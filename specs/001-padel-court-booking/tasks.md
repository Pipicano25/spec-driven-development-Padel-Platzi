---

description: "Task list for feature implementation: Reserva de Canchas de Pádel"
---

# Tasks: Reserva de Canchas de Pádel

**Input**: Design documents from `/specs/001-padel-court-booking/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Incluidas. plan.md (R8) y quickstart.md exigen pruebas de integración del backend,
incluida la prueba de concurrencia de SC-002. Escribir cada bloque de pruebas antes de su
implementación y comprobar que falla.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Web app: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `db/`
- Reglas globales (constitución): TypeScript en todo, funciones en vez de clases, componentes
  funcionales con Hooks, `camelCase` para funciones/variables y `PascalCase` para tipos, SQL
  puro parametrizado con `better-sqlite3` (sin ORM), mensajes al usuario en español y sin
  detalles técnicos. No añadir nada fuera de spec.md.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Crear las carpetas `db/`, `backend/src/`, `backend/tests/`, `frontend/src/pages/`, `frontend/src/components/`, `frontend/tests/` y un `.gitignore` en la raíz que ignore `node_modules/`, `dist/`, `db/padel.db`, `db/padel.db-wal` y `db/padel.db-shm`
- [X] T002 Crear `backend/package.json` (`"type": "module"`) con dependencias `express@4`, `better-sqlite3`, `cookie-parser`; devDependencies `typescript`, `tsx`, `vitest`, `supertest`, `@types/express`, `@types/better-sqlite3`, `@types/cookie-parser`, `@types/supertest`, `@types/node`; scripts `"dev": "tsx watch src/index.ts"`, `"start": "tsx src/index.ts"`, `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`; ejecutar `npm install` en `backend/`
- [X] T003 [P] Crear `backend/tsconfig.json` con `strict: true`, `target: ES2022`, `module`/`moduleResolution: NodeNext`, `esModuleInterop: true`, `include: ["src", "tests"]`
- [X] T004 [P] Crear el proyecto frontend: `frontend/package.json` (`"type": "module"`) con dependencias `react@18`, `react-dom@18`, `react-router-dom`; devDependencies `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss@4`, `@tailwindcss/vite`, `vitest`, `@types/react`, `@types/react-dom`; scripts `dev`, `build`, `test` (`vitest run`), `typecheck`; más `frontend/tsconfig.json` (strict, `jsx: react-jsx`) y `frontend/index.html` con `<div id="root">`, `lang="es"` y el título "Reservas de Pádel"; ejecutar `npm install` en `frontend/`
- [X] T005 [P] Crear `frontend/vite.config.ts` con los plugins `react()` y `tailwindcss()`, `server.port: 5173` y `server.proxy: { '/api': 'http://localhost:3010' }`
- [X] T006 [P] Crear `frontend/src/index.css` con `@import "tailwindcss";`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Crear `db/schema.sql` idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) según data-model.md: `users` (`id INTEGER PRIMARY KEY AUTOINCREMENT`, `email TEXT NOT NULL UNIQUE`, `password_hash TEXT NOT NULL`, `created_at TEXT NOT NULL`); `sessions` (`token TEXT PRIMARY KEY`, `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `expires_at TEXT NOT NULL`); `login_attempts` (`email TEXT PRIMARY KEY`, `failed_count INTEGER NOT NULL DEFAULT 0`, `locked_until TEXT NULL`); `courts` (`id TEXT PRIMARY KEY`, `name TEXT NOT NULL UNIQUE`); `reservations` (`id INTEGER PRIMARY KEY AUTOINCREMENT`, `user_id INTEGER NOT NULL REFERENCES users(id)`, `court_id TEXT NOT NULL REFERENCES courts(id)`, `date TEXT NOT NULL`, `start_hour INTEGER NOT NULL CHECK (start_hour BETWEEN 0 AND 23)`, `created_at TEXT NOT NULL`, `UNIQUE (court_id, date, start_hour)`); índice `(user_id, date, start_hour)` sobre `reservations`; seed con `INSERT OR IGNORE` de exactamente 5 canchas: `laureles`/"Cancha Laureles", `el-poblado`/"Cancha El Poblado", `belen`/"Cancha Belén", `robledo`/"Cancha Robledo", `envigado`/"Cancha Envigado"
- [X] T008 Implementar `openDb(path)` en `backend/src/db.ts`: abre `better-sqlite3` en `path` (por defecto `process.env.DB_PATH` o `../db/padel.db` resuelto desde el archivo; acepta `':memory:'`), ejecuta `PRAGMA foreign_keys = ON` y `PRAGMA journal_mode = WAL` (salvo en memoria), lee y ejecuta `db/schema.sql` con `db.exec`, y devuelve la conexión
- [X] T009 [P] Implementar `backend/src/time.ts` (zona fija `America/Bogota`, sin librerías, con `Intl.DateTimeFormat`): tipo `Clock = () => Date`; `systemClock`; `bogotaNow(clock)` → `{ date: 'YYYY-MM-DD', hour: 0–23 }`; `addDays(date, n)`; `bookingWindow(clock)` → `{ firstDate: hoy, lastDate: hoy + 6 días }`; `isValidDate(str)` (formato `YYYY-MM-DD` y fecha real); `isInWindow(date, clock)`; `isPastSlot(date, startHour, clock)` ⇔ `(date, startHour) <= (hoy, horaActual)`; `isActive(date, startHour, clock)` ⇔ `(date, startHour + 1) > ahora`; `isCancellable(date, startHour, clock)` ⇔ `(date, startHour) > ahora`. Comparar con la clave `díasDesdeEpoch(date) * 24 + hora`
- [X] T010 [P] Implementar `backend/src/errors.ts` sin clases: objeto `errorCatalog` con cada `code` → `{ status, message }` copiado literalmente de la tabla "Catálogo de errores" de `contracts/api.md`; `httpError(code, message?)` devuelve un objeto `{ status, code, message }` para lanzar con `throw`; middleware `errorHandler` que responde `{ error: { code, message } }` para errores conocidos, convierte el JSON mal formado de `express.json()` en 400 `VALIDATION_ERROR` y cualquier otro error en 500 `INTERNAL_ERROR` ("Ocurrió un problema. Intenta de nuevo."), registrando el detalle solo con `console.error` en el servidor y nunca enviando stack traces
- [X] T011 [P] Declarar en `backend/src/types.ts` las interfaces `User { id: number; email: string }`, `Court { id: string; name: string }`, `Slot { startHour: number; status: 'available' | 'reserved'; selectable: boolean }`, `ReservationDto { id; courtId; courtName; date; startHour; endHour; cancellable }` y `AppDeps { db; clock }`, según `contracts/api.md`
- [X] T012 Implementar las sesiones en `backend/src/auth.ts`: `createSession(db, userId, clock)` (token de `crypto.randomBytes(32)` en hex, `expires_at` = ahora + 24 h), `deleteSession(db, token)`, `getSessionUser(db, token, clock)` (devuelve `User` solo si la sesión existe y `expires_at > ahora`; si venció, borra la fila) y el middleware `requireAuth(deps)`, que lee la cookie `sid`, adjunta el usuario a `res.locals.user` o lanza `httpError('UNAUTHENTICATED')`
- [X] T013 Implementar `createApp(deps: AppDeps)` en `backend/src/app.ts` (`express.json()`, `cookieParser()`, montaje de routers bajo `/api` y `errorHandler` al final) y `backend/src/index.ts`, que llama a `openDb()` y `createApp({ db, clock: systemClock })` y escucha en `process.env.PORT ?? 3010`
- [X] T014 [P] Crear `backend/tests/helpers.ts` con `createTestApp(initialNow: Date)`: base `':memory:'` vía `openDb`, reloj mutable (`setNow(date)`, `advance(ms)`) y la app de `createApp`; devuelve `{ app, db, setNow, advance }`
- [X] T015 [P] Escribir `backend/tests/time.test.ts` con reloj fijo: ventana de 7 días (hoy … hoy+6), bloque en curso = pasado, bloque siguiente ≠ pasado, reserva en curso activa y no cancelable, bloque 23:00 activo hasta las 00:00 del día siguiente, `isValidDate` rechaza `2026-02-30` y `2026-9-1`, y el cálculo es correcto aunque el servidor esté en otra zona (instante UTC 2026-09-23T03:30Z → Bogotá 2026-09-22, 22 h)
- [X] T016 [P] Crear `frontend/src/types.ts` (`User`, `Court`, `BookingWindow`, `Slot`, `Reservation` según `contracts/api.md`) y `frontend/src/api.ts` con `apiFetch<T>(path, options)`: envía y recibe JSON con `credentials: 'same-origin'`; en respuestas no-ok lanza `{ status, code, message }` usando `body.error.message` y, si falta o no es JSON, "Ocurrió un problema. Intenta de nuevo."; ante un error de red lanza ese mismo mensaje genérico; maneja 204 sin cuerpo
- [X] T017 [P] Escribir `frontend/tests/api.test.ts` (Vitest, `fetch` simulado): el mensaje del servidor pasa tal cual, un cuerpo no-JSON o un error de red produce el mensaje genérico, 204 devuelve `undefined` y el error nunca contiene stack ni texto técnico

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Registro e inicio de sesión (Priority: P1) 🎯 MVP

