import { Trophy, Dumbbell, Trash2 } from "lucide-react";

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// Group feed of brags + PRs — the "people are here" social layer.
export default function WinsFeed({ wins, nameOf, canDelete, onDelete }) {
  if (!wins.length)
    return <p className="text-sm text-muted">No wins yet. Be the first to post one. 🏆</p>;

  return (
    <div className="space-y-2">
      {wins.map((w) => (
        <div key={w.id} className="rounded-2xl border border-line bg-surface p-3 animate-rise">
          <div className="flex items-center gap-2">
            <span className={`grid h-7 w-7 place-items-center rounded-full ${w.kind === "pr" ? "bg-gold text-ink" : "bg-surface2 text-mint"}`}>
              {w.kind === "pr" ? <Trophy size={14} /> : <Dumbbell size={14} />}
            </span>
            <p className="text-sm font-bold">{nameOf(w.user_id)}</p>
            <span className="ml-auto text-[11px] text-muted">{timeAgo(w.created_at)}</span>
            {canDelete?.(w) && (
              <button onClick={() => onDelete(w)} aria-label="Delete post" className="ml-1 text-muted transition active:scale-90 hover:text-ember"><Trash2 size={14} /></button>
            )}
          </div>

          {w.kind === "pr" ? (
            <p className="mt-2 capitalize">
              <span className="font-display text-xl text-gold">{w.exercise}</span>{" "}
              <span className="font-score">{w.weight_kg ? `${w.weight_kg}kg` : ""}{w.reps ? ` × ${w.reps}` : ""}</span>
              {w.text && <span className="block text-sm text-muted">{w.text}</span>}
            </p>
          ) : (
            <>
              {w.text && <p className="mt-2 text-sm">{w.text}</p>}
              {w.photo_url && <img src={w.photo_url} alt="" className="mt-2 max-h-72 w-full rounded-xl object-cover" />}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
