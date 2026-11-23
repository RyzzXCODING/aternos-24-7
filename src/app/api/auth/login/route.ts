import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userSettings } from "@/lib/db/schema";
import { addLog } from "@/lib/store";
import { loginSchema } from "@/lib/shared/validation";
import { findUserByUsername, getCurrentUser, verifyPassword, createSession } from "@/lib/auth";
import { clientIp, fail, ok, rateLimited, readJson, serverError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const limit = await checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
    if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

    const body = await readJson(request);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return fail("INVALID_INPUT", "Invalid username or password", 400);

    const user = await findUserByUsername(parsed.data.username);
    const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
    if (!user || !valid) {
      await addLog("auth", `Failed sign-in attempt for ${parsed.data.username}`, { ip });
      return fail("INVALID_CREDENTIALS", "Invalid username or password", 401);
    }
    if (user.role !== "owner") return fail("FORBIDDEN", "Owner access required", 403);

    await createSession(user.id);
    const settings = await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1);
    await addLog("auth", `Sign-in successful for ${user.username}`, { ip });
    return ok({
      user: { id: user.id, username: user.username, role: user.role },
      settings: settings[0]
        ? {
            theme: "industrial",
            compact: settings[0].compact,
            refreshMs: settings[0].refreshMs,
            notifyOnError: settings[0].notifyOnError,
          }
        : null,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED", "Not signed in", 401);
    return ok({ id: user.id, username: user.username, role: user.role });
  } catch (error) {
    return serverError(error);
  }
}
