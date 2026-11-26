/** Client-side task selection, filtering, sorting and dashboard statistics. Pure functions. */
import { isOpenStatus } from "./constants";
import { addDaysKey, daysUntil, todayKey } from "./dates";
import type { ScoreResult } from "./scoring";
import type { TaskDTO, TaskFilter } from "./types";

export const isLive = (t: TaskDTO) => !t.deletedAt && !t.archivedAt;
export const isOpen = (t: TaskDTO) => isLive(t) && isOpenStatus(t.status);
export const isDone = (t: TaskDTO) => isLive(t) && t.status === "completed";
export const isOverdue = (t: TaskDTO, today = todayKey()) => isOpen(t) && !!t.dueDate && t.dueDate < today;
export const isOnMyDay = (t: TaskDTO, today = todayKey()) =>
  isOpen(t) && ((t.pinnedToday && t.myDayDate === today) || t.dueDate === today);

export type SortKey = "score" | "due" | "priority" | "created" | "title" | "estimate";
export const SORT_LABEL: Record<SortKey, string> = {
  score: "Priority score",
  due: "Due date",
  priority: "Priority level",
  created: "Newest first",
  title: "Title",
  estimate: "Shortest first",
};

export function matchesFilter(t: TaskDTO, f: TaskFilter, today = todayKey()): boolean {
  if (!f.includeCompleted && !isOpenStatus(t.status)) return false;
  if (f.search) {
    const q = f.search.toLowerCase();
    const hay = `${t.title} ${t.description} ${t.notes} ${t.tags.join(" ")}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.categoryIds?.length && !f.categoryIds.includes(t.categoryId ?? "__none")) return false;
  if (f.projectIds?.length && !f.projectIds.includes(t.projectId ?? "__none")) return false;
  if (f.priorities?.length && !f.priorities.includes(t.priority)) return false;
  if (f.statuses?.length && !f.statuses.includes(t.status)) return false;
  if (f.energy?.length && !f.energy.includes(t.energy)) return false;
  if (f.maxMinutes != null && (t.estimateMin == null || t.estimateMin > f.maxMinutes)) return false;
  if (f.tag && !t.tags.includes(f.tag)) return false;
  if (f.highPriority && t.priority > 2) return false;
  if (f.waiting && t.status !== "waiting") return false;
  if (f.due && f.due !== "any") {
    const d = t.dueDate;
    switch (f.due) {
      case "none":
        if (d) return false;
        break;
      case "overdue":
        if (!d || d >= today) return false;
        break;
      case "today":
        if (d !== today) return false;
        break;
      case "tomorrow":
        if (d !== addDaysKey(today, 1)) return false;
        break;
      case "week":
      case "next7":
        if (!d || d < today || d > addDaysKey(today, 7)) return false;
        break;
      case "next30":
        if (!d || d < today || d > addDaysKey(today, 30)) return false;
        break;
    }
  }
  return true;
}

export function sortTasks(tasks: TaskDTO[], key: SortKey, scores: Map<string, ScoreResult>): TaskDTO[] {
  const s = (t: TaskDTO) => scores.get(t.id)?.score ?? 0;
  const due = (t: TaskDTO) => (t.dueDate ? t.dueDate + (t.dueTime ?? "99:99") : "9999-99-99");
  const copy = [...tasks];
  switch (key) {
    case "score":
      return copy.sort((a, b) => s(b) - s(a) || due(a).localeCompare(due(b)));
    case "due":
      return copy.sort((a, b) => due(a).localeCompare(due(b)) || s(b) - s(a));
    case "priority":
      return copy.sort((a, b) => a.priority - b.priority || s(b) - s(a));
    case "created":
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "title":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case "estimate":
      return copy.sort((a, b) => (a.estimateMin ?? 9999) - (b.estimateMin ?? 9999));
  }
}

export function projectProgress(projectId: string, tasks: TaskDTO[], milestones: { weight: number; completedAt: string | null }[], weighted: boolean) {
  const own = tasks.filter((t) => t.projectId === projectId && isLive(t) && t.status !== "cancelled" && !t.parentId);
  const done = own.filter((t) => t.status === "completed").length;
  if (weighted && milestones.length) {
    const total = milestones.reduce((a, m) => a + m.weight, 0);
    const got = milestones.filter((m) => m.completedAt).reduce((a, m) => a + m.weight, 0);
    return { pct: total ? Math.round((got / total) * 100) : 0, done, total: own.length };
  }
  return { pct: own.length ? Math.round((done / own.length) * 100) : 0, done, total: own.length };
}

/** Counts of completed tasks per day for the last `days` days (oldest first). */
export function completionSeries(tasks: TaskDTO[], days = 14, today = todayKey()) {
  const out: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ date: addDaysKey(today, -i), count: 0 });
  const idx = new Map(out.map((o, i) => [o.date, i]));
  for (const t of tasks) {
    if (!t.completedAt || t.deletedAt) continue;
    const d = new Date(t.completedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const i = idx.get(key);
    if (i !== undefined) out[i].count++;
  }
  return out;
}

export const dueIn = (t: TaskDTO) => (t.dueDate ? daysUntil(t.dueDate) : null);
