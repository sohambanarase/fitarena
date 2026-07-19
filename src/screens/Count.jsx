import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { toISO } from "../lib/streak.js";
import ScreenHeader from "../components/ScreenHeader.jsx";
import Sheet from "../components/Sheet.jsx";
import Loader from "../components/Loader.jsx";
import QuantityScale from "../components/QuantityScale.jsx";
import CameraScanner from "../components/CameraScanner.jsx";
import {
  MEALS, MEAL_LABELS, QUICK_FOODS,
  loadGoals, saveGoals, addFood, searchFoods, recentFoods,
  loadLogs, logFood, removeLog, macrosFor, dayTotals, lookupBarcode,
  loadSavedMeals, createSavedMeal, deleteSavedMeal, logSavedMeal, savedMealTotals,
  searchOFF, cacheOffFood, loadFavorites, isFavorite, setFavorite, ensureFood, loadRange, weeklyInsights,
  loadQuickFoods, builtinQuickFoods, addQuickFood, updateFoodRow, deleteFoodRow, hideDefaultQuick, restoreDefaultQuick, hiddenDefaultCount,
  getFood, updateLog, loadMyFoods,
  loadBurn, addBurn, removeBurn, burnTotal, workoutSummary,
} from "../lib/nutrition.js";
import { Settings, Plus, Search, Sparkles, Zap, Trash2, ScanLine, PencilLine, Apple, Barcode, Camera, Bookmark, BookmarkPlus, X, ChevronLeft, ChevronRight, Star, Image as ImageIcon, MessageCircle, TrendingUp, Pencil, RotateCcw, CalendarDays, ListChecks, Flame, Dumbbell } from "lucide-react";

const num = (v) => (v === "" || v == null ? null : Number(v));

/* progress ring */
function Ring({ value, goal, size = 128, stroke = 11, color = "rgb(var(--c-gold))", children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: "rgb(var(--c-surface2))" }} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: color, strokeDashoffset: c * (1 - pct), transition: "stroke-dashoffset .6s ease" }} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} />
      </svg>
      <div className="absolute grid place-items-center text-center">{children}</div>
    </div>
  );
}
function MacroBar({ label, value, goal, color, star }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className={"text-xs font-bold " + (star ? "text-mint" : "text-muted")}>{label}{star ? " ★" : ""}</span>
        <span className="font-score text-[11px]">{Math.round(value)}{goal ? " / " + goal : ""} g</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full" style={{ width: pct + "%", background: color }} /></div>
    </div>
  );
}

