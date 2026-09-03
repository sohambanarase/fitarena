// api/_ai.js — one entry point for every AI call in the app.
//
// WHY THIS EXISTS
// Gemini's free quota is per-project, not per-model. So when the key gets a 429, every
// Gemini model is rate-limited at the same moment, and the model-hopping already built
// into _gemini.js can't rescue it. The only real fix is a second provider on a separate
// key. That's all this file does: try providers in order until one answers.
//
// THE CHAIN
//   text  : Gemini -> Groq -> OpenRouter
//   images: Gemini -> OpenRouter          (Groq is skipped, see below)
//
// Groq retired both of its vision models — Llama 4 Maverick in March 2026 and Llama 4
// Scout in July 2026 — and the replacements are text-only. So Groq never sees an image
// request unless GROQ_VISION_MODEL is set, which is the escape hatch for the day Groq
// ships a new multimodal model: set that env var and it joins the image chain too.
//
// OpenRouter sits last on purpose. Its free tier is 50 requests/day (1,000 after a
// one-time $10 credit purchase), which is too thin to lead with but perfect as a backstop.
// The model used is `openrouter/free`, a router that picks a free model and filters for
// the capabilities the request needs — image understanding included.
//
// SETUP: add either or both to Vercel env. Both are free, no card needed.
//   GROQ_API_KEY        console.groq.com/keys
//   OPENROUTER_API_KEY  openrouter.ai/keys
// Optional overrides: GROQ_MODEL, GROQ_VISION_MODEL, OPENROUTER_MODEL, GEMINI_MODEL.
// With none of them set, behaviour is identical to before: Gemini only.

import { generate as geminiGenerate } from "./_gemini.js";
import { callOpenAICompat, hasImage } from "./_openai_compat.js";

const COOLDOWN_SOFT = 5 * 60 * 1000;       // 429 / 5xx — busy, come back soon
const COOLDOWN_HARD = 6 * 60 * 60 * 1000;  // 401 / 403 — bad or missing key, stop asking

const penalty = new Map();                 // "provider:model" -> retry-after timestamp
const benched = (id) => penalty.has(id) && penalty.get(id) > Date.now();

// Groq model preference. gpt-oss-120b is the strongest free option and handles the strict
// "return only JSON" prompts well; the smaller ones are there for when it's rate-limited,
// and llama-3.1-8b-instant has by far the highest daily ceiling (~14,400 vs ~1,000).
const GROQ_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "llama-3.1-8b-instant"];

function groqModels(needsVision) {
  if (needsVision) {
    const vm = process.env.GROQ_VISION_MODEL;
    return vm ? [vm] : [];                 // no vision model configured -> skip Groq entirely
  }
  return process.env.GROQ_MODEL ? [process.env.GROQ_MODEL] : GROQ_MODELS;
}

function openRouterModels() {
  return [process.env.OPENROUTER_MODEL || "openrouter/free"];
}

export function configured() {
  return {
    gemini: !!process.env.GEMINI_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
  };
}

export function anyConfigured() {
  const c = configured();
  return c.gemini || c.groq || c.openrouter;
}

// Records the outcome so a dead key isn't retried on every single request.
function bench(id, status) {
  if (status === 401 || status === 403 || status === 404) penalty.set(id, Date.now() + COOLDOWN_HARD);
  else penalty.set(id, Date.now() + COOLDOWN_SOFT);
}

// Main entry point. Signature and return shape match the old _gemini.js `generate`
// exactly, so callers didn't have to change.
export async function generate(_legacyKey, { parts, temperature = 0.3, maxOutputTokens = 200 }) {
  const needsVision = hasImage(parts);
  let rateLimited = null;   // preferred failure: lets the UI say "busy" not "broken"
  let lastFail = null;

  // ---- 1. Gemini ----
  const geminiKey = process.env.GEMINI_API_KEY || _legacyKey;
  if (geminiKey && !benched("gemini")) {
    try {
      const r = await geminiGenerate(geminiKey, { parts, temperature, maxOutputTokens });
      if (r && r.ok) { r.providerUsed = "gemini"; return r; }
      if (r) {
        bench("gemini", r.status);
        if (r.status === 429) rateLimited = r; else lastFail = lastFail || r;
      }
    } catch { bench("gemini", 503); }
  }

  // ---- 2 & 3. the OpenAI-compatible providers ----
  const chain = [
    {
      name: "groq",
      key: process.env.GROQ_API_KEY,
      url: "https://api.groq.com/openai/v1/chat/completions",
      models: groqModels(needsVision),
      headers: {},
    },
    {
      name: "openrouter",
      key: process.env.OPENROUTER_API_KEY,
      url: "https://openrouter.ai/api/v1/chat/completions",
      models: openRouterModels(),
      // OpenRouter asks apps to identify themselves; it also improves free-tier standing.
      headers: { "HTTP-Referer": "https://fitarena-crew.vercel.app", "X-Title": "FitArena" },
    },
  ];

  for (const p of chain) {
    if (!p.key || !p.models.length) continue;
    for (const model of p.models) {
      const id = p.name + ":" + model;
      if (benched(id)) continue;

      const r = await callOpenAICompat({
        url: p.url, key: p.key, model, parts, temperature, maxOutputTokens, headers: p.headers,
      });

      if (r.ok) { r.providerUsed = p.name; r.modelUsed = model; return r; }

      bench(id, r.status);
      r.providerUsed = p.name;
      r.modelUsed = model;
      if (r.status === 429) rateLimited = rateLimited || r; else lastFail = lastFail || r;
    }
  }

  // Everything failed. Prefer surfacing a 429 so the app shows "AI is busy, try shortly"
  // rather than a hard error — busy is usually the truth and always the kinder message.
  return rateLimited || lastFail || {
    ok: false,
    status: 503,
    json: async () => ({}),
    text: async () => "No AI provider available. Set GEMINI_API_KEY, GROQ_API_KEY or OPENROUTER_API_KEY.",
  };
}

// For tests / diagnostics.
export function _reset() { penalty.clear(); }
export function _state() {
  const now = Date.now();
  return {
    configured: configured(),
    benched: [...penalty.entries()]
      .filter(([, t]) => t > now)
      .map(([id, t]) => ({ id, retryInSeconds: Math.round((t - now) / 1000) })),
  };
}
