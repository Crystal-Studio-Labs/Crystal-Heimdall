// Uptime Tracker Sentinel Service Worker
const CACHE_NAME = "crystal-uptime-v3";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon-192.svg",
  "/icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Never cache API routes or telemetry conduits - always live network
  if (event.request.url.includes("/api/")) {
    return;
  }

  const url = new URL(event.request.url);

  // Cache-First for static bundles, hashed Vite assets, fonts & SVGs
  if (url.pathname.startsWith("/assets/") || url.hostname.includes("fonts.g") || url.pathname.endsWith(".svg") || url.pathname.endsWith(".png")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Network-First with offline fallback for navigation and HTML documents
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === "GET") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/index.html");
          }
        });
      })
  );
});

// Push & In-App Notification Handler for Mobile & Desktop Sentinel
self.addEventListener("push", (event) => {
  let data = { title: "Telemetry Alert", body: "Service outage detected" };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || "A monitored system dropped offline. Tap to triage.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [600, 200, 600, 200, 1000, 300, 800],
    tag: data.tag || "heimdall-outage-alert",
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || "/dashboard", timestamp: Date.now() },
    actions: [
      { action: "explore", title: "[VIEW SENTINEL]" },
      { action: "silence", title: "[SILENCE ALARM]" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "CRITICAL OUTAGE DETECTED", options)
  );
});

// In-app message receiver from Dashboard / Status page to trigger native mobile system notification
self.addEventListener("message", (event) => {
  if (event.data && (event.data.type === "TRIGGER_OUTAGE_NOTIFICATION" || event.data.type === "TEST_NOTIFICATION")) {
    const data = event.data;
    const options = {
      body: data.body || "A monitored service dropped offline. Tap to triage.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: data.vibrate || [600, 200, 600, 200, 1000, 300, 800],
      tag: data.tag || "heimdall-outage-alert",
      renotify: true,
      requireInteraction: true,
      data: { url: data.url || "/dashboard", timestamp: Date.now() },
      actions: [
        { action: "explore", title: "[VIEW SENTINEL]" },
        { action: "silence", title: "[SILENCE ALARM]" }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "CRITICAL OUTAGE DETECTED", options)
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/dashboard";

  if (event.action === "silence") {
    // Notify all open clients to silence audio alarm
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
        windowClients.forEach((client) => {
          client.postMessage({ type: "SILENCE_AUDIO_ALARM" });
        });
      })
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes("/dashboard") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
