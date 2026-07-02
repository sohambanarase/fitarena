import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { loadExercises } from "../lib/exercises.js";
import {
  loadGoals, addGoal, setGoalProgress, removeGoal, syncGoalsForExercise,
  logExercise, loadEntries, removeEntry, setsOf,
} from "../lib/grind.js";
import { toISO, startOfWeekISO } from "../lib/streak.js";
import Sheet from "../components/Sheet.jsx";
import Loader from "../components/Loader.jsx";
import { Plus, Target, Trash2, Check, ChevronLeft, ChevronRight, Search, X, Lock, Dumbbell } from "lucide-react";

const num = (v) => (v === "" || v == null ? null : Number(v));
const shiftISO = (iso, d) => { const [y, m, dd] = iso.split("-").map(Number); return toISO(new Date(y, m - 1, dd + d)); };
const dayLabel = (iso) => {
  const t = toISO(new Date()), y = shiftISO(t, -1);
  if (iso === t) return "Today";
  if (iso === y) return "Yesterday";
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};

const CATS = [
  { key: "Chest", muscles: ["chest"] },
  { key: "Back", muscles: ["lats", "middle back", "lower back", "traps"] },
  { key: "Shoulders", muscles: ["shoulders"] },
  { key: "Biceps", muscles: ["biceps"] },
  { key: "Triceps", muscles: ["triceps"] },
  { key: "Legs", muscles: ["quadriceps", "hamstrings", "glutes", "calves", "abductors", "adductors"] },
];

export default function Grind() {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [entries, setEntries] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(toISO(new Date()));
  const [addingGoal, setAddingGoal] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [logging, setLogging] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [g, e] = await Promise.all([loadGoals(user.id), loadEntries(user.id)]);
    setGoals(g); setEntries(e); setLoading(false);
  }, [user.id]);
  useEffect(() => { load(); loadExercises().then(setExercises); }, [load]);

  const ws = startOfWeekISO();
  const setsThisWeek = entries.filter((e) => e.log_date >= ws).reduce((s, e) => s + setsOf(e).length, 0);
  const dayEntries = entries.filter((e) => e.log_date === date);
  const today = toISO(new Date());

  return (
    <div className="screen space-y-4">
      <header className="pt-1">
        <p className="eyebrow text-gold">Your training camp</p>
        <h1 className="font-display text-3xl uppercase leading-none tracking-wide">The Grind</h1>
      </header>

      <div className="flex gap-2">
        <div className="glass flex-1 rounded-2xl px-3 py-2.5"><p className="eyebrow">Active goals</p><p className="font-score text-xl font-bold text-gold">{goals.length}</p></div>
        <div className="glass flex-1 rounded-2xl px-3 py-2.5"><p className="eyebrow">Sets this week</p><p className="font-score text-xl font-bold text-gold">{setsThisWeek}</p></div>
      </div>

      {loading ? <Loader label="Loading your grind…" /> : (
        <>
          {/* GOALS */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="eyebrow flex items-center gap-1"><Target size={12} /> Goals</p>
              <button onClick={() => setAddingGoal(true)} className="pill pill-on flex items-center gap-1"><Plus size={14} /> Add goal</button>
            </div>
            {goals.length === 0
              ? <p className="text-sm text-muted">No goals yet. Search a lift (e.g. “Bench Press”), set a target — it tracks itself as you log.</p>
              : goals.map((g) => <GoalCard key={g.id} g={g} onTap={() => setEditGoal(g)} />)}
          </section>

          {/* DATE NAV */}
          <div className="glass flex items-center justify-between rounded-2xl px-2 py-2">
            <button onClick={() => setDate((d) => shiftISO(d, -1))} className="grid h-9 w-9 place-items-center rounded-xl bg-surface2 active:scale-95"><ChevronLeft size={18} /></button>
            <label className="relative flex-1 cursor-pointer text-center">
              <span className="font-bold">{dayLabel(date)}</span>
              <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </label>
            <button onClick={() => setDate((d) => (d < today ? shiftISO(d, 1) : d))} disabled={date >= today}
              className="grid h-9 w-9 place-items-center rounded-xl bg-surface2 active:scale-95 disabled:opacity-30"><ChevronRight size={18} /></button>
          </div>

          {/* LOG for the selected day */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="eyebrow flex items-center gap-1"><Dumbbell size={12} /> Workout</p>
              <button onClick={() => setLogging(true)} className="pill pill-on flex items-center gap-1"><Plus size={14} /> Log workout</button>
            </div>
            {dayEntries.length === 0
              ? <p className="text-sm text-muted">Nothing logged for {dayLabel(date).toLowerCase()}. Tap “Log workout”.</p>
              : dayEntries.map((e) => {
                  const sets = setsOf(e);
                  const top = sets.reduce((m, s) => Math.max(m, s.weight || 0), 0);
                  return (
                    <button key={e.id} onClick={() => setDetail(e)} className="card flex w-full items-center justify-between text-left active:scale-[.99]">
                      <div>
                        <p className="font-bold capitalize">{e.exercise}</p>
                        <p className="text-[11px] text-muted">{sets.length} set{sets.length !== 1 ? "s" : ""}{top ? " · top " + top + "kg" : ""}</p>
                      </div>
                      <ChevronRight size={18} className="text-muted" />
                    </button>
                  );
                })}
          </section>
        </>
      )}

      {addingGoal && <AddGoalSheet userId={user.id} exercises={exercises} onClose={() => setAddingGoal(false)} onDone={load} />}
      {editGoal && <EditGoalSheet goal={editGoal} onClose={() => setEditGoal(null)} onDone={load} />}
      {logging && <LogFlow userId={user.id} date={date} exercises={exercises} onClose={() => setLogging(false)} onDone={load} />}
      {detail && <EntryDetail entry={detail} onClose={() => setDetail(null)} onDeleted={load} />}
    </div>
  );
}

function GoalCard({ g, onTap }) {
  const pct = g.target ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
  const done = g.target && g.current >= g.target;
  return (
    <button onClick={onTap} className="card w-full text-left active:scale-[.99]">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-bold capitalize">{g.title}{g.exercise && <span className="ml-1 text-[10px] font-normal uppercase tracking-wide text-mint">auto</span>}</p>
        {done ? <span className="pill pill-on flex shrink-0 items-center gap-1"><Check size={12} /> Smashed</span>
              : <span className="shrink-0 font-score text-sm text-gold">{g.current || 0}{g.target ? " / " + g.target : ""} {g.unit || ""}</span>}
      </div>
      {g.target != null && g.target !== "" && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface2">
          <div className={"h-full rounded-full transition-[width] duration-700 " + (done ? "bg-mint" : "bg-gold")} style={{ width: pct + "%" }} />
        </div>
      )}
    </button>
  );
}

