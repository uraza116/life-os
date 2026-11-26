import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/server/http";
import { subcategoryInput } from "@/lib/validation";

export async function POST(req: Request) {
  return handle(async () => {
    const input = await readJson(req, subcategoryInput);
    const count = await prisma.subcategory.count({ where: { categoryId: input.categoryId } });
    const s = await prisma.subcategory.create({ data: { ...input, sortOrder: input.sortOrder ?? count } });
    return {
      subcategory: { id: s.id, categoryId: s.categoryId, name: s.name, sortOrder: s.sortOrder, hidden: s.hidden, isDemo: s.isDemo },
    };
  });
}
