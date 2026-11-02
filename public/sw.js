/**
 * sw.js — Service Worker de MeDebe (PWA)
 * [CAMBIO] Qué hace: guarda en caché la app (páginas, CSS, JS, imágenes y fuentes)
 * para que abra rápido y también sin conexión (la parte visual).
 * Para qué sirve: es requisito de la PWA para poder instalarse y funcionar offline.
 *
 * Estrategias:
 *   - /api/*  → SIEMPRE red (los datos nunca se cachean: saldo, movimientos, etc.)
 *   - Navegación y archivos propios → red primero, caché como respaldo offline
 *     (así, al desplegar una versión nueva, se ve enseguida)
 *   - Fuentes de Google → caché primero + actualización en segundo plano
 *
 * IMPORTANTE: al desplegar cambios, subí la versión de CACHE_VERSION para limpiar cachés viejos.
 */
const CACHE_VERSION = 'medebe-v1.2.0';

// Archivos que se guardan al instalar (la app queda disponible offline)
const PRECACHE = [
  '/', '/index.html', '/ingreso.html', '/retiro.html', '/historial.html',
  '/perfiles.html', '/perfil.html', '/perfil-ingreso.html', '/perfil-retiro.html', '/perfil-historial.html',
  '/css/styles.css',
  '/js/main.js', '/js/ingreso.js', '/js/retiro.js', '/js/historial.js', '/js/perfiles.js',
  '/js/perfil-detalle.js', '/js/perfil-ingreso.js', '/js/perfil-retiro.js', '/js/perfil-historial.js', '/js/pwa.js', '/js/camara.js',
  '/img/logo.png', '/img/logo_2.png', '/img/icon-192.png', '/img/icon-512.png',
  '/manifest.webmanifest',
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

/**
 * Cloudflare Pages redirige /pagina.html → /pagina. Una respuesta "redirected"
 * no puede usarse para una navegación, así que se reconstruye como respuesta normal.
 */
async function limpiarRespuesta(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

/** Guarda una respuesta válida en caché (solo respuestas 200 completas) */
async function guardar(request, res) {
  if (!res || res.status !== 200) return;
  const cache = await caches.open(CACHE_VERSION);
  await cache.put(request, await limpiarRespuesta(res.clone()));
}

/** Instalación: precachea los archivos base (si alguno falla, no rompe la instalación) */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res.status !== 200) return;
        const limpia = await limpiarRespuesta(res);
        await cache.put(url, limpia.clone());
        // Cloudflare sirve /pagina sin ".html": guardamos también esa variante
        if (url.endsWith('.html') && url !== '/index.html') {
          await cache.put(url.replace(/\.html$/, ''), limpia.clone());
        }
      } catch (_) { /* sin red para ese archivo: se cacheará luego al usarlo */ }
    }));
    await self.skipWaiting();
  })());
});

/** Activación: borra cachés de versiones anteriores y toma control de las pestañas abiertas */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;            // POST/DELETE van directo a la red

  const url = new URL(request.url);

  // Datos de la API: nunca se cachean
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Fuentes de Google: caché primero, actualizando en segundo plano
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      const guardado = await cache.match(request);
      const red = fetch(request).then(res => { if (res.ok || res.type === 'opaque') cache.put(request, res.clone()); return res; }).catch(() => guardado);
      return guardado || red;
    })());
    return;
  }

  // Solo manejamos archivos del propio sitio
  if (url.origin !== self.location.origin) return;

  // Navegación y archivos propios: red primero, caché como respaldo offline
  event.respondWith((async () => {
    try {
      const res = await fetch(request);
      if (request.mode !== 'navigate' || res.type !== 'opaqueredirect') guardar(request, res);
      return res;
    } catch (_) {
      const cache = await caches.open(CACHE_VERSION);
      // Variantes de la ruta (con/sin .html) y, si es navegación, la portada como último recurso
      const ruta = url.pathname;
      const variantes = [ruta, ruta.replace(/\.html$/, ''), ruta + '.html'];
      for (const v of variantes) {
        const hit = await cache.match(v, { ignoreSearch: true });
        if (hit) return hit;
      }
      if (request.mode === 'navigate') {
        const portada = await cache.match('/index.html');
        if (portada) return portada;
      }
      return new Response('Sin conexión', { status: 503, statusText: 'Offline' });
    }
  })());
});
