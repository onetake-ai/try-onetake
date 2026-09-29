// OneTake AI - Instagram free trial landing page
// Requires: pricing-data.js, translations.js, tracking-params.js, cohort.js,
//           checkout-core.js, price-localizer.js (see script order in index.html)

(function() {
    'use strict';

    var PLAN_KEY = 'launch-monthly-trial';

    var core = window.oneTakeCheckout;
    var isSandbox = new URLSearchParams(window.location.search).get('environment') === 'sandbox';
    var activePlanPresets = isSandbox ? sandboxPlanPresets : planPresets;
    // Sandbox presets don't list every plan; fall back to the live preset
    var plan = activePlanPresets[PLAN_KEY] || planPresets[PLAN_KEY];

    // State shape expected by checkout-core.js (same as app.js)
    var state = {
        formData: { firstName: '', email: '', useCases: [], estimatedVolume: '' },
        currentLanguage: 'en',
        planKey: PLAN_KEY,
        planInfo: plan,
        productId: plan.product,
        hasTrial: !!plan.trial,
        hasOneTimeCharge: !!plan.oneTimeCharge,
        trackingParams: {},
        checkoutCompleted: false,
        downsellShown: false,
        downsellAccepted: false,
        originalPlanKey: null,
        isSubmitting: false
    };

    var els = {};

    // ==========================================
    // LANGUAGE
    // ==========================================

    // Map a Weglot / <html lang> code to a language code checkout-core.js understands
    function normalizeLanguage(code) {
        code = (code || '').toLowerCase();
        if (code.indexOf('pt') === 0) return 'pt-br';
        return core.LANG_MAP[code.split('-')[0]] || 'en';
    }

    // Current page language: Weglot first, then <html lang> (Weglot updates it), then English
    function getPageLanguage() {
        if (window.Weglot && typeof Weglot.getCurrentLang === 'function') {
            try {
                var lang = Weglot.getCurrentLang();
                if (lang) return normalizeLanguage(lang);
            } catch (e) { /* Weglot not initialized yet */ }
        }
        return normalizeLanguage(document.documentElement.lang);
    }

    // Messages live in the HTML (#messages) so Weglot translates them
    function message(key) {
        var el = document.querySelector('#messages [data-msg="' + key + '"]');
        return el ? el.textContent.trim() : '';
    }

    // ==========================================
    // FORM
    // ==========================================

    function showError(text, field) {
        els.formError.textContent = text;
        els.formError.hidden = false;
        [els.firstName, els.email].forEach(function(input) {
            input.setAttribute('aria-invalid', String(input === field));
        });
        if (field) field.focus();
    }

    function clearError() {
        els.formError.hidden = true;
        els.formError.textContent = '';
        els.firstName.removeAttribute('aria-invalid');
        els.email.removeAttribute('aria-invalid');
    }

    function setLoading(isLoading) {
        els.submitBtn.disabled = isLoading;
        els.submitBtn.querySelector('.btn__label').hidden = isLoading;
        els.submitBtn.querySelector('.btn__loading').hidden = !isLoading;
    }

    function handleSubmit(event) {
        event.preventDefault();
        if (state.isSubmitting) return;

        var firstName = els.firstName.value.trim();
        var email = els.email.value.trim();

        if (!firstName) {
            showError(message('firstName'), els.firstName);
            return;
        }
        if (!core.isValidEmail(email)) {
            showError(message('email'), els.email);
            return;
        }
        clearError();

        state.formData.firstName = firstName;
        state.formData.email = email;
        state.isSubmitting = true;
        setLoading(true);

        // Same tracking as the main signup page (app.js)
        core.trackFormSubmit(state, isSandbox);
        if (window.fpr) window.fpr('referral', { email: email });

        core.sleep(500).then(openCheckout);
    }

    function openCheckout() {
        state.currentLanguage = getPageLanguage();
        if (window.oneTakeTracking) {
            state.trackingParams = window.oneTakeTracking.parseTrackingParams();
        }
        window.oneTakeState = state;

        var failed = false;
        core.openCheckout(state, activePlanPresets, {
            onError: function() {
                failed = true;
                showCheckoutError();
            }
        });

        if (!failed) {
            // Paddle's overlay is open; reset the button for when it closes
            state.isSubmitting = false;
            setLoading(false);
        }
    }

    function showCheckoutError() {
        state.isSubmitting = false;
        setLoading(false);
        // If we're in the "one step away" state, go back to the form so the message is visible
        showForm();
        showError(message('checkout'), null);
    }

    // ==========================================
    // ONE STEP AWAY STATE
    // ==========================================

    function showOneStep() {
        els.signup.hidden = true;
        els.oneStep.hidden = false;
        els.oneStep.scrollIntoView({ block: 'center' });
    }

    function showForm() {
        els.oneStep.hidden = true;
        els.signup.hidden = false;
    }

    // ==========================================
    // PADDLE EVENTS (mirrors app.js, minus the downsell)
    // ==========================================

    function handlePaddleEvent(data) {
        if (data.name === 'checkout.completed') {
            state.checkoutCompleted = true;
            core.trackPurchase(state, data, isSandbox);
        }

        if (data.name === 'checkout.closed' && !state.checkoutCompleted) {
            showOneStep();
        }

        if (data.name === 'checkout.customer.updated' && typeof AnyTrack !== 'undefined') {
            AnyTrack('trigger', 'InitiateCheckout', {});
        }

        if (data.name === 'checkout.payment.selected' && typeof AnyTrack !== 'undefined') {
            AnyTrack('trigger', 'AddPaymentInfo', {});
        }
    }

    // ==========================================
    // STICKY CTA AND SCROLL TO FORM
    // ==========================================

    // The block currently holding the form or the "one step away" message
    function activeSignupBlock() {
        return els.oneStep.hidden ? els.signup : els.oneStep;
    }

    function goToForm() {
        var block = activeSignupBlock();
        var target = els.oneStep.hidden ? els.firstName : els.reopenBtn;
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        block.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        target.focus({ preventScroll: true });
    }

    function setupStickyCta() {
        if (!('IntersectionObserver' in window)) return;

        var visible = { signup: true, oneStep: false, final: false };

        function update() {
            // Hidden while the form (or the one-step panel, or the final CTA) is on screen
            var show = !visible.signup && !visible.oneStep && !visible.final;
            els.stickyCta.classList.toggle('is-visible', show);
            els.stickyCta.setAttribute('aria-hidden', String(!show));
            els.stickyCta.querySelector('button').tabIndex = show ? 0 : -1;
        }

        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                // A hidden element never intersects, which is what we want
                visible[entry.target.dataset.stickyKey] = entry.isIntersecting;
            });
            update();
        });

        els.signup.dataset.stickyKey = 'signup';
        els.oneStep.dataset.stickyKey = 'oneStep';
        els.finalCta.dataset.stickyKey = 'final';
        observer.observe(els.signup);
        observer.observe(els.oneStep);
        observer.observe(els.finalCta);
    }

    // ==========================================
    // LAZY MEDIA AND FAQ
    // ==========================================

    // Below-the-fold videos load their poster and source only when near the viewport
    function setupLazyVideos() {
        var videos = document.querySelectorAll('.lazy-video');

        function load(video) {
            if (video.dataset.poster) video.poster = video.dataset.poster;
            if (video.dataset.src) {
                video.src = video.dataset.src;
                video.play().catch(function() {});
            }
        }

        if (!('IntersectionObserver' in window)) {
            videos.forEach(load);
            return;
        }

        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (!entry.isIntersecting) return;
                load(entry.target);
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '300px 0px' });

        videos.forEach(function(video) { observer.observe(video); });
    }

    // Keep one FAQ answer open at a time
    function setupFaq() {
        var items = document.querySelectorAll('#faq details');
        items.forEach(function(item) {
            item.addEventListener('toggle', function() {
                if (!item.open) return;
                items.forEach(function(other) {
                    if (other !== item) other.open = false;
                });
            });
        });
    }

    // ==========================================
    // INIT
    // ==========================================

    function init() {
        els.signup = document.getElementById('signup');
        els.form = document.getElementById('signupForm');
        els.firstName = document.getElementById('firstName');
        els.email = document.getElementById('email');
        els.formError = document.getElementById('formError');
        els.submitBtn = document.getElementById('submitBtn');
        els.oneStep = document.getElementById('oneStep');
        els.reopenBtn = document.getElementById('reopenBtn');
        els.stickyCta = document.getElementById('stickyCta');
        els.finalCta = document.getElementById('finalCta');

        core.initPaddle(isSandbox, handlePaddleEvent);
        window.localizePrices();

        els.form.addEventListener('submit', handleSubmit);
        els.reopenBtn.addEventListener('click', openCheckout);
        // "Next" on the first name keyboard moves to email instead of submitting
        els.firstName.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                els.email.focus();
            }
        });
        [els.firstName, els.email].forEach(function(input) {
            input.addEventListener('input', function() {
                if (!els.formError.hidden) clearError();
            });
        });
        document.querySelectorAll('.js-go-to-form').forEach(function(btn) {
            btn.addEventListener('click', goToForm);
        });

        setupStickyCta();
        setupLazyVideos();
        setupFaq();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
