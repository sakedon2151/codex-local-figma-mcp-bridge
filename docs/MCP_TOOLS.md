# MCP Tools

## 1. Purpose

This document defines the MCP tools exposed to Codex. These tools are the public agent-facing API. They should remain smaller and more stable than the internal Figma command DSL.

## 2. Design Rules

- Tool names use the `figma_` prefix.
- Tool inputs are validated with strict schemas.
- Tool outputs are JSON strings or structured MCP content that can be parsed by an agent.
- Mutating tools return the changed node IDs and a concise summary.
- Read tools are bounded by explicit depth, child count, and payload limits.
- Tools do not expose arbitrary JavaScript execution.
- Tools operate only on the currently paired, open Figma file.

## 3. Common Response Shape

All tools return a JSON object with this shape:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "commandId": "cmd_01",
    "durationMs": 42
  }
}
```

Error shape:

```json
{
  "ok": false,
  "error": {
    "code": "PLUGIN_DISCONNECTED",
    "message": "No Figma plugin is paired with the local server."
  },
  "meta": {
    "commandId": "cmd_01",
    "durationMs": 3
  }
}
```

## 4. MVP Tools

### 4.1 `figma_status`

Reports local bridge and plugin connection state.

Input:

```json
{}
```

Output:

```json
{
  "ok": true,
  "data": {
    "server": {
      "running": true,
      "port": 3846,
      "transport": "stdio"
    },
    "plugin": {
      "paired": true,
      "lastHeartbeatAt": "2026-04-26T00:00:00.000Z",
      "capabilities": ["read", "mutate", "batch", "progress"]
    }
  }
}
```

When no plugin is paired, include safe pairing guidance:

```json
{
  "ok": true,
  "data": {
    "server": {
      "running": true,
      "port": 3846
    },
    "plugin": {
      "paired": false
    },
    "pairing": {
      "tokenRequired": true,
      "tokenExpiresAt": "2026-04-26T00:10:00.000Z"
    }
  }
}
```

### 4.2 `figma_get_selection`

Reads the current selection from the open Figma file.

Input:

```json
{
  "includeNodeSummary": true
}
```

Schema:

- `includeNodeSummary`: optional boolean, default `true`.

Output:

```json
{
  "ok": true,
  "data": {
    "selectionCount": 1,
    "selection": [
      {
        "id": "123:456",
        "name": "Primary CTA",
        "type": "TEXT",
        "visible": true
      }
    ]
  }
}
```

### 4.3 `figma_read_node`

Reads one node by ID.

Input:

```json
{
  "nodeId": "123:456",
  "maxDepth": 2,
  "includeHidden": false,
  "includeGeometry": false
}
```

Schema:

- `nodeId`: required string.
- `maxDepth`: optional integer from `0` to `4`, default `1`.
- `includeHidden`: optional boolean, default `false`.
- `includeGeometry`: optional boolean, default `false`.

Output:

```json
{
  "ok": true,
  "data": {
    "node": {
      "id": "123:456",
      "name": "Primary CTA",
      "type": "TEXT",
      "x": 120,
      "y": 80,
      "width": 160,
      "height": 44,
      "characters": "Continue"
    }
  }
}
```

### 4.4 `figma_read_tree`

Reads a bounded tree from the current page or from a target node.

Input:

```json
{
  "rootNodeId": "123:456",
  "maxDepth": 3,
  "maxNodes": 200,
  "includeHidden": false
}
```

Schema:

- `rootNodeId`: optional string. If omitted, use current page.
- `maxDepth`: optional integer from `0` to `4`, default `2`.
- `maxNodes`: optional integer from `1` to `500`, default `200`.
- `includeHidden`: optional boolean, default `false`.

Output:

```json
{
  "ok": true,
  "data": {
    "root": {
      "id": "0:1",
      "name": "Page 1",
      "type": "PAGE",
      "children": []
    },
    "truncated": false,
    "nodeCount": 42
  }
}
```

### 4.5 `figma_create_node`

Creates a supported node.

Input:

```json
{
  "type": "TEXT",
  "parentId": "123:100",
  "name": "Primary CTA Label",
  "x": 24,
  "y": 20,
  "text": {
    "characters": "Continue",
    "fontSize": 16,
    "fontWeight": 600
  },
  "fills": [
    {
      "type": "SOLID",
      "color": {
        "r": 0,
        "g": 0,
        "b": 0
      },
      "opacity": 1
    }
  ]
}
```

Supported MVP node types:

- `FRAME`
- `RECTANGLE`
- `TEXT`

Output:

```json
{
  "ok": true,
  "data": {
    "node": {
      "id": "123:789",
      "name": "Primary CTA Label",
      "type": "TEXT",
      "parentId": "123:100"
    }
  }
}
```

### 4.6 `figma_update_node`

Updates whitelisted properties on one node.

Input:

```json
{
  "nodeId": "123:789",
  "properties": {
    "name": "Primary CTA",
    "x": 120,
    "y": 80,
    "width": 160,
    "height": 44,
    "visible": true
  }
}
```

Schema:

- `nodeId`: required string.
- `properties`: required object.
- `properties` may include only supported fields listed in `COMMAND_DSL.md`.

Output:

```json
{
  "ok": true,
  "data": {
    "node": {
      "id": "123:789",
      "name": "Primary CTA",
      "type": "TEXT"
    },
    "changedProperties": ["name", "x", "y", "width", "height", "visible"]
  }
}
```

### 4.7 `figma_delete_node`

Deletes one node by ID.

Input:

```json
{
  "nodeId": "123:789"
}
```

Output:

```json
{
  "ok": true,
  "data": {
    "deletedNode": {
      "id": "123:789",
      "name": "Primary CTA",
      "type": "TEXT"
    }
  }
}
```

### 4.8 `figma_batch`

Applies multiple read or mutation operations in order.

Input:

```json
{
  "operations": [
    {
      "type": "createNode",
      "node": {
        "type": "RECTANGLE",
        "name": "Background",
        "x": 0,
        "y": 0,
        "width": 320,
        "height": 180
      }
    },
    {
      "type": "readTree",
      "options": {
        "maxDepth": 1,
        "maxNodes": 50
      }
    }
  ],
  "options": {
    "dryRun": false,
    "stopOnError": true
  }
}
```

Schema:

- `operations`: required array, 1 to 100 items.
- `options.dryRun`: optional boolean, default `false`.
- `options.stopOnError`: optional boolean, default `true`.

Output:

```json
{
  "ok": true,
  "data": {
    "results": [
      {
        "index": 0,
        "ok": true,
        "result": {
          "nodeId": "123:900"
        }
      },
      {
        "index": 1,
        "ok": true,
        "result": {
          "nodeCount": 12
        }
      }
    ]
  }
}
```

## 5. Post-MVP Tools

Candidates after MVP:

- `figma_set_selection`
- `figma_focus_node`
- `figma_clone_node`
- `figma_scan_text_nodes`
- `figma_set_text_content`
- `figma_set_multiple_text_contents`
- `figma_get_local_styles`
- `figma_get_local_components`
- `figma_create_component_instance`
- `figma_export_node`

These should be added only after the MVP bridge is stable.

## 6. Tool To DSL Mapping

| MCP Tool              | DSL Command                                       |
| --------------------- | ------------------------------------------------- |
| `figma_status`        | local server state and optional `getPluginStatus` |
| `figma_get_selection` | `getSelection`                                    |
| `figma_read_node`     | `readNode`                                        |
| `figma_read_tree`     | `readTree`                                        |
| `figma_create_node`   | `createNode`                                      |
| `figma_update_node`   | `updateNode`                                      |
| `figma_delete_node`   | `deleteNode`                                      |
| `figma_batch`         | `batch`                                           |

## 7. Validation Expectations

Validation happens twice:

- MCP server validates agent input before sending commands to the plugin.
- Plugin validates again before calling Figma Plugin API.

Double validation is intentional. It prevents malformed commands from reaching Figma even if the MCP server and plugin versions drift.
