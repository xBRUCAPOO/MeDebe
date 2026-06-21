/**
 * perfil-historial.js — Lógica del historial de un perfil (perfil-historial.html)
 * Responsabilidades:
 *   1. Cargar todos los movimientos del perfil
 *   2. Renderizar cada movimiento (asunto en vez de materia, saldo antes/después)
 *   3. Filtrar por tipo (todos / cargos / pagos)
 *   4. Abrir modal flotante de detalle al clickear un movimiento
 *      (asunto, monto con balance, fecha y hora, descripción, foto)
 *   5. Press-and-hold sobre un movimiento para eliminarlo
 *   6. Al eliminar, revertir el efecto en el saldo del perfil
 *   7. Abrir imágenes adjuntas en un modal de pantalla completa
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
    vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
    alpha: Math.random() * 0.35 + 0.08,
    color: Math.random() > 0.75 ? 'rgba(106,191,80,' : 'rgba(255,255,255,',
  };
}
function initParticles()    { particles = Array.from({ length: 25 }, createParticle); }
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
const listEl         = document.getElementById('movimientos-list');
const emptyEl        = document.getElementById('hist-empty');
const loadingEl      = document.getElementById('hist-loading');
const filterBtns     = document.querySelectorAll('.filter-btn');
const toastEl        = document.getElementById('toast');

const imgModalOv     = document.getElementById('img-modal-overlay');
const imgModalImg    = document.getElementById('img-modal-img');
const imgModalClose  = document.getElementById('img-modal-close');

const detailOverlay  = document.getElementById('mov-detail-overlay');
const detailTitle    = document.getElementById('mov-detail-title');
const detailBalance  = document.getElementById('mov-detail-balance');
const detailDate     = document.getElementById('mov-detail-date');
const detailDesc     = document.getElementById('mov-detail-desc');
const detailImg      = document.getElementById('mov-detail-img');
const detailClose    = document.getElementById('mov-detail-close');

const deleteOverlay  = document.getElementById('mov-delete-overlay');
const deleteCancel   = document.getElementById('mov-delete-cancel');
const deleteConfirm  = document.getElementById('mov-delete-confirm');

/* ── Estado interno ── */
let allMovimientos = [];
let filtroActivo   = 'todos';
let movAEliminar   = null;

/* ══════════════════════════════════════════════════════
   FORMATEO
   ══════════════════════════════════════════════════════ */
function formatFecha(isoString) {
  const d = new Date(isoString);
  const fecha = d.toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const hora = d.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
  });
  return `${fecha}, ${hora}`;
}

