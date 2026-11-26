"use client";

import { Archive, Copy, Plus, Sun, Trash, X } from "lucide-react";
import { useState } from "react";
import { ENERGY_LEVELS, PRIORITY_LABEL, STATUS_LABEL, TASK_STATUSES, isOpenStatus } from "@/lib/constants";
import { describeRecurrence, type RecurrenceRule } from "@/lib/recurrence";
import { BUCKET_LABEL, QUADRANT_LABEL } from "@/lib/scoring";
import type { TaskDTO } from "@/lib/types";
import { useStore } from "./store";
import { Button, Input, Label, LevelPicker, Modal, Select, Textarea } from "./ui";

const RECURRENCE_PRESETS: { label: string; value: RecurrenceRule | null }[] = [
  { label: "Does not repeat", value: null },
  { label: "Daily", value: { freq: "daily", interval: 1 } },
  { label: "Every weekday", value: { freq: "weekdays", interval: 1 } },
  { label: "Weekly", value: { freq: "weekly", interval: 1 } },
  { label: "Every 2 weeks", value: { freq: "weekly", interval: 2 } },
  { label: "Monthly", value: { freq: "monthly", interval: 1 } },
  { label: "Yearly", value: { freq: "yearly", interval: 1 } },
];

export function TaskEditor() {
  const { ws, editingId, openTask } = useStore();
  const task = ws?.tasks.find((t) => t.id === editingId);
  return (
    <Modal open={!!task} onOpenChange={(v) => !v && openTask(null)} title="Task details" side>
      {/* key remounts the form when switching tasks so local drafts reset */}
      {task && <EditorBody key={task.id} task={task} />}
    </Modal>
  );
}

