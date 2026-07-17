import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { loadExercises, imageUrl, imageFallback } from "../lib/exercises.js";
import {
  loadGoals, addGoal, setGoalProgress, removeGoal, syncGoalsForExercise,
  logExercise, loadEntries, removeEntry, setsOf,
  loadPlans, savePlan, deletePlan, logPlan,
  loadCustomExercises, addCustomExercise, updateEntry,
  saveSession, loadSessionSeconds,
} from "../lib/grind.js";
import { toISO, startOfWeekISO } from "../lib/streak.js";
import Sheet from "../components/Sheet.jsx";
import CountUp from "../components/CountUp.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import Loader from "../components/Loader.jsx";
import { Timer, Copy as CopyIcon } from "lucide-react";
import { Plus, Target, Trash2, Check, ChevronLeft, ChevronRight, Search, X, Lock, Dumbbell, Copy, Play, Pencil, Layers } from "lucide-react";

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

/* ---------- small shared bits ---------- */
function Thumb({ ex, size = 36 }) {
  const [stage, setStage] = useState(0);
  const path = ex?.images?.[0];
  const src = stage === 0 ? imageUrl(path) : stage === 1 ? imageFallback(path) : null;
  const cls = "shrink-0 rounded-lg object-cover bg-surface2";
  const style = { width: size, height: size };
  if (!path || stage === 2)
    return <div style={style} className={cls + " grid place-items-center font-display text-line"}>{(ex?.name || "?")[0]?.toUpperCase()}</div>;
  return <img src={src} alt="" loading="lazy" onError={() => setStage((s) => s + 1)} style={style} className={cls} />;
}
function SearchBox({ value, onChange, placeholder, autoFocus }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2.5">
      <Search size={18} className="text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} className="w-full bg-transparent outline-none placeholder:text-muted" />
      {value && <button onClick={() => onChange("")}><X size={16} className="text-muted" /></button>}
    </div>
  );
}
function ExRow({ ex, onClick, right }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl bg-surface2 px-3 py-2 text-left active:scale-[.99]">
      <Thumb ex={ex} />
      <span className="flex-1 truncate text-sm capitalize">{ex.name}</span>
      {right}
    </button>
  );
}
function ExerciseSearch({ exercises, onPick, placeholder = "Search exercises", autoFocus }) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return exercises.filter((e) => e.name.toLowerCase().includes(n)).slice(0, 20);
  }, [q, exercises]);
  return (
    <div className="space-y-2">
      <SearchBox value={q} onChange={setQ} placeholder={placeholder} autoFocus={autoFocus} />
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {matches.map((e) => <ExRow key={e.id} ex={e} onClick={() => onPick(e)} right={<span className="text-[11px] capitalize text-muted">{e.muscle}</span>} />)}
        {q && matches.length === 0 && <p className="px-1 text-sm text-muted">No match.</p>}
      </div>
    </div>
  );
}

