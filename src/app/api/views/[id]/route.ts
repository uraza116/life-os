import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/server/http";
import { toSavedViewDTO } from "@/lib/server/serialize";
import { savedViewPatch } from "@/lib/validation";

export async function PATCH(req: Request, ctx: RouteContext<"/api/views/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const { filters, ...rest } = await readJson(req, savedViewPatch);
    const v = await prisma.savedView.update({
      where: { id },
      data: { ...rest, ...(filters ? { filters: JSON.stringify(filters) } : {}) },
    });
    return { view: toSavedViewDTO(v) };
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/views/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    await prisma.savedView.delete({ where: { id } });
    return { ok: true };
  });
}
