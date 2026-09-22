# Sistema de Reservas de Pádel

Aplicación web para reservar las 5 canchas de pádel del club en bloques de 1 hora. Los usuarios
se registran con correo y contraseña, consultan la disponibilidad diaria de cada cancha y
gestionan sus reservas desde el panel "Mis Reservas".

El proyecto se construyó con **Spec-Driven Development** usando
[Spec Kit](https://github.com/github/spec-kit): la constitución, la especificación, el plan y las
tareas son la fuente de la verdad del código (ver [Documentación del proyecto](#documentación-del-proyecto)).

## Funcionalidades

- **Autenticación**: registro e inicio de sesión con correo y contraseña; la sesión dura 24 horas.
  Tras 5 intentos fallidos con el mismo correo, el inicio de sesión se bloquea 15 minutos.
- **Catálogo cerrado**: Cancha Laureles, Cancha El Poblado, Cancha Belén, Cancha Robledo y
  Cancha Envigado.
- **Disponibilidad**: grilla de 24 bloques de 1 hora (formato 24 h) por cancha y fecha, con
  estados "Disponible" y "Reservado". Se puede reservar desde hoy hasta 6 días después.
- **Reservas**: un bloque por reserva, nunca en horarios que ya comenzaron y como máximo
  **una reserva activa por usuario**.
- **Prevención de doble reserva**: la disponibilidad se re-valida y la reserva se escribe en una
  única transacción, con una restricción `UNIQUE (cancha, fecha, hora)` como última defensa.
- **Mis Reservas**: próximas reservas e historial; las reservas futuras se pueden cancelar
  previa confirmación. Las canceladas desaparecen del panel.

Fuera de alcance en esta versión: pagos en línea, panel de administración de canchas,
notificaciones (correo, SMS, WhatsApp), reservas de varias horas en un solo paso, matchmaking,
recuperación de contraseña y edición de perfil.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 18, React Router, Tailwind CSS 4, Vite |
| Backend | Node.js 22, Express 4, cookie-parser |
| Base de datos | SQLite (`db/padel.db`) con `better-sqlite3` y SQL puro, sin ORM |
| Lenguaje | TypeScript 5 en todo el stack |
| Pruebas | Vitest y supertest |

Todas las reglas de tiempo (bloques pasados, ventana de 7 días, reserva activa) se calculan en
el backend con la hora local del club, `America/Bogota`.

## Requisitos

- Node.js 22 LTS y npm 10 o superior.
- Puertos libres: `3010` (backend) y `5173` (frontend).

## Puesta en marcha

```bash
# Terminal 1 — backend (crea db/padel.db y carga las 5 canchas al iniciar)
cd backend
npm install
npm run dev          # http://localhost:3010

# Terminal 2 — frontend
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Abre <http://localhost:5173>, crea una cuenta y empieza a reservar. En desarrollo, Vite
redirige las llamadas a `/api` hacia el backend, así que la cookie de sesión funciona sin CORS.

Para empezar con una base de datos vacía, detén el backend y borra `db/padel.db`.

### Configuración

| Variable | Dónde | Por defecto | Uso |
|----------|-------|-------------|-----|
| `PORT` | backend | `3010` | Puerto del servidor |
| `DB_PATH` | backend | `db/padel.db` | Ruta del archivo SQLite |
| `NODE_ENV` | backend | — | Con `production`, la cookie de sesión se marca `secure` |

Si cambias el puerto del backend, actualiza también el proxy en `frontend/vite.config.ts`.

## Scripts

| Carpeta | Comando | Descripción |
|---------|---------|-------------|
| `backend/` | `npm run dev` | Servidor con recarga automática |
| `backend/` | `npm start` | Servidor sin recarga |
| `backend/` | `npm test` | Pruebas de integración de la API (SQLite en memoria y reloj fijo) |
| `backend/` | `npm run typecheck` | Verificación de tipos |
| `frontend/` | `npm run dev` | Servidor de desarrollo de Vite |
| `frontend/` | `npm run build` | Build de producción en `frontend/dist` |
| `frontend/` | `npm test` | Pruebas del cliente de la API |
| `frontend/` | `npm run typecheck` | Verificación de tipos |

Las pruebas del backend cubren registro, inicio de sesión y bloqueo, rutas protegidas, ventana de
7 días, bloques pasados, una reserva activa por usuario, cancelación, manejo de errores y una
prueba de concurrencia: 10 usuarios reservan el mismo bloque a la vez y solo uno lo consigue.

## Estructura

```text
├── backend/
│   ├── src/
│   │   ├── index.ts          # Arranque del servidor
│   │   ├── app.ts            # Monta rutas y manejo de errores
│   │   ├── db.ts             # Conexión SQLite y aplicación del esquema
│   │   ├── time.ts           # Reglas de tiempo (hora de Bogotá)
│   │   ├── errors.ts         # Catálogo de errores y manejador global
│   │   ├── auth.ts           # Registro, login, sesiones y bloqueo
│   │   ├── courts.ts         # Canchas y disponibilidad
│   │   └── reservations.ts   # Crear, listar y cancelar reservas
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── pages/            # Login, Registro, Canchas, Mis Reservas
│   │   ├── components/       # Grilla de horarios, diálogo de confirmación, navegación
│   │   ├── api.ts            # Cliente de la API con mensajes de error amigables
│   │   └── useAuth.tsx       # Estado de sesión
│   └── tests/
├── db/
│   └── schema.sql            # Esquema y catálogo de canchas
└── specs/001-padel-court-booking/   # Especificación, plan y tareas
```

## API

API REST en JSON bajo `/api`. Todas las rutas, salvo registro e inicio de sesión, requieren
sesión (cookie `sid`).

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Crear cuenta e iniciar sesión |
| `POST` | `/api/auth/login` | Iniciar sesión |
| `POST` | `/api/auth/logout` | Cerrar sesión |
| `GET` | `/api/auth/me` | Usuario de la sesión actual |
| `GET` | `/api/courts` | Canchas y ventana de reserva |
| `GET` | `/api/courts/:courtId/availability?date=YYYY-MM-DD` | Grilla de 24 bloques |
| `POST` | `/api/reservations` | Crear reserva |
| `GET` | `/api/reservations/me` | Reservas próximas e historial |
| `DELETE` | `/api/reservations/:id` | Cancelar una reserva futura |

Los errores siempre tienen la forma
`{ "error": { "code": "SLOT_TAKEN", "message": "La cancha ya fue reservada en este horario" } }`,
con mensajes en español listos para mostrar y sin detalles técnicos. Códigos HTTP: `400`
petición inválida, `401` sin sesión o credenciales incorrectas, `404` no encontrado, `409`
conflicto de reserva o correo ya registrado, `429` inicio de sesión bloqueado.

Contrato completo: [`specs/001-padel-court-booking/contracts/api.md`](specs/001-padel-court-booking/contracts/api.md).

## Documentación del proyecto

| Documento | Contenido |
|-----------|-----------|
| [Constitución](.specify/memory/constitution.md) | Principios y reglas no negociables del proyecto |
| [Especificación](specs/001-padel-court-booking/spec.md) | Historias de usuario, requisitos y criterios de éxito |
| [Plan](specs/001-padel-court-booking/plan.md) | Decisiones técnicas y estructura |
| [Investigación](specs/001-padel-court-booking/research.md) | Alternativas evaluadas y justificación |
| [Modelo de datos](specs/001-padel-court-booking/data-model.md) | Tablas, reglas y ciclo de vida de una reserva |
| [Tareas](specs/001-padel-court-booking/tasks.md) | Desglose de la implementación |
| [Quickstart](specs/001-padel-court-booking/quickstart.md) | Guía de validación de punta a punta |

La carpeta `promts-example/` contiene los prompts usados en cada paso del flujo de Spec Kit
(`/speckit-constitution`, `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`,
`/speckit-tasks`, `/speckit-implement` y `/speckit-converge`).

### Contribuir

Cualquier cambio de comportamiento empieza en la especificación: actualiza `spec.md` (con
`/speckit-specify` o `/speckit-clarify`) antes de tocar el código. La constitución prohíbe añadir
funcionalidades que no estén documentadas en la spec.
