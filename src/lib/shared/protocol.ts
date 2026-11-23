import { Buffer } from "node:buffer";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-alpoyy-signature";
export const TIMESTAMP_HEADER = "x-alpoyy-timestamp";
export const NONCE_HEADER = "x-alpoyy-nonce";
export const KEY_HEADER = "x-alpoyy-key";
export const MAX_SKEW_MS = 5 * 60 * 1000;

export interface SignedRequest {
  method: string;
  path: string;
  body: string;
  timestamp: number;
  nonce: string;
  keyId: string;
  signature: string;
}

export function bodyHash(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export function signString(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function canonicalString(
  method: string,
  path: string,
  timestamp: number,
  nonce: string,
  body: string,
): string {
  return [
    method.toUpperCase(),
    path,
    String(timestamp),
    nonce,
    bodyHash(body),
  ].join("\n");
}

export function createSignature(
  secret: string,
  method: string,
  path: string,
  timestamp: number,
  nonce: string,
  body: string,
): string {
  return signString(secret, canonicalString(method, path, timestamp, nonce, body));
}

export function signRequest(
  secret: string,
  keyId: string,
  method: string,
  path: string,
  body = "",
): SignedRequest {
  const timestamp = Date.now();
  const nonce = `${timestamp}-${Math.random().toString(36).slice(2, 12)}`;
  return {
    method,
    path,
    body,
    timestamp,
    nonce,
    keyId,
    signature: createSignature(secret, method, path, timestamp, nonce, body),
  };
}

export function signedHeaders(request: SignedRequest): Record<string, string> {
  return {
    "content-type": "application/json",
    [SIGNATURE_HEADER]: request.signature,
    [TIMESTAMP_HEADER]: String(request.timestamp),
    [NONCE_HEADER]: request.nonce,
    [KEY_HEADER]: request.keyId,
  };
}

export class NonceCache {
  private readonly seen = new Map<string, number>();

  constructor(private readonly ttlMs: number = MAX_SKEW_MS * 2) {}

  consume(keyId: string, nonce: string, now = Date.now()): boolean {
    const key = `${keyId}:${nonce}`;
    for (const [stored, expires] of this.seen) {
      if (expires < now) this.seen.delete(stored);
    }
    if (this.seen.has(key)) return false;
    this.seen.set(key, now + this.ttlMs);
    return true;
  }
}

export interface VerifyOptions {
  secret: string;
  expectedKeyId: string;
  method: string;
  path: string;
  body: string;
  headers: Headers | Map<string, string>;
  now?: number;
  nonces?: NonceCache;
}

export function verifySignature(options: VerifyOptions): { ok: true } | { ok: false; reason: string } {
  const { secret, expectedKeyId, method, path, body, headers, now = Date.now() } = options;
  const get = (name: string) =>
    headers instanceof Headers ? headers.get(name) : headers.get(name.toLowerCase()) ?? headers.get(name);

  const signature = get(SIGNATURE_HEADER);
  const timestampRaw = get(TIMESTAMP_HEADER);
  const nonce = get(NONCE_HEADER);
  const keyId = get(KEY_HEADER);

  if (!signature || !timestampRaw || !nonce || !keyId) {
    return { ok: false, reason: "missing signature headers" };
  }
  if (!timingSafeEqualSafe(keyId, expectedKeyId)) {
    return { ok: false, reason: "unknown key id" };
  }

  const timestamp = Number(timestampRaw);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > MAX_SKEW_MS) {
    return { ok: false, reason: "stale timestamp" };
  }

  const expected = createSignature(secret, method, path, timestamp, nonce, body);
  if (!timingSafeEqualSafe(signature, expected)) {
    return { ok: false, reason: "invalid signature" };
  }

  if (options.nonces && !options.nonces.consume(keyId, nonce, now)) {
    return { ok: false, reason: "replayed nonce" };
  }

  return { ok: true };
}

export function timingSafeEqualSafe(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
