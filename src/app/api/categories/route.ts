import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/server/http";
import { categoryInclude, toCategoryDTO } from "@/lib/server/serialize";
import { categoryInput } from "@/lib/validation";

export async function POST(req: Request) {
  return handle(async () => {
    const input = await readJson(req, categoryInput);
    const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
    const row = await prisma.category.create({
      data: { ...input, sortOrder: input.sortOrder ?? (max._max.sortOrder ?? 0) + 1 },
      include: categoryInclude,
    });
    return { category: toCategoryDTO(row) };
  });
}
