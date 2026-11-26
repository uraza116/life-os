"use client";

import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { FolderKanban, Moon, Plus, Search, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { isOpenStatus } from "@/lib/constants";
import { NAV_MAIN, NAV_SETTINGS } from "./nav";
import { useStore } from "./store";

const item = "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-fg";

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, ws, openTask, openQuickAdd } = useStore();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [q, setQ] = useState("");
  const close = () => {
    setPaletteOpen(false);
    setQ("");
  };
  const go = (fn: () => void) => {
    close();
    fn();
  };
  const tasks = (ws?.tasks ?? []).filter((t) => !t.deletedAt && isOpenStatus(t.status));
  const projects = (ws?.projects ?? []).filter((p) => !p.deletedAt && !p.archivedAt);

  return (
    <Dialog.Root open={paletteOpen} onOpenChange={(v) => (v ? setPaletteOpen(true) : close())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-panel shadow-2xl">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          {/* Plain substring match: cmdk's default fuzzy match lets short queries hit unrelated actions. */}
          <Command loop filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase().trim()) ? 1 : 0)}>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 text-faint" />
              <Command.Input value={q} onValueChange={setQ} placeholder="Search tasks, projects, pages or actions…" className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
            </div>
            <Command.List className="max-h-[50vh] overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-sm text-muted">No results.</Command.Empty>
              <Command.Group heading="Actions">
                <Command.Item className={item} value="new task create add" onSelect={() => go(() => openQuickAdd())}>
                  <Plus className="h-4 w-4 text-muted" /> New task…
                </Command.Item>
                <Command.Item className={item} value="new project" onSelect={() => go(() => router.push("/projects?new=1"))}>
                  <FolderKanban className="h-4 w-4 text-muted" /> New project…
                </Command.Item>
                <Command.Item className={item} value="toggle theme dark light mode" onSelect={() => go(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
                  {resolvedTheme === "dark" ? <Sun className="h-4 w-4 text-muted" /> : <Moon className="h-4 w-4 text-muted" />}
                  Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
                </Command.Item>
              </Command.Group>
              <Command.Group heading="Go to">
                {[...NAV_MAIN, NAV_SETTINGS].map((n) => (
                  <Command.Item key={n.href} className={item} value={`go ${n.label}`} onSelect={() => go(() => router.push(n.href))}>
                    <n.icon className="h-4 w-4 text-muted" /> {n.label}
                  </Command.Item>
                ))}
              </Command.Group>
              {projects.length > 0 && (
                <Command.Group heading="Projects">
                  {projects.map((p) => (
                    <Command.Item key={p.id} className={item} value={`project ${p.name} ${p.id}`} onSelect={() => go(() => router.push(`/projects/${p.id}`))}>
                      <FolderKanban className="h-4 w-4 text-muted" /> {p.name}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {q.length > 0 && tasks.length > 0 && (
                <Command.Group heading="Tasks">
                  {tasks.slice(0, 200).map((t) => (
                    <Command.Item key={t.id} className={item} value={`task ${t.title} ${t.tags.join(" ")} ${t.id}`} onSelect={() => go(() => openTask(t.id))}>
                      <span className="h-3.5 w-3.5 rounded-full border border-faint" /> <span className="truncate">{t.title}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
            <div className="flex justify-between border-t border-border px-3 py-2 text-[11px] text-faint">
              <span>↑↓ navigate · Enter select · Esc close</span>
              <span>Ctrl K</span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
