# Local Figma MCP Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local MCP server and Figma plugin bridge that lets Codex read and mutate the currently open editable Figma draft without using Figma's official MCP server.

**Architecture:** A Node.js MCP server exposes stdio tools to Codex and hosts a loopback WebSocket endpoint for the Figma plugin. The Figma plugin UI iframe connects to the local endpoint, pairs with a token, and relays validated DSL commands to the plugin main thread, which executes Figma Plugin API operations.

**Tech Stack:** TypeScript, Node.js LTS, `@modelcontextprotocol/sdk`, `ws`, `zod`, Figma Plugin API, Vitest.

---

## 1. Target File Structure

Create this structure:

```text
docs/
  PRD.md
  ARCHITECTURE.md
  REFERENCE_ANALYSIS.md
  PROTOCOL.md
  MCP_TOOLS.md
  COMMAND_DSL.md
  SECURITY_MODEL.md
  TECH_STACK.md
  DIRECTORY_ARCHITECTURE.md
  IMPLEMENTATION_PLAN.md
package.json
tsconfig.json
vitest.config.ts
esbuild.config.mjs
eslint.config.mjs
src/
  shared/
    protocol.ts
    schemas.ts
    errors.ts
    types.ts
  bridge/
    server.ts
    session-store.ts
    command-router.ts
    heartbeat.ts
  mcp/
    server.ts
    tools.ts
    tool-results.ts
  plugin/
    manifest.json
    code.ts
    ui.html
    ui.ts
    commands/
      dispatcher.ts
      read.ts
      mutate.ts
      batch.ts
    serializer.ts
    font.ts
    plugin-errors.ts
tests/
  shared/
    schemas.test.ts
  bridge/
    session-store.test.ts
    command-router.test.ts
  mcp/
    tools.test.ts
    tool-results.test.ts
  plugin/
    dispatcher.test.ts
    read.test.ts
    mutate.test.ts
```

## 2. Phase 1: Project Scaffold

### Task 1: Initialize TypeScript Package

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Add package scripts**

