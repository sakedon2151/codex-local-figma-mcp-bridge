import { dispatchPluginCommand } from "@plugin/commands/dispatcher";
import { createFakeFigma } from "./fake-figma";

describe("plugin command dispatcher", () => {
  it("rejects unknown commands", async () => {
    const figma = createFakeFigma();

    await expect(dispatchPluginCommand(figma, { type: "closeEverything" })).rejects.toMatchObject({
      code: "INVALID_MESSAGE"
    });
  });
});
