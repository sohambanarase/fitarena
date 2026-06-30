import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import { consistencyScore, currentStreak, toISO } from "../lib/streak.js";
import Loader from "../components/Loader.jsx";
import { Flame, RefreshCw } from "lucide-react";

export default function Coach() {
  const { user, profile, challenge } = useAuth();
  const [state, setState] = useState({ loading: true });

  const ask = useCallback(async () => {
    setState({ loading: true });
    try {
      // pull my last 21 days for an honest read
      const since = toISO(new Date(Date.now() - 21 * 86_400_000));
      const { data: logs = [] } = await supabase
        .from("daily_logs")
        .select("log_date, workout_type")
        .eq("user_id", user.id)
        .gte("log_date", since)
        .order("log_date", { ascending: false });

      // my rank in the group (compute locally, cheap)
      const { data: members = [] } = challenge
        ? await supabase.from("challenge_members").select("user_id").eq("challenge_id", challenge.id)
        : { data: [] };

      const c = consistencyScore(logs, profile?.weekly_goal ?? 4);
      const payload = {
        name: profile?.name,
        goal: profile?.goal,
        startWeight: profile?.start_weight_kg,
        currentWeight: profile?.current_weight_kg,
        heightCm: profile?.height_cm,
        weeklyGoal: profile?.weekly_goal ?? 4,
        gymDaysThisWeek: c.days,
        streak: currentStreak(logs),
        totalPlayers: members.length || 1,
        last14: logs.slice(0, 14).map((l) => l.workout_type),
      };

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Coach is offline");
      setState({ loading: false, message: data.message, tone: data.tone, days: c.days, goal: c.goal });
    } catch (e) {
      setState({ loading: false, error: String(e.message || e) });
    }
  }, [user, profile, challenge]);

  useEffect(() => {
    ask();
  }, [ask]);

  const crushing = state.tone === "crushing it";

  return (
    <div className="screen space-y-4">
      <header className="pt-1">
        <p className="eyebrow text-gold">Powered by Gemini</p>
        <h1 className="font-display text-3xl uppercase leading-none tracking-wide">AI Coach</h1>
      </header>

      <div className={`card border-2 ${crushing ? "border-mint/60" : state.tone ? "border-ember/60" : "border-line"}`}>
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`grid h-9 w-9 place-items-center rounded-full ${
              crushing ? "bg-mint text-ink" : "bg-ember text-ink"
            }`}
          >
            <Flame size={18} />
          </span>
          <p className="font-bold">
            {state.loading ? "Reading your tape…" : crushing ? "TOAST" : state.tone ? "ROAST" : "Coach"}
          </p>
        </div>

        {state.loading ? (
          <Loader label="Cooking up a take…" />
        ) : state.error ? (
          <p className="text-sm text-ember">
            {state.error}
            <span className="mt-1 block text-muted">
              Tip: the coach needs the /api function. Run <code>vercel dev</code> locally, or open the deployed URL.
            </span>
          </p>
        ) : (
          <p className="text-lg leading-snug">{state.message}</p>
        )}
      </div>

      <button onClick={ask} disabled={state.loading} className="pill mx-auto flex items-center gap-2">
        <RefreshCw size={14} /> New take
      </button>
    </div>
  );
}
