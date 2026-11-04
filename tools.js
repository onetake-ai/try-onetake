/**
 * tools.js — OneTake AI shared tracking loader
 *
 * Loads CrazyEgg, Plausible, AnyTrack, Weglot, FirstPromoter, and useBouncer on every page
 * that includes this file.
 * Include this script before </body> in every HTML page in the project.
 */

// ── CrazyEgg ───────────────────────────────────────────────────────────────
// TODO: remove the inline CrazyEgg snippet from /index.html once that file is redeployed
(function () {
  var s = document.createElement('script');
  s.async = true;
  s.src = '//script.crazyegg.com/pages/scripts/0131/5613.js';
  document.head.appendChild(s);
}());

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
if (!window.__disable_weglot) {
  (function () {
    var s = document.createElement('script');
    s.type = 'text/javascript';
    s.src = 'https://cdn.weglot.com/weglot.min.js';
    s.onload = function () {
      Weglot.initialize({ api_key: 'wg_b5330e33967081afe868173757c877b34' });
    };
    document.head.appendChild(s);
  }());
}

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

// Values the checkouts send to Paddle (customData) and Airwallex (metadata) as `tid` and `ref_id`,
// so the webhook handler can pass them to the FirstPromoter sale API.
// tid: visitor tracking ID (fpr.js, else the _fprom_tid cookie, _fprom_track on old accounts).
// refId: the last ?ref= seen in this browser in the past 30 days, for when the cookie is missing
// (ad blocker stopping fpr.js, cookies cleared...).
window.oneTakeFirstPromoter = (function () {
  var REF_KEY = 'onetake-fp-ref';
  var REF_DAYS = 30;

  function tid() {
    if (window.FPROM && window.FPROM.data && window.FPROM.data.tid) return String(window.FPROM.data.tid);
    var match = document.cookie.match(/(?:^|;\s*)_fprom_(?:tid|track)=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function refId() {
    try {
      var saved = JSON.parse(localStorage.getItem(REF_KEY));
      if (saved && saved.value && Date.now() - saved.savedAt < REF_DAYS * 86400000) return saved.value;
    } catch (e) { /* storage unavailable */ }
    return '';
  }

  // Last touch: a new ?ref= replaces the saved one (a value still holding a Liquid tag is ignored)
  var ref = (new URLSearchParams(window.location.search).get('ref') || '').trim();
  if (ref && !/\{\{|\{%/.test(ref)) {
    try { localStorage.setItem(REF_KEY, JSON.stringify({ value: ref.slice(0, 100), savedAt: Date.now() })); } catch (e) { /* storage unavailable */ }
  }

  return { tid: tid, refId: refId };
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

// ── useBouncer ─────────────────────────────────────────────────────────────

var bouncerConfig = {
  apikey: 'gTVUH7N0EaSO4CYDoNf1bdedQriEqXCNadVoNNaZ',
  feedbackOverlayMessage: 'Merci d\'entrer une adresse email valide.',
};

(function () {
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://app.usebouncer.com/bouncer-script/bouncer-script-beta.js';
  // tools.js is usually loaded in <head>, where document.body doesn't exist yet
  (document.body || document.head).appendChild(s);
}());
