# Implementation Plan: Reserva de Canchas de Pádel

**Branch**: `001-padel-court-booking` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-padel-court-booking/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Aplicación web para reservar las 5 canchas fijas de pádel en bloques de 1 hora, con registro e
inicio de sesión por correo y contraseña, grilla diaria de disponibilidad dentro de una ventana
de 7 días, máximo una reserva activa por usuario y un panel "Mis Reservas" con cancelación.

Enfoque técnico: frontend React + Tailwind (Vite) que consume una API REST Express bajo `/api`;
SQLite con `better-sqlite3` y SQL puro. La regla crítica de doble reserva se garantiza con una
transacción `IMMEDIATE` que valida todo antes de insertar, más un índice `UNIQUE
(court_id, date, start_hour)` como última defensa. Sesiones en tabla SQLite con cookie
`httpOnly`; contraseñas con `crypto.scrypt`; toda la lógica de tiempo en el backend con zona
`America/Bogota`. Detalles en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 22 LTS (backend) y navegador moderno (frontend)

**Primary Dependencies**: Backend — Express 4, better-sqlite3, cookie-parser. Frontend — React 18,
react-router-dom, Tailwind CSS, Vite. Dev — tsx, Vitest, supertest.

**Storage**: SQLite local `/db/padel.db`; esquema y seed en `/db/schema.sql`

**Testing**: Vitest (backend y frontend) + supertest para la API, con SQLite `:memory:` y reloj
inyectable

**Target Platform**: Servidor Node.js local; navegadores de escritorio y móvil actuales

**Project Type**: Aplicación web (frontend SPA + backend API)

**Performance Goals**: Grilla de disponibilidad visible en < 2 s (SC-003); flujo registro +
primera reserva en < 3 min (SC-001)

**Constraints**: 0 dobles reservas bajo peticiones simultáneas (SC-002); ningún error técnico
expuesto al usuario (SC-005); hora local `America/Bogota`

**Scale/Scope**: Un club, 5 canchas, decenas a cientos de usuarios; 4 pantallas (login,
registro, canchas/grilla, mis reservas); 9 endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Regla de la constitución | Cómo la cumple el plan | Pre | Post |
|---|--------------------------|------------------------|-----|------|
| I | Catálogo cerrado de 5 canchas | Tabla `courts` sembrada con 5 filas fijas; sin rutas de alta/edición/baja; cancha desconocida → 400 `UNKNOWN_COURT` | ✅ | ✅ |
| II | Validar disponibilidad antes de escribir; atómico | Transacción `IMMEDIATE` con re-validación + `UNIQUE (court_id, date, start_hour)`; conflicto → 409 sin escribir; prueba de 10 peticiones simultáneas | ✅ | ✅ |
| III | Sesión obligatoria en todo flujo de reserva; 401 en servidor | Middleware `requireAuth` en canchas, disponibilidad y reservas; guard en el router del frontend | ✅ | ✅ |
| IV | Estructura plana `/frontend`, `/backend`, `/db`; funcional; sin clases | Módulos de funciones por dominio (sin capas repositorio/servicio); componentes funcionales con Hooks | ✅ | ✅ |
| V | Cero código sombra | Solo lo que exige la spec: sin pagos, admin, notificaciones, recuperación de contraseña, perfiles ni estado "Tu reserva" | ✅ | ✅ |
| Stack | React + Tailwind, Express, SQLite `padel.db` sin ORM, TypeScript | Exactamente ese stack; SQL puro parametrizado con `better-sqlite3` | ✅ | ✅ |
| Nombres | camelCase funciones/variables, PascalCase tipos | Aplicado en código y contrato JSON (`startHour`, `Reservation`) | ✅ | ✅ |
| Errores UI | Mensajes amigables, sin stack traces | `apiFetch` único + mensajes en español desde el servidor con genérico de respaldo | ✅ | ✅ |
| Errores API | Códigos HTTP semánticos (400/401/409) | 400/401/409 según constitución; además 404 (reserva ajena/inexistente), 429 (bloqueo de login, FR-004a) y 500 genérico, todos semánticos. Manejador global sin stack traces | ✅ | ✅ |

**Resultado**: Sin violaciones. Complexity Tracking no aplica.

## Project Structure

### Documentation (this feature)

```text
specs/001-padel-court-booking/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── api.md           # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md  # Spec quality checklist (/speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
db/
├── schema.sql           # DDL idempotente + seed de las 5 canchas
└── padel.db             # Generado al arrancar (ignorado por git)

backend/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts         # Arranque del servidor (puerto 3010)
│   ├── app.ts           # createApp(db, clock): monta rutas y manejador de errores
│   ├── db.ts            # Abre SQLite, aplica schema.sql, PRAGMA foreign_keys
│   ├── time.ts          # Reloj Bogotá: hoy, hora actual, ventana, pasado/activa
│   ├── errors.ts        # Catálogo de errores, httpError(), errorHandler
│   ├── auth.ts          # register/login/logout/me, scrypt, sesiones, bloqueo, requireAuth
│   ├── courts.ts        # GET courts + availability
│   ├── reservations.ts  # crear (transacción), listar, cancelar
│   └── types.ts         # Interfaces compartidas del backend
└── tests/
    ├── helpers.ts             # app con SQLite en memoria y reloj controlable
    ├── auth.test.ts
    ├── courts.test.ts
    ├── errors.test.ts
    ├── reservations.test.ts   # incluye concurrencia SC-002
    └── time.test.ts

frontend/
├── package.json
├── vite.config.ts       # proxy /api → http://localhost:3010
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx          # Rutas + guard de sesión
│   ├── index.css        # Tailwind
│   ├── api.ts           # apiFetch + mapeo de errores amigables
│   ├── format.ts        # Fechas y rangos horarios en español (CourtsPage y MyReservationsPage)
│   ├── types.ts         # Court, Slot, Reservation, User
│   ├── useAuth.tsx      # Contexto + hook de sesión
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── CourtsPage.tsx         # selector de cancha, calendario, grilla
│   │   └── MyReservationsPage.tsx
│   └── components/
│       ├── AuthForm.tsx           # formulario común de LoginPage y RegisterPage
│       ├── SlotGrid.tsx
│       ├── ConfirmDialog.tsx
│       └── NavBar.tsx
└── tests/
    └── api.test.ts
```

**Structure Decision**: Aplicación web con las tres carpetas de primer nivel que exige la
constitución (`/frontend`, `/backend`, `/db`), cada app con su propio `package.json`. Dentro del
backend, un archivo por dominio con funciones (sin capas de controladores/servicios/
repositorios). Los tipos se declaran en cada app; no se crea un paquete compartido para no
añadir una cuarta carpeta. `AuthForm.tsx` y `format.ts` no añaden funcionalidad: evitan
duplicar el formulario de login/registro y el formato de fechas/horas entre páginas.

## Complexity Tracking

No hay violaciones de la constitución que justificar.
