"use client";

import { useMemo, useState } from "react";
import { parseQuickAdd } from "@/lib/nlp";
import { formatDue } from "@/lib/dates";
import { describeRecurrence } from "@/lib/recurrence";
import { useStore } from "./store";
import { Button, Input, Modal } from "./ui";

export function QuickAdd() {
  const { quickAdd, closeQuickAdd } = useStore();
  return (
    <Modal open={quickAdd.open} onOpenChange={(v) => !v && closeQuickAdd()} title="Quick add task">
      {quickAdd.open && <QuickAddBody />}
    </Modal>
  );
}

function QuickAddBody() {
  const { ws, quickAdd, closeQuickAdd, createTask, today } = useStore();
  const [text, setText] = useState("");
  const parsed = useMemo(() => (ws && text.trim() ? parseQuickAdd(text, ws.categories, ws.projects) : null), [text, ws]);
  const defaults = quickAdd.defaults ?? {};

  const save = async (keepOpen: boolean) => {
    if (!parsed) return;
    await createTask({
      ...defaults,
      title: parsed.title,
      dueDate: parsed.dueDate ?? defaults.dueDate ?? null,
      dueTime: parsed.dueTime,
      priority: parsed.priority ?? defaults.priority ?? 3,
      categoryId: parsed.categoryId ?? defaults.categoryId ?? null,
      projectId: parsed.projectId ?? defaults.projectId ?? null,
      estimateMin: parsed.estimateMin,
      energy: parsed.energy ?? "medium",
      recurrence: parsed.recurrence,
      tags: parsed.tags,
      // Things captured with no date, category or project land in the Inbox for later triage.
      status: defaults.status ?? (parsed.dueDate || parsed.categoryId || parsed.projectId || defaults.categoryId || defaults.projectId ? "todo" : "inbox"),
      ...(parsed.priority && parsed.priority <= 2 ? { importance: 4 } : {}),
      ...(defaults.pinnedToday ? { pinnedToday: true, myDayDate: today } : {}),
    });
    setText("");
    if (!keepOpen) closeQuickAdd();
  };

  const cat = parsed?.categoryId ? ws?.categories.find((c) => c.id === parsed.categoryId) : undefined;
  const proj = parsed?.projectId ? ws?.projects.find((p) => p.id === parsed.projectId) : undefined;

  return (
    <div className="p-4">
      <Input
        autoFocus
        aria-label="Describe the task"
        className="h-10 text-base"
        placeholder="e.g. Email advisor tomorrow 3pm p1 #phd ~15m"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save(e.shiftKey);
          }
        }}
      />
      <div className="mt-3 min-h-24 rounded-lg border border-border bg-panel-2/50 p-3 text-sm">
        {parsed ? (
          <>
            <div className="text-xs font-medium uppercase tracking-wide text-faint">Preview</div>
            <div className="mt-1 font-medium">{parsed.title}</div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <dt className="text-muted">Due</dt>
              <dd>{parsed.dueDate ? formatDue(parsed.dueDate, parsed.dueTime) + ` (${parsed.dueDate})` : defaults.dueDate ? formatDue(defaults.dueDate) : "—"}</dd>
              <dt className="text-muted">Priority</dt>
              <dd>P{parsed.priority ?? defaults.priority ?? 3}</dd>
              <dt className="text-muted">Category</dt>
              <dd>{cat?.name ?? ws?.categories.find((c) => c.id === defaults.categoryId)?.name ?? "—"}</dd>
              {(proj || defaults.projectId) && (
                <>
                  <dt className="text-muted">Project</dt>
                  <dd>{proj?.name ?? ws?.projects.find((p) => p.id === defaults.projectId)?.name}</dd>
                </>
              )}
              {parsed.estimateMin && (
                <>
                  <dt className="text-muted">Estimate</dt>
                  <dd>{parsed.estimateMin} min</dd>
                </>
              )}
              {parsed.energy && (
                <>
                  <dt className="text-muted">Energy</dt>
                  <dd>{parsed.energy}</dd>
                </>
              )}
              {parsed.recurrence && (
                <>
                  <dt className="text-muted">Repeats</dt>
                  <dd>{describeRecurrence(parsed.recurrence)}</dd>
                </>
              )}
              {parsed.tags.length > 0 && (
                <>
                  <dt className="text-muted">Tags</dt>
                  <dd>{parsed.tags.map((t) => `#${t}`).join(" ")}</dd>
                </>
              )}
            </dl>
          </>
        ) : (
          <div className="text-xs leading-relaxed text-muted">
            Type naturally. Understood: dates (<i>tomorrow, fri 3pm, next week, dec 5</i>), priority (<i>p1–p5, urgent</i>), category (
            <i>#phd, @teaching</i>), project (<i>+dissertation</i>), estimate (<i>~30m, ~2h</i>), energy (<i>high energy</i>), repeat (
            <i>every monday, every month on the 1st</i>) and other <i>#tags</i>.
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-faint">Enter to save · Shift+Enter to save and add another</span>
        <div className="flex gap-2">
          <Button onClick={closeQuickAdd}>Cancel</Button>
          <Button variant="primary" disabled={!parsed} onClick={() => void save(false)}>
            Add task
          </Button>
        </div>
      </div>
    </div>
  );
}
