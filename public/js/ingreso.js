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

/* ── Mapa de recompensas según nota ──
   [CAMBIO] La nota 9 ahora vale $5.000 (antes $2.500). Debe coincidir con functions/api/ingreso.js */
const RECOMPENSAS = { 8: 2500, 9: 5000, 10: 10000 };

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
const inputImagenCamara  = document.getElementById('input-imagen-camara');
const inputImagenGaleria = document.getElementById('input-imagen-galeria');
const uploadZone     = document.getElementById('image-upload-zone');
const uploadPH       = document.getElementById('upload-placeholder');
const uploadPreview  = document.getElementById('upload-preview');
const previewImg     = document.getElementById('preview-img');
const removeImgBtn   = document.getElementById('remove-img-btn');

// Modal de selección de origen (Cámara / Galería)
const sourceOverlay  = document.getElementById('image-source-overlay');
const btnSourceCamara  = document.getElementById('btn-source-camara');
const btnSourceGaleria = document.getElementById('btn-source-galeria');
const sourceCancel     = document.getElementById('image-source-cancel');

// Error spans
const errorMateria   = document.getElementById('error-materia');
const errorNota      = document.getElementById('error-nota');

// [CAMBIO] Monto personalizado: botón toggle, contenedor del input, input y error
const btnMontoCustom   = document.getElementById('btn-monto-custom');
const customMontoWrap  = document.getElementById('custom-monto-wrap');
const inputMontoCustom = document.getElementById('input-monto-custom');
const errorMontoCustom = document.getElementById('error-monto-custom');

/* Estado interno */
let imagenBase64 = null;   // guardará la imagen en base64 para enviar al servidor
let notaSeleccionada = null;
let customActivo = false;  // [CAMBIO] true cuando "Monto personalizado" está seleccionado

/* ══════════════════════════════════════════════════════
   [CAMBIO] UTILIDADES DE MONTO
   - formatearMiles: agrega puntos separadores de miles (10000 → "10.000")
   - leerMonto: convierte el texto del input a número entero
   - formatearInputMiles: formatea el input mientras se escribe,
     manteniendo la posición del cursor
   ══════════════════════════════════════════════════════ */
function formatearMiles(num) {
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function leerMonto(texto) {
  const digitos = String(texto).replace(/\D/g, '');
  return digitos ? parseInt(digitos, 10) : 0;
}

function formatearInputMiles(input) {
  // Cantidad de dígitos que hay antes del cursor (para reubicarlo después de formatear)
  const digitosAntesCursor = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, '').length;

  // Solo dígitos, sin ceros a la izquierda y con tope de 9 dígitos
  const digitos = input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 9);
  input.value = digitos ? formatearMiles(digitos) : '';

  // Reubicar el cursor tras el mismo número de dígitos
  let pos = 0, contados = 0;
  while (pos < input.value.length && contados < digitosAntesCursor) {
    if (/\d/.test(input.value[pos])) contados++;
    pos++;
  }
  try { input.setSelectionRange(pos, pos); } catch (_) { /* algunos teclados no lo permiten */ }
}

/* ══════════════════════════════════════════════════════
   [CAMBIO] PREVIEW DEL MONTO
   Muestra el monto que se va a registrar: el personalizado si esa
   opción está activa, o el de la nota seleccionada en caso contrario.
   ══════════════════════════════════════════════════════ */
function actualizarPreview() {
  const monto = customActivo
    ? leerMonto(inputMontoCustom.value)
    : (notaSeleccionada ? RECOMPENSAS[notaSeleccionada] : 0);

  if (monto > 0) {
    previewAmount.textContent = `$${formatearMiles(monto)} ARS`;
    rewardPreview.classList.add('visible');
  } else {
    previewAmount.textContent = '—';
    rewardPreview.classList.remove('visible');
  }
}

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

    // Actualizar preview del monto (respeta el monto personalizado si está activo)
    actualizarPreview();

    // Micro-feedback: el botón presionado hace un pequeño flash de escala
    btn.style.transform = 'scale(0.92)';
    setTimeout(() => (btn.style.transform = ''), 150);
  });
});

