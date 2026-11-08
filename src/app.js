import { setCharacterNotes } from "./notes.js";
import { createCharacterPanel } from "./character-panel.js";
import { denUpgradePicker, denUpgradeList } from "./den-upgrade-view.js";
import { denUpgradeById, selectDenUpgrade, chooseDenEffect } from "./den-upgrades.js";
import { questSlotHtml, selectQuest, selectWildQuest } from "./side-quest-view.js";
import { conditions, setCondition, hasConditions } from "./conditions.js";
import { spells, spellArchetypes, elementalSpecialisms, searchSpells, matchSpell } from "./spells.js";
import { spellDetails } from "./spell-view.js";
import { deriveAbilitySources, abilitySourcesHtml } from "./ability-sources.js";
import { specialMagicItems, magicEffects, magicEffect } from "./equipment-rules.js";
import { equipmentDetails, magicDetails, magicReferenceLibrary } from "./equipment-view.js";
import { skills, skillCategories, searchSkills, matchSkill, skillName } from "./skills.js";
import {
  stats,
  dice,
  emptyData,
  id,
  wound,
  sorted,
  startGame,
  nextRound,
  adjustVP,
  loadData,
  emptyBandStatus,
  bandNumbers,
  bandTexts,
  bandLists,
  characterRoles,
  characterRole,
  conflictingRoles,
  putCharacter,
  equipmentCategories,
  characterInventory,
  alliances,
  selectAlliance,
} from "./model.js";
import { read, write } from "./db.js";
import { createUpdater } from "./update.js";
import { speciesGroups, speciesPresets, presetValues } from "./species.js";
import {
  loadEquipmentCatalog,
  searchEquipment,
  equipmentCategoryLabels,
  equipmentDisplayName,
} from "./equipment.js";
const app = document.querySelector("#app"),
  modal = document.querySelector("#modal"),
  status = document.querySelector("#save-status");
let data,
  screen = "home",
  bandId,
  saveQueue = Promise.resolve(),
  failed = false,
  pending = 0;
let rosterEditMode = false;
function resetRosterView() {
  rosterEditMode = false;
}
let restoreQueue = Promise.resolve(),
  updateBusy = false;
const updater = createUpdater({
  beforeReload: async () => {
    await saveQueue;
    await restoreQueue;
    await saveQueue;
    if (pending || failed || !data) throw Error("unsaved");
  },
  busy: (active) => {
    updateBusy = active;
    if (active)
      show(
        "<h2>更新しています…</h2><p>保存完了を待っています。この画面を閉じずにお待ちください。</p>",
      );
    else if (modal.open) modal.close();
  },
});
modal.addEventListener("cancel", (e) => {
  if (updateBusy) e.preventDefault();
});
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const btn = (text, action, extra = "") =>
  `<button type="button" data-action="${action}" ${extra}>${text}</button>`;
const portrait = (c) =>
  c.photo
    ? `<img class="portrait" src="${esc(c.photo)}" alt="${esc(c.name)}の写真">`
    : '<span class="portrait" aria-hidden="true">♟</span>';
