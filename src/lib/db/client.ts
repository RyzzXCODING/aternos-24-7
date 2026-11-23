import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __alpoyyClient?: Client;
  __alpoyyDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function resolveUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) return configured;
  const file = resolve(process.cwd(), "data", "alpoyy.db");
  mkdirSync(dirname(file), { recursive: true });
  return `file:${file}`;
}

function getClient(): Client {
  if (!globalForDb.__alpoyyClient) {
    globalForDb.__alpoyyClient = createClient({
      url: resolveUrl(),
      authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
    });
  }
  return globalForDb.__alpoyyClient;
}

export const db =
  globalForDb.__alpoyyDb ??
  (globalForDb.__alpoyyDb = drizzle(getClient(), { schema }));

export function getDbClient(): Client {
  return getClient();
}

export { schema };
