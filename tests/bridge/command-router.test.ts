import { ErrorCode } from "@shared/errors";
import { CommandRouter } from "@bridge/command-router";
import { SessionStore } from "@bridge/session-store";
import type { ProtocolMessage } from "@shared/protocol";

function createPairedStore() {
  const store = new SessionStore({
    now: () => new Date("2026-04-26T00:00:00.000Z"),
    sessionIdFactory: () => "ses_test",
    pairingTokenFactory: () => "123456",
    tokenTtlMs: 600000
  });
  store.pairPlugin({
    connectionId: "plugin-1",
    sessionId: "ses_test",
    pairingToken: "123456",
    capabilities: ["read", "mutate"]
  });
  return store;
}

describe("CommandRouter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends command requests to the paired plugin", async () => {
    const sent: ProtocolMessage[] = [];
    const router = new CommandRouter({
      sessionStore: createPairedStore(),
      sendToPlugin: (message) => {
        sent.push(message);
      },
      commandIdFactory: () => "cmd_01",
      messageIdFactory: () => "msg_01",
      now: () => new Date("2026-04-26T00:00:00.000Z"),
      commandTimeoutMs: 1000
    });

    const promise = router.sendCommand({ type: "getSelection", payload: {} });

    expect(sent[0]).toMatchObject({
      type: "command.request",
      sessionId: "ses_test",
      payload: {
        commandId: "cmd_01",
        command: { type: "getSelection", payload: {} }
      }
    });

    router.handlePluginMessage({
      version: 1,
      id: "msg_res_01",
      type: "command.response",
      sessionId: "ses_test",
      sentAt: "2026-04-26T00:00:00.010Z",
      payload: {
        commandId: "cmd_01",
        ok: true,
        result: null
      }
    });

    await expect(promise).resolves.toEqual({
      commandId: "cmd_01",
      ok: true,
      result: null
    });
  });

  it.each([null, false, 0, ""])("resolves falsy success result %s", async (value) => {
    const router = new CommandRouter({
      sessionStore: createPairedStore(),
      sendToPlugin: () => {},
      commandIdFactory: () => "cmd_01",
      messageIdFactory: () => "msg_01",
      now: () => new Date("2026-04-26T00:00:00.000Z"),
      commandTimeoutMs: 1000
    });

    const promise = router.sendCommand({ type: "getSelection", payload: {} });
    router.handlePluginMessage({
      version: 1,
      id: "msg_res_01",
      type: "command.response",
      sessionId: "ses_test",
      sentAt: "2026-04-26T00:00:00.010Z",
      payload: {
        commandId: "cmd_01",
        ok: true,
        result: value
      }
    });

    await expect(promise).resolves.toMatchObject({ ok: true, result: value });
  });

  it("rejects pending commands when the plugin disconnects", async () => {
    const router = new CommandRouter({
      sessionStore: createPairedStore(),
      sendToPlugin: () => {},
      commandIdFactory: () => "cmd_01",
      messageIdFactory: () => "msg_01",
      now: () => new Date("2026-04-26T00:00:00.000Z"),
      commandTimeoutMs: 1000
    });

    const promise = router.sendCommand({ type: "getSelection", payload: {} });
    router.rejectPendingForDisconnect();

    await expect(promise).rejects.toMatchObject({
      code: ErrorCode.PluginDisconnected
    });
  });

  it("rejects timed out commands", async () => {
    const router = new CommandRouter({
      sessionStore: createPairedStore(),
      sendToPlugin: () => {},
      commandIdFactory: () => "cmd_01",
      messageIdFactory: () => "msg_01",
      now: () => new Date("2026-04-26T00:00:00.000Z"),
      commandTimeoutMs: 1000
    });

    const promise = router.sendCommand({ type: "getSelection", payload: {} });
    const expectation = expect(promise).rejects.toMatchObject({
      code: ErrorCode.CommandTimeout
    });

    await vi.advanceTimersByTimeAsync(1001);

    await expectation;
  });
});
