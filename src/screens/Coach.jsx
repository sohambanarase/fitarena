import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import { consistencyScore, currentStreak, toISO, startOfWeekISO } from "../lib/streak.js";
import { loadGroupWins, bestPRs } from "../lib/achievements.js";
import Loader from "../components/Loader.jsx";
import { Sparkles, RefreshCw, Send } from "lucide-react";

const cacheKey = (uid) => "fitarena.coach." + uid + "." + toISO(new Date());

export default function Coach() {
  const { user, profile, activeChallenge } = useAuth();
  const [summary, setSummary] = useState({ loading: false });
  const [cooldown, setCooldown] = useState(0);
  const [q, setQ] = useState("");
  const [qa, setQa] = useState([]);        // [{ q, a }]
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey(user.id));
    if (cached) setSummary(JSON.parse(cached));
  }, [user.id]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Gather the athlete's context once, reused for the summary and for questions.
  const buildContext = useCallback(async () => {
    const since = toISO(new Date(Date.now() - 21 * 86400000));
    const { data: logs = [] } = await supabase
      .from("daily_logs").select("log_date, workout_type")
      .eq("user_id", user.id).gte("log_date", since).order("log_date", { ascending: false });
    const members = activeChallenge
      ? (await supabase.from("challenge_members").select("user_id").eq("challenge_id", activeChallenge.id)).data || []
      : [];
    const myWins = await loadGroupWins([user.id]);
    const c = consistencyScore(logs, profile?.weekly_goal ?? 4);
    const ws = startOfWeekISO();
    const weekLogs = logs.filter((l) => l.log_date >= ws);
    const breakdown = {
      lift: weekLogs.filter((l) => l.workout_type === "lift").length,
      cardio: weekLogs.filter((l) => l.workout_type === "cardio").length,
      rest: weekLogs.filter((l) => l.workout_type === "rest").length,
      skip: weekLogs.filter((l) => l.workout_type === "skip").length,
    };
    return {
      name: profile?.name,
      goals: profile?.goals?.length ? profile.goals : [profile?.goal].filter(Boolean),
      startWeight: profile?.start_weight_kg,
      currentWeight: profile?.current_weight_kg,
      weeklyGoal: profile?.weekly_goal ?? 4,
      gymDaysThisWeek: c.days,
      breakdown,
      streak: currentStreak(logs),
      totalPlayers: members.length || 1,
      recentPRs: bestPRs(myWins).slice(0, 3).map((w) => w.exercise + (w.weight_kg ? " " + w.weight_kg + "kg" : "")),
      last14: logs.slice(0, 14).map((l) => l.workout_type),
    };
  }, [user, profile, activeChallenge]);

  async function callCoach(extra) {
    const ctx = await buildContext();
    const res = await fetch("/api/coach", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ctx, ...extra }),
    });
    const data = await res.json();
    if (res.status === 429 || data.rateLimited) { setCooldown(data.retryAfter || 60); return { rate: true, wait: data.retryAfter || 60 }; }
    if (!res.ok) throw new Error(data.error || "Coach is offline");
    return { message: data.message };
  }

  const getSummary = useCallback(async () => {
    setSummary({ loading: true });
    try {
      const r = await callCoach({});
      if (r.rate) { setSummary({ loading: false, soft: "Coach is catching his breath — the free tier has a short cooldown. Try again in ~" + r.wait + "s." }); return; }
      const next = { loading: false, message: r.message };
      setSummary(next); localStorage.setItem(cacheKey(user.id), JSON.stringify(next)); setCooldown(15);
    } catch (e) { setSummary({ loading: false, error: String(e.message || e) }); }
  }, [buildContext, user.id]);

  async function askCoach() {
    const question = q.trim();
    if (!question || asking || cooldown > 0) return;
    setAsking(true); setQ("");
    setQa((prev) => [{ q: question, a: null }, ...prev]);
    try {
      const r = await callCoach({ question });
      const answer = r.rate ? "Hang on ~" + r.wait + "s — the free tier is cooling down, then ask again." : r.message;
      setQa((prev) => prev.map((row, i) => (i === 0 ? { ...row, a: answer } : row)));
      if (!r.rate) setCooldown(15);
    } catch (e) {
      setQa((prev) => prev.map((row, i) => (i === 0 ? { ...row, a: "Coach is offline right now." } : row)));
    }
    setAsking(false);
  }

  const hasSummary = summary.message && !summary.loading;

  return (
    <div className="screen space-y-4">
      <header className="pt-1">
        <p className="eyebrow text-gold">Powered by Gemini</p>
        <h1 className="font-display text-3xl uppercase leading-none tracking-wide">AI Coach</h1>
      </header>

      {/* Weekly read + suggestions */}
      <div className="card">
        <div className="mb-2 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gold text-ink"><Sparkles size={18} /></span>
          <p className="font-bold">Your week</p>
        </div>
        {summary.loading ? <Loader label="Reading your week…" />
          : summary.soft ? <p className="text-sm text-muted">{summary.soft}</p>
          : summary.error ? <p className="text-sm text-ember">{summary.error}</p>
          : hasSummary ? <p className="whitespace-pre-line leading-relaxed">{summary.message}</p>
          : <p className="text-muted">Tap below for a read on your week and a few suggestions tuned to your goals.</p>}
        <button onClick={getSummary} disabled={summary.loading || cooldown > 0}
          className="pill mt-3 flex items-center gap-2 disabled:opacity-50">
          <RefreshCw size={14} /> {cooldown > 0 ? "Wait " + cooldown + "s" : hasSummary ? "Refresh" : "Get my read"}
        </button>
      </div>

      {/* Ask the coach */}
      <div className="space-y-2">
        <p className="eyebrow">Ask the coach</p>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && askCoach()}
            placeholder="e.g. How do I get my bench up?" className="w-full bg-transparent outline-none placeholder:text-muted" />
          <button onClick={askCoach} disabled={!q.trim() || asking || cooldown > 0}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold text-ink disabled:opacity-40"><Send size={16} /></button>
        </div>
        <p className="text-[11px] text-muted">Short questions on training, routines, or your goals. Not medical advice.</p>

        {qa.map((row, i) => (
          <div key={i} className="space-y-1.5 pt-1">
            <p className="text-sm font-semibold text-gold">{row.q}</p>
            {row.a === null ? <p className="text-sm text-muted">Thinking…</p>
              : <p className="card leading-relaxed">{row.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
