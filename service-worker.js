// Cache key and files (optional, if you want offline PWA assets)
const CACHE_NAME = 'comaster-v1';
const OFFLINE_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('[SW] Installed');
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
  console.log('[SW] Activated');
});

self.addEventListener('periodicsync', async (event) => {
  if (event.tag === 'clipboard-sync') {
    event.waitUntil(syncClipboard());
  }
});

async function syncClipboard() {
  const cacheKey = 'clipboard-last-value';
  const username = await getStoredUsername();

  if (!username) return;

  const response = await fetch(`https://comaster-fd3fe-default-rtdb.firebaseio.com/devices/${username}/clipboard.json`);
  const clipboardText = await response.text();

  const cache = await caches.open('clipboard-cache');
  const last = await cache.match(cacheKey);
  const lastValue = last ? await last.text() : null;

  if (clipboardText && clipboardText !== lastValue && clipboardText !== '"') {
    // Show notification
    self.registration.showNotification("📋 Clipboard Synced", {
      body: `Copied: ${clipboardText.replace(/"/g, '')}`,
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: 'clipboard-notify'
    });

    // Update stored value
    await cache.put(cacheKey, new Response(clipboardText));
  }
}

async function getStoredUsername() {
  const cache = await caches.open('clipboard-cache');
  const match = await cache.match('username');
  return match ? await match.text() : null;
}

self.addEventListener('message', event => {
  if (event.data?.type === 'SAVE_USERNAME') {
    caches.open('clipboard-cache').then(cache => {
      cache.put('username', new Response(event.data.username));
    });
  }
});
