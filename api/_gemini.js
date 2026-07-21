// api/_gemini.js — shared Gemini plumbing.
// Files starting with "_" are not routes; this is imported by coach.js / nutrition.js.
//
// Model IDs come and go: Google retires them, closes old ones to new keys, and new ones
// sometimes reject options older ones accepted. So instead of trusting one name:
//   1. ask the key which models it can use and rank them (newest Flash first),
//   2. try them in order until one actually answers, and remember the winner,
//   3. put failing models in a penalty box (short for rate limits, long for hard errors),
//   4. drop thinkingConfig for models that reject it, with extra token headroom.
// A known-good older model is always last in the chain, so there is a floor.

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const LIST_URL = BASE + "/models?pageSize=200";
const GEN_URL = (m) => BASE + "/models/" + m + ":generateContent";

const LIST_TTL = 6 * 60 * 60 * 1000;   // re-discover twice a day on a warm instance
const COOLDOWN_SOFT = 10 * 60 * 1000;  // 429 / 5xx — probably temporary
const COOLDOWN_HARD = 24 * 60 * 60 * 1000; // 400 / 403 / 404 — this key can't use it
const MAX_TRIES = 4;

// Always available as a floor, in preference order.
const FLOOR = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];

let listCache = { ids: null, at: 0 };
let winner = null;                     // last model that actually answered
const penalty = new Map();             // model -> timestamp when it may be retried
const noThinking = new Set();          // models that reject thinkingConfig

const SKIP = /(image|vision|tts|audio|live|embedding|aqa|learnlm|gemma|dialog|thinking-exp)/i;

// Higher is better. Version dominates; then plain Flash over Flash-Lite; then stable over preview.
export function scoreModel(rawName) {
  const id = String(rawName || "").replace(/^models\//, "");
  if (!/^gemini-/i.test(id) || !/flash/i.test(id) || SKIP.test(id)) return null;
  const m = id.match(/^gemini-(\d+)(?:\.(\d+))?/i);
  if (!m) return null;
  const major = parseInt(m[1], 10);
  const minor = m[2] ? parseInt(m[2], 10) : 0;
  const lite = /flash-lite/i.test(id);
  const preview = /(preview|-exp\b|experimental)/i.test(id);
  return { id, score: major * 1000 + minor * 10 + (lite ? 0 : 5) + (preview ? 0 : 2) };
}

export function bestFlash(models) {
  const ranked = rankFlash(models);
  return ranked.length ? ranked[0] : null;
}
export function rankFlash(models) {
  return (models || [])
    .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes("generateContent"))
    .map((m) => scoreModel(m.name))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map((m) => m.id);
}

async function discover(key) {
  if (listCache.ids && Date.now() - listCache.at < LIST_TTL) return listCache.ids;
  try {
    const r = await fetch(LIST_URL, { headers: { "x-goog-api-key": key } });
    if (!r.ok) return listCache.ids || [];
    const j = await r.json();
    const ids = rankFlash(j && j.models);
    listCache = { ids, at: Date.now() };
    return ids;
  } catch { return listCache.ids || []; }
}

const benched = (m) => penalty.has(m) && penalty.get(m) > Date.now();

// Models to try, in order: pinned env > last winner > discovered > floor.
export async function candidates(key) {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL];
  const found = await discover(key);
  const all = [...(winner ? [winner] : []), ...found, ...FLOOR];
  const seen = new Set();
  const ordered = all.filter((m) => m && !seen.has(m) && seen.add(m));
  const usable = ordered.filter((m) => !benched(m));
  return (usable.length ? usable : ordered).slice(0, MAX_TRIES);   // if everything is benched, try anyway
}

function bodyFor(model, parts, temperature, maxOutputTokens) {
  const generationConfig = { temperature, maxOutputTokens };
  if (noThinking.has(model)) generationConfig.maxOutputTokens = Math.round(maxOutputTokens * 2.5); // thinking eats budget
  else generationConfig.thinkingConfig = { thinkingBudget: 0 };
  return JSON.stringify({ contents: [{ role: "user", parts }], generationConfig });
}

// Tries models until one answers. Returns the raw Response of the successful call,
// or the most informative failure if every candidate fails (429s preferred, so the
// caller can still show "AI is busy" rather than a hard error).
export async function generate(key, { parts, temperature = 0.3, maxOutputTokens = 200 }) {
  const list = await candidates(key);
  let lastFail = null, rateLimited = null;

  for (const model of list) {
    const send = () => fetch(GEN_URL(model), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: bodyFor(model, parts, temperature, maxOutputTokens),
    });

    let r;
    try { r = await send(); } catch { penalty.set(model, Date.now() + COOLDOWN_SOFT); continue; }

    // this model doesn't accept thinkingConfig — remember and retry it once
    if (r.status === 400 && !noThinking.has(model)) {
      const text = await r.clone().text().catch(() => "");
      if (/thinking/i.test(text)) { noThinking.add(model); try { r = await send(); } catch { /* fall through */ } }
    }

    if (r.ok) { winner = model; penalty.delete(model); r.modelUsed = model; return r; }

    if (r.status === 429) { penalty.set(model, Date.now() + COOLDOWN_SOFT); rateLimited = r; }
    else if (r.status >= 500) { penalty.set(model, Date.now() + COOLDOWN_SOFT); lastFail = lastFail || r; }
    else { penalty.set(model, Date.now() + COOLDOWN_HARD); lastFail = lastFail || r; }   // 400/403/404
    if (winner === model) winner = null;
  }

  const out = rateLimited || lastFail;
  if (out) out.modelUsed = list[list.length - 1];
  return out || { ok: false, status: 503, text: async () => "No Gemini model available", json: async () => ({}) };
}

// For tests / diagnostics.
export function _reset() { listCache = { ids: null, at: 0 }; winner = null; penalty.clear(); noThinking.clear(); }
export function _state() { return { winner, penalised: [...penalty.keys()], noThinking: [...noThinking] }; }
