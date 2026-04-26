import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import { CodedError, ErrorCode } from "@shared/errors";
import type { CommandDsl, CommandResponsePayload, ProtocolMessage } from "@shared/protocol";
import { PROTOCOL_VERSION } from "@shared/protocol";
import { protocolMessageSchema } from "@shared/schemas";
import { CommandRouter } from "./command-router";
import { SessionStore, type BridgeSession, type BridgeStatus } from "./session-store";

export interface LocalBridgeServerOptions {
  host?: string;
  port?: number;
  sessionStore?: SessionStore;
}

export interface LocalBridgeAddress {
  host: string;
  port: number;
}

export class LocalBridgeServer {
  private readonly host: string;
  private readonly sessionStore: SessionStore;
  private readonly webSocketServer: WebSocketServer;
  private pluginSocket: WebSocket | null = null;
  private pluginConnectionId: string | null = null;
  private readonly router: CommandRouter;

  private constructor(
    options: Required<Pick<LocalBridgeServerOptions, "host">> & {
      port: number;
      sessionStore: SessionStore;
      webSocketServer: WebSocketServer;
    }
  ) {
    this.host = options.host;
    this.sessionStore = options.sessionStore;
    this.webSocketServer = options.webSocketServer;
    this.router = new CommandRouter({
      sessionStore: this.sessionStore,
      sendToPlugin: (message) => {
        this.pluginSocket?.send(JSON.stringify(message));
      }
    });
    this.webSocketServer.on("connection", (socket) => this.handleConnection(socket));
  }

  static async start(options: LocalBridgeServerOptions = {}): Promise<LocalBridgeServer> {
    const host = options.host ?? "127.0.0.1";
    const port = options.port ?? 3846;
    const webSocketServer = new WebSocketServer({ host, port, path: "/figma" });
    await new Promise<void>((resolve) => webSocketServer.once("listening", resolve));
    return new LocalBridgeServer({
      host,
      port,
      sessionStore: options.sessionStore ?? new SessionStore(),
      webSocketServer
    });
  }

  address(): LocalBridgeAddress {
    const address = this.webSocketServer.address() as AddressInfo;
    return {
      host: this.host,
      port: address.port
    };
  }

  getSession(): BridgeSession {
    return this.sessionStore.getSession();
  }

  getStatus(): BridgeStatus {
    const address = this.address();
    return this.sessionStore.getStatus({
      running: true,
      host: address.host,
      port: address.port,
      transport: "stdio"
    });
  }

  sendCommand(command: CommandDsl): Promise<CommandResponsePayload> {
    return this.router.sendCommand(command);
  }

  async close(): Promise<void> {
    for (const client of this.webSocketServer.clients) {
      client.close();
    }
    await new Promise<void>((resolve, reject) => {
      this.webSocketServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private handleConnection(socket: WebSocket): void {
    const connectionId = `plugin_${randomUUID()}`;
    let paired = false;

    socket.on("message", (raw) => {
      const message = this.parseMessage(raw.toString());
      if (!message) {
        this.rejectAndClose(socket, connectionId, ErrorCode.InvalidMessage, "Invalid message.");
        return;
      }

      if (!paired) {
        if (message.type !== "plugin.hello") {
          this.rejectAndClose(
            socket,
            connectionId,
            ErrorCode.PairingRequired,
            "Pairing is required before sending commands."
          );
          return;
        }

        const helloPayload = message.payload as {
          pairingToken: string;
          capabilities: string[];
        };
        const result = this.sessionStore.pairPlugin({
          connectionId,
          sessionId: message.sessionId,
          pairingToken: helloPayload.pairingToken,
          capabilities: helloPayload.capabilities
        });

        if (!result.ok) {
          this.rejectAndClose(socket, connectionId, result.error.code, result.error.message);
          return;
        }

        paired = true;
        this.pluginSocket = socket;
        this.pluginConnectionId = connectionId;
        this.send(socket, {
          version: PROTOCOL_VERSION,
          id: `msg_${randomUUID()}`,
          type: "session.accepted",
          sessionId: this.sessionStore.getSession().sessionId,
          sentAt: new Date().toISOString(),
          payload: {
            serverVersion: "0.1.0",
            heartbeatIntervalMs: 5000,
            commandTimeoutMs: 30000,
            maxPayloadBytes: 1048576
          }
        });
        return;
      }

      if (message.type === "heartbeat.ping") {
        this.sessionStore.markHeartbeat(connectionId);
        this.send(socket, {
          version: PROTOCOL_VERSION,
          id: `msg_${randomUUID()}`,
          type: "heartbeat.pong",
          sessionId: this.sessionStore.getSession().sessionId,
          sentAt: new Date().toISOString(),
          payload: {
            serverUptimeMs: process.uptime() * 1000
          }
        });
        return;
      }

      this.router.handlePluginMessage(message);
    });

    socket.on("close", () => {
      if (this.pluginConnectionId === connectionId) {
        this.pluginSocket = null;
        this.pluginConnectionId = null;
        this.sessionStore.markPluginDisconnected(connectionId);
        this.router.rejectPendingForDisconnect();
      }
    });
  }

  private parseMessage(raw: string): ProtocolMessage | null {
    try {
      const parsed = protocolMessageSchema.safeParse(JSON.parse(raw));
      return parsed.success ? (parsed.data as ProtocolMessage) : null;
    } catch {
      return null;
    }
  }

  private rejectAndClose(
    socket: WebSocket,
    connectionId: string,
    code: string,
    message: string
  ): void {
    this.send(socket, {
      version: PROTOCOL_VERSION,
      id: `msg_${randomUUID()}`,
      type: "session.rejected",
      sessionId: this.sessionStore.getSession().sessionId,
      sentAt: new Date().toISOString(),
      payload: {
        error: new CodedError(code as ErrorCode, message).toJSON()
      }
    });
    this.sessionStore.markPluginDisconnected(connectionId);
    socket.close();
  }

  private send(socket: WebSocket, message: ProtocolMessage): void {
    socket.send(JSON.stringify(message));
  }
}
