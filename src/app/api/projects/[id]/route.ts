import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/server/http";
import { projectInclude, toProjectDTO } from "@/lib/server/serialize";
import { projectPatch } from "@/lib/validation";

export async function PATCH(req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const { archived, deleted, ...rest } = await readJson(req, projectPatch.omit({ id: true }));
    const data: Record<string, unknown> = { ...rest };
    if (archived !== undefined) data.archivedAt = archived ? new Date() : null;
    if (deleted !== undefined) data.deletedAt = deleted ? new Date() : null;
    const row = await prisma.project.update({ where: { id }, data, include: projectInclude });
    return { project: toProjectDTO(row) };
  });
}

/** Permanently deletes a project; its tasks stay, unlinked. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    await prisma.project.delete({ where: { id } });
    return { ok: true };
  });
}
