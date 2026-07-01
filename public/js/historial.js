/**
 * historial.js — Lógica de la pantalla de historial (historial.html)
 * Responsabilidades:
 *   1. Cargar todos los movimientos y el saldo real desde el API
 *   2. Renderizar cada movimiento como una tarjeta en la lista
 *      — Muestra: saldo antes | cambio | saldo después
 *      — Los saldos se calculan ANCLADOS al saldo real actual (no
 *        se asume que el historial arranca en $0), así el antes/después
 *        siempre es correcto sin importar el filtro activo.
 *   3. Filtrar por tipo (todos / ingresos / retiros)
 *   4. Abrir imágenes adjuntas en un modal de pantalla completa
 *   5. Mantener presionado un movimiento para eliminarlo (revierte el saldo)
 *   6. Animación de entrada escalonada de los ítems
 */

'use strict';

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
const listEl         = document.getElementById('movimientos-list');
const emptyEl        = document.getElementById('hist-empty');
const loadingEl      = document.getElementById('hist-loading');
const filterBtns     = document.querySelectorAll('.filter-btn');
const imgModalOv     = document.getElementById('img-modal-overlay');
const imgModalImg    = document.getElementById('img-modal-img');
const imgModalClose  = document.getElementById('img-modal-close');
const toastEl        = document.getElementById('toast');

const deleteOverlay  = document.getElementById('mov-delete-overlay');
const deleteCancel   = document.getElementById('mov-delete-cancel');
const deleteConfirm  = document.getElementById('mov-delete-confirm');

/* ── Estado interno ── */
let allMovimientos = [];       // siempre ordenados DESC (más nuevo primero)
let filtroActivo   = 'todos';
let saldoAntesMap  = new Map();
let saldoDespuesMap = new Map();
let movAEliminar   = null;

/* ══════════════════════════════════════════════════════
   FORMATEO DE FECHA
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

/**
 * Formatea un número con puntos de miles (estilo ARS).
 * Si es negativo, antepone "- ".
 */
function formatMonto(n) {
  if (n < 0) return '- $' + Math.abs(n).toLocaleString('es-AR');
  return '$' + Math.abs(n).toLocaleString('es-AR');
}

/* ══════════════════════════════════════════════════════
   CÁLCULO DE SALDOS ACUMULADOS
   Los movimientos vienen ordenados DESC (más nuevo primero).
   En vez de asumir que el historial arranca en $0 (lo cual rompía
   los números apenas se aplicaba un filtro, o si el saldo real no
   coincidía con la suma de los movimientos visibles), anclamos el
   cálculo al saldo REAL actual que viene del backend (/api/saldo)
   y retrocedemos movimiento por movimiento. Así "antes" y "después"
   siempre reflejan el saldo verdadero, sin importar el filtro.
   ══════════════════════════════════════════════════════ */
function calcularSaldos(movimientosDesc, saldoActual) {
  const saldoAntes   = new Map();
  const saldoDespues = new Map();

  let acumulado = saldoActual;
  movimientosDesc.forEach(mov => {
    saldoDespues.set(mov.id, acumulado);
    const antes = mov.tipo === 'ingreso' ? acumulado - mov.monto : acumulado + mov.monto;
    saldoAntes.set(mov.id, antes);
    acumulado = antes;
  });

  return { saldoAntes, saldoDespues };
}

/* ══════════════════════════════════════════════════════
   RENDERIZADO DE UN ÍTEM DE MOVIMIENTO
   ══════════════════════════════════════════════════════ */
