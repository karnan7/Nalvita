import {
  Activity,
  FileText,
  LayoutDashboard,
  Pill,
  Search,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

import logoFullDark from "@/assets/logo-full-dark-4x.png";
import logoFullLight from "@/assets/logo-full-light-4x.png";
import { ViewingAsBanner } from "@/components/family/viewing-as-banner";
import { ThemeToggle } from "@/components/ui-nalvita/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Match the index route exactly so it isn't active on every path. */
  end?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/medicines", label: "Medicines", icon: Pill },
  { to: "/vitals", label: "Vitals", icon: Activity },
  { to: "/family", label: "Family", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
];

const SETTINGS_ITEM: NavItem = {
  to: "/settings",
  label: "Settings",
  icon: Settings,
};

/** First letters of the first and last words of a name, e.g. "Priya Sharma" → "PS". */
function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "·";
  const first = (words[0] ?? "").charAt(0);
  const last =
    words.length > 1 ? (words[words.length - 1] ?? "").charAt(0) : "";
  return (first + last).toUpperCase();
}

function BrandMark({ compact = false }: Readonly<{ compact?: boolean }>) {
  // Full horizontal lockup (mark + wordmark + "A WELL LIFE" tagline), swapped by
  // theme so it keeps 4.5:1 on either ground. Sized as large as the container
  // comfortably allows so the tagline stays legible.
  const heightClass = compact ? "h-10 w-auto" : "h-12 w-auto";
  return (
    <Link
      to="/dashboard"
      aria-label="Nalvita home"
      className="flex items-center"
    >
      <img
        src={logoFullLight}
        alt=""
        className={cn(heightClass, "dark:hidden")}
      />
      <img
        src={logoFullDark}
        alt=""
        className={cn("hidden dark:block", heightClass)}
      />
    </Link>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
    isActive
      ? "bg-interactive text-content-inverse"
      : "text-content-muted hover:bg-sunken hover:text-content",
  );
}

function SidebarLink({ to, label, icon: Icon, end }: Readonly<NavItem>) {
  return (
    <NavLink to={to} end={end} className={navLinkClass}>
      <Icon className="size-5 shrink-0" />
      {label}
    </NavLink>
  );
}

function MobileLink({ to, label, icon: Icon, end }: Readonly<NavItem>) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-interactive text-content-inverse"
            : "text-content-muted hover:text-content",
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </NavLink>
  );
}

/**
 * App chrome for signed-in pages, following the Nalvita web wireframes: a left
 * sidebar for primary navigation (Settings pinned to the bottom) and a top bar
 * with search and the account avatar. On narrow screens the sidebar collapses
 * to a scrollable nav row under the top bar.
 */
export function PageShell({ children }: Readonly<{ children: ReactNode }>) {
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);
  const avatarInitials = initials(profile?.full_name);

  return (
    <div className="min-h-screen bg-app md:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border-default bg-surface p-4 md:flex">
        <div className="px-2 pb-6 pt-2">
          <BrandMark />
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
          <div className="flex-1" />
          <SidebarLink {...SETTINGS_ITEM} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b border-border-default bg-surface/85 px-4 py-4 backdrop-blur sm:px-6">
          <div className="md:hidden">
            <BrandMark compact />
          </div>
          <div className="hidden min-w-0 flex-1 md:flex">
            <div className="flex w-full max-w-xs items-center gap-2 rounded-xl bg-sunken px-3 py-2 text-sm text-content-muted">
              <Search className="size-4 shrink-0" />
              <span>Search records…</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-full bg-interactive text-sm font-bold text-content-inverse"
            >
              {avatarInitials}
            </span>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-border-default bg-surface px-3 py-2 md:hidden">
          {[...NAV_ITEMS, SETTINGS_ITEM].map((item) => (
            <MobileLink key={item.to} {...item} />
          ))}
        </nav>

        <ViewingAsBanner />

        <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
