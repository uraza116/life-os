"use client";

import { Tooltip } from "radix-ui";
import { Check, Clock, Flag, FolderKanban, ListChecks, Repeat, Sun, Trash } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PRIORITY_SHORT, STATUS_LABEL } from "@/lib/constants";
import { formatDue, formatMinutes } from "@/lib/dates";
import { BUCKET_LABEL, QUADRANT_LABEL } from "@/lib/scoring";
import type { TaskDTO } from "@/lib/types";
import { useStore } from "./store";
import { Badge, Button, cn, Dot, Select } from "./ui";

const PRIORITY_COLOR: Record<number, string> = { 1: "#ef4444", 2: "#f97316", 3: "#3b82f6", 4: "#64748b", 5: "#a1a1aa" };

export function ScoreBadge({ id }: { id: string }) {
  const { scores } = useStore();
  const s = scores.get(id);
  if (!s) return null;
  const tone = s.score >= 72 ? "#ef4444" : s.score >= 58 ? "#f97316" : s.score >= 40 ? "#3b82f6" : "#64748b";
  return (
    <Tooltip.Root delayDuration={250}>
      <Tooltip.Trigger asChild>
        <span
          className="inline-flex h-5 min-w-8 items-center justify-center rounded-md px-1 text-[11px] font-semibold tabular-nums"
          style={{ color: tone, background: `${tone}18` }}
          aria-label={`Priority score ${s.score}`}
        >
          {s.score}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="left" sideOffset={6} className="z-50 max-w-64 rounded-lg border border-border bg-panel p-3 text-xs text-fg shadow-xl">
          <div className="mb-1 font-semibold">
            Score {s.score} · {BUCKET_LABEL[s.bucket]}
          </div>
          <div className="mb-2 text-muted">{QUADRANT_LABEL[s.quadrant]}</div>
          {s.reasons.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4">
              {s.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function CompleteToggle({ task }: { task: TaskDTO }) {
  const { toggleComplete } = useStore();
  const done = task.status === "completed";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void toggleComplete(task);
      }}
      aria-label={done ? "Mark as not done" : "Mark as done"}
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] transition-colors",
        done ? "border-success bg-success text-white" : "hover:bg-panel-2",
      )}
      style={done ? undefined : { borderColor: PRIORITY_COLOR[task.priority] }}
    >
      {done && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
}

export function TaskRow({
  task,
  selected,
  onSelect,
  selectable,
  extra,
}: {
  task: TaskDTO;
  selected?: boolean;
  onSelect?: (v: boolean) => void;
  selectable?: boolean;
  extra?: ReactNode;
}) {
  const { ws, openTask, today } = useStore();
  const cat = task.categoryId ? ws?.categories.find((c) => c.id === task.categoryId) : undefined;
  const proj = task.projectId ? ws?.projects.find((p) => p.id === task.projectId) : undefined;
  const overdue = task.dueDate && task.dueDate < today && task.status !== "completed";
  const done = task.status === "completed";
  const checklistDone = task.checklist.filter((c) => c.done).length;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openTask(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") openTask(task.id);
      }}
      className={cn(
        "group flex cursor-pointer items-start gap-3 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-panel-2/60",
        selected && "bg-accent-soft/60",
      )}
    >
      {selectable && (
        <input
          type="checkbox"
          aria-label={`Select ${task.title}`}
          checked={!!selected}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onSelect?.(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--accent)]"
        />
      )}
      <div className="mt-px">
        <CompleteToggle task={task} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-sm", done && "text-muted line-through")}>{task.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {task.dueDate && (
            <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-danger", task.dueDate === today && !done && "text-accent")}>
              <Clock className="h-3 w-3" />
              {formatDue(task.dueDate, task.dueTime)}
            </span>
          )}
          {cat && (
            <span className="inline-flex items-center gap-1.5">
              <Dot color={cat.color} />
              {cat.name}
            </span>
          )}
          {proj && (
            <span className="inline-flex items-center gap-1">
              <FolderKanban className="h-3 w-3" />
              {proj.name}
            </span>
          )}
          {task.estimateMin ? <span>{formatMinutes(task.estimateMin)}</span> : null}
          {task.recurrence && <Repeat className="h-3 w-3" aria-label="Repeats" />}
          {task.checklist.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3 w-3" />
              {checklistDone}/{task.checklist.length}
            </span>
          )}
          {task.status !== "todo" && task.status !== "completed" && <Badge>{STATUS_LABEL[task.status]}</Badge>}
          {task.pinnedToday && task.myDayDate === today && !done && <Sun className="h-3 w-3 text-warn" aria-label="On My Day" />}
          {task.tags.map((t) => (
            <span key={t} className="text-faint">
              #{t}
            </span>
          ))}
          {task.isDemo && <span className="text-faint">demo</span>}
        </div>
      </div>
      {extra}
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium" style={{ color: PRIORITY_COLOR[task.priority] }}>
          <Flag className="h-3 w-3" />
          {PRIORITY_SHORT[task.priority]}
        </span>
        {!done && !task.deletedAt && <ScoreBadge id={task.id} />}
      </div>
    </div>
  );
}

