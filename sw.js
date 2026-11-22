// Service worker: precaches the whole game so it works offline and installs
// as a PWA. The deploy workflow replaces __BUILD__ with the commit SHA, which
// renames the cache and makes clients pick up the new version.
const VERSION = '__BUILD__';
const CACHE = `fever-snake-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/three.module.min.js',
  './src/main.js',
  './src/snake.js',
  './src/input.js',
  './src/audio.js',
  './src/order.js',
  './src/topologies/grid.js',
  './src/topologies/cube.js',
  './src/topologies/portal-grid.js',
  './src/render/util.js',
  './src/render/three.js',
  './src/render/three-util.js',
  './src/worlds/index.js',
  './src/worlds/grid-input.js',
  './src/worlds/neon.js',
  './src/worlds/retro95.js',
  './src/worlds/cube.js',
  './src/worlds/pocket.js',
  './src/worlds/tube.js',
  './src/worlds/terminal.js',
  './src/worlds/firstperson.js',
  './src/worlds/doodle.js',
  './src/worlds/spreadsheet.js',
  './src/worlds/portals.js',
  './src/worlds/planet.js',
  './src/worlds/isometric.js',
  './src/worlds/lightsout.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fever-snake-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first, so a new deploy shows up on the next load; the cache (kept
// fresh by every successful fetch) is the fallback when offline.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(request, { ignoreSearch: request.mode === 'navigate' })
          .then((hit) => hit ?? (request.mode === 'navigate' ? caches.match('./index.html') : Response.error())),
      ),
  );
});
