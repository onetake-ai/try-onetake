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
 *           referred_by, utm_source, utm_medium, utm_campaign, utm_content, utm_channel
 *                                   affiliate (?ref=) and campaign of the visit; saved on the user
 *                                   (last touch: an empty value never erases a stored one) and on the event
 *
 *           Step 2 answers (optional questions on /masterclass/trafic/recherche/, sent with
 *           event=CompleteQualification): saved on the user and on the event, see QUALIFICATION_CHOICES
 *           and QUALIFICATION_TEXTS below. Choices are English slugs; multiple choices are sent and
 *           saved as comma-separated slugs (e.g. "online-course,book"). Unknown values are dropped.
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
const ALLOWED_EVENTS     = ['Lead', 'CompleteRegistration', 'CompleteQualification'];
const ATTRIBUTION_FIELDS = ['referred_by', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_channel'];

// Step 2 answers: allowed slugs for each choice question (multiple: comma-separated list)
const QUALIFICATION_CHOICES: Record<string, { values: string[]; multiple?: boolean }> = {
  profession:      { values: ['coach', 'online-trainer', 'consultant', 'therapist', 'other'] },
  current_offers:  { values: ['one-on-one-coaching', 'group-program', 'online-course', 'in-person-events', 'book', 'nothing-yet'], multiple: true },
  audience_size:   { values: ['under-1k', '1k-10k', '10k-100k', 'over-100k'] },
  videos_per_week: { values: ['none', '1-2', '3-5', 'over-5'] },
  video_blocker:   { values: ['no-time', 'editing', 'on-camera', 'what-to-say', 'no-clients'] },
};
// Step 2 answers: free text questions, with their maximum length
const QUALIFICATION_TEXTS: Record<string, number> = { expertise: 200, masterclass_goal: 500 };

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

// Trimmed, without control characters, at most `max` characters ('' when not a usable string)
function cleanText(value: unknown, max = 200): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

// Only the allowed slugs, without duplicates ('' when none is allowed)
function cleanChoice(value: unknown, allowed: string[], multiple: boolean): string {
  if (typeof value !== 'string') return '';
  const picked = value.split(',').map((v) => v.trim()).filter((v) => allowed.includes(v));
  return [...new Set(multiple ? picked : picked.slice(0, 1))].join(',');
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

  // Affiliate and campaign attribution: only these keys, as short plain strings
  const attribution: Record<string, string> = {};
  for (const key of ATTRIBUTION_FIELDS) {
    const value = cleanText(fields[key]);
    if (value) attribution[key] = value;
  }

  const qualification: Record<string, string> = {};
  for (const [key, choice] of Object.entries(QUALIFICATION_CHOICES)) {
    const value = cleanChoice(fields[key], choice.values, !!choice.multiple);
    if (value) qualification[key] = value;
  }
  for (const [key, max] of Object.entries(QUALIFICATION_TEXTS)) {
    const value = cleanText(fields[key], max);
    if (value) qualification[key] = value;
  }

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
  // Last touch: a new value replaces the stored one; an empty value never erases it
  Object.assign(userProperties, attribution);
  Object.assign(userProperties, qualification);
  // Registration time, set here (not by the browser) so a wrong visitor clock can't skew it.
  // Overwritten on every new registration.
  if (event === 'CompleteRegistration') userProperties.Register_to_a_webinar_on = new Date().toISOString();

  const eventProperties: Record<string, string> = {};
  if (url)        eventProperties.url = url;
  if (slug)       eventProperties.masterclass_slug       = slug;
  if (attendsOn)  eventProperties.attends_masterclass_on = attendsOn;
  Object.assign(eventProperties, attribution);   // history of each registration's source
  Object.assign(eventProperties, qualification);

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
