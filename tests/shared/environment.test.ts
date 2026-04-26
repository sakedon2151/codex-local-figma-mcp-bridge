import { ErrorCode } from "@shared/errors";
import { PROTOCOL_VERSION } from "@shared/protocol";

describe("development scaffold", () => {
  it("exposes shared protocol constants for tests and runtime code", () => {
    expect(PROTOCOL_VERSION).toBe(1);
    expect(ErrorCode.PluginDisconnected).toBe("PLUGIN_DISCONNECTED");
  });
});
