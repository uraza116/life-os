import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { handle } from "@/lib/server/http";
import { ensureDefaults } from "@/lib/server/seed";
import {
  categoryInclude,
  projectInclude,
  taskInclude,
  toCategoryDTO,
  toProjectDTO,
  toSettingsDTO,
  toTaskDTO,
} from "@/lib/server/serialize";
import type { Workspace } from "@/lib/types";

export async function GET() {
  await connection();
  return handle(async () => {
    await ensureDefaults();
    const [settings, categories, projects, tasks] = await Promise.all([
      prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
      prisma.category.findMany({ include: categoryInclude, orderBy: { sortOrder: "asc" } }),
      prisma.project.findMany({ include: projectInclude, orderBy: { createdAt: "asc" } }),
      prisma.task.findMany({ include: taskInclude, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    ]);
    const ws: Workspace = {
      settings: toSettingsDTO(settings),
      categories: categories.map(toCategoryDTO),
      projects: projects.map(toProjectDTO),
      tasks: tasks.map(toTaskDTO),
      views: [],
      dailyNotes: [],
    };
    return ws;
  });
}
