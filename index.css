import { NavLink } from "react-router-dom";
import { Swords, Target, Flame, BookOpen, User } from "lucide-react";

const tabs = [
  { to: "/", label: "Arena", Icon: Swords, end: true },
  { to: "/grind", label: "Grind", Icon: Target },
  { to: "/coach", label: "Coach", Icon: Flame },
  { to: "/playbook", label: "Playbook", Icon: BookOpen },
  { to: "/profile", label: "Profile", Icon: User },
];

export default function BottomNav() {
  return (
    <nav className="glass-strong fixed bottom-0 left-1/2 z-50 w-full max-w-[440px] -translate-x-1/2 px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <ul className="flex justify-around">
        {tabs.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-2 py-1 text-[10px] font-semibold transition ${isActive ? "text-gold" : "text-muted"}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={21} strokeWidth={isActive ? 2.6 : 2} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