/* ================= MAIN ================= */
export default function Grind() {
  const { user } = useAuth();
  const [tab, setTab] = useState("log"); // log | planner
  const [goals, setGoals] = useState([]);
  const [entries, setEntries] = useState([]);
  const [plans, setPlans] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(toISO(new Date()));
  const [addingGoal, setAddingGoal] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [logging, setLogging] = useState(false);
  const [detail, setDetail] = useState(null);
  const [editPlan, setEditPlan] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [logQueue, setLogQueue] = useState(null);
  const [logStart, setLogStart] = useState(0);
  const [sessionStart, setSessionStart] = useState(() => { try { const v = localStorage.getItem("fitarena.session"); return v ? Number(v) : null; } catch { return null; } });
  const startSession = useCallback(() => { setSessionStart((cur) => { if (cur) return cur; const t = Date.now(); try { localStorage.setItem("fitarena.session", String(t)); } catch {} return t; }); }, []);
  const [daySeconds, setDaySeconds] = useState(0);
  const refreshSessions = useCallback(() => loadSessionSeconds(user.id, date).then(setDaySeconds), [user.id, date]);
  useEffect(() => { refreshSessions(); }, [refreshSessions]);
  const stopSession = async () => {
    const startedAt = sessionStart;
    try { localStorage.removeItem("fitarena.session"); } catch {}
    setSessionStart(null);
    if (startedAt) { await saveSession(user.id, (Date.now() - startedAt) / 1000); refreshSessions(); }
  };
  const planStartIndex = useCallback((plan) => {
    const done = new Set(entries.filter((e) => e.log_date === date).map((e) => e.exercise.toLowerCase()));
    const idx = plan.exercises.findIndex((it) => !done.has(it.exercise.toLowerCase()));
    return idx < 0 ? 0 : idx;
  }, [entries, date]);

  const load = useCallback(async () => {
    setLoading(true);
    const [g, e, p] = await Promise.all([loadGoals(user.id), loadEntries(user.id), loadPlans(user.id)]);
    setGoals(g); setEntries(e); setPlans(p); setLoading(false);
  }, [user.id]);
  const loadEx = useCallback(async () => {
    const [base, custom] = await Promise.all([loadExercises(), loadCustomExercises(user.id)]);
    const mapped = custom.map((c) => ({ id: "custom-" + c.id, name: c.name, muscle: c.muscle || "", images: [], custom: true }));
    setExercises([...mapped, ...base]);
  }, [user.id]);
  useEffect(() => { load(); loadEx(); }, [load, loadEx]);
  const registerCustom = (ex) => setExercises((prev) => [ex, ...prev]);

  const exByName = useMemo(() => {
    const m = {}; exercises.forEach((e) => (m[e.name.toLowerCase()] = e)); return m;
  }, [exercises]);

  const ws = startOfWeekISO();
  const setsThisWeek = entries.filter((e) => e.log_date >= ws).reduce((s, e) => s + setsOf(e).length, 0);
  const dayEntries = entries.filter((e) => e.log_date === date);
  const today = toISO(new Date());

  return (
    <div className="screen animate-screen space-y-4">
      <ScreenHeader eyebrow="Your training camp" title="The Grind" />

      <div className="flex gap-2">
        <div className="glass flex-1 rounded-2xl px-3 py-2.5"><p className="eyebrow">Active goals</p><p className="font-score text-xl font-bold text-gold"><CountUp value={goals.length} duration={500} /></p></div>
        <div className="glass flex-1 rounded-2xl px-3 py-2.5"><p className="eyebrow">Sets this week</p><p className="font-score text-xl font-bold text-gold"><CountUp value={setsThisWeek} /></p></div>
        <div className="glass flex-1 rounded-2xl px-3 py-2.5"><p className="eyebrow">Exercises wk</p><p className="font-score text-xl font-bold text-gold"><CountUp value={entries.filter((e) => e.log_date >= ws).length} /></p></div>
      </div>

      <SessionBar start={sessionStart} onStart={startSession} onStop={stopSession} loggedSecs={daySeconds} />

      {/* Log / Planner switch */}
      <div className="glass grid grid-cols-2 gap-1 rounded-2xl p-1">
        {[["log", "Log"], ["planner", "Planner"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={"rounded-xl py-2 text-sm font-bold transition " + (tab === k ? "bg-gold text-ink" : "text-muted")}>{label}</button>
        ))}
      </div>

      {loading ? <Loader label="Loading your grind…" /> : tab === "log" ? (
        <>
          {/* GOALS */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="eyebrow flex items-center gap-1"><Target size={12} /> Goals</p>
              <button onClick={() => setAddingGoal(true)} className="pill pill-on flex items-center gap-1"><Plus size={14} /> Add goal</button>
            </div>
            {goals.length === 0
              ? <p className="text-sm text-muted">No goals yet. Search a lift (e.g. "Bench Press"), set a target — it tracks itself as you log.</p>
              : goals.map((g) => <GoalCard key={g.id} g={g} onTap={() => setEditGoal(g)} />)}
          </section>

          {/* DATE NAV */}
          <div className="glass flex items-center justify-between rounded-2xl px-2 py-2">
            <button onClick={() => setDate((d) => shiftISO(d, -1))} className="grid h-9 w-9 place-items-center rounded-xl bg-surface2 active:scale-95"><ChevronLeft size={18} /></button>
            <label className="relative flex-1 cursor-pointer text-center">
              <span className="font-bold">{dayLabel(date)}</span>
              <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </label>
            <button onClick={() => setDate((d) => (d < today ? shiftISO(d, 1) : d))} disabled={date >= today} className="grid h-9 w-9 place-items-center rounded-xl bg-surface2 active:scale-95 disabled:opacity-30"><ChevronRight size={18} /></button>
          </div>

          {/* LOG */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="eyebrow flex items-center gap-1"><Dumbbell size={12} /> Workout</p>
              <button onClick={() => { setLogQueue(null); setLogStart(0); setLogging(true); }} className="pill pill-on flex items-center gap-1"><Plus size={14} /> Log workout</button>
            </div>
            {dayEntries.length === 0
              ? <p className="text-sm text-muted">Nothing logged for {dayLabel(date).toLowerCase()}. Tap "Log workout".</p>
              : dayEntries.map((e) => {
                  const sets = setsOf(e);
                  const top = sets.reduce((m, s) => Math.max(m, s.weight || 0), 0);
                  return (
                    <button key={e.id} onClick={() => setDetail(e)} className="panel flex w-full items-center gap-3 p-3 text-left transition active:scale-[.99]">
                      <Thumb ex={exByName[e.exercise.toLowerCase()] || { name: e.exercise }} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold capitalize">{e.exercise}</p>
                        <p className="text-[11px] text-muted">{sets.length} set{sets.length !== 1 ? "s" : ""}{top ? " · top " + top + "kg" : ""}</p>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-muted" />
                    </button>
                  );
                })}
          </section>
        </>
      ) : (
        /* ============ PLANNER TAB ============ */
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1"><Layers size={12} /> Workout plans</p>
            <button onClick={() => setEditPlan(null)} className="pill pill-on flex items-center gap-1"><Plus size={14} /> New plan</button>
          </div>
          {plans.length === 0
            ? <p className="text-sm text-muted">No plans yet. Build a "Push Day" once, then start it in one tap any time.</p>
            : plans.map((p) => (
                <div key={p.id} className="card space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{p.name}</p>
                      <p className="text-[11px] text-muted">{p.exercises.length} exercise{p.exercises.length !== 1 ? "s" : ""}</p>
                    </div>
                    <button onClick={() => { setLogQueue(p.exercises); setLogStart(planStartIndex(p)); setLogging(true); }} className="btn-primary flex items-center gap-1 px-3 py-2 text-sm"><Play size={14} /> Start</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.exercises.slice(0, 4).map((x, i) => <span key={i} className="rounded-md bg-surface2 px-2 py-0.5 text-[11px] capitalize text-muted">{x.exercise}</span>)}
                    {p.exercises.length > 4 && <span className="text-[11px] text-muted">+{p.exercises.length - 4}</span>}
                  </div>
                  <div className="flex gap-2 border-t border-line pt-2 text-muted">
                    <button onClick={() => setEditPlan(p)} className="flex items-center gap-1 text-xs"><Pencil size={13} /> Edit</button>
                    <button onClick={async () => { await savePlan({ user_id: user.id, name: p.name + " copy", exercises: p.exercises }); load(); }} className="flex items-center gap-1 text-xs"><Copy size={13} /> Duplicate</button>
                    <button onClick={async () => { await deletePlan(p.id); load(); }} className="ml-auto flex items-center gap-1 text-xs text-ember"><Trash2 size={13} /> Delete</button>
                  </div>
                </div>
              ))}
        </section>
      )}

      {addingGoal && <AddGoalSheet userId={user.id} exercises={exercises} onClose={() => setAddingGoal(false)} onDone={load} />}
      {editGoal && <EditGoalSheet goal={editGoal} onClose={() => setEditGoal(null)} onDone={load} />}
      {logging && <LogFlow userId={user.id} date={date} exercises={exercises} registerCustom={registerCustom} queue={logQueue} doneNames={entries.filter((e) => e.log_date === date).map((e) => e.exercise.toLowerCase())} startSession={startSession} onClose={() => { setLogging(false); setLogQueue(null); refreshSessions(); }} onDone={load} />}
      {detail && <EntryDetail entry={detail} userId={user.id} onClose={() => setDetail(null)} onSaved={load} onDeleted={load} />}
      {editPlan !== undefined && <PlanEditor userId={user.id} exercises={exercises} exByName={exByName} registerCustom={registerCustom} plan={editPlan} onClose={() => setEditPlan(undefined)} onDone={load} />}
    </div>
  );
}

/* ---------- Goals ---------- */
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
function AddGoalSheet({ userId, exercises, onClose, onDone }) {
  const [tab, setTab] = useState("exercise");
  const [picked, setPicked] = useState(null);
  const [target, setTarget] = useState("");
  const [custom, setCustom] = useState({ title: "", current: "", target: "", unit: "" });
  const [busy, setBusy] = useState(false);

  async function createExerciseGoal() {
    setBusy(true);
    const { data } = await addGoal({ user_id: userId, title: picked.name, exercise: picked.name, metric: "weight", target: num(target), current: 0, unit: "kg" });
    if (data) await syncGoalsForExercise(userId, picked.name);
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
            <div className="flex items-center gap-3 rounded-xl bg-surface2 px-3 py-2.5">
              <Thumb ex={picked} /><span className="flex-1 font-bold capitalize">{picked.name}</span>
              <button className="text-muted" onClick={() => setPicked(null)}><X size={18} /></button>
            </div>
            <label className="block"><span className="eyebrow mb-1 block">Target weight (kg)</span>
              <input className="inp" inputMode="decimal" placeholder="e.g. 100" value={target} onChange={(e) => setTarget(e.target.value)} autoFocus /></label>
            <p className="text-[11px] text-muted">Auto-completes when you log this lift at or above your target.</p>
            <button className="btn-primary w-full" onClick={createExerciseGoal} disabled={busy || !target}>{busy ? "Saving…" : "Create goal"}</button>
          </div>
        ) : <ExerciseSearch exercises={exercises} onPick={setPicked} placeholder="Search a lift, e.g. Bench Press" autoFocus />
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
    </Sheet>
  );
}
function EditGoalSheet({ goal, onClose, onDone }) {
  const [current, setCurrent] = useState(String(goal.current ?? ""));
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={goal.title} onClose={onClose}>
      <div className="space-y-3">
        <p className="eyebrow">{goal.exercise ? "Auto-tracks from your log — override if needed" : "Update progress"} {goal.unit ? "(" + goal.unit + ")" : ""}</p>
        <input className="inp text-center font-score text-2xl" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
        {goal.target && <p className="text-center text-sm text-muted">Target: {goal.target} {goal.unit || ""}</p>}
        <button className="btn-primary w-full" onClick={async () => { setBusy(true); await setGoalProgress(goal.id, Number(current) || 0); setBusy(false); onDone(); onClose(); }} disabled={busy}>{busy ? "Saving…" : "Save progress"}</button>
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-ember active:scale-[.98]" onClick={async () => { await removeGoal(goal.id); onDone(); onClose(); }}><Trash2 size={16} /> Delete goal</button>
      </div>
    </Sheet>
  );
}

