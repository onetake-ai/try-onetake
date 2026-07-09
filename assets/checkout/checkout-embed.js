// OneTake AI - Embeddable Checkout Snippet
// Requires: pricing-data.js, translations.js, tracking-params.js, cohort.js, checkout-core.js
//
// Usage:
//   <div id="onetake-checkout"></div>
//   <script src="https://try.onetake.ai/assets/checkout/checkout-embed.js"
//           data-plans="launch-monthly-trial,pro-monthly-trial"
//           data-container="onetake-checkout"></script>

(function() {
    'use strict';

    // Capture currentScript at parse time (unavailable after async execution)
    var scriptEl = document.currentScript;
    if (!scriptEl) return;

    var scriptSrc = scriptEl.src;
    var baseUrl = scriptSrc.substring(0, scriptSrc.lastIndexOf('/') + 1);
    var siteRoot = baseUrl.replace(/assets\/checkout\/$/, '');

    // Parse configuration from data attributes on the script tag
    var config = {
        plans: (scriptEl.getAttribute('data-plans') || '').split(',').filter(Boolean),
        containerId: scriptEl.getAttribute('data-container'),
        cta1: scriptEl.getAttribute('data-cta-1') || '',
        cta2: scriptEl.getAttribute('data-cta-2') || '',
        successUrl: scriptEl.getAttribute('data-success-url') || ''
    };

    if (!config.containerId || config.plans.length === 0) {
        console.error('OneTake Checkout Embed: data-container and data-plans are required');
        return;
    }

    // Embed-local state (independent from app.js state; passed to checkout-core functions)
    var state = {
        currentLanguage: 'en',
        planKey: null,
        planInfo: null,
        productId: null,
        hasTrial: false,
        hasOneTimeCharge: false,
        formData: {
            firstName: '',
            email: '',
            useCases: [],
            estimatedVolume: ''
        },
        trackingParams: {},
        downsellShown: false,
        downsellAccepted: false,
        originalPlanKey: '',
        downsellPlanKey: null,
        downsellPlanInfo: null,
        checkoutCompleted: false
    };

    var isSandbox = new URLSearchParams(window.location.search).get('environment') === 'sandbox';
    var activePlanPresets = null;   // Set to planPresets or sandboxPlanPresets after deps load
    var core = null;                // Reference to window.oneTakeCheckout
    var container = null;           // Mount-point DOM element
    var localizedPrices = {};       // productId → localized price string from Paddle PricePreview

    // ======================================================================
    // DEPENDENCY LOADING
    // ======================================================================

    // Load a script by URL; resolves immediately if Paddle is already present
    function loadScript(src) {
        return new Promise(function(resolve, reject) {
            if (src.indexOf('paddle.js') !== -1 && typeof Paddle !== 'undefined') { resolve(); return; }
            var s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = resolve;
            s.onerror = function() { reject(new Error('Failed to load: ' + src)); };
            document.head.appendChild(s);
        });
    }

    // Inject a <link rel="stylesheet"> into the document head
    function loadCSS(href) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    // Load Montserrat font if not already present on the host page
    function loadFont() {
        if (document.querySelector('link[href*="montserrat"]')) return;
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.bunny.net/css?family=montserrat:300,400,500,600,700';
        document.head.appendChild(link);
    }

    // Load CSS, font, and all JS dependencies in parallel
    function loadDependencies() {
        loadCSS(baseUrl + 'checkout-embed.css');
        loadFont();

        var scripts = [
            siteRoot + 'pricing-data.js',
            siteRoot + 'translations.js',
            siteRoot + 'tracking-params.js',
            siteRoot + 'cohort.js',
            siteRoot + 'tools.js',
            baseUrl + 'checkout-core.js',
            'https://cdn.paddle.com/paddle/v2/paddle.js'
        ];

        return Promise.all(scripts.map(function(src) {
            return loadScript(src).catch(function(err) {
                console.warn('OneTake Checkout Embed:', err.message);
            });
        }));
    }

    // ======================================================================
    // TRANSLATION / PRICE HELPERS
    // ======================================================================

    // Shorthand for translated strings; delegates to checkout-core
    function t(key, params) {
        if (core) return core.getTranslation(state.currentLanguage, key, params);
        return key;
    }

    // Return the trial length in days for a plan (fallback to default)
    function getTrialDays(planInfo) {
        return (planInfo && planInfo.trial) || (typeof DEFAULT_TRIAL_DAYS !== 'undefined' ? DEFAULT_TRIAL_DAYS : 3);
    }

    // Map recurrence key (monthly/yearly/quarterly) to translated suffix
    function getRecurrenceLabel(recurrence) {
        var map = {
            monthly: t('downsell.perMonth'),
            yearly: t('downsell.perYear'),
            quarterly: t('downsell.perQuarter')
        };
        return map[recurrence] || '/' + recurrence;
    }

    // Build EUR fallback price text (shown until PricePreview responds)
    function buildFallbackPriceText(planInfo) {
        var price = planInfo.firstExpectedPayment || 0;
        var suffix = getRecurrenceLabel(planInfo.recurrence);
        var text = '';
        if (planInfo.trial) {
            text = t('downsell.trialNote', { days: planInfo.trial }) + ', ';
        }
        text += price + ' €' + suffix;
        return text;
    }

    // Build price text using the localized amount from Paddle PricePreview
    function buildLocalizedPriceText(planInfo, localizedPrice) {
        var suffix = getRecurrenceLabel(planInfo.recurrence);
        var text = '';
        if (planInfo.trial) {
            text = t('downsell.trialNote', { days: planInfo.trial }) + ', ';
        }
        text += localizedPrice + suffix;
        return text;
    }

    // Call Paddle PricePreview to get visitor-localized prices for all plans
    function fetchLocalizedPrices() {
        if (typeof Paddle === 'undefined') return;

        // Build PricePreview items from configured plan product IDs
        var items = config.plans.map(function(key) {
            var preset = activePlanPresets[key];
            if (!preset) return null;
            return { priceId: preset.product, quantity: 1 };
        }).filter(Boolean);

        if (items.length === 0) return;

        try {
            Paddle.PricePreview({
                items: items
            }).then(function(result) {
                // Parse lineItems from the PricePreview response
                if (result && result.data && result.data.details && result.data.details.lineItems) {
                    result.data.details.lineItems.forEach(function(item) {
                        var priceId = item.price && item.price.id;
                        var formatted = item.formattedTotals && item.formattedTotals.total;
                        if (priceId && formatted) {
                            // Extract numeric amount (in minor units) and currency symbol
                            var amount = parseInt(formatted.replace(/[^0-9]/g, ''), 10);
                            var symbol = formatted.replace(/[\d\s.,]/g, '').trim();
                            // Format: "S$59" for short symbols, "59 CHF" for longer ones
                            localizedPrices[priceId] = (symbol.length <= 3 ? symbol : '') + Math.round(amount / 100 || 0);
                            if (symbol.length > 3) {
                                localizedPrices[priceId] = Math.round(amount / 100 || 0) + ' ' + symbol;
                            }
                        }
                    });
                }
                updatePlanRadioLabels();
            }).catch(function(err) {
                console.warn('PricePreview failed:', err);
            });
        } catch (e) {
            console.warn('PricePreview error:', e);
        }
    }

    // Replace EUR fallback text in plan radio labels with localized prices
    function updatePlanRadioLabels() {
        config.plans.forEach(function(key) {
            var preset = activePlanPresets[key];
            if (!preset) return;
            var priceEl = container.querySelector('[data-plan-price="' + key + '"]');
            if (!priceEl) return;
            var localized = localizedPrices[preset.product];
            if (localized) {
                priceEl.textContent = buildLocalizedPriceText(preset, localized);
            }
        });
    }

    // ======================================================================
    // RENDERING
    // ======================================================================

    // Return the correct headline translation key based on plan type
    function getHeadlineKey() {
        if (state.hasOneTimeCharge) return 'headlineOneDollarTrial';
        if (state.hasTrial) return 'headline';
        return 'headlineNoTrial';
    }

    // Resolve CTA button text (prefers data-cta attributes, then translated defaults)
    function getButtonText(step) {
        if (step === 1 && config.cta1) return config.cta1;
        if (step === 2 && config.cta2) return config.cta2;
        if (step === 2 && config.cta1) return config.cta1;
        if (state.hasOneTimeCharge) return t('button.submitOneDollarTrial');
        if (state.hasTrial) return t('button.submit');
        return t('button.submitNoTrial');
    }

    // Render step 1: first name, email, plan radio (if multi-plan), and CTA
    function renderStep1() {
        var multiPlan = config.plans.length > 1;
        var trialDays = state.planInfo ? getTrialDays(state.planInfo) : 3;

        var html = '<div class="otc-root" style="position:relative;">' +
            '<div class="otc-card">' +
            '<h2 class="otc-title">' + t(getHeadlineKey(), { days: trialDays }) + '</h2>' +
            '<div class="otc-step" id="otcStep1">' +
            '<div class="otc-group">' +
            '<label class="otc-label" for="otcFirstName">' + t('label.firstName') + '</label>' +
            '<input class="otc-input" type="text" id="otcFirstName" placeholder="' + t('placeholder.firstName') + '" autocomplete="given-name">' +
            '<span class="otc-error-msg" id="otcFirstNameError"></span>' +
            '</div>' +
            '<div class="otc-group">' +
            '<label class="otc-label" for="otcEmail">' + t('label.email') + '</label>' +
            '<input class="otc-input" type="email" id="otcEmail" placeholder="' + t('placeholder.email') + '" autocomplete="email">' +
            '<span class="otc-error-msg" id="otcEmailError"></span>' +
            '</div>';

        if (multiPlan) {
            html += '<div class="otc-plans">';
            config.plans.forEach(function(key, idx) {
                var preset = activePlanPresets[key];
                if (!preset) return;
                var checked = idx === 0 ? ' checked' : '';
                var selectedClass = idx === 0 ? ' otc-selected' : '';
                html += '<div class="otc-plan-option' + selectedClass + '" data-plan-key="' + key + '">' +
                    '<input type="radio" name="otcPlan" value="' + key + '"' + checked + '>' +
                    '<div class="otc-plan-text">' +
                    '<span class="otc-plan-name">' + (preset.tier || key) + '</span>' +
                    '<span class="otc-plan-price" data-plan-price="' + key + '">' + buildFallbackPriceText(preset) + '</span>' +
                    '</div>' +
                    '</div>';
            });
            html += '</div>';
        }

        html += '<button type="button" class="otc-btn" id="otcCta1">' + getButtonText(1) + '</button>' +
            '</div>';

        html += '<div class="otc-step" id="otcStep2" hidden>' +
            renderStep2Fields() +
            '<button type="button" class="otc-btn" id="otcCta2">' + getButtonText(2) + '</button>' +
            '</div>';

        html += '<div class="otc-privacy"><p>' + t('footer.privacy') + '</p></div>' +
            '</div>' +
            '<div class="otc-downsell-overlay" id="otcDownsell"></div>' +
            '</div>';

        container.innerHTML = html;
        bindStep1Events();
    }

    // Render step 2 fields: use case multi-select dropdown and frequency select
    function renderStep2Fields() {
        var useCases = typeof useCaseValues !== 'undefined' ? useCaseValues : [];
        var html = '<div class="otc-group">' +
            '<label class="otc-label">' + t('label.useCases') + '</label>' +
            '<div class="otc-dropdown" id="otcUseCaseDropdown">' +
            '<button type="button" class="otc-dropdown-trigger" id="otcUseCaseTrigger">' +
            '<div class="otc-chips" id="otcUseCaseChips"><span class="otc-placeholder">' + t('label.useCases') + '</span></div>' +
            '<svg class="otc-dropdown-arrow" width="12" height="8" viewBox="0 0 12 8"><path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' +
            '</button>' +
            '<div class="otc-dropdown-menu" id="otcUseCaseMenu">';

        useCases.forEach(function(uc) {
            html += '<div class="otc-dropdown-option" data-value="' + uc + '">' +
                '<input type="checkbox" value="' + uc + '">' +
                '<span>' + t('useCase.' + uc) + '</span>' +
                '</div>';
        });

        html += '</div></div>' +
            '<span class="otc-error-msg" id="otcUseCaseError"></span>' +
            '</div>';

        html += '<div class="otc-group">' +
            '<label class="otc-label" for="otcFrequency">' + t('label.usageFrequency') + '</label>' +
            '<select class="otc-select" id="otcFrequency">' +
            '<option value="">' + t('option.selectFrequency') + '</option>' +
            '<option value="daily">' + t('option.daily') + '</option>' +
            '<option value="several_per_week">' + t('option.severalWeek') + '</option>' +
            '<option value="once_a_week">' + t('option.onceWeek') + '</option>' +
            '<option value="few_per_month">' + t('option.fewMonth') + '</option>' +
            '<option value="rarely">' + t('option.rarely') + '</option>' +
            '<option value="want_to">' + t('option.wantTo') + '</option>' +
            '<option value="never">' + t('option.never') + '</option>' +
            '</select>' +
            '</div>';

        return html;
    }

    // ======================================================================
    // EVENT BINDING
    // ======================================================================

    // Bind step 1 CTA click and plan radio selection handlers
    function bindStep1Events() {
        var cta1 = container.querySelector('#otcCta1');
        if (cta1) cta1.addEventListener('click', handleStep1Submit);

        var planOptions = container.querySelectorAll('.otc-plan-option');
        planOptions.forEach(function(opt) {
            opt.addEventListener('click', function() {
                var radio = opt.querySelector('input[type="radio"]');
                radio.checked = true;
                planOptions.forEach(function(o) { o.classList.remove('otc-selected'); });
                opt.classList.add('otc-selected');
                selectPlan(opt.getAttribute('data-plan-key'));
            });
        });

        if (config.plans.length === 1) {
            selectPlan(config.plans[0]);
        } else if (config.plans.length > 1) {
            selectPlan(config.plans[0]);
        }
    }

    // Bind step 2 CTA click, use case dropdown toggle, and outside-click close
    function bindStep2Events() {
        var cta2 = container.querySelector('#otcCta2');
        if (cta2) cta2.addEventListener('click', handleStep2Submit);

        var dropdown = container.querySelector('#otcUseCaseDropdown');
        var trigger = container.querySelector('#otcUseCaseTrigger');
        var menu = container.querySelector('#otcUseCaseMenu');

        if (trigger) {
            trigger.addEventListener('click', function(e) {
                e.stopPropagation();
                dropdown.classList.toggle('otc-open');
            });
        }

        if (menu) {
            var options = menu.querySelectorAll('.otc-dropdown-option');
            options.forEach(function(opt) {
                opt.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var cb = opt.querySelector('input[type="checkbox"]');
                    cb.checked = !cb.checked;
                    updateUseCaseSelection();
                });
            });
        }

        document.addEventListener('click', function(e) {
            if (dropdown && !dropdown.contains(e.target)) {
                dropdown.classList.remove('otc-open');
            }
        });
    }

    // Sync use case chips display with checkbox state; update form data
    function updateUseCaseSelection() {
        var menu = container.querySelector('#otcUseCaseMenu');
        var chipsContainer = container.querySelector('#otcUseCaseChips');
        if (!menu || !chipsContainer) return;

        var selected = [];
        menu.querySelectorAll('input[type="checkbox"]:checked').forEach(function(cb) {
            selected.push(cb.value);
        });
        state.formData.useCases = selected;

        if (selected.length === 0) {
            chipsContainer.innerHTML = '<span class="otc-placeholder">' + t('label.useCases') + '</span>';
        } else {
            chipsContainer.innerHTML = selected.map(function(uc) {
                return '<span class="otc-chip">' + t('useCase.' + uc) +
                    '<button type="button" class="otc-chip-remove" data-uc="' + uc + '">×</button></span>';
            }).join('');
            chipsContainer.querySelectorAll('.otc-chip-remove').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var ucVal = btn.getAttribute('data-uc');
                    var cb = menu.querySelector('input[value="' + ucVal + '"]');
                    if (cb) cb.checked = false;
                    updateUseCaseSelection();
                });
            });
        }

        var errorEl = container.querySelector('#otcUseCaseError');
        if (errorEl && selected.length > 0) errorEl.textContent = '';
    }

    // Resolve a plan key and update state + UI (headline, CTA text)
    function selectPlan(planKey) {
        var resolved = core.resolvePlan(planKey, activePlanPresets);
        if (!resolved) return;
        state.planKey = resolved.planKey;
        state.planInfo = resolved.planInfo;
        state.productId = resolved.productId;
        state.hasTrial = resolved.hasTrial;
        state.hasOneTimeCharge = resolved.hasOneTimeCharge;

        var titleEl = container.querySelector('.otc-title');
        if (titleEl) {
            titleEl.textContent = t(getHeadlineKey(), { days: getTrialDays(state.planInfo) });
        }

        var cta1 = container.querySelector('#otcCta1');
        if (cta1) cta1.textContent = getButtonText(1);
        var cta2 = container.querySelector('#otcCta2');
        if (cta2) cta2.textContent = getButtonText(2);
    }

    // Validate step 1 (name + email) and transition to step 2
    function handleStep1Submit() {
        var firstNameInput = container.querySelector('#otcFirstName');
        var emailInput = container.querySelector('#otcEmail');
        var firstNameError = container.querySelector('#otcFirstNameError');
        var emailError = container.querySelector('#otcEmailError');
        var valid = true;

        var firstName = (firstNameInput.value || '').trim();
        var email = (emailInput.value || '').trim();

        if (!firstName) {
            firstNameInput.classList.add('otc-error');
            firstNameError.textContent = t('error.required');
            valid = false;
        } else {
            firstNameInput.classList.remove('otc-error');
            firstNameError.textContent = '';
        }

        if (!email) {
            emailInput.classList.add('otc-error');
            emailError.textContent = t('error.required');
            valid = false;
        } else if (!core.isValidEmail(email)) {
            emailInput.classList.add('otc-error');
            emailError.textContent = t('error.email');
            valid = false;
        } else {
            emailInput.classList.remove('otc-error');
            emailError.textContent = '';
        }

        if (!valid) return;

        state.formData.firstName = firstName;
        state.formData.email = email;

        var step1 = container.querySelector('#otcStep1');
        var step2 = container.querySelector('#otcStep2');
        step1.hidden = true;
        step2.hidden = false;
        bindStep2Events();
    }

    // Validate step 2, fire tracking events, and open Paddle checkout
    function handleStep2Submit() {
        // Validate form
        var useCaseError = container.querySelector('#otcUseCaseError');
        var valid = true;

        if (state.formData.useCases.length === 0) {
            useCaseError.textContent = t('error.useCases');
            var trigger = container.querySelector('#otcUseCaseTrigger');
            if (trigger) trigger.classList.add('otc-error');
            valid = false;
        } else {
            useCaseError.textContent = '';
            var trigger2 = container.querySelector('#otcUseCaseTrigger');
            if (trigger2) trigger2.classList.remove('otc-error');
        }

        var freqSelect = container.querySelector('#otcFrequency');
        if (freqSelect) {
            state.formData.estimatedVolume = freqSelect.value;
        }

        if (!valid) return;

        var cta2 = container.querySelector('#otcCta2');
        if (cta2) {
            cta2.disabled = true;
            cta2.innerHTML = '<span class="otc-spinner"></span>';
        }

        // Collect tracking params from URL
        if (window.oneTakeTracking) {
            state.trackingParams = window.oneTakeTracking.parseTrackingParams();
        }

        // Track formSubmit event across analytics providers
        core.trackFormSubmit(state, isSandbox);

        // Expose state for external access (e.g. tracking scripts)
        window.oneTakeState = state;

        // Open Paddle checkout
        var checkoutOpts = {
            onError: function(msg) {
                console.error(msg);
                if (cta2) {
                    cta2.disabled = false;
                    cta2.textContent = getButtonText(2);
                }
            }
        };
        if (config.successUrl) {
            checkoutOpts.successUrl = config.successUrl;
        }

        core.openCheckout(state, activePlanPresets, checkoutOpts);

        if (cta2) {
            cta2.disabled = false;
            cta2.textContent = getButtonText(2);
        }
    }

    // ======================================================================
    // PADDLE EVENT HANDLING
    // ======================================================================

    // Route Paddle checkout events (completed → track purchase; closed → show downsell)
    function handlePaddleEvent(data) {
        if (!data || !data.name) return;

        if (data.name === 'checkout.completed' && !state.checkoutCompleted) {
            state.checkoutCompleted = true;
            core.trackPurchase(state, data, isSandbox);
        }

        if (data.name === 'checkout.closed' && !state.checkoutCompleted) {
            state.downsellShown = true;
            core.maybeShowDownsell(state, activePlanPresets, showDownsellModal);
        }
    }

    // ======================================================================
    // DOWNSELL
    // ======================================================================

    // Render the downsell overlay with plan details and localized price
    function showDownsellModal(downsellKey, downsellPlan, originalPlanKey) {
        state.downsellPlanKey = downsellKey;
        state.downsellPlanInfo = downsellPlan;

        var overlay = container.querySelector('#otcDownsell');
        if (!overlay) return;

        // Determine downsell type: yearly→monthly or higher→lower tier
        var isYearly = (state.planInfo && state.planInfo.recurrence === 'yearly') &&
                       downsellPlan.recurrence === 'monthly';
        var titleKey = isYearly ? 'downsell.title.yearly' : 'downsell.title.tier';
        var bodyKey = isYearly ? 'downsell.body.yearly' : 'downsell.body.tier';

        var priceText = downsellPlan.firstExpectedPayment + ' €' + getRecurrenceLabel(downsellPlan.recurrence);
        var localizedPrice = localizedPrices[downsellPlan.product];
        if (localizedPrice) {
            priceText = localizedPrice + getRecurrenceLabel(downsellPlan.recurrence);
        }

        var noteHtml = '';
        if (downsellPlan.trial) {
            noteHtml = '<div class="otc-downsell-plan-note">' +
                t('downsell.trialNote', { days: downsellPlan.trial }) + '</div>';
        }

        overlay.innerHTML = '<div class="otc-downsell-card">' +
            '<button class="otc-downsell-close" id="otcDsClose">×</button>' +
            '<div class="otc-downsell-eyebrow">' + t('downsell.eyebrow') + '</div>' +
            '<div class="otc-downsell-title">' + t(titleKey) + '</div>' +
            '<div class="otc-downsell-body">' + t(bodyKey) + '</div>' +
            '<div class="otc-downsell-plan">' +
            '<div class="otc-downsell-plan-label">' + t('downsell.planLabel') + '</div>' +
            '<div class="otc-downsell-plan-price">' + priceText + '</div>' +
            noteHtml +
            '</div>' +
            '<button class="otc-downsell-cta" id="otcDsAccept">' + t('downsell.cta') + '</button>' +
            '<button class="otc-downsell-dismiss" id="otcDsDismiss">' + t('downsell.dismiss') + '</button>' +
            '</div>';

        overlay.classList.add('otc-open');

        overlay.querySelector('#otcDsClose').addEventListener('click', hideDownsell);
        overlay.querySelector('#otcDsDismiss').addEventListener('click', hideDownsell);
        overlay.querySelector('#otcDsAccept').addEventListener('click', handleAcceptDownsell);
    }

    // Close the downsell overlay
    function hideDownsell() {
        var overlay = container.querySelector('#otcDownsell');
        if (overlay) overlay.classList.remove('otc-open');
    }

    // Accept the downsell offer: switch plan and reopen Paddle checkout
    function handleAcceptDownsell() {
        hideDownsell();
        core.acceptDownsell(state, isSandbox);
        state.checkoutCompleted = false;

        var checkoutOpts = {};
        if (config.successUrl) {
            checkoutOpts.successUrl = config.successUrl;
        }
        core.openCheckout(state, activePlanPresets, checkoutOpts);
    }

    // ======================================================================
    // INITIALIZATION
    // ======================================================================

    // Bootstrap the embed: load deps, init Paddle, resolve plans, render form
    function init() {
        // Find the mount-point container element
        container = document.getElementById(config.containerId);
        if (!container) {
            console.error('OneTake Checkout Embed: container #' + config.containerId + ' not found');
            return;
        }

        // Show loading spinner while dependencies load
        container.innerHTML = '<div class="otc-root"><div class="otc-card" style="text-align:center;padding:3rem"><span class="otc-spinner"></span></div></div>';

        loadDependencies().then(function() {
            // Grab reference to checkout-core API
            core = window.oneTakeCheckout;
            if (!core) {
                console.error('OneTake Checkout Embed: checkout-core.js failed to load');
                return;
            }

            // Select live or sandbox plan presets
            activePlanPresets = isSandbox ? (typeof sandboxPlanPresets !== 'undefined' ? sandboxPlanPresets : {}) : (typeof planPresets !== 'undefined' ? planPresets : {});

            // Detect browser language
            state.currentLanguage = core.detectLanguage();

            // Parse UTM/ad tracking params from URL
            if (window.oneTakeTracking) {
                state.trackingParams = window.oneTakeTracking.parseTrackingParams();
            }

            // Initialize Paddle SDK with event callback
            core.initPaddle(isSandbox, handlePaddleEvent);

            // Resolve first plan and render the form
            selectPlan(config.plans[0]);
            renderStep1();

            // Fetch localized prices to replace EUR fallback text
            fetchLocalizedPrices();
        }).catch(function(err) {
            console.error('OneTake Checkout Embed: initialization failed', err);
        });
    }

    // Run init when DOM is ready (or immediately if already loaded)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
