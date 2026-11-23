import { getCurrentUser } from "@/lib/auth";
import { ok, rateLimited, serverError, unauthorized } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { getBotState } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const rate = await checkRateLimit(`bot-status:${user.id}`, 120, 60_000);
    if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);
    return ok({ state: await getBotState() });
  } catch (error) {
    return serverError(error);
  }
}
