# PRD: Local Figma MCP Bridge for Draft Editing

## 1. Summary

Codex agents need a way to read and edit an open Figma draft without using Figma's official MCP server or relying on REST API quotas. This project will build a local MCP server and a companion Figma plugin. The plugin runs inside the currently open Figma file, connects to the local server over localhost, and applies agent-requested changes through the Figma Plugin API.

The first product target is not full Figma workspace CRUD. The target is reliable CRUD for design objects inside a user-owned, open, editable Figma draft.

## 2. Background

Figma's REST API is rate limited by endpoint tier, seat type, and plan. For free Starter resources, those limits can become a blocker for agent-driven design iteration. The Figma Plugin API, however, can read and modify the contents of a file while the plugin is running in that file.

Starter drafts are a good fit for the first version because Figma allows unlimited draft files on the Starter plan. This does not remove all limits: the project still only edits the open draft, and Figma's product, permission, and runtime constraints remain in force.

The intended setup is:

- The user opens a Figma Design draft in the Figma desktop app.
- The user runs a locally developed Figma plugin.
- Codex connects to a local MCP server.
- The MCP server forwards structured commands to the plugin.
- The plugin reads or edits the open file through the Plugin API.

## 3. Goals

- Provide Codex with MCP tools for reading and editing the currently open Figma draft.
- Avoid Figma REST API file-content rate limits for normal draft editing workflows.
- Avoid Figma's official MCP server entirely.
- Support macOS and Windows.
- Keep all traffic local by default.
- Use Figma-native editable objects, not screenshots or raster-only output.
- Make risky edits inspectable, reversible, and scoped.

## 4. Non-Goals

- No attempt to bypass Figma plan, seat, permission, or product limits.
- No full Figma workspace/file-browser CRUD through Plugin API alone.
- No automatic editing of files that are not open and connected through the plugin.
- No background plugin that runs without user initiation.
- No arbitrary JavaScript execution from Codex inside Figma as the default interface.
- No dependency on Figma's official MCP server or `use_figma` tool.

## 5. Users

- Primary user: a developer/designer using Codex locally with Figma desktop.
- Secondary user: an agent workflow author who wants repeatable Figma draft automation.

## 6. Key Constraints

- Figma plugins must be initiated by the user and cannot be true background processes.
- The plugin can only operate in the file where it is running.
- The user must have edit permission for the open file.
- Draft files are suitable for personal iteration and can be unlimited on Starter, but Starter draft collaboration is limited.
- Figma product limits still apply. For example, Starter team files can have page limits.
- REST API usage should be optional and avoided in the MVP.
- Localhost networking must be explicitly allowed in the plugin manifest.

## 7. Functional Requirements

### 7.1 Local MCP Server

The server must expose MCP tools that Codex can call. MVP tools:

- `figma_status`: report whether a Figma plugin client is connected.
- `figma_get_selection`: return selected node IDs and basic metadata.
- `figma_read_node`: return a structured description of one node.
- `figma_read_tree`: return a bounded subtree from the current page or target node.
- `figma_create_node`: create supported node types from a structured spec.
- `figma_update_node`: update supported properties on an existing node.
- `figma_delete_node`: remove a node by ID.
- `figma_batch`: apply multiple safe operations in order.

### 7.2 Figma Plugin

The plugin must:

- Connect to the local bridge using localhost WebSocket or HTTP polling.
- Send connection status and safe session metadata to the server.
- Receive structured commands from the server.
- Execute commands through the Figma Plugin API.
- Return structured success or error responses.
- Keep the plugin UI visible enough for connection state and pairing status.

### 7.3 Command DSL

Commands must be structured JSON, not raw code. The DSL should support:

- Node lookup by ID.
- Selection lookup.
- Page listing and current-page operations.
- Node creation for frames, rectangles, ellipses, lines, text, components, sections, and groups as support matures.
- Property updates for name, position, size, fills, strokes, text, layout, constraints, visibility, and plugin metadata.
- Deletion by node ID.
- Batched operations with partial-failure reporting.

### 7.4 Safety

- The server must bind to `127.0.0.1` by default.
- A per-session pairing token must be required before accepting plugin commands.
- Destructive commands must be clearly represented in logs and responses.
- Large or destructive batches should support dry-run mode.
- The plugin should group mutations into undo-friendly units where appropriate so users can recover from bad edits.

## 8. Non-Functional Requirements

- Cross-platform: macOS and Windows.
- Local-first: no external network required for MVP operation.
- Predictable: commands should return deterministic JSON responses.
- Observable: logs should identify command ID, target node ID, duration, and result.
- Resilient: reconnect cleanly when the plugin or server restarts.
- Bounded: large tree reads must be depth/size limited to avoid freezing Figma or overflowing MCP responses.

## 9. MVP Scope

MVP should prove the end-to-end bridge with a small but useful operation set:

- Start local MCP server.
- Run Figma plugin in an open draft.
- Pair plugin with server.
- Codex calls `figma_status`.
- Codex reads current selection.
- Codex creates a frame with text and shape children.
- Codex updates a node property.
- Codex deletes a created node.
- User can undo changes in Figma.

## 10. Out-of-Scope for MVP

- File creation and deletion from Figma's file browser.
- Importing external libraries or publishing components.
- Remote team collaboration flows.
- Image/video asset import.
- Full variable and design-token management.
- Complete parity with Figma's official MCP write-to-canvas feature.

## 11. Acceptance Criteria

- On macOS and Windows, the local server starts and exposes MCP tools.
- The Figma plugin connects to the local server from the desktop app.
- Codex can detect connection status through MCP.
- Codex can read the current selection without calling Figma REST file endpoints.
- Codex can create, update, and delete at least rectangle, frame, and text nodes.
- Commands fail safely with actionable errors when the plugin is disconnected or the target node is invalid.
- The server refuses non-local unauthenticated requests.
- The repo includes setup instructions for both macOS and Windows.

## 12. Risks

- Figma plugin runtime restrictions may limit long-running sessions.
- Large document reads can degrade Figma performance.
- Plugin API coverage is not identical to Figma UI capabilities.
- Figma plan/product limits remain in force.
- MCP client support varies by transport, so the server should prefer standard MCP transports.
- Localhost services can be abused if they do not validate origin, bind address, and pairing tokens.

## 13. References

- Figma Plugin API overview: https://developers.figma.com/docs/plugins/
- Figma plugin network access manifest: https://developers.figma.com/docs/plugins/manifest/
- Figma plugin runtime model: https://developers.figma.com/docs/plugins/how-plugins-run/
- Figma REST API rate limits: https://developers.figma.com/docs/rest-api/rate-limits/
- Figma Starter plan overview: https://help.figma.com/hc/en-us/articles/13838684089751-Starter-plan-overview
- Figma createPage Starter limit note: https://developers.figma.com/docs/plugins/api/properties/figma-createpage/
- MCP transport specification: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
