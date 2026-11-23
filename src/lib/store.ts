import { and, count, desc, eq, like, lt, or } from "drizzle-orm";
import { db } from "./db/client";
import {
  activityLogs,
  appConfig,
  botState,
  userSettings,
  type ActivityLogRow,
  type AppConfigRow,
  type BotStateRow,
} from "./db/schema";
import {
  emptyBotState,
  type BotState,
  type EventType,
  type ServerConfig,
} from "./shared/types";

export const STALE_STATE_MS = 90_000;

export function toServerConfig(row: AppConfigRow): ServerConfig {
  return {
    host: row.host,
    port: row.port,
    version: row.version,
    username: row.username,
    authMode: row.authMode === "microsoft" ? "microsoft" : "offline",
    reconnectEnabled: row.reconnectEnabled,
    reconnectDelayMs: row.reconnectDelayMs,
    reconnectMaxAttempts: row.reconnectMaxAttempts,
    chatMonitoring: row.chatMonitoring,
    playerListMonitoring: row.playerListMonitoring,
    workerEndpoint: row.workerEndpoint,
  };
}

export async function getConfigRow(): Promise<AppConfigRow> {
  const rows = await db.select().from(appConfig).where(eq(appConfig.id, 1)).limit(1);
  if (rows[0]) return rows[0];

  const fallback: AppConfigRow = {
    id: 1,
    host: "",
    port: 25565,
    version: "1.21.11",
    username: "",
    authMode: "offline",
    reconnectEnabled: true,
    reconnectDelayMs: 5000,
    reconnectMaxAttempts: 5,
    chatMonitoring: true,
    playerListMonitoring: true,
    workerEndpoint: process.env.WORKER_ENDPOINT || "http://127.0.0.1:8787",
    updatedAt: new Date(0),
    updatedBy: null,
  };
  await db.insert(appConfig).values(fallback).onConflictDoNothing();
  return fallback;
}

export async function getServerConfig(): Promise<ServerConfig> {
  return toServerConfig(await getConfigRow());
}

export async function saveServerConfig(config: ServerConfig, userId: string): Promise<ServerConfig> {
  await db.insert(appConfig).values({ id: 1, ...config, updatedAt: new Date(), updatedBy: userId })
    .onConflictDoUpdate({
      target: appConfig.id,
      set: { ...config, updatedAt: new Date(), updatedBy: userId },
    });
  return config;
}

