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
    title: ['New website and Google sign-in', 'Nueva web y entrar con Google'],
    chg: [
      [
        'The game moves to survivor.preciostcg.com. You now sign in only with Google (no more name and password accounts) and everyone starts from scratch. You can still play as a guest.',
        'El juego se muda a survivor.preciostcg.com. Ahora se entra sólo con Google (ya no hay cuentas de nombre y contraseña) y se empieza de cero. Sigues pudiendo jugar como invitado.'
      ],
      [
        'The game now opens in your browser’s language: Spanish if your browser is in Spanish, English otherwise. You can change it any time in Settings > Language. The guide and Pokédex pages now live at guide/ and pokedex/ (in Spanish under es/).',
        'El juego se abre ahora en el idioma de tu navegador: en español si tu navegador está en español y en inglés si no. Puedes cambiarlo cuando quieras en Ajustes > Idioma. Las páginas de la guía y la Pokédex están ahora en guide/ y pokedex/ (en español, dentro de es/).'
      ]
    ]
  },
  {
    d: '2026-10-15',
    title: ['Required updates', 'Actualizaciones obligatorias'],
    chg: [
      [
        'When an update is required (for example, to fix an important bug), your current run ends after a 10 s notice and the game reloads. You lose nothing: that run’s coins, tickets, records and leaderboard entry are saved as if you had quit.',
        'Cuando una actualización sea obligatoria (por ejemplo, para arreglar un fallo importante), la partida en curso se termina tras un aviso de 10 s y el juego se recarga. No pierdes nada: las monedas, los tickets, los récords y el ranking de esa partida se guardan como al abandonarla.'
      ]
    ]
  },
  {
    d: '2026-10-14',
    title: ['Recover your account with Gmail', 'Recupera tu cuenta con Gmail'],
    new: [
      [
        'If you play with a name and password, you can link your Gmail: if you ever forget your password, sign in with Google and it is the same account. We offer it when you sign in.',
        'Si juegas con nombre y contraseña, puedes vincular tu Gmail: si un día olvidas la contraseña, entras con Google y es tu misma cuenta. Te lo ofrecemos al entrar.'
      ],
      [
        'Mobile: you can now place the buttons wherever you want. In Settings > Controls > Place the buttons, drag the attacks (with the item), the pause button and the joystick, which can now also be fixed instead of appearing where you put your finger.',
        'Móvil: ya puedes colocar los botones donde quieras. En Ajustes > Controles > Colocar los botones arrastras los ataques (con el objeto), la pausa y el joystick, que ahora también puede ser fijo en vez de aparecer donde pones el dedo.'
      ]
    ],
    chg: [
      [
        'The weekly and monthly leaderboards start from scratch, like the all-time one: now only runs with the Judgment of Arceus count, and all boards match each other.',
        'Las tablas de la semana y del mes del ranking empiezan de cero, como el histórico: ahora sólo cuentan partidas con la Sentencia de Arceus y todas las tablas cuadran entre sí.'
      ],
      [
        'Important: the only official PokéSurvivor website is pokesurvivor.com. The game is and always will be free: if any other website asks you to pay (for tickets, coins or anything else), it isn’t us. You will also see this when signing in and in the Legal notice.',
        'Aviso importante: la única web oficial de PokéSurvivor es pokesurvivor.com. El juego es y será gratis: si alguna otra web te pide pagar (por tickets, monedas o lo que sea), no somos nosotros. Lo verás también al entrar y en el Aviso legal.'
      ],
      [
        'The game’s code moves to a non-commercial license (PolyForm Noncommercial 1.0.0): you can still study and modify it, but nobody may charge for it.',
        'El código del juego pasa a una licencia no comercial (PolyForm Noncommercial 1.0.0): se puede seguir estudiando y modificando, pero nadie puede cobrar por él.'
      ]
    ],
    fix: [
      [
        'Co-op: the game no longer freezes with each player waiting for the other to choose. An item and the level-up cards no longer cover each other, and if the connection drops a message it fixes itself.',
        'Cooperativo: la partida ya no se queda parada con cada uno esperando a que el otro elija. Un objeto y las cartas de nivel ya no se tapan, y si la conexión pierde un aviso se arregla solo.'
      ],
      [
        'Co-op: after coming back from a rift, players who are not the host can see every enemy again (some used to be invisible, with only their attacks showing).',
        'Cooperativo: al volver de una grieta, quien no era el anfitrión ya ve a todos los enemigos (antes algunos eran invisibles y sólo se veían sus ataques).'
      ],
      [
        'Friends: if your phone or computer has the wrong time (or time zone), your friends no longer always show as offline and their invitations reach you.',
        'Amigos: si tu móvil u ordenador tiene la hora (o la zona horaria) mal puesta, tus amigos ya no salen siempre desconectados y sus invitaciones te llegan.'
      ],
      [
        'Playing on two devices (PC and phone) no longer loses coins or tickets: before, if one had the game open with old data and saved, it erased what you earned on the other. Now both are added up. And when you come back to the game after a while away, it brings in what you got on the other device (Pokémon, shinies...) without reloading.',
        'Jugar en dos aparatos (PC y móvil) ya no hace perder monedas ni tickets: antes, si uno tenía la partida abierta con datos viejos y guardaba, borraba lo ganado en el otro. Ahora se suma lo de los dos. Y al volver al juego tras un rato fuera, se trae lo conseguido en el otro aparato (Pokémon, shinies...) sin recargar.'
      ],
      [
        'Big in-game announcements (a nearby Gholdengo, a swarm...) are always centered now.',
        'Los avisos grandes de la partida (un Gholdengo cerca, una marea...) ya salen siempre centrados.'
      ]
    ]
  },
  {
    d: '2026-10-13',
    title: ['The Judgment of Arceus', 'La Sentencia de Arceus'],
    new: [
      [
        'The Judgment of Arceus: at minute 30, Arceus descends from the sky and takes you to the Ruins of Judgment. It is invincible, chases you faster and faster and casts pillars of light, beams and shockwaves; if it touches you, you lose almost half your HP. Every 5 seconds a legendary joins, each with twice the HP and damage of the previous one. How long can you last?',
        'La Sentencia de Arceus: al llegar al minuto 30, Arceus baja del cielo y te lleva a las Ruinas del Juicio. Es invencible, te persigue cada vez más deprisa y lanza pilares de luz, rayos y ondas; si te toca, te quita casi media vida. Cada 5 segundos acude un legendario con el doble de vida y de daño que el anterior. ¿Cuánto aguantarás?'
      ],
      [
        'Three new achievements: The Judgment (reach minute 30), Before the Creator (survive 1 minute against Arceus) and Divine challenge (defeat 3 legendaries against Arceus in a single run).',
        'Tres logros nuevos: La Sentencia (llega al minuto 30), Ante el Creador (aguanta 1 minuto ante Arceus) y Desafío divino (derrota a 3 legendarios ante Arceus en una partida).'
      ],
      ['New music for the fight against Arceus.', 'Música nueva para la pelea contra Arceus.'],
      [
        'A button to report suspicious records on the leaderboard (the little flag on each row).',
        'Botón para reportar marcas sospechosas en el ranking (la banderita de cada fila).'
      ]
    ],
    chg: [
      [
        'The all-time leaderboard starts from scratch: now that runs end against Arceus, older records could no longer be reached. The daily, weekly and monthly boards are unchanged.',
        'El ranking histórico empieza de cero: ahora que las partidas acaban ante Arceus, las marcas de antes ya no se podrían alcanzar. Las tablas de hoy, de la semana y del mes siguen igual.'
      ],
      [
        'Overtime from minute 60 is removed (runs no longer get that far).',
        'Se quita el tiempo extra del minuto 60 (ya no se llega hasta ahí).'
      ],
      [
        'Rifts no longer open from minute 28 on, so the Judgment does not catch you inside one.',
        'Desde el minuto 28 ya no se abren grietas, para que la Sentencia no te pille dentro de una.'
      ],
      [
        'Leaderboard protected against cheating: the server checks that every record was really played. You never lose anything you earn by playing.',
        'Ranking protegido contra trampas: el servidor comprueba que cada marca se ha jugado de verdad. Nunca se pierde nada de lo que ganas jugando.'
      ],
      [
        'Records over 35 minutes have been removed from the leaderboard: with the Judgment of Arceus they are no longer possible.',
        'Se han quitado del ranking las marcas de más de 35 minutos: con la Sentencia de Arceus ya no son posibles.'
      ]
    ],
    fix: [
      [
        'Gacha pulls, new Pokémon and rewards are saved to the cloud right away. If you opened the game on another device or browser and something was missing, open it again where you got it: it comes back on its own.',
        'Las tiradas del gacha, los Pokémon nuevos y los premios se guardan en la nube al momento. Si abriste el juego en otro aparato o navegador y te faltaba algo, vuelve a abrirlo donde lo conseguiste: se recupera solo.'
      ]
    ]
  },
  {
    d: '2026-10-12',
    title: ['Overtime and less random rifts', 'Tiempo extra y grietas con menos azar'],
    new: [
      [
        'Overtime: from minute 60 on, wild Pokémon keep getting stronger (more HP and more damage), faster and faster. Before, with maxed upgrades, some runs never ended; now the best ones will last about an hour and a half.',
        'Tiempo extra: desde el minuto 60 los Pokémon salvajes se vuelven cada vez más fuertes (más vida y más daño), y cada vez más deprisa. Antes, con las mejoras al máximo, algunas partidas no acababan nunca; ahora las mejores rondarán la hora y media.'
      ],
      [
        'The game now updates itself when a new version is out: within 5 seconds if you are in the menu, or after your run if you are playing (without losing anything).',
        'El juego se actualiza solo cuando sale una versión nueva: si estás en el menú, a los 5 segundos; si estás jugando, al acabar la partida (sin perder nada).'
      ],
      [
        'A "What\'s new" button (this window) with every change to the game.',
        'Botón de Novedades (esta ventana) con todos los cambios del juego.'
      ],
      ['Easier to read numbers: 2, 5 and 8 no longer look alike.', 'Números más fáciles de leer: el 2, el 5 y el 8 ya no se confunden.'],
      [
        'Pick the normal or shiny version of your partner right from the main menu, under it.',
        'Elige la versión normal o shiny de tu compañero desde el menú principal, debajo de él.'
      ],
      [
        'New upgrades for each Pokémon: Critical Hit (+3% critical chance per level, crits deal x1.5 damage), Card reroll (+1 level-up card reroll per run) and Ban (block moves so they never show up in your cards; pick them in Upgrades).',
        'Mejoras nuevas para cada Pokémon: Golpe Crítico (+3 % de críticos por nivel, que hacen x1,5 de daño), Cambio de cartas (+1 cambio de las cartas de nivel por run) y Veto (bloquea movimientos para que no te salgan en las cartas; se eligen en Mejoras).'
      ],
      [
        'Move shortcuts (in Upgrades, for each Pokémon): choose which move always goes in each slot, for example Confusion always on 1, for muscle memory.',
        'Atajos de movimientos (en Mejoras, para cada Pokémon): elige qué movimiento va siempre en cada hueco, por ejemplo Confusión siempre en el 1, para la memoria muscular.'
      ]
    ],
    chg: [
      [
        'Rock Slide deals less damage (21 instead of 26): it defeated almost twice as many as the average move.',
        'Avalancha hace menos daño (21 en vez de 26): derrotaba casi el doble que la media de los movimientos.'
      ],
      [
        'Level-up card rerolls are no longer earned by defeating bosses: you get 1 free per run and can buy more in Upgrades.',
        'Los cambios de cartas de nivel ya no se ganan venciendo jefes: tienes 1 gratis por run y el resto se compra en Mejoras.'
      ],
      [
        'Rift legendaries no longer always drop x10 tickets: they drop one half of the time (they used to always drop 2, which was too many).',
        'Los legendarios de grieta ya no dan siempre tickets x10: dan uno la mitad de las veces (antes daban 2 siempre y salían demasiados).'
      ],
      [
        'Co-op: if your networks cannot connect to each other, the room says so and keeps retrying, instead of playing laggy through a slow server.',
        'Cooperativo: si vuestras redes no consiguen conectar entre sí, la sala lo avisa y lo reintenta sola, en vez de jugar a tirones por un servidor lento.'
      ],
      [
        'We moved to new servers so the game can stay free: you may need to sign in again (with the same account and password, or with Google). Your save and your Pokémon are unchanged.',
        'Hemos cambiado de servidores para que el juego siga siendo gratis: puede que tengas que volver a iniciar sesión (con la misma cuenta y contraseña, o con Google). Tu partida y tus Pokémon siguen igual.'
      ],
      [
        'Gacha: shinies no longer come out as duplicates. If you roll one you already have, you get another of the same rarity that you are missing.',
        'Gacha: los shiny ya no salen repetidos. Si te toca uno que ya tienes, sale otro de la misma rareza que te falte.'
      ],
      [
        'Less random rifts: every time one does not show up, the next one is more likely (at most 2.5 minutes without a rift).',
        'Grietas con menos azar: cada vez que no sale una, la siguiente es más probable (como mucho 2,5 minutos sin grieta).'
      ],
      [
        'Legendaries you have not beaten yet show up 4 times as often in rifts.',
        'Los legendarios que aún no has vencido salen 4 veces más en las grietas.'
      ],
      [
        'Healers heal more the harder you hit, but with diminishing returns and a cap (2.5x at most).',
        'Los curanderos curan más cuanto más fuerte pegas, pero cada vez menos y con un tope (como mucho el 2,5x).'
      ],
      [
        'Stronger melee attacks: while one is active you take 25% less damage, and they reach 25% further and deal 20% more damage.',
        'Ataques cuerpo a cuerpo más fuertes: mientras llevas uno activo recibes un 25 % menos de daño, llegan un 25 % más lejos y hacen un 20 % más de daño.'
      ],
      [
        'Co-op: choosing which held item to keep now pauses the run for everyone (it used to keep going and you got hit while choosing).',
        'Cooperativo: al elegir con qué objeto quedarte, la partida se para para todos (antes seguía y te pegaban mientras elegías).'
      ],
      [
        'Co-op: while someone is choosing a fusion, the run pauses for everyone.',
        'Cooperativo: mientras alguien elige una fusión, la partida se para para todos.'
      ],
      [
        'Co-op: if the host switches tabs or their game stalls, the run pauses for everyone until they are back.',
        'Cooperativo: si el anfitrión cambia de pestaña o se le para el juego, la partida se pausa para todos hasta que vuelva.'
      ],
      ['Runs shorter than 1 minute no longer count for the leaderboard.', 'Las runs de menos de 1 minuto ya no cuentan para el ranking.']
    ],
    fix: [
      [
        'Removed broken records from the leaderboard caused by the minute 84 bug (the clock kept running while the game was frozen) and a few impossible ones. If you had one, your next run counts again.',
        'Quitadas del ranking las marcas rotas por el fallo del minuto 84 (el reloj seguía corriendo con el juego parado) y alguna imposible. Si tenías una, tu próxima partida vuelve a contar.'
      ],
      [
        'iPhone (Safari and Chrome): sometimes you could not switch moves by tapping the icons, especially with your other finger on the joystick. Buttons also sit above the home bar now.',
        'iPhone (Safari y Chrome): a veces no se podía cambiar de movimiento tocando los iconos, sobre todo con el otro dedo en el joystick. Además los botones quedan por encima de la barra de inicio.'
      ],
      [
        'In runs longer than 84 minutes the screen went black, the game froze or you kept levelling up forever. Now you can play for as long as you survive.',
        'En las partidas de más de 84 minutos la pantalla se quedaba en negro, el juego se paraba o empezabas a subir de nivel sin fin. Ya puedes jugar todo lo que aguantes.'
      ],
      [
        'If the game ever crashes, the run ends by itself and is saved (time, defeated, records and leaderboard) instead of being lost.',
        'Si el juego fallara, la partida se cierra sola y se guarda (tiempo, derrotados, récords y ranking) en vez de perderse.'
      ],
      [
        'Very long runs were sometimes flagged as cheating and did not count for the leaderboard.',
        'Las partidas muy largas a veces se tomaban por trampas y no contaban para el ranking.'
      ],
      [
        'Co-op: if the host switched tabs, enemies stood still and everyone else got a free advantage.',
        'Cooperativo: si el anfitrión cambiaba de pestaña, los enemigos se quedaban quietos y los demás jugaban con ventaja.'
      ],
      [
        'iPhone: holding your finger on the joystick brought up "Copy / Select all".',
        'iPhone: mantener el dedo en el joystick sacaba "Copiar / Seleccionar todo".'
      ],
      [
        'iPhone: fullscreen sometimes did not show up. Now the button explains how to get it (Share and "Add to Home Screen").',
        'iPhone: a veces no salía la pantalla completa. Ahora el botón explica cómo tenerla (Compartir y "Añadir a pantalla de inicio").'
      ]
    ]
  },
  {
    d: '2026-10-11',
    title: ['Bonds', 'Vínculos'],
    new: [
      [
        'Bonds: defeating a legendary lets you fuse moves that fire at the same time from a single slot (up to 4).',
        'Vínculos: al vencer a un legendario fusionas movimientos que se lanzan a la vez desde un solo hueco (hasta 4).'
      ],
      ['A button to reroll the level-up cards.', 'Botón para cambiar las cartas de subir de nivel.']
    ],
    chg: [
      ['More rifts.', 'Más grietas.'],
      ['Weaker psychic moves and healers.', 'Movimientos psíquicos y curanderos más flojos.'],
      [
        'Level-up card upgrades (speed, cooldown, experience, magnet, armor and power) can only be taken a limited number of times.',
        'Las mejoras de las cartas de nivel (velocidad, recarga, experiencia, imán, coraza y potencia) tienen un tope de veces.'
      ],
      [
        'On mobile, the Pokémon details show alongside; logging in is faster and the x10 gacha can be closed.',
        'En el móvil, la ficha del Pokémon sale al lado; entrar es más rápido y el gacha x10 se puede cerrar.'
      ]
    ],
    fix: [
      [
        'Black screen in runs longer than an hour because image memory filled up.',
        'Pantalla negra en partidas de más de una hora por llenarse la memoria de imágenes.'
      ],
      [
        'Tickets were lost if the tab closed before the run ended: now they are saved as soon as you pick them up.',
        'Los tickets se perdían si se cerraba la pestaña antes de acabar la partida: ahora se guardan al cogerlos.'
      ],
      [
        'An upgrade bought right after saving was charged but not applied.',
        'Una mejora comprada justo después de guardar se cobraba y no se apuntaba.'
      ],
      [
        'The game froze forever if something went wrong mid-run.',
        'El juego se quedaba congelado para siempre si algo fallaba a mitad de partida.'
      ]
    ]
  },
  {
    d: '2026-10-10',
    title: ['More challenge', 'Más reto'],
    new: [
      [
        'Bosses and legendaries with 4 telegraphed attacks that get enraged at half health.',
        'Jefes y legendarios con 4 ataques avisados que se enfurecen a media vida.'
      ],
      [
        '12 new moves and 8 new ways to attack: boomerang, chain, mines, meteors, turret, dash, trail and spray.',
        '12 movimientos nuevos y 8 formas de atacar nuevas: bumerán, cadena, minas, meteoros, torreta, embestida, rastro y abanico.'
      ],
      [
        'Mid-run events (single-type hordes, golden hour, lost Pokémon) and Meowth and Gholdengo running away loaded with coins.',
        'Eventos a mitad de partida (hordas de un tipo, hora dorada, Pokémon perdidos) y Meowth y Gholdengo que huyen cargados de monedas.'
      ],
      ['Statues for big Pokémon.', 'Estatuas para los Pokémon grandes.']
    ],
    chg: [
      ['Harder: fewer but tougher enemies.', 'Más difícil: menos enemigos pero más duros.'],
      [
        'Levelling up is slower, tickets are rarer and bosses drop a x10 ticket one time in three.',
        'Subir de nivel es más lento, los tickets son más raros y los jefes dan ticket x10 una de cada tres veces.'
      ],
      ['Faster loading.', 'Carga más rápida.']
    ],
    fix: [
      [
        'Straggling enemies vanished in front of you: now only off-screen.',
        'Los enemigos rezagados desaparecían delante de ti: ahora sólo fuera de la vista.'
      ],
      ['Menus and screens overlapped the top bar.', 'Los menús y pantallas se montaban encima de la barra de arriba.']
    ]
  },
  {
    d: '2026-10-09',
    title: ['Mobile and English', 'Móvil e inglés'],
    new: [
      [
        'Play on phones and tablets with a touch joystick, and install it as an app.',
        'Se puede jugar en móvil y tablet con joystick táctil, e instalar como app.'
      ],
      ['The game in English and Spanish.', 'El juego, en español y en inglés.'],
      ['Settings screen with automatic graphics quality.', 'Pantalla de ajustes con calidad gráfica automática.']
    ],
    chg: [
      ['Fewer but stronger enemies on screen.', 'Menos enemigos en pantalla pero más fuertes.'],
      ['Giga Drain becomes Grass Knot (no more healing).', 'Gigadrenado pasa a ser Hierba Lazo (ya no cura).']
    ]
  },
  {
    d: '2026-10-08',
    title: ['Missions, rifts and co-op', 'Misiones, grietas y cooperativo'],
    new: [
      [
        'Daily and weekly missions, achievements with medals and titles, and a public profile.',
        'Misiones diarias y semanales, logros con medallas y títulos, y perfil público.'
      ],
      [
        'Held items, move evolutions and enemies that heal, shield, summon or explode.',
        'Objetos equipables, evoluciones de movimientos y enemigos que curan, protegen, invocan o explotan.'
      ],
      [
        'Rifts leading to 18 legendary arenas, one per type, and weather that changes the fight.',
        'Grietas que llevan a 18 arenas legendarias, una por tipo, y clima que cambia la batalla.'
      ],
      ['Co-op with your friends list and leaderboards.', 'Cooperativo con tu lista de amigos y ranking.'],
      [
        'Upgrades for each Pokémon, a slot-machine ticket gacha and a type chart.',
        'Mejoras para cada Pokémon, gacha tragaperras con tickets y tabla de tipos.'
      ]
    ],
    chg: [['Camera further out and enemies that walk around obstacles.', 'Cámara más lejos y enemigos que rodean los obstáculos.']]
  },
  {
    d: '2026-10-07',
    title: ['First version', 'Primera versión'],
    new: [['First public version of PokéSurvivor.', 'Primera versión pública de PokéSurvivor.']]
  }
];
