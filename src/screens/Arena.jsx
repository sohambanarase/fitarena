import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import { buildLeaderboard, toISO } from "../lib/streak.js";
import { loadGroupWins } from "../lib/achievements.js";
import CountdownBell from "../components/CountdownBell.jsx";
import CheckInCard from "../components/CheckInCard.jsx";
import ContenderCard from "../components/ContenderCard.jsx";
import WinsFeed from "../components/WinsFeed.jsx";
import WinComposer from "../components/WinComposer.jsx";
import ChallengeSwitcher from "../components/ChallengeSwitcher.jsx";
import Sheet from "../components/Sheet.jsx";
import Loader from "../components/Loader.jsx";
import CountUp from "../components/CountUp.jsx";
import { ChevronDown, UserPlus, Share2, Plus, Trophy, UserMinus, Crown, Trash2 } from "lucide-react";

export default function Arena() {
  const { user, activeChallenge , refresh } = useAuth();
  const [board, setBoard] = useState([]);
  const [wins, setWins] = useState([]);
  const [names, setNames] = useState({});
  const [savedType, setSavedType] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    if (!activeChallenge) { setLoading(false); return; }
    setLoading(true);
    setErr(null);

    // 1) member ids for this challenge
    const { data: cm, error: cmErr } = await supabase
      .from("challenge_members").select("user_id").eq("challenge_id", activeChallenge.id);
    const ids = (cm || []).map((r) => r.user_id);

    // 2) their profiles (separate query — challenge_members has no direct FK to profiles)
    const { data: profRows, error: pErr } = await supabase
      .from("profiles").select("id, name, weekly_goal")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const people = profRows || [];
    setNames(Object.fromEntries(people.map((p) => [p.id, p.name || "Athlete"])));

    const since = toISO(new Date(Date.now() - 21 * 86400000));
    const { data: logs } = await supabase
      .from("daily_logs")
      .select("user_id, log_date, workout_type")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .gte("log_date", since);

    const winRows = await loadGroupWins(ids, activeChallenge.id);
    const logsByUser = {}, winsByUser = {};
    (logs || []).forEach((l) => (logsByUser[l.user_id] ||= []).push(l));
    winRows.forEach((w) => (winsByUser[w.user_id] ||= []).push(w));

    setBoard(buildLeaderboard(people, logsByUser, winsByUser));
    setWins(winRows);
    setSavedType((logsByUser[user.id] || []).find((l) => l.log_date === toISO(new Date()))?.workout_type || null);
    if (cmErr || pErr) setErr((cmErr || pErr).message);
    setLoading(false);
  }, [activeChallenge, user]);

  useEffect(() => { load(); }, [load]);

  async function submitCheckIn(type) {
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("daily_logs")
      .upsert({ user_id: user.id, log_date: toISO(new Date()), workout_type: type }, { onConflict: "user_id,log_date" });
    if (error) setErr(error.message);
    else { setSavedType(type); if (type === "lift" || type === "cardio") { setCelebrate(true); setTimeout(() => setCelebrate(false), 1400); } }
    await load();
    setSaving(false);
  }

  if (!activeChallenge)
    return (
      <>
        <div className="screen flex flex-col justify-center text-center">
          <h1 className="font-display text-4xl uppercase tracking-wide">Pick your fight</h1>
          <p className="mt-1 text-sm text-muted">Create a challenge or join your friends with a code.</p>
          <button className="btn-primary mt-5" onClick={() => setSheet("switch")}>Get started</button>
        </div>
        {sheet === "switch" && <ChallengeSwitcher onClose={() => setSheet(null)} />}
      </>
    );

  const me = board.find((r) => r.id === user.id);
  const leader = board[0];
  const crewSessions = board.reduce((s, r) => s + r.days, 0);

  async function deleteWin(w) {
    await supabase.rpc("delete_win", { win_id: w.id });
    load();
  }
  const isCreator = activeChallenge?.created_by === user.id;

  return (
    <div className="screen animate-screen space-y-3">
      <header className="flex items-center gap-2 pt-1">
        <span className="w-14 shrink-0 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Arena</span>
        <button
          onClick={() => setSheet("switch")}
          className="glass mx-auto flex min-w-0 max-w-[62%] items-center gap-1.5 rounded-full px-4 py-2.5 active:scale-95"
        >
          <span className="truncate font-bold">{activeChallenge.name}</span>
          <ChevronDown size={16} className="shrink-0 text-gold" />
        </button>
        <button onClick={() => setSheet("invite")} className="pill flex w-14 shrink-0 items-center justify-center gap-1">
          <UserPlus size={14} />
        </button>
      </header>

      <div className="flex items-stretch gap-2">
        <div className="glass flex-1 rounded-2xl px-3 py-2.5">
          <p className="eyebrow">Top dog</p>
          <p className="truncate font-bold">{leader && leader.total > 0 ? names[leader.id] + " · " + leader.total : "Up for grabs"}</p>
        </div>
        <div className="glass flex-1 rounded-2xl px-3 py-2.5">
          <p className="eyebrow">You</p>
          <p className="font-bold">{me ? "#" + me.rank + " · " + me.total : "—"}</p>
        </div>
        <button onClick={() => setSheet("members")} className="glass rounded-2xl px-3 py-2.5 text-center active:scale-95">
          <p className="eyebrow">Crew</p>
          <p className="font-score font-bold text-gold"><CountUp value={board.length} duration={500} /></p>
        </button>
      </div>

      <CountdownBell endDate={activeChallenge.end_date} />
      <CheckInCard savedType={savedType} onSubmit={submitCheckIn} saving={saving} />
      {err && <p className="rounded-xl border border-ember/50 bg-ember/10 px-3 py-2 text-sm text-ember">{err}</p>}

      <div className="pt-1">
        <p className="eyebrow mb-2">Standings · resets Monday</p>
        {loading ? <Loader label="Counting reps…" /> : (
          <div className="space-y-2">
            {board.map((row) => <ContenderCard key={row.id} row={row} isMe={row.id === user.id} />)}
          </div>
        )}
      </div>

      <div className="pt-2">
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow flex items-center gap-1"><Trophy size={12} /> Wins feed</p>
          <button onClick={() => setSheet("post")} className="pill pill-on flex items-center gap-1"><Plus size={14} /> Post a win</button>
        </div>
        {!loading && <WinsFeed wins={wins} nameOf={(id) => names[id] || "Athlete"} canDelete={(w) => w.user_id === user.id || isCreator} onDelete={deleteWin} />}
      </div>

      {sheet === "switch" && <ChallengeSwitcher onClose={() => setSheet(null)} />}
      {sheet === "post" && <WinComposer challengeId={activeChallenge.id} onClose={() => setSheet(null)} onPosted={load} />}
      {celebrate && (
        <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center">
          <div className="animate-stamp rounded-3xl border-4 border-gold bg-ink/85 px-8 py-5 text-center shadow-2xl" style={{ backdropFilter: "blur(8px)" }}>
            <p className="font-display text-4xl uppercase tracking-wider text-gold">Logged</p>
            <p className="mt-1 text-sm text-mint">Rank points earned 💪</p>
          </div>
        </div>
      )}
      {sheet === "invite" && <InviteSheet challenge={activeChallenge} onClose={() => setSheet(null)} />}
      {sheet === "members" && <MembersSheet challenge={activeChallenge} board={board} meId={user.id} sessions={crewSessions} onClose={() => setSheet(null)} onChanged={load} onDeleteChallenge={async () => { await supabase.rpc("delete_challenge", { c_id: activeChallenge.id }); setSheet(null); refresh(); }} />}
    </div>
  );
}

