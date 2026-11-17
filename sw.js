// Service worker: сайт открывается без интернета, а при наличии сети всегда грузится свежая версия.
// Ещё он показывает push-уведомления, которые присылает робот синхронизации с Jira.
const CACHE = 'questlog-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Запросы к GitHub API и шрифтам идут напрямую, без кэша
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});

// Уведомление от робота: { title, body, url, tag }
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Квест-лог', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || undefined,
    data: { url: d.url || (self.registration.scope + '#work') }
  }));
});

// Нажатие на уведомление: открыть задачу в Jira или вкладку «Работа»
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || (self.registration.scope + '#work');
  e.waitUntil((async () => {
    if (url.indexOf(self.registration.scope) === 0) {
      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of list) {
        if (c.url.indexOf(self.registration.scope) === 0 && 'focus' in c) { await c.focus(); if ('navigate' in c) await c.navigate(url); return; }
      }
    }
    await self.clients.openWindow(url);
  })());
});
