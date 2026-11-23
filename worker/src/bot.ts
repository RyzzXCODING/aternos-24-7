import mineflayer, { type Bot } from "mineflayer";
import { signRequest, signedHeaders } from "../../src/lib/shared/protocol";
import {
  emptyBotState,
  type BotState,
  type EventType,
  type ServerConfig,
  type WorkerEvent,
  type WorkerHealth,
} from "../../src/lib/shared/types";
import type { WorkerConfig } from "./config";
import { log } from "./logging";

const startedAt = Date.now();

export class BotManager {
  private state: BotState = emptyBotState();
  private bot: Bot | null = null;
  private config: ServerConfig | null = null;
  private generation = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private playerTimer: ReturnType<typeof setInterval> | null = null;
  private intentionalStop = true;
  private lastError: string | null = null;

  constructor(private readonly worker: WorkerConfig) {}

  getState(): BotState {
    return { ...this.state, players: [...this.state.players] };
  }

  getHealth(): WorkerHealth {
    return {
      alive: true,
      version: "1.0.0",
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      botStatus: this.state.status,
      configLoaded: Boolean(this.config),
      lastError: this.lastError,
    };
  }

  async start(config: ServerConfig): Promise<void> {
    this.config = config;
    this.intentionalStop = false;
    this.generation += 1;
    this.state = {
      ...emptyBotState(),
      status: "CONNECTING",
      address: `${config.host}:${config.port}`,
      version: config.version,
      username: config.username,
      lastAttemptAt: new Date().toISOString(),
      detail: "Opening connection",
    };
    this.lastError = null;
    this.push([{ type: "connection", message: `Connecting to ${this.state.address} as ${config.username}` }]);
    this.connect(this.generation);
  }

  async stop(reason = "Stopped by owner"): Promise<void> {
    this.intentionalStop = true;
    this.generation += 1;
    this.clearTimers();
    const active = this.bot;
    this.bot = null;
    if (active) {
      try {
        active.quit(reason);
      } catch {
        try { active.end(reason); } catch { /* already closed */ }
      }
    }
    this.state = {
      ...this.state,
      status: "STOPPED",
      connectedAt: null,
      lastDisconnectReason: reason,
      reconnectAttempt: 0,
      players: [],
      maxPlayers: null,
      detail: reason,
      updatedAt: new Date().toISOString(),
    };
    this.push([{ type: "disconnection", message: `Bot stopped: ${reason}` }]);
  }

  async shutdown(): Promise<void> {
    await this.stop("Worker is shutting down");
  }

  private connect(generation: number): void {
    const config = this.config;
    if (!config || generation !== this.generation) return;
    if (this.bot) {
      try { this.bot.end("Restarting connection"); } catch { /* already closed */ }
      this.bot = null;
    }

    this.state = {
      ...this.state,
      status: "CONNECTING",
      lastAttemptAt: new Date().toISOString(),
      detail: generation === 1 ? "Opening connection" : `Reconnect attempt ${this.state.reconnectAttempt}`,
    };
    this.push([]);

    let bot: Bot;
    try {
      bot = mineflayer.createBot({
        host: config.host,
        port: config.port,
        username: config.username,
        version: config.version,
        auth: config.authMode === "microsoft" ? "microsoft" : "offline",
        ...(config.authMode === "microsoft" && this.worker.minecraftToken
          ? { accessToken: this.worker.minecraftToken }
          : {}),
      });
    } catch (error) {
      this.handleFailure(generation, error instanceof Error ? error.message : "Could not create bot");
      return;
    }

    this.bot = bot;

    bot.once("login", () => {
      if (generation !== this.generation) return;
      this.state = {
        ...this.state,
        status: "ONLINE",
        connectedAt: new Date().toISOString(),
        lastDisconnectReason: null,
        reconnectAttempt: 0,
        detail: "Connected",
        updatedAt: new Date().toISOString(),
      };
      this.lastError = null;
      this.push([{ type: "connection", message: `Connected to ${this.state.address}` }]);
      this.startPlayerMonitoring(generation, bot);
    });

    bot.on("chat", (username, message) => {
      if (generation !== this.generation || !config.chatMonitoring) return;
      const clean = message.replace(/§./g, "").trim().slice(0, 300);
      if (!clean) return;
      this.push([{ type: "connection", message: `Chat <${username}> ${clean}` }]);
    });

    bot.on("playerJoined", (player) => {
      if (generation !== this.generation || !config.playerListMonitoring) return;
      this.updatePlayers(bot);
      this.push([{ type: "connection", message: `${player.username} joined the server` }]);
    });

    bot.on("playerLeft", (player) => {
      if (generation !== this.generation || !config.playerListMonitoring) return;
      this.updatePlayers(bot);
      this.push([{ type: "connection", message: `${player.username} left the server` }]);
    });

    bot.on("kicked", (reason) => {
      if (generation !== this.generation) return;
      this.handleFailure(generation, `Kicked: ${reason.replace(/§./g, "")}`);
    });

    bot.on("error", (error) => {
      if (generation !== this.generation) return;
      this.handleFailure(generation, error.message);
    });

    bot.once("end", (reason) => {
      if (generation !== this.generation) return;
      this.handleFailure(generation, reason || "Connection closed");
    });
  }

