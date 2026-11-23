import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, rateLimited, readJson, serverError, unauthorized } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { clearLogs, listLogs } from "@/lib/store";
import { addLog } from "@/lib/store";
import { logsQuerySchema } from "@/lib/shared/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = logsQuerySchema.safeParse(params);
    if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid log filters", 422);
    return ok(await listLogs(parsed.data));
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const rate = await checkRateLimit(`logs-clear:${user.id}`, 5, 60_000);
    if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);

    const body = await readJson(request);
    if (!body || (body as { confirm?: string }).confirm !== "CLEAR_LOGS") {
      return fail("CONFIRMATION_REQUIRED", "Send confirm: CLEAR_LOGS to clear activity logs", 400);
    }

    const removed = await clearLogs();
    await addLog("system", `Activity log cleared (${removed} entries removed)`, { user: user.username });
    return ok({ removed });
  } catch (error) {
    return serverError(error);
  }
}
