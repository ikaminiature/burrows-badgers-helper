const {openPanel,closePanel}=require('./support/panel.cjs');
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
    const { emptyBandStatus, stats, startGame } = await import(
      "../src/model.js"
    );
    const c = {
        id: "one",
        name: "長い名前の第一の戦士",
        species: "旧種族",
        level: 6,
        fate: 2,
        experience: 3,
        photo:
          "data:image/png;base64," +
          fs.readFileSync("icon-192.png").toString("base64"),
        stats: Object.fromEntries(stats.map((s) => [s, "D8"])),
        equipment: "旧装備の原文",
        skills: "旧スキルの原文",
        spells: "旧呪文の原文",
        notes: "特殊効果\nメモ",
        equipmentSlots: {
          weapon1: "剣",
          weapon2: "弓",
          armour1: "鎧",
          armour2: "盾",
          item: "道具",
          special: "特別装備",
        },
        skillEntries: ["スキルＡ", "スキルＢ"],
        spellEntries: ["呪文Ａ", "呪文Ｂ"],
      },
      second = { ...structuredClone(c), id: "two", name: "第二の戦士" };
    const w = {
        id: "w",
        name: "閲覧検証",
        status: emptyBandStatus(),
        characters: [c, second],
      },
      data = { version: 2, warbands: [w], game: startGame(w) };
    data.game.characters[0].wounds = 5;
    data.game.round = 4;
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.writeCount = 0;
      const original = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (stores, mode, ...args) {
        if (mode === "readwrite") window.writeCount++;
        return original.call(this, stores, mode, ...args);
      };
    });
    await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173");
    await page.getByRole("heading", { name: "冒険の準備" }).waitFor();
    const disk = () =>
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
    async function open() {
      await page
        .getByRole("link", { name: "ウォーバンド", exact: true })
        .click();
      await page.getByRole("button", { name: "開く", exact: true }).click();
    }
    await open();
    const cards = page.locator(".roster-card"),
      first = cards.nth(0),
      other = cards.nth(1);
    assert.equal(await first.locator(".character-extra").isVisible(), false);
    assert.equal(await other.locator(".character-extra").isVisible(), false);
    for (const text of ["編集", "複製", "削除"])
      assert.equal(
        await cards.getByRole("button", { name: text, exact: true }).count(),
        0,
      );
    await openPanel(page,first);
    const panel=page.locator("#character-panel .character-extra");
    assert.equal(await panel.locator("input,textarea,select,button").count(),0);
    assert.deepEqual(await panel.locator("dt").allTextContents(),["武器1","武器2","鎧1","鎧2","アイテム","スペシャル"]);
    for(const text of ["剣","弓","鎧","盾","道具","特別装備"])await panel.getByText(text,{exact:true}).waitFor();
    await panel.getByText("特殊効果\nメモ",{exact:true}).waitFor();
    await page.locator("#character-panel").getByRole("tab",{name:"スキル",exact:true}).click();
    for(const text of ["スキルＡ","スキルＢ"])await panel.getByText(text,{exact:true}).waitFor();
    await page.locator("#character-panel").getByRole("tab",{name:"呪文",exact:true}).click();
    for(const text of ["呪文Ａ","呪文Ｂ"])await panel.getByText(text,{exact:true}).waitFor();
    await closePanel(page);await openPanel(page,other);
    await page.locator("#character-panel").getByRole("heading",{name:second.name,exact:true}).waitFor();
    await closePanel(page);
    await first.getByRole("button", { name: c.name, exact: true }).click();
    assert.equal(
      await page
        .locator("#modal")
        .getByRole("button", { name: "編集", exact: true })
        .count(),
      0,
    );
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ["light", "dark"]) {
        await page.emulateMedia({ colorScheme: theme });
        const layout = await first
          .locator(".readonly-points")
          .evaluateAll((es) =>
            es.map((el) => {
              const caption = el
                  .querySelector(".point-caption")
                  .getBoundingClientRect(),
                boxes = [...el.querySelectorAll("input")].map((e) => ({
                  r: e.getBoundingClientRect().toJSON(),
                  disabled: e.disabled,
                  opacity: getComputedStyle(e).opacity,
                  bg: getComputedStyle(e).backgroundColor,
                }));
              return { caption: caption.toJSON(), boxes };
            }),
          );
        assert.equal(layout[0].boxes[0].r.x, layout[1].boxes[0].r.x);
        for (const row of layout) {
          assert.equal(row.boxes.length, 5);
          for (const box of row.boxes) {
            assert.equal(box.disabled, true);
            assert.equal(box.opacity, "1");
            assert.ok(
              Math.abs(
                row.caption.y +
                  row.caption.height / 2 -
                  (box.r.y + box.r.height / 2),
              ) < 1,
            );
            assert.equal(box.r.y, row.boxes[0].r.y);
          }
          assert.notEqual(row.boxes[0].bg, row.boxes[4].bg);
        }
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
      }
    }
    await page.getByRole("button", { name: "編集モード", exact: true }).click();
    for (const text of ["編集", "複製", "削除"])
      assert.equal(
        await first.getByRole("button", { name: text, exact: true }).count(),
        1,
      );
    assert.equal(await other.locator(".character-extra").isVisible(), false);
    await page
      .getByRole("button", { name: "編集を終了", exact: true })
      .click();
    assert.equal(await page.evaluate(() => window.writeCount), 0);
    assert.deepEqual(await disk(), data);
    await page.getByRole("button", { name: "編集モード", exact: true }).click();
    await first.getByRole("button", { name: "編集", exact: true }).click();
    await page
      .getByRole("textbox", { name: "名前", exact: true })
      .fill("編集済み");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await first.getByRole("button", { name: "複製", exact: true }).click();
    assert.equal(await cards.count(), 3);
    assert.equal(
      await cards.nth(1).getByRole("heading").textContent(),
      "編集済み の複製",
    );
    await cards
      .nth(1)
      .getByRole("button", { name: "削除", exact: true })
      .click();
    await page.getByRole("button", { name: "キャンセル", exact: true }).click();
    assert.equal(await cards.count(), 3);
    await cards
      .nth(1)
      .getByRole("button", { name: "削除", exact: true })
      .click();
    await page.getByRole("button", { name: "確認して実行" }).click();
    assert.equal(await cards.count(), 2);
    await page
      .locator("#save-status")
      .filter({ hasText: "端末に保存済み" })
      .waitFor();
    const after = await disk();
    assert.deepEqual(after.game, data.game);
    assert.deepEqual(after.warbands[0].characters[0], {
      ...c,
      name: "編集済み",
    });
    assert.deepEqual(after.warbands[0].characters[1], second);
    await page.reload();
    await page.getByRole("button", { name: "開く", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "編集モード", exact: true })
        .count(),
      1,
    );
    assert.equal(await cards.locator(".character-extra:visible").count(), 0);
    assert.equal(
      await cards.getByRole("button", { name: "編集", exact: true }).count(),
      0,
    );
    await page.screenshot({
      path: path.join(os.tmpdir(), "bb-roster-view.png"),
      fullPage: true,
    });
    await page.getByRole("link", { name: "ホーム", exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "JSON を書き出す" }).click(),
    ]);
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "bb-view-")),
      "backup.json",
    );
    await download.saveAs(file);
    assert.deepEqual(JSON.parse(fs.readFileSync(file)), after);
    await page.locator("#restore-file").setInputFiles(file);
    await page.getByRole("button", { name: "確認して実行" }).click();
    await page.locator("#modal").waitFor({ state: "hidden" });
    await open();
    assert.equal(
      await cards.getByRole("button", { name: "編集", exact: true }).count(),
      0,
    );
    assert.deepEqual(await disk(), after);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: character-specific panel, readonly tabs, view/edit mode with no DB writes, edit/duplicate/delete confirmation, horizontal point labels at 320/390px light/dark, JSON/photo/battle preservation",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
