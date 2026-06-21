/**
 * ingreso.js — Lógica de la pantalla de ingreso de nota (ingreso.html)
 * Responsabilidades:
 *   1. Selector interactivo de nota (botones 8 / 9 / 10)
 *   2. Preview del monto a ganar según nota seleccionada
 *   3. Carga y preview de imagen adjunta (convertida a base64)
 *   4. Validación del formulario antes de enviar
 *   5. Envío al API (JSON) y redirección con mensaje de éxito
 */

'use strict';

/* ── Canvas de partículas compartido ── */
const canvas = document.getElementById('particles-canvas');
const ctx    = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

function createParticle() {
  return {
    x: Math.random() * canvas.width, y: Math.random() * canvas.height,
    radius: Math.random() * 1.2 + 0.3,
    vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
    alpha: Math.random() * 0.4 + 0.1,
    color: Math.random() > 0.7 ? 'rgba(106,191,80,' : 'rgba(255,255,255,',
  };
}

function initParticles() { particles = Array.from({ length: 30 }, createParticle); }

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `${p.color}${p.alpha})`;
    ctx.fill();
  });
  requestAnimationFrame(animateParticles);
}

/* ── Mapa de recompensas según nota ── */
const RECOMPENSAS = { 8: 2500, 9: 2500, 10: 10000 };

/* ── Referencias al DOM ── */
const notaBtns       = document.querySelectorAll('.nota-btn');
const inputNota      = document.getElementById('input-nota');
const inputMateria   = document.getElementById('input-materia');
const rewardPreview  = document.getElementById('reward-preview');
const previewAmount  = document.getElementById('preview-amount');
const form           = document.getElementById('form-ingreso');
const btnSubmit      = document.getElementById('btn-submit');
const toastEl        = document.getElementById('toast');

// Elementos de imagen
const inputImagen        = document.getElementById('input-imagen');
const inputImagenGaleria = document.getElementById('input-imagen-galeria');
const btnElegirGaleria   = document.getElementById('btn-elegir-galeria');
const uploadZone     = document.getElementById('image-upload-zone');
const uploadPH       = document.getElementById('upload-placeholder');
const uploadPreview  = document.getElementById('upload-preview');
const previewImg     = document.getElementById('preview-img');
const removeImgBtn   = document.getElementById('remove-img-btn');

// Error spans
const errorMateria   = document.getElementById('error-materia');
const errorNota      = document.getElementById('error-nota');

/* Estado interno */
let imagenBase64 = null;   // guardará la imagen en base64 para enviar al servidor
let notaSeleccionada = null;

/* ══════════════════════════════════════════════════════
   SELECTOR DE NOTA
   Al presionar un botón (8, 9, 10):
   - Se marca como seleccionado (aria-pressed="true")
   - Se actualiza el input oculto
   - Se muestra el preview del monto
   ══════════════════════════════════════════════════════ */
notaBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const nota = parseInt(btn.dataset.nota, 10);

    // Desmarcar todos los botones
    notaBtns.forEach(b => b.setAttribute('aria-pressed', 'false'));

    // Marcar el seleccionado
    btn.setAttribute('aria-pressed', 'true');

    // Guardar nota en el input oculto y en el estado
    inputNota.value   = nota;
    notaSeleccionada  = nota;

    // Limpiar error previo
    clearError(errorNota, document.getElementById('group-nota'));

    // Actualizar preview del monto
    const monto = RECOMPENSAS[nota];
    previewAmount.textContent = `$${monto.toLocaleString('es-AR')} ARS`;
    rewardPreview.classList.add('visible');

    // Micro-feedback: el botón presionado hace un pequeño flash de escala
    btn.style.transform = 'scale(0.92)';
    setTimeout(() => (btn.style.transform = ''), 150);
  });
});

/* ══════════════════════════════════════════════════════
   MANEJO DE IMAGEN
   El input[type=file] real está oculto; al hacer clic
   en la zona de upload, lo activamos programáticamente.
   Convertimos la imagen a base64 con FileReader para
   guardarla directamente en D1 junto con el resto del registro.

   Importante: el error "espacio insuficiente en el dispositivo"
   lo genera el sistema operativo AL TOMAR LA FOTO (antes de que
   este código se ejecute), porque el input con capture="environment"
   le pide al OS que abra la cámara nativa, y esa cámara necesita
   guardar la foto original en el almacenamiento del dispositivo
   para poder devolverla al navegador. Eso es inevitable mientras
   se use "capture" y es indetectable desde JS (el evento "change"
   nunca llega a dispararse si el OS no pudo guardar la foto).

   Por eso el fallback es manual: se ofrece un segundo input SIN
   "capture" que abre el selector de galería/archivos normal, donde
   el navegador puede trabajar con un blob temporal en memoria sin
   necesidad de escribir una copia nueva en disco.
   ══════════════════════════════════════════════════════ */

