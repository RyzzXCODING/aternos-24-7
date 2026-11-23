import { NextRequest } from "next/server";
import { connect } from "node:net";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, rateLimited, readJson, serverError, unauthorized } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { safeParse, serverConfigSchema } from "@/lib/shared/validation";
import { getWorkerHealth } from "@/lib/worker-client";
import { addLog } from "@/lib/store";

export const runtime = "nodejs";

function probeTcp(host: string, port: number, timeoutMs = 4000): Promise<{ reachable: boolean; latencyMs: number | null; error: string | null }> {
  return new Promise((resolve) => {
    const began = Date.now();
    const socket = connect({ host, port });
    let settled = false;

    const finish = (reachable: boolean, error: string | null) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ reachable, latencyMs: reachable ? Date.now() - began : null, error });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true, null));
    socket.once("timeout", () => finish(false, "Connection timed out"));
    socket.once("error", (error) => finish(false, error.message));
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const rate = await checkRateLimit(`config-test:${user.id}`, 10, 60_000);
    if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);

    const parsed = safeParse(serverConfigSchema, await readJson(request));
    if (!parsed.ok) return fail("VALIDATION_ERROR", "Please correct the highlighted fields", 422, parsed.issues);

    const config = parsed.data;
    const [tcp, worker] = await Promise.all([
      probeTcp(config.host, config.port),
      getWorkerHealth(config.workerEndpoint)
        .then((health) => ({ reachable: health.alive, version: health.version, error: health.lastError }))
        .catch((error: unknown) => ({
          reachable: false,
          version: null,
          error: error instanceof Error ? error.message : "Worker check failed",
        })),
    ]);

    await addLog("system", `Configuration test ${tcp.reachable && worker.reachable ? "passed" : "reported issues"}`, {
      user: user.username,
      target: `${config.host}:${config.port}`,
    });

    return ok({
      tcp,
      worker,
      passed: tcp.reachable && worker.reachable,
    });
  } catch (error) {
    return serverError(error);
  }
}
