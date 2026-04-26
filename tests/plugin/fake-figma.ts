import type { MinimalFigma, MinimalNode } from "@plugin/figma-types";

export interface FakeFigma extends MinimalFigma {
  nodes: Map<string, MinimalNode>;
  loadedFonts: Array<{ family: string; style: string }>;
}

let nextId = 1;

function createNode(type: MinimalNode["type"], name: string): MinimalNode {
  return {
    id: `${type.toLowerCase()}-${nextId++}`,
    type,
    name,
    visible: true,
    locked: false,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    children: [],
    parent: null,
    remove() {
      if (this.parent) {
        this.parent.children = (this.parent.children ?? []).filter((child) => child.id !== this.id);
      }
    },
    resize(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
  };
}

export function createFakeFigma(): FakeFigma {
  nextId = 1;
  const nodes = new Map<string, MinimalNode>();
  const loadedFonts: Array<{ family: string; style: string }> = [];

  const page = createNode("PAGE", "Page 1");
  page.id = "page-1";

  const frame = createNode("FRAME", "Frame");
  frame.id = "frame-1";
  frame.parent = page;

  const text = createNode("TEXT", "Label");
  text.id = "text-1";
  text.parent = frame;
  text.characters = "Label";

  frame.children!.push(text);
  page.children!.push(frame);

  for (const node of [page, frame, text]) {
    nodes.set(node.id, node);
  }

  const figma: FakeFigma = {
    nodes,
    loadedFonts,
    currentPage: Object.assign(page, { selection: [] }),
    async getNodeByIdAsync(id: string) {
      return nodes.get(id) ?? null;
    },
    createFrame() {
      const node = createNode("FRAME", "Frame");
      nodes.set(node.id, node);
      return node;
    },
    createRectangle() {
      const node = createNode("RECTANGLE", "Rectangle");
      nodes.set(node.id, node);
      return node;
    },
    createText() {
      const node = createNode("TEXT", "Text");
      nodes.set(node.id, node);
      return node;
    },
    async loadFontAsync(fontName: { family: string; style: string }) {
      loadedFonts.push(fontName);
    }
  };

  const originalDelete = nodes.delete.bind(nodes);
  nodes.delete = (id: string) => originalDelete(id);

  return figma;
}