/** Procesa un File ya elegido (sea por cámara o por galería) */
function procesarArchivoImagen(file) {
  if (!file) return;

  // Validar que sea una imagen
  if (!file.type.startsWith('image/')) {
    showToast('El archivo debe ser una imagen', 'error');
    return;
  }

  // Validar tamaño máximo (700KB del archivo original)
  if (file.size > 700 * 1024) {
    showToast('La imagen no puede superar los 700KB', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    imagenBase64 = ev.target.result;
    previewImg.src = imagenBase64;

    // Ocultar placeholder y mostrar preview
    uploadPH.hidden      = true;
    uploadPreview.hidden = false;
    uploadZone.classList.add('has-image');
  };
  reader.onerror = () => {
    showToast('No se pudo leer la imagen. Probá desde la galería.', 'error');
  };
  reader.readAsDataURL(file);
}

inputImagen.addEventListener('change', (e) => {
  procesarArchivoImagen(e.target.files[0]);
});

inputImagenGaleria.addEventListener('change', (e) => {
  procesarArchivoImagen(e.target.files[0]);
});

/** Botón de respaldo: abre el selector de galería directamente */
btnElegirGaleria.addEventListener('click', (e) => {
  e.stopPropagation(); // no disparar también el input de cámara
  inputImagenGaleria.click();
});

/* Aviso preventivo: si el espacio libre del dispositivo está muy bajo,
   la cámara nativa probablemente va a fallar al intentar guardar la
   foto. Lo avisamos antes de que el usuario toque la zona de cámara,
   así sabe que puede usar el botón de galería directamente. */
async function avisarSiPocoEspacio() {
  if (!('storage' in navigator) || !navigator.storage.estimate) return;
  try {
    const { quota, usage } = await navigator.storage.estimate();
    if (!quota) return;
    const libreMB = (quota - usage) / (1024 * 1024);
    if (libreMB < 50) {
      showToast(
        'Poco espacio libre en el dispositivo: si la cámara falla, usá "Elegir desde galería".',
        'error',
        5000
      );
    }
  } catch {
    // Si la API no está disponible o falla, no bloqueamos nada.
  }
}
avisarSiPocoEspacio();

/** Eliminar imagen seleccionada y volver al placeholder */
removeImgBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // evitar que abra el selector de archivos
  imagenBase64          = null;
  inputImagen.value     = '';
  inputImagenGaleria.value = '';
  previewImg.src        = '';
  uploadPH.hidden        = false;
  uploadPreview.hidden   = true;
  uploadZone.classList.remove('has-image');
});

/* ══════════════════════════════════════════════════════
   VALIDACIÓN DEL FORMULARIO
   ══════════════════════════════════════════════════════ */

/** Muestra un error bajo un campo */
function showError(errEl, groupEl, msg) {
  errEl.textContent = msg;
  groupEl.querySelector('.field-input, .nota-selector')?.classList.add('has-error');
}

/** Limpia el error de un campo */
function clearError(errEl, groupEl) {
  errEl.textContent = '';
  groupEl?.querySelector('.field-input, .nota-selector')?.classList.remove('has-error');
}

function validateForm() {
  let valid = true;

  // Validar materia
  if (!inputMateria.value.trim()) {
    showError(errorMateria, document.getElementById('group-materia'), 'La materia es obligatoria.');
    valid = false;
  } else {
    clearError(errorMateria, document.getElementById('group-materia'));
  }

  // Validar nota
  if (!inputNota.value) {
    errorNota.textContent = 'Seleccioná una nota (8, 9 o 10).';
    valid = false;
  } else {
    errorNota.textContent = '';
  }

  return valid;
}

/* Validación en tiempo real al escribir la materia */
inputMateria.addEventListener('input', () => {
  if (inputMateria.value.trim()) {
    clearError(errorMateria, document.getElementById('group-materia'));
  }
});

/* ══════════════════════════════════════════════════════
   ENVÍO DEL FORMULARIO
   ══════════════════════════════════════════════════════ */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  // Deshabilitar botón mientras procesa (evita doble envío)
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `
    <span class="material-symbols-outlined">hourglass_top</span>
    Registrando…
  `;

  try {
    // Construimos el payload en JSON: la imagen va como string
    // base64 dentro de "imagen" (o null si no se adjuntó ninguna).
    const payload = {
      materia: inputMateria.value.trim(),
      nota:    parseInt(inputNota.value, 10),
      imagen:  imagenBase64 || null,
    };

    const res = await fetch('/api/ingreso', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Error al registrar el ingreso.');
    }

    // ¡Éxito! Redirigir al inicio con mensaje de confirmación
    const monto  = data.monto.toLocaleString('es-AR');
    const msgOk  = encodeURIComponent(`✅ ¡+$${monto} ARS registrado correctamente!`);
    window.location.href = `/?msg=${msgOk}&type=success`;

  } catch (err) {
    // Error: reactivar botón y mostrar el mensaje
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `
      <span class="material-symbols-outlined">check_circle</span>
      Confirmar ingreso
    `;
    showToast(err.message || 'Error de conexión', 'error');
  }
});

/* ── Toast ── */
let toastTimeout;
function showToast(msg, type = '', duration = 3000) {
  clearTimeout(toastTimeout);
  toastEl.textContent = msg;
  toastEl.className   = `toast visible ${type}`;
  toastTimeout = setTimeout(() => toastEl.classList.remove('visible'), duration);
}

/* ── Init ── */
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
initParticles();
animateParticles();
