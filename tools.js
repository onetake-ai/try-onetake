/**
 * tools.js — OneTake AI shared tracking loader
 *
 * Loads Plausible, AnyTrack, Weglot, and FirstPromoter on every page that includes this file.
 * Include this script in the <head> of every HTML page in the project.
 * See README.md for details.
 */

// ── Plausible ──────────────────────────────────────────────────────────────
(function () {
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://plausible.io/js/pa-J8zROrLHf_IuTzmzQ6Gdx.js';
  document.head.appendChild(s);
  window.plausible = window.plausible || function () { (plausible.q = plausible.q || []).push(arguments); };
  plausible.init = plausible.init || function (i) { plausible.o = i || {}; };
  plausible.init();
}());

// ── AnyTrack ───────────────────────────────────────────────────────────────
!function(e,t,n,s,a){(a=t.createElement(n)).async=!0,a.src="https://assets.anytrack.io/01Nrajm7X3x6.js",(t=t.getElementsByTagName(n)[0]).parentNode.insertBefore(a,t),e[s]=e[s]||function(){(e[s].q=e[s].q||[]).push(arguments)}}(window,document,"script","AnyTrack");

// ── Weglot ─────────────────────────────────────────────────────────────────
(function () {
  var s = document.createElement('script');
  s.type = 'text/javascript';
  s.src = 'https://cdn.weglot.com/weglot.min.js';
  s.onload = function () {
    Weglot.initialize({ api_key: 'wg_b5330e33967081afe868173757c877b34' });
  };
  document.head.appendChild(s);
}());

// ── FirstPromoter ──────────────────────────────────────────────────────────
(function(w){w.fpr=w.fpr||function(){w.fpr.q=w.fpr.q||[];w.fpr.q[arguments[0]==='set'?'unshift':'push'](arguments);};})(window);
fpr("init", {cid:"qmdronva"});
fpr("click");

(function(){
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://cdn.firstpromoter.com/fpr.js';
  document.head.appendChild(s);
}());

function sendReferralToFirstPromoter() {
  var urlString = decodeURI(window.location.href);
  var url = new URL(urlString);
  if (url.searchParams.has("wj_lead_email")) {
    var emailFromUrl = url.searchParams.get("wj_lead_email");
    if (emailFromUrl) {
      if (window.fpr) window.fpr("referral", { email: emailFromUrl });
    }
  }
}

var stateDocumentCheck = setInterval(function(){
  if (document.readyState === "complete") {
    clearInterval(stateDocumentCheck);
    sendReferralToFirstPromoter();
  }
}, 100);
