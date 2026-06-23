const CACHE = 'flashcards-v4';
const APP_SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'cards.json',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
];

// On install, fetch cards.json and pre-cache every MP3 the deck references
// so the app keeps working offline even for words the user hasn't played.
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_SHELL);
    try {
      const res = await fetch('cards.json', { cache: 'no-cache' });
      const cards = await res.json();
      const audio = [...new Set(cards.map((c) => c.audio).filter(Boolean))];
      await cache.addAll(audio);
    } catch (_) {
      // Audio pre-cache is best-effort — runtime fetches will fill it in.
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: try the network, fall back to cache when offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
