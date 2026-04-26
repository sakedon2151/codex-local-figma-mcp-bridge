import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await readFile(path.join(root, filePath), "utf8");
  return JSON.parse(raw) as T;
};

const collectStrings = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }

  return [];
};

describe("Codex plugin wrapper", () => {
  it("declares the local-figma MCP server without placeholder values", async () => {
    const manifest = await readJson<{
      name: string;
      mcpServers: string;
      interface: { displayName: string; defaultPrompt: string[] };
    }>("plugins/local-figma/.codex-plugin/plugin.json");

    expect(manifest.name).toBe("local-figma");
    expect(manifest.mcpServers).toBe("./.mcp.json");
    expect(manifest.interface.displayName).toBe("Local Figma MCP");
    expect(manifest.interface.defaultPrompt).toContain("Show local-figma pairing status");
    expect(collectStrings(manifest).some((value) => value.includes("[TODO:"))).toBe(false);
  });

  it("starts the MCP server without npm lifecycle stdout", async () => {
    const config = await readJson<{
      mcpServers: Record<string, { command: string; args: string[]; cwd: string }>;
    }>("plugins/local-figma/.mcp.json");

    expect(config.mcpServers["local-figma"]).toEqual({
      command: "node",
      args: ["--import", "tsx", path.join(root, "src/mcp/server.ts")],
      cwd: root
    });
  });

  it("publishes the local plugin in the repo marketplace", async () => {
    const marketplace = await readJson<{
      name: string;
      plugins: Array<{
        name: string;
        source: { source: string; path: string };
        policy: { installation: string; authentication: string };
        category: string;
      }>;
    }>(".agents/plugins/marketplace.json");

    expect(marketplace.name).toBe("codex-talk-to-figma-project");
    expect(marketplace.plugins).toContainEqual({
      name: "local-figma",
      source: {
        source: "local",
        path: "./plugins/local-figma"
      },
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL"
      },
      category: "Coding"
    });
  });
});