Use Node.js LTS as the runtime. Required scripts:

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "dev:mcp": "tsx src/mcp/server.ts",
    "dev:plugin": "tsc -p tsconfig.json --watch"
  }
}
```

- [ ] **Step 2: Add dependencies**

Runtime dependencies:

```text
@modelcontextprotocol/sdk
ws
zod
```

Development dependencies:

```text
@types/node
@types/ws
typescript
tsx
vitest
```

- [ ] **Step 3: Verify install and empty build**

Run:

```bash
npm install
npm run build
npm test
```

Expected:

- dependencies install.
- build succeeds once source files exist.
- tests run once test files exist.

## 3. Phase 2: Shared Protocol And Schemas

### Task 2: Define Protocol Types

**Files:**

- Create: `src/shared/protocol.ts`
- Create: `src/shared/errors.ts`

- [ ] **Step 1: Define message envelope types**

Include types for:

- `plugin.hello`
- `session.accepted`
- `session.rejected`
- `heartbeat.ping`
- `heartbeat.pong`
- `command.request`
- `command.response`
- `command.progress`

- [ ] **Step 2: Define shared error codes**

Include protocol error codes:

```text
INVALID_MESSAGE
UNSUPPORTED_VERSION
INVALID_SESSION
PAIRING_REQUIRED
PAIRING_TOKEN_INVALID
PLUGIN_ALREADY_PAIRED
PLUGIN_DISCONNECTED
COMMAND_TIMEOUT
PAYLOAD_TOO_LARGE
```

Include Figma command error codes:

```text
NODE_NOT_FOUND
PAGE_NOT_LOADED
UNSUPPORTED_NODE_TYPE
UNSUPPORTED_PROPERTY
INVALID_PARENT
FONT_LOAD_FAILED
MUTATION_NOT_ALLOWED
BATCH_PARTIAL_FAILURE
FIGMA_API_ERROR
```

### Task 3: Define Zod Schemas

**Files:**

- Create: `src/shared/schemas.ts`
- Create: `tests/shared/schemas.test.ts`

- [ ] **Step 1: Add schema coverage for protocol envelopes**

Validate:

- `version` equals `1`.
- `id` is a non-empty string.
- `type` is a known message type.
- `sessionId` is a non-empty string.
- `sentAt` is a string.
- `payload` matches the message type.

- [ ] **Step 2: Add schema coverage for command DSL**

Validate:

- `getSelection`
- `readNode`
- `readTree`
- `createNode`
- `updateNode`
- `deleteNode`
- `batch`

- [ ] **Step 3: Test rejection cases**

Tests must assert rejection for:

- unknown message type.
- unsupported command type.
- update payload with unknown property.
- create node with unsupported node type.
- batch with more than 100 operations.

Run:

```bash
npm test -- tests/shared/schemas.test.ts
```

Expected:

- valid examples from `PROTOCOL.md` pass.
- invalid examples fail with useful schema errors.

## 4. Phase 3: Session Bridge

### Task 4: Implement Session Store

**Files:**

- Create: `src/bridge/session-store.ts`
- Create: `tests/bridge/session-store.test.ts`

- [ ] **Step 1: Create session generation**

Session store must generate:

- `sessionId`
- `pairingToken`
- `createdAt`
- `expiresAt`
- paired plugin state

- [ ] **Step 2: Add pairing validation**

Rules:

- correct token pairs the plugin.
- incorrect token is rejected.
- expired token is rejected.
- second plugin is rejected.

- [ ] **Step 3: Add disconnect behavior**

Disconnect marks plugin as unavailable and rejects pending commands through the bridge layer.

### Task 5: Implement WebSocket Bridge

**Files:**

- Create: `src/bridge/server.ts`

- [ ] **Step 1: Start WebSocket server on loopback**

Default bind:

```text
127.0.0.1:3846
```

- [ ] **Step 2: Validate pairing handshake**

Accept only `plugin.hello` before pairing.

- [ ] **Step 3: Route command requests**

Expose an internal method:

```ts
sendCommand(command: CommandDsl, timeoutMs?: number): Promise<CommandResponsePayload>
```

- [ ] **Step 4: Handle progress**

Progress events update pending request activity and can be subscribed to by MCP tooling later.

- [ ] **Step 5: Handle falsy success results**

Resolve a command when response payload has `ok: true`, even when `result` is `null`, `false`, `0`, or an empty string.

## 5. Phase 4: MCP Server

### Task 6: Implement MCP Server Entrypoint

**Files:**

- Create: `src/mcp/server.ts`
- Create: `src/mcp/tools.ts`
- Create: `src/mcp/tool-results.ts`
- Create: `tests/mcp/tool-results.test.ts`

- [ ] **Step 1: Start MCP stdio server**

Use `StdioServerTransport` from `@modelcontextprotocol/sdk`.

- [ ] **Step 2: Start bridge with the MCP server**

The MCP process should own the WebSocket bridge so users run one server command.

- [ ] **Step 3: Add result helpers**

Result helpers should produce consistent `ok`, `data`, `error`, and `meta` shapes.

### Task 7: Implement MVP MCP Tools

**Files:**

- Modify: `src/mcp/tools.ts`

- [ ] **Step 1: Add `figma_status`**

Return server state, port, session status, and plugin pairing state.

- [ ] **Step 2: Add read tools**

Add:

- `figma_get_selection`
- `figma_read_node`
- `figma_read_tree`

- [ ] **Step 3: Add mutation tools**

Add:

- `figma_create_node`
- `figma_update_node`
- `figma_delete_node`

- [ ] **Step 4: Add `figma_batch`**

Validate operation count and map tool input to the DSL `batch` command.

## 6. Phase 5: Figma Plugin

### Task 8: Create Plugin Manifest And UI

**Files:**

- Create: `src/plugin/manifest.json`
- Create: `src/plugin/ui.html`
- Create: `src/plugin/ui.ts`

- [ ] **Step 1: Add manifest**

Manifest requirements:

```json
{
  "name": "Local Codex Figma Bridge",
  "api": "1.0.0",
  "editorType": ["figma"],
  "main": "code.js",
  "ui": "ui.html",
  "documentAccess": "dynamic-page",
  "networkAccess": {
    "allowedDomains": ["ws://localhost:3846", "http://localhost:3846"],
    "devAllowedDomains": ["ws://localhost:3846", "http://localhost:3846"],
    "reasoning": "Connects to a local MCP bridge controlled by the user."
  }
}
```

- [ ] **Step 2: Add UI state**

UI must show:

- server URL.
- pairing token input.
- paired/unpaired status.
- last heartbeat.
- last command status.

- [ ] **Step 3: Add WebSocket client**

UI sends `plugin.hello`, heartbeats, command responses, and progress events.

### Task 9: Implement Plugin Main Thread

**Files:**

- Create: `src/plugin/code.ts`
- Create: `src/plugin/commands/dispatcher.ts`
- Create: `src/plugin/commands/read.ts`
- Create: `src/plugin/commands/mutate.ts`
- Create: `src/plugin/commands/batch.ts`
- Create: `src/plugin/serializer.ts`
- Create: `src/plugin/font.ts`
- Create: `src/plugin/plugin-errors.ts`

- [ ] **Step 1: Show plugin UI**

Use:

```ts
figma.showUI(__html__, { width: 360, height: 520 });
```

- [ ] **Step 2: Relay command requests**

Main thread receives `execute-command` from UI and returns either `command-result` or `command-error`.

- [ ] **Step 3: Implement read commands**

Implement:

- `getSelection`
- `readNode`
- `readTree`

- [ ] **Step 4: Implement mutation commands**

Implement:

- `createNode`
- `updateNode`
- `deleteNode`

- [ ] **Step 5: Implement batch command**

Run operations in order, emit progress, and stop on first error by default.

## 7. Phase 6: Verification

### Task 10: Automated Verification

**Files:**

- Modify tests under `tests/`

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm test
```

