const CACHE_NAME = "clipboard-sync-v1";
const URLS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// Standard caching
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

// Background clipboard sync using SyncManager
self.addEventListener("sync", event => {
  if (event.tag === "clipboard-sync") {
    event.waitUntil(syncClipboard());
  }
});

// Example clipboard sync function
async function syncClipboard() {
  try {
    const dbText = await readFromIndexedDB("clipboard-buffer", "pending");
    if (!dbText) return;

    const firebaseApp = await import("https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js");
    const database = await import("https://www.gstatic.com/firebasejs/9.22.1/firebase-database-compat.js");

    const firebaseConfig = {
      apiKey: "your-key",
      authDomain: "your-project.firebaseapp.com",
      projectId: "your-id",
      databaseURL: "https://your-project.firebaseio.com",
      appId: "your-app-id"
    };
    firebaseApp.initializeApp(firebaseConfig);

    const db = database.getDatabase();
    const ref = database.ref(db, "/clipboard");
    await database.set(ref, { text: dbText, updated: Date.now() });

    await clearFromIndexedDB("clipboard-buffer", "pending");
    console.log("✅ Clipboard sync completed");
  } catch (err) {
    console.error("❌ Clipboard sync failed", err);
  }
}

// IndexedDB helpers
function readFromIndexedDB(storeName, key) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("ClipboardSync", 1);
    open.onupgradeneeded = () => open.result.createObjectStore(storeName);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const get = store.get(key);
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    };
    open.onerror = () => reject(open.error);
  });
}

function clearFromIndexedDB(storeName, key) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("ClipboardSync", 1);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const del = store.delete(key);
      del.onsuccess = () => resolve();
      del.onerror = () => reject(del.error);
    };
  });
}
