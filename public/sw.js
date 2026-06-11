// Clinike service worker minimo
// Objetivo: tornar a aplicacao instalavel (PWA) e ter um cache de "shell"
// para resposta instantanea ao reabrir o app. NAO faz cache de dados/API
// (Supabase) — todas as requisicoes dinamicas passam direto pela rede.

const VERSION = 'v4'
const SHELL_CACHE = `clinike-shell-${VERSION}`
const SHELL_ASSETS = ['/manifest.json', '/logo.svg', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith('clinike-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Cache-first APENAS para os 3 icones fixos (logo/favicon/manifest).
  // /_next/static/* NAO eh cacheado pelo SW — o Next ja versiona os chunks
  // com hash na URL, entao o cache HTTP do navegador cuida disso e evitamos
  // o problema de chunk antigo "preso" no cache do SW apos um deploy.
  if (
    url.pathname === '/manifest.json' ||
    url.pathname === '/logo.svg' ||
    url.pathname === '/favicon.svg'
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone()
            caches.open(SHELL_CACHE).then((cache) => cache.put(req, clone))
          }
          return res
        })
      })
    )
  }
})
