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
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const url = process.env.TEST_URL || "http://127.0.0.1:5173";
    await page.goto(url);
    await page.getByRole("heading", { name: "冒険の準備" }).waitFor();
    const { emptyBandStatus, stats, startGame } = await import(
      "../src/model.js"
    );
    const c = {
        id: "c",
        name: "旧戦士",
        species: "旧種族",
        level: 6,
        fate: 2,
        experience: 3,
        photo:
          "data:image/png;base64," +
          fs.readFileSync("icon-192.png").toString("base64"),
        stats: Object.fromEntries(stats.map((s) => [s, "D8"])),
        equipment: "原文の装備",
        skills: "旧技能",
        spells: "旧呪文",
        notes: "メモ",
        equipmentSlots: {
          weapon1: "自由な剣",
          weapon2: "",
          armour1: "",
          armour2: "",
          item: "",
          special: "",
        },
        skillEntries: ["技能を維持"],
        spellEntries: ["呪文を維持"],
      },
      w = {
        id: "w",
        name: "装備検証",
        status: emptyBandStatus(),
        characters: [c],
      },
      data = { version: 2, warbands: [w], game: startGame(w) };
    data.game.round = 3;
    data.game.characters[0].wounds = 5;
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
    const result = (id) =>
      page.locator(`.equipment-option[data-equipment-id="${id}"]`);
    async function picker(label) {
      await page
        .getByRole("button", { name: label + "の装備を検索", exact: true })
        .click();
      await page
        .locator("#equipment-result-status")
        .filter({ hasText: `${({"武器1":17,"武器2":17,"鎧1":6,"鎧2":6,"アイテム":73,"スペシャル":96})[label]} / 96 件` })
        .waitFor();
    }
    async function query(text) {
      await page
        .getByRole("searchbox", { name: "装備検索", exact: true })
        .fill(text);
    }
    await edit();
    assert.equal(
      await page
        .getByRole("textbox", { name: "武器1", exact: true })
        .inputValue(),
      "自由な剣",
    );
    await picker("武器1");
    assert.equal(await page.locator(".equipment-option").count(), 17);
    await result("general-store-006")
      .getByText("弓（18″）", { exact: true })
      .waitFor();
    await result("general-store-001")
      .getByText("片手武器", { exact: true })
      .waitFor();
    assert.equal(
      await result("general-store-001")
        .getByText("片手武器（）", { exact: true })
        .count(),
      0,
    );
    await query("ﾗｲﾄｸﾛｽﾎﾞｳ");
    assert.equal(await page.locator(".equipment-option").count(), 1);
    await result("general-store-007")
      .getByText("ライトクロスボウ（24″）", { exact: true })
      .waitFor();
    await query("ＬＩＧＨＴ　ＣＲＯＳＳＢＯＷ");
    assert.equal(await page.locator(".equipment-option").count(), 1);
    await query("PiStOl");
    const pistol = result("general-store-010");
    assert.equal(await pistol.getByRole("button", { name: "備考", exact: true }).count(), 0);
    await pistol.locator(".equipment-details > summary").click();
    await pistol.getByText(/ピストルによる射撃はストロング/).waitFor();
    assert.equal(await pistol.locator(".equipment-shared-rule > summary").filter({hasText: "装備枠"}).count(), 0);
    await pistol.getByRole("button", { name: "選ぶ", exact: true }).click();
    assert.equal(
      await page
        .getByRole("textbox", { name: "武器1", exact: true })
        .inputValue(),
      "ピストル",
    );
    await page
      .locator("#selection-weapon1")
      .filter({ hasText: "ピストル（12″）" })
      .waitFor();
    await picker("武器2");
    assert.equal(
      await page
        .locator(".equipment-option")
        .first()
        .getAttribute("data-equipment-id"),
      "general-store-010",
    );
    await query("Bow");
    await result("general-store-006")
      .getByRole("button", { name: "選ぶ", exact: true })
      .click();
    await picker("鎧1");
    assert.equal(await page.getByRole("combobox", { name: "カテゴリ", exact: true }).isVisible(), false);
    assert.equal(await page.locator(".equipment-option").count(), 6);
    await result("general-store-020")
      .getByRole("button", { name: "選ぶ", exact: true })
      .click();
    await picker("アイテム");
    assert.equal(await page.getByRole("combobox", { name: "カテゴリ", exact: true }).isVisible(), false);
    await query("Lead slingshot");
    await result("general-store-034").getByText("リードスリングショット", { exact: true }).waitFor();
    assert.equal(await result("general-store-034").getByText("表記要確認", { exact: true }).count(), 0);
    await result("general-store-034")
      .getByRole("button", { name: "選ぶ", exact: true })
      .click();
    await picker("スペシャル");
    await page
      .getByRole("combobox", { name: "カテゴリ", exact: true })
      .selectOption("ingredient");
    await query("Antler dust");
    await result("general-store-060").getByText("角の粉", { exact: true }).waitFor();
    await query("角の粉");
    assert.equal(await result("general-store-082").count(), 0);
    await query("Powdered acorns");
    const flagged = result("general-store-082");
    await flagged.getByText("粉末ドングリ", { exact: true }).waitFor();
    assert.equal(await flagged.getByText("表記要確認", { exact: true }).count(), 0);
    assert.equal(await flagged.getByRole("button", { name: "備考", exact: true }).count(), 0);
    await flagged.getByRole("button", { name: "選ぶ", exact: true }).click();
    await page
      .getByRole("textbox", { name: "鎧2", exact: true })
      .fill("独自の自由入力鎧");
    assert.equal(await page.locator('input[name^="slot-"]').count(), 6);
    assert.equal(
      await page
        .getByRole("textbox", { name: "スキル 1", exact: true })
        .inputValue(),
      "技能を維持",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "呪文 1", exact: true })
        .inputValue(),
      "呪文を維持",
    );
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page
      .locator("#save-status")
      .filter({ hasText: "端末に保存済み" })
      .waitFor();
    const card = page.locator(".roster-card");
    await card
      .getByRole("button", { name: "装備・スキル・呪文を表示", exact: true })
      .click();
    const panel = card.locator(".character-extra");
    await panel.getByText("ピストル（12″）", { exact: true }).waitFor();
    await panel.getByText("弓（18″）", { exact: true }).waitFor();
    await panel.getByText("独自の自由入力鎧", { exact: true }).waitFor();
    const pistolDetails = panel
      .locator("dd")
      .filter({ hasText: "ピストル（12″）" });
    assert.equal(await pistolDetails.getByRole("button", { name: "備考", exact: true }).count(), 0);
    await pistolDetails.locator(".equipment-details > summary").click();
    await pistolDetails.getByText(/ピストルによる射撃はストロング/).waitFor();
    await card.getByRole("button", { name: c.name, exact: true }).click();
    await page
      .locator("#modal")
      .getByText("ピストル（12″）", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.getByRole("link", { name: "ホーム", exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "JSON を書き出す" }).click(),
    ]);
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "bb-store-")),
      "backup.json",
    );
    await download.saveAs(file);
    const exported = JSON.parse(fs.readFileSync(file)),
      saved = exported.warbands[0].characters[0];
    assert.equal(saved.equipmentSelections.weapon1.id, "general-store-010");
    assert.equal(saved.equipmentSelections.weapon1.range, "12″");
    assert.equal(saved.equipmentSelections.special.nameJa, "粉末ドングリ");
    assert.equal(saved.equipmentSelections.special.nameEn, "Powdered acorns");
    assert.deepEqual(saved.skillEntries, c.skillEntries);
    assert.deepEqual(saved.spellEntries, c.spellEntries);
    assert.equal(saved.photo, c.photo);
    assert.deepEqual(exported.game, data.game);
    assert.equal(exported.recentEquipmentIds[0], "general-store-082");
    await page.reload();
    await edit();
    await picker("武器1");
    assert.equal(await page.locator(".equipment-option").first().getAttribute("data-equipment-id"), "general-store-006");
    assert.equal(await result("general-store-082").count(), 0);
    await query("Mandrake");
    assert.equal(await page.locator(".equipment-option").count(), 0);
    await page.getByRole("button", { name: "装備検索を閉じる", exact: true }).click();
    await picker("アイテム");
    await query("Mandrake");
    await result("general-store-080").getByRole("button", { name: "選ぶ", exact: true }).click();
    assert.equal(await page.getByRole("textbox", { name: "アイテム", exact: true }).inputValue(), "マンドレイク");
    assert.equal(await page.getByRole("textbox", { name: "武器1", exact: true }).inputValue(), "ピストル");
    await page
      .getByRole("textbox", { name: "武器1", exact: true })
      .fill("新しい自由入力の杖");
    await page
      .getByRole("button", { name: "武器2を未装備にする", exact: true })
      .click();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page
      .locator("#save-status")
      .filter({ hasText: "端末に保存済み" })
      .waitFor();
    await page.getByRole("link", { name: "ホーム", exact: true }).click();
    const changed = await page.evaluate(
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
    assert.equal(
      changed.warbands[0].characters[0].equipmentSlots.weapon1,
      "新しい自由入力の杖",
    );
    assert.equal(changed.warbands[0].characters[0].equipmentSlots.weapon2, "");
    assert.equal(
      changed.warbands[0].characters[0].equipmentSelections.weapon1,
      undefined,
    );
    assert.equal(
      changed.warbands[0].characters[0].equipmentSelections.weapon2,
      undefined,
    );
    assert.deepEqual(changed.game, data.game);
    await page.locator("#restore-file").setInputFiles(file);
    await page.getByRole("button", { name: "確認して実行" }).click();
    await page.locator("#modal").waitFor({ state: "hidden" });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await edit();
    assert.equal(
      await page
        .getByRole("textbox", { name: "武器1", exact: true })
        .inputValue(),
      "ピストル",
    );
    await picker("武器1");
    await query("Pistol");
    await pistol.getByText("ピストル（12″）", { exact: true }).waitFor();
    assert.equal(
      await page
        .locator("#modal")
        .evaluate((e) => e.scrollWidth <= e.clientWidth),
      true,
    );
    await page.screenshot({
      path: path.join(os.tmpdir(), "bb-equipment-search.png"),
    });
    assert.deepEqual(errors, []);
    await context.setOffline(false);
    const fallback = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    const free = await fallback.newPage();
    await free.route("**/data/bb2_general_store_ja_en.json", (route) =>
      route.abort(),
    );
    await free.goto(url);
    await free.getByRole("heading", { name: "冒険の準備" }).waitFor();
    await free.getByRole("link", { name: "ウォーバンド", exact: true }).click();
    await free.getByRole("button", { name: "＋ ウォーバンドを登録" }).click();
    await free
      .getByRole("textbox", { name: "名前", exact: true })
      .fill("自由入力");
    await free.getByRole("button", { name: "保存", exact: true }).click();
    await free.getByRole("button", { name: "＋ キャラクター登録" }).click();
    await free
      .getByRole("button", { name: "武器1の装備を検索", exact: true })
      .click();
    await free
      .locator("#equipment-result-status")
      .filter({ hasText: "自由入力してください" })
      .waitFor();
    await free
      .getByRole("textbox", { name: "武器1", exact: true })
      .fill("通信なしの自由装備");
    assert.equal(
      await free
        .getByRole("textbox", { name: "武器1", exact: true })
        .inputValue(),
      "通信なしの自由装備",
    );
    await fallback.close();
    console.log(
      "PASS: actual 96-item search, JA/EN NFKC, category/recent ordering, stable IDs, range and hidden notes, confirmed errata names and no obsolete review flags, free/custom/unequip, JSON/offline/game preservation, catalog failure fallback",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