**Goal**: Un visitante se registra con correo y contraseña, inicia y cierra sesión; sin sesión solo ve login y registro (FR-001 a FR-005, FR-004a).

**Independent Test**: Registrar una cuenta, cerrar sesión, iniciar sesión de nuevo y llegar a `/canchas`; sin sesión, `/canchas` y `/mis-reservas` redirigen a `/login`. Pasos 1–4 y 14–15 de quickstart.md.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T018 [US1] Escribir `backend/tests/auth.test.ts` con `supertest` y `createTestApp`: registro 201 con cookie `sid` y `{ user: { id, email } }`; el correo se guarda normalizado (`" Ana@Test.com "` → `ana@test.com`); correo duplicado sin importar mayúsculas → 409 `EMAIL_TAKEN`; correo inválido → 400 `INVALID_EMAIL`; contraseña de 7 caracteres → 400 `WEAK_PASSWORD`; `password_hash` ≠ contraseña en texto plano; login correcto 200 con cookie; contraseña incorrecta y correo inexistente → 401 `INVALID_CREDENTIALS` con el mismo mensaje; 5 fallos consecutivos → el 5.º y los siguientes 429 `LOGIN_LOCKED`, incluso con la contraseña correcta; tras `advance(15 min)` el login correcto funciona; el bloqueo también aplica a correos no registrados; un login exitoso reinicia el contador; `GET /api/auth/me` sin cookie → 401 `UNAUTHENTICATED`; logout 204 y después `/me` → 401; sesión con más de 24 h (`advance(24 h)`) → 401

