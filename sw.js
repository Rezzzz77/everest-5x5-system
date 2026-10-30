const CACHE = 'everest-5x5-v12';

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
  './src/ai.js',
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

  // درخواست‌های Supabase و DeepSeek همیشه آنلاین
  if (req.url.includes('supabase.co') || req.url.includes('deepseek.com')) return;

  // صفحه‌ها و اسکریپت‌ها: شبکه اول. اگر نسخه جدید در دسترس است فوراً اجرا شود،
  // و فقط در صورت آفلاین بودن از کش استفاده شود.
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  const isScript = req.destination === 'script' || req.url.endsWith('.js') || req.url.includes('.js?');

  if (isHTML || isScript) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then(c => c || (isHTML ? caches.match('./index.html') : null)))
    );
    return;
  }

  // سایر منابع (تصاویر، آیکون‌ها و ...): کش اول با پس‌زمینه به‌روزرسانی
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