function formatMonto(n) {
  if (n < 0) return '- $' + Math.abs(n).toLocaleString('es-AR');
  return '$' + Math.abs(n).toLocaleString('es-AR');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ══════════════════════════════════════════════════════
   CÁLCULO DE SALDOS ACUMULADOS
   ══════════════════════════════════════════════════════ */
function calcularSaldos(movimientos) {
  const cronologico = [...movimientos].reverse();
  const saldoAntes = new Map();
  const saldoDespues = new Map();

  let acumulado = 0;
  cronologico.forEach(mov => {
    saldoAntes.set(mov.id, acumulado);
    if (mov.tipo === 'cargo') acumulado += mov.monto;
    else acumulado -= mov.monto;
    saldoDespues.set(mov.id, acumulado);
  });

  return { saldoAntes, saldoDespues };
}

/* ══════════════════════════════════════════════════════
   CARGAR NOMBRE DEL PERFIL
   ══════════════════════════════════════════════════════ */
async function loadPerfilNombre() {
  try {
    const res = await fetch(`/api/perfiles/${perfilId}`);
    if (!res.ok) throw new Error();
    const perfil = await res.json();
    nombreSubEl.textContent = perfil.nombre;
  } catch {
    nombreSubEl.textContent = 'Movimientos del perfil';
  }
}

/* ══════════════════════════════════════════════════════
   RENDERIZADO DE UN ÍTEM
   ══════════════════════════════════════════════════════ */
function renderMovimiento(mov, index, saldoAntes, saldoDespues) {
  const esCargo  = mov.tipo === 'cargo';
  const antes    = saldoAntes.get(mov.id);
  const despues  = saldoDespues.get(mov.id);
  const fecha    = formatFecha(mov.fecha);
  const delay    = Math.min(index * 50, 400);

  const imagenHtml = mov.imagen
    ? `<div class="mov-image-container" role="button" tabindex="0"
            aria-label="Ver imagen adjunta en pantalla completa"
            data-img="${encodeURIComponent(mov.imagen)}">
         <img class="mov-image" src="${mov.imagen}" alt="Imagen adjunta del movimiento" loading="lazy" />
       </div>`
    : '';

  const cambioStr = esCargo
    ? `<span class="bal-change bal-change--pos">+$${mov.monto.toLocaleString('es-AR')}</span>`
    : `<span class="bal-change bal-change--neg">−$${mov.monto.toLocaleString('es-AR')}</span>`;

  const balanceLine = `
    <div class="mov-balance-line">
      <span class="bal-before">${formatMonto(antes)}</span>
      <span class="bal-arrow" aria-hidden="true">→</span>
      ${cambioStr}
      <span class="bal-arrow" aria-hidden="true">=</span>
      <span class="bal-after">${formatMonto(despues)}</span>
    </div>`;

  const li = document.createElement('li');
  li.className = `mov-item mov-item--${esCargo ? 'ingreso' : 'retiro'} mov-item--clickable`;
  li.style.animationDelay = `${delay}ms`;
  li.dataset.tipo = mov.tipo;
  li.dataset.id   = mov.id;

  li.innerHTML = `
    <div class="mov-body" data-action="detail">
      <div class="mov-type-icon" aria-hidden="true">
        <span class="material-symbols-outlined">
          ${esCargo ? 'subject' : 'arrow_upward'}
        </span>
      </div>
      <div class="mov-info">
        <span class="mov-title">
          ${escapeHtml(mov.asunto)}
        </span>
        <span class="mov-date">
          <span class="material-symbols-outlined" style="font-size:0.75rem;vertical-align:-1px">
            schedule
          </span>
          ${fecha}
        </span>
        ${balanceLine}
      </div>
      <span class="mov-amount">
        ${esCargo ? '+' : '−'}$${mov.monto.toLocaleString('es-AR')}
      </span>
    </div>
    ${imagenHtml}
    <div class="mov-item-delete-overlay" data-action="delete">
      <span class="material-symbols-outlined">delete</span>
      Eliminar movimiento
    </div>
  `;

  /* Abrir modal de detalle */
  li.querySelector('[data-action="detail"]').addEventListener('click', () => {
    if (li.classList.contains('mov-item--pressing')) return;
    openDetailModal(mov, antes, despues);
  });

  /* Botón eliminar dentro del overlay press-and-hold */
  li.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
    e.stopPropagation();
    openDeleteModal(mov);
  });

  /* Imagen: abrir modal ampliado (independiente del modal de detalle) */
  const imgContainer = li.querySelector('.mov-image-container');
  if (imgContainer) {
    imgContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      const imgData = decodeURIComponent(imgContainer.dataset.img);
      openImgModal(imgData);
    });
    imgContainer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.stopPropagation();
        const imgData = decodeURIComponent(imgContainer.dataset.img);
        openImgModal(imgData);
      }
    });
  }

  attachPressHold(li);

  return li;
}

function attachPressHold(li) {
  let pressTimer = null;
  const HOLD_MS = 500;

  const start = () => {
    pressTimer = setTimeout(() => {
      li.classList.add('mov-item--pressing');
    }, HOLD_MS);
  };
  const cancel = () => clearTimeout(pressTimer);

  li.addEventListener('touchstart', start, { passive: true });
  li.addEventListener('touchend', cancel);
  li.addEventListener('touchmove', cancel);
  li.addEventListener('mousedown', start);
  li.addEventListener('mouseup', cancel);
  li.addEventListener('mouseleave', cancel);

  li.addEventListener('click', (e) => {
    if (li.classList.contains('mov-item--pressing') && e.target.closest('[data-action="delete"]') === null) {
      li.classList.remove('mov-item--pressing');
    }
  });
}

/* ══════════════════════════════════════════════════════
   RENDERIZADO DE LA LISTA COMPLETA
   ══════════════════════════════════════════════════════ */
function renderLista() {
  const filtrados = filtroActivo === 'todos'
    ? allMovimientos
    : allMovimientos.filter(m => m.tipo === filtroActivo);

  listEl.innerHTML = '';

  if (filtrados.length === 0) {
    emptyEl.hidden = false;
    listEl.hidden  = true;
  } else {
    emptyEl.hidden = true;
    listEl.hidden  = false;

    const { saldoAntes, saldoDespues } = calcularSaldos(filtrados);

    filtrados.forEach((mov, i) => {
      const liEl = renderMovimiento(mov, i, saldoAntes, saldoDespues);
      listEl.appendChild(liEl);
    });
  }
}

