/**
 * Airwallex Checkout: BunnyCDN Edge Script (script ID 99045)
 *
 * Generic checkout backend for pages that sell an Airwallex Billing subscription. Pages declare
 * their plans by key in /airwallex-data.js; the price IDs, sales windows and redirect pages live
 * only in PLANS below, so the browser never sends a raw price ID or URL.
 *
 * DEPLOYMENT:
 *   Deployed by .github/workflows/deploy-airwallex-checkout.yml on every push to main that
 *   changes this file. Environment variables (Bunny dashboard → Edge Scripts → 99045 → Env):
 *     AIRWALLEX_CLIENT_ID                  Client ID of the scoped API key
 *     AIRWALLEX_API_KEY                    Scoped API key (Billing customers + Billing checkouts, write)
 *     AIRWALLEX_LEGAL_ENTITY_ID            le_... billing entity
 *     AIRWALLEX_LINKED_PAYMENT_ACCOUNT_ID  acct_... account that receives the payments
 *     AIRWALLEX_LOGIN_AS                   Optional: account ID for x-login-as, only when the key
 *                                          is linked to several accounts
 *     USERLIST_PUSH_KEY                    Userlist Push API key (same as userlist-proxy.ts)
 *
 * CORS: only https://try.onetake.ai. Requests from any other Origin get 403.
 *
 * ENDPOINTS (POST, JSON body, JSON response):
 *
 *   /checkout  { plan, page, email, first_name, attribution }
 *              Sends the Userlist event AddToCart, creates a Billing Customer (email prefilled on
 *              the checkout page), then a Billing Checkout in SUBSCRIPTION mode.
 *              200 { url, checkout_id }: redirect the visitor to url (valid 1 hour).
 *
 *   /wire      { plan, page, email, first_name, last_name, company, attribution }
 *              Bank transfer pledge, for plans with wire: true. Sends the Userlist event
 *              InitiateCheckout and sets the user property pledged_wire_payment_on (now, UTC).
 *              200 { ok: true }: the page then shows the bank details.
 *
 *   /purchase  { checkout_id }
 *              Called by the success page. Retrieves the Billing Checkout and, only when its
 *              status is COMPLETED, sends the Userlist event Purchase (once per browser: the page
 *              keeps a flag). 200 { completed, plan, value, currency, email, first_name }.
 *
 * ERRORS: { error, code } with code one of
 *   UNKNOWN_PLAN (400), INVALID_EMAIL (400), INVALID_NAME (400), NOT_OPEN_YET (403),
 *   OFFER_CLOSED (410: the page redirects to /oto/too-late/), NOT_CONFIGURED (500),
 *   AIRWALLEX_ERROR (502, with step, status, airwallex_code, airwallex_message: the failed call), USERLIST_ERROR (502), FORBIDDEN_ORIGIN (403), NOT_FOUND (404).
 */

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

