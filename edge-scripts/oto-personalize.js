/**
 * OTO Personalisation Proxy — BunnyCDN Edge Script
 *
 * DEPLOYMENT:
 *   1. Go to BunnyCDN Dashboard → Edge Scripts → Create Edge Script
 *   2. Paste this entire file into the editor
 *   3. Add environment variable: ANTHROPIC_API_KEY = <your Anthropic API key>
 *   4. Set the script URL path to: /oto-personalize
 *   5. Update ANTHROPIC_PROXY_URL in oto/index.html to point to this script
 *
 * WHAT IT DOES:
 *   Receives survey data POSTed from the OTO page, asks Claude Haiku to score
 *   the quality of the answers and — if they're meaningful — rewrite four copy
 *   blocks personalised to that user's niche and goals.
 *   Always returns JSON; falls back to { isPersonalized: false } on any error.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// claude-haiku-4-5 is used (not Sonnet) because we need to respond within the
// 2-second abort timeout set on the client side.
const ANTHROPIC_MODEL   = 'claude-haiku-4-5-20251001';

// Keep max_tokens tight — we only need a small JSON object back.
const MAX_TOKENS = 600;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age':       '86400',
};

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// Includes full OneTake feature set so Claude never invents capabilities,
// plus the current default copy for each field so Claude knows what to improve.
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a direct-response copywriter for OneTake AI, an AI video editing SaaS platform.

## About OneTake AI

OneTake AI turns raw videos into professional, polished presentations in one click.
It is designed for entrepreneurs, trainers, coaches, and content creators who want to publish
professional video content without spending hours editing.

### Plan features

**Occasional ($20/mo):**
- Edit 1 hour of content per month, videos up to 60 minutes
- 1 viral Short/Reel generated per video
- AI Instant Editing: removes mistakes, cleans audio, adds subtitles & transitions
- OneTake learns from your content to help write scripts, find ideas, and more
- Host/embed videos with OneTake Player (unlimited views), no watermark
- All video styles & customisation for YouTube, TikTok, Instagram, and social media
- Translate subtitles into a new language

**Pro ($39/mo per team member):**
- Everything in Occasional, plus:
- Edit 3 hours of content per month, videos up to 120 minutes
- Unlimited viral Shorts/Reels per video
- Turn long videos into viral Shorts for IG Reels, TikTok, YouTube Shorts
- Whitelabel hosting: custom domain and branding with OneTake Player (unlimited views)
- Teleprompter with gaze correction: AI makes you look directly into the camera
- Background removal & replacement (green screen or any background)

**Premium Studio ($149/mo per team member — discounted to $99/mo on this offer):**
- Everything in Pro, plus:
- Edit 10 hours of content per month, no video duration limit
- Unlimited viral Shorts/Reels per video
- Add additional team members
- 30 minutes of Premium AI editing per month
- All Premium features use hyper-realistic models: gaze correction, background removal, translation
- Video translation with voice cloning — hyper-realistic lip sync in 20+ languages

## Your task

You will receive survey answers a user provided when signing up for OneTake AI.

### Step 1: Score the quality of the information on a scale of 1–5

  1 = random/nonsense/test data (e.g. "asdf", "test", single characters, lorem ipsum)
  2 = very vague — no recognisable business or use case
  3 = some useful info — has a recognisable business type or niche
  4 = good — specific niche, target audience, or goal stated
  5 = excellent — specific niche, avatar, big promise, and main problem all provided

### Step 2: Output

Respond ONLY with valid JSON (no markdown, no prose, no code fences).

The FIRST key must always be "qualityScore" (integer 1–5).

If qualityScore < 3, respond with exactly:
{"qualityScore":1,"isPersonalized":false}
(use the actual score, not always 1)

If qualityScore >= 3, include personalised rewrites of the four fields shown below.
The CURRENT DEFAULT for each field is shown — you are replacing these with something
more personal and specific to this user's niche, goals, and problems.

{
  "qualityScore": <integer 3–5>,
  "isPersonalized": true,
  "headline": "CURRENT DEFAULT: Don't Start OneTake at Half Power — Upgrade to Premium Studio Now and Claim 4 Exclusive Bonuses (Today Only) | YOUR REWRITE: max 18 words, direct-response headline addressing their specific niche or goal; keep the urgency and benefit-driven tone",
  "introParagraph": "CURRENT DEFAULT: Most creators leave 90% of OneTake's power unused — not because they don't need it, but because they never got the chance to start with it. Today, for this page only, you can unlock every Premium Studio feature at 33%+ off the regular price, plus four exclusive bonuses worth more than the subscription itself. | YOUR REWRITE: 2–3 sentences that connect this specific user's stated problem to what Premium Studio unlocks for them; make it feel like it was written for them personally",
  "benefit1": "CURRENT DEFAULT: Priority support + live sessions | YOUR REWRITE: max 12 words — same feature (priority email/chat/Zoom support + twice-monthly live Q&A sessions with Sébastien), reframed to resonate with their use case",
  "benefit2": "CURRENT DEFAULT: Whitelabel hosting (custom domain) | YOUR REWRITE: max 12 words — same feature (host videos on their own domain, no OneTake branding), reframed to resonate with their use case"
}

Rules:
- Output ONLY the JSON object — no explanation, no markdown, no backticks
- Never invent OneTake features or capabilities beyond what is listed above
- Write in English regardless of the input language
- Address the user directly (use "you" / "your")
- Tone: warm, direct, enthusiastic — like a mentor who genuinely wants this person to win
- The headline and introParagraph must feel written specifically for this person, not generic
`;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the user-turn message Claude will see.
 */
