import { getDbClient } from "./db/client";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const client = getDbClient();
  const result = await client.execute({
    sql: `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET
        window_start = CASE WHEN rate_limits.window_start <= ? THEN ? ELSE rate_limits.window_start END,
        count = CASE WHEN rate_limits.window_start <= ? THEN 1 ELSE rate_limits.count + 1 END
      RETURNING count, window_start`,
    args: [key, now, windowStart, now, windowStart],
  });

  const row = result.rows[0] as unknown as { count: number; window_start: number } | undefined;
  const count = Number(row?.count ?? 1);
  const start = Number(row?.window_start ?? now);
  const retryAfterSeconds = Math.max(1, Math.ceil((start + windowMs - now) / 1000));

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds,
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  await getDbClient().execute({ sql: "DELETE FROM rate_limits WHERE key = ?", args: [key] });
}

export async function cleanupRateLimits(): Promise<void> {
  await getDbClient().execute({
    sql: "DELETE FROM rate_limits WHERE window_start < ?",
    args: [Date.now() - 24 * 60 * 60 * 1000],
  });
}
