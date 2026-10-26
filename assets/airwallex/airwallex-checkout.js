/**
 * /assets/airwallex/airwallex-checkout.js
 *
 * Front-end helper for Airwallex Hosted Billing Checkout. Needs /airwallex-data.js loaded first,
 * and /assets/airwallex/airwallex-checkout.css. Page copy is in French (tutoiement).
 *
 *   <button data-airwallex-plan="challenge-yearly">Je rejoins le Challenge</button>
 *     Click: popup asking prénom + email, then AddToCart (AnyTrack, Plausible; Userlist from the
 *     edge script), then redirect to the Airwallex checkout created on the spot (valid 1 hour).
 *
 *   <a href="#" data-airwallex-wire="challenge-yearly">Je préfère payer par virement</a>
 *     Click: popup with prénom, nom, email, entreprise. On submit, InitiateCheckout (AnyTrack,
 *     Plausible; Userlist with pledged_wire_payment_on), then the bank details and reference.
 *
 *   window.oneTakeAirwallex.confirmPurchase()  (success page)
 *     Asks the edge script whether the checkout started in this browser is paid, then fires
 *     Purchase (AnyTrack, Plausible) once. Resolves with the purchase, or null.
 *
 * Prefill: ?first_name= and ?email= (values still holding a Liquid tag are ignored), then the
 * last values typed on this browser. Attribution: ?ref= and utm_* of the last visit that had any,
 * kept 30 days, plus the AnyTrack click ID.
 * On the OFFER_CLOSED error the visitor is sent to /oto/too-late/.
 */
