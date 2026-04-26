# Protocol: Local MCP to Figma Plugin Bridge

## 1. Purpose

This document defines the local socket protocol between the MCP server and the Figma plugin. MCP itself remains standard stdio or Streamable HTTP. This protocol is only for the local bridge between our server and the plugin UI iframe.

## 2. Transports

### 2.1 Agent To MCP Server

Default:

- MCP stdio transport.

Optional later:

- MCP Streamable HTTP bound to `127.0.0.1`.

### 2.2 MCP Server To Figma Plugin

Default:

- WebSocket on `ws://127.0.0.1:<port>/figma`.

Recommended development port:

- `3846`.

Allowed aliases in Figma manifest:

- `ws://localhost:3846`
- `http://localhost:3846`
- `ws://127.0.0.1:3846`
- `http://127.0.0.1:3846`

The server must bind to loopback by default. It must not bind to `0.0.0.0` in normal mode.

## 3. Roles

Each WebSocket client has one role:

- `plugin`: Figma plugin UI iframe.
- `observer`: optional local debug UI.

The MCP server is not a WebSocket role in the MVP if bridge and MCP server are the same process. If a separate relay process is introduced, it may use role `mcp`.

The MVP should prefer one Node process that owns both:

- MCP stdio server.
- WebSocket endpoint for the Figma plugin.

This removes the need for an unauthenticated relay process.

## 4. Session Model

The server creates a session on startup.

Session fields:

```json
{
  "sessionId": "ses_2xN6s0J3",
  "pairingToken": "083421",
  "createdAt": "2026-04-26T00:00:00.000Z",
  "port": 3846
}
```

The pairing token is displayed in server logs or returned through `figma_status` when no plugin is paired. The plugin UI asks the user for this token before pairing.

One session has at most one active plugin connection in the MVP.

## 5. Message Envelope

All WebSocket messages are JSON objects with this base shape:

```json
{
  "version": 1,
  "id": "msg_01",
  "type": "message_type",
  "sessionId": "ses_2xN6s0J3",
  "sentAt": "2026-04-26T00:00:00.000Z",
  "payload": {}
}
```

Rules:

- `version` must be `1`.
- `id` must be unique per sender.
- `type` must be one of the protocol message types.
- `sentAt` must be ISO-8601.
- `payload` must match the schema for `type`.

## 6. Pairing Flow

### 6.1 Plugin Hello

Plugin sends:

```json
{
  "version": 1,
  "id": "msg_plugin_hello_01",
  "type": "plugin.hello",
  "sessionId": "ses_2xN6s0J3",
  "sentAt": "2026-04-26T00:00:00.000Z",
  "payload": {
    "pairingToken": "083421",
    "pluginVersion": "0.1.0",
    "editorType": "figma",
    "capabilities": ["read", "mutate", "batch", "progress"]
  }
}
```

Server validates:

- WebSocket is from loopback.
- Origin is allowed when present.
- `sessionId` matches active session.
- `pairingToken` matches active session.
- no other plugin is already paired.

### 6.2 Session Accepted

Server responds:

```json
{
  "version": 1,
  "id": "msg_session_accepted_01",
  "type": "session.accepted",
  "sessionId": "ses_2xN6s0J3",
  "sentAt": "2026-04-26T00:00:01.000Z",
  "payload": {
    "serverVersion": "0.1.0",
    "heartbeatIntervalMs": 5000,
    "commandTimeoutMs": 30000,
    "maxPayloadBytes": 1048576
  }
}
```

### 6.3 Session Rejected

Server responds and closes the socket:

```json
{
  "version": 1,
  "id": "msg_session_rejected_01",
  "type": "session.rejected",
  "sessionId": "ses_2xN6s0J3",
  "sentAt": "2026-04-26T00:00:01.000Z",
  "payload": {
    "error": {
      "code": "PAIRING_TOKEN_INVALID",
      "message": "The pairing token is invalid."
    }
  }
}
```

## 7. Heartbeats

Plugin sends:

```json
{
  "version": 1,
  "id": "msg_ping_01",
  "type": "heartbeat.ping",
  "sessionId": "ses_2xN6s0J3",
  "sentAt": "2026-04-26T00:00:05.000Z",
  "payload": {
    "pluginUptimeMs": 5000
  }
}
```

