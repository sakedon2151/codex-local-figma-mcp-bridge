import { describe, expect, it } from "vitest";
import manifest from "../../src/plugin/manifest.json";

describe("Figma plugin manifest", () => {
  it("stays a plugin manifest, not a widget manifest", () => {
    expect(manifest).not.toHaveProperty("containsWidget");
    expect(manifest).not.toHaveProperty("widgetApi");
  });

  it("uses Figma-importable localhost network access entries", () => {
    const allowedDomains = manifest.networkAccess.allowedDomains;

    expect(allowedDomains).toContain("ws://localhost:3846");
    expect(allowedDomains).toContain("http://localhost:3846");
    expect(allowedDomains).not.toContain("ws://127.0.0.1:3846");
    expect(allowedDomains).not.toContain("http://127.0.0.1:3846");
  });
});
