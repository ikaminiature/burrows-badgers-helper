import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, appendFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
test("公開ビルドは同じ入力なら同じ版、静的ファイル変更時には新しい版になる", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bb-build-"));
  try {
    for (const name of [
      "src",
      "index.html",
      "style.css",
      "manifest.webmanifest",
      "sw.js",
      "icon.svg",
      "icon-192.png",
      "icon-512.png",
      "apple-touch-icon.png",
    ])
      await cp(name, join(dir, name), { recursive: true });
    const build = async () => {
      const r = spawnSync(process.execPath, [resolve("scripts/build.js")], {
        cwd: dir,
        encoding: "utf8",
      });
      assert.equal(r.status, 0, r.stderr);
      const sw = await readFile(join(dir, "dist/sw.js"), "utf8");
      assert.match(sw, /const VERSION = "build-[a-f0-9]+";/);
      return sw;
    };
    const original = await build();
    assert.equal(await build(), original);
    await appendFile(join(dir, "style.css"), "\n/* new visual version */");
    assert.notEqual(await build(), original);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
