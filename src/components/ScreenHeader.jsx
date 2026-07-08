import { useEffect, useState } from "react";

// Big display title with subtle parallax + a floating condensed glass bar
// that materializes once you scroll past it.
export default function ScreenHeader({ eyebrow, title, right }) {
  const [y, setY] = useState(0);
  useEffect(() => {
    const el = document.querySelector(".screen");
    if (!el) return;
    const onScroll = () => setY(el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  const condensed = y > 46;
  return (
    <>
      <header className="flex items-end justify-between pt-1" style={{ transform: `translateY(${Math.min(y * 0.18, 10)}px)`, opacity: Math.max(0, 1 - y / 90) }}>
        <div>
          {eyebrow && <p className="eyebrow text-gold">{eyebrow}</p>}
          <h1 className="font-display text-3xl uppercase leading-none tracking-wide">{title}</h1>
        </div>
        {right}
      </header>
      <div className={"glass-strong pointer-events-none fixed left-1/2 z-40 flex -translate-x-1/2 items-center justify-center rounded-full px-5 py-2 transition-all duration-300 " + (condensed ? "opacity-100" : "-translate-y-3 opacity-0")}
        style={{ top: "max(0.6rem, env(safe-area-inset-top))" }}>
        <span className="font-display text-base uppercase tracking-wider">{title}</span>
      </div>
    </>
  );
}
