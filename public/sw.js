// Clinike service worker minimo
// Objetivo: tornar a aplicacao instalavel (PWA) e ter um cache de "shell"
// para resposta instantanea ao reabrir o app. NAO faz cache de dados/API
// (Supabase) — todas as requisicoes dinamicas passam direto pela rede.

const VERSION = 'v1'
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

  // Nunca cacheia chamadas para Supabase ou para APIs do Next
  if (
    url.hostname.endsWith('.supabase.co') ||
    url.hostname.endsWith('.supabase.in') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/data/') ||
    url.pathname.startsWith('/dashboard')
  ) {
    return
  }

  // Cache-first para assets estaticos do Next e icones
  if (
    url.pathname.startsWith('/_next/static/') ||
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
