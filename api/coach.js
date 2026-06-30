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

  const prompt = [
    'You are "The Coach" in a fitness app where ' + (b.totalPlayers || "a few") + ' friends compete in a transformation challenge.',
    "Voice: a witty gym buddy. Sharp and funny, a little savage when they slack, but never cruel and never about looks/weight as shame. No medical advice. Hype them hard when earned.",
    "Write ONE punchy message, 2-3 sentences, under 55 words. One emoji max. No preamble. Talk straight to them.",
    "",
    "Player: " + (b.name || "Athlete"),
    "Goals: " + ((b.goals && b.goals.length ? b.goals.join(", ") : "get fitter")),
    "This week: " + days + "/" + weeklyGoal + " gym days (" + mood + "). Breakdown — lift:" + (bd.lift||0) + " cardio:" + (bd.cardio||0) + " rest:" + (bd.rest||0) + " missed:" + (bd.skip||0) + ". Streak: " + (b.streak ?? 0) + " days.",
    (b.recentPRs && b.recentPRs.length ? "Recent PRs: " + b.recentPRs.join(", ") + "." : "No PRs logged lately."),
    "Last 14 days (newest first): " + ((b.last14 || []).join(", ") || "no logs yet") + ".",
    "",
    "Be specific: reference what they actually did vs skipped (e.g. lots of lifting but zero cardio, or a fat streak, or a PR). If crushing it -> a TOAST. If behind/ghosting -> a ROAST plus one concrete nudge to log a session today.",
  ].join("\n");

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 120 } }),
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
