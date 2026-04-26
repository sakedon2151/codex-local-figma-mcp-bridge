import { build } from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = import.meta.dirname;
const outdir = resolve(root, "dist/plugin");
const uiBundlePath = resolve(outdir, "ui.js");

await mkdir(outdir, { recursive: true });

await Promise.all([
  build({
    entryPoints: [resolve(root, "src/plugin/code.ts")],
    outfile: resolve(outdir, "code.js"),
    bundle: true,
    target: "es2017",
    format: "iife",
    sourcemap: true,
    logLevel: "info",
    external: []
  }),
  build({
    entryPoints: [resolve(root, "src/plugin/ui.ts")],
    outfile: uiBundlePath,
    bundle: true,
    target: "es2017",
    format: "iife",
    sourcemap: true,
    logLevel: "info"
  })
]);

const [uiHtmlTemplate, uiScript] = await Promise.all([
  readFile(resolve(root, "src/plugin/ui.html"), "utf8"),
  readFile(uiBundlePath, "utf8")
]);
const inlineUiScript = uiScript
  .replace(/\n\/\/# sourceMappingURL=ui\.js\.map\s*$/u, "")
  .replace(/<\/script/giu, "<\\/script");
const uiHtml = uiHtmlTemplate.replace(
  '<script src="./ui.js"></script>',
  `<script>\n${inlineUiScript}\n</script>`
);

if (uiHtml === uiHtmlTemplate) {
  throw new Error("Failed to inline UI script into plugin ui.html.");
}

await Promise.all([
  copyFile(resolve(root, "src/plugin/manifest.json"), resolve(outdir, "manifest.json")),
  writeFile(resolve(outdir, "ui.html"), uiHtml)
]);
