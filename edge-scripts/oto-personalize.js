/**
 * OTO Personalisation Proxy — BunnyCDN Edge Script
 *
 * DEPLOYMENT:
 *   1. Go to BunnyCDN Dashboard → Edge Scripts → Create Edge Script
 *   2. Paste this entire file into the editor
 *   3. Add environment variable: ANTHROPIC_API_KEY = <your Anthropic API key>
 *   4. Deploy and note the script URL
 *   5. Update ANTHROPIC_PROXY_URL in oto/index.html to point to this script
 *
 * WHAT IT DOES:
 *   Receives survey data POSTed from the OTO page, asks Claude Haiku to score
 *   the quality of the answers and — if they're meaningful — rewrite four copy
 *   blocks personalised to that user's niche and goals.
 *   Uses tool calling to guarantee structured JSON output with no parsing needed.
 *   Always returns JSON; falls back to { isPersonalized: false } on any error.
 */

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL   = 'claude-haiku-4-5-20251001';
const MAX_TOKENS        = 350; // tool use output is compact — no markdown overhead

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age':       '86400',
};

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — kept short to reduce input tokens and improve latency
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a direct-response copywriter for OneTake AI — an AI video editor that turns raw footage into polished content in one click. Designed for entrepreneurs, trainers, and coaches.

Plans: Occasional ($20/mo, 1h editing/mo), Pro ($39/mo, 3h + whitelabel hosting + gaze correction + background removal), Premium Studio ($99/mo OTO price, 10h + unlimited duration + team members + hyper-realistic AI + voice cloning in 20+ languages).

Score the survey answers 1–5, then if quality ≥ 3, write personalised copy. Tone: warm, direct, mentor-like. Always English. Address the user as "you/your". Never invent features beyond those listed above.`;

// ─────────────────────────────────────────────────────────────────────────────
// TOOL DEFINITION
// Forces Claude to return structured data — no JSON parsing of free text needed.
// ─────────────────────────────────────────────────────────────────────────────

const OTO_TOOL = {
  name: 'personalize_oto',
  description: 'Score the quality of the survey answers and, if sufficient, return personalised copy for the OTO page.',
  input_schema: {
    type: 'object',
    properties: {
      qualityScore: {
        type: 'integer',
        description: '1=nonsense/test data, 2=very vague, 3=recognisable niche, 4=specific niche+audience, 5=niche+avatar+promise+problem all present'
      },
      isPersonalized: {
        type: 'boolean',
        description: 'true only when qualityScore >= 3 and personalised copy has been written'
      },
      headline: {
        type: 'string',
        description: 'Max 18 words. Direct-response headline for this user\'s specific niche/goal. Default to improve: "Don\'t Start OneTake at Half Power — Upgrade to Premium Studio Now and Claim 4 Exclusive Bonuses (Today Only)"'
      },
      introParagraph: {
        type: 'string',
        description: '2–3 sentences connecting this user\'s stated problem to what Premium Studio unlocks. Default to improve: "Most creators leave 90% of OneTake\'s power unused — not because they don\'t need it, but because they never got the chance to start with it. Today, for this page only, you can unlock every Premium Studio feature at 33%+ off the regular price, plus four exclusive bonuses worth more than the subscription itself."'
      },
      benefit1: {
        type: 'string',
        description: 'Max 12 words. Reframe "Priority support + live sessions" (priority email/chat support + twice-monthly live Q&A with Sébastien) to resonate with this user\'s use case.'
      },
      benefit2: {
        type: 'string',
        description: 'Max 12 words. Reframe "Whitelabel hosting (custom domain)" (host videos on own domain, no OneTake branding) to resonate with this user\'s use case.'
      }
    },
    required: ['qualityScore', 'isPersonalized']
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildUserMessage(body) {
  const lines = [
    'Survey answers from a new OneTake AI user:',
    '',
    `Plan signed up for: ${body.plan               || 'not specified'}`,
    `Use cases: ${body.useCases                    || 'not specified'}`,
    `Videos per month: ${body.estimatedVolume      || 'not specified'}`,
    `Website: ${body.website                       || 'not provided'}`,
    `About their business: ${body.nameAndDescription || 'not provided'}`,
    `Target audience: ${body.avatar                || 'not provided'}`,
    `Big promise / transformation: ${body.bigPromise || 'not provided'}`,
    `Main problem to solve: ${body.mainProblem     || 'not provided'}`,
  ];
  return lines.join('\n');
}

function fallback(reason) {
  if (reason) console.error('[oto-personalize] fallback reason:', reason);
  return new Response(
    JSON.stringify({ qualityScore: 0, isPersonalized: false, _debug: reason || 'unknown' }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

BunnySDK.net.http.serve(async (request) => {
  const method = request.method.toUpperCase();

  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fallback('ANTHROPIC_API_KEY environment variable not set');
  }

  // ── Call Anthropic with tool use ────────────────────────────────────────────
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
        model:       ANTHROPIC_MODEL,
        max_tokens:  MAX_TOKENS,
        system:      SYSTEM_PROMPT,
        tools:       [OTO_TOOL],
        tool_choice: { type: 'tool', name: 'personalize_oto' },
        messages:    [{ role: 'user', content: buildUserMessage(body) }],
      }),
    });
  } catch (err) {
    return fallback('fetch to Anthropic failed: ' + err.message);
  }

  if (!anthropicResponse.ok) {
    const errText = await anthropicResponse.text().catch(() => '');
    return fallback(`Anthropic API ${anthropicResponse.status}: ${errText}`);
  }

  // ── Extract tool call input — already a parsed object, no JSON.parse needed ─
  let anthropicData;
  try {
    anthropicData = await anthropicResponse.json();
  } catch (err) {
    return fallback('could not parse Anthropic response: ' + err.message);
  }

  const toolInput = anthropicData?.content?.[0]?.input;
  if (!toolInput || typeof toolInput !== 'object') {
    return fallback('unexpected Anthropic response shape: ' + JSON.stringify(anthropicData).slice(0, 200));
  }

  // Sanity-check: if isPersonalized but missing required copy fields, downgrade
  if (toolInput.isPersonalized && (!toolInput.headline || !toolInput.introParagraph)) {
    toolInput.isPersonalized = false;
  }

  return new Response(JSON.stringify(toolInput), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
