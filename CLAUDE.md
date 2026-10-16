# PokéSurvivor — cómo se trabaja y se publica

Normas fijas del dueño del proyecto. Se aplican SIEMPRE.

## Publicar una versión

1. Se edita `src/` (la página es `src/index.html`; lo estático va en `public/`). `dist/` se genera y no se sube.
2. `npm run build` (o `npm run build:force` para una actualización obligatoria); `npm start` para verlo.
   - `scripts/build.js` genera `dist/index.html`, `dist/js/app.min.js` y **`dist/version.json`** (la huella de esta versión);
     luego `scripts/export_data.js` y `scripts/make_seo_pages.py` generan las páginas web.
3. Commit (sin "Co-Authored-By" ni ninguna firma de IA) y `git push origin main` sólo cuando el dueño lo pida.
   Coolify reconstruye la imagen (`Dockerfile`) y publica solo. Ver `docs/PUBLICAR.md`.

## Actualización automática de los jugadores (obligatorio)

Al publicar, todos los jugadores deben pasar a la versión nueva sin perder nada
(`src/js/core/updater.js`, mira `version.json` cada 5 min):

- **Fuera de partida** (menú, sala de cooperativo incluida): aviso de 5 s y la página se recarga.
  Si está en el gacha, la tienda de mejoras, los ajustes o escribiendo en un campo, espera a que termine.
- **En partida**: no se toca. Al acabar, la run se guarda como siempre y, al volver al menú, se recarga.
- Antes de recargar se sube a la nube lo pendiente.
  No quitar `updater.js` ni la escritura de `version.json` en `scripts/build.js`.

## Novedades (changelog)

Cada cambio de juego o arreglo de fallos va también en `src/js/data/changelog.js`
(español e inglés, en `new` / `chg` / `fix` de la fecha de hoy). Los cambios de
servidores, base de datos o costes NO van ahí.

## Servidores

- Firebase: proyecto **pokesurvivor-free** (autenticación normal: cuentas gratis sin límite).
  **Nunca** activar "Identity Platform" ni nada que lo active (funciones de bloqueo, MFA,
  "Actualizar para habilitar"): cobra por usuario. El proyecto viejo pokesurvivor-jpter se borró el 13-10-2026 (con su facturación).
- Cloudflare: SÓLO el dominio pokesurvivor.com (comprado allí, DNS gratis). El Worker y el TURN
  (Cloudflare Realtime) se quitaron el 15-10-2026: el cooperativo va sólo con conexión directa
  (STUN gratis de Google). No volver a añadir nada de pago.
- Mantenimiento: `MAINTENANCE` en `src/js/main.js` (con `?dev` se puede entrar para probar).
