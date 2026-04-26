import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { LocalBridgeServer } from "@bridge/server";
import { createFigmaToolHandlers, type FigmaBridgeForTools } from "./tools";

export interface McpServerMetadata {
  name: "LocalFigmaMcpBridge";
  version: "0.1.0";
}

export function getMcpServerMetadata(): McpServerMetadata {
  return {
    name: "LocalFigmaMcpBridge",
    version: "0.1.0"
  };
}

export function createMcpServer(bridge: FigmaBridgeForTools): McpServer {
  const metadata = getMcpServerMetadata();
  const server = new McpServer({
    name: metadata.name,
    version: metadata.version
  });
  const tools = createFigmaToolHandlers(bridge);

  server.registerTool(
    "figma_status",
    {
      description:
        "Use first for the local-figma MCP bridge. Reports bridge status and returns pairing details including sessionId, pairingToken, and expiresAt for the Figma plugin UI.",
      inputSchema: z.object({}).passthrough()
    },
    (input) => tools.figma_status(input)
  );
  server.registerTool(
    "figma_get_selection",
    {
      description: "Read the current Figma selection.",
      inputSchema: z.object({ includeNodeSummary: z.boolean().optional() }).strict()
    },
    (input) => tools.figma_get_selection(input)
  );
  server.registerTool(
    "figma_read_node",
    {
      description: "Read a Figma node by ID.",
      inputSchema: z
        .object({
          nodeId: z.string(),
          maxDepth: z.number().optional(),
          includeHidden: z.boolean().optional(),
          includeGeometry: z.boolean().optional()
        })
        .strict()
    },
    (input) => tools.figma_read_node(input)
  );
  server.registerTool(
    "figma_read_tree",
    {
      description: "Read a bounded Figma subtree.",
      inputSchema: z
        .object({
          rootNodeId: z.string().optional(),
          maxDepth: z.number().optional(),
          maxNodes: z.number().optional(),
          includeHidden: z.boolean().optional()
        })
        .strict()
    },
    (input) => tools.figma_read_tree(input)
  );
  server.registerTool(
    "figma_create_node",
    {
      description: "Create a supported Figma node.",
      inputSchema: z.object({}).passthrough()
    },
    (input) => tools.figma_create_node(input)
  );
  server.registerTool(
    "figma_update_node",
    {
      description: "Update whitelisted properties on a Figma node.",
      inputSchema: z
        .object({
          nodeId: z.string(),
          properties: z.record(z.unknown())
        })
        .strict()
    },
    (input) => tools.figma_update_node(input)
  );
  server.registerTool(
    "figma_delete_node",
    {
      description: "Delete a Figma node by ID.",
      inputSchema: z.object({ nodeId: z.string() }).strict()
    },
    (input) => tools.figma_delete_node(input)
  );
  server.registerTool(
    "figma_batch",
    {
      description: "Run multiple Figma commands in order.",
      inputSchema: z.object({
        operations: z.array(z.unknown()),
        options: z.record(z.unknown()).optional()
      })
    },
    (input) => tools.figma_batch(input)
  );

  return server;
}

export async function startMcpServer(): Promise<void> {
  const bridge = await LocalBridgeServer.start();
  const mcpServer = createMcpServer(bridge);
  const session = bridge.getSession();
  process.stderr.write(
    `[INFO] Local Figma bridge listening on ws://127.0.0.1:${bridge.address().port}/figma\n`
  );
  process.stderr.write(
    `[INFO] Figma plugin WebSocket URL: ws://localhost:${bridge.address().port}/figma\n`
  );
  process.stderr.write(`[INFO] Figma plugin session ID: ${session.sessionId}\n`);
  process.stderr.write(`[INFO] Figma plugin pairing token: ${session.pairingToken}\n`);
  await mcpServer.connect(new StdioServerTransport());
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint ? import.meta.url === pathToFileURL(entrypoint).href : false;
}

if (isMainModule()) {
  startMcpServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown MCP startup error.";
    process.stderr.write(`[ERROR] ${message}\n`);
    process.exit(1);
  });
}
