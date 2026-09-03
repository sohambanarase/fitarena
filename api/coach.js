// ============================================================
// /api/coach.js — Vercel Serverless Function (Node runtime)
// Keeps AI provider keys server-side. The browser sends only a stats payload.
// ============================================================

import { generate, anyConfigured } from "./_ai.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  // Any one provider is enough — the chain in _ai.js decides which to actually use.
  const key = process.env.GEMINI_API_KEY;
  if (!anyConfigured()) return res.status(500).json({ error: "No AI provider configured on the server." });

  const b = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const weeklyGoal = b.weeklyGoal ?? 4;
  const days = b.gymDaysThisWeek ?? 0;
  const bd = b.breakdown || {};
  const mood = days >= weeklyGoal ? "crushing it" : days === 0 ? "ghosting the gym" : "behind pace";
  const question = (b.question || "").toString().slice(0, 300).trim();

  const wchg = (b.startWeight && b.currentWeight) ? (b.currentWeight - b.startWeight) : null;
  const context = [
    "Athlete: " + (b.name || "Athlete"),
    "Goals: " + (b.goals && b.goals.length ? b.goals.join(", ") : "general fitness"),
    (wchg != null ? "Bodyweight: " + b.startWeight + "kg -> " + b.currentWeight + "kg (" + (wchg >= 0 ? "+" : "") + wchg.toFixed(1) + "kg)." : ""),
    "Consistency this week: " + (b.consistencyPct ?? 0) + "% (" + days + " of " + weeklyGoal + " goal gym days). Last week: " + (b.lastWeekGymDays ?? 0) + " gym days.",
    "Sets logged: " + (b.setsThisWeek ?? 0) + " this week vs " + (b.setsLastWeek ?? 0) + " last week.",
    "This week split - lift:" + (bd.lift||0) + " cardio:" + (bd.cardio||0) + " rest:" + (bd.rest||0) + " missed:" + (bd.skip||0) + ". Current streak: " + (b.streak ?? 0) + " days.",
    (b.recentPRs && b.recentPRs.length ? "Best lifts: " + b.recentPRs.join(", ") + "." : "No PRs logged yet."),
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
        "You are 'The Coach' - a sharp, data-literate fitness coach in a challenge app. Give an INSIGHTFUL, statistical read of the athlete's week; lead with the numbers and what they mean.",
        "Structure: (1) a one-line headline with the key number(s) AND the week-over-week trend (e.g. 'Volume up 18% — 24 sets vs 20 last week' or 'Consistency slipped to 60% from 100%'). (2) one sentence interpreting the pattern (volume up but consistency down, all lifting no cardio, streak building, etc). (3) TWO specific numbers-based suggestions tied to their goals (e.g. 'one more session hits 5/5', 'you're ~5kg off your bench goal, try 3x5').",
        "Warm and motivating, never shaming looks or weight. Under 95 words. At most one emoji. No headings, no preamble - talk straight to them.",
        "",
        "CONTEXT:", context,
      ].join("\n");

  try {
    const r = await generate(key, { parts: [{ text: prompt }], temperature: question ? 0.6 : 0.75, maxOutputTokens: 360 });

    if (r.status === 429) {
      const detail = await r.text();
      const m = detail.match(/retry in ([\d.]+)s/i);
      return res.status(429).json({ rateLimited: true, retryAfter: m ? Math.ceil(parseFloat(m[1])) : 60 });
    }
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return res.status(502).json({ error: "AI error", provider: r.providerUsed || "unknown", model: r.modelUsed || "unknown", status: r.status, detail: detail.slice(0, 300) });
    }

    const data = await r.json();
    const text = (data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "").trim()
      || "Coach came back empty this time — tap refresh to try again.";
    res.setHeader("Cache-Control", "s-maxage=30");
    return res.status(200).json({ message: text, tone: mood });
  } catch (e) {
    return res.status(500).json({ error: "Request failed", detail: String(e).slice(0, 300) });
  }
}
function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
