import { useState } from "react";
import { Dumbbell, HeartPulse, Coffee, X, Check } from "lucide-react";

const OPTIONS = [
  { key: "lift", label: "Lifted", Icon: Dumbbell, tone: "gold" },
  { key: "cardio", label: "Cardio", Icon: HeartPulse, tone: "gold" },
  { key: "rest", label: "Rest day", Icon: Coffee, tone: "mint" },
  { key: "skip", label: "Missed it", Icon: X, tone: "ember" },
];

const toneClass = {
  gold: "bg-gold text-ink",
  mint: "bg-mint text-ink",
  ember: "bg-ember text-ink",
};

// "Did you hit the gym today?" — but typed, since rest days are allowed and shouldn't
// break a streak. Tapping an option upserts today's log and stamps in.
export default function CheckInCard({ todayType, onPick, saving }) {
  const [justPicked, setJustPicked] = useState(null);

  if (todayType) {
    const chosen = OPTIONS.find((o) => o.key === todayType);
    return (
      <div className="card flex items-center justify-between">
        <div>
          <p className="eyebrow">Today, locked in</p>
          <p className="mt-1 flex items-center gap-2 text-lg font-bold">
            <chosen.Icon size={20} className="text-gold" />
            {chosen.label}
          </p>
        </div>
        <button
          onClick={() => onPick(null)}
          className="pill"
          disabled={saving}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="eyebrow">Did you hit the gym today?</p>
      <p className="mt-1 font-display text-2xl uppercase tracking-wide">Log it. Earn your rank.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {OPTIONS.map(({ key, label, Icon, tone }) => (
          <button
            key={key}
            disabled={saving}
            onClick={() => {
              setJustPicked(key);
              onPick(key);
            }}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-4 font-bold transition active:scale-95 disabled:opacity-60 ${
              justPicked === key ? `${toneClass[tone]} animate-stamp` : "bg-surface2 text-paper"
            }`}
          >
            {justPicked === key ? <Check size={18} /> : <Icon size={18} />}
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Rest days protect your streak but don't move your rank — only real sessions do.
      </p>
    </div>
  );
}
