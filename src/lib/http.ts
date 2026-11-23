import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(code: string, message: string, status = 400, details?: unknown): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message, details } }, { status });
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 64);
  return request.headers.get("x-real-ip")?.trim().slice(0, 64) || "unknown";
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function serverError(error: unknown): NextResponse {
  const id = Math.random().toString(36).slice(2, 10);
  console.error(`[api:${id}]`, error);
  return fail(
    "INTERNAL_ERROR",
    process.env.NODE_ENV === "production"
      ? `An internal error occurred. Reference: ${id}`
      : error instanceof Error
        ? error.message
        : "An internal error occurred",
    500,
  );
}

export function unauthorized(): NextResponse {
  return fail("UNAUTHORIZED", "Sign in to continue", 401);
}

export function rateLimited(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code: "RATE_LIMITED", message: "Too many attempts. Try again shortly." } },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
