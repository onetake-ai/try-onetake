/**
 * Userlist Lead Proxy: BunnyCDN Edge Script
 *
 * DEPLOYMENT:
 *   1. Go to BunnyCDN Dashboard → Edge Scripts → Create Edge Script
 *   2. Paste this entire file into the editor
 *   3. Add environment variable:
 *        USERLIST_PUSH_KEY = <your Userlist Push API key>
 *   4. Deploy and note the script URL
 *
 * ENDPOINT: POST /track
 * BODY:     application/x-www-form-urlencoded
 *           email, prenom (or first_name), language, url, redirect (path only)
 *
 * Optional fields (used by the masterclass funnels in /masterclass/):
 *           event                   Userlist event name, one of ALLOWED_EVENTS (default: "Lead")
 *           masterclass_slug        e.g. "traffic"; saved on the user and on the event
 *           attends_masterclass_on  ISO 8601 datetime of the live session; saved on the user and on the event
 *
 * With event=CompleteRegistration, the user property Register_to_a_webinar_on is set to the
 * current UTC time (ISO 8601) on every registration.
 *
 * RESPONSE:
 *   Default: 302 redirect to SITE_ORIGIN + redirect, whatever happens with Userlist
 *            (plain HTML forms, e.g. /bootcamps/ehv/access/).
 *   With the request header "Accept: application/json" (fetch from JS):
 *            200 {"ok":true} once Userlist has accepted the event,
 *            400 / 500 / 502 {"error": "..."} otherwise, so the page can show an inline error.
 */

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

const USERLIST_EVENTS_URL = 'https://push.userlist.com/events';
const SITE_ORIGIN        = 'https://try.onetake.ai';
const ALLOWED_EVENTS     = ['Lead', 'CompleteRegistration'];

const corsHeaders = () => ({
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age':       '86400',
});

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });

const err = (message: string, status = 400) => json({ error: message }, status);

function isValidRedirectPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes(':') && !path.includes('\\');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]{1,64}$/.test(slug);
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !isNaN(Date.parse(value));
}

BunnySDK.net.http.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return err('Method not allowed', 405);
  }

  const wantsJson = (req.headers.get('accept') || '').includes('application/json');

  let fields: Record<string, string> = {};

  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const body = await req.formData();
    body.forEach((value, key) => {
      if (typeof value === 'string') fields[key] = value;
    });
  } else {
    try {
      fields = await req.json() as Record<string, string>;
    } catch {
      return err('Invalid request body');
    }
  }

  const email      = (fields.email || '').trim();
  const first_name = (fields.first_name || fields.prenom || '').trim();
  const language   = fields.language || '';
  const url        = fields.url || '';
  let   redirect   = fields.redirect || '/';
  const event      = ALLOWED_EVENTS.includes(fields.event) ? fields.event : 'Lead';
  const slug       = isValidSlug(fields.masterclass_slug || '') ? fields.masterclass_slug : '';
  const attendsOn  = isValidIsoDate(fields.attends_masterclass_on || '') ? fields.attends_masterclass_on : '';

  if (!isValidRedirectPath(redirect)) redirect = '/';

  const redirectResponse = () =>
    new Response(null, { status: 302, headers: { 'Location': SITE_ORIGIN + redirect } });

  if (!email || (wantsJson && !isValidEmail(email))) {
    return wantsJson ? err('Invalid email') : redirectResponse();
  }

  const pushKey = process.env.USERLIST_PUSH_KEY;
  if (!pushKey) return wantsJson ? err('Server not configured', 500) : redirectResponse();

  const userProperties: Record<string, string> = {  };
  if (first_name) userProperties.first_name = first_name;
  if (language)   userProperties.language   = language;
  if (slug)       userProperties.masterclass_slug       = slug;
  if (attendsOn)  userProperties.attends_masterclass_on = attendsOn;
  // Registration time, set here (not by the browser) so a wrong visitor clock can't skew it.
  // Overwritten on every new registration.
  if (event === 'CompleteRegistration') userProperties.Register_to_a_webinar_on = new Date().toISOString();

  const eventProperties: Record<string, string> = {};
  if (url)        eventProperties.url = url;
  if (slug)       eventProperties.masterclass_slug       = slug;
  if (attendsOn)  eventProperties.attends_masterclass_on = attendsOn;

  let accepted = false;
  try {
    const res = await fetch(USERLIST_EVENTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Push ${pushKey}`,
        'Accept':        'application/json',
      },
      body: JSON.stringify({
        name: event,
        user: { email, properties: userProperties },
        properties: eventProperties,
      }),
    });
    accepted = res.ok;
  } catch {
    // swallow: HTML forms always redirect regardless of Userlist outcome
  }

  if (wantsJson) {
    return accepted ? json({ ok: true }) : err('Userlist did not accept the event', 502);
  }

  return redirectResponse();
});
