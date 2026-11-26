/**
 * Transparent task prioritization engine.
 *
 * Each factor yields a value in [0, 1] which is multiplied by its weight. Base weights sum to 100,
 * so the raw score is already on a 0–100 scale. Modifiers (status, dependencies, someday) are
 * applied afterwards and every contribution is recorded so the UI can explain the result.
 *
 * Design rule from the spec: overdue low-value tasks must not consistently outrank strategically
 * important work. The overdue boost is therefore capped (max 7 days counted) and scaled by the
 * task's importance.
 */
import { isOpenStatus } from "./constants";
import { daysUntil, todayKey } from "./dates";
import type { CategoryDTO, ProjectDTO, TaskDTO } from "./types";

export const DEFAULT_WEIGHTS = {
  deadline: 24,
  importance: 20,
  priority: 15,
  urgency: 11,
  impact: 10,
  context: 8, // project / category importance
  effort: 5, // quick-win bonus
  energy: 4, // fit with current energy
  unblocks: 3, // other tasks depend on this one
  overdue: 10, // bonus on top, capped and scaled by importance
} as const;
export type Weights = Record<keyof typeof DEFAULT_WEIGHTS, number>;

export const WEIGHT_LABELS: Record<keyof Weights, string> = {
  deadline: "Deadline proximity",
  importance: "Importance",
  priority: "Assigned priority",
  urgency: "Urgency",
  impact: "Potential impact",
  context: "Project & category importance",
  effort: "Quick-win (low effort)",
  energy: "Energy fit",
  unblocks: "Unblocks other tasks",
  overdue: "Overdue boost (capped)",
};

export type Bucket = "do_now" | "do_today" | "this_week" | "later" | "delegate" | "eliminate";
export const BUCKET_LABEL: Record<Bucket, string> = {
  do_now: "Do Now",
  do_today: "Do Today",
  this_week: "Schedule This Week",
  later: "Do Later",
  delegate: "Delegate",
  eliminate: "Consider Eliminating",
};

export type Quadrant = "do" | "schedule" | "delegate" | "eliminate";
export const QUADRANT_LABEL: Record<Quadrant, string> = {
  do: "Urgent & important",
  schedule: "Important, not urgent",
  delegate: "Urgent, not important",
  eliminate: "Neither urgent nor important",
};

export type Factor = { key: string; label: string; points: number };

export type ScoreResult = {
  score: number;
  computed: number;
  manual: boolean;
  bucket: Bucket;
  quadrant: Quadrant;
  reasons: string[];
  factors: Factor[];
  blockedBy: string[];
};

export type ScoreContext = {
  today?: string;
  energy: "low" | "medium" | "high";
  availableMin?: number;
  weights?: Partial<Weights>;
  categories: Map<string, CategoryDTO>;
  projects: Map<string, ProjectDTO>;
  tasks: Map<string, TaskDTO>;
  dependentsCount: Map<string, number>;
};

const lin = (v: number) => Math.min(1, Math.max(0, (v - 1) / 4)); // 1..5 → 0..1

export function buildScoreContext(
  tasks: TaskDTO[],
  categories: CategoryDTO[],
  projects: ProjectDTO[],
  energy: "low" | "medium" | "high",
  weights?: Partial<Weights>,
  availableMin?: number,
): ScoreContext {
  const dependentsCount = new Map<string, number>();
  for (const t of tasks) {
    if (!isOpenStatus(t.status) || t.deletedAt) continue;
    for (const d of t.dependsOn) dependentsCount.set(d, (dependentsCount.get(d) ?? 0) + 1);
  }
  return {
    energy,
    weights,
    availableMin,
    categories: new Map(categories.map((c) => [c.id, c])),
    projects: new Map(projects.map((p) => [p.id, p])),
    tasks: new Map(tasks.map((t) => [t.id, t])),
    dependentsCount,
  };
}

