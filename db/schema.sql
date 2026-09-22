-- Esquema del Sistema de Reservas de Pádel (idempotente: se ejecuta en cada arranque).

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  email        TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT NULL
);

CREATE TABLE IF NOT EXISTS courts (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS reservations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  court_id   TEXT NOT NULL REFERENCES courts(id),
  date       TEXT NOT NULL,
  start_hour INTEGER NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  created_at TEXT NOT NULL,
  -- Regla crítica: imposible tener dos reservas para la misma cancha, fecha y hora.
  UNIQUE (court_id, date, start_hour)
);

CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations (user_id, date, start_hour);

-- Catálogo cerrado: exactamente 5 canchas fijas.
INSERT OR IGNORE INTO courts (id, name) VALUES
  ('laureles',   'Cancha Laureles'),
  ('el-poblado', 'Cancha El Poblado'),
  ('belen',      'Cancha Belén'),
  ('robledo',    'Cancha Robledo'),
  ('envigado',   'Cancha Envigado');
