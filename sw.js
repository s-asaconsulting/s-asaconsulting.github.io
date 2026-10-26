const CACHE_NAME = 's-asa-cache-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/site.webmanifest',
    '/LOGO.png',
    '/bas-service.jpg'
];

// 1. Встановлення Service Worker та кешування базових файлів
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Активація та автоматичне видалення старих версій кешу
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Обробка запитів: спочатку мережа (актуальні дані), при відсутності зв'язку — кеш
self.addEventListener('fetch', (event) => {
    // Ігноруємо POST-запити (відправка контактної форми) та зовнішні трекери
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Оновлюємо кеш свіжою копією файлу
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return networkResponse;
            })
            .catch(() => {
                // Якщо інтернет відсутній — віддаємо збережену версію з кешу
                return caches.match(event.request);
            })
    );
});