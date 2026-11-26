import "server-only";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wraps a route handler body: validation errors → 400, HttpError → its status, others → 500. */
export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    const result = await fn();
    if (result instanceof Response) return result;
    return Response.json(result ?? { ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Invalid input", issues: z.flattenError(err) }, { status: 400 });
    }
    if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2025") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    console.error(err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Body must be JSON");
  }
  return schema.parse(body);
}