/* -------- Add goal: search an exercise (auto) OR a custom goal -------- */
function AddGoalSheet({ userId, exercises, onClose, onDone }) {
  const [tab, setTab] = useState("exercise");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(null);
  const [target, setTarget] = useState("");
  const [custom, setCustom] = useState({ title: "", current: "", target: "", unit: "" });
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return exercises.filter((e) => e.name.toLowerCase().includes(n)).slice(0, 12);
  }, [q, exercises]);

  async function createExerciseGoal() {
    setBusy(true);
    const { data } = await addGoal({ user_id: userId, title: picked.name, exercise: picked.name, metric: "weight", target: num(target), current: 0, unit: "kg" });
    if (data) await syncGoalsForExercise(userId, picked.name); // reflect any past logs immediately
    setBusy(false); onDone(); onClose();
  }
  async function createCustomGoal() {
    setBusy(true);
    await addGoal({ user_id: userId, title: custom.title.trim(), target: num(custom.target), current: num(custom.current) || 0, unit: custom.unit.trim() || null });
    setBusy(false); onDone(); onClose();
  }

  return (
    <Sheet title="New goal" onClose={onClose}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button className={"pill py-2 " + (tab === "exercise" ? "pill-on" : "")} onClick={() => setTab("exercise")}>Track a lift</button>
        <button className={"pill py-2 " + (tab === "custom" ? "pill-on" : "")} onClick={() => setTab("custom")}>Custom</button>
      </div>

      {tab === "exercise" ? (
        picked ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-surface2 px-4 py-3">
              <span className="font-bold capitalize">{picked.name}</span>
              <button className="text-muted" onClick={() => setPicked(null)}><X size={18} /></button>
            </div>
            <label className="block">
              <span className="eyebrow mb-1 block">Target weight (kg)</span>
              <input className="inp" inputMode="decimal" placeholder="e.g. 100" value={target} onChange={(e) => setTarget(e.target.value)} autoFocus />
            </label>
            <p className="text-[11px] text-muted">Auto-completes when you log this lift at or above your target.</p>
            <button className="btn-primary w-full" onClick={createExerciseGoal} disabled={busy || !target}>{busy ? "Saving…" : "Create goal"}</button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2.5">
              <Search size={18} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a lift, e.g. Bench Press" className="w-full bg-transparent outline-none placeholder:text-muted" autoFocus />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {matches.map((e) => (
                <button key={e.id} onClick={() => setPicked(e)} className="flex w-full items-center justify-between rounded-xl bg-surface2 px-4 py-2.5 text-left active:scale-[.99]">
                  <span className="capitalize">{e.name}</span>
                  <span className="text-[11px] capitalize text-muted">{e.muscle}</span>
                </button>
              ))}
              {q && matches.length === 0 && <p className="px-1 text-sm text-muted">No match. Try another name or use a Custom goal.</p>}
            </div>
          </div>
        )
      ) : (
        <div className="space-y-3">
          <input className="inp" placeholder="Goal (e.g. Lose 3 kg)" value={custom.title} onChange={(e) => setCustom({ ...custom, title: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <input className="inp text-center" inputMode="decimal" placeholder="now" value={custom.current} onChange={(e) => setCustom({ ...custom, current: e.target.value })} />
            <input className="inp text-center" inputMode="decimal" placeholder="target" value={custom.target} onChange={(e) => setCustom({ ...custom, target: e.target.value })} />
            <input className="inp text-center" placeholder="unit" value={custom.unit} onChange={(e) => setCustom({ ...custom, unit: e.target.value })} />
          </div>
          <button className="btn-primary w-full" onClick={createCustomGoal} disabled={busy || !custom.title.trim()}>{busy ? "Saving…" : "Create goal"}</button>
        </div>
      )}
      <style>{`.inp{width:100%;border-radius:.75rem;background:rgba(39,34,49,.7);padding:.7rem 1rem;outline:none}`}</style>
    </Sheet>
  );
}

