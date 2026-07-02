import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import { loadGroupWins, bestPRs } from "../lib/achievements.js";
import { LogOut, Trophy, Moon, Sun } from "lucide-react";
import { currentTheme, applyTheme } from "../lib/theme.js";

const GOALS = ["Lose fat", "Build muscle", "Recomp", "Stay consistent", "Get stronger", "Run more"];

export default function Profile() {
  const { user, profile, activeChallenge, refresh, signOut } = useAuth();
  const [form, setForm] = useState({ name: "", height_cm: "", start_weight_kg: "", current_weight_kg: "", weekly_goal: 4, goals: [] });
  const [prs, setPrs] = useState([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(currentTheme());
  const switchTheme = (t) => { applyTheme(t); setTheme(t); };

  useEffect(() => {
    if (profile)
      setForm({
        name: profile.name ?? "",
        height_cm: profile.height_cm ?? "",
        start_weight_kg: profile.start_weight_kg ?? "",
        current_weight_kg: profile.current_weight_kg ?? "",
        weekly_goal: profile.weekly_goal ?? 4,
        goals: profile.goals?.length ? profile.goals : (profile.goal ? [profile.goal] : []),
      });
  }, [profile]);

  useEffect(() => { loadGroupWins([user.id], null, 120).then((w) => setPrs(bestPRs(w))); }, [user.id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleGoal = (g) => setForm((f) => ({ ...f, goals: f.goals.includes(g) ? f.goals.filter((x) => x !== g) : [...f.goals, g] }));

  async function save() {
    setBusy(true);
    const num = (v) => (v === "" ? null : Number(v));
    await supabase.from("profiles").update({
      name: form.name || null,
      height_cm: num(form.height_cm),
      start_weight_kg: num(form.start_weight_kg),
      current_weight_kg: num(form.current_weight_kg),
      weekly_goal: Number(form.weekly_goal) || 4,
      goals: form.goals,
    }).eq("id", user.id);
    await refresh();
    setBusy(false); setSaved(true); setTimeout(() => setSaved(false), 1500);
  }

  const delta = form.start_weight_kg && form.current_weight_kg
    ? (Number(form.current_weight_kg) - Number(form.start_weight_kg)).toFixed(1) : null;

  return (
    <div className="screen space-y-4">
      <header className="pt-1">
        <p className="eyebrow">{user.email}</p>
        <h1 className="font-display text-3xl uppercase leading-none tracking-wide">Profile</h1>
      </header>

      <div className="card">
        <p className="eyebrow">Appearance</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={() => switchTheme("dark")} className={"flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition " + (theme === "dark" ? "bg-gold text-ink" : "bg-surface2 text-muted")}>
            <Moon size={16} /> Dark
          </button>
          <button onClick={() => switchTheme("light")} className={"flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition " + (theme === "light" ? "bg-gold text-ink" : "bg-surface2 text-muted")}>
            <Sun size={16} /> Light
          </button>
        </div>
      </div>

      {delta !== null && (
        <div className="card flex items-center justify-between">
          <div>
            <p className="eyebrow">Weight change</p>
            <p className="font-score text-3xl font-bold text-gold">{delta > 0 ? "+" : ""}{delta}<span className="text-base text-muted"> kg</span></p>
          </div>
          <p className="text-right text-sm text-muted">{form.start_weight_kg} \u2192 {form.current_weight_kg} kg</p>
        </div>
      )}

      <div className="card space-y-3">
        <Field label="Name"><input className="inp" value={form.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Height (cm)"><input className="inp" inputMode="decimal" value={form.height_cm} onChange={set("height_cm")} /></Field>
          <Field label="Weekly gym goal"><input className="inp" inputMode="numeric" value={form.weekly_goal} onChange={set("weekly_goal")} /></Field>
          <Field label="Start weight (kg)"><input className="inp" inputMode="decimal" value={form.start_weight_kg} onChange={set("start_weight_kg")} /></Field>
          <Field label="Current weight (kg)"><input className="inp" inputMode="decimal" value={form.current_weight_kg} onChange={set("current_weight_kg")} /></Field>
        </div>
        <Field label="Goals (pick any)">
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button key={g} className={"pill " + (form.goals.includes(g) ? "pill-on" : "")} onClick={() => toggleGoal(g)}>{g}</button>
            ))}
          </div>
        </Field>
        <button className="btn-primary w-full" onClick={save} disabled={busy}>{busy ? "Saving\u2026" : saved ? "Saved \u2713" : "Save"}</button>
      </div>

      <div className="card">
        <p className="eyebrow flex items-center gap-1"><Trophy size={12} /> Your PR bests</p>
        {prs.length ? (
          <div className="mt-2 space-y-1.5">
            {prs.map((w) => (
              <div key={w.id} className="flex items-center justify-between border-b border-line/60 pb-1.5 last:border-0">
                <span className="capitalize">{w.exercise}</span>
                <span className="font-score text-gold">{w.weight_kg ? w.weight_kg + "kg" : ""}{w.reps ? " \u00d7 " + w.reps : ""}</span>
              </div>
            ))}
          </div>
        ) : <p className="mt-1 text-sm text-muted">No PRs yet. Log one from the Arena \u2192 Post a win.</p>}
      </div>

      {activeChallenge && (
        <div className="card">
          <p className="eyebrow">Active challenge</p>
          <p className="mt-1 font-bold">{activeChallenge.name}</p>
          <p className="text-sm text-muted">Invite code: <span className="font-score text-gold">{activeChallenge.invite_code}</span></p>
        </div>
      )}

      <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-muted active:scale-[.98] transition">
        <LogOut size={16} /> Sign out
      </button>

    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="eyebrow mb-1 block">{label}</span>{children}</label>;
}
