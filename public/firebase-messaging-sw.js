// Firebase Messaging & Web Push Service Worker
self.addEventListener('push', function(event) {
  var title = 'MOMO Fleet Alert';
  var body = 'New notification received';
  var type = 'ALERT';
  var targetUrl = '/';

  try {
    if (event.data) {
      var payload = event.data.json();

      // Extract title and body from nested notification object or root
      if (payload.notification) {
        title = payload.notification.title || title;
        body = payload.notification.body || body;
      } else {
        title = payload.title || title;
        body = payload.body || body;
      }

      // Extract metadata
      if (payload.data) {
        type = payload.data.type || type;
        targetUrl = payload.data.url || targetUrl;
      } else {
        type = payload.type || type;
        targetUrl = payload.url || targetUrl;
      }
    }
  } catch (e) {
    if (event.data) {
      body = event.data.text();
    }
  }

  // Minimal options letting iOS handle native styling and app icon
  var options = {
    body: body,
    tag: type || 'momo-alert',
    renotify: true,
    data: {
      url: targetUrl
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});