// Service worker: guarda a "casca" do app para abrir rápido e funcionar offline.
const CACHE = 'zaplivre-v3';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest', '/icons/icon.svg', '/socket.io/socket.io.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    if (url.pathname === '/socket.io/socket.io.js') {
      event.respondWith(caches.match(event.request).then((r) => r || fetch(event.request)));
    }
    return;
  }
  // Rede primeiro, cache como reserva.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match('/index.html')))
  );
});

// Aviso com o aplicativo fechado. Este é o único caminho pelo qual o navegador
// entrega notificação em segundo plano; sem ele a mensagem só aparece quando a
// pessoa abre o aplicativo de novo.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text?.() || '' }; }
  const title = data.title || 'ZapLivre';
  const options = {
    body: data.body || 'Nova mensagem',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Avisos da mesma conversa se substituem, em vez de empilhar vinte.
    tag: data.tag || 'zaplivre',
    renotify: true,
    data: { chatId: data.chatId || null, messageId: data.messageId || null },
  };
  event.waitUntil(
    self.registration.showNotification(title, options).then(() => updateBadge())
  );
});

async function updateBadge() {
  if (!self.navigator?.setAppBadge) return;
  try {
    const list = await self.registration.getNotifications();
    await self.navigator.setAppBadge(list.length);
  } catch { /* ignora */ }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  const target = chatId ? `/?chat=${encodeURIComponent(chatId)}` : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          // Aplicativo já aberto: pede para abrir a conversa sem recarregar.
          c.postMessage({ type: 'open-chat', chatId });
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