const SITE_ORIGIN         = 'https://try.onetake.ai';
const AIRWALLEX_API       = 'https://api.airwallex.com';
const USERLIST_EVENTS_URL = 'https://push.userlist.com/events';
const ATTRIBUTION_FIELDS  = ['referred_by', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_channel', 'click_id'];

type Plan = {
  priceId:     string;
  bonusPriceIds?: string[];   // 0 € prices listed under the plan on the checkout (same billing cycle)
  label:       string;   // Shown in Userlist and in the Airwallex metadata
  value:       number;   // Price excl. VAT, for conversion tracking
  currency:    string;
  duration:    { period: number; period_unit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' };   // Billing cycle, same as the price's
  opensAt?:    string;   // ISO 8601 UTC; checkouts refused before
  closesAt:    string;   // ISO 8601 UTC; checkouts refused from this instant
  successPath: string;   // Root-relative
  backPath:    string;   // Root-relative, anchored at the pricing section
  wire?:       boolean;  // Bank transfer allowed
};

// Le Challenge des Experts à Haute Valeur: dates in Europe/Paris (CET, UTC+1 after Oct 25).
// Quarterly from Thu Oct 29 00:00 Paris; everything closes after Mon Nov 2 23:59:59 Paris.
// Keep in sync with CONFIG in /4dcm/le-challenge/app.js and data-deadline in its index.html.
const CHALLENGE_CLOSES_AT = '2026-11-02T23:00:00Z';

const PLANS: Record<string, Plan> = {
  'challenge-yearly': {
    priceId:     'pri_sgpd7k7qvhnkhdrg33w',
    bonusPriceIds: ['pri_sgpdlsksvhnl1euoxcj'],   // Les Skills IA de l'Expert à Haute Valeur (yearly)
    label:       'Le Challenge des Experts à Haute Valeur (annuel)',
    value:       999,
    currency:    'EUR',
    duration:    { period: 1, period_unit: 'YEAR' },
    closesAt:    CHALLENGE_CLOSES_AT,
    successPath: '/4dcm/le-challenge/merci/',
    backPath:    '/4dcm/le-challenge/#prix',
    wire:        true,
  },
  'challenge-quarterly': {
    priceId:     'pri_sgpd7k7qvhnkhehpgad',
    bonusPriceIds: ['pri_sgpdd4ck6hnl1ffdwsk'],   // Les Skills IA de l'Expert à Haute Valeur (quarterly)
    label:       'Le Challenge des Experts à Haute Valeur (trimestriel)',
    value:       299,
    currency:    'EUR',
    duration:    { period: 90, period_unit: 'DAY' },
    opensAt:     '2026-10-28T23:00:00Z',
    closesAt:    CHALLENGE_CLOSES_AT,
    successPath: '/4dcm/le-challenge/merci/',
    backPath:    '/4dcm/le-challenge/#prix',
  },
};

// ── Responses ────────────────────────────────────────────────────────────────

const corsHeaders = (): Record<string, string> => ({
  'Access-Control-Allow-Origin':  SITE_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age':       '86400',
  'Vary':                         'Origin',
});

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });

const fail = (code: string, status: number, error = code) => json({ error, code }, status);

// Airwallex failure: which call failed and what Airwallex answered (no secrets), so the browser
// console shows the cause; the Bunny logs have the full response too
class AirwallexError extends Error {
  step: string;
  status: number;
  detail: Record<string, unknown>;
  constructor(step: string, status: number, detail: Record<string, unknown>) {
    super(`${step} failed (${status})`);
    this.step = step;
    this.status = status;
    this.detail = detail;
  }
}

function airwallexFailure(e: unknown): Response {
  if (e instanceof AirwallexError) {
    return json({
      error: 'AIRWALLEX_ERROR',
      code: 'AIRWALLEX_ERROR',
      step: e.step,
      status: e.status,
      airwallex_code: typeof e.detail.code === 'string' ? e.detail.code : '',
      airwallex_message: typeof e.detail.message === 'string' ? e.detail.message : '',
      airwallex_source: typeof e.detail.source === 'string' ? e.detail.source : '',
    }, 502);
  }
  console.error('Airwallex call failed', String(e));
  return json({ error: 'AIRWALLEX_ERROR', code: 'AIRWALLEX_ERROR', step: 'network', airwallex_message: String(e) }, 502);
}

// ── Input cleaning ───────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// Trimmed, without control characters, at most `max` characters ('' when not a usable string)
function cleanText(value: unknown, max = 200): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function cleanSlug(value: unknown): string {
  return typeof value === 'string' && /^[a-z0-9/_-]{1,100}$/.test(value) ? value : '';
}

function cleanAttribution(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value || typeof value !== 'object') return out;
  for (const key of ATTRIBUTION_FIELDS) {
    const v = cleanText((value as Record<string, unknown>)[key]);
    if (v) out[key] = v;
  }
  return out;
}

// null when the plan can be sold now, else the error response
function checkWindow(plan: Plan): Response | null {
  const now = Date.now();
  if (now >= Date.parse(plan.closesAt)) return fail('OFFER_CLOSED', 410);
  if (plan.opensAt && now < Date.parse(plan.opensAt)) return fail('NOT_OPEN_YET', 403);
  return null;
}

// ── Userlist ─────────────────────────────────────────────────────────────────

