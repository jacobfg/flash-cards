const CACHE = 'flashcards-v5';
const APP_SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'cards.json',
  'manifest.webmanifest',
];

// Cross-origin assets (Duolingo CDN audio + avatar) come back as opaque
// responses if CORS is closed, but they still cache and play. Fetch them
// individually so a single 404 or CORS hiccup doesn't abort the whole batch.
async function precacheRemote(cache, urls) {
  await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url, { mode: 'no-cors' });
      await cache.put(url, res);
    } catch (_) {
      // Best-effort — runtime fetch handler will fill the cache on first play.
    }
  }));
}

// On install, fetch cards.json and pre-cache every Duo audio URL plus the
// avatar so the deck plays offline even before the user taps anything.
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_SHELL);
    try {
      const res = await fetch('cards.json', { cache: 'no-cache' });
      const data = await res.json();
      const cards = Array.isArray(data) ? data : (data.cards || []);
      const remote = [
        ...new Set(cards.map((c) => c.audioURL).filter(Boolean)),
      ];
      const avatarURL = !Array.isArray(data) && data.user?.avatarURL;
      if (avatarURL) remote.push(avatarURL);
      await precacheRemote(cache, remote);
    } catch (_) {}
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
