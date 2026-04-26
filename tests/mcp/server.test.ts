import { getMcpServerMetadata } from "@mcp/server";

describe("MCP server scaffold", () => {
  it("exposes stable metadata before the real MCP server is implemented", () => {
    expect(getMcpServerMetadata()).toEqual({
      name: "LocalFigmaMcpBridge",
      version: "0.1.0"
    });
  });
});
