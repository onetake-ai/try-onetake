/**
 * /masterclass/offer-deadline.js
 *
 * Deadlines of the masterclass offer pages. Needs session-date.js (time zone helpers) first.
 *
 * English (/masterclass/traffic/watch/): 6 days after registration, at the end of that day
 * in the visitor's time zone. Registered Monday 10:00 local, the offer ends Sunday 23:59:59 local.
 *   masterclassOffer.resolveRegisteredOn(urlValue, storedValue, now) -> ms
 *   masterclassOffer.englishDeadline(registeredOnMs, timeZone)       -> ms
 *
 * French (/masterclass/trafic/offre/): the Wednesday after the Thursday live, 23:59:59 Paris time.
 *   masterclassOffer.frenchDeadline(now, attendsValue, session)      -> ms
 *   With a valid attends_masterclass_on value: the Wednesday after that session.
 *   Without: the weekly cycle (opens Thursday at the start of the live, closes Wednesday 23:59:59),
 *   so on Thursday before the live the deadline is already over and the page redirects.
 *
 * Tests: open /masterclass/tests/offer-deadline.test.html in a browser.
 */
(function (root) {
  'use strict';

  var ms = root.masterclassSession;
  var DAYS_AFTER_REGISTRATION = 6;
  var DAYS_AFTER_LIVE = 6; // Thursday + 6 = Wednesday

  // ISO 8601 datetime only (e.g. "2026-10-05T10:00:00Z" or with an offset); anything else is ignored
  function parseIso(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value.trim())) return null;
    var t = Date.parse(value.trim());
    return isNaN(t) ? null : t;
  }

  // The earlier of the URL value and the stored value, so editing the URL can't extend the offer.
  // Neither valid: now (first visit).
  function resolveRegisteredOn(urlValue, storedValue, now) {
    var candidates = [parseIso(urlValue), parseIso(storedValue)].filter(function (t) { return t !== null; });
    if (!candidates.length) return now == null ? Date.now() : +now;
    return Math.min.apply(null, candidates);
  }

  function visitorTimeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
  }

  // End of the day, DAYS_AFTER days after the calendar date of `instant` in `timeZone`
  function endOfDayAfter(instant, days, timeZone) {
    var w = ms.wallClock(instant, timeZone);
    var d = new Date(Date.UTC(w.year, w.month - 1, w.day + days));
    return ms.fromWallClock(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 23, 59, timeZone, 59);
  }

  function englishDeadline(registeredOn, timeZone) {
    return endOfDayAfter(+registeredOn, DAYS_AFTER_REGISTRATION, timeZone || visitorTimeZone());
  }

  function frenchDeadline(now, attendsValue, session) {
    var s = session || ms.DEFAULTS;
    var tz = s.timeZone || 'Europe/Paris';
    var attends = parseIso(attendsValue);
    if (attends !== null) return endOfDayAfter(attends, DAYS_AFTER_LIVE, tz);

    // Weekly cycle: the most recent live start at or before now
    var nowMs = now == null ? Date.now() : +now;
    var w = ms.wallClock(nowMs, tz);
    var weekday = s.weekday == null ? 4 : s.weekday;
    var daysBack = (w.weekday - weekday + 7) % 7;
    if (daysBack === 0 && w.hour * 60 + w.minute < ms.toMinutes(s.time || '20:00')) daysBack = 7;
    var d = new Date(Date.UTC(w.year, w.month - 1, w.day - daysBack));
    var lastLive = ms.fromWallClock(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 12, 0, tz);
    return endOfDayAfter(lastLive, DAYS_AFTER_LIVE, tz);
  }

  // "Sunday, October 11 at midnight"
  function formatEnglishEnd(deadline, timeZone) {
    var date = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || visitorTimeZone(), weekday: 'long', month: 'long', day: 'numeric'
    }).format(new Date(deadline));
    return date + ' at midnight';
  }

  // "mercredi 14 octobre à minuit (heure de Paris)"
  function formatFrenchEnd(deadline) {
    var tz = 'Europe/Paris';
    var w = ms.wallClock(deadline, tz);
    var weekday = new Intl.DateTimeFormat('fr-FR', { timeZone: tz, weekday: 'long' }).format(new Date(deadline));
    var month = new Intl.DateTimeFormat('fr-FR', { timeZone: tz, month: 'long' }).format(new Date(deadline));
    return weekday + ' ' + (w.day === 1 ? '1er' : w.day) + ' ' + month + ' à minuit (heure de Paris)';
  }

  root.masterclassOffer = {
    parseIso: parseIso,
    resolveRegisteredOn: resolveRegisteredOn,
    englishDeadline: englishDeadline,
    frenchDeadline: frenchDeadline,
    formatEnglishEnd: formatEnglishEnd,
    formatFrenchEnd: formatFrenchEnd,
    visitorTimeZone: visitorTimeZone
  };
})(typeof window !== 'undefined' ? window : globalThis);
