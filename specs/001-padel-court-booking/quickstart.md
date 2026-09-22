# Quickstart: Reserva de Canchas de Pádel

**Feature**: `001-padel-court-booking` | **Plan**: [plan.md](./plan.md)

Guía para arrancar el sistema y validar de punta a punta que cumple la spec. Los detalles de
endpoints y datos están en [contracts/api.md](./contracts/api.md) y
[data-model.md](./data-model.md).

## Prerrequisitos

- Node.js 22 LTS y npm 10+ (verificado: Node 22.14, npm 11.2).
- Puertos libres: `3010` (backend) y `5173` (frontend).

## Arranque

```bash
# Terminal 1 — backend (crea /db/padel.db y siembra las 5 canchas al iniciar)
cd backend
npm install
npm run dev          # http://localhost:3010

# Terminal 2 — frontend (proxy /api → localhost:3010)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Para empezar de cero: detener el backend y borrar `db/padel.db`.

## Pruebas automáticas

```bash
cd backend && npm test     # integración de la API con SQLite en memoria y reloj fijo
cd frontend && npm test    # lógica pura (mapeo de errores)
```

Deben cubrir como mínimo: registro/login/bloqueo, 401 sin sesión, ventana de 7 días, bloque
pasado, una reserva activa, cancelación y la prueba de concurrencia de SC-002.

## Validación manual (end-to-end)

Usar navegadores o ventanas privadas distintas para tener tres usuarios: **A**, **B** y **C**.

| # | Pasos | Resultado esperado | Spec |
|---|-------|--------------------|------|
| 1 | Sin sesión, abrir `/canchas` y `/mis-reservas` | Redirige a `/login`; no se ven canchas ni reservas | FR-005 |
| 2 | Registrar A con `a@test.com` / `12345678` | Queda con sesión y entra a `/canchas` | US1-1 |
| 3 | Registrar otra cuenta con `A@Test.com` | "Este correo ya está registrado" | FR-002 |
| 4 | Registrar con contraseña `1234` | "La contraseña debe tener al menos 8 caracteres" | FR-003 |
| 5 | Ver `/canchas` | Exactamente las 5 canchas; calendario limitado a hoy … hoy + 6 | FR-007, FR-012 |
| 6 | Elegir Cancha Laureles y hoy | 24 bloques 00:00–23:00; los ya comenzados no se pueden seleccionar | FR-009, FR-011 |
| 7 | A reserva un bloque futuro de mañana | Confirmación con cancha, fecha y hora; bloque pasa a "Reservado" | US2-3, FR-018 |
| 8 | A intenta reservar otro bloque | "Ya tienes una reserva activa…" | FR-017 |
| 9 | B (registrado) abre la misma cancha y fecha | El bloque de A aparece "Reservado", sin datos de A | FR-010 |
| 10 | B carga una grilla con un bloque libre; en otra ventana un tercer usuario C reserva ese bloque; B lo confirma sin recargar | B recibe "La cancha ya fue reservada en este horario" y la grilla se actualiza | FR-014 |
| 11 | A abre `/mis-reservas` | Su reserva en "Próximas" con cancha, fecha y hora | FR-019 |
| 12 | A cancela y rechaza el diálogo | La reserva sigue igual | US3-4 |
| 13 | A cancela y confirma | Desaparece del panel (no va al historial); B ve el bloque "Disponible" al recargar | FR-021, FR-022, SC-006 |
| 14 | Cerrar sesión e intentar login 5 veces con contraseña errónea, luego con la correcta | 5.º intento y siguientes: "Demasiados intentos fallidos…" durante 15 min | FR-004a |
| 15 | Login con un correo inexistente y contraseña errónea | "Correo o contraseña incorrectos" (mismo mensaje que con correo existente) | FR-004 |
| 16 | Detener el backend y hacer cualquier acción en la UI | Mensaje amigable, sin detalles técnicos | FR-023, SC-005 |

### Validación por API (opcional)

```bash
# Reserva sin sesión → 401 UNAUTHENTICATED
curl -i -X POST http://localhost:3010/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"courtId":"laureles","date":"2026-09-23","startHour":10}'

# Cancha fuera del catálogo (con cookie sid válida) → 400 UNKNOWN_COURT
curl -i -X POST http://localhost:3010/api/reservations -b "sid=<token>" \
  -H "Content-Type: application/json" \
  -d '{"courtId":"medellin","date":"2026-09-23","startHour":10}'
```

## Criterios de salida

- Las 16 validaciones manuales se cumplen.
- `npm test` pasa en backend y frontend, incluida la prueba de 10 reservas simultáneas con
  exactamente 1 éxito y 9 respuestas `409 SLOT_TAKEN` (SC-002).
- La grilla carga en menos de 2 s (SC-003).
