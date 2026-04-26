export const PROTOCOL_VERSION = 1 as const;

export type ProtocolMessageType =
  | "plugin.hello"
  | "session.accepted"
  | "session.rejected"
  | "heartbeat.ping"
  | "heartbeat.pong"
  | "command.request"
  | "command.response"
  | "command.progress";

export type NodeType = "FRAME" | "RECTANGLE" | "TEXT";

export type CommandType =
  | "getPluginStatus"
  | "getSelection"
  | "readNode"
  | "readTree"
  | "createNode"
  | "updateNode"
  | "deleteNode"
  | "batch";

export interface ProtocolErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ProtocolMessage<TPayload = unknown> {
  version: typeof PROTOCOL_VERSION;
  id: string;
  type: ProtocolMessageType;
  sessionId: string;
  sentAt: string;
  payload: TPayload;
}

export interface CommandResponsePayload {
  commandId: string;
  ok: boolean;
  result?: unknown;
  error?: ProtocolErrorPayload;
}

export interface CommandProgressPayload {
  commandId: string;
  status: "started" | "in_progress" | "completed" | "error";
  progress: number;
  processedItems: number;
  totalItems: number;
  message: string;
}

export interface CommandTarget {
  nodeId?: string;
}

export interface CommandDsl {
  type: CommandType;
  target?: CommandTarget;
  payload?: Record<string, unknown>;
  options?: Record<string, unknown>;
}
