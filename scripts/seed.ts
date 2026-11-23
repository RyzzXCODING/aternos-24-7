import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, getDbClient } from "../src/lib/db/client";
import { activityLogs, appConfig, botState, userSettings, users } from "../src/lib/db/schema";
import { serverConfigSchema } from "../src/lib/shared/validation";

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME?.trim() || "owner";
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must be set and at least 12 characters long.");
  }

  const existing = await db.select({ id: users.id }).from(users).where(eqUsername(username)).limit(1);
  let userId: string;

  if (existing.length > 0) {
    userId = existing[0].id;
    await db.update(users).set({ passwordHash: await bcrypt.hash(password, 12) }).where(eqUsername(username));
    console.log(`Updated password for existing owner "${username}".`);
  } else {
    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      username,
      passwordHash: await bcrypt.hash(password, 12),
      role: "owner",
      createdAt: new Date(),
    });
    await db.insert(userSettings).values({ userId }).onConflictDoNothing();
    console.log(`Created owner "${username}".`);
  }

  const defaults = serverConfigSchema.parse({
    host: process.env.SEED_SERVER_HOST || "localhost",
    port: Number(process.env.SEED_SERVER_PORT || 25565),
    version: process.env.SEED_SERVER_VERSION || "1.21.11",
    username: process.env.SEED_BOT_USERNAME || "AlpoyyBot",
    authMode: process.env.SEED_AUTH_MODE || "offline",
    reconnectEnabled: true,
    reconnectDelayMs: 5000,
    reconnectMaxAttempts: 5,
    chatMonitoring: true,
    playerListMonitoring: true,
    workerEndpoint: process.env.SEED_WORKER_ENDPOINT || "http://127.0.0.1:8787",
  });

  await db.insert(appConfig).values({
    id: 1,
    ...defaults,
    updatedAt: new Date(),
  }).onConflictDoNothing();

  await db.insert(botState).values({
    id: 1,
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
    updatedAt: new Date(),
  }).onConflictDoNothing();

  await db.insert(activityLogs).values({
    at: new Date(),
    type: "system",
    message: "AlpoyyAternos initialized",
    metadata: { userId },
  });

  getDbClient().close();
}

function eqUsername(value: string) {
  return eq(users.username, value);
}


main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
