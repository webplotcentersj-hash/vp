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

## Notas

- La BD principal debe tener las tablas: `users`, `locations`, `clients`, `rentals` (como en el proyecto PHP original).
- La BD de campañas debe tener: `campaigns`, `campaign_locations`, `campaign_metrics`, `campaign_links`, etc. (según `setup_campaigns.sql`).
- Si no configuras las BD, el login y las rutas que usan BD fallarán hasta que `.env.local` esté correcto.
