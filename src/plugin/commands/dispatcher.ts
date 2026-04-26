import { ErrorCode } from "@shared/errors";
import type { CommandDsl } from "@shared/protocol";
import { commandDslSchema } from "@shared/schemas";
import type { MinimalFigma } from "../figma-types";
import { PluginCommandError } from "../plugin-errors";
import { batch } from "./batch";
import { createNode, deleteNode, updateNode } from "./mutate";
import { getPluginStatus, getSelection, readNode, readTree } from "./read";

export interface DispatchProgress {
  status: "started" | "in_progress" | "completed" | "error";
  progress: number;
  processedItems: number;
  totalItems: number;
  message: string;
}

export interface DispatchContext {
  onProgress?: (progress: DispatchProgress) => void;
}

function parseCommand(command: unknown): CommandDsl {
  const parsed = commandDslSchema.safeParse(command);
  if (parsed.success) {
    return parsed.data as CommandDsl;
  }

  if (
    typeof command === "object" &&
    command !== null &&
    "type" in command &&
    command.type === "updateNode"
  ) {
    throw new PluginCommandError(ErrorCode.UnsupportedProperty, "Unsupported update property.");
  }

  throw new PluginCommandError(ErrorCode.InvalidMessage, "Unknown or invalid command.");
}

export async function dispatchPluginCommand(
  figma: MinimalFigma,
  rawCommand: unknown,
  context: DispatchContext = {}
): Promise<unknown> {
  const command = parseCommand(rawCommand);

  switch (command.type) {
    case "getPluginStatus":
      return getPluginStatus(figma);
    case "getSelection":
      return getSelection(figma);
    case "readNode":
      return readNode(figma, command);
    case "readTree":
      return readTree(figma, command);
    case "createNode":
      return createNode(figma, command);
    case "updateNode":
      return updateNode(figma, command);
    case "deleteNode":
      return deleteNode(figma, command);
    case "batch":
      return batch(figma, command, context);
    default:
      throw new PluginCommandError(ErrorCode.InvalidMessage, "Unknown command.");
  }
}
