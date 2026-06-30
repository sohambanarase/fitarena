import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import { buildLeaderboard, toISO, startOfWeekISO } from "../lib/streak.js";
import CountdownBell from "../components/CountdownBell.jsx";
import CheckInCard from "../components/CheckInCard.jsx";
import ContenderCard from "../components/ContenderCard.jsx";
import Loader from "../components/Loader.jsx";
import { UserPlus, Share2, X } from "lucide-react";

export default function Arena() {
  const { user, profile, challenge, setChallenge, refresh } = useAuth();
  const [board, setBoard] = useState([]);
  const [todayType, setTodayType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const load = useCallback(async () => {
    if (!challenge) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // members of this challenge + their profiles
    const { data: members } = await supabase
      .from("challenge_members")
      .select("user_id, profiles(id, name, weekly_goal)")
      .eq("challenge_id", challenge.id);

    const people = (members || []).map((m) => m.profiles).filter(Boolean);
    const ids = people.map((p) => p.id);

    // logs from start of this week is enough for score; pull 21 days for streaks
    const since = toISO(new Date(Date.now() - 21 * 86_400_000));
    const { data: logs } = await supabase
      .from("daily_logs")
      .select("user_id, log_date, workout_type")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .gte("log_date", since);

    const logsByUser = {};
    (logs || []).forEach((l) => (logsByUser[l.user_id] ||= []).push(l));

    setBoard(buildLeaderboard(people, logsByUser));
    const mine = (logsByUser[user.id] || []).find((l) => l.log_date === toISO(new Date()));
    setTodayType(mine?.workout_type || null);
    setLoading(false);
  }, [challenge, user]);

  useEffect(() => {
    load();
  }, [load]);

  async function pick(type) {
    setSaving(true);
    if (type === null) {
      await supabase.from("daily_logs").delete().eq("user_id", user.id).eq("log_date", toISO(new Date()));
      setTodayType(null);
    } else {
      await supabase
        .from("daily_logs")
        .upsert({ user_id: user.id, log_date: toISO(new Date()), workout_type: type }, { onConflict: "user_id,log_date" });
      setTodayType(type);
    }
    await load();
    setSaving(false);
  }

  if (!challenge) return <NoChallenge onDone={refresh} setChallenge={setChallenge} userId={user.id} name={profile?.name} />;

  return (
    <div className="screen space-y-3">
      <header className="flex items-center justify-between pt-1">
        <div>
          <p className="eyebrow">{challenge.name}</p>
          <h1 className="font-display text-3xl uppercase leading-none tracking-wide">The Arena</h1>
        </div>
        <button onClick={() => setShowInvite(true)} className="pill flex items-center gap-1">
          <UserPlus size={14} /> Invite
        </button>
      </header>

      <CountdownBell endDate={challenge.end_date} />
      <CheckInCard todayType={todayType} onPick={pick} saving={saving} />

      <div className="pt-1">
        <p className="eyebrow mb-2">Standings · resets Monday</p>
        {loading ? (
          <Loader label="Counting reps…" />
        ) : board.length ? (
          <div className="space-y-2">
            {board.map((row) => (
              <ContenderCard key={row.id} row={row} isMe={row.id === user.id} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No contenders yet. Invite your crew.</p>
        )}
      </div>

      {showInvite && (
        <InviteModal challenge={challenge} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}

// ---------- invite by code (no email service → stays $0) ----------
function InviteModal({ challenge, onClose }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const text = `Join my FitArena challenge "${challenge.name}". Code: ${challenge.invite_code}`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      await navigator.clipboard.writeText(challenge.invite_code);
      setCopied(true);
    }
  };
  return (
    <Sheet onClose={onClose} title="Add a friend">
      <p className="text-sm text-muted">Send them this code. They tap “Join with a code” when they sign up.</p>
      <div className="mt-3 rounded-xl border border-line bg-surface2 px-4 py-5 text-center">
        <p className="font-score text-4xl font-bold tracking-[0.3em] text-gold">{challenge.invite_code}</p>
      </div>
      <button className="btn-primary mt-3 flex w-full items-center justify-center gap-2" onClick={share}>
        <Share2 size={16} /> {copied ? "Copied!" : "Share invite"}
      </button>
    </Sheet>
  );
}

// ---------- empty state: create or join ----------
function NoChallenge({ userId, name, onDone, setChallenge }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function create() {
    setBusy(true); setErr(null);
    const { data: ch, error } = await supabase
      .from("challenges")
      .insert({ name: `${name || "My"}'s Cut`, created_by: userId })
      .select()
      .single();
    if (error) { setErr(error.message); setBusy(false); return; }
    await supabase.from("challenge_members").insert({ challenge_id: ch.id, user_id: userId });
    setChallenge(ch);
    onDone();
  }

  async function join() {
    setBusy(true); setErr(null);
    const { data: cid, error } = await supabase.rpc("join_challenge", { code });
    if (error) { setErr(error.message); setBusy(false); return; }
    const { data: ch } = await supabase.from("challenges").select("*").eq("id", cid).single();
    setChallenge(ch);
    onDone();
  }

  return (
    <div className="screen flex flex-col justify-center space-y-4">
      <div className="text-center">
        <h1 className="font-display text-4xl uppercase tracking-wide">Pick your fight</h1>
        <p className="mt-1 text-sm text-muted">Start a challenge or join your friends’ with a code.</p>
      </div>
      <button className="btn-primary w-full" onClick={create} disabled={busy}>
        Start a new challenge
      </button>
      <div className="card space-y-3">
        <p className="eyebrow">Join with a code</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl bg-surface2 px-4 py-3 uppercase tracking-widest outline-none placeholder:text-muted"
            placeholder="ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button className="pill pill-on" onClick={join} disabled={busy || code.length < 4}>
            Join
          </button>
        </div>
        {err && <p className="text-sm text-ember">{err}</p>}
      </div>
    </div>
  );
}

// ---------- reusable bottom sheet ----------
function Sheet({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-[440px] rounded-t-3xl border-t border-line bg-surface p-5 pb-8 animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase tracking-wide">{title}</h2>
          <button onClick={onClose} className="text-muted"><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
