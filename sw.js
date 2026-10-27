/**
 * Service Worker для PWA «С-АСА КОНСАЛТИНГ» (https://s-asa.com.ua/)
 */

const CACHE_VERSION = 's-asa-v1.0.1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Основні ресурси сайту разом із кастомною сторінкою 404 для роботи офлайн
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/404.html',
    '/site.webmanifest',
    '/LOGO.png',
    '/bas-service.jpg'
];

// 1. ВСТАНОВЛЕННЯ: кешування базових файлів та миттєва активація
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// 2. АКТИВАЦІЯ: видалення застарілих кешів попередніх версій
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== STATIC_CACHE)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// 3. ПЕРЕХОПЛЕННЯ ЗАПИТІВ (FETCH)
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Ігноруємо всі не-GET запити (зокрема POST-відправку контактної форми)
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Ігноруємо сторонні домени (крім Google Fonts)
    const isSameOrigin = url.origin === self.location.origin;
    const isGoogleFonts = url.origin === 'https://fonts.googleapis.com' ||
                          url.origin === 'https://fonts.gstatic.com';

    if (!isSameOrigin && !isGoogleFonts) return;

    // СТРАТЕГІЯ 1: Network-First для HTML-сторінок та навігації
    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    // Якщо сторінка успішно знайдена в мережі — повертаємо її
                    return networkResponse;
                })
                .catch(async () => {
                    // Офлайн-режим: спробуємо знайти точний запитуваний файл у кеші
                    const cache = await caches.open(STATIC_CACHE);
                    const cachedResponse = await cache.match(request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Якщо сторінки немає в кеші (реальна 404 офлайн) — віддаємо нашу кастомну 404.html
                    return cache.match('/404.html');
                })
        );
        return;
    }

    // СТРАТЕГІЯ 2: Stale-While-Revalidate для зображень, маніфесту та шрифтів Google
    event.respondWith(
        caches.open(STATIC_CACHE).then(async (cache) => {
            const cachedResponse = await cache.match(request);

            const networkFetch = fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                        cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                })
                .catch(() => cachedResponse);

            return cachedResponse || networkFetch;
        })
    );
});