/* ============ changelog.js — game news ============
 * What people see under the "News" button in the top bar: gameplay changes
 * and fixed bugs (nothing about servers or databases).
 * Newest date on top. Each date, by section:
 *   new  what's new · chg  changes and tweaks · fix  fixed bugs
 * Each line (and title) is a pair [English, Spanish]: English first, then Spanish.
 */
G.CHANGELOG = [
  {
    d: '2026-10-16',
    title: ['Simpler menus', 'Menús más sencillos'],
    new: [
      [
        'Every run has a seed: you can see it in the pause screen and in the run summary.',
        'Cada partida tiene una semilla: la ves en la pausa y en el resumen de la partida.'
      ]
    ],
    chg: [
      [
        'Descriptions of items, upgrades, level-up cards and altars always show their real values.',
        'Las descripciones de objetos, mejoras, cartas de nivel y altares muestran siempre sus valores reales.'
      ],
      [
        'Removed the Support button and the donation message at the end of a run. Settings > About and the legal notice are shorter: no more contact, source code, official website or cryptocurrency sections.',
        'Se quitan el botón Apoyar y el mensaje de donación al terminar la partida. Ajustes > Acerca de y el aviso legal son más cortos: ya no hay apartados de contacto, código fuente, web oficial ni criptomonedas.'
      ]
    ]
  }
];
