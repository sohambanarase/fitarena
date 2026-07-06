// ============================================================
// /api/coach.js — Vercel Serverless Function (Node runtime)
// Keeps GEMINI_API_KEY server-side. The browser sends only a stats payload.
// ============================================================

const MODEL = "gemini-2.5-flash"; // free-tier eligible. Swap to "gemini-3.5-flash" (paid) anytime.
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY not configured on the server." });

  const b = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const weeklyGoal = b.weeklyGoal ?? 4;
  const days = b.gymDaysThisWeek ?? 0;
  const bd = b.breakdown || {};
  const mood = days >= weeklyGoal ? "crushing it" : days === 0 ? "ghosting the gym" : "behind pace";
  const question = (b.question || "").toString().slice(0, 300).trim();

  const context = [
    "Athlete: " + (b.name || "Athlete"),
    "Goals: " + (b.goals && b.goals.length ? b.goals.join(", ") : "general fitness"),
    (b.startWeight && b.currentWeight ? "Weight: " + b.startWeight + "kg → " + b.currentWeight + "kg." : ""),
    "This week: " + days + "/" + weeklyGoal + " gym days. Breakdown — lift:" + (bd.lift||0) + " cardio:" + (bd.cardio||0) + " rest:" + (bd.rest||0) + " missed:" + (bd.skip||0) + ". Streak: " + (b.streak ?? 0) + " days.",
    (b.recentPRs && b.recentPRs.length ? "Recent PRs: " + b.recentPRs.join(", ") + "." : "No PRs logged lately."),
    "Last 14 days (newest first): " + ((b.last14 || []).join(", ") || "no logs yet") + ".",
  ].filter(Boolean).join("\n");

  const prompt = question
    ? [
        "You are a knowledgeable, encouraging fitness coach inside a friendly challenge app.",
        "Answer the athlete's question clearly and practically, tailored to their context and goals.",
        "Keep it to 2-4 short sentences. Be concrete and actionable. No preamble.",
        "Do NOT give medical diagnoses; for pain or injury, suggest seeing a professional.",
        "",
        "CONTEXT:", context,
        "",
        "QUESTION: " + question,
      ].join("\n")
    : [
        "You are 'The Coach' in a friendly fitness challenge app. Give the athlete a short, genuinely useful read of their week.",
        "Tone: warm, motivating gym buddy with a little personality — encouraging, never cruel, never shaming looks or weight.",
        "Structure: first ONE sentence summarizing how the week is going, referencing what they actually did vs skipped. Then TWO or THREE concrete suggestions tied to their goals and this week's balance (examples: add a cardio day if all lifting, chase a specific PR, protect a streak, take a rest/deload if 6+ days straight, restart today if they've been missing).",
        "Under 90 words total. At most one emoji. No preamble, no headings — talk straight to them.",
        "",
        "CONTEXT:", context,
      ].join("\n");

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: question ? 0.6 : 0.75, maxOutputTokens: 360, thinkingConfig: { thinkingBudget: 0 } } }),
    });

    if (r.status === 429) {
      const detail = await r.text();
      const m = detail.match(/retry in ([\d.]+)s/i);
      return res.status(429).json({ rateLimited: true, retryAfter: m ? Math.ceil(parseFloat(m[1])) : 60 });
    }
    if (!r.ok) return res.status(502).json({ error: "Gemini error", detail: (await r.text()).slice(0, 400) });

    const data = await r.json();
    const text = (data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "").trim()
      || "Coach is speechless. Go log a workout and check back.";
    res.setHeader("Cache-Control", "s-maxage=30");
    return res.status(200).json({ message: text, tone: mood });
  } catch (e) {
    return res.status(500).json({ error: "Request failed", detail: String(e).slice(0, 300) });
  }
}
function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
