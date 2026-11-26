import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/server/http";
import { subcategoryPatch } from "@/lib/validation";

export async function PATCH(req: Request, ctx: RouteContext<"/api/subcategories/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const data = await readJson(req, subcategoryPatch.omit({ id: true }));
    const s = await prisma.subcategory.update({ where: { id }, data });
    return {
      subcategory: { id: s.id, categoryId: s.categoryId, name: s.name, sortOrder: s.sortOrder, hidden: s.hidden, isDemo: s.isDemo },
    };
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/subcategories/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    await prisma.subcategory.delete({ where: { id } });
    return { ok: true };
  });
}
