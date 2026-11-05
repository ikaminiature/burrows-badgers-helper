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
    await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173");
    await page.getByRole("heading", { name: "冒険の準備" }).waitFor();
    await page.getByRole("link", { name: "ウォーバンド", exact: true }).click();
    await page.getByRole("button", { name: "＋ ウォーバンドを登録" }).click();
    await page
      .getByRole("textbox", { name: "名前", exact: true })
      .fill("カード検証");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page
      .getByRole("button", { name: "ステータス編集", exact: true })
      .click();
    for (const label of ["年金", "労働力", "資材", "トレジャリー"])
      await page
        .getByRole("spinbutton", { name: label, exact: true })
        .fill("9999");
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.getByRole("button", { name: "＋ キャラクター登録" }).click();
    const name = "とても長い名前の森を守る勇敢な小さな戦士アッシュ";
    await page.getByRole("textbox", { name: "名前", exact: true }).fill(name);
    await page
      .getByRole("textbox", { name: "種族", exact: true })
      .fill("ネズミ");
    await page
      .getByRole("spinbutton", { name: "Level", exact: true })
      .fill("6");
    await page
      .locator("#photo-library")
      .setInputFiles(path.resolve("icon-192.png"));
    await page.locator("#photo-preview img").waitFor();
    const values = {
      Movement: "D4",
      Strike: "D8",
      Ranged: "D10",
      Concealment: "D6",
      Fortitude: "D12",
      Block: "D6",
      Nimbleness: "D8",
      Awareness: "D4",
      Presence: "D10",
    };
    for (const [k, v] of Object.entries(values))
      await page
        .getByRole("combobox", { name: k, exact: true })
        .selectOption(v);
    assert.equal(await page.locator("[data-form-point]:checked").count(), 0);
    await page.getByRole("checkbox", { name: "運命点 5", exact: true }).check();
    await page.getByRole("checkbox", { name: "経験値 3", exact: true }).check();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    const card = page.locator(".roster-card");
    assert.equal(await card.locator("img").count(), 1);
    await card.getByText("ネズミ · Lv. 06", { exact: true }).waitFor();
    assert.equal(await card.locator('[data-point="fate"]:checked').count(), 5);
    assert.equal(
      await card.locator('[data-point="experience"]:checked').count(),
      3,
    );
    assert.deepEqual(await card.locator(".card-stats span").allTextContents(), [
      "M4",
      "S8",
      "R10",
      "C6",
      "F12",
      "",
      "B6",
      "N8",
      "A4",
      "P10",
    ]);
    const rects = await card.locator(".card-stats span").evaluateAll((es) =>
      es.map((e) => ({
        x: e.getBoundingClientRect().x,
        y: e.getBoundingClientRect().y,
      })),
    );
    for (let i = 1; i < 5; i++) {
      assert.equal(rects[i].x, rects[i + 5].x);
      assert.equal(rects[i].y, rects[0].y);
      assert.equal(rects[i + 5].y, rects[5].y);
    }
    assert.ok(rects[5].y > rects[0].y);
    const resources = await page
      .locator(".resources dd")
      .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().y));
    assert.equal(new Set(resources).size, 1);
    assert.equal(await card.locator("[data-point]:disabled").count(), 10);
    await card
      .locator('[data-point="fate"]')
      .first()
      .evaluate((e) => e.click());
    assert.equal(await card.locator('[data-point="fate"]:checked').count(), 5);
    await card.getByRole("button", { name: "編集", exact: true }).click();
    await page
      .getByRole("checkbox", { name: "運命点 4", exact: true })
      .uncheck();
    await page.getByRole("checkbox", { name: "経験値 5", exact: true }).check();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    const saved = () =>
      page
        .locator("#save-status")
        .filter({ hasText: "端末に保存済み" })
        .waitFor();
    await saved();
    await page.reload();
    await page.getByRole("button", { name: "開く", exact: true }).click();
    assert.equal(await card.locator('[data-point="fate"]:checked').count(), 3);
    assert.equal(
      await card.locator('[data-point="experience"]:checked').count(),
      5,
    );
    // Selecting the name opens full information and the existing edit form.
    await card.getByRole("button", { name, exact: true }).click();
    await page
      .getByRole("button", { name: "編集", exact: true })
      .filter({ visible: true })
      .last()
      .click();
    assert.equal(
      await page.locator('[data-form-point="fate"]:checked').count(),
      3,
    );
    await page
      .getByRole("checkbox", { name: "経験値 2", exact: true })
      .uncheck();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    assert.equal(
      await card.locator('[data-point="experience"]:checked').count(),
      1,
    );
    await saved();
    await page.getByRole("link", { name: "ホーム", exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "JSON を書き出す" }).click(),
    ]);
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "bb-cards-")),
      "backup.json",
    );
    await download.saveAs(file);
    const backup = JSON.parse(fs.readFileSync(file));
    assert.equal(backup.warbands[0].characters[0].fate, 3);
    assert.equal(backup.warbands[0].characters[0].experience, 1);
    await page.getByRole("link", { name: "ゲームを開始", exact: true }).click();
    await page.getByRole("button", { name: "このウォーバンドで開始" }).click();
    await page
      .getByRole("button", { name: "ゲームを終了", exact: true })
      .click();
    await page.getByRole("button", { name: "確認して実行" }).click();
    await page.getByRole("link", { name: "ウォーバンド", exact: true }).click();
    await page.getByRole("button", { name: "開く", exact: true }).click();
    assert.equal(await card.locator('[data-point="fate"]:checked').count(), 3);
    assert.equal(
      await card.locator('[data-point="experience"]:checked').count(),
      1,
    );
    await card.getByRole("button", { name: "編集", exact: true }).click();
    await page
      .getByRole("checkbox", { name: "運命点 1", exact: true })
      .uncheck();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await saved();
    await page.getByRole("link", { name: "ホーム", exact: true }).click();
    await page.locator("#restore-file").setInputFiles(file);
    await page.getByRole("button", { name: "確認して実行" }).click();
    await page.locator("#modal").waitFor({ state: "hidden" });
    await page.reload();
    await page.getByRole("link", { name: "ウォーバンド", exact: true }).click();
    await page.getByRole("button", { name: "開く", exact: true }).click();
    assert.equal(await card.locator('[data-point="fate"]:checked').count(), 3);
    assert.equal(
      await card.locator('[data-point="experience"]:checked').count(),
      1,
    );
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page
          .locator(".resources>div")
          .evaluateAll((es) =>
            es.every((e) => parseFloat(getComputedStyle(e).borderTopWidth) > 0),
          ),
        true,
      );
      assert.equal(
        await page.locator(".resources dd").evaluateAll((es) =>
          es.every((e) => {
            const r = document.createRange();
            r.selectNodeContents(e);
            return (
              r.getClientRects().length === 1 &&
              r.getBoundingClientRect().width <= e.clientWidth
            );
          }),
        ),
        true,
      );
      assert.equal(
        new Set(
          await page
            .locator(".resources dd")
            .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().y)),
        ).size,
        1,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
    }
    await page.screenshot({
      path: path.join(os.tmpdir(), "bb-roster-cards.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: long-name cards, exact 5x2 stat positions, 4-column resources, point form/card persistence, JSON restoration, end-game preservation, mobile widths",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
