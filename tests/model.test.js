import test from "node:test";
import assert from "node:assert/strict";
import {
  stats,
  penalty,
  wound,
  sorted,
  startGame,
  nextRound,
  validateData,
  emptyData,
  loadData,
  emptyBandStatus,
} from "../src/model.js";
const character = (id) => ({
  id,
  name: id,
  species: "ネズミ",
  level: 0,
  photo: "",
  stats: Object.fromEntries(stats.map((s) => [s, "D6"])),
  equipment: "剣",
  skills: "",
  spells: "",
  notes: "",
});
test("負傷ペナルティの全18値", () => {
  assert.deepEqual(
    Array.from({ length: 18 }, (_, w) => penalty(w)),
    [
      "0",
      "0",
      "0",
      "0",
      "-1",
      "-1",
      "-1",
      "-2",
      "-2",
      "-2",
      "-3",
      "-3",
      "-3",
      "-4",
      "-4",
      "-4",
      "-4",
      "戦闘不能",
    ],
  );
});
test("上下限と戦闘不能から回復した際の行動保持", () => {
  const c = { wounds: 16, acted: false };
  wound(c, 1);
  assert.deepEqual(c, { wounds: 17, acted: true });
  wound(c, 1);
  assert.equal(c.wounds, 17);
  wound(c, -1);
  assert.deepEqual(c, { wounds: 16, acted: true });
  wound(c, -100);
  assert.equal(c.wounds, 0);
});
test("グループ順と登録順の維持", () => {
  const cs = [
    { id: "a", wounds: 17, acted: true },
    { id: "b", wounds: 0, acted: true },
    { id: "c", wounds: 0, acted: false },
    { id: "d", wounds: 0, acted: false },
    { id: "e", wounds: 0, acted: true },
  ];
  assert.deepEqual(
    sorted(cs).map((c) => c.id),
    ["c", "d", "b", "e", "a"],
  );
  assert.equal(cs[0].id, "a");
});
test("戦闘スナップショット独立とラウンド更新", () => {
  const w = { name: "森", characters: [character("a"), character("b")] };
  const g = startGame(w);
  g.characters[0].stats.Movement = "D12";
  wound(g.characters[0], 17);
  g.characters[1].acted = true;
  nextRound(g);
  assert.equal(g.round, 2);
  assert.equal(g.characters[0].acted, true);
  assert.equal(g.characters[1].acted, false);
  assert.equal(w.characters[0].stats.Movement, "D6");
  assert.equal(w.characters[0].wounds, undefined);
});
test("写真と戦闘を含むバックアップ往復および不正入力拒否", () => {
  const d = emptyData();
  d.warbands.push({
    id: "w",
    name: "森",
    status: emptyBandStatus(),
    characters: [{ ...character("a"), photo: "data:image/jpeg;base64,YQ==" }],
  });
  d.game = startGame(d.warbands[0]);
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(d))), d);
  for (const mutate of [
    (x) => (x.version = 99),
    (x) => (x.game.characters[0].wounds = 18),
    (x) => (x.warbands[0].characters[0].stats.Block = "D99"),
    (x) => (x.warbands[0].characters[0].photo = "javascript:alert(1)"),
    (x) =>
      (x.game.characters[0].effects = [{ id: "e", name: "", description: "" }]),
  ]) {
    const bad = structuredClone(d);
    mutate(bad);
    assert.throws(() => validateData(bad));
  }
});

test("旧データの移行はキャラクター・写真・戦闘を変えず、元データも変更しない", () => {
  const legacy = {
    version: 1,
    warbands: [
      {
        id: "w",
        name: "旧バンド",
        characters: [
          { ...character("c"), photo: "data:image/jpeg;base64,YQ==" },
        ],
      },
    ],
    game: null,
  };
  legacy.game = startGame(legacy.warbands[0]);
  delete legacy.game.status;
  wound(legacy.game.characters[0], 17);
  legacy.game.round = 8;
  const original = structuredClone(legacy),
    loaded = loadData(legacy);
  assert.equal(loaded.version, 2);
  assert.deepEqual(loaded.warbands[0].status, emptyBandStatus());
  assert.deepEqual(
    loaded.warbands[0].characters,
    original.warbands[0].characters,
  );
  assert.deepEqual(loaded.game, original.game);
  assert.deepEqual(legacy, original);
  loaded.warbands[0].status.stash.push({ id: "s", name: "剣" });
  assert.deepEqual(loadData(JSON.parse(JSON.stringify(loaded))), loaded);
});
test("ステータス・独立リストのJSON往復とゲームスナップショットの独立", () => {
  const d = emptyData(),
    s = {
      ...emptyBandStatus(),
      rating: 123.5,
      pension: 2,
      labour: 3,
      materials: 4,
      treasury: -5,
      alliance: "自由入力",
      archetype: "斥候",
      notes: "1行目\n2行目",
      stash: [
        { id: "a", name: "弓" },
        { id: "b", name: "矢" },
      ],
      upgrades: [{ id: "u", name: "工房" }],
    };
  d.warbands.push({
    id: "w",
    name: "森",
    status: s,
    characters: [character("a")],
  });
  d.game = startGame(d.warbands[0]);
  assert.deepEqual(loadData(JSON.parse(JSON.stringify(d))), d);
  s.stash[0].name = "剣";
  s.rating = 999;
  assert.equal(d.game.status.rating, 123.5);
  assert.equal(d.game.status.stash[0].name, "弓");
  // No item count limit; order and separate lists survive serialization.
  s.stash = Array.from({ length: 350 }, (_, i) => ({
    id: "item" + i,
    name: String(i),
  }));
  assert.deepEqual(
    loadData(JSON.parse(JSON.stringify(d))).warbands[0].status.stash,
    s.stash,
  );
  for (const mutate of [
    (x) => (x.rating = "5"),
    (x) => (x.materials = Infinity),
    (x) => x.stash.push({ id: "item0", name: "重複" }),
    (x) => (x.upgrades = "工房"),
  ]) {
    const bad = structuredClone(d);
    mutate(bad.warbands[0].status);
    assert.throws(() => validateData(bad));
  }
});
