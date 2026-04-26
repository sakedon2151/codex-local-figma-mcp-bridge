import { randomInt, randomUUID } from "node:crypto";
import { CodedError, ErrorCode, type CodedErrorShape } from "@shared/errors";

export interface SessionStoreOptions {
  now?: () => Date;
  sessionIdFactory?: () => string;
  pairingTokenFactory?: () => string;
  tokenTtlMs?: number;
}

export interface BridgeSession {
  sessionId: string;
  pairingToken: string;
  createdAt: string;
  expiresAt: string;
}

export interface PairPluginInput {
  connectionId: string;
  sessionId: string;
  pairingToken: string;
  capabilities: string[];
}

export type PairPluginResult = { ok: true } | { ok: false; error: CodedErrorShape };

export interface BridgeStatus {
  server?: {
    running: boolean;
    host: string;
    port: number;
    transport: "stdio";
  };
  pairing: {
    sessionId: string;
    pairingToken: string;
    expiresAt: string;
  };
  plugin:
    | {
        paired: true;
        connectionId: string;
        capabilities: string[];
        lastHeartbeatAt?: string;
      }
    | {
        paired: false;
      };
}

interface PluginState {
  connectionId: string;
  capabilities: string[];
  lastHeartbeatAt?: string;
}

function createPairingToken(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export class SessionStore {
  private readonly now: () => Date;
  private readonly session: BridgeSession;
  private plugin: PluginState | null = null;

  constructor(options: SessionStoreOptions = {}) {
    this.now = options.now ?? (() => new Date());
    const createdAt = this.now();
    const tokenTtlMs = options.tokenTtlMs ?? 10 * 60 * 1000;
    this.session = {
      sessionId: options.sessionIdFactory?.() ?? `ses_${randomUUID()}`,
      pairingToken: options.pairingTokenFactory?.() ?? createPairingToken(),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + tokenTtlMs).toISOString()
    };
  }

  getSession(): BridgeSession {
    return { ...this.session };
  }

  getPairedConnectionId(): string | null {
    return this.plugin?.connectionId ?? null;
  }

  getStatus(server?: BridgeStatus["server"]): BridgeStatus {
    return {
      ...(server ? { server } : {}),
      pairing: {
        sessionId: this.session.sessionId,
        pairingToken: this.session.pairingToken,
        expiresAt: this.session.expiresAt
      },
      plugin: this.plugin
        ? {
            paired: true,
            connectionId: this.plugin.connectionId,
            capabilities: [...this.plugin.capabilities],
            ...(this.plugin.lastHeartbeatAt ? { lastHeartbeatAt: this.plugin.lastHeartbeatAt } : {})
          }
        : { paired: false }
    };
  }

  pairPlugin(input: PairPluginInput): PairPluginResult {
    if (this.plugin) {
      return {
        ok: false,
        error: new CodedError(
          ErrorCode.PluginAlreadyPaired,
          "A Figma plugin is already paired."
        ).toJSON()
      };
    }

    if (
      input.sessionId !== this.session.sessionId ||
      input.pairingToken !== this.session.pairingToken ||
      this.now().getTime() > Date.parse(this.session.expiresAt)
    ) {
      return {
        ok: false,
        error: new CodedError(
          ErrorCode.PairingTokenInvalid,
          "The pairing token is invalid."
        ).toJSON()
      };
    }

    this.plugin = {
      connectionId: input.connectionId,
      capabilities: [...input.capabilities]
    };
    return { ok: true };
  }

  markHeartbeat(connectionId: string): void {
    if (this.plugin?.connectionId === connectionId) {
      this.plugin.lastHeartbeatAt = this.now().toISOString();
    }
  }

  markPluginDisconnected(connectionId: string): void {
    if (this.plugin?.connectionId === connectionId) {
      this.plugin = null;
    }
  }
}
