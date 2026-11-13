/**
 * Coachs et Formateurs : ventes record pendant Black Friday. Offer state, shared by the three pages
 * (offre/, clients/, retour/). Load it in <head> so the plans don't flicker.
 *
 * Display states (all dates Europe/Paris, UTC+1):
 *   launch     Fri Nov 13 to Sun Nov 15     annual plan only
 *   quarterly  from Mon Nov 16 00:00        annual + quarterly (last 2 days)
 * The pages close after Tue Nov 17 23:59:59 Paris: the countdown bar in <head> redirects to
 * /oto/too-late/, unless the link carries ?unlockfor=1 (the page then stays open, both plans shown).
 * The edge script (edge-scripts/airwallex-checkout.ts, LIVE_PLANS) enforces the opening dates only.
 *
 * ?preview_state=launch|quarterly forces a display state (display only: checkouts still follow
 * the server dates). The CSS lives in /4dcm/le-challenge/style.css ([data-show-state="quarterly"]).
 */
(function () {
  'use strict';

  var CONFIG = {
    quarterlyOpensAt: '2026-11-15T23:00:00Z'    // Mon Nov 16, 00:00 Paris
    // Closing (Tue Nov 17, 23:59:59 Paris = 2026-11-17T23:00:00Z): data-deadline of the countdown in each page
  };

  function offerState() {
    var preview = new URLSearchParams(window.location.search).get('preview_state');
    if (preview === 'launch' || preview === 'quarterly') return preview;
    return Date.now() >= Date.parse(CONFIG.quarterlyOpensAt) ? 'quarterly' : 'launch';
  }

  document.documentElement.setAttribute('data-offer-state', offerState());
})();
