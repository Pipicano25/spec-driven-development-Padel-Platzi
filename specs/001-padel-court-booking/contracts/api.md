# API Contract: Reserva de Canchas de Pádel

**Feature**: `001-padel-court-booking` | **Date**: 2026-09-22 | **Plan**: [../plan.md](../plan.md)

API REST JSON servida por el backend bajo el prefijo `/api`. En desarrollo el frontend la
consume por el proxy de Vite (mismo origen), así la cookie de sesión viaja sin CORS.

## Convenciones

- **Autenticación**: cookie `sid` (`httpOnly`, `sameSite=lax`, `secure` en producción). Las rutas
  marcadas 🔒 responden `401 UNAUTHENTICATED` sin sesión válida.
- **Fechas**: `date` en formato `YYYY-MM-DD`; `startHour` entero 0–23; horas en
  `America/Bogota`.
- **Errores**: siempre con este cuerpo y nunca con stack traces ni detalles internos:

  ```json
  { "error": { "code": "SLOT_TAKEN", "message": "La cancha ya fue reservada en este horario" } }
  ```

  `message` está en español y es apto para mostrarse al usuario tal cual.

### Catálogo de errores

| HTTP | code | message |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | "Revisa los datos ingresados" (o mensaje específico del campo) |
| 400 | `INVALID_EMAIL` | "Ingresa un correo electrónico válido" |
| 400 | `WEAK_PASSWORD` | "La contraseña debe tener al menos 8 caracteres" |
| 400 | `UNKNOWN_COURT` | "La cancha seleccionada no existe" |
| 400 | `OUTSIDE_BOOKING_WINDOW` | "Solo puedes reservar con hasta 7 días de anticipación" |
| 400 | `PAST_SLOT` | "No puedes reservar en un horario que ya pasó" |
| 400 | `RESERVATION_STARTED` | "No puedes cancelar una reserva que ya comenzó" |
| 401 | `UNAUTHENTICATED` | "Inicia sesión para continuar" |
| 401 | `INVALID_CREDENTIALS` | "Correo o contraseña incorrectos" |
| 404 | `RESERVATION_NOT_FOUND` | "No encontramos esa reserva" |
| 404 | `NOT_FOUND` | "No encontramos lo que buscas" (ruta `/api` inexistente) |
| 409 | `EMAIL_TAKEN` | "Este correo ya está registrado" |
| 409 | `SLOT_TAKEN` | "La cancha ya fue reservada en este horario" |
| 409 | `ACTIVE_RESERVATION_EXISTS` | "Ya tienes una reserva activa. Cancélala o espera a que termine para hacer otra" |
| 429 | `LOGIN_LOCKED` | "Demasiados intentos fallidos. Intenta de nuevo en 15 minutos" |
| 500 | `INTERNAL_ERROR` | "Ocurrió un problema. Intenta de nuevo." |

Una reserva ajena responde `404` (no `403`) para no revelar su existencia (FR-006). Los errores
de la petición detectados por Express (cuerpo demasiado grande, URL mal codificada) responden
`400 VALIDATION_ERROR`.

---

## Autenticación

### `POST /api/auth/register`

Request: `{ "email": "ana@correo.com", "password": "secreta123" }`

| Status | Body |
|--------|------|
| 201 | `{ "user": { "id": 1, "email": "ana@correo.com" } }` + cookie `sid` |
| 400 | `INVALID_EMAIL` \| `WEAK_PASSWORD` \| `VALIDATION_ERROR` |
| 409 | `EMAIL_TAKEN` |

### `POST /api/auth/login`

Request: `{ "email": "ana@correo.com", "password": "secreta123" }`

| Status | Body |
|--------|------|
| 200 | `{ "user": { "id": 1, "email": "ana@correo.com" } }` + cookie `sid` (24 h) |
| 400 | `VALIDATION_ERROR` |
| 401 | `INVALID_CREDENTIALS` (cuenta inexistente o contraseña incorrecta, mismo mensaje) |
| 429 | `LOGIN_LOCKED` (5 fallos consecutivos → 15 min, aun con contraseña correcta) |