export function scoreTask(task: TaskDTO, ctx: ScoreContext): ScoreResult {
  const w: Weights = { ...DEFAULT_WEIGHTS, ...(ctx.weights ?? {}) };
  const today = ctx.today ?? todayKey();
  const factors: Factor[] = [];
  const reasons: string[] = [];
  const add = (key: keyof Weights, value: number) => {
    const points = value * w[key];
    if (points > 0.05) factors.push({ key, label: WEIGHT_LABELS[key], points: Math.round(points * 10) / 10 });
    return points;
  };

  let raw = 0;

  // Deadline proximity
  const due = task.dueDate ? daysUntil(task.dueDate, today) : null;
  if (due !== null) {
    const v = due <= 0 ? 1 : 1 / (1 + due / 3);
    raw += add("deadline", v);
    if (due < 0) reasons.push(`Overdue by ${-due} day${due === -1 ? "" : "s"}`);
    else if (due === 0) reasons.push(task.dueTime ? "Due today at a set time" : "Due today");
    else if (due === 1) reasons.push("Due tomorrow");
    else if (due <= 7) reasons.push(`Due in ${due} days`);
  }

  // Overdue boost: capped at 7 days and scaled by importance so low-value overdue work can't dominate.
  if (due !== null && due < 0) {
    const capped = Math.min(-due, 7) / 7;
    raw += add("overdue", capped * lin(task.importance) * 0.9 + capped * 0.1);
  }

  raw += add("importance", lin(task.importance));
  if (task.importance >= 4) reasons.push(task.importance === 5 ? "Very high importance" : "High importance");

  raw += add("priority", (5 - task.priority) / 4);
  if (task.priority <= 2) reasons.push(task.priority === 1 ? "Marked P1 critical" : "Marked P2 high");

  raw += add("urgency", lin(task.urgency));
  raw += add("impact", lin(task.impact));
  if (task.impact >= 4) reasons.push("High potential impact");

  // Context: project & category importance
  const project = task.projectId ? ctx.projects.get(task.projectId) : undefined;
  const category = task.categoryId ? ctx.categories.get(task.categoryId) : undefined;
  const ctxVals = [project ? lin(project.importance) : null, category ? lin(category.importance) : null].filter(
    (v): v is number => v !== null,
  );
  if (ctxVals.length) {
    raw += add("context", Math.max(...ctxVals));
    if (project && project.importance >= 4) reasons.push(`Part of key project "${project.name}"`);
  }

  // Effort: smaller tasks get a quick-win bonus
  const est = task.estimateMin;
  const effortV = est == null ? 0.4 : est <= 15 ? 1 : est <= 30 ? 0.8 : est <= 60 ? 0.6 : est <= 120 ? 0.35 : 0.15;
  raw += add("effort", effortV);
  if (est != null && est <= 15) reasons.push(`Quick win (${est} min)`);

  // Energy fit
  const levels = { low: 0, medium: 1, high: 2 } as const;
  const gap = levels[task.energy] - levels[ctx.energy];
  const energyV = gap <= 0 ? 1 - Math.abs(gap) * 0.25 : gap === 1 ? 0.3 : 0;
  raw += add("energy", energyV);
  if (gap === 0 && ctx.energy === "high" && task.energy === "high") reasons.push("Matches your high energy");

  // Unblocks others
  const dependents = ctx.dependentsCount.get(task.id) ?? 0;
  if (dependents) {
    raw += add("unblocks", Math.min(1, dependents / 3));
    reasons.push(`Unblocks ${dependents} task${dependents > 1 ? "s" : ""}`);
  }

  // ---- Modifiers
  let multiplier = 1;
  const blockedBy = task.dependsOn.filter((id) => {
    const dep = ctx.tasks.get(id);
    return dep && isOpenStatus(dep.status) && !dep.deletedAt;
  });
  if (blockedBy.length) {
    multiplier *= 0.5;
    reasons.unshift(`Waiting on ${blockedBy.length} unfinished dependenc${blockedBy.length > 1 ? "ies" : "y"}`);
  }
  if (task.status === "waiting" || task.status === "blocked" || task.status === "on_hold") {
    multiplier *= 0.6;
  }
  if (task.startDate && daysUntil(task.startDate, today) > 0) {
    multiplier *= 0.6;
    reasons.push("Not started yet (start date in future)");
  }
  if (ctx.availableMin != null && est != null && est > ctx.availableMin) {
    multiplier *= 0.85;
  }

  let computed = Math.round(Math.min(100, raw * multiplier));
  if (task.priority === 5) computed = Math.min(computed, 35); // someday items stay out of the way

  const manual = task.manualScore != null;
  const score = manual ? Math.max(0, Math.min(100, task.manualScore!)) : computed;
  if (manual) reasons.unshift("Score manually set by you");

  factors.sort((a, b) => b.points - a.points);

  // Eisenhower
  const important = task.importance >= 4 || task.priority <= 2;
  const urgent = task.urgency >= 4 || (due !== null && due <= 2);
  const quadrant: Quadrant = important && urgent ? "do" : important ? "schedule" : urgent ? "delegate" : "eliminate";

  // Action bucket
  let bucket: Bucket;
  if (task.delegatable && task.importance <= 3) bucket = "delegate";
  else if (task.priority === 5 || (task.importance <= 2 && task.urgency <= 2 && task.impact <= 2 && (due === null || due > 14)))
    bucket = "eliminate";
  else if (score >= 72 || (due !== null && due <= 0 && important)) bucket = "do_now";
  else if (score >= 58 || (due !== null && due <= 0)) bucket = "do_today";
  else if (score >= 40 || (due !== null && due <= 7)) bucket = "this_week";
  else bucket = "later";

  return { score, computed, manual, bucket, quadrant, reasons: reasons.slice(0, 4), factors, blockedBy };
}
