import { Flame, Crown } from "lucide-react";

// A leaderboard row, but as a "contender card" — rank chip, name, consistency
// meter that fills with gold, and a streak flame. The #1 gets the belt glow.
export default function ContenderCard({ row, isMe }) {
  const leader = row.rank === 1 && row.score > 0;
  return (
    <div
      className={`relative flex items-center gap-3 rounded-2xl border bg-surface px-3 py-3 animate-rise ${
        leader ? "border-gold/60 shadow-belt" : "border-line"
      } ${isMe ? "ring-1 ring-mint/60" : ""}`}
    >
      {/* rank */}
      <div
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-lg ${
          leader ? "bg-gold text-ink" : "bg-surface2 text-paper"
        }`}
      >
        {row.rank}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {leader && <Crown size={14} className="text-gold" />}
          <p className="truncate font-bold">
            {row.name || "Athlete"}
            {isMe && <span className="ml-1 text-xs font-normal text-mint">you</span>}
          </p>
        </div>

        {/* consistency meter */}
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface2">
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-700"
            style={{ width: `${row.score}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted">
          {row.days}/{row.goal} gym days this week
        </p>
      </div>

      {/* streak + score */}
      <div className="shrink-0 text-right">
        <p className="font-score text-lg font-bold tabular-nums text-paper">{row.score}</p>
        <p className="flex items-center justify-end gap-0.5 text-[11px] text-muted">
          <Flame size={12} className={row.streak > 0 ? "text-ember" : "text-muted"} />
          {row.streak}d
        </p>
      </div>
    </div>
  );
}
