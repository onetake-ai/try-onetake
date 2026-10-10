/**
 * /masterclass/masterclass.js
 *
 * Shared behavior for the masterclass funnels (/masterclass/traffic/ and /masterclass/trafic/).
 * Reads window.MASTERCLASS_CONFIG (the funnel's config.js) and window.masterclassSession
 * (session-date.js). Load order on every page: config.js, session-date.js, masterclass.js.
 *
 * Markup hooks (all optional on a page):
 *   form.mc-form                 Registration form: sends the lead (with ?ref= and UTMs) to Userlist,
 *                                fires the FirstPromoter referral and the Plausible goal, then goes to page 2
 *   #mcStep2Template             Optional questions shown in place of the form after registration, before
 *                                page 2 (answers saved on the Userlist user, event config.qualificationEvent)
 *   [data-mc-text="path"]        Text from the config (e.g. "email.subject"); placeholder when empty
 *   [data-mc-href="path"]        Link URL from the config
 *   [data-mc-player="path"]      OneTake player (16:9) from the config; hidden while empty, or outside
 *                                its `days` (e.g. replayVideo.days: [0, 1], Sunday and Monday in the session time zone)
 *   [data-mc-show-if="path"]     Shown only when that config value is set (and [data-mc-hide-if] the opposite)
 *   [data-mc-session]            Date of the next live session, in French
 *   [data-mc-first-name]         ", Name" from ?first_name= (or the name typed at registration)
 *   #mcScan                      Account screenshots under a scan overlay, from config.profiles
 *   #mcHostPhoto                 Host photo from config.hostPhoto
 *   #mcJoin                      "Join the live" block, shown just before the session
 *   [data-mc-prefill]            Fills #firstName and #email (checkout form) from the URL or registration
 *
 * masterclass.mountSessionCountdown() is called from <head> on the French confirmation page.
 * masterclass.lead() returns { first_name, email } from the URL or the registration (used by offer.js).
 */
