# notifier-api

Microservicio backend disenado para la generacion, despacho, almacenamiento seguro y verificacion de codigos de autenticacion de un solo uso (OTP), integrando auditoria transaccional de notificaciones y proteccion criptografica robusta.

---

## 1. Arquitectura y Stack Tecnologico

El microservicio esta desarrollado siguiendo una arquitectura por capas desacoplada (Controladores, Servicios, Repositorios y Modelos) para garantizar escalabilidad, mantenibilidad y observabilidad.

- **Entorno de Ejecucion:** Node.js (Version LTS recomendada, arquitectura basada en modulos ECMAScript).
- **Lenguaje:** TypeScript en modo estricto (`strict: true`) con resolucion de modulos `NodeNext`.
- **Framework Web:** Express v5 con middlewares perimetrales de seguridad y gestion centralizada de errores.
- **Base de Datos:** PostgreSQL con conexion optimizada mediante `pg.Pool`, consultas parametrizadas contra inyecciones SQL y soporte transaccional.
- **Gestor de Paquetes:** pnpm (definido en package.json devEngines).
- **Seguridad Criptografica:**
  - Generador de numeros pseudoaleatorios criptograficamente seguros (CSPRNG via `node:crypto.randomInt`) para codigos OTP de 6 digitos.
  - Hashing no reversible mediante `bcryptjs` con 10 rondas de salt antes de persistir en base de datos.
  - Comparacion de claves en tiempo constante (`node:crypto.timingSafeEqual`) para mitigar ataques de temporizacion en la validacion de API Keys.
- **Notificaciones y Plantillas:** Nodemailer con transporte SMTP seguro y motor de plantillas EJS para el renderizado dinamico de correos.
- **Control de Tasa y Proteccion:** `express-rate-limit` con politicas diferenciadas para solicitud y verificacion de codigos OTP, y cabeceras HTTP de endurecimiento (nosniff, DENY, HSTS, CSP).
- **Registro de Eventos (Logging):** Winston con mascara y sanitizacion automatica de claves sensibles (passwords, tokens, credenciales y secretos).

---

## 2. Requisitos Previos

Antes de ejecutar el microservicio, asegurese de contar con las siguientes dependencias instaladas en el sistema:

1. **Node.js**: Version 20.x o superior.
2. **pnpm**: Version 9.x o superior (el proyecto define `pnpm@12.15.0`).
3. **PostgreSQL**: Servidor PostgreSQL activo con la base de datos `notifier_db` y las tablas `otp_requests` y `notification_logs` creadas.
4. **Servidor SMTP**: Acceso a un servidor de correo saliente (por ejemplo, Gmail con contrasena de aplicacion o un servidor SMTP corporativo/transaccional).

---

## 3. Configuracion de Variables de Entorno

El microservicio utiliza variables de entorno para su operacion. En la raiz del proyecto se provee el archivo plantilla `.env.example`.

Para inicializar la configuracion:

1. Cree una copia del archivo de ejemplo con el nombre `.env`:
   ```bash
   cp .env.example .env
   ```
2. Modifique los valores en el archivo `.env` de acuerdo a su entorno:

| Variable | Descripcion | Valor por Defecto / Ejemplo |
| :--- | :--- | :--- |
| `PORT` | Puerto de escucha del servidor HTTP | `3000` |
| `NODE_ENV` | Entorno de ejecucion (`development`, `production`, `test`) | `development` |
| `API_SECRET_KEY` | Clave secreta requerida en el encabezado `x-api-key` | Cadena alfanumerica segura |
| `DATABASE_URL` | Cadena de conexion a la base de datos PostgreSQL | `postgresql://usuario:password@localhost:5432/notifier_db` |
| `SMTP_HOST` | Host del servidor SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | Puerto del servicio SMTP | `587` |
| `SMTP_SECURE` | Define si la conexion utiliza TLS directo (puerto 465) | `false` |
| `SMTP_USER` | Usuario o cuenta de correo del remitente SMTP | `notificaciones@dominio.com` |
| `SMTP_PASS` | Contrasena o clave de aplicacion del servicio SMTP | Credencial de aplicacion |
| `SMTP_FROM` | Encabezado remitente de los correos despachados | `"Notifier <notificaciones@dominio.com>"` |
| `OTP_EXPIRATION_SECONDS` | Tiempo de validez del codigo OTP en segundos | `600` (10 minutos) |
| `OTP_MAX_ATTEMPTS` | Limite de intentos fallidos antes de invalidar el OTP | `3` |

---

## 4. Instalacion y Comandos de Ejecucion

