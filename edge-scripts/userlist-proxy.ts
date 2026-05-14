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
 * BODY:     { "email": "...", "first_name": "..." }
 */

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

const USERLIST_PUSH_URL = 'https://push.userlist.com';

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

  let body: { email?: string; first_name?: string };
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON body');
  }

  const { email, first_name } = body;
  if (!email) {
    return err('email is required');
  }

  const pushKey = process.env.USERLIST_PUSH_KEY;
  if (!pushKey) {
    return err('Server misconfiguration', 500);
  }

  const authHeader = `Basic ${btoa(`:${pushKey}`)}`;

  try {
    const [usersRes, eventsRes] = await Promise.all([
      fetch(`${USERLIST_PUSH_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          identifier: email,
          email,
          properties: { first_name: first_name ?? '', language: 'fr' },
        }),
      }),
      fetch(`${USERLIST_PUSH_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          name: 'Lead',
          user: { identifier: email },
        }),
      }),
    ]);

    if (!usersRes.ok) {
      const text = await usersRes.text();
      return err(`Userlist /users error: ${text}`, 502);
    }
    if (!eventsRes.ok) {
      const text = await eventsRes.text();
      return err(`Userlist /events error: ${text}`, 502);
    }

    return ok({ success: true });
  } catch (e) {
    return err(`Upstream request failed: ${String(e)}`, 502);
  }
});
