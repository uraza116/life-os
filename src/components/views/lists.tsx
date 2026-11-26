"use client";

import { format } from "date-fns";
import { Archive, Bookmark, CalendarClock, CircleCheck, Inbox, ListTodo, NotebookPen, Plus, Search, Sun, Trash } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { ENERGY_LEVELS, STATUS_LABEL, TASK_STATUSES } from "@/lib/constants";
import { addDaysKey, formatDue, formatMinutes, fromDateKey } from "@/lib/dates";
import { isDone, isLive, isOnMyDay, isOpen, isOverdue, matchesFilter, SORT_LABEL, sortTasks, type SortKey } from "@/lib/filters";
import { BUCKET_LABEL } from "@/lib/scoring";
import type { TaskDTO, TaskFilter } from "@/lib/types";
import { useStore } from "../store";
import { TaskList } from "../task-list";
import { Button, Card, cn, Empty, Input, PageHeader, Progress, Select, Textarea } from "../ui";

function Section({ title, count, children, tone }: { title: string; count?: number; children: ReactNode; tone?: string }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold" style={tone ? { color: tone } : undefined}>
        {title}
        {count !== undefined && <span className="text-xs font-normal text-faint">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- My Day */

export function MyDayView() {
  const { ws, scores, today, openQuickAdd, saveSettings, updateTask } = useStore();
  if (!ws) return null;
  const open = ws.tasks.filter(isOpen);
  const overdue = sortTasks(open.filter((t) => isOverdue(t, today)), "score", scores);
  const todays = sortTasks(open.filter((t) => isOnMyDay(t, today)), "score", scores);
  const doneToday = ws.tasks.filter((t) => isDone(t) && t.completedAt && format(new Date(t.completedAt), "yyyy-MM-dd") === today);
  const onDay = new Set([...overdue, ...todays].map((t) => t.id));
  const suggestions = sortTasks(
    open.filter((t) => !onDay.has(t.id) && t.status !== "waiting" && t.status !== "on_hold" && !(t.startDate && t.startDate > today)),
    "score",
    scores,
  ).slice(0, 5);
  const planned = todays.reduce((a, t) => a + (t.estimateMin ?? 0), 0);
  const cap = ws.settings.dailyCapacityMin;
  const total = todays.length + doneToday.length;

  return (
    <>
      <PageHeader
        title="My Day"
        icon={<Sun className="h-5 w-5 text-warn" />}
        subtitle={format(new Date(), "EEEE, MMMM d")}
        actions={
          <>
            <label className="flex items-center gap-2 text-xs text-muted">
              Energy
              <Select className="h-8 w-28" value={ws.settings.energyLevel} onChange={(e) => void saveSettings({ energyLevel: e.target.value as "low" | "medium" | "high" })}>
                {ENERGY_LEVELS.map((e) => (
                  <option key={e} value={e}>
                    {e[0].toUpperCase() + e.slice(1)}
                  </option>
                ))}
              </Select>
            </label>
            <Button variant="primary" onClick={() => openQuickAdd({ pinnedToday: true })}>
              <Plus className="h-4 w-4" /> Add to today
            </Button>
          </>
        }
      />
      <Card className="mb-6 grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <div className="flex justify-between text-xs text-muted">
            <span>Progress</span>
            <span className="tabular-nums">
              {doneToday.length}/{total} done
            </span>
          </div>
          <div className="mt-2">
            <Progress value={total ? (doneToday.length / total) * 100 : 0} color="emerald" />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted">
            <span>Planned time</span>
            <span className="tabular-nums">
              {formatMinutes(planned)} / {formatMinutes(cap)}
            </span>
          </div>
          <div className="mt-2">
            <Progress value={cap ? (planned / cap) * 100 : 0} color={planned > cap ? "red" : undefined} />
          </div>
          {planned > cap && <div className="mt-1 text-xs text-danger">Over capacity by {formatMinutes(planned - cap)}.</div>}
        </div>
      </Card>

      {overdue.length > 0 && (
        <Section title="Overdue" count={overdue.length} tone="var(--danger)">
          <TaskList
            tasks={overdue}
            rowExtra={(t) => (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  void updateTask(t.id, { dueDate: today });
                }}
              >
                Move to today
              </Button>
            )}
          />
        </Section>
      )}
      <Section title="Today" count={todays.length}>
        <TaskList
          tasks={todays}
          empty={<Empty icon={<Sun className="h-7 w-7" />} title="Nothing planned for today yet" hint="Add tasks from the suggestions below, or press Q." />}
          rowExtra={(t) =>
            t.pinnedToday && t.myDayDate === today ? (
              <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  void updateTask(t.id, { pinnedToday: false, myDayDate: null });
                }}
              >
                Remove
              </Button>
            ) : null
          }
        />
      </Section>
      {suggestions.length > 0 && (
        <Section title="Suggested next (highest score)">
          <TaskList
            tasks={suggestions}
            rowExtra={(t) => (
              <div className="flex items-center gap-2">
                <span className="hidden text-[11px] text-faint md:inline">{BUCKET_LABEL[scores.get(t.id)?.bucket ?? "later"]}</span>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    void updateTask(t.id, { pinnedToday: true, myDayDate: today });
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Today
                </Button>
              </div>
            )}
          />
        </Section>
      )}
      {doneToday.length > 0 && (
        <Section title="Done today" count={doneToday.length}>
          <TaskList tasks={doneToday} />
        </Section>
      )}
      <DailyNote />
    </>
  );
}

