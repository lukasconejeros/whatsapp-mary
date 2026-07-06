// Service Worker de Arteluk: recibe el Web Push (app cerrada) y muestra la
// notificación; al tocarla, abre o enfoca la app en el chat.

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const titulo = data.titulo || 'Arteluk';
  const cuerpo = data.cuerpo || 'Tienes un mensaje nuevo';
  const url = data.url || '/inbox';
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url },
      // Un tag por conversación: avisos de clientes distintos NO se reemplazan.
      tag: data.tag || ('arteluk-' + Math.random().toString(36).slice(2)),
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/inbox';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          if ('navigate' in c) { try { c.navigate(url); } catch (e) { /* noop */ } }
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