async function pushUserlist(
  name: string,
  email: string,
  userProperties: Record<string, string | number>,
  eventProperties: Record<string, string | number>,
): Promise<boolean> {
  const pushKey = process.env.USERLIST_PUSH_KEY;
  if (!pushKey) return false;
  try {
    const res = await fetch(USERLIST_EVENTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Push ${pushKey}`,
        'Accept':        'application/json',
      },
      body: JSON.stringify({ name, user: { email, properties: userProperties }, properties: eventProperties }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Airwallex ────────────────────────────────────────────────────────────────

// The access token is valid 30 minutes; kept in memory until a minute before it expires
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-id':  process.env.AIRWALLEX_CLIENT_ID || '',
    'x-api-key':    process.env.AIRWALLEX_API_KEY || '',
  };
  if (process.env.AIRWALLEX_LOGIN_AS) headers['x-login-as'] = process.env.AIRWALLEX_LOGIN_AS;

  const res = await fetch(`${AIRWALLEX_API}/api/v1/authentication/login`, { method: 'POST', headers });
  const data = await res.json().catch(() => ({})) as { token?: string; expires_at?: string };
  if (!res.ok || !data.token) {
    console.error('Airwallex login failed', res.status, JSON.stringify(data));
    throw new AirwallexError('login', res.status, data as Record<string, unknown>);
  }
  const expiresAt = Date.parse(data.expires_at || '') || Date.now() + 25 * 60_000;
  cachedToken = { token: data.token, expiresAt };
  return data.token;
}

async function airwallex(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>) {
  const call = async () => fetch(`${AIRWALLEX_API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getAccessToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });

  let res = await call();
  if (res.status === 401) {   // Token revoked or expired early: log in again once
    cachedToken = null;
    res = await call();
  }
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    console.error(`Airwallex ${method} ${path} failed`, res.status, JSON.stringify(data));
    throw new AirwallexError(`${method} ${path.replace(/\/(bc|bcus)_[^/]+/, '/{id}')}`, res.status, data);
  }
  return data;
}

