/**
 * Userlist Lead Proxy — BunnyCDN Edge Script
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
 */

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

const USERLIST_EVENTS_URL = 'https://push.userlist.com/events';
const SITE_ORIGIN        = 'https://try.onetake.ai';

const corsHeaders = () => ({
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age':       '86400',
});

const err = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });

function isValidRedirectPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes(':') && !path.includes('\\');
}

BunnySDK.net.http.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return err('Method not allowed', 405);
  }

  let email      = '';
  let first_name = '';
  let language   = '';
  let url        = '';
  let redirect   = '/';

  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const body = await req.formData();
    email      = (body.get('email')      as string) || '';
    first_name = (body.get('first_name') as string) || (body.get('prenom') as string) || '';
    language   = (body.get('language')   as string) || '';
    url        = (body.get('url')        as string) || '';
    redirect   = (body.get('redirect')   as string) || '/';
  } else {
    try {
      const body = await req.json() as Record<string, string>;
      email      = body.email      || '';
      first_name = body.first_name || '';
      language   = body.language   || '';
      url        = body.url        || '';
    } catch {
      return err('Invalid request body');
    }
  }

  if (!isValidRedirectPath(redirect)) redirect = '/';

  const redirectResponse = () =>
    new Response(null, { status: 302, headers: { 'Location': SITE_ORIGIN + redirect } });

  if (!email) return redirectResponse();

  const pushKey = process.env.USERLIST_PUSH_KEY;
  if (!pushKey) return redirectResponse();

  const userProperties: Record<string, string> = { email };
  if (first_name) userProperties.first_name = first_name;
  if (language)   userProperties.language   = language;

  const eventProperties: Record<string, string> = {};
  if (url) eventProperties.url = url;

  try {
    await fetch(USERLIST_EVENTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Push ${pushKey}`,
        'Accept':        'application/json',
      },
      body: JSON.stringify({
        name: 'Lead',
        user: { email, properties: userProperties },
        properties: eventProperties,
      }),
    });
  } catch {
    // swallow — always redirect regardless of Userlist outcome
  }

  return redirectResponse();
});
