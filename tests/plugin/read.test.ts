import { dispatchPluginCommand } from "@plugin/commands/dispatcher";
import { createFakeFigma } from "./fake-figma";

describe("plugin read commands", () => {
  it("returns selection summaries", async () => {
    const figma = createFakeFigma();
    figma.currentPage.selection = [figma.nodes.get("text-1")!];

    await expect(
      dispatchPluginCommand(figma, { type: "getSelection", payload: { includeNodeSummary: true } })
    ).resolves.toEqual({
      selectionCount: 1,
      selection: [{ id: "text-1", name: "Label", type: "TEXT", visible: true }]
    });
  });

  it("limits read tree depth and node count", async () => {
    const figma = createFakeFigma();

    const result = await dispatchPluginCommand(figma, {
      type: "readTree",
      options: { maxDepth: 1, maxNodes: 2, includeHidden: false }
    });

    expect(result).toMatchObject({
      nodeCount: 2,
      truncated: true,
      root: {
        id: "page-1",
        children: [{ id: "frame-1" }]
      }
    });
  });
});
