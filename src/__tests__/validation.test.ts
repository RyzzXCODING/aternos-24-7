import { describe, expect, it } from "vitest";
import { serverConfigSchema } from "@/lib/shared/validation";

describe("serverConfigSchema", () => {
  const base = {
    host: "play.example.com",
    port: 25565,
    version: "1.21.11",
    username: "AlpoyyBot",
    authMode: "offline" as const,
    reconnectEnabled: true,
    reconnectDelayMs: 5000,
    reconnectMaxAttempts: 5,
    chatMonitoring: true,
    playerListMonitoring: true,
    workerEndpoint: "http://127.0.0.1:8787",
  };

  it("accepts valid offline config", () => {
    const parsed = serverConfigSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it("rejects microsoft auth mode", () => {
    const parsed = serverConfigSchema.safeParse({ ...base, authMode: "microsoft" });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid host and port", () => {
    const parsed = serverConfigSchema.safeParse({ ...base, host: "http://bad host", port: 70000 });
    expect(parsed.success).toBe(false);
  });
});
