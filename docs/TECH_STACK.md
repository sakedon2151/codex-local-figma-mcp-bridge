# Technical Stack

## 1. Purpose

This document defines the technical stack for the Local Figma MCP Bridge. The stack is chosen for stable SDD and TDD workflows across macOS and Windows, while keeping the runtime simple enough for local agent workflows.

## 2. Stack Summary

| Area            | Choice                      | Reason                                                          |
| --------------- | --------------------------- | --------------------------------------------------------------- |
| Runtime         | Node.js LTS                 | Most stable cross-platform default for macOS and Windows.       |
| Language        | TypeScript                  | Shared contracts between MCP server, bridge, and plugin.        |
| Package manager | npm                         | Lowest setup friction and broad platform support.               |
| MCP SDK         | `@modelcontextprotocol/sdk` | Official MCP server primitives.                                 |
| WebSocket       | `ws`                        | Mature Node WebSocket implementation.                           |
| Validation      | `zod`                       | Runtime schemas for protocol, MCP tool inputs, and command DSL. |
| Test runner     | `vitest`                    | Fast TypeScript-friendly tests for TDD.                         |
| Dev runner      | `tsx`                       | Run TypeScript entrypoints during development.                  |
| Plugin bundling | `esbuild`                   | Simple browser/plugin bundle output for Figma plugin files.     |
| Formatting      | `prettier`                  | Consistent formatting with little ceremony.                     |
| Linting         | `eslint`                    | Catch unsafe TypeScript and project hygiene issues.             |

## 3. Runtime Decision

Use Node.js LTS as the primary runtime.

The reference project uses Bun successfully, but this project prioritizes conservative Windows/macOS compatibility. Node.js is easier to support for users who already run Codex, editors, and local MCP servers.

Bun may remain useful for reference comparison, but production project scripts should not require it.

## 4. Language And Type System

Use TypeScript with strict settings.

Required compiler posture:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `moduleResolution: "Bundler"` or a Node-compatible equivalent chosen during setup.
- no implicit `any` in project-owned source.

The type system should model boundaries explicitly:

- MCP tool input.
- protocol envelope.
- command DSL.
- Figma command result.
- normalized error shape.

## 5. Validation Strategy

Use `zod` for runtime validation.

Validation happens at three layers:

1. MCP tool input validation.
2. local protocol envelope validation.
3. plugin command DSL validation.

This intentionally duplicates some checks. The MCP server and Figma plugin may drift during development, and the plugin must remain the final guard before touching the Figma document.

## 6. Testing Stack

Use `vitest` for unit and integration-style local tests.

Test categories:

- `tests/shared`: protocol and DSL schemas.
- `tests/bridge`: session pairing, routing, heartbeat, timeout.
- `tests/mcp`: tool input to DSL mapping and result formatting.
- `tests/plugin`: plugin command logic using a fake Figma API.

Manual Figma Desktop verification lives in `docs/MANUAL_TESTING.md` after implementation begins.

## 7. Build Strategy

The project has two build targets:

### 7.1 MCP Server Build

Target:

- Node.js.
- stdio MCP server.
- local WebSocket bridge.

Build options:

- Use `tsc` for type checking.
- Use direct TypeScript execution with `tsx` during development.
- Add `tsup` later only if packaged distribution needs a single bundled artifact.

### 7.2 Figma Plugin Build

Target:

- `manifest.json`
- `code.js`
- `ui.html`
- optional `ui.js` bundle if the UI script is split from HTML.

Use `esbuild` to bundle:

- `src/plugin/code.ts` to generated plugin `code.js`.
- `src/plugin/ui.ts` to generated UI JavaScript when needed.

Generated plugin output should live under `dist/plugin/` or `build/plugin/` and should not be edited by hand.

## 8. Development Commands

Expected commands after scaffold:

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev:mcp
npm run build:plugin
```

Recommended script meanings:

- `typecheck`: run TypeScript without emitting.
- `test`: run Vitest once.
- `test:watch`: run Vitest in watch mode.
- `build`: build server and plugin artifacts.
- `dev:mcp`: start MCP server and local bridge with `tsx`.
- `build:plugin`: bundle Figma plugin files.

## 9. SDD Workflow

Specs drive implementation in this order:

```text
docs/PRD.md
  -> docs/ARCHITECTURE.md
    -> docs/PROTOCOL.md
    -> docs/MCP_TOOLS.md
    -> docs/COMMAND_DSL.md
    -> docs/SECURITY_MODEL.md
      -> docs/IMPLEMENTATION_PLAN.md
        -> tests
          -> implementation
```

When behavior is unclear, update the relevant spec before changing tests or implementation.

## 10. TDD Workflow

Default implementation loop:

1. Write or update a failing test from the spec.
2. Run the focused test and confirm it fails for the expected reason.
3. Implement the smallest code path that passes.
4. Run the focused test.
5. Run the broader test group.
6. Refactor only with tests passing.

Start with tests that do not require Figma:

- protocol schemas.
- command DSL schemas.
- session store.
- command router.
- MCP result helpers.

Figma Desktop manual testing comes after the local contracts are stable.

## 11. Dependency Policy

Keep dependencies minimal.

Allowed initial runtime dependencies:

- `@modelcontextprotocol/sdk`
- `ws`
- `zod`

Use Node's built-in `crypto.randomUUID()` for command and session IDs instead of adding a UUID package.

Allowed initial development dependencies:

- `@types/node`
- `@types/ws`
- `typescript`
- `tsx`
- `vitest`
- `esbuild`
- `prettier`
- `eslint`
- TypeScript ESLint packages

Add new dependencies only when they remove meaningful complexity or are required for MCP/Figma compatibility.

## 12. Cross-Platform Requirements

The stack must work on:

- macOS with Figma Desktop.
- Windows with Figma Desktop.

Rules:

- Avoid shell-specific scripts.
- Avoid requiring WSL.
- Use Node `path` utilities for paths.
- Bind local bridge to `127.0.0.1` by default.
- Document any platform-specific behavior in setup or manual testing docs.

## 13. Reference Project Position

The reference project remains under `REFERENCE/`.

Rules:

- Do not import source from `REFERENCE/`.
- Do not rely on Bun-only scripts.
- Reuse concepts and patterns only after adapting them to this project's protocol, security model, and tests.
- Preserve MIT attribution if code is copied or substantially derived.
