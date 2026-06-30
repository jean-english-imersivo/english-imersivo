/* ============================================================
   English Imersivo — Service Worker
   Cache do shell (HTML + ícones + manifest) pra app abrir offline.
   NUNCA cacheia chamadas de API (Gemini/Groq/Mistral) — sempre rede.
   ============================================================ */

const CACHE_NAME = 'english-imersivo-v3';
const SHELL = [
  './',
  './codigo_principal.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
];

// Hosts que NUNCA devem ser cacheados (APIs LLM)
const API_HOSTS = [
  'generativelanguage.googleapis.com',
  'api.groq.com',
  'api.mistral.ai',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL).catch(() => {
      // Se algum recurso falhar (ex: ícone ainda não gerado), instala mesmo assim
      console.log('Shell cache: some resources missing, continuing');
    }))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca tocar em APIs LLM — sempre rede
  if (API_HOSTS.some(h => url.hostname.includes(h))) {
    return; // browser segue padrão (network)
  }

  // Apenas GET é cacheável
  if (event.request.method !== 'GET') return;

  // Estrategia network-first: sempre tenta rede primeiro, cache como fallback offline.
  // Isso garante que atualizações do HTML/JS apareçam imediatamente quando ha internet.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cacheia recursos OK do próprio domínio pra uso offline
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
