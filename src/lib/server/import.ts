import "server-only";
import { z } from "zod";
import { prisma } from "../db";
import { recurrenceSchema } from "../validation";

/**
 * JSON import for files produced by GET /api/export?format=json.
 * - "merge": upserts every row by id, so re-importing the same file is harmless.
 * - "replace": deletes all categories, projects and tasks first, then imports.
 * Everything runs in one transaction: a bad file changes nothing.
 */

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const instant = z.string().nullable().optional();

const sub = z.object({ id: z.string(), name: z.string(), sortOrder: z.number().int().optional(), hidden: z.boolean().optional(), isDemo: z.boolean().optional() });
const category = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string().optional(),
  icon: z.string().optional(),
  importance: z.number().int().min(1).max(5).optional(),
  sortOrder: z.number().int().optional(),
  hidden: z.boolean().optional(),
  pinned: z.boolean().optional(),
  isDemo: z.boolean().optional(),
  subcategories: z.array(sub).optional(),
});
const milestone = z.object({
  id: z.string(),
  title: z.string().min(1),
  dueDate: date,
  weight: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
  completedAt: instant,
  isDemo: z.boolean().optional(),
});
const project = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  importance: z.number().int().min(1).max(5).optional(),
  status: z.string().optional(),
  startDate: date,
  targetDate: date,
  notes: z.string().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().optional(),
  pinned: z.boolean().optional(),
  useWeightedMilestones: z.boolean().optional(),
  isDemo: z.boolean().optional(),
  createdAt: instant,
  archivedAt: instant,
  deletedAt: instant,
  milestones: z.array(milestone).optional(),
});
const task = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  notes: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  subcategoryId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  status: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  importance: z.number().int().min(1).max(5).optional(),
  urgency: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  energy: z.string().optional(),
  manualScore: z.number().int().min(0).max(100).nullable().optional(),
  pinnedToday: z.boolean().optional(),
  myDayDate: date,
  delegatable: z.boolean().optional(),
  startDate: date,
  dueDate: date,
  dueTime: z.string().nullable().optional(),
  estimateMin: z.number().int().nullable().optional(),
  actualMin: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  recurrence: recurrenceSchema.nullable().optional(),
  recurrenceParentId: z.string().nullable().optional(),
  waitingOn: z.string().nullable().optional(),
  followUpDate: date,
  postponeCount: z.number().int().optional(),
  sortOrder: z.number().optional(),
  isDemo: z.boolean().optional(),
  createdAt: instant,
  completedAt: instant,
  archivedAt: instant,
  deletedAt: instant,
  checklist: z.array(z.object({ text: z.string(), done: z.boolean() })).optional(),
  dependsOn: z.array(z.string()).optional(),
});
const view = z.object({ id: z.string(), name: z.string(), filters: z.record(z.string(), z.unknown()).optional(), sort: z.string().optional(), pinned: z.boolean().optional() });
const note = z.object({ date: z.string(), content: z.string() });

export const importFile = z.object({
  app: z.literal("life-os"),
  version: z.number().int().min(1).max(1),
  settings: z
    .object({
      displayName: z.string().optional(),
      workdayStart: z.string().optional(),
      workdayEnd: z.string().optional(),
      dailyCapacityMin: z.number().int().optional(),
      energyLevel: z.string().optional(),
      weekStartsOn: z.number().int().optional(),
      scoringWeights: z.record(z.string(), z.number()).optional(),
    })
    .nullable()
    .optional(),
  categories: z.array(category).default([]),
  projects: z.array(project).default([]),
  tasks: z.array(task).default([]),
  views: z.array(view).default([]),
  dailyNotes: z.array(note).default([]),
});
export const importBody = z.object({ mode: z.enum(["merge", "replace"]), data: importFile });

const toDate = (s: string | null | undefined) => (s ? new Date(s) : null);

