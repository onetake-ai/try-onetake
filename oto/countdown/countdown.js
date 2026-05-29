/**
 * /oto/countdown/countdown.js
 *
 * Self-contained sticky countdown bar. Drop a single <script> tag in <head>
 * (no async/defer) and the bar is inserted as the first element in <body>.
 *
 * Required attributes on the <script> tag:
 *   data-deadline   ISO 8601 UTC string, e.g. "2026-05-29T22:00:00Z"
 *   data-redirect   URL to redirect to when the countdown expires
 *
 * Optional attributes:
 *   data-label        Label text before the digits (default: "Offer closes in")
 *   data-label-hours  Unit label for hours  (default: "hours")
 *   data-label-min    Unit label for minutes (default: "min")
 *   data-label-sec    Unit label for seconds (default: "sec")
 */
(function () {
  var s = document.currentScript;
  var deadline   = new Date(s.getAttribute('data-deadline')).getTime();
  var redirectTo = s.getAttribute('data-redirect');
  var label      = s.getAttribute('data-label')        || 'Offer closes in';
  var labelH     = s.getAttribute('data-label-hours')  || 'hours';
  var labelM     = s.getAttribute('data-label-min')    || 'min';
  var labelSec   = s.getAttribute('data-label-sec')    || 'sec';

  var style = document.createElement('style');
  style.textContent = [
    '#countdown-bar{position:sticky;top:0;z-index:1000;background:#0f0f0f;',
    'border-bottom:1px solid rgba(255,255,255,.08);padding:.7rem 1.5rem;',
    'display:flex;align-items:center;justify-content:center;gap:1rem;flex-wrap:wrap}',

    '#countdown-bar .cd-label{font-size:.72rem;font-weight:500;',
    'letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.5);white-space:nowrap}',

    '#countdown-bar .cd-units{display:flex;gap:.5rem;align-items:center}',

    '#countdown-bar .cd-unit{display:flex;flex-direction:column;',
    'align-items:center;min-width:2.8rem}',

    '#countdown-bar .cd-num{font-family:monospace;font-size:1.25rem;',
    'font-weight:600;color:#fff;line-height:1}',

    '#countdown-bar .cd-name{font-size:.55rem;font-weight:400;',
    'letter-spacing:.1em;text-transform:uppercase;',
    'color:rgba(255,255,255,.38);margin-top:.2rem}',

    '#countdown-bar .cd-sep{font-family:monospace;font-size:1.1rem;',
    'color:rgba(255,255,255,.25);line-height:1;margin-bottom:.4rem}',

    '@media(max-width:480px){',
    '#countdown-bar{gap:.6rem;padding:.55rem 1rem}',
    '#countdown-bar .cd-num{font-size:1rem}}'
  ].join('');
  document.head.appendChild(style);

  var bar = document.createElement('div');
  bar.id = 'countdown-bar';
  bar.innerHTML =
    '<span class="cd-label">' + label + '</span>' +
    '<div class="cd-units">' +
      '<div class="cd-unit"><span class="cd-num" id="cd-h">--</span><span class="cd-name">' + labelH + '</span></div>' +
      '<span class="cd-sep">:</span>' +
      '<div class="cd-unit"><span class="cd-num" id="cd-m">--</span><span class="cd-name">' + labelM + '</span></div>' +
      '<span class="cd-sep">:</span>' +
      '<div class="cd-unit"><span class="cd-num" id="cd-s">--</span><span class="cd-name">' + labelSec + '</span></div>' +
    '</div>';

  var timer;
  function pad(n) { return String(n).padStart(2, '0'); }
  function tick() {
    var diff = deadline - Date.now();
    if (diff <= 0) {
      clearInterval(timer);
      location.replace(redirectTo);
      return;
    }
    bar.querySelector('#cd-h').textContent = pad(Math.floor(diff / 3600000));
    bar.querySelector('#cd-m').textContent = pad(Math.floor((diff % 3600000) / 60000));
    bar.querySelector('#cd-s').textContent = pad(Math.floor((diff % 60000) / 1000));
  }

  function insert() {
    document.body.insertBefore(bar, document.body.firstChild);
    tick();
    timer = setInterval(tick, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insert);
  } else {
    insert();
  }
})();
