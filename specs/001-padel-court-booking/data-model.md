# Data Model: Reserva de Canchas de Pádel

**Feature**: `001-padel-court-booking` | **Date**: 2026-09-22 | **Plan**: [plan.md](./plan.md)

Almacenamiento: SQLite en `/db/padel.db`, esquema en `/db/schema.sql`. Todas las horas se
interpretan en `America/Bogota` (ver [research.md R6](./research.md#r6-zona-horaria-y-reglas-de-tiempo)).
`PRAGMA foreign_keys = ON` en cada conexión.

## Entidades

### users

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `email` | TEXT NOT NULL UNIQUE | Guardado normalizado (trim + minúsculas); formato válido (FR-002) |
| `password_hash` | TEXT NOT NULL | `salt:hash` scrypt en hex; nunca texto plano (FR-003) |
| `created_at` | TEXT NOT NULL | ISO 8601 |

Validación de entrada: correo con formato válido; contraseña ≥ 8 caracteres.

### sessions

| Campo | Tipo | Reglas |
|-------|------|--------|
| `token` | TEXT PK | 32 bytes aleatorios en hex |
| `user_id` | INTEGER NOT NULL → `users.id` ON DELETE CASCADE | |
| `expires_at` | TEXT NOT NULL | ISO 8601; inicio de sesión + 24 h |

Una sesión es válida si existe y `expires_at > ahora`. Logout borra la fila. Las filas vencidas
se ignoran (y pueden borrarse al validar).

### login_attempts

| Campo | Tipo | Reglas |
|-------|------|--------|
| `email` | TEXT PK | Correo normalizado, exista o no la cuenta (FR-004a) |
| `failed_count` | INTEGER NOT NULL DEFAULT 0 | Fallos consecutivos |
| `locked_until` | TEXT NULL | ISO 8601; bloqueado mientras `locked_until > ahora` |

### courts

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | TEXT PK | Slug fijo |
| `name` | TEXT NOT NULL UNIQUE | Nombre visible |

Catálogo inmutable (Principio I, FR-007), sembrado en `schema.sql` con `INSERT OR IGNORE`.
No existe ninguna ruta para crear/editar/eliminar:

| id | name |
|----|------|
| `laureles` | Cancha Laureles |
| `el-poblado` | Cancha El Poblado |
| `belen` | Cancha Belén |
| `robledo` | Cancha Robledo |
| `envigado` | Cancha Envigado |

### reservations

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `user_id` | INTEGER NOT NULL → `users.id` | Dueño; solo él puede verla/cancelarla (FR-006) |
| `court_id` | TEXT NOT NULL → `courts.id` | Debe pertenecer al catálogo |
| `date` | TEXT NOT NULL | `YYYY-MM-DD`, dentro de hoy … hoy + 6 (FR-012) |
| `start_hour` | INTEGER NOT NULL CHECK (0–23) | Bloque de 1 h: `start_hour:00`–`start_hour+1:00` (FR-013) |
| `created_at` | TEXT NOT NULL | ISO 8601 |

**Restricciones**:

- `UNIQUE (court_id, date, start_hour)` — imposibilidad física de doble reserva (FR-015).
- Índice `(user_id, date, start_hour)` para "Mis Reservas" y la regla de una reserva activa.

## Reglas derivadas (no almacenadas)

Sea `ahora = (hoy, horaActual)` en `America/Bogota`:

| Concepto | Definición |
|----------|------------|
| Bloque pasado | `(date, start_hour) <= (hoy, horaActual)` |
| Reserva activa | `(date, start_hour + 1) > ahora` — incluye la reserva en curso |
| Reserva en historial | No activa |
| Cancelable | `(date, start_hour) > ahora` (aún no comienza) |
| Estado de bloque en grilla | `reserved` si existe fila en `reservations`; si no, `available` |
| Bloque seleccionable | `available` y no pasado |

## Ciclo de vida de una reserva

```text
            crear (bloque libre, futuro, en ventana, usuario sin reserva activa)
  (ninguna) ─────────────────────────────────────────────────────────────▶ ACTIVA (próxima)
                                                                              │   │
                     cancelar (antes de la hora de inicio) ── DELETE ◀────────┘   │
                     → el bloque vuelve a "available"; no queda rastro            │
                                                                                  │ llega la hora de fin
                                                                                  ▼
                                                                          PASADA (historial)
```

La reserva en curso (inicio ≤ ahora < fin) sigue ACTIVA pero ya no es cancelable.

## Invariantes críticas (verificadas en una única transacción al crear)

1. `court_id` existe en `courts` → si no, 400.
2. `date` válida y dentro de la ventana; `start_hour` entero 0–23 → si no, 400.
3. El bloque no es pasado → si no, 400.
4. El usuario no tiene reserva activa → si no, 409 `ACTIVE_RESERVATION_EXISTS`.
5. No existe reserva para `(court_id, date, start_hour)` → si no, 409 `SLOT_TAKEN`.
6. `INSERT`; si viola el `UNIQUE`, 409 `SLOT_TAKEN`.
