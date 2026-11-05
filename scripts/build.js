import { mkdir, copyFile, cp, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
for (const f of [
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "sw.js",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
])
  await copyFile(f, `dist/${f}`);
await cp("src", "dist/src", { recursive: true });
