import { z } from "zod";
import { ErrorCode } from "./errors";
import { PROTOCOL_VERSION } from "./protocol";

export const capabilitySchema = z.enum(["read", "mutate", "batch", "progress"]);

export const nodeTypeSchema = z.enum(["FRAME", "RECTANGLE", "TEXT"]);

const isoStringSchema = z.string().min(1);

const protocolBase = {
  version: z.literal(PROTOCOL_VERSION),
  id: z.string().min(1),
  sessionId: z.string().min(1),
  sentAt: isoStringSchema
};

const protocolErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.unknown()).optional()
  })
  .strict();

export const commandTargetSchema = z
  .object({
    nodeId: z.string().min(1).optional()
  })
  .strict();

const solidPaintSchema = z
  .object({
    type: z.literal("SOLID"),
    color: z
      .object({
        r: z.number().min(0).max(1),
        g: z.number().min(0).max(1),
        b: z.number().min(0).max(1)
      })
      .strict(),
    opacity: z.number().min(0).max(1).optional()
  })
  .strict();

const textSpecSchema = z
  .object({
    characters: z.string().optional(),
    fontFamily: z.string().min(1).optional(),
    fontStyle: z.string().min(1).optional(),
    fontSize: z.number().positive().optional(),
    fontWeight: z.number().optional()
  })
  .strict();

export const createNodePayloadSchema = z
  .object({
    type: nodeTypeSchema,
    parentId: z.string().min(1).optional(),
    name: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    fills: z.array(solidPaintSchema).optional(),
    strokes: z.array(solidPaintSchema).optional(),
    strokeWeight: z.number().positive().optional(),
    opacity: z.number().min(0).max(1).optional(),
    cornerRadius: z.number().min(0).optional(),
    layout: z
      .object({
        mode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional()
      })
      .strict()
      .optional(),
    text: textSpecSchema.optional()
  })
  .strict();

