export const ErrorCode = {
  InvalidMessage: "INVALID_MESSAGE",
  UnsupportedVersion: "UNSUPPORTED_VERSION",
  InvalidSession: "INVALID_SESSION",
  PairingRequired: "PAIRING_REQUIRED",
  PairingTokenInvalid: "PAIRING_TOKEN_INVALID",
  PluginAlreadyPaired: "PLUGIN_ALREADY_PAIRED",
  PluginDisconnected: "PLUGIN_DISCONNECTED",
  CommandTimeout: "COMMAND_TIMEOUT",
  PayloadTooLarge: "PAYLOAD_TOO_LARGE",
  NodeNotFound: "NODE_NOT_FOUND",
  PageNotLoaded: "PAGE_NOT_LOADED",
  UnsupportedNodeType: "UNSUPPORTED_NODE_TYPE",
  UnsupportedProperty: "UNSUPPORTED_PROPERTY",
  InvalidParent: "INVALID_PARENT",
  FontLoadFailed: "FONT_LOAD_FAILED",
  MutationNotAllowed: "MUTATION_NOT_ALLOWED",
  BatchPartialFailure: "BATCH_PARTIAL_FAILURE",
  FigmaApiError: "FIGMA_API_ERROR"
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface CodedErrorShape {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export class CodedError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CodedError";
    this.code = code;
    this.details = details;
  }

  toJSON(): CodedErrorShape {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {})
    };
  }
}

export function toCodedError(error: unknown, fallbackMessage = "Unexpected error."): CodedError {
  if (error instanceof CodedError) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    Object.values(ErrorCode).includes(error.code as ErrorCode)
  ) {
    const message =
      "message" in error && typeof error.message === "string" ? error.message : fallbackMessage;
    return new CodedError(error.code as ErrorCode, message);
  }

  if (error instanceof Error) {
    return new CodedError(ErrorCode.FigmaApiError, error.message);
  }

  return new CodedError(ErrorCode.FigmaApiError, fallbackMessage);
}
