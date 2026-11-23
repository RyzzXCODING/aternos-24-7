import { ok, serverError } from "@/lib/http";
import { getDbClient } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const began = Date.now();
    await getDbClient().execute({ sql: "SELECT 1 AS healthy" });
    return ok({
      api: "healthy",
      database: "healthy",
      dbLatencyMs: Date.now() - began,
      auth: "enabled",
      workerAuthConfigured: Boolean(process.env.WORKER_SHARED_SECRET),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return serverError(error);
  }
}
