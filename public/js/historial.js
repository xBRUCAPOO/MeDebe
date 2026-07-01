/**
 * historial.js — Lógica de la pantalla de historial (historial.html)
 * Responsabilidades:
 *   1. Cargar todos los movimientos desde el API
 *   2. Renderizar cada movimiento como una tarjeta en la lista
 *      — Muestra: saldo antes | cambio | saldo después
 *   3. Filtrar por tipo (todos / ingresos / retiros)
 *   4. Abrir imágenes adjuntas en un modal de pantalla completa
 *   5. Animación de entrada escalonada de los ítems
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
const balanceAmountEl = document.getElementById('balance-amount');
const listEl         = document.getElementById('movimientos-list');
const emptyEl        = document.getElementById('hist-empty');
const loadingEl      = document.getElementById('hist-loading');
const filterBtns     = document.querySelectorAll('.filter-btn');
const imgModalOv     = document.getElementById('img-modal-overlay');
const imgModalImg    = document.getElementById('img-modal-img');
const imgModalClose  = document.getElementById('img-modal-close');
const toastEl        = document.getElementById('toast');

/* ── Estado interno ── */
let allMovimientos = [];
let filtroActivo   = 'todos';

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
   Recorre los movimientos de más viejo a más reciente
   para calcular el saldo antes y después de cada uno.
   ══════════════════════════════════════════════════════ */
function calcularSaldos(movimientos) {
  // Los movimientos vienen ordenados DESC (más nuevo primero)
  // Para calcular saldos los procesamos en orden cronológico (reverso)
  const cronologico = [...movimientos].reverse();
  const saldoAntes = new Map(); // id → saldo antes del movimiento
  const saldoDespues = new Map(); // id → saldo después del movimiento

  let acumulado = 0;
  cronologico.forEach(mov => {
    saldoAntes.set(mov.id, acumulado);
    if (mov.tipo === 'ingreso') acumulado += mov.monto;
    else acumulado -= mov.monto;
    saldoDespues.set(mov.id, acumulado);
  });

  return { saldoAntes, saldoDespues };
}

/* ══════════════════════════════════════════════════════
   RENDERIZADO DE UN ÍTEM DE MOVIMIENTO
   ══════════════════════════════════════════════════════ */
function renderMovimiento(mov, index, saldoAntes, saldoDespues) {
  const esIngreso = mov.tipo === 'ingreso';
  const cambio    = esIngreso ? mov.monto : -mov.monto;
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
    ? `<span class="bal-change bal-change--pos">+$${balanceAmountEl.toLocaleString('es-AR')}</span>`
    : `<span class="bal-change bal-change--neg">−$${balanceAmountEl.toLocaleString('es-AR')}</span>`;

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
  `;

  return li;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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

    // Calcular saldos sobre el conjunto filtrado para que los números
    // sean consistentes con lo que se muestra
    const { saldoAntes, saldoDespues } = calcularSaldos(filtrados);

    filtrados.forEach((mov, i) => {
      const liEl = renderMovimiento(mov, i, saldoAntes, saldoDespues);
      listEl.appendChild(liEl);
    });

    listEl.querySelectorAll('.mov-image-container').forEach(container => {
      const openModal = () => {
        const imgData = decodeURIComponent(container.dataset.img);
        imgModalImg.src = imgData;
        imgModalOv.hidden = false;
        document.body.style.overflow = 'hidden';
      };

      container.addEventListener('click', openModal);
      container.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') openModal();
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
    const res = await fetch('/api/historial');
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
loadHistorial();