  private startPlayerMonitoring(generation: number, bot: Bot): void {
    if (this.playerTimer) clearInterval(this.playerTimer);
    if (!this.config?.playerListMonitoring) return;
    this.updatePlayers(bot);
    this.playerTimer = setInterval(() => {
      if (generation !== this.generation) return;
      this.updatePlayers(bot);
      this.push([]);
    }, 15000);
    this.playerTimer.unref?.();
  }

  private updatePlayers(bot: Bot): void {
    const players = Object.keys(bot.players || {}).slice(0, 100);
    this.state = {
      ...this.state,
      players,
      maxPlayers: players.length || null,
      motd: typeof (bot as unknown as { motd?: string }).motd === "string"
        ? (bot as unknown as { motd: string }).motd.replace(/§./g, "").slice(0, 500)
        : this.state.motd,
      updatedAt: new Date().toISOString(),
    };
  }

  private handleFailure(generation: number, reason: string): void {
    if (generation !== this.generation) return;
    this.clearTimers();
    const safeReason = reason.replace(/§./g, "").slice(0, 500);
    this.lastError = safeReason;
    this.bot = null;

    if (this.intentionalStop) {
      this.state = { ...this.state, status: "STOPPED", detail: safeReason, connectedAt: null, updatedAt: new Date().toISOString() };
      return;
    }

    const config = this.config;
    const canRetry = Boolean(config?.reconnectEnabled && this.state.reconnectAttempt < config.reconnectMaxAttempts);
    if (canRetry && config) {
      const attempt = this.state.reconnectAttempt + 1;
      this.state = {
        ...this.state,
        status: "CONNECTING",
        reconnectAttempt: attempt,
        connectedAt: null,
        players: [],
        lastDisconnectReason: safeReason,
        detail: `Reconnecting in ${config.reconnectDelayMs / 1000}s (attempt ${attempt}/${config.reconnectMaxAttempts})`,
        updatedAt: new Date().toISOString(),
      };
      this.push([{ type: "disconnection", message: `Disconnected (${safeReason}). Scheduling reconnect ${attempt}/${config.reconnectMaxAttempts}` }]);
      this.reconnectTimer = setTimeout(() => this.connect(generation), config.reconnectDelayMs);
      this.reconnectTimer.unref?.();
    } else {
      this.intentionalStop = true;
      this.state = {
        ...this.state,
        status: "ERROR",
        connectedAt: null,
        players: [],
        lastDisconnectReason: safeReason,
        detail: "Connection failed and no further reconnect attempts will be made",
        updatedAt: new Date().toISOString(),
      };
      this.push([{ type: "error", message: `Connection ended: ${safeReason}` }]);
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.playerTimer) clearInterval(this.playerTimer);
    this.reconnectTimer = null;
    this.playerTimer = null;
  }

  push(events: WorkerEvent[] = []): void {
    this.state = { ...this.state, updatedAt: new Date().toISOString() };
    for (const event of events) {
      const type: EventType = event.type;
      log(type === "error" ? "error" : "info", event.message, { eventType: type }, this.worker);
    }

    if (!this.worker.dashboardUrl) return;
    const body = JSON.stringify({ state: this.getState(), events });
    const path = "/api/internal/worker/state";
    const signed = signRequest(this.worker.sharedSecret, this.worker.pushKeyId, "POST", path, body);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    fetch(`${this.worker.dashboardUrl.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers: signedHeaders(signed),
      body,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) log("warn", "Dashboard rejected state push", { status: response.status }, this.worker);
      })
      .catch((error) => {
        log("warn", "Could not push state to dashboard", { error: error instanceof Error ? error.message : "unknown" }, this.worker);
      })
      .finally(() => clearTimeout(timer));
  }

  heartbeat(): void {
    if (this.state.status !== "STOPPED" && this.state.status !== "OFFLINE") this.push([]);
  }
}
