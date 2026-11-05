/**
 * Le Challenge des Experts à Haute Valeur: sales page script
 *
 * Display states (all dates Europe/Paris; Paris is UTC+1 from Oct 25, 2026):
 *   launch     until Fri Oct 30 23:59:59      annual plan only
 *   quarterly  Sat Oct 31 00:00 to Nov 2       annual + quarterly
 *   closed     from Tue Nov 3 00:00           the countdown bar in <head> redirects to /oto/too-late/
 * The edge script (edge-scripts/airwallex-checkout.ts, LIVE_PLANS) enforces the same dates server side.
 *
 * ?preview_state=launch|quarterly forces a display state (display only: checkouts still follow
 * the server dates). Combine with ?unlockfor=1 to look at the page after the deadline.
 */
(function () {
  'use strict';

  var CONFIG = {
    timeZone:         'Europe/Paris',
    quarterlyOpensAt: '2026-10-30T23:00:00Z',   // Sat Oct 31, 00:00 Paris
    closesAt:         '2026-11-02T23:00:00Z'    // Mon Nov 2, 23:59:59 Paris (exclusive end)
  };

  function offerState() {
    var preview = new URLSearchParams(window.location.search).get('preview_state');
    if (preview === 'launch' || preview === 'quarterly') return preview;
    var now = Date.now();
    if (now >= Date.parse(CONFIG.closesAt)) return 'closed';
    return now >= Date.parse(CONFIG.quarterlyOpensAt) ? 'quarterly' : 'launch';
  }

  // Set right away (this script is loaded at the end of <body>) so the plans don't flicker
  document.documentElement.setAttribute('data-offer-state', offerState());

  // The skills (section 6) are rendered by /4dcm/challenge-skills.js, shared with /4dcm/acces-challenge/
})();
