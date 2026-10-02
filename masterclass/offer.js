/**
 * /masterclass/offer.js
 *
 * Masterclass offer pages: /masterclass/traffic/watch/ (English) and /masterclass/trafic/offre/ (French).
 * Load in <head> after config.js, session-date.js, offer-deadline.js and masterclass.js: the deadline
 * check runs right away, so an expired offer redirects before the page shows.
 * The page also loads the /instagram/ scripts at the end of <body> (checkout-core.js, price-localizer.js,
 * instagram/app.js for the shared sections).
 *
 * Config (MASTERCLASS_CONFIG.offer):
 *   plans               { yearly: '<pricing-data key>', quarterly: '<pricing-data key>' }
 *   defaultPlan         'yearly'
 *   deadline            'registration' (English: 6 days after registration, visitor's time zone)
 *                       or 'weekly-live' (French: the Wednesday after the Thursday live, Paris time)
 *   revealAfterSeconds  0 = sales content visible right away; otherwise seconds of time on page
 *   expiredRedirectUrl  where to send visitors once the offer is over
 *
 * URL parameters: first_name, email, registered_on (English), attends_masterclass_on (French),
 *   offer=1 (show the sales content right away), unlockfor=<anything> (preview: no deadline redirect),
 *   environment=sandbox (Paddle sandbox, as on /instagram/).
 *
 * Markup hooks:
 *   #offerCtaTemplate (<template>) cloned into every [data-offer-cta]: price, countdown, plan selector, button
 *   [data-offer-price="yearly|quarterly"] gets data-paddle-price-id from pricing-data.js
 *   [data-offer-countdown] with [data-unit="d|h|m|s"], [data-offer-countdown-compact], [data-offer-end]
 *   #offerContent (sales content, hidden until the reveal), #revealNotice with [data-reveal-clock]
 *   #offerSticky (sticky CTA bar), #offerMessages [data-msg]
 */
