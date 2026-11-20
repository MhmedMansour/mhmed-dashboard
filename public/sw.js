/* مِحور الهندسي — Offline-first service worker (v5) */
const APP_CACHE = "mihwar-app-v5";
const DATA_CACHE = "mihwar-data-v5";
const FILE_CACHE = "mihwar-files-v5";

const APP_SHELL = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/images/sample-revit-bim.png",
  "/images/sample-autocad-mep.png",
];

// Every durable scan/preview/download endpoint shares the dedicated file cache,
// so offline preparation covers certificate files, info cards AND Haram cards.
const FILE_URL_RE = /\/api\/(files|general-info|haram-documents)\/\d+\/(preview|download)/;
// Third-party feeds must always come from the live network (fresh data + CORS).
const NO_CACHE_PATHS = ["/api/opportunities"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![APP_CACHE, DATA_CACHE, FILE_CACHE].includes(key))
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
      .catch(() => {})
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "CLEAR_FILE_CACHE") {
    event.waitUntil(caches.delete(FILE_CACHE).catch(() => {}));
  }
});

// Best-effort background sync: tell open tabs to flush the outbox.
self.addEventListener("sync", (event) => {
  if (event.tag === "mihwar-sync") {
    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) =>
          clients.forEach((client) => client.postMessage({ type: "MIHWAR_SYNC" }))
        )
        .catch(() => {})
    );
  }
});

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function offlineImagePlaceholder() {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='420'>" +
    "<rect width='100%' height='100%' fill='#0f172a'/>" +
    "<text x='50%' y='46%' fill='#e2e8f0' font-size='26' text-anchor='middle' font-family='sans-serif'>غير متاح أوفلاين</text>" +
    "<text x='50%' y='58%' fill='#94a3b8' font-size='16' text-anchor='middle' font-family='sans-serif'>افتح الملف مرة واحدة أونلاين ليُحفظ على جهازك</text>" +
    "</svg>";
  return new Response(svg, {
    status: 200,
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// Cache Storage refuses Requests whose cache mode is "no-store" (which the
// dashboard fetch helpers use). Build a plain GET Request as the cache key so
// online responses are actually stored and can be served later offline.
function cacheKey(url) {
  return new Request(url, { method: "GET", credentials: "same-origin" });
}

async function handleFileRequest(request) {
  const key = cacheKey(request.url);
  const cached = await caches.match(key, { cacheName: FILE_CACHE }).catch(() => undefined);
  // HEAD checks (preview availability) resolve from cache when offline.
  if (request.method === "HEAD") {
    if (cached) return new Response(null, { status: 200, headers: cached.headers });
    try {
      const res = await fetch(request);
      return new Response(null, { status: res.status, headers: res.headers });
    } catch {
      return new Response(null, { status: 503 });
    }
  }
  try {
    const network = await fetch(request);
    if (network && network.status === 200) {
      try {
        const cache = await caches.open(FILE_CACHE);
        await cache.put(key, network.clone());
      } catch {
        // Quota exceeded or huge file — serve network response anyway.
      }
    }
    return network;
  } catch {
    if (cached) return cached;
    const accept = request.headers.get("accept") || "";
    if (accept.includes("image/")) return offlineImagePlaceholder();
    return jsonResponse(
      { error: "الملف غير محفوظ أوفلاين — افتحه مرة واحدة أونلاين أولاً", code: "OFFLINE_NOT_CACHED" },
      503
    );
  }
}

async function handleApiRequest(request, url) {
  // Never cache exports — they must always hit the server.
  if (url.searchParams.get("export") === "true") {
    return fetch(request);
  }
  const key = cacheKey(request.url);
  try {
    const network = await fetch(request);
    if (network && network.status === 200) {
      try {
        const cache = await caches.open(DATA_CACHE);
        await cache.put(key, network.clone());
      } catch {
        // ignore cache failures
      }
    }
    return network;
  } catch {
    const cached = await caches.match(key, { cacheName: DATA_CACHE }).catch(() => undefined);
    if (cached) return cached;
    return jsonResponse(
      { error: "أنت غير متصل بالإنترنت — لا توجد نسخة محفوظة لهذا الطلب", code: "OFFLINE_NO_CACHE" },
      503
    );
  }
}

async function handleNavigation(request) {
  try {
    const network = await fetch(request);
    if (network && (network.status === 200 || network.type === "opaque")) {
      try {
        const cache = await caches.open(APP_CACHE);
        await cache.put("/", network.clone());
        await cache.put(request, network.clone());
      } catch {
        // ignore
      }
    }
    return network;
  } catch {
    const cached =
      (await caches.match(request, { cacheName: APP_CACHE }).catch(() => undefined)) ||
      (await caches.match("/", { cacheName: APP_CACHE }).catch(() => undefined));
    if (cached) return cached;
    const offline = await caches.match("/offline.html", { cacheName: APP_CACHE }).catch(() => undefined);
    if (offline) return offline;
    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

async function handleStatic(request) {
  const cached = await caches.match(request, { cacheName: APP_CACHE }).catch(() => undefined);
  const networkFetch = fetch(request)
    .then(async (response) => {
      if (response && (response.status === 200 || response.type === "opaque")) {
        try {
          const cache = await caches.open(APP_CACHE);
          await cache.put(request, response.clone());
        } catch {
          // ignore
        }
      }
      return response;
    })
    .catch(() => cached);
  // Cache-first for shells/assets so the UI paints instantly offline.
  if (cached) {
    networkFetch.catch(() => {});
    return cached;
  }
  return networkFetch.then(
    (res) =>
      res ||
      new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" && request.method !== "HEAD") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // File bytes: dedicated cache, works offline after first open.
  if (FILE_URL_RE.test(url.pathname)) {
    event.respondWith(handleFileRequest(request));
    return;
  }

  if (NO_CACHE_PATHS.some((p) => url.pathname.startsWith(p))) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(handleApiRequest(request, url));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleStatic(request));
});