Server responds:

```json
{
  "version": 1,
  "id": "msg_pong_01",
  "type": "heartbeat.pong",
  "sessionId": "ses_2xN6s0J3",
  "sentAt": "2026-04-26T00:00:05.010Z",
  "payload": {
    "serverUptimeMs": 5010
  }
}
```

If the server misses three heartbeat intervals, the plugin is marked disconnected and pending commands fail with `PLUGIN_DISCONNECTED`.

## 8. Command Request

Server sends a command to plugin:

```json
{
  "version": 1,
  "id": "msg_cmd_01",
  "type": "command.request",
  "sessionId": "ses_2xN6s0J3",
  "sentAt": "2026-04-26T00:00:10.000Z",
  "payload": {
    "commandId": "cmd_01",
    "command": {
      "type": "readNode",
      "target": {
        "nodeId": "123:456"
      },
      "options": {
        "maxDepth": 2,
        "includeHidden": false
      }
    }
  }
}
```

## 9. Command Response

Plugin responds:

```json
{
  "version": 1,
  "id": "msg_cmd_res_01",
  "type": "command.response",
  "sessionId": "ses_2xN6s0J3",
  "sentAt": "2026-04-26T00:00:10.100Z",
  "payload": {
    "commandId": "cmd_01",
    "ok": true,
    "result": {
      "node": {
        "id": "123:456",
        "name": "Primary CTA",
        "type": "TEXT"
      }
    }
  }
}
```

Error response:

```json
{
  "version": 1,
  "id": "msg_cmd_err_01",
  "type": "command.response",
  "sessionId": "ses_2xN6s0J3",
  "sentAt": "2026-04-26T00:00:10.100Z",
  "payload": {
    "commandId": "cmd_01",
    "ok": false,
    "error": {
      "code": "NODE_NOT_FOUND",
      "message": "No node exists for id 123:456.",
      "details": {
        "nodeId": "123:456"
      }
    }
  }
}
```

The server must resolve successful commands based on `ok: true`, not based on whether `result` is truthy.

## 10. Progress Events

Plugin sends progress for long commands:

```json
{
  "version": 1,
  "id": "msg_progress_01",
  "type": "command.progress",
  "sessionId": "ses_2xN6s0J3",
  "sentAt": "2026-04-26T00:00:15.000Z",
  "payload": {
    "commandId": "cmd_02",
    "status": "in_progress",
    "progress": 40,
    "processedItems": 40,
    "totalItems": 100,
    "message": "Serialized 40 of 100 nodes."
  }
}
```

Allowed status values:

- `started`
- `in_progress`
- `completed`
- `error`

Progress events extend the inactivity timeout for the command.

## 11. Error Codes

Core protocol errors:

- `INVALID_MESSAGE`
- `UNSUPPORTED_VERSION`
- `INVALID_SESSION`
- `PAIRING_REQUIRED`
- `PAIRING_TOKEN_INVALID`
- `PLUGIN_ALREADY_PAIRED`
- `PLUGIN_DISCONNECTED`
- `COMMAND_TIMEOUT`
- `PAYLOAD_TOO_LARGE`

Figma command errors:

- `NODE_NOT_FOUND`
- `PAGE_NOT_LOADED`
- `UNSUPPORTED_NODE_TYPE`
- `UNSUPPORTED_PROPERTY`
- `INVALID_PARENT`
- `FONT_LOAD_FAILED`
- `MUTATION_NOT_ALLOWED`
- `BATCH_PARTIAL_FAILURE`
- `FIGMA_API_ERROR`

## 12. Timeouts And Limits

Defaults:

- Pairing timeout: 10 minutes.
- Command timeout: 30 seconds.
- Extended inactivity timeout after progress: 60 seconds.
- Max inbound WebSocket payload: 1 MiB.
- Max read tree depth: 4.
- Max read tree nodes: 500.
- Max batch operations: 100.

Limits should be configurable through server options.

## 13. Differences From The Reference Protocol

The reference uses:

- open channel join.
- peer broadcast.
- no pairing token.
- permissive CORS.

This project uses:

- explicit session pairing.
- one paired plugin per server session.
- direct command routing.
- strict message envelopes.
- `ok`-based responses.
- loopback-only security by default.
