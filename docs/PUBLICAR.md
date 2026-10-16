# Publicar el juego (Coolify + Docker)

El juego es una web estática. `npm run build` la genera en `dist/` y el
`Dockerfile` la sirve con nginx, así que se puede alojar en cualquier sitio que
ejecute Docker. Aquí: **Coolify** en un servidor propio (Hetzner).

## 1. Crear la aplicación en Coolify (una vez)

1. **Projects → (tu proyecto) → + New → Public/Private Repository** y elige este
   repositorio, rama `main`.
2. **Build Pack: Dockerfile** (usa el `Dockerfile` de la raíz).
3. **Ports Exposes: `80`**.
4. **Domains:** tu dominio, con `https://` delante (p. ej. `https://midominio.com`).
   Coolify (Traefik) saca el certificado HTTPS solo. En el DNS del dominio, un
   registro `A` apuntando a la IP del servidor.
5. Activa **Auto Deploy** (webhook de GitHub) para que cada `git push` publique.
6. **Deploy**.

La imagen hace `npm ci`, `npm run build` (Node + Python dentro del contenedor) y
copia `dist/` a nginx (`deploy/nginx.conf`). No hace falta Node ni Python en el
servidor.

## 2. Actualizar el juego

```
npm run build        # opcional: comprobar en local que compila (npm start para verlo)
git add -A
git commit -m "Qué has cambiado"
git push             # Coolify reconstruye y publica
```

`dist/` no se sube al repositorio: lo genera la imagen en cada despliegue.

Los jugadores pasan solos a la versión nueva (`src/js/core/updater.js` mira
`/version.json` cada 5 min). nginx sirve `version.json` y las páginas sin caché
y `js/app.min.js` con caché larga (la URL lleva la huella `?v=`).

### Actualización obligatoria

Para que también se corten las partidas en curso (guardando lo ganado), en
Coolify añade la **Build Variable** `BUILD_ARGS=--forzar`, despliega, y luego
quítala. En local equivale a `npm run build:force`.

## 3. Probar la imagen en local

```
npm run docker:build
npm run docker:run   # http://localhost:8080
```

## 4. Firebase y dominio

- La nube (cuentas, partidas, cooperativo) sólo se activa en los dominios de
  `HOSTS` en `src/js/core/db.js`; en otro dominio el juego va en modo local y
  avisa de que no es la web oficial. Para tu dominio: añádelo a `HOSTS`, pon
  tu propio proyecto en `src/js/core/firebase-config.js` ([FIREBASE.md](FIREBASE.md))
  y añade el dominio a los **dominios autorizados** de Authentication.
- Las páginas para buscadores usan `SITE = 'https://pokesurvivor.com/'`
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