(function () {
  'use strict';

  var config = window.MASTERCLASS_CONFIG || {};
  var STORAGE_KEY = 'onetake-masterclass-lead';

  // ── Helpers ──────────────────────────────────────────────────────────

  function get(path) {
    return String(path).split('.').reduce(function (obj, key) {
      return obj == null ? undefined : obj[key];
    }, config);
  }

  function nextSession() {
    return window.masterclassSession.next(new Date(), config.session);
  }

  function saveLead(lead) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lead)); } catch (e) { /* storage unavailable */ }
  }

  function savedLead() {
    try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; }
  }

  function param(name) {
    return (new URLSearchParams(window.location.search).get(name) || '').trim();
  }

  // Visible placeholder box. The label says exactly what is missing.
  function placeholder(label, className) {
    var box = document.createElement('div');
    box.className = 'ph' + (className ? ' ' + className : '');
    box.setAttribute('data-placeholder', label);
    box.textContent = '[PLACEHOLDER: ' + label + ']';
    return box;
  }

  function inlinePlaceholder(label) {
    var span = document.createElement('span');
    span.className = 'ph ph--inline';
    span.setAttribute('data-placeholder', label);
    span.textContent = '[CONFIG: ' + label + ']';
    return span;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ── Attribution: affiliate (?ref=) and UTMs ─────────────────────────

  // Sent to Userlist as referred_by and utm_* (see edge-scripts/userlist-proxy.ts).
  // The last link with any of these parameters wins, and is remembered for 30 days in this
  // browser, so a visitor who comes back later without them is still attributed.
  var ATTRIBUTION_KEY = 'onetake-masterclass-attribution';
  var ATTRIBUTION_DAYS = 30;
  var ATTRIBUTION_FIELDS = { ref: 'referred_by', utm_source: 'utm_source', utm_medium: 'utm_medium',
    utm_campaign: 'utm_campaign', utm_content: 'utm_content', utm_channel: 'utm_channel' };

  function captureAttribution() {
    var found = {};
    Object.keys(ATTRIBUTION_FIELDS).forEach(function (key) {
      var value = param(key);
      if (value) found[ATTRIBUTION_FIELDS[key]] = value.slice(0, 200);
    });
    if (!Object.keys(found).length) return;
    try {
      window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({ values: found, savedAt: Date.now() }));
    } catch (e) { /* storage unavailable: the URL values are still sent below */ }
  }

  // Values from the current URL if it has any, otherwise the remembered ones (if under 30 days old)
  function attribution() {
    var fromUrl = {};
    Object.keys(ATTRIBUTION_FIELDS).forEach(function (key) {
      var value = param(key);
      if (value) fromUrl[ATTRIBUTION_FIELDS[key]] = value.slice(0, 200);
    });
    if (Object.keys(fromUrl).length) return fromUrl;
    try {
      var saved = JSON.parse(window.localStorage.getItem(ATTRIBUTION_KEY));
      if (saved && saved.values && Date.now() - saved.savedAt < ATTRIBUTION_DAYS * 86400000) return saved.values;
    } catch (e) { /* nothing saved */ }
    return {};
  }

  // ── Registration forms ───────────────────────────────────────────────

  // Once Userlist has accepted the lead:
  // - FirstPromoter referral (same call as /instagram/ and the main signup page), so an opt-in
  //   from an affiliate link (?ref=) counts as that affiliate's lead
  // - Plausible "CompleteRegistration" goal (same name as the Userlist event)
  // Leaves the page once Plausible confirms and FirstPromoter had a moment to send (at most 1 s).
  function trackRegistration(email, next) {
    var done = false;
    var plausibleSent = false;
    var minWaitOver = false;
    function go() { if (!done) { done = true; next(); } }
    function maybeGo() { if (plausibleSent && minWaitOver) go(); }
    setTimeout(go, 1000);
    setTimeout(function () { minWaitOver = true; maybeGo(); }, 400);
    if (typeof window.fpr === 'function') window.fpr('referral', { email: email });
    if (typeof window.plausible === 'function') {
      window.plausible(config.registrationEvent, {
        props: { language: config.language, masterclass_slug: config.slug },
        callback: function () { plausibleSent = true; maybeGo(); }
      });
    } else {
      plausibleSent = true;
    }
  }

  function setupForm(form) {
    var firstName = form.querySelector('[name="first_name"]');
    var email = form.querySelector('[name="email"]');
    var error = form.querySelector('.mc-form__error');
    var button = form.querySelector('button[type="submit"]');
    var sending = false;

    function showError(text, field) {
      error.textContent = text;
      error.hidden = false;
      [firstName, email].forEach(function (input) {
        input.setAttribute('aria-invalid', String(input === field));
      });
      if (field) field.focus();
    }

    function clearError() {
      error.hidden = true;
      error.textContent = '';
      firstName.removeAttribute('aria-invalid');
      email.removeAttribute('aria-invalid');
    }

    function setLoading(isLoading) {
      sending = isLoading;
      button.disabled = isLoading;
      button.setAttribute('aria-busy', String(isLoading));
      button.querySelector('.btn__label').hidden = isLoading;
      button.querySelector('.btn__loading').hidden = !isLoading;
    }

    [firstName, email].forEach(function (input) {
      input.addEventListener('input', function () { if (!error.hidden) clearError(); });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (sending) return;

      var lead = { first_name: firstName.value.trim(), email: email.value.trim() };
      if (!lead.first_name) return showError(config.messages.firstName, firstName);
      if (!isValidEmail(lead.email)) return showError(config.messages.email, email);
      clearError();
      setLoading(true);

      var body = new URLSearchParams({
        email: lead.email,
        first_name: lead.first_name,
        language: config.language,
        event: config.registrationEvent,
        masterclass_slug: config.slug
      });
      if (config.session) body.set('attends_masterclass_on', nextSession().toISOString());
      var source = attribution();
      Object.keys(source).forEach(function (key) { body.set(key, source[key]); });

      var controller = 'AbortController' in window ? new AbortController() : null;
      var timeout = setTimeout(function () { if (controller) controller.abort(); }, 15000);

      fetch(config.proxyUrl, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: body,
        signal: controller ? controller.signal : undefined
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        saveLead(lead);
        var step2 = document.getElementById('mcStep2Template');
        trackRegistration(lead.email, function () {
          if (step2) showStep2(form, step2, lead);
          else window.location.assign(config.urls.checkInbox);
        });
      }).catch(function () {
        setLoading(false);
        showError(config.messages.network, null);
      }).then(function () {
        clearTimeout(timeout);
      });
    });
  }

  // ── Step 2: optional questions (/masterclass/trafic/recherche/) ──────

  // Replaces the registration form that was just sent with <template id="mcStep2Template">.
  // Answers go to Userlist as user properties, through the same proxy, with the event
  // config.qualificationEvent (FormSubmit), and the Plausible goal config.qualificationGoal (formSubmit,
  // as on the signup form). Multiple choices are sent as comma-separated slugs.
  // Whatever happens (no answer, error, timeout), the visitor goes on to page 2.
  function showStep2(form, template, lead) {
    var step = template.content.firstElementChild.cloneNode(true);
    form.hidden = true;
    form.parentNode.insertBefore(step, form.nextSibling);
    // Wider card on desktop (two columns of questions); in the hero, it takes the headline's place
    form.parentNode.classList.add('is-step2');
    var hero = form.closest('.mc-hero__inner');
    if (hero) hero.classList.add('has-step2');
    step.querySelectorAll('.mc-step2__skip').forEach(function (link) { link.href = config.urls.checkInbox; });
    step.querySelectorAll('details.mc-multi').forEach(setupMulti);
    var title = step.querySelector('.mc-step2__title');
    title.focus({ preventScroll: true });
    step.scrollIntoView({ behavior: 'smooth', block: 'start' });

    var answers = step.querySelector('form');
    var button = answers.querySelector('button[type="submit"]');
    var sending = false;

    function next() { window.location.assign(config.urls.checkInbox); }

    answers.addEventListener('submit', function (event) {
      event.preventDefault();
      if (sending) return;

      var values = {};
      Array.prototype.forEach.call(answers.elements, function (input) {
        if (!input.name) return;
        if ((input.type === 'radio' || input.type === 'checkbox') && !input.checked) return;
        var value = input.value.trim();
        if (!value) return;
        values[input.name] = values[input.name] ? values[input.name] + ',' + value : value;
      });
      if (!Object.keys(values).length) return next();

      sending = true;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.querySelector('.btn__label').hidden = true;
      button.querySelector('.btn__loading').hidden = false;

      var body = new URLSearchParams({
        email: lead.email,
        language: config.language,
        event: config.qualificationEvent,
        masterclass_slug: config.slug
      });
      Object.keys(values).forEach(function (key) { body.set(key, values[key]); });

      var done = false;
      function finish() { if (!done) { done = true; next(); } }
      setTimeout(finish, 8000);

      fetch(config.proxyUrl, { method: 'POST', headers: { 'Accept': 'application/json' }, body: body })
        .catch(function () { /* answers are optional: never block the visitor */ })
        .then(function () {
          if (typeof window.plausible !== 'function') return finish();
          setTimeout(finish, 1000);
          // Same Plausible goal as the signup form (checkout-core.js), with its estimated_volume prop
          var props = { language: config.language, masterclass_slug: config.slug };
          if (values.estimated_volume) props.estimated_volume = values.estimated_volume;
          window.plausible(config.qualificationGoal, {
            props: props,
            callback: finish
          });
        });
    });
  }

  // Multiple choice dropdown (<details class="mc-multi"> holding checkboxes): the summary lists the
  // checked labels; closes on Escape or a click outside
  function setupMulti(details) {
    var value = details.querySelector('.mc-multi__value');
    var boxes = details.querySelectorAll('input[type="checkbox"]');
    details.addEventListener('change', function () {
      var labels = Array.prototype.filter.call(boxes, function (box) { return box.checked; })
        .map(function (box) { return box.nextElementSibling.textContent; });
      value.textContent = labels.length ? labels.join(', ') : value.getAttribute('data-empty');
      value.classList.toggle('is-set', labels.length > 0);
    });
    document.addEventListener('click', function (event) {
      if (details.open && !details.contains(event.target)) details.open = false;
    });
    details.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && details.open) {
        details.open = false;
        details.querySelector('summary').focus();
      }
    });
  }

  // ── Config bindings ──────────────────────────────────────────────────

  // The email subject contains the Liquid tag {{ user.first_name | capitalize }}: show the
  // visitor's first name instead, or drop the tag (and the punctuation after it) when unknown
  function personalize(text) {
    var name = savedLead().first_name || '';
    name = name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
    if (name) return text.replace(/\{\{\s*user\.first_name[^}]*\}\}/g, name);
    var rest = text.replace(/\{\{\s*user\.first_name[^}]*\}\}[,:]?\s*/g, '');
    return rest.charAt(0).toUpperCase() + rest.slice(1);
  }

  function bindText() {
    document.querySelectorAll('[data-mc-text]').forEach(function (el) {
      var value = get(el.getAttribute('data-mc-text'));
      if (typeof value === 'string') value = personalize(value);
      if (value) {
        el.textContent = value;
      } else {
        el.textContent = '';
        el.appendChild(inlinePlaceholder(el.getAttribute('data-placeholder') || el.getAttribute('data-mc-text')));
      }
    });
    document.querySelectorAll('[data-mc-href]').forEach(function (el) {
      var value = get(el.getAttribute('data-mc-href'));
      if (value) el.href = value;
    });
  }

  function bindPlayers() {
    document.querySelectorAll('[data-mc-player]').forEach(function (holder) {
      var url = get(holder.getAttribute('data-mc-player'));
      holder.textContent = '';
      if (!url) {
        // Not ready yet: hide it (and its [data-mc-show-if] section) rather than show a placeholder
        holder.hidden = true;
        return;
      }
      var player = document.createElement('div');
      player.className = 'player player--wide';
      var iframe = document.createElement('iframe');
      iframe.className = 'player__frame';
      iframe.title = holder.getAttribute('data-title') || '';
      iframe.src = url;
      iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen';
      iframe.allowFullscreen = true;
      player.appendChild(iframe);
      holder.appendChild(player);
    });
  }

  // Elements that depend on a config value: [data-mc-show-if="path"] shows only once the value is set,
  // [data-mc-hide-if="path"] hides once it is set (e.g. a fallback headline while a video is missing)
  function bindConditions() {
    document.querySelectorAll('[data-mc-show-if]').forEach(function (el) {
      el.hidden = !get(el.getAttribute('data-mc-show-if'));
    });
    document.querySelectorAll('[data-mc-hide-if]').forEach(function (el) {
      el.hidden = !!get(el.getAttribute('data-mc-hide-if'));
    });
  }

  function bindSession() {
    var nodes = document.querySelectorAll('[data-mc-session]');
    if (!nodes.length || !config.session) return;
    var text = window.masterclassSession.formatFr(nextSession(), config.session);
    nodes.forEach(function (el) { el.textContent = text; });
  }

  function bindFirstName() {
    var name = param('first_name') || savedLead().first_name || '';
    // The email link sends {{ user.first_name | capitalize }}; a literal unrendered tag is ignored
    if (!name || /[{}<>]/.test(name)) return;
    document.querySelectorAll('[data-mc-first-name]').forEach(function (el) {
      el.textContent = ', ' + name;
    });
  }

  function prefillCheckout() {
    if (!document.querySelector('[data-mc-prefill]')) return;
    var lead = savedLead();
    var values = { firstName: param('first_name') || lead.first_name, email: param('email') || lead.email };
    Object.keys(values).forEach(function (id) {
      var input = document.getElementById(id);
      var value = values[id];
      if (input && value && !/[{}<>]/.test(value) && !input.value) input.value = value;
    });
  }

  // ── Proof section ────────────────────────────────────────────────────

  // Account screenshots in two rows scrolling in opposite directions, under a scan overlay.
  // Each row holds the list twice, so translating it by -50% loops seamlessly.
  function renderScan() {
    var scan = document.getElementById('mcScan');
    var accounts = (config.profiles || []).filter(function (p) { return p.image; });
    if (!scan || !accounts.length) return;

    function track(list, reverse, describe) {
      var row = document.createElement('div');
      row.className = 'mc-scan__track' + (reverse ? ' mc-scan__track--reverse' : '');
      list.concat(list).forEach(function (p, i) {
        var img = document.createElement('img');
        img.src = p.image;
        img.width = 288;
        img.height = 640;
        img.loading = 'lazy';
        img.decoding = 'async';
        // Only the first copy of the first row is described; the rest repeats it
        img.alt = describe && i < list.length ? (p.alt || p.name) : '';
        row.appendChild(img);
      });
      return row;
    }

    var half = Math.ceil(accounts.length / 2);
    var second = accounts.slice(half).concat(accounts.slice(0, half)).reverse();
    scan.appendChild(track(accounts, false, true));
    scan.appendChild(track(second, true, false));

    var overlay = document.createElement('div');
    overlay.className = 'mc-scan__overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<span class="mc-scan__line"></span>' +
      '<span class="mc-scan__corner mc-scan__corner--tl"></span><span class="mc-scan__corner mc-scan__corner--tr"></span>' +
      '<span class="mc-scan__corner mc-scan__corner--bl"></span><span class="mc-scan__corner mc-scan__corner--br"></span>';
    var label = document.createElement('span');
    label.className = 'mc-scan__label';
    label.textContent = config.scanLabel || '';
    overlay.appendChild(label);
    scan.appendChild(overlay);
  }

  function renderProof() {
    renderScan();

    var photo = document.getElementById('mcHostPhoto');
    if (photo) {
      if (config.hostPhoto) {
        photo.src = config.hostPhoto;
        photo.hidden = false;
      } else {
        photo.replaceWith(placeholder('Photo of Sébastien Night, square or 4:5', 'host__photo'));
      }
    }
  }

  // ── Live session (French page 3) ─────────────────────────────────────

  // Injects /oto/countdown/countdown.js with this week's session as the deadline.
  // When the session starts (or if the page is opened during the session), it redirects to the live.
  function mountSessionCountdown() {
    var c = config.countdown || {};
    var script = document.createElement('script');
    script.src = '/oto/countdown/countdown.js';
    script.setAttribute('data-deadline', nextSession().toISOString());
    script.setAttribute('data-redirect', config.liveUrl);
    script.setAttribute('data-label', c.label || '');
    script.setAttribute('data-label-days', c.days || '');
    script.setAttribute('data-label-hours', c.hours || '');
    script.setAttribute('data-label-min', c.min || '');
    script.setAttribute('data-label-sec', c.sec || '');
    document.head.appendChild(script);
  }

  function setupJoin() {
    var block = document.getElementById('mcJoin');
    if (!block || !config.session) return;
    var start = nextSession().getTime();
    var opensAt = start - (config.joinButtonMinutesBefore || 0) * 60000;
    function check() {
      block.hidden = Date.now() < opensAt;
      if (!block.hidden) clearInterval(timer);
    }
    var timer = setInterval(check, 15000);
    check();
  }

  // A video with `days` (0 = Sunday ... 6 = Saturday) is only shown on those days, in the session
  // time zone (Paris for the French funnel). On other days its URL counts as empty, so the player
  // and its [data-mc-show-if] elements hide and the [data-mc-hide-if] fallbacks show.
  function applyVideoDays() {
    var timeZone = (config.session && config.session.timeZone) || 'Europe/Paris';
    var today = window.masterclassSession.wallClock(Date.now(), timeZone).weekday;
    Object.keys(config).forEach(function (key) {
      var video = config[key];
      if (video && video.embedUrl && Array.isArray(video.days) && video.days.indexOf(today) === -1) {
        video.embedUrl = '';
      }
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────

  function init() {
    applyVideoDays();
    captureAttribution();
    document.querySelectorAll('form.mc-form').forEach(setupForm);
    bindConditions();
    bindText();
    bindPlayers();
    bindSession();
    bindFirstName();
    prefillCheckout();
    renderProof();
    setupJoin();
  }

  // First name and email from the URL, or else from the registration saved in this browser
  function lead() {
    var saved = savedLead();
    var clean = function (v) { return v && !/[{}<>]/.test(v) ? v : ''; };
    return {
      first_name: clean(param('first_name')) || clean(saved.first_name),
      email: clean(param('email')) || clean(saved.email)
    };
  }

  window.masterclass = { mountSessionCountdown: mountSessionCountdown, lead: lead, param: param };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
