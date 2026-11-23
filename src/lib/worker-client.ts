import { randomUUID } from "node:crypto";
import { signRequest, signedHeaders } from "./shared/protocol";
import type {
  BotState,
  ServerConfig,
  WorkerCommandResponse,
  WorkerHealth,
} from "./shared/types";

export class WorkerUnavailableError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "WorkerUnavailableError";
  }
}

function workerSecret(): string {
  const secret = process.env.WORKER_SHARED_SECRET;
  if (!secret || secret.length < 32) {
    throw new WorkerUnavailableError("WORKER_SHARED_SECRET is not configured on the dashboard server");
  }
  return secret;
}

function workerKeyId(): string {
  return process.env.WORKER_KEY_ID || "alpoyy-web";
}

export function workerBaseUrl(endpoint?: string): string {
  const raw = (endpoint || process.env.WORKER_ENDPOINT || "http://127.0.0.1:8787").trim();
  return raw.replace(/\/+$/, "");
}

async function callWorker<T>(
  endpoint: string | undefined,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const serialized = body === undefined ? "" : JSON.stringify(body);
  const url = `${workerBaseUrl(endpoint)}${path}`;
  const signed = signRequest(workerSecret(), workerKeyId(), method, path, serialized);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method,
      headers: signedHeaders(signed),
      body: method === "POST" ? serialized : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let parsed: { ok?: boolean; data?: T; error?: { message?: string } } = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new WorkerUnavailableError(`Worker returned an invalid response (${response.status})`, response.status);
    }
    if (!response.ok || parsed.ok === false) {
      throw new WorkerUnavailableError(
        parsed.error?.message || `Worker responded with HTTP ${response.status}`,
        response.status,
      );
    }
    if (parsed.data === undefined) {
      throw new WorkerUnavailableError("Worker response was missing data", response.status);
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof WorkerUnavailableError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new WorkerUnavailableError("Worker request timed out", 504);
    }
    throw new WorkerUnavailableError(
      error instanceof Error ? error.message : "Could not reach the worker",
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function getWorkerHealth(endpoint?: string): Promise<WorkerHealth> {
  return callWorker<WorkerHealth>(endpoint, "GET", "/v1/health");
}

export async function sendWorkerCommand(
  endpoint: string,
  command: "start" | "stop" | "restart" | "status",
  config?: ServerConfig,
): Promise<WorkerCommandResponse> {
  const payload = config ? { type: command, config } : { type: command };
  return callWorker<WorkerCommandResponse>(endpoint, "POST", "/v1/command", payload);
}

export async function syncWorkerState(endpoint?: string): Promise<BotState | null> {
  const result = await callWorker<WorkerCommandResponse>(endpoint, "POST", "/v1/command", { type: "status" });
  return result.state ?? null;
}

export function requestId(): string {
  return randomUUID().slice(0, 8);
}
