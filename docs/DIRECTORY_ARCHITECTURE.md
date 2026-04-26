# Directory Architecture

## 1. Purpose

This document defines the project directory architecture. The goal is to keep SDD documents, shared contracts, MCP server code, bridge code, Figma plugin code, and tests in clear boundaries.

## 2. Top-Level Layout

```text
.
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── REFERENCE_ANALYSIS.md
│   ├── PROTOCOL.md
│   ├── MCP_TOOLS.md
│   ├── COMMAND_DSL.md
│   ├── SECURITY_MODEL.md
│   ├── TECH_STACK.md
│   ├── DIRECTORY_ARCHITECTURE.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── MANUAL_TESTING.md
├── src/
│   ├── shared/
│   ├── bridge/
│   ├── mcp/
│   └── plugin/
├── tests/
│   ├── shared/
│   ├── bridge/
│   ├── mcp/
│   └── plugin/
├── REFERENCE/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── esbuild.config.mjs
├── eslint.config.mjs
└── README.md
```

`MANUAL_TESTING.md`, config files, and source folders may be created during implementation. The docs listed here define the intended final structure.

## 3. Documentation Boundary

`docs/` contains project decisions and implementation context.

Responsibilities:

- product scope.
- architecture.
- protocol contracts.
- MCP tool contracts.
- command DSL.
- security model.
- stack decisions.
- implementation plan.
- manual verification instructions.

Rules:

- Specs live in `docs/`, not the repository root.
- Behavior changes should update docs before or alongside tests.
- Implementation should not import from docs.
- Docs should not contain generated output.

## 4. Shared Source Boundary

`src/shared/` contains contracts used by multiple runtime boundaries.

Planned files:

```text
src/shared/
├── protocol.ts
├── schemas.ts
├── errors.ts
└── types.ts
```

Responsibilities:

- protocol envelope types.
- command DSL types.
- shared error codes.
- Zod schemas.
- type guards and parsing helpers.

Rules:

- No Node-only APIs unless guarded or isolated.
- No Figma Plugin API references.
- No MCP SDK references.
- This layer should be safe to use from both server and plugin builds.

## 5. Bridge Boundary

`src/bridge/` contains the local WebSocket bridge and session lifecycle.

Planned files:

```text
src/bridge/
├── server.ts
├── session-store.ts
├── command-router.ts
└── heartbeat.ts
```

Responsibilities:

- loopback WebSocket server.
- pairing token lifecycle.
- plugin session binding.
- command request/response routing.
- pending request timeouts.
- heartbeat tracking.

Rules:

- Bind to `127.0.0.1` by default.
- Do not expose MCP tool definitions here.
- Do not call Figma Plugin API here.
- Do not broadcast commands to arbitrary peers.

## 6. MCP Boundary

`src/mcp/` contains agent-facing MCP server behavior.

Planned files:

```text
src/mcp/
├── server.ts
├── tools.ts
└── tool-results.ts
```

Responsibilities:

- MCP server startup.
- stdio transport.
- MCP tool registration.
- tool input validation.
- mapping MCP tools to command DSL.
- formatting MCP tool results.

Rules:

- Keep MCP-specific imports in this folder.
- Tools should call bridge interfaces, not WebSocket internals.
- Tools should not know Figma Plugin API details.

## 7. Plugin Boundary

`src/plugin/` contains Figma plugin source.

Planned files:

```text
src/plugin/
├── manifest.json
├── code.ts
├── ui.html
├── ui.ts
├── serializer.ts
├── font.ts
├── plugin-errors.ts
└── commands/
    ├── dispatcher.ts
    ├── read.ts
    ├── mutate.ts
    └── batch.ts
```

Responsibilities:

- Figma plugin manifest.
- plugin UI and pairing workflow.
- WebSocket client in the UI iframe.
- `postMessage` bridge between UI and main thread.
- command dispatcher.
- Figma Plugin API reads and mutations.
- font loading.
- bounded node serialization.

Rules:

- Plugin UI handles browser APIs and WebSocket.
- Plugin main thread handles Figma Plugin API.
- No raw JavaScript command execution.
- Validate DSL commands before mutating Figma.
- Keep generated `code.js` out of source when using TypeScript.

## 8. Test Boundary

`tests/` mirrors source boundaries.

Planned files:

```text
tests/
├── shared/
│   └── schemas.test.ts
├── bridge/
│   ├── session-store.test.ts
│   └── command-router.test.ts
├── mcp/
│   ├── tools.test.ts
│   └── tool-results.test.ts
└── plugin/
    ├── dispatcher.test.ts
    ├── read.test.ts
    └── mutate.test.ts
```

Responsibilities:

- Validate contracts before implementation.
- Prove pairing and session behavior.
- Prove command routing and timeout behavior.
- Prove MCP tool to DSL mapping.
- Prove plugin command behavior with fake Figma APIs.

Rules:

- Unit tests should not require Figma Desktop.
- Manual Figma Desktop tests live in docs.
- Tests should be written before implementation for new behavior.

## 9. Reference Boundary

`REFERENCE/` contains cloned external projects.

Rules:

- Treat `REFERENCE/` as read-only research context.
- Do not import from `REFERENCE/`.
- Do not run production code from `REFERENCE/`.
- Do not mutate reference code unless explicitly evaluating a patch.
- Preserve third-party licenses.

## 10. Generated Output

Generated files should live outside source.

Preferred locations:

```text
dist/
├── mcp/
└── plugin/
```

or:

```text
build/
└── plugin/
```

Rules:

- Generated output should not be edited by hand.
- Generated output may be gitignored unless distribution requires committed plugin artifacts.
- Source of truth remains `src/`.

## 11. Dependency Direction

Allowed dependency direction:

```text
src/mcp -> src/bridge -> src/shared
src/plugin -> src/shared
tests -> src
```

Disallowed:

```text
src/shared -> src/mcp
src/shared -> src/bridge
src/shared -> src/plugin
src/bridge -> src/mcp
src/mcp -> src/plugin
src/plugin -> src/mcp
src/* -> REFERENCE
```

This keeps runtime boundaries independent and testable.

## 12. Implementation Order

Recommended order:

1. `src/shared`
2. `tests/shared`
3. `src/bridge`
4. `tests/bridge`
5. `src/mcp`
6. `tests/mcp`
7. `src/plugin`
8. `tests/plugin`
9. `docs/MANUAL_TESTING.md`
10. manual Figma Desktop verification

This order maximizes testability before any Figma runtime dependency enters the loop.
