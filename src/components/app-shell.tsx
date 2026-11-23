"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bot,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  ScrollText,
  ServerCog,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StatusBadge, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { apiFetch, useApi } from "@/lib/use-api";
import type { MeData, StatusData } from "@/lib/dashboard-types";
import { relativeTime } from "@/lib/format";

const nav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/server", label: "Server Configuration", icon: ServerCog },
  { href: "/bot", label: "Bot Control", icon: Bot },
  { href: "/logs", label: "Activity Logs", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

const titles: Record<string, string> = {
  "/": "Overview",
  "/server": "Server Configuration",
  "/bot": "Bot Control",
  "/logs": "Activity Logs",
  "/settings": "Settings",
};

function SidebarContent({
  pathname,
  status,
  user,
  onNavigate,
  onLogout,
  loggingOut,
}: {
  pathname: string;
  status: StatusData | null;
  user: MeData | null;
  onNavigate?: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <div className="flex size-9 items-center justify-center rounded-lg border border-primary-hover/40 bg-primary/20 text-sm font-bold text-text">
          A
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-text">AlpoyyAternos</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-subtle">Bot Manager</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Main navigation">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle">Workspace</p>
        {nav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-primary/15 font-medium text-text border border-primary-hover/30"
                  : "text-muted hover:bg-white/[0.04] hover:text-text border border-transparent",
              )}
            >
              <Icon className={cx("size-4 shrink-0", active ? "text-[#d46a73]" : "text-subtle group-hover:text-text")} />
              <span className="truncate">{item.label}</span>
              {active ? <ChevronRight className="ml-auto size-3.5 text-[#d46a73]" /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 p-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-subtle">Bot status</span>
            {status ? <StatusBadge status={status.bot.status} /> : <span className="text-xs text-muted">…</span>}
          </div>
          <p className="mt-2 truncate text-xs text-muted">
            {status?.server.address || "No server configured"}
          </p>
          {status?.worker.lastPushAt ? (
            <p className="mt-1 text-[10px] text-subtle">Sync {relativeTime(status.worker.lastPushAt)}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface p-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-elevated text-xs font-semibold text-muted">
            {user?.user.username.slice(0, 1).toUpperCase() || "O"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-text">{user?.user.username || "Owner"}</p>
            <p className="flex items-center gap-1 text-[10px] text-subtle"><ShieldCheck className="size-3" /> Owner access</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-md p-1.5 text-subtle transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const status = useApi<StatusData>("/api/status", { intervalMs: 10000 });
  const me = useApi<MeData>("/api/auth/me");

  async function logout() {
    setLoggingOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST", body: "{}" });
      router.replace("/login");
      router.refresh();
    } catch {
      toast({ title: "Sign out failed", variant: "error" });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-border bg-surface lg:block">
        <SidebarContent pathname={pathname} status={status.data} user={me.data} onLogout={logout} loggingOut={loggingOut} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <aside className="animate-fade-up absolute inset-y-0 left-0 w-[280px] border-r border-border bg-surface">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 z-10 rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-text"
            >
              <X className="size-4" />
            </button>
            <SidebarContent
              pathname={pathname}
              status={status.data}
              user={me.data}
              onNavigate={() => setMobileOpen(false)}
              onLogout={logout}
              loggingOut={loggingOut}
            />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-bg/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-md border border-border p-2 text-muted transition-colors hover:text-text lg:hidden"
          >
            <Menu className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-text sm:text-base">{titles[pathname] || "Dashboard"}</h2>
            <p className="hidden text-[11px] text-subtle sm:block">Authorized Minecraft bot management</p>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            {status.data?.worker.alive === false ? (
              <Link href="/settings" className="badge border-primary-hover/30 bg-primary/10 text-[#d46a73]">
                <Activity className="size-3" /> Worker offline
              </Link>
            ) : null}
            {status.data ? <StatusBadge status={status.data.bot.status} /> : null}
          </div>

          <button
            type="button"
            onClick={() => { void status.reload(); toast({ title: "Status refreshed", variant: "info" }); }}
            aria-label="Refresh status"
            title="Refresh status"
            className="rounded-md border border-border p-2 text-muted transition-colors hover:border-[#444444] hover:text-text"
          >
            <RefreshCw className={cx("size-4", status.loading && "animate-spin")} />
          </button>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {status.error && status.data === null ? (
            <div className="mb-5 rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-xs text-[#fca5a5]">
              Could not load live status: {status.error}
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
