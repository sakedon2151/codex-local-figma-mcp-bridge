export type MinimalNodeType = "PAGE" | "FRAME" | "RECTANGLE" | "TEXT";

export interface MinimalNode {
  id: string;
  type: MinimalNodeType;
  name: string;
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
  fontName?: { family: string; style: string };
  children?: MinimalNode[];
  parent: MinimalNode | null;
  remove: () => void;
  resize?: (width: number, height: number) => void;
  appendChild?: (child: MinimalNode) => void;
}

export interface MinimalPage extends MinimalNode {
  selection: MinimalNode[];
}

export interface MinimalFigma {
  currentPage: MinimalPage;
  getNodeByIdAsync: (id: string) => Promise<MinimalNode | null>;
  createFrame: () => MinimalNode;
  createRectangle: () => MinimalNode;
  createText: () => MinimalNode;
  loadFontAsync: (fontName: { family: string; style: string }) => Promise<void>;
  ui?: {
    postMessage: (message: unknown) => void;
    onmessage?: (message: unknown) => void | Promise<void>;
  };
  showUI?: (html: string, options: { width: number; height: number }) => void;
  notify?: (message: string) => void;
  nodes?: Map<string, MinimalNode>;
}
