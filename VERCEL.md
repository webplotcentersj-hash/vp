# Desplegar en Vercel

## 1. Subir código a GitHub (si aún no está)

```bash
cd app-next
git add .
git commit -m "Deploy Vercel"
git push -u origin main
```

(Si el repo es **webplotcentersj-hash/vp**, el push debe hacerse desde esa carpeta con ese remote.)

---

## 2. Conectar con Vercel

1. Entrá a **[vercel.com](https://vercel.com)** e iniciá sesión con GitHub.
2. **Add New…** → **Project**.
3. Importá el repositorio **webplotcentersj-hash/vp**.
4. Dejá **Root Directory** en blanco. **No hagas Deploy todavía.**

---

## 3. Variables de entorno en Vercel

En la pantalla del proyecto, abrí **Environment Variables** y agregá **todas** estas (elegí Production, Preview y Development):

| Name | Value |
|------|--------|
| `DB_HOST` | `srv1651.hstgr.io` |
| `DB_USER` | `u956355532_vpv` |
| `DB_PASSWORD` | *(tu contraseña de la BD principal)* |
| `DB_NAME` | `u956355532_vp` |
| `DB_CAMPAIGNS_HOST` | `srv1651.hstgr.io` |
| `DB_CAMPAIGNS_USER` | `u956355532_mapi` |
| `DB_CAMPAIGNS_PASSWORD` | *(tu contraseña de la BD campañas)* |
| `DB_CAMPAIGNS_NAME` | `u956355532_mapados` |
| `NEXT_PUBLIC_APP_URL` | *(dejalo vacío por ahora; después del primer deploy poné la URL que te dé Vercel, ej. `https://vp-xxx.vercel.app`)* |

Opcional (solo si usás el asistente IA):

| Name | Value |
|------|--------|
| `GEMINI_API_KEY` | *(tu API key de Gemini)* |

---

## 4. Deploy

- Clic en **Deploy**.
- Cuando termine, Vercel te da una URL tipo **https://vp-xxxx.vercel.app**.
- Entrá a esa URL: deberías ver el login de la app.
- Opcional: en **Settings → Environment Variables** actualizá `NEXT_PUBLIC_APP_URL` con esa URL y volvé a desplegar (o en el próximo deploy se usará sola).

---

## 5. Hostinger: acceso remoto a MySQL

Para que Vercel pueda conectar a tu MySQL en Hostinger:

1. En **Hostinger (hPanel)** → **Bases de datos** → **Remote MySQL**.
2. Agregá **Any Host** (o las IPs de Vercel si querés restringir) para permitir conexiones desde internet.
3. Guardá los cambios.

Sin esto, el deploy en Vercel va a fallar al intentar conectar a la base de datos.
