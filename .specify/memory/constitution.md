<!--
Sync Impact Report
==================
Version change: (plantilla sin completar) → 1.0.0
Tipo de cambio: MAJOR (ratificación inicial; todos los marcadores reemplazados)

Principios definidos (marcador de plantilla → título nuevo):
  - [PRINCIPLE_1_NAME] → I. Catálogo Cerrado de Canchas
  - [PRINCIPLE_2_NAME] → II. Prevención de Doble Reserva (NO NEGOCIABLE)
  - [PRINCIPLE_3_NAME] → III. Autenticación Obligatoria
  - [PRINCIPLE_4_NAME] → IV. Simplicidad y Estructura Plana
  - [PRINCIPLE_5_NAME] → V. Cero Código Sombra y Spec como Fuente de la Verdad

Secciones añadidas:
  - [SECTION_2_NAME] → Stack Tecnológico y Estilo de Código
  - [SECTION_3_NAME] → Manejo de Errores y Validaciones
  - Governance (completada)

Secciones eliminadas: ninguna

Plantillas dependientes: no modificadas (leen la constitución en tiempo de ejecución).

TODOs diferidos:
  - "Bloques de Tiempo" se interpreta como notación horaria de 24 h (HH:mm). La duración
    exacta de cada bloque (p. ej. 60 o 90 minutos) y el horario operativo de las canchas
    NO están definidos: deben precisarse en spec.md (/speckit-specify o /speckit-clarify).
-->

# Sistema de Reservas de Pádel Constitution

Aplicación para la reserva de canchas de pádel. Su propósito es permitir a los usuarios
autenticarse y gestionar reservas de tiempo en espacios específicos.

## Core Principles

### I. Catálogo Cerrado de Canchas

- El sistema MUST manejar exactamente 5 canchas fijas: **Cancha Laureles**,
  **Cancha El Poblado**, **Cancha Belén**, **Cancha Robledo** y **Cancha Envigado**.
- MUST NOT existir funcionalidad para crear, editar ni eliminar canchas desde la aplicación.
- Toda reserva que referencie una cancha fuera de este catálogo MUST rechazarse con HTTP 400.

**Razón**: el dominio es cerrado; un catálogo fijo elimina toda una clase de errores y de
funcionalidad administrativa innecesaria.

### II. Prevención de Doble Reserva (NO NEGOCIABLE)

- Es la regla crítica del sistema. Ninguna reserva MUST escribirse en la base de datos sin
  validar primero que la cancha seleccionada esté libre en ese horario.
- La validación y la inserción MUST ejecutarse de forma atómica (misma transacción SQLite)
  para que dos solicitudes concurrentes no puedan reservar el mismo bloque.
- Un intento de reserva sobre un horario ocupado MUST responder HTTP 409 y MUST NOT modificar
  la base de datos.
- Las reservas operan con notación horaria de 24 horas (HH:mm, 00:00–23:59).

**Razón**: una doble reserva rompe la confianza del usuario y es el único fallo que invalida
el propósito del producto.

### III. Autenticación Obligatoria

- Todo flujo de reserva (crear, consultar las propias, cancelar) MUST exigir un usuario con
  sesión activa.
- El backend MUST responder HTTP 401 a cualquier operación de reserva sin sesión válida,
  independientemente de lo que haga la UI.

**Razón**: cada reserva debe pertenecer a un usuario identificable; la validación en el
servidor es la única garantía real.

### IV. Simplicidad y Estructura Plana

- El repositorio MUST organizarse en tres carpetas de primer nivel: `/frontend`, `/backend`
  y `/db`.
- MUST NOT implementarse "Clean Architecture", capas de repositorio/servicio abstractas ni
  patrones complejos sin una justificación documentada en el plan.
- Se MUST priorizar la programación funcional: funciones puras y componentes funcionales con
  Hooks en React. Las clases MUST evitarse salvo que una dependencia lo exija.

**Razón**: el alcance es pequeño; la sobreingeniería añade costo sin aportar valor.

### V. Cero Código Sombra y Spec como Fuente de la Verdad

- Se MUST construir estrictamente lo documentado en `spec.md`. No se añaden características
  "por si acaso" (p. ej. pasarelas de pago, perfiles complejos, notificaciones).
- Si una instrucción contradice esta constitución, o se detecta una falla lógica en la
  especificación, el agente de IA MUST detenerse, advertir del problema y solicitar la
  actualización de `spec.md` antes de tocar el código fuente.

**Razón**: el desarrollo guiado por especificación (SDD) solo funciona si la spec es la
única fuente de la verdad.

## Stack Tecnológico y Estilo de Código

- **Lenguaje**: TypeScript en todo el stack (frontend y backend).
- **Frontend / UI**: React con componentes funcionales y Hooks; estilos con Tailwind CSS.
- **Backend**: Node.js con Express.
- **Base de datos**: SQLite local en el archivo `padel.db`. MUST NOT usarse ORMs pesados;
  el acceso se hace con `better-sqlite3` o sentencias SQL puras (siempre parametrizadas).
- **Nomenclatura**: `camelCase` para funciones y variables; `PascalCase` para interfaces y
  tipos.

## Manejo de Errores y Validaciones

- **UI**: MUST NOT exponerse errores crudos ni stack traces al usuario final. Todo error
  técnico MUST traducirse a un mensaje amigable en español
  (p. ej. "La cancha ya fue reservada en este horario").
- **Backend**: MUST retornar códigos HTTP semánticos:
  - `400` petición inválida (datos faltantes, formato de hora inválido, cancha inexistente).
  - `401` no autenticado.
  - `409` conflicto de reserva (doble reserva).
- Las respuestas de error del backend MUST NOT incluir stack traces ni detalles internos.

## Governance

- Esta constitución prevalece sobre cualquier otra práctica, instrucción puntual o
  preferencia del agente. Las reglas de dominio (Principios I–III) son inmutables salvo
  enmienda formal.
- **Enmiendas**: toda modificación MUST documentarse en este archivo con su Sync Impact
  Report, incrementar la versión y actualizar la fecha de última enmienda.
- **Versionado** (SemVer):
  - MAJOR: eliminación o redefinición incompatible de principios.
  - MINOR: principio o sección nueva, o guía ampliada materialmente.
  - PATCH: aclaraciones, redacción y correcciones sin cambio semántico.
- **Cumplimiento**: cada `plan.md` MUST incluir un "Constitution Check" que verifique los
  principios; cada revisión de código MUST confirmar que no hay doble reserva posible,
  que las rutas de reserva exigen sesión y que no se añadió código sombra. Toda complejidad
  adicional MUST justificarse por escrito en el plan.

**Version**: 1.0.0 | **Ratified**: 2026-09-21 | **Last Amended**: 2026-09-21