export const updateNodePayloadSchema = z
  .object({
    name: z.string().optional(),
    visible: z.boolean().optional(),
    locked: z.boolean().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    fills: z.array(solidPaintSchema).optional(),
    strokes: z.array(solidPaintSchema).optional(),
    strokeWeight: z.number().positive().optional(),
    opacity: z.number().min(0).max(1).optional(),
    cornerRadius: z.number().min(0).optional(),
    characters: z.string().optional(),
    fontSize: z.number().positive().optional(),
    fontName: z
      .object({
        family: z.string().min(1),
        style: z.string().min(1)
      })
      .strict()
      .optional(),
    textAlignHorizontal: z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional(),
    textAlignVertical: z.enum(["TOP", "CENTER", "BOTTOM"]).optional(),
    letterSpacing: z.unknown().optional(),
    lineHeight: z.unknown().optional(),
    layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional(),
    layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional(),
    paddingTop: z.number().optional(),
    paddingRight: z.number().optional(),
    paddingBottom: z.number().optional(),
    paddingLeft: z.number().optional(),
    primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional(),
    counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional(),
    itemSpacing: z.number().optional(),
    layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional(),
    layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one property is required.");

const readNodeCommandSchema = z
  .object({
    type: z.literal("readNode"),
    target: z.object({ nodeId: z.string().min(1) }).strict(),
    options: z
      .object({
        maxDepth: z.number().int().min(0).max(4).optional(),
        includeHidden: z.boolean().optional(),
        includeGeometry: z.boolean().optional()
      })
      .strict()
      .optional()
  })
  .strict();

const readTreeCommandSchema = z
  .object({
    type: z.literal("readTree"),
    target: commandTargetSchema.optional(),
    options: z
      .object({
        maxDepth: z.number().int().min(0).max(4).optional(),
        maxNodes: z.number().int().min(1).max(500).optional(),
        includeHidden: z.boolean().optional()
      })
      .strict()
      .optional()
  })
  .strict();

const getSelectionCommandSchema = z
  .object({
    type: z.literal("getSelection"),
    payload: z
      .object({
        includeNodeSummary: z.boolean().optional()
      })
      .strict()
      .optional()
  })
  .strict();

const getPluginStatusCommandSchema = z
  .object({
    type: z.literal("getPluginStatus"),
    payload: z.object({}).strict().optional()
  })
  .strict();

const createNodeCommandSchema = z
  .object({
    type: z.literal("createNode"),
    payload: createNodePayloadSchema
  })
  .strict();

const updateNodeCommandSchema = z
  .object({
    type: z.literal("updateNode"),
    target: z.object({ nodeId: z.string().min(1) }).strict(),
    payload: updateNodePayloadSchema
  })
  .strict();

const deleteNodeCommandSchema = z
  .object({
    type: z.literal("deleteNode"),
    target: z.object({ nodeId: z.string().min(1) }).strict()
  })
  .strict();

export type CommandDslInput = z.input<typeof commandDslSchema>;

export const commandDslSchema: z.ZodType = z.lazy(() =>
  z.discriminatedUnion("type", [
    getPluginStatusCommandSchema,
    getSelectionCommandSchema,
    readNodeCommandSchema,
    readTreeCommandSchema,
    createNodeCommandSchema,
    updateNodeCommandSchema,
    deleteNodeCommandSchema,
    z
      .object({
        type: z.literal("batch"),
        payload: z
          .object({
            operations: z.array(commandDslSchema).min(1).max(100),
            options: z
              .object({
                dryRun: z.boolean().optional(),
                stopOnError: z.boolean().optional()
              })
              .strict()
              .optional()
          })
          .strict()
      })
      .strict()
  ])
);

export const commandResponsePayloadSchema = z.discriminatedUnion("ok", [
  z
    .object({
      commandId: z.string().min(1),
      ok: z.literal(true),
      result: z.unknown().optional()
    })
    .strict(),
  z
    .object({
      commandId: z.string().min(1),
      ok: z.literal(false),
      error: protocolErrorSchema
    })
    .strict()
]);

export const commandProgressPayloadSchema = z
  .object({
    commandId: z.string().min(1),
    status: z.enum(["started", "in_progress", "completed", "error"]),
    progress: z.number().min(0).max(100),
    processedItems: z.number().int().min(0),
    totalItems: z.number().int().min(0),
    message: z.string()
  })
  .strict();

export const protocolMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...protocolBase,
      type: z.literal("plugin.hello"),
      payload: z
        .object({
          pairingToken: z.string().min(1),
          pluginVersion: z.string().min(1),
          editorType: z.enum(["figma", "figjam"]),
          capabilities: z.array(capabilitySchema)
        })
        .strict()
    })
    .strict(),
  z
    .object({
      ...protocolBase,
      type: z.literal("session.accepted"),
      payload: z
        .object({
          serverVersion: z.string().min(1),
          heartbeatIntervalMs: z.number().int().positive(),
          commandTimeoutMs: z.number().int().positive(),
          maxPayloadBytes: z.number().int().positive()
        })
        .strict()
    })
    .strict(),
  z
    .object({
      ...protocolBase,
      type: z.literal("session.rejected"),
      payload: z.object({ error: protocolErrorSchema }).strict()
    })
    .strict(),
  z
    .object({
      ...protocolBase,
      type: z.literal("heartbeat.ping"),
      payload: z.object({ pluginUptimeMs: z.number().min(0) }).strict()
    })
    .strict(),
  z
    .object({
      ...protocolBase,
      type: z.literal("heartbeat.pong"),
      payload: z.object({ serverUptimeMs: z.number().min(0) }).strict()
    })
    .strict(),
  z
    .object({
      ...protocolBase,
      type: z.literal("command.request"),
      payload: z
        .object({
          commandId: z.string().min(1),
          command: commandDslSchema
        })
        .strict()
    })
    .strict(),
  z
    .object({
      ...protocolBase,
      type: z.literal("command.response"),
      payload: commandResponsePayloadSchema
    })
    .strict(),
  z
    .object({
      ...protocolBase,
      type: z.literal("command.progress"),
      payload: commandProgressPayloadSchema
    })
    .strict()
]);

export function invalidMessage(message = "Invalid message.") {
  return {
    code: ErrorCode.InvalidMessage,
    message
  };
}
