import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import { loadGroupWins, bestPRs } from "../lib/achievements.js";
import { LogOut, Trophy, Moon, Sun, Bell, HelpCircle, ChevronRight, ChevronLeft } from "lucide-react";
import Sheet from "../components/Sheet.jsx";
import CountUp from "../components/CountUp.jsx";
import { currentStreak, consistencyScore, toISO } from "../lib/streak.js";
import { Flame } from "lucide-react";
import { currentTheme, applyTheme } from "../lib/theme.js";
import { pushSupported, isStandalone, pushStatus, enablePush, disablePush, sendTestPush } from "../lib/push.js";

const GOALS = ["Lose fat", "Build muscle", "Recomp", "Stay consistent", "Get stronger", "Run more"];

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, activeChallenge, refresh, signOut } = useAuth();
  const [form, setForm] = useState({ name: "", height_cm: "", start_weight_kg: "", current_weight_kg: "", weekly_goal: 4, goals: [] });
  const [prs, setPrs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(currentTheme());
  const switchTheme = (t) => { applyTheme(t); setTheme(t); };
  const [pushState, setPushState] = useState("loading");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushErr, setPushErr] = useState(null);
  const isOwner = user.email === "sohambanarase1999@gmail.com";
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  async function testNotif() {
    setTestBusy(true); setTestMsg(null);
    try {
      const r = await sendTestPush(user.id);
      setTestMsg(r.sent > 0
        ? `Sent to ${r.sent} device${r.sent !== 1 ? "s" : ""} — check your devices.`
        : (r.note || (r.lastError ? "Send failed: " + r.lastError : "Nothing sent.")));
    } catch (e) { setTestMsg(e.message || "Test failed."); }
    setTestBusy(false);
  }
  const needsInstall = pushSupported() && !isStandalone();
  useEffect(() => {
    const since = toISO(new Date(Date.now() - 30 * 86400000));
    supabase.from("daily_logs").select("log_date, workout_type").eq("user_id", user.id)
      .gte("log_date", since).order("log_date", { ascending: false })
      .then(({ data }) => setLogs(data || []));
  }, [user.id]);

  useEffect(() => { pushStatus().then(setPushState); }, []);
  async function enableNotifs() {
    setPushBusy(true); setPushErr(null);
    try { await enablePush(user.id); setPushState("on"); }
    catch (e) { setPushErr(e.message || "Couldn't enable notifications."); setPushState(await pushStatus()); }
    setPushBusy(false);
  }
  async function disableNotifs() {
    setPushBusy(true);
    try { await disablePush(); } catch {}
    setPushState("off"); setPushBusy(false);
  }

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
    <div className="screen animate-screen space-y-4">
      <button onClick={() => navigate("/")} className="pill mt-1 flex w-fit items-center gap-1"><ChevronLeft size={14} /> Arena</button>
      <div className="card grain overflow-hidden">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-25" style={{ background: "var(--grad-gold)", filter: "blur(30px)" }} />
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full p-[3px]" style={{ background: "var(--grad-gold)" }}>
            <div className="grid h-full w-full place-items-center rounded-full bg-ink font-display text-2xl text-gold">
              {(form.name || "A")[0].toUpperCase()}
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl uppercase leading-none tracking-wide">{form.name || "Athlete"}</h1>
            <p className="truncate text-[11px] text-muted">{user.email}</p>
            <p className="mt-1 flex items-center gap-1 text-sm font-bold text-ember"><Flame size={14} /> <CountUp value={currentStreak(logs)} duration={600} /> day streak</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface2/70 px-2 py-2.5"><p className="font-score text-xl font-bold text-gold"><CountUp value={consistencyScore(logs, form.weekly_goal || 4).days} duration={600} /></p><p className="eyebrow mt-0.5 !text-[9px]">Gym days wk</p></div>
          <div className="rounded-xl bg-surface2/70 px-2 py-2.5"><p className="font-score text-xl font-bold text-mint"><CountUp value={prs.length} duration={700} /></p><p className="eyebrow mt-0.5 !text-[9px]">PR lifts</p></div>
          <div className="rounded-xl bg-surface2/70 px-2 py-2.5"><p className="font-score text-xl font-bold text-gold"><CountUp value={delta !== null ? Math.abs(delta) : 0} decimals={1} duration={800} /></p><p className="eyebrow mt-0.5 !text-[9px]">kg {delta !== null && delta > 0 ? "gained" : "lost"}</p></div>
        </div>
        <div className="mt-3">
          <p className="eyebrow mb-1.5">Last 14 days</p>
          <div className="flex gap-1">
            {Array.from({ length: 14 }).map((_, i) => {
              const day = toISO(new Date(Date.now() - (13 - i) * 86400000));
              const l = logs.find((x) => x.log_date === day);
              const active = l && (l.workout_type === "lift" || l.workout_type === "cardio");
              const rest = l && l.workout_type === "rest";
              return <div key={i} className={"h-2.5 flex-1 rounded-full " + (active ? "bg-gold" : rest ? "bg-mint opacity-60" : "bg-surface2")} title={day} />;
            })}
          </div>
        </div>
      </div>

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

      <button onClick={() => setShowHelp(true)} className="card flex w-full items-center gap-3 text-left active:scale-[.99]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface2"><HelpCircle size={18} className="text-gold" /></span>
        <div className="flex-1"><p className="font-bold">How it works</p><p className="text-[11px] text-muted">What each tab does, and what the Arena numbers mean</p></div>
        <ChevronRight size={18} className="text-muted" />
      </button>

      <div className="card">
        <p className="eyebrow flex items-center gap-1"><Bell size={12} /> Notifications</p>
        {pushState === "unsupported" ? (
          <p className="mt-2 text-sm text-muted">This browser doesn't support push notifications.</p>
        ) : pushState === "on" ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted">On — daily reminder and nudges are live.</p>
              <button onClick={disableNotifs} disabled={pushBusy} className="pill shrink-0">Turn off</button>
            </div>
            {isOwner && (
              <button onClick={testNotif} disabled={testBusy} className="btn-primary w-full">{testBusy ? "Sending…" : "Send test notification"}</button>
            )}
            {isOwner && testMsg && <p className="text-[11px] text-muted">{testMsg}</p>}
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">A daily check-in reminder, plus a nudge when someone posts a win, joins, or passes you on the board.</p>
            <button onClick={enableNotifs} disabled={pushBusy} className="btn-primary mt-3 w-full">{pushBusy ? "Enabling…" : "Enable notifications"}</button>
            {needsInstall && <p className="mt-2 text-[11px] text-muted">On iPhone: add FitArena to your home screen and open it from that icon first, then enable.</p>}
            {pushState === "denied" && <p className="mt-2 text-[11px] text-ember">Notifications are blocked. Allow them for FitArena in your settings, then try again.</p>}
          </>
        )}
        {pushErr && <p className="mt-2 text-[11px] text-ember">{pushErr}</p>}
      </div>

      {showHelp && <HelpSheet onClose={() => setShowHelp(false)} />}

      {delta !== null && (
        <div className="card flex items-center justify-between">
          <div>
            <p className="eyebrow">Weight change</p>
            <p className="font-score text-3xl font-bold text-gold">{delta > 0 ? "+" : ""}{delta}<span className="text-base text-muted"> kg</span></p>
          </div>
          <p className="text-right text-sm text-muted">{form.start_weight_kg} → {form.current_weight_kg} kg</p>
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
        <button className="btn-primary w-full" onClick={save} disabled={busy}>{busy ? "Saving…" : saved ? "Saved ✓" : "Save"}</button>
      </div>

      <div className="card">
        <p className="eyebrow flex items-center gap-1"><Trophy size={12} /> Your PR bests</p>
        {prs.length ? (
          <div className="mt-2 space-y-1.5">
            {prs.map((w) => (
              <div key={w.id} className="flex items-center justify-between border-b border-line/60 pb-1.5 last:border-0">
                <span className="capitalize">{w.exercise}</span>
                <span className="font-score text-gold">{w.weight_kg ? w.weight_kg + "kg" : ""}{w.reps ? " × " + w.reps : ""}</span>
              </div>
            ))}
          </div>
        ) : <p className="mt-1 text-sm text-muted">No PRs yet. Log one from the Arena → Post a win.</p>}
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


function HelpSheet({ onClose }) {
  const Row = ({ term, children }) => (
    <div className="rounded-xl bg-surface2 px-3 py-2.5">
      <p className="font-bold">{term}</p>
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
  return (
    <Sheet title="How it works" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="eyebrow mb-2">The tabs</p>
          <div className="space-y-1.5">
            <Row term="Arena">The leaderboard, plus your daily check-in. Each day, log whether you trained.</Row>
            <Row term="Grind">Your personal training: goals that track themselves, a set-by-set workout log, and reusable workout plans.</Row>
            <Row term="Coach">An AI read of your week with suggestions for your goals — and you can ask it short training questions.</Row>
            <Row term="Playbook">A searchable library of exercises with how-to steps.</Row>
            <Row term="Profile">Your stats, goals, theme, and notifications.</Row>
          </div>
        </div>
        <div>
          <p className="eyebrow mb-2">The Arena numbers</p>
          <div className="space-y-1.5">
            <Row term="Score">Your weekly total = Consistency + Bonus. Higher wins.</Row>
            <Row term="Consistency (0–100)">Gym days this week ÷ your weekly goal. Hit your goal and it maxes at 100.</Row>
            <Row term="Bonus (up to +15)">Points from wins you post — a PR is +3, a brag is +1. Kept small on purpose, so showing up matters most.</Row>
            <Row term="Streak (e.g. 5d)">Days in a row you've been active. Lifting, cardio, or a rest day keep it alive; a missed day breaks it.</Row>
            <Row term="Rank (#)">Where you sit on the leaderboard this week.</Row>
            <Row term="Crew">How many people are in the challenge. Tap it to see everyone (the creator can remove members).</Row>
            <Row term="Top dog / You">The current leader, and your own rank and score at a glance.</Row>
            <Row term="Days left">Days remaining in the challenge.</Row>
          </div>
        </div>
        <p className="text-[11px] text-muted">Everything resets every Monday, so each week is a fresh race.</p>
      </div>
    </Sheet>
  );
}
