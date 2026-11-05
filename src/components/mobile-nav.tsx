import { NavLink } from "react-router";
import {
  IconMessageCircle,
  IconSettings,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/groups", label: "Chats", icon: IconMessageCircle },
  { to: "/contacts", label: "Contacts", icon: IconUsers },
  { to: "/wallet", label: "Wallet", icon: IconWallet },
  { to: "/settings/profile", label: "Settings", icon: IconSettings },
] as const;

/** Bottom navigation for the mobile Kimchi shell. */
export function MobileBottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="flex shrink-0 items-stretch justify-around border-t bg-card px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
    >
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-extrabold transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={21} stroke={isActive ? 2.4 : 1.9} aria-hidden />
              <span className="truncate">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
