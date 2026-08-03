import { defaultEndDate } from "../lib/challenge.js";
import { useState } from "react";
import Sheet from "./Sheet.jsx";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Plus, LogIn, Check } from "lucide-react";

export default function ChallengeSwitcher({ onClose }) {
  const { user, challenges, activeChallenge, setActiveId, refresh } = useAuth();
  const [mode, setMode] = useState("list"); // list | create | join

  return (
    <Sheet title={mode === "create" ? "New challenge" : mode === "join" ? "Join a challenge" : "Your challenges"} onClose={onClose}>
      {mode === "list" && (
        <div className="space-y-2">
          {challenges.map((c) => {
            const on = c.id === activeChallenge?.id;
            return (
              <button
                key={c.id}
                onClick={() => { setActiveId(c.id); onClose(); }}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${on ? "border-gold bg-surface2" : "border-line"}`}
              >
                <div>
                  <p className="font-bold">{c.name}</p>
                  <p className="text-xs text-muted">
                    ends {new Date(c.end_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    {c.goal ? ` · ${c.goal}` : ""}
                  </p>
                </div>
                {on && <Check size={18} className="text-gold" />}
              </button>
            );
          })}
          {challenges.length === 0 && <p className="text-sm text-muted">No challenges yet — create one or join with a code.</p>}

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button className="pill flex items-center justify-center gap-1 py-3" onClick={() => setMode("create")}>
              <Plus size={16} /> Create
            </button>
            <button className="pill flex items-center justify-center gap-1 py-3" onClick={() => setMode("join")}>
              <LogIn size={16} /> Join with code
            </button>
          </div>
        </div>
      )}

      {mode === "create" && (
        <CreateForm userId={user.id} name={user.email?.split("@")[0]} onBack={() => setMode("list")}
          onDone={(id) => { refresh(); setActiveId(id); onClose(); }} />
      )}

      {mode === "join" && (
        <JoinForm onBack={() => setMode("list")} onDone={(id) => { refresh(); setActiveId(id); onClose(); }} />
      )}
    </Sheet>
  );
}

function CreateForm({ userId, name, onDone, onBack }) {
  const [form, setForm] = useState({ name: `${name || "Our"} Challenge`, end_date: defaultEndDate(30), goal: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function create() {
    setBusy(true); setErr(null);
    const { data: ch, error } = await supabase
      .from("challenges")
      .insert({ name: form.name || "Challenge", end_date: form.end_date, goal: form.goal || null, created_by: userId })
      .select().single();
    if (error) { setErr(error.message); setBusy(false); return; }
    await supabase.from("challenge_members").insert({ challenge_id: ch.id, user_id: userId });
    onDone(ch.id);
  }

  return (
    <div className="space-y-3">
      <Field label="Name"><input className="inp" value={form.name} onChange={set("name")} /></Field>
      <Field label="End date"><input className="inp" type="date" value={form.end_date} onChange={set("end_date")} /></Field>
      <Field label="Goal (optional)"><input className="inp" placeholder="e.g. 4 gym days a week, drop body fat" value={form.goal} onChange={set("goal")} /></Field>
      {err && <p className="text-sm text-ember">{err}</p>}
      <div className="flex gap-2">
        <button className="pill" onClick={onBack}>Back</button>
        <button className="btn-primary flex-1" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create challenge"}</button>
      </div>
    </div>
  );
}

function JoinForm({ onDone, onBack }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function join() {
    setBusy(true); setErr(null);
    const { data: cid, error } = await supabase.rpc("join_challenge", { code });
    if (error) { setErr(error.message); setBusy(false); return; }
    onDone(cid);
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full rounded-xl bg-surface2 px-4 py-3 text-center text-lg uppercase tracking-[0.3em] outline-none placeholder:text-muted"
        placeholder="ABC123" maxLength={6} value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      />
      {err && <p className="text-sm text-ember">{err}</p>}
      <div className="flex gap-2">
        <button className="pill" onClick={onBack}>Back</button>
        <button className="btn-primary flex-1" onClick={join} disabled={busy || code.length < 4}>{busy ? "Joining…" : "Join"}</button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="eyebrow mb-1 block">{label}</span>{children}</label>;
}
