# Sistema de Gestión de Almuerzos Corporativos - Backend

API robusta y escalable desarrollada con NestJS para la gestión integral de menús, reservas y autenticación en un entorno corporativo. El sistema está diseñado para manejar flujos de autorización mediante lista blanca (whitelist), control de estados de reserva y generación de resúmenes operativos detallados.

## Stack Tecnológico

*   **Framework:** NestJS (Node 22)
*   **Lenguaje:** TypeScript
*   **ORM:** Prisma
*   **Base de Datos:** PostgreSQL (Alojada en Supabase)
*   **Autenticación:** Supabase Auth (JWT Bearer Validation)
*   **Gestor de Paquetes:** pnpm
*   **Documentación:** Swagger / OpenAPI 3.0
*   **Validación:** class-validator / class-transformer
*   **Testing:** Jest
*   **Seguridad:** Helmet & CORS configuration

## Arquitectura del Proyecto

El proyecto sigue una **arquitectura modular** de NestJS, donde cada dominio de negocio está encapsulado en su propio módulo. Esto facilita la mantenibilidad, escalabilidad y las pruebas unitarias independientes. Se implementa una capa de servicios para la lógica de negocio, controladores para la exposición de endpoints y DTOs para la transferencia y validación de datos.


## Configuración del Entorno

Se requiere un archivo `.env` en la raíz del proyecto con la siguiente configuración:

| Variable | Descripción | Ejemplo |
| :--- | :--- | :--- |
| `DATABASE_URL` | URL de conexión a PostgreSQL (con pooling) | `postgresql://...` |
| `DIRECT_DATABASE_URL` | URL de conexión directa para migraciones | `postgresql://...` |
| `SUPABASE_URL` | URL del proyecto en Supabase | `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | Llave pública anónima de Supabase | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave de rol de servicio (uso administrativo) | `eyJhbGci...` |
| `PORT` | Puerto de escucha del servidor | `3000` |
| `NODE_ENV` | Entorno de ejecución | `development` |
| `FRONTEND_URL` | URL del cliente permitido por CORS | `http://localhost:3000` |

## Instalación y Configuración

1.  **Clonar el repositorio e instalar dependencias:**
    ```bash
    pnpm install
    ```

2.  **Configuración de base de datos con Prisma:**
    Asegúrese de haber configurado las variables `DATABASE_URL` y `DIRECT_DATABASE_URL`. Luego, sincronice el esquema:
    ```bash
    npx prisma db push
    ```

3.  **Generar el cliente de Prisma:**
    ```bash
    npx prisma generate
    ```

## Comandos Disponibles

*   `pnpm run start:dev`: Inicia el servidor en modo desarrollo con hot-reload.
*   `pnpm run build`: Compila el proyecto para producción en la carpeta `/dist`.
*   `pnpm run start:prod`: Ejecuta la versión compilada del proyecto.
*   `pnpm run lint`: Ejecuta el linter para asegurar la calidad del código.
*   `pnpm run test`: Ejecuta la suite de pruebas unitarias con Jest.

## Documentación API (Swagger)

La documentación interactiva de la API está disponible mediante Swagger. Una vez que el servidor esté corriendo, acceda a:

`http://localhost:3000/api/docs`

Aquí podrá visualizar todos los endpoints, modelos de datos y realizar pruebas de peticiones directamente desde el navegador.

## Flujo de Autenticación

El sistema utiliza **Supabase Auth** para el manejo de identidades.
1.  El cliente se autentica contra Supabase y recibe un JWT.
2.  El cliente envía el JWT en el encabezado `Authorization: Bearer <token>` para endpoints protegidos.
3.  El backend valida la firma del JWT y extrae el identificador del usuario.
4.  Se valida que el usuario tenga un perfil correspondiente en la tabla `profiles` de la base de datos interna.

### Ejemplo de Request (Auth Me)
**GET** `/api/v1/auth/me`
**Headers:** `Authorization: Bearer <JWT>`

**Response (200 OK):**
```json
{
  "userId": "550e8400-e29b-411d-a716-446655440000",
  "role": "ADMIN",
  "email": "usuario@empresa.com"
}
```

## Módulos Principales y Funcionalidades

*   **Menus:** Permite la creación de menús diarios especificando sopas, proteínas, acompañamientos y bebidas. Soporta la carga masiva mediante archivos `.xlsx`.
*   **Reservations:** Gestión de pedidos vinculados a una fecha específica y un usuario de la lista blanca. 
    *   **Proteína inmutable:** Una vez creada la reserva, su proteína no puede cambiarse. Se rechazan las modificaciones y la eliminación pública para impedir borrar y volver a elegir; la cancelación conserva el registro y la selección original.
    *   **Colombia Timezone:** Todos los timestamps y validaciones de fecha respetan el huso horario UTC-5.
    *   **Resumen Diario:** Endpoint para obtener el conteo consolidado de proteínas solicitadas para una fecha determinada.
*   **Whitelist:** Filtro de seguridad que permite verificar si una CC (Cédula de Ciudadanía) está autorizada para realizar reservas.

## CI/CD

El proyecto integra **GitHub Actions** para la automatización de procesos:
*   Validación de construcción (`build`).
*   Ejecución de pruebas unitarias (`test`).

## Consideraciones de Producción

El acceso por cédula no requiere clave ni sesión de dispositivo. La migración
`20261030140000_remove_device_access` elimina las tablas de la funcionalidad retirada.
Aplicarla junto con el despliegue de esta versión y el frontend actualizado mediante
`pnpm exec prisma migrate deploy`. Se conserva la migración original en el historial
de Prisma porque ya fue aplicada.

*   **Pgbouncer:** En entornos de producción (Supabase), se recomienda el uso de `?pgbouncer=true` en la `DATABASE_URL` para una gestión eficiente de conexiones.
*   **Versionamiento:** La API está versionada mediante el prefijo de URI (`/api/v1`).
*   **Seguridad:** Implementación de Helmet para cabeceras HTTP seguras y CORS restringido a dominios autorizados.


## Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).
