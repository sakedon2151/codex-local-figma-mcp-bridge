import { ErrorCode } from "@shared/errors";
import { SessionStore } from "@bridge/session-store";

const fixedNow = new Date("2026-04-26T00:00:00.000Z");

function createStore(now = fixedNow) {
  return new SessionStore({
    now: () => now,
    sessionIdFactory: () => "ses_test",
    pairingTokenFactory: () => "123456",
    tokenTtlMs: 10 * 60 * 1000
  });
}

describe("SessionStore", () => {
  it("creates a session with token and expiry", () => {
    const store = createStore();
    const session = store.getSession();

    expect(session).toMatchObject({
      sessionId: "ses_test",
      pairingToken: "123456",
      createdAt: fixedNow.toISOString(),
      expiresAt: "2026-04-26T00:10:00.000Z"
    });
  });

  it("exposes pairing details in status for MCP clients", () => {
    const store = createStore();

    expect(store.getStatus().pairing).toEqual({
      sessionId: "ses_test",
      pairingToken: "123456",
      expiresAt: "2026-04-26T00:10:00.000Z"
    });
  });

  it("pairs one plugin with the correct token", () => {
    const store = createStore();
    const result = store.pairPlugin({
      connectionId: "plugin-1",
      sessionId: "ses_test",
      pairingToken: "123456",
      capabilities: ["read", "mutate"]
    });

    expect(result).toEqual({ ok: true });
    expect(store.getStatus().plugin).toMatchObject({
      paired: true,
      connectionId: "plugin-1",
      capabilities: ["read", "mutate"]
    });
  });

  it("rejects invalid and expired tokens", () => {
    const invalid = createStore().pairPlugin({
      connectionId: "plugin-1",
      sessionId: "ses_test",
      pairingToken: "wrong",
      capabilities: []
    });

    expect(invalid).toEqual({
      ok: false,
      error: { code: ErrorCode.PairingTokenInvalid, message: "The pairing token is invalid." }
    });

    let currentTime = fixedNow;
    const expiredStore = new SessionStore({
      now: () => currentTime,
      sessionIdFactory: () => "ses_test",
      pairingTokenFactory: () => "123456",
      tokenTtlMs: 10 * 60 * 1000
    });
    currentTime = new Date("2026-04-26T00:11:00.000Z");
    const expired = expiredStore.pairPlugin({
      connectionId: "plugin-1",
      sessionId: "ses_test",
      pairingToken: "123456",
      capabilities: []
    });

    expect(expired.ok).toBe(false);
    if (expired.ok) {
      throw new Error("Expected expired pairing to fail.");
    }
    expect(expired.error?.code).toBe(ErrorCode.PairingTokenInvalid);
  });

  it("rejects a second active plugin", () => {
    const store = createStore();

    store.pairPlugin({
      connectionId: "plugin-1",
      sessionId: "ses_test",
      pairingToken: "123456",
      capabilities: []
    });

    const result = store.pairPlugin({
      connectionId: "plugin-2",
      sessionId: "ses_test",
      pairingToken: "123456",
      capabilities: []
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected second plugin pairing to fail.");
    }
    expect(result.error?.code).toBe(ErrorCode.PluginAlreadyPaired);
  });

  it("marks the paired plugin disconnected", () => {
    const store = createStore();

    store.pairPlugin({
      connectionId: "plugin-1",
      sessionId: "ses_test",
      pairingToken: "123456",
      capabilities: []
    });

    store.markPluginDisconnected("plugin-1");

    expect(store.getStatus().plugin).toEqual({ paired: false });
  });
});
