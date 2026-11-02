/**
 * pwa.js — Registro del Service Worker (PWA)
 * [CAMBIO] Qué hace: registra /sw.js para que MeDebe pueda instalarse como app
 * y funcione con caché offline.
 * Para qué sirve: se carga desde index.html; el Service Worker queda activo
 * para todo el sitio (scope "/"), así que no hace falta cargarlo en cada página.
 */
'use strict';

if ('serviceWorker' in navigator) {
  // Se registra después de 'load' para no competir con la carga inicial de la pantalla
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('No se pudo registrar el Service Worker:', err));
  });
}
