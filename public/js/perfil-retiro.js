/**
 * perfil-retiro.js — Lógica de la pantalla "Registrar pago" (perfil-retiro.html)
 * Responsabilidades:
 *   1. Cargar y mostrar el saldo actual del perfil como referencia
 *   2. Botones de montos rápidos (incluye "Todo")
 *   3. Manejo de imagen y descripción opcional
 *   4. Enviar el pago al API — SIN modal de advertencia de saldo negativo
 */

'use strict';

/* ── ID del perfil desde la URL ── */
const urlParams = new URLSearchParams(window.location.search);
const perfilId   = urlParams.get('id');

if (!perfilId) {
  window.location.href = 'perfiles.html';
}

/* ── Canvas de partículas ── */
const canvas = document.getElementById('particles-canvas');
const ctx    = canvas.getContext('2d');
let particles = [];

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
function createParticle() {
  return {
    x: Math.random() * canvas.width, y: Math.random() * canvas.height,
    radius: Math.random() * 1.2 + 0.3,
    vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
    alpha: Math.random() * 0.4 + 0.1,
    color: Math.random() > 0.7 ? 'rgba(106,191,80,' : 'rgba(255,255,255,',
  };
}
function initParticles()    { particles = Array.from({ length: 30 }, createParticle); }
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
const nombreSubEl     = document.getElementById('perfil-nombre-sub');
const saldoActualEl   = document.getElementById('saldo-actual');
const inputAsunto     = document.getElementById('input-asunto');
const inputMonto      = document.getElementById('input-monto');
const inputDescripcion = document.getElementById('input-descripcion');
const errorAsunto     = document.getElementById('error-asunto');
const errorMonto      = document.getElementById('error-monto');
const form            = document.getElementById('form-pago');
const btnSubmit       = document.getElementById('btn-submit');
const quickBtns       = document.querySelectorAll('.quick-btn');
const toastEl         = document.getElementById('toast');

// Elementos de imagen
const inputImagenCamara  = document.getElementById('input-imagen-camara');
const inputImagenGaleria = document.getElementById('input-imagen-galeria');
const uploadZone     = document.getElementById('image-upload-zone');
const uploadPH       = document.getElementById('upload-placeholder');
const uploadPreview  = document.getElementById('upload-preview');
const previewImg     = document.getElementById('preview-img');
const removeImgBtn   = document.getElementById('remove-img-btn');

// Modal de selección de origen (Cámara / Galería)
const sourceOverlay    = document.getElementById('image-source-overlay');
const btnSourceCamara  = document.getElementById('btn-source-camara');
const btnSourceGaleria = document.getElementById('btn-source-galeria');
const sourceCancel     = document.getElementById('image-source-cancel');

/* ── Estado interno ── */
let saldoActual   = 0;
let imagenBase64  = null;

/* ══════════════════════════════════════════════════════
   CARGA DEL PERFIL Y SALDO ACTUAL
   ══════════════════════════════════════════════════════ */
async function loadPerfil() {
  try {
    const res  = await fetch(`/api/perfiles/${perfilId}`);
    if (!res.ok) throw new Error();
    const perfil = await res.json();
    saldoActual = perfil.saldo;
    nombreSubEl.textContent = `Para: ${perfil.nombre}`;

    const fmt = `$${Math.abs(saldoActual).toLocaleString('es-AR')} ARS`;
    saldoActualEl.textContent = saldoActual < 0 ? `-${fmt}` : fmt;
    saldoActualEl.classList.toggle('negative', saldoActual < 0);
  } catch {
    saldoActualEl.textContent = 'Error al cargar';
    nombreSubEl.textContent = 'Nuevo movimiento';
  }
}

/* ══════════════════════════════════════════════════════
   BOTONES DE MONTOS RÁPIDOS
   ══════════════════════════════════════════════════════ */
quickBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const amount = btn.dataset.amount;

    if (amount === 'all') {
      if (saldoActual > 0) {
        inputMonto.value = Math.floor(saldoActual);
      } else {
        showToast('El saldo ya es cero o negativo', 'error');
        return;
      }
    } else {
      inputMonto.value = amount;
    }

    errorMonto.textContent = '';
    inputMonto.classList.remove('has-error');

    btn.style.transform = 'scale(0.91)';
    setTimeout(() => (btn.style.transform = ''), 150);
  });
});

