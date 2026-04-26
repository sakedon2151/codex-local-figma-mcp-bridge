import { CodedError, ErrorCode } from "@shared/errors";
import type { CommandDsl, CommandResponsePayload, ProtocolMessage } from "@shared/protocol";
import { PROTOCOL_VERSION } from "@shared/protocol";
import { protocolMessageSchema } from "@shared/schemas";
import type { SessionStore } from "./session-store";

export interface CommandRouterOptions {
  sessionStore: SessionStore;
  sendToPlugin: (message: ProtocolMessage) => void;
  commandIdFactory?: () => string;
  messageIdFactory?: () => string;
  now?: () => Date;
  commandTimeoutMs?: number;
  progressTimeoutMs?: number;
}

interface PendingCommand {
  resolve: (payload: CommandResponsePayload) => void;
  reject: (error: CodedError) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class CommandRouter {
  private readonly sessionStore: SessionStore;
  private readonly sendToPlugin: (message: ProtocolMessage) => void;
  private readonly commandIdFactory: () => string;
  private readonly messageIdFactory: () => string;
  private readonly now: () => Date;
  private readonly commandTimeoutMs: number;
  private readonly progressTimeoutMs: number;
  private readonly pending = new Map<string, PendingCommand>();

  constructor(options: CommandRouterOptions) {
    this.sessionStore = options.sessionStore;
    this.sendToPlugin = options.sendToPlugin;
    this.commandIdFactory = options.commandIdFactory ?? (() => `cmd_${crypto.randomUUID()}`);
    this.messageIdFactory = options.messageIdFactory ?? (() => `msg_${crypto.randomUUID()}`);
    this.now = options.now ?? (() => new Date());
    this.commandTimeoutMs = options.commandTimeoutMs ?? 30_000;
    this.progressTimeoutMs = options.progressTimeoutMs ?? 60_000;
  }

  sendCommand(
    command: CommandDsl,
    timeoutMs = this.commandTimeoutMs
  ): Promise<CommandResponsePayload> {
    const session = this.sessionStore.getSession();
    if (!this.sessionStore.getPairedConnectionId()) {
      return Promise.reject(
        new CodedError(ErrorCode.PluginDisconnected, "No Figma plugin is paired.")
      );
    }

    const commandId = this.commandIdFactory();
    const message: ProtocolMessage = {
      version: PROTOCOL_VERSION,
      id: this.messageIdFactory(),
      type: "command.request",
      sessionId: session.sessionId,
      sentAt: this.now().toISOString(),
      payload: {
        commandId,
        command
      }
    };

    return new Promise((resolve, reject) => {
      const timeout = this.createTimeout(commandId, timeoutMs);
      this.pending.set(commandId, {
        resolve,
        reject,
        timeout
      });
      this.sendToPlugin(message);
    });
  }

  handlePluginMessage(message: unknown): void {
    const parsed = protocolMessageSchema.safeParse(message);
    if (!parsed.success) {
      return;
    }

    if (parsed.data.type === "command.progress") {
      const pending = this.pending.get(parsed.data.payload.commandId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.timeout = this.createTimeout(parsed.data.payload.commandId, this.progressTimeoutMs);
      }
      return;
    }

    if (parsed.data.type !== "command.response") {
      return;
    }

    const pending = this.pending.get(parsed.data.payload.commandId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pending.delete(parsed.data.payload.commandId);

    if (parsed.data.payload.ok) {
      pending.resolve(parsed.data.payload);
      return;
    }

    pending.reject(
      new CodedError(
        parsed.data.payload.error.code as ErrorCode,
        parsed.data.payload.error.message,
        parsed.data.payload.error.details
      )
    );
  }

  rejectPendingForDisconnect(): void {
    for (const [commandId, pending] of this.pending.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(
        new CodedError(ErrorCode.PluginDisconnected, "The Figma plugin disconnected.")
      );
      this.pending.delete(commandId);
    }
  }

  private createTimeout(commandId: string, timeoutMs: number): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      const pending = this.pending.get(commandId);
      if (!pending) {
        return;
      }
      this.pending.delete(commandId);
      pending.reject(new CodedError(ErrorCode.CommandTimeout, "Command timed out."));
    }, timeoutMs);
  }
}
