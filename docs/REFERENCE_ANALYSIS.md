# Reference Analysis: cursor-talk-to-figma-mcp

## 1. Purpose

This document captures what we learned from the cloned reference project at `REFERENCE/cursor-talk-to-figma-mcp`. The reference is valuable because it already proves the core architecture we want:

```text
AI agent
  <-> MCP server over stdio
    <-> local WebSocket relay
      <-> Figma plugin UI iframe
        <-> Figma plugin main thread
          <-> open Figma document through Plugin API
```

The project should be treated as a working reference, not as production-ready code to copy wholesale.

## 2. Reference Project Layout

Important files:

- `REFERENCE/cursor-talk-to-figma-mcp/src/talk_to_figma_mcp/server.ts`
  - MCP server.
  - Uses `@modelcontextprotocol/sdk`.
  - Connects to the WebSocket relay through `ws`.
  - Exposes many Figma tools.
  - Tracks pending requests by UUID.

- `REFERENCE/cursor-talk-to-figma-mcp/src/socket.ts`
  - Bun WebSocket relay.
  - Uses channel names to route messages between MCP server and Figma plugin.
  - Broadcasts messages to peers in the same channel.

- `REFERENCE/cursor-talk-to-figma-mcp/src/cursor_mcp_plugin/ui.html`
  - Figma plugin UI.
  - Connects to `ws://localhost:3055`.
  - Generates a random channel.
  - Relays messages between WebSocket and plugin main thread.

- `REFERENCE/cursor-talk-to-figma-mcp/src/cursor_mcp_plugin/code.js`
  - Figma plugin main thread.
  - Dispatches incoming commands.
  - Calls Figma Plugin API for reads and mutations.
  - Contains read, create, update, delete, export, annotation, text, layout, and component helpers.

- `REFERENCE/cursor-talk-to-figma-mcp/src/cursor_mcp_plugin/manifest.json`
  - Allows localhost WebSocket access.
  - Uses `documentAccess: "dynamic-page"`.
  - Supports `figma` and `figjam`.

## 3. Confirmed Working Patterns

### 3.1 MCP Stdio Boundary

The reference uses an MCP server over stdio. This is the safest default for Codex-style local agent integration because it keeps the MCP client boundary standard and avoids custom WebSocket MCP transports.

Adopt this pattern.

### 3.2 WebSocket Bridge Boundary

The reference separates MCP transport from the plugin bridge:

- MCP client to MCP server: stdio.
- MCP server to local relay: WebSocket.
- Figma plugin UI to local relay: WebSocket.
- Plugin UI to plugin main thread: `postMessage`.

Adopt the separation, but replace the generic relay with a stricter session bridge.

### 3.3 Request/Response Correlation

The MCP server creates a UUID for each command and stores a pending promise until the Figma plugin responds. Long operations send progress events to keep the command alive.

Adopt the concept:

- `commandId` per request.
- pending request map.
- timeout per request.
- progress events that extend inactivity timeout.

Improve the result handling so falsy successful results such as `null`, `false`, `0`, or empty strings do not time out.

### 3.4 Figma Plugin Command Dispatcher

The plugin main thread receives structured command names and parameters, then routes them through a dispatcher. This is the right shape because it avoids arbitrary JavaScript execution inside Figma.

Adopt the dispatcher pattern, but split the implementation into focused modules.

### 3.5 Node Serialization

The reference often uses `node.exportAsync({ format: "JSON_REST_V1" })`, then filters unsupported or noisy fields. This is useful because it gives an agent a familiar Figma-like JSON shape without calling the REST API.

Adopt this pattern for `readNode` and bounded `readTree`, with explicit depth and size limits.

### 3.6 Chunking And Progress

The reference chunks large scans and emits progress updates. This matters because large Figma documents can freeze the plugin runtime if traversed in one pass.

Adopt this pattern for tree reads, text scans, and large batches.

## 4. Reference Tool Surface

The reference exposes many tools:

- Document and selection reads.
- Node reads.
- Rectangle, frame, and text creation.
- Fill, stroke, corner radius, movement, resize, clone, and deletion.
- Text scanning and batch text replacement.
- Local styles and local components.
- Component instance creation and override propagation.
- Annotation helpers.
- Prototype reactions and FigJam connector helpers.
- Export node as image.
- Focus and selection helpers.

For our MVP, the reference surface is too broad. We should start with:

- `figma_status`
- `figma_get_selection`
- `figma_read_node`
- `figma_read_tree`
- `figma_create_node`
- `figma_update_node`
- `figma_delete_node`
- `figma_batch`

The extra reference tools are useful post-MVP examples.

## 5. Gaps And Risks In The Reference

### 5.1 Relay Security

The relay allows broad CORS and does not authenticate plugin clients. Channel names are random but not treated as secrets with a pairing protocol.

Do not adopt as-is.

Required changes:

- Bind to `127.0.0.1` by default.
- Reject remote bind addresses in normal mode.
- Validate WebSocket origin when available.
- Require pairing token.
- Bind each session to exactly one MCP role and one Figma plugin role.

### 5.2 Channel Broadcast Model

The reference broadcasts a message to every other client in the same channel. This is convenient for demos but too loose for a local automation bridge.

Replace with explicit routing:

- MCP connection sends command to its paired plugin session.
- Plugin session sends responses only to the paired MCP session.
- Unknown clients cannot join an existing session.

### 5.3 Runtime Choice

The reference uses Bun for the relay and package scripts. Bun is convenient, but our cross-platform goal is better served by Node.js LTS because it is more commonly available and easier to support in enterprise Windows/macOS environments.

Recommended choice:

- TypeScript.
- Node.js LTS.
- `@modelcontextprotocol/sdk`.
- `ws`.
- `zod`.
- Vitest or Node test runner.

### 5.4 Large Single Plugin File

The reference plugin main file is over four thousand lines. It proves breadth but makes auditing and safe modification harder.

Split our plugin into:

- `dispatcher`
- `commands/read`
- `commands/mutate`
- `commands/batch`
- `serializer`
- `font`
- `errors`
- `types`

### 5.5 Falsy Result Handling

The reference resolves a pending request only when `myResponse.result` is truthy. Successful results such as `false`, `0`, `null`, or an empty string can be ignored and eventually time out.

Use `ok: true` instead of truthiness.

### 5.6 Windows/WSL Guidance

The reference suggests binding to `0.0.0.0` for Windows WSL. This conflicts with our security model.

Preferred Windows strategy:

- Run the Node server on the same host environment as Figma whenever possible.
- Use `127.0.0.1` and `localhost` only.
- Document WSL as an advanced, explicitly unsafe mode if it requires non-loopback binding.

## 6. Reuse Decisions

Use these ideas:

- stdio MCP server.
- local WebSocket plugin bridge.
- request IDs and pending map.
- progress updates for long operations.
- command dispatcher.
- `JSON_REST_V1` serialization.
- Figma font loading patterns.
- basic create/update/delete operation examples.

Do not reuse these as-is:

- unauthenticated channel join.
- broadcast relay.
- permissive CORS.
- `0.0.0.0` default or recommended binding.
- single huge plugin file.
- truthiness-based response handling.
- Cursor-branded setup and package names.

## 7. License

The reference project uses the MIT License. We may reuse concepts and code with attribution and license preservation where copied or substantially derived.

## 8. Reverse Engineering Output

The next development step should extract the reference into these project-native documents:

- `PROTOCOL.md`
- `MCP_TOOLS.md`
- `COMMAND_DSL.md`
- `SECURITY_MODEL.md`
- `IMPLEMENTATION_PLAN.md`

This file is the record of why the new design diverges from the reference where it does.
