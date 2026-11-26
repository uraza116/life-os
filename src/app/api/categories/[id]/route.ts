import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/server/http";
import { categoryInclude, toCategoryDTO } from "@/lib/server/serialize";
import { categoryPatch } from "@/lib/validation";

export async function PATCH(req: Request, ctx: RouteContext<"/api/categories/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const data = await readJson(req, categoryPatch.omit({ id: true }));
    const row = await prisma.category.update({ where: { id }, data, include: categoryInclude });
    return { category: toCategoryDTO(row) };
  });
}

/** Deletes a category. Its tasks and projects keep existing, uncategorized. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/categories/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    await prisma.category.delete({ where: { id } });
    return { ok: true };
  });
}
