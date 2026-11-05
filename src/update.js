// Service Worker updates never clear application data. Every controlled tab
// waits for its own IndexedDB operations before reloading on controllerchange.
export function createUpdater({ beforeReload, busy }) {
  let registration,
    waiting,
    checking = false,
    applying = false,
    reloading = false;
  let controlled = !!navigator.serviceWorker?.controller;
  let message = "オンラインでアプリの最新版を確認できます。";
  const supported = "serviceWorker" in navigator;
  const html = () =>
    `<section class="card" id="app-update"><h2>アプリの更新</h2><p id="update-status" role="status">${message}</p><div class="actions"><button type="button" data-update-check ${!supported || checking || applying ? "disabled" : ""}>最新版を確認</button>${waiting ? `<button type="button" class="primary" data-update-apply ${applying ? "disabled" : ""}>更新する</button>` : ""}</div></section>`;
  const paint = () => {
    const node = document.querySelector("#app-update");
    if (node) node.outerHTML = html();
  };
  const set = (text) => {
    message = text;
    paint();
  };
  const installed = (worker) =>
    new Promise((resolve, reject) => {
      let timer;
      const done = () => {
        if (["installed", "activated", "redundant"].includes(worker.state)) {
          clearTimeout(timer);
          worker.removeEventListener("statechange", done);
          worker.state === "redundant"
            ? reject(Error("install failed"))
            : resolve();
        }
      };
      worker.addEventListener("statechange", done);
      timer = setTimeout(() => {
        worker.removeEventListener("statechange", done);
        reject(Error("install timeout"));
      }, 30000);
      done();
    });
  const detect = () => {
    waiting = registration?.waiting;
    if (waiting)
      set("新しいバージョンがあります。保存を完了してから更新します。");
  };
  const ready = supported
    ? navigator.serviceWorker
        .register("./sw.js", { updateViaCache: "none" })
        .then((r) => {
          registration = r;
          detect();
          r.addEventListener("updatefound", () => {
            const worker = r.installing;
            if (worker)
              installed(worker)
                .then(detect)
                .catch(() =>
                  set(
                    "更新ファイルを取得できませんでした。オンラインで再試行してください。",
                  ),
                );
          });
          return r;
        })
        .catch(() => {
          set(
            "更新機能を準備できませんでした。オンラインで再試行してください。",
          );
          return null;
        })
    : Promise.resolve(null);
  async function check() {
    if (checking || applying) return;
    if (!navigator.onLine) {
      set("オフラインです。オンラインになってから最新版を確認してください。");
      return;
    }
    checking = true;
    set("最新版を確認中…");
    try {
      registration =
        (await ready) ||
        (await navigator.serviceWorker.register("./sw.js", {
          updateViaCache: "none",
        }));
      if (!registration) throw Error("unavailable");
      await registration.update();
      if (registration.installing) await installed(registration.installing);
      waiting = registration.waiting;
      set(waiting ? "新しいバージョンがあります。" : "現在、最新版です");
    } catch {
      set(
        navigator.onLine
          ? "更新を確認できませんでした。通信状態を確認して再試行してください。"
          : "オフラインです。オンラインになってから最新版を確認してください。",
      );
    } finally {
      checking = false;
      paint();
    }
  }
  async function reload() {
    if (reloading) return;
    reloading = true;
    applying = true;
    busy(true);
    set("保存完了を待って更新しています…");
    try {
      await beforeReload();
      location.reload();
    } catch {
      reloading = false;
      applying = false;
      busy(false);
      set(
        "保存が完了していないため再読み込みを中止しました。データをバックアップしてから再試行してください。",
      );
    }
  }
  async function apply() {
    if (applying) return;
    waiting = registration?.waiting;
    if (!waiting) {
      await reload();
      return;
    }
    applying = true;
    busy(true);
    set("保存完了を待って更新しています…");
    try {
      await beforeReload();
      waiting.postMessage({ type: "SKIP_WAITING" });
      setTimeout(() => {
        if (applying && !reloading) {
          applying = false;
          busy(false);
          set("更新の反映を確認できませんでした。再試行してください。");
        }
      }, 15000);
    } catch {
      applying = false;
      busy(false);
      set(
        "保存が完了していないため更新を中止しました。データをバックアップしてから再試行してください。",
      );
    }
  }
  if (supported)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!controlled) {
        controlled = true;
        return;
      }
      reload();
    });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-update-check]")) check();
    if (e.target.closest("[data-update-apply]")) apply();
  });
  if (!supported)
    message =
      "このブラウザでは更新確認を利用できません。HTTPSで開いてください。";
  return { html };
}