(function () {
  'use strict';

  var config = window.AIRWALLEX_CONFIG;
  if (!config) { console.error('airwallex-checkout.js: load /airwallex-data.js first'); return; }

  var LEAD_KEY        = 'onetake-airwallex-lead';
  var CHECKOUT_KEY    = 'onetake-airwallex-checkout';
  var ATTRIBUTION_KEY = 'onetake-airwallex-attribution';
  var ATTRIBUTION_DAYS = 30;
  var ATTRIBUTION_PARAMS = { ref: 'referred_by', utm_source: 'utm_source', utm_medium: 'utm_medium',
    utm_campaign: 'utm_campaign', utm_content: 'utm_content', utm_term: 'utm_term', utm_channel: 'utm_channel' };
  var TOO_LATE_URL = 'https://try.onetake.ai/oto/too-late/';
  var ERROR_TEXT = 'Oups, la page de paiement n\'a pas pu s\'ouvrir. Réessaie dans un instant ou écris-nous à ' + config.supportEmail + '.';
  var WIRE_ERROR_TEXT = 'Oups, ton formulaire n\'a pas pu être envoyé. Réessaie dans un instant ou écris-nous à ' + config.supportEmail + '.';

  // ── Storage (may be unavailable: private mode, blocked cookies) ─────────────

  function read(storage, key) {
    try { return JSON.parse(window[storage].getItem(key)) || null; } catch (e) { return null; }
  }
  function write(storage, key, value) {
    try { window[storage].setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  // ── Prefill and attribution ──────────────────────────────────────────────────

  function urlValue(name) {
    var value = new URLSearchParams(window.location.search).get(name) || '';
    return /\{\{|\{%/.test(value) ? '' : value.trim();   // unrendered Liquid tag
  }

  function savedLead() {
    var lead = read('localStorage', LEAD_KEY) || {};
    return {
      first_name: urlValue('first_name') || lead.first_name || '',
      last_name:  lead.last_name || '',
      email:      urlValue('email') || lead.email || '',
      company:    lead.company || ''
    };
  }

  function saveLead(values) {
    var lead = read('localStorage', LEAD_KEY) || {};
    Object.keys(values).forEach(function (k) { if (values[k]) lead[k] = values[k]; });
    write('localStorage', LEAD_KEY, lead);
  }

  // Last touch: the current URL wins when it has any parameter, else the saved values (30 days)
  function attribution() {
    var params = new URLSearchParams(window.location.search);
    var found = {};
    Object.keys(ATTRIBUTION_PARAMS).forEach(function (key) {
      var value = params.get(key);
      if (value) found[ATTRIBUTION_PARAMS[key]] = value.slice(0, 200);
    });
    if (Object.keys(found).length) {
      write('localStorage', ATTRIBUTION_KEY, { values: found, savedAt: Date.now() });
    } else {
      var saved = read('localStorage', ATTRIBUTION_KEY);
      if (saved && saved.values && Date.now() - saved.savedAt < ATTRIBUTION_DAYS * 86400000) found = saved.values;
    }
    if (typeof window.AnyTrack === 'function') {
      try { var atclid = window.AnyTrack('atclid'); if (atclid) found.click_id = String(atclid); } catch (e) { /* not loaded yet */ }
    }
    return found;
  }
  attribution();   // Save this visit's parameters right away

  function pageSlug() {
    return window.location.pathname.replace(/^\/+|\/+$/g, '') || 'home';
  }

  // ── Tracking ─────────────────────────────────────────────────────────────────

  function track(eventName, plan, extra) {
    var data = { value: plan.value, currency: plan.currency };
    Object.keys(extra || {}).forEach(function (k) { data[k] = extra[k]; });
    if (typeof window.AnyTrack === 'function') window.AnyTrack('trigger', eventName, data);
    if (typeof window.plausible === 'function') {
      var options = { props: { plan: data.planKey || '', payment_method: data.paymentMethod || 'card' } };
      if (eventName === 'Purchase') options.revenue = { amount: plan.value, currency: plan.currency };
      window.plausible(eventName, options);
    }
  }

  // ── Edge script calls ────────────────────────────────────────────────────────

  function post(path, body) {
    return fetch(config.endpoint.replace(/\/+$/, '') + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var error = new Error(data.error || 'HTTP ' + res.status);
          error.code = data.code || '';
          throw error;
        }
        return data;
      });
    });
  }

  function handleClosed(error) {
    if (error && error.code === 'OFFER_CLOSED') { window.location.replace(TOO_LATE_URL); return true; }
    return false;
  }

  // ── Popup ────────────────────────────────────────────────────────────────────

  var modal = null;
  var lastFocus = null;

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function openModal(content, titleId) {
    closeModal();
    lastFocus = document.activeElement;
    var close = el('button', { type: 'button', 'class': 'awx-close', 'aria-label': 'Fermer' });
    close.innerHTML = '&times;';
    close.addEventListener('click', closeModal);
    var card = el('div', { 'class': 'awx-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId }, [close, content]);
    modal = el('div', { 'class': 'awx-overlay' }, [card]);
    modal.addEventListener('mousedown', function (e) { if (e.target === modal) closeModal(); });
    document.body.appendChild(modal);
    document.documentElement.classList.add('awx-open');
    var first = card.querySelector('input:not([value]), input[value=""], input, button.awx-submit');
    if (first) first.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.remove();
    modal = null;
    document.documentElement.classList.remove('awx-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (!modal) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    // Keep the focus inside the popup
    var focusable = modal.querySelectorAll('button, input, a[href]');
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  function field(name, label, type, value, required, autocomplete) {
    var id = 'awx-' + name;
    var input = el('input', { id: id, name: name, type: type, autocomplete: autocomplete });
    input.value = value || '';
    if (required) input.required = true;
    return el('div', { 'class': 'awx-field' }, [el('label', { 'for': id, text: label }), input]);
  }

  function setLoading(button, loading, text) {
    button.disabled = loading;
    button.classList.toggle('is-loading', loading);
    if (text) button.textContent = text;
  }

  // ── Card checkout ────────────────────────────────────────────────────────────

  function openCheckout(planKey, trigger) {
    var plan = config.plans[planKey];
    if (!plan) { console.error('airwallex-checkout.js: unknown plan', planKey); return; }
    var lead = savedLead();

    var error = el('p', { 'class': 'awx-error', role: 'alert' });
    var submit = el('button', { type: 'submit', 'class': 'awx-submit', text: 'Continuer vers le paiement' });
    var form = el('form', { 'class': 'awx-form', novalidate: '' }, [
      el('p', { 'class': 'awx-eyebrow', text: plan.priceLabel }),
      el('h2', { id: 'awx-title', text: 'Dernière étape avant le paiement' }),
      el('p', { 'class': 'awx-intro', text: 'Indique ton prénom et ton email\u00a0: c\'est là que tu recevras tes accès.' }),
      field('first_name', 'Prénom', 'text', lead.first_name, true, 'given-name'),
      field('email', 'Email', 'email', lead.email, true, 'email'),
      error,
      submit,
      el('p', { 'class': 'awx-note', text: 'Paiement sécurisé par carte sur la page de notre partenaire Airwallex. Garantie inconditionnelle de 14 jours.' })
    ]);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstName = form.first_name.value.trim();
      var email = form.email.value.trim();
      error.textContent = '';
      if (!firstName) { error.textContent = 'Indique ton prénom.'; form.first_name.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { error.textContent = 'Indique une adresse email valide.'; form.email.focus(); return; }

      saveLead({ first_name: firstName, email: email });
      track('AddToCart', plan, { planKey: planKey, email: email, firstName: firstName });
      setLoading(submit, true, 'Ouverture du paiement…');
      if (trigger) trigger.classList.add('is-loading');

      post('/checkout', { plan: planKey, page: pageSlug(), email: email, first_name: firstName, attribution: attribution() })
        .then(function (data) {
          write('sessionStorage', CHECKOUT_KEY, { id: data.checkout_id, plan: planKey });
          write('localStorage', CHECKOUT_KEY, { id: data.checkout_id, plan: planKey, at: Date.now() });
          window.location.href = data.url;
        })
        .catch(function (err) {
          if (handleClosed(err)) return;
          console.error('Airwallex checkout failed', err);
          setLoading(submit, false, 'Continuer vers le paiement');
          if (trigger) trigger.classList.remove('is-loading');
          error.textContent = ERROR_TEXT;
        });
    });

    openModal(form, 'awx-title');
  }

  // ── Wire transfer ────────────────────────────────────────────────────────────

  function copyButton(value, label) {
    var button = el('button', { type: 'button', 'class': 'awx-copy', 'aria-label': 'Copier ' + label, text: 'Copier' });
    button.addEventListener('click', function () {
      var done = function () {
        button.textContent = 'Copié';
        setTimeout(function () { button.textContent = 'Copier'; }, 2000);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(value).then(done, function () { fallbackCopy(value); done(); });
      } else {
        fallbackCopy(value);
        done();
      }
    });
    return button;
  }

  function fallbackCopy(value) {
    var area = el('textarea', { readonly: '', 'class': 'awx-offscreen' });
    area.value = value;
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); } catch (e) { /* nothing more to try */ }
    area.remove();
  }

  function bankRow(label, value, copyValue) {
    var children = [el('dt', { text: label }), el('dd', {}, [el('strong', { text: value })])];
    if (copyValue) children[1].appendChild(copyButton(copyValue, label));
    return children;
  }

  function showBankDetails(container, plan, values) {
    var bank = config.bank;
    var reference = plan.wire.referencePrefix + ' ' + values.last_name.toUpperCase() + ' ' + values.first_name;
    var list = el('dl', { 'class': 'awx-bank' });
    [].concat(
      bankRow('Titulaire', bank.holder),
      bankRow('IBAN', bank.iban, bank.iban.replace(/\s+/g, '')),
      bankRow('BIC', bank.bic, bank.bic),
      bankRow('Banque', bank.address),
      bankRow('Référence à indiquer', reference, reference)
    ).forEach(function (node) { list.appendChild(node); });

    container.innerHTML = '';
    container.appendChild(el('h2', { id: 'awx-title', text: 'Merci\u00a0! Voici les coordonnées pour ton virement de ' + plan.wire.amountLabel + '\u00a0:' }));
    container.appendChild(list);
    container.appendChild(el('p', { 'class': 'awx-intro', text: 'Indique bien cette référence pour qu\'on puisse identifier ton paiement. Dès réception, on active ton accès et tu reçois un email de confirmation.' }));
    var heading = container.querySelector('h2');
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  }

  function openWire(planKey) {
    var plan = config.plans[planKey];
    if (!plan || !plan.wire) { console.error('airwallex-checkout.js: no wire transfer for', planKey); return; }
    var lead = savedLead();

    var error = el('p', { 'class': 'awx-error', role: 'alert' });
    var submit = el('button', { type: 'submit', 'class': 'awx-submit', text: 'Afficher les coordonnées bancaires' });
    var form = el('form', { 'class': 'awx-form', novalidate: '' }, [
      el('p', { 'class': 'awx-eyebrow', text: 'Paiement par virement' }),
      el('h2', { id: 'awx-title', text: 'Tu préfères payer l\'abonnement annuel par virement\u00a0?' }),
      el('p', { 'class': 'awx-intro', text: 'Indique-nous tes coordonnées pour afficher les informations bancaires.' }),
      el('div', { 'class': 'awx-row' }, [
        field('first_name', 'Prénom', 'text', lead.first_name, true, 'given-name'),
        field('last_name', 'Nom', 'text', lead.last_name, true, 'family-name')
      ]),
      field('email', 'Email', 'email', lead.email, true, 'email'),
      field('company', 'Entreprise (facultatif)', 'text', lead.company, false, 'organization'),
      error,
      submit
    ]);
    var container = el('div', { 'class': 'awx-form' }, [form]);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var values = {
        first_name: form.first_name.value.trim(),
        last_name:  form.last_name.value.trim(),
        email:      form.email.value.trim(),
        company:    form.company.value.trim()
      };
      error.textContent = '';
      if (!values.first_name) { error.textContent = 'Indique ton prénom.'; form.first_name.focus(); return; }
      if (!values.last_name) { error.textContent = 'Indique ton nom.'; form.last_name.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) { error.textContent = 'Indique une adresse email valide.'; form.email.focus(); return; }

      saveLead(values);
      setLoading(submit, true, 'Envoi…');
      post('/wire', {
        plan: planKey, page: pageSlug(), first_name: values.first_name, last_name: values.last_name,
        email: values.email, company: values.company, attribution: attribution()
      })
        .then(function () {
          track('InitiateCheckout', plan, { planKey: planKey, paymentMethod: 'wire', email: values.email, firstName: values.first_name });
          showBankDetails(container, plan, values);
        })
        .catch(function (err) {
          if (handleClosed(err)) return;
          console.error('Wire transfer form failed', err);
          setLoading(submit, false, 'Afficher les coordonnées bancaires');
          error.textContent = WIRE_ERROR_TEXT;
        });
    });

    openModal(container, 'awx-title');
  }

  // ── Success page ─────────────────────────────────────────────────────────────

  // The checkout may still be processing when the visitor lands: a few tries, 2 s apart
  function confirmPurchase() {
    var started = read('sessionStorage', CHECKOUT_KEY) || read('localStorage', CHECKOUT_KEY);
    if (!started || !started.id) return Promise.resolve(null);
    var firedKey = 'onetake-airwallex-purchase-' + started.id;
    if (read('localStorage', firedKey)) return Promise.resolve(read('localStorage', firedKey));

    var attempt = function (left) {
      return post('/purchase', { checkout_id: started.id }).then(function (data) {
        if (data.completed) return data;
        if (left <= 0) return null;
        return new Promise(function (r) { setTimeout(r, 2000); }).then(function () { return attempt(left - 1); });
      });
    };

    return attempt(4).then(function (data) {
      if (!data) return null;
      var plan = config.plans[data.plan] || { value: data.value, currency: data.currency };
      track('Purchase', plan, { planKey: data.plan, transactionId: started.id, email: data.email, firstName: data.first_name });
      write('localStorage', firedKey, data);
      return data;
    }).catch(function (err) {
      console.error('Purchase confirmation failed', err);
      return null;
    });
  }

  // ── Bindings ─────────────────────────────────────────────────────────────────

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest && e.target.closest('[data-airwallex-plan], [data-airwallex-wire]');
    if (!trigger) return;
    e.preventDefault();
    if (trigger.hasAttribute('data-airwallex-wire')) openWire(trigger.getAttribute('data-airwallex-wire'));
    else openCheckout(trigger.getAttribute('data-airwallex-plan'), trigger);
  });

  // Back from Airwallex with the browser button: the page may come from the bfcache
  window.addEventListener('pageshow', function () {
    document.querySelectorAll('[data-airwallex-plan].is-loading').forEach(function (t) { t.classList.remove('is-loading'); });
    closeModal();
  });

  window.oneTakeAirwallex = {
    openCheckout: openCheckout,
    openWire: openWire,
    confirmPurchase: confirmPurchase,
    attribution: attribution
  };
})();
