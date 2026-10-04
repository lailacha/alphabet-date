// Minimal service worker so the app opens fast and offline.
// - Hashed build files (/assets/…) never change: cache first.
// - Everything else (the page itself, icons, manifest): network first, so a
//   new version shows up as soon as it is deployed; the cache is only a
//   fallback when offline.
// - API calls are never touched (photos use the browser HTTP cache).
const CACHE = 'alphabet-date-v4'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return

  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(e.request, copy))
            }
            return res
          })
      )
    )
    return
  }

  const key = e.request.mode === 'navigate' ? '/' : e.request
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(key, copy))
        }
        return res
      })
      .catch(() => caches.match(key))
  )
})
