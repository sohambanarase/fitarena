import { NavLink, useLocation } from "react-router-dom";
import { Swords, Target, Flame, BookOpen, Apple } from "lucide-react";

const tabs = [
  { to: "/", label: "Arena", Icon: Swords, end: true },
  { to: "/grind", label: "Grind", Icon: Target },
  { to: "/coach", label: "Coach", Icon: Flame },
  { to: "/playbook", label: "Playbook", Icon: BookOpen },
  { to: "/count", label: "Count", Icon: Apple },
];

// Floating "island" nav: detached glass capsule with a liquid sliding
// indicator behind the active tab (Dynamic Island vibe).
export default function BottomNav() {
  const { pathname } = useLocation();
  const idx = Math.max(0, tabs.findIndex((t) => (t.end ? pathname === t.to : pathname.startsWith(t.to))));

  return (
    <nav
      className="nav-island grain fixed left-1/2 z-50 -translate-x-1/2 rounded-full px-1.5 py-1.5"
      style={{ bottom: "max(0.9rem, env(safe-area-inset-bottom))", width: "min(92%, 400px)" }}
      aria-label="Main navigation"
    >
      <div className="relative">
        {/* liquid indicator */}
        <div
          className="absolute top-0 h-full rounded-full bg-gold"
          style={{
            width: `${100 / tabs.length}%`,
            left: `${(100 / tabs.length) * idx}%`,
            transition: "left .35s cubic-bezier(.34,1.56,.64,1)",
            boxShadow: "var(--btn-glow), inset 0 1px 0 rgba(255,255,255,.35)",
          }}
        />
        <ul className="relative z-10 flex">
          {tabs.map(({ to, label, Icon, end }, i) => (
            <li key={to} className="flex-1">
              <NavLink to={to} end={end} aria-label={label}
                className="flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[9.5px] font-bold">
                {({ isActive }) => (
                  <>
                    <Icon size={20} strokeWidth={isActive ? 2.6 : 2}
                      className={"transition-transform duration-300 " + (isActive ? "scale-110 text-ink" : "text-muted")}
                      style={isActive ? { transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)" } : undefined} />
                    <span className={isActive ? "text-ink" : "text-muted"}>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
