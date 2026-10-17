/* ============ changelog.js — game news ============
 * What people see under the "News" button in the top bar: gameplay changes
 * and fixed bugs (nothing about servers or databases).
 * Newest date on top. Each date, by section:
 *   new  what's new · chg  changes and tweaks · fix  fixed bugs
 * Each line (and title) is a pair [English, Spanish]: English first, then Spanish.
 */
export const CHANGELOG = [
  {
    d: '2026-10-17',
    title: ['Story mode in every region', 'Modo Historia en todas las regiones'],
    new: [
      [
        'Mega Evolution: 42 partners with a Mega or Primal form (Charizard, Gengar, Lucario, Gardevoir, Rayquaza, Kyogre, Groudon and more) can Mega Evolve in a run. A boss or a chest drops its Mega Stone (or its Orb); then defeating foes fills the Mega meter next to your moves. When it is full, press Space, A on a controller or tap the Mega button: for 25 seconds your partner takes its Mega form, with more damage, speed and defense, an aura, and a shockwave that heals you and pushes foes back. Afterwards the meter rests for a while and charges again. Your teammates see your Mega form in co-op too.',
        'Megaevolución: 42 compañeros con forma Mega o Primigenia (Charizard, Gengar, Lucario, Gardevoir, Rayquaza, Kyogre, Groudon y más) pueden megaevolucionar en una partida. Un jefe o un cofre suelta su megapiedra (o su prisma); después, derrotar enemigos llena el medidor Mega junto a tus movimientos. Cuando esté lleno, pulsa Espacio, A en el mando o toca el botón Mega: durante 25 segundos tu compañero toma su forma Mega, con más daño, velocidad y defensa, un aura y una onda que te cura y aparta a los enemigos. Después el medidor descansa un rato y vuelve a cargarse. En cooperativo tus compañeros también ven tu forma Mega.'
      ],
      [
        'Controller support: play with an Xbox, PlayStation or Switch Pro controller. Left stick to move, LB/RB to switch moves, Y for ×2 speed, Start to pause. In menus, the stick or D-pad moves a gold highlight, A chooses, B goes back, LB/RB switch tabs and the right stick scrolls. The full layout is in Settings > Controls.',
        'Compatibilidad con mandos: juega con un mando de Xbox, PlayStation o Switch Pro. Stick izquierdo para moverte, LB/RB para cambiar de movimiento, Y para velocidad ×2, Start para pausar. En los menús, el stick o la cruceta mueven un resaltado dorado, A elige, B vuelve, LB/RB cambian de pestaña y el stick derecho desplaza. Tienes todos los botones en Ajustes > Controles.'
      ],
      [
        'Game speed ×2: in solo runs (story and the other modes), the ×2 button at the top right of the screen, "Game speed" in the pause menu or the F key make the whole game go twice as fast. Runs start at ×1, or at ×2 with Settings > Controls > "Start at ×2 speed". ×2 runs still count for the leaderboard. Not available in co-op.',
        'Velocidad ×2: en las partidas en solitario (Historia y los demás modos), el botón ×2 arriba a la derecha de la pantalla, «Velocidad del juego» en el menú de pausa o la tecla F hacen que todo el juego vaya el doble de rápido. Las partidas empiezan a ×1, o a ×2 con Ajustes > Controles > «Empezar a velocidad ×2». Las partidas a ×2 siguen contando para la clasificación. No disponible en cooperativo.'
      ],
      [
        'Trainer perks: some achievements now unlock a perk you can equip on the Play screen before a run, such as 4 level-up cards, a bond from every boss, starting with a held item, or getting back up once with 30% HP. You start with 1 slot and get more at 25 and 60 achievements.',
        'Ventajas de entrenador: algunos logros ahora desbloquean una ventaja que puedes equipar en la pantalla Jugar antes de una partida, como ver 4 cartas al subir de nivel, un vínculo por cada jefe, empezar con un objeto equipado o levantarte una vez con el 30% de vida. Empiezas con 1 casilla y consigues más con 25 y 60 logros.'
      ],
      [
        'New Playstyle achievements that reward how you play: survive with every type, go 3 minutes without being hit, win a gym without dropping below half health or with a single move, bond 4 moves, live through every weather, and more.',
        'Nuevos logros de Estilo de juego que premian cómo juegas: aguanta con todos los tipos, pasa 3 minutos sin que te golpeen, gana un gimnasio sin bajar de la mitad de vida o con un solo movimiento, vincula 4 movimientos, aguanta todos los climas y más.'
      ],
      [
        'Shiny partners now have a bonus. Shiny Charm: while you play a shiny, wild shinies (and shiny rift legendaries) are 4 times more common, and in co-op the whole team gets it. Shiny Sash: once per run, a hit that would knock you out leaves you at 1 HP, with a sparkle that pushes nearby enemies back.',
        'Los compañeros shiny ahora tienen un bonus. Amuleto Iris: mientras juegas con un shiny, los shiny salvajes (y los legendarios shiny de la grieta) salen 4 veces más a menudo, y en cooperativo lo tiene todo el equipo. Banda Shiny: una vez por partida, un golpe que te dejaría KO te deja con 1 de vida, con un destello que aparta a los enemigos cercanos.'
      ],
      [
        'Upgrades: an "Upgrade all" button buys every upgrade level of that Pokémon at once and shows what it will cost. If your coins are not enough for everything, it buys as many levels as you can afford, cheapest first.',
        'Mejoras: un botón «Mejorar todo» compra de una vez todos los niveles de mejora de ese Pokémon y muestra cuánto costará. Si tus monedas no llegan para todo, compra todos los niveles que puedas pagar, los más baratos primero.'
      ],
      [
        'Gacha: after a pull, an "Open again" button lets you do the same pull (×1 or ×10) right away if you still have the tickets for it.',
        'Gacha: tras una tirada, un botón «Abrir otra vez» te deja hacer la misma tirada (×1 o ×10) al momento si aún tienes los tickets.'
      ],
      [
        "Story mode now covers all nine regions: 72 stages, from Brock to Grusha, each with its own routes, wild Pokémon and the leader's real team. In Alola you face the island trials, against Captains and Kahunas, for Z-Crystals. Every region is open from the start; later regions are a bit harder and give more.",
        'El modo Historia ya recorre las nueve regiones: 72 etapas, de Brock a Grusha, cada una con sus rutas, sus Pokémon salvajes y el equipo de verdad del líder. En Alola te enfrentas a las pruebas de las islas, contra capitanes y kahunas, por cristales Z. Todas las regiones están abiertas desde el principio; las últimas son algo más difíciles y dan más.'
      ],
      [
        'Gym leaders appear next to their best Pokémon, stand at the back of their arena and send out their team when you arrive. Every badge has its own icon, and each region has a champion title to earn, plus "Grand Champion" for all 72 badges.',
        'Los líderes de gimnasio aparecen junto a su mejor Pokémon, esperan al fondo de su arena y sacan a su equipo cuando llegas. Cada medalla tiene su icono, y cada región tiene un título de campeón, además de «Gran Campeón» por las 72 medallas.'
      ]
    ],
    chg: [
      [
        'The run seed is no longer shown in the pause menu or on the end-of-run screen, and Settings > About no longer shows a version number and date.',
        'La semilla de la partida ya no se muestra en el menú de pausa ni en la pantalla final, y Ajustes > Acerca de ya no muestra número de versión ni fecha.'
      ],
      [
        "Computer: during a run, your Pokémon's name, level, health and active effects are bigger, and so is Story mode's progress bar.",
        'Ordenador: durante la partida, el nombre, nivel, vida y efectos activos de tu Pokémon se ven más grandes, igual que la barra de progreso del modo Historia.'
      ],
      [
        "The move tooltip is wider, so the move's level stays on the same line as its name, and the level is now easy to read.",
        'La ficha de un movimiento es más ancha, así que el nivel del movimiento queda en la misma línea que su nombre, y ahora el nivel se lee bien.'
      ],
      [
        'Mobile: the frame limit has a new "Auto" option, now the default, that runs the game at 60 FPS on phones and tablets (no limit on computers). On 90 and 120 Hz screens this halves the work, so the phone heats up less and does not slow itself down mid-run. You can still pick "No limit" in Settings.',
        'Móvil: el límite de fotogramas tiene una opción nueva, «Auto», ahora la predeterminada, que hace ir el juego a 60 FPS en móviles y tablets (sin límite en ordenadores). En pantallas de 90 y 120 Hz esto reduce el trabajo a la mitad, así que el móvil se calienta menos y no se ralentiza a mitad de partida. Puedes seguir eligiendo «Sin límite» en Ajustes.'
      ]
    ],
    fix: [
      [
        'Mobile: entering and leaving a rift no longer stutters. The ground is drawn about a third faster and a little at a time, and the map you leave is kept, so coming back from the arena is instant.',
        'Móvil: entrar y salir de una grieta ya no va a tirones. El suelo se dibuja como un tercio más rápido y poco a poco, y el mapa que dejas se guarda, así que volver de la arena es instantáneo.'
      ],
      [
        'With a frame limit, the game no longer skips a frame every few seconds on screens slightly faster than the limit.',
        'Con un límite de fotogramas, el juego ya no se salta un fotograma cada pocos segundos en pantallas algo más rápidas que el límite.'
      ],
      [
        'Main menu: the arrow next to the highlighted option is now centred on it, also on options with a two-line description.',
        'Menú principal: la flecha junto a la opción resaltada ahora está centrada en ella, también en las opciones con descripción de dos líneas.'
      ],
      [
        'Profile: the "View my public profile" button no longer sits right against the title picker; it is now on its own line below it.',
        'Perfil: el botón «Ver mi perfil público» ya no aparece pegado al selector de título; ahora está en su propia línea debajo.'
      ],
      [
        'Phones: starting a run no longer freezes for a few seconds, and the game no longer stutters every so often while you walk into new ground. The ground is now drawn a little at a time, ahead of where you are going.',
        'Móvil: empezar una partida ya no congela el juego unos segundos, y ya no se traba cada tanto al caminar hacia terreno nuevo. El suelo ahora se dibuja poco a poco, por delante de hacia donde vas.'
      ],
      ['Defeating Pokémon no longer causes small hitches.', 'Derrotar Pokémon ya no provoca pequeños tirones.'],
      [
        'Missions: the "Refreshes in" countdown now matches when missions really change (midnight in Spain) wherever you live, and the weekly one no longer shows a day too many.',
        'Misiones: la cuenta atrás de «Se renuevan en» ahora coincide con cuándo cambian de verdad (medianoche en España) vivas donde vivas, y la semanal ya no muestra un día de más.'
      ],
      [
        'Picking up a magnet no longer pulls in the other magnets on the map, so you can save them for later.',
        'Recoger un imán ya no atrae a los demás imanes del mapa, así que puedes guardarlos para más tarde.'
      ],
      [
        'Story gyms: when the leader sends out a Pokémon, it now stands still inside a bubble for 2 seconds and can\'t be hurt, so a strong team no longer knocks it out before you even see it.',
        'Gimnasios de Historia: cuando el líder saca un Pokémon, ahora se queda quieto dentro de una burbuja durante 2 segundos y no se le puede dañar, así un equipo fuerte ya no lo debilita antes de que llegues a verlo.'
      ]
    ]
  },
  {
    d: '2026-10-16',
    title: ['Story mode, damage meter, your stats and search', 'Modo Historia, medidor de daño, tus estadísticas y buscador'],
    new: [
      [
        "Story mode: Play now has a tab for each game mode. In Story, travel Kanto stage by stage: 10 minutes of themed routes (Route 1, Viridian Forest, Mt. Moon...) with their own wild Pokémon, three mini-bosses that each grant a bond, and a gym battle at the end against the leader's team. Beat all 8 leaders, from Brock to Giovanni, to collect every badge. Solo, not ranked.",
        'Modo Historia: Jugar ahora tiene una pestaña para cada modo de juego. En Historia recorres Kanto etapa a etapa: 10 minutos de rutas temáticas (Ruta 1, Bosque Verde, Mt. Moon...) con sus propios Pokémon salvajes, tres minijefes que dan un vínculo cada uno y un combate de gimnasio al final contra el equipo del líder. Vence a los 8 líderes, de Brock a Giovanni, para conseguir todas las medallas. En solitario, sin ranking.'
      ],
      [
        'Each stage gives coins and tickets the first time (plus its badge) and a smaller reward on every repeat, and keeps your best clear time. After a stage, go straight to the next one or try again. New Story achievements, including the title "Kanto champion".',
        'Cada etapa da monedas y tickets la primera vez (y su medalla) y un premio menor cada vez que la repites, y guarda tu mejor tiempo. Al terminar una etapa puedes pasar directamente a la siguiente o reintentarla. Nuevos logros de Historia, con el título «Campeón de Kanto».'
      ],
      [
        'Coming from the original game? Claim the welcome gift on the main menu: 300 gacha tickets and 50,000 coins, once per account.',
        '¿Vienes del juego original? Reclama el regalo de bienvenida en el menú principal: 300 tickets del gacha y 50.000 monedas, una vez por cuenta.'
      ],
      [
        'Damage meter: key R (or Settings › Graphics) shows how much damage each move deals and, in co-op, each teammate. Burns and poisons count for whoever applied them.',
        'Medidor de daño: la tecla R (o Ajustes › Gráficos) enseña cuánto daño hace cada movimiento y, en grupo, cada compañero. Las quemaduras y venenos cuentan para quien los puso.'
      ],
      [
        'The pause has tabs: Stats (every stat, the level cards you took, active effects and your moves) and Damage. The end of the run shows them too.',
        'La pausa tiene pestañas: Estadísticas (cada estadística, las cartas de nivel que llevas, los efectos activos y tus movimientos) y Daño. El final de la partida también las enseña.'
      ],
      [
        'Hover a move on the bottom bar (or keep your finger on it) to see what it does: damage, cooldown, next upgrade and evolution.',
        'Pasa el ratón por un movimiento de la barra de abajo (o deja el dedo encima) para ver qué hace: daño, recarga, siguiente mejora y evolución.'
      ],
      [
        'Search the collection by name, number or type, across all regions. The Pokémon, move, title and leaderboard lists can be searched too.',
        'Busca en la colección por nombre, número o tipo, en todas las regiones. Las listas de Pokémon, movimientos, títulos y del ranking también se pueden buscar.'
      ],
      [
        'Gacha: "Open without animation" shows the results at once, and Space, Enter or Skip end the slot machine halfway. A ×10 shows a summary.',
        'Gacha: «Abrir sin animación» enseña el resultado al momento, y Espacio, Intro o Saltar terminan la tragaperras a medias. El ×10 enseña un resumen.'
      ],
      [
        'Settings › Graphics: resolution (Auto, High, Low) and a frame limit, for less heat and battery.',
        'Ajustes › Gráficos: resolución (Auto, Alta, Baja) y límite de fotogramas, para menos calor y batería.'
      ]
    ],
    chg: [
      [
        'Items with a downside (Choice Band, Life Orb) ask before equipping when they are your first item; you can keep going without one. Settings › Controls changes it.',
        'Los objetos con inconveniente (Cinta Elección, Vidasfera) preguntan antes de equiparse si son tu primer objeto; puedes seguir sin ninguno. Se cambia en Ajustes › Controles.'
      ],
      [
        'Auto-aim goes for a small chest right next to you, as long as your attack can reach it.',
        'El apuntado automático va a por un cofre pequeño que tengas al lado, si tu ataque llega.'
      ],
      [
        'Buffs and altar powers show as circles with the move icon and a ring that empties as they run out.',
        'Los efectos y los poderes de altar salen como círculos con el icono del movimiento y un aro que se vacía según se acaban.'
      ],
      [
        'Level cards say how much they raise your stat, and the experience bar shows its numbers.',
        'Las cartas de nivel dicen cuánto suben tu estadística, y la barra de experiencia enseña sus números.'
      ],
      [
        'Menus and the pause run at 30 frames per second, and the sound stops when the tab is hidden.',
        'Los menús y la pausa van a 30 fotogramas por segundo, y el sonido se para con la pestaña oculta.'
      ]
    ],
    fix: [
      [
        'Co-op: picking up two items at once could leave the whole group stuck on "choosing".',
        'Cooperativo: coger dos objetos a la vez podía dejar a todo el grupo parado en «eligiendo».'
      ],
      ['You can type spaces in the search boxes again.', 'Ya se pueden escribir espacios en los buscadores.'],
      [
        'Mobile (Firefox above all): parts of the ground could turn into black squares with Pokémon leaving trails over them.',
        'Móvil (sobre todo Firefox): partes del suelo podían quedarse en cuadros negros con los Pokémon dejando rastro encima.'
      ]
    ]
  }
];
