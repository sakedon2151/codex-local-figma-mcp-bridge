# Command DSL

## 1. Purpose

The command DSL is the internal command language sent from the local MCP server to the Figma plugin. It is lower-level than the MCP tools and maps closely to Figma Plugin API operations.

The DSL is structured JSON. It must never accept raw JavaScript as a command.

## 2. Command Envelope

```json
{
  "type": "updateNode",
  "target": {
    "nodeId": "123:456"
  },
  "payload": {
    "name": "Primary CTA",
    "x": 120,
    "y": 80
  },
  "options": {
    "dryRun": false
  }
}
```

Envelope fields:

- `type`: required command type.
- `target`: optional command target.
- `payload`: optional command payload.
- `options`: optional execution options.

The transport-level `commandId` lives outside this object in the protocol message envelope.

## 3. Core Commands

### 3.1 `getPluginStatus`

Returns plugin-side status.

Payload:

```json
{}
```

Result:

```json
{
  "editorType": "figma",
  "currentPage": {
    "id": "0:1",
    "name": "Page 1"
  },
  "capabilities": ["read", "mutate", "batch", "progress"]
}
```

### 3.2 `getSelection`

Returns current selection.

Payload:

```json
{
  "includeNodeSummary": true
}
```

### 3.3 `readNode`

Reads a node by ID.

Target:

```json
{
  "nodeId": "123:456"
}
```

Options:

```json
{
  "maxDepth": 1,
  "includeHidden": false,
  "includeGeometry": false
}
```

### 3.4 `readTree`

Reads a bounded subtree. If `target.nodeId` is omitted, the root is `figma.currentPage`.

Target:

```json
{
  "nodeId": "123:456"
}
```

Options:

```json
{
  "maxDepth": 2,
  "maxNodes": 200,
  "includeHidden": false
}
```

### 3.5 `createNode`

Creates a node.

Payload:

```json
{
  "type": "FRAME",
  "parentId": "0:1",
  "name": "Card",
  "x": 100,
  "y": 100,
  "width": 320,
  "height": 180,
  "fills": [
    {
      "type": "SOLID",
      "color": {
        "r": 1,
        "g": 1,
        "b": 1
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

### 3.6 `updateNode`

Updates one node.

Target:

```json
{
  "nodeId": "123:456"
}
```

Payload:

```json
{
  "name": "Primary CTA",
  "x": 120,
  "y": 80,
  "width": 160,
  "height": 44,
  "visible": true
}
```

### 3.7 `deleteNode`

Deletes one node.

Target:

```json
{
  "nodeId": "123:456"
}
```

The command returns node identity before deletion:

```json
{
  "id": "123:456",
  "name": "Primary CTA",
  "type": "TEXT"
}
```

### 3.8 `batch`

Runs commands in sequence.

Payload:

```json
{
  "operations": [
    {
      "type": "createNode",
      "payload": {
        "type": "RECTANGLE",
        "name": "Background",
        "x": 0,
        "y": 0,
        "width": 320,
        "height": 180
      }
    }
  ],
  "options": {
    "dryRun": false,
    "stopOnError": true
  }
}
```

Rules:

- Batch operations run in order.
- Default behavior is stop on first error.
- Results include one entry per attempted operation.
- Large batches emit progress events.

## 4. Node Creation Specs

### 4.1 Shared Geometry

Applicable to scene nodes that support position and size:

```json
{
  "x": 0,
  "y": 0,
  "width": 100,
  "height": 100
}
```

Rules:

- `x` and `y` default to `0`.
- `width` and `height` must be positive when provided.
- Nodes that support `resize` use `resize(width, height)`.

### 4.2 Paint

Solid paint:

```json
{
  "type": "SOLID",
  "color": {
    "r": 0.1,
    "g": 0.2,
    "b": 0.3
  },
  "opacity": 1
}
```

Rules:

- RGB values are floats from `0` to `1`.
- Opacity is a float from `0` to `1`.
- MVP supports solid paints only.

### 4.3 Frame Spec

```json
{
  "type": "FRAME",
  "name": "Container",
  "x": 0,
  "y": 0,
  "width": 320,
  "height": 180,
  "layout": {
    "mode": "NONE"
  }
}
```

Supported layout modes:

- `NONE`
- `HORIZONTAL`
- `VERTICAL`

### 4.4 Rectangle Spec

```json
{
  "type": "RECTANGLE",
  "name": "Background",
  "x": 0,
  "y": 0,
  "width": 320,
  "height": 180,
  "cornerRadius": 8
}
```

### 4.5 Text Spec

```json
{
  "type": "TEXT",
  "name": "Label",
  "x": 24,
  "y": 20,
  "text": {
    "characters": "Continue",
    "fontFamily": "Inter",
    "fontStyle": "Regular",
    "fontSize": 16,
    "fontWeight": 400
  }
}
```

Rules:

- Text commands must load fonts before setting characters.
- Default font is `Inter Regular`.
- If the requested font fails to load, return `FONT_LOAD_FAILED`.

## 5. Update Property Whitelist

MVP shared properties:

- `name`
- `visible`
- `locked`
- `x`
- `y`
- `width`
- `height`
- `fills`
- `strokes`
- `strokeWeight`
- `opacity`
- `cornerRadius`

Text-only properties:

- `characters`
- `fontSize`
- `fontName`
- `textAlignHorizontal`
- `textAlignVertical`
- `letterSpacing`
- `lineHeight`

Frame-only auto layout properties:

- `layoutMode`
- `layoutWrap`
- `paddingTop`
- `paddingRight`
- `paddingBottom`
- `paddingLeft`
- `primaryAxisAlignItems`
- `counterAxisAlignItems`
- `itemSpacing`
- `layoutSizingHorizontal`
- `layoutSizingVertical`

Unsupported properties must return `UNSUPPORTED_PROPERTY`.

## 6. Node Serialization

Serialized node shape:

```json
{
  "id": "123:456",
  "name": "Primary CTA",
  "type": "TEXT",
  "visible": true,
  "locked": false,
  "x": 120,
  "y": 80,
  "width": 160,
  "height": 44,
  "fills": [],
  "strokes": [],
  "children": []
}
```

Serialization rules:

- Remove noisy fields such as `boundVariables` and image references unless explicitly requested.
- Skip vector geometry by default unless `includeGeometry` is true.
- Include children only up to `maxDepth`.
- Stop traversal when `maxNodes` is reached.
- Return `truncated: true` when limits cut off output.

## 7. Dry Run

`options.dryRun: true` validates the command and returns the expected operation summary without mutating Figma.

Dry run is required for:

- `batch` with more than 25 mutations when requested by MCP tool policy.
- destructive preview flows.

Dry run is best effort for create/update/delete because exact Figma-generated node IDs are not known until mutation.

## 8. Undo Strategy

Commands should be small enough for Figma undo to remain useful.

Batch commands should:

- group related mutations together where the Plugin API supports it.
- report operation summaries.
- avoid mixing large unrelated destructive operations in one batch.

## 9. Validation Locations

Validation happens in two places:

- MCP server validates tool input and converts to DSL.
- Plugin validates DSL before invoking Figma Plugin API.

The plugin is the final authority because it runs closest to Figma.
