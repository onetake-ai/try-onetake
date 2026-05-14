/**
 * Userlist Lead Proxy — BunnyCDN Edge Script
 *
 * DEPLOYMENT:
 *   1. Go to BunnyCDN Dashboard → Edge Scripts → Create Edge Script
 *   2. Paste this entire file into the editor
 *   3. Add environment variable:
 *        USERLIST_PUSH_KEY = <your Userlist Push API key>
 *   4. Deploy and note the script URL
 *   5. Update USERLIST_PROXY_URL in /tools.js to point to this script URL
 *
 * ENDPOINT: POST /track
 * BODY:     { "email": "...", "first_name": "...", "language": "fr", "url": "https://..." }
 */

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

const USERLIST_EVENTS_URL = 'https://push.userlist.com/events';

const corsHeaders = () => ({
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age':       '86400',
});

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });

const err = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });

BunnySDK.net.http.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return err('Method not allowed', 405);
  }

  let body: { email?: string; first_name?: string; language?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON body');
  }

  const { email, first_name, language, url } = body;
  if (!email) {
    return err('email is required');
  }

  const pushKey = process.env.USERLIST_PUSH_KEY;
  if (!pushKey) {
    return err('Server misconfiguration', 500);
  }

  const userProperties: Record<string, string> = { email };
  if (first_name) userProperties.first_name = first_name;
  if (language)   userProperties.language   = language;

  const eventProperties: Record<string, string> = {};
  if (url) eventProperties.url = url;

  try {
    const res = await fetch(USERLIST_EVENTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Push ${pushKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        name: 'Lead',
        user: { email, properties: userProperties },
        properties: eventProperties,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return err(`Userlist error: ${text}`, 502);
    }

    return ok({ success: true });
  } catch (e) {
    return err(`Upstream request failed: ${String(e)}`, 502);
  }
});
