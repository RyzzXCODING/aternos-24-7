import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, rateLimited, readJson, serverError, unauthorized } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { addLog, getConfigRow, saveServerConfig, toServerConfig } from "@/lib/store";
import { safeParse, serverConfigSchema } from "@/lib/shared/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const row = await getConfigRow();
    return ok({
      config: toServerConfig(row),
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
      secrets: {
        workerSharedSecretConfigured: Boolean(process.env.WORKER_SHARED_SECRET),
        minecraftTokenConfigured: Boolean(process.env.MC_AUTH_TOKEN),
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const rate = await checkRateLimit(`config-write:${user.id}`, 15, 60_000);
    if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);

    const parsed = safeParse(serverConfigSchema, await readJson(request));
    if (!parsed.ok) return fail("VALIDATION_ERROR", "Please correct the highlighted fields", 422, parsed.issues);

    const previous = toServerConfig(await getConfigRow());
    const saved = await saveServerConfig(parsed.data, user.id);
    const changes = Object.keys(saved).filter(
      (key) => saved[key as keyof typeof saved] !== previous[key as keyof typeof saved],
    );
    await addLog("config", `Server configuration saved${changes.length ? ` (${changes.join(", ")})` : ""}`, {
      user: user.username,
      fields: changes.join(","),
    });
    return ok({ config: saved });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  return PUT(request);
}
