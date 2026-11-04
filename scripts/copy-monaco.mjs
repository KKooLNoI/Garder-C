// Copies Monaco's prebuilt assets into public/ so the editor is served from our own origin
// (no CDN dependency, strict CSP, works offline). Runs before dev and build.
import { cpSync, existsSync, rmSync } from "node:fs";

const src = "node_modules/monaco-editor/min/vs";
const dest = "public/monaco/vs";
if (!existsSync(src)) {
  console.error(`monaco-editor not installed: ${src} is missing. Run npm install.`);
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`copied Monaco assets to ${dest}`);