function EditGoalSheet({ goal, onClose, onDone }) {
  const [current, setCurrent] = useState(String(goal.current ?? ""));
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={goal.title} onClose={onClose}>
      <div className="space-y-3">
        <p className="eyebrow">{goal.exercise ? "Progress auto-tracks from your log — override if needed" : "Update progress"} {goal.unit ? "(" + goal.unit + ")" : ""}</p>
        <input className="inp text-center font-score text-2xl" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
        {goal.target && <p className="text-center text-sm text-muted">Target: {goal.target} {goal.unit || ""}</p>}
        <button className="btn-primary w-full" onClick={async () => { setBusy(true); await setGoalProgress(goal.id, Number(current) || 0); setBusy(false); onDone(); onClose(); }} disabled={busy}>{busy ? "Saving…" : "Save progress"}</button>
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-ember active:scale-[.98]" onClick={async () => { await removeGoal(goal.id); onDone(); onClose(); }}><Trash2 size={16} /> Delete goal</button>
        <style>{`.inp{width:100%;border-radius:.75rem;background:rgba(39,34,49,.7);padding:.7rem 1rem;outline:none}`}</style>
      </div>
    </Sheet>
  );
}

/* -------- Log flow: category → exercise → sets count → per-set entry -------- */
function LogFlow({ userId, date, exercises, onClose, onDone }) {
  const [step, setStep] = useState("cat");      // cat | ex | count | entry
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(null);
  const [ex, setEx] = useState(null);
  const [count, setCount] = useState(0);
  const [sets, setSets] = useState([]);         // saved sets [{weight,reps}]
  const [cur, setCur] = useState(0);
  const [w, setW] = useState("");
  const [r, setR] = useState("");
  const [busy, setBusy] = useState(false);

  const searchResults = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return exercises.filter((e) => e.name.toLowerCase().includes(n)).slice(0, 20);
  }, [q, exercises]);

  const catExercises = useMemo(() => {
    if (!cat) return [];
    return exercises.filter((e) => cat.muscles.includes(e.muscle)).sort((a, b) => a.name.localeCompare(b.name));
  }, [cat, exercises]);

  function pickExercise(e) { setEx(e); setStep("count"); }
  function pickCount(n) { setCount(n); setSets([]); setCur(0); setW(""); setR(""); setStep("entry"); }
  function saveSet() {
    const next = [...sets, { weight: num(w) || 0, reps: num(r) }];
    setSets(next); setCur(cur + 1); setW(""); setR("");
  }
  async function finish() {
    setBusy(true);
    await logExercise(userId, date, ex.name, sets);
    setBusy(false);
    // reset to log another exercise
    setStep("cat"); setCat(null); setEx(null); setCount(0); setSets([]); setCur(0); setQ("");
    onDone();
  }

  const title = step === "cat" ? "What did you train?" : step === "ex" ? cat.key : step === "count" ? ex.name : ex.name;

  return (
    <Sheet title={title} onClose={() => { onClose(); }}>
      {step === "cat" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2.5">
            <Search size={18} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any exercise" className="w-full bg-transparent outline-none placeholder:text-muted" />
            {q && <button onClick={() => setQ("")}><X size={16} className="text-muted" /></button>}
          </div>
          {q ? (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {searchResults.map((e) => (
                <button key={e.id} onClick={() => pickExercise(e)} className="flex w-full items-center justify-between rounded-xl bg-surface2 px-4 py-2.5 text-left active:scale-[.99]">
                  <span className="capitalize">{e.name}</span><span className="text-[11px] capitalize text-muted">{e.muscle}</span>
                </button>
              ))}
              {searchResults.length === 0 && <p className="text-sm text-muted">No match.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {CATS.map((c) => (
                <button key={c.key} onClick={() => { setCat(c); setStep("ex"); }} className="glass flex h-20 items-center justify-center rounded-2xl font-display text-xl uppercase tracking-wide active:scale-95">{c.key}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "ex" && (
        <div className="space-y-2">
          <button onClick={() => setStep("cat")} className="pill">← Categories</button>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {catExercises.map((e) => (
              <button key={e.id} onClick={() => pickExercise(e)} className="w-full rounded-xl bg-surface2 px-4 py-2.5 text-left capitalize active:scale-[.99]">{e.name}</button>
            ))}
          </div>
        </div>
      )}

      {step === "count" && (
        <div className="space-y-3">
          <p className="eyebrow">How many sets?</p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button key={n} onClick={() => pickCount(n)} className="glass grid h-14 place-items-center rounded-xl font-score text-lg font-bold active:scale-95">{n}</button>
            ))}
          </div>
          <button onClick={() => setStep("ex")} className="pill">← Back</button>
        </div>
      )}

      {step === "entry" && (
        <div className="space-y-2">
          {Array.from({ length: count }).map((_, i) => {
            if (i < cur) {
              const s = sets[i];
              return (
                <div key={i} className="flex items-center justify-between rounded-xl border border-line bg-surface2 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 font-bold"><Lock size={13} className="text-muted" /> Set {i + 1}</span>
                  <span className="font-score">{s.weight ? s.weight + "kg" : "bodyweight"}{s.reps ? " × " + s.reps : ""}</span>
                </div>
              );
            }
            if (i === cur) {
              return (
                <div key={i} className="rounded-xl border-2 border-gold bg-surface2 px-4 py-3">
                  <p className="mb-2 font-bold text-gold">Set {i + 1}</p>
                  <div className="flex items-center gap-2">
                    <input className="inp text-center" inputMode="decimal" placeholder="kg" value={w} onChange={(e) => setW(e.target.value)} autoFocus />
                    <span className="text-muted">×</span>
                    <input className="inp text-center" inputMode="numeric" placeholder="reps" value={r} onChange={(e) => setR(e.target.value)} />
                    <button className="btn-primary shrink-0 px-4" onClick={saveSet} disabled={!w && !r}>{i + 1 === count ? "Save" : "Next"}</button>
                  </div>
                </div>
              );
            }
            return <div key={i} className="rounded-xl border border-line px-4 py-3 text-sm text-muted">Set {i + 1}</div>;
          })}

          {cur >= count && (
            <button className="btn-primary mt-2 w-full" onClick={finish} disabled={busy}>{busy ? "Saving…" : "Finish " + ex.name}</button>
          )}
          <style>{`.inp{width:100%;border-radius:.75rem;background:rgba(18,16,26,.6);padding:.6rem;outline:none}`}</style>
        </div>
      )}
    </Sheet>
  );
}

function EntryDetail({ entry, onClose, onDeleted }) {
  const sets = setsOf(entry);
  return (
    <Sheet title={entry.exercise} onClose={onClose}>
      <div className="space-y-1.5">
        {sets.map((s, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-surface2 px-4 py-2.5">
            <span className="font-bold">Set {i + 1}</span>
            <span className="font-score">{s.weight ? s.weight + "kg" : "bodyweight"}{s.reps ? " × " + s.reps : ""}</span>
          </div>
        ))}
        {sets.length === 0 && <p className="text-sm text-muted">No set detail recorded.</p>}
      </div>
      <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-ember active:scale-[.98]"
        onClick={async () => { await removeEntry(entry.id); onDeleted(); onClose(); }}><Trash2 size={16} /> Delete exercise</button>
    </Sheet>
  );
}
