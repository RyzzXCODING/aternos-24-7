import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("owner"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("sessions_expires_at_idx").on(table.expiresAt)]);

export const appConfig = sqliteTable("app_config", {
  id: integer("id").primaryKey(),
  host: text("host").notNull().default(""),
  port: integer("port").notNull().default(25565),
  version: text("version").notNull().default("1.21.11"),
  username: text("username").notNull().default(""),
  authMode: text("auth_mode").notNull().default("offline"),
  reconnectEnabled: integer("reconnect_enabled", { mode: "boolean" }).notNull().default(true),
  reconnectDelayMs: integer("reconnect_delay_ms").notNull().default(5000),
  reconnectMaxAttempts: integer("reconnect_max_attempts").notNull().default(5),
  chatMonitoring: integer("chat_monitoring", { mode: "boolean" }).notNull().default(true),
  playerListMonitoring: integer("player_list_monitoring", { mode: "boolean" }).notNull().default(true),
  workerEndpoint: text("worker_endpoint").notNull().default("http://127.0.0.1:8787"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  updatedBy: text("updated_by"),
});

export const botState = sqliteTable("bot_state", {
  id: integer("id").primaryKey(),
  status: text("status").notNull().default("OFFLINE"),
  address: text("address"),
  version: text("version"),
  username: text("username"),
  connectedAt: integer("connected_at", { mode: "timestamp_ms" }),
  lastAttemptAt: integer("last_attempt_at", { mode: "timestamp_ms" }),
  lastDisconnectReason: text("last_disconnect_reason"),
  reconnectAttempt: integer("reconnect_attempt").notNull().default(0),
  players: text("players", { mode: "json" }).$type<string[]>().notNull().default([]),
  maxPlayers: integer("max_players"),
  motd: text("motd"),
  pingMs: integer("ping_ms"),
  detail: text("detail"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  lastWorkerPushAt: integer("last_worker_push_at", { mode: "timestamp_ms" }),
});

export const activityLogs = sqliteTable("activity_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  at: integer("at", { mode: "timestamp_ms" }).notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
}, (table) => [
  index("activity_logs_at_idx").on(table.at),
  index("activity_logs_type_idx").on(table.type),
]);

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("industrial"),
  compact: integer("compact", { mode: "boolean" }).notNull().default(false),
  refreshMs: integer("refresh_ms").notNull().default(5000),
 notifyOnError: integer("notify_on_error", { mode: "boolean" }).notNull().default(true),
});

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start", { mode: "timestamp_ms" }).notNull(),
  count: integer("count").notNull().default(0),
});

export type UserRow = typeof users.$inferSelect;
export type ActivityLogRow = typeof activityLogs.$inferSelect;
export type AppConfigRow = typeof appConfig.$inferSelect;
export type BotStateRow = typeof botState.$inferSelect;
