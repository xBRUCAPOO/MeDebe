/**
 * perfil-detalle.js — Lógica de la pantalla de detalle de perfil (perfil.html)
 * Responsabilidades:
 *   1. Animar el canvas de partículas de fondo
 *   2. Cargar el perfil seleccionado por ?id= en la URL
 *   3. Mostrar saldo, estado y estadísticas (total adeudado / pagado)
 */

'use strict';

/* ── Obtener ID del perfil desde la URL ── */
const urlParams = new URLSearchParams(window.location.search);
const perfilId   = urlParams.get('id');

if (!perfilId) {
  window.location.href = 'perfiles.html';
}

/* ── Elementos del DOM ── */
const balanceAmountEl  = document.getElementById('perfil-balance-amount');
const statCargosEl     = document.getElementById('perfil-stat-cargos');
const statPagosEl      = document.getElementById('perfil-stat-pagos');
const nombreHeaderEl   = document.getElementById('perfil-nombre-header');
const estadoHeaderEl   = document.getElementById('perfil-estado-header');
const loadingOverlay   = document.getElementById('loading-overlay');
const toastEl          = document.getElementById('toast');

/* ── FIX: asegurar scroll habilitado al volver de otra sub-página ── */
document.body.style.overflow = '';
document.documentElement.style.overflow = '';

/* ══════════════════════════════════════════════════════
   CANVAS DE PARTÍCULAS
   ══════════════════════════════════════════════════════ */
const canvas  = document.getElementById('particles-canvas');
const ctx     = canvas.getContext('2d');
let particles = [];
const PARTICLE_COUNT = 40;

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

function createParticle() {
  return {
    x:       Math.random() * canvas.width,
    y:       Math.random() * canvas.height,
    radius:  Math.random() * 1.5 + 0.3,
    vx:      (Math.random() - 0.5) * 0.3,
    vy:      (Math.random() - 0.5) * 0.3,
    alpha:   Math.random() * 0.5 + 0.1,
    color:   Math.random() > 0.7
               ? `rgba(106,191,80,`
               : `rgba(255,255,255,`,
  };
}

function initParticles() {
  particles = Array.from({ length: PARTICLE_COUNT }, createParticle);
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `${p.color}${p.alpha})`;
    ctx.fill();
  });
  requestAnimationFrame(animateParticles);
}

/* ══════════════════════════════════════════════════════
   ANIMACIÓN DE CONTADOR
   ══════════════════════════════════════════════════════ */
function animateCounter(el, from, to, duration = 800) {
  const start = performance.now();
  const diff  = to - from;

  function step(timestamp) {
    const elapsed  = timestamp - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    const current  = from + diff * eased;
    const rounded  = Math.round(current);

    el.textContent = formatNumberSigned(rounded, to);

    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = formatNumberSigned(to, to);
  }

  requestAnimationFrame(step);
}

function formatNumber(n) {
  return Math.abs(n).toLocaleString('es-AR');
}

function formatNumberSigned(current, finalValue) {
  if (finalValue < 0) {
    return '- ' + Math.abs(current).toLocaleString('es-AR');
  }
  return Math.abs(current).toLocaleString('es-AR');
}

/* ══════════════════════════════════════════════════════
   CARGA DE DATOS DEL PERFIL
   ══════════════════════════════════════════════════════ */
async function loadPerfil() {
  try {
    const [perfilRes, movRes] = await Promise.all([
      fetch(`/api/perfiles/${perfilId}`),
      fetch(`/api/perfiles/${perfilId}/movimientos`),
    ]);

    if (!perfilRes.ok) throw new Error('Perfil no encontrado');
    if (!movRes.ok) throw new Error('Error de red');

    const perfil = await perfilRes.json();
    const movimientos = await movRes.json();

    /* ── Header ── */
    nombreHeaderEl.textContent = perfil.nombre;

    const saldo = perfil.saldo;
    const esNegativo = saldo < 0;
    const esCero = saldo === 0;

    balanceAmountEl.classList.toggle('negative', esNegativo);

    const prevValue = parseInt(balanceAmountEl.dataset.value || '0', 10);
    balanceAmountEl.dataset.value = saldo;
    animateCounter(balanceAmountEl, prevValue, saldo);

    if (esCero) {
      estadoHeaderEl.textContent = 'Neutro · sin deuda';
    } else if (esNegativo) {
      estadoHeaderEl.textContent = 'Le debo';
    } else {
      estadoHeaderEl.textContent = 'Me debe';
    }

    /* ── Estadísticas ── */
    let totalCargos = 0;
    let totalPagos  = 0;

    movimientos.forEach(mov => {
      if (mov.tipo === 'cargo') totalCargos += mov.monto;
      if (mov.tipo === 'pago')  totalPagos  += mov.monto;
    });

    statCargosEl.textContent = `$${formatNumber(totalCargos)}`;
    statPagosEl.textContent  = `$${formatNumber(totalPagos)}`;

  } catch (err) {
    console.error('Error cargando perfil:', err);
    showToast('No se pudo cargar el perfil', 'error');
  } finally {
    setTimeout(() => {
      loadingOverlay.classList.add('hidden');
    }, 300);
  }
}

/* ══════════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════════ */
let toastTimeout;
function showToast(msg, type = '', duration = 3000) {
  clearTimeout(toastTimeout);
  toastEl.textContent = msg;
  toastEl.className   = `toast visible ${type}`;
  toastTimeout = setTimeout(() => toastEl.classList.remove('visible'), duration);
}

/* ══════════════════════════════════════════════════════
   INICIALIZACIÓN
   ══════════════════════════════════════════════════════ */
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
initParticles();
animateParticles();
loadPerfil();

const msgParam = urlParams.get('msg');
const typeParam = urlParams.get('type') || 'success';
if (msgParam) {
  const cleanUrl = `${window.location.pathname}?id=${perfilId}`;
  window.history.replaceState({}, '', cleanUrl);
  setTimeout(() => showToast(decodeURIComponent(msgParam), typeParam), 600);
}
