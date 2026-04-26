import { ErrorCode } from "@shared/errors";
import { createFigmaToolHandlers } from "@mcp/tools";
import { readToolResultJson } from "@mcp/tool-results";
import type { CommandDsl } from "@shared/protocol";

function createBridgeFake() {
  const commands: CommandDsl[] = [];
  return {
    commands,
    bridge: {
      getStatus: () => ({
        server: { running: true, host: "127.0.0.1", port: 3846, transport: "stdio" },
        pairing: {
          sessionId: "ses_test",
          pairingToken: "123456",
          expiresAt: "2026-04-26T00:10:00.000Z"
        },
        plugin: { paired: true as const, capabilities: ["read", "mutate"] }
      }),
      sendCommand: async (command: CommandDsl) => {
        commands.push(command);
        return {
          commandId: "cmd_01",
          ok: true as const,
          result: { node: { id: "123:456", type: "TEXT", name: "Label" } }
        };
      }
    }
  };
}

describe("MCP figma tool handlers", () => {
  it("returns pairing details from figma_status", async () => {
    const fake = createBridgeFake();
    const tools = createFigmaToolHandlers(fake.bridge);

    const result = await tools.figma_status({});

    expect(readToolResultJson(result)).toMatchObject({
      ok: true,
      data: {
        pairing: {
          sessionId: "ses_test",
          pairingToken: "123456",
          expiresAt: "2026-04-26T00:10:00.000Z"
        }
      }
    });
  });

  it("maps read node input to the readNode DSL command", async () => {
    const fake = createBridgeFake();
    const tools = createFigmaToolHandlers(fake.bridge);

    await tools.figma_read_node({ nodeId: "123:456", maxDepth: 2, includeHidden: false });

    expect(fake.commands[0]).toEqual({
      type: "readNode",
      target: { nodeId: "123:456" },
      options: { maxDepth: 2, includeHidden: false }
    });
  });

  it("returns safe errors when the bridge reports plugin disconnection", async () => {
    const tools = createFigmaToolHandlers({
      getStatus: () => ({
        server: { running: true, host: "127.0.0.1", port: 3846, transport: "stdio" },
        pairing: {
          sessionId: "ses_test",
          pairingToken: "123456",
          expiresAt: "2026-04-26T00:10:00.000Z"
        },
        plugin: { paired: false as const }
      }),
      sendCommand: async () => {
        throw { code: ErrorCode.PluginDisconnected, message: "No Figma plugin is paired." };
      }
    });

    const result = await tools.figma_get_selection({});

    expect(readToolResultJson(result)).toMatchObject({
      ok: false,
      error: { code: "PLUGIN_DISCONNECTED" }
    });
  });

  it("rejects invalid tool input before bridge call", async () => {
    const fake = createBridgeFake();
    const tools = createFigmaToolHandlers(fake.bridge);

    const result = await tools.figma_create_node({ type: "VECTOR" });

    expect(fake.commands).toHaveLength(0);
    expect(readToolResultJson(result)).toMatchObject({
      ok: false,
      error: { code: "INVALID_MESSAGE" }
    });
  });
});
