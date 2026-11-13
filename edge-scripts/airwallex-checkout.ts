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
 *     AIRWALLEX_API_KEY                    Scoped API key (Billing customers + Billing checkouts, read
 *                                          and write; Billing subscriptions, read)
 *     AIRWALLEX_LEGAL_ENTITY_ID            le_... billing entity
 *     AIRWALLEX_LINKED_PAYMENT_ACCOUNT_ID  acct_... account that receives the payments
 *     AIRWALLEX_LOGIN_AS                   Optional: account ID for x-login-as, only when the key
 *                                          is linked to several accounts
 *     USERLIST_PUSH_KEY                    Userlist Push API key (same as userlist-proxy.ts)
 *     OWNER_NOTIFY_URL                     Optional: URL of edge-scripts/owner-notify.ts (SMS to Sébastien
 *                                          on each Challenge purchase with a phone number)
 *     OWNER_NOTIFY_SECRET                  Optional: same value as in owner-notify.ts
 *
 * SANDBOX: a second Bunny script runs this same file with ENVIRONMENT=SANDBOX and the credentials of
 * the Airwallex sandbox account (api-demo.airwallex.com); it offers only SANDBOX_PLANS. Pages reach it
 * with ?environment=sandbox (see tools.js). The script skips the owner SMS and Userlist in sandbox. It
 * refuses requests on the beta host without ENVIRONMENT=SANDBOX, and on any other host with it.
 *
 * CORS: only https://try.onetake.ai. Requests from any other Origin get 403.
 *
 * ENDPOINTS (POST, JSON body, JSON response):
 *
 *   /checkout  { plan, page, email, first_name, attribution }
 *              Sends the Userlist event AddToCart, reuses or creates the Billing Customer for the
 *              email and plan currency (email prefilled on the checkout page), then creates a
 *              Billing Checkout in SUBSCRIPTION mode.
 *              200 { url, checkout_id }: redirect the visitor to url (valid 1 hour).
 *
 *   /purchase  { checkout_id }
 *              Called by the success page. Retrieves the Billing Checkout and, only when its
 *              status is COMPLETED, sends the Userlist event Purchase (once per browser: the page
 *              keeps a flag). 200 { completed, plan, value, currency, email, first_name }.
 *
 * ERRORS: { error, code } with code one of
 *   UNKNOWN_PLAN (400), INVALID_EMAIL (400), NOT_OPEN_YET (403),
 *   OFFER_CLOSED (410: the page redirects to /oto/too-late/), NOT_CONFIGURED (500),
 *   AIRWALLEX_ERROR (502, with step, status, airwallex_code, airwallex_message: the failed call), USERLIST_ERROR (502), FORBIDDEN_ORIGIN (403), NOT_FOUND (404).
 */

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

const SITE_ORIGIN         = 'https://try.onetake.ai';
// Sandbox deployment (second Bunny script, same file): set ENVIRONMENT=SANDBOX and the sandbox credentials;
// it then calls the Airwallex sandbox API and offers only SANDBOX_PLANS
const SANDBOX             = process.env.ENVIRONMENT === 'SANDBOX';
const AIRWALLEX_API       = SANDBOX ? 'https://api-demo.airwallex.com' : 'https://api.airwallex.com';
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
  closesAt?:   string;   // ISO 8601 UTC; checkouts refused from this instant (omit: always open)
  successPath: string;   // Root-relative
  backPath:    string;   // Root-relative, anchored at the pricing section
};

// Le Challenge des Experts à Haute Valeur: dates in Europe/Paris (CET, UTC+1 after Oct 25).
// Quarterly from Sat Oct 31 00:00 Paris; everything closes after Mon Nov 2 23:59:59 Paris.
// Keep in sync with CONFIG in /4dcm/le-challenge/app.js and data-deadline in its index.html.
const CHALLENGE_CLOSES_AT = '2026-11-02T23:00:00Z';

