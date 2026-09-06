const CACHE = 'talk-timer-v2'

const ASSETS = [
    './',
    './index.html',
    './app.css',
    './app.js',
    './manifest.webmanifest',
    './icons/icon-180.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png'
]

const precache = async () => {
    const cache = await caches.open(CACHE)

    await cache.addAll(ASSETS)
    await self.skipWaiting()
}

const dropStaleCaches = async () => {
    const keys = await caches.keys()
    const stale = keys.filter((key) => key !== CACHE)

    await Promise.all(stale.map((key) => caches.delete(key)))
    await self.clients.claim()
}

const respond = async (request) => {
    const hit = await caches.match(request)

    if (hit) {
        return hit
    }

    const response = await fetch(request)
    const cache = await caches.open(CACHE)

    cache.put(request, response.clone())

    return response
}

self.addEventListener('install', (event) => event.waitUntil(precache()))

self.addEventListener('activate', (event) => event.waitUntil(dropStaleCaches()))

self.addEventListener('fetch', (event) => {
    const { request } = event

    if (request.method !== 'GET') {
        return
    }

    if (new URL(request.url).origin !== self.location.origin) {
        return
    }

    event.respondWith(respond(request))
})
