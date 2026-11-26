import { handle, readJson } from "@/lib/server/http";
import { createTask } from "@/lib/server/tasks";
import { taskInput } from "@/lib/validation";

export async function POST(req: Request) {
  return handle(async () => ({ task: await createTask(await readJson(req, taskInput)) }));
}
