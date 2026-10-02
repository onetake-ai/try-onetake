// Tests for /masterclass/offer-deadline.js. Run by opening offer-deadline.test.html in a browser.
// Instants are written in UTC; comments give the matching local time.
(function (root) {
  'use strict';

  function iso(t) { return new Date(t).toISOString().replace('.000Z', 'Z'); }

  function run() {
    var o = root.masterclassOffer;
    var results = [];
    function check(name, actual, expected) {
      results.push({ name: name, pass: actual === expected, expected: expected, actual: actual });
    }

    // ── English: 6 days after registration, end of day, visitor's time zone ──
    var P = 'Europe/Paris', NY = 'America/New_York', SG = 'Asia/Singapore';

    check('EN: Monday 10:00 Paris, offer ends Sunday 23:59:59 Paris',
      iso(o.englishDeadline(Date.parse('2026-10-05T08:00:00Z'), P)), '2026-10-11T21:59:59Z');
    check('EN: registered 23:50 local, the day still counts as day 0',
      iso(o.englishDeadline(Date.parse('2026-10-05T21:50:00Z'), P)), '2026-10-11T21:59:59Z');
    check('EN: registered 00:10 local the next day, one more day',
      iso(o.englishDeadline(Date.parse('2026-10-05T22:10:00Z'), P)), '2026-10-12T21:59:59Z');
    check('EN: registered in Los Angeles (Mon 23:30 -07:00), visitor in Paris (Tue 08:30)',
      iso(o.englishDeadline(Date.parse('2026-10-05T23:30:00-07:00'), P)), '2026-10-12T21:59:59Z');
    check('EN: same instant, visitor in New York (Tue 02:30)',
      iso(o.englishDeadline(Date.parse('2026-10-05T23:30:00-07:00'), NY)), '2026-10-13T03:59:59Z');
    check('EN: visitor in Singapore (no DST)',
      iso(o.englishDeadline(Date.parse('2026-10-05T02:00:00Z'), SG)), '2026-10-11T15:59:59Z');
    check('EN: DST end in Paris (registered Tue 20 Oct CEST, ends Mon 26 Oct CET)',
      iso(o.englishDeadline(Date.parse('2026-10-20T10:00:00Z'), P)), '2026-10-26T22:59:59Z');
    check('EN: DST start in Paris (registered Mon 23 Mar 2027 CET, ends Sun 29 Mar CEST)',
      iso(o.englishDeadline(Date.parse('2027-03-23T10:00:00Z'), P)), '2027-03-29T21:59:59Z');
    check('EN: DST change in New York (registered Fri 30 Oct EDT, ends Thu 5 Nov EST)',
      iso(o.englishDeadline(Date.parse('2026-10-30T15:00:00Z'), NY)), '2026-11-06T04:59:59Z');
    check('EN format: "Sunday, October 11 at midnight"',
      o.formatEnglishEnd(Date.parse('2026-10-11T21:59:59Z'), P), 'Sunday, October 11 at midnight');

    // registered_on resolution
    var now = Date.parse('2026-10-08T12:00:00Z');
    check('EN: URL value only', iso(o.resolveRegisteredOn('2026-10-05T08:00:00Z', null, now)), '2026-10-05T08:00:00Z');
    check('EN: stored value only', iso(o.resolveRegisteredOn(null, '2026-10-04T08:00:00Z', now)), '2026-10-04T08:00:00Z');
    check('EN: URL value later than stored one: stored wins',
      iso(o.resolveRegisteredOn('2026-10-07T08:00:00Z', '2026-10-04T08:00:00Z', now)), '2026-10-04T08:00:00Z');
    check('EN: URL value earlier than stored one: URL wins',
      iso(o.resolveRegisteredOn('2026-10-03T08:00:00Z', '2026-10-04T08:00:00Z', now)), '2026-10-03T08:00:00Z');
    check('EN: invalid URL value, stored value used',
      iso(o.resolveRegisteredOn('not-a-date', '2026-10-04T08:00:00Z', now)), '2026-10-04T08:00:00Z');
    check('EN: unrendered Liquid tag ignored, first visit time used',
      iso(o.resolveRegisteredOn('{{ user.properties.Register_to_a_webinar_on }}', null, now)), '2026-10-08T12:00:00Z');
    check('EN: date without time ignored', iso(o.resolveRegisteredOn('2026-10-05', 'garbage', now)), '2026-10-08T12:00:00Z');
    check('EN: impossible date ignored', iso(o.resolveRegisteredOn('2026-13-45T99:00:00Z', null, now)), '2026-10-08T12:00:00Z');

    // ── French: Wednesday after the Thursday live, 23:59:59 Paris ──
    check('FR: Friday after the live',             iso(o.frenchDeadline(Date.parse('2026-10-09T10:00:00Z'))), '2026-10-14T21:59:59Z');
    check('FR: Sunday',                            iso(o.frenchDeadline(Date.parse('2026-10-11T10:00:00Z'))), '2026-10-14T21:59:59Z');
    check('FR: Wednesday 23:30, still open',       iso(o.frenchDeadline(Date.parse('2026-10-14T21:30:00Z'))), '2026-10-14T21:59:59Z');
    check('FR: Thursday 10:00, before the live: already over (redirect)',
      o.frenchDeadline(Date.parse('2026-10-15T08:00:00Z')) < Date.parse('2026-10-15T08:00:00Z'), true);
    check('FR: Thursday 20:30, live started: open until next Wednesday',
      iso(o.frenchDeadline(Date.parse('2026-10-15T18:30:00Z'))), '2026-10-21T21:59:59Z');
    check('FR: with attends_masterclass_on, Wednesday after that session',
      iso(o.frenchDeadline(Date.parse('2026-10-16T10:00:00Z'), '2026-10-08T18:00:00.000Z')), '2026-10-14T21:59:59Z');
    check('FR: with attends_masterclass_on, opened Thursday 10:00 of the next week: over',
      o.frenchDeadline(Date.parse('2026-10-15T08:00:00Z'), '2026-10-08T18:00:00.000Z') < Date.parse('2026-10-15T08:00:00Z'), true);
    check('FR: invalid attends_masterclass_on falls back to the weekly cycle',
      iso(o.frenchDeadline(Date.parse('2026-10-09T10:00:00Z'), 'garbage')), '2026-10-14T21:59:59Z');
    check('FR: DST end (live Thu 22 Oct CEST, ends Wed 28 Oct CET)',
      iso(o.frenchDeadline(Date.parse('2026-10-25T12:00:00Z'))), '2026-10-28T22:59:59Z');
    check('FR: DST end with attends_masterclass_on',
      iso(o.frenchDeadline(Date.parse('2026-10-23T12:00:00Z'), '2026-10-22T18:00:00.000Z')), '2026-10-28T22:59:59Z');
    check('FR: DST start (live Thu 25 Mar 2027 CET, ends Wed 31 Mar CEST)',
      iso(o.frenchDeadline(Date.parse('2027-03-28T12:00:00Z'))), '2027-03-31T21:59:59Z');
    check('FR format', o.formatFrenchEnd(Date.parse('2026-10-14T21:59:59Z')), 'mercredi 14 octobre à minuit (heure de Paris)');

    return results;
  }

  root.runOfferDeadlineTests = run;
})(typeof window !== 'undefined' ? window : globalThis);
