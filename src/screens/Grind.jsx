import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { loadExercises, imageUrl, imageFallback } from "../lib/exercises.js";
import {
  loadGoals, addGoal, setGoalProgress, removeGoal, syncGoalsForExercise,
  logExercise, loadEntries, removeEntry, setsOf,
  loadPlans, savePlan, deletePlan, logPlan,
  loadCustomExercises, addCustomExercise, updateEntry,
  saveSession, loadSessionSeconds,
} from "../lib/grind.js";
import { loadTimerPrefs } from "../lib/timerPrefs.js";
import { toISO, startOfWeekISO } from "../lib/streak.js";
import Sheet from "../components/Sheet.jsx";
import CountUp from "../components/CountUp.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import Loader from "../components/Loader.jsx";
import { Timer, Copy as CopyIcon } from "lucide-react";
import { Plus, Target, Trash2, Check, ChevronLeft, ChevronRight, Search, X, Lock, Dumbbell, Copy, Play, Pencil, Layers, TrendingUp, LineChart} from "lucide-react";

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
  const lastByExercise = useMemo(() => {
    // entries arrive newest-first; keep the first past-day occurrence of each exercise
    const map = {};
    for (const e of entries) {
      if (e.log_date === date) continue;
      const key = e.exercise.toLowerCase();
      if (!map[key]) map[key] = { date: e.log_date, sets: setsOf(e) };
    }
    return map;
  }, [entries, date]);
  const [addingGoal, setAddingGoal] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [logging, setLogging] = useState(false);
  const [detail, setDetail] = useState(null);
  const [editPlan, setEditPlan] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [logQueue, setLogQueue] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
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
  const editSession = (seconds) => {
    const t = Date.now() - Math.max(0, seconds) * 1000;   // shift the start so the clock reads `seconds`
    setSessionStart(t);
    try { localStorage.setItem("fitarena.session", String(t)); } catch {}
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
      <ScreenHeader eyebrow="Your training camp" title="The Grind" right={
        <button onClick={() => setShowHistory(true)} aria-label="Exercise history" className="flex items-center gap-1.5 rounded-full bg-surface2 px-3 py-2 text-[11px] font-bold text-muted active:scale-95">
          <LineChart size={15} /> History
        </button>
      } />

      <div className="flex gap-2">
        <div className="glass flex-1 rounded-2xl px-3 py-2.5"><p className="eyebrow">Active goals</p><p className="font-score text-xl font-bold text-gold"><CountUp value={goals.length} duration={500} /></p></div>
        <div className="glass flex-1 rounded-2xl px-3 py-2.5"><p className="eyebrow">Sets this week</p><p className="font-score text-xl font-bold text-gold"><CountUp value={setsThisWeek} /></p></div>
        <div className="glass flex-1 rounded-2xl px-3 py-2.5"><p className="eyebrow">Exercises wk</p><p className="font-score text-xl font-bold text-gold"><CountUp value={entries.filter((e) => e.log_date >= ws).length} /></p></div>
      </div>

      <SessionBar start={sessionStart} onStart={startSession} onStop={stopSession} onEdit={editSession} loggedSecs={daySeconds} />

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
      {showHistory && <ExerciseHistorySheet userId={user.id} onClose={() => setShowHistory(false)} />}
      {logging && <LogFlow userId={user.id} date={date} exercises={exercises} registerCustom={registerCustom} queue={logQueue} doneNames={entries.filter((e) => e.log_date === date).map((e) => e.exercise.toLowerCase())} lastByExercise={lastByExercise} startSession={startSession} onClose={() => { setLogging(false); setLogQueue(null); refreshSessions(); }} onDone={load} />}
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

function fmtDate(iso) {
  try { const d = new Date(iso + "T00:00:00"); const t = new Date(); const diff = Math.round((new Date(t.toISOString().slice(0,10)) - new Date(iso)) / 86400000);
    if (diff === 0) return "today"; if (diff === 1) return "yesterday"; if (diff < 7) return diff + " days ago";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return iso; }
}
function fmtClock(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(sec).padStart(2, "0");
}

// Session timer bar — manual start, auto-starts on first logged set, stop when done.
function SessionBar({ start, onStart, onStop, onEdit, loggedSecs }) {
  const [now, setNow] = useState(Date.now());
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!start) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [start]);
  const s = start ? Math.max(0, Math.floor((now - start) / 1000)) : 0;

  return (
    <>
      {!start ? (
        <div className="flex items-center gap-2">
          <button onClick={onStart} className="glass flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold text-muted active:scale-[.99]">
            <Timer size={15} /> Start gym session{loggedSecs > 0 ? " · " + Math.round(loggedSecs / 60) + " min logged today" : ""}
          </button>
          <button onClick={() => setEditing(true)} aria-label="Edit session time" className="glass grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-muted active:scale-90"><Pencil size={15} /></button>
        </div>
      ) : (
        <div className="glass flex items-center justify-between rounded-2xl px-4 py-2.5">
          <span className="flex items-center gap-2 font-bold text-gold"><Timer size={16} className="animate-pulse-soft" /> Session {fmtClock(s)}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)} aria-label="Edit session time" className="grid h-7 w-7 place-items-center rounded-full bg-surface2 text-muted active:scale-90"><Pencil size={13} /></button>
            <button onClick={onStop} className="rounded-full bg-ember px-4 py-1.5 text-xs font-bold text-ink active:scale-95">Stop</button>
          </div>
        </div>
      )}
      {editing && (
        <SessionEditSheet
          seconds={s}                              /* read once on open; the sheet won't re-sync while you type */
          running={!!start}
          onClose={() => setEditing(false)}
          onApply={(sec) => { onEdit(sec); setEditing(false); }}
        />
      )}
    </>
  );
}

