import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import { LogOut } from "lucide-react";

const GOALS = ["Lose fat", "Build muscle", "Recomp", "Stay consistent"];

export default function Profile() {
  const { user, profile, challenge, refresh, signOut } = useAuth();
  const [form, setForm] = useState({
    name: "", height_cm: "", start_weight_kg: "", current_weight_kg: "", goal: "", weekly_goal: 4,
  });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile)
      setForm({
        name: profile.name ?? "",
        height_cm: profile.height_cm ?? "",
        start_weight_kg: profile.start_weight_kg ?? "",
        current_weight_kg: profile.current_weight_kg ?? "",
        goal: profile.goal ?? "",
        weekly_goal: profile.weekly_goal ?? 4,
      });
  }, [profile]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setBusy(true);
    const num = (v) => (v === "" ? null : Number(v));
    await supabase.from("profiles").update({
      name: form.name || null,
      height_cm: num(form.height_cm),
      start_weight_kg: num(form.start_weight_kg),
      current_weight_kg: num(form.current_weight_kg),
      goal: form.goal || null,
      weekly_goal: Number(form.weekly_goal) || 4,
    }).eq("id", user.id);
    await refresh();
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const delta =
    form.start_weight_kg && form.current_weight_kg
      ? (Number(form.current_weight_kg) - Number(form.start_weight_kg)).toFixed(1)
      : null;

  return (
    <div className="screen space-y-4">
      <header className="pt-1">
        <p className="eyebrow">{user.email}</p>
        <h1 className="font-display text-3xl uppercase leading-none tracking-wide">Profile</h1>
      </header>

      {delta !== null && (
        <div className="card flex items-center justify-between">
          <div>
            <p className="eyebrow">Weight change</p>
            <p className="font-score text-3xl font-bold text-gold">
              {delta > 0 ? "+" : ""}{delta}<span className="text-base text-muted"> kg</span>
            </p>
          </div>
          <p className="text-right text-sm text-muted">
            {form.start_weight_kg} → {form.current_weight_kg} kg
          </p>
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
        <Field label="Goal">
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button key={g} className={`pill ${form.goal === g ? "pill-on" : ""}`} onClick={() => setForm({ ...form, goal: g })}>{g}</button>
            ))}
          </div>
        </Field>
        <button className="btn-primary w-full" onClick={save} disabled={busy}>
          {busy ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>

      {challenge && (
        <div className="card">
          <p className="eyebrow">Your challenge</p>
          <p className="mt-1 font-bold">{challenge.name}</p>
          <p className="text-sm text-muted">Invite code: <span className="font-score text-gold">{challenge.invite_code}</span></p>
        </div>
      )}

      <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-muted active:scale-[.98] transition">
        <LogOut size={16} /> Sign out
      </button>

      <style>{`.inp{width:100%;border-radius:.75rem;background:#272231;padding:.7rem 1rem;outline:none}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      {children}
    </label>
  );
}
