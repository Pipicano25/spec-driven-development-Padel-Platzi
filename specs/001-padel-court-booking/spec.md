# Feature Specification: Reserva de Canchas de Pádel

**Feature Branch**: `001-padel-court-booking`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Autenticación con correo y contraseña; exploración de las 5 canchas
fijas con grilla de disponibilidad de 24 bloques de 1 hora por fecha; creación de reservas con
re-validación anti-colisión, sin fechas pasadas y máximo una reserva activa por usuario; panel
'Mis Reservas' con reservas futuras, historial y cancelación. Sin pagos, sin panel de
administración, sin notificaciones, sin reservas multi-hora y sin matchmaking."

## Clarifications

### Session 2026-09-22

- Q: ¿Con cuántos días de anticipación, como máximo, puede un usuario reservar una cancha? → A: 7 días (hoy + 6 días más)
- Q: ¿Las reservas canceladas deben seguir apareciendo en "Mis Reservas" o desaparecer del panel? → A: Desaparecen; el historial solo muestra reservas jugadas
- Q: ¿Qué puede ver una persona que todavía no ha iniciado sesión? → A: Solo las pantallas de registro e inicio de sesión
- Q: ¿Qué debe hacer el sistema cuando alguien falla muchas veces seguidas al intentar iniciar sesión con el mismo correo? → A: Tras 5 intentos fallidos, bloqueo de 15 minutos para ese correo
- Q: En la grilla de horarios, ¿el bloque que reservó el propio usuario debe verse distinto de los bloques reservados por otras personas? → A: No; solo "Disponible" / "Reservado"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registro e inicio de sesión (Priority: P1)

Una persona visitante crea una cuenta con su correo electrónico y una contraseña, y luego inicia
sesión para acceder a la disponibilidad de las canchas y a sus reservas. También puede cerrar
sesión.

**Why this priority**: Toda reserva exige un usuario con sesión activa (Constitución, Principio
III). Sin autenticación ninguna otra historia puede entregarse.

**Independent Test**: Se puede probar registrando una cuenta nueva, cerrando sesión, iniciando
sesión de nuevo y comprobando que se accede a la sección de disponibilidad, mientras que un
visitante sin sesión es redirigido al inicio de sesión.

**Acceptance Scenarios**:

1. **Given** un visitante sin cuenta, **When** se registra con un correo válido no registrado y
   una contraseña que cumple el mínimo, **Then** la cuenta se crea y queda con sesión activa.
2. **Given** un correo ya registrado, **When** alguien intenta registrarse con ese correo,
   **Then** el sistema rechaza el registro con el mensaje "Este correo ya está registrado".
3. **Given** un usuario registrado, **When** inicia sesión con correo y contraseña correctos,
   **Then** accede a la aplicación con sesión activa.
4. **Given** un usuario registrado, **When** inicia sesión con una contraseña incorrecta,
   **Then** el sistema muestra "Correo o contraseña incorrectos" sin indicar cuál de los dos
   falló.
5. **Given** un visitante sin sesión, **When** intenta ver la lista de canchas, la grilla de
   disponibilidad, "Mis Reservas" o reservar, **Then** el sistema lo lleva al inicio de sesión
   sin mostrar ningún dato de canchas ni reservas.
6. **Given** 5 intentos fallidos consecutivos con un mismo correo, **When** se intenta iniciar
   sesión de nuevo con ese correo antes de 15 minutos (aun con la contraseña correcta),
   **Then** el sistema lo rechaza con "Demasiados intentos fallidos. Intenta de nuevo en 15
   minutos".
7. **Given** un usuario con sesión activa, **When** cierra sesión, **Then** deja de poder ver
   la disponibilidad y sus reservas hasta volver a iniciar sesión.

---

### User Story 2 - Consultar disponibilidad y reservar un bloque (Priority: P1)

Un usuario con sesión activa elige una de las 5 canchas y una fecha en un calendario, ve la
grilla de 24 bloques de 1 hora con su estado ("Disponible" o "Reservado"), selecciona un bloque
disponible y confirma la reserva.

**Why this priority**: Es el propósito central del producto y contiene la regla crítica de
prevención de doble reserva.

