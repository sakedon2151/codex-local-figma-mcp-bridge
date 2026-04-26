import { ErrorCode } from "@shared/errors";
import type { CommandDsl } from "@shared/protocol";
import type { MinimalFigma, MinimalNode } from "../figma-types";
import { PluginCommandError } from "../plugin-errors";
import { serializeNode, serializeTree } from "../serializer";

export function getSelection(figma: MinimalFigma): unknown {
  return {
    selectionCount: figma.currentPage.selection.length,
    selection: figma.currentPage.selection.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible
    }))
  };
}

export async function readNode(figma: MinimalFigma, command: CommandDsl): Promise<unknown> {
  const nodeId = command.target?.nodeId;
  if (!nodeId) {
    throw new PluginCommandError(ErrorCode.NodeNotFound, "Missing node ID.");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new PluginCommandError(ErrorCode.NodeNotFound, `Node not found: ${nodeId}`);
  }

  const maxDepth = typeof command.options?.maxDepth === "number" ? command.options.maxDepth : 1;
  return serializeTree(node, {
    maxDepth,
    maxNodes: 500,
    includeHidden:
      typeof command.options?.includeHidden === "boolean" ? command.options.includeHidden : false
  });
}

export async function readTree(figma: MinimalFigma, command: CommandDsl): Promise<unknown> {
  let root: MinimalNode | null = figma.currentPage;
  if (command.target?.nodeId) {
    root = await figma.getNodeByIdAsync(command.target.nodeId);
  }

  if (!root) {
    throw new PluginCommandError(ErrorCode.NodeNotFound, "Root node not found.");
  }

  return serializeTree(root, {
    maxDepth: typeof command.options?.maxDepth === "number" ? command.options.maxDepth : 2,
    maxNodes: typeof command.options?.maxNodes === "number" ? command.options.maxNodes : 200,
    includeHidden:
      typeof command.options?.includeHidden === "boolean" ? command.options.includeHidden : false
  });
}

export function getPluginStatus(figma: MinimalFigma): unknown {
  return {
    editorType: "figma",
    currentPage: {
      id: figma.currentPage.id,
      name: figma.currentPage.name
    },
    capabilities: ["read", "mutate", "batch", "progress"]
  };
}

export { serializeNode };