### Implementation for User Story 1

- [X] T019 [US1] Añadir a `backend/src/auth.ts` `hashPassword(password)` (`crypto.scrypt`, sal aleatoria de 16 bytes, keylen 64, formato `"salt:hash"` en hex) y `verifyPassword(password, stored)` con `crypto.timingSafeEqual`
- [X] T020 [US1] Implementar `POST /api/auth/register` en `backend/src/auth.ts` (función `authRouter(deps)`): normalizar el correo (trim + minúsculas); validar el formato (400 `INVALID_EMAIL`) y la longitud mínima de 8 caracteres (400 `WEAK_PASSWORD`); cuerpo sin strings → 400 `VALIDATION_ERROR`; `INSERT` parametrizado, convirtiendo la violación de `UNIQUE` en 409 `EMAIL_TAKEN`; crear la sesión y fijar la cookie `sid` (`httpOnly`, `sameSite: 'lax'`, `secure` si `NODE_ENV === 'production'`, `maxAge` 24 h, `path: '/'`); responder 201 `{ user }`
- [X] T021 [US1] Implementar `POST /api/auth/login` en `backend/src/auth.ts` según research.md R5: con el correo normalizado, si `login_attempts.locked_until > ahora` → 429 `LOGIN_LOCKED` sin evaluar la contraseña; si el bloqueo expiró, reiniciar el contador; ante credenciales inválidas (usuario inexistente o contraseña errónea) incrementar `failed_count` con upsert y, al llegar a 5, fijar `locked_until = ahora + 15 min` y responder 429 `LOGIN_LOCKED`; si no, 401 `INVALID_CREDENTIALS`; si son correctas, borrar la fila de `login_attempts`, crear la sesión, fijar la cookie y responder 200 `{ user }`
- [X] T022 [US1] Implementar `POST /api/auth/logout` (con `requireAuth`: borra la sesión y limpia la cookie, 204) y `GET /api/auth/me` (con `requireAuth`, 200 `{ user }`) en `backend/src/auth.ts`, y montar `authRouter(deps)` en `/api/auth` en `backend/src/app.ts`
- [X] T023 [US1] Añadir a `backend/tests/helpers.ts` `registerAndLogin(app, email)`, que crea un `supertest.agent`, registra al usuario con la contraseña `password123` y devuelve el agente con la cookie
- [X] T024 [P] [US1] Implementar `frontend/src/useAuth.tsx`: `AuthProvider` con un contexto `{ user, loading, login(email, password), register(email, password), logout() }`; al montarse llama a `GET /api/auth/me` (un 401 significa sin sesión, no es un error visible); `useAuth()` lee el contexto
- [X] T025 [P] [US1] Implementar `frontend/src/pages/LoginPage.tsx`: formulario de correo y contraseña con Tailwind; botón "Iniciar sesión" deshabilitado mientras se envía; muestra el `message` del error (incluido el de bloqueo); enlace a `/registro`; al tener éxito navega a `/canchas`
- [X] T026 [P] [US1] Implementar `frontend/src/pages/RegisterPage.tsx`: formulario de correo y contraseña; validación en cliente (mínimo 8 caracteres, "La contraseña debe tener al menos 8 caracteres"); botón "Crear cuenta" deshabilitado mientras se envía; muestra el `message` del servidor (p. ej. "Este correo ya está registrado"); enlace a `/login`; al tener éxito navega a `/canchas`
- [X] T027 [P] [US1] Implementar `frontend/src/components/NavBar.tsx`: enlaces "Canchas" (`/canchas`) y "Mis Reservas" (`/mis-reservas`), correo del usuario y botón "Cerrar sesión" que llama a `logout()` y navega a `/login`
- [X] T028 [US1] Implementar `frontend/src/App.tsx` con `react-router-dom`: rutas públicas `/login` y `/registro` (con sesión redirigen a `/canchas`); rutas protegidas `/canchas` y `/mis-reservas` dentro de un guard `RequireAuth` que muestra "Cargando…" mientras `loading` y redirige a `/login` sin sesión; `NavBar` solo en rutas protegidas; `/` y cualquier otra ruta → `/canchas`. Crear `frontend/src/pages/CourtsPage.tsx` y `frontend/src/pages/MyReservationsPage.tsx` como componentes mínimos con solo su título, que US2 y US3 reemplazarán
- [X] T029 [US1] Implementar `frontend/src/main.tsx`: `createRoot` con `<BrowserRouter><AuthProvider><App/></AuthProvider></BrowserRouter>` e importar `./index.css`

