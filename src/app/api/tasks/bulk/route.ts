import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/server/http";
import { taskInclude, toTaskDTO } from "@/lib/server/serialize";
import { taskScalars, updateTask } from "@/lib/server/tasks";
import { bulkInput } from "@/lib/validation";
import type { Prisma } from "@/generated/prisma/client";
import type { TaskDTO } from "@/lib/types";

export async function POST(req: Request) {
  return handle(async () => {
    const { ids, action, patch } = await readJson(req, bulkInput);
    const where = { id: { in: ids } };
    const spawned: TaskDTO[] = [];
    switch (action) {
      case "update":
        await prisma.task.updateMany({ where, data: taskScalars(patch ?? {}) as Prisma.TaskUncheckedUpdateManyInput });
        break;
      case "complete":
        // One by one so recurring tasks spawn their next occurrence.
        for (const id of ids) {
          const r = await updateTask(id, { status: "completed" });
          if (r.spawned) spawned.push(r.spawned);
        }
        break;
      case "reopen":
        await prisma.task.updateMany({ where, data: { status: "todo", completedAt: null } });
        break;
      case "delete":
        await prisma.task.updateMany({ where, data: { deletedAt: new Date() } });
        break;
      case "restore":
        await prisma.task.updateMany({ where, data: { deletedAt: null } });
        break;
      case "archive":
        await prisma.task.updateMany({ where, data: { archivedAt: new Date() } });
        break;
      case "unarchive":
        await prisma.task.updateMany({ where, data: { archivedAt: null } });
        break;
      case "purge":
        await prisma.task.deleteMany({ where });
        return { tasks: [], removed: ids, spawned };
    }
    const rows = await prisma.task.findMany({ where, include: taskInclude });
    return { tasks: rows.map(toTaskDTO), removed: [], spawned };
  });
}