// Coaching Black Friday: dates in Europe/Paris (UTC+1). Sales open Fri Nov 13 00:00 Paris; quarterly
// plans in the last 2 days, from Mon Nov 16 00:00 Paris. The pages close after Tue Nov 17 23:59:59 Paris.
// Keep in sync with CONFIG in /4dcm/black-friday-coaching/app.js and data-deadline in its pages.
const BF_COACHING_OPENS_AT           = '2026-11-12T23:00:00Z';
const BF_COACHING_QUARTERLY_OPENS_AT = '2026-11-15T23:00:00Z';

const LIVE_PLANS: Record<string, Plan> = {
  'challenge-yearly': {
    priceId:     'pri_sgpd7k7qvhnkhdrg33w',
    bonusPriceIds: [   // Yearly 0 € prices, in the order shown on the checkout
      'pri_sgpdd4ck6hnl1q5hn8e',   // Le Challenge des Experts à Haute Valeur
      'pri_sgpdlsksvhnl1euoxcj',   // Les Skills IA de l'Expert à Haute Valeur
      'pri_sgpdd4ck6hnl1ni1dzc',   // Groupe privé VIP
    ],
    label:       'Le Challenge des Experts à Haute Valeur (annuel)',
    value:       999,
    currency:    'EUR',
    duration:    { period: 1, period_unit: 'YEAR' },
    closesAt:    CHALLENGE_CLOSES_AT,
    successPath: '/4dcm/le-challenge/merci/',
    backPath:    '/4dcm/le-challenge/#prix',
  },
  'challenge-quarterly': {
    priceId:     'pri_sgpd7k7qvhnkhehpgad',
    bonusPriceIds: [   // Quarterly 0 € prices, in the order shown on the checkout
      'pri_sgpdd4ck6hnl1qv8bkn',   // Le Challenge des Experts à Haute Valeur
      'pri_sgpdd4ck6hnl1ffdwsk',   // Les Skills IA de l'Expert à Haute Valeur
      'pri_sgpd7k7qvhnl1ob13hn',   // Groupe privé VIP
    ],
    label:       'Le Challenge des Experts à Haute Valeur (trimestriel)',
    value:       299,
    currency:    'EUR',
    duration:    { period: 90, period_unit: 'DAY' },
    opensAt:     '2026-10-30T23:00:00Z',
    closesAt:    CHALLENGE_CLOSES_AT,
    successPath: '/4dcm/le-challenge/merci/',
    backPath:    '/4dcm/le-challenge/#prix',
  },
  // Same offer for current and former OneTake customers (/4dcm/acces-challenge/): no sales window
  'challenge-access-yearly': {
    priceId:     'pri_sgpd7k7qvhnkhdrg33w',
    bonusPriceIds: [   // Same yearly 0 € prices as challenge-yearly
      'pri_sgpdd4ck6hnl1q5hn8e',   // Le Challenge des Experts à Haute Valeur
      'pri_sgpdlsksvhnl1euoxcj',   // Les Skills IA de l'Expert à Haute Valeur
      'pri_sgpdd4ck6hnl1ni1dzc',   // Groupe privé VIP
    ],
    label:       'Le Challenge des Experts à Haute Valeur (accès clients, annuel)',
    value:       999,
    currency:    'EUR',
    duration:    { period: 1, period_unit: 'YEAR' },
    successPath: '/4dcm/acces-challenge/merci/',
    backPath:    '/4dcm/acces-challenge/#prix',
  },
  // Shown on /4dcm/acces-challenge/ only with ?plan=quarterly: no sales window
  'challenge-access-quarterly': {
    priceId:     'pri_sgpd7k7qvhnkhehpgad',
    bonusPriceIds: [   // Same quarterly 0 € prices as challenge-quarterly
      'pri_sgpdd4ck6hnl1qv8bkn',   // Le Challenge des Experts à Haute Valeur
      'pri_sgpdd4ck6hnl1ffdwsk',   // Les Skills IA de l'Expert à Haute Valeur
      'pri_sgpd7k7qvhnl1ob13hn',   // Groupe privé VIP
    ],
    label:       'Le Challenge des Experts à Haute Valeur (accès clients, trimestriel)',
    value:       299,
    currency:    'EUR',
    duration:    { period: 90, period_unit: 'DAY' },
    successPath: '/4dcm/acces-challenge/merci/',
    backPath:    '/4dcm/acces-challenge/#prix',
  },
  // Customers who cancelled OneTake in the past (/4dcm/comeagain-challenge/): same offer, no sales window
  'challenge-comeback-yearly': {
    priceId:     'pri_sgpd7k7qvhnkhdrg33w',
    bonusPriceIds: [   // Same yearly 0 € prices as challenge-yearly
      'pri_sgpdd4ck6hnl1q5hn8e',   // Le Challenge des Experts à Haute Valeur
      'pri_sgpdlsksvhnl1euoxcj',   // Les Skills IA de l'Expert à Haute Valeur
      'pri_sgpdd4ck6hnl1ni1dzc',   // Groupe privé VIP
    ],
    label:       'Le Challenge des Experts à Haute Valeur (retour, annuel)',
    value:       999,
    currency:    'EUR',
    duration:    { period: 1, period_unit: 'YEAR' },
    successPath: '/4dcm/comeagain-challenge/merci/',
    backPath:    '/4dcm/comeagain-challenge/#prix',
  },
  // Shown on /4dcm/comeagain-challenge/ only with ?plan=quarterly
  'challenge-comeback-quarterly': {
    priceId:     'pri_sgpd7k7qvhnkhehpgad',
    bonusPriceIds: [   // Same quarterly 0 € prices as challenge-quarterly
      'pri_sgpdd4ck6hnl1qv8bkn',   // Le Challenge des Experts à Haute Valeur
      'pri_sgpdd4ck6hnl1ffdwsk',   // Les Skills IA de l'Expert à Haute Valeur
      'pri_sgpd7k7qvhnl1ob13hn',   // Groupe privé VIP
    ],
    label:       'Le Challenge des Experts à Haute Valeur (retour, trimestriel)',
    value:       299,
    currency:    'EUR',
    duration:    { period: 90, period_unit: 'DAY' },
    successPath: '/4dcm/comeagain-challenge/merci/',
    backPath:    '/4dcm/comeagain-challenge/#prix',
  },
  // New members: never customers, or tried OneTake without staying (/4dcm/rejoindre-challenge/).
  // Same offer, no sales window: each email link has its own deadline, shown by the page only
  'challenge-join-yearly': {
    priceId:     'pri_sgpd7k7qvhnkhdrg33w',
    bonusPriceIds: [   // Same yearly 0 € prices as challenge-yearly
      'pri_sgpdd4ck6hnl1q5hn8e',   // Le Challenge des Experts à Haute Valeur
      'pri_sgpdlsksvhnl1euoxcj',   // Les Skills IA de l'Expert à Haute Valeur
      'pri_sgpdd4ck6hnl1ni1dzc',   // Groupe privé VIP
    ],
    label:       'Le Challenge des Experts à Haute Valeur (nouveaux membres, annuel)',
    value:       999,
    currency:    'EUR',
    duration:    { period: 1, period_unit: 'YEAR' },
    successPath: '/4dcm/rejoindre-challenge/merci/',
    backPath:    '/4dcm/rejoindre-challenge/#prix',
  },
  // Shown on /4dcm/rejoindre-challenge/ only with ?plan=quarterly
  'challenge-join-quarterly': {
    priceId:     'pri_sgpd7k7qvhnkhehpgad',
    bonusPriceIds: [   // Same quarterly 0 € prices as challenge-quarterly
      'pri_sgpdd4ck6hnl1qv8bkn',   // Le Challenge des Experts à Haute Valeur
      'pri_sgpdd4ck6hnl1ffdwsk',   // Les Skills IA de l'Expert à Haute Valeur
      'pri_sgpd7k7qvhnl1ob13hn',   // Groupe privé VIP
    ],
    label:       'Le Challenge des Experts à Haute Valeur (nouveaux membres, trimestriel)',
    value:       299,
    currency:    'EUR',
    duration:    { period: 90, period_unit: 'DAY' },
    successPath: '/4dcm/rejoindre-challenge/merci/',
    backPath:    '/4dcm/rejoindre-challenge/#prix',
  },
  // Coachs et Formateurs : ventes record pendant Black Friday (/4dcm/black-friday-coaching/), dates above.
  // Same prices as the Challenge, which is included. No closesAt on purpose: the pages close on
  // Tue Nov 17 (countdown redirect), but a link with ?unlockfor=1 must still let a late buyer pay.
  'bf-coaching-yearly': {
    priceId:     'pri_sgpd7k7qvhnkhdrg33w',
    bonusPriceIds: [   // Same yearly 0 € prices as challenge-yearly
      'pri_sgpdd4ck6hnl1q5hn8e',   // Le Challenge des Experts à Haute Valeur
      'pri_sgpdlsksvhnl1euoxcj',   // Les Skills IA de l'Expert à Haute Valeur
      'pri_sgpdd4ck6hnl1ni1dzc',   // Groupe privé VIP
      // TODO: add the yearly 0 € prices "Atelier Black Friday" and "Coaching live" once created
    ],
    label:       'Coaching Black Friday (annuel)',
    value:       999,
    currency:    'EUR',
    duration:    { period: 1, period_unit: 'YEAR' },
    opensAt:     BF_COACHING_OPENS_AT,
    successPath: '/4dcm/black-friday-coaching/offre/merci/',
    backPath:    '/4dcm/black-friday-coaching/offre/#prix',
  },
  'bf-coaching-quarterly': {
    priceId:     'pri_sgpd7k7qvhnkhehpgad',
    bonusPriceIds: [   // Same quarterly 0 € prices as challenge-quarterly
      'pri_sgpdd4ck6hnl1qv8bkn',   // Le Challenge des Experts à Haute Valeur
      'pri_sgpdd4ck6hnl1ffdwsk',   // Les Skills IA de l'Expert à Haute Valeur
      'pri_sgpd7k7qvhnl1ob13hn',   // Groupe privé VIP
      // TODO: add the quarterly 0 € prices "Atelier Black Friday" and "Coaching live" once created
    ],
    label:       'Coaching Black Friday (trimestriel)',
    value:       299,
    currency:    'EUR',
    duration:    { period: 90, period_unit: 'DAY' },
    opensAt:     BF_COACHING_QUARTERLY_OPENS_AT,
    successPath: '/4dcm/black-friday-coaching/offre/merci/',
    backPath:    '/4dcm/black-friday-coaching/offre/#prix',
  },
  // Current OneTake customers
  'bf-coaching-access-yearly': {
    priceId:     'pri_sgpd7k7qvhnkhdrg33w',
    bonusPriceIds: [   // Same yearly 0 € prices as challenge-yearly
      'pri_sgpdd4ck6hnl1q5hn8e',   // Le Challenge des Experts à Haute Valeur
      'pri_sgpdlsksvhnl1euoxcj',   // Les Skills IA de l'Expert à Haute Valeur
      'pri_sgpdd4ck6hnl1ni1dzc',   // Groupe privé VIP
      // TODO: add the yearly 0 € prices "Atelier Black Friday" and "Coaching live" once created
    ],
    label:       'Coaching Black Friday (clients, annuel)',
    value:       999,
    currency:    'EUR',
    duration:    { period: 1, period_unit: 'YEAR' },
    opensAt:     BF_COACHING_OPENS_AT,
    successPath: '/4dcm/black-friday-coaching/clients/merci/',
    backPath:    '/4dcm/black-friday-coaching/clients/#prix',
  },
  'bf-coaching-access-quarterly': {
    priceId:     'pri_sgpd7k7qvhnkhehpgad',
    bonusPriceIds: [   // Same quarterly 0 € prices as challenge-quarterly
      'pri_sgpdd4ck6hnl1qv8bkn',   // Le Challenge des Experts à Haute Valeur
      'pri_sgpdd4ck6hnl1ffdwsk',   // Les Skills IA de l'Expert à Haute Valeur
      'pri_sgpd7k7qvhnl1ob13hn',   // Groupe privé VIP
      // TODO: add the quarterly 0 € prices "Atelier Black Friday" and "Coaching live" once created
    ],
    label:       'Coaching Black Friday (clients, trimestriel)',
    value:       299,
    currency:    'EUR',
    duration:    { period: 90, period_unit: 'DAY' },
    opensAt:     BF_COACHING_QUARTERLY_OPENS_AT,
    successPath: '/4dcm/black-friday-coaching/clients/merci/',
    backPath:    '/4dcm/black-friday-coaching/clients/#prix',
  },
  // Customers who cancelled OneTake in the past
  'bf-coaching-comeback-yearly': {
    priceId:     'pri_sgpd7k7qvhnkhdrg33w',
    bonusPriceIds: [   // Same yearly 0 € prices as challenge-yearly
      'pri_sgpdd4ck6hnl1q5hn8e',   // Le Challenge des Experts à Haute Valeur
      'pri_sgpdlsksvhnl1euoxcj',   // Les Skills IA de l'Expert à Haute Valeur
      'pri_sgpdd4ck6hnl1ni1dzc',   // Groupe privé VIP
      // TODO: add the yearly 0 € prices "Atelier Black Friday" and "Coaching live" once created
    ],
    label:       'Coaching Black Friday (retour, annuel)',
    value:       999,
    currency:    'EUR',
    duration:    { period: 1, period_unit: 'YEAR' },
    opensAt:     BF_COACHING_OPENS_AT,
    successPath: '/4dcm/black-friday-coaching/retour/merci/',
    backPath:    '/4dcm/black-friday-coaching/retour/#prix',
  },
  'bf-coaching-comeback-quarterly': {
    priceId:     'pri_sgpd7k7qvhnkhehpgad',
    bonusPriceIds: [   // Same quarterly 0 € prices as challenge-quarterly
      'pri_sgpdd4ck6hnl1qv8bkn',   // Le Challenge des Experts à Haute Valeur
      'pri_sgpdd4ck6hnl1ffdwsk',   // Les Skills IA de l'Expert à Haute Valeur
      'pri_sgpd7k7qvhnl1ob13hn',   // Groupe privé VIP
      // TODO: add the quarterly 0 € prices "Atelier Black Friday" and "Coaching live" once created
    ],
    label:       'Coaching Black Friday (retour, trimestriel)',
    value:       299,
    currency:    'EUR',
    duration:    { period: 90, period_unit: 'DAY' },
    opensAt:     BF_COACHING_QUARTERLY_OPENS_AT,
    successPath: '/4dcm/black-friday-coaching/retour/merci/',
    backPath:    '/4dcm/black-friday-coaching/retour/#prix',
  },
};

