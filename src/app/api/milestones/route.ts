import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/server/http";
import { toMilestoneDTO } from "@/lib/server/serialize";
import { milestoneInput } from "@/lib/validation";

export async function POST(req: Request) {
  return handle(async () => {
    const { completed, ...input } = await readJson(req, milestoneInput);
    const count = await prisma.milestone.count({ where: { projectId: input.projectId } });
    const m = await prisma.milestone.create({
      data: { ...input, sortOrder: input.sortOrder ?? count, completedAt: completed ? new Date() : null },
    });
    return { milestone: toMilestoneDTO(m) };
  });
}
