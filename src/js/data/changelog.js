/* ============ changelog.js — game news ============
 * What people see under the "News" button in the top bar: gameplay changes
 * and fixed bugs (nothing about servers or databases).
 * Newest date on top. Each date, by section:
 *   new  what's new · chg  changes and tweaks · fix  fixed bugs
 * Each line (and title) is a pair [English, Spanish]: English first, then Spanish.
 */
export const CHANGELOG = [
  {
    d: '2026-10-16',
    title: ['Damage meter, your stats and search', 'Medidor de daño, tus estadísticas y buscador'],
    new: [
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
      ['You can type spaces in the search boxes again.', 'Ya se pueden escribir espacios en los buscadores.']
    ]
  }
];
