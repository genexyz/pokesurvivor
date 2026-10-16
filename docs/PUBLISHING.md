# Publicar el juego (Coolify + Docker)

El juego es una web estática más un servidor pequeño de Node (`server/`) con
Postgres para la nube: cuentas de Google, partidas, amigos, ranking y las salas
del cooperativo. `npm run build` genera la web en `dist/` y el `Dockerfile`
monta una imagen con el servidor, que sirve `dist/` y la nube. Se publica en
**Coolify**, en **https://survivor.preciostcg.com**. Nada de servicios de pago:
Postgres va en el mismo Coolify y el cooperativo sólo usa el STUN gratis de Google.

## 1. Crear la aplicación en Coolify (una vez)

0. **Postgres:** en el mismo proyecto, **+ New → Database → PostgreSQL**. Copia su
   URL interna (`postgres://...`): es el `DATABASE_URL` de abajo. Activa sus
   copias de seguridad programadas (Backups) si quieres.
1. **Projects → (tu proyecto) → + New → Public/Private Repository** y elige este
   repositorio, rama `main`.
2. **Build Pack: Dockerfile** (usa el `Dockerfile` de la raíz).
3. **Ports Exposes: `80`**.
4. **Domains:** `https://survivor.preciostcg.com`. Coolify (Traefik) saca el
   certificado HTTPS solo (y deja pasar el WebSocket `/ws` sin configurar nada).
   En el DNS de preciostcg.com, un registro `A` `survivor` apuntando a la IP del servidor.
   4b. **Environment Variables** (ver `.env.example`):
   - `DATABASE_URL`: la del Postgres del paso 0
   - `BETTER_AUTH_URL=https://survivor.preciostcg.com`
   - `BETTER_AUTH_SECRET`: uno nuevo, `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`: los mismos que precios-tcg
   - `ADMIN_EMAILS`: tu correo de Google (para la moderación del ranking)
     4c. **Google Cloud Console → APIs y servicios → Credenciales →** el cliente OAuth
     de precios-tcg: añade el origen `https://survivor.preciostcg.com` y la URI de
     redirección `https://survivor.preciostcg.com/api/auth/callback/google` (y para
     probar en local, `http://localhost:3000/api/auth/callback/google`).
     La pantalla de "Elige una cuenta" de Google enseña el nombre de la app de ese cliente.
5. Activa **Auto Deploy** (webhook de GitHub) para que cada `git push` publique.
6. **Deploy**.

La imagen hace `npm ci`, `npm run build` (Node + Python dentro del contenedor) y
arranca `node server/index.mjs` en el puerto 80. Al arrancar, el servidor crea
o actualiza solo las tablas de Postgres. No hace falta instalar nada en el servidor.

## 2. Actualizar el juego

```
npm run build        # opcional: comprobar en local que compila (npm start para verlo)
git add -A
git commit -m "Qué has cambiado"
git push             # Coolify reconstruye y publica
```

`dist/` no se sube al repositorio: lo genera la imagen en cada despliegue.

Los jugadores pasan solos a la versión nueva (`src/js/core/updater.js` mira
`/version.json` cada 5 min). El servidor sirve `version.json` y las páginas sin caché
y `js/app.min.js` con caché larga (la URL lleva la huella `?v=`).

### Actualización obligatoria

Para que también se corten las partidas en curso (guardando lo ganado), en
Coolify añade la **Build Variable** `BUILD_ARGS=--forzar`, despliega, y luego
quítala. En local equivale a `npm run build:force`.

## 3. Probar en local

```
cp .env.example .env   # y rellena BETTER_AUTH_SECRET y las claves de Google
npm run db:up          # Postgres en Docker (docker-compose.dev.yml)
npm run dev            # http://localhost:3000, con nube; sin DATABASE_URL va en modo local
```

La imagen: `npm run docker:build` y `npm run docker:run` (http://localhost:8080;
su `DATABASE_URL` tiene que llegar desde dentro del contenedor, p. ej.
`host.docker.internal` en vez de `localhost`).

## 4. Nube y dominio

- La nube (cuentas, partidas, cooperativo) sólo se activa en los dominios de
  `HOSTS` en `src/js/core/db.js`; en otro dominio el juego va en modo local y
  avisa de que no es la web oficial. Para otro dominio: añádelo a `HOSTS`, cambia
  `BETTER_AUTH_URL` y la URI de redirección del cliente OAuth de Google.
- Las páginas para buscadores usan `SITE = 'https://survivor.preciostcg.com/'`
  (`scripts/make_seo_pages.py`) y `src/index.html` tiene esa URL en canonical y
  og:image: cámbialas si publicas en otro dominio.

## 5. Que salga en Google

1. <https://search.google.com/search-console> → **Añadir propiedad** → tu dominio.
2. Verificación por DNS (registro TXT) o con la etiqueta `<meta ...>` dentro de
   `<head>` en `src/index.html` (y publicar).
3. **Sitemaps** → `sitemap.xml`.

## Recordatorios

- **Nada de dinero**: ni anuncios, ni donaciones a cambio de nada, ni pagos.
  Lo exige la licencia de los sprites (CC BY-NC) y la del código (PolyForm
  Noncommercial), y es lo que más reduce el riesgo de que Nintendo pida retirarlo.
- Si llega una reclamación de derechos al correo del aviso legal, atiéndela
  rápido: retirar lo que pidan suele cerrar el asunto.
