import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { NonceCache, verifySignature } from "../../src/lib/shared/protocol";
import { serverConfigSchema } from "../../src/lib/shared/validation";
import { BotManager } from "./bot";
import type { WorkerConfig } from "./config";
import { log } from "./logging";

const nonces = new NonceCache();

const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), config: serverConfigSchema }),
  z.object({ type: z.literal("restart"), config: serverConfigSchema }),
  z.object({ type: z.literal("stop") }),
  z.object({ type: z.literal("status") }),
]);

function respond(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of req) {
    body += chunk.toString("utf8");
    if (body.length > 64_000) throw new Error("Payload too large");
  }
  return body;
}

export function createWorkerServer(config: WorkerConfig, manager: BotManager) {
  return createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const path = url.pathname;
    const method = (req.method || "GET").toUpperCase();
    const started = Date.now();

    try {
      const body = method === "POST" ? await readBody(req) : "";
      const headers = new Map<string, string>();
      for (const [name, value] of Object.entries(req.headers)) {
        headers.set(name.toLowerCase(), Array.isArray(value) ? value.join(",") : value ?? "");
      }
      const verified = verifySignature({
        secret: config.sharedSecret,
        expectedKeyId: config.keyId,
        method,
        path,
        body,
        headers,
        nonces,
      });
      if (!verified.ok) {
        log("warn", "Rejected unsigned worker request", { path, reason: verified.reason }, config);
        respond(res, 401, { ok: false, error: { code: "UNAUTHORIZED", message: `Invalid signature: ${verified.reason}` } });
        return;
      }

      if (method === "GET" && path === "/v1/health") {
        respond(res, 200, { ok: true, data: manager.getHealth() });
        return;
      }

      if (method === "POST" && path === "/v1/command") {
        let parsed: ReturnType<typeof commandSchema.safeParse>;
        try {
          parsed = commandSchema.safeParse(JSON.parse(body || "{}"));
        } catch {
          respond(res, 400, { ok: false, error: { code: "INVALID_JSON", message: "Malformed command payload" } });
          return;
        }
        if (!parsed.success) {
          respond(res, 422, {
            ok: false,
            error: { code: "VALIDATION_ERROR", message: "Invalid command", details: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) },
          });
          return;
        }

        const command = parsed.data;
        let message: string;
        if (command.type === "start" || command.type === "restart") {
          await manager.start(command.config);
          message = command.type === "start" ? "Bot connection started" : "Bot connection restarted";
        } else if (command.type === "stop") {
          await manager.stop();
          message = "Bot connection stopped";
        } else {
          message = "Current state returned";
        }

        log("info", `Command ${command.type} handled`, { durationMs: Date.now() - started }, config);
        respond(res, 200, {
          ok: true,
          data: { ok: true, state: manager.getState(), health: manager.getHealth(), message },
        });
        return;
      }

      respond(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "Endpoint not found" } });
    } catch (error) {
      log("error", "Worker request failed", { path, error: error instanceof Error ? error.message : "unknown" }, config);
      respond(res, 500, { ok: false, error: { code: "INTERNAL_ERROR", message: "Worker internal error" } });
    }
  });
}
