export const equipmentCategoryLabels = {
  weapon: "武器",
  armour: "鎧・盾",
  item: "一般アイテム",
  ingredient: "呪文材料",
  bonded_critter: "絆の生き物",
  stag_beetle_grub: "クワガタの幼虫",
};
export function parseEquipmentCatalog(data) {
  if (!data || !Array.isArray(data.items)) throw Error("装備データが不正です");
  const ids = new Set();
  return data.items.map((item) => {
    if (
      !item ||
      typeof item.id !== "string" ||
      !/^[A-Za-z0-9_-]+$/.test(item.id) ||
      ids.has(item.id) ||
      !Object.hasOwn(equipmentCategoryLabels, item.category) ||
      !["nameJa", "nameEn"].every(
        (k) => typeof item[k] === "string" && item[k],
      ) ||
      !(item.range === null || typeof item.range === "string") ||
      !Array.isArray(item.notesJa) ||
      !item.notesJa.every((x) => typeof x === "string") ||
      (item.reviewRequired !== undefined &&
        typeof item.reviewRequired !== "string")
    )
      throw Error("装備データが不正です");
    ids.add(item.id);
    return {
      id: item.id,
      category: item.category,
      nameJa: item.nameJa,
      nameEn: item.nameEn,
      range: item.range,
      notesJa: [...item.notesJa],
      ...(item.reviewRequired ? { reviewRequired: item.reviewRequired } : {}),
    };
  });
}
let catalogPromise;
export function loadEquipmentCatalog() {
  if (!catalogPromise)
    catalogPromise = fetch(
      new URL("../data/bb2_general_store_ja_en.json", import.meta.url),
    )
      .then((r) => {
        if (!r.ok) throw Error("装備データを取得できません");
        return r.json();
      })
      .then(parseEquipmentCatalog)
      .catch((e) => {
        catalogPromise = undefined;
        throw e;
      });
  return catalogPromise;
}
export function normalizeEquipmentSearch(value) {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑–—−]/g, "-")
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/\s/g, "");
}
export function equipmentAllowedInSlot(item,slot) {
  if (slot === "weapon1" || slot === "weapon2") return item.category === "weapon";
  if (slot === "armour1" || slot === "armour2") return item.category === "armour";
  if (slot === "item") return item.category !== "weapon" && item.category !== "armour";
  return true;
}
export function searchEquipment(
  items,
  { query = "", category = "", slot = "", recent = [] } = {},
) {
  const tokens = String(query)
    .normalize("NFKC")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeEquipmentSearch);
  const preferred = slot.startsWith("weapon")
    ? "weapon"
    : slot.startsWith("armour")
      ? "armour"
      : slot === "item"
        ? "item"
        : "";
  const fixedSlot = ["weapon1", "weapon2", "armour1", "armour2", "item"].includes(slot);
  return items
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        equipmentAllowedInSlot(item, slot) &&
        (fixedSlot || !category || item.category === category) &&
        tokens.every((token) =>
          normalizeEquipmentSearch(item.nameJa + " " + item.nameEn).includes(
            token,
          ),
        ),
    )
    .sort((a, b) => {
      const ra = recent.indexOf(a.item.id),
        rb = recent.indexOf(b.item.id),
        ar = ra < 0 ? Infinity : ra,
        br = rb < 0 ? Infinity : rb;
      return (
        (ar === br ? 0 : ar < br ? -1 : 1) ||
        Number(b.item.category === preferred) -
          Number(a.item.category === preferred) ||
        a.index - b.index
      );
    })
    .map(({ item }) => item);
}
export const equipmentDisplayName = (item) =>
  item.nameJa + (item.range ? `（${item.range}）` : "");