/** A task list with optional multi-select and a bulk action bar. */
export function TaskList({
  tasks,
  empty,
  selectable = false,
  bulkMode = "open",
  rowExtra,
}: {
  tasks: TaskDTO[];
  empty?: ReactNode;
  selectable?: boolean;
  bulkMode?: "open" | "trash" | "archive" | "completed";
  rowExtra?: (t: TaskDTO) => ReactNode;
}) {
  const { bulk, ws, today } = useStore();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const visibleSel = [...sel].filter((id) => tasks.some((t) => t.id === id));
  const all = tasks.length > 0 && visibleSel.length === tasks.length;
  const clear = () => setSel(new Set());
  const run = async (action: Parameters<typeof bulk>[1], patch?: Parameters<typeof bulk>[2]) => {
    await bulk(visibleSel, action, patch);
    clear();
  };

  if (!tasks.length) return <>{empty}</>;
  return (
    <div>
      {selectable && (
        <div className="mb-2 flex min-h-8 flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex cursor-pointer items-center gap-2 text-muted">
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setSel(e.target.checked ? new Set(tasks.map((t) => t.id)) : new Set())}
              className="h-4 w-4 accent-[var(--accent)]"
              aria-label="Select all"
            />
            {visibleSel.length ? `${visibleSel.length} selected` : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
          </label>
          {visibleSel.length > 0 && bulkMode === "open" && (
            <>
              <Button size="sm" onClick={() => run("complete")}>
                <Check className="h-3.5 w-3.5" /> Complete
              </Button>
              <Button size="sm" onClick={() => run("update", { pinnedToday: true, myDayDate: today })}>
                <Sun className="h-3.5 w-3.5" /> Add to My Day
              </Button>
              <Select
                aria-label="Set priority"
                className="h-7 w-auto text-xs"
                value=""
                onChange={(e) => e.target.value && run("update", { priority: Number(e.target.value) })}
              >
                <option value="">Set priority…</option>
                {[1, 2, 3, 4, 5].map((p) => (
                  <option key={p} value={p}>
                    P{p}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Move to category"
                className="h-7 w-auto text-xs"
                value=""
                onChange={(e) => e.target.value && run("update", { categoryId: e.target.value === "__none" ? null : e.target.value, subcategoryId: null })}
              >
                <option value="">Move to category…</option>
                <option value="__none">No category</option>
                {ws?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={() => run("archive")}>
                Archive
              </Button>
              <Button size="sm" variant="danger" onClick={() => run("delete")}>
                <Trash className="h-3.5 w-3.5" /> Delete
              </Button>
            </>
          )}
          {visibleSel.length > 0 && bulkMode === "completed" && (
            <>
              <Button size="sm" onClick={() => run("reopen")}>Reopen</Button>
              <Button size="sm" onClick={() => run("archive")}>Archive</Button>
              <Button size="sm" variant="danger" onClick={() => run("delete")}>Delete</Button>
            </>
          )}
          {visibleSel.length > 0 && bulkMode === "archive" && (
            <>
              <Button size="sm" onClick={() => run("unarchive")}>Unarchive</Button>
              <Button size="sm" variant="danger" onClick={() => run("delete")}>Move to Trash</Button>
            </>
          )}
          {visibleSel.length > 0 && bulkMode === "trash" && (
            <>
              <Button size="sm" onClick={() => run("restore")}>Restore</Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (confirm(`Permanently delete ${visibleSel.length} task(s)? This cannot be undone.`)) void run("purge");
                }}
              >
                Delete forever
              </Button>
            </>
          )}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-panel">
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            selectable={selectable}
            selected={sel.has(t.id)}
            onSelect={(v) =>
              setSel((s) => {
                const n = new Set(s);
                if (v) n.add(t.id);
                else n.delete(t.id);
                return n;
              })
            }
            extra={rowExtra?.(t)}
          />
        ))}
      </div>
    </div>
  );
}
