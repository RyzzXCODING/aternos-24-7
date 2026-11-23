export const BOT_STATUSES = [
  "OFFLINE",
  "ONLINE",
  "CONNECTING",
  "ERROR",
  "STOPPED",
  "WORKER_OFFLINE",
] as const;

export type BotStatus = (typeof BOT_STATUSES)[number];

export const EVENT_TYPES = [
  "connection",
  "disconnection",
  "error",
  "config",
  "auth",
  "system",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface ServerConfig {
  host: string;
  port: number;
  version: string;
  username: string;
  authMode: "offline" | "microsoft";
  reconnectEnabled: boolean;
  reconnectDelayMs: number;
  reconnectMaxAttempts: number;
  chatMonitoring: boolean;
  playerListMonitoring: boolean;
  workerEndpoint: string;
}

export interface BotState {
  status: BotStatus;
  address: string | null;
  version: string | null;
  username: string | null;
  connectedAt: string | null;
  lastAttemptAt: string | null;
  lastDisconnectReason: string | null;
  reconnectAttempt: number;
  players: string[];
  maxPlayers: number | null;
  motd: string | null;
  pingMs: number | null;
  detail: string | null;
  updatedAt: string;
}

export interface WorkerHealth {
  alive: boolean;
  version: string;
  uptimeSeconds: number;
  botStatus: BotStatus;
  configLoaded: boolean;
  lastError: string | null;
}

export interface WorkerEvent {
  type: EventType;
  message: string;
  metadata?: Record<string, unknown>;
  at?: string;
}

export type WorkerCommandPayload =
  | { type: "start"; config: ServerConfig }
  | { type: "stop" }
  | { type: "restart"; config: ServerConfig }
  | { type: "status" };

export interface WorkerCommandResponse {
  ok: boolean;
  state: BotState;
  health: WorkerHealth;
  message?: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function emptyBotState(): BotState {
  return {
    status: "OFFLINE",
    address: null,
    version: null,
    username: null,
    connectedAt: null,
    lastAttemptAt: null,
    lastDisconnectReason: null,
    reconnectAttempt: 0,
    players: [],
    maxPlayers: null,
    motd: null,
    pingMs: null,
    detail: null,
    updatedAt: new Date().toISOString(),
  };
}
