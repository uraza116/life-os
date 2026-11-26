import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/server/http";
import { projectInclude, toProjectDTO } from "@/lib/server/serialize";
import { projectInput } from "@/lib/validation";

export async function POST(req: Request) {
  return handle(async () => {
    const { archived, deleted, ...data } = await readJson(req, projectInput);
    const row = await prisma.project.create({
      data: { ...data, archivedAt: archived ? new Date() : null, deletedAt: deleted ? new Date() : null },
      include: projectInclude,
    });
    return { project: toProjectDTO(row) };
  });
}
