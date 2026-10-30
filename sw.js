const CACHE = 'everest-5x5-v9';

const PRECACHE = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './src/config.js',
  './src/db.js',
  './src/defaults.js',
  './src/auth.js',
  './src/coach.js',
  './src/stages.js',
  './src/utils.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // درخواست‌های Supabase همیشه آنلاین
  if (req.url.includes('supabase.co')) return;

  // صفحه‌ها: شبکه اول. اگر نسخه قدیمی HTML/JS از کش بیاید، لینک ورود
  // (که توکن را در hash دارد) با کد قدیمی پردازش می‌شود و کاربر وارد نمی‌شود.
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