/* ══════════════════════════════════════════════════════
   MANEJO DE IMAGEN
   (Ver nota detallada sobre el modal y compresión en ingreso.js)
   ══════════════════════════════════════════════════════ */

const MAX_DIM_PX        = 1600;
const MAX_BASE64_BYTES  = 700 * 1024;
const MAX_INPUT_BYTES   = 10 * 1024 * 1024;

function abrirSelectorOrigen() {
  sourceOverlay.hidden = false;
}

function cerrarSelectorOrigen() {
  sourceOverlay.hidden = true;
}

uploadZone.addEventListener('click', () => {
  if (!uploadZone.classList.contains('has-image')) {
    abrirSelectorOrigen();
  }
});

uploadZone.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && !uploadZone.classList.contains('has-image')) {
    e.preventDefault();
    abrirSelectorOrigen();
  }
});

btnSourceCamara.addEventListener('click', () => {
  inputImagenCamara.click();
  cerrarSelectorOrigen();
});

btnSourceGaleria.addEventListener('click', () => {
  inputImagenGaleria.click();
  cerrarSelectorOrigen();
});

sourceCancel.addEventListener('click', () => cerrarSelectorOrigen());

sourceOverlay.addEventListener('click', (e) => {
  if (e.target === sourceOverlay) cerrarSelectorOrigen();
});

function comprimirImagen(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_DIM_PX || height > MAX_DIM_PX) {
        if (width >= height) {
          height = Math.round((height * MAX_DIM_PX) / width);
          width  = MAX_DIM_PX;
        } else {
          width  = Math.round((width * MAX_DIM_PX) / height);
          height = MAX_DIM_PX;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx2d = canvas.getContext('2d');
      ctx2d.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);

      while (dataUrl.length > MAX_BASE64_BYTES && quality > 0.3) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      if (dataUrl.length > MAX_BASE64_BYTES) {
        reject(new Error('No se pudo comprimir la imagen lo suficiente. Probá con otra foto.'));
        return;
      }

      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen seleccionada.'));
    };

    img.src = objectUrl;
  });
}

async function procesarArchivoImagen(file) {
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('El archivo debe ser una imagen', 'error');
    return;
  }
  if (file.size > MAX_INPUT_BYTES) {
    showToast('La imagen no puede superar los 10MB', 'error');
    return;
  }

  uploadPH.querySelector('.upload-text').textContent = 'Comprimiendo imagen…';

  try {
    imagenBase64 = await comprimirImagen(file);
    previewImg.src = imagenBase64;
    uploadPH.hidden      = true;
    uploadPreview.hidden = false;
    uploadZone.classList.add('has-image');
  } catch (err) {
    showToast(err.message || 'No se pudo procesar la imagen.', 'error');
  } finally {
    uploadPH.querySelector('.upload-text').textContent = 'Tocá para adjuntar una foto';
  }
}

inputImagenCamara.addEventListener('change', (e) => {
  procesarArchivoImagen(e.target.files[0]);
});

inputImagenGaleria.addEventListener('change', (e) => {
  procesarArchivoImagen(e.target.files[0]);
});

removeImgBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  imagenBase64             = null;
  inputImagenCamara.value  = '';
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

  const val = parseFloat(inputMonto.value);
  if (!inputMonto.value || isNaN(val) || val <= 0) {
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
   Nota: a diferencia del retiro de Control Académico, aquí
   NO se muestra ningún modal de advertencia por saldo negativo.
   El pago se procesa directamente sin importar el resultado.
   ══════════════════════════════════════════════════════ */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  await procesarPago();
});

async function procesarPago() {
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `
    <span class="material-symbols-outlined">hourglass_top</span>
    Procesando…
  `;

  try {
    const payload = {
      tipo: 'pago',
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
    if (!res.ok) throw new Error(data.error || 'Error al registrar el pago.');

    const monto = payload.monto.toLocaleString('es-AR');
    const msg   = encodeURIComponent(`💸 Pago de $${monto} ARS registrado`);
    window.location.href = `perfil.html?id=${perfilId}&msg=${msg}&type=success`;

  } catch (err) {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `
      <span class="material-symbols-outlined">arrow_downward</span>
      Confirmar pago
    `;
    showToast(err.message || 'Error de conexión', 'error');
  }
}

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
loadPerfil();
