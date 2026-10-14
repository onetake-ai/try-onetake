/* Layout variants of the French registration page (/masterclass/trafic/1/ and /2/).
 * Load after masterclass.js. The forms themselves are handled by masterclass.js (form.mc-form).
 *
 *   <dialog class="mv-modal" id="mvModal">   Registration popup (one per page)
 *   [data-mv-open]                          Opens the popup (CTA buttons of /1/)
 *   [data-mv-scroll="#id"]                  Scrolls to the inline form and focuses its first field (/2/)
 *   .mv-modal__intro--default / --exit      Intro shown for a CTA click / for the exit intent
 *
 * Exit intent: on desktop only, when the pointer leaves through the top of the window,
 * after a few seconds on the page and once per browser session.
 */
(function () {
  var EXIT_KEY = 'mv_exit_shown';
  var EXIT_DELAY_MS = 5000;

  var modal = document.getElementById('mvModal');

  function openModal(mode) {
    if (!modal || modal.open) return;
    modal.querySelectorAll('[data-mv-intro]').forEach(function (el) {
      el.hidden = el.getAttribute('data-mv-intro') !== mode;
      var title = el.querySelector('.mv-modal__title');
      if (!el.hidden && title) modal.setAttribute('aria-labelledby', title.id);
    });
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
    var field = modal.querySelector('input[name="first_name"]');
    if (field && window.matchMedia('(pointer: fine)').matches) field.focus();
  }

  function closeModal() {
    if (!modal) return;
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  }

  function setupModal() {
    if (!modal) return;
    document.querySelectorAll('[data-mv-open]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        openModal('default');
      });
    });
    modal.querySelectorAll('[data-mv-close]').forEach(function (button) {
      button.addEventListener('click', closeModal);
    });
    // A click on the backdrop (outside the card) closes the popup
    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeModal();
    });
  }

  function setupScroll() {
    document.querySelectorAll('[data-mv-scroll]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        var target = document.querySelector(button.getAttribute('data-mv-scroll'));
        if (!target) return;
        event.preventDefault();
        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        var field = target.querySelector('input[name="first_name"]');
        if (field) field.focus({ preventScroll: true });
      });
    });
  }

  function exitAlreadyShown() {
    try { return sessionStorage.getItem(EXIT_KEY) === '1'; } catch (e) { return false; }
  }

  function setupExitIntent() {
    if (!modal || exitAlreadyShown()) return;
    if (!window.matchMedia('(min-width: 768px) and (pointer: fine)').matches) return;
    var armed = false;
    setTimeout(function () { armed = true; }, EXIT_DELAY_MS);

    function onLeave(event) {
      if (!armed || event.relatedTarget || event.clientY > 0 || modal.open) return;
      document.removeEventListener('mouseout', onLeave);
      try { sessionStorage.setItem(EXIT_KEY, '1'); } catch (e) { /* the popup may show again next visit */ }
      openModal('exit');
    }
    document.addEventListener('mouseout', onLeave);
  }

  function init() {
    setupModal();
    setupScroll();
    setupExitIntent();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
