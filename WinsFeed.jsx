import { X } from "lucide-react";

// Reusable bottom sheet (mobile-native pattern).
export default function Sheet({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="glass-strong max-h-[90%] w-full max-w-[440px] overflow-y-auto rounded-t-3xl p-5 pb-10 animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase tracking-wide">{title}</h2>
          <button onClick={onClose} className="text-muted"><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
