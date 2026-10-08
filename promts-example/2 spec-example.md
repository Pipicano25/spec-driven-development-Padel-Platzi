/speckit-specify

## Features principales

### 1. Autenticación de Usuarios

- Los usuarios deben poder registrarse e iniciar sesión usando un correo electrónico y contraseña.

- Solo los usuarios con una sesión activa pueden visualizar la disponibilidad completa y realizar reservas.

- Los usuarios solo pueden gestionar sus propias reservas, no las de terceros.

### 2. Exploración y Selección de Canchas

- El sistema debe listar estáticamente las 5 canchas disponibles: Cancha Laureles, Cancha El Poblado, Cancha Belén, Cancha Robledo, y Cancha Envigado.

- El usuario debe poder seleccionar una fecha específica en un calendario para ver la disponibilidad.

- Para la fecha seleccionada, el sistema debe mostrar la grilla de horarios de 24 horas (en bloques de 1 hora) para la cancha elegida.

- El sistema debe indicar claramente qué bloques horarios están "Disponibles" y cuáles están "Reservados".

- Un usuario solo puede tener una reserva activa a la vez

### 3. Creación de Reservas

- El usuario puede seleccionar un bloque horario disponible y confirmar su reserva.

- **Regla Crítica (Prevención de colisión):** Antes de confirmar, el sistema debe re-validar que el bloque siga disponible. Si otro usuario tomó el turno en ese lapso de tiempo, la reserva debe ser rechazada con un mensaje de error claro.

- Las reservas solo pueden hacerse en bloques enteros (ej. 14:00 a 15:00).

- No se pueden realizar reservas en fechas u horarios que ya hayan transcurrido (pasado).

### 4. Gestión Mis Reservas

- El usuario debe tener un panel donde pueda ver la lista de sus reservas futuras y su historial de reservas pasadas.

- Cada ítem de la lista debe mostrar: Nombre de la cancha, Fecha y Hora.

- El usuario puede cancelar una reserva futura seleccionándola en su panel y confirmando la acción.

## Lo que NO se va a construir en esta iteración (Non-Goals)

- NO habrá pasarela de pagos integrados (el pago se manejará presencialmente en el club).

- NO habrá panel de administrador web para agregar, editar o eliminar canchas (el listado de 5 canchas es inmutable en el código).

- NO habrá notificaciones externas (ni correos transaccionales de confirmación, ni mensajes SMS/WhatsApp).

- NO habrá reservas de más de 1 hora continua en un solo clic (si alguien quiere 2 horas, debe hacer 2 reservas independientes).

- NO habrá sistema de "matchmaking" para buscar compañeros de juego o torneos.
