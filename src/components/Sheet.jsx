import { X } from "lucide-react";

// Bottom sheet: blurred scrim + strong glass pane + drag handle + spring rise.
export default function Sheet({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
      style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="glass-strong grain max-h-[90%] w-full max-w-[440px] overflow-y-auto rounded-t-[28px] p-5 pb-10 animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase tracking-wide">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-surface2 text-muted transition active:scale-90"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
