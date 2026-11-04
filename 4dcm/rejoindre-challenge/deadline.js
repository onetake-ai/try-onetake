/**
 * /4dcm/rejoindre-challenge/: per-link offer deadline
 *
 * The email link carries the day it was sent: ?sent_on=2026-11-21 (also accepted: 21/11/2026,
 * an ISO 8601 date and time, or Userlist's email format "2026-11-21 08:00:00 UTC"). The offer
 * stays open for DAYS_OPEN full days after that day, until midnight Paris time:
 * sent on Nov 21, the page closes at the end of Nov 24.
 *
 * The date is remembered in localStorage, so the Airwallex checkout's back link (no parameter)
 * keeps the same deadline. A newer link replaces it. Without any date (link forwarded without
 * the parameter, unrendered Liquid tag), the first visit counts as the sending day.
 *
 * Loaded in <head> without async/defer: it redirects right away once the deadline has passed,
 * otherwise injects the countdown bar (/oto/countdown/countdown.js). ?unlockfor=1 disables both.
 * [data-join-deadline] elements get the closing day as text ("mardi 24 novembre").
 *
 * Display only: the edge script (PLANS in edge-scripts/airwallex-checkout.ts) has no sales window
 * for the challenge-join-* plans, since each link has its own deadline.
 */
(function () {
  'use strict';

  var DAYS_OPEN    = 3;
  var TIME_ZONE    = 'Europe/Paris';
  var STORAGE_KEY  = 'oneTakeRejoindreChallengeSentOn';
  var TOO_LATE_URL = 'https://try.onetake.ai/oto/too-late/';

  var params = new URLSearchParams(window.location.search);

  // Calendar day (in Paris) of a date string, as [year, month, day]; null if unreadable
  function parseDay(value) {
    value = String(value || '').trim();
    if (!value || /[{}%]/.test(value)) return null;   // unrendered Liquid tag
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) return [+m[1], +m[2], +m[3]];
    m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(value);
    if (m) return [+m[3], +m[2], +m[1]];
    // Date and time: Userlist's "2026-11-21 08:00:00 UTC", or ISO 8601 (read as UTC without an offset)
    var iso = value.replace(' UTC', 'Z').replace(' ', 'T');
    if (/T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(iso)) iso += 'Z';
    var time = Date.parse(iso);
    return isNaN(time) ? null : parisDay(time);
  }

  function parisDay(time) {
    var parts = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(time))
      .forEach(function (p) { parts[p.type] = p.value; });
    return [+parts.year, +parts.month, +parts.day];
  }

  // Offset of Paris from UTC at this instant, in ms
  function parisOffset(time) {
    var parts = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'
    }).formatToParts(new Date(time)).forEach(function (p) { parts[p.type] = +p.value; });
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - time;
  }

  // Midnight in Paris at the start of this day (Date.UTC normalizes day overflow)
  function parisMidnight(year, month, day) {
    var guess = Date.UTC(year, month - 1, day);
    var time = guess - parisOffset(guess);
    return guess - parisOffset(time);
  }

  function key(day) {
    return day[0] + '-' + ('0' + day[1]).slice(-2) + '-' + ('0' + day[2]).slice(-2);
  }

  function read() {
    try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function save(day) {
    try { window.localStorage.setItem(STORAGE_KEY, key(day)); } catch (e) { /* storage unavailable */ }
  }

  var sentOn = parseDay(params.get('sent_on'));
  if (sentOn) save(sentOn);
  else sentOn = parseDay(read());
  if (!sentOn) { sentOn = parisDay(Date.now()); save(sentOn); }

  var deadline = parisMidnight(sentOn[0], sentOn[1], sentOn[2] + DAYS_OPEN + 1);
  var closingDay = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(deadline - 1));

  window.rejoindreChallenge = { sentOn: key(sentOn), deadline: new Date(deadline).toISOString(), closingDay: closingDay };

  var unlocked = !!params.get('unlockfor');
  if (!unlocked && Date.now() >= deadline) {
    window.location.replace(TOO_LATE_URL);
    return;
  }

  // Countdown bar (it handles ?unlockfor itself and redirects when the time is up)
  var script = document.createElement('script');
  script.src = '/oto/countdown/countdown.js';
  script.setAttribute('data-deadline', new Date(deadline).toISOString());
  script.setAttribute('data-redirect', TOO_LATE_URL);
  script.setAttribute('data-label', 'Cette offre ferme dans');
  script.setAttribute('data-label-days', 'jours');
  script.setAttribute('data-label-hours', 'heures');
  script.setAttribute('data-label-min', 'min');
  script.setAttribute('data-label-sec', 'sec');
  document.head.appendChild(script);

  function fill() {
    document.querySelectorAll('[data-join-deadline]').forEach(function (el) { el.textContent = closingDay; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill);
  else fill();
})();
