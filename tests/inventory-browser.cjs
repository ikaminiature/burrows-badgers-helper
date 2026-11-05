const { enableRosterEditing } = require("./support/roster.cjs");
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173");
    await page.getByRole("heading", { name: "冒険の準備" }).waitFor();
    const { emptyBandStatus, stats, startGame } = await import(
      "../src/model.js"
    );
    const c = {
      id: "c",
      name: "旧戦士",
      species: "独自の種族",
      level: 6,
      fate: 3,
      experience: 4,
      photo:
        "data:image/png;base64," +
        fs.readFileSync("icon-192.png").toString("base64"),
      stats: Object.fromEntries(stats.map((s) => [s, "D10"])),
      equipment: "剣、鎧\n未分類の品",
      skills: "Strong (1)\nScout",
      spells: "Fire\nHeal",
      notes: "メモ",
    };
    const w = {
        id: "w",
        name: "旧バンド",
        status: emptyBandStatus(),
        characters: [c],
      },
      data = { version: 2, warbands: [w], game: startGame(w) };
    data.game.round = 4;
    data.game.characters[0].wounds = 8;
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
    async function edit() {
      await page
        .getByRole("link", { name: "ウォーバンド", exact: true })
        .click();
      await page.getByRole("button", { name: "開く", exact: true }).click();
      await enableRosterEditing(page);
      await page.getByRole("button", { name: "編集", exact: true }).click();
    }
    await edit();
    assert.equal(
      await page
        .getByRole("combobox", { name: "種族", exact: true })
        .locator("option:checked")
        .textContent(),
      c.species + "（現在の値を保持）",
    );
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "Level", exact: true })
        .inputValue(),
      "6",
    );
    for (const s of stats)
      assert.equal(
        await page.getByRole("combobox", { name: s, exact: true }).inputValue(),
        "D10",
      );
    assert.equal(
      await page
        .getByRole("textbox", { name: "スキル 1", exact: true })
        .inputValue(),
      "Strong (1)",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "呪文 2", exact: true })
        .inputValue(),
      "Heal",
    );
    await page.locator('#character-form').getByText("旧装備（未分類・原文）", { exact: true }).click();
    assert.equal(
      await page.getByRole("textbox", { name: "旧装備の原文" }).inputValue(),
      c.equipment,
    );
    const labels = ["武器1", "武器2", "鎧1", "鎧2", "アイテム", "スペシャル"];
    for (const [i, label] of labels.entries())
      await page
        .getByRole("textbox", { name: label, exact: true })
        .fill(i === 1 ? "" : "装備" + i);
    assert.equal(await page.locator('input[name^="slot-"]').count(), 6);
    await page
      .getByRole("textbox", { name: "スキル 1", exact: true })
      .fill("Strong (2)");
    await page
      .getByRole("button", { name: "スキル 2 を削除", exact: true })
      .click();
    await page.getByRole("button", { name: "＋ スキル", exact: true }).click();
    await page
      .getByRole("textbox", { name: "スキル 2", exact: true })
      .fill("追加スキル");
    await page
      .getByRole("textbox", { name: "呪文 1", exact: true })
      .fill("Flame");
    await page
      .getByRole("button", { name: "呪文 2 を削除", exact: true })
      .click();
    await page.getByRole("button", { name: "＋ 呪文", exact: true }).click();
    await page
      .getByRole("textbox", { name: "呪文 2", exact: true })
      .fill("追加呪文");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page
      .locator("#save-status")
      .filter({ hasText: "端末に保存済み" })
      .waitFor();
    await page.reload();
    await edit();
    assert.equal(
      await page
        .getByRole("textbox", { name: "武器1", exact: true })
        .inputValue(),
      "装備0",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "武器2", exact: true })
        .inputValue(),
      "",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "スキル 1", exact: true })
        .inputValue(),
      "Strong (2)",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "呪文 2", exact: true })
        .inputValue(),
      "追加呪文",
    );
    await page.getByRole("button", { name: "キャンセル", exact: true }).click();
    await page.getByRole("button", { name: c.name, exact: true }).click();
    for (const label of labels)
      await page
        .locator("#modal dt")
        .getByText(label, { exact: true })
        .waitFor();
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.getByRole("link", { name: "ホーム", exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "JSON を書き出す" }).click(),
    ]);
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "bb-items-")),
      "backup.json",
    );
    await download.saveAs(file);
    const exported = JSON.parse(fs.readFileSync(file));
    assert.deepEqual(exported.game, data.game);
    const saved = exported.warbands[0].characters[0];
    assert.equal(saved.equipment, c.equipment);
    assert.equal(saved.skills, c.skills);
    assert.equal(saved.spells, c.spells);
    assert.equal(saved.photo, c.photo);
    assert.deepEqual(saved.skillEntries, ["Strong (2)", "追加スキル"]);
    assert.deepEqual(saved.spellEntries, ["Flame", "追加呪文"]);
    await page.locator("#restore-file").setInputFiles(file);
    await page.getByRole("button", { name: "確認して実行" }).click();
    await page.locator("#modal").waitFor({ state: "hidden" });
    await page.reload();
    await edit();
    assert.equal(
      await page
        .getByRole("textbox", { name: "スキル 2", exact: true })
        .inputValue(),
      "追加スキル",
    );
    await page.getByRole("button", { name: "キャンセル", exact: true }).click();
    await page.getByRole("link", { name: "戦闘", exact: true }).click();
    assert.equal(await page.locator(".wound-count").textContent(), "8");
    await page
      .getByRole("button", { name: "キャラクター詳細", exact: true })
      .click();
    await page
      .locator("#modal li")
      .getByText("Strong (1)", { exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: lossless legacy conversion, six fixed slots, independent skill/spell CRUD and order, JSON restore, photo/stats/points retention, unchanged battle snapshot",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
