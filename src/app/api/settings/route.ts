import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/server/http";
import { toSettingsDTO } from "@/lib/server/serialize";
import { settingsPatch } from "@/lib/validation";

export async function PATCH(req: Request) {
  return handle(async () => {
    const { scoringWeights, ...rest } = await readJson(req, settingsPatch);
    const data = { ...rest, ...(scoringWeights ? { scoringWeights: JSON.stringify(scoringWeights) } : {}) };
    const row = await prisma.settings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });
    return { settings: toSettingsDTO(row) };
  });
}
