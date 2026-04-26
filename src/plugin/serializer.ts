import type { MinimalNode } from "./figma-types";

export interface SerializedNode {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fills?: unknown[];
  strokes?: unknown[];
  strokeWeight?: number;
  opacity?: number;
  cornerRadius?: number;
  characters?: string;
  fontSize?: number;
  children?: SerializedNode[];
}

export interface SerializeTreeOptions {
  maxDepth: number;
  maxNodes: number;
  includeHidden: boolean;
}

export interface SerializedTree {
  root: SerializedNode;
  nodeCount: number;
  truncated: boolean;
}

export function serializeNode(node: MinimalNode, includeChildren = false): SerializedNode {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
    ...(node.locked !== undefined ? { locked: node.locked } : {}),
    ...(node.x !== undefined ? { x: node.x } : {}),
    ...(node.y !== undefined ? { y: node.y } : {}),
    ...(node.width !== undefined ? { width: node.width } : {}),
    ...(node.height !== undefined ? { height: node.height } : {}),
    ...(node.fills ? { fills: node.fills } : {}),
    ...(node.strokes ? { strokes: node.strokes } : {}),
    ...(node.strokeWeight !== undefined ? { strokeWeight: node.strokeWeight } : {}),
    ...(node.opacity !== undefined ? { opacity: node.opacity } : {}),
    ...(node.cornerRadius !== undefined ? { cornerRadius: node.cornerRadius } : {}),
    ...(node.characters !== undefined ? { characters: node.characters } : {}),
    ...(node.fontSize !== undefined ? { fontSize: node.fontSize } : {}),
    ...(includeChildren ? { children: [] } : {})
  };
}

export function serializeTree(root: MinimalNode, options: SerializeTreeOptions): SerializedTree {
  let nodeCount = 0;
  let truncated = false;

  function visit(node: MinimalNode, depth: number): SerializedNode | null {
    if (!options.includeHidden && !node.visible) {
      return null;
    }

    if (nodeCount >= options.maxNodes) {
      truncated = true;
      return null;
    }

    nodeCount += 1;
    const serialized = serializeNode(node, depth < options.maxDepth);

    if (depth < options.maxDepth) {
      const children: SerializedNode[] = [];
      for (const child of node.children ?? []) {
        const serializedChild = visit(child, depth + 1);
        if (serializedChild) {
          children.push(serializedChild);
        }
      }
      serialized.children = children;
    } else if ((node.children ?? []).length > 0) {
      truncated = true;
    }

    return serialized;
  }

  const serializedRoot = visit(root, 0);
  if (!serializedRoot) {
    throw new Error("Root node could not be serialized.");
  }

  return {
    root: serializedRoot,
    nodeCount,
    truncated
  };
}
