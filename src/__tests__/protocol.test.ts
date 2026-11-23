import { describe, expect, it } from "vitest";
import { NonceCache, signRequest, signedHeaders, verifySignature } from "@/lib/shared/protocol";

describe("worker protocol signing", () => {
  it("verifies a valid signed request and rejects replay", () => {
    const secret = "x".repeat(32);
    const body = JSON.stringify({ hello: "world" });
    const signed = signRequest(secret, "web", "POST", "/v1/command", body);
    const headers = new Map(Object.entries(signedHeaders(signed)));
    const nonces = new NonceCache();

    const ok = verifySignature({ secret, expectedKeyId: "web", method: "POST", path: "/v1/command", body, headers, nonces });
    expect(ok.ok).toBe(true);

    const replay = verifySignature({ secret, expectedKeyId: "web", method: "POST", path: "/v1/command", body, headers, nonces });
    expect(replay.ok).toBe(false);
  });
});
