# Codex Agent Instructions

This project implements a custom local MCP server named `local-figma`.

When the user asks to pair or operate Figma through this project:

- First use the exposed MCP tools from the `local-figma` server.
- Start with `figma_status`; it returns `data.pairing.sessionId`, `data.pairing.pairingToken`, and plugin connection state.
- Do not create ad-hoc Node scripts to imitate an MCP client when `figma_status` is unavailable.
- If `figma_status` is not exposed in the current Codex thread, report that the `local-figma` MCP server is not loaded in this thread and ask the user to verify Codex app MCP settings or restart the app.
- Do not use the official Figma MCP tools as a replacement for this local bridge unless the user explicitly asks for the official Figma integration.
