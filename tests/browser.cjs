const { enableRosterEditing } = require("./support/roster.cjs");
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173");
  await page.getByRole("heading", { name: "冒険の準備" }).waitFor();
  await page.getByRole("link", { name: /ウォーバンドを管理/ }).click();
  await page.getByRole("button", { name: "＋ ウォーバンドを登録" }).click();
  await page
    .getByRole("textbox", { name: "名前", exact: true })
    .fill("森の仲間");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  async function add(name) {
    await page.getByRole("button", { name: "＋ キャラクター登録" }).click();
    await page.getByRole("textbox", { name: "名前", exact: true }).fill(name);
    await page
      .getByRole("combobox", { name: "サイズ分類", exact: true })
      .selectOption("small");
    await page
      .getByRole("combobox", { name: "種族", exact: true })
      .selectOption("small-01");
    if (name === "アッシュ") {
      await page
        .locator("#photo-library")
        .setInputFiles(require("node:path").resolve("icon-512.png"));
      await page.locator("#photo-preview img").waitFor();
    }
    await page.getByRole("button", { name: "保存", exact: true }).click();
  }
  await add("アッシュ");
  await add("バーチ");
  await page.getByRole("link", { name: "ホーム", exact: true }).click();
  await page.getByRole("link", { name: "ゲームを開始", exact: true }).click();
  await page.getByRole("button", { name: "このウォーバンドで開始" }).click();
  await page.getByRole("heading", { name: "アッシュ", exact: true }).waitFor();
  for (let i = 0; i < 17; i++)
    await page
      .getByRole("button", { name: "アッシュの負傷を1増やす", exact: true })
      .click();
  let ash = page.locator("article").filter({
    has: page.getByRole("heading", { name: "アッシュ", exact: true }),
  });
  assert.equal(
    await ash
      .getByRole("checkbox", { name: "行動済み", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page.locator("article").last().getByRole("heading").textContent(),
    "アッシュ",
  );
  await ash.getByRole("button", { name: "アッシュの負傷を1減らす" }).click();
  assert.equal(
    await ash
      .getByRole("checkbox", { name: "行動済み", exact: true })
      .isChecked(),
    true,
  );
  assert.equal(
    await ash
      .getByRole("checkbox", { name: "行動済み", exact: true })
      .isDisabled(),
    false,
  );
  await page.getByRole("button", { name: "次のラウンド", exact: true }).click();
  await page.getByRole("button", { name: "確認して実行" }).click();
  assert.equal(
    await ash
      .getByRole("checkbox", { name: "行動済み", exact: true })
      .isChecked(),
    false,
  );
  await ash.locator(".condition-picker > summary").click();
  await page.getByRole("textbox", { name: "自由登録の状態名", exact: true }).fill("毒");
  await page.getByRole("textbox", { name: "説明・メモ" }).fill("手動で処理");
  await page.getByRole("button", { name: "登録", exact: true }).click();
  await page
    .locator("#save-status")
    .filter({ hasText: "端末に保存済み" })
    .waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "アッシュ", exact: true }).waitFor();
  await page.locator(".gauge").first().waitFor();
  assert.equal(await page.locator(".gauge").first().locator(".filled").count(), 16);
  assert.equal(await page.locator("article").first().locator("img").count(), 1);
  await page.getByRole("link", { name: "ホーム", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "JSON を書き出す" }).click(),
  ]);
  const file = require("node:path").join(
    require("node:fs").mkdtempSync(
      require("node:path").join(require("node:os").tmpdir(), "bb-test-"),
    ),
    "backup.json",
  );
  await download.saveAs(file);
  const backup = require(file);
  assert.equal(backup.game.round, 2);
  assert.equal(backup.game.characters[0].effects[0].name, "毒");
  assert.ok(
    backup.warbands[0].characters[0].photo.startsWith("data:image/jpeg"),
  );
  // Change the live game after export so restoration must actually replace it.
  await page.getByRole("link", { name: /ラウンド 2 を再開/ }).click();
  await page.getByRole("button", { name: "次のラウンド", exact: true }).click();
  await page.getByRole("button", { name: "確認して実行" }).click();
  await page.getByRole("link", { name: "ホーム", exact: true }).click();
  await page.getByRole("link", { name: /ラウンド 3 を再開/ }).waitFor();
  // Hold a real IndexedDB write lock to reproduce a slow restore deterministically.
  await page
    .locator("#save-status")
    .filter({ hasText: "端末に保存済み" })
    .waitFor();
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("bb-helper", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("data", "readwrite");
          let held = true;
          window.releaseRestoreLock = () => {
            held = false;
          };
          tx.oncomplete = () => db.close();
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
          const keepAlive = () => {
            tx.objectStore("data").get("app").onsuccess = () => {
              resolve();
              if (held) keepAlive();
            };
          };
          keepAlive();
        };
      }),
  );
  await page.getByRole("button", { name: "JSON から復元" }).click();
  await page.locator("#restore-file").setInputFiles(file);
  await page.getByRole("button", { name: "確認して実行" }).click();
  await page.getByRole("heading", { name: "復元中…", exact: true }).waitFor();
  assert.equal(await page.locator("#save-status").textContent(), "復元中…");
  assert.equal(await page.locator("#modal").isVisible(), true);
  await page.evaluate(() => window.releaseRestoreLock());
  await page.locator("#modal").waitFor({ state: "hidden" });
  await page.getByRole("link", { name: /ラウンド 2 を再開/ }).waitFor();
  await page
    .locator("#save-status")
    .filter({ hasText: "端末に保存済み" })
    .waitFor();
  // Reload only after the restored snapshot is committed and rendered.
  await page.reload();
  await page.getByRole("link", { name: /ラウンド 2 を再開/ }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "冒険の準備" }).waitFor();
  await page.getByRole("link", { name: /ラウンド 2 を再開/ }).click();
  await page.getByRole("heading", { name: "アッシュ", exact: true }).waitFor();
  await page.locator(".gauge").first().waitFor();
  assert.equal(await page.locator(".gauge").first().locator(".filled").count(), 16);
  assert.equal(await page.locator("article").first().locator("img").count(), 1);
  await page.locator("article").first().locator(".condition-picker > summary").click();
  await page.locator("article").first().getByText("毒", {exact:true}).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: require("node:path").join(
      require("node:path").dirname(file),
      "battle.png",
    ),
    fullPage: true,
  });
  await page.getByRole("button", { name: "ゲームを終了", exact: true }).click();
  await page.getByRole("button", { name: "確認して実行" }).click();
  await page.getByRole("link", { name: /ウォーバンドを管理/ }).click();
  await page.getByRole("button", { name: "開く", exact: true }).click();
  await enableRosterEditing(page);
  await page.getByRole("button", { name: "編集", exact: true }).first().click();
  assert.equal(
    await page.getByRole("textbox", { name: "名前", exact: true }).inputValue(),
    "アッシュ",
  );
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await page.getByRole("button", { name: "複製", exact: true }).first().click();
  assert.equal(await page.locator("article").count(), 3);
  await page
    .getByRole("button", { name: "アッシュ の複製を上へ", exact: true })
    .click();
  assert.equal(
    await page.locator("article").first().getByRole("heading").textContent(),
    "アッシュ の複製",
  );
  await page.getByRole("button", { name: "削除", exact: true }).first().click();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  assert.equal(await page.locator("article").count(), 3);
  await page.getByRole("button", { name: "削除", exact: true }).first().click();
  await page.getByRole("button", { name: "確認して実行" }).click();
  assert.equal(await page.locator("article").count(), 2);
  await page.getByRole("button", { name: "名前変更", exact: true }).click();
  await page
    .getByRole("textbox", { name: "名前", exact: true })
    .fill("森の守り手");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page
    .getByRole("button", { name: "ウォーバンド一覧へ", exact: true })
    .click();
  await page.getByRole("button", { name: "＋ ウォーバンドを登録" }).click();
  await page.getByRole("textbox", { name: "名前", exact: true }).fill("予備");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page
    .getByRole("button", { name: "ウォーバンド削除", exact: true })
    .click();
  await page.getByRole("button", { name: "確認して実行" }).click();
  assert.equal(
    await page.getByRole("button", { name: "開く", exact: true }).count(),
    1,
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 768, height: 1024 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mobile CRUD, photo resize, wound bounds, ordering, round, effects, IndexedDB reload, JSON roundtrip, offline reload, end-game isolation, no overflow / console errors",
  );
  await browser.close();
})();
