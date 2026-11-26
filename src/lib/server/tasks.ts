import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "../db";
import { todayKey } from "../dates";
import { nextOccurrence } from "../recurrence";
import type { TaskInput } from "../validation";
import { taskInclude, toTaskDTO } from "./serialize";
import type { TaskDTO } from "../types";

type Patch = Partial<TaskInput>;

/** Scalar fields of a task input mapped to Prisma column values. */
export function taskScalars(input: Patch): Prisma.TaskUncheckedUpdateInput {
  const data: Prisma.TaskUncheckedUpdateInput = {};
  const copy = [
    "title", "description", "notes", "categoryId", "subcategoryId", "projectId", "milestoneId", "parentId",
    "status", "priority", "importance", "urgency", "impact", "energy", "manualScore", "pinnedToday", "myDayDate",
    "delegatable", "startDate", "dueDate", "dueTime", "estimateMin", "actualMin", "waitingOn", "followUpDate",
    "postponeCount", "sortOrder",
  ] as const;
  for (const key of copy) {
    if (input[key] !== undefined) (data as Record<string, unknown>)[key] = input[key];
  }
  if (input.tags !== undefined) data.tags = JSON.stringify(input.tags);
  if (input.recurrence !== undefined) data.recurrence = input.recurrence ? JSON.stringify(input.recurrence) : null;
  if (input.archived !== undefined) data.archivedAt = input.archived ? new Date() : null;
  if (input.deleted !== undefined) data.deletedAt = input.deleted ? new Date() : null;
  return data;
}

async function writeRelations(tx: Prisma.TransactionClient, taskId: string, input: Patch) {
  if (input.checklist) {
    await tx.checklistItem.deleteMany({ where: { taskId } });
    if (input.checklist.length) {
      await tx.checklistItem.createMany({
        data: input.checklist.map((c, i) => ({ taskId, text: c.text, done: c.done, sortOrder: i })),
      });
    }
  }
  if (input.dependsOn) {
    await tx.taskDependency.deleteMany({ where: { taskId } });
    const ids = [...new Set(input.dependsOn)].filter((id) => id !== taskId);
    if (ids.length) {
      const existing = await tx.task.findMany({ where: { id: { in: ids } }, select: { id: true } });
      await tx.taskDependency.createMany({ data: existing.map((d) => ({ taskId, dependsOnId: d.id })) });
    }
  }
}

export async function createTask(input: TaskInput, isDemo = false): Promise<TaskDTO> {
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        ...(taskScalars(input) as Prisma.TaskUncheckedCreateInput),
        ...(input.id ? { id: input.id } : {}),
        title: input.title,
        isDemo,
        completedAt: input.status === "completed" ? new Date() : null,
      },
    });
    await writeRelations(tx, created.id, input);
    return tx.task.findUniqueOrThrow({ where: { id: created.id }, include: taskInclude });
  });
  return toTaskDTO(row);
}

/** Updates a task. Completing a recurring task spawns its next occurrence (returned as `spawned`). */
export async function updateTask(id: string, patch: Patch): Promise<{ task: TaskDTO; spawned?: TaskDTO }> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
    const data = taskScalars(patch);
    const completing = patch.status === "completed" && before.status !== "completed";
    const reopening = patch.status !== undefined && patch.status !== "completed" && before.status === "completed";
    if (completing) data.completedAt = new Date();
    if (reopening) data.completedAt = null;
    // Moving the due date later counts as a postponement (useful for procrastination insights).
    if (patch.dueDate && before.dueDate && patch.dueDate > before.dueDate && patch.postponeCount === undefined) {
      data.postponeCount = before.postponeCount + 1;
    }
    await tx.task.update({ where: { id }, data });
    await writeRelations(tx, id, patch);
    const task = toTaskDTO(await tx.task.findUniqueOrThrow({ where: { id }, include: taskInclude }));

    let spawned: TaskDTO | undefined;
    if (completing && task.recurrence) {
      const base = task.dueDate ?? todayKey();
      let next = nextOccurrence(base, task.recurrence);
      while (next < todayKey()) next = nextOccurrence(next, task.recurrence);
      const startShift = task.startDate && task.dueDate ? daysBetween(task.startDate, task.dueDate) : null;
      const created = await tx.task.create({
        data: {
          title: task.title,
          description: task.description,
          notes: task.notes,
          categoryId: task.categoryId,
          subcategoryId: task.subcategoryId,
          projectId: task.projectId,
          milestoneId: task.milestoneId,
          status: "todo",
          priority: task.priority,
          importance: task.importance,
          urgency: task.urgency,
          impact: task.impact,
          energy: task.energy,
          delegatable: task.delegatable,
          dueDate: next,
          dueTime: task.dueTime,
          startDate: startShift != null ? shiftKey(next, -startShift) : null,
          estimateMin: task.estimateMin,
          tags: JSON.stringify(task.tags),
          recurrence: JSON.stringify(task.recurrence),
          recurrenceParentId: task.recurrenceParentId ?? task.id,
          isDemo: task.isDemo,
          checklist: { create: task.checklist.map((c, i) => ({ text: c.text, done: false, sortOrder: i })) },
        },
        include: taskInclude,
      });
      // The completed instance no longer repeats; the new one carries the rule forward.
      await tx.task.update({ where: { id }, data: { recurrence: null } });
      task.recurrence = null;
      spawned = toTaskDTO(created);
    }
    return { task, spawned };
  });
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
function shiftKey(key: string, days: number) {
  const d = new Date(Date.parse(key) + days * 86400000);
  return d.toISOString().slice(0, 10);
}
