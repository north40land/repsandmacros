// Keeps the app shell available when the gym has no signal.
// Pages: network first, cached copy as fallback. Built assets: cache first (their names are hashed).
const CACHE = 'workout-shell-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  const isAsset = new URL(req.url).pathname.includes('/assets/')
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      if (isAsset) {
        const hit = await cache.match(req)
        if (hit) return hit
      }
      try {
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: true })
        if (hit) return hit
        throw err
      }
    })(),
  )
})
