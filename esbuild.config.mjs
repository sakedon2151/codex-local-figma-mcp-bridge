import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = import.meta.dirname;
const outdir = resolve(root, "dist/plugin");

await mkdir(outdir, { recursive: true });

await Promise.all([
  build({
    entryPoints: [resolve(root, "src/plugin/code.ts")],
    outfile: resolve(outdir, "code.js"),
    bundle: true,
    target: "es2020",
    format: "iife",
    sourcemap: true,
    logLevel: "info",
    external: []
  }),
  build({
    entryPoints: [resolve(root, "src/plugin/ui.ts")],
    outfile: resolve(outdir, "ui.js"),
    bundle: true,
    target: "es2020",
    format: "iife",
    sourcemap: true,
    logLevel: "info"
  })
]);

await mkdir(dirname(resolve(outdir, "manifest.json")), { recursive: true });
await Promise.all([
  copyFile(resolve(root, "src/plugin/manifest.json"), resolve(outdir, "manifest.json")),
  copyFile(resolve(root, "src/plugin/ui.html"), resolve(outdir, "ui.html"))
]);
