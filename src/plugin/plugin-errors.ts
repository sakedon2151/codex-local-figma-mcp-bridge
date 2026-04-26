import type { ErrorCode } from "@shared/errors";

export class PluginCommandError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "PluginCommandError";
    this.code = code;
    this.details = details;
  }
}
