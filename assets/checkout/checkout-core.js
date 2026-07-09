// OneTake AI - Shared Checkout Logic
// Requires: pricing-data.js, translations.js, tracking-params.js, cohort.js

(function() {
    'use strict';

    // ==========================================
    // CONSTANTS / DEFAULTS
    // ==========================================

    var DEFAULT_FREE_TO_PAID_CONVERSION_RATE = 0.30; // 30% of trials convert to paid
    var DEFAULT_CURRENCY = 'EUR';                     // All prices assumed in EUR
    var UNKNOWN_PRODUCT_EXPECTED_VALUE = 1;            // Fallback for unknown product IDs

    // Default plan info for unknown direct product links
    var DEFAULT_PLAN_INFO = {
        tier: 'OneTake AI',
        recurrence: 'yearly',
        trial: null,
        product: null,                                // Will be set from URL
        firstExpectedPayment: 120,
        freeToPaidConversionRate: DEFAULT_FREE_TO_PAID_CONVERSION_RATE
    };

    // Map browser language codes to supported translations
    var LANG_MAP = {
        'en': 'en',
        'fr': 'fr',
        'es': 'es',
        'pt': 'pt-br',
        'it': 'it',
        'ja': 'ja',
        'ru': 'ru',
        'de': 'de'
    };

    // Detect browser language with English fallback
    function detectLanguage() {
        var browserLang = navigator.language || navigator.userLanguage;
        var langCode = browserLang.toLowerCase().split('-')[0];
        return LANG_MAP[langCode] || 'en';
    }

    // Strip region subtag (e.g. pt-br → pt)
    function getTwoLetterLanguageCode(lang) {
        return lang.split('-')[0];
    }

    // Translation lookup with English fallback and {placeholder} substitution
    function getTranslation(lang, key, params) {
        var raw = (translations[lang] && translations[lang][key])
               || (translations['en'] && translations['en'][key])
               || key;
        return applyTranslationParams(raw, params);
    }

    // Resolve a plan key into a structured plan object
    function resolvePlan(planKey, presets) {
        var preset = presets[planKey];
        if (!preset) return null;
        return {
            planKey: planKey,
            planInfo: preset,
            productId: preset.product,
            hasTrial: !!preset.trial,
            hasOneTimeCharge: !!preset.oneTimeCharge
        };
    }

    // Reverse-lookup: find plan key from a Paddle product ID
    function getPlanKeyByProductId(productId, presets) {
        return Object.keys(presets).find(function(key) {
            return presets[key].product === productId;
        }) || null;
    }

    // Calculate expected monetary value of a trial signup (conversionRate × firstExpectedPayment)
    function getExpectedTrialValue(state) {
        if (state.planInfo) {
            var rate = state.planInfo.freeToPaidConversionRate || DEFAULT_FREE_TO_PAID_CONVERSION_RATE;
            var payment = state.planInfo.firstExpectedPayment || UNKNOWN_PRODUCT_EXPECTED_VALUE;
            return parseFloat((rate * payment).toFixed(2));
        }
        return UNKNOWN_PRODUCT_EXPECTED_VALUE;
    }

    // Initialize the Paddle payment SDK (sandbox or live)
    function initPaddle(isSandbox, eventCallback) {
        if (typeof Paddle === 'undefined') {
            console.error('Paddle SDK not loaded');
            return;
        }
        var paddleToken = isSandbox
            ? 'test_a0712686526dbce8894bee10086'
            : 'live_bb0b00885e63d509a759b2e2b29';
        try {
            if (isSandbox) {
                Paddle.Environment.set("sandbox");
            }
            Paddle.Initialize({
                token: paddleToken,
                eventCallback: eventCallback
            });
            console.log('Paddle initialized' + (isSandbox ? ' (sandbox)' : ''));
        } catch (error) {
            console.error('Paddle initialization failed:', error);
        }
    }

    // Assemble custom metadata sent to Paddle with each checkout.
    // Includes user, plan, tracking, and cohort data so the backend can forward it via Paddle webhooks.
    function buildCheckoutCustomData(state, presets) {
        var lang = state.currentLanguage || 'en';
        var data = {
            plan: state.planKey || '',
            has_trial: String(!!state.hasTrial),
            estimated_volume: state.formData.estimatedVolume || '',
            first_name: state.formData.firstName || '',
            language: getTwoLetterLanguageCode(lang)
        };

        if (state.formData.useCases && state.formData.useCases.length > 0) {
            data.use_cases = state.formData.useCases.join(',');
        }

        if (state.planInfo) {
            data.plan_name = state.planInfo.tier || '';
            data.plan_interval = state.planInfo.recurrence || '';
            data.first_expected_payment = String(state.planInfo.firstExpectedPayment || '');
            data.free_to_paid_conversion_rate = String(state.planInfo.freeToPaidConversionRate || '');
        }
        if (state.productId) {
            data.plan_id = state.productId;
        }

        if (state.hasTrial) {
            data.expected_value = String(getExpectedTrialValue(state));
            data.trial_days = String(state.planInfo ? state.planInfo.trial : DEFAULT_TRIAL_DAYS);
        }

        // Include AnyTrack click ID for attribution
        if (typeof AnyTrack !== 'undefined') {
            var atclid = AnyTrack('atclid');
            if (atclid) {
                data.click_id = atclid;
            }
        }

        // Include FirstPromoter affiliate tracking ID
        var fpMatch = document.cookie.match(/_fprom_track=([^;]+)/);
        if (fpMatch) {
            data.fp_tid = decodeURIComponent(fpMatch[1]);
        }

        // Include UTM tracking params via tracking module
        if (window.oneTakeTracking) {
            window.oneTakeTracking.addTrackingToCustomData(data, state.trackingParams || {});
        }

        // Include cohort assignment via cohort module
        if (window.oneTakeCohort) {
            data.cohort = String(window.oneTakeCohort.assignCohort());
        }

        data.downsell_shown    = String(!!state.downsellShown);
        data.downsell_accepted = String(!!state.downsellAccepted);
        data.original_plan     = state.originalPlanKey || '';

        // Downsell checkout context — only present when the user accepted a downsell offer.
        // Lets the backend distinguish a downsell checkout from a normal checkout.
        if (state.downsellAccepted && state.originalPlanKey) {
            data.checkout_type = 'downsell';
            var originalPlan = presets[state.originalPlanKey];
            if (originalPlan) {
                data.original_plan_id       = originalPlan.product || '';
                data.original_plan_name     = originalPlan.tier || '';
                data.original_plan_interval = originalPlan.recurrence || '';
            }
        }

        return data;
    }

    // Open the Paddle checkout overlay
    function openCheckout(state, presets, opts) {
        if (typeof Paddle === 'undefined') {
            console.error('Paddle not available');
            if (opts && opts.onError) opts.onError('Payment system unavailable. Please try again.');
            return;
        }

        var items = [{
            priceId: state.productId,
            quantity: 1
        }];

        if (state.planInfo && state.planInfo.oneTimeCharge) {
            items.push({ priceId: state.planInfo.oneTimeCharge, quantity: 1 });
        }

        var customer = {
            email: state.formData.email
        };

        // Build success URL with query parameters
        var lang = state.currentLanguage || 'en';
        var successParams = new URLSearchParams({
            email: state.formData.email,
            language: getTwoLetterLanguageCode(lang),
            product: state.productId
        });

        if (state.planKey) {
            successParams.set('plan', state.planKey);
        }

        if (state.formData.useCases && state.formData.useCases.length > 0) {
            successParams.set('useCases', state.formData.useCases.join(','));
        }

        if (state.formData.estimatedVolume) {
            successParams.set('estimatedVolume', state.formData.estimatedVolume);
        }

        // Forward tracking params to onboarding page
        if (window.oneTakeTracking) {
            window.oneTakeTracking.addTrackingToSuccessUrl(successParams, state.trackingParams || {});
        }

        var successPath = (opts && opts.successUrl)
            || (state.planInfo && state.planInfo.successUrl)
            || '/onboarding/';
        var successUrl = /^https?:\/\//.test(successPath)
            ? successPath + '?' + successParams.toString()
            : 'https://try.onetake.ai' + successPath + '?' + successParams.toString();

        var settings = {
            displayMode: 'overlay',
            theme: 'light',
            locale: getTwoLetterLanguageCode(lang),
            successUrl: successUrl
        };

        // Build custom data for Paddle webhooks (plan info, form data, UTM params, cohort)
        var customData = buildCheckoutCustomData(state, presets);
        console.log('Custom data for Paddle:', customData);
        console.log('Opening Paddle checkout with:', { items: items, customer: customer, settings: settings, customData: customData });

        try {
            var checkoutConfig = {
                settings: settings,
                items: items,
                customer: customer
            };
            if (customData) {
                checkoutConfig.customData = customData;
            }
            Paddle.Checkout.open(checkoutConfig);
        } catch (error) {
            console.error('Paddle checkout error:', error);
            if (opts && opts.onError) opts.onError('Could not open checkout. Please try again.');
        }
    }

    // Fire analytics events on form submit (Plausible, AnyTrack, CrazyEgg)
    function trackFormSubmit(state, isSandbox) {
        var useCases = state.formData.useCases || [];

        // Check if any use case contains 'personal' or 'music' — skip tracking for non-ICP
        var hasInvalidUseCase = useCases.some(function(uc) {
            return uc.includes('music') || uc.includes('personal');
        });

        if (hasInvalidUseCase) {
            console.log('Skipping FormSubmit tracking - invalid ICP (personal/music)');
            return;
        }

        // Fire Plausible event (skip in sandbox)
        if (!isSandbox && typeof plausible !== 'undefined') {
            plausible('formSubmit', {
                props: {
                    use_cases: useCases.join(','),
                    estimated_volume: state.formData.estimatedVolume
                }
            });
            console.log('Plausible formSubmit event fired');
        }

        // Fire AnyTrack event
        if (typeof AnyTrack !== 'undefined') {
            AnyTrack('trigger', 'FormSubmit', {
                use_cases: useCases.join(','),
                estimated_volume: state.formData.estimatedVolume
            });
            console.log('AnyTrack FormSubmit event fired');
        }

        // Fire CrazyEgg conversion
        if (typeof CE2 !== 'undefined') {
            (window.CE_API || (window.CE_API=[])).push(function(){
                CE2.converted("ff76d55c-95cf-4be9-99a9-ef655b436cf9");
            });
            console.log('CrazyEgg formSubmit conversion fired');
        }
    }

    // Fire purchase analytics across three providers (AnyTrack, CrazyEgg, Plausible).
    // For trials, uses expectedValue (conversionRate × firstPayment) instead of actual charge.
    function trackPurchase(state, paddleData, isSandbox) {
        var isTrial = state.hasTrial;
        var expectedValue = isTrial ? getExpectedTrialValue(state) : null;
        var actualValue = (paddleData.data && paddleData.data.totals && paddleData.data.totals.total) || 0;

        var purchaseData = {
            value: isTrial ? expectedValue : actualValue,
            taxPrice: (paddleData.data && paddleData.data.totals && paddleData.data.totals.tax) || 0,
            currency: (paddleData.data && paddleData.data.currency_code) || DEFAULT_CURRENCY,
            transactionId: (paddleData.data && paddleData.data.transaction_id) || '',
            email: state.formData.email,
            firstName: state.formData.firstName,
            items: (paddleData.data && paddleData.data.items) || []
        };

        if (isTrial) {
            console.log('Trial purchase detected. Expected value:', expectedValue, DEFAULT_CURRENCY);
        }

        // AnyTrack Purchase event (value = expectedValue for trials)
        if (typeof AnyTrack !== 'undefined') {
            AnyTrack('trigger', 'Purchase', {
                value: purchaseData.value,
                taxPrice: purchaseData.taxPrice,
                currency: purchaseData.currency,
                transactionId: purchaseData.transactionId,
                email: purchaseData.email,
                firstName: purchaseData.firstName,
                items: purchaseData.items,
                downsell_shown:    state.downsellShown,
                downsell_accepted: state.downsellAccepted
            });
            console.log('AnyTrack Purchase event fired with value:', purchaseData.value);
        }

        // CrazyEgg Purchase conversion (worth = expectedValue for trials)
        if (typeof CE2 !== 'undefined') {
            var worth = isTrial ? expectedValue.toString() : (actualValue > 0 ? actualValue.toString() : UNKNOWN_PRODUCT_EXPECTED_VALUE.toString());
            var currency = purchaseData.currency || DEFAULT_CURRENCY;

            (window.CE_API || (window.CE_API=[])).push(function(){
                CE2.converted("f2ff5947-c667-49a1-85fd-210cdf91be10", {
                    worth: worth,
                    currency: currency
                });
            });
            console.log('CrazyEgg Purchase conversion fired with worth:', worth, 'currency:', currency);
        }

        // Plausible Purchase event (using revenue option for proper revenue attribution; skipped in sandbox)
        if (!isSandbox && typeof plausible !== 'undefined') {
            var plausibleOptions = {
                revenue: { amount: purchaseData.value, currency: purchaseData.currency },
                props: {
                    plan:              state.planKey || 'unknown',
                    downsell_shown:    String(state.downsellShown),
                    downsell_accepted: String(state.downsellAccepted)
                }
            };
            if (isTrial) {
                plausibleOptions.props.expectedValue = expectedValue;
            }
            plausible('Purchase', plausibleOptions);
            console.log('Plausible Purchase event fired with options:', plausibleOptions);
        }
    }

    // Decide whether to show the downsell offer after checkout close
    function maybeShowDownsell(state, presets, showModalFn) {
        var currentPlanKey = state.planKey || getPlanKeyByProductId(state.productId, presets);
        if (!currentPlanKey) return;

        var downsellKey = downsellMap[currentPlanKey];
        if (!downsellKey) return;

        var downsellPlan = presets[downsellKey];
        if (!downsellPlan) return;

        showModalFn(downsellKey, downsellPlan, currentPlanKey);
    }

    // Switch state to the downsell plan and fire analytics
    function acceptDownsell(state, isSandbox) {
        state.originalPlanKey  = state.planKey; // preserve before switch
        state.downsellAccepted = true;

        // Switch active plan to the downsell plan
        state.productId        = state.downsellPlanInfo.product;
        state.planKey          = state.downsellPlanKey;
        state.planInfo         = state.downsellPlanInfo;
        state.hasTrial         = !!state.downsellPlanInfo.trial;
        state.hasOneTimeCharge = !!(state.downsellPlanInfo && state.downsellPlanInfo.oneTimeCharge);
        state.checkoutCompleted = false; // Reset so a close on this new checkout is handled cleanly

        // Analytics (skipped in sandbox)
        if (!isSandbox && typeof plausible !== 'undefined') {
            plausible('DownsellAccepted', { props: { downsell_plan: state.downsellPlanKey } });
        }
        if (typeof AnyTrack !== 'undefined') {
            AnyTrack('trigger', 'DownsellAccepted', { downsell_plan: state.downsellPlanKey });
        }
        console.log('Downsell accepted:', state.downsellPlanKey);
    }

    // Fisher-Yates shuffle
    function shuffleArray(array) {
        var shuffled = array.slice();
        for (var i = shuffled.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
        }
        return shuffled;
    }

    // Basic email format validation
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // Promise-based delay utility
    function sleep(ms) {
        return new Promise(function(resolve) { setTimeout(resolve, ms); });
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    window.oneTakeCheckout = {
        DEFAULT_FREE_TO_PAID_CONVERSION_RATE: DEFAULT_FREE_TO_PAID_CONVERSION_RATE,
        DEFAULT_CURRENCY: DEFAULT_CURRENCY,
        DEFAULT_PLAN_INFO: DEFAULT_PLAN_INFO,
        LANG_MAP: LANG_MAP,
        detectLanguage: detectLanguage,
        getTwoLetterLanguageCode: getTwoLetterLanguageCode,
        getTranslation: getTranslation,
        resolvePlan: resolvePlan,
        getPlanKeyByProductId: getPlanKeyByProductId,
        getExpectedTrialValue: getExpectedTrialValue,
        initPaddle: initPaddle,
        buildCheckoutCustomData: buildCheckoutCustomData,
        openCheckout: openCheckout,
        trackFormSubmit: trackFormSubmit,
        trackPurchase: trackPurchase,
        maybeShowDownsell: maybeShowDownsell,
        acceptDownsell: acceptDownsell,
        shuffleArray: shuffleArray,
        isValidEmail: isValidEmail,
        sleep: sleep
    };

})();
