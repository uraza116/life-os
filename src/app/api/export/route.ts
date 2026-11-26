import { connection, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { todayKey } from "@/lib/dates";
import { handle } from "@/lib/server/http";
import {
  categoryInclude,
  projectInclude,
  taskInclude,
  toCategoryDTO,
  toProjectDTO,
  toSettingsDTO,
  toTaskDTO,
} from "@/lib/server/serialize";

const csvCell = (v: unknown) => {
  const s = v == null ? "" : Array.isArray(v) ? v.join("; ") : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  await connection();
  return handle(async () => {
    const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
    const [settings, categories, projects, tasks] = await Promise.all([
      prisma.settings.findUnique({ where: { id: "singleton" } }),
      prisma.category.findMany({ include: categoryInclude, orderBy: { sortOrder: "asc" } }),
      prisma.project.findMany({ include: projectInclude }),
      prisma.task.findMany({ include: taskInclude, orderBy: { createdAt: "asc" } }),
    ]);
    const stamp = todayKey();
    if (format === "json") {
      const body = JSON.stringify(
        {
          app: "life-os",
          version: 1,
          exportedAt: new Date().toISOString(),
          settings: settings ? toSettingsDTO(settings) : null,
          categories: categories.map(toCategoryDTO),
          projects: projects.map(toProjectDTO),
          tasks: tasks.map(toTaskDTO),
        },
        null,
        2,
      );
      return new Response(body, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="life-os-export-${stamp}.json"`,
        },
      });
    }
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const projName = new Map(projects.map((p) => [p.id, p.name]));
    const header = [
      "id", "title", "status", "priority", "importance", "urgency", "impact", "category", "project", "startDate",
      "dueDate", "dueTime", "estimateMin", "energy", "tags", "createdAt", "completedAt", "archived", "deleted", "description",
    ];
    const lines = [header.join(",")];
    for (const row of tasks) {
      const t = toTaskDTO(row);
      lines.push(
        [
          t.id, t.title, t.status, t.priority, t.importance, t.urgency, t.impact,
          t.categoryId ? catName.get(t.categoryId) : "", t.projectId ? projName.get(t.projectId) : "",
          t.startDate, t.dueDate, t.dueTime, t.estimateMin, t.energy, t.tags, t.createdAt, t.completedAt,
          t.archivedAt ? "yes" : "", t.deletedAt ? "yes" : "", t.description,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    return new Response("﻿" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="life-os-tasks-${stamp}.csv"`,
      },
    });
  });
}
