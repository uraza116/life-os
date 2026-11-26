"use client";

import { Bookmark, Moon, PanelLeft, PanelLeftClose, Plus, Search, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ThemeProvider, useTheme } from "next-themes";
import { Tooltip } from "radix-ui";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { isOpen, isOnMyDay, isOverdue } from "@/lib/filters";
import { CommandPalette } from "./command-palette";
import { NAV_MAIN, NAV_SETTINGS, NAV_SOON, type NavItem } from "./nav";
import { QuickAdd } from "./quick-add";
import { StoreProvider, useStore } from "./store";
import { TaskEditor } from "./task-editor";
import { Button, cn, Dot } from "./ui";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Tooltip.Provider>
        <StoreProvider>
          <Frame>{children}</Frame>
          <ThemedToaster />
        </StoreProvider>
      </Tooltip.Provider>
    </ThemeProvider>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster position="bottom-right" theme={resolvedTheme === "dark" ? "dark" : "light"} richColors closeButton />;
}

function useShortcuts() {
  const { setPaletteOpen, openQuickAdd, paletteOpen } = useStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
        return;
      }
      const el = e.target as HTMLElement;
      const typing = el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "q" || e.key === "n") {
        e.preventDefault();
        openQuickAdd();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen, openQuickAdd, paletteOpen]);
}

function Frame({ children }: { children: ReactNode }) {
  const { ws, error, reload, openQuickAdd, setPaletteOpen } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  useShortcuts();

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* usePathname is request data on dynamic routes (/projects/[id]); keep it inside Suspense */}
      <Suspense fallback={<aside className={cn("shrink-0 border-r border-border bg-panel", collapsed ? "w-14" : "w-60")} />}>
        <Sidebar collapsed={collapsed} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-panel/80 px-3 backdrop-blur">
          <Button variant="ghost" size="icon" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-8 w-full max-w-sm cursor-pointer items-center gap-2 rounded-md border border-border bg-bg px-2.5 text-sm text-faint hover:text-muted"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search or jump to…</span>
            <kbd className="rounded border border-border px-1.5 text-[10px]">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="primary" onClick={() => openQuickAdd()} title="Quick add (Q)">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add task</span>
            </Button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            {error && !ws ? (
              <div className="rounded-xl border border-border bg-panel p-6 text-sm">
                <div className="font-medium text-danger">Could not load your data.</div>
                <div className="mt-1 text-muted">{error}</div>
                <Button className="mt-3" onClick={() => void reload()}>
                  Retry
                </Button>
              </div>
            ) : null}
            {!ws && !error ? (
              <div className="space-y-3" aria-busy="true" aria-label="Loading">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-panel-2" />
                ))}
              </div>
            ) : null}
            {/* Always rendered (views return null until data loads) so Next can validate the page segment. */}
            {children}
          </div>
        </main>
      </div>
      <QuickAdd />
      <TaskEditor />
      <CommandPalette />
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the theme is only known after hydration
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { ws, today } = useStore();
  const pathname = usePathname();
  const viewParam = useSearchParams().get("view");
  const counts: Record<string, number> = {};
  if (ws) {
    counts["/my-day"] = ws.tasks.filter((t) => isOnMyDay(t, today) || isOverdue(t, today)).length;
    counts["/inbox"] = ws.tasks.filter((t) => isOpen(t) && t.status === "inbox").length;
    counts["/tasks"] = ws.tasks.filter((t) => isOpen(t)).length;
  }
  const pinnedProjects = ws?.projects.filter((p) => p.pinned && !p.deletedAt && !p.archivedAt) ?? [];

  const link = (n: NavItem) => {
    const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href) && !(n.href === "/tasks" && viewParam);
    if (n.soon) {
      return (
        <div
          key={n.label}
          aria-disabled="true"
          title={`${n.label} is coming in a later phase`}
          className={cn("flex h-8 cursor-not-allowed items-center gap-2.5 rounded-md px-2 text-sm text-faint opacity-60", collapsed && "justify-center")}
        >
          <n.icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{n.label}</span>
              <span className="rounded border border-border px-1 text-[10px] uppercase tracking-wide">soon</span>
            </>
          )}
        </div>
      );
    }
    return (
      <Link
        key={n.href}
        href={n.href}
        title={collapsed ? n.label : undefined}
        className={cn(
          "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
          active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-panel-2 hover:text-fg",
          collapsed && "justify-center",
        )}
      >
        <n.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
        {!collapsed && counts[n.href] ? <span className="text-xs tabular-nums text-faint">{counts[n.href]}</span> : null}
      </Link>
    );
  };

  return (
    <aside className={cn("flex shrink-0 flex-col border-r border-border bg-panel transition-[width]", collapsed ? "w-14" : "w-60")}>
      <div className={cn("flex h-12 items-center gap-2 border-b border-border px-4", collapsed && "justify-center px-0")}>
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-fg">L</div>
        {!collapsed && <span className="text-sm font-semibold">Life OS</span>}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Main">
        {NAV_MAIN.map(link)}
        {!collapsed && (ws?.views.length ?? 0) > 0 && (
          <div className="pt-3">
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Saved views</div>
            {ws?.views.map((v) => (
              <Link
                key={v.id}
                href={`/tasks?view=${v.id}`}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm",
                  pathname === "/tasks" && viewParam === v.id ? "bg-accent-soft text-accent" : "text-muted hover:bg-panel-2 hover:text-fg",
                )}
              >
                <Bookmark className="h-4 w-4 shrink-0" />
                <span className="truncate">{v.name}</span>
              </Link>
            ))}
          </div>
        )}
        {!collapsed && pinnedProjects.length > 0 && (
          <div className="pt-3">
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Pinned projects</div>
            {pinnedProjects.map((p) => {
              const cat = ws?.categories.find((c) => c.id === p.categoryId);
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className={cn(
                    "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm",
                    pathname === `/projects/${p.id}` ? "bg-accent-soft text-accent" : "text-muted hover:bg-panel-2 hover:text-fg",
                  )}
                >
                  <Dot color={p.color ?? cat?.color} className="mx-1" />
                  <span className="truncate">{p.name}</span>
                </Link>
              );
            })}
          </div>
        )}
        <div className="pt-3">
          {!collapsed && <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Coming later</div>}
          {NAV_SOON.map(link)}
        </div>
      </nav>
      <div className="border-t border-border p-2">{link(NAV_SETTINGS)}</div>
    </aside>
  );
}