**Checkpoint**: User Story 1 funciona y se prueba de forma independiente (`npm test` en backend y los pasos 1–4 y 14–15 de quickstart.md)

---

## Phase 4: User Story 2 - Consultar disponibilidad y reservar un bloque (Priority: P1)

**Goal**: El usuario con sesión elige cancha y fecha (ventana de 7 días), ve 24 bloques "Disponible"/"Reservado" y reserva un bloque con re-validación atómica (FR-007 a FR-018).

**Independent Test**: Con dos cuentas, A reserva un bloque y B lo ve "Reservado" y no puede tomarlo; 10 reservas simultáneas del mismo bloque producen exactamente 1 éxito. Pasos 5–10 de quickstart.md.

**Depends on**: US1 (hace falta un usuario con sesión)

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T030 [P] [US2] Escribir `backend/tests/courts.test.ts` (reloj fijo en 2026-09-22 14:30 Bogotá): sin sesión, `/api/courts` y la disponibilidad → 401; `GET /api/courts` devuelve exactamente las 5 canchas y `bookingWindow { firstDate: '2026-09-22', lastDate: '2026-09-28' }`; la disponibilidad devuelve 24 slots con `startHour` 0–23; en hoy, los slots 0–14 tienen `selectable: false` y el 15 `true`; un bloque reservado aparece `status: 'reserved'`, `selectable: false` y sin datos del dueño (tampoco para el propio dueño); cancha `medellin` → 400 `UNKNOWN_COURT`; fecha `2026-09-29` o `2026-09-21` → 400 `OUTSIDE_BOOKING_WINDOW`; fecha `22-09-2026` → 400 `VALIDATION_ERROR`
- [X] T031 [P] [US2] Escribir `backend/tests/reservations.test.ts` (bloque `describe('POST /api/reservations')`, reloj fijo en 2026-09-22 14:30 Bogotá): 201 con `ReservationDto` (`courtName`, `endHour = startHour + 1`, `cancellable: true`); sin sesión → 401; mismo bloque por otro usuario → 409 `SLOT_TAKEN` sin nueva fila; bloque 14 de hoy (en curso) → 400 `PAST_SLOT`; ayer → 400 (`OUTSIDE_BOOKING_WINDOW` o `PAST_SLOT`); `2026-09-29` → 400 `OUTSIDE_BOOKING_WINDOW`; `startHour` 24, -1, 1.5 o `"10"` → 400 `VALIDATION_ERROR`; cancha desconocida → 400 `UNKNOWN_COURT`; un segundo intento del mismo usuario → 409 `ACTIVE_RESERVATION_EXISTS`; una reserva en curso (reloj avanzado dentro de su hora) sigue bloqueando otra; al pasar su hora de fin el usuario puede reservar de nuevo; **concurrencia SC-002**: 10 usuarios distintos lanzan con `Promise.all` la reserva del mismo bloque → exactamente 1 respuesta 201, 9 respuestas 409 `SLOT_TAKEN` y 1 fila en `reservations`; doble envío del mismo usuario con `Promise.all` → 1 fila

