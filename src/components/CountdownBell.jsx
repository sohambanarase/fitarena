import { daysLeft } from "../lib/streak.js";

// The signature element: a scoreboard countdown to "the final bell" (challenge end).
export default function CountdownBell({ endDate = "2026-08-31" }) {
  const left = daysLeft(endDate);
  return (
    <div className="flex items-end justify-between rounded-2xl border border-line bg-surface px-4 py-3">
      <div>
        <p className="eyebrow text-gold/90">The Final Bell</p>
        <p className="text-sm text-muted">
          {new Date(endDate + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric" })}
        </p>
      </div>
      <div className="text-right leading-none">
        <span className="font-score text-4xl font-bold text-gold tabular-nums">{left}</span>
        <span className="ml-1 text-xs uppercase tracking-widest text-muted">days left</span>
      </div>
    </div>
  );
}