function airwallexConfigured(): boolean {
  return !!(process.env.AIRWALLEX_CLIENT_ID && process.env.AIRWALLEX_API_KEY
    && process.env.AIRWALLEX_LEGAL_ENTITY_ID && process.env.AIRWALLEX_LINKED_PAYMENT_ACCOUNT_ID);
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleCheckout(fields: Record<string, unknown>): Promise<Response> {
  const planKey = cleanText(fields.plan, 64);
  const plan = PLANS[planKey];
  if (!plan) return fail('UNKNOWN_PLAN', 400);
  const closed = checkWindow(plan);
  if (closed) return closed;

  const email = cleanText(fields.email, 254).toLowerCase();
  if (!isValidEmail(email)) return fail('INVALID_EMAIL', 400);
  const firstName   = cleanText(fields.first_name, 100);
  const page        = cleanSlug(fields.page);
  const attribution = cleanAttribution(fields.attribution);

  if (!airwallexConfigured()) return fail('NOT_CONFIGURED', 500);

  // Abandoned cart follow-up; never blocks the checkout
  const userProperties: Record<string, string> = { ...attribution };
  if (firstName) userProperties.first_name = firstName;
  await pushUserlist('AddToCart', email, userProperties, {
    plan: planKey, value: plan.value, currency: plan.currency, page, payment_method: 'card', ...attribution,
  });

  // Airwallex metadata values are short strings
  const metadata: Record<string, string> = { plan: planKey, email, ...attribution };
  if (page)      metadata.page = page;
  if (firstName) metadata.first_name = firstName;

  try {
    const customer = await airwallex('POST', '/api/v1/billing/billing_customers/create', {
      request_id:               crypto.randomUUID(),
      email,
      name:                     firstName || email,
      type:                     'INDIVIDUAL',
      default_billing_currency: plan.currency,
      default_legal_entity_id:  process.env.AIRWALLEX_LEGAL_ENTITY_ID,
      metadata,
    });

    const checkout = await airwallex('POST', '/api/v1/billing/billing_checkouts/create', {
      request_id:                crypto.randomUUID(),
      mode:                      'SUBSCRIPTION',
      legal_entity_id:           process.env.AIRWALLEX_LEGAL_ENTITY_ID,
      linked_payment_account_id: process.env.AIRWALLEX_LINKED_PAYMENT_ACCOUNT_ID,
      billing_customer_id:       customer.id,
      success_url:               SITE_ORIGIN + plan.successPath,
      back_url:                  SITE_ORIGIN + plan.backPath,
      line_items:                [plan.priceId, ...(plan.bonusPriceIds || [])].map((id) => ({ price_id: id, quantity: 1 })),
      subscription_data:         { duration: plan.duration },   // Required in SUBSCRIPTION mode
    });
    if (typeof checkout.url !== 'string') throw new AirwallexError('checkout url', 200, { message: 'No url in the checkout response' });

    // Links the checkout to the page and campaign; a failure here must not block the sale
    await airwallex('POST', `/api/v1/billing/billing_checkouts/${checkout.id}/update`, {
      request_id: crypto.randomUUID(),
      metadata,
    }).catch(() => {});

    return json({ url: checkout.url, checkout_id: checkout.id });
  } catch (e) {
    return airwallexFailure(e);
  }
}

async function handleWire(fields: Record<string, unknown>): Promise<Response> {
  const planKey = cleanText(fields.plan, 64);
  const plan = PLANS[planKey];
  if (!plan || !plan.wire) return fail('UNKNOWN_PLAN', 400);
  const closed = checkWindow(plan);
  if (closed) return closed;

  const email = cleanText(fields.email, 254).toLowerCase();
  if (!isValidEmail(email)) return fail('INVALID_EMAIL', 400);
  const firstName = cleanText(fields.first_name, 100);
  const lastName  = cleanText(fields.last_name, 100);
  if (!firstName || !lastName) return fail('INVALID_NAME', 400);
  const company     = cleanText(fields.company, 200);
  const page        = cleanSlug(fields.page);
  const attribution = cleanAttribution(fields.attribution);

  const userProperties: Record<string, string> = {
    ...attribution,
    first_name: firstName,
    last_name:  lastName,
    // Set here (not by the browser) so a wrong visitor clock can't skew it
    pledged_wire_payment_on: new Date().toISOString(),
  };
  if (company) userProperties.company = company;

  const accepted = await pushUserlist('InitiateCheckout', email, userProperties, {
    plan: planKey, value: plan.value, currency: plan.currency, page, payment_method: 'wire', ...attribution,
  });
  return accepted ? json({ ok: true }) : fail('USERLIST_ERROR', 502);
}

async function handlePurchase(fields: Record<string, unknown>): Promise<Response> {
  const checkoutId = cleanText(fields.checkout_id, 100);
  if (!/^[A-Za-z0-9_-]+$/.test(checkoutId)) return fail('NOT_FOUND', 404);
  if (!airwallexConfigured()) return fail('NOT_CONFIGURED', 500);

  try {
    const checkout = await airwallex('GET', `/api/v1/billing/billing_checkouts/${checkoutId}`);
    if (checkout.status !== 'COMPLETED') return json({ completed: false });

    // Plan from the line item, else from the metadata written at creation
    const items = Array.isArray(checkout.line_items) ? checkout.line_items as Record<string, unknown>[] : [];
    const metadata = (checkout.metadata || {}) as Record<string, string>;
    const planKey = Object.keys(PLANS).find((k) => items.some((i) => i.price_id === PLANS[k].priceId))
      || (PLANS[metadata.plan] ? metadata.plan : '');
    const plan = PLANS[planKey];
    if (!plan) return json({ completed: false });

    const customer = checkout.billing_customer_id
      ? await airwallex('GET', `/api/v1/billing/billing_customers/${checkout.billing_customer_id}`).catch(() => ({} as Record<string, unknown>))
      : {} as Record<string, unknown>;
    const email = cleanText(customer.email || metadata.email, 254).toLowerCase();
    const firstName = cleanText(metadata.first_name, 100);

    if (isValidEmail(email)) {
      await pushUserlist('Purchase', email, firstName ? { first_name: firstName } : {}, {
        plan: planKey,
        value: plan.value,
        currency: plan.currency,
        payment_method: 'card',
        checkout_id: checkoutId,
        subscription_id: cleanText(checkout.subscription_id, 100),
      });
    }

    return json({ completed: true, plan: planKey, value: plan.value, currency: plan.currency, email, first_name: firstName });
  } catch (e) {
    return airwallexFailure(e);
  }
}

// ── Router ───────────────────────────────────────────────────────────────────

BunnySDK.net.http.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (origin !== SITE_ORIGIN) return fail('FORBIDDEN_ORIGIN', 403);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 405);

  let fields: Record<string, unknown>;
  try {
    fields = await req.json() as Record<string, unknown>;
    if (!fields || typeof fields !== 'object') throw new Error('body');
  } catch {
    return fail('INVALID_BODY', 400);
  }

  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  if (path === '/checkout') return handleCheckout(fields);
  if (path === '/wire')     return handleWire(fields);
  if (path === '/purchase') return handlePurchase(fields);
  return fail('NOT_FOUND', 404);
});
