/**
 * /masterclass/didacs/didacs.js
 *
 * Didacs mockups (/masterclass/didacs/, /1/ and /2/). No tracking and no real form: these pages only
 * show how the Didacs Center masterclass page could be redesigned. Load after session-date.js and
 * phone-field.js (and before variants.js on /1/ and /2/).
 *
 *   [data-dd-session]          Filled with the next session: every Saturday at 11:00, Paris time
 *   [data-dd-session-day]      Filled with the weekday only ("samedi")
 *   [data-dd-testimonials]     "marquee" (one scrolling row of large cards) or "grid" (masonry wall)
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
    // "(heure de Paris)" wraps as one unit, so the pre-header never breaks inside it
    var zone = ' (heure de Paris)';
    var main = label.slice(0, label.length - (label.slice(-zone.length) === zone ? zone.length : 0));
    document.querySelectorAll('[data-dd-session]').forEach(function (el) {
      el.textContent = main;
      if (main !== label) {
        var span = document.createElement('span');
        span.className = 'dd-nowrap';
        span.textContent = zone.trim();
        el.append(' ', span);
      }
    });
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
    // Never enlarge an image past its own width: the small Google reviews would get blurry
    img.style.maxWidth = item.width + 'px';
    if (hidden) img.setAttribute('aria-hidden', 'true');
    return img;
  }

  function track(items) {
    var row = document.createElement('div');
    row.className = 'dd-marquee__track';
    // Two copies for a seamless loop (the animation moves the track by half its width)
    items.forEach(function (item) { row.appendChild(image(item, false, true)); });
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
      // One row of large cards: the testimonials hold a lot of text and must stay legible
      box.classList.add('dd-marquee');
      box.appendChild(track(TESTIMONIALS));
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
