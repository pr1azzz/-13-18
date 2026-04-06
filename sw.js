const STATIC_CACHE = 'app-shell-v2';
const DYNAMIC_CACHE = 'dynamic-content-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/sw.js',
  '/manifest.json',
  '/icons/icon-48x48.png',
  '/icons/icon-128x128.png',
  '/icons/icon-512x512.png'
];

// Установка — кэшируем App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Активация — чистим старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — разная стратегия для статики и контента
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Пропускаем запросы к CDN (chota.css)
  if (url.origin !== location.origin) {
    return;
  }

  // Динамический контент (content/*) — Network First
  if (url.pathname.startsWith('/content/')) {
    event.respondWith(
      fetch(event.request)
        .then(networkRes => {
          const resClone = networkRes.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, resClone);
          });
          return networkRes;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cached => cached || caches.match('/content/home.html'));
        })
    );
    return;
  }

  // Статические ресурсы — Cache First (из App Shell)
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
// ========== ОБРАБОТЧИК PUSH-УВЕДОМЛЕНИЙ ==========
self.addEventListener('push', (event) => {
  let data = { title: 'Новое уведомление', body: '' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: '/icons/icon-128x128.png',
    badge: '/icons/icon-48x48.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Обработчик клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});