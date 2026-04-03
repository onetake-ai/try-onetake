/**
 * OTO Personalisation Proxy — BunnyCDN Edge Script
 *
 * DEPLOYMENT:
 *   1. Go to BunnyCDN Dashboard → Edge Scripts → Create Edge Script
 *   2. Paste this entire file into the editor
 *   3. Add environment variables:
 *        ANTHROPIC_API_KEY = <your Anthropic API key>
 *        OPENAI_API_KEY    = <your OpenAI API key>
 *   4. Deploy and note the script URL
 *   5. Update ANTHROPIC_PROXY_URL in oto/index.html to point to this script
 *
 * WHAT IT DOES:
 *   Fires Anthropic (claude-haiku) and OpenAI (gpt-4.1-nano) in parallel,
 *   returns whichever answers first, logs the winner to console.
 *   Uses tool calling on both APIs to guarantee structured JSON output.
 *   Always returns JSON; falls back to { isPersonalized: false } on any error.
 */

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_API_URL    = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_MODEL   = 'claude-haiku-4-5-20251001';
const OPENAI_MODEL      = 'gpt-4.1-nano';
const MAX_TOKENS        = 350;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age':       '86400',
};

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — kept short to reduce input tokens and latency
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a direct-response copywriter for OneTake AI — an AI video editor that turns raw footage into polished content in one click. Designed for entrepreneurs, trainers, and coaches.

Plans: Occasional ($20/mo, 1h editing/mo), Pro ($39/mo, 3h + whitelabel hosting + gaze correction + background removal), Premium Studio ($99/mo OTO price, 10h + unlimited duration + team members + hyper-realistic AI + voice cloning in 20+ languages).

Score the survey answers 1–5, then if quality ≥ 3, write personalised copy. Tone: warm, direct, mentor-like. Always English. Address the user as "you/your". Never invent features beyond those listed above.`;

// ─────────────────────────────────────────────────────────────────────────────
// TOOL DEFINITION (shared schema, used by both APIs)
// ─────────────────────────────────────────────────────────────────────────────

const OTO_TOOL_SCHEMA = {
  name: 'personalize_oto',
  description: 'Score the quality of the survey answers and, if sufficient, return personalised copy for the OTO page.',
  parameters: {
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

function sanitize(result) {
  // Downgrade isPersonalized if required copy fields are missing
  if (result.isPersonalized && (!result.headline || !result.introParagraph)) {
    result.isPersonalized = false;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// API CALLERS
// Each returns a parsed result object or throws on any failure.
// ─────────────────────────────────────────────────────────────────────────────

async function callAnthropic(apiKey, userMessage) {
  const response = await fetch(ANTHROPIC_API_URL, {
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
      tools:       [{ name: OTO_TOOL_SCHEMA.name, description: OTO_TOOL_SCHEMA.description, input_schema: OTO_TOOL_SCHEMA.parameters }],
      tool_choice: { type: 'tool', name: OTO_TOOL_SCHEMA.name },
      messages:    [{ role: 'user', content: userMessage }],
    }),
  });
  if (!response.ok) throw new Error('Anthropic HTTP ' + response.status);
  const data = await response.json();
  const input = data?.content?.[0]?.input;
  if (!input || typeof input !== 'object') throw new Error('unexpected Anthropic response shape');
  return sanitize(input);
}

async function callOpenAI(apiKey, userMessage) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model:       OPENAI_MODEL,
      max_tokens:  MAX_TOKENS,
      tools:       [{ type: 'function', function: OTO_TOOL_SCHEMA }],
      tool_choice: { type: 'function', function: { name: OTO_TOOL_SCHEMA.name } },
      messages:    [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
    }),
  });
  if (!response.ok) throw new Error('OpenAI HTTP ' + response.status);
  const data = await response.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error('unexpected OpenAI response shape');
  return sanitize(JSON.parse(args));
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

BunnySDK.net.http.serve(async (request) => {
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (method !== 'POST') {
    return fallback('method not allowed: ' + method);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return fallback('invalid JSON body: ' + err.message);
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey    = process.env.OPENAI_API_KEY;

  const userMessage = buildUserMessage(body);

  const promises = [];
  if (anthropicKey) {
    promises.push(
      callAnthropic(anthropicKey, userMessage)
        .then(r => { console.log('[oto-personalize] winner: anthropic (score ' + r.qualityScore + ')'); return r; })
    );
  }
  if (openaiKey) {
    promises.push(
      callOpenAI(openaiKey, userMessage)
        .then(r => { console.log('[oto-personalize] winner: openai (score ' + r.qualityScore + ')'); return r; })
    );
  }

  if (!promises.length) {
    return fallback('no API keys configured');
  }

  let result;
  try {
    result = await Promise.any(promises);
  } catch (err) {
    // AggregateError — both APIs failed
    return fallback('all API calls failed');
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
