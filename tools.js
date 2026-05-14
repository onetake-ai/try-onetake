/**
 * tools.js — OneTake AI shared tracking loader
 *
 * Loads CrazyEgg, Plausible, AnyTrack, Weglot, FirstPromoter, and useBouncer on every page
 * that includes this file. Also exposes submitLead() for opt-in form handling.
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

// ── Lead submission ────────────────────────────────────────────────────────

var USERLIST_PROXY_URL = 'https://userlist-proxy-for-tryonetakeai-84nhl.bunny.run/track';
var REDIRECT_URL = 'https://try.onetake.ai/bootcamps/ehv/vpl1-10k/';

function submitLead(email, prenom, language) {
  document.querySelectorAll('[type="submit"]').forEach(function (btn) { btn.disabled = true; });

  fetch(USERLIST_PROXY_URL, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, first_name: prenom, language: language, url: location.href })
  });

  if (window.plausible) window.plausible('Lead');
  if (window.CE2) window.CE2.set('wr', 1);

  // ── Anytrack ─────────────────────────────────────────────────────────────
  // TODO: uncomment and add your Anytrack container script src below when ready
  // (function () {
  //   var s = document.createElement('script');
  //   s.async = true;
  //   s.src = 'https://assets.anytrack.io/YOUR_CONTAINER_ID.js';
  //   document.head.appendChild(s);
  // }());
  if (window.anytrkTrack) window.anytrkTrack('Lead');

  setTimeout(function () { location.href = REDIRECT_URL; }, 600);
}

// ── useBouncer ─────────────────────────────────────────────────────────────

var bouncerConfig = {
  apikey: 'gTVUH7N0EaSO4CYDoNf1bdedQriEqXCNadVoNNaZ',
  feedbackOverlayMessage: 'Merci d\'entrer une adresse email valide.',
  onSuccess: function (emailInput) {
    var form = emailInput.form;
    var email = emailInput.value;
    var prenomInput = form ? form.querySelector('[name="prenom"]') : null;
    var prenom = prenomInput ? prenomInput.value : '';
    var langInput = form ? form.querySelector('[name="language"]') : null;
    var language = langInput ? langInput.value : '';
    submitLead(email, prenom, language);
  }
};

(function () {
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://app.usebouncer.com/bouncer-script/bouncer-script-beta.js';
  document.body.appendChild(s);
}());
