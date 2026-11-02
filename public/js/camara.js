/**
 * camara.js — Cámara propia dentro de la página (getUserMedia)
 * [CAMBIO] Qué hace: abre la cámara en una pantalla completa dentro de la app,
 * muestra la vista en vivo y, al tocar el obturador, captura un cuadro liviano
 * (máx. ~1280px) y lo devuelve como archivo JPEG.
 * Para qué sirve: antes se usaba <input capture>, que abre la app de cámara del
 * sistema y devuelve una foto enorme; en Android eso causaba el error
 * "memoria insuficiente para completar la operación anterior". Con la cámara
 * integrada no se sale de la página y la imagen es chica desde el origen.
 *
 * Uso:  const archivo = await MeDebeCamara.abrir();   // File | null (si se cancela)
 * Si el navegador no soporta la cámara o hay otro error, la promesa se rechaza:
 * el llamador decide el respaldo (ver los JS de cada pantalla).
 */
'use strict';

const MeDebeCamara = (() => {
  const MAX_LADO_PX = 1280;   // resolución pedida a la cámara (liviana y suficiente)
  const CALIDAD_JPEG = 0.85;

  function abrir() {
    return new Promise(async (resolve, reject) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        reject(new Error('CAMARA_NO_SOPORTADA'));
        return;
      }

      let stream = null;
      let facing = 'environment';   // arranca con la cámara trasera
      let cerrado = false;

      /* ── Pantalla de cámara (se crea al abrir y se elimina al cerrar) ── */
      const overlay = document.createElement('div');
      overlay.className = 'camara-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Cámara');
      overlay.innerHTML = `
        <video class="camara-video" playsinline muted autoplay></video>
        <div class="camara-controls">
          <button type="button" class="camara-btn" data-accion="cerrar" aria-label="Cancelar">
            <span class="material-symbols-outlined">close</span>
          </button>
          <button type="button" class="camara-shutter" data-accion="capturar" aria-label="Sacar foto"></button>
          <button type="button" class="camara-btn" data-accion="girar" aria-label="Cambiar cámara">
            <span class="material-symbols-outlined">cameraswitch</span>
          </button>
        </div>`;
      const video = overlay.querySelector('video');

      /** Apaga la cámara, quita la pantalla y resuelve con el resultado */
      function terminar(resultado, error) {
        if (cerrado) return;
        cerrado = true;
        document.removeEventListener('keydown', onKey);
        if (stream) stream.getTracks().forEach(t => t.stop());   // libera cámara y memoria
        video.srcObject = null;
        overlay.remove();
        if (error) reject(error); else resolve(resultado);
      }

      function onKey(e) { if (e.key === 'Escape') terminar(null); }

      /** Enciende (o cambia) la cámara con el lado indicado */
      async function iniciar() {
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width:  { ideal: MAX_LADO_PX },
            height: { ideal: 720 },
          },
        });
        video.srcObject = stream;
        await video.play().catch(() => {});
      }

      /** Captura el cuadro actual como JPEG liviano */
      function capturar() {
        const w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) return;                       // la cámara todavía no está lista
        const escala = Math.min(1, MAX_LADO_PX / Math.max(w, h));
        const lienzo = document.createElement('canvas');
        lienzo.width  = Math.round(w * escala);
        lienzo.height = Math.round(h * escala);
        lienzo.getContext('2d').drawImage(video, 0, 0, lienzo.width, lienzo.height);
        lienzo.toBlob((blob) => {
          lienzo.width = lienzo.height = 0;
          if (!blob) { terminar(null, new Error('CAPTURA_FALLIDA')); return; }
          terminar(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', CALIDAD_JPEG);
      }

      overlay.addEventListener('click', async (e) => {
        const accion = e.target.closest('[data-accion]')?.dataset.accion;
        if (accion === 'cerrar')   terminar(null);
        if (accion === 'capturar') capturar();
        if (accion === 'girar') {
          facing = facing === 'environment' ? 'user' : 'environment';
          try { await iniciar(); } catch (err) { terminar(null, err); }
        }
      });

      document.body.appendChild(overlay);
      document.addEventListener('keydown', onKey);

      try {
        await iniciar();
      } catch (err) {
        terminar(null, err);   // permiso denegado, sin cámara, etc.
      }
    });
  }

  return { abrir };
})();
