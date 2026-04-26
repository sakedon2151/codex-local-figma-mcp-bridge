const statusElement = document.getElementById("status");
const connectButton = document.getElementById("connect") as HTMLButtonElement | null;
const serverUrlInput = document.getElementById("server-url") as HTMLInputElement | null;
const sessionIdInput = document.getElementById("session-id") as HTMLInputElement | null;
const pairingTokenInput = document.getElementById("pairing-token") as HTMLInputElement | null;

let socket: WebSocket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function setStatus(message: string): void {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function messageId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function send(message: unknown): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function startHeartbeat(sessionId: string): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  const startedAt = Date.now();
  heartbeatTimer = setInterval(() => {
    send({
      version: 1,
      id: messageId("msg_ping"),
      type: "heartbeat.ping",
      sessionId,
      sentAt: new Date().toISOString(),
      payload: {
        pluginUptimeMs: Date.now() - startedAt
      }
    });
  }, 5000);
}

function connect(): void {
  const serverUrl = serverUrlInput?.value || "ws://localhost:3846/figma";
  const sessionId = sessionIdInput?.value.trim();
  const pairingToken = pairingTokenInput?.value.trim();

  if (!sessionId || !pairingToken) {
    setStatus("Session ID and pairing token are required.");
    return;
  }

  socket?.close();
  socket = new WebSocket(serverUrl);
  setStatus("Connecting...");

  socket.onopen = () => {
    send({
      version: 1,
      id: messageId("msg_hello"),
      type: "plugin.hello",
      sessionId,
      sentAt: new Date().toISOString(),
      payload: {
        pairingToken,
        pluginVersion: "0.1.0",
        editorType: "figma",
        capabilities: ["read", "mutate", "batch", "progress"]
      }
    });
  };

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data as string) as {
      type?: string;
      payload?: {
        commandId?: string;
        command?: unknown;
        error?: { message?: string };
      };
    };

    if (message.type === "session.accepted") {
      setStatus("Paired with local bridge.");
      startHeartbeat(sessionId);
      return;
    }

    if (message.type === "session.rejected") {
      setStatus(message.payload?.error?.message ?? "Pairing rejected.");
      socket?.close();
      return;
    }

    if (message.type === "command.request" && message.payload?.commandId) {
      parent.postMessage(
        {
          pluginMessage: {
            type: "execute-command",
            commandId: message.payload.commandId,
            command: message.payload.command
          }
        },
        "*"
      );
    }
  };

  socket.onclose = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    setStatus("Disconnected.");
  };

  socket.onerror = () => {
    setStatus("Connection error.");
  };
}

connectButton?.addEventListener("click", connect);

window.onmessage = (event) => {
  const message = event.data.pluginMessage as
    | {
        type: "command-result";
        commandId: string;
        result: unknown;
      }
    | {
        type: "command-error";
        commandId: string;
        error: { code: string; message: string };
      }
    | {
        type: "command-progress";
        commandId: string;
        progress: {
          status: string;
          progress: number;
          processedItems: number;
          totalItems: number;
          message: string;
        };
      }
    | undefined;

  if (!message) {
    return;
  }

  const sessionId = sessionIdInput?.value.trim() ?? "";
  if (message.type === "command-progress") {
    send({
      version: 1,
      id: messageId("msg_progress"),
      type: "command.progress",
      sessionId,
      sentAt: new Date().toISOString(),
      payload: {
        commandId: message.commandId,
        ...message.progress
      }
    });
    setStatus(message.progress.message);
    return;
  }

  send({
    version: 1,
    id: messageId("msg_response"),
    type: "command.response",
    sessionId,
    sentAt: new Date().toISOString(),
    payload:
      message.type === "command-result"
        ? {
            commandId: message.commandId,
            ok: true,
            result: message.result
          }
        : {
            commandId: message.commandId,
            ok: false,
            error: message.error
          }
  });
  setStatus(message.type === "command-result" ? "Command completed." : message.error.message);
};

setStatus("Not connected.");
