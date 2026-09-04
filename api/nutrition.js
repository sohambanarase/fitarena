// /api/nutrition.js — AI-backed nutrition helper.
// modes: "estimate" (meal text -> macros), "label" (label photo -> per-100g macros),
//        "assist" (question + today's context -> short answer).
import { generate, anyConfigured } from "./_ai.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  // Any one provider is enough — the chain in _ai.js decides which to actually use.
  const key = process.env.GEMINI_API_KEY;
  if (!anyConfigured()) return res.status(500).json({ error: "No AI provider configured." });
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

async function ai(key, parts, maxTokens, temp) {
  return generate(key, { parts, maxOutputTokens: maxTokens, temperature: temp == null ? 0.3 : temp });
}


/* ---------- response reading ----------
   Three bugs lived here and together they caused the frequent, confusing
   "Couldn't estimate that. Add quantities." even on well-described meals:

   1. Only parts[0] was read. Gemini's thinking-capable models return a THOUGHT part
      first, whose .text is undefined — so the real answer sitting in parts[1] was
      thrown away and the parse failed. coach.js already joined all parts; this file
      didn't. That single line is the main cause.
   2. maxOutputTokens was 120 for estimate and burn. Any preamble or leftover thinking
      truncated the JSON mid-object, which parses to nothing.
   3. finishReason was never checked, so a truncated or safety-blocked reply was
      reported as a bad meal description — telling you to add quantities when
      quantities were never the problem.
*/

// Joins every text part and drops thought parts, which carry no .text.
function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.filter((p) => p && typeof p.text === "string" && !p.thought)
              .map((p) => p.text).join("").replace(/```json|```/gi, "").trim();
}

function finishReason(data) { return data?.candidates?.[0]?.finishReason || null; }
function blockReason(data) { return data?.promptFeedback?.blockReason || null; }

// Asks for JSON, and retries once if the model truncated or answered with something
// unparseable. The retry doubles the token budget and adds a blunter instruction —
// weaker fallback models often comply on the second, more explicit ask.
async function askJSON(key, parts, maxTokens, validate, temp) {
  let lastReason = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const tokens = attempt === 0 ? maxTokens : maxTokens * 2;
    const sendParts = attempt === 0 ? parts : parts.map((pt, i) =>
      i === 0 && pt.text
        ? { text: pt.text + "\n\nIMPORTANT: reply with the raw JSON object only. No explanation, no markdown fences, no thinking out loud." }
        : pt);

    const r = await ai(key, sendParts, tokens, temp);
    if (r.status === 429) return { busy: true };
    if (!r.ok) { lastReason = "provider"; continue; }

    const data = await r.json();
    if (blockReason(data)) return { blocked: true };

    const parsed = safeParse(extractText(data));
    if (parsed && validate(parsed)) return { ok: true, data: parsed };

    lastReason = finishReason(data) === "MAX_TOKENS" ? "truncated" : "unparseable";
    if (lastReason !== "truncated" && attempt === 0 && !extractText(data)) lastReason = "empty";
  }
  return { failed: lastReason || "unparseable" };
}

// One place deciding what the user is told, so the message matches the real cause
// instead of always blaming the description.
function failMessage(reason, fallback) {
  if (reason === "truncated") return "That answer got cut off. Try again, or split a very long meal into two entries.";
  if (reason === "provider") return "AI is unreachable right now. Try again in a moment.";
  if (reason === "empty") return "The AI returned nothing. Try again.";
  return fallback;
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
  const out = await askJSON(key, parts, 320, (p) => p.calories != null);
  if (out.busy) return res.status(200).json({ ok: false, error: "AI is busy right now. Try again shortly." });
  if (out.blocked) return res.status(200).json({ ok: false, error: "That description was blocked. Try rewording it." });
  if (!out.ok) return res.status(200).json({ ok: false, error: failMessage(out.failed, "Couldn't estimate that one. Try naming the dish and a rough portion.") });
  const p = out.data;
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
  const out = await askJSON(key, [{ text: prompt }, { inlineData: { mimeType, data: image } }], 500, (p) => p.calories_per_100g != null);
  if (out.busy) return res.status(200).json({ ok: false, error: "AI is busy right now. Try again shortly." });
  if (out.blocked) return res.status(200).json({ ok: false, error: "That image was blocked. Try another photo." });
  if (!out.ok) return res.status(200).json({ ok: false, error: failMessage(out.failed, "Couldn't read that label. Try a clearer, straight-on photo.") });
  return res.status(200).json({ ok: true, food: out.data });
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
    c.waterMl != null ? "Water: " + r0(c.waterMl) + " ml" + (c.waterGoalMl ? " of a " + c.waterGoalMl + " ml goal" : "") + "." : "",
  ].filter(Boolean).join(" ");
  const prompt = [
    "You are a practical nutrition coach inside a gym app. Answer using their live numbers below.",
    "Be specific and numbers-first. For food ideas give 2-3 concrete options with rough macros. Under 90 words. At most one emoji. No preamble.",
    "If hydration is clearly behind and relevant to what they asked, mention it in one short clause - do not lecture.",
    "", "THEIR DAY: " + ctx, "", "QUESTION: " + q,
  ].join("\n");
  const r = await ai(key, [{ text: prompt }], 420, 0.5);
  if (r.status === 429) return res.status(200).json({ ok: false, error: "AI is busy right now. Try again shortly." });
  const data = await r.json();
  const text = extractText(data);
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
  const out = await askJSON(key, [{ text: prompt }], 320, (p) => p.calories != null);
  if (out.busy) return res.status(200).json({ ok: false, error: "AI is busy right now. Try again shortly." });
  if (out.blocked) return res.status(200).json({ ok: false, error: "That description was blocked. Try rewording it." });
  if (!out.ok) return res.status(200).json({ ok: false, error: failMessage(out.failed, "Couldn't estimate that. Try describing it differently.") });
  const p = out.data;
  return res.status(200).json({ ok: true, calories: int(p.calories), label: (p.label || "Activity").toString().slice(0, 40), minutes: p.minutes == null ? null : int(p.minutes) });
}

function int(v) { return Math.max(0, Math.round(Number(v) || 0)); }
function r0(v) { return Math.round(Number(v) || 0); }
function safeParse(s) {
  if (s == null) return null;
  try { return JSON.parse(s); } catch { /* fall through */ }
  // Smaller fallback models sometimes wrap the JSON in prose or a fence despite the
  // prompt. Pull out the first balanced {...} block and try that before giving up.
  const t = String(s).replace(/```[a-z]*|```/gi, "");
  const start = t.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < t.length; i++) {
    if (t[i] === "{") depth++;
    else if (t[i] === "}" && --depth === 0) {
      try { return JSON.parse(t.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}
