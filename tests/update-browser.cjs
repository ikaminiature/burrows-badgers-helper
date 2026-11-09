const { enableRosterEditing } = require("./support/roster.cjs");
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
(async () => {
  let version = "1",
    failSW = false,
    swRequests = 0;
  const root = path.resolve("dist");
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let relative = url.pathname.replace(/^\/app\//, "");
    if (!relative) relative = "index.html";
    if (!url.pathname.startsWith("/app/") || relative.includes("..")) {
      res.writeHead(404).end();
      return;
    }
    if (relative === "sw.js") {
      swRequests++;
      if (failSW) {
        res.writeHead(503).end("offline");
        return;
      }
    }
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    let body = fs.readFileSync(file);
    if (relative === "sw.js")
      body = body
        .toString()
        .replace(
          /const VERSION = "[^"]+";/,
          `const VERSION = "test-${version}";`,
        );
    if (relative === "src/app.js")
      body =
        body.toString() + `\nwindow.__testVersion=${JSON.stringify(version)};`;
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.setHeader(
      "Content-Type",
      relative.endsWith(".js")
        ? "text/javascript"
        : relative.endsWith(".css")
          ? "text/css"
          : relative.endsWith(".png")
            ? "image/png"
            : relative.endsWith(".svg")
              ? "image/svg+xml"
              : "text/html",
    );
    res.end(body);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const url = `http://127.0.0.1:${server.address().port}/app/`;
    await page.goto(url);
    await page.getByRole("heading", { name: "冒険の準備" }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page
      .getByRole("button", { name: "最新版を確認", exact: true })
      .click();
    await page
      .locator("#update-status")
      .filter({ hasText: "現在、最新版です" })
      .waitFor();
    const { emptyBandStatus, stats, startGame, characterInventory } =
      await import("../src/model.js");
    const c = {
      id: "c",
      name: "保存を待つ戦士",
      species: "ネズミ",
      level: 6,
      fate: 3,
      experience: 2,
      photo:
        "data:image/png;base64," +
        fs.readFileSync("icon-192.png").toString("base64"),
      stats: Object.fromEntries(stats.map((s) => [s, "D6"])),
      equipment: "剣",
      skills: "斥候",
      spells: "",
      notes: "保持",
    };
    const w = {
        id: "w",
        name: "保持するバンド",
        status: { ...emptyBandStatus(), treasury: 9999 },
        characters: [c],
      },
      g = startGame(w);
    g.round = 7;
    g.characters[0].wounds = 6;
    g.characters[0].acted = true;
    const data = { version: 2, warbands: [w], game: g };
    data.warbands.forEach(w=>{w.status.rating=w.characters.reduce((sum,c)=>sum+c.level,0);});
    await page.evaluate(
      (d) =>
        new Promise((resolve, reject) => {
          const r = indexedDB.open("bb-helper", 1);
          r.onsuccess = () => {
            const db = r.result,
              tx = db.transaction("data", "readwrite");
            tx.objectStore("data").put(d, "app");
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
      data,
    );
    await page.reload();
    const other = await context.newPage();
    other.on("pageerror", (e) => errors.push(e.message));
    await other.goto(url);
    await other.getByRole("heading", { name: "冒険の準備" }).waitFor();
    async function lock() {
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const r = indexedDB.open("bb-helper", 1);
            r.onsuccess = () => {
              const db = r.result,
                tx = db.transaction("data", "readwrite");
              let held = true;
              window.releaseLock = () => (held = false);
              tx.oncomplete = () => db.close();
              const loop = () =>
                (tx.objectStore("data").get("app").onsuccess = () => {
                  resolve();
                  if (held) loop();
                });
              loop();
            };
          }),
      );
    }
    async function editFate(n) {
      await page
        .getByRole("link", { name: "ウォーバンド", exact: true })
        .click();
      await page.getByRole("button", { name: "開く", exact: true }).click();
      await enableRosterEditing(page);
      await page.getByRole("button", { name: "編集", exact: true }).click();
      await page
        .getByRole("checkbox", { name: "運命点 " + n, exact: true })
        .check();
      await page.getByRole("button", { name: "保存", exact: true }).click();
      await page.getByRole("link", { name: "ホーム", exact: true }).click();
    }
    await lock();
    await editFate(4);
    version = "2";
    await page
      .getByRole("button", { name: "最新版を確認", exact: true })
      .click();
    await page.getByRole("button", { name: "更新する", exact: true }).waitFor();
    await page.getByRole("button", { name: "更新する", exact: true }).click();
    await page.getByRole("heading", { name: "更新しています…" }).waitFor();
    assert.equal(await page.evaluate(() => window.__testVersion), "1");
    assert.equal(
      await page.evaluate(
        async () => !!(await navigator.serviceWorker.getRegistration()).waiting,
      ),
      true,
    );
    const load = page.waitForEvent("load"),
      otherLoad = other.waitForEvent("load");
    await page.evaluate(() => window.releaseLock());
    await Promise.all([load, otherLoad]);
    await page.getByRole("heading", { name: "冒険の準備" }).waitFor();
    assert.equal(await page.evaluate(() => window.__testVersion), "2");
    assert.equal(await other.evaluate(() => window.__testVersion), "2");
    assert.ok(swRequests >= 2);
    const stored = () =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            const r = indexedDB.open("bb-helper", 1);
            r.onsuccess = () => {
              const db = r.result,
                q = db.transaction("data").objectStore("data").get("app");
              q.onsuccess = () => {
                db.close();
                resolve(q.result);
              };
            };
          }),
      );
    const expected = structuredClone(data);
    expected.warbands[0].characters[0].fate = 4;
    Object.assign(expected.warbands[0].characters[0], characterInventory(c));
    assert.deepEqual(await stored(), expected);
    await page
      .getByRole("button", { name: "最新版を確認", exact: true })
      .click();
    await page
      .locator("#update-status")
      .filter({ hasText: "現在、最新版です" })
      .waitFor();
    // A second tab may activate an update while this tab is restoring a backup.
    await lock();
    const incoming = structuredClone(data);
    incoming.warbands[0].characters[0].experience = 5;
    await page.locator("#restore-file").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(incoming)),
    });
    await page.getByRole("button", { name: "確認して実行" }).click();
    await page.getByRole("heading", { name: "復元中…" }).waitFor();
    version = "3";
    await other
      .getByRole("button", { name: "最新版を確認", exact: true })
      .click();
    const otherNavigation = other.waitForEvent(
      "framenavigated",
      (f) => f === other.mainFrame(),
    );
    await other.getByRole("button", { name: "更新する", exact: true }).click();
    await otherNavigation;
    await page.getByRole("heading", { name: "更新しています…" }).waitFor();
    assert.equal(await page.evaluate(() => window.__testVersion), "2");
    const restoredLoad = page.waitForEvent("load");
    await page.evaluate(() => window.releaseLock());
    await restoredLoad;
    await other.waitForFunction(() => window.__testVersion === "3");
    await page.getByRole("heading", { name: "冒険の準備" }).waitFor();
    assert.equal(await page.evaluate(() => window.__testVersion), "3");
    assert.deepEqual(await stored(), incoming);
    await context.setOffline(true);
    await page
      .getByRole("button", { name: "最新版を確認", exact: true })
      .click();
    await page
      .locator("#update-status")
      .filter({ hasText: "オフライン" })
      .waitFor();
    await page.reload();
    await page.getByRole("heading", { name: "冒険の準備" }).waitFor();
    assert.deepEqual(await stored(), incoming);
    await context.setOffline(false);
    failSW = true;
    await page
      .getByRole("button", { name: "最新版を確認", exact: true })
      .click();
    await page
      .locator("#update-status")
      .filter({ hasText: "更新を確認できませんでした" })
      .waitFor();
    failSW = false;
    // A failed save must prevent activation/reload rather than discard memory state.
    await page.evaluate(() => {
      const original = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (stores, mode, ...args) {
        if (mode === "readwrite") throw Error("simulated quota failure");
        return original.call(this, stores, mode, ...args);
      };
    });
    await editFate(5);
    await page
      .locator("#save-status")
      .filter({ hasText: "保存失敗" })
      .waitFor();
    version = "4";
    await page
      .getByRole("button", { name: "最新版を確認", exact: true })
      .click();
    await page.getByRole("button", { name: "更新する", exact: true }).click();
    await page
      .locator("#update-status")
      .filter({ hasText: "更新を中止しました" })
      .waitFor();
    assert.equal(await page.evaluate(() => window.__testVersion), "3");
    assert.deepEqual(await stored(), incoming);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: real SW latest/update, stale HTTP cache bypass, waiting/activation, save and restore completion across tabs, IndexedDB/photo/battle preservation, offline reload, network failure, failed-save update refusal",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
