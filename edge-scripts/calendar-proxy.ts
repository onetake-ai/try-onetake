/**
 * Proton Calendar relay: BunnyCDN Edge Script
 *
 * Proton's shared calendar links (.ics) send no CORS header, so /tools/calendar/ can't read
 * them from the browser. This script fetches the calendar from Proton and hands it to the page.
 * It only ever fetches Proton shared calendar links: never an arbitrary URL.
 * Subscriptions don't go through this script: the page's subscribe buttons point at Proton.
 *
 * DEPLOYMENT:
 *   1. BunnyCDN Dashboard → Edge Scripts → Create Edge Script (no secret needed)
 *   2. Add the custom hostname calendarfeed.onetake.ai (our own domain: filters block
 *      *.bunny.run more often). If you pick another hostname, update PROXY_URL in
 *      /tools/calendar/app.js.
 *   3. Set the GitHub repository variable CALENDAR_PROXY_SCRIPT_ID to the script's numeric ID
 *      (dash.bunny.net/edge-script/12345 → 12345): .github/workflows/deploy-calendar-proxy.yml
 *      then deploys every change to this file pushed to main.
 *
 * ENDPOINT: GET /?id=<calendar ID>&key=<CacheKey>
 *   The two parts of a Proton link:
 *   https://calendar.proton.me/api/calendar/v1/url/<calendar ID>/calendar.ics?CacheKey=<CacheKey>
 *
 * RESPONSE:
 *   200 text/calendar   the calendar, cached 5 minutes
 *   400 {"error": "INVALID_LINK"}         id or key missing or malformed
 *   404 {"error": "NOT_FOUND"}            Proton doesn't know this link (calendar no longer shared)
 *   502 {"error": "UPSTREAM"}             Proton didn't answer, or didn't send a calendar
 */

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";

const PROTON_BASE    = 'https://calendar.proton.me/api/calendar/v1/url/';
const ALLOWED_ORIGIN = 'https://try.onetake.ai';
const MAX_BYTES      = 5 * 1024 * 1024;

// Proton IDs and keys are URL-safe base64, optionally padded
const ID_PATTERN  = /^[A-Za-z0-9_-]{20,200}={0,2}$/;
const KEY_PATTERN = /^[A-Za-z0-9+/_-]{8,100}={0,2}$/;

const corsHeaders = () => ({
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age':       '86400',
  'Vary':                         'Origin',
});

const err = (code: string, status: number) =>
  new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders() },
  });

BunnySDK.net.http.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'GET') {
    return err('METHOD_NOT_ALLOWED', 405);
  }

  const params = new URL(req.url).searchParams;
  const id  = (params.get('id')  || '').trim();
  const key = (params.get('key') || '').trim();
  if (!ID_PATTERN.test(id) || !KEY_PATTERN.test(key)) {
    console.log(`Refused GET: INVALID_LINK (origin ${req.headers.get('origin') || '-'})`);
    return err('INVALID_LINK', 400);
  }

  const upstreamUrl = PROTON_BASE + id + '/calendar.ics?CacheKey=' + encodeURIComponent(key);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { headers: { 'Accept': 'text/calendar' } });
  } catch (e) {
    console.log(`Proton fetch failed: ${e}`);
    return err('UPSTREAM', 502);
  }

  if (upstream.status === 404 || upstream.status === 410 || upstream.status === 422) {
    return err('NOT_FOUND', 404);
  }
  if (!upstream.ok) {
    console.log(`Proton answered ${upstream.status}`);
    return err('UPSTREAM', 502);
  }

  const body = await upstream.text();
  if (body.length > MAX_BYTES || !body.trimStart().startsWith('BEGIN:VCALENDAR')) {
    console.log(`Proton sent no calendar (${body.length} characters)`);
    return err('UPSTREAM', 502);
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type':  'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      ...corsHeaders(),
    },
  });
});
