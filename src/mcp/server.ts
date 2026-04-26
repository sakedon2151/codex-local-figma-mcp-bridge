import { pathToFileURL } from "node:url";

export interface McpServerMetadata {
  name: "LocalFigmaMcpBridge";
  version: "0.1.0";
}

export function getMcpServerMetadata(): McpServerMetadata {
  return {
    name: "LocalFigmaMcpBridge",
    version: "0.1.0"
  };
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint ? import.meta.url === pathToFileURL(entrypoint).href : false;
}

if (isMainModule()) {
  const metadata = getMcpServerMetadata();
  process.stderr.write(
    `[INFO] ${metadata.name} ${metadata.version} scaffold ready. MCP tools will be implemented in the next phase.\n`
  );
}
