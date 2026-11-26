import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { handle } from "@/lib/server/http";
import { ensureDefaults } from "@/lib/server/seed";
import {
  categoryInclude,
  projectInclude,
  taskInclude,
  toCategoryDTO,
  toDailyNoteDTO,
  toProjectDTO,
  toSavedViewDTO,
  toSettingsDTO,
  toTaskDTO,
} from "@/lib/server/serialize";
import type { Workspace } from "@/lib/types";

export async function GET() {
  await connection();
  return handle(async () => {
    await ensureDefaults();
    const [settings, categories, projects, tasks, views, notes] = await Promise.all([
      prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
      prisma.category.findMany({ include: categoryInclude, orderBy: { sortOrder: "asc" } }),
      prisma.project.findMany({ include: projectInclude, orderBy: { createdAt: "asc" } }),
      prisma.task.findMany({ include: taskInclude, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
      prisma.savedView.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
      prisma.note.findMany({ where: { kind: "daily", deletedAt: null }, orderBy: { date: "desc" } }),
    ]);
    const ws: Workspace = {
      settings: toSettingsDTO(settings),
      categories: categories.map(toCategoryDTO),
      projects: projects.map(toProjectDTO),
      tasks: tasks.map(toTaskDTO),
      views: views.map(toSavedViewDTO),
      dailyNotes: notes.map(toDailyNoteDTO),
    };
    return ws;
  });
}
