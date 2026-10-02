/*
 * Service worker de Dinerillo. A mano y corto a propósito.
 *
 * Por qué network-first y no cache-first: esto es una app de plata. Un importe
 * viejo servido desde el cache es peor que un error, porque el error se ve y se
 * reintenta, mientras que el número viejo se le cree y se toma una decisión con
 * él. Así que el cache cumple una sola función: que al abrir la app sin señal
 * aparezca una pantalla que explique qué pasó, en vez del dinosaurio del
 * navegador. Nada de datos se guarda acá.
 */

const CACHE = "dinerillo-v1";

// El shell mínimo: la pantalla de offline y los iconos que la acompañan.
const SHELL = [
  "/offline",
  "/icons/icono-192.png",
  "/icons/icono-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-180.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      /*
       * Uno por uno y no con addAll: addAll aborta entero si falla un solo
       * pedido, y un icono caído no puede dejarnos sin pantalla de offline.
       */
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const res = await fetch(new Request(url, { cache: "reload" }));
            if (res && res.ok) await cache.put(url, res);
          } catch {
            // Sin red durante la instalación: se reintenta en la próxima versión.
          }
        }),
      );
      // Sin esperar a que se cierren las pestañas viejas: no hay estado que migrar.
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const claves = await caches.keys();
      await Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;

  // Un POST no se cachea ni se reintenta solo: que lo maneje la app.
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Google Sheets, fuentes, cualquier cosa de afuera: no es asunto nuestro.
  if (url.origin !== self.location.origin) return;

  // La API mueve plata: siempre fresca, nunca tocada por el worker.
  if (url.pathname.startsWith("/api/")) return;

  // Sólo navegaciones. El resto (JS, CSS, iconos) lo cachea el navegador solo.
  if (req.mode !== "navigate") return;

  evento.respondWith(
    (async () => {
      try {
        return await fetch(req);
      } catch {
        const cache = await caches.open(CACHE);
        const offline = await cache.match("/offline");
        if (offline) return offline;
        return new Response("Sin conexión.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })(),
  );
});
