import { getCurrentUser } from "@/lib/auth";
import { fail, ok, serverError, unauthorized } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { getBotState, getConfigRow, recentWorkerPushMs, toServerConfig } from "@/lib/store";
import { getWorkerHealth, WorkerUnavailableError } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const rate = await checkRateLimit(`status:${user.id}`, 120, 60_000);
    if (!rate.allowed) return fail("RATE_LIMITED", "Too many status requests", 429);

    const configRow = await getConfigRow();
    const config = toServerConfig(configRow);
    const bot = await getBotState();
    const pushedAt = await recentWorkerPushMs();

    let worker: { alive: boolean; version: string | null; error: string | null; latencyMs: number | null };
    const began = Date.now();
    try {
      const health = await getWorkerHealth(config.workerEndpoint);
      worker = {
        alive: health.alive,
        version: health.version,
        error: health.lastError,
        latencyMs: Date.now() - began,
      };
    } catch (error) {
      worker = {
        alive: false,
        version: null,
        error: error instanceof WorkerUnavailableError ? error.message : "Worker health check failed",
        latencyMs: null,
      };
    }

    const dbStart = Date.now();
    await getConfigRow();
    const dbLatencyMs = Date.now() - dbStart;
    const effectiveBot = !worker.alive && bot.status !== "OFFLINE" && bot.status !== "STOPPED"
      ? { ...bot, status: "WORKER_OFFLINE" as const, detail: worker.error || bot.detail }
      : bot;

    const connectedAt = effectiveBot.connectedAt ? new Date(effectiveBot.connectedAt).getTime() : null;
    const connectionDurationMs =
      effectiveBot.status === "ONLINE" && connectedAt ? Math.max(0, Date.now() - connectedAt) : null;

    return ok({
      bot: effectiveBot,
      server: {
        address: config.host ? `${config.host}:${config.port}` : null,
        host: config.host,
        port: config.port,
        version: config.version,
        username: config.username,
      },
      worker: { ...worker, lastPushAt: pushedAt ? new Date(pushedAt).toISOString() : null },
      system: {
        api: "healthy",
        database: dbLatencyMs >= 0 ? "healthy" : "unknown",
        dbLatencyMs,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        node: process.version,
      },
      configUpdatedAt: configRow.updatedAt.toISOString(),
      connectionDurationMs,
    });
  } catch (error) {
    return serverError(error);
  }
}
