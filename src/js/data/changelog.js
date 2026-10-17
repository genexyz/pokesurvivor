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
        "Story mode now covers all nine regions: 72 stages, from Brock to Grusha, each with its own routes, wild Pokémon and the leader's real team. In Alola you face the island trials, against Captains and Kahunas, for Z-Crystals. Every region is open from the start; later regions are a bit harder and give more.",
        'El modo Historia ya recorre las nueve regiones: 72 etapas, de Brock a Grusha, cada una con sus rutas, sus Pokémon salvajes y el equipo de verdad del líder. En Alola te enfrentas a las pruebas de las islas, contra capitanes y kahunas, por cristales Z. Todas las regiones están abiertas desde el principio; las últimas son algo más difíciles y dan más.'
      ],
      [
        'Gym leaders appear next to their best Pokémon, stand at the back of their arena and send out their team when you arrive. Every badge has its own icon, and each region has a champion title to earn, plus "Pokémon Master" for all 72 badges.',
        'Los líderes de gimnasio aparecen junto a su mejor Pokémon, esperan al fondo de su arena y sacan a su equipo cuando llegas. Cada medalla tiene su icono, y cada región tiene un título de campeón, además de «Maestro Pokémon» por las 72 medallas.'
      ]
    ],
    fix: [
      [
        'Phones: starting a run no longer freezes for a few seconds, and the game no longer stutters every so often while you walk into new ground. The ground is now drawn a little at a time, ahead of where you are going.',
        'Móvil: empezar una partida ya no congela el juego unos segundos, y ya no se traba cada tanto al caminar hacia terreno nuevo. El suelo ahora se dibuja poco a poco, por delante de hacia donde vas.'
      ],
      ['Defeating Pokémon no longer causes small hitches.', 'Derrotar Pokémon ya no provoca pequeños tirones.']
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
