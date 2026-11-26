import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/server/http";
import { toSavedViewDTO } from "@/lib/server/serialize";
import { savedViewInput } from "@/lib/validation";

export async function POST(req: Request) {
  return handle(async () => {
    const { filters, ...rest } = await readJson(req, savedViewInput);
    const count = await prisma.savedView.count();
    const v = await prisma.savedView.create({ data: { ...rest, filters: JSON.stringify(filters), sortOrder: count } });
    return { view: toSavedViewDTO(v) };
  });
}
