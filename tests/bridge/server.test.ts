import WebSocket from "ws";
import { LocalBridgeServer } from "@bridge/server";

const sentAt = "2026-04-26T00:00:00.000Z";

function waitForMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    socket.once("message", (data) => {
      resolve(JSON.parse(data.toString()) as Record<string, unknown>);
    });
  });
}

describe("LocalBridgeServer", () => {
  let server: LocalBridgeServer;

  afterEach(async () => {
    await server?.close();
  });

  it("rejects a wrong pairing token", async () => {
    server = await LocalBridgeServer.start({ port: 0 });
    const address = server.address();
    const socket = new WebSocket(`ws://${address.host}:${address.port}/figma`);
    await new Promise((resolve) => socket.once("open", resolve));

    const rejected = waitForMessage(socket);
    socket.send(
      JSON.stringify({
        version: 1,
        id: "msg_hello",
        type: "plugin.hello",
        sessionId: server.getSession().sessionId,
        sentAt,
        payload: {
          pairingToken: "wrong",
          pluginVersion: "0.1.0",
          editorType: "figma",
          capabilities: ["read"]
        }
      })
    );

    await expect(rejected).resolves.toMatchObject({ type: "session.rejected" });
    socket.close();
  });

  it("accepts correct pairing and forwards commands to the paired plugin", async () => {
    server = await LocalBridgeServer.start({ port: 0 });
    const address = server.address();
    const socket = new WebSocket(`ws://${address.host}:${address.port}/figma`);
    await new Promise((resolve) => socket.once("open", resolve));

    const accepted = waitForMessage(socket);
    socket.send(
      JSON.stringify({
        version: 1,
        id: "msg_hello",
        type: "plugin.hello",
        sessionId: server.getSession().sessionId,
        sentAt,
        payload: {
          pairingToken: server.getSession().pairingToken,
          pluginVersion: "0.1.0",
          editorType: "figma",
          capabilities: ["read"]
        }
      })
    );

    await expect(accepted).resolves.toMatchObject({ type: "session.accepted" });

    const commandFromServer = waitForMessage(socket);
    const commandPromise = server.sendCommand({ type: "getSelection", payload: {} });
    const request = await commandFromServer;
    expect(request).toMatchObject({ type: "command.request" });

    const payload = request.payload as { commandId: string };
    socket.send(
      JSON.stringify({
        version: 1,
        id: "msg_response",
        type: "command.response",
        sessionId: server.getSession().sessionId,
        sentAt,
        payload: {
          commandId: payload.commandId,
          ok: true,
          result: { selectionCount: 0, selection: [] }
        }
      })
    );

    await expect(commandPromise).resolves.toMatchObject({
      ok: true,
      result: { selectionCount: 0, selection: [] }
    });
    socket.close();
  });
});
