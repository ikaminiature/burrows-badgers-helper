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
    const { speciesGroups, speciesPresets } = await import("../src/species.js");
    const { stats } = await import("../src/model.js");
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173");
    await page.getByRole("heading", { name: "冒険の準備" }).waitFor();
    await page.getByRole("link", { name: "ウォーバンド", exact: true }).click();
    await page.getByRole("button", { name: "＋ ウォーバンドを登録" }).click();
    await page
      .getByRole("textbox", { name: "名前", exact: true })
      .fill("種族検証");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.getByRole("button", { name: "＋ キャラクター登録" }).click();
    await page
      .getByRole("textbox", { name: "名前", exact: true })
      .fill("成長した戦士");
    let first = true;
    for (const g of speciesGroups) {
      await page
        .getByRole("combobox", { name: "サイズ分類", exact: true })
        .selectOption(g.id);
      const expected = speciesPresets.filter((p) => p.group === g.id);
      assert.equal(
        await page.locator("#species-preset option:not([disabled])").count(),
        expected.length,
      );
      assert.ok(
        (
          await page.locator("#species-size option:checked").textContent()
        ).includes(g.base + "mm"),
      );
      for (const p of expected) {
        await page
          .getByRole("combobox", { name: "種族", exact: true })
          .selectOption(p.id);
        if (!first)
          await page
            .getByRole("button", { name: "初期値に置き換える", exact: true })
            .click();
        first = false;
        const actual = await page.locator("#character-form").evaluate(
          (form, keys) => ({
            level: Number(form.elements.level.value),
            stats: Object.fromEntries(
              keys.map((k) => [k, form.elements[k].value]),
            ),
            skills: [
              ...form.querySelectorAll("#character-skillEntries textarea"),
            ].map((e) => e.value),
          }),
          stats,
        );
        assert.deepEqual(
          actual,
          { level: p.level, stats: p.stats, skills: p.skills },
          p.name,
        );
      }
      console.log("PASS: automatic species inputs for " + g.name);
    }
    await page
      .getByRole("spinbutton", { name: "Level", exact: true })
      .fill("12");
    await page
      .getByRole("combobox", { name: "Movement", exact: true })
      .selectOption("D20");
    await page
      .getByRole("textbox", { name: "スキル 1", exact: true })
      .fill("手動で成長したスキル");
    await page
      .getByRole("button", { name: "スキル 2 を削除", exact: true })
      .click();
    await page.getByRole("button", { name: "＋ 呪文", exact: true }).click();
    await page
      .getByRole("textbox", { name: "呪文 1", exact: true })
      .fill("保持する呪文");
    await page
      .getByRole("textbox", { name: "武器1", exact: true })
      .fill("保持する剣");
    await page
      .locator("#photo-library")
      .setInputFiles(path.resolve("icon-192.png"));
    await page.locator("#photo-preview img").waitFor();
    await page.getByRole("checkbox", { name: "運命点 3", exact: true }).check();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page
      .locator("#save-status")
      .filter({ hasText: "端末に保存済み" })
      .waitFor();
    await page.reload();
    await page.getByRole("button", { name: "開く", exact: true }).click();
    await enableRosterEditing(page);
    await page.getByRole("button", { name: "編集", exact: true }).click();
    assert.equal(
      await page
        .getByRole("combobox", { name: "種族", exact: true })
        .inputValue(),
      "massive-06",
    );
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "Level", exact: true })
        .inputValue(),
      "12",
    );
    assert.equal(
      await page
        .getByRole("combobox", { name: "Movement", exact: true })
        .inputValue(),
      "D20",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "スキル 1", exact: true })
        .inputValue(),
      "手動で成長したスキル",
    );
    await page
      .getByRole("combobox", { name: "サイズ分類", exact: true })
      .selectOption("small");
    await page
      .getByRole("combobox", { name: "種族", exact: true })
      .selectOption("small-01");
    await page
      .getByRole("button", { name: "変更を取り消す", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("combobox", { name: "種族", exact: true })
        .inputValue(),
      "massive-06",
    );
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "Level", exact: true })
        .inputValue(),
      "12",
    );
    assert.equal(
      await page
        .getByRole("combobox", { name: "Movement", exact: true })
        .inputValue(),
      "D20",
    );
    await page
      .getByRole("combobox", { name: "サイズ分類", exact: true })
      .selectOption("medium");
    await page
      .getByRole("combobox", { name: "種族", exact: true })
      .selectOption("medium-03");
    await page
      .getByRole("button", { name: "初期値に置き換える", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "Level", exact: true })
        .inputValue(),
      "2",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "スキル 1", exact: true })
        .inputValue(),
      "ストロング(1)",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "武器1", exact: true })
        .inputValue(),
      "保持する剣",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "呪文 1", exact: true })
        .inputValue(),
      "保持する呪文",
    );
    assert.equal(
      await page.locator('[data-form-point="fate"]:checked').count(),
      3,
    );
    assert.equal(await page.locator("#photo-preview img").count(), 1);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page
      .locator("#save-status")
      .filter({ hasText: "端末に保存済み" })
      .waitFor();
    await page.getByRole("link", { name: "ホーム", exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "JSON を書き出す" }).click(),
    ]);
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "bb-species-")),
      "backup.json",
    );
    await download.saveAs(file);
    const d = JSON.parse(fs.readFileSync(file));
    assert.equal(d.warbands[0].characters[0].speciesPresetId, "medium-03");
    assert.equal(d.warbands[0].characters[0].species, "モグラ");
    assert.deepEqual(d.warbands[0].characters[0].skillEntries, [
      "ストロング(1)",
      "坑道掘り",
      "近眼",
    ]);
    await page.locator("#restore-file").setInputFiles(file);
    await page.getByRole("button", { name: "確認して実行" }).click();
    await page.locator("#modal").waitFor({ state: "hidden" });
    await page.reload();
    await page.getByRole("link", { name: "ウォーバンド", exact: true }).click();
    await page.getByRole("button", { name: "開く", exact: true }).click();
    await enableRosterEditing(page);
    await page.getByRole("button", { name: "編集", exact: true }).click();
    assert.equal(
      await page
        .getByRole("combobox", { name: "種族", exact: true })
        .inputValue(),
      "medium-03",
    );
    assert.equal(
      await page
        .getByRole("textbox", { name: "スキル 2", exact: true })
        .inputValue(),
      "坑道掘り",
    );
    assert.equal(
      await page
        .locator("#modal")
        .evaluate((e) => e.scrollWidth <= e.clientWidth),
      true,
    );
    await page.screenshot({
      path: path.join(os.tmpdir(), "bb-species-form.png"),
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: all 48 species, grouped selectors, manual growth retention, change confirmation/cancel, fixed equipment and spell preservation, skill edits/deletes, JSON restoration",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