### Implementation for User Story 2

- [X] T032 [US2] Implementar `courtsRouter(deps)` en `backend/src/courts.ts` (con `requireAuth`) y montarlo en `/api/courts` en `backend/src/app.ts`: `GET /` → `{ courts, bookingWindow }` desde la tabla `courts` (orden fijo del seed) y `time.bookingWindow`; `GET /:courtId/availability?date=` valida la cancha (400 `UNKNOWN_COURT`), la fecha con `isValidDate` (400 `VALIDATION_ERROR`) y la ventana (400 `OUTSIDE_BOOKING_WINDOW`), consulta los `start_hour` reservados de esa cancha y fecha y construye 24 `Slot` con `status` `'available' | 'reserved'` y `selectable = status === 'available' && !isPastSlot(...)`, sin exponer `user_id`
- [X] T033 [US2] Implementar `reservationsRouter(deps)` en `backend/src/reservations.ts` (con `requireAuth`) con `POST /` y montarlo en `/api/reservations` en `backend/src/app.ts`. La creación va dentro de `db.transaction(fn).immediate()` y aplica, en orden, los invariantes de data-model.md: (1) cancha en el catálogo → si no, 400 `UNKNOWN_COURT`; (2) `date` válida y dentro de la ventana, `startHour` entero 0–23 → si no, 400; (3) bloque no pasado → si no, 400 `PAST_SLOT`; (4) el usuario no tiene reserva activa (`isActive`) → si no, 409 `ACTIVE_RESERVATION_EXISTS`; (5) no existe fila para `(court_id, date, start_hour)` → si no, 409 `SLOT_TAKEN`; (6) `INSERT`, convirtiendo `SQLITE_CONSTRAINT_UNIQUE` en 409 `SLOT_TAKEN`. Responder 201 `{ reservation }` con una función `toReservationDto(row, clock)` exportada (hace JOIN con `courts.name`, `endHour`, `cancellable = isCancellable(...)`)
- [X] T034 [P] [US2] Implementar `frontend/src/components/SlotGrid.tsx`: props `{ slots, selectedHour, onSelect }`; 24 botones en una grilla responsive (Tailwind, 2–6 columnas), cada uno con el rango `HH:00 – HH:00` (el fin 24 se muestra como `00:00`) y la etiqueta "Disponible" o "Reservado"; colores distintos por estado; deshabilitado y con `aria-disabled` cuando `!selectable`; resalta el bloque seleccionado
- [X] T035 [US2] Reemplazar `frontend/src/pages/CourtsPage.tsx`: carga `GET /api/courts`; selector de las 5 canchas; `<input type="date">` con `min`/`max` = `bookingWindow` y hoy (`firstDate`) por defecto; al cambiar cancha o fecha carga la disponibilidad y limpia la selección; `SlotGrid`; al seleccionar muestra el resumen (cancha, fecha, hora) y el botón "Confirmar reserva", deshabilitado mientras se envía (evita el doble clic); si tiene éxito muestra "Reserva confirmada: {cancha}, {fecha}, {HH:00 – HH:00}" (FR-018) y recarga la grilla; si falla muestra el `message` del error (p. ej. "La cancha ya fue reservada en este horario"), limpia la selección y recarga la grilla (US2-4)

