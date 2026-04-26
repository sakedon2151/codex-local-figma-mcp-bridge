import type { MinimalFigma, MinimalNode } from "./figma-types";

export async function loadTextFont(
  figma: MinimalFigma,
  node: MinimalNode,
  requested?: { family?: string; style?: string }
): Promise<{ family: string; style: string }> {
  const fontName = {
    family: requested?.family ?? node.fontName?.family ?? "Inter",
    style: requested?.style ?? node.fontName?.style ?? "Regular"
  };
  await figma.loadFontAsync(fontName);
  node.fontName = fontName;
  return fontName;
}
