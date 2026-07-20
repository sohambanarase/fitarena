// /api/nutrition.js — Gemini-backed nutrition helper.
// modes: "estimate" (meal text -> macros), "label" (label photo -> per-100g macros),
//        "assist" (question + today's context -> short answer).
import { generate } from "./_gemini.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY not configured." });
  const b = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const mode = b.mode || "estimate";
  try {
    if (mode === "label") return await labelScan(b, key, res);
    if (mode === "assist") return await assist(b, key, res);
    if (mode === "burn") return await burn(b, key, res);
    return await estimate(b, key, res);
  } catch (e) {
    return res.status(500).json({ error: "AI request failed." });
  }
}

async function gemini(key, parts, maxTokens, temp) {
  return generate(key, { parts, maxOutputTokens: maxTokens, temperature: temp == null ? 0.3 : temp });
}

async function estimate(b, key, res) {
  const meal = (b.meal || "").toString().slice(0, 500).trim();
  const image = (b.image || "").toString();
  if (!meal && !image) return res.status(400).json({ error: "No meal described." });
  const prompt = [
    "Estimate the total nutrition for this meal. Sum all items.",
    image ? "A photo of the meal is attached - identify the foods and estimate portion sizes from it. If a text description is also given, it takes priority for quantities." : "",
    "Return ONLY compact JSON: {\"calories\":<int>,\"protein\":<int>,\"carbs\":<int>,\"fat\":<int>}. No markdown, no words.",
    "Use realistic values for the stated quantities; assume typical portions if vague.",
    "", "MEAL: " + (meal || "(see photo)"),
  ].filter(Boolean).join("\n");
  const parts = [{ text: prompt }];
  if (image) parts.push({ inlineData: { mimeType: b.mimeType || "image/jpeg", data: image } });
  const r = await gemini(key, parts, 120);
  if (r.status === 429) return res.status(200).json({ ok: false, error: "AI is busy (free-tier limit). Try again shortly." });
  const data = await r.json();
  const t = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text || "").replace(/```json|```/g, "").trim();
  const p = safeParse(t);
  if (!p || p.calories == null) return res.status(200).json({ ok: false, error: "Couldn't estimate that. Add quantities." });
  return res.status(200).json({ ok: true, calories: int(p.calories), protein: int(p.protein), carbs: int(p.carbs), fat: int(p.fat) });
}

async function labelScan(b, key, res) {
  const image = (b.image || "").toString();
  const mimeType = b.mimeType || "image/jpeg";
  if (!image) return res.status(400).json({ error: "No image provided." });
  const prompt = [
    "This is a photo of a food nutrition label. Read the per-100g values (convert if only per-serving is shown with a serving size).",
    "Return ONLY compact JSON, no markdown: {\"name\":<string or null>,\"calories_per_100g\":<num>,\"protein_per_100g\":<num>,\"carbs_per_100g\":<num>,\"fat_per_100g\":<num>,\"sugar_per_100g\":<num or null>,\"salt_per_100g\":<num or null>,\"fiber_per_100g\":<num or null>,\"serving_size\":<num grams or null>}.",
    "If a value isn't legible, use null. Never invent values.",
  ].join("\n");
  const r = await gemini(key, [{ text: prompt }, { inlineData: { mimeType, data: image } }], 300);
  if (r.status === 429) return res.status(200).json({ ok: false, error: "AI is busy (free-tier limit). Try again shortly." });
  const data = await r.json();
  const t = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text || "").replace(/```json|```/g, "").trim();
  const p = safeParse(t);
  if (!p || p.calories_per_100g == null) return res.status(200).json({ ok: false, error: "Couldn't read that label. Try a clearer, straight-on photo." });
  return res.status(200).json({ ok: true, food: p });
}

async function assist(b, key, res) {
  const q = (b.question || "").toString().slice(0, 300).trim();
  const c = b.context || {};
  if (!q) return res.status(400).json({ error: "No question." });
  const ctx = [
    "Today so far - calories: " + r0(c.calories) + (c.caloriesGoal ? " of " + c.caloriesGoal + " goal" : ""),
    "protein: " + r0(c.protein) + "g" + (c.proteinGoal ? " of " + c.proteinGoal + "g goal" : ""),
    "carbs: " + r0(c.carbs) + "g, fat: " + r0(c.fat) + "g.",
    c.caloriesGoal ? "Calories remaining: " + Math.round(c.caloriesGoal - (c.calories || 0)) + "." : "",
    c.proteinGoal ? "Protein remaining: " + Math.round(c.proteinGoal - (c.protein || 0)) + "g." : "",
  ].filter(Boolean).join(" ");
  const prompt = [
    "You are a practical nutrition coach inside a gym app. Answer using their live numbers below.",
    "Be specific and numbers-first. For food ideas give 2-3 concrete options with rough macros. Under 90 words. At most one emoji. No preamble.",
    "", "THEIR DAY: " + ctx, "", "QUESTION: " + q,
  ].join("\n");
  const r = await gemini(key, [{ text: prompt }], 260, 0.5);
  if (r.status === 429) return res.status(200).json({ ok: false, error: "AI is busy (free-tier limit). Try again shortly." });
  const data = await r.json();
  const text = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text || "").trim();
  if (!text) return res.status(200).json({ ok: false, error: "No answer - try rephrasing." });
  return res.status(200).json({ ok: true, answer: text });
}

async function burn(b, key, res) {
  const activity = (b.activity || "").toString().slice(0, 400).trim();
  const w = b.weightKg ? Number(b.weightKg) : null;
  const wk = b.workout || null;
  if (!activity && !(wk && (wk.count || wk.minutes))) return res.status(400).json({ error: "Nothing to estimate." });
  const desc = activity || [
    wk.minutes ? "Gym session of about " + wk.minutes + " minutes." : "",
    wk.count ? "Exercises logged: " + (wk.exercises || []).slice(0, 12).join("; ") + "." : "",
  ].filter(Boolean).join(" ");
  const prompt = [
    "Estimate the calories burned for this activity. Be realistic and conservative - resistance training burns far less than people assume, and do NOT include basal metabolism, only the activity itself.",
    w ? "The person weighs about " + Math.round(w) + " kg." : "Assume an average adult (75 kg).",
    "Return ONLY compact JSON: {\"calories\":<int>,\"label\":<short 2-4 word name>,\"minutes\":<int or null>}. No markdown, no words.",
    "", "ACTIVITY: " + desc,
  ].join("\n");
  const r = await gemini(key, [{ text: prompt }], 120);
  if (r.status === 429) return res.status(200).json({ ok: false, error: "AI is busy (free-tier limit). Try again shortly." });
  const data = await r.json();
  const t = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text || "").replace(/```json|```/g, "").trim();
  const p = safeParse(t);
  if (!p || p.calories == null) return res.status(200).json({ ok: false, error: "Couldn't estimate that. Try describing it differently." });
  return res.status(200).json({ ok: true, calories: int(p.calories), label: (p.label || "Activity").toString().slice(0, 40), minutes: p.minutes == null ? null : int(p.minutes) });
}

function int(v) { return Math.max(0, Math.round(Number(v) || 0)); }
function r0(v) { return Math.round(Number(v) || 0); }
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