Ejecute los siguientes comandos desde la raiz del proyecto utilizando `pnpm`:

### Instalacion de Dependencias
```bash
pnpm install
```

### Ejecucion en Modo Desarrollo
Inicia el servidor con recarga en caliente utilizando `tsx watch`:
```bash
pnpm run dev
```

### Compilacion de Produccion
Compila el codigo TypeScript a JavaScript estricto en la carpeta `dist/` y copia recursivamente las plantillas EJS:
```bash
pnpm run build
```

### Ejecucion en Modo Produccion
Ejecuta la version transpilada lista para entornos productivos:
```bash
pnpm start
```

### Suite de Pruebas Automatizadas
Ejecuta las pruebas unitarias y de integracion del servicio:
```bash
pnpm test
```

---

## 5. Especificacion de Endpoints

### 5.1. Comprobacion de Salud (Health Check)

Verifica la disponibilidad del microservicio y la conectividad activa hacia el servidor PostgreSQL.

- **Ruta:** `GET /health` (o `GET /api/health`)
- **Autenticacion:** No requerida (Endpoint publico para balanceadores y sondas de orquestacion).
- **Respuestas:**
  - `200 OK`: Servicio operativo y conexion a base de datos confirmada.
  - `503 Service Unavailable`: Servicio degradado (sin conexion a base de datos).

Ejemplo de respuesta (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2026-10-28T22:00:00.000Z",
  "uptime_seconds": 120,
  "database": "connected",
  "environment": "development"
}
```

---

### 5.2. Solicitud y Envio de Codigo OTP

Genera un codigo numerico seguro de 6 digitos, almacena su representacion hash en la tabla `otp_requests`, renderiza la plantilla de correo y despacha la notificacion, registrando la auditoria en `notification_logs`.

- **Ruta:** `POST /api/otp/send`
- **Autenticacion Requerida:** Encabezado `x-api-key: <API_SECRET_KEY>`
- **Control de Tasa (Rate Limit):** Maximo 3 solicitudes por IP en una ventana de 15 minutos.
- **Cuerpo de la Solicitud (JSON):**

| Campo | Tipo | Requerido | Descripcion |
| :--- | :--- | :--- | :--- |
| `app_name` | string | Si | Nombre o identificador del sistema solicitante |
| `identifier` | string | Si | Destinatario (direccion de correo electronico valida) |
| `channel` | string | No | Canal de entrega. Valor por defecto: `"email"` |
| `template` | string | No | Nombre de la plantilla EJS. Valor por defecto: `"otp-default"` |
| `payload` | object | No | Objeto JSON con variables dinamicas para inyectar en la plantilla |

Ejemplo de Solicitud:
```bash
curl -X POST http://localhost:3000/api/otp/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: tu_clave_secreta_aqui" \
  -d '{
    "app_name": "Portal Clientes",
    "identifier": "usuario@ejemplo.com",
    "channel": "email",
    "template": "otp-default",
    "payload": {
      "name": "Carlos Gomez"
    }
  }'
```

Ejemplo de Respuesta Exitosa (200 OK):
```json
{
  "message": "OTP enviado",
  "expires_in": 600
}
```

Codigos de Error Posibles:
- `400 Bad Request`: Datos de entrada invalidos o formato de correo incorrecto.
- `401 Unauthorized`: Encabezado `x-api-key` ausente o no valido.
- `429 Too Many Requests`: Limite de tasa excedido.
- `502 Bad Gateway`: Fallo al despachar el correo mediante el transporte SMTP.

---

### 5.3. Verificacion de Codigo OTP

Valida el codigo OTP de 6 digitos provisto por el usuario contra el registro pendiente mas reciente almacenado en la base de datos. Controla la expiracion temporal y el numero maximo de intentos fallidos.

- **Ruta:** `POST /api/otp/verify`
- **Autenticacion Requerida:** Encabezado `x-api-key: <API_SECRET_KEY>`
- **Control de Tasa (Rate Limit):** Maximo 5 intentos por IP en una ventana de 15 minutos.
- **Cuerpo de la Solicitud (JSON):**

| Campo | Tipo | Requerido | Descripcion |
| :--- | :--- | :--- | :--- |
| `app_name` | string | Si | Nombre del sistema solicitante (debe coincidir con la solicitud) |
| `identifier` | string | Si | Destinatario asociado al OTP |
| `code` | string | Si | Codigo numerico exacto de 6 digitos |

Ejemplo de Solicitud:
```bash
curl -X POST http://localhost:3000/api/otp/verify \
  -H "Content-Type: application/json" \
  -H "x-api-key: tu_clave_secreta_aqui" \
  -d '{
    "app_name": "Portal Clientes",
    "identifier": "usuario@ejemplo.com",
    "code": "849201"
  }'
