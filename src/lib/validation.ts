import { z } from "zod";
import { CATEGORY_COLORS, ENERGY_LEVELS, PROJECT_STATUSES, TASK_STATUSES } from "./constants";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const timeKey = z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm");
const level = z.number().int().min(1).max(5);

export const recurrenceSchema = z.object({
  freq: z.enum(["daily", "weekdays", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).max(365),
  byWeekday: z.array(z.number().int().min(0).max(6)).optional(),
  byMonthDay: z.number().int().min(-1).max(31).optional(),
});

export const taskInput = z.object({
  id: z.string().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(20000).optional(),
  notes: z.string().max(20000).optional(),
  categoryId: z.string().nullable().optional(),
  subcategoryId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: level.optional(),
  importance: level.optional(),
  urgency: level.optional(),
  impact: level.optional(),
  energy: z.enum(ENERGY_LEVELS).optional(),
  manualScore: z.number().int().min(0).max(100).nullable().optional(),
  pinnedToday: z.boolean().optional(),
  myDayDate: dateKey.nullable().optional(),
  delegatable: z.boolean().optional(),
  startDate: dateKey.nullable().optional(),
  dueDate: dateKey.nullable().optional(),
  dueTime: timeKey.nullable().optional(),
  estimateMin: z.number().int().min(0).max(100000).nullable().optional(),
  actualMin: z.number().int().min(0).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  recurrence: recurrenceSchema.nullable().optional(),
  waitingOn: z.string().max(200).nullable().optional(),
  followUpDate: dateKey.nullable().optional(),
  postponeCount: z.number().int().min(0).optional(),
  sortOrder: z.number().optional(),
  checklist: z
    .array(z.object({ id: z.string().optional(), text: z.string().max(500), done: z.boolean() }))
    .max(200)
    .optional(),
  dependsOn: z.array(z.string()).max(50).optional(),
  archived: z.boolean().optional(),
  deleted: z.boolean().optional(),
});
export type TaskInput = z.infer<typeof taskInput>;
export const taskPatch = taskInput.partial();

export const bulkInput = z.object({
  ids: z.array(z.string()).min(1).max(1000),
  action: z.enum(["update", "complete", "reopen", "delete", "restore", "purge", "archive", "unarchive"]),
  patch: taskPatch.omit({ id: true, checklist: true, dependsOn: true }).optional(),
});

export const categoryInput = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(80),
  color: z.enum(CATEGORY_COLORS).optional(),
  icon: z.string().max(40).optional(),
  importance: level.optional(),
  sortOrder: z.number().int().optional(),
  hidden: z.boolean().optional(),
  pinned: z.boolean().optional(),
});
export const categoryPatch = categoryInput.partial();

export const subcategoryInput = z.object({
  id: z.string().min(1).max(64).optional(),
  categoryId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().optional(),
  hidden: z.boolean().optional(),
});
export const subcategoryPatch = subcategoryInput.partial().omit({ categoryId: true });

export const projectInput = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(20000).optional(),
  categoryId: z.string().nullable().optional(),
  priority: level.optional(),
  importance: level.optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  startDate: dateKey.nullable().optional(),
  targetDate: dateKey.nullable().optional(),
  notes: z.string().max(50000).optional(),
  color: z.string().max(20).nullable().optional(),
  pinned: z.boolean().optional(),
  useWeightedMilestones: z.boolean().optional(),
  archived: z.boolean().optional(),
  deleted: z.boolean().optional(),
});
export const projectPatch = projectInput.partial();

export const milestoneInput = z.object({
  id: z.string().min(1).max(64).optional(),
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  dueDate: dateKey.nullable().optional(),
  weight: z.number().int().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  completed: z.boolean().optional(),
});
export const milestonePatch = milestoneInput.partial().omit({ projectId: true });

export const settingsPatch = z.object({
  displayName: z.string().max(80).optional(),
  workdayStart: timeKey.optional(),
  workdayEnd: timeKey.optional(),
  dailyCapacityMin: z.number().int().min(0).max(1440).optional(),
  energyLevel: z.enum(ENERGY_LEVELS).optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  scoringWeights: z.record(z.string(), z.number().min(0).max(100)).optional(),
});

export const taskFilterSchema = z.object({
  search: z.string().max(200).optional(),
  categoryIds: z.array(z.string()).max(50).optional(),
  projectIds: z.array(z.string()).max(50).optional(),
  priorities: z.array(z.number().int().min(1).max(5)).optional(),
  statuses: z.array(z.enum(TASK_STATUSES)).optional(),
  energy: z.array(z.enum(ENERGY_LEVELS)).optional(),
  maxMinutes: z.number().int().min(0).optional(),
  due: z.enum(["overdue", "today", "tomorrow", "week", "next7", "next30", "none", "any"]).optional(),
  tag: z.string().max(50).optional(),
  highPriority: z.boolean().optional(),
  waiting: z.boolean().optional(),
  includeCompleted: z.boolean().optional(),
});

export const SORT_KEYS = ["score", "due", "priority", "created", "title", "estimate"] as const;

export const savedViewInput = z.object({
  name: z.string().trim().min(1).max(60),
  filters: taskFilterSchema,
  sort: z.enum(SORT_KEYS),
  pinned: z.boolean().optional(),
});
export const savedViewPatch = savedViewInput.partial();

export const dailyNoteInput = z.object({
  date: dateKey,
  content: z.string().max(100000),
});
