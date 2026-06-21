/**
 * main.js — Lógica de la pantalla principal (index.html)
 * Responsabilidades:
 *   1. Animar el canvas de partículas de fondo
 *   2. Verificar conexión con el servidor
 *   3. Cargar y mostrar el saldo actual con animación de contador
 *   4. Mostrar estadísticas (total ganado / retirado)
 *   5. Texto motivacional dinámico
 */

'use strict';

/* ── Frases motivacionales según estado del saldo ── */
const FRASES = [
  'Persiste y vencerás',
  'El esfuerzo siempre tiene recompensa.',
  'TOC: Good job Hunter, roll in',
  'Si, no esta mal el 8, pero la próxima apunta al 11',
  'El 5 de hoy es el 10 de mañana',
  'Burgos hdp',
  'Que es un 2 mas en la lista?',
  'Con que así te va a en penitenciario?',
  'Y esa plata? nada mal',
  'Acordate de gradecerle a Diosito',
  'Disciplina?',
  'Obsesión?',
  'Lo estas dando todo?',
  'Colega estaría orgulloso',
  'No tendrás novia, ciertamente sos un fracasado, pero HEY, mira la plata que tenes',
  'Simula que puse algo cómico aca',
  'El que no intenta se arrepiente de la espera',
  'Todo puede pasar, pero todo pasa me dijo mamá',
  'Dale Bruca, vos podés',
  'Se tu propio Judge, pone orten en medio de tu caos',
  'TOC estaría orgulloso',
  'En el chiste y en el triunfo, lo que mas duele, es no ser visto',
  'Se el hombre que ella necesite, aunque todavía no sepas quien es',
  'Pero al igual que un inocente, no podés perder el jucio',
  'Lo gracioso de todo esto, es que todo lo que aprendiste que te llevó a la nota de ahora, te lo vas a olvidar en 2 meses xd',
  'Si, sos un fracasado, pero, se TU fracasado.',
  'Ser el mejor de los malos no quita el hecho de que sos el mejor en algo',
  'Mientras mas aprendo, me tomo un té, o que se yo algo asi era',
  'Hacelo por tus padres y por ellos que creen en tí, pedazo de egoísta',
  'Intenta cumplir con lo que generaste',
  'Siempre escondido detrás de la risa, que patético que sos heee...',
  'SI BRUCA LLEGA NO HAY MAS PENAS CUMPLIENDO CONDENA, JA'
];

/* ── Elementos del DOM ── */
const balanceAmountEl = document.getElementById('balance-amount');
const statIngresosEl  = document.getElementById('stat-ingresos');
const statRetirosEl   = document.getElementById('stat-retiros');
const motivationalEl  = document.getElementById('motivational-text');
const loadingOverlay  = document.getElementById('loading-overlay');
const statusDot       = document.getElementById('status-dot');
const toastEl         = document.getElementById('toast');

/* ── FIX: Asegurar que el scroll esté siempre habilitado al cargar la página ──
   Cuando el usuario vuelve desde historial/ingreso/retiro, el body puede quedar
   con overflow:hidden si un modal fue abierto en esa sub-página. Lo reseteamos. */
document.body.style.overflow = '';
document.documentElement.style.overflow = '';

/* ══════════════════════════════════════════════════════
   CANVAS DE PARTÍCULAS — Efecto visual de fondo
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

/**
 * Anima un número desde `from` hasta `to` en `duration` ms.
 * Muestra el signo negativo cuando el valor es negativo.
 */
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

/**
 * Formatea un número con puntos de miles.
 * Si `finalValue` es negativo, antepone "- " al resultado.
 * Ej: -10000 → "- 10.000"
 */
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
   COMUNICACIÓN CON EL SERVIDOR
   ══════════════════════════════════════════════════════ */

async function checkServerStatus() {
  try {
    const res = await fetch('/api/saldo', { method: 'GET' });
    if (res.ok) {
      statusDot.textContent = 'database';
      statusDot.classList.add('online');
      statusDot.classList.remove('offline');
    } else throw new Error('not ok');
  } catch {
    statusDot.textContent = 'database_off';
    statusDot.classList.add('offline');
    statusDot.classList.remove('online');
  }
}

async function loadDashboard() {
  try {
    const [saldoRes, historialRes] = await Promise.all([
      fetch('/api/saldo'),
      fetch('/api/historial'),
    ]);

    if (!saldoRes.ok || !historialRes.ok) throw new Error('Error de red');

    const { total }   = await saldoRes.json();
    const movimientos = await historialRes.json();

    // ── Actualizar saldo principal ──
    const esNegativo = total < 0;
    balanceAmountEl.classList.toggle('negative', esNegativo);

    const prevValue = parseInt(balanceAmountEl.dataset.value || '0', 10);
    balanceAmountEl.dataset.value = total;

    animateCounter(balanceAmountEl, prevValue, total);

    // ── Calcular y mostrar estadísticas ──
    let totalIngresos = 0;
    let totalRetiros  = 0;

    movimientos.forEach(mov => {
      if (mov.tipo === 'ingreso') totalIngresos += mov.monto;
      if (mov.tipo === 'retiro')  totalRetiros  += mov.monto;
    });

    statIngresosEl.textContent = `$${formatNumber(totalIngresos)}`;
    statRetirosEl.textContent  = `$${formatNumber(totalRetiros)}`;

    // ── Texto motivacional ──
    const frase = FRASES[Math.floor(Math.random() * FRASES.length)];
    motivationalEl.textContent = frase;

  } catch (err) {
    console.error('Error cargando dashboard:', err);
    showToast('No se pudo conectar con el servidor', 'error');
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

  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('visible');
  }, duration);
}

/* ══════════════════════════════════════════════════════
   INICIALIZACIÓN
   ══════════════════════════════════════════════════════ */
window.addEventListener('resize', resizeCanvas);

resizeCanvas();
initParticles();
animateParticles();
checkServerStatus();
loadDashboard();

const urlParams = new URLSearchParams(window.location.search);
const msg = urlParams.get('msg');
const type = urlParams.get('type') || 'success';
if (msg) {
  window.history.replaceState({}, '', '/');
  setTimeout(() => showToast(decodeURIComponent(msg), type), 600);
}