**Independent Test**: Con dos cuentas, reservar un bloque con la primera y comprobar que la
segunda lo ve como "Reservado" y no puede tomarlo; intentar reservar el mismo bloque desde ambas
cuentas casi al mismo tiempo y comprobar que solo una reserva se crea.

**Acceptance Scenarios**:

1. **Given** un usuario con sesión activa, **When** abre la sección de canchas, **Then** ve
   exactamente las 5 canchas: Cancha Laureles, Cancha El Poblado, Cancha Belén, Cancha Robledo y
   Cancha Envigado.
2. **Given** un usuario que eligió una cancha y una fecha, **When** se muestra la grilla,
   **Then** aparecen 24 bloques (00:00–01:00 hasta 23:00–00:00), cada uno marcado como
   "Disponible" o "Reservado".
3. **Given** un bloque "Disponible" en el futuro y un usuario sin reserva activa, **When**
   selecciona el bloque y confirma, **Then** la reserva se crea y el bloque pasa a "Reservado".
4. **Given** que otro usuario reservó el mismo bloque después de que la grilla se cargó,
   **When** el usuario confirma, **Then** la reserva se rechaza con el mensaje "La cancha ya fue
   reservada en este horario" y la grilla se actualiza.
5. **Given** un bloque cuya hora de inicio ya pasó (o una fecha pasada), **When** el usuario lo
   ve en la grilla, **Then** no puede seleccionarlo, y cualquier intento de reservarlo es
   rechazado con "No puedes reservar en un horario que ya pasó".
6. **Given** un usuario que ya tiene una reserva activa, **When** intenta confirmar otra,
   **Then** se rechaza con el mensaje "Ya tienes una reserva activa. Cancélala o espera a que
   termine para hacer otra".
7. **Given** una fecha posterior a hoy + 6 días, **When** el usuario intenta seleccionarla,
   **Then** el calendario no la permite.

---

### User Story 3 - Mis Reservas: ver y cancelar (Priority: P2)

Un usuario con sesión activa abre su panel "Mis Reservas", ve su reserva futura y su historial
de reservas pasadas (cancha, fecha y hora), y puede cancelar una reserva futura previa
confirmación.

**Why this priority**: Aporta control al usuario y, por la regla de una reserva activa, es la
única forma de liberar su cupo antes de que la reserva transcurra.

**Independent Test**: Crear una reserva, abrirla en "Mis Reservas", cancelarla confirmando la
acción y comprobar que el bloque vuelve a verse "Disponible" y que el usuario puede reservar de
nuevo.

**Acceptance Scenarios**:

1. **Given** un usuario con reservas futuras y pasadas, **When** abre "Mis Reservas", **Then**
   ve dos listas separadas —"Próximas" e "Historial"— y cada ítem muestra nombre de la cancha,
   fecha y hora.
2. **Given** una reserva futura, **When** el usuario elige cancelarla, **Then** el sistema pide
   confirmación antes de ejecutar la cancelación.
3. **Given** que el usuario confirma la cancelación, **When** se completa, **Then** el bloque
   queda "Disponible" para cualquier usuario, la reserva desaparece de "Mis Reservas" (no pasa al
   historial) y el usuario puede hacer una nueva reserva.
4. **Given** que el usuario rechaza la confirmación, **When** cierra el diálogo, **Then** la
   reserva permanece sin cambios.
5. **Given** una reserva pasada o que ya comenzó, **When** el usuario la ve, **Then** no existe
   opción de cancelarla.
6. **Given** un usuario, **When** intenta ver o cancelar una reserva de otra persona, **Then** el
   sistema lo impide.

---

### Edge Cases

- Dos usuarios confirman el mismo bloque de la misma cancha en el mismo instante: exactamente una
  reserva se crea; la otra recibe el mensaje de cancha ya reservada.
- Un mismo usuario envía la confirmación dos veces seguidas (doble clic): se crea como máximo una
  reserva.
- El usuario carga la grilla a las 13:55 y confirma el bloque 14:00 a las 14:01: se rechaza por
  horario pasado.
