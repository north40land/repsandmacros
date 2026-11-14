// Keeps the app available when the gym has no signal.
//   Built files (hashed names): from the saved copy first.
//   The page itself: from the network, falling back to the saved copy if the
//   connection is down or too slow to answer within a few seconds.
const CACHE = 'workout-shell-v3'
const PAGE_TIMEOUT_MS = 4000

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name)
      await self.clients.claim()
    })(),
  ),
)

// The page lists the files it loaded so they can be saved straight away.
self.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'precache' || !Array.isArray(e.data.urls)) return
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await Promise.all(
        e.data.urls
          .filter((url) => typeof url === 'string' && url.startsWith(self.location.origin))
          .map(async (url) => {
            if (await cache.match(url, { ignoreVary: true })) return
            try {
              const res = await fetch(url, { cache: 'reload' })
              if (res.ok) await cache.put(url, res)
            } catch (err) {
              /* try again next launch */
            }
          }),
      )
    })(),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  const isAsset = url.pathname.includes('/assets/')
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      if (isAsset) {
        // ignoreVary: the saved copy was fetched by this helper, whose request headers differ from the page's.
        const hit = await cache.match(req, { ignoreVary: true })
        if (hit) return hit
      }
      try {
        const res = await (isAsset
          ? fetch(req)
          : Promise.race([fetch(req), new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), PAGE_TIMEOUT_MS))]))
        if (res.ok) cache.put(req, res.clone())
        return res
      } catch (err) {
        const loose = { ignoreSearch: true, ignoreVary: true }
        const hit = (await cache.match(req, loose)) || (req.mode === 'navigate' && (await cache.match(self.registration.scope, loose)))
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