**Checkpoint**: User Stories 1 y 2 funcionan; `npm test` pasa, incluida la prueba de concurrencia

---

## Phase 5: User Story 3 - Mis Reservas: ver y cancelar (Priority: P2)

**Goal**: Panel con "Próximas" e "Historial" (cancha, fecha, hora) y cancelación con confirmación de reservas que aún no comienzan; las canceladas desaparecen (FR-019 a FR-022, FR-006).

**Independent Test**: Crear una reserva, verla en "Mis Reservas", cancelarla confirmando y comprobar que el bloque vuelve a "Disponible" y que se puede reservar de nuevo. Pasos 11–13 de quickstart.md.

**Depends on**: US1 (sesión) y US2 (para que existan reservas)

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T036 [US3] Añadir a `backend/tests/reservations.test.ts` los bloques `describe('GET /api/reservations/me')` y `describe('DELETE /api/reservations/:id')`, insertando las reservas pasadas directamente en `db` y avanzando el reloj: `upcoming` contiene la reserva activa (incluida la que está en curso, con `cancellable: false`) y `history` las pasadas en orden descendente, cada ítem con `courtName`, `date`, `startHour` y `endHour`; sin sesión → 401; no aparecen reservas de otros usuarios; `DELETE` de una futura propia → 204, luego desaparece de `upcoming` y de `history`, el bloque queda `available` y el usuario puede reservar de nuevo; `DELETE` de una en curso o pasada → 400 `RESERVATION_STARTED`; `DELETE` de una ajena, inexistente o con id no numérico → 404 `RESERVATION_NOT_FOUND`, y la reserva ajena sigue existiendo

### Implementation for User Story 3

