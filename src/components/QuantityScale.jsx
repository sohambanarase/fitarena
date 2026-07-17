import { useRef, useState, useCallback } from "react";
import { Minus, Plus, Pencil } from "lucide-react";

// Horizontal draggable ruler. Drag left/right to change the value; the centered
// value is highlighted and nutrition updates live via onChange.
export default function QuantityScale({ value, onChange, step = 5, min = 0, max = 2000, unit = "g", servingSize }) {
  const drag = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const px = 2; // pixels per unit

  const set = useCallback((v) => onChange(Math.max(min, Math.min(max, Math.round(v / step) * step))), [onChange, min, max, step]);
  const onMove = useCallback((e) => {
    if (!drag.current) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    set(drag.current.v + (drag.current.x - x) / px);
  }, [set]);
  const onUp = useCallback(() => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    drag.current = null;
  }, [onMove]);
  const onDown = (e) => {
    drag.current = { x: e.touches ? e.touches[0].clientX : e.clientX, v: value };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const ticks = [];
  const range = 130;
  for (let v = Math.max(min, value - range); v <= Math.min(max, value + range); v += step) ticks.push(v);

  return (
    <div className="select-none">
      <div className="mb-1 flex items-center justify-center gap-2">
        {editing ? (
          <input autoFocus inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { if (draft !== "") set(Number(draft)); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { if (draft !== "") set(Number(draft)); setEditing(false); } }}
            className="w-28 rounded-lg bg-surface2 py-1 text-center font-score text-3xl font-bold text-gold outline-none" />
        ) : (
          <button onClick={() => { setDraft(String(value)); setEditing(true); }} className="flex items-center gap-1.5">
            <span className="font-score text-3xl font-bold text-gold">{value}</span>
            <span className="text-muted">{unit}</span>
            <Pencil size={13} className="text-muted" />
          </button>
        )}
      </div>

      <div className="relative h-16 cursor-grab touch-none overflow-hidden rounded-2xl bg-surface2 active:cursor-grabbing" onPointerDown={onDown} onTouchStart={onDown}>
        <div className="pointer-events-none absolute left-1/2 top-1 z-10 h-14 w-0.5 -translate-x-1/2 rounded bg-gold" />
        <div className="pointer-events-none absolute top-0 h-full" style={{ left: "50%", transform: `translateX(${-value * px}px)` }}>
          {ticks.map((v) => (
            <div key={v} style={{ position: "absolute", left: v * px, bottom: 6 }} className="flex -translate-x-1/2 flex-col items-center">
              <div className={(v % 25 === 0 ? "h-7 w-px bg-paper/50" : "h-3.5 w-px bg-line")} />
              {v % 25 === 0 && <span className="mt-1 text-[9px] text-muted">{v}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-2">
        <button onClick={() => set(value - step)} className="grid h-9 w-9 place-items-center rounded-full bg-surface2 active:scale-90"><Minus size={16} /></button>
        <button onClick={() => set(100)} className="pill">Reset 100{unit}</button>
        {servingSize ? <button onClick={() => set(servingSize)} className="pill">1 serving</button> : null}
        <button onClick={() => set(value + step)} className="grid h-9 w-9 place-items-center rounded-full bg-surface2 active:scale-90"><Plus size={16} /></button>
      </div>
    </div>
  );
}
