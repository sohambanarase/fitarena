import { NavLink } from "react-router-dom";
import { Swords, Flame, BookOpen, User } from "lucide-react";

const tabs = [
  { to: "/", label: "Arena", Icon: Swords, end: true },
  { to: "/coach", label: "Coach", Icon: Flame },
  { to: "/playbook", label: "Playbook", Icon: BookOpen },
  { to: "/profile", label: "Profile", Icon: User },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] border-t border-line bg-ink/95 backdrop-blur px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-50">
      <ul className="flex justify-around">
        {tabs.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-1 text-[11px] font-semibold transition ${
                  isActive ? "text-gold" : "text-muted"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.6 : 2} />
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
