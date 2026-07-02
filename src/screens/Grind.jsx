import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { loadGoals, addGoal, setGoalProgress, removeGoal, loadEntries, addEntry, removeEntry, groupByDate } from "../lib/grind.js";
import { toISO, startOfWeekISO } from "../lib/streak.js";
import Sheet from "../components/Sheet.jsx";
import Loader from "../components/Loader.jsx";
import { Plus, Target, Trash2, Check, Dumbbell } from "lucide-react";

const num = (v) => (v === "" || v == null ? null : Number(v));
const todayLabel = (iso) => {
  const t = toISO(new Date());
  const y = toISO(new Date(Date.now() - 86400000));
  if (iso === t) return "Today";
  if (iso === y) return "Yesterday";
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

export default function Grind() {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingGoal, setAddingGoal] = useState(false);
  const [editGoal, setEditGoal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [g, e] = await Promise.all([loadGoals(user.id), loadEntries(user.id)]);
    setGoals(g); setEntries(e); setLoading(false);
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const ws = startOfWeekISO();
  const setsThisWeek = entries.filter((e) => e.log_date >= ws).reduce((s, e) => s + (e.sets || 1), 0);
  const days = groupByDate(entries);

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
            {goals.length === 0 ? <p className="text-sm text-muted">No goals yet. Set one — “Bench 100kg”, “Gym 20× this month”, “Drop 3kg”.</p> : (
              goals.map((g) => <GoalCard key={g.id} g={g} onTap={() => setEditGoal(g)} />)
            )}
          </section>

          {/* QUICK LOG */}
          <QuickLog userId={user.id} onAdded={load} />

          {/* HISTORY */}
          <section className="space-y-3">
            <p className="eyebrow flex items-center gap-1"><Dumbbell size={12} /> Log</p>
            {days.length === 0 ? <p className="text-sm text-muted">Nothing logged yet. Add your first set above.</p> : (
              days.map(({ date, items }) => (
                <div key={date} className="card">
                  <p className="mb-2 text-sm font-bold">{todayLabel(date)}</p>
                  <div className="space-y-1.5">
                    {items.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{e.exercise}</span>
                        <span className="flex items-center gap-2">
                          <span className="font-score text-muted">
                            {e.sets ? e.sets + "×" : ""}{e.reps ?? ""}{e.weight_kg ? " @ " + e.weight_kg + "kg" : ""}
                          </span>
                          <button onClick={async () => { await removeEntry(e.id); load(); }} className="text-muted"><Trash2 size={14} /></button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}

      {addingGoal && <AddGoalSheet userId={user.id} onClose={() => setAddingGoal(false)} onDone={load} />}
      {editGoal && <EditGoalSheet goal={editGoal} onClose={() => setEditGoal(null)} onDone={load} />}
    </div>
  );
}

function GoalCard({ g, onTap }) {
  const pct = g.target ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
  const done = g.target && g.current >= g.target;
  return (
    <button onClick={onTap} className="card w-full text-left active:scale-[.99]">
      <div className="flex items-center justify-between">
        <p className="font-bold">{g.title}</p>
        {done ? <span className="pill pill-on flex items-center gap-1"><Check size={12} /> Smashed</span>
              : <span className="font-score text-sm text-gold">{g.current}{g.target ? " / " + g.target : ""} {g.unit || ""}</span>}
      </div>
      {g.target && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface2">
          <div className={"h-full rounded-full transition-[width] duration-700 " + (done ? "bg-mint" : "bg-gold")} style={{ width: pct + "%" }} />
        </div>
      )}
    </button>
  );
}

function QuickLog({ userId, onAdded }) {
  const [f, setF] = useState({ exercise: "", sets: "", reps: "", weight_kg: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function add() {
    if (!f.exercise.trim()) return;
    setBusy(true);
    await addEntry({ user_id: userId, log_date: toISO(new Date()), exercise: f.exercise.trim(), sets: num(f.sets), reps: num(f.reps), weight_kg: num(f.weight_kg) });
    setF({ exercise: "", sets: "", reps: "", weight_kg: "" });
    setBusy(false);
    onAdded();
  }

  return (
    <div className="card space-y-2">
      <p className="eyebrow">Log a set — fast</p>
      <input className="inp" placeholder="Exercise (e.g. Bench press)" value={f.exercise} onChange={set("exercise")} />
      <div className="grid grid-cols-3 gap-2">
        <input className="inp text-center" inputMode="numeric" placeholder="sets" value={f.sets} onChange={set("sets")} />
        <input className="inp text-center" inputMode="numeric" placeholder="reps" value={f.reps} onChange={set("reps")} />
        <input className="inp text-center" inputMode="decimal" placeholder="kg" value={f.weight_kg} onChange={set("weight_kg")} />
      </div>
      <button className="btn-primary w-full" onClick={add} disabled={busy || !f.exercise.trim()}>{busy ? "Adding…" : "Add to today"}</button>
      <style>{`.inp{width:100%;border-radius:.75rem;background:rgba(39,34,49,.7);padding:.65rem 1rem;outline:none}`}</style>
    </div>
  );
}

function AddGoalSheet({ userId, onClose, onDone }) {
  const [f, setF] = useState({ title: "", target: "", unit: "", current: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save() {
    if (!f.title.trim()) return;
    setBusy(true);
    await addGoal({ user_id: userId, title: f.title.trim(), target: num(f.target), current: num(f.current) || 0, unit: f.unit.trim() || null });
    setBusy(false); onDone(); onClose();
  }
  return (
    <Sheet title="New goal" onClose={onClose}>
      <div className="space-y-3">
        <input className="inp" placeholder="Goal (e.g. Bench press)" value={f.title} onChange={set("title")} />
        <div className="grid grid-cols-3 gap-2">
          <input className="inp text-center" inputMode="decimal" placeholder="now" value={f.current} onChange={set("current")} />
          <input className="inp text-center" inputMode="decimal" placeholder="target" value={f.target} onChange={set("target")} />
          <input className="inp text-center" placeholder="unit" value={f.unit} onChange={set("unit")} />
        </div>
        <button className="btn-primary w-full" onClick={save} disabled={busy || !f.title.trim()}>{busy ? "Saving…" : "Create goal"}</button>
        <style>{`.inp{width:100%;border-radius:.75rem;background:rgba(39,34,49,.7);padding:.7rem 1rem;outline:none}`}</style>
      </div>
    </Sheet>
  );
}

function EditGoalSheet({ goal, onClose, onDone }) {
  const [current, setCurrent] = useState(String(goal.current ?? ""));
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={goal.title} onClose={onClose}>
      <div className="space-y-3">
        <p className="eyebrow">Update progress {goal.unit ? "(" + goal.unit + ")" : ""}</p>
        <input className="inp text-center text-2xl font-score" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
        {goal.target && <p className="text-center text-sm text-muted">Target: {goal.target} {goal.unit || ""}</p>}
        <button className="btn-primary w-full" onClick={async () => { setBusy(true); await setGoalProgress(goal.id, Number(current) || 0); setBusy(false); onDone(); onClose(); }} disabled={busy}>
          {busy ? "Saving…" : "Save progress"}
        </button>
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-ember active:scale-[.98]"
          onClick={async () => { await removeGoal(goal.id); onDone(); onClose(); }}>
          <Trash2 size={16} /> Delete goal
        </button>
        <style>{`.inp{width:100%;border-radius:.75rem;background:rgba(39,34,49,.7);padding:.7rem 1rem;outline:none}`}</style>
      </div>
    </Sheet>
  );
}