(function () {
  'use strict';

  var config = window.MASTERCLASS_CONFIG || {};
  var offer = config.offer || {};
  var api = window.masterclassOffer;
  var params = new URLSearchParams(window.location.search);
  var preview = !!params.get('unlockfor');
  var KEYS = { registeredOn: 'onetake-masterclass-registered-on', unlocked: 'onetake-masterclass-offer-unlocked' };

  function store(key, value) {
    try { if (value == null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
  }
  function stored(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  // ── Deadline (runs immediately, before the page renders) ────────────

  function computeDeadline() {
    var now = Date.now();
    if (offer.deadline === 'weekly-live') {
      return api.frenchDeadline(now, params.get('attends_masterclass_on'), config.session);
    }
    var registeredOn = api.resolveRegisteredOn(params.get('registered_on'), stored(KEYS.registeredOn), now);
    store(KEYS.registeredOn, new Date(registeredOn).toISOString());
    return api.englishDeadline(registeredOn);
  }

  var deadline = computeDeadline();

  function expire() {
    if (!preview) window.location.replace(offer.expiredRedirectUrl);
  }
  if (Date.now() > deadline) {
    expire();
    return;
  }

  // ── Countdowns ──────────────────────────────────────────────────────

  function pad(n) { return String(n).padStart(2, '0'); }

  function renderCountdowns() {
    var diff = Math.max(0, deadline - Date.now());
    var d = Math.floor(diff / 86400000);
    var h = Math.floor(diff % 86400000 / 3600000);
    var m = Math.floor(diff % 3600000 / 60000);
    var s = Math.floor(diff % 60000 / 1000);
    document.querySelectorAll('[data-offer-countdown]').forEach(function (clock) {
      clock.querySelector('[data-unit="d"]').textContent = d;
      clock.querySelector('[data-unit="h"]').textContent = pad(h);
      clock.querySelector('[data-unit="m"]').textContent = pad(m);
      clock.querySelector('[data-unit="s"]').textContent = pad(s);
    });
    var labels = config.language === 'fr' ? ['j', 'h', 'min'] : ['d', 'h', 'm'];
    document.querySelectorAll('[data-offer-countdown-compact]').forEach(function (el) {
      el.textContent = d + labels[0] + ' ' + pad(h) + labels[1] + ' ' + pad(m) + labels[2] + ' ' + pad(s) + 's';
    });
    if (diff === 0) expire();
  }

  function renderEndDate() {
    var text = config.language === 'fr'
      ? 'Cette offre se termine ' + api.formatFrenchEnd(deadline)
      : 'Offer ends ' + api.formatEnglishEnd(deadline);
    document.querySelectorAll('[data-offer-end]').forEach(function (el) { el.textContent = text; });
  }

  // ── CTA blocks: price, countdown, plan selector, button ─────────────

  var selectedPlan = offer.defaultPlan || 'yearly';

  function mountCtaBlocks() {
    var template = document.getElementById('offerCtaTemplate');
    if (!template) return;
    document.querySelectorAll('[data-offer-cta]').forEach(function (slot, i) {
      var block = template.content.cloneNode(true);
      // Unique names and IDs per block, so each selector works on its own
      block.querySelectorAll('[name="offerPlan"]').forEach(function (radio) {
        radio.name = 'offerPlan' + i;
        radio.id = 'offerPlan' + i + '-' + radio.value;
        radio.checked = radio.value === selectedPlan;
      });
      block.querySelectorAll('label[for]').forEach(function (label) {
        label.htmlFor = 'offerPlan' + i + '-' + label.htmlFor;
      });
      slot.appendChild(block);
    });

    // Every selector shows the same choice
    document.addEventListener('change', function (event) {
      if (!event.target.name || event.target.name.indexOf('offerPlan') !== 0) return;
      selectedPlan = event.target.value;
      document.querySelectorAll('[data-offer-cta] input[type="radio"]').forEach(function (radio) {
        radio.checked = radio.value === selectedPlan;
      });
    });

    document.querySelectorAll('[data-offer-cta] .js-offer-checkout').forEach(function (button) {
      button.addEventListener('click', function () { openCheckout(button); });
    });
  }

  // ── Checkout (Paddle, through checkout-core.js like /instagram/) ────

  var isSandbox = params.get('environment') === 'sandbox';
  var state = null;

  function message(key) {
    var el = document.querySelector('#offerMessages [data-msg="' + key + '"]');
    return el ? el.textContent.trim() : '';
  }

  // pricing-data.js declares these with const: they are globals, but not properties of window
  function livePresets() {
    return typeof planPresets !== 'undefined' ? planPresets : {};
  }
  function presets() {
    return isSandbox && typeof sandboxPlanPresets !== 'undefined' ? sandboxPlanPresets : livePresets();
  }

  function buildState(planKey) {
    // Sandbox presets don't list every plan; fall back to the live preset (same as instagram/app.js)
    var plan = presets()[planKey] || livePresets()[planKey];
    var lead = window.masterclass.lead();
    return {
      formData: { firstName: lead.first_name, email: lead.email, useCases: [], estimatedVolume: '' },
      currentLanguage: config.language,
      planKey: planKey,
      planInfo: plan,
      productId: plan.product,
      hasTrial: !!plan.trial,
      hasOneTimeCharge: !!plan.oneTimeCharge,
      trackingParams: window.oneTakeTracking ? window.oneTakeTracking.parseTrackingParams() : {},
      checkoutCompleted: false,
      downsellShown: false,
      downsellAccepted: false,
      originalPlanKey: null,
      isSubmitting: false
    };
  }

  function openCheckout(button) {
    var block = button.closest('[data-offer-cta]');
    var error = block.querySelector('.of-cta__error');
    error.hidden = true;
    state = buildState(offer.plans[selectedPlan]);
    window.oneTakeState = state;
    window.oneTakeCheckout.openCheckout(state, presets(), {
      onError: function () {
        error.textContent = message('checkout');
        error.hidden = false;
      }
    });
  }

  function handlePaddleEvent(data) {
    if (!state) return;
    if (data.name === 'checkout.completed') {
      state.checkoutCompleted = true;
      window.oneTakeCheckout.trackPurchase(state, data, isSandbox);
    }
    if (data.name === 'checkout.customer.updated' && typeof AnyTrack !== 'undefined') {
      AnyTrack('trigger', 'InitiateCheckout', {});
    }
    if (data.name === 'checkout.payment.selected' && typeof AnyTrack !== 'undefined') {
      AnyTrack('trigger', 'AddPaymentInfo', {});
    }
  }

  // ── Reveal of the sales content (English page) ──────────────────────

  var revealed = false;

  function reveal(animate) {
    var content = document.getElementById('offerContent');
    var notice = document.getElementById('revealNotice');
    if (!content || revealed) return;
    revealed = true;
    content.hidden = false;
    if (animate) {
      content.classList.add('is-revealing');
      void content.offsetHeight;
      content.classList.add('is-revealed');
    }
    if (notice) notice.hidden = true;
    store(KEYS.unlocked, '1');
    updateSticky();
  }

  function setupReveal() {
    var content = document.getElementById('offerContent');
    if (!content) { revealed = true; return; } // French page: no reveal delay
    var delay = parseFloat(offer.revealAfterSeconds) || 0;
    if (delay <= 0 || params.get('offer') === '1' || stored(KEYS.unlocked) === '1') {
      reveal(false);
      return;
    }
    content.hidden = true;
    var notice = document.getElementById('revealNotice');
    var clock = notice && notice.querySelector('[data-reveal-clock]');
    if (notice) notice.hidden = false;
    var endsAt = Date.now() + delay * 1000;
    (function tick() {
      var left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      if (clock) clock.textContent = pad(Math.floor(left / 60)) + ':' + pad(left % 60);
      if (left === 0) reveal(true);
      else setTimeout(tick, 250);
    })();
  }

  // ── Sticky CTA bar ──────────────────────────────────────────────────

  var sticky = null;
  var visibleBlocks = new Set();
  var pastHero = false;

  function updateSticky() {
    if (!sticky) return;
    var mobile = window.matchMedia('(max-width: 959px)').matches;
    var show = revealed && visibleBlocks.size === 0 && (mobile || pastHero);
    sticky.classList.toggle('is-visible', show);
    sticky.setAttribute('aria-hidden', String(!show));
    sticky.querySelector('button').tabIndex = show ? 0 : -1;
  }

  // Scrolls to the CTA block closest to the current position
  function goToNearestCta() {
    var blocks = Array.prototype.slice.call(document.querySelectorAll('[data-offer-cta]'));
    var middle = window.innerHeight / 2;
    blocks.sort(function (a, b) {
      return Math.abs(a.getBoundingClientRect().top - middle) - Math.abs(b.getBoundingClientRect().top - middle);
    });
    if (!blocks[0]) return;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    blocks[0].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    var button = blocks[0].querySelector('.js-offer-checkout');
    if (button) button.focus({ preventScroll: true });
  }

  function setupSticky() {
    sticky = document.getElementById('offerSticky');
    if (!sticky) return;
    sticky.querySelector('button').addEventListener('click', goToNearestCta);
    if (!('IntersectionObserver' in window)) { visibleBlocks.clear(); pastHero = true; updateSticky(); return; }

    var blocks = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visibleBlocks.add(entry.target); else visibleBlocks.delete(entry.target);
      });
      updateSticky();
    });
    document.querySelectorAll('[data-offer-cta]').forEach(function (block) { blocks.observe(block); });

    var hero = document.getElementById('offerHero');
    if (hero) {
      new IntersectionObserver(function (entries) {
        pastHero = !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0;
        updateSticky();
      }).observe(hero);
    }
    window.addEventListener('resize', updateSticky);
  }

  // ── Init ────────────────────────────────────────────────────────────

  // [data-offer-price="yearly|quarterly"] gets the Paddle price ID of that plan, from pricing-data.js
  function bindPriceIds() {
    document.querySelectorAll('[data-offer-price]').forEach(function (el) {
      var plan = livePresets()[offer.plans[el.getAttribute('data-offer-price')]];
      if (plan) el.setAttribute('data-paddle-price-id', plan.product);
    });
  }

  function init() {
    mountCtaBlocks();
    bindPriceIds();
    renderEndDate();
    renderCountdowns();
    setInterval(renderCountdowns, 1000);
    setupReveal();
    setupSticky();
    if (window.oneTakeCheckout) {
      window.oneTakeCheckout.initPaddle(isSandbox, handlePaddleEvent);
      if (window.localizePrices) window.localizePrices();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