- Bloque 23:00–00:00: pertenece a la fecha seleccionada y termina a la medianoche del día
  siguiente.
- Una reserva en curso (su hora de inicio pasó pero no su hora de fin) sigue contando como
  reserva activa, aparece en "Próximas" y no puede cancelarse.
- La sesión expira mientras el usuario está en la grilla: al confirmar se le pide iniciar sesión
  de nuevo y no se crea la reserva.
- Se solicita una cancha que no pertenece al catálogo: se rechaza como petición inválida.
- Se envía una reserva para el día 8 o posterior sin pasar por el calendario: se rechaza como
  petición inválida con el mensaje de ventana de 7 días.
- La ventana avanza a medianoche (hora local): a las 00:00 se habilita un día nuevo.
- Cualquier fallo técnico se muestra con un mensaje amigable, nunca con detalles internos.

## Requirements *(mandatory)*

### Functional Requirements

**Autenticación**

- **FR-001**: El sistema MUST permitir registrarse con correo electrónico y contraseña.
- **FR-002**: El sistema MUST validar que el correo tenga un formato válido y no esté ya
  registrado (sin distinguir mayúsculas/minúsculas).
- **FR-003**: El sistema MUST exigir contraseñas de al menos 8 caracteres y MUST almacenarlas
  de forma que no puedan leerse en texto plano.
- **FR-004**: El sistema MUST permitir iniciar y cerrar sesión; ante credenciales incorrectas
  MUST mostrar un mensaje genérico que no revele si el correo existe.
- **FR-004a**: Tras 5 intentos fallidos consecutivos de inicio de sesión con un mismo correo, el
  sistema MUST bloquear el inicio de sesión para ese correo durante 15 minutos, incluso si
  durante el bloqueo se ingresa la contraseña correcta, mostrando "Demasiados intentos
  fallidos. Intenta de nuevo en 15 minutos". Un inicio de sesión exitoso reinicia el contador.
  El bloqueo MUST aplicarse igual a correos no registrados, para no revelar cuáles existen.
- **FR-005**: Un visitante sin sesión MUST ver únicamente las pantallas de registro e inicio de
  sesión. La lista de canchas, la grilla de disponibilidad, la creación de reservas y
  "Mis Reservas" MUST estar restringidas a usuarios con sesión activa, tanto en la interfaz
  como en el servidor.
- **FR-006**: El sistema MUST impedir que un usuario vea, cancele o modifique reservas de otro
  usuario.

**Canchas y disponibilidad**

- **FR-007**: El sistema MUST mostrar exactamente las 5 canchas fijas del catálogo y MUST NOT
  ofrecer forma alguna de crear, editar o eliminar canchas.
- **FR-008**: El usuario MUST poder seleccionar una cancha y una fecha mediante un calendario.
- **FR-009**: Para la cancha y fecha elegidas, el sistema MUST mostrar 24 bloques de 1 hora en
  formato de 24 horas (00:00–01:00 … 23:00–00:00), cada uno marcado "Disponible" o "Reservado".
- **FR-010**: La grilla MUST usar únicamente los estados "Disponible" y "Reservado"; las
  reservas del propio usuario se muestran también como "Reservado". La grilla MUST NOT revelar
  quién hizo una reserva.
- **FR-011**: Los bloques cuya hora de inicio ya pasó MUST mostrarse como no seleccionables.
- **FR-012**: El calendario MUST permitir seleccionar únicamente fechas dentro de una ventana
  de 7 días: hoy y los 6 días siguientes (hora local del club). El sistema MUST rechazar
  cualquier reserva fuera de esa ventana con el mensaje "Solo puedes reservar con hasta 7 días
  de anticipación", aunque la solicitud no provenga del calendario.

**Creación de reservas**

- **FR-013**: Una reserva MUST corresponder exactamente a un bloque entero de 1 hora que
  comienza en hora en punto; MUST NOT existir reservas de varias horas en una sola acción.
- **FR-014**: Antes de registrar una reserva, el sistema MUST re-validar en el mismo paso que el
  bloque sigue libre; si no lo está MUST rechazarla con "La cancha ya fue reservada en este
  horario" sin registrar nada.
