"use client";

import { ArrowLeft, Check, FolderKanban, Pin, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PRIORITY_LABEL, PROJECT_STATUSES, PROJECT_STATUS_LABEL } from "@/lib/constants";
import { formatDue } from "@/lib/dates";
import { isLive, isOpen, isOverdue, projectProgress, sortTasks } from "@/lib/filters";
import type { ProjectDTO } from "@/lib/types";
import { useStore } from "../store";
import { TaskList } from "../task-list";
import { Badge, Button, Card, cn, Dot, Empty, Input, Label, LevelPicker, Modal, PageHeader, Progress, Select, Textarea } from "../ui";

type Draft = Partial<ProjectDTO> & { name: string };

function ProjectForm({ initial, onDone }: { initial?: ProjectDTO; onDone: (p?: ProjectDTO) => void }) {
  const { ws, saveProject } = useStore();
  const [d, setD] = useState<Draft>(
    initial ?? { name: "", description: "", categoryId: null, priority: 3, importance: 3, status: "active", startDate: null, targetDate: null },
  );
  if (!ws) return null;
  const submit = async () => {
    if (!d.name.trim()) return;
    const p = await saveProject({ ...d, name: d.name.trim() });
    onDone(p);
  };
  return (
    <form
      className="space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div>
        <Label>Name</Label>
        <Input autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Dissertation chapter 4" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={d.description ?? ""} onChange={(e) => setD({ ...d, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <Select value={d.categoryId ?? ""} onChange={(e) => setD({ ...d, categoryId: e.target.value || null })}>
            <option value="">No category</option>
            {ws.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Priority</Label>
          <Select value={d.priority} onChange={(e) => setD({ ...d, priority: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </div>
        <LevelPicker label="Importance (feeds task scores)" value={d.importance ?? 3} onChange={(v) => setD({ ...d, importance: v })} />
        <div>
          <Label>Start date</Label>
          <Input type="date" value={d.startDate ?? ""} onChange={(e) => setD({ ...d, startDate: e.target.value || null })} />
        </div>
        <div>
          <Label>Target date</Label>
          <Input type="date" value={d.targetDate ?? ""} onChange={(e) => setD({ ...d, targetDate: e.target.value || null })} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={!!d.useWeightedMilestones} onChange={(e) => setD({ ...d, useWeightedMilestones: e.target.checked })} />
        Measure progress by weighted milestones (instead of task count)
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!d.name.trim()}>
          {initial ? "Save" : "Create project"}
        </Button>
      </div>
    </form>
  );
}

export function ProjectsView() {
  const { ws } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<string>("open");
  const showForm = creating || params.get("new") === "1";
  if (!ws) return null;
  const close = (p?: ProjectDTO) => {
    setCreating(false);
    if (params.get("new")) router.replace("/projects");
    if (p) router.push(`/projects/${p.id}`);
  };
  const projects = ws.projects
    .filter((p) => !p.deletedAt && !p.archivedAt)
    .filter((p) => (status === "open" ? p.status !== "completed" && p.status !== "cancelled" : status === "all" ? true : p.status === status))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.priority - b.priority || (a.targetDate ?? "9").localeCompare(b.targetDate ?? "9"));

  return (
    <>
      <PageHeader
        title="Projects"
        icon={<FolderKanban className="h-5 w-5 text-accent" />}
        subtitle="Multi-step outcomes with milestones and linked tasks."
        actions={
          <>
            <Select aria-label="Status filter" className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="open">Open</option>
              <option value="all">All</option>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New project
            </Button>
          </>
        }
      />
      {projects.length === 0 ? (
        <Empty icon={<FolderKanban className="h-7 w-7" />} title="No projects here" hint="Create a project to group related tasks and track milestones." action={<Button variant="primary" onClick={() => setCreating(true)}>New project</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const cat = ws.categories.find((c) => c.id === p.categoryId);
            const prog = projectProgress(p.id, ws.tasks, p.milestones, p.useWeightedMilestones);
            const openCount = ws.tasks.filter((t) => t.projectId === p.id && isOpen(t)).length;
            const overdue = ws.tasks.filter((t) => t.projectId === p.id && isOverdue(t)).length;
            const nextMs = p.milestones.filter((m) => !m.completedAt).sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"))[0];
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="block">
                <Card className="h-full p-4 transition-colors hover:border-accent/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-medium">
                        <Dot color={p.color ?? cat?.color} />
                        <span className="truncate">{p.name}</span>
                        {p.pinned && <Pin className="h-3 w-3 shrink-0 text-faint" />}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">{cat?.name ?? "No category"}</div>
                    </div>
                    <Badge>{PROJECT_STATUS_LABEL[p.status] ?? p.status}</Badge>
                  </div>
                  {p.description && <p className="mt-2 line-clamp-2 text-xs text-muted">{p.description}</p>}
                  <div className="mt-3 flex justify-between text-xs text-muted">
                    <span>
                      {prog.done}/{prog.total} tasks{overdue > 0 && <span className="text-danger"> · {overdue} overdue</span>}
                    </span>
                    <span className="tabular-nums">{prog.pct}%</span>
                  </div>
                  <div className="mt-1.5">
                    <Progress value={prog.pct} color={p.color ?? cat?.color} />
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-faint">
                    <span className="truncate">{nextMs ? `Next: ${nextMs.title}` : `${openCount} open`}</span>
                    {p.targetDate && <span>Target {formatDue(p.targetDate)}</span>}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <Modal open={showForm} onOpenChange={(v) => !v && close()} title="New project">
        {showForm && <ProjectForm onDone={close} />}
      </Modal>
    </>
  );
}

export function ProjectDetailView({ id }: { id: string }) {
  const { ws, scores, saveProject, saveMilestone, deleteMilestone, openQuickAdd, today } = useStore();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const [msDate, setMsDate] = useState("");
  const [showDone, setShowDone] = useState(false);
  if (!ws) return null;
  const p = ws.projects.find((x) => x.id === id);
  if (!p) {
    return <Empty title="Project not found" hint="It may have been deleted." action={<Link href="/projects" className="text-sm text-accent">Back to projects</Link>} />;
  }
  const cat = ws.categories.find((c) => c.id === p.categoryId);
  const prog = projectProgress(p.id, ws.tasks, p.milestones, p.useWeightedMilestones);
  const tasks = ws.tasks.filter((t) => t.projectId === p.id && isLive(t));
  const openTasks = sortTasks(tasks.filter(isOpen), "score", scores);
  const doneTasks = tasks.filter((t) => t.status === "completed");
  const milestones = [...p.milestones].sort((a, b) => a.sortOrder - b.sortOrder);
  const addMilestone = () => {
    if (!msTitle.trim()) return;
    void saveMilestone({ projectId: p.id, title: msTitle.trim(), dueDate: msDate || null });
    setMsTitle("");
    setMsDate("");
  };

  return (
    <>
      <Link href="/projects" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft className="h-3 w-3" /> Projects
      </Link>
      <PageHeader
        title={p.name}
        icon={<Dot color={p.color ?? cat?.color} className="h-3 w-3" />}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{PROJECT_STATUS_LABEL[p.status] ?? p.status}</Badge>
            <span>{cat?.name ?? "No category"}</span>
            <span>· {PRIORITY_LABEL[p.priority]}</span>
            {p.targetDate && <span className={cn(p.targetDate < today && p.status !== "completed" && "text-danger")}>· Target {formatDue(p.targetDate)}</span>}
            {p.isDemo && <span className="text-faint">· demo</span>}
          </span>
        }
        actions={
          <>
            <Button onClick={() => void saveProject({ id: p.id, pinned: !p.pinned })}>
              <Pin className="h-3.5 w-3.5" /> {p.pinned ? "Unpin" : "Pin"}
            </Button>
            <Button onClick={() => setEditing(true)}>Edit</Button>
            {p.status !== "completed" && (
              <Button onClick={() => void saveProject({ id: p.id, status: "completed" })}>
                <Check className="h-3.5 w-3.5" /> Complete
              </Button>
            )}
            <Button onClick={() => void saveProject({ id: p.id, archived: true }).then(() => router.push("/projects"))}>Archive</Button>
            <Button variant="danger" onClick={() => void saveProject({ id: p.id, deleted: true }).then(() => router.push("/projects"))}>
              Trash
            </Button>
          </>
        }
      />
      {p.description && <p className="-mt-2 mb-5 max-w-3xl text-sm text-muted">{p.description}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Tasks <span className="text-xs font-normal text-faint">{openTasks.length} open</span>
            </h2>
            <Button size="sm" variant="primary" onClick={() => openQuickAdd({ projectId: p.id, categoryId: p.categoryId })}>
              <Plus className="h-3.5 w-3.5" /> Add task
            </Button>
          </div>
          <TaskList tasks={openTasks} selectable empty={<Empty title="No open tasks" hint="Add the next concrete step for this project." />} />
          {doneTasks.length > 0 && (
            <div className="mt-4">
              <button type="button" className="cursor-pointer text-xs text-muted hover:text-fg" onClick={() => setShowDone((v) => !v)}>
                {showDone ? "Hide" : "Show"} {doneTasks.length} completed
              </button>
              {showDone && (
                <div className="mt-2">
                  <TaskList tasks={doneTasks} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">Progress</span>
              <span className="text-2xl font-semibold tabular-nums">{prog.pct}%</span>
            </div>
            <div className="mt-2">
              <Progress value={prog.pct} color={p.color ?? cat?.color} />
            </div>
            <div className="mt-2 text-xs text-muted">
              {p.useWeightedMilestones ? "Based on weighted milestones" : `${prog.done} of ${prog.total} tasks done`}
            </div>
          </Card>

          <div>
            <h2 className="mb-2 text-sm font-semibold">Milestones</h2>
            <Card className="divide-y divide-border">
              {milestones.length === 0 && <div className="p-3 text-xs text-muted">No milestones yet.</div>}
              {milestones.map((m) => {
                const linked = tasks.filter((t) => t.milestoneId === m.id);
                const linkedDone = linked.filter((t) => t.status === "completed").length;
                return (
                  <div key={m.id} className="group flex items-start gap-2.5 p-3">
                    <button
                      type="button"
                      aria-label={m.completedAt ? "Mark milestone not done" : "Mark milestone done"}
                      onClick={() => void saveMilestone({ id: m.id, projectId: p.id, completed: !m.completedAt })}
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border",
                        m.completedAt ? "border-success bg-success text-white" : "border-faint hover:bg-panel-2",
                      )}
                    >
                      {m.completedAt && <Check className="h-3 w-3" strokeWidth={3} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-sm", m.completedAt && "text-muted line-through")}>{m.title}</div>
                      <div className="text-xs text-faint">
                        {m.dueDate ? <span className={cn(!m.completedAt && m.dueDate < today && "text-danger")}>{formatDue(m.dueDate)}</span> : "No date"}
                        {linked.length > 0 && ` · ${linkedDone}/${linked.length} tasks`}
                        {p.useWeightedMilestones && ` · weight ${m.weight}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete milestone"
                      className="cursor-pointer text-faint opacity-0 hover:text-danger group-hover:opacity-100"
                      onClick={() => confirm(`Delete milestone "${m.title}"?`) && void deleteMilestone(m.id, p.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              <form
                className="flex flex-wrap gap-2 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  addMilestone();
                }}
              >
                <Input className="h-7 min-w-32 flex-1" placeholder="New milestone" value={msTitle} onChange={(e) => setMsTitle(e.target.value)} aria-label="Milestone title" />
                <Input className="h-7 w-36" type="date" value={msDate} onChange={(e) => setMsDate(e.target.value)} aria-label="Milestone due date" />
                <Button size="sm" type="submit" disabled={!msTitle.trim()}>
                  Add
                </Button>
              </form>
            </Card>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold">Notes</h2>
            <Textarea
              key={p.id + p.updatedAt}
              className="min-h-32"
              defaultValue={p.notes}
              placeholder="Decisions, links, ideas…"
              onBlur={(e) => e.target.value !== p.notes && void saveProject({ id: p.id, notes: e.target.value })}
            />
          </div>
        </div>
      </div>

      <Modal open={editing} onOpenChange={setEditing} title="Edit project">
        {editing && <ProjectForm initial={p} onDone={() => setEditing(false)} />}
      </Modal>
    </>
  );
}
