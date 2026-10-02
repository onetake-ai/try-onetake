/**
 * /masterclass/session-date.js
 *
 * Date of the next live masterclass session (French funnel: every Thursday at 20:00, Paris time).
 * Used by the registration page, the Userlist payload, the "check your inbox" page and the
 * confirmation page, so the date is always the same everywhere.
 *
 * Everything is computed in the session time zone (Europe/Paris by default) with Intl,
 * so daylight saving time is handled: the session stays at 20:00 Paris time all year.
 *
 *   masterclassSession.next(now, options)  -> Date (the session start, a real instant)
 *   masterclassSession.formatFr(date, options) -> "jeudi 8 octobre à 20h (heure de Paris)"
 *
 * options (all optional, defaults below):
 *   weekday   0 = Sunday ... 4 = Thursday
 *   time      session start, "HH:MM"
 *   cutoff    "HH:MM" on the session day; from this time on, the next session is the following week
 *   timeZone  IANA time zone
 *
 * Tests: open /masterclass/tests/session-date.test.html in a browser.
 */
(function (root) {
  'use strict';

  var DEFAULTS = { weekday: 4, time: '20:00', cutoff: '21:00', timeZone: 'Europe/Paris' };
  var WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  var formatters = {};

  function settings(options) {
    var s = {};
    for (var key in DEFAULTS) s[key] = (options && options[key] != null) ? options[key] : DEFAULTS[key];
    return s;
  }

  function toMinutes(hhmm) {
    var parts = String(hhmm).split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
  }

  // Wall-clock date and time of an instant in a time zone
  function wallClock(ms, timeZone) {
    if (!formatters[timeZone]) {
      formatters[timeZone] = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone, hourCycle: 'h23', weekday: 'short',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
    var out = {};
    formatters[timeZone].formatToParts(new Date(ms)).forEach(function (p) { out[p.type] = p.value; });
    return {
      year: +out.year, month: +out.month, day: +out.day,
      hour: +out.hour % 24, minute: +out.minute, second: +out.second,
      weekday: WEEKDAYS[out.weekday]
    };
  }

  // Offset of the time zone at an instant, in ms (Paris: +1 h in winter, +2 h in summer)
  function offsetAt(ms, timeZone) {
    var w = wallClock(ms, timeZone);
    var asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
    return asUtc - Math.floor(ms / 1000) * 1000;
  }

  // Instant matching a wall-clock time in a time zone
  function fromWallClock(year, month, day, hour, minute, timeZone) {
    var guess = Date.UTC(year, month - 1, day, hour, minute);
    var first = guess - offsetAt(guess, timeZone);
    // The offset can differ on either side of a DST change: check once more at the result
    return guess - offsetAt(first, timeZone);
  }

  function next(now, options) {
    var s = settings(options);
    var nowMs = now == null ? Date.now() : +now;
    var w = wallClock(nowMs, s.timeZone);
    var daysAhead = (s.weekday - w.weekday + 7) % 7;
    if (daysAhead === 0 && w.hour * 60 + w.minute >= toMinutes(s.cutoff)) daysAhead = 7;

    // Calendar arithmetic on the wall-clock date (Date.UTC handles month and year rollover)
    var target = new Date(Date.UTC(w.year, w.month - 1, w.day + daysAhead));
    var start = toMinutes(s.time);
    return new Date(fromWallClock(
      target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate(),
      Math.floor(start / 60), start % 60, s.timeZone
    ));
  }

  // "jeudi 8 octobre à 20h (heure de Paris)", "jeudi 1er octobre à 20h30 (heure de Paris)"
  function formatFr(date, options) {
    var s = settings(options);
    var w = wallClock(+date, s.timeZone);
    var weekday = new Intl.DateTimeFormat('fr-FR', { timeZone: s.timeZone, weekday: 'long' }).format(date);
    var month = new Intl.DateTimeFormat('fr-FR', { timeZone: s.timeZone, month: 'long' }).format(date);
    var day = w.day === 1 ? '1er' : String(w.day);
    var time = w.hour + 'h' + (w.minute ? String(w.minute).padStart(2, '0') : '');
    var zone = s.timeZone === 'Europe/Paris' ? ' (heure de Paris)' : '';
    return weekday + ' ' + day + ' ' + month + ' à ' + time + zone;
  }

  root.masterclassSession = { next: next, formatFr: formatFr, DEFAULTS: DEFAULTS };
})(typeof window !== 'undefined' ? window : globalThis);
