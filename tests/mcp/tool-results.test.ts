import { createErrorResult, createSuccessResult, readToolResultJson } from "@mcp/tool-results";
import { ErrorCode } from "@shared/errors";

describe("MCP tool result helpers", () => {
  it("formats successful JSON tool results", () => {
    const result = createSuccessResult(
      { selectionCount: 0 },
      { commandId: "cmd_01", durationMs: 5 }
    );

    expect(readToolResultJson(result)).toEqual({
      ok: true,
      data: { selectionCount: 0 },
      meta: { commandId: "cmd_01", durationMs: 5 }
    });
  });

  it("formats safe error JSON tool results", () => {
    const result = createErrorResult(
      { code: ErrorCode.PluginDisconnected, message: "No plugin paired." },
      { commandId: "cmd_01", durationMs: 5 }
    );

    expect(readToolResultJson(result)).toEqual({
      ok: false,
      error: { code: "PLUGIN_DISCONNECTED", message: "No plugin paired." },
      meta: { commandId: "cmd_01", durationMs: 5 }
    });
  });
});
