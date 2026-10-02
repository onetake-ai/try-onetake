// Tests for /masterclass/session-date.js. Run by opening session-date.test.html in a browser.
// Instants are written in UTC; the comments give the matching Paris time.
// Paris is UTC+2 in summer (until 25 Oct 2026, from 28 Mar 2027) and UTC+1 in winter.
(function (root) {
  'use strict';

  var CASES = [
    // [description, now (UTC), expected session start (UTC)]
    ['Monday morning: same week',                          '2026-10-05T08:00:00Z', '2026-10-08T18:00:00Z'], // Mon 10:00
    ['Thursday morning: same evening',                     '2026-10-08T07:00:00Z', '2026-10-08T18:00:00Z'], // Thu 09:00
    ['Thursday 20:30, session started: same evening',      '2026-10-08T18:30:00Z', '2026-10-08T18:00:00Z'], // Thu 20:30
    ['Thursday 20:59: still the same evening',             '2026-10-08T18:59:00Z', '2026-10-08T18:00:00Z'], // Thu 20:59
    ['Thursday 21:00, cutoff: following week',             '2026-10-08T19:00:00Z', '2026-10-15T18:00:00Z'], // Thu 21:00
    ['Thursday 21:30: following week',                     '2026-10-08T19:30:00Z', '2026-10-15T18:00:00Z'], // Thu 21:30
    ['Sunday: next Thursday',                              '2026-10-11T12:00:00Z', '2026-10-15T18:00:00Z'], // Sun 14:00
    ['Late Wednesday night, UTC still Wednesday',          '2026-10-14T21:30:00Z', '2026-10-15T18:00:00Z'], // Wed 23:30
    ['Just after midnight Paris, UTC still Wednesday',     '2026-10-14T22:30:00Z', '2026-10-15T18:00:00Z'], // Thu 00:30

    // End of summer time: Sunday 25 Oct 2026, 03:00 CEST becomes 02:00 CET
    ['Thursday before the DST end (summer time)',          '2026-10-22T10:00:00Z', '2026-10-22T18:00:00Z'], // Thu 12:00 CEST
    ['Thursday 21:30 before the DST end: winter session',  '2026-10-22T19:30:00Z', '2026-10-29T19:00:00Z'], // Thu 21:30 CEST
    ['Saturday before the DST end',                        '2026-10-24T10:00:00Z', '2026-10-29T19:00:00Z'], // Sat 12:00 CEST
    ['Sunday of the DST end, during the change',           '2026-10-25T00:30:00Z', '2026-10-29T19:00:00Z'], // Sun 02:30 CEST
    ['Sunday of the DST end, after the change',            '2026-10-25T02:30:00Z', '2026-10-29T19:00:00Z'], // Sun 03:30 CET
    ['Monday after the DST end',                           '2026-10-26T08:00:00Z', '2026-10-29T19:00:00Z'], // Mon 09:00 CET
    ['Thursday 20:30 after the DST end: same evening',     '2026-10-29T19:30:00Z', '2026-10-29T19:00:00Z'], // Thu 20:30 CET
    ['Thursday 21:00 after the DST end: following week',   '2026-10-29T20:00:00Z', '2026-11-05T19:00:00Z'], // Thu 21:00 CET

    // Start of summer time: Sunday 28 Mar 2027, 02:00 CET becomes 03:00 CEST
    ['Thursday 20:30 before the DST start: same evening',  '2027-03-25T19:30:00Z', '2027-03-25T19:00:00Z'], // Thu 20:30 CET
    ['Thursday 21:00 before the DST start: summer session','2027-03-25T20:00:00Z', '2027-04-01T18:00:00Z'], // Thu 21:00 CET
    ['Saturday before the DST start',                      '2027-03-27T12:00:00Z', '2027-04-01T18:00:00Z'], // Sat 13:00 CET
    ['Sunday of the DST start, before the change',         '2027-03-28T00:30:00Z', '2027-04-01T18:00:00Z'], // Sun 01:30 CET
    ['Sunday of the DST start, after the change',          '2027-03-28T01:30:00Z', '2027-04-01T18:00:00Z'], // Sun 03:30 CEST
    ['Monday after the DST start',                         '2027-03-29T08:00:00Z', '2027-04-01T18:00:00Z'], // Mon 10:00 CEST

    // Year rollover
    ['Thursday 31 Dec 2026, 22:00: first Thursday of 2027','2026-12-31T21:00:00Z', '2027-01-07T19:00:00Z']  // Thu 22:00 CET
  ];

  var FORMAT_CASES = [
    ['2026-10-08T18:00:00Z', 'jeudi 8 octobre à 20h (heure de Paris)'],
    ['2026-10-29T19:00:00Z', 'jeudi 29 octobre à 20h (heure de Paris)'],
    ['2027-04-01T18:00:00Z', 'jeudi 1er avril à 20h (heure de Paris)']
  ];

  function run() {
    var api = root.masterclassSession;
    var results = [];

    CASES.forEach(function (c) {
      var actual = api.next(new Date(c[1])).toISOString().replace('.000Z', 'Z');
      results.push({ name: 'next: ' + c[0], pass: actual === c[2], expected: c[2], actual: actual });
    });

    FORMAT_CASES.forEach(function (c) {
      var actual = api.formatFr(new Date(c[0]));
      results.push({ name: 'formatFr: ' + c[0], pass: actual === c[1], expected: c[1], actual: actual });
    });

    // A different cutoff from the config
    var custom = api.next(new Date('2026-10-08T18:30:00Z'), { cutoff: '20:15' }).toISOString().replace('.000Z', 'Z');
    results.push({ name: 'next: custom cutoff 20:15, Thursday 20:30', pass: custom === '2026-10-15T18:00:00Z', expected: '2026-10-15T18:00:00Z', actual: custom });

    return results;
  }

  root.runSessionDateTests = run;
})(typeof window !== 'undefined' ? window : globalThis);
