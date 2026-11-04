/**
 * Owner SMS notifications: BunnyCDN Edge Script
 *
 * Sends Sébastien an SMS through the Free Mobile API (it can only text the account owner's own
 * phone) when someone buys or registers. The SMS holds only a WhatsApp link (wa.me) to the
 * buyer or lead, with Sébastien's message already typed: one tap, then Send. No SMS when the
 * person gave no WhatsApp number.
 *
 * ENDPOINTS (POST):
 *
 *   /paddle   Paddle notification destination (event transaction.completed). Checks the
 *             Paddle-Signature header, then texts for first purchases only (origin "web": paid
 *             and trial; renewals are ignored), in the buyer's language (custom_data.language).
 *             Always answers 200 once the signature is valid, so Paddle doesn't retry.
 *
 *   /notify   Called by our other edge scripts, with "Authorization: Bearer OWNER_NOTIFY_SECRET".
 *             JSON body { kind, first_name, telephone }, kind one of:
 *               challenge    Challenge purchase (edge-scripts/airwallex-checkout.ts, /purchase)
 *               masterclass  French masterclass registration (edge-scripts/userlist-proxy.ts)
 *             200 { sent: true|false }.
 *
 * Bunny script 100963, deployed by .github/workflows/deploy-owner-notify.yml.
 *
 * ENVIRONMENT (Bunny dashboard → Edge Scripts → 100963 → Env, as secrets):
 *   FREE_MOBILE_USER       Free Mobile login (Espace Abonné → Mes Options → Notifications par SMS)
 *   FREE_MOBILE_PASS       Free Mobile identification key
 *   PADDLE_WEBHOOK_SECRET  Secret key of the Paddle notification destination (pdl_ntfset_...)
 *   OWNER_NOTIFY_SECRET    Shared with airwallex-checkout.ts and userlist-proxy.ts
 *
 * Messages are below (MESSAGES, PADDLE_WELCOME). Free Mobile answers 402 when too many SMS are
 * sent in a short time: the failure is logged, never retried. Keys and phone numbers are never
 * logged.
 */

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

const FREE_MOBILE_URL   = 'https://smsapi.free-mobile.fr/sendmsg';
const SIGNATURE_MAX_AGE = 5 * 60;   // seconds: older Paddle signatures are refused (replays)

// ── Messages ─────────────────────────────────────────────────────────────────

// " NAME" (or nothing when the first name is unknown)
const spaced = (name: string) => (name ? ' ' + name : '');

const MESSAGES: Record<string, (name: string) => string> = {
  challenge: (name) =>
    `Ici Sébastien, bienvenue dans le Challenge${spaced(name)}! Rejoins le groupe privé sur Telegram: https://www.onetake.ai/challenge/telegram`,
  masterclass: () =>
    "Hello ici Sébastien de OneTake!\nRDV jeudi à 20h heure de Paris pour la masterclass. Note-le bien stp !\nQuelle est ton activité stp? Quelle est ta clientèle?",
};

// Paddle purchases (paid and trial), in the buyer's language; English when unknown
const PADDLE_WELCOME: Record<string, (name: string) => string> = {
  fr: (n) => `Bienvenue sur OneTake${spaced(n)}! Mets en ligne ta première vidéo dès aujourd'hui et donne-moi ton feedback :-)`,
  en: (n) => `Welcome to OneTake${spaced(n)}! Upload your first video today and send me your feedback :-)`,
  es: (n) => `¡Te doy la bienvenida a OneTake${n ? ', ' + n : ''}! Sube tu primer vídeo hoy mismo y dame tu opinión :-)`,
  pt: (n) => `Boas-vindas ao OneTake${n ? ', ' + n : ''}! Envie seu primeiro vídeo hoje mesmo e me dê seu feedback :-)`,
  it: (n) => `Ti do il benvenuto su OneTake${n ? ', ' + n : ''}! Carica il tuo primo video oggi stesso e dammi il tuo feedback :-)`,
  de: (n) => `Willkommen bei OneTake${spaced(n)}! Lade noch heute dein erstes Video hoch und gib mir dein Feedback :-)`,
  ja: (n) => `OneTakeへようこそ${n ? '、' + n + 'さん' : ''}！今日さっそく最初の動画をアップロードして、ぜひ感想を聞かせてね :-)`,
  ru: (n) => `Добро пожаловать в OneTake${n ? ', ' + n : ''}! Загрузи своё первое видео уже сегодня и поделись со мной впечатлениями :-)`,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function cleanText(value: unknown, max = 100): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max) : '';
}

