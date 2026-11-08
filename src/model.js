import { conditions } from "./conditions.js";
export const stats = [
  "Movement",
  "Strike",
  "Block",
  "Ranged",
  "Nimbleness",
  "Concealment",
  "Awareness",
  "Fortitude",
  "Presence",
];
export const dice = ["D4", "D6", "D8", "D10", "D12", "D20"];
export const emptyData = () => ({ version: 2, warbands: [], game: null });
export const characterRoles = {
  none: "なし",
  leader: "リーダー",
  second: "サブ",
};
export const characterRole = (c) => c?.role ?? "none";
export function conflictingRoles(w, c) {
  return characterRole(c) === "none"
    ? []
    : w.characters.filter(
        (other) =>
          other.id !== c.id && characterRole(other) === characterRole(c),
      );
}
export function putCharacter(w, c, transfer = false) {
  if (
    (c.role !== undefined && !Object.hasOwn(characterRoles, c.role)) ||
    !Object.hasOwn(characterRoles, characterRole(c))
  )
    throw Error("役職が不正です");
  const conflicts = conflictingRoles(w, c);
  if (conflicts.length && !transfer)
    throw Error("役職の重複を確認してください");
  for (const other of conflicts) other.role = "none";
  const index = w.characters.findIndex((other) => other.id === c.id);
  if (index < 0) w.characters.push(c);
  else w.characters[index] = c;
}
export const equipmentCategories = {
  weapon1: "武器1",
  weapon2: "武器2",
  armour1: "鎧1",
  armour2: "鎧2",
  item: "アイテム",
  special: "スペシャル",
};
// Preserve original free text. Only line breaks are safe item separators.
export function characterInventory(c = {}) {
  const lines = (value) =>
    (value || "").split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  return {
    equipmentSlots: structuredClone(
      c.equipmentSlots ||
        Object.fromEntries(
          Object.keys(equipmentCategories).map((k) => [k, ""]),
        ),
    ),
    skillEntries: structuredClone(c.skillEntries || lines(c.skills)),
    spellEntries: structuredClone(c.spellEntries || lines(c.spells)),
  };
}
export const alliances = {
  王党派: "戦士",
  ならず者: "レンジャー",
  フリービースト: "万能型",
  キンドレッド: "レンジャー",
  ウィッチハンター: "民間呪術師",
  ワイルドリング: "万能型",
  "アーケイン・コンクラーベ": "民間呪術師",
  アンデッド: "民間呪術師",
  傭兵団: "戦士",
  ヒルフォーク: "万能型",
};
export function selectAlliance(status, name) {
  if (!Object.hasOwn(alliances, name))
    throw Error("選択肢にないアライアンスです");
  status.alliance = name;
  status.archetype = alliances[name];
}
export const bandNumbers = {
  rating: "レーティング",
  pension: "年金",
  labour: "労働力",
  materials: "資材",
  treasury: "トレジャリー",
};
export const bandTexts = {
  alliance: "アライアンス",
  archetype: "アーキタイプ",
  notes: "メモ",
};
export const bandLists = {
  stash: "隠しておいた装備",
  upgrades: "アジト・アップグレード",
};
export const emptyBandStatus = () => ({
  ...Object.fromEntries(Object.keys(bandNumbers).map((k) => [k, 0])),
  alliance: "",
  archetype: "",
  notes: "",
  stash: [],
  upgrades: [],
});
// Migrate a copy, preserving characters/photos and existing battle values.
export function loadData(input) {
  const d = structuredClone(input);
  if (!d || ![1, 2].includes(d.version) || !Array.isArray(d.warbands))
    throw Error("対応していないバックアップ形式です");
  if (d.version === 1) {
    for (const w of d.warbands)
      if (w && w.status === undefined) w.status = emptyBandStatus();
    d.version = 2;
  }
  for (const w of d.warbands)
    for (const c of w.characters || []) {
      if (c.fate === undefined) c.fate = 0;
      if (c.experience === undefined) c.experience = 0;
    }
  if (d.game && typeof d.game === "object" && !Array.isArray(d.game)) {
    if (d.game.vp === undefined) d.game.vp = 0;
    if (d.game.sideQuests === undefined) d.game.sideQuests = ["", ""];
  }
  return validateData(d);
}
export const id = () => crypto.randomUUID();
export function penalty(w) {
  return w === 17
    ? "戦闘不能"
    : w < 4
      ? "0"
      : String(-Math.min(4, Math.floor((w - 1) / 3)));
}
export function wound(c, delta) {
  c.wounds = Math.max(0, Math.min(17, c.wounds + delta));
  if (c.wounds === 17) c.acted = true;
}
export function sorted(characters) {
  return characters
    .map((c, i) => ({ c, i }))
    .sort((a, b) => group(a.c) - group(b.c) || a.i - b.i)
    .map((x) => x.c);
}
const group = (c) => (c.wounds === 17 ? 2 : c.acted ? 1 : 0);
export function startGame(w) {
  return {
    id: id(),
    name: w.name,
    status: structuredClone(w.status || emptyBandStatus()),
    round: 1,
    vp: 0,
    sideQuests: ["", ""],
    sideQuestSelections: [null, null],
    characters: structuredClone(w.characters).map((c) => ({
      ...c,
      wounds: 0,
      acted: false,
      effects: [],
    })),
  };
}
export function adjustVP(g, delta) {
  if (!Number.isSafeInteger(delta)) throw Error("VPの変更値が不正です");
  g.vp = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, (g.vp ?? 0) + delta));
}
export function nextRound(g) {
  g.round++;
  for (const c of g.characters) c.acted = c.wounds === 17;
}
export function validateData(d) {
  if (!d || d.version !== 2 || !Array.isArray(d.warbands))
    throw Error("対応していないバックアップ形式です");
  if (
    d.recentEquipmentIds !== undefined &&
    (!Array.isArray(d.recentEquipmentIds) ||
      !d.recentEquipmentIds.every(
        (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v),
      ))
  )
    throw Error("最近の装備データが不正です");
  const ids = new Set();
  const validId = (v) =>
    typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v);
  const str = (v, max = 20000) => typeof v === "string" && v.length <= max;
  const checkStatus = (s) => {
    if (
      !s ||
      !Object.keys(bandNumbers).every(
        (k) => typeof s[k] === "number" && Number.isFinite(s[k]),
      ) ||
      !Object.keys(bandTexts).every((k) => str(s[k])) ||
      (s.denUpgrades !== undefined &&
        (!Array.isArray(s.denUpgrades) || new Set(s.denUpgrades.map(v=>v?.id)).size !== s.denUpgrades.length ||
          !s.denUpgrades.every(v=>v && str(v.id,200) && v.id.length>0 &&
            (v.choice===null || (str(v.choice,200) && v.choice.length>0))))) ||
      !Object.keys(bandLists).every((k) => {
        if (!Array.isArray(s[k])) return false;
        const seen = new Set();
        return s[k].every((e) => {
          if (!e || !validId(e.id) || seen.has(e.id) || !str(e.name))
            return false;
          seen.add(e.id);
          return true;
        });
      })
    )
      throw Error("ウォーバンドステータスが不正です");
  };
  const character = (c) => {
    if (
      !c ||
      !validId(c.id) ||
      !str(c.name, 200) ||
      !c.name.trim() ||
      !str(c.species, 200) ||
      (c.role !== undefined && !Object.hasOwn(characterRoles, c.role)) ||
      (c.speciesPresetId !== undefined && !validId(c.speciesPresetId)) ||
      !Number.isInteger(c.level) ||
      c.level < 0 ||
      c.level > 100 ||
      !["fate", "experience"].every(
        (k) =>
          c[k] === undefined ||
          (Number.isInteger(c[k]) && c[k] >= 0 && c[k] <= 5),
      ) ||
      !c.stats ||
      !stats.every((s) => dice.includes(c.stats[s])) ||
      !["equipment", "skills", "spells", "notes"].every((k) => str(c[k])) ||
      (c.equipmentSelections !== undefined &&
        (!c.equipmentSelections ||
          typeof c.equipmentSelections !== "object" ||
          Array.isArray(c.equipmentSelections) ||
          !Object.entries(c.equipmentSelections).every(
            ([key, item]) =>
              Object.hasOwn(equipmentCategories, key) &&
              item &&
              validId(item.id) &&
              str(item.nameJa) &&
              str(item.nameEn) &&
              [
                "weapon",
                "armour",
                "item",
                "ingredient",
                "bonded_critter",
                "stag_beetle_grub",
              ].includes(item.category) &&
              (item.range === null || str(item.range)) &&
              Array.isArray(item.notesJa) &&
              item.notesJa.every((v) => str(v)) &&
              (item.reviewRequired === undefined || str(item.reviewRequired)),
          ))) ||
      (c.equipmentSlots !== undefined &&
        (!c.equipmentSlots ||
          !Object.keys(equipmentCategories).every((k) =>
            str(c.equipmentSlots[k]),
          ) ||
          Object.keys(c.equipmentSlots).some(
            (k) => !Object.hasOwn(equipmentCategories, k),
          ))) ||
      (c.equipmentMagic !== undefined &&
        (!c.equipmentMagic || typeof c.equipmentMagic !== "object" || Array.isArray(c.equipmentMagic) ||
          !Object.entries(c.equipmentMagic).every(([key, value]) =>
            Object.hasOwn(equipmentCategories, key) && value && str(value.notes) &&
            Array.isArray(value.effects) && value.effects.every(effect =>
              effect && str(effect.id, 200) && effect.id.length > 0 &&
              (effect.bonus === null || (Number.isSafeInteger(effect.bonus) && effect.bonus >= 0)))))) ||
      (c.spellSelections !== undefined &&
        (!Array.isArray(c.spellSelections) || !Array.isArray(c.spellEntries) ||
          c.spellSelections.length !== c.spellEntries.length ||
          !c.spellSelections.every(v => v === null ||
            (v && str(v.id, 200) && v.id.length > 0)))) ||
      (c.skillSelections !== undefined &&
        (!Array.isArray(c.skillSelections) ||
          !Array.isArray(c.skillEntries) ||
          c.skillSelections.length !== c.skillEntries.length ||
          !c.skillSelections.every(v => v === null ||
            (v && str(v.id, 200) && (v.value === null ||
              (Number.isSafeInteger(v.value) && v.value >= 0)))))) ||
      !["skillEntries", "spellEntries"].every(
        (k) =>
          c[k] === undefined ||
          (Array.isArray(c[k]) && c[k].every((v) => str(v))),
      ) ||
      !str(c.photo, 2000000) ||
      (c.photo &&
        !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(c.photo))
    )
      throw Error("キャラクターデータが不正です");
  };
  for (const w of d.warbands) {
    if (
      !w ||
      !validId(w.id) ||
      ids.has(w.id) ||
      !str(w.name, 200) ||
      !w.name.trim() ||
      !Array.isArray(w.characters)
    )
      throw Error("ウォーバンドデータが不正です");
    checkStatus(w.status);
    ids.add(w.id);
    for (const role of ["leader", "second"])
      if (w.characters.filter((c) => c?.role === role).length > 1)
        throw Error("役職が重複しています。バックアップを確認してください");
    const cs = new Set();
    for (const c of w.characters) {
      character(c);
      if (cs.has(c.id)) throw Error("ID が重複しています");
      cs.add(c.id);
    }
  }
  if (d.game !== null) {
    const g = d.game;
    if (
      !g ||
      !validId(g.id) ||
      !str(g.name, 200) ||
      !Number.isInteger(g.round) ||
      g.round < 1 ||
      (g.vp !== undefined && (!Number.isSafeInteger(g.vp) || g.vp < 0)) ||
      (g.sideQuests !== undefined && (!Array.isArray(g.sideQuests) ||
        g.sideQuests.length !== 2 || !g.sideQuests.every(v => str(v)))) ||
      (g.sideQuestSelections !== undefined &&
        (!Array.isArray(g.sideQuestSelections) || g.sideQuestSelections.length !== 2 ||
          !g.sideQuestSelections.every(v => v === null ||
            (v && str(v.id,200) && v.id.length > 0 &&
              (v.wildCardChoice === null || (str(v.wildCardChoice,200) && v.wildCardChoice.length > 0)))))) ||
      !Array.isArray(g.characters)
    )
      throw Error("ゲームデータが不正です");
    if (g.status !== undefined) checkStatus(g.status);
    const cs = new Set();
    for (const c of g.characters) {
      character(c);
      if (cs.has(c.id)) throw Error("ID が重複しています");
      cs.add(c.id);
      if (
        !Number.isInteger(c.wounds) ||
        c.wounds < 0 ||
        c.wounds > 17 ||
        typeof c.acted !== "boolean" ||
        (c.wounds === 17 && !c.acted) ||
        (c.conditions !== undefined &&
          (!Array.isArray(c.conditions) || new Set(c.conditions).size !== c.conditions.length ||
            !c.conditions.every(id => conditions.some(v => v.id === id)))) ||
        !Array.isArray(c.effects) ||
        !c.effects.every(
          (e) =>
            e &&
            validId(e.id) &&
            str(e.name, 200) &&
            e.name.trim() &&
            str(e.description),
        )
      )
        throw Error("戦闘データが不正です");
    }
  }
  return d;
}
