"use client";

import { ArrowRight, Database, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { addDaysKey, formatMinutes, fromDateKey, greeting } from "@/lib/dates";
import { completionSeries, isDone, isOnMyDay, isOpen, isOverdue, projectProgress, sortTasks } from "@/lib/filters";
import { QUADRANT_LABEL, type Quadrant } from "@/lib/scoring";
import { useStore } from "../store";
import { TaskList } from "../task-list";
import { Button, Card, Dot, Empty, PageHeader, Progress } from "../ui";

function Stat({ label, value, hint, tone }: { label: string; value: number | string; hint?: string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
    </Card>
  );
}

const QUADRANTS: { key: Quadrant; title: string }[] = [
  { key: "do", title: "Do first" },
  { key: "schedule", title: "Schedule" },
  { key: "delegate", title: "Delegate" },
  { key: "eliminate", title: "Eliminate" },
];

export function OverviewView() {
  const { ws, scores, today, loadDemo, openTask } = useStore();
  if (!ws) return null;
  const open = ws.tasks.filter(isOpen);
  const overdue = open.filter((t) => isOverdue(t, today));
  const dueToday = open.filter((t) => t.dueDate === today);
  const myDay = ws.tasks.filter((t) => isOnMyDay(t, today));
  const weekAgo = addDaysKey(today, -6);
  const doneWeek = ws.tasks.filter((t) => isDone(t) && t.completedAt && format(new Date(t.completedAt), "yyyy-MM-dd") >= weekAgo);
  const top = sortTasks(open.filter((t) => t.status !== "waiting"), "score", scores).slice(0, 5);
  const planned = myDay.reduce((a, t) => a + (t.estimateMin ?? 0), 0);
  const cap = ws.settings.dailyCapacityMin;
  const series = completionSeries(ws.tasks, 14, today).map((d) => ({ ...d, label: format(fromDateKey(d.date), "MMM d") }));
  const projects = ws.projects.filter((p) => !p.deletedAt && !p.archivedAt && (p.status === "active" || p.status === "planning"));
  const byCat = ws.categories
    .map((c) => ({ c, n: open.filter((t) => t.categoryId === c.id).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const maxCat = Math.max(1, ...byCat.map((x) => x.n));
  const name = ws.settings.displayName;

  if (ws.tasks.length === 0) {
    return (
      <>
        <PageHeader title={`${greeting()}${name ? `, ${name}` : ""}`} subtitle={format(new Date(), "EEEE, MMMM d")} icon={<LayoutDashboard className="h-5 w-5 text-accent" />} />
        <Empty
          icon={<Database className="h-8 w-8" />}
          title="No tasks yet"
          hint="Press Q (or the Add task button) to capture your first task, or load demo data to explore. Demo data can be removed in one click from Settings."
          action={
            <Button variant="primary" onClick={() => void loadDemo()}>
              Load demo data
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title={`${greeting()}${name ? `, ${name}` : ""}`} subtitle={format(new Date(), "EEEE, MMMM d")} icon={<LayoutDashboard className="h-5 w-5 text-accent" />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open tasks" value={open.length} hint={`${ws.tasks.filter((t) => isOpen(t) && t.status === "inbox").length} in inbox`} />
        <Stat label="Due today" value={dueToday.length} hint={`${myDay.length} on My Day`} />
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? "var(--danger)" : undefined} hint={overdue.length ? "Needs attention" : "All caught up"} />
        <Stat label="Completed (7 days)" value={doneWeek.length} tone="var(--success)" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Top priorities</h2>
            <Link href="/tasks" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
              All tasks <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <TaskList tasks={top} empty={<Empty title="Nothing open" hint="You're clear. Add a task with Q." />} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Today&apos;s capacity</h2>
          <Card className="p-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium tabular-nums">{formatMinutes(planned)} planned</span>
              <span className="text-xs text-muted">of {formatMinutes(cap)}</span>
            </div>
            <div className="mt-2">
              <Progress value={cap ? (planned / cap) * 100 : 0} color={planned > cap ? "red" : undefined} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {planned > cap
                ? `Over capacity by ${formatMinutes(planned - cap)} — consider moving something to tomorrow.`
                : `${myDay.length} task${myDay.length === 1 ? "" : "s"} on My Day. ${formatMinutes(cap - planned)} still free.`}
            </p>
            <Link href="/my-day" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent">
              Open My Day <ArrowRight className="h-3 w-3" />
            </Link>
          </Card>

          <h2 className="mb-2 mt-6 text-sm font-semibold">Open tasks by category</h2>
          <Card className="space-y-2.5 p-4">
            {byCat.length === 0 && <div className="text-xs text-muted">No categorized open tasks.</div>}
            {byCat.map(({ c, n }) => (
              <div key={c.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <Dot color={c.color} />
                    {c.name}
                  </span>
                  <span className="tabular-nums text-muted">{n}</span>
                </div>
                <Progress value={(n / maxCat) * 100} color={c.color} />
              </div>
            ))}
          </Card>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Eisenhower matrix</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {QUADRANTS.map((q) => {
            const list = sortTasks(open.filter((t) => scores.get(t.id)?.quadrant === q.key), "score", scores);
            return (
              <Card key={q.key} className="p-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-sm font-semibold">{q.title}</div>
                    <div className="text-xs text-muted">{QUADRANT_LABEL[q.key]}</div>
                  </div>
                  <div className="text-lg font-semibold tabular-nums">{list.length}</div>
                </div>
                <ul className="mt-2 space-y-1">
                  {list.slice(0, 4).map((t) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => openTask(t.id)} className="w-full cursor-pointer truncate text-left text-xs text-muted hover:text-fg">
                        {t.title}
                      </button>
                    </li>
                  ))}
                  {list.length > 4 && <li className="text-xs text-faint">+{list.length - 4} more</li>}
                </ul>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Completed per day (last 14 days)</h2>
          <Card className="h-56 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--panel-2)" }}
                  contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--fg)" }}
                  labelStyle={{ color: "var(--muted)" }}
                  formatter={(v) => [String(v), "Completed"]}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </section>
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Active projects</h2>
            <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
              All projects <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Card className="divide-y divide-border">
            {projects.length === 0 && <div className="p-4 text-xs text-muted">No active projects.</div>}
            {projects.slice(0, 5).map((p) => {
              const prog = projectProgress(p.id, ws.tasks, p.milestones, p.useWeightedMilestones);
              const cat = ws.categories.find((c) => c.id === p.categoryId);
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="block p-3 hover:bg-panel-2/60">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 truncate">
                      <Dot color={p.color ?? cat?.color} />
                      {p.name}
                    </span>
                    <span className="text-xs tabular-nums text-muted">{prog.pct}%</span>
                  </div>
                  <Progress value={prog.pct} color={p.color ?? cat?.color} />
                </Link>
              );
            })}
          </Card>
        </section>
      </div>
    </>
  );
}
