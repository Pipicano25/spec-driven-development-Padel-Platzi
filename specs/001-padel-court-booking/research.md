# Research: Reserva de Canchas de Pádel

**Feature**: `001-padel-court-booking` | **Date**: 2026-09-22 | **Plan**: [plan.md](./plan.md)

El stack base viene fijado por la constitución (React + Tailwind, Node.js + Express, SQLite con
`better-sqlite3`, TypeScript). Esta investigación resuelve las decisiones que la constitución y
la spec dejan abiertas.

## R1. Prevención de doble reserva

- **Decision**: Doble barrera. (1) Validación y escritura dentro de una transacción
  `IMMEDIATE` de `better-sqlite3` (`db.transaction(fn).immediate()`), que re-lee el bloque, la
  reserva activa del usuario, la ventana de 7 días y la hora actual antes de insertar.
  (2) Restricción `UNIQUE (court_id, date, start_hour)` en la tabla `reservations` como última
  línea de defensa; si salta, se traduce a 409 `SLOT_TAKEN`.
- **Rationale**: `better-sqlite3` es síncrono, así que dentro de un proceso Node cada
  transacción se ejecuta completa sin intercalarse con otra petición; `IMMEDIATE` toma el lock de
  escritura al inicio y protege también frente a un segundo proceso. El índice único garantiza la
  regla aunque exista un bug en la validación. Cumple Principio II y FR-014/FR-015.
- **Alternatives considered**: Solo `SELECT` + `INSERT` sin transacción (vulnerable si el código
  se vuelve asíncrono); bloqueo en memoria/mutex (no sobrevive a varios procesos); solo índice
  único (la constitución exige validar antes de escribir).

## R2. Cancelación: borrar o marcar

- **Decision**: La cancelación **borra** la fila (`DELETE`).
- **Rationale**: La clarificación de la spec establece que las reservas canceladas desaparecen de
  "Mis Reservas" y del historial. Borrar libera el bloque automáticamente con un `UNIQUE` simple
  y evita tener que filtrar `cancelled_at` en todas las consultas.
- **Alternatives considered**: Borrado lógico con `cancelled_at` + índice único parcial (añade
  complejidad sin un requisito que la use; sería código sombra).

## R3. Sesiones

- **Decision**: Tabla `sessions` en SQLite con token aleatorio de 32 bytes
  (`crypto.randomBytes`), expiración a 24 h desde el inicio de sesión, enviado en una cookie
  `httpOnly`, `sameSite=lax` (y `secure` en producción). Lectura de la cookie con
  `cookie-parser`. Logout borra la fila.
- **Rationale**: Sobrevive a reinicios del servidor, es trivial de invalidar y no requiere
  dependencias pesadas. Cumple FR-004, FR-005 y el supuesto de sesión de 24 h.
- **Alternatives considered**: `express-session` con MemoryStore (se pierde al reiniciar y no es
  apto para producción); JWT (no se puede revocar en logout sin lista negra; más complejo).

## R4. Hash de contraseñas

- **Decision**: `crypto.scrypt` nativo de Node con sal aleatoria de 16 bytes; se almacena
  `salt:hash` en hex. Comparación con `crypto.timingSafeEqual`.
- **Rationale**: Cero dependencias adicionales, algoritmo resistente a fuerza bruta,
  cumple FR-003.
- **Alternatives considered**: `bcrypt` (módulo nativo extra de compilar en Windows); `bcryptjs`
  (dependencia innecesaria teniendo scrypt nativo).

## R5. Bloqueo por intentos fallidos

- **Decision**: Tabla `login_attempts (email, failed_count, locked_until)` indexada por el correo
  normalizado (minúsculas, sin espacios), exista o no la cuenta. Al 5.º fallo consecutivo se fija
  `locked_until = ahora + 15 min` y se responde 429 `LOGIN_LOCKED`. Mientras esté bloqueado se
  responde 429 sin evaluar la contraseña. Un login exitoso borra la fila; al expirar el bloqueo
  el contador se reinicia.