```

Ejemplo de Respuesta Exitosa (200 OK):
```json
{
  "valid": true
}
```

Codigos de Error Posibles:
- `400 Bad Request`: Codigo expirado o formato de 6 digitos invalido.
- `401 Unauthorized`: Codigo incorrecto (devuelve intentos restantes `remaining_attempts`) o clave de API invalida.
- `404 Not Found`: No existe ninguna solicitud pendiente para la aplicacion e identificador.
- `429 Too Many Requests`: Limite de intentos por IP excedido.

---

## 6. Estructura del Proyecto

```
notifier-api/
├── .env                       # Variables de entorno locales (ignorado por Git)
├── .env.example               # Plantilla modelo de variables de entorno
├── .gitignore                 # Reglas estrictas de exclusion para el control de versiones
├── package.json               # Manifiesto de configuracion, scripts y dependencias
├── pnpm-lock.yaml             # Bloqueo determinista de versiones de dependencias
├── pnpm-workspace.yaml        # Configuracion del espacio de trabajo pnpm
├── tsconfig.json              # Configuracion del compilador TypeScript
├── dist/                      # Codigo transpilado y plantillas para produccion (ignorado por Git)
├── tests/
│   └── test-suite.ts          # Pruebas de integracion y unitarias (criptografia, templates, endpoints)
└── src/
    ├── app.ts                 # Ensamblador de la aplicacion Express y definicion de middlewares
    ├── index.ts               # Punto de entrada principal y logica de arranque / graceful shutdown
    ├── config/
    │   ├── database.ts        # Configuracion de pool PostgreSQL y ejecucion de consultas
    │   ├── env.ts             # Carga y validacion de variables de entorno
    │   └── logger.ts          # Logger Winston estructurado con sanitizacion de secretos
    ├── controllers/
    │   └── otp.controller.ts  # Controladores HTTP de recepcion y respuesta de solicitudes OTP
    ├── middleware/
    │   ├── auth.middleware.ts        # Validacion segura de cabecera x-api-key en tiempo constante
    │   ├── error.middleware.ts       # Manejador centralizado de errores operativos y de sistema
    │   ├── rateLimiter.middleware.ts # Limitacion de peticiones por ventana temporal (DoS / Brute Force)
    │   └── validator.middleware.ts   # Sanitizacion y validacion de esquemas de datos de entrada
    ├── models/
    │   ├── errors.ts          # Jerarquia de errores tipados (AppError, BadRequestError, etc.)
    │   └── types.ts           # Definiciones de tipos, DTOs y modelos de base de datos
    ├── repositories/
    │   ├── notification.repository.ts # Operaciones en base de datos para la tabla notification_logs
    │   └── otp.repository.ts          # Operaciones en base de datos para la tabla otp_requests
    ├── routes/
    │   ├── health.routes.ts   # Enrutador para endpoints de estado de salud
    │   └── otp.routes.ts      # Enrutador para endpoints de generacion y verificacion de OTP
    ├── services/
    │   ├── crypto.service.ts  # Generador CSPRNG, bcrypt hashing y timingSafeEqual
    │   ├── email.service.ts   # Integracion Nodemailer y resolucion segura de plantillas
    │   └── otp.service.ts     # Orquestador del flujo de negocio para OTP y notificaciones
    └── templates/
        └── otp-default.ejs    # Plantilla HTML/CSS responsiva para correos con codigo OTP
```

---

## 7. Buenas Practicas de Seguridad Aplicadas

- **Cero exposicion de secretos:** Ninguna clave, credencial o contrasena se encuentra hardcodeada; toda la parametrizacion se realiza via `process.env`.
- **Mitigacion de ataques de temporizacion:** Validacion de `x-api-key` realizada en tiempo constante para evitar deduccion byte a byte por analisis de latencia.
- **Prevencion de Path Traversal:** Nombres de plantillas sanitizados con expresiones regulares estrictas antes de resolver rutas en el sistema de archivos.
- **Prevencion de inyeccion SQL:** Todas las consultas hacia PostgreSQL utilizan parametros preparados (`$1`, `$2`, etc.).
- **Almacenamiento protegido:** Los codigos OTP no se persisten en texto plano en la base de datos; unicamente se almacena su hash `bcrypt`.
- **Proteccion contra fuerza bruta:** Politicas de limitacion por IP y expiracion automatica al alcanzar el umbral de intentos fallidos.

