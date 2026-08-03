import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import Loader from "../components/Loader.jsx";
import Sheet from "../components/Sheet.jsx";
import CountUp from "../components/CountUp.jsx";
import { loadMyHistory, syncMyScore, loadLeaderboard, loadMyScoreRow, setNickname } from "../lib/globalScore.js";
import { computeScore, streakState, POINTS, REST_ALLOWANCE, MILESTONES } from "../lib/score.js";
import { ChevronLeft, Trophy, Flame, Pencil, Info } from "lucide-react";

export default function GlobalBoard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [mine, setMine] = useState(null);
  const [score, setScore] = useState(null);
  const [rest, setRest] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const load = useCallback(async () => {
    try {
      const history = await loadMyHistory(user.id);
      setScore(computeScore(history.logs, history.wins, history.weeklyGoal));
      setRest(streakState(history.logs));
      await syncMyScore(user.id, history);            // publish before reading the board
      const [rows, row] = await Promise.all([loadLeaderboard(), loadMyScoreRow(user.id)]);
      setBoard(rows); setMine(row);
    } catch {
      setBoard([]);                                   // offline: show the empty state, not a spinner
    }
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const myRank = board?.find((r) => r.user_id === user.id)?.rank;

  return (
    <div className="screen animate-screen space-y-4">
      <button onClick={() => navigate("/")} className="pill mt-1 flex w-fit items-center gap-1"><ChevronLeft size={14} /> Arena</button>
      <ScreenHeader eyebrow="All-time" title="Global board" right={
        <button onClick={() => setShowRules(true)} aria-label="How points work" className="grid h-9 w-9 place-items-center rounded-full bg-surface2 text-muted active:scale-90"><Info size={17} /></button>
      } />

      {/* your permanent score */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="font-score text-4xl font-bold text-gold"><CountUp value={score?.points || 0} duration={700} /></p>
            <p className="text-[10px] text-muted">total points</p>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-bold">{mine?.nickname || "No nickname yet"}</p>
              <button onClick={() => setEditing(true)} aria-label="Edit nickname" className="text-muted active:scale-90"><Pencil size={13} /></button>
            </div>
            <p className="text-[12px] text-muted">
              {myRank ? "Rank #" + myRank + " · " : ""}{score?.activeDays || 0} active days · best streak {score?.bestStreak || 0}
            </p>
            <p className="flex items-center gap-1 text-[12px] font-bold text-mint">
              <Flame size={13} /> {score?.currentStreak || 0} day streak
              {rest?.state === "resting" && <span className="font-semibold text-muted">· {rest.restLeft} rest day{rest.restLeft !== 1 ? "s" : ""} left</span>}
            </p>
          </div>
        </div>
        {!mine?.nickname && (
          <button onClick={() => setEditing(true)} className="btn-primary mt-3 w-full py-2.5 text-sm">Set a nickname to appear on the board</button>
        )}
      </div>

      {/* the board */}
      <div>
        <p className="eyebrow mb-2 flex items-center gap-1"><Trophy size={13} className="text-gold" /> Everyone, all time</p>
        {board === null ? <Loader label="Counting points…" /> : board.length === 0 ? (
          <p className="text-sm text-muted">Nobody on the board yet. Set a nickname and you'll be first.</p>
        ) : (
          <div className="space-y-1.5">
            {board.map((r) => {
              const isMe = r.user_id === user.id;
              return (
                <div key={r.user_id} className={"flex items-center gap-3 rounded-xl px-3 py-2.5 " + (isMe ? "border border-gold/40 bg-gold/10" : "panel")}>
                  <span className={"w-7 shrink-0 font-score text-sm font-bold " + (r.rank <= 3 ? "text-gold" : "text-muted")}>#{r.rank}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{r.nickname || "Anonymous"}{isMe ? " (you)" : ""}</p>
                    <p className="text-[11px] text-muted">{r.active_days} active days · best streak {r.best_streak}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-score font-bold text-gold">{r.points}</p>
                    {r.current_streak > 0 && <p className="text-[10px] text-mint">🔥 {r.current_streak}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted">Points never reset. They keep adding up across every challenge you run.</p>
      </div>

      {editing && <NicknameSheet userId={user.id} current={mine?.nickname} onClose={() => setEditing(false)} onSaved={load} />}
      {showRules && <RulesSheet score={score} onClose={() => setShowRules(false)} />}
    </div>
  );
}

function NicknameSheet({ userId, current, onClose, onSaved }) {
  const [name, setName] = useState(current || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  async function save() {
    setBusy(true); setErr(null);
    const { error } = await setNickname(userId, name);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onSaved(); onClose();
  }
  return (
    <Sheet title="Your nickname" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted">This is the name everyone sees on the global board. Up to 20 characters.</p>
        <input className="inp" autoFocus value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="e.g. IronMike" />
        {err && <p className="text-sm text-ember">{err}</p>}
        <button className="btn-primary w-full py-3.5" disabled={busy || !name.trim()} onClick={save}>{busy ? "Saving…" : "Save nickname"}</button>
      </div>
    </Sheet>
  );
}

function RulesSheet({ score, onClose }) {
  const rows = [
    ["Train (lift or cardio)", "+" + POINTS.activeDay + " a day"],
    ["Streak bonus", "+" + POINTS.streakPerDay + " per day in a row, up to +" + POINTS.streakBonusCap],
    ["Weekly goal met", "+" + POINTS.weeklyGoal],
    ["Personal record", "+" + POINTS.pr],
    ["Brag posted", "+" + POINTS.brag],
    ["Streak milestones", Object.entries(MILESTONES).map(([d, p]) => d + "d +" + p).join(" · ")],
  ];
  return (
    <Sheet title="How points work" onClose={onClose}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          {rows.map(([l, v]) => (
            <div key={l} className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2">
              <span className="text-sm">{l}</span><span className="text-sm font-bold text-gold">{v}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted">
          Rest days earn nothing but protect your streak — up to {REST_ALLOWANCE} in a row. A {REST_ALLOWANCE + 1}th straight rest day,
          or a day with nothing logged, resets the streak to zero. Today never breaks it until the day is over.
        </p>
        {score && (
          <div className="card">
            <p className="eyebrow mb-1.5">Where your {score.points} points came from</p>
            <div className="space-y-1 text-[12px]">
              <Row label="Training days" value={score.breakdown.activity} />
              <Row label="Streak bonuses" value={score.breakdown.streak} />
              <Row label="Weekly goals hit" value={score.breakdown.weekly} />
              <Row label="PRs and brags" value={score.breakdown.wins} />
              <Row label="Milestones" value={score.breakdown.milestones} />
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
function Row({ label, value }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{label}</span><span className="font-score font-bold">{value}</span></div>;
}
