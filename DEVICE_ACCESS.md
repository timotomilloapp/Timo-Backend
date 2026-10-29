# Acceso compartido por dispositivo

Antes de iniciar esta versión, ejecutar `pnpm exec prisma migrate deploy` con
`DIRECT_DATABASE_URL` configurada y regenerar el cliente con `pnpm exec prisma generate`.
La migración agrega las tablas de configuración y sesiones, sin clave predeterminada.
Hasta que un administrador habilitado defina la clave en **Acceso de dispositivos**,
el acceso por cédula permanece bloqueado.

La clave tiene entre 8 y 128 caracteres y se almacena con scrypt y sal aleatoria.
Cada apertura genera un token aleatorio independiente; solo su hash se guarda en
PostgreSQL. El cliente envía el token mediante `X-Device-Session`. La sesión vence
exactamente tres horas después de abrirla, sin renovación por actividad.
Cerrar sesión revoca ese token en el servidor. Cambiar la clave invalida todas las
sesiones anteriores. Las sesiones no dependen de la memoria del proceso.

Endpoints bajo `/api/v1/device-access`:

- `POST /login`: `{ "password": "..." }`, devuelve token y vencimiento.
- `GET /session`: devuelve estado y vencimiento, sin renovar la sesión.
- `POST /logout`: revoca la sesión actual; es idempotente.
- `GET /settings` y `PUT /settings`: requieren JWT, rol ADMIN y perfil habilitado.

Los menús, reservas y el ingreso por cédula verifican la sesión en el servidor.
Las operaciones administrativas conservan sus guards JWT y pueden operar sin
sesión compartida. El ingreso por cédula siempre requiere la sesión del dispositivo.
La protección de intentos permite 10 solicitudes por IP por minuto por proceso;
en despliegues con varias réplicas, complementar con un límite en el proxy de entrada.

El frontend requiere conexión para verificar acceso; no se permite usar respuestas
API cacheadas para eludir el cierre o la caducidad. Comparte la sesión entre pestañas
del mismo navegador y limpia la identificación del empleado al cerrar o caducar.
Los otros dispositivos conservan su propia sesión al cerrar uno; cambiar la clave
revoca el acceso de todos. La clave configurada no caduca: caduca cada sesión abierta.