// Sandbox deployment (ENVIRONMENT=SANDBOX): the same plans as LIVE_PLANS (same keys, labels, values and
// pages), only the price comes from the Airwallex sandbox account, per billing cycle (the last word of the
// plan key). Sales windows and bonus prices are not copied. To add a cycle, add it here and in LIVE_PLANS.
const SANDBOX_CYCLES: Record<string, { priceId: string; duration: Plan['duration'] }> = {
  yearly:    { priceId: 'pri_sgpvlwl2chnvktri22h', duration: { period: 1, period_unit: 'YEAR' } },
  quarterly: { priceId: 'pri_sgpvjhrj5hnvosz9frg', duration: { period: 90, period_unit: 'DAY' } },
};

const SANDBOX_PLANS: Record<string, Plan> = Object.fromEntries(
  Object.entries(LIVE_PLANS)
    .filter(([key]) => SANDBOX_CYCLES[key.split('-').pop() as string])
    .map(([key, { bonusPriceIds, opensAt, closesAt, ...plan }]) => [key, {
      ...plan,
      ...SANDBOX_CYCLES[key.split('-').pop() as string],
    }]),
);

// Keeps the success and back pages in sandbox mode, with the test flags the sales page was opened with
// (fp_test for the FirstPromoter test, unlockfor to bypass the countdown redirect)
function sandboxUrl(path: string, fields: Record<string, unknown>): string {
  const url = new URL(path, SITE_ORIGIN);
  url.searchParams.set('environment', 'sandbox');
  if (cleanText(fields.fp_test, 8) === '1') url.searchParams.set('fp_test', '1');
  const unlockfor = cleanText(fields.unlockfor, 32);
  if (unlockfor) url.searchParams.set('unlockfor', unlockfor);
  return url.pathname + url.search + url.hash;
}

