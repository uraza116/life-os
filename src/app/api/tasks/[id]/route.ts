import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/server/http";
import { updateTask } from "@/lib/server/tasks";
import { taskPatch } from "@/lib/validation";

export async function PATCH(req: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => updateTask(id, await readJson(req, taskPatch)));
}

/** Permanently deletes a task (soft delete is a PATCH with `deleted: true`). */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    await prisma.task.delete({ where: { id } });
    return { ok: true };
  });
}
