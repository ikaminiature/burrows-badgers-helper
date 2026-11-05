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
  validateData,
} from "./model.js";
import { read, write } from "./db.js";
const app = document.querySelector("#app"),
  modal = document.querySelector("#modal"),
  status = document.querySelector("#save-status");
let data,
  screen = "home",
  bandId,
  saveQueue = Promise.resolve(),
  failed = false,
  pending = 0;
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
    app.innerHTML = `<div class="hero"><div class="eyebrow">BURROWS & BADGERS · 2ND EDITION</div><h1>小さな戦士たちの、<br>次の冒険へ。</h1><p>ウォーバンドを整えて、卓上の戦いに集中。</p><div class="stack"><a class="button primary" href="#choose">ゲームを開始</a>${data.game ? `<a class="button" href="#battle">${esc(data.game.name)} · ラウンド ${data.game.round} を再開</a>` : ""}</div></div><h2>冒険の準備</h2><a class="button" href="#bands">ウォーバンドを管理（${data.warbands.length}）</a><section class="card"><h2>データのバックアップ</h2><p class="muted">データと写真はこの端末・ブラウザ内に保存されます。定期的に写真を含む JSON を保管してください。</p><div class="actions">${btn("JSON を書き出す", "export")}${btn("JSON から復元", "import")}</div><input id="restore-file" type="file" accept="application/json,.json" hidden></section><details class="card"><summary>オフラインで使う・ホーム画面に追加</summary><p>一度オンラインで開き、読み込みを終えてから使ってください。iPhone は Safari の共有メニューから「ホーム画面に追加」を選びます。</p><p class="muted">非公式の補助ツールです。ルールの自動判定は負傷管理のみ。ブラウザのデータ削除で保存内容が消えるため、バックアップを推奨します。</p></details>`;
  if (screen === "bands")
    app.innerHTML = `<div class="eyebrow">WARBANDS</div><h1>ウォーバンド管理</h1>${btn("＋ ウォーバンドを登録", "new-band", 'class="primary"')}${data.warbands.length ? data.warbands.map((w) => `<section class="card"><div class="row between"><div><h2>${esc(w.name)}</h2><span class="muted">${w.characters.length} キャラクター</span></div>${btn("開く", "open-band", `data-id="${w.id}"`)}</div></section>`).join("") : '<p class="empty">最初のウォーバンドを登録しましょう。</p>'}${band() ? bandView(band()) : ""}`;
  if (screen === "choose")
    app.innerHTML = `<div class="eyebrow">NEW GAME</div><h1>出陣するウォーバンド</h1>${data.game ? '<p class="muted">進行中のゲームがあります。新しく開始する場合は確認後に置き換えます。</p>' : ""}${data.warbands.map((w) => `<section class="card"><h2>${esc(w.name)}</h2><p>${w.characters.length} キャラクター</p>${btn("このウォーバンドで開始", "start", `class="primary" data-id="${w.id}" ${w.characters.length ? "" : "disabled"}`)}</section>`).join("") || '<p class="empty">ウォーバンドとキャラクターを登録してください。</p>'}<a class="button" href="#bands">ウォーバンド管理へ</a>`;
  if (screen === "battle")
    app.innerHTML = data.game
      ? battleView()
      : `<h1>戦闘管理</h1><p class="empty">進行中のゲームはありません。</p><a class="button primary" href="#choose">ゲームを開始</a>`;
}
function bandView(w) {
  return `<section class="card"><div class="row between"><h2>${esc(w.name)}</h2>${btn("名前変更", "rename-band")}</div><div class="actions">${btn("＋ キャラクター登録", "new-character", 'class="primary"')}${btn("ウォーバンド削除", "delete-band", 'class="danger"')}</div></section>${w.characters.map((c, i) => `<article class="card"><div class="row">${portrait(c)}<div class="identity"><h3>${esc(c.name)}</h3><span class="muted">${esc(c.species)} · Lv.${c.level}</span></div></div><div class="actions">${btn("編集", "edit-character", `data-id="${c.id}"`)}${btn("複製", "duplicate", `data-id="${c.id}"`)}${btn("↑", "up", `data-id="${c.id}" aria-label="${esc(c.name)}を上へ" ${i === 0 ? "disabled" : ""}`)}${btn("↓", "down", `data-id="${c.id}" aria-label="${esc(c.name)}を下へ" ${i === w.characters.length - 1 ? "disabled" : ""}`)}${btn("削除", "delete-character", `data-id="${c.id}" class="danger"`)}</div></article>`).join("")}`;
}
function battleView() {
  const g = data.game;
  return `<div class="eyebrow">BATTLE</div><div class="row between"><div><h1>${esc(g.name)}</h1><p>ラウンド <strong>${g.round}</strong></p></div>${btn("次のラウンド", "next", 'class="primary"')}</div><p class="muted">操作は自動保存。ホームに戻っても続きから再開できます。</p>${sorted(
    g.characters,
  )
    .map(
      (c) =>
        `<article class="card battle ${c.acted ? "acted" : ""} ${c.wounds === 17 ? "out" : ""}"><div class="row">${portrait(c)}<div class="identity"><h3>${esc(c.name)}</h3><span class="muted">${esc(c.species)}</span></div><span class="badge">${c.wounds === 17 ? "戦闘不能" : c.acted ? "行動済み" : "未行動"}</span></div><div class="row between"><div><span class="wound-count">${c.wounds}</span> / 17 <span class="muted">負傷</span></div><strong>ペナルティ ${penalty(c.wounds)}</strong></div><div class="gauge" role="img" aria-label="負傷 ${c.wounds} / 17">${Array.from({ length: 17 }, (_, i) => `<span class="pip ${[4, 7, 10, 13].includes(i + 1) ? "threshold" : ""} ${i === 16 ? "last" : ""} ${i < c.wounds ? "filled" : ""}">${i + 1}</span>`).join("")}</div><div class="row between"><div class="row wound-controls">${btn("−1", "minus", `data-id="${c.id}" aria-label="${esc(c.name)}の負傷を1減らす" ${c.wounds === 0 ? "disabled" : ""}`)}${btn("＋1", "plus", `data-id="${c.id}" aria-label="${esc(c.name)}の負傷を1増やす" ${c.wounds === 17 ? "disabled" : ""}`)}</div><label class="check"><input type="checkbox" data-acted="${c.id}" ${c.acted ? "checked" : ""} ${c.wounds === 17 ? "disabled" : ""}>行動済み</label></div><details><summary>状態・効果（${c.effects.length}）</summary>${c.effects.map((e) => `<div class="effect"><strong>${esc(e.name)}</strong><p>${esc(e.description)}</p>${btn("解除", "remove-effect", `data-id="${c.id}" data-effect="${e.id}"`)}</div>`).join("")}${btn("＋ 状態・効果を追加", "add-effect", `data-id="${c.id}"`)}</details>${btn("キャラクター詳細", "detail", `data-id="${c.id}"`)}</article>`,
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
        const n = { id: id(), name, characters: [] };
        data.warbands.push(n);
        bandId = n.id;
      }
    });
    modal.close();
  };
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
  show(
    `<h2>${c ? "キャラクター編集" : "キャラクター登録"}</h2><form id="character-form"><label>名前<input name="name" value="${esc(c?.name || "")}" required maxlength="200"></label><label>種族<input name="species" value="${esc(c?.species || "")}" maxlength="200"></label><label>Level<input type="number" name="level" min="0" max="100" step="1" value="${c?.level ?? 0}" required></label><div id="photo-preview">${portrait({ photo, name: c?.name || "" })}</div><label>写真ライブラリ・ファイル<input id="photo-library" type="file" accept="image/*"></label><label>カメラで撮影<input id="photo-camera" type="file" accept="image/*" capture="environment"></label>${btn("写真を削除", "clear-photo")}<p class="muted">長辺 800px 以下に縮小して端末に保存します。</p><h3>能力値</h3><div class="stats">${stats.map((s) => `<label>${s}<select name="${s}">${dice.map((d) => `<option ${c?.stats[s] === d ? "selected" : ""}>${d}</option>`).join("")}</select></label>`).join("")}</div>${[
      ["equipment", "装備"],
      ["skills", "スキル"],
      ["spells", "呪文"],
      ["notes", "特殊効果・メモ"],
    ]
      .map(
        ([key, label]) =>
          `<label>${label}<textarea name="${key}" maxlength="20000">${esc(c?.[key] || "")}</textarea></label>`,
      )
      .join(
        "",
      )}<p id="form-error" class="error" role="alert"></p><div class="actions"><button id="character-save" class="primary">保存</button>${btn("キャンセル", "close")}</div></form>`,
  );
  const preview = () =>
    (modal.querySelector("#photo-preview").innerHTML = portrait({
      photo,
      name: c?.name || "",
    }));
  let processing = false;
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
        modal.querySelector("#character-save").disabled = false;
      }
    };
  modal.querySelector("[data-action=clear-photo]").onclick = () => {
    photo = "";
    preview();
  };
  modal.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    if (processing) return;
    const f = new FormData(e.target),
      name = f.get("name").trim();
    if (!name) return;
    const n = {
      id: c?.id || id(),
      name,
      species: f.get("species").trim(),
      level: Number(f.get("level")),
      photo,
      stats: Object.fromEntries(stats.map((s) => [s, f.get(s)])),
      ...Object.fromEntries(
        ["equipment", "skills", "spells", "notes"].map((k) => [k, f.get(k)]),
      ),
    };
    change(() => {
      if (c) band().characters[band().characters.indexOf(c)] = n;
      else band().characters.push(n);
    });
    modal.close();
  };
}
function detail(c) {
  show(
    `<div class="row">${portrait(c)}<div><h2>${esc(c.name)}</h2><p>${esc(c.species)} · Lv.${c.level}</p></div></div><div class="stats">${stats.map((s) => `<div><span class="muted">${s}</span><br><strong>${esc(c.stats[s])}</strong></div>`).join("")}</div>${[
      ["equipment", "装備"],
      ["skills", "スキル"],
      ["spells", "呪文"],
      ["notes", "特殊効果・メモ"],
    ]
      .map(
        ([k, l]) =>
          `<h3>${l}</h3><p class="detail-text">${esc(c[k]) || "—"}</p>`,
      )
      .join("")}${btn("閉じる", "close")}`,
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
    const incoming = validateData(JSON.parse(await file.text()));
    confirmAction(
      "バックアップを復元",
      "現在の全ウォーバンドと進行中のゲームを置き換えます。先にバックアップを保管してください。",
      async () => {
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
  data = (await read()) || emptyData();
  validateData(data);
  status.textContent = "端末に保存済み";
  navigate();
} catch {
  app.innerHTML =
    "<h1>データを読み込めません</h1><p>Safari のストレージ設定・空き容量を確認し、再読み込みしてください。保存データは変更していません。</p>";
  status.textContent = "保存機能を利用できません";
}
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {
    status.textContent += " · オフライン準備失敗";
  });
