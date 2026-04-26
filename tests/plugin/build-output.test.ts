import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("plugin build output", () => {
  it("inlines the UI script into ui.html for Figma showUI", () => {
    execFileSync("node", ["esbuild.config.mjs"], {
      cwd: process.cwd(),
      stdio: "pipe"
    });

    const uiHtml = readFileSync(resolve(process.cwd(), "dist/plugin/ui.html"), "utf8");

    expect(uiHtml).not.toContain('<script src="./ui.js"></script>');
    expect(uiHtml).toContain("<script>");
    expect(uiHtml).toContain("new WebSocket");
    expect(uiHtml).toContain('setStatus("Not connected.")');
  });
});
