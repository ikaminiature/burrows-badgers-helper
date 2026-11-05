import {
  stats,
  dice,
  emptyData,
  id,
  penalty,
  wound,
  sorted,
  startGame,
  nextRound,
  loadData,
  emptyBandStatus,
  bandNumbers,
  bandTexts,
  bandLists,
  equipmentCategories,
  characterInventory,
  alliances,
  selectAlliance,
} from "./model.js";
import { read, write } from "./db.js";
import { createUpdater } from "./update.js";
import { speciesGroups, speciesPresets, presetValues } from "./species.js";
const app = document.querySelector("#app"),
  modal = document.querySelector("#modal"),
  status = document.querySelector("#save-status");
let data,
  screen = "home",
  bandId,
  saveQueue = Promise.resolve(),
  failed = false,
  pending = 0;
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
function show(html) {
  modal.innerHTML = html;
  if (!modal.open) modal.showModal();
  modal.querySelector("input,button")?.focus();
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
  if (route === "bands" && screen !== "bands") bandId = undefined;
  screen = ["home", "bands", "battle", "choose"].includes(route)
    ? route
    : "home";
  render();
}
function render() {
  if (!data) return;
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
      : `<div class="eyebrow">WARBANDS</div><h1>ウォーバンド管理</h1>${btn("＋ ウォーバンドを登録", "new-band", 'class="primary"')}${data.warbands.map((w) => `<section class="card"><h2>${esc(w.name)}</h2><p>${w.characters.length} キャラクター</p>${btn("開く", "open-band", `data-id="${w.id}"`)}</section>`).join("") || '<p class="empty">最初のウォーバンドを登録しましょう。</p>'}`;
  if (screen === "choose")
    app.innerHTML = `<div class="eyebrow">NEW GAME</div><h1>出陣するウォーバンド</h1>${data.game ? '<p class="muted">進行中のゲームがあります。新しく開始する場合は確認後に置き換えます。</p>' : ""}${data.warbands.map((w) => `<section class="card"><h2>${esc(w.name)}</h2><p>${w.characters.length} キャラクター</p>${btn("このウォーバンドで開始", "start", `class="primary" data-id="${w.id}" ${w.characters.length ? "" : "disabled"}`)}</section>`).join("") || '<p class="empty">ウォーバンドとキャラクターを登録してください。</p>'}<a class="button" href="#bands">ウォーバンド管理へ</a>`;
  if (screen === "battle")
    app.innerHTML = data.game
      ? battleView()
      : `<h1>戦闘管理</h1><p class="empty">進行中のゲームはありません。</p><a class="button primary" href="#choose">ゲームを開始</a>`;
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
  return `<fieldset class="points"><legend>${label}</legend><div>${Array.from({ length: 5 }, (_, i) => `<label><input type="checkbox" ${form ? `data-form-point="${key}"` : `data-point="${key}" data-id="${c.id}" ${battle ? 'data-battle-point="true"' : "disabled"}`} data-value="${i + 1}" aria-label="${form ? "" : esc(c.name) + "の"}${label} ${i + 1}" ${(c[key] || 0) > i ? "checked" : ""}></label>`).join("")}</div></fieldset>`;
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
      ([k, l]) =>
        `<h2>${l}</h2><ul>${s[k].map((e) => `<li class="detail-text">${esc(e.name) || "（未入力）"}</li>`).join("") || "<li>登録なし</li>"}</ul>`,
    )
    .join(
      "",
    )}<h2>メモ</h2><p class="detail-text">${esc(s.notes) || "—"}</p></section><h2>登録キャラクター</h2>${w.characters.map((c, i) => `<article class="card roster-card"><div class="roster-top"><div class="roster-photo">${portrait(c)}<span class="level">Lv. ${String(c.level).padStart(2, "0")}</span></div><div class="roster-info"><div class="identity"><h3>${btn(esc(c.name), "roster-detail", `data-id="${c.id}" class="character-name" title="${esc(c.name)}"`)}</h3><span class="muted">${esc(c.species)}</span></div><div class="point-trackers">${points(c, "fate", "運命点")}${points(c, "experience", "経験値")}</div></div></div><div class="card-stats">${cardStats.map((pair) => (pair ? `<span aria-label="${pair[1]} ${esc(c.stats[pair[1]])}">${pair[0]}${esc(c.stats[pair[1]].replace(/^D/, ""))}</span>` : '<span aria-hidden="true"></span>')).join("")}</div><div class="actions">${btn("編集", "edit-character", `data-id="${c.id}"`)}${btn("複製", "duplicate", `data-id="${c.id}"`)}${btn("↑", "up", `data-id="${c.id}" aria-label="${esc(c.name)}を上へ" ${i === 0 ? "disabled" : ""}`)}${btn("↓", "down", `data-id="${c.id}" aria-label="${esc(c.name)}を下へ" ${i === w.characters.length - 1 ? "disabled" : ""}`)}${btn("削除", "delete-character", `data-id="${c.id}" class="danger"`)}</div></article>`).join("") || '<p class="empty">キャラクターは未登録です。</p>'}<section class="card"><h2>管理・編集メニュー</h2><div class="actions">${btn("ステータス編集", "band-status")}${btn("名前変更", "rename-band")}${btn("＋ キャラクター登録", "new-character", 'class="primary"')}${btn("ウォーバンド削除", "delete-band", 'class="danger"')}</div></section>`;
}
function battleView() {
  const g = data.game;
  return `<div class="eyebrow">BATTLE</div><div class="row between"><div><h1>${esc(g.name)}</h1><p>ラウンド <strong>${g.round}</strong></p></div>${btn("次のラウンド", "next", 'class="primary"')}</div>${btn("ウォーバンドステータス", "battle-status")}<p class="muted">操作は自動保存。ホームに戻っても続きから再開できます。</p>${sorted(
    g.characters,
  )
    .map(
      (c) =>
        `<article class="card battle ${c.acted ? "acted" : ""} ${c.wounds === 17 ? "out" : ""}"><div class="row">${portrait(c)}<div class="identity"><h3>${esc(c.name)}</h3><span class="muted">${esc(c.species)}</span></div><span class="badge">${c.wounds === 17 ? "戦闘不能" : c.acted ? "行動済み" : "未行動"}</span></div><div class="row between"><div><span class="wound-count">${c.wounds}</span> / 17 <span class="muted">負傷</span></div><strong>ペナルティ ${penalty(c.wounds)}</strong></div><div class="gauge" role="img" aria-label="負傷 ${c.wounds} / 17">${Array.from({ length: 17 }, (_, i) => `<span class="pip ${[4, 7, 10, 13].includes(i + 1) ? "threshold" : ""} ${i === 16 ? "last" : ""} ${i < c.wounds ? "filled" : ""}">${i + 1}</span>`).join("")}</div><div class="row between"><div class="row wound-controls">${btn("−1", "minus", `data-id="${c.id}" aria-label="${esc(c.name)}の負傷を1減らす" ${c.wounds === 0 ? "disabled" : ""}`)}${btn("＋1", "plus", `data-id="${c.id}" aria-label="${esc(c.name)}の負傷を1増やす" ${c.wounds === 17 ? "disabled" : ""}`)}</div><label class="check"><input type="checkbox" data-acted="${c.id}" ${c.acted ? "checked" : ""} ${c.wounds === 17 ? "disabled" : ""}>行動済み</label></div><details><summary>状態・効果（${c.effects.length}）</summary>${c.effects.map((e) => `<div class="effect"><strong>${esc(e.name)}</strong><p>${esc(e.description)}</p>${btn("解除", "remove-effect", `data-id="${c.id}" data-effect="${e.id}"`)}</div>`).join("")}${btn("＋ 状態・効果を追加", "add-effect", `data-id="${c.id}"`)}</details>${points(c, "fate", "運命点", false, true)}${points(c, "experience", "経験値", false, true)}${btn("キャラクター詳細", "detail", `data-id="${c.id}"`)}</article>`,
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
        ([k, l]) =>
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
  for (const k of Object.keys(bandLists)) draw(k);
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
      ([k, l]) =>
        `<h3>${l}</h3><ol>${s[k].map((item) => `<li class="detail-text">${esc(item.name) || "（未入力）"}</li>`).join("") || "<li>登録なし</li>"}</ol>`,
    )
    .join("")}`;
}
function battleStatus() {
  const g = data.game;
  show(
    `${g.status ? statusReadOnly(g.name, g.status, "ゲーム開始時の記録です。登録済みウォーバンドとは独立しています。") : "<h2>ウォーバンドステータス</h2><p>このゲームは旧形式のため、開始時のステータス記録はありません。</p>"}<details><summary>登録済みウォーバンドの現在のステータス</summary>${data.warbands.map((w) => `<details><summary>${esc(w.name)}</summary>${statusReadOnly(w.name, w.status, "登録済みの現在の内容です。")}</details>`).join("") || "<p>登録なし</p>"}</details>${btn("閉じる", "close")}`,
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
    `<h2>${c ? "キャラクター編集" : "キャラクター登録"}</h2><form id="character-form"><label>名前<input name="name" value="${esc(c?.name || "")}" required maxlength="200"></label><label>サイズ分類<select id="species-size"><option value="">サイズ分類を選択</option>${speciesGroups.map((g) => `<option value="${g.id}" ${g.id === acceptedGroup ? "selected" : ""}>${g.name}：${g.base}mmベース</option>`).join("")}</select></label><label>種族<select name="species" id="species-preset" required></select></label><section id="species-confirm" hidden role="alert"><h3>種族の初期値に置き換えますか？</h3><p>レベル・9能力値・スキル一覧を選択した種族の初期値に置き換えます。装備・呪文・写真・運命点・経験値は維持します。</p><div class="actions"><button type="button" id="species-apply">初期値に置き換える</button><button type="button" id="species-cancel">変更を取り消す</button></div></section><label>Level<input type="number" name="level" min="0" max="100" step="1" value="${c?.level ?? 0}" required></label><div id="photo-preview">${portrait({ photo, name: c?.name || "" })}</div><label>写真ライブラリ・ファイル<input id="photo-library" type="file" accept="image/*"></label><label>カメラで撮影<input id="photo-camera" type="file" accept="image/*" capture="environment"></label>${btn("写真を削除", "clear-photo")}<p class="muted">長辺 800px 以下に縮小して端末に保存します。</p>${points(c || {}, "fate", "運命点", true)}${points(c || {}, "experience", "経験値", true)}<h3>能力値</h3><div class="stats">${stats.map((s) => `<label>${s}<select name="${s}">${dice.map((d) => `<option ${c?.stats[s] === d ? "selected" : ""}>${d}</option>`).join("")}</select></label>`).join("")}</div><h3>装備</h3>${Object.entries(
      equipmentCategories,
    )
      .map(
        ([key, label]) =>
          `<label>${label}<input name="slot-${key}" maxlength="20000" value="${esc(inventory.equipmentSlots[key])}"></label>`,
      )
      .join(
        "",
      )}${c?.equipment ? `<details><summary>旧装備（未分類・原文）</summary><p class="muted">原文を保持しています。必要な装備を上の6枠へ手動で割り振ってください。</p><textarea readonly aria-label="旧装備の原文">${esc(c.equipment)}</textarea></details>` : ""}<section aria-label="スキル"><h3>スキル</h3><div id="character-skillEntries"></div>${btn("＋ スキル", "add-character-entry", 'data-list="skillEntries"')}</section><section aria-label="呪文"><h3>呪文</h3><div id="character-spellEntries"></div>${btn("＋ 呪文", "add-character-entry", 'data-list="spellEntries"')}</section><label>特殊効果・メモ<textarea name="notes" maxlength="20000">${esc(c?.notes || "")}</textarea></label><p id="form-error" class="error" role="alert"></p><div class="actions"><button id="character-save" class="primary">保存</button>${btn("キャンセル", "close")}</div></form>`,
  );
  const drawEntries = (key) => {
    const label = key === "skillEntries" ? "スキル" : "呪文",
      node = modal.querySelector("#character-" + key);
    node.innerHTML =
      inventory[key]
        .map(
          (text, i) =>
            `<div class="character-entry"><label>${label} ${i + 1}<textarea data-index="${i}" maxlength="20000">${esc(text)}</textarea></label>${btn("削除", "delete-character-entry", `data-index="${i}" aria-label="${label} ${i + 1} を削除"`)}</div>`,
        )
        .join("") || '<p class="muted">登録なし</p>';
    node.oninput = (e) => {
      if (e.target.dataset.index !== undefined)
        inventory[key][Number(e.target.dataset.index)] = e.target.value;
    };
    node.onclick = (e) => {
      const b = e.target.closest('[data-action="delete-character-entry"]');
      if (b) {
        inventory[key].splice(Number(b.dataset.index), 1);
        drawEntries(key);
      }
    };
  };
  for (const key of ["skillEntries", "spellEntries"]) drawEntries(key);
  for (const b of modal.querySelectorAll('[data-action="add-character-entry"]'))
    b.onclick = () => {
      const key = b.dataset.list;
      inventory[key].push("");
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
      equipmentSlots: Object.fromEntries(
        Object.keys(equipmentCategories).map((k) => [k, f.get("slot-" + k)]),
      ),
      skillEntries: structuredClone(inventory.skillEntries),
      spellEntries: structuredClone(inventory.spellEntries),
    };
    change(() => {
      if (c) band().characters[band().characters.indexOf(c)] = n;
      else band().characters.push(n);
    });
    modal.close();
  };
}
function detail(c, editable = false) {
  show(
    `<div class="row">${portrait(c)}<div><h2>${esc(c.name)}</h2><p>${esc(c.species)} · Lv.${c.level}</p></div></div><div class="stats">${stats.map((s) => `<div><span class="muted">${s}</span><br><strong>${esc(c.stats[s])}</strong></div>`).join("")}</div><h3>装備</h3><dl class="status-grid">${Object.entries(
      equipmentCategories,
    )
      .map(
        ([key, label]) =>
          `<div><dt>${label}</dt><dd class="detail-text">${esc(characterInventory(c).equipmentSlots[key]) || "—"}</dd></div>`,
      )
      .join(
        "",
      )}</dl>${c.equipment ? `<details><summary>旧装備（未分類・原文）</summary><p class="detail-text">${esc(c.equipment)}</p></details>` : ""}${[
      ["skillEntries", "スキル"],
      ["spellEntries", "呪文"],
    ]
      .map(
        ([key, label]) =>
          `<h3>${label}</h3><ol>${
            characterInventory(c)
              [key].map(
                (text) =>
                  `<li class="detail-text">${esc(text) || "（未入力）"}</li>`,
              )
              .join("") || "<li>登録なし</li>"
          }</ol>`,
      )
      .join(
        "",
      )}${c.skills || c.spells ? `<details><summary>移行前のスキル・呪文の原文</summary><h3>スキル</h3><p class="detail-text">${esc(c.skills)}</p><h3>呪文</h3><p class="detail-text">${esc(c.spells)}</p></details>` : ""}<h3>特殊効果・メモ</h3><p class="detail-text">${esc(c.notes) || "—"}</p>${editable ? btn("編集", "edit-character", `data-id="${c.id}"`) : ""}${btn("閉じる", "close")}`,
  );
}
function effectForm(c) {
  show(
    `<h2>状態・効果を追加</h2><p class="muted">効果は記録のみ。能力値やルールには自動適用しません。</p><form><label>名前<input name="name" required maxlength="200"></label><label>説明（任意）<textarea name="description" maxlength="20000"></textarea></label><div class="actions"><button class="primary">追加</button>${btn("キャンセル", "close")}</div></form>`,
  );
  modal.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      name = f.get("name").trim();
    if (!name) return;
    change(() =>
      c.effects.push({ id: id(), name, description: f.get("description") }),
    );
    modal.close();
  };
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
  switch (a) {
    case "close":
      modal.close();
      break;
    case "new-band":
      nameForm();
      break;
    case "open-band":
      bandId = b.dataset.id;
      render();
      break;
    case "close-band":
      bandId = undefined;
      render();
      break;
    case "roster-detail":
      detail(wc, true);
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
    case "detail":
      detail(c);
      break;
    case "add-effect":
      effectForm(c);
      break;
    case "remove-effect":
      change(
        () => (c.effects = c.effects.filter((x) => x.id !== b.dataset.effect)),
      );
      break;
    case "export":
      download();
      break;
    case "import":
      document.querySelector("#restore-file").click();
      break;
  }
});
document.addEventListener("change", (e) => {
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
