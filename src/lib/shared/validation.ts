import { z } from "zod";

export const hostSchema = z
  .string()
  .trim()
  .min(1, "A server address is required")
  .max(253, "Address is too long")
  .regex(/^[a-zA-Z0-9._-]+$/, "Use a hostname or IPv4 address without protocol or path");

export const portSchema = z.coerce
  .number()
  .int("Port must be a whole number")
  .min(1, "Port must be between 1 and 65535")
  .max(65535, "Port must be between 1 and 65535");

export const versionSchema = z
  .string()
  .trim()
  .regex(/^\d+\.\d+(\.\d+)?$/, "Use a version like 1.21.11 or 1.20.4");

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(16, "Minecraft usernames are at most 16 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores are allowed");

export const workerEndpointSchema = z
  .string()
  .trim()
  .url("Enter a full http(s) URL")
  .refine((value) => /^https?:$/.test(new URL(value).protocol), "Only http(s) endpoints are supported")
  .refine((value) => !new URL(value).username && !new URL(value).password, "Credentials in the URL are not allowed")
  .max(500);

export const serverConfigSchema = z.object({
  host: hostSchema,
  port: portSchema,
  version: versionSchema,
  username: usernameSchema,
  authMode: z.enum(["offline", "microsoft"]),
  reconnectEnabled: z.boolean(),
  reconnectDelayMs: z.number().int().min(1000).max(600000),
  reconnectMaxAttempts: z.number().int().min(0).max(100),
  chatMonitoring: z.boolean(),
  playerListMonitoring: z.boolean(),
  workerEndpoint: workerEndpointSchema,
}).superRefine((value, ctx) => {
  if (value.authMode === "microsoft") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["authMode"],
      message: "Microsoft auth is not supported in this offline-mode deployment. Use offline mode only on servers that permit it.",
    });
  }
});

export type ServerConfigInput = z.infer<typeof serverConfigSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(32),
  password: z.string().min(12, "Password must be at least 12 characters").max(128),
});

export const logsQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  type: z.enum(["all", "connection", "disconnection", "error", "config", "auth", "system"]).optional().default("all"),
  page: z.coerce.number().int().min(1).max(100000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(15),
});

export function safeParse<T extends z.ZodType>(schema: T, value: unknown):
  | { ok: true; data: z.infer<T> }
  | { ok: false; issues: { path: string; message: string }[] } {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join(".") || "form",
      message: issue.message,
    })),
  };
}
