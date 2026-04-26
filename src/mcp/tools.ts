import { z } from "zod";
import { CodedError, ErrorCode, toCodedError } from "@shared/errors";
import type { CommandDsl, CommandResponsePayload } from "@shared/protocol";
import {
  commandDslSchema,
  createNodePayloadSchema,
  updateNodePayloadSchema
} from "@shared/schemas";
import { createErrorResult, createSuccessResult, type TextToolResult } from "./tool-results";

export interface FigmaBridgeForTools {
  getStatus: () => unknown;
  sendCommand: (command: CommandDsl) => Promise<CommandResponsePayload>;
}

export interface FigmaToolHandlers {
  figma_status: (input: unknown) => Promise<TextToolResult>;
  figma_get_selection: (input: unknown) => Promise<TextToolResult>;
  figma_read_node: (input: unknown) => Promise<TextToolResult>;
  figma_read_tree: (input: unknown) => Promise<TextToolResult>;
  figma_create_node: (input: unknown) => Promise<TextToolResult>;
  figma_update_node: (input: unknown) => Promise<TextToolResult>;
  figma_delete_node: (input: unknown) => Promise<TextToolResult>;
  figma_batch: (input: unknown) => Promise<TextToolResult>;
}

const emptyInputSchema = z.object({}).passthrough();

const getSelectionInputSchema = z
  .object({
    includeNodeSummary: z.boolean().optional()
  })
  .strict();

const readNodeInputSchema = z
  .object({
    nodeId: z.string().min(1),
    maxDepth: z.number().int().min(0).max(4).optional(),
    includeHidden: z.boolean().optional(),
    includeGeometry: z.boolean().optional()
  })
  .strict();

const readTreeInputSchema = z
  .object({
    rootNodeId: z.string().min(1).optional(),
    maxDepth: z.number().int().min(0).max(4).optional(),
    maxNodes: z.number().int().min(1).max(500).optional(),
    includeHidden: z.boolean().optional()
  })
  .strict();

const deleteNodeInputSchema = z.object({ nodeId: z.string().min(1) }).strict();

const batchInputSchema = z
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
  .strict();

function nowMs(): number {
  return Date.now();
}

function commandMeta(commandId: string, startedAt: number) {
  return {
    commandId,
    durationMs: Math.max(0, Date.now() - startedAt)
  };
}

function invalidInputResult(startedAt: number): TextToolResult {
  return createErrorResult(
    new CodedError(ErrorCode.InvalidMessage, "Invalid tool input.").toJSON(),
    commandMeta("local", startedAt)
  );
}

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

async function executeCommand(
  bridge: FigmaBridgeForTools,
  command: CommandDsl,
  startedAt: number
): Promise<TextToolResult> {
  try {
    const commandValidation = commandDslSchema.safeParse(command);
    if (!commandValidation.success) {
      return invalidInputResult(startedAt);
    }

    const response = await bridge.sendCommand(command);
    if (response.ok) {
      return createSuccessResult(
        response.result ?? null,
        commandMeta(response.commandId, startedAt)
      );
    }

    return createErrorResult(
      {
        code: response.error?.code as ErrorCode,
        message: response.error?.message ?? "Command failed.",
        ...(response.error?.details ? { details: response.error.details } : {})
      },
      commandMeta(response.commandId, startedAt)
    );
  } catch (error) {
    const coded = toCodedError(error, "Command failed.");
    return createErrorResult(coded.toJSON(), commandMeta("local", startedAt));
  }
}

export function createFigmaToolHandlers(bridge: FigmaBridgeForTools): FigmaToolHandlers {
  return {
    async figma_status(input: unknown) {
      const startedAt = nowMs();
      const parsed = emptyInputSchema.safeParse(input ?? {});
      if (!parsed.success) {
        return invalidInputResult(startedAt);
      }
      return createSuccessResult(bridge.getStatus(), commandMeta("local", startedAt));
    },

    async figma_get_selection(input: unknown) {
      const startedAt = nowMs();
      const parsed = getSelectionInputSchema.safeParse(input ?? {});
      if (!parsed.success) {
        return invalidInputResult(startedAt);
      }
      return executeCommand(
        bridge,
        {
          type: "getSelection",
          payload: {
            includeNodeSummary: parsed.data.includeNodeSummary ?? true
          }
        },
        startedAt
      );
    },

    async figma_read_node(input: unknown) {
      const startedAt = nowMs();
      const parsed = readNodeInputSchema.safeParse(input);
      if (!parsed.success) {
        return invalidInputResult(startedAt);
      }
      const { nodeId, ...options } = parsed.data;
      return executeCommand(
        bridge,
        {
          type: "readNode",
          target: { nodeId },
          options: stripUndefined(options)
        },
        startedAt
      );
    },

    async figma_read_tree(input: unknown) {
      const startedAt = nowMs();
      const parsed = readTreeInputSchema.safeParse(input ?? {});
      if (!parsed.success) {
        return invalidInputResult(startedAt);
      }
      const { rootNodeId, ...options } = parsed.data;
      return executeCommand(
        bridge,
        {
          type: "readTree",
          ...(rootNodeId ? { target: { nodeId: rootNodeId } } : {}),
          options: stripUndefined(options)
        },
        startedAt
      );
    },

    async figma_create_node(input: unknown) {
      const startedAt = nowMs();
      const parsed = createNodePayloadSchema.safeParse(input);
      if (!parsed.success) {
        return invalidInputResult(startedAt);
      }
      return executeCommand(bridge, { type: "createNode", payload: parsed.data }, startedAt);
    },

    async figma_update_node(input: unknown) {
      const startedAt = nowMs();
      const parsed = z
        .object({
          nodeId: z.string().min(1),
          properties: updateNodePayloadSchema
        })
        .strict()
        .safeParse(input);
      if (!parsed.success) {
        return invalidInputResult(startedAt);
      }
      return executeCommand(
        bridge,
        {
          type: "updateNode",
          target: { nodeId: parsed.data.nodeId },
          payload: parsed.data.properties
        },
        startedAt
      );
    },

    async figma_delete_node(input: unknown) {
      const startedAt = nowMs();
      const parsed = deleteNodeInputSchema.safeParse(input);
      if (!parsed.success) {
        return invalidInputResult(startedAt);
      }
      return executeCommand(
        bridge,
        {
          type: "deleteNode",
          target: { nodeId: parsed.data.nodeId }
        },
        startedAt
      );
    },

    async figma_batch(input: unknown) {
      const startedAt = nowMs();
      const parsed = batchInputSchema.safeParse(input);
      if (!parsed.success) {
        return invalidInputResult(startedAt);
      }
      return executeCommand(
        bridge,
        {
          type: "batch",
          payload: parsed.data
        },
        startedAt
      );
    }
  };
}