/* ══════════════════════════════════════════════════════
   [CAMBIO] MONTO PERSONALIZADO
   El botón delgado bajo las 3 notas funciona como interruptor:
   - Activo: aparece el input para ingresar el monto debajo del botón
     y ese monto reemplaza la recompensa estándar de la nota.
   - Inactivo: el input se oculta y se limpia (vuelve la recompensa estándar).
   ══════════════════════════════════════════════════════ */
btnMontoCustom.addEventListener('click', () => {
  customActivo = !customActivo;

  btnMontoCustom.setAttribute('aria-pressed', String(customActivo));
  btnMontoCustom.setAttribute('aria-expanded', String(customActivo));
  customMontoWrap.hidden = !customActivo;

  if (customActivo) {
    inputMontoCustom.focus();
  } else {
    // Al desactivar: limpiar valor y error para que no quede nada "escondido"
    inputMontoCustom.value = '';
    errorMontoCustom.textContent = '';
    inputMontoCustom.classList.remove('has-error');
  }

  actualizarPreview();
});

// Formateo con puntos de miles en vivo + preview + limpieza de error
inputMontoCustom.addEventListener('input', () => {
  formatearInputMiles(inputMontoCustom);
  if (leerMonto(inputMontoCustom.value) > 0) {
    errorMontoCustom.textContent = '';
    inputMontoCustom.classList.remove('has-error');
  }
  actualizarPreview();
});

/* ══════════════════════════════════════════════════════
   MANEJO DE IMAGEN
   Al tocar la zona de upload se abre un modal propio que le
   pregunta al usuario si quiere usar la Cámara o la Galería,
   en vez de depender del selector nativo del sistema (que varía
   de comportamiento según el dispositivo/Android). Cada opción
   dispara su propio input[type=file] oculto.

   D1 tiene un límite de fila de ~1MB, y el backend rechaza
   imágenes que en base64 superen ~900KB (ver functions/api/ingreso.js).
   Las fotos de cámara modernas pesan 3-8MB de entrada, así que
   ANTES de convertir a base64 redimensionamos y recomprimimos
   la imagen en el navegador con <canvas>, iterando la calidad
   JPEG hasta entrar bajo el límite. Esto pasa siempre, sin que
   el usuario tenga que preocuparse por el tamaño del archivo.
   ══════════════════════════════════════════════════════ */

const MAX_DIM_PX        = 1600;        // lado mayor máximo tras redimensionar
const MAX_BASE64_BYTES  = 700 * 1024;  // techo seguro (backend acepta hasta ~900KB)
const MAX_INPUT_BYTES   = 60 * 1024 * 1024; // [CAMBIO cámara] antes 10MB: las fotos de cámara modernas lo superan; igual se comprimen en el cliente
const MAX_DIM_STEPS     = [MAX_DIM_PX, 1280, 1024, 800]; // [CAMBIO cámara] tamaños máximos a probar si la foto no entra en el límite

/** Abre el modal para elegir origen de la imagen */
function abrirSelectorOrigen() {
  sourceOverlay.hidden = false;
}

function cerrarSelectorOrigen() {
  sourceOverlay.hidden = true;
}

// Tocar la zona de upload (cuando todavía no hay imagen) abre el modal.
// Si ya hay una imagen cargada, el clic lo maneja remove-img-btn (con
// su propio stopPropagation), así que no hace falta excluirlo acá.
uploadZone.addEventListener('click', () => {
  if (!uploadZone.classList.contains('has-image')) {
    abrirSelectorOrigen();
  }
});

// Soporte de teclado: la zona es role="button" para accesibilidad
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

// Cerrar el modal si se toca el fondo oscuro (fuera de la tarjeta)
sourceOverlay.addEventListener('click', (e) => {
  if (e.target === sourceOverlay) cerrarSelectorOrigen();
});

/**
 * [CAMBIO cámara] Redimensiona y comprime una imagen en el navegador.
 * Qué hace: decodifica el archivo, lo reduce y lo recomprime a JPEG hasta que
 * el base64 entre bajo MAX_BASE64_BYTES (límite de D1). Si con 1600px no alcanza,
 * prueba con lados más chicos (MAX_DIM_STEPS) antes de rendirse.
 * Para qué sirve: las fotos de cámara pesan mucho y a veces no entraban en el
 * límite, por lo que fallaban; ahora siempre se achican lo necesario.
 * Devuelve una Promise<string> con el resultado en base64 (data URL).
 */
