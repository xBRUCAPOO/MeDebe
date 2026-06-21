/**
 * retiro.js — Lógica de la pantalla de retiro (retiro.html)
 * Responsabilidades:
 *   1. Cargar y mostrar el saldo actual como referencia
 *   2. Botones de montos rápidos (incluye "Todo")
 *   3. Mostrar modal de confirmación si el saldo quedará negativo
 *   4. Enviar el retiro al API y redirigir con mensaje de éxito
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
const saldoActualEl   = document.getElementById('saldo-actual');
const inputMonto      = document.getElementById('input-monto');
const errorMonto      = document.getElementById('error-monto');
const form            = document.getElementById('form-retiro');
const btnSubmit       = document.getElementById('btn-submit-retiro');
const quickBtns       = document.querySelectorAll('.quick-btn');
const modalOverlay    = document.getElementById('modal-overlay');
const modalBody       = document.getElementById('modal-body');
const modalCancel     = document.getElementById('modal-cancel');
const modalConfirm    = document.getElementById('modal-confirm');
const toastEl         = document.getElementById('toast');

/* ── Estado interno ── */
let saldoActual = 0;          // saldo cargado desde el servidor
let montoARetirar = 0;        // monto que el usuario quiere retirar

/* ══════════════════════════════════════════════════════
   CARGA DEL SALDO ACTUAL
   ══════════════════════════════════════════════════════ */
async function loadSaldo() {
  try {
    const res  = await fetch('/api/saldo');
    const data = await res.json();
    saldoActual = data.total;

    const fmt = `$${Math.abs(saldoActual).toLocaleString('es-AR')} ARS`;
    saldoActualEl.textContent = saldoActual < 0 ? `-${fmt}` : fmt;
    saldoActualEl.classList.toggle('negative', saldoActual < 0);
  } catch {
    saldoActualEl.textContent = 'Error al cargar';
  }
}

/* ══════════════════════════════════════════════════════
   BOTONES DE MONTOS RÁPIDOS
   ══════════════════════════════════════════════════════ */
quickBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const amount = btn.dataset.amount;

    if (amount === 'all') {
      // "Todo" pone el saldo actual completo (si es positivo)
      if (saldoActual > 0) {
        inputMonto.value = Math.floor(saldoActual);
      } else {
        showToast('El saldo ya es cero o negativo', 'error');
        return;
      }
    } else {
      inputMonto.value = amount;
    }

    // Limpiar error si había
    errorMonto.textContent = '';
    inputMonto.classList.remove('has-error');

    // Micro-feedback visual
    btn.style.transform = 'scale(0.91)';
    setTimeout(() => (btn.style.transform = ''), 150);
  });
});

/* ══════════════════════════════════════════════════════
   VALIDACIÓN
   ══════════════════════════════════════════════════════ */
function validateMonto() {
  const val = parseFloat(inputMonto.value);

  if (!inputMonto.value || isNaN(val) || val <= 0) {
    errorMonto.textContent = 'Ingresá un monto mayor a cero.';
    inputMonto.classList.add('has-error');
    return false;
  }

  errorMonto.textContent = '';
  inputMonto.classList.remove('has-error');
  return true;
}

inputMonto.addEventListener('input', () => {
  if (inputMonto.value && parseFloat(inputMonto.value) > 0) {
    errorMonto.textContent = '';
    inputMonto.classList.remove('has-error');
  }
});

/* ══════════════════════════════════════════════════════
   FLUJO DEL FORMULARIO
   Al enviar:
     1. Validamos el monto
     2. Si el saldo quedará negativo → mostramos modal de confirmación
     3. Si no → procesamos directamente
   ══════════════════════════════════════════════════════ */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateMonto()) return;

  montoARetirar = parseFloat(inputMonto.value);
  const saldoResultante = saldoActual - montoARetirar;

  if (saldoResultante < 0) {
    // ⚠️ El saldo quedará negativo: mostrar modal de advertencia
    const fmtResultante = `$${Math.abs(saldoResultante).toLocaleString('es-AR')} ARS`;
    modalBody.textContent =
      `Tras este retiro, el saldo quedará en −${fmtResultante}. ` +
      `Esto significa que se habrá anticipado dinero aún no ganado. ¿Confirmás?`;

    modalOverlay.hidden = false;
  } else {
    // Saldo OK, procesamos directamente
    await procesarRetiro();
  }
});

/* ── Botones del modal ── */
modalCancel.addEventListener('click', () => {
  modalOverlay.hidden = true;
});

modalConfirm.addEventListener('click', async () => {
  modalOverlay.hidden = true;
  await procesarRetiro();
});

/* ─── Cierre del modal al tocar fuera ─── */
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.hidden = true;
});

/* ══════════════════════════════════════════════════════
   PROCESAR EL RETIRO
   Envía la solicitud al backend y redirige al inicio.
   ══════════════════════════════════════════════════════ */
async function procesarRetiro() {
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `
    <span class="material-symbols-outlined">hourglass_top</span>
    Procesando…
  `;

  try {
    const res = await fetch('/api/retiro', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ monto: montoARetirar }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Error al registrar el retiro.');

    // Redirigir con mensaje de éxito
    const monto = montoARetirar.toLocaleString('es-AR');
    const msg   = encodeURIComponent(`💸 Retiro de $${monto} ARS registrado`);
    window.location.href = `/?msg=${msg}&type=success`;

  } catch (err) {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `
      <span class="material-symbols-outlined">arrow_upward</span>
      Confirmar retiro
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
loadSaldo();
