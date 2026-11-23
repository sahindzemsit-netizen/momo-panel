/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import { type PrecacheEntry, Serwist } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  // eslint-disable-next-line no-underscore-dangle
  __SW_MANIFEST: (string | PrecacheEntry)[] | undefined;
};

// Filter runtime caching to strictly avoid intercepting Firestore, Firebase Auth, and Google streaming APIs.
// This ensures teammates' PCs connect directly to Firestore at maximum speed without worker latency or timeouts.
const safeRuntimeCaching = (defaultCache || []).filter((entry: any) => {
  const cacheName = entry.handler?.cacheName || '';
  if (cacheName === 'cross-origin' || cacheName === 'others') {
    return false;
  }
  return true;
}).map((entry: any) => {
  const originalMatcher = entry.matcher;
  return {
    ...entry,
    matcher: (options: any) => {
      const url = options.url ? (typeof options.url === 'string' ? options.url : options.url.href) : '';
      if (
        url.includes('firestore.googleapis.com') ||
        url.includes('googleapis.com') ||
        url.includes('firebaseapp.com') ||
        url.includes('identitytoolkit') ||
        url.includes('/api/push')
      ) {
        return false; // Bypass worker entirely so browser fetches Firestore directly at full speed
      }
      return typeof originalMatcher === 'function' ? originalMatcher(options) : originalMatcher.test(url);
    }
  };
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    concurrency: 10,
    cleanOnStart: true,
  },
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: safeRuntimeCaching,
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Background Push Notification handler (wakes locked phone screen on iOS 16.4+ and Android with FULL details)
self.addEventListener("push", (event: PushEvent) => {
  let data: Record<string, any> = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "New fleet alert" };
  }

  // Extract full details from nested notification, root, or data object
  const title = (data.notification && data.notification.title) || data.title || (data.data && data.data.title) || "MOMO FLEET";
  const body = (data.notification && data.notification.body) || data.body || (data.data && data.data.body) || "New fleet alert";
  const color = data.color || (data.data && data.data.color) || 'orange';
  const icon = color === 'green' ? '/paidoutlay.png' : color === 'red' ? '/violation.png' : '/android-chrome-192x192.png';
  
  const options: NotificationOptions = {
    body,
    icon,
    badge: "/favicon-32x32.png",
    tag: data.tag || (data.data && data.data.type) || `momo-${Date.now()}`,
    data: { url: (data.data && data.data.url) || data.url || "/" },
    requireInteraction: true,
  } as any;

  // Increment App Badge when push is received while phone is locked
  if ("setAppBadge" in navigator) {
    const unread = Number(data.badgeCount || (data.data && data.data.badgeCount)) || 1;
    (navigator as any).setAppBadge(unread).catch(() => {});
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle clicking on the lock-screen notification banner
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  if ("clearAppBadge" in navigator) {
    (navigator as any).clearAppBadge().catch(() => {});
  }

  const urlToOpen = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

serwist.addEventListeners();
