// Cache de l'interface Kokorigo : l'application reste ouvrable sans réseau.
// Les livres et les positions de lecture vivent dans IndexedDB / localStorage,
// et la synthèse vocale hors ligne utilise les voix du téléphone.
// Incrémenter CACHE_NAME à chaque version pour purger l'ancien cache.
const CACHE_NAME = "kokorigo-v1";
const MATCH_OPTIONS = { ignoreVary: true };

const DOCUMENTS = ["/", "/workspace", "/reader"];

const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/fonts/OpenDyslexic-Regular.woff",
  "/fonts/OpenDyslexic-Bold.woff",
];

// Une page ne s'ouvre hors ligne que si ses bundles sont eux aussi en cache :
// on relève donc les scripts et feuilles de style référencés par son HTML.
async function precacheDocument(cache, url) {
  const response = await fetch(url);
  if (!response.ok) return;
  await cache.put(url, response.clone());

  const html = await response.text();
  const assets = new Set(
    Array.from(html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g), (match) => match[1]),
  );
  await Promise.all(Array.from(assets, (asset) => cache.add(asset).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Une ressource manquante ne doit pas faire échouer toute l'installation.
      await Promise.all(STATIC_ASSETS.map((url) => cache.add(url).catch(() => undefined)));
      await Promise.all(DOCUMENTS.map((url) => precacheDocument(cache, url).catch(() => undefined)));
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    // Next.js renvoie un en-tête Vary (RSC, Accept-Encoding…) que la requête
    // de navigation ne reproduit pas : sans ignoreVary, le cache resterait muet.
    const cached = await cache.match(request, MATCH_OPTIONS) ?? await cache.match("/", MATCH_OPTIONS);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, MATCH_OPTIONS);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // L'API (bibliothèque, voix, synthèse) n'est jamais servie depuis le cache :
  // le code applicatif bascule lui-même sur les données locales.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  if (request.mode === "navigate" || url.searchParams.has("_rsc")) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
