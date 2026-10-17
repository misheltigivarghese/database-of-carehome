import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  HeartPulse,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { initials } from "../lib/format";
import { Button, IconButton } from "./ui/Button";

const NAV_ITEMS = [{ to: "/residents", label: "Residents", icon: Users }] as const;

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  care_staff: "Care staff",
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { displayName, role, isAdmin, signOut } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
          <HeartPulse aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-sm leading-tight font-semibold text-foreground">
            Resident Records
          </p>
          <p className="truncate text-xs text-muted-foreground">Care Assistant</p>
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg border border-transparent px-3 py-2 text-sm transition-colors duration-150 ease-out",
                isActive
                  ? "border-primary/20 bg-primary/10 font-semibold text-primary"
                  : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            {/* NavLink adds aria-current="page" on the active item automatically. */}
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
          >
            {initials(displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {isAdmin ? <ShieldCheck aria-hidden="true" className="size-3" /> : null}
              {ROLE_LABEL[role]}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          icon={<LogOut aria-hidden="true" className="size-4" />}
          onClick={() => void signOut()}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { profileError } = useAuth();
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Escape closes the drawer and focus returns to where it came from.
  useEffect(() => {
    if (!drawerOpen) return;
    const trigger = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstLink = panel?.querySelector<HTMLElement>("a, button");
    window.requestAnimationFrame(() => firstLink?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus?.();
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-primary"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface lg:block">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
        <IconButton
          label="Open navigation menu"
          size="md"
          icon={<Menu aria-hidden="true" className="size-5" />}
          onClick={() => setDrawerOpen(true)}
        />
        <span className="font-heading text-sm font-semibold text-foreground">
          Resident Records
        </span>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-foreground/40 motion-safe:animate-[fade-in_150ms_ease-out]"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-surface shadow-pop motion-safe:animate-[slide-in-left_250ms_cubic-bezier(0.16,1,0.3,1)]"
          >
            <IconButton
              label="Close navigation menu"
              icon={<X aria-hidden="true" className="size-4" />}
              onClick={() => setDrawerOpen(false)}
              className="absolute top-3 right-3 z-10"
            />
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <main id="main-content" className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {profileError ? (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-card border border-warning/40 bg-warning-soft px-4 py-3"
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Some of your access could not be confirmed
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{profileError}</p>
              </div>
            </div>
          ) : null}
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}
