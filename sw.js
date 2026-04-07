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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.origin !== location.origin) return;
  
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
  
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// ========== ОБРАБОТЧИК PUSH-УВЕДОМЛЕНИЙ (С КНОПКОЙ) ==========
self.addEventListener('push', (event) => {
  let data = { title: 'Новое уведомление', body: '', reminderId: null };
  
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
    data: { reminderId: data.reminderId }
  };
  
  // Добавляем кнопку "Отложить" только если это напоминание
  if (data.reminderId) {
    options.actions = [
      { action: 'snooze', title: '⏰ Отложить на 5 минут' }
    ];
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ========== ОБРАБОТЧИК КЛИКА ПО УВЕДОМЛЕНИЮ (С КНОПКОЙ) ==========
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  
  if (action === 'snooze') {
    const reminderId = notification.data.reminderId;
    
    event.waitUntil(
      fetch(`http://localhost:3001/snooze?reminderId=${reminderId}`, { 
        method: 'POST' 
      })
        .then(() => {
          console.log('✅ Напоминание отложено на 5 минут');
          notification.close();
        })
        .catch(err => {
          console.error('❌ Ошибка откладывания:', err);
          notification.close();
        })
    );
  } else {
    // При клике на само уведомление открываем приложение
    event.waitUntil(
      clients.openWindow('/')
    );
    notification.close();
  }
});