/**
 * perfiles.js — Lógica de la pantalla de Perfiles (perfiles.html)
 * Responsabilidades:
 *   1. Cargar y renderizar la lista de perfiles
 *   2. Buscador en tiempo real por nombre
 *   3. Filtros por estado: MeDebe / LeDebo / Neutro
 *   4. Modal de descripción del perfil (botón info)
 *   5. Modal para crear un nuevo perfil
 *   6. Press-and-hold para eliminar un perfil
 */

'use strict';

/* ── Canvas de partículas compartido ── */
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
const listEl        = document.getElementById('perfiles-list');
const loadingEl      = document.getElementById('perfiles-loading');
const emptyEl        = document.getElementById('perfiles-empty');
const noResultsEl    = document.getElementById('perfiles-no-results');
const searchInput    = document.getElementById('perfiles-search');
const filterBtns     = document.querySelectorAll('#perfiles-filter-bar .filter-btn');
const toastEl        = document.getElementById('toast');

const btnAddPerfil      = document.getElementById('btn-add-perfil');
const addOverlay        = document.getElementById('perfil-add-overlay');
const formAddPerfil      = document.getElementById('form-add-perfil');
const inputPerfilNombre  = document.getElementById('input-perfil-nombre');
const inputPerfilDesc    = document.getElementById('input-perfil-desc');
const errorPerfilNombre  = document.getElementById('error-perfil-nombre');
const perfilAddCancel    = document.getElementById('perfil-add-cancel');
const perfilAddSubmit    = document.getElementById('perfil-add-submit');

const infoOverlay    = document.getElementById('perfil-info-overlay');
const infoTitle      = document.getElementById('perfil-info-title');
const infoDesc       = document.getElementById('perfil-info-desc');
const infoClose      = document.getElementById('perfil-info-close');

const deleteOverlay  = document.getElementById('perfil-delete-overlay');
const deleteCancel   = document.getElementById('perfil-delete-cancel');
const deleteConfirm  = document.getElementById('perfil-delete-confirm');

/* ── Estado interno ── */
let allPerfiles    = [];
let filtroActivo   = 'todos';
let searchTerm     = '';
let perfilAEliminar = null;

/* ══════════════════════════════════════════════════════
   UTILIDADES
   ══════════════════════════════════════════════════════ */
function formatMonto(n) {
  return '$' + Math.abs(Math.round(n)).toLocaleString('es-AR');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function estadoDePerfil(saldo) {
  if (saldo > 0) return 'medebe';
  if (saldo < 0) return 'ledebo';
  return 'neutro';
}

function labelDeEstado(estado) {
  if (estado === 'medebe') return 'Me debe';
  if (estado === 'ledebo') return 'Le debo';
  return 'Neutro';
}

function iconoDeEstado(estado) {
  if (estado === 'medebe') return 'arrow_circle_down';
  if (estado === 'ledebo') return 'arrow_circle_up';
  return 'person';
}

/* ══════════════════════════════════════════════════════
   RENDERIZADO
   ══════════════════════════════════════════════════════ */
function renderPerfilItem(perfil, index) {
  const estado = estadoDePerfil(perfil.saldo);
  const delay  = Math.min(index * 50, 400);

  const li = document.createElement('li');
  li.className = `perfil-item perfil-item--${estado}`;
  li.style.animationDelay = `${delay}ms`;
  li.dataset.id = perfil.id;

  li.innerHTML = `
    <div class="perfil-body" data-action="open">
      <div class="perfil-icon" aria-hidden="true">
        <span class="material-symbols-outlined">${iconoDeEstado(estado)}</span>
      </div>
      <div class="perfil-info">
        <span class="perfil-nombre">${escapeHtml(perfil.nombre)}</span>
        <span class="perfil-estado-label">${labelDeEstado(estado)}</span>
      </div>
      <span class="perfil-saldo">${formatMonto(perfil.saldo)}</span>
      <button class="perfil-info-btn" data-action="info" aria-label="Ver descripción del perfil">
        <span class="material-symbols-outlined">info</span>
      </button>
    </div>
    <div class="perfil-delete-overlay-btn" data-action="delete">
      <span class="material-symbols-outlined">delete</span>
      Eliminar perfil
    </div>
  `;

  /* Click para entrar al perfil */
  li.querySelector('[data-action="open"]').addEventListener('click', (e) => {
    if (li.classList.contains('perfil-item--pressing')) return;
    window.location.href = `perfil.html?id=${perfil.id}`;
  });

  /* Botón info */
  li.querySelector('[data-action="info"]').addEventListener('click', (e) => {
    e.stopPropagation();
    openInfoModal(perfil);
  });

  /* Botón eliminar (dentro del overlay de press-and-hold) */
  li.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
    e.stopPropagation();
    openDeleteModal(perfil);
  });

  /* Press and hold para revelar el botón de eliminar */
  attachPressHold(li);

  return li;
}

function attachPressHold(li) {
  let pressTimer = null;
  const HOLD_MS = 500;

  const start = () => {
    pressTimer = setTimeout(() => {
      li.classList.add('perfil-item--pressing');
    }, HOLD_MS);
  };
  const cancel = () => {
    clearTimeout(pressTimer);
  };
  const release = () => {
    clearTimeout(pressTimer);
  };

  li.addEventListener('touchstart', start, { passive: true });
  li.addEventListener('touchend', release);
  li.addEventListener('touchmove', cancel);
  li.addEventListener('mousedown', start);
  li.addEventListener('mouseup', release);
  li.addEventListener('mouseleave', cancel);

  /* Tocar fuera del overlay de eliminar, dentro de la card en estado pressing, lo cierra */
  li.addEventListener('click', (e) => {
    if (li.classList.contains('perfil-item--pressing') && e.target.closest('[data-action="delete"]') === null) {
      li.classList.remove('perfil-item--pressing');
    }
  });
}