- [X] T037 [US3] Añadir a `reservationsRouter` en `backend/src/reservations.ts`: `GET /me` → `{ upcoming, history }` solo con las filas de `res.locals.user.id`, separadas por `isActive`, `upcoming` ascendente y `history` descendente por `(date, start_hour)`, mapeadas con `toReservationDto`; `DELETE /:id` → busca por `id` **y** `user_id` (si no hay fila o el id no es entero → 404 `RESERVATION_NOT_FOUND`), si `!isCancellable` → 400 `RESERVATION_STARTED`, si no, `DELETE` de la fila y 204
- [X] T038 [P] [US3] Implementar `frontend/src/components/ConfirmDialog.tsx`: modal accesible (`role="dialog"`, `aria-modal`, foco inicial en "No, mantener", cierre con Escape) con props `{ open, title, message, confirmLabel, onConfirm, onCancel, pending }`
- [X] T039 [US3] Reemplazar `frontend/src/pages/MyReservationsPage.tsx`: carga `GET /api/reservations/me`; secciones "Próximas" e "Historial", con los mensajes "No tienes reservas próximas" / "Aún no tienes reservas pasadas" cuando están vacías; cada ítem muestra el nombre de la cancha, la fecha legible en español (p. ej. "martes, 22 de septiembre de 2026", construida sin desplazar la zona horaria) y `HH:00 – HH:00`; botón "Cancelar reserva" solo si `cancellable`, que abre `ConfirmDialog` ("¿Cancelar la reserva de {cancha} el {fecha} a las {hora}?"); al confirmar llama a `DELETE`, recarga la lista y muestra "Reserva cancelada"; los errores se muestran con su `message`

**Checkpoint**: Las tres historias funcionan de forma independiente

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T040 [P] Escribir `backend/tests/errors.test.ts`: un JSON mal formado en `POST /api/auth/login` → 400 `VALIDATION_ERROR`; un error inesperado (una ruta de prueba montada sobre `createApp` que lanza `new Error('boom')`) → 500 con `{ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un problema. Intenta de nuevo.' } }` y un cuerpo que no contiene `boom` ni `stack` (FR-023, SC-005)
- [X] T041 Ejecutar `npm run typecheck` y `npm test` en `backend/` y `frontend/` y corregir cualquier fallo
- [X] T042 Revisar el cumplimiento de la constitución en `backend/src/` y `frontend/src/`: ninguna `class` propia, todo el SQL parametrizado (sin interpolar valores del usuario), ninguna ruta de alta/edición/baja de canchas, ninguna funcionalidad fuera de spec.md (pagos, notificaciones, perfiles, recuperación de contraseña, estado "Tu reserva")
- [ ] T043 Ejecutar la validación manual completa de `specs/001-padel-court-booking/quickstart.md` (pasos 1–16 y criterios de salida) y anotar el resultado

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup; bloquea todas las historias
- **US1 (Phase 3)**: depende de Foundational
- **US2 (Phase 4)**: depende de US1 (sesión y `registerAndLogin`)
- **US3 (Phase 5)**: depende de US2 (`reservationsRouter` y `toReservationDto`)
- **Polish (Phase 6)**: depende de las historias completadas

```text
Setup ─▶ Foundational ─▶ US1 (P1, MVP) ─▶ US2 (P1) ─▶ US3 (P2) ─▶ Polish
```

### Within Each User Story

- Las pruebas se escriben primero y deben fallar
- Backend antes que la página que lo consume
- `auth.ts` y `reservations.ts` se modifican de forma secuencial (mismo archivo)

### Task-level dependencies

- T008 ← T007; T012 ← T008, T010; T013 ← T010, T012; T014 ← T013
- T019 → T020 → T021 → T022 (mismo archivo); T023 ← T022; T028 ← T024–T027; T029 ← T028
- T032, T033 ← T023; T035 ← T034, T032, T033
- T036 ← T033; T037 ← T036; T039 ← T037, T038

### Parallel Opportunities

- Setup: T003, T004, T005 y T006 tras T001/T002
- Foundational: T009, T010, T011, T016 y T017 en paralelo; T014 y T015 en paralelo después de T013
- US1: el frontend (T024–T027) en paralelo con el backend (T019–T022)
- US2: T030 y T031 en paralelo; T034 en paralelo con T032/T033
- US3: T038 en paralelo con T036/T037
- Polish: T040 en paralelo con T042

---

## Parallel Example: User Story 1