function SessionEditSheet({ seconds, running, onClose, onApply }) {
  // Fields hold raw text while typing. Tapping a field CLEARS it (rather than relying on
  // select-on-focus, which mobile Safari ignores) so what you type replaces the old value
  // instead of being appended to it. Leaving a field blank restores what was there.
  const [h, setH] = useState(String(Math.floor(seconds / 3600)));
  const [m, setM] = useState(String(Math.floor((seconds % 3600) / 60)));
  const [sc, setSc] = useState(String(seconds % 60));
  const prior = useRef({});

  const val = (t, max) => Math.max(0, Math.min(max, parseInt(t || "0", 10) || 0));
  // minutes/seconds may exceed 59 while typing (e.g. "90"); they roll over when you leave the field
  const total = Math.min(24 * 3600 - 1, val(h, 23) * 3600 + val(m, 599) * 60 + val(sc, 599));

  const fromTotal = (t) => {
    const x = Math.max(0, Math.min(24 * 3600 - 1, Math.round(t)));
    setH(String(Math.floor(x / 3600))); setM(String(Math.floor((x % 3600) / 60))); setSc(String(x % 60));
  };

  const fields = [["Hours", "h", h, setH], ["Min", "m", m, setM], ["Sec", "s", sc, setSc]];

  return (
    <Sheet title={running ? "Edit session time" : "Set session time"} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {running
            ? "Type the total time you want on the clock, then it keeps counting from there. Handy if you forgot to start or stop it."
            : "Start the session already part-way through, if you forgot to start it earlier."}
        </p>

        <div className="flex items-end justify-center gap-2">
          {fields.map(([label, key, value, setter]) => (
            <div key={key} className="text-center">
              <input
                inputMode="numeric"
                value={value}
                placeholder={prior.current[key] != null ? prior.current[key] : "0"}
                onFocus={() => { prior.current[key] = value; setter(""); }}
                onChange={(e) => setter(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                onBlur={() => {
                  if (value === "") setter(prior.current[key] != null ? prior.current[key] : "0");
                  else fromTotal(total);
                }}
                className="inp w-20 py-3 text-center font-score text-2xl font-bold"
              />
              <p className="mt-1 text-[10px] text-muted">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-1.5">
          {[-10, -5, -1, 1, 5, 10].map((n) => (
            <button key={n} onClick={() => fromTotal(total + n * 60)} className="pill text-[11px]">{n > 0 ? "+" : ""}{n}m</button>
          ))}
          <button onClick={() => fromTotal(0)} className="pill text-[11px]">reset</button>
        </div>

        <p className="text-center font-score text-2xl font-bold text-gold">{fmtClock(total)}</p>
        <button className="btn-primary w-full py-3.5" onClick={() => onApply(total)}>
          {running ? "Set timer to " + fmtClock(total) : "Start session at " + fmtClock(total)}
        </button>
        <p className="text-center text-[11px] text-muted">This sets the clock to exactly this time, it doesn't add to it.</p>
      </div>
    </Sheet>
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
function LogFlow({ userId, date, exercises, registerCustom, queue, doneNames = [], lastByExercise = {}, startSession, onClose, onDone }) {
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
  const prefs = useMemo(() => loadTimerPrefs(), []);
  // last time this exercise was trained (for the per-set hint)
  const lastSets = useMemo(() => (ex ? (lastByExercise[ex.name.toLowerCase()] || null) : null), [ex, lastByExercise]);

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
          {restSince && cur < count && (() => {
            const over = prefs.setRest > 0 && restSecs >= prefs.setRest;
            return (
              <div className={"sticky top-0 z-10 flex items-center justify-between rounded-full px-4 py-2 transition-colors " + (over ? "animate-pulse-rest bg-ember/90 text-ink" : "glass")}>
                <span className={"flex items-center gap-2 text-sm font-bold " + (over ? "text-ink" : "text-gold")}>
                  <Timer size={15} className={over ? "" : "animate-pulse-soft"} /> Rest {fmtClock(restSecs)}{prefs.setRest > 0 ? " / " + fmtClock(prefs.setRest) : ""}
                </span>
                <button onClick={() => setRestSince(null)} className={"text-[11px] font-semibold " + (over ? "text-ink/80" : "text-muted")}>{over ? "back to it!" : "dismiss"}</button>
              </div>
            );
          })()}
          {isPlan && <button onClick={() => setStep("chooser")} className="pill">← Back to plan</button>}
          {isPlan && <p className="eyebrow">{ex?.name}{target ? " · target " + (target.weight || "?") + "kg × " + (target.reps || "?") : ""}</p>}
          {lastSets && (
            <div className="rounded-xl border border-line bg-surface2 px-3 py-2">
              <p className="text-[11px] font-bold text-muted">Last time ({fmtDate(lastSets.date)})</p>
              <p className="mt-0.5 text-[12px]">{lastSets.sets.map((st, k) => (st.weight ? st.weight + "kg" : "BW") + (st.reps ? "×" + st.reps : "")).join("  ·  ")}</p>
            </div>
          )}
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
                {lastSets && lastSets.sets[i] && (
                  <p className="mt-1.5 text-[11px] text-muted">Last time · {lastSets.sets[i].weight ? lastSets.sets[i].weight + "kg" : "bodyweight"}{lastSets.sets[i].reps ? " × " + lastSets.sets[i].reps : ""}</p>
                )}
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

      {step === "rest" && (() => {
        const over = prefs.exRest > 0 && restSecs >= prefs.exRest;
        return (
        <div className={"space-y-4 rounded-2xl py-6 text-center transition-colors " + (over ? "animate-pulse-rest bg-ember/90" : "")}>
          <div className={"mx-auto grid h-28 w-28 place-items-center rounded-full border-4 " + (over ? "border-ink" : "border-gold")}>
            <span className={"font-score text-3xl font-bold " + (over ? "text-ink" : "text-gold")}>{fmtClock(restSecs)}</span>
          </div>
          <p className={"eyebrow " + (over ? "text-ink" : "")}>{over ? "Time to move — back to it!" : "Rest" + (prefs.exRest > 0 ? " · target " + fmtClock(prefs.exRest) : "")}</p>
          <div className="space-y-2">
            <button className="btn-primary w-full py-4 text-base" onClick={logAnother}>Log another exercise</button>
            <button className={"pill mx-auto block px-6 py-2 " + (over ? "!text-ink" : "")} onClick={onClose}>Done for now</button>
          </div>
        </div>
        );
      })()}
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

/* ---------- Exercise history & progression ---------- */
const SET_COLORS = ["rgb(var(--c-gold))", "rgb(var(--c-mint))", "rgb(var(--c-ember))", "#6C8CF5", "#B072E8", "#E8A33D"];
const e1rm = (w, r) => (w && r ? Math.round(w * (1 + r / 30)) : w || 0);

function ExerciseHistorySheet({ userId, onClose }) {
  const [range, setRange] = useState(30);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [all, setAll] = useState(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(null);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    setAll(null);
    const days = range === "custom" ? 1095 : range;
    loadEntries(userId, Math.max(days, 7)).then(setAll).catch(() => setAll([]));
  }, [userId, range]);

  const inRange = useCallback((iso) => {
    if (range === "custom") {
      if (from && iso < from) return false;
      if (to && iso > to) return false;
      return true;
    }
    return iso >= toISO(new Date(Date.now() - range * 86400000));
  }, [range, from, to]);

  const rows = useMemo(() => (all || []).filter((e) => inRange(e.log_date)), [all, inRange]);

  // exercise list with how often it appears
  const exList = useMemo(() => {
    const m = {};
    rows.forEach((e) => {
      const k = e.exercise.toLowerCase();
      if (!m[k]) m[k] = { name: e.exercise, sessions: 0, last: e.log_date };
      m[k].sessions++;
      if (e.log_date > m[k].last) m[k].last = e.log_date;
    });
    const list = Object.values(m).sort((a, b) => b.sessions - a.sessions);
    const needle = q.trim().toLowerCase();
    return needle ? list.filter((x) => x.name.toLowerCase().includes(needle)) : list;
  }, [rows, q]);

  // sessions for the picked exercise, oldest first
  const sessions = useMemo(() => {
    if (!picked) return [];
    return rows
      .filter((e) => e.exercise.toLowerCase() === picked.toLowerCase())
      .map((e) => {
        const sets = setsOf(e).map((s) => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 }));
        const volume = sets.reduce((n, s) => n + s.weight * s.reps, 0);
        const top = sets.reduce((n, s) => Math.max(n, s.weight), 0);
        const best1rm = sets.reduce((n, s) => Math.max(n, e1rm(s.weight, s.reps)), 0);
        return { id: e.id, date: e.log_date, sets, volume, top, best1rm, reps: sets.reduce((n, s) => n + s.reps, 0) };
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [rows, picked]);

  const stats = useMemo(() => {
    if (!sessions.length) return null;
    const prWeight = Math.max(...sessions.map((s) => s.top));
    const pr1rm = Math.max(...sessions.map((s) => s.best1rm));
    const bestVol = Math.max(...sessions.map((s) => s.volume));
    const totalSets = sessions.reduce((n, s) => n + s.sets.length, 0);
    const first = sessions[0], last = sessions[sessions.length - 1];
    return {
      prWeight, pr1rm, bestVol, totalSets, count: sessions.length,
      topDelta: last.top - first.top,
      volDelta: last.volume - first.volume,
      firstDate: first.date, lastDate: last.date,
    };
  }, [sessions]);

  const maxSets = Math.min(6, sessions.reduce((n, s) => Math.max(n, s.sets.length), 0));

  return (
    <Sheet title="Exercise history" onClose={onClose}>
      <div className="space-y-3">
        {/* range picker */}
        <div className="flex flex-wrap gap-1.5">
          {[[7, "7 days"], [30, "30 days"], [90, "3 months"], [180, "6 months"], [365, "1 year"], ["custom", "Custom"]].map(([v, l]) => (
            <button key={l} onClick={() => { setRange(v); setSel(null); }} className={"pill text-[11px] " + (range === v ? "pill-on" : "")}>{l}</button>
          ))}
        </div>
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="inp flex-1 py-2 text-xs" />
            <span className="text-xs text-muted">to</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="inp flex-1 py-2 text-xs" />
          </div>
        )}

        {all === null ? <Loader label="Loading your history…" /> : !picked ? (
          <>
            <div className="search-glass"><Search size={18} className="text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search an exercise" className="w-full bg-transparent outline-none placeholder:text-muted" /></div>
            <div className="max-h-[52vh] space-y-1.5 overflow-y-auto">
              {exList.length === 0 && <p className="px-1 text-sm text-muted">Nothing logged in this range. Try a longer period.</p>}
              {exList.map((x) => (
                <button key={x.name} onClick={() => { setPicked(x.name); setSel(null); }} className="panel flex w-full items-center gap-3 p-2.5 text-left active:scale-[.99]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold capitalize">{x.name}</p>
                    <p className="text-[11px] text-muted">{x.sessions} session{x.sessions !== 1 ? "s" : ""} · last {fmtDate(x.last)}</p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-muted" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => { setPicked(null); setSel(null); }} className="pill">← All exercises</button>
            <p className="font-display text-lg capitalize">{picked}</p>

            {sessions.length === 0 ? (
              <p className="text-sm text-muted">No sessions for this exercise in the selected range.</p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  <div className="panel py-2"><p className="font-score text-base font-bold text-gold">{stats.prWeight}</p><p className="text-[9px] text-muted">best kg</p></div>
                  <div className="panel py-2"><p className="font-score text-base font-bold text-mint">{stats.pr1rm}</p><p className="text-[9px] text-muted">est 1RM</p></div>
                  <div className="panel py-2"><p className="font-score text-base font-bold">{Math.round(stats.bestVol)}</p><p className="text-[9px] text-muted">best volume</p></div>
                  <div className="panel py-2"><p className="font-score text-base font-bold">{stats.count}</p><p className="text-[9px] text-muted">sessions</p></div>
                </div>

                <WeightPerSetChart sessions={sessions} maxSets={maxSets} sel={sel} onSelect={setSel} />
                <VolumeChart sessions={sessions} sel={sel} onSelect={setSel} />

                {sel != null && sessions[sel] && (
                  <div className="panel">
                    <p className="eyebrow mb-1">{fmtDate(sessions[sel].date)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sessions[sel].sets.map((st, i) => (
                        <span key={i} className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: SET_COLORS[i % SET_COLORS.length], color: "rgb(var(--c-ink))" }}>
                          {st.weight ? st.weight + "kg" : "BW"}{st.reps ? " × " + st.reps : ""}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted">Volume {Math.round(sessions[sel].volume)} kg · {sessions[sel].sets.length} sets · {sessions[sel].reps} reps</p>
                  </div>
                )}

                <div className="card">
                  <p className="eyebrow mb-1 flex items-center gap-1"><TrendingUp size={12} /> Progress</p>
                  <p className="text-sm">
                    Top set {stats.topDelta === 0 ? "held steady" : stats.topDelta > 0 ? <span className="font-bold text-mint">up {stats.topDelta}kg</span> : <span className="font-bold text-ember">down {Math.abs(stats.topDelta)}kg</span>} since {fmtDate(stats.firstDate)}.
                  </p>
                  <p className="mt-1 text-[12px] text-muted">
                    {stats.count} session{stats.count !== 1 ? "s" : ""} · {stats.totalSets} sets · session volume {stats.volDelta >= 0 ? "+" : ""}{Math.round(stats.volDelta)} kg vs your first.
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function ChartFrame({ title, legend, children }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="eyebrow">{title}</p>
        {legend}
      </div>
      <div className="rounded-2xl bg-surface2 p-2.5">{children}</div>
    </div>
  );
}

// One coloured line per set number, so you can see set 1 / 2 / 3 progressing separately.
function WeightPerSetChart({ sessions, maxSets, sel, onSelect }) {
  const W = 300, H = 130, PADL = 26, PADB = 16;
  const weights = sessions.flatMap((s) => s.sets.map((x) => x.weight)).filter((n) => n > 0);
  const max = Math.max(1, ...weights) * 1.1;
  const min = Math.max(0, Math.min(...(weights.length ? weights : [0])) * 0.85);
  const x = (i) => PADL + (sessions.length === 1 ? (W - PADL) / 2 : (i * (W - PADL - 6)) / (sessions.length - 1));
  const y = (v) => H - PADB - ((v - min) / (max - min || 1)) * (H - PADB - 6);

  return (
    <ChartFrame
      title="Weight per set"
      legend={
        <span className="flex flex-wrap gap-1.5">
          {Array.from({ length: maxSets }).map((_, i) => (
            <span key={i} className="flex items-center gap-1 text-[9px] text-muted">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: SET_COLORS[i % SET_COLORS.length] }} />set {i + 1}
            </span>
          ))}
        </span>
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[max, (max + min) / 2, min].map((v, i) => (
          <g key={i}>
            <line x1={PADL} x2={W} y1={y(v)} y2={y(v)} stroke="rgb(var(--c-line))" strokeWidth="1" />
            <text x="2" y={y(v) + 3} fontSize="8" fill="rgb(var(--c-muted))">{Math.round(v)}</text>
          </g>
        ))}
        {Array.from({ length: maxSets }).map((_, si) => {
          const pts = sessions.map((s, i) => (s.sets[si] && s.sets[si].weight ? { x: x(i), y: y(s.sets[si].weight) } : null)).filter(Boolean);
          if (pts.length === 0) return null;
          return (
            <g key={si}>
              {pts.length > 1 && <polyline fill="none" stroke={SET_COLORS[si % SET_COLORS.length]} strokeWidth="2" strokeLinejoin="round" points={pts.map((p) => p.x + "," + p.y).join(" ")} />}
              {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={SET_COLORS[si % SET_COLORS.length]} />)}
            </g>
          );
        })}
        {sessions.map((s, i) => (
          <rect key={i} x={x(i) - 8} y="0" width="16" height={H - PADB + 6} fill="transparent" onClick={() => onSelect(sel === i ? null : i)} style={{ cursor: "pointer" }} />
        ))}
        {sel != null && <line x1={x(sel)} x2={x(sel)} y1="0" y2={H - PADB} stroke="rgb(var(--c-paper))" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />}
        {sessions.length > 1 && (
          <>
            <text x={PADL} y={H - 3} fontSize="8" fill="rgb(var(--c-muted))">{fmtDate(sessions[0].date)}</text>
            <text x={W} y={H - 3} textAnchor="end" fontSize="8" fill="rgb(var(--c-muted))">{fmtDate(sessions[sessions.length - 1].date)}</text>
          </>
        )}
      </svg>
      <p className="mt-1 text-center text-[10px] text-muted">Tap a point to see that session</p>
    </ChartFrame>
  );
}

function VolumeChart({ sessions, sel, onSelect }) {
  const W = 300, H = 90, PADB = 14;
  const max = Math.max(1, ...sessions.map((s) => s.volume)) * 1.1;
  const bw = Math.max(6, Math.min(24, (W - 8) / sessions.length - 4));
  const step = sessions.length > 1 ? (W - bw - 8) / (sessions.length - 1) : 0;
  return (
    <ChartFrame title="Session volume (kg lifted)">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {sessions.map((s, i) => {
          const x = 4 + i * step, h = ((s.volume / max) * (H - PADB)) || 0;
          return (
            <g key={i} onClick={() => onSelect(sel === i ? null : i)} style={{ cursor: "pointer" }}>
              <rect x={x} y={H - PADB - h} width={bw} height={h} rx="3" fill="rgb(var(--c-gold))" opacity={sel == null || sel === i ? 0.9 : 0.35} />
              <rect x={x} y="0" width={bw} height={H} fill="transparent" />
            </g>
          );
        })}
        <line x1="0" x2={W} y1={H - PADB} y2={H - PADB} stroke="rgb(var(--c-line))" strokeWidth="1" />
      </svg>
    </ChartFrame>
  );
}
