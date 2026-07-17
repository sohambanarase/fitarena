// /api/nutrition.js — estimate macros for a described meal via Gemini.
// Returns whole-meal totals; the client shows them as an editable estimate.
const MODEL = "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY not configured." });

  const b = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const meal = (b.meal || "").toString().slice(0, 500).trim();
  if (!meal) return res.status(400).json({ error: "No meal described." });

  const prompt = [
    "Estimate the total nutrition for this meal. Sum all items.",
    "Return ONLY compact JSON, no markdown, no words: {\"calories\":<int kcal>,\"protein\":<int g>,\"carbs\":<int g>,\"fat\":<int g>}.",
    "Use realistic values for the stated quantities. If quantities are vague, assume typical portions.",
    "",
    "MEAL: " + meal,
  ].join("\n");

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 120, thinkingConfig: { thinkingBudget: 0 } } }),
    });
    if (r.status === 429) return res.status(200).json({ ok: false, error: "AI is busy (free-tier limit). Try again shortly." });
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = safeParse(text.replace(/```json|```/g, "").trim());
    if (!parsed || parsed.calories == null) return res.status(200).json({ ok: false, error: "Couldn't estimate that. Try adding quantities." });
    return res.status(200).json({
      ok: true,
      calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
      protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(parsed.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(parsed.fat) || 0)),
    });
  } catch (e) {
    return res.status(500).json({ error: "AI request failed." });
  }
}
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
