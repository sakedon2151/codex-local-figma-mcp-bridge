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
