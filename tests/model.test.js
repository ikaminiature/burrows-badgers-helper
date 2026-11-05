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
    characters: [{ ...character("a"), photo: "data:image/jpeg;base64,YQ==" }],
  });
  d.game = startGame(d.warbands[0]);
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(d))), d);
  for (const mutate of [
    (x) => (x.version = 2),
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
