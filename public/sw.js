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

// ---- Reminders ----
// Show a notification when the server sends one, and open the Doses tab when it is tapped.

self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch (err) {
    data = { body: e.data ? e.data.text() : '' }
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Reminder', {
      body: data.body || '',
      tag: data.tag,
      icon: './icon-180.png',
      badge: './icon-180.png',
      data: { url: data.url || './' },
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.location.href).href
  e.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus()
          client.postMessage({ type: 'open', tab: 'doses' })
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
