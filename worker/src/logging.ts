import type { WorkerConfig } from "./config";

const levels = ["debug", "info", "warn", "error"] as const;

export function log(
  level: (typeof levels)[number],
  message: string,
  fields: Record<string, unknown> = {},
  config?: Pick<WorkerConfig, "logLevel">,
): void {
  const threshold = levels.indexOf(config?.logLevel ?? "info");
  if (levels.indexOf(level) < threshold) return;
  const entry = {
    at: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