### `POST /api/auth/logout` 🔒

| Status | Body |
|--------|------|
| 204 | vacío; sesión eliminada y cookie borrada |

### `GET /api/auth/me` 🔒

| Status | Body |
|--------|------|
| 200 | `{ "user": { "id": 1, "email": "ana@correo.com" } }` |
| 401 | `UNAUTHENTICATED` |

---

## Canchas y disponibilidad

### `GET /api/courts` 🔒

| Status | Body |
|--------|------|
| 200 | ver abajo |

```json
{
  "courts": [
    { "id": "laureles", "name": "Cancha Laureles" },
    { "id": "el-poblado", "name": "Cancha El Poblado" },
    { "id": "belen", "name": "Cancha Belén" },
    { "id": "robledo", "name": "Cancha Robledo" },
    { "id": "envigado", "name": "Cancha Envigado" }
  ],
  "bookingWindow": { "firstDate": "2026-09-22", "lastDate": "2026-09-28" }
}
```

`bookingWindow` alimenta `min`/`max` del calendario (FR-012).

### `GET /api/courts/:courtId/availability?date=YYYY-MM-DD` 🔒

| Status | Body |
|--------|------|
| 200 | ver abajo (siempre 24 elementos, `hour` 0–23) |
| 400 | `UNKNOWN_COURT` \| `VALIDATION_ERROR` \| `OUTSIDE_BOOKING_WINDOW` |

```json
{
  "courtId": "laureles",
  "date": "2026-09-22",
  "slots": [
    { "startHour": 0, "status": "available", "selectable": false },
    { "startHour": 14, "status": "reserved", "selectable": false },
    { "startHour": 15, "status": "available", "selectable": true }
  ]
}
```

- `status`: solo `"available"` o `"reserved"`; no identifica al dueño, ni siquiera si es el
  propio usuario (FR-010).
- `selectable`: `status == "available"` y el bloque no ha comenzado (FR-011).

---

## Reservas

### `POST /api/reservations` 🔒

Request: `{ "courtId": "laureles", "date": "2026-09-22", "startHour": 15 }`

Ejecuta todas las validaciones y el `INSERT` en una única transacción (ver
[data-model.md](../data-model.md#invariantes-críticas-verificadas-en-una-única-transacción-al-crear)).

| Status | Body |
|--------|------|
| 201 | `{ "reservation": Reservation }` |
| 400 | `VALIDATION_ERROR` \| `UNKNOWN_COURT` \| `OUTSIDE_BOOKING_WINDOW` \| `PAST_SLOT` |
| 401 | `UNAUTHENTICATED` |
| 409 | `ACTIVE_RESERVATION_EXISTS` \| `SLOT_TAKEN` |

### `GET /api/reservations/me` 🔒

| Status | Body |
|--------|------|
| 200 | `{ "upcoming": Reservation[], "history": Reservation[] }` |

- `upcoming`: reservas activas (incluye la en curso), orden ascendente por fecha/hora. Por la
  regla de una reserva activa contiene como máximo 1 elemento.
- `history`: reservas cuya hora de fin ya pasó, orden descendente. Las canceladas no existen.

### `DELETE /api/reservations/:id` 🔒

| Status | Body |
|--------|------|
| 204 | vacío; la reserva se elimina y el bloque queda disponible |
| 400 | `RESERVATION_STARTED` |
| 404 | `RESERVATION_NOT_FOUND` (no existe o pertenece a otro usuario) |

---

## Tipo `Reservation`

```json
{
  "id": 7,
  "courtId": "laureles",
  "courtName": "Cancha Laureles",
  "date": "2026-09-22",
  "startHour": 15,
  "endHour": 16,
  "cancellable": true
}
```

`endHour` es `startHour + 1` (24 para el bloque 23:00–00:00; se muestra como `00:00`).
`cancellable` indica si la reserva aún no comienza (FR-020).
