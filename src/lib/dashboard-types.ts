import type { BotState, ServerConfig, WorkerHealth } from "./shared/types";

export interface StatusData {
  bot: BotState;
  server: {
    address: string | null;
    host: string;
    port: number;
    version: string;
    username: string;
  };
  worker: {
    alive: boolean;
    version: string | null;
    error: string | null;
    latencyMs: number | null;
    lastPushAt: string | null;
  };
  system: {
    api: string;
    database: string;
    dbLatencyMs: number;
    uptimeSeconds: number;
    node: string;
  };
  configUpdatedAt: string;
  connectionDurationMs: number | null;
}

export interface ConfigData {
  config: ServerConfig;
  updatedAt: string;
  updatedBy: string | null;
  secrets: {
    workerSharedSecretConfigured: boolean;
    minecraftTokenConfigured: boolean;
  };
}

export interface LogItem {
  id: number;
  key: string;
  at: string;
  type: string;
  message: string;
  metadata: Record<string, unknown> | null;
}

export interface LogsData {
  items: LogItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface SettingsData {
  theme: "industrial";
  compact: boolean;
  refreshMs: number;
  notifyOnError: boolean;
}

export interface MeData {
  user: { id: string; username: string; role: string };
  settings: SettingsData;
}

export interface WorkerCommandData {
  state: BotState;
  message: string;
  worker?: WorkerHealth;
}