const band = () => data.warbands.find((w) => w.id === bandId);
function save() {
  pending++;
  status.textContent = "保存中…";
  const snapshot = structuredClone(data);
  saveQueue = saveQueue
    .catch(() => {})
    .then(() => write(snapshot))
    .then(() => {
      pending--;
      failed = false;
      status.textContent = pending ? "保存中…" : "端末に保存済み";
    })
    .catch(() => {
      pending--;
      failed = true;
      status.textContent = "保存失敗・バックアップしてください";
    });
  return saveQueue;
}
function change(fn) {
  fn();
  save();
  render();
}
function show(html, { focusHeading = false } = {}) {
  modal.innerHTML = html;
  // Give the character heading native dialog autofocus before showModal runs.
  // Focusing an input and then blurring it can still open the iOS keyboard.
  const heading = (focusHeading || modal.querySelector("#character-form")) ? modal.querySelector("h2") : null;
  if (heading) {
    heading.tabIndex = -1;
    heading.setAttribute("autofocus", "");
  }
  if (!modal.open) modal.showModal();
  (heading || modal.querySelector("input,button"))?.focus({ preventScroll: true });
}
function confirmAction(title, message, action) {
  show(
    `<h2>${title}</h2><p>${message}</p><div class="actions">${btn("キャンセル", "close")}${btn("確認して実行", "confirm", 'class="danger"')}</div>`,
  );
  modal.querySelector("[data-action=confirm]").onclick = () => {
    modal.close();
    action();
  };
}
function navigate() {
  const route = location.hash.slice(1) || "home";
  if (route !== screen) {
    resetRosterView();
    if (route === "bands") bandId = undefined;
  }
  screen = ["home", "bands", "battle", "choose"].includes(route)
    ? route
    : "home";
  render();
}
function render() {
  if (!data) return;
  const editing = screen === "bands" && !!band() && rosterEditMode;
  document.querySelector("header").classList.toggle("roster-edit-header", editing);
  document.documentElement.classList.toggle("roster-editing", editing);
  document.querySelector("#editing-indicator").hidden = !editing;
  document
    .querySelectorAll("nav a")
    .forEach((a) =>
      a.setAttribute(
        "aria-current",
        a.hash === `#${screen}` || (screen === "choose" && a.hash === "#home")
          ? "page"
          : "false",
      ),
    );
  if (screen === "home")
    app.innerHTML = `<div class="hero"><div class="eyebrow">BURROWS & BADGERS · 2ND EDITION</div><h1>小さな戦士たちの、<br>次の冒険へ。</h1><p>ウォーバンドを整えて、卓上の戦いに集中。</p><div class="stack"><a class="button primary" href="#choose">ゲームを開始</a>${data.game ? `<a class="button" href="#battle">${esc(data.game.name)} · ラウンド ${data.game.round} を再開</a>` : ""}</div></div>${updater.html()}<h2>冒険の準備</h2><a class="button" href="#bands">ウォーバンドを管理（${data.warbands.length}）</a><section class="card"><h2>データのバックアップ</h2><p class="muted">データと写真はこの端末・ブラウザ内に保存されます。定期的に写真を含む JSON を保管してください。</p><div class="actions">${btn("JSON を書き出す", "export")}${btn("JSON から復元", "import")}</div><input id="restore-file" type="file" accept="application/json,.json" hidden></section><details class="card"><summary>オフラインで使う・ホーム画面に追加</summary><p>一度オンラインで開き、読み込みを終えてから使ってください。iPhone は Safari の共有メニューから「ホーム画面に追加」を選びます。</p><p class="muted">非公式の補助ツールです。ルールの自動判定は負傷管理のみ。ブラウザのデータ削除で保存内容が消えるため、バックアップを推奨します。</p></details>`;
  if (screen === "bands")
    app.innerHTML = band()
      ? bandView(band())
      : `<div class="eyebrow">WARBANDS</div><h1>ウォーバンド管理</h1>${btn("＋ ウォーバンドを登録", "new-band", 'class="primary"')}${
          data.warbands
            .map((w) => {
              const leader = w.characters.find(
                (c) => characterRole(c) === "leader",
              );
              return `<section class="card warband-card"><div class="row">${portrait(leader || { name: "", photo: "" })}<div class="identity"><h2 id="band-title-${w.id}">${esc(w.name)}</h2><p>${esc(w.status.alliance) || "アライアンス未設定"}</p><p>${leader ? "リーダー：" + esc(leader.name) : "リーダー未設定"}</p><p>${w.characters.length} キャラクター</p></div></div>${btn("開く", "open-band", `data-id="${w.id}" class="warband-open" aria-describedby="band-title-${w.id}" title="${esc(w.name)}を開く"`)}</section>`;
            })
            .join("") ||
          '<p class="empty">最初のウォーバンドを登録しましょう。</p>'
        }`;
  if (screen === "choose")
    app.innerHTML = `<div class="eyebrow">NEW GAME</div><h1>出陣するウォーバンド</h1>${data.game ? '<p class="muted">進行中のゲームがあります。新しく開始する場合は確認後に置き換えます。</p>' : ""}${data.warbands.map((w) => `<section class="card"><h2>${esc(w.name)}</h2><p>${w.characters.length} キャラクター</p>${btn("このウォーバンドで開始", "start", `class="primary" data-id="${w.id}" ${w.characters.length ? "" : "disabled"}`)}</section>`).join("") || '<p class="empty">ウォーバンドとキャラクターを登録してください。</p>'}<a class="button" href="#bands">ウォーバンド管理へ</a>`;
  if (screen === "bands" && band()) loadRosterAbilityCatalog();
  if (screen === "battle")
    app.innerHTML = data.game
      ? battleView()
      : `<h1>戦闘管理</h1><p class="empty">進行中のゲームはありません。</p><a class="button primary" href="#choose">ゲームを開始</a>`;
}
// Display-only catalog data. Update the current cards without rebuilding them,
// so a late catalog response preserves open equipment and character disclosures.
let rosterAbilityCatalog, rosterAbilityLoading = false;
function loadRosterAbilityCatalog() {
  if (rosterAbilityCatalog || rosterAbilityLoading) return;
  rosterAbilityLoading = true;
  loadEquipmentCatalog().then(items => {
    rosterAbilityCatalog = items;
    const characters = screen === "battle" ? data.game?.characters : screen === "bands" ? band()?.characters : null;
    if (!characters) return;
    for (const node of app.querySelectorAll(".ability-sources[data-character-id]")) {
      const character = characters.find(c => c.id === node.dataset.characterId);
      if (!character) continue;
      const open = [...node.querySelectorAll("details[open]")].map(el => el.dataset.ability);
      node.innerHTML = abilitySourcesHtml(deriveAbilitySources(character, items));
      for (const el of node.querySelectorAll("details")) el.open = open.includes(el.dataset.ability);
    }
  }).catch(() => {
    // Known IDs remain usable; retry on the next visit without changing data.
  }).finally(() => { rosterAbilityLoading = false; });
}
const cardStats = [
  ["M", "Movement"],
  ["S", "Strike"],
  ["R", "Ranged"],
  ["C", "Concealment"],
  ["F", "Fortitude"],
  null,
  ["B", "Block"],
  ["N", "Nimbleness"],
  ["A", "Awareness"],
  ["P", "Presence"],
];
function points(c, key, label, form = false, battle = false) {
  const checks = Array.from(
    { length: 5 },
    (_, i) =>
      `<label><input type="checkbox" ${form ? `data-form-point="${key}"` : `data-point="${key}" data-id="${c.id}" ${battle ? 'data-battle-point="true"' : "disabled"}`} data-value="${i + 1}" aria-label="${form ? "" : esc(c.name) + "の"}${label} ${i + 1}" ${(c[key] || 0) > i ? "checked" : ""}></label>`,
  ).join("");
  return !form && !battle
    ? `<div class="points readonly-points" role="group" aria-label="${label}"><span class="point-caption">${label}</span><div>${checks}</div></div>`
    : `<fieldset class="points"><legend>${label}</legend><div>${checks}</div></fieldset>`;
}
function bandView(w) {
  const s = w.status;
  const fields = (keys) =>
    keys
      .map(
        ([k, l]) =>
          `<div><dt>${l}</dt><dd class="detail-text">${esc(s[k]) || "—"}</dd></div>`,
      )
      .join("");
  return `${btn("ウォーバンド一覧へ", "close-band")}<section class="card band-overview"><h1>${esc(w.name)}</h1><dl class="status-grid">${fields(
    [
      ["rating", "レーティング"],
      ["alliance", "アライアンス"],
      ["archetype", "アーキタイプ"],
    ],
  )}</dl><dl class="resources">${fields([
    ["pension", "年金"],
    ["labour", "労働力"],
    ["materials", "資材"],
    ["treasury", "トレジャリー"],
  ])}</dl>${Object.entries(bandLists)
    .map(
      ([k, l]) => k === "upgrades" ? denUpgradeList(s) :
        `<h2>${l}</h2><ul>${s[k].map((e) => `<li class="detail-text">${esc(e.name) || "（未入力）"}</li>`).join("") || "<li>登録なし</li>"}</ul>`,
    )
    .join(
      "",
    )}<h2>メモ</h2><p class="detail-text">${esc(s.notes) || "—"}</p></section><div class="row between"><h2>登録キャラクター</h2>${btn(rosterEditMode ? "編集を終了" : "編集モード", "toggle-roster-edit", `aria-pressed="${rosterEditMode}"`)}</div>${w.characters.map((c, i) => `<article class="card roster-card" data-character-id="${c.id}" data-panel-source="roster"><div class="roster-top"><div class="roster-photo">${portrait(c)}${characterRole(c) !== "none" ? `<span class="character-role">${characterRoles[characterRole(c)]}</span>` : ""}<span class="level">Lv. ${String(c.level).padStart(2, "0")}</span></div><div class="roster-info"><div class="identity"><h3>${btn(esc(c.name), "roster-detail", `data-id="${c.id}" class="character-name" title="${esc(c.name)}"`)}</h3><span class="muted">${esc(c.species)}</span></div><div class="point-trackers">${points(c, "fate", "運命点")}${points(c, "experience", "経験値")}</div></div></div><div class="card-stats">${cardStats.map((pair) => (pair ? `<span aria-label="${pair[1]} ${esc(c.stats[pair[1]])}">${pair[0]}${esc(c.stats[pair[1]].replace(/^D/, ""))}</span>` : '<span aria-hidden="true"></span>')).join("")}</div><div class="ability-sources" data-character-id="${c.id}" aria-label="${esc(c.name)}のスキル・装備由来の能力値">${abilitySourcesHtml(deriveAbilitySources(c, rosterAbilityCatalog || []))}</div>${characterButtons(c,"roster")}${rosterEditMode ? `<div class="actions">${btn("編集", "edit-character", `data-id="${c.id}"`)}${btn("複製", "duplicate", `data-id="${c.id}"`)}${btn("↑", "up", `data-id="${c.id}" aria-label="${esc(c.name)}を上へ" ${i === 0 ? "disabled" : ""}`)}${btn("↓", "down", `data-id="${c.id}" aria-label="${esc(c.name)}を下へ" ${i === w.characters.length - 1 ? "disabled" : ""}`)}${btn("削除", "delete-character", `data-id="${c.id}" class="danger"`)}</div>` : ""}</article>`).join("") || '<p class="empty">キャラクターは未登録です。</p>'}<section class="card"><h2>管理・編集メニュー</h2><div class="actions">${btn("ステータス編集", "band-status")}${btn("名前変更", "rename-band")}${btn("＋ キャラクター登録", "new-character", 'class="primary"')}${btn("ウォーバンド削除", "delete-band", 'class="danger"')}</div></section>`;
}
function freeEffects(c) {
  return c.effects.map(e=>`<div class="effect" data-effect-id="${e.id}"><strong>${esc(e.name)}</strong><p class="detail-text">${esc(e.description)}</p><div class="actions">${btn("編集", "edit-effect", `data-id="${c.id}" data-effect="${e.id}" aria-label="${esc(e.name)}を編集"`)}${btn("削除", "remove-effect", `data-id="${c.id}" data-effect="${e.id}" aria-label="${esc(e.name)}を削除"`)}</div></div>`).join("") || '<p class="muted">登録なし</p>';
}
function conditionPanel(c) {
  return `<details class="condition-picker"><summary>状態を選択・解除<span class="condition-alert" role="img" aria-label="状態効果あり" title="状態効果あり" ${hasConditions(c)?"":"hidden"}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3 2 21h20L12 3Z" fill="currentColor"/><path d="M12 9v5m0 3v1" stroke="var(--bg)" stroke-width="2"/></svg></span></summary><div class="condition-choices">${conditions.map(v=>`<div class="condition-option ${(c.conditions||[]).includes(v.id)?'is-selected':''}"><label class="condition-check"><input type="checkbox" data-condition="${v.id}" data-character="${c.id}" aria-label="${v.nameJa}" ${(c.conditions||[]).includes(v.id)?'checked':''}></label><details class="condition-detail" data-condition-id="${v.id}"><summary>${v.nameJa}</summary><p lang="en">${v.nameEn}</p><p class="detail-text">${esc(v.description)}</p><small>日本語訳 第2版 ${v.page}ページ</small></details></div>`).join('')}</div><h4>自由登録の状態・メモ</h4><div class="free-effect-list">${freeEffects(c)}</div><form class="effect-editor" data-effect-form="${c.id}"><label>自由登録の状態名<input name="name" required maxlength="200"></label><label>説明・メモ<textarea name="description" maxlength="20000"></textarea></label><div class="actions"><button type="submit">登録</button>${btn("入力をクリア", "cancel-effect", `data-id="${c.id}"`)}</div></form></details>`;
}
function battleCard(c) {
  return [...app.querySelectorAll(".battle")].find(n=>n.dataset.characterId===c.id);
}
function updateConditions(c) {
  save();
  battleCard(c).querySelector(".condition-alert").hidden = !hasConditions(c);
  for (const n of battleCard(c).querySelectorAll("[data-condition][type=checkbox]")) {
    n.checked = (c.conditions||[]).includes(n.dataset.condition);
    n.closest(".condition-option").classList.toggle("is-selected",n.checked);
  }
}
function updateFreeEffects(c) {
  save();
  battleCard(c).querySelector(".condition-alert").hidden = !hasConditions(c);
  battleCard(c).querySelector(".free-effect-list").innerHTML = freeEffects(c);
}
function resetEffectEditor(c) {
  const form = battleCard(c).querySelector(".effect-editor");
  form.reset(); delete form.dataset.editing;
  form.querySelector('[type="submit"]').textContent = "登録";
}
function battleView() {
  loadRosterAbilityCatalog();
  const g = data.game;
  return `<div class="eyebrow">BATTLE</div><div class="row between"><div><h1>${esc(g.name)}</h1><p>ラウンド <strong>${g.round}</strong></p></div>${btn("次のラウンド", "next", 'class="primary"')}</div><section class="battle-objectives" aria-label="戦闘のVPとサイドクエスト"><div class="vp-counter"><span>現在のVP</span><div class="row">${btn("−", "vp-minus", `aria-label="VPを1減らす" ${!g.vp?'disabled':''}`)}<output id="battle-vp" aria-label="現在のVP" aria-live="polite">${g.vp ?? 0}</output>${btn("＋", "vp-plus", `aria-label="VPを1増やす" ${(g.vp??0)===Number.MAX_SAFE_INTEGER?'disabled':''}`)}</div></div><div class="side-quests">${[0,1].map(i=>questSlotHtml(g,i)).join("")}</div></section><div class="split-actions battle-tools">${btn("ウォーバンド<wbr>ステータス", "battle-status", 'aria-label="ウォーバンドステータス"')}${btn("メモ", "game-notes", 'aria-haspopup="dialog"')}</div><p class="muted">操作は自動保存。ホームに戻っても続きから再開できます。</p>${sorted(
    g.characters,
  )
    .map(
      (c) =>
        `<article data-character-id="${c.id}" data-panel-source="battle" class="card roster-card battle ${c.acted ? "acted" : ""} ${c.wounds === 17 ? "out" : ""}"><div class="roster-top"><div class="roster-photo">${portrait(c)}${characterRole(c) !== "none" ? `<span class="character-role">${characterRoles[characterRole(c)]}</span>` : ""}<span class="level">Lv. ${String(c.level).padStart(2,"0")}</span></div><div class="roster-info"><div class="identity"><h3>${esc(c.name)}</h3><span class="muted">${esc(c.species)}</span></div>${c.wounds === 17 ? '<span class="badge">戦闘不能</span>' : ''}<div class="point-trackers">${points(c,"fate","運命点",false,true)}${points(c,"experience","経験値",false,true)}</div></div></div><div class="card-stats">${cardStats.map(pair=>pair?`<span aria-label="${pair[1]} ${esc(c.stats[pair[1]])}">${pair[0]}${esc(c.stats[pair[1]].replace(/^D/,""))}</span>`:'<span aria-hidden="true"></span>').join("")}</div><div class="ability-sources" data-character-id="${c.id}" aria-label="${esc(c.name)}のスキル・装備由来の能力値">${abilitySourcesHtml(deriveAbilitySources(c,rosterAbilityCatalog||[]))}</div><div class="gauge" role="img" aria-label="負傷 ${c.wounds} / 17">${Array.from({ length: 17 }, (_, i) => `<span class="pip ${[4, 7, 10, 13].includes(i + 1) ? "threshold" : ""} ${i === 16 ? "last" : ""} ${i < c.wounds ? "filled" : ""}">${i + 1}</span>`).join("")}</div><div class="row between"><div class="row wound-controls">${btn("−1", "minus", `data-id="${c.id}" aria-label="${esc(c.name)}の負傷を1減らす" ${c.wounds === 0 ? "disabled" : ""}`)}${btn("＋1", "plus", `data-id="${c.id}" aria-label="${esc(c.name)}の負傷を1増やす" ${c.wounds === 17 ? "disabled" : ""}`)}</div><label class="check"><input type="checkbox" aria-label="行動済み" title="行動済み" data-acted="${c.id}" ${c.acted ? "checked" : ""} ${c.wounds === 17 ? "disabled" : ""}></label></div>${conditionPanel(c)}${characterButtons(c,"battle")}</article>`,
    )
    .join(
      "",
    )}<div class="actions"><a class="button" href="#home">中断してホームへ</a>${btn("ゲームを終了", "end", 'class="danger"')}</div>`;
}
function nameForm(w) {
  show(
    `<h2>${w ? "ウォーバンド名を変更" : "ウォーバンド登録"}</h2><form id="name-form"><label>名前<input name="name" required maxlength="200" value="${esc(w?.name || "")}"></label><div class="actions"><button class="primary">保存</button>${btn("キャンセル", "close")}</div></form>`,
  );
  modal.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get("name").trim();
    if (!name) return;
    change(() => {
      if (w) w.name = name;
      else {
        const n = { id: id(), name, characters: [], status: emptyBandStatus() };
        data.warbands.push(n);
        bandId = n.id;
      }
    });
    modal.close();
  };
}
function bandStatusForm(w) {
  const s = w.status;
  if (
    Object.hasOwn(alliances, s.alliance) &&
    s.archetype !== alliances[s.alliance]
  ) {
    selectAlliance(s, s.alliance);
    save();
    render();
  }
  show(
    `<div class="status-toolbar"><h2>ウォーバンドステータス編集</h2>${btn("閉じる", "close")}</div><p class="muted">有効な入力は端末に自動保存します。数値は手動入力です。</p><form id="band-status-form"><label>バンド名<input name="name" required maxlength="200" value="${esc(w.name)}"></label><div class="status-grid">${Object.entries(
      bandNumbers,
    )
      .map(
        ([k, l]) =>
          `<label>${l}<input type="number" step="any" required name="${k}" value="${s[k]}"></label>`,
      )
      .join("")}</div>${Object.entries(bandTexts)
      .map(
        ([k, l]) =>
          `<label>${l}${
            k === "alliance"
              ? `<select name="alliance">${Object.hasOwn(alliances, s.alliance) ? "" : `<option value="${esc(s.alliance)}" selected disabled>${s.alliance ? "現在の値：" + esc(s.alliance) + "（保持）" : "未設定（保持）"}</option>`}${Object.keys(
                  alliances,
                )
                  .map(
                    (name) =>
                      `<option value="${esc(name)}" ${s.alliance === name ? "selected" : ""}>${esc(name)}</option>`,
                  )
                  .join("")}</select>`
              : k === "notes"
                ? `<textarea name="${k}" maxlength="20000">${esc(s[k])}</textarea>`
                : `<input name="${k}" maxlength="20000" value="${esc(s[k])}" readonly>`
          }</label>`,
      )
      .join(
        "",
      )}<p id="status-error" class="error" role="status"></p></form>${Object.entries(
      bandLists,
    )
      .map(
        ([k, l]) => k === "upgrades" ? denUpgradePicker(s) :
          `<section aria-label="${l}"><h3>${l}</h3><div id="list-${k}"></div>${btn("＋ " + l, "add-status-item", `data-list="${k}"`)}</section>`,
      )
      .join("")}`,
  );
  const form = modal.querySelector("form");
  form.onsubmit = (e) => e.preventDefault();
  form.oninput = (e) => {
    const field = e.target,
      key = field.name;
    if (key === "archetype" || key === "alliance") return;
    const valid =
      field.checkValidity() && (key !== "name" || field.value.trim());
    modal.querySelector("#status-error").textContent = valid
      ? ""
      : "空欄の名前や数値は保存できません。入力を確認してください。";
    if (!valid) return;
    if (key === "name") w.name = field.value.trim();
    else
      s[key] = Object.hasOwn(bandNumbers, key)
        ? Number(field.value)
        : field.value;
    save();
    render();
  };
  form.onchange = (e) => {
    if (e.target.name === "alliance") {
      selectAlliance(s, e.target.value);
      form.elements.archetype.value = s.archetype;
      save();
      render();
    }
  };
  const draw = (k) => {
    const list = modal.querySelector("#list-" + k);
    list.innerHTML =
      s[k]
        .map(
          (item, i) =>
            `<div class="status-item"><label>${esc(bandLists[k])} ${i + 1}<textarea data-item="${item.id}" maxlength="20000">${esc(item.name)}</textarea></label>${btn("削除", "delete-status-item", `data-item="${item.id}" aria-label="${esc(bandLists[k])} ${i + 1} を削除"`)}</div>`,
        )
        .join("") || '<p class="muted">まだ登録されていません。</p>';
    list.oninput = (e) => {
      const item = s[k].find((x) => x.id === e.target.dataset.item);
      if (item) {
        item.name = e.target.value;
        save();
      }
    };
    list.onclick = (e) => {
      const b = e.target.closest('[data-action="delete-status-item"]');
      if (b) {
        s[k] = s[k].filter((x) => x.id !== b.dataset.item);
        save();
        draw(k);
      }
    };
  };
  const denPicker=modal.querySelector("#den-picker");
  denPicker.onchange=e=>{
    const input=e.target, upgradeId=input.dataset.denSelect || input.dataset.denChoice;
    if(!upgradeId)return;
    if(input.dataset.denSelect)selectDenUpgrade(s,upgradeId,input.checked);
    else chooseDenEffect(s,upgradeId,input.value);
    const row=input.closest(".den-option"), selection=s.denUpgrades?.find(v=>v.id===upgradeId), upgrade=denUpgradeById(upgradeId);
    row.classList.toggle("is-selected",Boolean(selection));
    const choice=row.querySelector(".den-choice");
    if(choice){
      choice.hidden=!selection;
      const select=choice.querySelector("select");select.disabled=!selection;select.value=selection?.choice||"";
      const note=row.querySelector(".den-chosen");note.hidden=!selection;
      note.textContent="選択した効果："+(upgrade.choices.find(v=>v.id===selection?.choice)?.name || (selection?.choice ? selection.choice+"（未確認）" : "未選択"));
    }
    save();render();
  };
  for (const k of Object.keys(bandLists).filter(k=>k!=="upgrades")) draw(k);
  for (const b of modal.querySelectorAll('[data-action="add-status-item"]'))
    b.onclick = () => {
      const k = b.dataset.list;
      s[k].push({ id: id(), name: "" });
      save();
      draw(k);
      modal
        .querySelector("#list-" + k + " .status-item:last-child textarea")
        .focus();
    };
}
function statusReadOnly(name, s, description) {
  return `<h2>${esc(name)} のステータス</h2><p class="muted">${description}</p><dl class="status-grid">${[...Object.entries(bandNumbers), ...Object.entries(bandTexts)].map(([k, l]) => `<div><dt>${l}</dt><dd class="detail-text">${esc(s[k]) || "—"}</dd></div>`).join("")}</dl>${Object.entries(
    bandLists,
  )
    .map(
      ([k, l]) => k === "upgrades" ? denUpgradeList(s) :
        `<h3>${l}</h3><ol>${s[k].map((item) => `<li class="detail-text">${esc(item.name) || "（未入力）"}</li>`).join("") || "<li>登録なし</li>"}</ol>`,
    )
    .join("")}`;
}
function battleStatus() {
  const g = data.game;
  show(
    `${g.status ? statusReadOnly(g.name, g.status, "ゲーム開始時の記録です。登録済みウォーバンドとは独立しています。") : "<h2>ウォーバンドステータス</h2><p>このゲームは旧形式のため、開始時のステータス記録はありません。</p>"}${btn("閉じる", "close")}`,
  );
}
async function resize(file) {
  if (file.size > 25 * 1024 * 1024)
    throw Error("25 MB 以下の写真を選んでください");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () =>
        reject(
          Error("写真を読み込めません。JPEG・PNG などの画像を選んでください"),
        );
      img.src = url;
    });
    const scale = Math.min(
      1,
      800 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}
