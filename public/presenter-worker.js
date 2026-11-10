const CACHE = "aeon-presenter-v1";
const SHELL = "/presenter";
const ASSET = "/_next/static/";

self.addEventListener("install", (event) =>
  event.waitUntil(self.skipWaiting()),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

async function saveAsset(cache, path) {
  if (await cache.match(path)) return;
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not cache ${path}`);
  if (path.endsWith(".css")) {
    const css = await response.clone().text();
    const fonts = [...css.matchAll(/url\(["']?([^)'"]+)["']?\)/g)]
      .map((match) => new URL(match[1], new URL(path, self.location.origin)))
      .filter(
        (url) =>
          url.origin === self.location.origin &&
          url.pathname.startsWith(`${ASSET}media/`),
      );
    await Promise.all(fonts.map((url) => saveAsset(cache, url.pathname)));
  }
  await cache.put(path, response);
}

async function saveShell(cache, response) {
  const html = await response.clone().text();
  const paths = [
    ...new Set(
      [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  if (!paths.some((path) => path.endsWith(".js")))
    throw new Error("Presenter shell has no scripts");
  await Promise.all(paths.map((path) => saveAsset(cache, path)));
  await cache.put(SHELL, response);
}

async function prepare() {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(SHELL, { cache: "no-cache" });
    if (!response.ok) throw new Error("Presenter shell is unavailable");
    await saveShell(cache, response);
  } catch (error) {
    if (!(await cache.match(SHELL))) throw error;
  }
}

self.addEventListener("message", (event) => {
  if (event.data !== "prepare" || !event.ports[0]) return;
  const reply = event.ports[0];
  event.waitUntil(
    prepare().then(
      () => reply.postMessage("ready"),
      () => reply.postMessage("unavailable"),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET")
    return;
  if (event.request.mode === "navigate" && url.pathname === SHELL) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(event.request);
          if (response.ok) return response;
        } catch {
          // Use the last complete build when the network is unavailable.
        }
        return (await cache.match(SHELL)) ?? Response.error();
      })(),
    );
  } else if (url.pathname.startsWith(ASSET)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(event.request)) ?? fetch(event.request);
      })(),
    );
  }
});
