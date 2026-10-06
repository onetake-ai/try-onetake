/**
 * /masterclass/live-guard.js
 *
 * Keeps a funnel offline until it is ready: when MASTERCLASS_CONFIG.live is false, every page of
 * that funnel redirects to MASTERCLASS_CONFIG.offlineRedirectUrl. Load it in <head>, right after
 * the funnel's config.js, so the redirect happens before the page shows.
 * Preview while offline: add ?preview=1 to the URL.
 */
(function () {
  'use strict';
  var config = window.MASTERCLASS_CONFIG || {};
  if (config.live !== false) return;
  if (new URLSearchParams(window.location.search).get('preview') === '1') return;
  window.location.replace(config.offlineRedirectUrl || '/');
})();
