import { getCurrentUser } from "./auth";
import { fail, ok, rateLimited, serverError, unauthorized } from "./http";
import { checkRateLimit } from "./rate-limit";
import { addLog, getServerConfig, saveBotState } from "./store";
import { emptyBotState, type BotState } from "./shared/types";
import { sendWorkerCommand, WorkerUnavailableError } from "./worker-client";

export type BotCommand = "start" | "stop" | "restart";

export async function handleBotCommand(command: BotCommand) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const rate = await checkRateLimit(`bot:${user.id}`, 30, 60_000);
    if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);

    const config = await getServerConfig();
    if (!config.host || !config.username) {
      return fail(
        "CONFIG_INCOMPLETE",
        "Set a server address and bot username in Server Configuration before starting the bot",
        422,
      );
    }

    const response = await sendWorkerCommand(config.workerEndpoint, command, config);
    const state: BotState = response.state
      ? {
          ...response.state,
          connectedAt: response.state.connectedAt || null,
          lastAttemptAt: response.state.lastAttemptAt || null,
          updatedAt: response.state.updatedAt || new Date().toISOString(),
        }
      : { ...emptyBotState(), status: "OFFLINE", detail: "Worker did not report a state" };

    await saveBotState(state, false);
    await addLog(
      command === "stop" ? "disconnection" : "connection",
      `Bot ${command} command ${response.ok ? "completed" : "failed"}`,
      { user: user.username, status: state.status, workerMessage: response.message },
    );

    if (!response.ok) return fail("WORKER_ERROR", response.message || "Worker rejected the command", 502, state);
    return ok({ state, message: response.message || `Bot ${command} command accepted`, worker: response.health });
  } catch (error) {
    if (error instanceof WorkerUnavailableError) {
      await addLog("error", `Bot ${command} failed: ${error.message}`);
      return fail(
        "WORKER_UNAVAILABLE",
        `Worker is unavailable: ${error.message}. Start the worker and try again.`,
        503,
      );
    }
    return serverError(error);
  }
}
