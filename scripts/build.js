import { createHash } from "node:crypto";
import {
  mkdir,
  copyFile,
  cp,
  rm,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
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
  "share-qr.png",
])
  await copyFile(f, `dist/${f}`);
await cp("src", "dist/src", { recursive: true });
await cp("data", "dist/data", { recursive: true });

// Stable content versions make any published asset change detectable by update().
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = dir + "/" + entry.name;
    if (entry.isDirectory()) paths.push(...(await files(path)));
    else paths.push(path);
  }
  return paths.sort();
}
const hash = createHash("sha256");
for (const path of await files("dist")) {
  hash.update(path);
  hash.update(await readFile(path));
}
const worker = await readFile("dist/sw.js", "utf8");
await writeFile(
  "dist/sw.js",
  worker.replace(
    /const VERSION = "[^"]+";/,
    `const VERSION = "build-${hash.digest("hex").slice(0, 24)}";`,
  ),
);
