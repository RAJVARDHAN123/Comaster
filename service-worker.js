// Cache key and files (optional, if you want offline PWA assets)
const CACHE_NAME = 'comaster-v1';
const OFFLINE_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install service worker and cache core files
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_FILES))
  );
});

// Activate and clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Optional: Serve cached files offline
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ✅ Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
      // If already open, focus it
      const appClient = clientsArr.find(client => client.url === '/' && 'focus' in client);
      if (appClient) return appClient.focus();

      // Otherwise, open a new tab
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// ✅ Background sync for clipboard
self.addEventListener('sync', event => {
  if (event.tag === 'clipboard-sync') {
    event.waitUntil(syncClipboard());
  }
});

async function syncClipboard() {
  const dbOpen = indexedDB.open("ClipboardSync", 1);
  dbOpen.onsuccess = () => {
    const db = dbOpen.result;
    const tx = db.transaction("clipboard-buffer", "readonly");
    const store = tx.objectStore("clipboard-buffer");
    const getReq = store.get("pending");
    getReq.onsuccess = async () => {
      const text = getReq.result;
      if (!text) return;
      try {
        const deviceName = await self.clients.matchAll().then(clientsArr =>
          clientsArr[0]?.url.includes("username=") ? new URL(clientsArr[0].url).searchParams.get("username") : null
        );
        if (!deviceName) return;

        await fetch(`https://comaster-fd3fe-default-rtdb.firebaseio.com/devices/${deviceName}/clipboard.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(text)
        });

        // Clear the buffer after success
        const txDel = db.transaction("clipboard-buffer", "readwrite");
        txDel.objectStore("clipboard-buffer").delete("pending");
      } catch (err) {
        console.error("Sync failed", err);
      }
    };
  };
}