function EditorBody({ task }: { task: TaskDTO }) {
  const { ws, updateTask, createTask, scores, openTask, today, purgeTask } = useStore();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [newItem, setNewItem] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  if (!ws) return null;
  const set = (patch: Parameters<typeof updateTask>[1]) => void updateTask(task.id, patch);
  const cat = ws.categories.find((c) => c.id === task.categoryId);
  const proj = ws.projects.find((p) => p.id === task.projectId);
  const s = scores.get(task.id);
  const onMyDay = task.pinnedToday && task.myDayDate === today;
  const recurrenceKey = JSON.stringify(task.recurrence);
  const presetMatch = RECURRENCE_PRESETS.find((p) => JSON.stringify(p.value) === recurrenceKey);
  const depCandidates = ws.tasks.filter((t) => t.id !== task.id && !t.deletedAt && isOpenStatus(t.status) && !task.dependsOn.includes(t.id));

  const duplicate = async () => {
    const copy = await createTask({
      title: `${task.title} (copy)`,
      description: task.description,
      categoryId: task.categoryId,
      subcategoryId: task.subcategoryId,
      projectId: task.projectId,
      milestoneId: task.milestoneId,
      status: isOpenStatus(task.status) ? task.status : "todo",
      priority: task.priority,
      importance: task.importance,
      urgency: task.urgency,
      impact: task.impact,
      energy: task.energy,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      startDate: task.startDate,
      estimateMin: task.estimateMin,
      tags: task.tags,
      checklist: task.checklist.map((c) => ({ text: c.text, done: false })),
    });
    if (copy) openTask(copy.id);
  };

  return (
    <div className="flex-1 space-y-5 overflow-y-auto p-4">
      <div>
        <Input
          aria-label="Title"
          className="h-10 text-base font-medium"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task.title && set({ title: title.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant={onMyDay ? "primary" : "secondary"} onClick={() => set(onMyDay ? { pinnedToday: false, myDayDate: null } : { pinnedToday: true, myDayDate: today })}>
            <Sun className="h-3.5 w-3.5" /> {onMyDay ? "On My Day" : "Add to My Day"}
          </Button>
          <Button size="sm" onClick={duplicate}>
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </Button>
          {task.archivedAt ? (
            <Button size="sm" onClick={() => set({ archived: false })}>Unarchive</Button>
          ) : (
            <Button size="sm" onClick={() => set({ archived: true })}>
              <Archive className="h-3.5 w-3.5" /> Archive
            </Button>
          )}
          {task.deletedAt ? (
            <>
              <Button size="sm" onClick={() => set({ deleted: false })}>Restore</Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (confirm("Permanently delete this task? This cannot be undone.")) {
                    openTask(null);
                    void purgeTask(task.id);
                  }
                }}
              >
                Delete forever
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                set({ deleted: true });
                openTask(null);
              }}
            >
              <Trash className="h-3.5 w-3.5" /> Move to Trash
            </Button>
          )}
        </div>
      </div>

      {s && isOpenStatus(task.status) && (
        <div className="rounded-lg border border-border bg-panel-2/50 p-3 text-sm">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-semibold tabular-nums">{s.score}</span>
              <span className="ml-1 text-xs text-muted">/ 100 {s.manual && "(manual)"}</span>
            </div>
            <div className="text-right text-xs">
              <div className="font-medium">{BUCKET_LABEL[s.bucket]}</div>
              <div className="text-muted">{QUADRANT_LABEL[s.quadrant]}</div>
            </div>
          </div>
          {s.reasons.length > 0 && <div className="mt-2 text-xs text-muted">{s.reasons.join(" · ")}</div>}
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-muted">How this score is calculated</summary>
            <ul className="mt-2 space-y-1">
              {s.factors.map((f) => (
                <li key={f.key} className="flex justify-between">
                  <span>{f.label}</span>
                  <span className="tabular-nums text-muted">+{f.points}</span>
                </li>
              ))}
              {s.computed !== Math.round(s.factors.reduce((a, f) => a + f.points, 0)) && (
                <li className="text-muted">Modifiers (dependencies, waiting, future start, someday cap) applied → {s.computed}</li>
              )}
            </ul>
            <div className="mt-3 flex items-center gap-2">
              <Label className="mb-0">Manual override</Label>
              <Input
                type="number"
                min={0}
                max={100}
                className="h-7 w-20"
                placeholder="auto"
                defaultValue={task.manualScore ?? ""}
                onBlur={(e) => {
                  const v = e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value)));
                  if (v !== task.manualScore) set({ manualScore: v });
                }}
              />
            </div>
          </details>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Status</Label>
          <Select value={task.status} onChange={(e) => set({ status: e.target.value as TaskDTO["status"] })}>
            {TASK_STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_LABEL[st]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Priority</Label>
          <Select value={task.priority} onChange={(e) => set({ priority: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={task.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value || null, subcategoryId: null })}>
            <option value="">No category</option>
            {ws.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Subcategory</Label>
          <Select value={task.subcategoryId ?? ""} disabled={!cat?.subcategories.length} onChange={(e) => set({ subcategoryId: e.target.value || null })}>
            <option value="">None</option>
            {cat?.subcategories.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Project</Label>
          <Select
            value={task.projectId ?? ""}
            onChange={(e) => {
              const p = ws.projects.find((x) => x.id === e.target.value);
              set({ projectId: e.target.value || null, milestoneId: null, ...(p?.categoryId && !task.categoryId ? { categoryId: p.categoryId } : {}) });
            }}
          >
            <option value="">No project</option>
            {ws.projects
              .filter((p) => !p.deletedAt && (!p.archivedAt || p.id === task.projectId))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </div>
        <div>
          <Label>Milestone</Label>
          <Select value={task.milestoneId ?? ""} disabled={!proj?.milestones.length} onChange={(e) => set({ milestoneId: e.target.value || null })}>
            <option value="">None</option>
            {proj?.milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Due date</Label>
          <Input type="date" value={task.dueDate ?? ""} onChange={(e) => set({ dueDate: e.target.value || null })} />
        </div>
        <div>
          <Label>Due time</Label>
          <Input type="time" value={task.dueTime ?? ""} onChange={(e) => set({ dueTime: e.target.value || null })} />
        </div>
        <div>
          <Label>Start date</Label>
          <Input type="date" value={task.startDate ?? ""} onChange={(e) => set({ startDate: e.target.value || null })} />
        </div>
        <div>
          <Label>Estimate (minutes)</Label>
          <Input
            type="number"
            min={0}
            defaultValue={task.estimateMin ?? ""}
            onBlur={(e) => {
              const v = e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value)));
              if (v !== task.estimateMin) set({ estimateMin: v });
            }}
          />
        </div>
        <div>
          <Label>Energy needed</Label>
          <Select value={task.energy} onChange={(e) => set({ energy: e.target.value as TaskDTO["energy"] })}>
            {ENERGY_LEVELS.map((e) => (
              <option key={e} value={e}>
                {e[0].toUpperCase() + e.slice(1)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Repeat</Label>
          <Select
            value={presetMatch ? RECURRENCE_PRESETS.indexOf(presetMatch) : "custom"}
            onChange={(e) => set({ recurrence: RECURRENCE_PRESETS[Number(e.target.value)]?.value ?? null })}
          >
            {RECURRENCE_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
            {!presetMatch && <option value="custom">{describeRecurrence(task.recurrence)}</option>}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <LevelPicker label="Importance" value={task.importance} onChange={(v) => set({ importance: v })} />
        <LevelPicker label="Urgency" value={task.urgency} onChange={(v) => set({ urgency: v })} />
        <LevelPicker label="Impact" value={task.impact} onChange={(v) => set({ impact: v })} />
      </div>

      {task.status === "waiting" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Waiting on</Label>
            <Input defaultValue={task.waitingOn ?? ""} onBlur={(e) => e.target.value !== (task.waitingOn ?? "") && set({ waitingOn: e.target.value || null })} />
          </div>
          <div>
            <Label>Follow up on</Label>
            <Input type="date" value={task.followUpDate ?? ""} onChange={(e) => set({ followUpDate: e.target.value || null })} />
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={task.delegatable} onChange={(e) => set({ delegatable: e.target.checked })} />
        Could be delegated
      </label>

      <div>
        <Label>Tags</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {task.tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-md bg-panel-2 px-2 py-0.5 text-xs">
              #{t}
              <button type="button" aria-label={`Remove tag ${t}`} className="cursor-pointer text-muted hover:text-fg" onClick={() => set({ tags: task.tags.filter((x) => x !== t) })}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Input
            className="h-7 w-32"
            placeholder="Add tag"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagDraft.trim()) {
                const t = tagDraft.trim().replace(/^#/, "").toLowerCase();
                if (!task.tags.includes(t)) set({ tags: [...task.tags, t] });
                setTagDraft("");
              }
            }}
          />
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={() => description !== task.description && set({ description })} placeholder="Details, links, context…" />
      </div>

      <div>
        <Label>
          Checklist ({task.checklist.filter((c) => c.done).length}/{task.checklist.length})
        </Label>
        <div className="space-y-1">
          {task.checklist.map((c, i) => (
            <div key={c.id} className="group flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--accent)]"
                checked={c.done}
                onChange={(e) => set({ checklist: task.checklist.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })}
              />
              <span className={c.done ? "flex-1 text-muted line-through" : "flex-1"}>{c.text}</span>
              <button type="button" aria-label="Remove item" className="cursor-pointer text-faint opacity-0 group-hover:opacity-100" onClick={() => set({ checklist: task.checklist.filter((_, j) => j !== i) })}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              className="h-7"
              placeholder="Add a step"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newItem.trim()) {
                  set({ checklist: [...task.checklist, { text: newItem.trim(), done: false }] });
                  setNewItem("");
                }
              }}
            />
            <Button
              size="sm"
              aria-label="Add step"
              onClick={() => {
                if (!newItem.trim()) return;
                set({ checklist: [...task.checklist, { text: newItem.trim(), done: false }] });
                setNewItem("");
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div>
        <Label>Depends on</Label>
        <div className="space-y-1">
          {task.dependsOn.map((id) => {
            const d = ws.tasks.find((t) => t.id === id);
            return (
              <div key={id} className="flex items-center justify-between rounded-md bg-panel-2 px-2 py-1 text-sm">
                <span className={d?.status === "completed" ? "text-muted line-through" : ""}>{d?.title ?? "Deleted task"}</span>
                <button type="button" aria-label="Remove dependency" className="cursor-pointer text-muted hover:text-fg" onClick={() => set({ dependsOn: task.dependsOn.filter((x) => x !== id) })}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          <Select value="" onChange={(e) => e.target.value && set({ dependsOn: [...task.dependsOn, e.target.value] })} aria-label="Add dependency">
            <option value="">Add a task this depends on…</option>
            {depCandidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="border-t border-border pt-3 text-xs text-faint">
        Created {new Date(task.createdAt).toLocaleString()}
        {task.completedAt && ` · Completed ${new Date(task.completedAt).toLocaleString()}`}
        {task.postponeCount > 0 && ` · Postponed ${task.postponeCount}×`}
        {task.isDemo && " · Demo data"}
      </div>
    </div>
  );
}
