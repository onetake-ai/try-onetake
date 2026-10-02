/**
 * /masterclass/masterclass.js
 *
 * Shared behavior for the masterclass funnels (/masterclass/traffic/ and /masterclass/trafic/).
 * Reads window.MASTERCLASS_CONFIG (the funnel's config.js) and window.masterclassSession
 * (session-date.js). Load order on every page: config.js, session-date.js, masterclass.js.
 *
 * Markup hooks (all optional on a page):
 *   form.mc-form                 Registration form: sends the lead to Userlist, then goes to page 2
 *   [data-mc-text="path"]        Text from the config (e.g. "email.subject"); placeholder when empty
 *   [data-mc-href="path"]        Link URL from the config
 *   [data-mc-player="path"]      OneTake player (16:9) from the config; placeholder when empty
 *   [data-mc-session]            Date of the next live session, in French
 *   [data-mc-first-name]         ", Name" from ?first_name= (or the name typed at registration)
 *   #mcProfiles, #mcReels        Proof grids, rendered from config.profiles and config.reels
 *   #mcHostPhoto                 Host photo from config.hostPhoto
 *   #mcOffer                     Watch page offer block (offerRevealSeconds, offer countdown)
 *   #mcJoin                      "Join the live" block, shown just before the session
 *   [data-mc-prefill]            Fills #firstName and #email (checkout form) from the URL or registration
 *
 * masterclass.mountSessionCountdown() is called from <head> on the French confirmation page.
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

  // ── Registration forms ───────────────────────────────────────────────

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
        window.location.assign(config.urls.checkInbox);
      }).catch(function () {
        setLoading(false);
        showError(config.messages.network, null);
      }).then(function () {
        clearTimeout(timeout);
      });
    });
  }

  // ── Config bindings ──────────────────────────────────────────────────

  function bindText() {
    document.querySelectorAll('[data-mc-text]').forEach(function (el) {
      var value = get(el.getAttribute('data-mc-text'));
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
        holder.appendChild(placeholder(holder.getAttribute('data-placeholder'), 'ph--video'));
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

  function figure(item, ratioClass, phLabel, caption) {
    var fig = document.createElement('figure');
    fig.className = 'proof-item ' + ratioClass;
    if (item.image) {
      var img = document.createElement('img');
      img.src = item.image;
      img.alt = item.alt || '';
      img.loading = 'lazy';
      fig.appendChild(img);
    } else {
      fig.appendChild(placeholder(phLabel));
    }
    if (caption) fig.appendChild(caption);
    return fig;
  }

  function renderProof() {
    var profiles = document.getElementById('mcProfiles');
    if (profiles) {
      (config.profiles || []).forEach(function (p) {
        var caption = document.createElement('figcaption');
        caption.className = 'proof-item__caption';
        caption.textContent = p.name;
        profiles.appendChild(figure(p, 'proof-item--profile',
          'Instagram profile screenshot, ' + p.name + ', follower count visible', caption));
      });
    }

    var reels = document.getElementById('mcReels');
    if (reels) {
      (config.reels || []).forEach(function (r, i) {
        var caption = document.createElement('figcaption');
        caption.className = 'proof-item__caption';
        if (r.creator && r.views) {
          var name = document.createElement('strong');
          name.textContent = r.creator;
          caption.appendChild(name);
          caption.appendChild(document.createTextNode(' ' + r.views + ' ' + config.viewsSuffix));
        } else {
          caption.appendChild(inlinePlaceholder('creator name + view count, Reel ' + (i + 1)));
        }
        reels.appendChild(figure(r, 'proof-item--reel',
          'Reel screenshot ' + (i + 1) + ', 9:16, view count visible', caption));
      });
    }

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

  // ── Watch page offer (English page 3) ────────────────────────────────

  function pad(n) { return String(n).padStart(2, '0'); }

  function setupOffer() {
    var block = document.getElementById('mcOffer');
    if (!block) return;

    var reveal = parseFloat(config.offerRevealSeconds) || 0;
    if (reveal > 0) {
      block.hidden = true;
      setTimeout(function () { block.hidden = false; }, reveal * 1000);
    }

    var clock = document.getElementById('mcOfferCountdown');
    var deadline = Date.parse(config.offerDeadline);
    if (!clock || !config.offerCountdownEnabled || isNaN(deadline)) return;

    clock.hidden = false;
    var timer;
    function tick() {
      var diff = deadline - Date.now();
      if (diff <= 0) {
        clearInterval(timer);
        block.remove();
        return;
      }
      clock.querySelector('[data-unit="d"]').textContent = Math.floor(diff / 86400000);
      clock.querySelector('[data-unit="h"]').textContent = pad(Math.floor(diff % 86400000 / 3600000));
      clock.querySelector('[data-unit="m"]').textContent = pad(Math.floor(diff % 3600000 / 60000));
      clock.querySelector('[data-unit="s"]').textContent = pad(Math.floor(diff % 60000 / 1000));
    }
    tick();
    timer = setInterval(tick, 1000);
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

  // ── Init ─────────────────────────────────────────────────────────────

  function init() {
    document.querySelectorAll('form.mc-form').forEach(setupForm);
    bindText();
    bindPlayers();
    bindSession();
    bindFirstName();
    prefillCheckout();
    renderProof();
    setupOffer();
    setupJoin();
  }

  window.masterclass = { mountSessionCountdown: mountSessionCountdown };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