function renderLista() {
  let filtrados = filtroActivo === 'todos'
    ? allPerfiles
    : allPerfiles.filter(p => estadoDePerfil(p.saldo) === filtroActivo);

  if (searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    filtrados = filtrados.filter(p => p.nombre.toLowerCase().includes(term));
  }

  listEl.innerHTML = '';

  const hayPerfiles = allPerfiles.length > 0;

  if (!hayPerfiles) {
    emptyEl.hidden = false;
    noResultsEl.hidden = true;
    listEl.hidden = true;
    return;
  }

  if (filtrados.length === 0) {
    emptyEl.hidden = true;
    noResultsEl.hidden = false;
    listEl.hidden = true;
    return;
  }

  emptyEl.hidden = true;
  noResultsEl.hidden = true;
  listEl.hidden = false;

  filtrados.forEach((perfil, i) => {
    listEl.appendChild(renderPerfilItem(perfil, i));
  });
}

/* ══════════════════════════════════════════════════════
   BUSCADOR
   ══════════════════════════════════════════════════════ */
searchInput.addEventListener('input', () => {
  searchTerm = searchInput.value;
  renderLista();
});

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
   MODAL: INFO DEL PERFIL
   ══════════════════════════════════════════════════════ */
function openInfoModal(perfil) {
  infoTitle.textContent = perfil.nombre;
  infoDesc.textContent  = perfil.descripcion && perfil.descripcion.trim()
    ? perfil.descripcion
    : 'Este perfil no tiene descripción.';
  infoOverlay.hidden = false;
}

infoClose.addEventListener('click', () => { infoOverlay.hidden = true; });
infoOverlay.addEventListener('click', (e) => {
  if (e.target === infoOverlay) infoOverlay.hidden = true;
});

/* ══════════════════════════════════════════════════════
   MODAL: AÑADIR PERFIL
   ══════════════════════════════════════════════════════ */
btnAddPerfil.addEventListener('click', () => {
  formAddPerfil.reset();
  errorPerfilNombre.textContent = '';
  inputPerfilNombre.classList.remove('has-error');
  addOverlay.hidden = false;
  setTimeout(() => inputPerfilNombre.focus(), 100);
});

perfilAddCancel.addEventListener('click', () => { addOverlay.hidden = true; });
addOverlay.addEventListener('click', (e) => {
  if (e.target === addOverlay) addOverlay.hidden = true;
});

formAddPerfil.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre = inputPerfilNombre.value.trim();
  if (!nombre) {
    errorPerfilNombre.textContent = 'El nombre es obligatorio.';
    inputPerfilNombre.classList.add('has-error');
    return;
  }
  errorPerfilNombre.textContent = '';
  inputPerfilNombre.classList.remove('has-error');

  perfilAddSubmit.disabled = true;
  perfilAddSubmit.innerHTML = `<span class="material-symbols-outlined">hourglass_top</span> Creando…`;

  try {
    const res = await fetch('/api/perfiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        descripcion: inputPerfilDesc.value.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear el perfil.');

    addOverlay.hidden = true;
    showToast(`✅ Perfil "${nombre}" creado`, 'success');
    await loadPerfiles();
  } catch (err) {
    showToast(err.message || 'Error de conexión', 'error');
  } finally {
    perfilAddSubmit.disabled = false;
    perfilAddSubmit.innerHTML = `<span class="material-symbols-outlined">check</span> Crear`;
  }
});

/* ══════════════════════════════════════════════════════
   MODAL: ELIMINAR PERFIL
   ══════════════════════════════════════════════════════ */
function openDeleteModal(perfil) {
  perfilAEliminar = perfil;
  deleteOverlay.hidden = false;
}

deleteCancel.addEventListener('click', () => {
  deleteOverlay.hidden = true;
  perfilAEliminar = null;
});

deleteOverlay.addEventListener('click', (e) => {
  if (e.target === deleteOverlay) {
    deleteOverlay.hidden = true;
    perfilAEliminar = null;
  }
});

deleteConfirm.addEventListener('click', async () => {
  if (!perfilAEliminar) return;
  const id = perfilAEliminar.id;
  const nombre = perfilAEliminar.nombre;

  deleteConfirm.disabled = true;

  try {
    const res = await fetch(`/api/perfiles/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar el perfil.');

    deleteOverlay.hidden = true;
    showToast(`🗑️ Perfil "${nombre}" eliminado`, 'success');
    await loadPerfiles();
  } catch (err) {
    showToast(err.message || 'Error de conexión', 'error');
  } finally {
    deleteConfirm.disabled = false;
    perfilAEliminar = null;
  }
});

/* ══════════════════════════════════════════════════════
   CARGA INICIAL
   ══════════════════════════════════════════════════════ */
async function loadPerfiles() {
  try {
    const res = await fetch('/api/perfiles');
    if (!res.ok) throw new Error('Error al cargar los perfiles');

    allPerfiles = await res.json();
    loadingEl.hidden = true;
    renderLista();
  } catch (err) {
    loadingEl.hidden = true;
    showToast('Error al cargar los perfiles', 'error');
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
loadPerfiles();
