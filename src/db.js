const opened = new Promise((resolve, reject) => {
  const r = indexedDB.open("bb-helper", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("data");
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});
export async function read() {
  const db = await opened;
  return new Promise((resolve, reject) => {
    const r = db.transaction("data").objectStore("data").get("app");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function write(data) {
  const db = await opened;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("data", "readwrite");
    tx.objectStore("data").put(data, "app");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
