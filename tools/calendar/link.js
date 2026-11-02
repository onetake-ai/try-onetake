/**
 * Proton calendar share links, shared by the calendar page (app.js) and the link generator (create/).
 *
 * A Proton share link: https://calendar.proton.me/api/calendar/v1/url/<calendar ID>/calendar.ics?CacheKey=<key>
 *                      &PassphraseKey=<passphrase>   (only in "Full view" links: it decrypts the event details;
 *                                                    "Limited view" links only show busy times)
 * Our page link:       https://try.onetake.ai/tools/calendar/?id=<calendar ID>&key=<key>&pass=<passphrase>
 *                      (all encoded, so email and chat apps don't cut the link at "==").
 */

export const PROXY_URL   = 'https://calendar.fluffybunny.onetake.ai';   // Bunny script 100436, edge-scripts/calendar-proxy.ts
export const PAGE_URL    = 'https://try.onetake.ai/tools/calendar/';
export const PROTON_BASE = 'https://calendar.proton.me/api/calendar/v1/url/';

// Same patterns as the relay
const ID_PATTERN  = /^[A-Za-z0-9_-]{20,200}={0,2}$/;
const KEY_PATTERN  = /^[A-Za-z0-9+/_-]{8,100}={0,2}$/;
const PASS_PATTERN = /^[A-Za-z0-9+/_-]{16,200}={0,2}$/;

// URLSearchParams turns "+" into a space
const restorePlus = (value) => (value || '').replace(/ /g, '+');

function toLink(id, key, pass) {
  if (!id || !key) return null;
  key = restorePlus(key);
  pass = restorePlus(pass);
  if (!ID_PATTERN.test(id) || !KEY_PATTERN.test(key)) return null;
  if (pass && !PASS_PATTERN.test(pass)) return null;

  const query = 'id=' + encodeURIComponent(id) + '&key=' + encodeURIComponent(key)
    + (pass ? '&pass=' + encodeURIComponent(pass) : '');
  const feed = PROTON_BASE + id + '/calendar.ics?CacheKey=' + encodeURIComponent(key)
    + (pass ? '&PassphraseKey=' + encodeURIComponent(pass) : '');
  return {
    id,
    key,
    pass,
    limited: !pass,   // "Limited view" link: busy times only, no titles, descriptions or join links
    feed,
    webcal: feed.replace(/^https:/, 'webcal:'),
    page: PAGE_URL + '?' + query,
    relay: PROXY_URL + '/?' + query,
  };
}

// Reads a Proton share link, or one of our page links (?id=&key=&pass=, or the Proton path after "?")
export function parseLink(text) {
  let raw = String(text || '').trim();
  try { raw = decodeURIComponent(raw); } catch (e) { /* keep it encoded */ }

  const idMatch  = raw.match(/\/url\/([A-Za-z0-9_-]+={0,2})\/calendar\.ics/) || raw.match(/[?&]id=([A-Za-z0-9_-]+={0,2})/);
  const keyMatch = raw.match(/CacheKey=([A-Za-z0-9+/_-]+={0,2})/) || raw.match(/[?&]key=([A-Za-z0-9+/_-]+={0,2})/);
  const passMatch = raw.match(/PassphraseKey=([A-Za-z0-9+/_-]+={0,2})/) || raw.match(/[?&]pass=([A-Za-z0-9+/_-]+={0,2})/);
  return toLink(idMatch && idMatch[1], keyMatch && keyMatch[1], passMatch && passMatch[1]);
}

// Link of the current page
export function readPageLink() {
  const params = new URLSearchParams(location.search);
  return toLink(params.get('id'), params.get('key'), params.get('pass')) || parseLink(location.search);
}

// What is wrong with a pasted text that parseLink() refused
export function linkProblem(text) {
  const raw = String(text || '').trim();
  if (!raw) return 'empty';
  if (/\/api\/calendar\/v1\/url\//.test(raw) || /[?&]id=/.test(raw)) return 'incomplete';
  if (/proton\.me/i.test(raw)) return 'notShareLink';
  return 'notProton';
}
