import { useEffect, useRef, useState } from "react";

// Animated number count-up (GPU-cheap, respects reduced motion).
export default function CountUp({ value, duration = 700, decimals = 0, className = "", suffix = "" }) {
  const [shown, setShown] = useState(0);
  const raf = useRef();
  const from = useRef(0);
  useEffect(() => {
    const target = Number(value) || 0;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShown(target); return; }
    const start = performance.now();
    const initial = from.current;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(initial + (target - initial) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return <span className={className}>{shown.toFixed(decimals)}{suffix}</span>;
}