function characterForm(c) {
  let photo = c?.photo || "";
  const inventory = characterInventory(c);
  let spellSelections = structuredClone(c?.spellSelections || inventory.spellEntries.map(() => null));
  let spellsTouched = false;
  let skillSelections = structuredClone(c?.skillSelections || inventory.skillEntries.map(() => null));
  let skillsTouched = false;
  const equipmentSelections = structuredClone(c?.equipmentSelections || {});
  const equipmentMagic = structuredClone(c?.equipmentMagic || {});
  let magicTouched = false;
  let recentEquipmentIds = [...(data.recentEquipmentIds || [])],
    recentTouched = false;
  let processing = false;
  const initialPreset =
    speciesPresets.find(
      (p) => p.id === c?.speciesPresetId && p.name === c?.species,
    ) || speciesPresets.find((p) => p.name === c?.species);
  let chosenId = initialPreset?.id || "",
    storedPresetId = c?.speciesPresetId,
    draftSpecies = c?.species || "",
    acceptedGroup = initialPreset?.group || "";
  show(
    `<h2>${c ? "キャラクター編集" : "キャラクター登録"}</h2><form id="character-form"><label>名前<input name="name" value="${esc(c?.name || "")}" required maxlength="200"></label><label>役職<select name="role">${Object.entries(
      characterRoles,
    )
      .map(
        ([value, label]) =>
          `<option value="${value}" ${characterRole(c) === value ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></label><label>サイズ分類<select id="species-size"><option value="">サイズ分類を選択</option>${speciesGroups.map((g) => `<option value="${g.id}" ${g.id === acceptedGroup ? "selected" : ""}>${g.name}：${g.base}mmベース</option>`).join("")}</select></label><label>種族<select name="species" id="species-preset" required></select></label><section id="species-confirm" hidden role="alert"><h3>種族の初期値に置き換えますか？</h3><p>レベル・9能力値・スキル一覧を選択した種族の初期値に置き換えます。装備・呪文・写真・運命点・経験値は維持します。</p><div class="actions"><button type="button" id="species-apply">初期値に置き換える</button><button type="button" id="species-cancel">変更を取り消す</button></div></section><label>Level<input type="number" name="level" min="0" max="100" step="1" value="${c?.level ?? 0}" required></label><div id="photo-preview">${portrait({ photo, name: c?.name || "" })}</div><label>写真ライブラリ・ファイル<input id="photo-library" type="file" accept="image/*"></label><label>カメラで撮影<input id="photo-camera" type="file" accept="image/*" capture="environment"></label>${btn("写真を削除", "clear-photo")}<p class="muted">長辺 800px 以下に縮小して端末に保存します。</p>${points(c || {}, "fate", "運命点", true)}${points(c || {}, "experience", "経験値", true)}<h3>能力値</h3><div class="stats">${stats.map((s) => `<label>${s}<select name="${s}">${dice.map((d) => `<option ${c?.stats[s] === d ? "selected" : ""}>${d}</option>`).join("")}</select></label>`).join("")}</div><h3>装備</h3>${Object.entries(
      equipmentCategories,
    )
      .map(
        ([key, label]) =>
          `<div class="equipment-slot"><label>${label}<input name="slot-${key}" maxlength="20000" value="${esc(inventory.equipmentSlots[key])}"></label><div class="actions">${btn("検索して選ぶ", "equipment-picker", `data-slot="${key}" aria-label="${label}の装備を検索"`)}${btn("未装備", "equipment-clear", `data-slot="${key}" aria-label="${label}を未装備にする"`)}</div><p class="muted" id="selection-${key}">${equipmentSelections[key] ? esc(equipmentDisplayName(equipmentSelections[key])) : ""}</p><details class="magic-slot-editor"><summary>${label}の魔法効果を設定</summary><div id="magic-editor-${key}"></div></details></div>`,
      )
      .join(
        "",
      )}<section id="equipment-picker" hidden><h3 id="equipment-picker-title"></h3><label>装備検索<input type="search" id="equipment-query" placeholder="日本語・英語で検索" autocomplete="off"></label><label id="equipment-category-control">カテゴリ<select id="equipment-category"><option value="">すべて</option>${Object.entries(
      equipmentCategoryLabels,
    )
      .map(([key, label]) => `<option value="${key}">${label}</option>`)
      .join(
        "",
      )}</select></label><label>装備データ<select id="equipment-source"><option value="general">一般商店（96種類）</option><option value="special">スペシャル魔法装備（12種類）</option></select></label>${magicReferenceLibrary()}<p id="equipment-result-status" role="status"></p><div id="equipment-results"></div>${btn("装備検索を閉じる", "equipment-picker-close")}</section>${c?.equipment ? `<details><summary>旧装備（未分類・原文）</summary><p class="muted">原文を保持しています。必要な装備を上の6枠へ手動で割り振ってください。</p><textarea readonly aria-label="旧装備の原文">${esc(c.equipment)}</textarea></details>` : ""}<section aria-label="スキル"><h3>スキル</h3><details id="skill-picker"><summary>スキルを検索して追加</summary><label>スキル検索<input id="skill-query" type="search" placeholder="日本語・英語"></label><label>スキルカテゴリ<select id="skill-category"><option value="">すべて</option>${skillCategories.map(v => `<option>${v}</option>`).join("")}</select></label><div id="skill-results"></div></details><div id="character-skillEntries"></div>${btn("＋ スキル", "add-character-entry", 'data-list="skillEntries"')}</section><section aria-label="呪文"><h3>呪文</h3><details id="spell-picker"><summary>呪文を選択して追加</summary><label>魔術アーキタイプ<select id="spell-archetype"><option value="">すべて</option>${spellArchetypes.map(a => `<option value="${a.id}">${a.nameJa} / ${a.nameEn}</option>`).join("")}</select></label><label>元素の専門分野<select id="spell-element"><option value="">すべて</option>${elementalSpecialisms.map(v=>`<option>${v}</option>`).join("")}</select></label><div id="spell-results"></div></details><div id="character-spellEntries"></div>${btn("＋ 呪文", "add-character-entry", 'data-list="spellEntries"')}</section><label>メモ<textarea name="notes" maxlength="20000">${esc(c?.notes || "")}</textarea></label><p id="form-error" class="error" role="alert"></p><div class="actions"><button id="character-save" class="primary">保存</button>${btn("キャンセル", "close")}</div></form>`,
  );
  const picker = modal.querySelector("#equipment-picker"),
    results = modal.querySelector("#equipment-results"),
    query = modal.querySelector("#equipment-query"),
    category = modal.querySelector("#equipment-category");
  let catalog = [],
    activeSlot = "",
    pickerRequest = 0;
  const selectionText = (key) => {
    modal.querySelector("#selection-" + key).textContent = equipmentSelections[key] ? equipmentDisplayName(equipmentSelections[key]) : "";
  };
  const renderResults = () => {
    const sourceItems = modal.querySelector("#equipment-source").value === "special" ? specialMagicItems : catalog;
    const matches = searchEquipment(sourceItems, {
      query: query.value,
      category: category.value,
      slot: activeSlot,
      recent: recentEquipmentIds,
    });
    modal.querySelector("#equipment-result-status").textContent =
      `${matches.length} / ${sourceItems.length} 件`;
    results.innerHTML =
      matches
        .map(
          (item) =>
            `<div class="equipment-option" data-equipment-id="${item.id}">${equipmentDetails(item)}<small>${equipmentCategoryLabels[item.category]}${recentEquipmentIds.includes(item.id) ? " · 最近の選択" : ""}</small>${item.reviewRequired ? '<span class="review-flag">表記要確認</span>' : ""}${btn("選ぶ", "equipment-choose", `data-equipment-id="${item.id}"`)}</div>`,
        )
        .join("") || "<p>該当する装備はありません。</p>";
  };
  query.oninput = renderResults;
  category.onchange = renderResults;
  modal.querySelector("#equipment-source").onchange = renderResults;
  for (const button of modal.querySelectorAll(
    '[data-action="equipment-picker"]',
  ))
    button.onclick = async () => {
      const request = ++pickerRequest;
      activeSlot = button.dataset.slot;
      picker.hidden = false;
      query.value = "";
      category.value = "";
      modal.querySelector("#equipment-category-control").hidden = activeSlot !== "special";
      modal.querySelector("#equipment-source").value = "general";
      modal.querySelector("#equipment-picker-title").textContent =
        equipmentCategories[activeSlot] + "の装備を検索";
      modal.querySelector("#equipment-result-status").textContent =
        "装備を読み込み中…";
      results.innerHTML = "";
      try {
        catalog = await loadEquipmentCatalog();
        if (
          request !== pickerRequest ||
          !modal.open ||
          modal.querySelector("#equipment-picker") !== picker
        )
          return;
        renderResults();
        query.focus();
      } catch {
        if (
          request === pickerRequest &&
          modal.open &&
          modal.querySelector("#equipment-picker") === picker
        )
          modal.querySelector("#equipment-result-status").textContent =
            "装備を読み込めませんでした。通信を確認して再試行するか、自由入力してください。";
      }
    };
  for (const input of modal.querySelectorAll('input[name^="slot-"]'))
    input.oninput = () => {
      const key = input.name.slice(5);
      if (equipmentSelections[key]?.nameJa !== input.value)
        delete equipmentSelections[key];
      selectionText(key);
    };
  for (const button of modal.querySelectorAll(
    '[data-action="equipment-clear"]',
  ))
    button.onclick = () => {
      const key = button.dataset.slot;
      modal.querySelector(`[name="slot-${key}"]`).value = "";
      delete equipmentSelections[key];
      if (equipmentMagic[key]) { delete equipmentMagic[key]; magicTouched = true; drawMagic(key); }
      selectionText(key);
    };
  const closePicker = () => {
    pickerRequest++;
    picker.hidden = true;
    modal
      .querySelector(
        `[data-action="equipment-picker"][data-slot="${activeSlot}"]`,
      )
      ?.focus();
  };
  modal.querySelector('[data-action="equipment-picker-close"]').onclick =
    closePicker;
  results.onclick = (e) => {
    const button = e.target.closest('[data-action="equipment-choose"]');
    if (!button) return;
    const item = [...catalog, ...specialMagicItems].find((item) => item.id === button.dataset.equipmentId);
    if (!item) return;
    equipmentSelections[activeSlot] = Object.fromEntries(
      ["id", "nameJa", "nameEn", "category", "range", "notesJa", ...(item.reviewRequired ? ["reviewRequired"] : [])].map(k => [k, structuredClone(item[k])])
    );
    modal.querySelector(`[name="slot-${activeSlot}"]`).value = item.nameJa;
    selectionText(activeSlot);
    recentEquipmentIds = [
      item.id,
      ...recentEquipmentIds.filter((id) => id !== item.id),
    ].slice(0, 20);
    recentTouched = true;
    closePicker();
  };
  const drawMagic = (key) => {
    const root = modal.querySelector("#magic-editor-" + key), value = equipmentMagic[key] || { effects: [], notes: "" };
    root.innerHTML = `<p class="muted">基本装備を維持して効果を手動登録します。能力値や装備枠は自動変更しません。</p>${value.effects.map((v,i) => `<div class="magic-entry"><label>魔法効果 ${i+1}<select data-magic-id="${i}">${!magicEffect(v.id) ? `<option value="${esc(v.id)}">${esc(v.id)}（現在の値を保持）</option>` : ""}${magicEffects.map(effect => `<option value="${effect.id}" ${effect.id===v.id?"selected":""}>${esc(effect.nameJa)} / ${effect.nameEn}</option>`).join("")}</select></label>${magicEffect(v.id)?.needsBonus || v.bonus !== null ? `<label>ボーナス値<input type="number" required min="0" max="9007199254740991" step="1" data-magic-bonus="${i}" value="${esc(v.bonus ?? 1)}"></label>` : ""}${btn("削除", "remove-magic-effect", `data-index="${i}" aria-label="${equipmentCategories[key]}の魔法効果 ${i+1} を削除"`)}</div>`).join("")}<button type="button" data-add-magic="${key}">＋ 魔法効果</button><label>魔法装備の補足<textarea maxlength="20000" data-magic-notes>${esc(value.notes)}</textarea></label>${magicDetails(value)}`;
    const touch = () => { magicTouched = true; return equipmentMagic[key] ||= { effects: [], notes: "" }; };
    root.onchange = e => {
      if(e.target.dataset.magicId !== undefined) {
        const effect = magicEffect(e.target.value);
        touch().effects[Number(e.target.dataset.magicId)] = { id:effect.id, bonus:effect.needsBonus?1:null };
        drawMagic(key);
      }
    };
    root.oninput = e => {
      if(e.target.dataset.magicBonus !== undefined && e.target.validity.valid && e.target.value !== "") touch().effects[Number(e.target.dataset.magicBonus)].bonus = Number(e.target.value);
      else if(e.target.hasAttribute("data-magic-notes")) touch().notes = e.target.value;
    };
    root.onclick = e => {
      const add = e.target.closest("[data-add-magic]"), remove = e.target.closest('[data-action="remove-magic-effect"]');
      if(add) { touch().effects.push({id:magicEffects[0].id,bonus:1}); drawMagic(key); }
      if(remove) { touch().effects.splice(Number(remove.dataset.index),1); drawMagic(key); }
    };
  };
  for (const key of Object.keys(equipmentCategories)) drawMagic(key);
  const drawEntries = (key) => {
    const label = key === "skillEntries" ? "スキル" : "呪文",
      node = modal.querySelector("#character-" + key);
    node.innerHTML =
      inventory[key]
        .map(
          (text, i) =>
            `<div class="character-entry"><label>${label} ${i + 1}<textarea data-index="${i}" maxlength="20000">${esc(text)}</textarea></label>${key === "skillEntries" && matchSkill(text, skillSelections[i])?.skill.parameterized ? `<label>数値 X<input type="number" required min="0" step="1" max="9007199254740991" data-skill-value="${i}" value="${matchSkill(text, skillSelections[i]).value}"></label>` : ""}${btn("削除", "delete-character-entry", `data-index="${i}" aria-label="${label} ${i + 1} を削除"`)}</div>`,
        )
        .join("") || '<p class="muted">登録なし</p>';
    node.oninput = (e) => {
      if (e.target.dataset.skillValue !== undefined) {
        const i = Number(e.target.dataset.skillValue), match = matchSkill(inventory[key][i], skillSelections[i]);
        if (match && e.target.validity.valid && e.target.value !== "") {
          const value = Number(e.target.value);
          inventory[key][i] = skillName(match.skill, value);
          skillSelections[i] = { id: match.skill.id, value };
          node.querySelector(`textarea[data-index="${i}"]`).value = inventory[key][i];
          skillsTouched = true;
        }
      } else if (e.target.dataset.index !== undefined) {
        const i = Number(e.target.dataset.index);
        inventory[key][i] = e.target.value;
        if (key === "spellEntries") { spellSelections[i] = null; spellsTouched = true; }
        if (key === "skillEntries") {
          skillSelections[i] = null; skillsTouched = true;
          const row = e.target.closest(".character-entry"), m = matchSkill(e.target.value);
          let number = row.querySelector("[data-skill-value]");
          if (m?.skill.parameterized) {
            if (!number) {
              const label = document.createElement("label");
              label.innerHTML = `数値 X<input type="number" required min="0" max="9007199254740991" step="1" data-skill-value="${i}">`;
              row.insertBefore(label, row.lastElementChild);
              number = label.querySelector("input");
            }
            number.value = m.value;
          } else if (number) number.parentElement.remove();
        }
      }
    };
    node.onclick = (e) => {
      const b = e.target.closest('[data-action="delete-character-entry"]');
      if (b) {
        inventory[key].splice(Number(b.dataset.index), 1);
        if (key === "spellEntries") { spellSelections.splice(Number(b.dataset.index), 1); spellsTouched = true; }
        if (key === "skillEntries") { skillSelections.splice(Number(b.dataset.index), 1); skillsTouched = true; }
        drawEntries(key);
      }
    };
  };
  const drawSkillResults = () => {
    const results = searchSkills(modal.querySelector("#skill-query").value, modal.querySelector("#skill-category").value);
    modal.querySelector("#skill-results").innerHTML = `<p role="status">${results.length}件</p>` + results.map(skill => `<div class="skill-option" data-skill-id="${skill.id}"><strong>${esc(skill.nameJa)}</strong><span class="skill-english">${esc(skill.nameEn)}</span><span>${skill.category}</span>${skill.parameterized ? `<label>数値 X<input type="number" required min="0" max="9007199254740991" step="1" value="1" form="skill-candidate-only" aria-label="${esc(skill.nameJa)}の数値"></label>` : ""}<button type="button" data-add-skill="${skill.id}">追加</button></div>`).join("");
  };
  modal.querySelector("#skill-query").oninput = drawSkillResults;
  modal.querySelector("#skill-category").onchange = drawSkillResults;
  modal.querySelector("#skill-results").onclick = e => {
    const b = e.target.closest("[data-add-skill]");
    if (!b) return;
    const skill = skills.find(s => s.id === b.dataset.addSkill), input = b.parentElement.querySelector("input");
    if (input && (!input.reportValidity() || input.value === "")) return;
    const value = skill.parameterized ? Number(input.value) : null;
    inventory.skillEntries.push(skillName(skill, value));
    skillSelections.push({id:skill.id,value});
    skillsTouched = true;
    drawEntries("skillEntries");
    modal.querySelector("#character-skillEntries .character-entry:last-child textarea").focus();
  };
  const drawSpellResults = () => {
    const archetype = modal.querySelector("#spell-archetype").value;
    const element = modal.querySelector("#spell-element");
    element.parentElement.hidden = archetype !== "elementalism";
    const results = searchSpells("", archetype, archetype === "elementalism" ? element.value : "");
    modal.querySelector("#spell-results").innerHTML = `<p role="status">${results.length}件</p>` + results.map(s=>`<div class="spell-option" data-spell-id="${s.id}">${spellDetails(s.nameJa,{id:s.id})}<button type="button" data-add-spell="${s.id}" aria-label="${esc(s.nameJa)}を追加">追加</button></div>`).join("");
  };
  modal.querySelector("#spell-archetype").onchange = drawSpellResults;
  modal.querySelector("#spell-element").onchange = drawSpellResults;
  modal.querySelector("#spell-results").onclick = e => {
    const b = e.target.closest("[data-add-spell]");
    if (!b) return;
    const s = spells.find(s=>s.id===b.dataset.addSpell);
    inventory.spellEntries.push(s.nameJa); spellSelections.push({id:s.id}); spellsTouched = true;
    drawEntries("spellEntries");
    modal.querySelector("#character-spellEntries .character-entry:last-child textarea").focus();
  };
  drawSpellResults();
  drawSkillResults();
  for (const key of ["skillEntries", "spellEntries"]) drawEntries(key);
  for (const b of modal.querySelectorAll('[data-action="add-character-entry"]'))
    b.onclick = () => {
      const key = b.dataset.list;
      inventory[key].push("");
      if (key === "spellEntries") { spellSelections.push(null); spellsTouched = true; }
      if (key === "skillEntries") { skillSelections.push(null); skillsTouched = true; }
      drawEntries(key);
      modal
        .querySelector(
          "#character-" + key + " .character-entry:last-child textarea",
        )
        .focus();
    };
  const speciesSelect = modal.querySelector("#species-preset"),
    groupSelect = modal.querySelector("#species-size"),
    confirmation = modal.querySelector("#species-confirm");
  let pendingPreset = "";
  const drawSpecies = () => {
    const options = speciesPresets.filter((p) => p.group === groupSelect.value),
      inGroup = options.some((p) => p.id === chosenId);
    speciesSelect.innerHTML = `${!inGroup ? `<option value="${c || chosenId ? "__legacy__" : ""}" selected disabled>${draftSpecies ? esc(draftSpecies) + "（現在の値を保持）" : "種族を選択"}</option>` : ""}${options.map((p) => `<option value="${p.id}" ${p.id === chosenId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}`;
  };
  const applySpecies = (id) => {
    const values = presetValues(id),
      p = speciesPresets.find((p) => p.id === id);
    chosenId = id;
    storedPresetId = id;
    draftSpecies = values.species;
    acceptedGroup = p.group;
    groupSelect.value = p.group;
    modal.querySelector('[name="level"]').value = values.level;
    for (const key of stats)
      modal.querySelector(`[name="${key}"]`).value = values.stats[key];
    inventory.skillEntries = values.skillEntries;
    skillSelections = values.skillEntries.map(() => null);
    skillsTouched = true;
    drawEntries("skillEntries");
    drawSpecies();
  };
  groupSelect.onchange = () => {
    if (confirmation.hidden) drawSpecies();
  };
  speciesSelect.onchange = () => {
    const id = speciesSelect.value;
    if (id === chosenId || id === "__legacy__") return;
    if (c || chosenId) {
      pendingPreset = id;
      confirmation.hidden = false;
      modal.querySelector("#character-save").disabled = true;
      groupSelect.disabled = true;
      speciesSelect.disabled = true;
      modal.querySelector("#species-apply").focus();
    } else applySpecies(id);
  };
  const finishSelection = () => {
    confirmation.hidden = true;
    modal.querySelector("#character-save").disabled = processing;
    groupSelect.disabled = false;
    speciesSelect.disabled = false;
    pendingPreset = "";
  };
  modal.querySelector("#species-apply").onclick = () => {
    applySpecies(pendingPreset);
    finishSelection();
  };
  modal.querySelector("#species-cancel").onclick = () => {
    groupSelect.value = acceptedGroup;
    drawSpecies();
    finishSelection();
  };
  drawSpecies();
  const preview = () =>
    (modal.querySelector("#photo-preview").innerHTML = portrait({
      photo,
      name: c?.name || "",
    }));
  for (const input of modal.querySelectorAll("input[type=file]"))
    input.onchange = async () => {
      if (!input.files[0]) return;
      processing = true;
      modal.querySelector("#character-save").disabled = true;
      try {
        photo = await resize(input.files[0]);
        preview();
        modal.querySelector("#form-error").textContent = "";
      } catch (e) {
        modal.querySelector("#form-error").textContent = e.message;
      } finally {
        processing = false;
        modal.querySelector("#character-save").disabled = !confirmation.hidden;
      }
    };
  modal.querySelector("[data-action=clear-photo]").onclick = () => {
    photo = "";
    preview();
  };
  modal.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    if (processing || !confirmation.hidden) return;
    const f = new FormData(e.target),
      name = f.get("name").trim();
    if (!name) return;
    const n = {
      ...structuredClone(c || {}),
      id: c?.id || id(),
      name,
      ...(f.get("role") !== "none" || c?.role !== undefined
        ? { role: f.get("role") }
        : {}),
      species: draftSpecies,
      ...(storedPresetId ? { speciesPresetId: storedPresetId } : {}),
      level: Number(f.get("level")),
      photo,
      fate: modal.querySelectorAll('[data-form-point="fate"]:checked').length,
      experience: modal.querySelectorAll(
        '[data-form-point="experience"]:checked',
      ).length,
      stats: Object.fromEntries(stats.map((s) => [s, f.get(s)])),
      equipment: c?.equipment || "",
      skills: c?.skills || "",
      spells: c?.spells || "",
      notes: f.get("notes"),
      ...(magicTouched || c?.equipmentMagic !== undefined ? {equipmentMagic: structuredClone(equipmentMagic)} : {}),
      equipmentSlots: Object.fromEntries(
        Object.keys(equipmentCategories).map((k) => [k, f.get("slot-" + k)]),
      ),
      ...(Object.keys(equipmentSelections).length ||
      c?.equipmentSelections !== undefined
        ? { equipmentSelections: structuredClone(equipmentSelections) }
        : {}),
      ...(skillsTouched || c?.skillSelections !== undefined ? {skillSelections: inventory.skillEntries.map((text, i) => {
        const matched = matchSkill(text, skillSelections[i]);
        return matched ? {id:matched.skill.id,value:matched.value} : null;
      })} : {}),
      skillEntries: structuredClone(inventory.skillEntries),
      ...(spellsTouched || c?.spellSelections !== undefined ? {spellSelections: inventory.spellEntries.map((text,i) => {
        const matched = matchSpell(text, spellSelections[i]);
        return matched ? {id:matched.id} : null;
      })} : {}),
      spellEntries: structuredClone(inventory.spellEntries),
    };
    const conflicts = conflictingRoles(band(), n);
    if (
      conflicts.length &&
      !window.confirm(
        `${characterRoles[n.role]}は「${conflicts.map((c) => c.name).join("、")}」に設定されています。「${n.name}」へ移しますか？現在の担当者は役職「なし」になります。`,
      )
    )
      return;
    change(() => {
      putCharacter(band(), n, true);
      setCharacterNotes(data,"roster",bandId,n.id,n.notes);
      if (recentTouched) data.recentEquipmentIds = recentEquipmentIds;
    });
    modal.close();
  };
}
function equipmentSlotDisplay(c, key) {
  const item = c.equipmentSelections?.[key],
    name = characterInventory(c).equipmentSlots[key];
  if (!item || item.nameJa !== name) return (esc(name) || "—") + magicDetails(c.equipmentMagic?.[key]);
  return `${equipmentDetails(item)}${item.reviewRequired ? '<span class="review-flag">表記要確認</span>' : ""}${magicDetails(c.equipmentMagic?.[key])}`;
}
function skillDisplay(text, selection) {
  const matched = matchSkill(text, selection);
  if (!matched) return `<li class="detail-text">${esc(text) || "（未入力）"}</li>`;
  const {skill, value} = matched;
  return `<li class="skill-detail"><details><summary><strong>${esc(skillName(skill,value))}</strong><span class="skill-english">${esc(skill.parameterized ? skill.nameEn.replace("X", String(value)) : skill.nameEn)}</span></summary><dl><dt>カテゴリ</dt><dd>${skill.category}</dd><dt>使用条件</dt><dd class="detail-text">${esc(skill.conditions)}</dd><dt>効果説明</dt><dd class="detail-text">${esc(skill.description)}</dd></dl></details></li>`;
}
function characterButtons(c,source) {
  const attrs=`data-id="${c.id}" data-source="${source}" aria-haspopup="dialog"`;
  return `<div class="split-actions character-tools">${btn("詳細","character-panel",attrs)}${btn("メモ","character-notes",attrs)}</div>`;
}
function notesEditor({title,description,value,onInput}) {
  show(`<h2>メモ</h2><p>${esc(title)}</p><p class="muted">${esc(description)}入力内容は自動保存されます。</p><label>メモ<textarea id="notes-editor" maxlength="20000" rows="10">${esc(value)}</textarea></label>${btn("閉じる","close")}`,{focusHeading:true});
  modal.querySelector('#notes-editor').addEventListener('input',e=>{if(onInput(e.target.value))save();});
}
function characterNotes(source,id) {
  const c=source==='battle'?data.game?.characters.find(c=>c.id===id):band()?.characters.find(c=>c.id===id);
  if(!c)return;
  const currentBandId=bandId;
  notesEditor({title:c.name,description:'キャラクター個別のメモです。',value:c.notes,onInput:text=>setCharacterNotes(data,source,currentBandId,id,text)});
}
function gameNotes() {
  const game=data.game;if(!game)return;
  notesEditor({title:game.name,description:'この戦闘だけのメモです。',value:game.notes??'',onInput:text=>{if(data.game!==game||game.notes===text)return false;game.notes=text;return true;}});
}
function characterExtras(c, activeTab = null) {
  const inventory=characterInventory(c);
  const section=(category,label,body)=>`<section data-extra-category="${category}" ${activeTab&&activeTab!==category?'hidden':''}><h3>${label}</h3>${body}</section>`;
  const equipment=`<dl class="status-grid equipment-detail-grid">${Object.entries(equipmentCategories).map(([key,label])=>`<div><dt>${label}</dt><dd class="detail-text">${equipmentSlotDisplay(c,key)}</dd></div>`).join("")}</dl>${c.equipment?`<details><summary>旧装備（未分類・原文）</summary><p class="detail-text">${esc(c.equipment)}</p></details>`:''}`;
  const skills=`<ol>${inventory.skillEntries.map((text,i)=>skillDisplay(text,c.skillSelections?.[i])).join('')||'<li>登録なし</li>'}</ol>${c.skills?`<details><summary>移行前のスキルの原文</summary><p class="detail-text">${esc(c.skills)}</p></details>`:''}`;
  const spells=`<ol>${inventory.spellEntries.map((text,i)=>`<li class="spell-detail">${spellDetails(text,c.spellSelections?.[i])}</li>`).join('')||'<li>登録なし</li>'}</ol>${c.spells?`<details><summary>移行前の呪文の原文</summary><p class="detail-text">${esc(c.spells)}</p></details>`:''}`;
  return section('equipment','装備',equipment)+section('skills','スキル',skills)+section('spells','呪文',spells);
}
const characterPanel=createCharacterPanel({
  getCharacter:(source,id)=>source==='battle'&&screen==='battle'?data.game?.characters.find(c=>c.id===id):source==='roster'&&screen==='bands'?band()?.characters.find(c=>c.id===id):null,
  renderContent:characterExtras,
});
function detail(c, editable = false) {
  show(
    `<div class="row">${portrait(c)}<div><h2>${esc(c.name)}</h2><p>${esc(c.species)} · Lv.${c.level}</p></div></div><div class="stats">${stats.map((s) => `<div><span class="muted">${s}</span><br><strong>${esc(c.stats[s])}</strong></div>`).join("")}</div>${characterExtras(c)}${editable ? btn("編集", "edit-character", `data-id="${c.id}"`) : ""}${btn("閉じる", "close")}`,
  );
}
function download() {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `bb-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function restore(file) {
  try {
    if (file.size > 100 * 1024 * 1024)
      throw Error("バックアップは 100 MB 以下にしてください");
    const incoming = loadData(JSON.parse(await file.text()));
    confirmAction(
      "バックアップを復元",
      "現在の全ウォーバンドと進行中のゲームを置き換えます。先にバックアップを保管してください。",
      () => {
        restoreQueue = (async () => {
          pending++;
          status.textContent = "復元中…";
          show("<h2>復元中…</h2><p>この画面を閉じずにお待ちください。</p>");
          await saveQueue;
          // Earlier autosaves may update the status while we await their completion.
          status.textContent = "復元中…";
          try {
            await write(incoming);
            data = incoming;
            resetRosterView();
            failed = false;
            bandId = undefined;
            status.textContent = "端末に保存済み";
            modal.close();
            render();
          } catch {
            status.textContent = "復元失敗・元のデータを保持";
            show(
              "<h2>復元できませんでした</h2><p>保存容量やブラウザの設定を確認してください。現在のデータは維持しています。</p>" +
                btn("閉じる", "close"),
            );
          } finally {
            pending--;
          }
        })();
        return restoreQueue;
      },
    );
  } catch (e) {
    show(
      `<h2>復元できませんでした</h2><p>${esc(e.message)}</p>${btn("閉じる", "close")}`,
    );
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b || b.disabled) return;
  const a = b.dataset.action,
    w = band(),
    c = data.game?.characters.find((c) => c.id === b.dataset.id),
    wc = w?.characters.find((c) => c.id === b.dataset.id);
  if (
    ["edit-character", "duplicate", "delete-character", "up", "down"].includes(
      a,
    ) &&
    (!rosterEditMode || screen !== "bands" || !wc)
  )
    return;
  switch (a) {
    case "close":
      modal.close();
      break;
    case "toggle-roster-edit":
      rosterEditMode = !rosterEditMode;
      render();
      document
        .querySelector('[data-action="toggle-roster-edit"]')
        ?.focus({ preventScroll: true });
      break;
    case "vp-plus":
    case "vp-minus":
      if (!data.game) break;
      adjustVP(data.game, a === "vp-plus" ? 1 : -1);
      save();
      document.getElementById("battle-vp").value = String(data.game.vp);
      app.querySelector('[data-action="vp-minus"]').disabled = data.game.vp === 0;
      app.querySelector('[data-action="vp-plus"]').disabled = data.game.vp === Number.MAX_SAFE_INTEGER;
      break;
    case "character-notes":
      characterNotes(b.dataset.source,b.dataset.id);
      break;
    case "game-notes":
      gameNotes();
      break;
    case "character-panel":
      characterPanel.open(b.dataset.source,b.dataset.id);
      break;
    case "new-band":
      resetRosterView();
      nameForm();
      break;
    case "open-band":
      resetRosterView();
      bandId = b.dataset.id;
      render();
      break;
    case "close-band":
      resetRosterView();
      bandId = undefined;
      render();
      break;
    case "roster-detail":
      detail(wc, rosterEditMode);
      break;
    case "band-status":
      bandStatusForm(w);
      break;
    case "battle-status":
      battleStatus();
      break;
    case "rename-band":
      nameForm(w);
      break;
    case "delete-band":
      confirmAction(
        "ウォーバンドを削除",
        `${esc(w.name)} と登録キャラクターを削除します。`,
        () =>
          change(() => {
            data.warbands = data.warbands.filter((x) => x !== w);
            bandId = undefined;
          }),
      );
      break;
    case "new-character":
      characterForm();
      break;
    case "edit-character":
      characterForm(wc);
      break;
    case "duplicate":
      change(() => {
        const n = structuredClone(wc);
        n.id = id();
        n.role = "none";
        n.name = (n.name + " の複製").slice(0, 200);
        w.characters.splice(w.characters.indexOf(wc) + 1, 0, n);
      });
      break;
    case "delete-character":
      confirmAction(
        "キャラクターを削除",
        `${esc(wc.name)} を削除します。`,
        () =>
          change(() => (w.characters = w.characters.filter((x) => x !== wc))),
      );
      break;
    case "up":
    case "down":
      change(() => {
        const i = w.characters.indexOf(wc),
          j = i + (a === "up" ? -1 : 1);
        if (j >= 0 && j < w.characters.length)
          [w.characters[i], w.characters[j]] = [
            w.characters[j],
            w.characters[i],
          ];
      });
      break;
    case "start": {
      const selected = data.warbands.find((x) => x.id === b.dataset.id);
      const run = () => {
        change(() => (data.game = startGame(selected)));
        location.hash = "battle";
      };
      data.game
        ? confirmAction(
            "新しいゲームを開始",
            "進行中のゲームを終了し、新しいゲームに置き換えます。",
            run,
          )
        : run();
      break;
    }
    case "plus":
    case "minus":
      change(() => wound(c, a === "plus" ? 1 : -1));
      break;
    case "next":
      confirmAction(
        "次のラウンドへ",
        `ラウンド ${data.game.round + 1} に進み、戦闘不能以外の行動済みチェックを解除します。`,
        () => change(() => nextRound(data.game)),
      );
      break;
    case "end":
      confirmAction(
        "ゲームを終了",
        "このゲームの負傷・状態・ラウンドを削除します。登録済みウォーバンドは保持します。",
        () => {
          change(() => (data.game = null));
          location.hash = "home";
        },
      );
      break;
    case "edit-effect": {
      if (!c) break;
      const effect = c.effects.find(v=>v.id===b.dataset.effect);
      if (!effect) break;
      const form = battleCard(c).querySelector(".effect-editor");
      form.dataset.editing = effect.id;
      form.elements.name.value = effect.name;
      form.elements.description.value = effect.description;
      form.querySelector('[type="submit"]').textContent = "更新";
      form.elements.name.focus({preventScroll:true});
      break;
    }
    case "cancel-effect":
      if (c) resetEffectEditor(c);
      break;
    case "remove-effect":
      if (!c) break;
      c.effects = c.effects.filter(v=>v.id!==b.dataset.effect);
      if (battleCard(c).querySelector(".effect-editor").dataset.editing===b.dataset.effect) resetEffectEditor(c);
      updateFreeEffects(c);
      break;
    case "export":
      download();
      break;
    case "import":
      document.querySelector("#restore-file").click();
      break;
  }
});
document.addEventListener("submit", e=>{
  const form=e.target.closest("[data-effect-form]");
  if (!form) return;
  e.preventDefault();
  const c=data.game?.characters.find(c=>c.id===form.dataset.effectForm);
  if (!c || !form.reportValidity()) return;
  const name=form.elements.name.value.trim(), description=form.elements.description.value;
  if (!name) return;
  const effect=c.effects.find(v=>v.id===form.dataset.editing);
  if (effect) Object.assign(effect,{name,description});
  else c.effects.push({id:id(),name,description});
  resetEffectEditor(c); updateFreeEffects(c);
});
document.addEventListener("change", (e) => {
  const control=e.target;
  if(data.game && control.matches('select[data-quest-slot], select[data-wild-quest-slot]')) {
    const index=Number(control.dataset.questSlot ?? control.dataset.wildQuestSlot);
    const wild=control.dataset.wildQuestSlot !== undefined;
    if(wild)selectWildQuest(data.game,index,control.value);
    else selectQuest(data.game,index,control.value);
    save();
    const panel=control.closest(".quest-slot");
    panel.outerHTML=questSlotHtml(data.game,index);
    app.querySelector(`[${wild?'data-wild-quest-slot':'data-quest-slot'}="${index}"]`)?.focus({preventScroll:true});
  }
  if (
    e.target.dataset.point &&
    e.target.dataset.battlePoint &&
    screen === "battle"
  ) {
    const c = data.game?.characters.find((c) => c.id === e.target.dataset.id);
    if (c)
      change(
        () =>
          (c[e.target.dataset.point] = e.target.checked
            ? Number(e.target.dataset.value)
            : Number(e.target.dataset.value) - 1),
      );
  }
  if (e.target.dataset.formPoint) {
    const key = e.target.dataset.formPoint,
      n = e.target.checked
        ? Number(e.target.dataset.value)
        : Number(e.target.dataset.value) - 1;
    modal
      .querySelectorAll(`[data-form-point="${key}"]`)
      .forEach((input) => (input.checked = Number(input.dataset.value) <= n));
  }

  if (e.target.dataset.condition && e.target.matches('input[type=checkbox]')) {
    const c = data.game?.characters.find(c=>c.id===e.target.dataset.character);
    if (c) {setCondition(c,e.target.dataset.condition,e.target.checked);updateConditions(c);}
  }
  if (e.target.dataset.acted) {
    const c = data.game.characters.find((c) => c.id === e.target.dataset.acted);
    if (c.wounds !== 17) change(() => (c.acted = e.target.checked));
  }
  if (e.target.id === "restore-file" && e.target.files[0])
    restore(e.target.files[0]);
});
window.addEventListener("hashchange", navigate);
window.addEventListener("beforeunload", (e) => {
  if (pending || failed) {
    e.preventDefault();
    e.returnValue = "";
  }
});
try {
  data = loadData((await read()) || emptyData());
  status.textContent = "端末に保存済み";
  navigate();
} catch {
  app.innerHTML =
    "<h1>データを読み込めません</h1><p>Safari のストレージ設定・空き容量を確認し、再読み込みしてください。保存データは変更していません。</p>";
  status.textContent = "保存機能を利用できません";
}
