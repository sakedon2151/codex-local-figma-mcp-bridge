import { ErrorCode } from "@shared/errors";
import type { CommandDsl } from "@shared/protocol";
import { updateNodePayloadSchema } from "@shared/schemas";
import type { MinimalFigma, MinimalNode } from "../figma-types";
import { loadTextFont } from "../font";
import { PluginCommandError } from "../plugin-errors";
import { serializeNode } from "../serializer";

interface CreatePayload {
  type: "FRAME" | "RECTANGLE" | "TEXT";
  parentId?: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: {
    characters?: string;
    fontFamily?: string;
    fontStyle?: string;
    fontSize?: number;
  };
}

function appendChild(parent: MinimalNode, child: MinimalNode): void {
  if (parent.appendChild) {
    parent.appendChild(child);
    return;
  }
  child.parent = parent;
  parent.children ??= [];
  parent.children.push(child);
}

async function findParent(figma: MinimalFigma, parentId?: string): Promise<MinimalNode> {
  if (!parentId) {
    return figma.currentPage;
  }

  const parent = await figma.getNodeByIdAsync(parentId);
  if (!parent) {
    throw new PluginCommandError(ErrorCode.InvalidParent, `Parent node not found: ${parentId}`);
  }
  return parent;
}

export async function createNode(figma: MinimalFigma, command: CommandDsl): Promise<unknown> {
  const payload = command.payload as unknown as CreatePayload;
  const node =
    payload.type === "FRAME"
      ? figma.createFrame()
      : payload.type === "RECTANGLE"
        ? figma.createRectangle()
        : figma.createText();

  node.name = payload.name ?? node.name;
  if (payload.x !== undefined) {
    node.x = payload.x;
  }
  if (payload.y !== undefined) {
    node.y = payload.y;
  }
  if (payload.width && payload.height && node.resize) {
    node.resize(payload.width, payload.height);
  }

  if (payload.type === "TEXT") {
    const requestedFont = {
      ...(payload.text?.fontFamily ? { family: payload.text.fontFamily } : {}),
      ...(payload.text?.fontStyle ? { style: payload.text.fontStyle } : {})
    };
    const fontName = await loadTextFont(figma, node, requestedFont);
    node.fontName = fontName;
    node.characters = payload.text?.characters ?? "";
    if (payload.text?.fontSize) {
      node.fontSize = payload.text.fontSize;
    }
  }

  const parent = await findParent(figma, payload.parentId);
  appendChild(parent, node);

  return {
    ...serializeNode(node),
    parentId: parent.id
  };
}

export async function updateNode(figma: MinimalFigma, command: CommandDsl): Promise<unknown> {
  const parsed = updateNodePayloadSchema.safeParse(command.payload);
  if (!parsed.success) {
    throw new PluginCommandError(ErrorCode.UnsupportedProperty, "Unsupported update property.");
  }

  const nodeId = command.target?.nodeId;
  const node = nodeId ? await figma.getNodeByIdAsync(nodeId) : null;
  if (!node) {
    throw new PluginCommandError(ErrorCode.NodeNotFound, `Node not found: ${nodeId ?? ""}`);
  }

  const changedProperties: string[] = [];
  for (const [property, value] of Object.entries(parsed.data)) {
    if (property === "width" || property === "height") {
      continue;
    }
    Reflect.set(node, property, value);
    changedProperties.push(property);
  }

  if (parsed.data.width !== undefined || parsed.data.height !== undefined) {
    if (!node.resize) {
      throw new PluginCommandError(ErrorCode.UnsupportedProperty, "Node does not support resize.");
    }
    node.resize(parsed.data.width ?? node.width ?? 1, parsed.data.height ?? node.height ?? 1);
    if (parsed.data.width !== undefined) {
      changedProperties.push("width");
    }
    if (parsed.data.height !== undefined) {
      changedProperties.push("height");
    }
  }

  return {
    node: serializeNode(node),
    changedProperties
  };
}

export async function deleteNode(figma: MinimalFigma, command: CommandDsl): Promise<unknown> {
  const nodeId = command.target?.nodeId;
  const node = nodeId ? await figma.getNodeByIdAsync(nodeId) : null;
  if (!node) {
    throw new PluginCommandError(ErrorCode.NodeNotFound, `Node not found: ${nodeId ?? ""}`);
  }

  const identity = {
    id: node.id,
    name: node.name,
    type: node.type
  };

  node.remove();
  figma.nodes?.delete(node.id);

  return identity;
}