export async function runImport(mode: "merge" | "replace", data: z.infer<typeof importFile>) {
  return prisma.$transaction(
    async (tx) => {
      if (mode === "replace") {
        await tx.task.deleteMany({});
        await tx.milestone.deleteMany({});
        await tx.project.deleteMany({});
        await tx.subcategory.deleteMany({});
        await tx.category.deleteMany({});
        await tx.savedView.deleteMany({});
        await tx.note.deleteMany({ where: { kind: "daily" } });
      }

      for (const c of data.categories) {
        const { subcategories, id, ...fields } = c;
        await tx.category.upsert({ where: { id }, create: { id, ...fields }, update: fields });
        for (const s of subcategories ?? []) {
          const { id: sid, ...sf } = s;
          await tx.subcategory.upsert({ where: { id: sid }, create: { id: sid, categoryId: id, ...sf }, update: { categoryId: id, ...sf } });
        }
      }
      const catIds = new Set((await tx.category.findMany({ select: { id: true } })).map((c) => c.id));
      const subIds = new Set((await tx.subcategory.findMany({ select: { id: true } })).map((s) => s.id));

      for (const p of data.projects) {
        const { milestones, id, createdAt, archivedAt, deletedAt, categoryId, ...fields } = p;
        const row = {
          ...fields,
          categoryId: categoryId && catIds.has(categoryId) ? categoryId : null,
          archivedAt: toDate(archivedAt),
          deletedAt: toDate(deletedAt),
        };
        await tx.project.upsert({ where: { id }, create: { id, ...row, ...(createdAt ? { createdAt: new Date(createdAt) } : {}) }, update: row });
        for (const m of milestones ?? []) {
          const { id: mid, completedAt, ...mf } = m;
          const mrow = { ...mf, projectId: id, completedAt: toDate(completedAt) };
          await tx.milestone.upsert({ where: { id: mid }, create: { id: mid, ...mrow }, update: mrow });
        }
      }
      const projIds = new Set((await tx.project.findMany({ select: { id: true } })).map((p) => p.id));
      const msIds = new Set((await tx.milestone.findMany({ select: { id: true } })).map((m) => m.id));

      // Pass 1: tasks without parent links (a parent may appear later in the file).
      for (const t of data.tasks) {
        const { id, checklist, dependsOn, parentId, tags, recurrence, createdAt, completedAt, archivedAt, deletedAt, categoryId, subcategoryId, projectId, milestoneId, ...fields } = t;
        void dependsOn;
        void parentId;
        const row = {
          ...fields,
          categoryId: categoryId && catIds.has(categoryId) ? categoryId : null,
          subcategoryId: subcategoryId && subIds.has(subcategoryId) ? subcategoryId : null,
          projectId: projectId && projIds.has(projectId) ? projectId : null,
          milestoneId: milestoneId && msIds.has(milestoneId) ? milestoneId : null,
          tags: JSON.stringify(tags ?? []),
          recurrence: recurrence ? JSON.stringify(recurrence) : null,
          completedAt: toDate(completedAt),
          archivedAt: toDate(archivedAt),
          deletedAt: toDate(deletedAt),
        };
        await tx.task.upsert({ where: { id }, create: { id, ...row, ...(createdAt ? { createdAt: new Date(createdAt) } : {}) }, update: row });
        if (checklist) {
          await tx.checklistItem.deleteMany({ where: { taskId: id } });
          if (checklist.length) await tx.checklistItem.createMany({ data: checklist.map((c, i) => ({ taskId: id, text: c.text, done: c.done, sortOrder: i })) });
        }
      }
      const taskIds = new Set((await tx.task.findMany({ select: { id: true } })).map((t) => t.id));

      // Pass 2: parent links and dependencies, now that every task exists.
      for (const t of data.tasks) {
        if (t.parentId && taskIds.has(t.parentId) && t.parentId !== t.id) {
          await tx.task.update({ where: { id: t.id }, data: { parentId: t.parentId } });
        }
        if (t.dependsOn) {
          await tx.taskDependency.deleteMany({ where: { taskId: t.id } });
          const deps = [...new Set(t.dependsOn)].filter((d) => d !== t.id && taskIds.has(d));
          if (deps.length) await tx.taskDependency.createMany({ data: deps.map((d) => ({ taskId: t.id, dependsOnId: d })) });
        }
      }

      for (const v of data.views) {
        const row = { name: v.name, filters: JSON.stringify(v.filters ?? {}), sort: v.sort ?? "score", pinned: v.pinned ?? false };
        await tx.savedView.upsert({ where: { id: v.id }, create: { id: v.id, ...row }, update: row });
      }
      for (const n of data.dailyNotes) {
        const existing = await tx.note.findFirst({ where: { kind: "daily", date: n.date, deletedAt: null } });
        if (existing) await tx.note.update({ where: { id: existing.id }, data: { content: n.content } });
        else await tx.note.create({ data: { kind: "daily", date: n.date, content: n.content } });
      }

      if (data.settings) {
        const { scoringWeights, ...s } = data.settings;
        const row = { ...s, ...(scoringWeights ? { scoringWeights: JSON.stringify(scoringWeights) } : {}) };
        await tx.settings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...row }, update: row });
      }
      const demoLeft = await tx.task.count({ where: { isDemo: true } });
      await tx.settings.upsert({ where: { id: "singleton" }, create: { id: "singleton", demoLoaded: demoLeft > 0 }, update: { demoLoaded: demoLeft > 0 } });

      return { categories: data.categories.length, projects: data.projects.length, tasks: data.tasks.length, views: data.views.length, notes: data.dailyNotes.length };
    },
    { timeout: 120_000 },
  );
}
