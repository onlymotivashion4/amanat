const DB = "amanat";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("images")) db.createObjectStore("images");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function emptyState() {
  return { version: 1, items: [], license: null };
}

export async function loadState() {
  try {
    const db = await openDb();
    const saved = await request(db.transaction("kv").objectStore("kv").get("state"));
    db.close();
    if (!saved || !Array.isArray(saved.items)) return emptyState();
    return saved;
  } catch {
    return emptyState();
  }
}

export async function saveState(state) {
  const db = await openDb();
  await request(db.transaction("kv", "readwrite").objectStore("kv").put(state, "state"));
  db.close();
}

export async function putImage(id, blob) {
  const db = await openDb();
  await request(db.transaction("images", "readwrite").objectStore("images").put(blob, id));
  db.close();
}

export async function getImage(id) {
  if (!id) return null;
  const db = await openDb();
  const blob = await request(db.transaction("images").objectStore("images").get(id));
  db.close();
  return blob || null;
}

export async function deleteImage(id) {
  if (!id) return;
  const db = await openDb();
  await request(db.transaction("images", "readwrite").objectStore("images").delete(id));
  db.close();
}
