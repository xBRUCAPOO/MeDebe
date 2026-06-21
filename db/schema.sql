-- ============================================================
-- schema.sql — Base de datos de MeDebe en Cloudflare D1
-- v1.4 — Agrega funcionalidad de Perfiles
-- ============================================================

-- Tabla principal: almacena todos los movimientos (ingresos y retiros)
CREATE TABLE IF NOT EXISTS movimientos (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo    TEXT    NOT NULL,   -- 'ingreso' o 'retiro'
  monto   REAL    NOT NULL,
  materia TEXT,
  nota    INTEGER,
  imagen  TEXT,
  fecha   TEXT    NOT NULL
);

-- Tabla de saldo: siempre tiene exactamente UNA fila (id=1)
CREATE TABLE IF NOT EXISTS saldo (
  id    INTEGER PRIMARY KEY CHECK (id = 1),
  total REAL    NOT NULL DEFAULT 0
);

-- Fila inicial del saldo
INSERT OR IGNORE INTO saldo (id, total) VALUES (1, 0);

-- ── PERFILES ──────────────────────────────────────────────────────────────────

-- Tabla de perfiles de deudores/acreedores
CREATE TABLE IF NOT EXISTS perfiles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT    NOT NULL,
  descripcion TEXT,                     -- opcional
  saldo       REAL    NOT NULL DEFAULT 0,
  creado_en   TEXT    NOT NULL
);

-- Movimientos asociados a un perfil
CREATE TABLE IF NOT EXISTS movimientos_perfil (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  perfil_id   INTEGER NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  tipo        TEXT    NOT NULL,   -- 'cargo' (+) o 'pago' (-)
  monto       REAL    NOT NULL,   -- siempre positivo
  asunto      TEXT    NOT NULL,
  descripcion TEXT,               -- opcional
  imagen      TEXT,               -- base64, opcional
  fecha       TEXT    NOT NULL
);
