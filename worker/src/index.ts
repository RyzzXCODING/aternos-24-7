import { loadWorkerConfig } from "./config";
import { BotManager } from "./bot";
import { log } from "./logging";
import { createWorkerServer } from "./server";

function main() {
  const config = loadWorkerConfig();
  const manager = new BotManager(config);
  const server = createWorkerServer(config, manager);

  server.listen(config.port, config.host, () => {
    log("info", "AlpoyyAternos worker listening", {
      host: config.host,
      port: config.port,
      dashboardUrl: config.dashboardUrl,
    }, config);
  });

  const heartbeat = setInterval(() => manager.heartbeat(), 15000);
  heartbeat.unref?.();

  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    log("info", "Worker shutdown started", { signal }, config);
    clearInterval(heartbeat);
    await manager.shutdown();
    server.close(() => {
      log("info", "Worker stopped", {}, config);
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

try {
  main();
} catch (error) {
  console.error("Worker failed to start:", error instanceof Error ? error.message : error);
  process.exit(1);
}
