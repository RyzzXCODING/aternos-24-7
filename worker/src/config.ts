import { z } from "zod";

const schema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(8787),
  host: z.string().default("0.0.0.0"),
  sharedSecret: z.string().min(32, "WORKER_SHARED_SECRET must be at least 32 characters"),
  keyId: z.string().min(1).default("alpoyy-web"),
  pushKeyId: z.string().min(1).default("alpoyy-worker"),
  dashboardUrl: z.string().url().default("http://127.0.0.1:3000"),
  minecraftToken: z.string().optional(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type WorkerConfig = z.infer<typeof schema>;

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return schema.parse({
    port: env.WORKER_PORT ?? 8787,
    host: env.WORKER_HOST ?? "0.0.0.0",
    sharedSecret: env.WORKER_SHARED_SECRET,
    keyId: env.WORKER_KEY_ID ?? "alpoyy-web",
    pushKeyId: env.WORKER_PUSH_KEY_ID ?? "alpoyy-worker",
    dashboardUrl: env.WORKER_DASHBOARD_URL ?? "http://127.0.0.1:3000",
    minecraftToken: env.MC_AUTH_TOKEN || undefined,
    logLevel: env.WORKER_LOG_LEVEL ?? "info",
  });
}
