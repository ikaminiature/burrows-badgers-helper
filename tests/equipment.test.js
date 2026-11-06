import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseEquipmentCatalog,
  searchEquipment,
  equipmentDisplayName,
  normalizeEquipmentSearch,
} from "../src/equipment.js";
import {
  emptyData,
  emptyBandStatus,
  loadData,
  stats,
  startGame,
} from "../src/model.js";
const source = JSON.parse(
    await readFile(
      new URL("../data/bb2_general_store_ja_en.json", import.meta.url),
      "utf8",
    ),
  ),
  catalog = parseEquipmentCatalog(source);
test("添付96件・安定ID・全フィールドを維持し不要な値を登録しない", () => {
  assert.equal(catalog.length, 96);
  assert.equal(new Set(catalog.map((i) => i.id)).size, 96);
  assert.deepEqual(
    Object.fromEntries(
      [
        "weapon",
        "armour",
        "item",
        "ingredient",
        "bonded_critter",
        "stag_beetle_grub",
      ].map((k) => [k, catalog.filter((i) => i.category === k).length]),
    ),
    {
      weapon: 17,
      armour: 6,
      item: 34,
      ingredient: 31,
      bonded_critter: 5,
      stag_beetle_grub: 3,
    },
  );
  for (const [index, item] of catalog.entries()) {
    assert.deepEqual(item, source.items[index]);
    assert.equal(Object.hasOwn(item, "price"), false);
    assert.equal(Object.hasOwn(item, "rarity"), false);
  }
  assert.deepEqual(
    catalog.filter((i) => i.reviewRequired),
    [],
    "確認済み項目には要確認フラグを残さない",
  );
  assert.deepEqual(
    catalog
      .filter((i) => ["general-store-034", "general-store-060", "general-store-082"].includes(i.id))
      .map((i) => [i.id, i.nameJa, i.nameEn]),
    [
      ["general-store-034", "リードスリングショット", "Lead slingshot"],
      ["general-store-060", "角の粉", "Antler dust"],
      ["general-store-082", "粉末ドングリ", "Powdered acorns"],
    ],
  );
  assert.equal(equipmentDisplayName(catalog[5]), "弓（18″）");
  assert.equal(equipmentDisplayName(catalog[9]), "ピストル（12″）");
  assert.equal(equipmentDisplayName(catalog[0]), "片手武器");
  assert.deepEqual(catalog[9].notesJa, ["スロウ", "気まぐれ", "黒色火薬"]);
});
test("日英・大文字小文字・全角半角・かな・複数語検索とカテゴリ", () => {
  for (const query of [
    "ライトクロスボウ",
    "ﾗｲﾄｸﾛｽﾎﾞｳ",
    "らいとくろすぼう",
    "LIGHT CROSSBOW",
    "ＬＩＧＨＴ　ＣＲＯＳＳＢＯＷ",
    "Crossbow Light",
  ])
    assert.deepEqual(
      searchEquipment(catalog, { query }).map((i) => i.id),
      ["general-store-007"],
      query,
    );
  assert.equal(
    searchEquipment(catalog, { query: "Mage's focus" })[0].id,
    "general-store-027",
  );
  assert.equal(searchEquipment(catalog, { category: "armour" }).length, 6);
  assert.equal(
    searchEquipment(catalog, { query: "Mandrake", slot: "weapon1" })[0]
      .category,
    "ingredient",
  );
  assert.equal(
    searchEquipment(catalog, { category: "weapon", query: "Mandrake" }).length,
    0,
  );
  assert.equal(normalizeEquipmentSearch("ＡＢＣ　ﾗｲﾄ"), "abcライト");
});
test("枠別のカテゴリ優先、最近の選択と全カテゴリ検索", () => {
  for (const [slot, category] of [
    ["weapon1", "weapon"],
    ["weapon2", "weapon"],
    ["armour1", "armour"],
    ["armour2", "armour"],
    ["item", "item"],
  ])
    assert.equal(searchEquipment(catalog, { slot })[0].category, category);
  assert.equal(searchEquipment(catalog, { slot: "special" }).length, 96);
  assert.equal(
    searchEquipment(catalog, { slot: "special" })[0].id,
    catalog[0].id,
  );
  assert.equal(
    searchEquipment(catalog, {
      slot: "weapon1",
      recent: ["general-store-080", "general-store-006"],
    })[0].id,
    "general-store-080",
  );
  assert.equal(
    searchEquipment(catalog, {
      slot: "weapon1",
      recent: ["general-store-080", "general-store-006"],
    })[1].id,
    "general-store-006",
  );
});
test("選択装備のID・射程・備考・自由入力のJSON往復とゲーム独立", () => {
  const c = {
      id: "c",
      name: "戦士",
      species: "旧種族",
      level: 6,
      fate: 3,
      experience: 2,
      photo: "",
      stats: Object.fromEntries(stats.map((s) => [s, "D8"])),
      equipment: "旧自由装備",
      skills: "旧技能",
      spells: "旧呪文",
      notes: "",
      equipmentSlots: {
        weapon1: "弓",
        weapon2: "独自の杖",
        armour1: "",
        armour2: "",
        item: "",
        special: "",
      },
      equipmentSelections: { weapon1: structuredClone(catalog[5]) },
    },
    d = emptyData();
  d.warbands.push({
    id: "w",
    name: "森",
    status: emptyBandStatus(),
    characters: [c],
  });
  d.game = startGame(d.warbands[0]);
  d.recentEquipmentIds = ["general-store-006"];
  assert.deepEqual(loadData(JSON.parse(JSON.stringify(d))), d);
  c.equipmentSelections.weapon1.notesJa.push("登録用メモ");
  assert.deepEqual(
    d.game.characters[0].equipmentSelections.weapon1.notesJa,
    [],
  );
  for (const mutate of [
    (x) => (x.equipmentSelections.weapon1.range = 12),
    (x) => (x.equipmentSelections.extra = catalog[0]),
    (x) => (x.equipmentSelections.weapon1.notesJa = "不正"),
    (x) => (x.equipmentSelections.weapon1.id = '"><script>'),
  ]) {
    const bad = structuredClone(d);
    mutate(bad.warbands[0].characters[0]);
    assert.throws(() => loadData(bad));
  }
});