- **FR-015**: Bajo ninguna circunstancia MUST existir dos reservas vigentes para la misma cancha,
  fecha y bloque, incluso ante solicitudes simultáneas.
- **FR-016**: El sistema MUST rechazar reservas cuyo bloque haya comenzado o ya haya pasado.
- **FR-017**: Un usuario MUST tener como máximo una reserva activa (no cancelada y cuya hora de
  fin aún no ha pasado); cualquier nueva reserva mientras exista una activa MUST rechazarse con
  un mensaje claro.
- **FR-018**: Tras una reserva exitosa, el sistema MUST mostrar una confirmación con cancha,
  fecha y hora.

**Mis Reservas**

- **FR-019**: El sistema MUST ofrecer un panel "Mis Reservas" con la lista de reservas próximas
  (activas) y el historial de reservas pasadas del usuario, cada ítem con nombre de cancha,
  fecha y hora, en orden cronológico (próximas ascendente, historial descendente).
- **FR-020**: El usuario MUST poder cancelar una reserva cuya hora de inicio aún no ha llegado,
  tras confirmar explícitamente la acción.
- **FR-021**: Al cancelarse una reserva, su bloque MUST quedar "Disponible" de inmediato para
  cualquier usuario, y el usuario MUST poder hacer una nueva reserva.
- **FR-022**: Las reservas canceladas MUST NOT mostrarse en "Mis Reservas" (ni en "Próximas" ni
  en "Historial"); el historial solo contiene reservas cuya hora de fin ya pasó sin haber sido
  canceladas.

**Errores**

- **FR-023**: Todo error MUST presentarse al usuario como un mensaje amigable en español, sin
  códigos técnicos ni detalles internos.

**Fuera de alcance (Non-Goals)**

- **FR-024**: Esta iteración MUST NOT incluir pagos en línea, panel de administración de canchas,
  notificaciones externas (correo, SMS, WhatsApp), reservas de más de 1 hora en un solo clic,
  ni matchmaking/torneos. Tampoco incluye recuperación de contraseña ni edición de perfil.

### Key Entities *(include if feature involves data)*

- **Usuario**: persona registrada. Atributos: correo (único), credencial protegida, fecha de
  registro. Tiene cero o más reservas.
- **Cancha**: una de las 5 canchas fijas. Atributos: identificador y nombre. Catálogo
  inmutable.
- **Reserva**: ocupación de una cancha por un usuario en un bloque. Atributos: usuario, cancha,
  fecha, hora de inicio (en punto; la hora de fin es inicio + 1 h), estado (activa, pasada,
  cancelada) y fecha de creación. Restricción: no puede haber dos reservas no canceladas para la
  misma cancha, fecha y hora de inicio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario nuevo completa el registro y su primera reserva en menos de 3 minutos.
- **SC-002**: En una prueba donde 10 usuarios intentan reservar el mismo bloque al mismo tiempo,
  exactamente 1 reserva se crea y los otros 9 reciben el mensaje de cancha ya reservada (0 dobles
  reservas).
- **SC-003**: La grilla de disponibilidad de una cancha y fecha se muestra en menos de 2 segundos.
- **SC-004**: El 90 % de los usuarios completa una reserva al primer intento sin ayuda.
- **SC-005**: El 100 % de los errores mostrados al usuario son mensajes comprensibles sin
  detalles técnicos.
- **SC-006**: Un bloque cancelado aparece como "Disponible" para otro usuario en su siguiente
  consulta de la grilla.

## Assumptions

- Todas las fechas y horas se interpretan en la hora local del club (America/Bogota, UTC-5).
- Las canchas están disponibles para reservar las 24 horas; no hay horarios de cierre.
- Un bloque se considera "pasado" en cuanto llega su hora de inicio (no se puede reservar el
  bloque en curso).
- Se puede cancelar una reserva hasta su hora de inicio; no hay penalizaciones.
- Una reserva deja de estar activa al llegar su hora de fin y pasa al historial.
- La sesión expira a las 24 horas de iniciada o al cerrar sesión.
- No se verifica el correo por email (no hay notificaciones externas en esta iteración).
- El pago se gestiona presencialmente en el club.
