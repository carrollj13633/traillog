/* TrailLog service worker: precache the app shell, cache map tiles opportunistically. */
'use strict';
const VERSION = 'v2';
const SHELL_CACHE = 'traillog-shell-' + VERSION;
const TILE_CACHE = 'traillog-tiles-v1';
const MAX_TILES = 1200;

const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css',
  'js/geo.js', 'js/platform.js', 'js/db.js', 'js/app.js',
  'vendor/leaflet/leaflet.css', 'vendor/leaflet/leaflet.js',
  'vendor/leaflet/images/layers.png', 'vendor/leaflet/images/layers-2x.png',
  'vendor/leaflet/images/marker-icon.png', 'vendor/leaflet/images/marker-icon-2x.png', 'vendor/leaflet/images/marker-shadow.png',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];

const TILE_HOSTS = [/(^|\.)tile\.openstreetmap\.org$/, /^server\.arcgisonline\.com$/, /(^|\.)tile\.opentopomap\.org$/];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
  // Do not skipWaiting automatically: the page offers a "Reload" prompt so an update never interrupts a recording.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('traillog-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function trimTiles(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_TILES) await Promise.all(keys.slice(0, keys.length - MAX_TILES).map((k) => cache.delete(k)));
}

async function tileStrategy(request) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    // Opaque (no-cors image) responses have status 0; cache them too.
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(request, res.clone()).then(() => (Math.random() < 0.05 ? trimTiles(cache) : null)).catch(() => {});
    }
    return res;
  } catch (e) {
    return Response.error();
  }
}

async function shellStrategy(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request).then((res) => {
    if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  if (hit) { network.catch(() => {}); return hit; }
  const res = await network;
  if (res) return res;
  if (request.mode === 'navigate') {
    const fallback = await cache.match('index.html');
    if (fallback) return fallback;
  }
  return Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (TILE_HOSTS.some((re) => re.test(url.hostname))) { event.respondWith(tileStrategy(req)); return; }
  if (url.origin === self.location.origin) event.respondWith(shellStrategy(req));
});
