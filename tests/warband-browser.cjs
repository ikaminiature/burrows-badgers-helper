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
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const url = process.env.TEST_URL || "http://127.0.0.1:5173";
    await page.goto(url);
    await page.getByRole("heading", { name: "冒険の準備" }).waitFor();
    const photo =
      "data:image/png;base64," +
      fs.readFileSync("icon-192.png").toString("base64");
    const c = {
      id: "c",
      name: "旧キャラクター",
      species: "ネズミ",
      level: 2,
      photo,
      stats: Object.fromEntries(
        [
          "Movement",
          "Strike",
          "Block",
          "Ranged",
          "Nimbleness",
          "Concealment",
          "Awareness",
          "Fortitude",
          "Presence",
        ].map((s) => [s, "D6"]),
      ),
      equipment: "剣",
      skills: "斥候",
      spells: "",
      notes: "キャラメモ",
    };
    const legacy = {
      version: 1,
      warbands: [
        {
          id: "old",
          name: "旧ウォーバンド",
          characters: [c],
          status: {
            rating: 0,
            pension: 0,
            labour: 0,
            materials: 0,
            treasury: 0,
            alliance: "自由な仲間",
            archetype: "探検隊",
            notes: "",
            stash: [],
            upgrades: [],
          },
        },
        { id: "other", name: "別バンド", characters: [] },
      ],
      game: {
        id: "g",
        name: "旧ウォーバンド",
        round: 5,
        characters: [
          {
            ...c,
            wounds: 4,
            acted: true,
            effects: [{ id: "e", name: "状態", description: "保持" }],
          },
        ],
      },
    };
    // Seed the actual v1 IndexedDB document, then exercise normal application loading.
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
          r.onerror = () => reject(r.error);
        }),
      legacy,
    );
    await page.reload();
    await page.getByRole("link", { name: /ラウンド 5 を再開/ }).waitFor();
    const saved = () =>
      page
        .locator("#save-status")
        .filter({ hasText: "端末に保存済み" })
        .waitFor();
    async function openEditor(name) {
      await page
        .getByRole("link", { name: "ウォーバンド", exact: true })
        .click();
      if (
        await page
          .getByRole("button", { name: "ウォーバンド一覧へ", exact: true })
          .count()
      )
        await page
          .getByRole("button", { name: "ウォーバンド一覧へ", exact: true })
          .click();
      await page
        .locator("section.card")
        .filter({ has: page.getByRole("heading", { name, exact: true }) })
        .getByRole("button", { name: "開く", exact: true })
        .click();
      await page
        .getByRole("button", { name: "ステータス編集", exact: true })
        .click();
    }
    const close = () =>
      page.getByRole("button", { name: "閉じる", exact: true }).click();
    await openEditor("旧ウォーバンド");
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "レーティング", exact: true })
        .inputValue(),
      "0",
    );
    assert.equal(
      await page
        .getByRole("combobox", { name: "アライアンス", exact: true })
        .inputValue(),
      "自由な仲間",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "アーキタイプ", exact: true })
        .inputValue(),
      "探検隊",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "アーキタイプ", exact: true })
        .getAttribute("readonly"),
      "",
    );
    for (const [label, value] of [
      ["バンド名", "森の守り手"],
      ["メモ", "第一行\n第二行"],
    ])
      await page.getByRole("textbox", { name: label, exact: true }).fill(value);
    for (const [label, value] of [
      ["レーティング", "123.5"],
      ["年金", "4"],
      ["労働力", "5"],
      ["資材", "6"],
      ["トレジャリー", "-7"],
    ])
      await page
        .getByRole("spinbutton", { name: label, exact: true })
        .fill(value);
    await page
      .getByRole("button", { name: "＋ 隠しておいた装備", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "隠しておいた装備 1", exact: true })
      .fill("弓");
    await page
      .getByRole("button", { name: "＋ 隠しておいた装備", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "隠しておいた装備 2", exact: true })
      .fill("矢");
    await page
      .getByRole("button", { name: "＋ アジト・アップグレード", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "アジト・アップグレード 1", exact: true })
      .fill("工房");
    await page
      .getByRole("textbox", { name: "アジト・アップグレード 1", exact: true })
      .fill("鍛冶場");
    await page
      .getByRole("button", {
        name: "アジト・アップグレード 1 を削除",
        exact: true,
      })
      .click();
    assert.equal(
      await page
        .getByRole("textbox", { name: "アジト・アップグレード 1", exact: true })
        .count(),
      0,
    );
    await page
      .getByRole("button", { name: "＋ アジト・アップグレード", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "アジト・アップグレード 1", exact: true })
      .fill("工房");
    await page
      .getByRole("textbox", { name: "隠しておいた装備 1", exact: true })
      .fill("長弓");
    await page
      .getByRole("button", { name: "隠しておいた装備 1 を削除", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("textbox", { name: "隠しておいた装備 1", exact: true })
        .inputValue(),
      "矢",
    );
    await page
      .getByRole("button", { name: "＋ 隠しておいた装備", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "隠しておいた装備 2", exact: true })
      .fill("盾");
    await page.getByRole("spinbutton", { name: "年金", exact: true }).fill("");
    await page
      .locator("#status-error")
      .filter({ hasText: "保存できません" })
      .waitFor();
    await page.getByRole("spinbutton", { name: "年金", exact: true }).fill("4");
    assert.equal(
      await page
        .locator("#modal")
        .evaluate((e) => e.scrollWidth <= e.clientWidth),
      true,
    );
    await page.screenshot({
      path: path.join(os.tmpdir(), "bb-warband-status.png"),
    });
    await close();
    await saved();
    await page.reload();
    await openEditor("森の守り手");
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "レーティング", exact: true })
        .inputValue(),
      "123.5",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "メモ", exact: true })
        .inputValue(),
      "第一行\n第二行",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "隠しておいた装備 2", exact: true })
        .inputValue(),
      "盾",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "アジト・アップグレード 1", exact: true })
        .inputValue(),
      "工房",
    );
    await close();
    await openEditor("別バンド");
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "レーティング", exact: true })
        .inputValue(),
      "0",
    );
    await close();
    await page.getByRole("link", { name: "戦闘", exact: true }).click();
    await page.locator(".gauge").first().waitFor();
  assert.equal(await page.locator(".gauge").locator(".filled").count(), 4);
    assert.equal(
      await page
        .getByRole("checkbox", { name: "行動済み", exact: true })
        .isChecked(),
      true,
    );
    await page
      .getByRole("button", { name: "ウォーバンドステータス", exact: true })
      .click();
    await page
      .getByText(
        "このゲームは旧形式のため、開始時のステータス記録はありません。",
      )
      .waitFor();
    await close();
    await page.getByRole("link", { name: "ホーム", exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "JSON を書き出す" }).click(),
    ]);
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "bb-status-")),
      "backup.json",
    );
    await download.saveAs(file);
    const backup = JSON.parse(fs.readFileSync(file));
    assert.equal(backup.version, 2);
    assert.deepEqual(backup.game, legacy.game);
    assert.deepEqual(
      backup.warbands[0].characters,
      legacy.warbands[0].characters.map((c) => ({
        ...c,
        fate: 0,
        experience: 0,
      })),
    );
    assert.deepEqual(backup.warbands[0].status, {
      rating: 123.5,
      pension: 4,
      labour: 5,
      materials: 6,
      treasury: -7,
      alliance: "自由な仲間",
      archetype: "探検隊",
      notes: "第一行\n第二行",
      stash: backup.warbands[0].status.stash,
      upgrades: backup.warbands[0].status.upgrades,
    });
    assert.deepEqual(
      backup.warbands[0].status.stash.map((e) => e.name),
      ["矢", "盾"],
    );
    assert.deepEqual(
      backup.warbands[0].status.upgrades.map((e) => e.name),
      ["工房"],
    );
    await openEditor("森の守り手");
    await page
      .getByRole("spinbutton", { name: "レーティング", exact: true })
      .fill("999");
    await close();
    await saved();
    async function restore(input) {
      await page.getByRole("link", { name: "ホーム", exact: true }).click();
      await page.locator("#restore-file").setInputFiles(input);
      await page.getByRole("button", { name: "確認して実行" }).click();
      await page.locator("#modal").waitFor({ state: "hidden" });
      await saved();
    }
    await restore(file);
    await page.reload();
    await openEditor("森の守り手");
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "レーティング", exact: true })
        .inputValue(),
      "123.5",
    );
    await close();
    const expectedAlliances = [
      ["王党派", "戦士"],
      ["ならず者", "レンジャー"],
      ["フリービースト", "万能型"],
      ["キンドレッド", "レンジャー"],
      ["ウィッチハンター", "民間呪術師"],
      ["ワイルドリング", "万能型"],
      ["アーケイン・コンクラーベ", "民間呪術師"],
      ["アンデッド", "民間呪術師"],
      ["傭兵団", "戦士"],
      ["ヒルフォーク", "万能型"],
    ];
    for (const [name, archetype] of expectedAlliances) {
      await openEditor("森の守り手");
      await page
        .getByRole("combobox", { name: "アライアンス", exact: true })
        .selectOption(name);
      assert.equal(
        await page
          .getByRole("textbox", { name: "アーキタイプ", exact: true })
          .inputValue(),
        archetype,
      );
      await close();
      await saved();
      await page.reload();
      await openEditor("森の守り手");
      assert.equal(
        await page
          .getByRole("combobox", { name: "アライアンス", exact: true })
          .inputValue(),
        name,
      );
      assert.equal(
        await page
          .getByRole("textbox", { name: "アーキタイプ", exact: true })
          .inputValue(),
        archetype,
      );
      assert.equal(
        await page
          .getByRole("combobox", { name: "アライアンス", exact: true })
          .locator("option:not([disabled])")
          .count(),
        10,
      );
      await close();
      await page
        .locator(".band-overview")
        .getByText(name, { exact: true })
        .waitFor();
      await page
        .locator(".band-overview")
        .getByText(archetype, { exact: true })
        .waitFor();
    }
    // Known legacy alliances are aligned when editing; unrelated game data stays intact.
    const inconsistent=structuredClone(backup);inconsistent.warbands[0].status.alliance='王党派';inconsistent.warbands[0].status.archetype='旧型';
    await restore({name:'known-legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(inconsistent))});
    await openEditor('森の守り手');assert.equal(await page.getByRole('textbox',{name:'アーキタイプ',exact:true}).inputValue(),'戦士');await close();await saved();
    await page.getByRole('link',{name:'ホーム',exact:true}).click();
    const [knownDownload]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'JSON を書き出す'}).click()]);
    const knownFile=path.join(path.dirname(file),'known.json');await knownDownload.saveAs(knownFile);const knownBackup=JSON.parse(fs.readFileSync(knownFile));assert.equal(knownBackup.warbands[0].status.alliance,'王党派');assert.equal(knownBackup.warbands[0].status.archetype,'戦士');assert.deepEqual(knownBackup.game,legacy.game);
    // New games retain a status snapshot independently of subsequent roster edits.
    await page.getByRole("link", { name: "ホーム", exact: true }).click();
    await page.getByRole("link", { name: "ゲームを開始", exact: true }).click();
    await page
      .locator("section.card")
      .filter({
        has: page.getByRole("heading", { name: "森の守り手", exact: true }),
      })
      .getByRole("button", { name: "このウォーバンドで開始" })
      .click();
    await page.getByRole("button", { name: "確認して実行" }).click();
    await openEditor("森の守り手");
    await page
      .getByRole("spinbutton", { name: "レーティング", exact: true })
      .fill("777");
    await close();
    await page.getByRole("link", { name: "戦闘", exact: true }).click();
    await page
      .getByRole("button", { name: "ウォーバンドステータス", exact: true })
      .click();
    assert.equal(
      await page.locator("#modal > dl dd").first().textContent(),
      "123.5",
    );
    await close();
    await restore({
      name: "legacy.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(legacy)),
    });
    await page.reload();
    await openEditor("旧ウォーバンド");
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "レーティング", exact: true })
        .inputValue(),
      "0",
    );
    await close();
    await page.getByRole("link", { name: "戦闘", exact: true }).click();
    await page.locator(".gauge").first().waitFor();
  assert.equal(await page.locator(".gauge").locator(".filled").count(), 4);
    assert.equal(await page.locator("article img").count(), 1);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: legacy IndexedDB + JSON migration, status autosave, per-band isolation, list CRUD + order, full JSON roundtrip, battle/photo preservation, status snapshots",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
