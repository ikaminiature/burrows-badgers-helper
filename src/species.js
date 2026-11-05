import { stats } from "./model.js";
export const speciesGroups = [
  { id: "small", name: "Small Beasts", base: 30, level: 1, page: 43 },
  { id: "medium", name: "Medium Beasts", base: 30, level: 2, page: 44 },
  { id: "large", name: "Large Beasts", base: 40, level: 3, page: 45 },
  { id: "massive", name: "Massive Beasts", base: 50, level: 4, page: 46 },
];
// User-supplied pp.43–46. Columns M S B R N C A F P. Fee is not stored.
// Source's "midium" is retained; visual line wraps are joined.
const tables = [
  `ネズミ/ヤマネ|6 6 4 6 6 6 6 6 6|
トガリネズミ|6 6 6 6 6 6 6 8 6|
鳥(S)|6 6 6 6 6 6 6 4 4|飛行
ノクチュール蝙蝠|4 6 4 4 6 6 6 6 6|飛行,拳闘士,生来の狩人,天賦,デリケート(2),暗視
クシイモリ|6 6 6 6 6 6 6 6 6|水泳
トガリネズミの放浪騎士|8 6 6 4 6 4 8 10 8|戦闘騎獣,大胆不敵
ミストガスト(small/midium)|6 8 6 6 8 6 10 6 6|異界の存在,不気味
追跡幼虫|6 6 6 4 6 8 6 6 6|執拗な追跡者,拳闘士,腕無し
攻撃幼虫|6 6 6 4 6 8 6 6 6|ストロング(1),拳闘士,腕無し
減衰幼虫|6 6 6 4 6 8 6 6 6|魔法耐性,拳闘士,腕無し`,
  `ハリネズミ|6 6 6 6 6 6 6 6 8|棘
リス|6 6 6 6 8 8 8 8 6|登攀
モグラ|4 6 6 4 6 6 4 8 6|ストロング(1),坑道掘り,近眼
イタチ/オコジョ|8 8 6 6 8 6 6 6 6|大胆不敵
黒ドブネズミ|6 8 6 6 6 8 6 6 6|
フェレット/ケナガイタチ|8 8 6 6 8 6 8 8 8|大胆不敵
猫|6 8 6 6 8 6 6 6 8|
ウサギ|8 6 6 6 6 6 6 6 6|
ヒキガエル|6 6 6 4 6 10 6 8 8|ストロング(1),タフ(2),生来の狩人
カエル|6 6 6 6 6 6 6 6 6|跳躍,水泳
毒ヘビ|6 8 4 4 4 8 8 8 8|毒,拳闘士,腕無し
マーモット|6 6 6 6 6 4 6 6 6|
水ネズミ|8 6 6 6 8 6 6 8 6|水泳
鳥(M)|6 6 6 6 8 6 6 6 6|飛行
猛禽(M)|6 8 6 4 8 6 8 6 6|飛行,拳闘士,ストロング(1),生来の狩人
猟犬(M)|6 8 6 6 6 4 6 6 6|ストロング(1)
緑トカゲ(レア)|6 6 4 6 6 8 6 6 6|
シャム猫(レア)|6 8 6 6 6 6 6 8 8|
亀(レア)|4 8 6 6 6 6 6 6 6|タフ(2)
カモノハシ(レア)|6 6 4 6 6 6 6 6 6|水泳`,
  `野兎|8 10 8 6 6 6 6 8 8|跳躍,ストロング(1)
山猫|8 10 6 4 8 8 8 8 8|ストロング(2),タフ(1),恐ろしい,生来の狩人
茶色ドブネズミ|8 8 6 6 6 6 6 6 8|ストロング(1)
狐|8 8 6 8 6 6 6 6 8|ストロング(1)
カワウソ|8 8 6 8 8 6 6 8 8|ストロング(1),水泳
鳥(L)|6 6 6 6 8 4 6 8 6|飛行
猛禽(L)|6 8 6 4 8 4 8 8 8|飛行,ストロング(2),拳闘士,生来の狩人
猟犬(L)|6 8 6 6 6 4 6 6 8|ストロング(2),タフ(1)
アライグマ(レア)|6 8 6 6 6 6 6 8 8|ストロング(1)
アルマジロ(レア)|8 8 6 6 8 6 6 8 8|ストロング(1),タフ(3),跳躍
フェネック(レア)|6 8 6 6 8 6 8 6 6|執拗な追跡者
ミストガスト(L)|6 8 8 6 8 6 10 6 8|ストロング(2),異界の存在,不気味`,
  `穴熊|8 8 6 6 6 4 6 8 10|ストロング(3),タフ(2),恐ろしい
ビーバー|6 8 6 6 4 4 6 10 8|ストロング(2),タフ(3),水泳
鳥(Massive)|6 8 6 6 6 4 6 8 8|飛行
猛禽(Massive)|6 10 6 4 6 4 8 10 10|飛行,ストロング(3),拳闘士,生来の狩人
猟犬(Massive)|8 10 6 4 6 6 6 8 8|ストロング(3),タフ(2),生来の狩人
ミストガスト(Massive)|8 10 8 6 8 6 10 8 10|ストロング(4),異界の存在,不気味`,
];
export const speciesPresets = tables.flatMap((table, index) =>
  table.split("\n").map((line, row) => {
    const [name, values, skills] = line.split("|");
    return {
      id: `${speciesGroups[index].id}-${String(row + 1).padStart(2, "0")}`,
      name,
      group: speciesGroups[index].id,
      page: speciesGroups[index].page,
      level: speciesGroups[index].level,
      stats: Object.fromEntries(
        values.split(" ").map((n, i) => [stats[i], `D${n}`]),
      ),
      skills: skills ? skills.split(",") : [],
    };
  }),
);
export function presetValues(id) {
  const p = speciesPresets.find((p) => p.id === id);
  if (!p) throw Error("種族が見つかりません");
  return {
    species: p.name,
    speciesPresetId: p.id,
    level: p.level,
    stats: structuredClone(p.stats),
    skillEntries: structuredClone(p.skills),
  };
}
