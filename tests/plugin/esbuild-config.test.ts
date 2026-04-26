import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("plugin bundling config", () => {
  it("targets a Figma-compatible JavaScript level", () => {
    const config = readFileSync(resolve(process.cwd(), "esbuild.config.mjs"), "utf8");

    expect(config.match(/target:\s*"es2017"/g)).toHaveLength(2);
    expect(config).not.toContain('target: "es2020"');
  });
});
