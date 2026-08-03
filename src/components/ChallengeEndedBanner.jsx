import { useState } from "react";
import { Flag, CalendarPlus, Check } from "lucide-react";
import Sheet from "./Sheet.jsx";
import { hasEnded, isCompleted, extendChallenge, completeChallenge, defaultEndDate } from "../lib/challenge.js";

// Shown on the home screen once a challenge passes its end date, so nobody is left
// staring at a dead countdown. Either push the finish line out or call it done.
export default function ChallengeEndedBanner({ challenge, onChanged }) {
  const [sheet, setSheet] = useState(null);   // "extend" | null
  const [busy, setBusy] = useState(false);

  if (!challenge || !hasEnded(challenge)) return null;
  const done = isCompleted(challenge);
  async function finish() {
    setBusy(true);
    await completeChallenge(challenge.id);
    setBusy(false);
    onChanged && onChanged();
  }

  return (
    <>
      <div className="rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3">
        <p className="flex items-center gap-1.5 font-bold text-gold"><Flag size={15} /> {done ? "Challenge complete" : "The final bell rang"}</p>
        <p className="mt-1 text-sm text-muted">
          {done
            ? "This one's in the books. Set a new end date to run it again, or start a fresh challenge."
            : "This challenge reached its end date. Keep it going with a new date, or close it out."}
        </p>
        <div className="mt-2.5 flex gap-2">
          <button onClick={() => setSheet("extend")} className="btn-primary flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm">
            <CalendarPlus size={15} /> {done ? "Run it again" : "Keep going"}
          </button>
          {!done && (
            <button onClick={finish} disabled={busy} className="pill flex items-center gap-1.5 px-4">
              <Check size={14} /> Complete
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-muted">Your training history and global score are kept either way.</p>
      </div>

      {sheet === "extend" && (
        <ChallengeDateSheet challenge={challenge} onClose={() => setSheet(null)} onChanged={onChanged} />
      )}
    </>
  );
}

// Pick / change a challenge's end date. Used by the banner and by tapping the countdown.
export function ChallengeDateSheet({ challenge, onClose, onChanged }) {
  const [newDate, setNewDate] = useState(challenge?.end_date || defaultEndDate(30));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    await extendChallenge(challenge.id, newDate);
    setBusy(false); onClose();
    onChanged && onChanged();
  }
  return (
    <Sheet title="Challenge end date" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted">Pick when this challenge should finish. You can change it again at any time.</p>
        <div className="flex flex-wrap gap-1.5">
          {[[14, "2 weeks"], [30, "30 days"], [60, "60 days"], [90, "3 months"]].map(([d, label]) => (
            <button key={d} onClick={() => setNewDate(defaultEndDate(d))} className={"pill text-[11px] " + (newDate === defaultEndDate(d) ? "pill-on" : "")}>{label}</button>
          ))}
        </div>
        <input type="date" className="inp" value={newDate} min={defaultEndDate(1)} onChange={(e) => setNewDate(e.target.value)} />
        <button className="btn-primary w-full py-3.5" disabled={busy || !newDate} onClick={save}>
          {busy ? "Saving…" : "Run until " + new Date(newDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </button>
      </div>
    </Sheet>
  );
}
