import { dispatchPluginCommand } from "@plugin/commands/dispatcher";
import { createFakeFigma } from "./fake-figma";

describe("plugin mutation commands", () => {
  it.each(["FRAME", "RECTANGLE", "TEXT"] as const)("creates %s nodes", async (type) => {
    const figma = createFakeFigma();

    const result = await dispatchPluginCommand(figma, {
      type: "createNode",
      payload: {
        type,
        parentId: "page-1",
        name: `${type} node`,
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        text: type === "TEXT" ? { characters: "Hello", fontSize: 16 } : undefined
      }
    });

    expect(result).toMatchObject({ name: `${type} node`, type, parentId: "page-1" });
  });

  it("loads a font before setting text characters", async () => {
    const figma = createFakeFigma();

    await dispatchPluginCommand(figma, {
      type: "createNode",
      payload: {
        type: "TEXT",
        parentId: "page-1",
        name: "Greeting",
        text: { characters: "Hello", fontFamily: "Inter", fontStyle: "Regular" }
      }
    });

    expect(figma.loadedFonts).toContainEqual({ family: "Inter", style: "Regular" });
  });

  it("updates only whitelisted properties", async () => {
    const figma = createFakeFigma();

    await expect(
      dispatchPluginCommand(figma, {
        type: "updateNode",
        target: { nodeId: "text-1" },
        payload: { unsafeScript: "figma.closePlugin()" }
      })
    ).rejects.toMatchObject({ code: "UNSUPPORTED_PROPERTY" });
  });

  it("deletes a node and returns its identity", async () => {
    const figma = createFakeFigma();

    const result = await dispatchPluginCommand(figma, {
      type: "deleteNode",
      target: { nodeId: "text-1" }
    });

    expect(result).toEqual({ id: "text-1", name: "Label", type: "TEXT" });
    expect(figma.nodes.has("text-1")).toBe(false);
  });
});
