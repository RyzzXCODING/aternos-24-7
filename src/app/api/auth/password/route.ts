import { NextRequest } from "next/server";
import { z } from "zod";
import { and, ne, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";
import { getCurrentSessionTokenHash, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { fail, ok, rateLimited, readJson, serverError, unauthorized } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { addLog } from "@/lib/store";

export const runtime = "nodejs";

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12, "New password must be at least 12 characters").max(128),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const rate = await checkRateLimit(`password:${user.id}`, 5, 15 * 60 * 1000);
    if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);

    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid password input", 422, parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
    }
    if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return fail("INVALID_PASSWORD", "Current password is incorrect", 401);
    }

    await db.update(users).set({ passwordHash: await hashPassword(parsed.data.newPassword) }).where(eq(users.id, user.id));
    const currentHash = await getCurrentSessionTokenHash();
    if (currentHash) {
      await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.tokenHash, currentHash)));
    }
    await addLog("auth", `Password changed for ${user.username}`);
    return ok({ changed: true, otherSessionsRevoked: true });
  } catch (error) {
    return serverError(error);
  }
}
