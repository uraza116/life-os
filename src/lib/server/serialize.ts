import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { parseRecurrence } from "../recurrence";
import type { CategoryDTO, MilestoneDTO, ProjectDTO, SettingsDTO, TaskDTO } from "../types";
import type { TaskStatus } from "../constants";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const taskInclude = {
  checklist: { orderBy: { sortOrder: "asc" } },
  dependencies: { select: { dependsOnId: true } },
} satisfies Prisma.TaskInclude;

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function toTaskDTO(t: TaskRow): TaskDTO {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    notes: t.notes,
    categoryId: t.categoryId,
    subcategoryId: t.subcategoryId,
    projectId: t.projectId,
    milestoneId: t.milestoneId,
    parentId: t.parentId,
    status: t.status as TaskStatus,
    priority: t.priority,
    importance: t.importance,
    urgency: t.urgency,
    impact: t.impact,
    energy: (t.energy as TaskDTO["energy"]) ?? "medium",
    manualScore: t.manualScore,
    pinnedToday: t.pinnedToday,
    myDayDate: t.myDayDate,
    delegatable: t.delegatable,
    startDate: t.startDate,
    dueDate: t.dueDate,
    dueTime: t.dueTime,
    scheduledStart: iso(t.scheduledStart),
    scheduledEnd: iso(t.scheduledEnd),
    estimateMin: t.estimateMin,
    actualMin: t.actualMin,
    tags: parseJson<string[]>(t.tags, []),
    recurrence: parseRecurrence(t.recurrence),
    recurrenceParentId: t.recurrenceParentId,
    waitingOn: t.waitingOn,
    followUpDate: t.followUpDate,
    postponeCount: t.postponeCount,
    sortOrder: t.sortOrder,
    isDemo: t.isDemo,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    completedAt: iso(t.completedAt),
    archivedAt: iso(t.archivedAt),
    deletedAt: iso(t.deletedAt),
    checklist: t.checklist.map((c) => ({ id: c.id, text: c.text, done: c.done, sortOrder: c.sortOrder })),
    dependsOn: t.dependencies.map((d) => d.dependsOnId),
  };
}

export const categoryInclude = { subcategories: { orderBy: { sortOrder: "asc" } } } satisfies Prisma.CategoryInclude;
type CategoryRow = Prisma.CategoryGetPayload<{ include: typeof categoryInclude }>;

export function toCategoryDTO(c: CategoryRow): CategoryDTO {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    importance: c.importance,
    sortOrder: c.sortOrder,
    hidden: c.hidden,
    pinned: c.pinned,
    isDemo: c.isDemo,
    subcategories: c.subcategories.map((s) => ({
      id: s.id,
      categoryId: s.categoryId,
      name: s.name,
      sortOrder: s.sortOrder,
      hidden: s.hidden,
      isDemo: s.isDemo,
    })),
  };
}

type MilestoneRow = Prisma.MilestoneGetPayload<object>;
export function toMilestoneDTO(m: MilestoneRow): MilestoneDTO {
  return {
    id: m.id,
    projectId: m.projectId,
    title: m.title,
    dueDate: m.dueDate,
    weight: m.weight,
    sortOrder: m.sortOrder,
    completedAt: iso(m.completedAt),
    isDemo: m.isDemo,
  };
}

export const projectInclude = { milestones: { orderBy: { sortOrder: "asc" } } } satisfies Prisma.ProjectInclude;
type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

export function toProjectDTO(p: ProjectRow): ProjectDTO {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    priority: p.priority,
    importance: p.importance,
    status: p.status,
    startDate: p.startDate,
    targetDate: p.targetDate,
    notes: p.notes,
    color: p.color,
    icon: p.icon,
    pinned: p.pinned,
    useWeightedMilestones: p.useWeightedMilestones,
    isDemo: p.isDemo,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    archivedAt: iso(p.archivedAt),
    deletedAt: iso(p.deletedAt),
    milestones: p.milestones.map(toMilestoneDTO),
  };
}

type SettingsRow = Prisma.SettingsGetPayload<object>;
export function toSettingsDTO(s: SettingsRow): SettingsDTO {
  return {
    displayName: s.displayName,
    workdayStart: s.workdayStart,
    workdayEnd: s.workdayEnd,
    dailyCapacityMin: s.dailyCapacityMin,
    energyLevel: (s.energyLevel as SettingsDTO["energyLevel"]) ?? "medium",
    weekStartsOn: s.weekStartsOn,
    scoringWeights: parseJson<Record<string, number>>(s.scoringWeights, {}),
    demoLoaded: s.demoLoaded,
  };
}
