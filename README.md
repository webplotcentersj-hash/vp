# Vía Pública Plot Center – App completa en Next.js

Aplicación de administración en **Next.js** (Node): login, dashboard, ubicaciones, clientes, alquileres, estadísticas, campañas publicitarias y asistente IA con **Gemini** (SDK `@google/genai`).

## Requisitos

- Node.js 18+
- **Dos bases MySQL**: una principal (ubicaciones, clientes, alquileres, users) y otra de campañas (campañas, métricas, links).
- API key de [Google AI Studio](https://aistudio.google.com/apikey) para el asistente IA.

## Instalación

```bash
cd app-next
npm install
cp .env.local.example .env.local
```

Edita `.env.local` con:

- **BD principal:** `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- **BD campañas:** `DB_CAMPAIGNS_HOST`, `DB_CAMPAIGNS_USER`, `DB_CAMPAIGNS_PASSWORD`, `DB_CAMPAIGNS_NAME`
- **Gemini:** `GEMINI_API_KEY` (y opcionalmente `GEMINI_MODEL`)

## Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000):

- **`/`** – Login (email/contraseña contra tabla `users` de la BD principal).
- **`/admin`** – Dashboard (resumen chupetes, vencimientos, estadísticas de campañas si hay BD campañas).
- **`/admin/ubicaciones`** – CRUD ubicaciones (chupetes).
- **`/admin/clientes`** – CRUD clientes.
- **`/admin/alquileres`** – CRUD alquileres.
- **`/admin/estadisticas`** – Tasa de ocupación, cliente más valioso, ingresos mensuales.
- **`/admin/campanas`** – Listado campañas, nueva campaña, ver detalle y métricas.
- **`/admin/ia`** – Chat con Gemini vía `/api/gemini`.

## API (rutas Next.js)

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/auth/login` | POST | Login (email, password) |
| `/api/dashboard` | GET | Datos dashboard (chupetes, vencimientos) |
| `/api/dashboard-stats` | GET | Estadísticas avanzadas campañas |
| `/api/stats` | GET | Estadísticas (ocupación, ingresos, top cliente) |
| `/api/locations` | GET, POST, PUT, DELETE | CRUD ubicaciones |
| `/api/clients` | GET, POST, PUT, DELETE | CRUD clientes |
| `/api/rentals` | GET, POST, PUT | CRUD alquileres (PUT con `action: 'end'` para finalizar) |
| `/api/campaigns` | GET, POST, PUT, DELETE | CRUD campañas |
| `/api/campaign-links` | GET, POST, PUT, DELETE | Links trackables por campaña |
| `/api/metrics` | GET, POST | Métricas por campaña |
| `/api/gemini` | POST | Chat con Gemini (body: `contents`, opcional `systemInstruction`) |

## Build

```bash
npm run build
npm start
```

## Despliegue en Vercel

1. **Sube el código a GitHub** (ya lo tienes en `https://github.com/webplotcentersj-hash/vp`).

2. **Entra en [vercel.com](https://vercel.com)** → Inicia sesión (con GitHub si quieres).

3. **Import Project** → “Import Git Repository” → elige el repo **webplotcentersj-hash/vp**.

4. **Configuración del proyecto:**
   - **Root Directory:** `./` (dejar por defecto si el repo es solo esta app).
   - **Framework Preset:** Next.js (Vercel lo detecta solo).
   - No cambies Build Command ni Output Directory.

5. **Variables de entorno** (Environment Variables): añade todas estas (y márcalas para Production, Preview y Development si quieres):

   | Nombre | Valor |
   |--------|--------|
   | `DB_HOST` | **Host MySQL remoto** (ej. `srv123.hostinger.com` o el que te dé tu hosting). **No uses `localhost`** en Vercel. |
   | `DB_USER` | u956355532_vpv |
   | `DB_PASSWORD` | Tu contraseña BD principal (entre comillas si tiene símbolos) |
   | `DB_NAME` | u956355532_vp |
   | `DB_CAMPAIGNS_HOST` | **Mismo host remoto** (o el de la BD de campañas si es otro) |
   | `DB_CAMPAIGNS_USER` | u956355532_mapi |
   | `DB_CAMPAIGNS_PASSWORD` | Tu contraseña BD campañas (entre comillas si tiene símbolos) |
   | `DB_CAMPAIGNS_NAME` | u956355532_mapados |
   | `GEMINI_API_KEY` | Tu API key de Gemini (opcional, solo si usas /admin/ia) |
   | `NEXT_PUBLIC_APP_URL` | `https://tu-dominio.vercel.app` (la URL final de la app; para links de tracking) |

   **Importante:** En Vercel la app corre en la nube, así que `DB_HOST` y `DB_CAMPAIGNS_HOST` tienen que ser el **hostname público** de MySQL que te da tu proveedor (Hostinger, etc.), no `localhost`. En el panel del hosting suele aparecer como “MySQL host” o “Database host”.

6. **Deploy** → Vercel hace build y despliegue. Cuando termine te da una URL tipo `https://vp-xxx.vercel.app`.

7. Después del primer deploy, pon en `NEXT_PUBLIC_APP_URL` esa URL real para que los links trackables de campañas apunten bien.

---

## Notas

- La BD principal debe tener las tablas: `users`, `locations`, `clients`, `rentals` (como en el proyecto PHP original).
- La BD de campañas debe tener: `campaigns`, `campaign_locations`, `campaign_metrics`, `campaign_links`, etc. (según `setup_campaigns.sql`).
- Si no configuras las BD, el login y las rutas que usan BD fallarán hasta que las variables de entorno estén correctas.
- **Vercel:** el servidor MySQL debe aceptar conexiones desde internet (acceso remoto habilitado en el hosting).