/* ══════════════════════════════════════════════════════
   FILTROS
   ══════════════════════════════════════════════════════ */
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filtroActivo = btn.dataset.filter;
    filterBtns.forEach(b => b.classList.remove('filter-btn--active'));
    btn.classList.add('filter-btn--active');
    renderLista();
  });
});

/* ══════════════════════════════════════════════════════
   MODAL DE DETALLE DE MOVIMIENTO
   ══════════════════════════════════════════════════════ */
function openDetailModal(mov, antes, despues) {
  const esCargo = mov.tipo === 'cargo';

  detailTitle.textContent = mov.asunto;

  const cambioStr = esCargo
    ? `<span class="bal-change bal-change--pos">+$${mov.monto.toLocaleString('es-AR')}</span>`
    : `<span class="bal-change bal-change--neg">−$${mov.monto.toLocaleString('es-AR')}</span>`;

  detailBalance.innerHTML = `
    <span class="bal-before">${formatMonto(antes)}</span>
    <span class="bal-arrow" aria-hidden="true">→</span>
    ${cambioStr}
    <span class="bal-arrow" aria-hidden="true">=</span>
    <span class="bal-after">${formatMonto(despues)}</span>
  `;

  detailDate.innerHTML = `
    <span class="material-symbols-outlined" style="font-size:0.85rem">schedule</span>
    ${formatFecha(mov.fecha)}
  `;

  if (mov.descripcion && mov.descripcion.trim()) {
    detailDesc.textContent = mov.descripcion;
    detailDesc.hidden = false;
  } else {
    detailDesc.hidden = true;
  }

  if (mov.imagen) {
    detailImg.src = mov.imagen;
    detailImg.hidden = false;
    detailImg.onclick = () => openImgModal(mov.imagen);
  } else {
    detailImg.hidden = true;
    detailImg.src = '';
  }

  detailOverlay.hidden = false;
}

detailClose.addEventListener('click', () => { detailOverlay.hidden = true; });
detailOverlay.addEventListener('click', (e) => {
  if (e.target === detailOverlay) detailOverlay.hidden = true;
});

/* ══════════════════════════════════════════════════════
   MODAL DE ELIMINACIÓN (con reversión de saldo)
   ══════════════════════════════════════════════════════ */
function openDeleteModal(mov) {
  movAEliminar = mov;
  deleteOverlay.hidden = false;
}

deleteCancel.addEventListener('click', () => {
  deleteOverlay.hidden = true;
  movAEliminar = null;
});

deleteOverlay.addEventListener('click', (e) => {
  if (e.target === deleteOverlay) {
    deleteOverlay.hidden = true;
    movAEliminar = null;
  }
});

deleteConfirm.addEventListener('click', async () => {
  if (!movAEliminar) return;
  const movId = movAEliminar.id;

  deleteConfirm.disabled = true;

  try {
    const res = await fetch(`/api/perfiles/${perfilId}/movimientos/${movId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar el movimiento.');

    deleteOverlay.hidden = true;
    showToast('🗑️ Movimiento eliminado y saldo revertido', 'success');
    await loadHistorial();
  } catch (err) {
    showToast(err.message || 'Error de conexión', 'error');
  } finally {
    deleteConfirm.disabled = false;
    movAEliminar = null;
  }
});

/* ══════════════════════════════════════════════════════
   MODAL DE IMAGEN AMPLIADA
   ══════════════════════════════════════════════════════ */
function openImgModal(imgData) {
  imgModalImg.src = imgData;
  imgModalOv.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeImgModal() {
  imgModalOv.hidden = true;
  imgModalImg.src   = '';
  document.body.style.overflow = '';
}

imgModalClose.addEventListener('click', closeImgModal);
imgModalOv.addEventListener('click', (e) => {
  if (e.target === imgModalOv) closeImgModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !imgModalOv.hidden) closeImgModal();
});

/* ══════════════════════════════════════════════════════
   CARGA INICIAL DE DATOS
   ══════════════════════════════════════════════════════ */
async function loadHistorial() {
  try {
    const res = await fetch(`/api/perfiles/${perfilId}/movimientos`);
    if (!res.ok) throw new Error('Error al cargar el historial');

    allMovimientos = await res.json();
    loadingEl.hidden = true;
    renderLista();

  } catch (err) {
    loadingEl.hidden = true;
    showToast('Error al cargar el historial', 'error');
    console.error(err);
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
loadPerfilNombre();
loadHistorial();
