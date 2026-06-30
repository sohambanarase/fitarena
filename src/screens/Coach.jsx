import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import { consistencyScore, currentStreak, toISO, startOfWeekISO } from "../lib/streak.js";
import { loadGroupWins, bestPRs } from "../lib/achievements.js";
import Loader from "../components/Loader.jsx";
import { Flame, RefreshCw } from "lucide-react";

// Cache the last take per user/day so reopening the tab costs zero API calls.
const cacheKey = (uid) => "fitarena.coach." + uid + "." + toISO(new Date());

export default function Coach() {
  const { user, profile, activeChallenge } = useAuth();
  const [state, setState] = useState({ loading: false });
  const [cooldown, setCooldown] = useState(0);

  // on mount: show cached take if we have one today; don't auto-call the API
  useEffect(() => {
    const cached = localStorage.getItem(cacheKey(user.id));
    if (cached) setState(JSON.parse(cached));
  }, [user.id]);

  // simple cooldown timer after a call (the free tier is rate-limited)
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const ask = useCallback(async () => {
    setState({ loading: true });
    try {
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

      const payload = {
        name: profile?.name,
        goals: (profile?.goals?.length ? profile.goals : [profile?.goal].filter(Boolean)),
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

      const res = await fetch("/api/coach", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.status === 429 || data.rateLimited) {
        const wait = data.retryAfter || 60;
        setCooldown(wait);
        setState({ loading: false, soft: "Coach is catching his breath \u2014 the free AI tier has a short cooldown. Try again in about " + wait + "s." });
        return;
      }
      if (!res.ok) throw new Error(data.error || "Coach is offline");

      const next = { loading: false, message: data.message, tone: data.tone };
      setState(next);
      localStorage.setItem(cacheKey(user.id), JSON.stringify(next));
      setCooldown(15);
    } catch (e) {
      setState({ loading: false, error: String(e.message || e) });
    }
  }, [user, profile, activeChallenge]);

  const crushing = state.tone === "crushing it";
  const hasTake = state.message && !state.loading;

  return (
    <div className="screen space-y-4">
      <header className="pt-1">
        <p className="eyebrow text-gold">Powered by Gemini</p>
        <h1 className="font-display text-3xl uppercase leading-none tracking-wide">AI Coach</h1>
      </header>

      <div className={"card border-2 " + (crushing ? "border-mint/60" : hasTake ? "border-ember/60" : "border-line")}>
        <div className="mb-2 flex items-center gap-2">
          <span className={"grid h-9 w-9 place-items-center rounded-full " + (crushing ? "bg-mint text-ink" : "bg-ember text-ink")}>
            <Flame size={18} />
          </span>
          <p className="font-bold">{state.loading ? "Reading your tape\u2026" : crushing ? "TOAST" : hasTake ? "ROAST" : "Coach"}</p>
        </div>

        {state.loading ? <Loader label="Cooking up a take\u2026" />
          : state.soft ? <p className="text-sm text-muted">{state.soft}</p>
          : state.error ? <p className="text-sm text-ember">{state.error}</p>
          : hasTake ? <p className="text-lg leading-snug">{state.message}</p>
          : <p className="text-muted">Tap below and I'll size up your week so far.</p>}
      </div>

      <button onClick={ask} disabled={state.loading || cooldown > 0}
        className="pill mx-auto flex items-center gap-2 disabled:opacity-50">
        <RefreshCw size={14} /> {cooldown > 0 ? "Wait " + cooldown + "s" : hasTake ? "New take" : "Get my take"}
      </button>
    </div>
  );
}