```text
# Backend (secuencial, mismo archivo):
T018 → T019 → T020 → T021 → T022 → T023
# Frontend en paralelo:
Task: "T024 useAuth en frontend/src/useAuth.tsx"
Task: "T025 LoginPage en frontend/src/pages/LoginPage.tsx"
Task: "T026 RegisterPage en frontend/src/pages/RegisterPage.tsx"
Task: "T027 NavBar en frontend/src/components/NavBar.tsx"
```

## Parallel Example: User Story 2

```text
Task: "T030 courts.test.ts"
Task: "T031 reservations.test.ts (POST + concurrencia)"
Task: "T034 SlotGrid en frontend/src/components/SlotGrid.tsx"
```

## Parallel Example: User Story 3

```text
Task: "T036 → T037 GET /me y DELETE en backend"
Task: "T038 ConfirmDialog en frontend/src/components/ConfirmDialog.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 (Setup) y Phase 2 (Foundational)
2. Completar Phase 3 (US1): registro, login, bloqueo, logout y rutas protegidas
3. **Parar y validar**: `npm test` + pasos 1–4 y 14–15 de quickstart.md

### Incremental Delivery

1. Setup + Foundational → base lista
2. + US1 → autenticación usable (MVP técnico)
3. + US2 → **primer incremento con valor de negocio**: ya se puede reservar sin doble reserva
4. + US3 → "Mis Reservas" y cancelación
5. Polish → validación completa del quickstart

### Notes

- [P] = archivos distintos y sin dependencias pendientes
- Cada historia se cierra en su checkpoint antes de pasar a la siguiente
- Si una tarea contradice la constitución o la spec, detenerse y pedir que se actualice spec.md (Principio V)

## Phase 7: Convergence

- [X] T044 Manejar la sesión expirada en el frontend: cuando cualquier llamada protegida responda 401 `UNAUTHENTICATED` (p. ej. al confirmar una reserva en `frontend/src/pages/CourtsPage.tsx` o al cargar `frontend/src/pages/MyReservationsPage.tsx`), limpiar `user` en `frontend/src/useAuth.tsx` para que `RequireAuth` redirija a `/login` sin crear la reserva; añadir la prueba correspondiente en `frontend/tests/` per spec: Edge Cases (sesión expira en la grilla), FR-005 (partial)
- [X] T045 Garantizar el cuerpo de error JSON en toda la API: en `backend/src/app.ts` añadir, antes de `errorHandler`, un manejador para rutas `/api/*` inexistentes que responda 404 `{ error: { code: 'NOT_FOUND', message: 'No encontramos lo que buscas' } }` (añadir el código a `errorCatalog` y al catálogo de `contracts/api.md`), y en `backend/src/errors.ts` convertir cualquier error de Express/body-parser con `status` 4xx (`entity.too.large`, URI mal codificada, etc.) en 400 `VALIDATION_ERROR` en lugar de 500; cubrirlo en `backend/tests/errors.test.ts` per plan: contracts/api.md convenciones de errores, FR-023 (partial)
- [X] T046 Alinear la versión de TypeScript con el plan: fijar `"typescript": "^5"` en `backend/package.json` y `frontend/package.json`, reinstalar y confirmar que `npm run typecheck` y `npm test` pasan en ambos (si se prefiere mantener TypeScript 7, actualizar primero plan.md con `/speckit-plan`) per plan: Technical Context (contradicts)
- [X] T047 En `POST /api/auth/register` de `backend/src/auth.ts`, capturar la violación `SQLITE_CONSTRAINT_UNIQUE` del `INSERT` en `users` y convertirla en 409 `EMAIL_TAKEN` (manteniendo la consulta previa), para que un registro concurrente del mismo correo no termine en 500 per T020 (partial)
- [X] T048 Revisar `frontend/src/components/AuthForm.tsx` y `frontend/src/format.ts`, que no figuran en la estructura de plan.md: justificarlos (se reutilizan en LoginPage/RegisterPage y en CourtsPage/MyReservationsPage) actualizando el árbol de plan.md, o integrar su contenido en los archivos previstos por el plan per plan: Project Structure (unrequested)
