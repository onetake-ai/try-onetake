/**
 * Owner SMS notifications: BunnyCDN Edge Script
 *
 * Sends Sébastien two SMS through the Free Mobile API (it can only text the account owner's own
 * phone) when someone buys or registers. No SMS when the person gave no WhatsApp number.
 *
 *   1. Who and why, then a bare WhatsApp link (wa.me) to the person, to send a voice note first:
 *        Marie (marie@exemple.fr) : achat Challenge
 *        https://wa.me/33612345678
 *   2. The WhatsApp link with Sébastien's message already typed: one tap, then Send.
 *
 * ENDPOINTS (POST):
 *
 *   /paddle   Paddle notification destination (event transaction.completed). Checks the
 *             Paddle-Signature header, then texts for first purchases only (origin "web": paid
 *             and trial; renewals are ignored), in the buyer's language (custom_data.language).
 *             Always answers 200 once the signature is valid, so Paddle doesn't retry.
 *
 *   /notify   Called by our other edge scripts, with "Authorization: Bearer OWNER_NOTIFY_SECRET".
 *             JSON body { kind, first_name, email, telephone, attends_masterclass_on }, kind one of:
 *               challenge    Challenge purchase (edge-scripts/airwallex-checkout.ts, /purchase)
 *               masterclass  French masterclass registration (edge-scripts/userlist-proxy.ts).
 *                            attends_masterclass_on (ISO 8601, the live session) makes the message say
 *                            "demain, ce jeudi 19 novembre à 20h" the day before and "ce soir (jeudi 19
 *                            novembre) à 20h" the same day, and adds the local time of leads in the
 *                            French overseas territories and Canada ("20h heure de Paris (15h en
 *                            Guadeloupe)"), found from their phone number (LOCAL_ZONES, CANADA_ZONES).
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
const SMS_GAP_MS        = 1500;     // pause between the two SMS, so they arrive in order

// ── Messages ─────────────────────────────────────────────────────────────────

// " NAME" (or nothing when the first name is unknown)
const spaced = (name: string) => (name ? ' ' + name : '');

// Reason shown in the first SMS, after the name and email
const REASONS: Record<string, string> = {
  challenge:   'achat Challenge',
  masterclass: 'inscription masterclass',
  trial:       'essai gratuit OneTake',
  purchase:    'achat OneTake',
};

// Extra data of the message: the live session (ISO 8601) and the lead's phone number (digits)
type Context = { sessionAt: string; digits: string };

const MESSAGES: Record<string, (name: string, ctx: Context) => string> = {
  challenge: (name) =>
    `Ici Sébastien, bienvenue dans le Challenge${spaced(name)}! Rejoins le groupe privé sur Telegram: https://www.onetake.ai/challenge/telegram`,
  masterclass: (name, ctx) =>
    `Hello${spaced(name)}, ici Sébastien de OneTake!\nRDV ${sessionWhen(ctx.sessionAt)} heure de Paris${localTime(ctx.sessionAt, ctx.digits)} pour la masterclass. Note-le bien stp !\nQuelle est ton activité stp? Quelle est ta clientèle?`,
};

// ── Session date and local time ──────────────────────────────────────────────

const PARIS = 'Europe/Paris';

// Time zones of leads outside mainland France, from the start of their phone number (E.164 digits
// without the +). Longest prefix first where two share a country code.
const LOCAL_ZONES: { prefix: string; zone: string; place: string }[] = [
  { prefix: '262639', zone: 'Indian/Mayotte',        place: 'à Mayotte' },   // Mayotte shares +262 with La Réunion
  { prefix: '262269', zone: 'Indian/Mayotte',        place: 'à Mayotte' },
  { prefix: '262',    zone: 'Indian/Reunion',        place: 'à La Réunion' },
  { prefix: '590',    zone: 'America/Guadeloupe',    place: 'en Guadeloupe' },   // also Saint-Martin, Saint-Barthélemy
  { prefix: '596',    zone: 'America/Martinique',    place: 'en Martinique' },
  { prefix: '594',    zone: 'America/Cayenne',       place: 'en Guyane' },
  { prefix: '689',    zone: 'Pacific/Tahiti',        place: 'en Polynésie' },
  { prefix: '687',    zone: 'Pacific/Noumea',        place: 'en Nouvelle-Calédonie' },
  { prefix: '508',    zone: 'America/Miquelon',      place: 'à Saint-Pierre-et-Miquelon' },
];

// Canada shares +1 with the United States: the area code (3 digits after the 1) tells them apart.
// One time zone per province (the main one when a province has several).
const CANADA_ZONES: { zone: string; place: string; areas: string }[] = [
  { zone: 'America/Toronto',    place: 'au Québec',                areas: '418 438 450 514 579 581 819 873' },
  { zone: 'America/Toronto',    place: 'en Ontario',               areas: '226 249 289 343 365 416 437 519 548 613 647 705 742 807 905' },
  { zone: 'America/Vancouver',  place: 'en Colombie-Britannique',  areas: '236 250 604 672 778' },
  { zone: 'America/Edmonton',   place: 'en Alberta',               areas: '368 403 587 780 825' },
  { zone: 'America/Regina',     place: 'en Saskatchewan',          areas: '306 639 474' },
  { zone: 'America/Winnipeg',   place: 'au Manitoba',              areas: '204 431 584' },
  { zone: 'America/Moncton',    place: 'au Nouveau-Brunswick',     areas: '506 428' },
  { zone: 'America/Halifax',    place: 'dans les Maritimes',       areas: '902 782' },   // Nouvelle-Écosse and Île-du-Prince-Édouard
  { zone: 'America/St_Johns',   place: 'à Terre-Neuve',            areas: '709 879' },
];

function zoneOf(digits: string): { zone: string; place: string } | null {
  if (digits.length === 11 && digits[0] === '1') {
    const area = digits.slice(1, 4);
    return CANADA_ZONES.find((c) => c.areas.split(' ').includes(area)) || null;
  }
  return LOCAL_ZONES.find((z) => digits.startsWith(z.prefix)) || null;
}

// "20h", "15h30" (minutes only when not on the hour)
function clock(date: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: zone, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '0';
  return `${Number(get('hour'))}h${get('minute') === '00' ? '' : get('minute')}`;
}

const dayOf = (date: Date, zone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);   // 2026-11-19

const weekdayOf = (date: Date, zone: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: zone, weekday: 'long' }).format(date);

// "jeudi à 20h" (default), "demain, ce jeudi 19 novembre à 20h" (the day before, Paris date) or
// "ce soir (jeudi 19 novembre) à 20h" (the day of). Without a valid session date: "jeudi à 20h".
function sessionWhen(sessionAt: string, now: Date = new Date()): string {
  const session = new Date(sessionAt);
  if (!sessionAt || isNaN(session.getTime())) return 'jeudi à 20h';

  const weekday = weekdayOf(session, PARIS);
  const date = new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS, day: 'numeric', month: 'long' }).format(session);
  const time = clock(session, PARIS);
  const days = Math.round((Date.parse(dayOf(session, PARIS)) - Date.parse(dayOf(now, PARIS))) / 86400000);
  if (days === 1) return `demain, ce ${weekday} ${date} à ${time}`;
  if (days === 0) return `ce soir (${weekday} ${date}) à ${time}`;
  return `${weekday} à ${time}`;
}

// " (15h en Guadeloupe)" for a lead in one of the zones above, else "". When the local date is not
// the Paris date, the day is added: " (6h le vendredi en Nouvelle-Calédonie)".
function localTime(sessionAt: string, digits: string): string {
  const session = new Date(sessionAt);
  const where = zoneOf(digits);
  if (!where || !sessionAt || isNaN(session.getTime())) return '';
  const otherDay = dayOf(session, where.zone) !== dayOf(session, PARIS) ? ` le ${weekdayOf(session, where.zone)}` : '';
  return ` (${clock(session, where.zone)}${otherDay} ${where.place})`;
}

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

// French overseas numbers written with +33 (0690..., 0696..., 0692...): +33690123456 -> +590690123456.
// Same table as OVERSEAS in /assets/phone-field/phone-field.js: keep them in sync.
const OVERSEAS_PHONES: [RegExp, string][] = [
  [/^69[01]\d{6}$/, '590'], [/^590\d{6}$/, '590'],   // Guadeloupe
  [/^69[67]\d{6}$/, '596'], [/^596\d{6}$/, '596'],   // Martinique
  [/^69[23]\d{6}$/, '262'], [/^262\d{6}$/, '262'],   // La Réunion
  [/^694\d{6}$/,    '594'], [/^594\d{6}$/, '594'],   // Guyane
  [/^639\d{6}$/,    '262'], [/^269\d{6}$/, '262'],   // Mayotte
];
function fixOverseasPhone(e164: string): string {
  const m = /^\+33(\d{9})$/.exec(e164);
  const rule = m && OVERSEAS_PHONES.find(([re]) => re.test(m[1]));
  return m && rule ? `+${rule[1]}${m[1]}` : e164;
}

// E.164 (+33612345678) → digits for wa.me (33612345678), or '' when malformed. A French overseas number
// saved with +33 gets its real country code (+33690123456 → 590690123456).
function waDigits(value: unknown): string {
  const phone = typeof value === 'string' ? value.replace(/[\s.()-]/g, '') : '';
  return /^\+[1-9]\d{6,14}$/.test(phone) ? fixOverseasPhone(phone).slice(1) : '';
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// "Marie (marie@exemple.fr) : achat Challenge"
function header(name: string, email: string, reason: string): string {
  return `${name || 'Sans prénom'}${email ? ` (${email})` : ''} : ${reason}`;
}

async function sendFreeMobile(msg: string, label: string): Promise<boolean> {
  const user = process.env.FREE_MOBILE_USER;
  const pass = process.env.FREE_MOBILE_PASS;
  if (!user || !pass) { console.error(`Owner SMS (${label}) not sent: FREE_MOBILE_USER or FREE_MOBILE_PASS missing`); return false; }

  const query = new URLSearchParams({ user, pass, msg });
  try {
    const res = await fetch(`${FREE_MOBILE_URL}?${query}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) console.error(`Owner SMS (${label}) refused by Free Mobile: ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error(`Owner SMS (${label}) failed:`, e instanceof Error ? e.message : e);
    return false;
  }
}

// The two SMS: who and why with a bare WhatsApp link, then the link with the message typed.
// The second is sent even when the first fails. true when both were sent.
async function sendOwnerSms(digits: string, head: string, message: string, label: string): Promise<boolean> {
  const first = await sendFreeMobile(`${head}\nhttps://wa.me/${digits}`, `${label} 1/2`);
  await new Promise((resolve) => setTimeout(resolve, SMS_GAP_MS));
  const second = await sendFreeMobile(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, `${label} 2/2`);
  return first && second;
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
  const name = cleanText(custom.first_name);
  const message = (PADDLE_WELCOME[lang] || PADDLE_WELCOME.en)(name);
  // Free trial: nothing charged today (has_trial is set by checkout-core.js)
  const total = data.details?.totals?.total;
  const trial = custom.has_trial === 'true' || total === '0';
  const head = header(name, cleanText(custom.email, 254).toLowerCase(), REASONS[trial ? 'trial' : 'purchase']);
  const sent = await sendOwnerSms(digits, head, message, 'paddle');
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

  const name = cleanText(fields.first_name);
  const head = header(name, cleanText(fields.email, 254).toLowerCase(), REASONS[kind]);
  const sessionAt = cleanText(fields.attends_masterclass_on, 40);
  const sent = await sendOwnerSms(digits, head, template(name, { sessionAt, digits }), kind);
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
