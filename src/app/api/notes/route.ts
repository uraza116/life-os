import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/server/http";
import { toDailyNoteDTO } from "@/lib/server/serialize";
import { dailyNoteInput } from "@/lib/validation";

/** Saves the daily note for one date (creates it on first save). Empty content deletes it. */
export async function PUT(req: Request) {
  return handle(async () => {
    const { date, content } = await readJson(req, dailyNoteInput);
    const existing = await prisma.note.findFirst({ where: { kind: "daily", date, deletedAt: null } });
    if (!content.trim()) {
      if (existing) await prisma.note.delete({ where: { id: existing.id } });
      return { note: { date, content: "" } };
    }
    const n = existing
      ? await prisma.note.update({ where: { id: existing.id }, data: { content } })
      : await prisma.note.create({ data: { kind: "daily", date, content } });
    return { note: toDailyNoteDTO(n) };
  });
}