function MembersSheet({ challenge, board, meId, sessions, onClose, onChanged, onDeleteChallenge }) {
  const isAdmin = challenge.created_by === meId;
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  async function remove(id) {
    setBusy(id); setErr(null);
    const { error } = await supabase.rpc("remove_member", { c_id: challenge.id, target: id });
    if (error) setErr(error.message);
    setBusy(null); onChanged();
  }
  return (
    <Sheet title="Crew" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">{board.length} in "{challenge.name}" · {sessions} sessions this week</p>
      <div className="space-y-2">
        {board.map((m) => {
          const owner = m.id === challenge.created_by;
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-xl bg-surface2 px-3 py-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold font-bold text-ink">{(m.name || "A")[0].toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{m.name || "Athlete"}{m.id === meId && <span className="text-xs font-normal text-mint"> you</span>}</p>
                {owner && <p className="flex items-center gap-1 text-[11px] text-muted"><Crown size={11} className="text-gold" /> Creator</p>}
              </div>
              {isAdmin && m.id !== meId && (
                <button onClick={() => remove(m.id)} disabled={busy === m.id} className="flex items-center gap-1 text-sm text-ember active:scale-95 disabled:opacity-50">
                  <UserMinus size={16} /> Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
      {err && <p className="mt-2 text-sm text-ember">{err}</p>}
      {!isAdmin && <p className="mt-3 text-[11px] text-muted">Only the challenge creator can remove members.</p>}

      {isAdmin && (
        <div className="mt-6 border-t border-line pt-4">
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-ember/50 py-3 font-bold text-ember active:scale-[.98]">
              <Trash2 size={16} /> Delete this challenge
            </button>
          ) : (
            <div className="rounded-xl border border-ember/50 bg-ember/10 p-3">
              <p className="text-sm font-bold">Delete "{challenge.name}"?</p>
              <p className="mt-1 text-[11px] text-muted">This removes the challenge, its leaderboard, and its wins feed for everyone. Personal workout logs are kept. This can't be undone.</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setConfirmDel(false)} className="pill flex-1 py-2.5">Cancel</button>
                <button onClick={async () => { setDelBusy(true); await onDeleteChallenge(); }} disabled={delBusy} className="flex-1 rounded-full bg-ember py-2.5 text-sm font-bold text-ink active:scale-95 disabled:opacity-50">{delBusy ? "Deleting…" : "Yes, delete"}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function InviteSheet({ challenge, onClose }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const text = 'Join my FitArena challenge "' + challenge.name + '". Code: ' + challenge.invite_code;
    if (navigator.share) { try { await navigator.share({ text }); } catch (e) {} }
    else { await navigator.clipboard.writeText(challenge.invite_code); setCopied(true); }
  };
  return (
    <Sheet title="Add a friend" onClose={onClose}>
      <p className="text-sm text-muted">Send this code. They tap "Join with a code" after signing up.</p>
      <div className="mt-3 rounded-xl border border-line bg-surface2 px-4 py-5 text-center">
        <p className="font-score text-4xl font-bold tracking-[0.3em] text-gold">{challenge.invite_code}</p>
      </div>
      <button className="btn-primary mt-3 flex w-full items-center justify-center gap-2" onClick={share}>
        <Share2 size={16} /> {copied ? "Copied!" : "Share invite"}
      </button>
    </Sheet>
  );
}
