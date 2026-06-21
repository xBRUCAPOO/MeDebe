/**
 * perfil-ingreso.js — Lógica de la pantalla "Añadir deuda" (perfil-ingreso.html)
 * Responsabilidades:
 *   1. Cargar el nombre del perfil para mostrarlo en el subtítulo
 *   2. Validar y enviar el formulario: asunto, monto, descripción e imagen
 *   3. Manejo de imagen (preview + conversión a base64)
 */

'use strict';

/* ── ID del perfil desde la URL ── */
const urlParams = new URLSearchParams(window.location.search);
const perfilId   = urlParams.get('id');

if (!perfilId) {
  window.location.href = 'perfiles.html';
}

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

/* ── Referencias al DOM ── */
const nombreSubEl    = document.getElementById('perfil-nombre-sub');
const inputAsunto    = document.getElementById('input-asunto');
const inputMonto     = document.getElementById('input-monto');
const inputDescripcion = document.getElementById('input-descripcion');
const form           = document.getElementById('form-cargo');
const btnSubmit      = document.getElementById('btn-submit');
const toastEl        = document.getElementById('toast');

const errorAsunto    = document.getElementById('error-asunto');
const errorMonto     = document.getElementById('error-monto');

// Elementos de imagen
const inputImagen        = document.getElementById('input-imagen');
const inputImagenGaleria = document.getElementById('input-imagen-galeria');
const btnElegirGaleria   = document.getElementById('btn-elegir-galeria');
const uploadZone     = document.getElementById('image-upload-zone');
const uploadPH       = document.getElementById('upload-placeholder');
const uploadPreview  = document.getElementById('upload-preview');
const previewImg     = document.getElementById('preview-img');
const removeImgBtn   = document.getElementById('remove-img-btn');

/* Estado interno */
let imagenBase64 = null;

/* ══════════════════════════════════════════════════════
   CARGAR NOMBRE DEL PERFIL
   ══════════════════════════════════════════════════════ */
async function loadPerfilNombre() {
  try {
    const res = await fetch(`/api/perfiles/${perfilId}`);
    if (!res.ok) throw new Error();
    const perfil = await res.json();
    nombreSubEl.textContent = `Para: ${perfil.nombre}`;
  } catch {
    nombreSubEl.textContent = 'Nuevo movimiento';
  }
}

/* ══════════════════════════════════════════════════════
   MANEJO DE IMAGEN
   (Ver nota detallada sobre el error de espacio en ingreso.js)
   ══════════════════════════════════════════════════════ */
function procesarArchivoImagen(file) {
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('El archivo debe ser una imagen', 'error');
    return;
  }

  if (file.size > 700 * 1024) {
    showToast('La imagen no puede superar los 700KB', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    imagenBase64 = ev.target.result;
    previewImg.src = imagenBase64;

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

btnElegirGaleria.addEventListener('click', (e) => {
  e.stopPropagation();
  inputImagenGaleria.click();
});

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

removeImgBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  imagenBase64             = null;
  inputImagen.value        = '';
  inputImagenGaleria.value = '';
  previewImg.src           = '';
  uploadPH.hidden           = false;
  uploadPreview.hidden      = true;
  uploadZone.classList.remove('has-image');
});

/* ══════════════════════════════════════════════════════
   VALIDACIÓN
   ══════════════════════════════════════════════════════ */
function showError(errEl, groupEl, msg) {
  errEl.textContent = msg;
  groupEl.querySelector('.field-input')?.classList.add('has-error');
}

function clearError(errEl, groupEl) {
  errEl.textContent = '';
  groupEl?.querySelector('.field-input')?.classList.remove('has-error');
}

function validateForm() {
  let valid = true;

  if (!inputAsunto.value.trim()) {
    showError(errorAsunto, document.getElementById('group-asunto'), 'El asunto es obligatorio.');
    valid = false;
  } else {
    clearError(errorAsunto, document.getElementById('group-asunto'));
  }

  const monto = parseFloat(inputMonto.value);
  if (!inputMonto.value || isNaN(monto) || monto <= 0) {
    showError(errorMonto, document.getElementById('group-monto'), 'Ingresá un monto mayor a cero.');
    valid = false;
  } else {
    clearError(errorMonto, document.getElementById('group-monto'));
  }

  return valid;
}

inputAsunto.addEventListener('input', () => {
  if (inputAsunto.value.trim()) clearError(errorAsunto, document.getElementById('group-asunto'));
});
inputMonto.addEventListener('input', () => {
  if (inputMonto.value && parseFloat(inputMonto.value) > 0) clearError(errorMonto, document.getElementById('group-monto'));
});

/* ══════════════════════════════════════════════════════
   ENVÍO DEL FORMULARIO
   ══════════════════════════════════════════════════════ */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `
    <span class="material-symbols-outlined">hourglass_top</span>
    Registrando…
  `;

  try {
    const payload = {
      tipo: 'cargo',
      asunto: inputAsunto.value.trim(),
      monto: parseFloat(inputMonto.value),
      descripcion: inputDescripcion.value.trim() || null,
      imagen: imagenBase64 || null,
    };

    const res = await fetch(`/api/perfiles/${perfilId}/movimientos`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar la deuda.');

    const monto  = payload.monto.toLocaleString('es-AR');
    const msgOk  = encodeURIComponent(`✅ ¡+$${monto} ARS registrado correctamente!`);
    window.location.href = `perfil.html?id=${perfilId}&msg=${msgOk}&type=success`;

  } catch (err) {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `
      <span class="material-symbols-outlined">check_circle</span>
      Confirmar
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
loadPerfilNombre();