function renderMovimiento(mov, index, saldoAntes, saldoDespues) {
  const esIngreso = mov.tipo === 'ingreso';
  const antes     = saldoAntes.get(mov.id);
  const despues   = saldoDespues.get(mov.id);
  const fecha     = formatFecha(mov.fecha);
  const delay     = Math.min(index * 50, 400);

  // Badge de nota (solo ingresos)
  let notaBadge = '';
  if (esIngreso) {
    const esGold = mov.nota === 10;
    notaBadge = `
      <span class="mov-nota">
        Nota: <span class="nota-badge ${esGold ? 'nota-badge--gold' : ''}">
          ${mov.nota}${esGold ? ' ⭐' : ''}
        </span>
      </span>`;
  }

  // Imagen adjunta
  const imagenHtml = (esIngreso && mov.imagen)
    ? `<div class="mov-image-container" role="button" tabindex="0"
            aria-label="Ver imagen adjunta en pantalla completa"
            data-img="${encodeURIComponent(mov.imagen)}">
         <img class="mov-image" src="${mov.imagen}" alt="Imagen de respaldo de la evaluación" loading="lazy" />
       </div>`
    : '';

  // Línea de balance: antes | +cambio | = después
  const cambioStr = esIngreso
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
  li.className = `mov-item mov-item--${mov.tipo}`;
  li.style.animationDelay = `${delay}ms`;
  li.dataset.tipo = mov.tipo;
  li.dataset.id   = mov.id;

  li.innerHTML = `
    <div class="mov-body">
      <div class="mov-type-icon" aria-hidden="true">
        <span class="material-symbols-outlined">
          ${esIngreso ? 'school' : 'arrow_upward'}
        </span>
      </div>
      <div class="mov-info">
        <span class="mov-title">
          ${esIngreso ? escapeHtml(mov.materia) : 'Retiro registrado'}
        </span>
        ${notaBadge}
        <span class="mov-date">
          <span class="material-symbols-outlined" style="font-size:0.75rem;vertical-align:-1px">
            schedule
          </span>
          ${fecha}
        </span>
        ${balanceLine}
      </div>
      <span class="mov-amount">
        ${esIngreso ? '+' : '−'}$${mov.monto.toLocaleString('es-AR')}
      </span>
    </div>
    ${imagenHtml}
    <div class="mov-item-delete-overlay" data-action="delete">
      <span class="material-symbols-outlined">delete</span>
      Eliminar movimiento
    </div>
  `;

  /* Botón eliminar dentro del overlay press-and-hold */
  li.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
    e.stopPropagation();
    openDeleteModal(mov);
  });

  attachPressHold(li);

  return li;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ══════════════════════════════════════════════════════
   MANTENER PRESIONADO PARA ELIMINAR
   ══════════════════════════════════════════════════════ */
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

    // Los saldos se calculan una sola vez sobre TODOS los movimientos
    // (saldoAntesMap / saldoDespuesMap), así el filtro solo cambia qué
    // se muestra, nunca los números de saldo antes/después.
    filtrados.forEach((mov, i) => {
      const liEl = renderMovimiento(mov, i, saldoAntesMap, saldoDespuesMap);
      listEl.appendChild(liEl);
    });

    listEl.querySelectorAll('.mov-image-container').forEach(container => {
      const openModal = () => {
        const imgData = decodeURIComponent(container.dataset.img);
        imgModalImg.src = imgData;
        imgModalOv.hidden = false;
        document.body.style.overflow = 'hidden';
      };

      container.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal();
      });
      container.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          openModal();
        }
      });
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
    const res = await fetch(`/api/movimientos/${movId}`, { method: 'DELETE' });
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
    const [histRes, saldoRes] = await Promise.all([
      fetch('/api/historial'),
      fetch('/api/saldo'),
    ]);

    if (!histRes.ok) throw new Error('Error al cargar el historial');
    if (!saldoRes.ok) throw new Error('Error al cargar el saldo');

    allMovimientos = await histRes.json();
    const saldoData = await saldoRes.json();
    const saldoActual = saldoData?.total ?? 0;

    const { saldoAntes, saldoDespues } = calcularSaldos(allMovimientos, saldoActual);
    saldoAntesMap   = saldoAntes;
    saldoDespuesMap = saldoDespues;

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
loadHistorial();
