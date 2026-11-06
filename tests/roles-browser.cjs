const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { enableRosterEditing } = require("./support/roster.cjs");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const { emptyBandStatus, stats, startGame } = await import(
      "../src/model.js"
    );
    const photo =
        "data:image/png;base64," +
        fs.readFileSync("icon-192.png").toString("base64"),
      c = {
        id: "a",
        name: "最初のリーダー",
        role: "leader",
        species: "旧種族",
        level: 6,
        fate: 2,
        experience: 3,
        photo,
        stats: Object.fromEntries(stats.map((s) => [s, "D8"])),
        equipment: "旧装備",
        skills: "旧技能",
        spells: "旧呪文",
        notes: "",
      },
      b = { ...c, id: "b", name: "写真なしのサブ", role: "second", photo: "" },
      third = { ...c, id: "c", name: "三人目" };
    delete third.role;
    const w = {
        id: "w",
        name: "とても長い名前のウォーバンドの一覧表示",
        status: { ...emptyBandStatus(), alliance: "王党派", archetype: "戦士" },
        characters: [c, b, third],
      },
      data = { version: 2, warbands: [w], game: startGame(w) };
    data.game.round = 5;
    data.game.characters[0].wounds = 7;
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173");
    await page.getByRole("heading", { name: "冒険の準備" }).waitFor();
    await page.evaluate(
      (d) =>
        new Promise((resolve) => {
          const r = indexedDB.open("bb-helper", 1);
          r.onsuccess = () => {
            const db = r.result,
              tx = db.transaction("data", "readwrite");
            tx.objectStore("data").put(d, "app");
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
          };
        }),
      data,
    );
    await page.reload();
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
    await page.getByRole("link", { name: "ウォーバンド", exact: true }).click();
    const listing = page.locator(".warband-card");
    await listing.getByText("王党派", { exact: true }).waitFor();
    await listing.getByText("リーダー：" + c.name, { exact: true }).waitFor();
    assert.equal(await listing.locator("img").getAttribute("src"), photo);
    await listing.click();
    const card = (id) =>
      page
        .locator(".roster-card")
        .filter({ has: page.getByRole("button", { name: id, exact: true }) });
    assert.equal(await card(third.name).locator(".character-role").count(), 0);
    await card(c.name)
      .locator(".character-role")
      .getByText("リーダー", { exact: true })
      .waitFor();
    await enableRosterEditing(page);
    await card(third.name)
      .getByRole("button", { name: "編集", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "役職", exact: true })
      .selectOption("leader");
    page.once("dialog", (d) => {
      assert.match(d.message(), /最初のリーダー/);
      d.dismiss();
    });
    await page.getByRole("button", { name: "保存", exact: true }).click();
    assert.equal(await page.locator("#modal").isVisible(), true);
    assert.deepEqual(await stored(), data);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page
      .locator("#save-status")
      .filter({ hasText: "端末に保存済み" })
      .waitFor();
    let saved = await stored();
    assert.equal(saved.warbands[0].characters[0].role, "none");
    assert.equal(saved.warbands[0].characters[2].role, "leader");
    assert.deepEqual(saved.game, data.game);
    const order = await card(third.name)
      .locator(".roster-photo")
      .evaluate((e) => [...e.children].map((n) => n.className));
    assert.deepEqual(order, ["portrait", "character-role", "level"]);
    await page
      .getByRole("button", { name: "ウォーバンド一覧へ", exact: true })
      .click();
    await listing
      .getByText("リーダー：" + third.name, { exact: true })
      .waitFor();
    assert.equal(await listing.locator("img").getAttribute("src"), photo);
    await listing.click();
    await enableRosterEditing(page);
    await card(third.name)
      .getByRole("button", { name: "編集", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "役職", exact: true })
      .selectOption("second");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page
      .getByRole("button", { name: "ウォーバンド一覧へ", exact: true })
      .click();
    await listing.getByText("リーダー未設定", { exact: true }).waitFor();
    assert.equal(await listing.locator("img").count(), 0);
    await listing.click();
    await enableRosterEditing(page);
    await card(b.name)
      .getByRole("button", { name: "編集", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "役職", exact: true })
      .selectOption("leader");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await card(b.name)
      .getByRole("button", { name: "複製", exact: true })
      .click();
    assert.equal(
      await card(b.name + " の複製")
        .locator(".character-role")
        .count(),
      0,
    );
    await page
      .locator("#save-status")
      .filter({ hasText: "端末に保存済み" })
      .waitFor();
    saved = await stored();
    assert.equal(
      saved.warbands[0].characters.filter((c) => c.role === "leader").length,
      1,
    );
    assert.equal(
      saved.warbands[0].characters.filter((c) => c.role === "second").length,
      1,
    );
    assert.deepEqual(saved.game, data.game);
    await page.reload();
    await page.getByRole("link", { name: "ウォーバンド", exact: true }).click();
    await listing.getByText("リーダー：" + b.name, { exact: true }).waitFor();
    assert.equal(await listing.locator("img").count(), 0);
    assert.equal(await listing.locator(".portrait").count(), 1);
    await listing.getByText("4 キャラクター", { exact: true }).waitFor();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
    }
    await page.screenshot({
      path: path.join(os.tmpdir(), "bb-warband-leader-list.png"),
    });
    await page.getByRole("link", { name: "ホーム", exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "JSON を書き出す" }).click(),
    ]);
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "bb-role-")),
      "backup.json",
    );
    await download.saveAs(file);
    assert.deepEqual(JSON.parse(fs.readFileSync(file)), saved);
    await page.locator("#restore-file").setInputFiles(file);
    await page.getByRole("button", { name: "確認して実行" }).click();
    await page.locator("#modal").waitFor({ state: "hidden" });
    await page.reload();
    await page.getByRole("link", { name: "ウォーバンド", exact: true }).click();
    await listing.getByText("リーダー：" + b.name, { exact: true }).waitFor();
    assert.deepEqual(await stored(), saved);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: role transfer confirm/cancel, uniqueness, duplicate clearing, leader photo/icon/name and whole-card tap, old data/JSON/game retention, mobile list",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