export function toBotState(row: BotStateRow | undefined): BotState {
  if (!row) return emptyBotState();
  return {
    status: row.status as BotState["status"],
    address: row.address,
    version: row.version,
    username: row.username,
    connectedAt: row.connectedAt?.toISOString() ?? null,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    lastDisconnectReason: row.lastDisconnectReason,
    reconnectAttempt: row.reconnectAttempt,
    players: row.players ?? [],
    maxPlayers: row.maxPlayers,
    motd: row.motd,
    pingMs: row.pingMs,
    detail: row.detail,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getBotState(): Promise<BotState> {
  const rows = await db.select().from(botState).where(eq(botState.id, 1)).limit(1);
  const state = toBotState(rows[0]);
  const pushedAt = rows[0]?.lastWorkerPushAt?.getTime() ?? 0;
  const isActive = state.status === "ONLINE" || state.status === "CONNECTING";
  if (isActive && (!pushedAt || Date.now() - pushedAt > STALE_STATE_MS)) {
    return {
      ...state,
      status: "WORKER_OFFLINE",
      detail: "Worker heartbeat is stale. The worker may be offline.",
      lastDisconnectReason: "Worker heartbeat lost",
    };
  }
  return state;
}

export async function saveBotState(state: BotState, fromWorker = true): Promise<void> {
  await db.insert(botState).values({
    id: 1,
    status: state.status,
    address: state.address,
    version: state.version,
    username: state.username,
    connectedAt: state.connectedAt ? new Date(state.connectedAt) : null,
    lastAttemptAt: state.lastAttemptAt ? new Date(state.lastAttemptAt) : null,
    lastDisconnectReason: state.lastDisconnectReason,
    reconnectAttempt: state.reconnectAttempt,
    players: state.players,
    maxPlayers: state.maxPlayers,
    motd: state.motd,
    pingMs: state.pingMs,
    detail: state.detail,
    updatedAt: new Date(state.updatedAt),
    lastWorkerPushAt: fromWorker ? new Date() : null,
  }).onConflictDoUpdate({
    target: botState.id,
    set: {
      status: state.status,
      address: state.address,
      version: state.version,
      username: state.username,
      connectedAt: state.connectedAt ? new Date(state.connectedAt) : null,
      lastAttemptAt: state.lastAttemptAt ? new Date(state.lastAttemptAt) : null,
      lastDisconnectReason: state.lastDisconnectReason,
      reconnectAttempt: state.reconnectAttempt,
      players: state.players,
      maxPlayers: state.maxPlayers,
      motd: state.motd,
      pingMs: state.pingMs,
      detail: state.detail,
      updatedAt: new Date(state.updatedAt),
      ...(fromWorker ? { lastWorkerPushAt: new Date() } : {}),
    },
  });
}

export async function addLog(
  type: EventType,
  message: string,
  metadata?: Record<string, unknown>,
  at = new Date(),
): Promise<void> {
  await db.insert(activityLogs).values({
    at,
    type,
    message: message.slice(0, 1000),
    metadata: metadata ? sanitizeMetadata(metadata) : null,
  });
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 20)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      result[key.slice(0, 40)] = typeof value === "string" ? value.slice(0, 500) : value;
    }
  }
  return result;
}

export interface LogQuery {
  q: string;
  type: string;
  page: number;
  limit: number;
}

export interface LogPage {
  items: (ActivityLogRow & { key: string })[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export async function listLogs(query: LogQuery): Promise<LogPage> {
  const filters = [];
  if (query.type !== "all") filters.push(eq(activityLogs.type, query.type));
  if (query.q) {
    const pattern = `%${query.q.replace(/[%_]/g, "\\$&")}%`;
    filters.push(or(like(activityLogs.message, pattern), like(activityLogs.type, pattern)));
  }
  const where = filters.length ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.limit;

  const [items, totals] = await Promise.all([
    db.select().from(activityLogs).where(where).orderBy(desc(activityLogs.at), desc(activityLogs.id))
      .limit(query.limit).offset(offset),
    db.select({ value: count() }).from(activityLogs).where(where),
  ]);

  const total = Number(totals[0]?.value ?? 0);
  return {
    items: items.map((item) => ({ ...item, key: String(item.id) })),
    total,
    page: query.page,
    limit: query.limit,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function clearLogs(): Promise<number> {
  const before = await db.select({ value: count() }).from(activityLogs);
  await db.delete(activityLogs);
  return Number(before[0]?.value ?? 0);
}

export interface DashboardSettings {
  theme: "industrial";
  compact: boolean;
  refreshMs: number;
  notifyOnError: boolean;
}

export async function getSettings(userId: string): Promise<DashboardSettings> {
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  const row = rows[0];
  return {
    theme: "industrial",
    compact: row?.compact ?? false,
    refreshMs: row?.refreshMs ?? 5000,
    notifyOnError: row?.notifyOnError ?? true,
  };
}

export async function saveSettings(userId: string, settings: DashboardSettings): Promise<void> {
  await db.insert(userSettings).values({ userId, ...settings })
    .onConflictDoUpdate({ target: userSettings.userId, set: settings });
}

export async function recentWorkerPushMs(): Promise<number | null> {
  const rows = await db.select({ pushed: botState.lastWorkerPushAt }).from(botState).where(eq(botState.id, 1)).limit(1);
  return rows[0]?.pushed?.getTime() ?? null;
}

export async function pruneOldLogs(days = 30): Promise<void> {
  await db.delete(activityLogs).where(lt(activityLogs.at, new Date(Date.now() - days * 86400000)));
}
