// =====================================================================
// SERVICE WORKER ДЛЯ S-ASA.COM.UA (OFFLINE-READY + SMART CACHE)
// =====================================================================

const CACHE_VERSION = 'sasa-pwa-v1.0.0';

// Обов'язковий набір файлів для миттєвої роботи офлайн
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/LOGO.png',
  '/bas-service.jpg'
];

// 1. ВСТАНОВЛЕННЯ (INSTALL): Кешуємо базові файли та активуємо воркер без очікування
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 2. АКТИВАЦІЯ (ACTIVATE): Видаляємо старі версії кешу та беремо під контроль відкриті вкладки
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('sasa-pwa-') && name !== CACHE_VERSION)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. ПЕРЕХОПЛЕННЯ ЗАПИТІВ (FETCH)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 3.1. Ігноруємо всі не-GET запити (критично для роботи форми formsubmit.co)
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 3.2. Пропускаємо сторонні домени, окрім шрифтів Google Fonts
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFonts = url.origin === 'https://fonts.googleapis.com' || 
                        url.origin === 'https://fonts.gstatic.com';

  if (!isSameOrigin && !isGoogleFonts) {
    return;
  }

  // 3.3. Стратегія NETWORK-FIRST для головної сторінки (HTML)
  // Завжди тягнемо свіжу версію з сервера; якщо немає мережі — беремо з кешу
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(request, responseClone);
              cache.put('/', responseClone.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          return cachedPage || caches.match('/') || caches.match('/index.html');
        })
    );
    return;
  }

  // 3.4. Стратегія STALE-WHILE-REVALIDATE для зображень, маніфесту та шрифтів
  // Віддаємо миттєво з кешу та паралельно оновлюємо у фоні
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});