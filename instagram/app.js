// OneTake AI - Instagram free trial landing page
// Requires: pricing-data.js, translations.js, tracking-params.js, cohort.js,
//           checkout-core.js, price-localizer.js (see script order in index.html)

(function() {
    'use strict';

    // ==========================================
    // CONTENT TO FILL IN (the only place to edit)
    // ==========================================

    // Video slots: paste a my.onetake.ai player URL (autoplay=true&loop=true, like the hero ones).
    // A slot stays hidden until every URL it needs is filled in.
    //   pair slots:   before + after (shown side by side, 9:16)
    //   single slots: main (ratio '9:16' or '16:9')
    var VIDEO_SLOTS = {
        'feature-sound':       { before: '', after: '' },
        'feature-ums':         { before: '', after: '' },
        'feature-captions':    { main: '', ratio: '9:16' },
        'feature-subtitles':   { main: '', ratio: '9:16' },
        'feature-transitions': { main: '', ratio: '9:16' },
        'feature-music':       { main: '', ratio: '9:16' },
        'feature-language':    { before: '', after: '' },
        'feature-short':       { main: '', ratio: '9:16' },
        'feature-publishing':  { main: '', ratio: '9:16' },
        'feature-gaze':        { before: '', after: '' },
        'feature-background':  { before: '', after: '' },
        'just-ask-recording':  { main: '', ratio: '16:9' },
        'founder-video':       { main: '', ratio: '16:9' }
    };

    // Founder photo, hosted on sebastiennight.com (src in #founderPhoto data-src). Set to false to hide it.
    var FOUNDER_PHOTO_READY = true;

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
    // VIDEO SLOTS, FOUNDER PHOTO, CHAT AND FAQ
    // ==========================================

    // Fill each [data-slot] whose URLs are set in VIDEO_SLOTS, then show it.
    // The OneTake player handles autoplay, loop and sound by itself.
    function setupVideoSlots() {
        document.querySelectorAll('[data-slot]').forEach(function(slot) {
            var config = VIDEO_SLOTS[slot.dataset.slot];
            if (!config) return;

            var holders = slot.querySelectorAll('[data-frame]');
            var ready = holders.length > 0 && Array.prototype.every.call(holders, function(holder) {
                return !!config[holder.dataset.frame];
            });
            if (!ready) return;

            holders.forEach(function(holder) {
                if (config.ratio === '16:9' && holder.dataset.frame === 'main') {
                    holder.classList.add('player--wide');
                }
                var iframe = document.createElement('iframe');
                iframe.className = 'player__frame';
                iframe.title = holder.dataset.title || '';
                iframe.src = config[holder.dataset.frame];
                iframe.loading = 'lazy';
                iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen';
                iframe.allowFullscreen = true;
                holder.appendChild(iframe);
            });

            slot.hidden = false;
            var host = slot.closest('[data-slot-host]');
            if (host) host.classList.add('has-media');
        });
    }

    function setupFounderPhoto() {
        var photo = document.getElementById('founderPhoto');
        if (!FOUNDER_PHOTO_READY || !photo) return;
        photo.src = photo.dataset.src;
        photo.hidden = false;
        document.getElementById('founder').classList.add('has-photo');
    }

    // Chat messages appear one by one when the mockup scrolls into view.
    // Without IntersectionObserver, or with reduced motion, they are all shown at once.
    function setupChat() {
        var chat = document.getElementById('chat');
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!chat || reduceMotion || !('IntersectionObserver' in window)) return;

        var messages = chat.querySelectorAll('.chat__msg');
        var STEP = 900;          // between two messages
        var PAUSE = 2500;        // once the conversation is complete, before it starts over
        var timers = [];
        var visible = false;
        var running = false;

        function stop() {
            timers.forEach(clearTimeout);
            timers = [];
            running = false;
        }

        function play() {
            running = true;
            messages.forEach(function(msg) { msg.classList.remove('is-shown'); });
            messages.forEach(function(msg, i) {
                timers.push(setTimeout(function() { msg.classList.add('is-shown'); }, 300 + i * STEP));
            });
            timers.push(setTimeout(function() {
                running = false;
                if (visible) play();
            }, 300 + (messages.length - 1) * STEP + PAUSE));
        }

        chat.classList.add('is-pending');

        // Plays only while the chat is on screen, and starts over when it comes back
        var observer = new IntersectionObserver(function(entries) {
            visible = entries[0].isIntersecting;
            if (visible && !running) play();
            if (!visible) stop();
        }, { threshold: 0.4 });

        observer.observe(chat);
    }

    // "Editing complete" checklist: each step checks off as it scrolls past 70% of the screen height
    // (and unchecks when scrolling back up). With reduced motion, every step shows as done.
    function setupDoneList() {
        var list = document.getElementById('doneList');
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!list || reduceMotion) return;

        var steps = list.querySelectorAll('.done__step');
        var ticking = false;
        list.classList.add('is-pending');

        function update() {
            ticking = false;
            var line = window.innerHeight * 0.7;
            steps.forEach(function(step) {
                step.classList.toggle('is-done', step.getBoundingClientRect().top < line);
            });
        }

        function onScroll() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(update);
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        update();
    }

    // ==========================================
    // SAVINGS CALCULATOR
    // ==========================================

    // Yearly cost of what OneTake replaces, for V videos a month of M minutes each.
    // Defaults (12 videos of 10 minutes) match the original table: $39,502.
    var FIXED_YEARLY_SAVINGS = 750 + 288 + 110 + 588 + 948 + 74 + 144; // Adobe, After Effects, Canva, Vimeo, Wistia, Office, Google

    function computeSavings(videos, minutes) {
        var yearlyMinutes = videos * minutes * 12;
        var videoHours = yearlyMinutes / 60;
        var batches = Math.ceil(videos / 12);          // 1 shoot day per 12 videos a month
        var cameraDays = batches * 12;
        var designerDays = batches * 6;                 // half a day per 12 videos a month
        var rows = {
            camera: cameraDays * 500,
            editor: Math.round(videoHours * 900),
            designer: designerDays * 300,
            transcription: yearlyMinutes * 2,
            subtitles: yearlyMinutes * 3
        };
        rows.total = rows.camera + rows.editor + rows.designer + rows.transcription + rows.subtitles + FIXED_YEARLY_SAVINGS;
        rows.cameraDays = cameraDays;
        rows.designerDays = designerDays;
        rows.videoHours = videoHours;
        rows.monthlyMinutes = videos * minutes;
        return rows;
    }

    // Amounts are in US dollars, except on the French, Spanish and Italian versions,
    // where the same numbers are shown in euros (1:1, no conversion)
    var EURO_LOCALES = { fr: 'fr-FR', es: 'es-ES', it: 'it-IT' };

    function euroLocale() {
        return EURO_LOCALES[getPageLanguage()] || null;
    }

    function formatMoney(n, decimals) {
        var opts = { minimumFractionDigits: decimals || 0, maximumFractionDigits: decimals || 0 };
        var locale = euroLocale();
        if (locale) return n.toLocaleString(locale, opts) + '\u00a0€';
        return '$' + n.toLocaleString('en-US', opts);
    }

    function formatNumber(n) {
        return (Math.round(n * 10) / 10).toLocaleString(euroLocale() || 'en-US');
    }

    // Static amounts: <span class="paddle-price money" data-usd="2.00">$2.00</span>
    // (paddle-price only makes Weglot skip them; they have no Paddle price ID)
    function renderStaticMoney() {
        document.querySelectorAll('.money[data-usd]').forEach(function(el) {
            var raw = el.dataset.usd;
            el.textContent = formatMoney(parseFloat(raw), (raw.split('.')[1] || '').length);
        });
    }

    var updateCalculator = function() {};

    function renderMoney() {
        renderStaticMoney();
        updateCalculator();
    }

    // Weglot loads asynchronously (tools.js): re-render once it is ready and on every language switch
    function watchLanguage() {
        var tries = 0;
        (function hook() {
            if (window.Weglot && typeof Weglot.on === 'function') {
                Weglot.on('initialized', renderMoney);
                Weglot.on('languageChanged', renderMoney);
                renderMoney();
                return;
            }
            if (++tries < 40) setTimeout(hook, 250);
        })();
    }

    function setupCalculator() {
        var videosInput = document.getElementById('calcVideos');
        var minutesInput = document.getElementById('calcMinutes');
        if (!videosInput || !minutesInput) return;

        var MONEY = ['camera', 'editor', 'designer', 'transcription', 'subtitles', 'total'];
        var planLines = document.querySelectorAll('[data-plan-minutes]');

        function update() {
            var videos = parseInt(videosInput.value, 10);
            var minutes = parseInt(minutesInput.value, 10);
            var result = computeSavings(videos, minutes);

            document.getElementById('calcVideosOut').textContent = videos;
            document.getElementById('calcMinutesOut').textContent = minutes;

            // Queried on every update: Weglot may replace the text nodes around these spans
            document.querySelectorAll('[data-calc]').forEach(function(el) {
                var key = el.dataset.calc;
                if (!(key in result)) return;
                el.textContent = MONEY.indexOf(key) !== -1 ? formatMoney(Math.round(result[key])) : formatNumber(result[key]);
            });

            // Show the smallest plan that covers the monthly minutes
            var shown = false;
            planLines.forEach(function(line) {
                var fits = !shown && result.monthlyMinutes <= parseInt(line.dataset.planMinutes, 10);
                line.hidden = !fits;
                if (fits) shown = true;
            });
        }

        videosInput.addEventListener('input', update);
        minutesInput.addEventListener('input', update);
        updateCalculator = update;
        update();
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
        setupVideoSlots();
        setupFounderPhoto();
        setupChat();
        setupDoneList();
        setupCalculator();
        renderStaticMoney();
        watchLanguage();
        setupFaq();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