export default function Count() {
  const { user, profile } = useAuth();
  const today = toISO(new Date());
  const [date, setDate] = useState(today);
  const [goals, setGoals] = useState(null);
  const [logs, setLogs] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showGoals, setShowGoals] = useState(false);
  const [add, setAdd] = useState(null); // { view, meal }
  const [editLog, setEditLog] = useState(null);
  const [burn, setBurn] = useState([]);
  const [showBurn, setShowBurn] = useState(false);
  const isToday = date === today;
  const shiftDay = (d) => setDate(toISO(new Date(new Date(date + "T00:00:00").getTime() + d * 86400000)));
  const dayLabel = isToday ? "Today" : new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  const load = useCallback(async () => {
    setLoading(true);
    const since = toISO(new Date(Date.now() - 6 * 86400000));
    const [g, l, range, bn] = await Promise.all([loadGoals(user.id), loadLogs(user.id, date), loadRange(user.id, since), loadBurn(user.id, date)]);
    setGoals(g); setLogs(l); setInsights(weeklyInsights(range, g)); setBurn(bn); setLoading(false);
  }, [user.id, date]);
  useEffect(() => { load(); }, [load]);

  const t = dayTotals(logs);
  const burned = burnTotal(burn);
  const calGoal = goals?.calories_goal || 0;
  const remaining = calGoal ? Math.round(calGoal + burned - t.calories) : null;
  const byMeal = useMemo(() => {
    const m = {}; MEALS.forEach((k) => (m[k] = []));
    logs.forEach((l) => (m[l.meal_type] || (m[l.meal_type] = [])).push(l));
    return m;
  }, [logs]);

  const actions = [
    { key: "barcode", label: "Scan", Icon: ScanLine },
    { key: "search", label: "Search", Icon: Search },
    { key: "manual", label: "Add food", Icon: PencilLine },
    { key: "quick", label: "Quick add", Icon: Zap },
    { key: "ai", label: "Use AI", Icon: Sparkles },
    { key: "saved", label: "Saved", Icon: Bookmark },
  ];

  return (
    <div className="screen animate-screen space-y-4">
      <ScreenHeader eyebrow="Nutrition" title="Count" right={
        <button onClick={() => setShowGoals(true)} className="grid h-9 w-9 place-items-center rounded-full bg-surface2 text-muted active:scale-90"><Settings size={18} /></button>
      } />

      <div className="flex items-center justify-between rounded-full bg-surface2 px-2 py-1.5">
        <button onClick={() => shiftDay(-1)} className="grid h-8 w-8 place-items-center rounded-full active:scale-90"><ChevronLeft size={18} /></button>
        <label className="relative flex cursor-pointer items-center gap-1.5">
          <CalendarDays size={14} className="text-muted" />
          <span className="text-sm font-bold">{dayLabel}</span>
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Pick a date" />
        </label>
        <button onClick={() => shiftDay(1)} disabled={isToday} className="grid h-8 w-8 place-items-center rounded-full active:scale-90 disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>

      {loading ? <Loader label="Loading your day…" /> : (
        <>
          {/* hero: calories ring + protein prioritized */}
          <div className="card">
            {!calGoal && !goals?.protein_goal ? (
              <button onClick={() => setShowGoals(true)} className="w-full py-2 text-center">
                <p className="font-bold">Set your goals to get started</p>
                <p className="text-sm text-muted">Add a daily calorie and protein target.</p>
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <Ring value={t.calories} goal={calGoal + burned}>
                  <p className="font-score text-2xl font-bold">{remaining != null ? remaining : Math.round(t.calories)}</p>
                  <p className="text-[10px] text-muted">{remaining != null ? "kcal left" : "kcal"}</p>
                  {burned > 0 && <p className="mt-0.5 text-[9px] font-bold text-mint">+{Math.round(burned)} burned</p>}
                </Ring>
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div>
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="text-sm font-bold text-mint">Protein ★</span>
                      <span className="font-score text-sm font-bold">{Math.round(t.protein)}{goals?.protein_goal ? " / " + goals.protein_goal : ""} g</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full" style={{ width: (goals?.protein_goal ? Math.min(100, (t.protein / goals.protein_goal) * 100) : 0) + "%", background: "var(--grad-mint)" }} /></div>
                    {goals?.protein_goal && t.protein < goals.protein_goal && <p className="mt-1 text-[11px] text-muted">{Math.round(goals.protein_goal - t.protein)}g protein to go</p>}
                  </div>
                  <MacroBar label="Carbs" value={t.carbs} goal={goals?.carbs_goal} color="var(--grad-gold)" />
                  <MacroBar label="Fat" value={t.fat} goal={goals?.fat_goal} color="var(--grad-ember)" />
                </div>
              </div>
            )}
          </div>

          {/* quick actions */}
          <div className="grid grid-cols-3 gap-2">
            {actions.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setAdd({ view: key, meal: "snacks" })} className="glass flex flex-col items-center gap-1.5 rounded-2xl py-3 active:scale-95">
                <Icon size={20} className="text-gold" />
                <span className="text-[11px] font-bold">{label}</span>
              </button>
            ))}
          </div>

          {/* activity / calories burned */}
          <div className="panel">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface2"><Flame size={18} className="text-mint" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{burned > 0 ? Math.round(burned) + " kcal burned" : "No activity logged"}</p>
                <p className="text-[11px] text-muted">{burned > 0 ? "Added back to today's budget" : "Log a workout or activity to earn calories back"}</p>
              </div>
              <button onClick={() => setShowBurn(true)} className="pill flex items-center gap-1"><Plus size={13} /> Add</button>
            </div>
            {burn.length > 0 && (
              <div className="mt-2 space-y-1">
                {burn.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold capitalize">{r.label}</span>
                    <span className="font-score text-[12px] text-mint">{Math.round(r.calories)} kcal</span>
                    <button onClick={async () => { await removeBurn(r.id); load(); }} aria-label="Delete activity" className="text-muted active:scale-90 hover:text-ember"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* meals */}
          {logs.length === 0 && (
            <div className="panel text-center">
              <p className="font-bold">No food logged yet today.</p>
              <p className="mt-1 text-sm text-muted">Start by scanning a barcode or adding your first meal. Track protein and calories to support your progress.</p>
            </div>
          )}
          <div className="space-y-3">
            {MEALS.map((meal) => {
              const items = byMeal[meal] || [];
              const mt = items.reduce((a, i) => ({ cal: a.cal + (Number(i.calculated_calories) || 0), p: a.p + (Number(i.calculated_protein) || 0) }), { cal: 0, p: 0 });
              return (
                <section key={meal} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="eyebrow">{MEAL_LABELS[meal]}{items.length ? " · " + Math.round(mt.cal) + " kcal · " + Math.round(mt.p) + "g P" : ""}</p>
                    <button onClick={() => setAdd({ view: "home", meal })} className="pill flex items-center gap-1"><Plus size={13} /> Add</button>
                  </div>
                  {items.map((i) => (
                    <div key={i.id} className="panel flex items-center gap-2 p-3">
                      <button onClick={() => setEditLog(i)} className="flex min-w-0 flex-1 items-center gap-2 text-left active:scale-[.99]">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold capitalize">{i.name}</p>
                          <p className="text-[11px] text-muted">{i.quantity}{i.quantity_unit} · {Math.round(i.calculated_calories || 0)} kcal · {Math.round(i.calculated_protein || 0)}g P</p>
                        </div>
                        <Pencil size={14} className="shrink-0 text-muted" />
                      </button>
                      <button onClick={async () => { await removeLog(i.id); load(); }} aria-label="Delete entry" className="text-muted active:scale-90 hover:text-ember"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </section>
              );
            })}
          </div>

          {insights && insights.daysLogged > 0 && (
            <div className="card">
              <p className="eyebrow mb-2 flex items-center gap-1 text-gold"><TrendingUp size={13} /> This week</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="font-score text-lg font-bold">{insights.avgCal}</p><p className="text-[10px] text-muted">avg kcal</p></div>
                <div><p className="font-score text-lg font-bold text-mint">{insights.avgProtein}</p><p className="text-[10px] text-muted">avg protein</p></div>
                <div><p className="font-score text-lg font-bold">{insights.daysLogged}</p><p className="text-[10px] text-muted">days logged</p></div>
              </div>
              <div className="mt-2 space-y-1 text-[12px] text-muted">
                {insights.proteinHit != null && <p>You hit your protein goal <span className="font-bold text-mint">{insights.proteinHit}/{insights.daysLogged}</span> day{insights.daysLogged !== 1 ? "s" : ""} logged.</p>}
                {goals?.protein_goal && isToday && t.protein < goals.protein_goal && <p>You still need <span className="font-bold text-mint">{Math.round(goals.protein_goal - t.protein)}g</span> protein today.</p>}
              </div>
              <button onClick={() => setAdd({ view: "ai", meal: "snacks", aiMode: "assist" })} className="pill mt-3 flex w-full items-center justify-center gap-1 py-2"><MessageCircle size={13} /> Ask the AI coach</button>
            </div>
          )}
        </>
      )}

      {showGoals && <GoalsSheet userId={user.id} goals={goals} onClose={() => setShowGoals(false)} onSaved={load} />}
      {add && <AddFoodSheet userId={user.id} date={date} initial={add} goals={goals} totals={t} onClose={() => setAdd(null)} onLogged={load} />}
      {editLog && <EditLogSheet userId={user.id} entry={editLog} onClose={() => setEditLog(null)} onSaved={load} />}
      {showBurn && <BurnSheet userId={user.id} date={date} weightKg={profile?.current_weight_kg} onClose={() => setShowBurn(false)} onSaved={load} />}
    </div>
  );
}

/* ---------- Goals ---------- */
function GoalsSheet({ userId, goals, onClose, onSaved }) {
  const [f, setF] = useState({
    calories_goal: goals?.calories_goal || "", protein_goal: goals?.protein_goal || "",
    carbs_goal: goals?.carbs_goal || "", fat_goal: goals?.fat_goal || "", goal_type: goals?.goal_type || "maintain",
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <Sheet title="Daily goals" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <p className="eyebrow mb-1">Goal</p>
          <div className="grid grid-cols-3 gap-2">
            {[["lose", "Lose fat"], ["maintain", "Maintain"], ["gain", "Build muscle"]].map(([v, l]) => (
              <button key={v} onClick={() => set("goal_type", v)} className={"pill py-2 " + (f.goal_type === v ? "pill-on" : "")}>{l}</button>
            ))}
          </div>
        </div>
        <Field label="Calories (kcal)" value={f.calories_goal} onChange={(v) => set("calories_goal", v)} />
        <Field label="Protein (g) ★" value={f.protein_goal} onChange={(v) => set("protein_goal", v)} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Carbs (g)" value={f.carbs_goal} onChange={(v) => set("carbs_goal", v)} />
          <Field label="Fat (g)" value={f.fat_goal} onChange={(v) => set("fat_goal", v)} />
        </div>
        <button className="btn-primary w-full" disabled={busy} onClick={async () => {
          setBusy(true);
          await saveGoals(userId, { calories_goal: num(f.calories_goal), protein_goal: num(f.protein_goal), carbs_goal: num(f.carbs_goal), fat_goal: num(f.fat_goal), goal_type: f.goal_type });
          setBusy(false); onSaved(); onClose();
        }}>{busy ? "Saving…" : "Save goals"}</button>
      </div>
    </Sheet>
  );
}
function Field({ label, value, onChange }) {
  return <label className="block"><span className="eyebrow mb-1 block">{label}</span>
    <input className="inp" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

/* ---------- Add food (search / manual / barcode / quick / ai) → review ---------- */
function AddFoodSheet({ userId, date, initial, goals, totals, onClose, onLogged }) {
  const [view, setView] = useState(initial.view === "home" ? "home" : initial.view);
  const [meal, setMeal] = useState(initial.meal || "snacks");
  const [review, setReview] = useState(null); // food object to review

  const openReview = async (food) => { let f = food; if (food.source === "off" && !food.id) f = await cacheOffFood(food); setReview(f); setView("review"); };

  return (
    <Sheet title={review ? review.name : titleFor(view)} onClose={onClose}>
      {view === "home" && <HomeChooser onPick={setView} />}
      {view === "search" && <SearchView userId={userId} onPick={openReview} />}
      {view === "quick" && <QuickView userId={userId} onPick={openReview} />}
      {view === "manual" && <ManualView userId={userId} save onPick={openReview} />}
      {view === "myfoods" && <MyFoodsView userId={userId} onPick={openReview} />}
      {view === "saved" && <SavedMealsView userId={userId} date={date} meal={meal} setMeal={setMeal} onLogged={() => { onLogged(); onClose(); }} />}
      {view === "barcode" && <BarcodeView onPick={openReview} />}
      {view === "ai" && <AIView userId={userId} initialMode={initial.aiMode} goals={goals} totals={totals} openReview={openReview} onLog={async (entry) => { await logFood({ ...entry, user_id: userId, log_date: date, meal_type: meal }); onLogged(); onClose(); }} meal={meal} setMeal={setMeal} />}
      {view === "review" && review && (
        <ReviewFood food={review} meal={meal} setMeal={setMeal} userId={userId}
          onAdd={async (entry) => { await logFood({ ...entry, user_id: userId, log_date: date, meal_type: meal }); onLogged(); onClose(); }} />
      )}
    </Sheet>
  );
}
function titleFor(v) {
  return { home: "Add food", search: "Search food", quick: "Quick add", manual: "Add food", saved: "Saved meals", myfoods: "My foods", barcode: "Scan barcode", ai: "AI estimate", review: "Review" }[v] || "Add food";
}
function HomeChooser({ onPick }) {
  const opts = [
    ["barcode", "Scan barcode", ScanLine], ["search", "Search food", Search],
    ["manual", "Add manually", PencilLine], ["quick", "Quick add", Zap],
    ["ai", "Use AI", Sparkles], ["saved", "Saved meals", Bookmark],
    ["myfoods", "My foods", ListChecks],
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {opts.map(([k, l, Icon]) => (
        <button key={k} onClick={() => onPick(k)} className="glass flex flex-col items-center gap-2 rounded-2xl py-5 active:scale-95">
          <Icon size={22} className="text-gold" /><span className="text-sm font-bold">{l}</span>
        </button>
      ))}
    </div>
  );
}

function SearchView({ userId, onPick }) {
  const [q, setQ] = useState("");
  const [local, setLocal] = useState([]);
  const [indian, setIndian] = useState([]);
  const [off, setOff] = useState([]);
  const [recent, setRecent] = useState([]);
  const [favs, setFavs] = useState([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => { recentFoods(userId).then(setRecent); loadFavorites(userId).then(setFavs); }, [userId]);
  useEffect(() => {
    if (!q.trim()) { setLocal([]); setIndian([]); setOff([]); return; }
    // dataset is loaded on first search only, so it never slows the app's first paint
    import("../data/indianFoods.js").then((m) => setIndian(m.searchIndian(q))).catch(() => {});
    setSearching(true);
    const t = setTimeout(async () => {
      const [l, o] = await Promise.all([searchFoods(userId, q), searchOFF(q)]);
      const have = new Set(l.map((f) => f.barcode).filter(Boolean));
      setLocal(l); setOff(o.filter((f) => !f.barcode || !have.has(f.barcode)).slice(0, 15));
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q, userId]);

  return (
    <div className="space-y-2">
      <div className="search-glass"><Search size={18} className="text-muted" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods, scanned items, or Open Food Facts" className="w-full bg-transparent outline-none placeholder:text-muted" /></div>
      {!q.trim() ? (
        <div className="max-h-[55vh] space-y-1.5 overflow-y-auto">
          {favs.length > 0 && <><p className="eyebrow flex items-center gap-1"><Star size={11} className="text-gold" /> Favorites</p>{favs.map((f) => <FoodRow key={f.id} food={f} onClick={() => onPick(f)} />)}</>}
          {recent.length > 0 && <><p className="eyebrow pt-1">Recent</p>{recent.map((f) => <FoodRow key={f.id} food={f} onClick={() => onPick(f)} />)}</>}
          {favs.length === 0 && recent.length === 0 && <p className="px-1 text-sm text-muted">Search your foods, scanned products, or the Open Food Facts database (e.g. "starbucks latte").</p>}
        </div>
      ) : (
        <div className="max-h-[55vh] space-y-1.5 overflow-y-auto">
          {local.length > 0 && <p className="eyebrow">Your foods</p>}
          {local.map((f) => <FoodRow key={f.id} food={f} onClick={() => onPick(f)} />)}
          {indian.length > 0 && <p className="eyebrow pt-1">Indian foods · IFCT 2017</p>}
          {indian.map((f, i) => <FoodRow key={"in" + i} food={f} onClick={() => onPick(f)} />)}
          {off.length > 0 && <p className="eyebrow pt-1">Open Food Facts</p>}
          {off.map((f, i) => <FoodRow key={"off" + i} food={f} onClick={() => onPick(f)} />)}
          {searching && <p className="px-1 text-sm text-muted">Searching packaged products…</p>}
          {!searching && local.length === 0 && indian.length === 0 && off.length === 0 && <p className="px-1 text-sm text-muted">No match. Add it manually or use AI.</p>}
        </div>
      )}
    </div>
  );
}
function QuickView({ userId, onPick }) {
  const [items, setItems] = useState(() => builtinQuickFoods()); // instant; user's own merge in below
  const [editing, setEditing] = useState(null); // food being edited, or "new"
  const [hiddenN, setHiddenN] = useState(hiddenDefaultCount());
  // only ever apply the newest fetch — a slow earlier one must not clobber a newer edit
  const reqRef = useRef(0);
  const reload = useCallback(() => {
    const id = ++reqRef.current;
    loadQuickFoods(userId).then((r) => { if (id === reqRef.current) setItems(r); }).catch(() => {});
  }, [userId]);
  const applyLocal = (updater) => { reqRef.current++; setItems(updater); };
  useEffect(() => { reload(); }, [reload]);

  if (editing) return (
    <QuickForm userId={userId} food={editing === "new" ? null : editing}
      onCancel={() => setEditing(null)}
      onSaved={() => { setEditing(null); setHiddenN(hiddenDefaultCount()); reload(); }} />
  );

  return (
    <div className="space-y-2">
      <p className="eyebrow">Tap to log · edit or remove any item</p>
      <div className="max-h-[52vh] space-y-1.5 overflow-y-auto">
        {items.map((f, i) => (
          <div key={f.id || "b" + i} className="panel flex items-center gap-2 p-2.5">
            <button onClick={() => onPick({ ...f })} className="flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[.99]">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface2 font-display text-line">{(f.name || "?")[0].toUpperCase()}</div>
              <div className="min-w-0">
                <p className="truncate font-bold capitalize">{f.name}</p>
                <p className="text-[11px] text-muted">{Math.round(f.calories_per_100g || 0)} kcal · {f.protein_per_100g || 0}g P /100g</p>
              </div>
            </button>
            <button onClick={() => setEditing(f)} aria-label="Edit" className="text-muted active:scale-90"><Pencil size={15} /></button>
            <button aria-label="Remove" className="text-muted active:scale-90 hover:text-ember"
              onClick={async () => {
                applyLocal((prev) => prev.filter((x) => (f.id ? x.id !== f.id : x.name !== f.name)));   // instant
                if (f.builtin) { hideDefaultQuick(f.name); setHiddenN(hiddenDefaultCount()); } else { await deleteFoodRow(f.id); }
                reload();
              }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => setEditing("new")} className="pill flex w-full items-center justify-center gap-1 py-2.5"><Plus size={14} /> Add your own quick item</button>
      {hiddenN > 0 && (
        <button onClick={() => { restoreDefaultQuick(); setHiddenN(0); applyLocal(builtinQuickFoods()); reload(); }} className="flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-muted">
          <RotateCcw size={12} /> Restore {hiddenN} built-in item{hiddenN !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}

function QuickForm({ userId, food, onSaved, onCancel }) {
  const [f, setF] = useState({
    name: food?.name || "", calories_per_100g: food?.calories_per_100g ?? "", protein_per_100g: food?.protein_per_100g ?? "",
    carbs_per_100g: food?.carbs_per_100g ?? "", fat_per_100g: food?.fat_per_100g ?? "", serving_size: food?.serving_size ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const ok = f.name.trim() && f.calories_per_100g !== "";
  async function save() {
    setBusy(true);
    const payload = { name: f.name.trim(), calories_per_100g: num(f.calories_per_100g), protein_per_100g: num(f.protein_per_100g), carbs_per_100g: num(f.carbs_per_100g), fat_per_100g: num(f.fat_per_100g), serving_size: num(f.serving_size) };
    if (food && food.id) await updateFoodRow(food.id, payload);
    else { await addQuickFood(userId, payload); if (food && food.builtin) hideDefaultQuick(food.name); } // editing a built-in makes your own copy
    setBusy(false); onSaved();
  }
  return (
    <div className="space-y-3">
      <button onClick={onCancel} className="pill">← Quick add</button>
      <p className="text-sm text-muted">Values per 100g. {food?.builtin ? "Saving makes this your own editable copy." : ""}</p>
      <input className="inp" placeholder="Name (e.g. Protein bar)" value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Calories /100g" value={f.calories_per_100g} onChange={(v) => set("calories_per_100g", v)} />
        <Field label="Protein /100g ★" value={f.protein_per_100g} onChange={(v) => set("protein_per_100g", v)} />
        <Field label="Carbs /100g" value={f.carbs_per_100g} onChange={(v) => set("carbs_per_100g", v)} />
        <Field label="Fat /100g" value={f.fat_per_100g} onChange={(v) => set("fat_per_100g", v)} />
      </div>
      <Field label="Usual serving (g, optional)" value={f.serving_size} onChange={(v) => set("serving_size", v)} />
      <button className="btn-primary w-full" disabled={!ok || busy} onClick={save}>{busy ? "Saving…" : "Save item"}</button>
    </div>
  );
}
function FoodRow({ food, onClick }) {
  return (
    <button onClick={onClick} className="panel flex w-full items-center gap-3 p-2.5 text-left active:scale-[.99]">
      {food.image_url ? <img src={food.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface2 font-display text-line">{(food.name || "?")[0].toUpperCase()}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold capitalize">{food.name}</p>
        <p className="text-[11px] text-muted">{food.brand ? food.brand + " · " : ""}{Math.round(food.calories_per_100g || 0)} kcal · {food.protein_per_100g || 0}g P /100g</p>
      </div>
      {food.source === "ifct" && <span className="shrink-0 rounded-full bg-surface2 px-2 py-0.5 text-[9px] font-bold text-muted">IFCT</span>}
      {food.source === "recipe" && <span className="shrink-0 rounded-full bg-surface2 px-2 py-0.5 text-[9px] font-bold text-muted">DISH</span>}
    </button>
  );
}

function ManualView({ userId, onPick }) {
  const [f, setF] = useState({ name: "", brand: "", calories_per_100g: "", protein_per_100g: "", carbs_per_100g: "", fat_per_100g: "", sugar_per_100g: "", salt_per_100g: "", fiber_per_100g: "", serving_size: "" });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const ok = f.name.trim() && f.calories_per_100g !== "";
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Nutrition per 100g. Saved to your foods for reuse.</p>
      <input className="inp" placeholder="Food name" value={f.name} onChange={(e) => set("name", e.target.value)} />
      <input className="inp" placeholder="Brand (optional)" value={f.brand} onChange={(e) => set("brand", e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Calories /100g" value={f.calories_per_100g} onChange={(v) => set("calories_per_100g", v)} />
        <Field label="Protein /100g ★" value={f.protein_per_100g} onChange={(v) => set("protein_per_100g", v)} />
        <Field label="Carbs /100g" value={f.carbs_per_100g} onChange={(v) => set("carbs_per_100g", v)} />
        <Field label="Fat /100g" value={f.fat_per_100g} onChange={(v) => set("fat_per_100g", v)} />
        <Field label="Sugar (opt)" value={f.sugar_per_100g} onChange={(v) => set("sugar_per_100g", v)} />
        <Field label="Serving g (opt)" value={f.serving_size} onChange={(v) => set("serving_size", v)} />
      </div>
      <button className="btn-primary w-full" disabled={!ok || busy} onClick={async () => {
        setBusy(true);
        const payload = { user_id: userId, source: "custom", name: f.name.trim(), brand: f.brand.trim() || null };
        ["calories_per_100g", "protein_per_100g", "carbs_per_100g", "fat_per_100g", "sugar_per_100g", "salt_per_100g", "fiber_per_100g", "serving_size"].forEach((k) => (payload[k] = num(f[k])));
        const { data } = await addFood(payload);
        setBusy(false); onPick(data || payload);
      }}>{busy ? "Saving…" : "Save & continue"}</button>
    </div>
  );
}

function BarcodeView({ onPick }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [mode, setMode] = useState("scan"); // scan | manual
  async function lookup(bc) {
    const c = (bc || code).trim();
    if (!c) return;
    setMode("manual"); setBusy(true); setErr(null);
    const food = await lookupBarcode(c);
    setBusy(false);
    if (!food) { setErr("We couldn't find this product. Add it manually, use AI, or search food."); return; }
    onPick(food);
  }
  if (mode === "scan") return <CameraScanner onDetected={(bc) => { setCode(bc); lookup(bc); }} onClose={() => setMode("manual")} />;
  return (
    <div className="space-y-3">
      <button onClick={() => { setErr(null); setMode("scan"); }} className="btn-primary flex w-full items-center justify-center gap-2 py-3"><Camera size={18} /> Scan with camera</button>
      <p className="text-center text-[11px] text-muted">or enter the barcode manually (works if the camera is blocked)</p>
      <div className="search-glass"><Barcode size={18} className="text-muted" /><input autoFocus inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter barcode number" className="w-full bg-transparent outline-none placeholder:text-muted" /></div>
      {err && <p className="text-sm text-ember">{err}</p>}
      <button className="btn-primary w-full" disabled={!code.trim() || busy} onClick={() => lookup()}>{busy ? "Looking up…" : "Look up product"}</button>
    </div>
  );
}

function AIView({ userId, initialMode, goals, totals, openReview, onLog, meal, setMeal }) {
  const [mode, setMode] = useState(initialMode || "describe");
  const tabs = [["describe", "Describe meal"], ["label", "Scan label"], ["assist", "Ask coach"]];
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setMode(k)} className={"pill flex-1 py-2 " + (mode === k ? "pill-on" : "")}>{l}</button>)}
      </div>
      {mode === "describe" && <AIDescribe onLog={onLog} meal={meal} setMeal={setMeal} />}
      {mode === "label" && <AILabel openReview={openReview} />}
      {mode === "assist" && <AIAssist goals={goals} totals={totals} />}
    </div>
  );
}

function AIDescribe({ onLog, meal, setMeal }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [est, setEst] = useState(null);
  const [err, setErr] = useState(null);
  const [photo, setPhoto] = useState(null); // { b64, mime, name } — kept in memory only, never stored
  async function pickPhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
      setPhoto({ b64, mime: file.type || "image/jpeg", name: file.name || "photo" });
    } catch { setErr("Couldn't read that photo."); }
  }
  async function estimate() {
    setBusy(true); setErr(null);
    try {
      const body = { mode: "estimate", meal: text };
      if (photo) { body.image = photo.b64; body.mimeType = photo.mime; }
      const res = await fetch("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok || !j.ok) setErr(j.error || "Couldn't estimate. Try rephrasing.");
      else setEst({ calories: j.calories, protein: j.protein, carbs: j.carbs, fat: j.fat });
    } catch { setErr("AI is offline right now."); }
    setBusy(false);
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Describe your meal, e.g. "200g cooked rice, 150g chicken breast, 1 spoon olive oil". Add a photo for a better estimate. You can edit before saving.</p>
      <textarea className="inp min-h-[90px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe what you ate…" />
      {photo ? (
        <div className="flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2">
          <ImageIcon size={16} className="text-mint" />
          <span className="min-w-0 flex-1 truncate text-sm">Photo attached</span>
          <button onClick={() => setPhoto(null)} className="text-muted active:scale-90"><X size={16} /></button>
        </div>
      ) : (
        <label className="pill flex w-full cursor-pointer items-center justify-center gap-1.5 py-2.5">
          <Camera size={14} /> Add a photo of the meal (optional)
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickPhoto} />
        </label>
      )}
      <p className="text-[11px] text-muted">Photos are only sent for the estimate — nothing is stored.</p>
      {err && <p className="text-sm text-ember">{err}</p>}
      {!est ? (
        <button className="btn-primary w-full" disabled={(!text.trim() && !photo) || busy} onClick={estimate}>{busy ? "Estimating…" : "Estimate with AI"}</button>
      ) : (
        <div className="space-y-3">
          <p className="eyebrow">Estimate (editable) · AI estimate</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Calories" value={est.calories ?? ""} onChange={(v) => setEst({ ...est, calories: num(v) })} />
            <Field label="Protein g ★" value={est.protein ?? ""} onChange={(v) => setEst({ ...est, protein: num(v) })} />
            <Field label="Carbs g" value={est.carbs ?? ""} onChange={(v) => setEst({ ...est, carbs: num(v) })} />
            <Field label="Fat g" value={est.fat ?? ""} onChange={(v) => setEst({ ...est, fat: num(v) })} />
          </div>
          <MealPicker meal={meal} setMeal={setMeal} />
          <button className="btn-primary w-full" onClick={() => onLog({
            name: (text.trim() || "Meal from photo").slice(0, 60), quantity: 1, quantity_unit: "meal",
            calculated_calories: est.calories, calculated_protein: est.protein, calculated_carbs: est.carbs, calculated_fat: est.fat,
          })}>Add to today</button>
        </div>
      )}
    </div>
  );
}

function AILabel({ openReview }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const b64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(",")[1]); r.onerror = reject; r.readAsDataURL(file); });
      const res = await fetch("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "label", image: b64, mimeType: file.type || "image/jpeg" }) });
      const j = await res.json();
      if (!res.ok || !j.ok) { setErr(j.error || "Couldn't read that label."); setBusy(false); return; }
      openReview({ source: "ai", name: j.food.name || "Scanned food", ...j.food });
    } catch { setErr("AI is offline right now."); }
    setBusy(false);
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Take a clear, straight-on photo of the nutrition label. AI reads the per-100g values — you confirm and edit before saving.</p>
      <label className="btn-primary flex w-full cursor-pointer items-center justify-center gap-2 py-4 text-base">
        <ImageIcon size={18} /> {busy ? "Reading label…" : "Take / choose label photo"}
        <input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy} onChange={onFile} />
      </label>
      {err && <p className="text-sm text-ember">{err}</p>}
    </div>
  );
}

function AIAssist({ goals, totals }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [err, setErr] = useState(null);
  const prompts = ["How much protein do I still need today?", "Suggest a high-protein dinner under 700 calories.", "What should I eat after my workout?", "Build me a 2500 kcal muscle-gain day."];
  async function ask(question) {
    const text = (question || q).trim(); if (!text) return;
    setBusy(true); setErr(null); setAnswer(null);
    try {
      const context = { calories: totals?.calories, protein: totals?.protein, carbs: totals?.carbs, fat: totals?.fat, caloriesGoal: goals?.calories_goal, proteinGoal: goals?.protein_goal };
      const res = await fetch("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "assist", question: text, context }) });
      const j = await res.json();
      if (!res.ok || !j.ok) setErr(j.error || "Couldn't answer. Try rephrasing.");
      else setAnswer(j.answer);
    } catch { setErr("AI is offline right now."); }
    setBusy(false);
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Ask about your day — the coach uses your goals and what you've logged so far.</p>
      <div className="flex flex-wrap gap-1.5">
        {prompts.map((pmt) => <button key={pmt} onClick={() => { setQ(pmt); ask(pmt); }} className="pill text-[11px]">{pmt}</button>)}
      </div>
      <textarea className="inp min-h-[70px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything about your nutrition today…" />
      <button className="btn-primary w-full" disabled={!q.trim() || busy} onClick={() => ask()}>{busy ? "Thinking…" : "Ask the coach"}</button>
      {err && <p className="text-sm text-ember">{err}</p>}
      {answer && <div className="card whitespace-pre-wrap text-sm leading-relaxed">{answer}</div>}
    </div>
  );
}

function MealPicker({ meal, setMeal }) {
  return (
    <div>
      <p className="eyebrow mb-1">Meal</p>
      <div className="flex flex-wrap gap-1.5">
        {MEALS.map((m) => <button key={m} onClick={() => setMeal(m)} className={"pill " + (meal === m ? "pill-on" : "")}>{MEAL_LABELS[m]}</button>)}
      </div>
    </div>
  );
}

function ReviewFood({ food, meal, setMeal, userId, onAdd }) {
  const [f, setF] = useState({ ...food });
  const [grams, setGrams] = useState(food.serving_size ? Number(food.serving_size) : 100);
  const [edit, setEdit] = useState(false);
  const [fav, setFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const m = macrosFor(f, grams);
  const setField = (k, v) => setF({ ...f, [k]: v });
  useEffect(() => { if (food.id) isFavorite(userId, food.id).then(setFav); }, [food.id, userId]);
  const [favErr, setFavErr] = useState(null);
  async function toggleFav() {
    setFavBusy(true); setFavErr(null);
    try {
      const saved = await ensureFood(userId, f);          // makes sure the food exists (deduped)
      const id = (saved && saved.id) || f.id;
      if (!id) throw new Error("no id");
      if (saved && saved.id && !f.id) setF((x) => ({ ...x, id: saved.id }));
      await setFavorite(userId, id, !fav);
      setFav(await isFavorite(userId, id));               // trust the database, not the click
    } catch { setFavErr("Couldn't update favourites — check your connection."); }
    setFavBusy(false);
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {f.image_url ? <img src={f.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" /> : null}
        <div className="min-w-0 flex-1"><p className="truncate font-bold capitalize">{f.name}</p>{f.brand && <p className="text-[11px] text-muted">{f.brand}</p>}{f.barcode && <p className="text-[10px] text-muted">#{f.barcode}</p>}</div>
        <button onClick={toggleFav} disabled={favBusy} aria-label="Favorite" className="shrink-0 active:scale-90 disabled:opacity-50"><Star size={22} className={fav ? "fill-gold text-gold" : "text-muted"} /></button>
      </div>
      {favErr && <p className="text-[11px] text-ember">{favErr}</p>}

      <div className="panel">
        <div className="mb-1.5 flex items-center justify-between"><p className="eyebrow">Per 100g{f.source === "recipe" ? " · typical recipe" : f.source === "ifct" ? " · IFCT 2017" : ""}</p><button onClick={() => setEdit(!edit)} className="pill">{edit ? "done" : "edit values"}</button></div>
        {edit ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Calories" value={f.calories_per_100g ?? ""} onChange={(v) => setField("calories_per_100g", num(v))} />
            <Field label="Protein" value={f.protein_per_100g ?? ""} onChange={(v) => setField("protein_per_100g", num(v))} />
            <Field label="Carbs" value={f.carbs_per_100g ?? ""} onChange={(v) => setField("carbs_per_100g", num(v))} />
            <Field label="Fat" value={f.fat_per_100g ?? ""} onChange={(v) => setField("fat_per_100g", num(v))} />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1 text-center text-sm">
            <div><p className="font-score font-bold">{Math.round(f.calories_per_100g || 0)}</p><p className="text-[10px] text-muted">kcal</p></div>
            <div><p className="font-score font-bold text-mint">{f.protein_per_100g || 0}</p><p className="text-[10px] text-muted">protein</p></div>
            <div><p className="font-score font-bold">{f.carbs_per_100g || 0}</p><p className="text-[10px] text-muted">carbs</p></div>
            <div><p className="font-score font-bold">{f.fat_per_100g || 0}</p><p className="text-[10px] text-muted">fat</p></div>
          </div>
        )}
      </div>

      <QuantityScale value={grams} onChange={setGrams} servingSize={food.serving_size ? Number(food.serving_size) : null} />

      <div className="card">
        <p className="eyebrow mb-1">This serving · {grams}g</p>
        <div className="grid grid-cols-4 gap-1 text-center">
          <div><p className="font-score text-lg font-bold text-gold">{m.calories}</p><p className="text-[10px] text-muted">kcal</p></div>
          <div><p className="font-score text-lg font-bold text-mint">{m.protein ?? 0}</p><p className="text-[10px] text-muted">protein</p></div>
          <div><p className="font-score text-lg font-bold">{m.carbs ?? 0}</p><p className="text-[10px] text-muted">carbs</p></div>
          <div><p className="font-score text-lg font-bold">{m.fat ?? 0}</p><p className="text-[10px] text-muted">fat</p></div>
        </div>
      </div>

      <MealPicker meal={meal} setMeal={setMeal} />

      <button className="btn-primary w-full py-4 text-base" onClick={async () => {
        let id = f.id || food.id || null;
        if (!id) { const saved = await ensureFood(userId, f); id = (saved && saved.id) || null; }   // dataset/quick items become reusable
        onAdd({
        food_id: id, name: f.name, quantity: grams, quantity_unit: "g", quantity_grams: grams,
        calculated_calories: m.calories, calculated_protein: m.protein, calculated_carbs: m.carbs, calculated_fat: m.fat,
        calculated_sugar: m.sugar, calculated_salt: m.salt, calculated_fiber: m.fiber,
        });
      }}>Add to {MEAL_LABELS[meal]}</button>
    </div>
  );
}

/* ---------- Saved meals ---------- */
function SavedMealsView({ userId, date, meal, setMeal, onLogged }) {
  const [meals, setMeals] = useState(null);
  const [mode, setMode] = useState("list");
  const reload = () => loadSavedMeals(userId).then(setMeals);
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  if (mode === "create") return <CreateSavedMeal userId={userId} onDone={() => { setMode("list"); reload(); }} onCancel={() => setMode("list")} />;

  return (
    <div className="space-y-3">
      <button onClick={() => setMode("create")} className="pill flex w-full items-center justify-center gap-1 py-2.5"><BookmarkPlus size={14} /> Create a saved meal</button>
      {meals === null ? <Loader label="Loading…" /> : meals.length === 0 ? (
        <p className="text-sm text-muted">No saved meals yet. Build a combo (e.g. "Post-workout: shake + banana") and log the whole thing in one tap next time.</p>
      ) : (
        <>
          <p className="eyebrow">Log to</p>
          <MealPicker meal={meal} setMeal={setMeal} />
          <div className="space-y-2">
            {meals.map((m) => {
              const t = savedMealTotals(m);
              return (
                <div key={m.id} className="panel flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{m.meal_name}</p>
                    <p className="text-[11px] text-muted">{m.items.length} item{m.items.length !== 1 ? "s" : ""} · {Math.round(t.cal)} kcal · {Math.round(t.p)}g P</p>
                  </div>
                  <button onClick={async () => { await logSavedMeal(userId, date, meal, m); onLogged(); }} className="btn-primary px-3 py-2 text-sm">Log</button>
                  <button onClick={async () => { await deleteSavedMeal(m.id); reload(); }} className="text-muted active:scale-90 hover:text-ember"><Trash2 size={16} /></button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CreateSavedMeal({ userId, onDone, onCancel }) {
  const [name, setName] = useState("");
  const [items, setItems] = useState([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function addItem(food) {
    let f = food;
    if (!f.id) {
      const { data } = await addFood({ user_id: userId, source: food.source || "custom", name: food.name, calories_per_100g: food.calories_per_100g, protein_per_100g: food.protein_per_100g, carbs_per_100g: food.carbs_per_100g, fat_per_100g: food.fat_per_100g, serving_size: food.serving_size });
      f = data || food;
    }
    setItems((prev) => [...prev, { food: f, grams: f.serving_size ? Number(f.serving_size) : 100 }]);
    setAdding(false);
  }

  if (adding) return (
    <div className="space-y-2">
      <button onClick={() => setAdding(false)} className="pill">← Back</button>
      <FoodPickerInline userId={userId} onPick={addItem} />
    </div>
  );

  return (
    <div className="space-y-3">
      <button onClick={onCancel} className="pill">← Saved meals</button>
      <input className="inp" placeholder="Meal name (e.g. Post-workout)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm font-bold capitalize">{it.food.name}</span>
            <input className="w-16 rounded-lg bg-surface px-2 py-1.5 text-center text-paper outline-none" inputMode="decimal" value={it.grams}
              onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, grams: Number(e.target.value) || 0 } : x)))} />
            <span className="text-[11px] text-muted">g</span>
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-muted"><X size={16} /></button>
          </div>
        ))}
      </div>
      <button onClick={() => setAdding(true)} className="pill flex w-full items-center justify-center gap-1 py-2.5"><Plus size={14} /> Add food</button>
      <button className="btn-primary w-full" disabled={busy || !name.trim() || items.length === 0}
        onClick={async () => { setBusy(true); await createSavedMeal(userId, name.trim(), items.map((it) => ({ food_id: it.food.id, grams: it.grams }))); setBusy(false); onDone(); }}>
        {busy ? "Saving…" : "Save meal"}
      </button>
    </div>
  );
}

function FoodPickerInline({ userId, onPick }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [recent, setRecent] = useState([]);
  useEffect(() => { recentFoods(userId).then(setRecent); }, [userId]);
  useEffect(() => { const t = setTimeout(() => searchFoods(userId, q).then(setResults), 250); return () => clearTimeout(t); }, [q, userId]);
  const list = q.trim() ? results : recent;
  return (
    <div className="space-y-2">
      <div className="search-glass"><Search size={18} className="text-muted" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your foods" className="w-full bg-transparent outline-none placeholder:text-muted" /></div>
      <div className="max-h-[42vh] space-y-1.5 overflow-y-auto">
        {list.map((f) => <FoodRow key={f.id} food={f} onClick={() => onPick(f)} />)}
        {!q.trim() && <><p className="eyebrow pt-1">Gym staples</p>{QUICK_FOODS.map((f, i) => <FoodRow key={"q" + i} food={f} onClick={() => onPick({ ...f, source: "quickadd" })} />)}</>}
      </div>
    </div>
  );
}

/* ---------- Edit an already-logged item ---------- */
function EditLogSheet({ userId, entry, onClose, onSaved }) {
  const [food, setFood] = useState(undefined); // undefined = loading, null = none
  const [grams, setGrams] = useState(Number(entry.quantity_grams || entry.quantity) || 100);
  const [meal, setMeal] = useState(entry.meal_type || "snacks");
  const [manual, setManual] = useState({
    name: entry.name || "", calories: entry.calculated_calories ?? "", protein: entry.calculated_protein ?? "",
    carbs: entry.calculated_carbs ?? "", fat: entry.calculated_fat ?? "",
  });
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getFood(entry.food_id).then((f) => setFood(f)); }, [entry.food_id]);
  useEffect(() => { if (entry.food_id) isFavorite(userId, entry.food_id).then(setFav); }, [entry.food_id, userId]);

  const m = food ? macrosFor(food, grams) : null;

  async function save() {
    setBusy(true);
    const patch = food
      ? { meal_type: meal, quantity: grams, quantity_unit: "g", quantity_grams: grams,
          calculated_calories: m.calories, calculated_protein: m.protein, calculated_carbs: m.carbs, calculated_fat: m.fat,
          calculated_sugar: m.sugar, calculated_salt: m.salt, calculated_fiber: m.fiber }
      : { meal_type: meal, name: manual.name.trim() || entry.name,
          calculated_calories: num(manual.calories), calculated_protein: num(manual.protein),
          calculated_carbs: num(manual.carbs), calculated_fat: num(manual.fat) };
    await updateLog(entry.id, patch);
    setBusy(false); onSaved(); onClose();
  }

  return (
    <Sheet title={entry.name || "Edit entry"} onClose={onClose}>
      {food === undefined ? <Loader label="Loading…" /> : (
        <div className="space-y-3">
          {food ? (
            <>
              <div className="flex items-center justify-between">
                <p className="eyebrow">Per 100g · {Math.round(food.calories_per_100g || 0)} kcal · {food.protein_per_100g || 0}g P</p>
                <button onClick={async () => { await setFavorite(userId, food.id, !fav); setFav(await isFavorite(userId, food.id)); }}
                  aria-label="Favorite" className="active:scale-90"><Star size={20} className={fav ? "fill-gold text-gold" : "text-muted"} /></button>
              </div>
              <QuantityScale value={grams} onChange={setGrams} servingSize={food.serving_size ? Number(food.serving_size) : null} />
              <div className="card">
                <p className="eyebrow mb-1">This serving · {grams}g</p>
                <div className="grid grid-cols-4 gap-1 text-center">
                  <div><p className="font-score text-lg font-bold text-gold">{m.calories}</p><p className="text-[10px] text-muted">kcal</p></div>
                  <div><p className="font-score text-lg font-bold text-mint">{m.protein ?? 0}</p><p className="text-[10px] text-muted">protein</p></div>
                  <div><p className="font-score text-lg font-bold">{m.carbs ?? 0}</p><p className="text-[10px] text-muted">carbs</p></div>
                  <div><p className="font-score text-lg font-bold">{m.fat ?? 0}</p><p className="text-[10px] text-muted">fat</p></div>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">This entry has no linked product (AI or quick estimate), so edit its totals directly.</p>
              <input className="inp" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="Name" />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Calories" value={manual.calories} onChange={(v) => setManual({ ...manual, calories: v })} />
                <Field label="Protein g ★" value={manual.protein} onChange={(v) => setManual({ ...manual, protein: v })} />
                <Field label="Carbs g" value={manual.carbs} onChange={(v) => setManual({ ...manual, carbs: v })} />
                <Field label="Fat g" value={manual.fat} onChange={(v) => setManual({ ...manual, fat: v })} />
              </div>
            </>
          )}

          <MealPicker meal={meal} setMeal={setMeal} />
          <button className="btn-primary w-full py-3.5" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
          <button onClick={async () => { await removeLog(entry.id); onSaved(); onClose(); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-ember active:scale-[.98]"><Trash2 size={16} /> Remove from diary</button>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- My foods: view / edit / delete everything you've added ---------- */
function MyFoodsView({ userId, onPick }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const reqRef = useRef(0);
  const reload = useCallback((term) => {
    const id = ++reqRef.current;
    loadMyFoods(userId, term === undefined ? q : term).then((r) => { if (id === reqRef.current) setItems(r); }).catch(() => {});
  }, [userId, q]);
  useEffect(() => { const t = setTimeout(() => reload(), 250); return () => clearTimeout(t); }, [q, reload]);

  if (editing) return <FoodEditor food={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />;

  return (
    <div className="space-y-2">
      <div className="search-glass"><Search size={18} className="text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your foods" className="w-full bg-transparent outline-none placeholder:text-muted" /></div>
      <p className="eyebrow">Tap to log · edit or delete any item</p>
      <div className="max-h-[55vh] space-y-1.5 overflow-y-auto">
        {items === null ? <Loader label="Loading…" /> : items.length === 0 ? (
          <p className="px-1 text-sm text-muted">{q.trim() ? "No match." : "Nothing here yet. Foods you add manually, save from a scan, or create as quick items show up here."}</p>
        ) : items.map((f) => (
          <div key={f.id} className="panel flex items-center gap-2 p-2.5">
            <button onClick={() => onPick(f)} className="flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[.99]">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface2 font-display text-line">{(f.name || "?")[0].toUpperCase()}</div>
              <div className="min-w-0">
                <p className="truncate font-bold capitalize">{f.name}</p>
                <p className="text-[11px] text-muted">{f.brand ? f.brand + " · " : ""}{Math.round(f.calories_per_100g || 0)} kcal · {f.protein_per_100g || 0}g P /100g</p>
              </div>
            </button>
            <button onClick={() => setEditing(f)} aria-label="Edit food" className="text-muted active:scale-90"><Pencil size={15} /></button>
            <button aria-label="Delete food" className="text-muted active:scale-90 hover:text-ember"
              onClick={async () => { setItems((prev) => prev.filter((x) => x.id !== f.id)); reqRef.current++; await deleteFoodRow(f.id); reload(); }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FoodEditor({ food, onCancel, onSaved }) {
  const [f, setF] = useState({
    name: food.name || "", brand: food.brand || "", calories_per_100g: food.calories_per_100g ?? "",
    protein_per_100g: food.protein_per_100g ?? "", carbs_per_100g: food.carbs_per_100g ?? "",
    fat_per_100g: food.fat_per_100g ?? "", serving_size: food.serving_size ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <div className="space-y-3">
      <button onClick={onCancel} className="pill">← My foods</button>
      <input className="inp" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Name" />
      <input className="inp" value={f.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Brand (optional)" />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Calories /100g" value={f.calories_per_100g} onChange={(v) => set("calories_per_100g", v)} />
        <Field label="Protein /100g ★" value={f.protein_per_100g} onChange={(v) => set("protein_per_100g", v)} />
        <Field label="Carbs /100g" value={f.carbs_per_100g} onChange={(v) => set("carbs_per_100g", v)} />
        <Field label="Fat /100g" value={f.fat_per_100g} onChange={(v) => set("fat_per_100g", v)} />
      </div>
      <Field label="Usual serving (g, optional)" value={f.serving_size} onChange={(v) => set("serving_size", v)} />
      <button className="btn-primary w-full" disabled={busy || !f.name.trim()} onClick={async () => {
        setBusy(true);
        await updateFoodRow(food.id, { name: f.name.trim(), brand: f.brand.trim() || null, calories_per_100g: num(f.calories_per_100g), protein_per_100g: num(f.protein_per_100g), carbs_per_100g: num(f.carbs_per_100g), fat_per_100g: num(f.fat_per_100g), serving_size: num(f.serving_size) });
        setBusy(false); onSaved();
      }}>{busy ? "Saving…" : "Save changes"}</button>
      <p className="text-[11px] text-muted">Editing a food changes it for future logs. Entries already in your diary keep the numbers they were logged with.</p>
    </div>
  );
}

/* ---------- Calories burned ---------- */
function BurnSheet({ userId, date, weightKg, onClose, onSaved }) {
  const [mode, setMode] = useState("workout");
  const [wk, setWk] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);   // { label, calories, minutes, source }
  const [manual, setManual] = useState({ label: "", calories: "", minutes: "" });

  useEffect(() => { workoutSummary(userId, date).then(setWk).catch(() => setWk({ count: 0, minutes: 0, exercises: [] })); }, [userId, date]);

  async function estimate(payload, source) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "burn", weightKg, ...payload }) });
      const j = await res.json();
      if (!res.ok || !j.ok) setErr(j.error || "Couldn't estimate that.");
      else setResult({ label: j.label, calories: j.calories, minutes: j.minutes, source });
    } catch { setErr("AI is offline right now."); }
    setBusy(false);
  }

  async function save(entry) {
    setBusy(true);
    await addBurn(userId, date, entry);
    setBusy(false); onSaved(); onClose();
  }

  const tabs = [["workout", "From workout"], ["describe", "Describe"], ["manual", "Manual"]];

  return (
    <Sheet title="Calories burned" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex gap-1.5">
          {tabs.map(([k, l]) => <button key={k} onClick={() => { setMode(k); setResult(null); setErr(null); }} className={"pill flex-1 py-2 " + (mode === k ? "pill-on" : "")}>{l}</button>)}
        </div>

        {mode === "workout" && (
          <div className="space-y-3">
            {wk === null ? <Loader label="Checking today's training…" /> : wk.count === 0 && !wk.minutes ? (
              <p className="text-sm text-muted">Nothing logged in Grind for this day yet. Log your workout there first, or use Describe / Manual.</p>
            ) : (
              <>
                <div className="panel">
                  <p className="eyebrow mb-1 flex items-center gap-1"><Dumbbell size={12} /> Today in Grind</p>
                  <p className="text-sm">{wk.count} exercise{wk.count !== 1 ? "s" : ""}{wk.minutes ? " · " + wk.minutes + " min session" : ""}</p>
                  {wk.exercises.length > 0 && <p className="mt-1 text-[11px] text-muted">{wk.exercises.slice(0, 4).join(" · ")}{wk.exercises.length > 4 ? " …" : ""}</p>}
                </div>
                <button className="btn-primary w-full py-3.5" disabled={busy} onClick={() => estimate({ workout: wk }, "workout")}>
                  {busy ? "Estimating…" : "Estimate with AI"}
                </button>
              </>
            )}
          </div>
        )}

        {mode === "describe" && (
          <div className="space-y-3">
            <p className="text-sm text-muted">e.g. "45 min football", "30 min run at 10 km/h", "1 hour cycling to work and back".</p>
            <textarea className="inp min-h-[80px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="What did you do?" />
            <button className="btn-primary w-full" disabled={!text.trim() || busy} onClick={() => estimate({ activity: text }, "ai")}>{busy ? "Estimating…" : "Estimate with AI"}</button>
          </div>
        )}

        {mode === "manual" && (
          <div className="space-y-3">
            <input className="inp" placeholder="Activity (e.g. Evening walk)" value={manual.label} onChange={(e) => setManual({ ...manual, label: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Calories burned" value={manual.calories} onChange={(v) => setManual({ ...manual, calories: v })} />
              <Field label="Minutes (optional)" value={manual.minutes} onChange={(v) => setManual({ ...manual, minutes: v })} />
            </div>
            <button className="btn-primary w-full" disabled={!manual.calories || busy}
              onClick={() => save({ label: manual.label.trim() || "Activity", calories: num(manual.calories), minutes: num(manual.minutes), source: "manual" })}>
              {busy ? "Saving…" : "Add to today"}
            </button>
          </div>
        )}

        {err && <p className="text-sm text-ember">{err}</p>}

        {result && (
          <div className="space-y-3 rounded-2xl border border-line p-3">
            <p className="eyebrow">Estimate — edit if you want</p>
            <input className="inp" value={result.label} onChange={(e) => setResult({ ...result, label: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Calories" value={result.calories} onChange={(v) => setResult({ ...result, calories: num(v) })} />
              <Field label="Minutes" value={result.minutes ?? ""} onChange={(v) => setResult({ ...result, minutes: num(v) })} />
            </div>
            <p className="text-[11px] text-muted">AI estimate — training burns are easy to overestimate, so treat it as a rough number.</p>
            <button className="btn-primary w-full" disabled={busy}
              onClick={() => save({ label: result.label || "Activity", calories: num(result.calories) || 0, minutes: num(result.minutes), source: result.source === "workout" ? "workout" : "ai" })}>
              {busy ? "Saving…" : "Add " + Math.round(result.calories || 0) + " kcal"}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
