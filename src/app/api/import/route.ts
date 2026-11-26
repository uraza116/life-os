import { handle, readJson } from "@/lib/server/http";
import { importBody, runImport } from "@/lib/server/import";

/** Imports a Life OS JSON export. Body: { mode: "merge" | "replace", data: <export file> }. */
export async function POST(req: Request) {
  return handle(async () => {
    const { mode, data } = await readJson(req, importBody);
    return { imported: await runImport(mode, data) };
  });
}
