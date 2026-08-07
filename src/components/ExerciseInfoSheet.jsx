import { useState } from "react";
import { imageUrl, imageFallback } from "../lib/exercises.js";
import Sheet from "./Sheet.jsx";
import { Dumbbell } from "lucide-react";

export function ExImg({ path, name, className }) {
  const [stage, setStage] = useState(0); // 0=cdn 1=raw 2=placeholder
  const src = stage === 0 ? imageUrl(path) : stage === 1 ? imageFallback(path) : null;
  if (!path || stage === 2)
    return <div className={"grid place-items-center bg-surface2 text-3xl font-display text-line " + className}>{name?.[0]?.toUpperCase()}</div>;
  return <img src={src} alt={name} loading="lazy" onError={() => setStage((s) => s + 1)} className={className} />;
}

// Shared exercise detail: photos, tags, how-to steps, and an optional "log it" action.
// Used by the Playbook library and by the exercise picker while logging.
export default function ExerciseInfoSheet({ ex, onClose, onLog, logLabel = "Log this exercise" }) {
  if (!ex) return null;
  const images = ex.images || [];
  const steps = ex.steps || [];
  return (
    <Sheet title={ex.name} onClose={onClose}>
      <div className={"mb-3 grid gap-2 " + (images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
        {(images.length ? images : [null]).map((p, i) => (
          <ExImg key={i} path={p} name={ex.name} className="aspect-square h-auto w-full rounded-2xl object-cover" />
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2 capitalize">
        {[ex.muscle, ex.category, ex.equipment, ex.level].filter(Boolean).map((t) => (
          <span key={t} className="pill pill-on">{t}</span>
        ))}
      </div>
      {ex.secondary?.length > 0 && (
        <p className="mb-3 text-sm capitalize text-muted">Also works: {ex.secondary.join(", ")}</p>
      )}

      {steps.length > 0 && (
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          {steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}

      {onLog && (
        <button onClick={() => onLog(ex)} className="btn-primary mt-4 flex w-full items-center justify-center gap-2 py-3.5 text-base">
          <Dumbbell size={17} /> {logLabel}
        </button>
      )}
    </Sheet>
  );
}
