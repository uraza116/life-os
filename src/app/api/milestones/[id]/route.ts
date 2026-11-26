import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/server/http";
import { toMilestoneDTO } from "@/lib/server/serialize";
import { milestonePatch } from "@/lib/validation";

export async function PATCH(req: Request, ctx: RouteContext<"/api/milestones/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const { completed, ...rest } = await readJson(req, milestonePatch.omit({ id: true }));
    const data: Record<string, unknown> = { ...rest };
    if (completed !== undefined) data.completedAt = completed ? new Date() : null;
    const m = await prisma.milestone.update({ where: { id }, data });
    return { milestone: toMilestoneDTO(m) };
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/milestones/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    await prisma.milestone.delete({ where: { id } });
    return { ok: true };
  });
}