const PLANS: Record<string, Plan> = SANDBOX ? SANDBOX_PLANS : LIVE_PLANS;

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

// WhatsApp number (optional) in E.164, e.g. +33612345678; '' when absent or malformed (never refuses a sale)
function cleanPhone(value: unknown): string {
  if (typeof value !== 'string') return '';
  let phone = value.replace(/[\s.\-()\/]/g, '');
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  return /^\+[1-9]\d{6,14}$/.test(phone) ? phone : '';
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

// FirstPromoter visitor tracking ID (tid) and promoter referral ID (ref_id), when the page has them
function cleanFirstPromoter(fields: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ['tid', 'ref_id']) {
    const v = cleanText(fields[key], 100);
    if (/^[A-Za-z0-9._~@+-]+$/.test(v)) out[key] = v;
  }
  return out;
}

// null when the plan can be sold now, else the error response
function checkWindow(plan: Plan): Response | null {
  const now = Date.now();
  if (plan.closesAt && now >= Date.parse(plan.closesAt)) return fail('OFFER_CLOSED', 410);
  if (plan.opensAt && now < Date.parse(plan.opensAt)) return fail('NOT_OPEN_YET', 403);
  return null;
}

// ── Userlist ─────────────────────────────────────────────────────────────────

// SMS to Sébastien through edge-scripts/owner-notify.ts (who, why and WhatsApp links). Only with
// a phone number; skipped when OWNER_NOTIFY_URL or OWNER_NOTIFY_SECRET is missing. Never fails the
// request.
async function notifyOwner(kind: string, firstName: string, email: string, telephone: string): Promise<void> {
  const url = process.env.OWNER_NOTIFY_URL;
  const secret = process.env.OWNER_NOTIFY_SECRET;
  if (SANDBOX || !url || !secret || !telephone) return;
  try {
    await fetch(url.replace(/\/+$/, '') + '/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
      body: JSON.stringify({ kind, first_name: firstName, email, telephone }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error('Owner SMS request failed:', e instanceof Error ? e.message : e);
  }
}


async function pushUserlist(
  name: string,
  email: string,
  userProperties: Record<string, string | number>,
  eventProperties: Record<string, string | number>,
): Promise<boolean> {
  const pushKey = process.env.USERLIST_PUSH_KEY;
  if (SANDBOX || !pushKey) return false;
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

// Tries each metadata set in turn until Airwallex accepts one (full, then without the utm
// attribution, then without FirstPromoter); never throws
async function attachMetadata(path: string, attempts: Record<string, string>[]) {
  const update = (m: Record<string, string>) => airwallex('POST', path, { request_id: crypto.randomUUID(), metadata: m });
  for (const metadata of attempts) {
    try { await update(metadata); return; } catch { /* next, smaller set */ }
  }
}

// Reuses the newest billing customer of this email, currency and legal entity, so a repeat buyer
// keeps one customer; any lookup failure falls back to creating a new one
async function findOrCreateCustomer(email: string, firstName: string, currency: string) {
  if (process.env.AIRWALLEX_LEGAL_ENTITY_ID) try {
    const found = await airwallex('GET', `/api/v1/billing/billing_customers?email=${encodeURIComponent(email)}&page_size=100`);
    const items = (Array.isArray(found.items) ? found.items : []) as Record<string, unknown>[];
    const match = items
      .filter((c) => String(c.email || '').toLowerCase() === email && c.default_billing_currency === currency
        && c.default_legal_entity_id === process.env.AIRWALLEX_LEGAL_ENTITY_ID && typeof c.id === 'string')
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
    if (match) return { customer: match, reused: true };
  } catch { /* create below */ }

  const customer = await airwallex('POST', '/api/v1/billing/billing_customers/create', {
    request_id:               crypto.randomUUID(),
    email,
    name:                     firstName || email,
    type:                     'INDIVIDUAL',
    default_billing_currency: currency,
    default_legal_entity_id:  process.env.AIRWALLEX_LEGAL_ENTITY_ID,
  });
  return { customer, reused: false };
}

// Renewals are credited from the customer metadata, so a customer whose subscription still bills
// keeps it. Unknown counts as billing: a failed lookup must not move commission
async function hasBillingSubscription(customerId: string): Promise<boolean> {
  try {
    const found = await airwallex('GET', `/api/v1/billing/subscriptions?billing_customer_id=${encodeURIComponent(customerId)}&page_size=100`);
    const items = (Array.isArray(found.items) ? found.items : []) as Record<string, unknown>[];
    return items.some((s) => String(s.status) !== 'CANCELLED');
  } catch {
    return true;
  }
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
  const telephone   = cleanPhone(fields.telephone);
  const page        = cleanSlug(fields.page);
  const attribution = cleanAttribution(fields.attribution);
  const firstPromoter = cleanFirstPromoter(fields);

  if (!airwallexConfigured()) return fail('NOT_CONFIGURED', 500);

  // Abandoned cart follow-up; never blocks the checkout
  const userProperties: Record<string, string> = { ...attribution };
  if (firstName) userProperties.first_name = firstName;
  if (telephone) userProperties.telephone = telephone;
  await pushUserlist('AddToCart', email, userProperties, {
    plan: planKey, value: plan.value, currency: plan.currency, page, payment_method: 'card', ...attribution,
  });

  // Airwallex metadata values are short strings. Attached after creation, never at creation:
  // metadata Airwallex refuses (e.g. a long utm value) must not block the sale
  const baseMetadata: Record<string, string> = { plan: planKey, email };
  if (page)      baseMetadata.page = page;
  if (firstName) baseMetadata.first_name = firstName;
  if (telephone) baseMetadata.telephone = telephone;   // Repeated on the Purchase event
  // tid and ref_id: read by the webhook handler for the FirstPromoter sale API, so they come
  // before the rest of the attribution in the fallbacks
  const salesMetadata: Record<string, string> = { ...baseMetadata, ...firstPromoter };
  const metadata: Record<string, string> = { ...salesMetadata, ...attribution };

  try {
    const { customer, reused } = await findOrCreateCustomer(email, firstName, plan.currency);
    const keepCustomerMetadata = reused && await hasBillingSubscription(String(customer.id));

    const checkout = await airwallex('POST', '/api/v1/billing/billing_checkouts/create', {
      request_id:                crypto.randomUUID(),
      mode:                      'SUBSCRIPTION',
      legal_entity_id:           process.env.AIRWALLEX_LEGAL_ENTITY_ID,
      linked_payment_account_id: process.env.AIRWALLEX_LINKED_PAYMENT_ACCOUNT_ID,
      billing_customer_id:       customer.id,
      success_url:               SITE_ORIGIN + (SANDBOX ? sandboxUrl(plan.successPath, fields) : plan.successPath),
      back_url:                  SITE_ORIGIN + (SANDBOX ? sandboxUrl(plan.backPath, fields) : plan.backPath),
      line_items:                [plan.priceId, ...(plan.bonusPriceIds || [])].map((id) => ({ price_id: id, quantity: 1 })),
      subscription_data:         { duration: plan.duration },   // Required in SUBSCRIPTION mode
    });
    if (typeof checkout.url !== 'string') throw new AirwallexError('checkout url', 200, { message: 'No url in the checkout response' });

    // Links the customer and checkout to the page and campaign; a failure here must not block the sale
    await Promise.all([
      !keepCustomerMetadata && attachMetadata(`/api/v1/billing/billing_customers/${customer.id}/update`, [metadata, salesMetadata, baseMetadata]),
      attachMetadata(`/api/v1/billing/billing_checkouts/${checkout.id}/update`, [metadata, salesMetadata, baseMetadata]),
    ]);

    return json({ url: checkout.url, checkout_id: checkout.id });
  } catch (e) {
    return airwallexFailure(e);
  }
}

async function handlePurchase(fields: Record<string, unknown>): Promise<Response> {
  const checkoutId = cleanText(fields.checkout_id, 100);
  if (!/^[A-Za-z0-9_-]+$/.test(checkoutId)) return fail('NOT_FOUND', 404);
  if (!airwallexConfigured()) return fail('NOT_CONFIGURED', 500);

  try {
    const checkout = await airwallex('GET', `/api/v1/billing/billing_checkouts/${checkoutId}`);
    if (checkout.status !== 'COMPLETED') return json({ completed: false });

    // Plans of one cycle share a price ID: prefer the plan written in the metadata at creation when its
    // price ID is on a line item, else the first plan with a matching line item
    const items = Array.isArray(checkout.line_items) ? checkout.line_items as Record<string, unknown>[] : [];
    const metadata = (checkout.metadata || {}) as Record<string, string>;
    const onItems = (k: string) => items.some((i) => i.price_id === PLANS[k].priceId);
    const planKey = (PLANS[metadata.plan] && onItems(metadata.plan) ? metadata.plan : '')
      || Object.keys(PLANS).find(onItems)
      || (PLANS[metadata.plan] ? metadata.plan : '');
    const plan = PLANS[planKey];
    if (!plan) return json({ completed: false });

    const customer = checkout.billing_customer_id
      ? await airwallex('GET', `/api/v1/billing/billing_customers/${checkout.billing_customer_id}`).catch(() => ({} as Record<string, unknown>))
      : {} as Record<string, unknown>;
    const email = cleanText(customer.email || metadata.email, 254).toLowerCase();
    const firstName = cleanText(metadata.first_name, 100);
    const telephone = cleanPhone(metadata.telephone);

    if (isValidEmail(email)) {
      const userProperties: Record<string, string> = {};
      if (firstName) userProperties.first_name = firstName;
      if (telephone) userProperties.telephone = telephone;
      await pushUserlist('Purchase', email, userProperties, {
        plan: planKey,
        value: plan.value,
        currency: plan.currency,
        payment_method: 'card',
        checkout_id: checkoutId,
        subscription_id: cleanText(checkout.subscription_id, 100),
      });
    }
    await notifyOwner('challenge', firstName, email, telephone);

    // customer_id: the page registers it as the FirstPromoter lead uid
    return json({ completed: true, plan: planKey, value: plan.value, currency: plan.currency, email, first_name: firstName,
      customer_id: cleanText(checkout.billing_customer_id, 100) });
  } catch (e) {
    return airwallexFailure(e);
  }
}

// ── Router ───────────────────────────────────────────────────────────────────

// Every refused request goes to the Bunny logs (Edge Scripts → 99045 → Logs), so a visitor's
// error code can be matched to its cause; Airwallex failures also log the full response above
function logRefusal(req: Request, path: string, res: Response, code: string, fields: Record<string, unknown> = {}) {
  console.warn(`Refused ${req.method} ${path || '/'}: ${code} (${res.status})`, JSON.stringify({
    origin: req.headers.get('origin') || '',
    plan:   cleanText(fields.plan, 64),
    email:  cleanText(fields.email, 254).toLowerCase(),
  }));
  return res;
}

BunnySDK.net.http.serve(async (req: Request) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  const refuse = (code: string, status: number) => logRefusal(req, path, fail(code, status), code);

  const origin = req.headers.get('origin');
  if (origin !== SITE_ORIGIN) return refuse('FORBIDDEN_ORIGIN', 403);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });

  // Fail closed, after the preflight so the page reads the error: the beta host must run in sandbox
  // (else live plans against the live API) and every other host live (else fake checkouts on live links)
  if (SANDBOX !== new URL(req.url).hostname.startsWith('beta.')) return refuse('NOT_CONFIGURED', 500);

  if (req.method !== 'POST') return refuse('METHOD_NOT_ALLOWED', 405);

  let fields: Record<string, unknown>;
  try {
    fields = await req.json() as Record<string, unknown>;
    if (!fields || typeof fields !== 'object') throw new Error('body');
  } catch {
    return refuse('INVALID_BODY', 400);
  }

  let res: Response;
  if (path === '/checkout')      res = await handleCheckout(fields);
  else if (path === '/purchase') res = await handlePurchase(fields);
  else return refuse('NOT_FOUND', 404);

  if (!res.ok) {
    const body = await res.clone().json().catch(() => ({})) as Record<string, unknown>;
    logRefusal(req, path, res, cleanText(body.code, 64) || 'UNKNOWN', fields);
  }
  return res;
});
