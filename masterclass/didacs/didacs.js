/**
 * /masterclass/didacs/didacs.js
 *
 * Didacs mockups (/masterclass/didacs/, /1/ and /2/). No tracking and no real form: these pages only
 * show how the Didacs Center masterclass page could be redesigned. Load after session-date.js and
 * phone-field.js (and before variants.js on /1/ and /2/).
 *
 *   [data-dd-session]          Filled with the next session: every Saturday at 11:00, Paris time
 *   [data-dd-session-day]      Filled with the weekday only ("samedi")
 *   [data-dd-testimonials]     "marquee" (two scrolling rows) or "grid" (masonry wall)
 *   form.mc-form               Checks the fields, then says it is a mockup (nothing is sent)
 *
 * Testimonial images stay on the Didacs servers (LeadConnector): never copy them into the repo.
 */
(function () {
  'use strict';

  var SESSION = { weekday: 6, time: '11:00', cutoff: '12:00', timeZone: 'Europe/Paris' };

  var CDN = 'https://assets.cdn.filesafe.space/8DiEKp6ty9FS1MywgVL9/media/';
  var TESTIMONIALS = [
    { src: CDN + '6aa018e3bfc1456f8c63a4a6.webp', alt: 'Témoignage de Géraldine : 16/20', width: 1672, height: 940 },
    { src: CDN + '6aa018e3d63e08439cc53981.webp', alt: 'Témoignage de Florence : 19/20', width: 383, height: 330 },
    { src: CDN + '6aa018e3d63e08439cc5398f.webp', alt: 'Témoignage d\'Alessandro : 18/20', width: 1672, height: 940 },
    { src: CDN + '6aa018e3dd867dc12dd613b8.webp', alt: 'Témoignage de Virginie', width: 389, height: 416 },
    { src: CDN + '6aa018e3641597c752ad7cea.webp', alt: 'Témoignage de Carole : 17/20', width: 1672, height: 940 }
  ];

  function fillSession() {
    var api = window.masterclassSession;
    if (!api) return;
    var date = api.next(Date.now(), SESSION);
    var label = api.formatFr(date, SESSION);
    document.querySelectorAll('[data-dd-session]').forEach(function (el) { el.textContent = label; });
    document.querySelectorAll('[data-dd-session-day]').forEach(function (el) { el.textContent = label.split(' ')[0]; });
  }

  function image(item, hidden, eager) {
    var img = document.createElement('img');
    img.src = item.src;
    img.width = item.width;
    img.height = item.height;
    // Scrolling rows: load now, or images still off to the side would show up blank as they slide in
    img.loading = eager ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.alt = hidden ? '' : item.alt;
    if (hidden) img.setAttribute('aria-hidden', 'true');
    return img;
  }

  function track(items, reverse) {
    var row = document.createElement('div');
    row.className = 'dd-marquee__track' + (reverse ? ' dd-marquee__track--reverse' : '');
    // Two copies for a seamless loop (the animation moves the track by half its width)
    items.forEach(function (item) { row.appendChild(image(item, reverse, true)); });
    items.forEach(function (item) { row.appendChild(image(item, true, true)); });
    return row;
  }

  function renderTestimonials() {
    document.querySelectorAll('[data-dd-testimonials]').forEach(function (box) {
      var mode = box.getAttribute('data-dd-testimonials');
      if (mode === 'grid') {
        box.classList.add('dd-grid');
        TESTIMONIALS.forEach(function (item) { box.appendChild(image(item, false)); });
        return;
      }
      box.classList.add('dd-marquee');
      box.appendChild(track(TESTIMONIALS, false));
      box.appendChild(track(TESTIMONIALS.slice().reverse(), true));
    });
  }

  function setupForms() {
    var phoneField = window.oneTakePhoneField;
    document.querySelectorAll('form.mc-form').forEach(function (form) {
      var phone = form.querySelector('[name="telephone"]');
      if (phone && phoneField) phoneField.attach(phone, { lang: 'fr' });
      var message = form.querySelector('.mc-form__error');

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!form.reportValidity()) return;
        if (phone && phoneField && !phoneField.read(phone).value) {
          phone.setCustomValidity('Vérifie ton numéro de mobile (et le pays).');
          phone.reportValidity();
          phone.setCustomValidity('');
          return;
        }
        if (message) {
          message.textContent = 'Maquette : ce formulaire n\'envoie rien.';
          message.classList.add('is-mock');
          message.hidden = false;
        }
      });
    });
  }

  function init() {
    fillSession();
    renderTestimonials();
    setupForms();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
