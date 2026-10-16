# PokéSurvivor · Mundo Misterioso

Bullet-heaven con Pokémon al estilo de Survivor.io y Megabonk, con sprites de
_Pokémon Mundo Misterioso_, capa roguelike, **966 Pokémon de las 9 generaciones**,
shinies y gacha por región. Música y efectos compuestos para el juego.

HTML + CSS + JavaScript vanilla sobre Canvas 2D. Sin build, sin dependencias y
**todo local**: no necesita internet para jugar.

> **Aviso sobre criptomonedas / Crypto disclaimer**
>
> PokéSurvivor **no tiene ninguna criptomoneda, token ni NFT oficial**, y yo no
> he creado ninguno. Cualquier token que use el nombre del juego lo han creado
> terceros. **No me hago cargo de ninguna compra, venta o inversión** que hagas
> con ellos y nada de lo que hay aquí es una recomendación de inversión. El
> juego es gratis y lo seguirá siendo.
>
> PokéSurvivor has **no official cryptocurrency, token or NFT**, and I have not
> created any. Any token using the game's name was created by third parties.
> **I take no responsibility for any purchase, sale or investment** you make
> with them, and nothing here is investment advice. The game is free and will
> stay free.

## Jugar

Necesitas [Node.js](https://nodejs.org) 20 o más:

```
npm install
npm run dev        # http://localhost:3000 (y /en/ en inglés)
```

Crea una cuenta o entra como invitado, haz el test de personalidad y a la
mazmorra. Con `npm run dev` la partida se guarda sólo en el navegador (no toca la
nube); ver [Desarrollo](#desarrollo).

| Tecla                     | Acción                      |
| ------------------------- | --------------------------- |
| `W` `A` `S` `D` / flechas | Moverse                     |
| `1` `2` `3` `4`           | Elegir el movimiento activo |
| `Q` / `E`                 | Ciclar movimientos          |
| `Esc` / `P`               | Pausa                       |

**En móvil o tablet** (en horizontal): pon el dedo en cualquier sitio y arrastra
para moverte (el joystick aparece donde tocas), toca un ataque de abajo para
cambiarlo y el botón de arriba a la derecha para pausar. Se puede instalar como
app ("Añadir a pantalla de inicio"). En **Ajustes** hay sonido, calidad gráfica
(con modo automático), números de daño, menos sacudidas, FPS y la cuenta.

El Pokémon ataca solo con el movimiento activo (o con todos los de un
**vínculo**: cada legendario vencido deja fusionar movimientos para lanzarlos a
la vez desde un solo hueco, hasta 4). Las rocas, cofres y la hierba
alta se rompen; las paredes y los árboles bloquean los disparos enemigos; el
agua frena y la lava quema (también a los enemigos).

En el mapa hay **altares de poder**, **manantiales** que curan, **cofres con
candado** (quédate a su lado unos segundos) y **trampas** que también dañan a
los enemigos. A veces se abre una **grieta**: entra y lucharás contra un
**legendario** en una arena aparte.

Hay **tabla de tipos** (un Rayo Burbuja le quita más a un Charmander) y,
de vez en cuando, **climas** (sol, lluvia, arena, nieve, niebla) que potencian
unos tipos y debilitan otros.

Cada día hay **misiones** (y semanales) que dan tickets y monedas; los
**logros** dan medallas y títulos, y tu **perfil** enseña tus 3 Pokémon
favoritos, tus marcas y tus medallas. En las runs encuentras **objetos** (Restos,
Cinta Elección...) y tus movimientos **evolucionan** al máximo nivel. Los
enemigos tienen personalidad: curan, ponen escudos, llaman a su manada o atacan
con aviso en el suelo.

Las **mejoras** son de cada Pokémon. El **gacha** va con **tickets** que se
ganan jugando (×1 de algunos Pokémon, ×10 de jefes y legendarios), y se tira
en una tragaperras pixel art.

Cada enemigo tiene 1/4096 de salir **shiny**: brilla, una flecha en el borde de
la pantalla te dice dónde está, y si lo derrotas te lo quedas. En el gacha sale
shiny 1 de cada 100 tiradas. En la colección eliges tu compañero en versión
normal o shiny.

La música suena tras el primer clic (los navegadores no dejan reproducir sonido
antes). Volumen y silencio: botón del altavoz arriba a la derecha, o en la pausa.

El guardado vive en el `localStorage` del navegador: si borras los datos del
sitio, se pierde.

En `videos/` hay grabaciones del juego (con su música): un combate contra un
jefe, la captura de un shiny salvaje y un shiny en el gacha.

## Guardado en la nube y publicación

- **Nube propia (`server/`: Node + Postgres):** se entra sólo con Google y la
  partida se sigue en cualquier aparato. Variables en [.env.example](.env.example).
  Sin `DATABASE_URL`, el juego guarda sólo en el navegador.
- **Jugar con amigos (hasta 4) y ranking:** con cuenta en la nube, menú
  **Amigos** (añadir por apodo, invitar a tu sala) y **Ranking** (tiempo
  aguantado: solo o grupo, de hoy a histórico, amigos, por Pokémon).
- **Publicar (Docker / Coolify):** [docs/PUBLICAR.md](docs/PUBLICAR.md).
- Si se juega en dos ordenadores a la vez o sin conexión, las partidas se
  **fusionan**: las colecciones se unen (nunca se pierde un Pokémon ni un
  shiny), mejoras y estadísticas se quedan con el máximo, y monedas y
  monedas y tickets con la libreta de cada aparato (`src/js/core/save-merge.js`,
  la misma fusión en el navegador y en el servidor).

## Licencia

Código bajo [PolyForm Noncommercial 1.0.0](LICENSE-NONCOMMERCIAL.md) desde el
14-10-2026: se puede usar, estudiar y modificar, pero **no con fines
comerciales** (ni vender el juego ni cobrar nada dentro de él). Las versiones
hasta el commit `b297089` se publicaron bajo MIT. Los sprites (CC BY-NC 4.0),
la fuente (OFL) y las marcas de Pokémon tienen sus propias condiciones: ver
[LICENSE](LICENSE) y [CREDITS.md](CREDITS.md). Proyecto de fan sin ánimo de
lucro.

**La única web oficial es [survivor.preciostcg.com](https://survivor.preciostcg.com).** El
juego es y será gratis: si alguien te pide pagar, no somos nosotros.

## Desarrollo

| Comando                               | Qué hace                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                         | Servidor local en http://localhost:3000 con `src/` + `public/`; se recarga al guardar. Con `.env` (DATABASE_URL), con nube. |
| `npm run db:up`                       | Postgres local en Docker (`docker-compose.dev.yml`).                                                                        |
| `npm run build`                       | Genera `dist/`: el juego empaquetado (`js/app.min.js`), `version.json` y las páginas web. Necesita Python 3.                |
| `npm run build:force`                 | Igual, pero es una actualización obligatoria para los jugadores.                                                            |
| `npm run build:debug`                 | Igual, sin ofuscar (`G` accesible en la consola).                                                                           |
| `npm start`                           | Sirve `dist/` como en producción (antes, `npm run build`).                                                                  |
| `npm run clean`                       | Borra `dist/` y `.cache/`.                                                                                                  |
| `npm run lint` / `lint:fix`           | Revisa el código con ESLint (y arregla lo automático).                                                                      |
| `npm run format` / `format:check`     | Formatea con Prettier / comprueba que todo está formateado.                                                                 |
| `npm run docker:build` / `docker:run` | Imagen de producción (servidor Node) en http://localhost:8080.                                                              |
| `npm run data:*`                      | Regenera datos: `pokedex`, `sprites`, `credits`, `hover`, `icons`, `font` (Python).                                         |

Puerto: `PORT=4000 npm run dev`. Python: si no está en el PATH, `PYTHON=/ruta/a/python`.

## Estructura

```
src/
  index.html            la página: pantallas + orden de carga de los scripts (se edita aquí)
  css/                  style.css (juego, estilo Mundo Misterioso) y pages.css (páginas web)
  js/
    core/     util, db (guardado), audio (sintetizador + efectos), input,
              sprites (animador PMD), camera, updater (actualización automática)
    data/     pokedex*, sprites-meta*, moves, starters (+ test), enemies,
              upgrades, music (partituras), changelog, lang-en
    world/    tiles (pixel art en código), world (terreno, objetos, colisiones)
    entities/ player, enemy, projectile, pickup, fx
    systems/  combat, spawner, levelup, gacha...
    net/      live (WebSocket), social (apodo, amigos, salas), net (WebRTC), coop, ranking
    ui/       icons (pixel art), ui, hud, login, test, menu, gacha-ui, run-ui...
    game.js   flujo y bucle principal
    main.js   arranque
public/                 se copia tal cual a dist/
  assets/pokemon/{dex}/ hojas de sprites PMD* (Idle, Walk, Attack, Shoot, Charge, Hurt, Faint); s/ = shiny
  assets/icons/         iconos de la app*
  assets/fonts/         Pixelify Sans (OFL) y su versión con números redibujados*
  contacto/  favicon.ico  manifest.webmanifest  sw.js
scripts/                build y scripts que regeneran los ficheros marcados con *
server/                 servidor (web, cuentas de Google, partidas, ranking, salas y señalización del cooperativo)
docs/                   publicar, SEO, dominio, GDD
dist/                   generado por npm run build (no se sube)
```

`*` = generado. Para rehacerlos (necesita Python 3 + Pillow e internet, sólo esa vez):

```
npm run data:sprites    # sprites normal y shiny + src/js/data/sprites-meta.js
                        # (~20 min; se puede cortar y relanzar: usa .cache/)
npm run data:pokedex    # src/js/data/pokedex.js
npm run data:credits    # CREDITS.md
```

## Notas de implementación

- **Sprites PMD.** Columnas = fotogramas, filas = 8 direcciones (Down, DownRight,
  Right, UpRight, Up, UpLeft, Left, DownLeft — verificado con los `-Offsets.png`).
  Cada animación tiene su propio tamaño de fotograma, así que se alinean por el
  **ancla al suelo** sacada del `-Shadow.png`; sin eso el sprite saltaría al atacar.
- **Coordenadas.** `(x, y)` de una entidad son sus **pies**. Las colisiones
  ocurren en el plano del suelo; los proyectiles vuelan en ese plano y se dibujan
  elevados con su sombra debajo.
- **Mundo.** Chunks de 16×16 tiles: los _datos_ (terreno, objetos) son baratos y
  se generan siempre; la _imagen_ se hornea a resolución de arte escribiendo en un
  `ImageData` (~4 ms por chunk en Chrome) y sólo para los visibles.
- **Rendimiento.** Rejilla espacial de enemigos reconstruida cada frame. Con 420
  enemigos, simulación + render completo ≈ 3 ms por frame en Chrome.
- **Metadatos en `.js`, no `.json`**, porque `fetch()` está bloqueado en `file://`.
- **Shiny.** Los shiny de SpriteCollab son el mismo dibujo con otra paleta; están
  en `s/` y sólo 30 tienen geometría distinta (campo `sa` en los metadatos).
  Las hojas se guardan como PNG con paleta exacta: misma imagen, la mitad de peso.
- **Audio.** Sintetizador Web Audio con planificador anticipado (programa las
  notas 150 ms por delante) y reverb por convolución con un impulso generado.
  Las partituras están en `js/data/music.js` en un formato de texto propio.
  Los efectos tienen separación mínima entre repeticiones y un tope de voces,
  para que 400 enemigos golpeados a la vez no saturen.
- **Iconos.** Mapas de caracteres convertidos a canvas y data URLs; siempre a
  múltiplos enteros de su tamaño para que el píxel quede limpio.

## Créditos y licencia

Sprites de [SpriteCollab](https://github.com/PMDCollab/SpriteCollab) bajo
**CC BY-NC 4.0** — uso **no comercial** y con atribución; la lista de artistas
está en [`CREDITS.md`](CREDITS.md). Pokémon es propiedad de Nintendo, Creatures
Inc. y GAME FREAK. Proyecto de fan sin ánimo de lucro.
