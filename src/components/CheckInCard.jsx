import { useEffect, useState } from "react";
import { Dumbbell, HeartPulse, Coffee, X, Check } from "lucide-react";

const OPTIONS = [
  { key: "lift", label: "Lifted", Icon: Dumbbell, tone: "gold" },
  { key: "cardio", label: "Cardio", Icon: HeartPulse, tone: "gold" },
  { key: "rest", label: "Rest day", Icon: Coffee, tone: "mint" },
  { key: "skip", label: "Missed it", Icon: X, tone: "ember" },
];
const toneRing = { gold: "border-gold text-gold", mint: "border-mint text-mint", ember: "border-ember text-ember" };

// Single choice per day, staged locally, then SUBMIT to save. Shows the saved
// state on reload so it never "vanishes".
export default function CheckInCard({ savedType, onSubmit, saving }) {
  const [pick, setPick] = useState(savedType || null);
  useEffect(() => setPick(savedType || null), [savedType]);

  const dirty = pick !== (savedType || null);

  return (
    <div className="card">
      <p className="eyebrow">Did you hit the gym today?</p>
      <p className="mt-1 font-display text-2xl uppercase tracking-wide">Log it. Earn your rank.</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {OPTIONS.map(({ key, label, Icon, tone }) => {
          const on = pick === key;
          return (
            <button
              key={key}
              onClick={() => setPick(key)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-4 font-bold transition active:scale-95 ${
                on ? `bg-surface2 ${toneRing[tone]}` : "border-transparent bg-surface2 text-paper"
              }`}
            >
              {on ? <Check size={18} /> : <Icon size={18} />}
              {label}
            </button>
          );
        })}
      </div>

      <button
        className="btn-primary mt-3 w-full disabled:opacity-50"
        disabled={!pick || saving || !dirty}
        onClick={() => onSubmit(pick)}
      >
        {saving ? "Saving…" : !dirty && savedType ? "Saved ✓" : "Submit today"}
      </button>

      <p className="mt-2 text-[11px] text-muted">
        Rest days protect your streak but don't move your rank — only real sessions do.
      </p>
    </div>
  );
}