/** Free-text note for today, saved when the box loses focus. Earlier notes are listed below it. */
function DailyNote() {
  const { ws, today, saveDailyNote } = useStore();
  const [showOld, setShowOld] = useState(false);
  if (!ws) return null;
  const current = ws.dailyNotes.find((n) => n.date === today)?.content ?? "";
  const older = ws.dailyNotes.filter((n) => n.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Section title="Daily note">
      <Textarea
        key={today}
        aria-label="Daily note"
        className="min-h-28"
        defaultValue={current}
        placeholder="Plans, wins, blockers, anything you want to remember about today…"
        onBlur={(e) => e.target.value !== current && void saveDailyNote(today, e.target.value)}
      />
      {older.length > 0 && (
        <div className="mt-2">
          <button type="button" className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-fg" onClick={() => setShowOld((v) => !v)}>
            <NotebookPen className="h-3.5 w-3.5" /> {showOld ? "Hide" : "Show"} {older.length} earlier note{older.length === 1 ? "" : "s"}
          </button>
          {showOld && (
            <div className="mt-2 space-y-2">
              {older.slice(0, 30).map((n) => (
                <Card key={n.date} className="p-3">
                  <div className="mb-1 text-xs font-medium text-muted">{format(fromDateKey(n.date), "EEEE, MMMM d, yyyy")}</div>
                  <div className="whitespace-pre-wrap text-sm">{n.content}</div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

/* ---------------------------------------------------------------- Inbox */

export function InboxView() {
  const { ws, scores, openQuickAdd } = useStore();
  if (!ws) return null;
  const inbox = sortTasks(ws.tasks.filter((t) => isOpen(t) && t.status === "inbox"), "created", scores);
  return (
    <>
      <PageHeader
        title="Inbox"
        icon={<Inbox className="h-5 w-5 text-accent" />}
        subtitle="Captured but not yet organized. Open a task to give it a category, date or project, or use bulk actions."
        actions={
          <Button variant="primary" onClick={() => openQuickAdd({ status: "inbox" })}>
            <Plus className="h-4 w-4" /> Capture
          </Button>
        }
      />
      <TaskList tasks={inbox} selectable empty={<Empty icon={<Inbox className="h-7 w-7" />} title="Inbox zero" hint="New tasks with no date, category or project land here." />} />
    </>
  );
}

/* ---------------------------------------------------------------- All tasks */

const DUE_OPTIONS: { value: NonNullable<TaskFilter["due"]>; label: string }[] = [
  { value: "any", label: "Any date" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "next7", label: "Next 7 days" },
  { value: "next30", label: "Next 30 days" },
  { value: "none", label: "No date" },
];

const DEFAULT_FILTER: TaskFilter = { due: "any" };

/** Drops empty values so a saved view compares equal to the same filters set by hand. */
function normFilter(f: TaskFilter) {
  return Object.fromEntries(
    Object.entries({ due: "any", ...f })
      .filter(([, v]) => v !== undefined && v !== "" && v !== false && !(Array.isArray(v) && !v.length))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}
const sameFilter = (a: TaskFilter, b: TaskFilter) => JSON.stringify(normFilter(a)) === JSON.stringify(normFilter(b));

export function AllTasksView() {
  const { ws, scores, today, saveView, deleteView } = useStore();
  const router = useRouter();
  const viewId = useSearchParams().get("view");
  const view = viewId ? ws?.views.find((v) => v.id === viewId) : undefined;
  const [f, setF] = useState<TaskFilter>(DEFAULT_FILTER);
  const [sort, setSort] = useState<SortKey>("score");
  const [naming, setNaming] = useState<string | null>(null);
  // Load a saved view's filters when ?view= changes (derived state, adjusted during render).
  const viewKey = view?.id ?? "";
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (ws && viewKey !== loadedFor) {
    setLoadedFor(viewKey);
    setF(view ? { ...DEFAULT_FILTER, ...view.filters } : DEFAULT_FILTER);
    setSort(view ? (view.sort as SortKey) : "score");
    setNaming(null);
  }
  const tasks = useMemo(() => {
    if (!ws) return [];
    return sortTasks(ws.tasks.filter((t) => isLive(t) && matchesFilter(t, f, today)), sort, scores);
  }, [ws, f, sort, scores, today]);
  if (!ws) return null;
  const one = (v: string) => (v ? [v] : undefined);
  const active = Object.entries(f).some(([k, v]) => (k === "due" ? v !== "any" : v !== undefined && v !== "" && v !== false));
  const dirty = !!view && (!sameFilter(f, view.filters) || sort !== view.sort);
  const viewHref = (id: string) => `/tasks?view=${id}`;

  const saveNew = async () => {
    if (!naming?.trim()) return;
    const v = await saveView({ name: naming.trim(), filters: f, sort, pinned: true });
    setNaming(null);
    if (v) router.push(viewHref(v.id));
  };

  return (
    <>
      <PageHeader
        title={view ? view.name : "All Tasks"}
        icon={view ? <Bookmark className="h-5 w-5 text-accent" /> : <ListTodo className="h-5 w-5 text-accent" />}
        subtitle={view ? "Saved view. Change the filters and press Update view to keep the changes." : "Filter, sort, search and act on many tasks at once."}
        actions={
          <>
            {ws.views.length > 0 && (
              <Select aria-label="Saved views" className="w-auto" value={view?.id ?? ""} onChange={(e) => router.push(e.target.value ? viewHref(e.target.value) : "/tasks")}>
                <option value="">All tasks (no saved view)</option>
                {ws.views.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            )}
            {view && dirty && <Button onClick={() => void saveView({ id: view.id, name: view.name, filters: f, sort })}>Update view</Button>}
            {view && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (!confirm(`Delete saved view "${view.name}"? Tasks are not affected.`)) return;
                  void deleteView(view.id);
                  router.push("/tasks");
                }}
              >
                Delete view
              </Button>
            )}
            {naming === null ? (
              <Button disabled={!active} title={active ? "Save these filters as a view" : "Set some filters first"} onClick={() => setNaming(view ? `${view.name} (copy)` : "")}>
                <Bookmark className="h-4 w-4" /> Save as view
              </Button>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveNew();
                }}
              >
                <Input
                  autoFocus
                  aria-label="View name"
                  className="w-44"
                  placeholder="View name"
                  value={naming}
                  onChange={(e) => setNaming(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setNaming(null)}
                />
                <Button type="submit" variant="primary" disabled={!naming.trim()}>
                  Save
                </Button>
                <Button type="button" variant="ghost" onClick={() => setNaming(null)}>
                  Cancel
                </Button>
              </form>
            )}
          </>
        }
      />
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-faint" />
          <Input aria-label="Search tasks" className="pl-8" placeholder="Search title, notes, tags" value={f.search ?? ""} onChange={(e) => setF({ ...f, search: e.target.value || undefined })} />
        </div>
        <Select aria-label="Category" className="w-auto" value={f.categoryIds?.[0] ?? ""} onChange={(e) => setF({ ...f, categoryIds: one(e.target.value) })}>
          <option value="">All categories</option>
          <option value="__none">No category</option>
          {ws.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Project" className="w-auto" value={f.projectIds?.[0] ?? ""} onChange={(e) => setF({ ...f, projectIds: one(e.target.value) })}>
          <option value="">All projects</option>
          <option value="__none">No project</option>
          {ws.projects
            .filter((p) => !p.deletedAt)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </Select>
        <Select aria-label="Priority" className="w-auto" value={f.priorities?.[0] ?? ""} onChange={(e) => setF({ ...f, priorities: e.target.value ? [Number(e.target.value)] : undefined })}>
          <option value="">Any priority</option>
          {[1, 2, 3, 4, 5].map((p) => (
            <option key={p} value={p}>
              P{p}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Status"
          className="w-auto"
          value={f.statuses?.[0] ?? ""}
          onChange={(e) => setF({ ...f, statuses: one(e.target.value), includeCompleted: e.target.value === "completed" || e.target.value === "cancelled" ? true : f.includeCompleted })}
        >
          <option value="">Any status</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select aria-label="Due" className="w-auto" value={f.due ?? "any"} onChange={(e) => setF({ ...f, due: e.target.value as TaskFilter["due"] })}>
          {DUE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Energy" className="w-auto" value={f.energy?.[0] ?? ""} onChange={(e) => setF({ ...f, energy: one(e.target.value) })}>
          <option value="">Any energy</option>
          {ENERGY_LEVELS.map((e) => (
            <option key={e} value={e}>
              {e} energy
            </option>
          ))}
        </Select>
        <Select aria-label="Sort by" className="w-auto" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              Sort: {SORT_LABEL[k]}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={!!f.includeCompleted} onChange={(e) => setF({ ...f, includeCompleted: e.target.checked || undefined })} />
          Show completed
        </label>
        {active && (
          <Button size="sm" variant="ghost" onClick={() => setF(DEFAULT_FILTER)}>
            Clear filters
          </Button>
        )}
      </Card>
      <TaskList tasks={tasks} selectable empty={<Empty title="No tasks match" hint={active ? "Try clearing some filters." : "Press Q to add your first task."} />} />
    </>
  );
}

/* ---------------------------------------------------------------- Upcoming */

export function UpcomingView() {
  const { ws, scores, today } = useStore();
  if (!ws) return null;
  const open = ws.tasks.filter(isOpen);
  const overdue = sortTasks(open.filter((t) => isOverdue(t, today)), "due", scores);
  const days = Array.from({ length: 14 }, (_, i) => addDaysKey(today, i));
  const horizon = days[days.length - 1];
  const later = sortTasks(open.filter((t) => t.dueDate && t.dueDate > horizon), "due", scores);
  return (
    <>
      <PageHeader title="Upcoming" icon={<CalendarClock className="h-5 w-5 text-accent" />} subtitle="Everything with a due date over the next two weeks, then later." />
      {overdue.length > 0 && (
        <Section title="Overdue" count={overdue.length} tone="var(--danger)">
          <TaskList tasks={overdue} />
        </Section>
      )}
      {days.map((d) => {
        const list = sortTasks(open.filter((t) => t.dueDate === d), "due", scores);
        const mins = list.reduce((a, t) => a + (t.estimateMin ?? 0), 0);
        return (
          <section key={d} className="mb-4">
            <h2 className={cn("mb-2 flex items-baseline gap-2 text-sm font-semibold", d === today && "text-accent")}>
              {formatDue(d)}
              <span className="text-xs font-normal text-faint">
                {format(fromDateKey(d), "EEE, MMM d")}
                {list.length > 0 && ` · ${list.length} task${list.length > 1 ? "s" : ""}${mins ? ` · ${formatMinutes(mins)}` : ""}`}
              </span>
            </h2>
            {list.length ? <TaskList tasks={list} /> : <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-faint">Nothing due</div>}
          </section>
        );
      })}
      {later.length > 0 && (
        <Section title="Later" count={later.length}>
          <TaskList tasks={later} />
        </Section>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- Completed */

export function CompletedView() {
  const { ws } = useStore();
  const [q, setQ] = useState("");
  if (!ws) return null;
  const done = ws.tasks
    .filter((t) => isDone(t) && (!q || t.title.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const groups = new Map<string, TaskDTO[]>();
  for (const t of done) {
    const key = t.completedAt ? format(new Date(t.completedAt), "yyyy-MM-dd") : "unknown";
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return (
    <>
      <PageHeader
        title="Completed"
        icon={<CircleCheck className="h-5 w-5 text-success" />}
        subtitle={`${done.length} completed task${done.length === 1 ? "" : "s"}`}
        actions={<Input aria-label="Search completed" className="w-56" placeholder="Search completed" value={q} onChange={(e) => setQ(e.target.value)} />}
      />
      {done.length === 0 && <Empty icon={<CircleCheck className="h-7 w-7" />} title="Nothing completed yet" hint="Completed tasks appear here, grouped by day." />}
      {[...groups.entries()].map(([day, list]) => (
        <Section key={day} title={day === "unknown" ? "Unknown date" : formatDue(day)} count={list.length}>
          <TaskList tasks={list} selectable bulkMode="completed" />
        </Section>
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- Archive & Trash */

export function TrashView() {
  const { ws, bulk, saveProject, purgeProject } = useStore();
  const [tab, setTab] = useState<"archive" | "trash">("trash");
  if (!ws) return null;
  const archived = ws.tasks.filter((t) => t.archivedAt && !t.deletedAt);
  const trashed = ws.tasks.filter((t) => t.deletedAt);
  const archivedProjects = ws.projects.filter((p) => p.archivedAt && !p.deletedAt);
  const trashedProjects = ws.projects.filter((p) => p.deletedAt);
  const tabBtn = (key: "archive" | "trash", label: string, n: number, Icon: typeof Trash) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={cn("inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm", tab === key ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg")}
    >
      <Icon className="h-4 w-4" /> {label} <span className="text-xs text-faint">{n}</span>
    </button>
  );
  const projects = tab === "archive" ? archivedProjects : trashedProjects;
  return (
    <>
      <PageHeader
        title="Archive & Trash"
        icon={<Archive className="h-5 w-5 text-accent" />}
        subtitle="Archived items are hidden but kept. Trashed items can be restored or deleted forever."
        actions={
          tab === "trash" && (trashed.length > 0 || trashedProjects.length > 0) ? (
            <Button
              variant="danger"
              onClick={() => {
                if (confirm(`Permanently delete ${trashed.length} task(s) and ${trashedProjects.length} project(s) in Trash? This cannot be undone.`)) {
                  void bulk(trashed.map((t) => t.id), "purge");
                  for (const p of trashedProjects) void purgeProject(p.id);
                }
              }}
            >
              Empty trash
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex border-b border-border">
        {tabBtn("trash", "Trash", trashed.length + trashedProjects.length, Trash)}
        {tabBtn("archive", "Archive", archived.length + archivedProjects.length, Archive)}
      </div>
      {projects.length > 0 && (
        <Section title="Projects" count={projects.length}>
          <Card className="divide-y divide-border">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <span className="truncate">{p.name}</span>
                <div className="flex gap-2">
                  {tab === "archive" ? (
                    <Button size="sm" onClick={() => void saveProject({ id: p.id, archived: false })}>Unarchive</Button>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => void saveProject({ id: p.id, deleted: false })}>Restore</Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => confirm(`Permanently delete project "${p.name}"? Its tasks are kept but unlinked.`) && void purgeProject(p.id)}
                      >
                        Delete forever
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </Section>
      )}
      <Section title="Tasks" count={tab === "archive" ? archived.length : trashed.length}>
        {tab === "archive" ? (
          <TaskList tasks={archived} selectable bulkMode="archive" empty={<Empty icon={<Archive className="h-7 w-7" />} title="Archive is empty" />} />
        ) : (
          <TaskList tasks={trashed} selectable bulkMode="trash" empty={<Empty icon={<Trash className="h-7 w-7" />} title="Trash is empty" />} />
        )}
      </Section>
    </>
  );
}
