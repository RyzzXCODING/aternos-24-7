import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, serverError } from "@/lib/http";
import { NonceCache, verifySignature } from "@/lib/shared/protocol";
import { BOT_STATUSES, EVENT_TYPES } from "@/lib/shared/types";
import { addLog, saveBotState } from "@/lib/store";

export const runtime = "nodejs";

const globalForNonce = globalThis as unknown as { __alpoyyWorkerNonces?: NonceCache };
const nonces = (globalForNonce.__alpoyyWorkerNonces ??= new NonceCache());

const stateSchema = z.object({
  status: z.enum(BOT_STATUSES),
  address: z.string().max(300).nullable().optional(),
  version: z.string().max(50).nullable().optional(),
  username: z.string().max(64).nullable().optional(),
  connectedAt: z.iso.datetime().nullable().optional(),
  lastAttemptAt: z.iso.datetime().nullable().optional(),
  lastDisconnectReason: z.string().max(500).nullable().optional(),
  reconnectAttempt: z.number().int().min(0).max(1000).optional(),
  players: z.array(z.string().max(64)).max(100).optional(),
  maxPlayers: z.number().int().min(0).max(100000).nullable().optional(),
  motd: z.string().max(500).nullable().optional(),
  pingMs: z.number().int().min(0).max(600000).nullable().optional(),
  detail: z.string().max(500).nullable().optional(),
  updatedAt: z.iso.datetime().optional(),
});

const payloadSchema = z.object({
  state: stateSchema,
  events: z.array(z.object({
    type: z.enum(EVENT_TYPES),
    message: z.string().min(1).max(1000),
    metadata: z.record(z.string(), z.unknown()).optional(),
    at: z.iso.datetime().optional(),
  })).max(50).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.WORKER_SHARED_SECRET;
    if (!secret || secret.length < 32) {
      return fail("NOT_CONFIGURED", "Worker authentication is not configured", 503);
    }

    const body = await request.text();
    const path = request.nextUrl.pathname;
    const verified = verifySignature({
      secret,
      expectedKeyId: process.env.WORKER_PUSH_KEY_ID || "alpoyy-worker",
      method: request.method,
      path,
      body,
      headers: request.headers,
      nonces,
    });
    if (!verified.ok) return fail("UNAUTHORIZED", `Invalid worker signature: ${verified.reason}`, 401);

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return fail("INVALID_JSON", "Malformed payload", 400);
    }
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid worker state payload", 422, parsed.error.issues);

    const { state, events = [] } = parsed.data;
    await saveBotState({
      status: state.status,
      address: state.address ?? null,
      version: state.version ?? null,
      username: state.username ?? null,
      connectedAt: state.connectedAt ?? null,
      lastAttemptAt: state.lastAttemptAt ?? null,
      lastDisconnectReason: state.lastDisconnectReason ?? null,
      reconnectAttempt: state.reconnectAttempt ?? 0,
      players: state.players ?? [],
      maxPlayers: state.maxPlayers ?? null,
      motd: state.motd ?? null,
      pingMs: state.pingMs ?? null,
      detail: state.detail ?? null,
      updatedAt: state.updatedAt ?? new Date().toISOString(),
    }, true);

    for (const event of events) {
      await addLog(event.type, event.message, event.metadata, event.at ? new Date(event.at) : new Date());
    }

    return ok({ accepted: true, events: events.length });
  } catch (error) {
    return serverError(error);
  }
}
