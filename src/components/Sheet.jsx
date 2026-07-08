import { X } from "lucide-react";
import { useRef, useState, useCallback } from "react";

// Draggable bottom sheet: grab the handle to resize between ~24vh and ~94vh,
// or drag it down to dismiss. Opaque surface so page content never shows through.
export default function Sheet({ title, children, onClose }) {
  const [h, setH] = useState(72); // height in vh
  const drag = useRef(null);

  const onMove = useCallback((e) => {
    if (!drag.current) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dvh = ((drag.current.startY - y) / window.innerHeight) * 100;
    setH(Math.max(18, Math.min(94, drag.current.startH + dvh)));
  }, []);

  const onUp = useCallback(() => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    setH((cur) => { if (cur < 30) { onClose(); return cur; } return cur; });
    drag.current = null;
  }, [onMove, onClose]);

  const onDown = (e) => {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    drag.current = { startY: y, startH: h };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60"
      style={{ backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
      onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="sheet-pane grain flex w-full max-w-[440px] flex-col rounded-t-[28px] animate-rise"
        style={{ height: `${h}vh` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* drag zone */}
        <div className="shrink-0 cursor-grab touch-none px-5 pt-3 active:cursor-grabbing"
          onPointerDown={onDown} onTouchStart={onDown}>
          <div className="mx-auto h-1.5 w-11 rounded-full bg-line" />
          <div className="mt-2 flex items-center justify-between">
            <h2 className="font-display text-2xl uppercase tracking-wide">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-surface2 text-muted transition active:scale-90"><X size={18} /></button>
          </div>
        </div>
        {/* scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-10 pt-2">{children}</div>
      </div>
    </div>
  );
}