function buildUserMessage(body) {
  const lines = [
    'Survey answers from a new OneTake AI user:',
    '',
    `Plan signed up for: ${body.plan             || 'not specified'}`,
    `Use cases selected: ${body.useCases         || 'not specified'}`,
    `Estimated video volume per month: ${body.estimatedVolume || 'not specified'}`,
    `Their website: ${body.website               || 'not provided'}`,
    `About themselves / their business: ${body.nameAndDescription || 'not provided'}`,
    `Their ideal target audience / customer: ${body.avatar    || 'not provided'}`,
    `Their big promise / transformation they deliver: ${body.bigPromise || 'not provided'}`,
    `Main problem or bottleneck they want to solve: ${body.mainProblem  || 'not provided'}`,
    '',
    'Please score these answers and, if the quality is sufficient, personalise the OneTake AI OTO page copy for this user.',
  ];
  return lines.join('\n');
}

/**
 * Always-safe fallback response — never throws.
 */
function fallback(reason) {
  if (reason) console.error('[oto-personalize] fallback reason:', reason);
  return new Response(
    JSON.stringify({ qualityScore: 0, isPersonalized: false }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  );
}

/**
 * Retrieve the Anthropic API key from the environment.
 * BunnyCDN exposes env variables on `context.env`; adjust if your setup differs.
 */
function getApiKey(context) {
  // BunnyCDN Edge Scripts (primary pattern)
  if (context && context.env && context.env.ANTHROPIC_API_KEY) {
    return context.env.ANTHROPIC_API_KEY;
  }
  // Fallback — some BunnyCDN versions expose env via process.env or a global
  if (typeof process !== 'undefined' && process.env && process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// BunnyCDN Edge Scripts use `async function onRequest(context)` as the entry.
// context.request  — the incoming Request object
// context.env      — environment variables set in the BunnyCDN dashboard
// Return a Response object.
// ─────────────────────────────────────────────────────────────────────────────

async function onRequest(context) {
  const request = context.request;
  const method  = request.method.toUpperCase();

  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ── Only accept POST ────────────────────────────────────────────────────────
  if (method !== 'POST') {
    return fallback('method not allowed: ' + method);
  }

  // ── Parse request body ──────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return fallback('invalid JSON body: ' + err.message);
  }

  // ── Retrieve API key ────────────────────────────────────────────────────────
  const apiKey = getApiKey(context);
  if (!apiKey) {
    return fallback('ANTHROPIC_API_KEY environment variable not set');
  }

  // ── Call Anthropic ──────────────────────────────────────────────────────────
  let anthropicResponse;
  try {
    anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: buildUserMessage(body) }],
      }),
    });
  } catch (err) {
    return fallback('fetch to Anthropic failed: ' + err.message);
  }

  if (!anthropicResponse.ok) {
    const errText = await anthropicResponse.text().catch(() => '');
    return fallback(`Anthropic API ${anthropicResponse.status}: ${errText}`);
  }

  // ── Parse Anthropic response ────────────────────────────────────────────────
  let anthropicData;
  try {
    anthropicData = await anthropicResponse.json();
  } catch (err) {
    return fallback('could not parse Anthropic response JSON: ' + err.message);
  }

  const rawText = anthropicData?.content?.[0]?.text || '';

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    return fallback('Claude returned non-JSON: ' + rawText.slice(0, 200));
  }

  // Sanity-check: ensure required fields are present when isPersonalized is true
  if (parsed.isPersonalized) {
    if (!parsed.headline || !parsed.introParagraph) {
      parsed.isPersonalized = false;
    }
  }

  return new Response(JSON.stringify(parsed), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
