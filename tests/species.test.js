import test from "node:test";
import assert from "node:assert/strict";
import {
  stats,
  emptyData,
  emptyBandStatus,
  loadData,
  startGame,
} from "../src/model.js";
import { speciesGroups, speciesPresets, presetValues } from "../src/species.js";
// Page-by-page reference in printed M/S/B/R/N/C/A/F/P column order.
const reference = [
  {
    names:
      "ネズミ/ヤマネ|トガリネズミ|鳥(S)|ノクチュール蝙蝠|クシイモリ|トガリネズミの放浪騎士|ミストガスト(small/midium)|追跡幼虫|攻撃幼虫|減衰幼虫",
    values: [
      [6, 6, 4, 6, 6, 6, 6, 6, 6],
      [6, 6, 6, 6, 6, 6, 6, 8, 6],
      [6, 6, 6, 6, 6, 6, 6, 4, 4],
      [4, 6, 4, 4, 6, 6, 6, 6, 6],
      [6, 6, 6, 6, 6, 6, 6, 6, 6],
      [8, 6, 6, 4, 6, 4, 8, 10, 8],
      [6, 8, 6, 6, 8, 6, 10, 6, 6],
      [6, 6, 6, 4, 6, 8, 6, 6, 6],
      [6, 6, 6, 4, 6, 8, 6, 6, 6],
      [6, 6, 6, 4, 6, 8, 6, 6, 6],
    ],
    skills: [
      [],
      [],
      ["飛行"],
      ["飛行", "拳闘士", "生来の狩人", "天賦", "デリケート(2)", "暗視"],
      ["水泳"],
      ["戦闘騎獣", "大胆不敵"],
      ["異界の存在", "不気味"],
      ["執拗な追跡者", "拳闘士", "腕無し"],
      ["ストロング(1)", "拳闘士", "腕無し"],
      ["魔法耐性", "拳闘士", "腕無し"],
    ],
  },
  {
    names:
      "ハリネズミ|リス|モグラ|イタチ/オコジョ|黒ドブネズミ|フェレット/ケナガイタチ|猫|ウサギ|ヒキガエル|カエル|毒ヘビ|マーモット|水ネズミ|鳥(M)|猛禽(M)|猟犬(M)|緑トカゲ(レア)|シャム猫(レア)|亀(レア)|カモノハシ(レア)",
    values: [
      [6, 6, 6, 6, 6, 6, 6, 6, 8],
      [6, 6, 6, 6, 8, 8, 8, 8, 6],
      [4, 6, 6, 4, 6, 6, 4, 8, 6],
      [8, 8, 6, 6, 8, 6, 6, 6, 6],
      [6, 8, 6, 6, 6, 8, 6, 6, 6],
      [8, 8, 6, 6, 8, 6, 8, 8, 8],
      [6, 8, 6, 6, 8, 6, 6, 6, 8],
      [8, 6, 6, 6, 6, 6, 6, 6, 6],
      [6, 6, 6, 4, 6, 10, 6, 8, 8],
      [6, 6, 6, 6, 6, 6, 6, 6, 6],
      [6, 8, 4, 4, 4, 8, 8, 8, 8],
      [6, 6, 6, 6, 6, 4, 6, 6, 6],
      [8, 6, 6, 6, 8, 6, 6, 8, 6],
      [6, 6, 6, 6, 8, 6, 6, 6, 6],
      [6, 8, 6, 4, 8, 6, 8, 6, 6],
      [6, 8, 6, 6, 6, 4, 6, 6, 6],
      [6, 6, 4, 6, 6, 8, 6, 6, 6],
      [6, 8, 6, 6, 6, 6, 6, 8, 8],
      [4, 8, 6, 6, 6, 6, 6, 6, 6],
      [6, 6, 4, 6, 6, 6, 6, 6, 6],
    ],
    skills: [
      ["棘"],
      ["登攀"],
      ["ストロング(1)", "坑道掘り", "近眼"],
      ["大胆不敵"],
      [],
      ["大胆不敵"],
      [],
      [],
      ["ストロング(1)", "タフ(2)", "生来の狩人"],
      ["跳躍", "水泳"],
      ["毒", "拳闘士", "腕無し"],
      [],
      ["水泳"],
      ["飛行"],
      ["飛行", "拳闘士", "ストロング(1)", "生来の狩人"],
      ["ストロング(1)"],
      [],
      [],
      ["タフ(2)"],
      ["水泳"],
    ],
  },
  {
    names:
      "野兎|山猫|茶色ドブネズミ|狐|カワウソ|鳥(L)|猛禽(L)|猟犬(L)|アライグマ(レア)|アルマジロ(レア)|フェネック(レア)|ミストガスト(L)",
    values: [
      [8, 10, 8, 6, 6, 6, 6, 8, 8],
      [8, 10, 6, 4, 8, 8, 8, 8, 8],
      [8, 8, 6, 6, 6, 6, 6, 6, 8],
      [8, 8, 6, 8, 6, 6, 6, 6, 8],
      [8, 8, 6, 8, 8, 6, 6, 8, 8],
      [6, 6, 6, 6, 8, 4, 6, 8, 6],
      [6, 8, 6, 4, 8, 4, 8, 8, 8],
      [6, 8, 6, 6, 6, 4, 6, 6, 8],
      [6, 8, 6, 6, 6, 6, 6, 8, 8],
      [8, 8, 6, 6, 8, 6, 6, 8, 8],
      [6, 8, 6, 6, 8, 6, 8, 6, 6],
      [6, 8, 8, 6, 8, 6, 10, 6, 8],
    ],
    skills: [
      ["跳躍", "ストロング(1)"],
      ["ストロング(2)", "タフ(1)", "恐ろしい", "生来の狩人"],
      ["ストロング(1)"],
      ["ストロング(1)"],
      ["ストロング(1)", "水泳"],
      ["飛行"],
      ["飛行", "ストロング(2)", "拳闘士", "生来の狩人"],
      ["ストロング(2)", "タフ(1)"],
      ["ストロング(1)"],
      ["ストロング(1)", "タフ(3)", "跳躍"],
      ["執拗な追跡者"],
      ["ストロング(2)", "異界の存在", "不気味"],
    ],
  },
  {
    names:
      "穴熊|ビーバー|鳥(Massive)|猛禽(Massive)|猟犬(Massive)|ミストガスト(Massive)",
    values: [
      [8, 8, 6, 6, 6, 4, 6, 8, 10],
      [6, 8, 6, 6, 4, 4, 6, 10, 8],
      [6, 8, 6, 6, 6, 4, 6, 8, 8],
      [6, 10, 6, 4, 6, 4, 8, 10, 10],
      [8, 10, 6, 4, 6, 6, 6, 8, 8],
      [8, 10, 8, 6, 8, 6, 10, 8, 10],
    ],
    skills: [
      ["ストロング(3)", "タフ(2)", "恐ろしい"],
      ["ストロング(2)", "タフ(3)", "水泳"],
      ["飛行"],
      ["飛行", "ストロング(3)", "拳闘士", "生来の狩人"],
      ["ストロング(3)", "タフ(2)", "生来の狩人"],
      ["ストロング(4)", "異界の存在", "不気味"],
    ],
  },
];
assert.equal(speciesPresets.length, 48);
assert.equal(new Set(speciesPresets.map((p) => p.id)).size, 48);
for (const [i, g] of speciesGroups.entries())
  test(`p.${43 + i} ${g.name}: 全種族の名前・9能力値・レベル・初期スキル`, () => {
    const presets = speciesPresets.filter((p) => p.group === g.id),
      r = reference[i];
    assert.equal(g.base, [30, 30, 40, 50][i]);
    assert.deepEqual(
      presets.map((p) => p.name),
      r.names.split("|"),
    );
    for (const [j, p] of presets.entries()) {
      assert.equal(p.level, i + 1);
      assert.equal(p.page, 43 + i);
      assert.deepEqual(
        stats.map((s) => p.stats[s]),
        r.values[j].map((v) => "D" + v),
        p.name,
      );
      assert.deepEqual(p.skills, r.skills[j], p.name);
      assert.equal(Object.hasOwn(p, "fee"), false);
      const values = presetValues(p.id);
      assert.deepEqual(values.stats, p.stats);
      assert.deepEqual(values.skillEntries, p.skills);
      values.stats.Movement = "D20";
      values.skillEntries.push("手動");
      assert.notEqual(p.stats.Movement, "D20");
      assert.ok(!p.skills.includes("手動"));
    }
  });
test("全プリセットのJSON往復、成長値とゲームの独立性", () => {
  for (const p of speciesPresets) {
    const d = emptyData(),
      v = presetValues(p.id),
      c = {
        id: "c",
        name: p.name,
        ...v,
        photo: "",
        fate: 2,
        experience: 3,
        equipment: "",
        skills: "",
        spells: "",
        notes: "",
      };
    d.warbands.push({
      id: "w",
      name: "森",
      status: emptyBandStatus(),
      characters: [c],
    });
    d.game = startGame(d.warbands[0]);
    c.level = 9;
    c.stats.Movement = "D20";
    c.skillEntries.push("成長スキル");
    const loaded = loadData(JSON.parse(JSON.stringify(d)));
    assert.deepEqual(loaded, d);
    assert.equal(loaded.warbands[0].characters[0].stats.Movement, "D20");
    assert.equal(loaded.game.characters[0].level, p.level);
  }
  assert.throws(() => presetValues("unknown"));
});
