// api/_gemini.js — shared Gemini plumbing.
// Files starting with "_" are not routes; this is imported by coach.js / nutrition.js.
//
// Why discovery instead of a hardcoded model: Google retires model IDs and closes older
// ones to new API keys. So on the first call we ask the key which models it can actually
// use and take the newest Flash. If a model disappears mid-flight we forget the choice and
// re-pick; if a model rejects thinkingConfig we retry without it.

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const LIST_URL = BASE + "/models?pageSize=200";
const GEN_URL = (m) => BASE + "/models/" + m + ":generateContent";

const CACHE_MS = 6 * 60 * 60 * 1000;   // re-check twice a day on a warm instance
const FALLBACKS = ["gemini-3.5-flash", "gemini-2.5-flash"];   // only if discovery itself fails

let cache = { model: null, at: 0 };
const noThinking = new Set();          // models that reject thinkingConfig
const dead = new Set();                // models this key got 404/403 on

// Variants that aren't general chat models.
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
  const scored = (models || [])
    .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes("generateContent"))
    .map((m) => scoreModel(m.name))
    .filter(Boolean)
    .filter((m) => !dead.has(m.id))
    .sort((a, b) => b.score - a.score);
  return scored.length ? scored[0].id : null;
}

async function discover(key) {
  try {
    const r = await fetch(LIST_URL, { headers: { "x-goog-api-key": key } });
    if (!r.ok) return null;
    const j = await r.json();
    return bestFlash(j && j.models);
  } catch { return null; }
}

export async function pickModel(key) {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;         // pinned by env
  const fresh = cache.model && Date.now() - cache.at < CACHE_MS && !dead.has(cache.model);
  if (fresh) return cache.model;
  const found = await discover(key);
  const chosen = found || FALLBACKS.find((f) => !dead.has(f)) || FALLBACKS[0];
  cache = { model: chosen, at: Date.now() };
  return chosen;
}

// Calls generateContent, healing around retired models and thinkingConfig rejections.
// Returns the raw fetch Response so callers keep their own 429 / error handling.
export async function generate(key, { parts, temperature = 0.3, maxOutputTokens = 200 }) {
  const build = (model) => {
    const generationConfig = { temperature, maxOutputTokens };
    if (!noThinking.has(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    return { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig }) };
  };

  let model = await pickModel(key);
  let r = await fetch(GEN_URL(model), build(model));

  // model rejects thinkingConfig → remember and retry without it
  if (r.status === 400 && !noThinking.has(model)) {
    const text = await r.clone().text().catch(() => "");
    if (/thinking/i.test(text)) { noThinking.add(model); r = await fetch(GEN_URL(model), build(model)); }
  }

  // model retired or not available to this key → forget it and re-pick once
  if (r.status === 404 || r.status === 403) {
    dead.add(model);
    cache = { model: null, at: 0 };
    const next = await pickModel(key);
    if (next && next !== model) { model = next; r = await fetch(GEN_URL(model), build(model)); }
  }
  return r;
}

// For tests / diagnostics.
export function _reset() { cache = { model: null, at: 0 }; dead.clear(); noThinking.clear(); }
export function _state() { return { cache: { ...cache }, dead: [...dead], noThinking: [...noThinking] }; }
