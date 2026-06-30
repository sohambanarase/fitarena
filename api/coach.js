// ============================================================
// /api/coach.js  —  Vercel Serverless Function (Node runtime)
// ------------------------------------------------------------
// The browser sends a compact stats payload; this function builds the prompt
// and calls Gemini. The GEMINI_API_KEY lives ONLY here (server env var) and
// never reaches the client bundle. This is the whole reason the function exists.
//
// Deploy: drop the repo on Vercel, set GEMINI_API_KEY in Project → Settings →
// Environment Variables. Vercel auto-detects /api/*.js as functions. $0 on Hobby.
// ============================================================

// Free + GA + free-tier eligible. Swap to "gemini-3.5-flash" later if you want
// the newer frontier model (paid tier) — it's a one-word change.
const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured on the server." });
  }

  // Vercel parses JSON bodies automatically; guard anyway.
  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const { name, goal, startWeight, currentWeight, heightCm, weeklyGoal, gymDaysThisWeek, streak, rank, totalPlayers, last14 } = body;

  const mood = gymDaysThisWeek >= (weeklyGoal ?? 4) ? "crushing it" : gymDaysThisWeek === 0 ? "ghosting the gym" : "behind pace";

  const prompt = `
You are "The Coach" in a fitness app where ${totalPlayers || "a few"} friends compete in a body-transformation challenge ending Aug 31.
Your voice: a witty gym buddy. Sharp, funny, a little savage when they slack — but never cruel, never about looks or weight as shame, never medical advice. Hype them hard when they earn it.

Write a SINGLE punchy message (2–3 sentences, under 55 words). No emoji spam (one max). No preamble, no "Here's your insight". Just talk to them.

Player: ${name || "Athlete"}
Goal: ${goal || "get fitter"}
This week: ${gymDaysThisWeek ?? 0}/${weeklyGoal ?? 4} gym days (${mood}). Current streak: ${streak ?? 0} days.
Leaderboard: rank ${rank ?? "?"} of ${totalPlayers ?? "?"}.
Recent pattern (last 14 days, newest first): ${(last14 || []).join(", ") || "no logs yet"}.

If they're crushing it → a TOAST (celebrate, dare them to keep it up).
If they're behind or ghosting → a ROAST (call it out, then a concrete nudge to log a session today).
`.trim();

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 120 },
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "Gemini error", detail: detail.slice(0, 500) });
    }

    const data = await r.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim() ||
      "Coach is speechless. Go log a workout and check back.";

    // Cache identical requests briefly at the edge to save quota.
    res.setHeader("Cache-Control", "s-maxage=60");
    return res.status(200).json({ message: text, tone: mood });
  } catch (e) {
    return res.status(500).json({ error: "Request failed", detail: String(e).slice(0, 300) });
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