// E.164 (+33612345678) → digits for wa.me (33612345678), or '' when malformed
function waDigits(value: unknown): string {
  const phone = typeof value === 'string' ? value.replace(/[\s.()-]/g, '') : '';
  return /^\+[1-9]\d{6,14}$/.test(phone) ? phone.slice(1) : '';
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// The SMS: only the WhatsApp link to the person, with the message already typed
async function sendOwnerSms(digits: string, message: string, label: string): Promise<boolean> {
  const user = process.env.FREE_MOBILE_USER;
  const pass = process.env.FREE_MOBILE_PASS;
  if (!user || !pass) { console.error(`Owner SMS (${label}) not sent: FREE_MOBILE_USER or FREE_MOBILE_PASS missing`); return false; }

  const link = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  const query = new URLSearchParams({ user, pass, msg: link });
  try {
    const res = await fetch(`${FREE_MOBILE_URL}?${query}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) console.error(`Owner SMS (${label}) refused by Free Mobile: ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error(`Owner SMS (${label}) failed:`, e instanceof Error ? e.message : e);
    return false;
  }
}

// ── Paddle ───────────────────────────────────────────────────────────────────

// Paddle-Signature: ts=1671552777;h1=<hex HMAC-SHA256 of "ts:rawBody" with the destination secret>
async function validPaddleSignature(header: string, rawBody: string): Promise<boolean> {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) { console.error('PADDLE_WEBHOOK_SECRET missing'); return false; }

  const parts: Record<string, string[]> = {};
  for (const part of header.split(';')) {
    const [k, v] = part.split('=');
    if (k && v) (parts[k.trim()] ||= []).push(v.trim());
  }
  const ts = (parts.ts || [])[0];
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > SIGNATURE_MAX_AGE) return false;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}:${rawBody}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return (parts.h1 || []).some((h) => timingSafeEqual(h, expected));
}

async function handlePaddle(req: Request): Promise<Response> {
  const rawBody = await req.text();
  if (!(await validPaddleSignature(req.headers.get('Paddle-Signature') || '', rawBody))) {
    console.error('Refused POST /paddle: invalid signature');
    return json({ error: 'INVALID_SIGNATURE' }, 401);
  }

  let event: Record<string, any>;
  try { event = JSON.parse(rawBody); } catch { return json({ ok: true, sent: false }); }

  const data = event.data || {};
  // First purchases only (paid or trial): renewals and plan changes have another origin
  if (event.event_type !== 'transaction.completed' || data.origin !== 'web') return json({ ok: true, sent: false });

  const custom = data.custom_data || {};
  const digits = waDigits(custom.telephone);
  if (!digits) return json({ ok: true, sent: false });

  const lang = cleanText(custom.language, 5).toLowerCase().split('-')[0];
  const message = (PADDLE_WELCOME[lang] || PADDLE_WELCOME.en)(cleanText(custom.first_name));
  const sent = await sendOwnerSms(digits, message, 'paddle');
  return json({ ok: true, sent });
}

// ── Internal calls ───────────────────────────────────────────────────────────

async function handleNotify(req: Request): Promise<Response> {
  const secret = process.env.OWNER_NOTIFY_SECRET;
  const auth = req.headers.get('Authorization') || '';
  if (!secret || !timingSafeEqual(auth, `Bearer ${secret}`)) return json({ error: 'FORBIDDEN' }, 403);

  let fields: Record<string, unknown>;
  try { fields = await req.json(); } catch { return json({ error: 'INVALID_BODY' }, 400); }

  const kind = cleanText(fields.kind, 20);
  const template = MESSAGES[kind];
  if (!template) return json({ error: 'UNKNOWN_KIND' }, 400);

  const digits = waDigits(fields.telephone);
  if (!digits) return json({ sent: false });

  const sent = await sendOwnerSms(digits, template(cleanText(fields.first_name)), kind);
  return json({ sent });
}

// ── Router ───────────────────────────────────────────────────────────────────

BunnySDK.net.http.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  if (path === '/paddle') return handlePaddle(req);
  if (path === '/notify') return handleNotify(req);
  return json({ error: 'NOT_FOUND' }, 404);
});