/* ---------- Log flow (category → exercise → sets → per-set) ---------- */
const CAT_MUSCLE = { Chest: "chest", Back: "lats", Shoulders: "shoulders", Biceps: "biceps", Triceps: "triceps", Legs: "quadriceps" };

function fmtClock(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(sec).padStart(2, "0");
}

// Session timer bar — manual start, auto-starts on first logged set, stop when done.
function SessionBar({ start, onStart, onStop, loggedSecs }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!start) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [start]);
  if (!start)
    return <button onClick={onStart} className="glass flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold text-muted active:scale-[.99]"><Timer size={15} /> Start gym session{loggedSecs > 0 ? " · " + Math.round(loggedSecs / 60) + " min logged today" : ""}</button>;
  const s = Math.max(0, Math.floor((now - start) / 1000));
  return (
    <div className="glass flex items-center justify-between rounded-2xl px-4 py-2.5">
      <span className="flex items-center gap-2 font-bold text-gold"><Timer size={16} className="animate-pulse-soft" /> Session {fmtClock(s)}</span>
      <button onClick={onStop} className="rounded-full bg-ember px-4 py-1.5 text-xs font-bold text-ink active:scale-95">Stop</button>
    </div>
  );
}

// Shared exercise picker: search + custom + body-part tiles → category list.
function ExercisePicker({ exercises, userId, registerCustom, onPick }) {
  const [mode, setMode] = useState("root"); // root | cat | custom
  const [cat, setCat] = useState(null);
  const [exQ, setExQ] = useState("");
  const [customName, setCustomName] = useState("");
  const [customCat, setCustomCat] = useState(null);
  const [saving, setSaving] = useState(false);

  const catExercises = useMemo(() => {
    if (!cat) return [];
    const list = exercises.filter((e) => cat.muscles.includes(e.muscle));
    const n = exQ.trim().toLowerCase();
    return (n ? list.filter((e) => e.name.toLowerCase().includes(n)) : list).sort((a, b) => a.name.localeCompare(b.name));
  }, [cat, exQ, exercises]);

  async function saveCustom() {
    if (!customName.trim()) return;
    setSaving(true);
    const muscle = customCat ? CAT_MUSCLE[customCat] : null;
    const { data } = await addCustomExercise(userId, customName, muscle);
    setSaving(false);
    const ex = { id: "custom-" + (data?.id || Date.now()), name: data?.name || customName.trim(), muscle: data?.muscle || muscle || "", images: [], custom: true };
    registerCustom?.(ex); onPick(ex);
  }

  if (mode === "custom") return (
    <div className="space-y-3">
      <button onClick={() => setMode("root")} className="pill">← Back</button>
      <label className="block"><span className="eyebrow mb-1 block">Exercise name</span>
        <input className="inp" placeholder="e.g. Cable Y-Raise" value={customName} onChange={(e) => setCustomName(e.target.value)} autoFocus /></label>
      <div><span className="eyebrow mb-1 block">Body part (optional)</span>
        <div className="flex flex-wrap gap-2">
          {CATS.map((c) => <button key={c.key} onClick={() => setCustomCat(customCat === c.key ? null : c.key)} className={"pill " + (customCat === c.key ? "pill-on" : "")}>{c.key}</button>)}
        </div></div>
      <button className="btn-primary w-full" disabled={!customName.trim() || saving} onClick={saveCustom}>{saving ? "Saving…" : "Add exercise"}</button>
    </div>
  );

  if (mode === "cat") return (
    <div className="space-y-2">
      <button onClick={() => { setMode("root"); setExQ(""); }} className="pill">← Categories</button>
      <SearchBox value={exQ} onChange={setExQ} placeholder={"Search in " + cat.key} autoFocus />
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {catExercises.map((e) => <ExRow key={e.id} ex={e} onClick={() => onPick(e)} />)}
        {catExercises.length === 0 && <p className="text-sm text-muted">No match in {cat.key}.</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <ExerciseSearch exercises={exercises} onPick={onPick} placeholder="Search any exercise" />
      <button onClick={() => setMode("custom")} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gold/50 py-3 text-sm font-bold text-gold active:scale-95"><Plus size={16} /> Add a custom exercise</button>
      <p className="eyebrow">or pick a body part</p>
      <div className="grid grid-cols-2 gap-2">
        {CATS.map((c) => <button key={c.key} onClick={() => { setCat(c); setExQ(""); setMode("cat"); }} className="glass flex h-16 items-center justify-center rounded-2xl font-display text-lg uppercase tracking-wide active:scale-95">{c.key}</button>)}
      </div>
    </div>
  );
}

// Unified log engine. Normal mode: pick → sets → entry. Plan mode (queue): walks the
// plan exercise-by-exercise, pre-filling each set with the target (editable), with rest
// timers between sets AND between exercises. Auto-starts the session on the first set.
function LogFlow({ userId, date, exercises, registerCustom, queue, doneNames = [], startSession, onClose, onDone }) {
  const isPlan = Array.isArray(queue) && queue.length > 0;
  const exByNameLocal = useMemo(() => { const m = {}; exercises.forEach((e) => (m[e.name.toLowerCase()] = e)); return m; }, [exercises]);
  const resolveEx = useCallback((name, i) => exByNameLocal[name.toLowerCase()] || { id: "q" + i, name, images: [], muscle: "" }, [exByNameLocal]);

  const [qIdx, setQIdx] = useState(0);
  const [sessionDone, setSessionDone] = useState([]);
  const doneSet = useMemo(() => new Set([...(doneNames || []), ...sessionDone].map((n) => n.toLowerCase())), [doneNames, sessionDone]);
  const [step, setStep] = useState("pick");
  const [ex, setEx] = useState(null);
  const [count, setCount] = useState(0);
  const [target, setTarget] = useState(null);
  const [sets, setSets] = useState([]);
  const [cur, setCur] = useState(0);
  const [w, setW] = useState("");
  const [r, setR] = useState("");
  const [busy, setBusy] = useState(false);
  const [restSince, setRestSince] = useState(null);
  const [restNow, setRestNow] = useState(0);
  useEffect(() => { if (!restSince) return; const t = setInterval(() => setRestNow(Date.now()), 1000); return () => clearInterval(t); }, [restSince]);
  const restSecs = restSince ? Math.floor((restNow - restSince) / 1000) : 0;

  const enterEntry = useCallback((exObj, nSets, tgt) => {
    setEx(exObj); setCount(Math.max(1, nSets || 3)); setTarget(tgt || null);
    setSets([]); setCur(0); setRestSince(null);
    setW(tgt && tgt.weight != null && tgt.weight !== "" ? String(tgt.weight) : "");
    setR(tgt && tgt.reps != null && tgt.reps !== "" ? String(tgt.reps) : "");
    setStep("entry");
  }, []);

  // plan mode: jump straight into the first exercise
  useEffect(() => { setStep(isPlan ? "chooser" : "pick"); /* eslint-disable-next-line */ }, []);
  function beginPlanExercise(i) { const it = queue[i]; setQIdx(i); enterEntry(resolveEx(it.exercise, i), Number(it.sets) || 3, { weight: it.weight, reps: it.reps }); }

  const prefill = (tgt) => { setW(tgt && tgt.weight != null && tgt.weight !== "" ? String(tgt.weight) : ""); setR(tgt && tgt.reps != null && tgt.reps !== "" ? String(tgt.reps) : ""); };

  function pickExercise(e) { setEx(e); setStep("count"); }
  function pickCount(n) { enterEntry(ex, n, null); }
  function saveSet() {
    startSession && startSession();
    setSets((prev) => [...prev, { weight: num(w) || 0, reps: num(r) }]);
    setCur((c) => c + 1); prefill(target);
    setRestSince(Date.now()); setRestNow(Date.now());
  }
  function sameAsLast() { const last = sets[sets.length - 1]; if (last) { setW(last.weight ? String(last.weight) : ""); setR(last.reps ? String(last.reps) : ""); } }

  async function finish() {
    setBusy(true); await logExercise(userId, date, ex.name, sets); setBusy(false); onDone();
    if (isPlan) { setSessionDone((prev) => [...prev, ex.name.toLowerCase()]); setRestSince(null); setStep("chooser"); return; }
    setRestSince(Date.now()); setRestNow(Date.now()); setStep("rest");
  }
  function logAnother() { setEx(null); setCount(0); setSets([]); setCur(0); setTarget(null); setRestSince(null); setStep("pick"); }

  const title = step === "chooser" ? "Your plan" : step === "pick" ? "What did you train?" : step === "rest" ? "Rest" : (ex?.name || "Log");

  return (
    <Sheet title={title} onClose={onClose}>
      {step === "pick" && <ExercisePicker exercises={exercises} userId={userId} registerCustom={registerCustom} onPick={pickExercise} />}

      {step === "chooser" && (
        <div className="space-y-2">
          <p className="eyebrow">Tap an exercise to log{doneSet.size > 0 ? " · " + doneSet.size + " done today" : ""}</p>
          {queue.map((it, i) => {
            const done = doneSet.has(it.exercise.toLowerCase());
            return (
              <button key={i} onClick={() => beginPlanExercise(i)} className={"flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[.99] " + (done ? "bg-surface2 opacity-70" : "panel")}>
                <Thumb ex={exByNameLocal[it.exercise.toLowerCase()] || { name: it.exercise }} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold capitalize">{it.exercise}</p>
                  <p className="text-[11px] text-muted">{it.sets} × {it.reps || "?"}{it.weight ? " · " + it.weight + "kg" : ""}{done ? " · logged" : ""}</p>
                </div>
                {done ? <Check size={18} className="shrink-0 text-mint" /> : <Play size={16} className="shrink-0 text-gold" />}
              </button>
            );
          })}
          <button onClick={onClose} className="pill mx-auto mt-2 block px-6 py-2">Done for now</button>
        </div>
      )}

      {step === "count" && (
        <div className="space-y-3">
          <p className="eyebrow">How many sets? (you can add more later)</p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <button key={n} onClick={() => pickCount(n)} className="glass grid h-14 place-items-center rounded-xl font-score text-lg font-bold active:scale-95">{n}</button>)}
          </div>
          <button onClick={() => setStep("pick")} className="pill">← Back</button>
        </div>
      )}

      {step === "entry" && (
        <div className="space-y-2">
          {restSince && cur < count && (
            <div className="glass sticky top-0 z-10 flex items-center justify-between rounded-full px-4 py-2">
              <span className="flex items-center gap-2 text-sm font-bold text-gold"><Timer size={15} className="animate-pulse-soft" /> Rest {fmtClock(restSecs)}</span>
              <button onClick={() => setRestSince(null)} className="text-[11px] font-semibold text-muted">dismiss</button>
            </div>
          )}
          {isPlan && <button onClick={() => setStep("chooser")} className="pill">← Back to plan</button>}
          {isPlan && <p className="eyebrow">{ex?.name}{target ? " · target " + (target.weight || "?") + "kg × " + (target.reps || "?") : ""}</p>}
          {Array.from({ length: count }).map((_, i) => {
            if (i < cur) { const s = sets[i]; return (
              <div key={i} className="flex items-center justify-between rounded-xl border border-line bg-surface2 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 font-bold"><Lock size={13} className="text-muted" /> Set {i + 1}</span>
                <span className="font-score">{s.weight ? s.weight + "kg" : "bodyweight"}{s.reps ? " × " + s.reps : ""}</span>
              </div>); }
            if (i === cur) return (
              <div key={i} className="rounded-xl border-2 border-gold bg-surface px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-bold text-gold">Set {i + 1} <span className="text-[11px] font-normal text-muted">of {count}</span></p>
                  <div className="flex gap-1.5">
                    {sets.length > 0 && <button onClick={sameAsLast} className="pill flex items-center gap-1"><CopyIcon size={12} /> same as last</button>}
                    <button onClick={() => setCount(count + 1)} className="pill flex items-center gap-1"><Plus size={12} /> set</button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input className="inp py-4 text-center text-lg font-bold" inputMode="decimal" placeholder="kg" value={w} onChange={(e) => setW(e.target.value)} autoFocus />
                  <span className="text-muted">×</span>
                  <input className="inp py-4 text-center text-lg font-bold" inputMode="numeric" placeholder="reps" value={r} onChange={(e) => setR(e.target.value)} />
                  <button className="btn-primary shrink-0 px-5 py-4" onClick={saveSet} disabled={!w && !r}>{i + 1 === count ? "Save" : "Next"}</button>
                </div>
              </div>);
            return <div key={i} className="rounded-xl border border-line px-4 py-3 text-sm text-muted">Set {i + 1}</div>;
          })}
          {cur >= count && (
            <div className="sticky bottom-0 z-10 -mx-1 space-y-2 bg-gradient-to-t from-black/20 to-transparent px-1 pb-1 pt-3">
              <button onClick={() => setCount(count + 1)} className="pill flex w-full items-center justify-center gap-1 py-2.5"><Plus size={13} /> Add another set</button>
              <button className="btn-primary w-full animate-pop py-4 text-base" onClick={finish} disabled={busy}>{busy ? "Saving…" : "Finish " + ex.name + " ✓"}</button>
            </div>
          )}
        </div>
      )}

      {step === "rest" && (
        <div className="space-y-4 py-4 text-center">
          <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border-4 border-gold">
            <span className="font-score text-3xl font-bold text-gold">{fmtClock(restSecs)}</span>
          </div>
          <p className="eyebrow">Rest</p>
          <div className="space-y-2">
            <button className="btn-primary w-full py-4 text-base" onClick={logAnother}>Log another exercise</button>
            <button className="pill mx-auto block px-6 py-2" onClick={onClose}>Done for now</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// Tap a logged exercise → edit/add/delete sets, or delete the whole thing.
function EntryDetail({ entry, userId, onClose, onSaved, onDeleted }) {
  const [sets, setSets] = useState(() => setsOf(entry).map((s) => ({ weight: s.weight ?? "", reps: s.reps ?? "" })));
  const [busy, setBusy] = useState(false);
  const setField = (i, k, v) => setSets(sets.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const addSet = () => { const last = sets[sets.length - 1]; setSets([...sets, { weight: last?.weight ?? "", reps: last?.reps ?? "" }]); };
  const delSet = (i) => setSets(sets.filter((_, j) => j !== i));
  async function save() {
    setBusy(true);
    const clean = sets.map((s) => ({ weight: num(s.weight) || 0, reps: num(s.reps) }));
    await updateEntry(entry.id, clean, userId, entry.exercise);
    setBusy(false); onSaved(); onClose();
  }
  return (
    <Sheet title={entry.exercise} onClose={onClose}>
      <p className="eyebrow mb-2">Edit sets</p>
      <div className="space-y-2">
        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2">
            <span className="w-12 text-sm font-bold text-muted">Set {i + 1}</span>
            <input className="inp flex-1 py-2.5 text-center" inputMode="decimal" placeholder="kg" value={s.weight} onChange={(e) => setField(i, "weight", e.target.value)} />
            <span className="text-muted">×</span>
            <input className="inp flex-1 py-2.5 text-center" inputMode="numeric" placeholder="reps" value={s.reps} onChange={(e) => setField(i, "reps", e.target.value)} />
            <button onClick={() => delSet(i)} className="text-muted active:scale-90 hover:text-ember"><Trash2 size={16} /></button>
          </div>
        ))}
        {sets.length === 0 && <p className="text-sm text-muted">No sets. Add one below.</p>}
      </div>
      <button onClick={addSet} className="pill mt-2 flex w-full items-center justify-center gap-1 py-2.5"><Plus size={14} /> Add set</button>
      <button className="btn-primary mt-3 w-full" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      <button className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-ember active:scale-[.98]" onClick={async () => { await removeEntry(entry.id); onDeleted(); onClose(); }}><Trash2 size={16} /> Delete exercise</button>
    </Sheet>
  );
}

/* ---------- Planner ---------- */
function PlanEditor({ userId, exercises, exByName, registerCustom, plan, onClose, onDone }) {
  const [name, setName] = useState(plan?.name || "");
  const [items, setItems] = useState(plan?.exercises || []);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const setItem = (i, patch) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const removeItem = (i) => setItems(items.filter((_, j) => j !== i));

  async function save() {
    setBusy(true);
    await savePlan({ id: plan?.id, user_id: userId, name: name.trim() || "My plan", exercises: items });
    setBusy(false); onDone(); onClose();
  }

  if (adding) return (
    <Sheet title="Add exercise" onClose={() => setAdding(false)}>
      <ExercisePicker exercises={exercises} userId={userId} registerCustom={registerCustom}
        onPick={(e) => { setItems([...items, { exercise: e.name, sets: 3, reps: 8, weight: "" }]); setAdding(false); }} />
    </Sheet>
  );

  return (
    <Sheet title={plan ? "Edit plan" : "New plan"} onClose={onClose}>
      <div className="space-y-3">
        <input className="inp" placeholder="Plan name (e.g. Push Day)" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-xl bg-surface2 p-2">
              <div className="mb-1.5 flex items-center gap-2">
                <Thumb ex={exByName[it.exercise.toLowerCase()] || { name: it.exercise }} size={28} />
                <span className="flex-1 truncate text-sm font-bold capitalize">{it.exercise}</span>
                <button onClick={() => removeItem(i)} className="text-muted"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Mini label="sets" value={it.sets} onChange={(v) => setItem(i, { sets: num(v) })} />
                <Mini label="reps" value={it.reps} onChange={(v) => setItem(i, { reps: num(v) })} />
                <Mini label="kg" value={it.weight} onChange={(v) => setItem(i, { weight: v })} />
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setAdding(true)} className="pill flex w-full items-center justify-center gap-1 py-2.5"><Plus size={14} /> Add exercise</button>
        <button className="btn-primary w-full" onClick={save} disabled={busy || !name.trim() || items.length === 0}>{busy ? "Saving…" : "Save plan"}</button>
      </div>
    </Sheet>
  );
}
function Mini({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-1 rounded-lg bg-surface2 px-2 py-1.5">
      <input className="w-full bg-transparent text-center outline-none" inputMode="decimal" placeholder={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      <span className="text-[10px] text-muted">{label}</span>
    </label>
  );
}