Expected:

- schema tests pass.
- session tests pass.
- result helper tests pass.

- [ ] **Step 2: Run TypeScript build**

Run:

```bash
npm run build
```

Expected:

- no TypeScript errors.

### Task 11: Manual Figma Verification

**Files:**

- Create: `docs/MANUAL_TESTING.md`

- [ ] **Step 1: Start server**

Run:

```bash
npm run dev:mcp
```

Expected:

- server prints loopback port.
- server prints a pairing token.

- [ ] **Step 2: Load plugin in Figma desktop**

Use Figma development plugin flow and select `src/plugin/manifest.json`.

- [ ] **Step 3: Pair plugin**

Enter the server pairing token in plugin UI.

Expected:

- plugin displays paired state.
- `figma_status` reports `paired: true`.

- [ ] **Step 4: Exercise MVP flow**

Call tools in this order:

1. `figma_get_selection`
2. `figma_create_node` with a frame.
3. `figma_create_node` with a text child.
4. `figma_update_node` to rename and move the text.
5. `figma_read_node` for the text node.
6. `figma_delete_node` for the text node.

Expected:

- nodes appear in Figma.
- reads return bounded JSON.
- deletion removes the target node.
- Figma undo can recover the mutation sequence.

## 8. Completion Criteria

The implementation is complete when:

- MCP server starts through one command.
- WebSocket bridge binds to loopback.
- Figma plugin pairs with token.
- `figma_status` reports paired state.
- read tools work on current selection and node IDs.
- create/update/delete tools work for frame, rectangle, and text.
- batch supports ordered operations and progress.
- invalid commands fail before reaching Figma Plugin API.
- unit tests pass.
- TypeScript build passes.
- manual Figma MVP flow passes on macOS and Windows.

## 9. Suggested Commit Sequence

1. `docs: add implementation context`
2. `chore: scaffold typescript project`
3. `feat: add bridge protocol schemas`
4. `feat: add local pairing bridge`
5. `feat: expose mcp figma tools`
6. `feat: add figma plugin bridge`
7. `feat: implement figma read commands`
8. `feat: implement figma mutation commands`
9. `test: cover bridge and tool contracts`
10. `docs: add manual figma testing guide`