async function comprimirImagen(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    // Cargar la imagen en un <img> (aplica la orientación EXIF automáticamente)
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload  = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen. Si es HEIC/HEIF, configurá la cámara en JPEG o elegila desde la galería.'));
      el.src = objectUrl;
    });
    // decode() asegura que esté totalmente decodificada antes de dibujarla (fotos grandes)
    if (img.decode) { try { await img.decode(); } catch (_) { /* seguimos igual */ } }

    const anchoOrig = img.naturalWidth;
    const altoOrig  = img.naturalHeight;
    if (!anchoOrig || !altoOrig) throw new Error('No se pudo leer la imagen seleccionada.');

    // Probamos cada tamaño máximo hasta lograr que entre bajo el límite
    for (const maxDim of MAX_DIM_STEPS) {
      const escala = Math.min(1, maxDim / Math.max(anchoOrig, altoOrig));
      const width  = Math.max(1, Math.round(anchoOrig * escala));
      const height = Math.max(1, Math.round(altoOrig  * escala));

      const lienzo = document.createElement('canvas');
      lienzo.width  = width;
      lienzo.height = height;
      lienzo.getContext('2d').drawImage(img, 0, 0, width, height);

      // Iterar calidad JPEG hasta entrar bajo el límite de tamaño
      let quality = 0.85;
      let dataUrl = lienzo.toDataURL('image/jpeg', quality);
      while (dataUrl.length > MAX_BASE64_BYTES && quality > 0.3) {
        quality -= 0.1;
        dataUrl = lienzo.toDataURL('image/jpeg', quality);
      }

      lienzo.width = lienzo.height = 0; // liberar memoria del lienzo
      if (dataUrl.length <= MAX_BASE64_BYTES) return dataUrl;
    }

    throw new Error('No se pudo comprimir la imagen lo suficiente. Probá con otra foto.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** [CAMBIO cámara] ¿El archivo es una imagen? Algunas cámaras/Android entregan type vacío: se valida por extensión */
function esArchivoDeImagen(file) {
  if (file.type) return file.type.startsWith('image/');
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(file.name || '');
}

/** Procesa el archivo elegido: valida, comprime y muestra preview */
async function procesarArchivoImagen(file) {
  if (!file) return;

  if (!esArchivoDeImagen(file)) {
    showToast('El archivo debe ser una imagen', 'error');
    return;
  }

  if (file.size > MAX_INPUT_BYTES) {
    showToast('La imagen es demasiado grande para procesarla', 'error');
    return;
  }

  // Feedback visual mientras se comprime (puede tardar un instante en fotos grandes)
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
    // [CAMBIO cámara] Resetear los inputs: así se puede volver a elegir/sacar una foto tras un error
    inputImagenCamara.value  = '';
    inputImagenGaleria.value = '';
  }
}

inputImagenCamara.addEventListener('change', (e) => {
  procesarArchivoImagen(e.target.files[0]);
});

inputImagenGaleria.addEventListener('change', (e) => {
  procesarArchivoImagen(e.target.files[0]);
});

/** Eliminar imagen seleccionada y volver al placeholder */
removeImgBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // evitar que vuelva a abrir el selector de origen
  imagenBase64             = null;
  inputImagenCamara.value  = '';
  inputImagenGaleria.value = '';
  previewImg.src           = '';
  uploadPH.hidden           = false;
  uploadPreview.hidden      = true;
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

  // [CAMBIO] Validar monto personalizado (solo si la opción está activa)
  if (customActivo && leerMonto(inputMontoCustom.value) <= 0) {
    errorMontoCustom.textContent = 'Ingresá un monto mayor a cero.';
    inputMontoCustom.classList.add('has-error');
    valid = false;
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
    // [CAMBIO] Si el monto personalizado está activo, se envía al backend para reemplazar la recompensa estándar
    if (customActivo) payload.monto = leerMonto(inputMontoCustom.value);

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
    const monto  = formatearMiles(data.monto); // [CAMBIO] formato con puntos de miles consistente
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
