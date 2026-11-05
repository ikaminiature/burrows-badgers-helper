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
export const emptyData = () => ({ version: 1, warbands: [], game: null });
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
    round: 1,
    characters: structuredClone(w.characters).map((c) => ({
      ...c,
      wounds: 0,
      acted: false,
      effects: [],
    })),
  };
}
export function nextRound(g) {
  g.round++;
  for (const c of g.characters) c.acted = c.wounds === 17;
}
export function validateData(d) {
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.warbands)
  )
    throw Error("対応していないバックアップ形式です");
  const ids = new Set();
  const validId = (v) =>
    typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v);
  const str = (v, max = 20000) => typeof v === "string" && v.length <= max;
  const character = (c) => {
    if (
      !c ||
      !validId(c.id) ||
      !str(c.name, 200) ||
      !c.name.trim() ||
      !str(c.species, 200) ||
      !Number.isInteger(c.level) ||
      c.level < 0 ||
      c.level > 100 ||
      !c.stats ||
      !stats.every((s) => dice.includes(c.stats[s])) ||
      !["equipment", "skills", "spells", "notes"].every((k) => str(c[k])) ||
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
    ids.add(w.id);
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
      !Array.isArray(g.characters)
    )
      throw Error("ゲームデータが不正です");
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
