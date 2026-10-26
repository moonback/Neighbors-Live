/// <reference lib="webworker" />
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Soft update: the new worker waits until the user accepts the "update" banner.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // API responses carry positions and short-lived signed URLs: never cached.
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/'),
      handler: new NetworkOnly(),
    },
    // Private media (signed URLs) and video streams: network only.
    {
      matcher: ({ url, request }) =>
        url.pathname.includes('/storage/v1/') || request.destination === 'video',
      handler: new NetworkOnly(),
    },
    // Map style, glyphs and vector tiles: cache first, bounded.
    {
      matcher: ({ url }) => /openfreemap|tiles|maptiler|stadiamaps/.test(url.hostname),
      handler: new CacheFirst({
        cacheName: 'map-tiles',
        plugins: [new ExpirationPlugin({ maxEntries: 800, maxAgeSeconds: 14 * 24 * 3600 })],
      }),
    },
    // App code and styles: fast from cache, refreshed in background.
    {
      matcher: ({ request, url }) =>
        url.origin === self.location.origin &&
        ['script', 'style', 'worker', 'font'].includes(request.destination),
      handler: new StaleWhileRevalidate({ cacheName: 'static' }),
    },
    {
      matcher: ({ request, url }) =>
        url.origin === self.location.origin && request.destination === 'image',
      handler: new CacheFirst({
        cacheName: 'images',
        plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600 })],
      }),
    },
    // Only explicitly public pages may be retained for offline navigation. Authenticated
    // pages contain account data and must never fall back to a previous user's HTML.
    {
      matcher: ({ request, url }) =>
        request.mode === 'navigate' &&
        url.origin === self.location.origin &&
        [
          '/commerces',
          '/commerces/decouvrir',
          '/legal',
          '/legal/regles',
          '/legal/confidentialite',
        ].includes(url.pathname),
      handler: new NetworkFirst({ cacheName: 'public-pages', networkTimeoutSeconds: 4 }),
    },
    {
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [{ url: '/offline', matcher: ({ request }) => request.destination === 'document' }],
  },
});

// Remove pages cached by older service worker versions, which cached every navigation.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('pages'));
});

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

self.addEventListener('push', (event) => {
  let data: PushPayload = { title: 'Voisino', body: '', url: '/' };
  try {
    data = { ...data, ...(event.data?.json() as Partial<PushPayload>) };
  } catch {
    /* non-JSON payload: keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data as { url?: string })?.url ?? '/',
    self.location.origin,
  );
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => new URL(c.url).origin === target.origin);
      if (open) {
        void open.navigate(target.href);
        return open.focus();
      }
      return self.clients.openWindow(target.href);
    }),
  );
});

serwist.addEventListeners();
