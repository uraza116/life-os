"use client";

import { ChevronDown, ChevronRight, Database, Download, Plus, Settings, Trash, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, type ReactNode } from "react";
import { CATEGORY_COLORS, CATEGORY_ICONS, ENERGY_LEVELS } from "@/lib/constants";
import { DEFAULT_WEIGHTS, WEIGHT_LABELS, type Weights } from "@/lib/scoring";
import type { CategoryDTO } from "@/lib/types";
import { useStore } from "../store";
import { Button, Card, cn, Dot, Input, Label, NamedIcon, PageHeader, Select } from "../ui";

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function CategoryRow({ c }: { c: CategoryDTO }) {
  const { ws, saveCategory, deleteCategory, saveSubcategory, deleteSubcategory } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(c.name);
  const [sub, setSub] = useState("");
  const taskCount = ws?.tasks.filter((t) => t.categoryId === c.id && !t.deletedAt).length ?? 0;
  const save = (patch: Partial<CategoryDTO>) => void saveCategory({ ...c, ...patch });
  return (
    <div className="border-b border-border last:border-b-0">
      <div className={cn("flex flex-wrap items-center gap-2 px-3 py-2", c.hidden && "opacity-60")}>
        <button type="button" aria-label={open ? "Collapse" : "Expand subcategories"} className="cursor-pointer text-muted" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Dot color={c.color} />
        <NamedIcon name={c.icon} className="h-4 w-4 text-muted" />
        <Input
          aria-label="Category name"
          className="h-7 w-44"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== c.name && save({ name: name.trim() })}
        />
        <Select aria-label="Color" className="h-7 w-28 text-xs" value={c.color} onChange={(e) => save({ color: e.target.value })}>
          {CATEGORY_COLORS.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </Select>
        <Select aria-label="Icon" className="h-7 w-32 text-xs" value={c.icon} onChange={(e) => save({ icon: e.target.value })}>
          {CATEGORY_ICONS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </Select>
        <Select aria-label="Importance" className="h-7 w-32 text-xs" value={c.importance} onChange={(e) => save({ importance: Number(e.target.value) })} title="Importance feeds task priority scores">
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              Importance {n}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--accent)]" checked={c.hidden} onChange={(e) => save({ hidden: e.target.checked })} />
          Hidden
        </label>
        <span className="ml-auto text-xs text-faint">{taskCount} tasks</span>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Delete ${c.name}`}
          onClick={() => {
            if (confirm(`Delete category "${c.name}"? Its ${taskCount} task(s) and projects are kept but become uncategorized.`)) void deleteCategory(c.id);
          }}
        >
          <Trash className="h-3.5 w-3.5" />
        </Button>
      </div>
      {open && (
        <div className="space-y-1 pb-3 pl-12 pr-3">
          {c.subcategories.map((s) => (
            <div key={s.id} className="group flex items-center gap-2 text-sm">
              <span className="flex-1">{s.name}</span>
              <button
                type="button"
                aria-label={`Delete subcategory ${s.name}`}
                className="cursor-pointer text-faint opacity-0 hover:text-danger group-hover:opacity-100"
                onClick={() => void deleteSubcategory(s.id, c.id)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <form
            className="flex gap-2 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (!sub.trim()) return;
              void saveSubcategory({ name: sub.trim(), categoryId: c.id });
              setSub("");
            }}
          >
            <Input className="h-7 w-56" placeholder="New subcategory" value={sub} onChange={(e) => setSub(e.target.value)} aria-label="New subcategory" />
            <Button size="sm" type="submit" disabled={!sub.trim()}>
              Add
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

export function SettingsView() {
  const { ws, saveSettings, saveCategory, loadDemo, removeDemo } = useStore();
  const { theme, setTheme } = useTheme();
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);
  if (!ws) return null;
  const s = ws.settings;
  const weights: Weights = { ...DEFAULT_WEIGHTS, ...(s.scoringWeights as Partial<Weights>) };
  const demoCount = ws.tasks.filter((t) => t.isDemo).length + ws.projects.filter((p) => p.isDemo).length;

  return (
    <>
      <PageHeader title="Settings" icon={<Settings className="h-5 w-5 text-accent" />} subtitle="Everything is stored locally on this computer." />
      <div className="space-y-5">
        <SectionCard title="You and your day">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Display name</Label>
              <Input defaultValue={s.displayName} onBlur={(e) => e.target.value !== s.displayName && void saveSettings({ displayName: e.target.value })} placeholder="Shown in the greeting" />
            </div>
            <div>
              <Label>Daily focus capacity (minutes)</Label>
              <Input
                type="number"
                min={0}
                max={1440}
                defaultValue={s.dailyCapacityMin}
                onBlur={(e) => {
                  const v = Math.max(0, Math.min(1440, Number(e.target.value) || 0));
                  if (v !== s.dailyCapacityMin) void saveSettings({ dailyCapacityMin: v });
                }}
              />
            </div>
            <div>
              <Label>Current energy (affects scores)</Label>
              <Select value={s.energyLevel} onChange={(e) => void saveSettings({ energyLevel: e.target.value as "low" | "medium" | "high" })}>
                {ENERGY_LEVELS.map((e) => (
                  <option key={e} value={e}>
                    {e[0].toUpperCase() + e.slice(1)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Workday starts</Label>
              <Input type="time" value={s.workdayStart} onChange={(e) => e.target.value && void saveSettings({ workdayStart: e.target.value })} />
            </div>
            <div>
              <Label>Workday ends</Label>
              <Input type="time" value={s.workdayEnd} onChange={(e) => e.target.value && void saveSettings({ workdayEnd: e.target.value })} />
            </div>
            <div>
              <Label>Theme</Label>
              <Select value={theme ?? "system"} onChange={(e) => setTheme(e.target.value)}>
                <option value="system">Match system</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Life categories" hint="Rename, recolor, set importance (it feeds the priority score), hide, or delete. Expand a row to edit subcategories.">
          <div className="overflow-hidden rounded-lg border border-border">
            {ws.categories.map((c) => (
              <CategoryRow key={c.id} c={c} />
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCat.trim()) return;
              void saveCategory({ name: newCat.trim(), color: "slate", icon: "Folder", importance: 3 });
              setNewCat("");
            }}
          >
            <Input className="w-64" placeholder="New category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-label="New category name" />
            <Button type="submit" disabled={!newCat.trim()}>
              <Plus className="h-4 w-4" /> Add category
            </Button>
          </form>
        </SectionCard>

        <SectionCard title="Priority score" hint="Each open task gets a transparent 0–100 score from these weighted factors. Open any task to see its breakdown, or override it manually.">
          <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            {(Object.keys(DEFAULT_WEIGHTS) as (keyof Weights)[]).map((k) => (
              <div key={k} className="flex justify-between border-b border-border py-1.5">
                <span className="text-muted">{WEIGHT_LABELS[k]}</span>
                <span className="tabular-nums">{weights[k]}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Demo data" hint="Sample tasks and projects for exploring the app. Demo rows are marked and never mix with your own data when removed.">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={busy}
              onClick={async () => {
                if (s.demoLoaded && !confirm("Reload demo data? Existing demo rows are replaced; your own data is untouched.")) return;
                setBusy(true);
                await loadDemo();
                setBusy(false);
              }}
            >
              <Database className="h-4 w-4" /> {s.demoLoaded ? "Reload demo data" : "Load demo data"}
            </Button>
            <Button
              variant="danger"
              disabled={busy || demoCount === 0}
              onClick={async () => {
                if (!confirm(`Remove ${demoCount} demo task(s)/project(s)? Your own data is untouched.`)) return;
                setBusy(true);
                await removeDemo();
                setBusy(false);
              }}
            >
              <Trash className="h-4 w-4" /> Remove demo data
            </Button>
            <span className="text-xs text-muted">{demoCount ? `${demoCount} demo items present` : "No demo data loaded"}</span>
          </div>
        </SectionCard>

        <SectionCard title="Export" hint="Download a copy of everything. JSON is a full backup; CSV opens in Excel or Google Sheets.">
          <div className="flex flex-wrap gap-2">
            <a href="/api/export?format=json" download>
              <Button type="button" tabIndex={-1}>
                <Download className="h-4 w-4" /> Export JSON
              </Button>
            </a>
            <a href="/api/export?format=csv" download>
              <Button type="button" tabIndex={-1}>
                <Download className="h-4 w-4" /> Export tasks CSV
              </Button>
            </a>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