- **Rationale**: Implementa FR-004a con una tabla y dos consultas; aplicar la regla a correos
  inexistentes evita revelar qué cuentas existen.
- **Alternatives considered**: `express-rate-limit` por IP (no cumple "por correo" y añade
  dependencia).

## R6. Zona horaria y reglas de tiempo

- **Decision**: Toda la lógica de "ahora", "pasado", "activa" y "ventana de 7 días" se calcula en
  el backend con la zona `America/Bogota` (UTC-5, sin horario de verano) usando
  `Intl.DateTimeFormat`. Las reservas se guardan como `date` (`TEXT 'YYYY-MM-DD'`) +
  `start_hour` (`INTEGER 0–23`), sin timestamps UTC. Las comparaciones usan una clave
  `date * 24 + hour` derivada.
  - Bloque pasado ⇔ `(date, start_hour) <= (hoy, horaActual)` (el bloque en curso ya no es
    reservable).
  - Reserva activa ⇔ `(date, start_hour + 1) > ahora` (sigue activa hasta su hora de fin).
  - Ventana ⇔ `hoy <= date <= hoy + 6 días`.
- **Rationale**: Independiente de la zona horaria del servidor o del navegador; la fecha como
  texto ISO se compara lexicográficamente. El frontend nunca decide qué es "pasado": recibe
  `selectable` por bloque y la ventana desde el servidor.
- **Alternatives considered**: Timestamps UTC (conversiones innecesarias); librerías como
  `date-fns-tz`/`luxon` (dependencia extra para una zona fija sin DST).

## R7. Frontend: calendario, rutas y errores

- **Decision**: React 18 + Vite + Tailwind CSS. Calendario con `<input type="date">` nativo con
  `min`/`max` tomados de la ventana que envía el servidor. Rutas con `react-router-dom`
  (`/login`, `/registro`, `/canchas`, `/mis-reservas`) y un guard que redirige a `/login` sin
  sesión. Estado de sesión con un hook `useAuth` sobre React Context. Un único `apiFetch` que
  convierte cualquier respuesta de error en un mensaje amigable (usa `error.message` del servidor
  o un genérico "Ocurrió un problema. Intenta de nuevo.").
- **Rationale**: Mínimas dependencias, componentes funcionales con Hooks (Principio IV); el
  input nativo cumple "seleccionar una fecha en un calendario" sin librería.
- **Alternatives considered**: Librerías de calendario (`react-day-picker`, etc.) — innecesarias;
  navegación por estado sin router — funciona, pero complica recargar la página en `/mis-reservas`.

## R8. Pruebas

- **Decision**: Vitest en backend y frontend. Backend: pruebas de integración de la API con
  `supertest` sobre la app Express y una base SQLite en memoria (`:memory:`), con un reloj
  inyectable para fijar "ahora". Incluye la prueba de concurrencia de SC-002 (10 usuarios,
  mismo bloque, `Promise.all`). Frontend: pruebas de la lógica pura (mapeo de errores); la
  interfaz se valida manualmente con `quickstart.md`.
- **Rationale**: Cubre con pruebas automáticas las reglas críticas (Principios II y III) sin
  montar una infraestructura de pruebas E2E.
- **Alternatives considered**: Jest (más configuración con ESM/TS); Playwright E2E (fuera del
  alcance mínimo).

## R9. Ubicación de la base de datos

- **Decision**: `/db/schema.sql` (DDL idempotente con `CREATE TABLE IF NOT EXISTS` + seed de las
  5 canchas con `INSERT OR IGNORE`) y `/db/padel.db` (generado, ignorado por git). El backend
  ejecuta `schema.sql` al arrancar. Ruta configurable con `DB_PATH` para las pruebas.
- **Rationale**: Respeta la estructura `/frontend`, `/backend`, `/db` de la constitución sin
  herramienta de migraciones.
- **Alternatives considered**: Herramienta de migraciones (sobreingeniería para un esquema fijo).
