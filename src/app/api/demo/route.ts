import { handle } from "@/lib/server/http";
import { loadDemo, removeDemo } from "@/lib/server/seed";

/** Loads demo data (replacing any previous demo rows). */
export async function POST() {
  return handle(async () => {
    await loadDemo();
    return { ok: true };
  });
}

/** Removes every row marked `isDemo`. The user's own data is untouched. */
export async function DELETE() {
  return handle(async () => {
    await removeDemo();
    return { ok: true };
  });
}
