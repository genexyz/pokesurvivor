/* ============ moves.js — move catalog ============
 *
 * kind (behavior, implemented in systems/combat.js):
 *   projectile  fires `count` projectiles at the nearest enemy
 *   melee       arc strike around the Pokémon
 *   beam        straight beam that pierces everything it hits
 *   orbit       orbs that spin around while the move is active
 *   nova        radial burst in every direction
 *   aura        circle of continuous damage around you
 *   buff        powers up the Pokémon itself (stackable, expires)
 *   ---- since 2026-10-10 (same graphics, different playstyle) ----
 *   boomerang   flies to the enemy and back to you, hitting both ways
 *   chain       hits one and jumps to the next `count` nearest ones
 *   mine        mines on the ground that explode when stepped on
 *   meteor      `count` meteors fall on nearby enemies (the shadow warns)
 *   turret      leaves something that fires on its own for `dur` seconds
 *   dash        you cross toward the enemy hitting everything on the way (taking no damage)
 *   trail       you leave pools that damage whatever steps on them
 *   cone        many short shots in a fan (breath, jet...)
 *
 * Only the ACTIVE move runs. Switch with 1-4 / Q / E.
 *
 * The icon is not stored here: G.Icons composes it (type emblem +
 * family badge), see ui/icons.js.
 *
 * Upgrades (lvl 1 -> 5) come from a shared ladder per `kind`:
 *   multiplicative mods -> dmg, cd, speed, radius, dur, amount, arc
 *   additive mods       -> count, pierce, stacks
 */
(() => {
  const LADDERS = {
    projectile: [
      { t: '+1 projectile', m: { count: 1, spread: 1.4 } },
      { t: '+45% damage', m: { dmg: 1.45 } },
      { t: '-25% cooldown', m: { cd: 0.75 } },
      { t: '+1 projectile and +1 pierce', m: { count: 1, pierce: 1, spread: 1.2 } }
    ],
    melee: [
      { t: '+40% damage', m: { dmg: 1.4 } },
      { t: '+25% range', m: { radius: 1.25 } },
      { t: '-25% cooldown', m: { cd: 0.75 } },
      { t: 'Hits in 360° and +50% damage', m: { arc: 9, dmg: 1.5 } }
    ],
    beam: [
      { t: '+45% damage', m: { dmg: 1.45 } },
      { t: '+30% range and width', m: { radius: 1.3, width: 1.3 } },
      { t: '-25% cooldown', m: { cd: 0.75 } },
      { t: '+50% damage', m: { dmg: 1.5 } }
    ],
    orbit: [
      { t: '+1 orb', m: { count: 1 } },
      { t: '+55% damage', m: { dmg: 1.55 } },
      { t: '+25% radius and spins faster', m: { radius: 1.25, speed: 1.35 } },
      { t: '+1 orb and +55% damage', m: { count: 1, dmg: 1.55 } }
    ],
    nova: [
      { t: '+4 projectiles', m: { count: 4 } },
      { t: '+40% damage', m: { dmg: 1.4 } },
      { t: '-25% cooldown', m: { cd: 0.75 } },
      { t: '+4 projectiles and +1 pierce', m: { count: 4, pierce: 1 } }
    ],
    aura: [
      { t: '+30% radius', m: { radius: 1.3 } },
      { t: '+45% damage', m: { dmg: 1.45 } },
      { t: 'Hits 40% more often', m: { cd: 0.7 } },
      { t: '+30% radius and +50% damage', m: { radius: 1.3, dmg: 1.5 } }
    ],
    boomerang: [
      { t: '+1 boomerang', m: { count: 1 } },
      { t: '+45% damage', m: { dmg: 1.45 } },
      { t: '+30% range', m: { radius: 1.3 } },
      { t: '+1 boomerang and +40% damage', m: { count: 1, dmg: 1.4 } }
    ],
    chain: [
      { t: '+2 jumps', m: { count: 2 } },
      { t: '+45% damage', m: { dmg: 1.45 } },
      { t: '-25% cooldown', m: { cd: 0.75 } },
      { t: '+2 jumps and +40% damage', m: { count: 2, dmg: 1.4 } }
    ],
    mine: [
      { t: '+1 mine', m: { count: 1 } },
      { t: '+50% damage', m: { dmg: 1.5 } },
      { t: '+30% blast radius', m: { radius: 1.3 } },
      { t: '+1 mine and -25% cooldown', m: { count: 1, cd: 0.75 } }
    ],
    meteor: [
      { t: '+1 meteor', m: { count: 1 } },
      { t: '+45% damage', m: { dmg: 1.45 } },
      { t: '+30% radius', m: { radius: 1.3 } },
      { t: '+2 meteors and -20% cooldown', m: { count: 2, cd: 0.8 } }
    ],
    turret: [
      { t: '+50% damage', m: { dmg: 1.5 } },
      { t: 'Fires 35% faster', m: { rate: 0.74 } },
      { t: '+1 at a time', m: { count: 1 } },
      { t: '+50% duration and +40% damage', m: { dur: 1.5, dmg: 1.4 } }
    ],
    dash: [
      { t: '+40% damage', m: { dmg: 1.4 } },
      { t: '+30% distance', m: { radius: 1.3 } },
      { t: '-25% cooldown', m: { cd: 0.75 } },
      { t: '+60% damage and wider', m: { dmg: 1.6, width: 1.4 } }
    ],
    trail: [
      { t: '+40% damage', m: { dmg: 1.4 } },
      { t: '+40% duration', m: { dur: 1.4 } },
      { t: 'Pools 30% bigger', m: { radius: 1.3 } },
      { t: '+50% damage and +30% radius', m: { dmg: 1.5, radius: 1.3 } }
    ],
    cone: [
      { t: '+3 shots', m: { count: 3 } },
      { t: '+40% damage', m: { dmg: 1.4 } },
      { t: '+30% range', m: { life: 1.3 } },
      { t: '+3 shots and +1 pierce', m: { count: 3, pierce: 1 } }
    ],
    buff: [
      { t: '+1 max stack', m: { stacks: 1 } },
      { t: '+40% power', m: { amount: 1.4 } },
      { t: '+50% duration', m: { dur: 1.5 } },
      { t: '+1 stack and +40% power', m: { stacks: 1, amount: 1.4 } }
    ]
  };

  const RAW = [
    // ---------------- NORMAL (pool shared by everyone) ----------------
    {
      id: 'tackle',
      name: 'Tackle',
      type: 'normal',
      kind: 'melee',
      desc: 'Charges in an arc at everything in front of you.',
      cd: 0.5,
      dmg: 13,
      radius: 48,
      arc: 1.7,
      knock: 90
    },

    {
      id: 'quick-attack',
      name: 'Quick Attack',
      type: 'normal',
      kind: 'dash',
      desc: 'You dash at the enemy like lightning and hit everything on the way.',
      cd: 0.75,
      dmg: 20,
      radius: 110,
      width: 34,
      knock: 40
    },

    {
      id: 'swords-dance',
      name: 'Swords Dance',
      type: 'normal',
      kind: 'buff',
      desc: 'Deals no damage: builds ATTACK while active.',
      cd: 0.85,
      stat: 'atk',
      amount: 0.13,
      dur: 7,
      stacks: 5
    },

    {
      id: 'agility',
      name: 'Agility',
      type: 'normal',
      kind: 'buff',
      desc: 'Deals no damage: builds SPEED while active.',
      cd: 0.85,
      stat: 'spd',
      amount: 0.1,
      dur: 7,
      stacks: 5
    },

    {
      id: 'harden',
      name: 'Harden',
      type: 'normal',
      kind: 'buff',
      desc: 'Deals no damage: builds DEFENSE while active.',
      cd: 0.85,
      stat: 'def',
      amount: 0.07,
      dur: 7,
      stacks: 5
    },

    // ---------------- FIRE ----------------
    {
      id: 'ember',
      name: 'Ember',
      type: 'fire',
      kind: 'projectile',
      desc: 'A fireball at the nearest enemy.',
      cd: 0.52,
      dmg: 18,
      speed: 310,
      count: 1,
      spread: 0.12,
      pierce: 0,
      life: 1.6,
      size: 7,
      burn: 1
    },

    {
      id: 'flamethrower',
      name: 'Flamethrower',
      type: 'fire',
      kind: 'cone',
      desc: 'A short fan of flames that burns.',
      cd: 0.7,
      dmg: 7,
      count: 7,
      arc: 0.9,
      speed: 380,
      life: 0.42,
      size: 6,
      pierce: 1,
      burn: 1
    },

    {
      id: 'fire-spin',
      name: 'Fire Spin',
      type: 'fire',
      kind: 'orbit',
      desc: 'Flames that spin around you. Constant defense.',
      cd: 0.3,
      dmg: 14,
      count: 3,
      radius: 62,
      speed: 2.4,
      size: 9,
      burn: 1
    },

    {
      id: 'heat-wave',
      name: 'Heat Wave',
      type: 'fire',
      kind: 'nova',
      desc: 'Explodes in flames in every direction.',
      cd: 1.25,
      dmg: 13,
      speed: 250,
      count: 10,
      pierce: 1,
      life: 1.1,
      size: 7,
      burn: 1
    },

    // ---------------- WATER ----------------
    {
      id: 'water-gun',
      name: 'Water Gun',
      type: 'water',
      kind: 'projectile',
      desc: 'A piercing jet. Reliable at any range.',
      cd: 0.44,
      dmg: 14,
      speed: 350,
      count: 1,
      spread: 0.1,
      pierce: 1,
      life: 1.5,
      size: 6
    },

    {
      id: 'bubble',
      name: 'Bubble',
      type: 'water',
      kind: 'nova',
      desc: 'A fan of bubbles that slows whatever they touch.',
      cd: 1.0,
      dmg: 9,
      speed: 210,
      count: 8,
      pierce: 0,
      life: 1.3,
      size: 8,
      slow: 0.45
    },

    {
      id: 'hydro-pump',
      name: 'Hydro Pump',
      type: 'water',
      kind: 'beam',
      desc: 'A slow but devastating water blast.',
      cd: 1.5,
      dmg: 29,
      radius: 250,
      width: 30
    },

    {
      id: 'aqua-ring',
      name: 'Aqua Ring',
      type: 'water',
      kind: 'buff',
      desc: 'Deals no damage: builds health REGENERATION.',
      cd: 0.9,
      stat: 'regen',
      amount: 1.6,
      dur: 8,
      stacks: 4
    },

    // ---------------- GRASS ----------------
    {
      id: 'vine-whip',
      name: 'Vine Whip',
      type: 'grass',
      kind: 'melee',
      desc: 'Long-range whips in a wide arc.',
      cd: 0.62,
      dmg: 16,
      radius: 68,
      arc: 1.3,
      knock: 60
    },

    {
      id: 'razor-leaf',
      name: 'Razor Leaf',
      type: 'grass',
      kind: 'boomerang',
      desc: 'Two leaves that fly out and back, cutting both ways.',
      cd: 0.9,
      dmg: 10,
      speed: 330,
      count: 2,
      spread: 0.5,
      radius: 210,
      size: 6
    },

    {
      id: 'leaf-storm',
      name: 'Petal Blizzard',
      type: 'grass',
      kind: 'orbit',
      desc: 'A cyclone of leaves spins widely around you.',
      cd: 0.26,
      dmg: 14,
      count: 4,
      radius: 74,
      speed: 2.6,
      size: 8
    },

    // (Formerly Giga Drain: healed on every hit and was broken. Same id so saves don't break.)
    {
      id: 'giga-drain',
      name: 'Grass Knot',
      type: 'grass',
      kind: 'aura',
      desc: 'Roots that snare and pound everything near you.',
      cd: 0.55,
      dmg: 9,
      radius: 76
    },

    // ---------------- ELECTRIC ----------------
    {
      id: 'thunder-shock',
      name: 'Thunder Shock',
      type: 'electric',
      kind: 'projectile',
      desc: 'A lightning-fast bolt that pierces several enemies.',
      cd: 0.4,
      dmg: 13,
      speed: 480,
      count: 1,
      spread: 0.08,
      pierce: 2,
      life: 1.1,
      size: 5
    },

    {
      id: 'discharge',
      name: 'Discharge',
      type: 'electric',
      kind: 'aura',
      desc: 'A permanent electric field around you.',
      cd: 0.45,
      dmg: 8,
      radius: 70
    },

    {
      id: 'thunderbolt',
      name: 'Thunderbolt',
      type: 'electric',
      kind: 'chain',
      desc: 'A bolt that jumps from one enemy to the next.',
      cd: 0.95,
      dmg: 21,
      count: 4,
      radius: 140
    },

    // ---------------- PSYCHIC ----------------
    // (11-10-2026: -22/-30 % damage and less homing; they were flooding the leaderboard.)
    {
      id: 'confusion',
      name: 'Confusion',
      type: 'psychic',
      kind: 'projectile',
      desc: 'A wave that homes in on its target.',
      cd: 0.58,
      dmg: 13,
      speed: 280,
      count: 1,
      spread: 0.1,
      pierce: 0,
      life: 2.2,
      size: 8,
      homing: 2.0
    },

    {
      id: 'psybeam',
      name: 'Psybeam',
      type: 'psychic',
      kind: 'beam',
      desc: 'A wide, heavy-hitting psychic beam.',
      cd: 1.15,
      dmg: 17,
      radius: 215,
      width: 40
    },

    {
      id: 'psychic',
      name: 'Psychic',
      type: 'psychic',
      kind: 'nova',
      desc: 'A radial mental burst that seeks enemies.',
      cd: 1.35,
      dmg: 10,
      speed: 230,
      count: 12,
      pierce: 1,
      life: 1.6,
      size: 7,
      homing: 1.0
    },

    // ---------------- SECONDARY TYPES ----------------
    {
      id: 'sludge',
      name: 'Sludge',
      type: 'poison',
      kind: 'projectile',
      desc: 'Toxic sludge that poisons on impact.',
      cd: 0.6,
      dmg: 17,
      speed: 290,
      count: 1,
      spread: 0.12,
      pierce: 0,
      life: 1.5,
      size: 8,
      poison: 1
    },

    {
      id: 'mud-shot',
      name: 'Mud Shot',
      type: 'ground',
      kind: 'nova',
      desc: 'Splashes mud around and slows foes.',
      cd: 1.1,
      dmg: 11,
      speed: 200,
      count: 7,
      pierce: 0,
      life: 1.0,
      size: 9,
      slow: 0.4
    },

    {
      id: 'gust',
      name: 'Gust',
      type: 'flying',
      kind: 'orbit',
      desc: 'Whirlwinds that escort you.',
      cd: 0.26,
      dmg: 13,
      count: 3,
      radius: 72,
      speed: 2.8,
      size: 8,
      knock: 40
    },

    {
      id: 'wing-attack',
      name: 'Wing Attack',
      type: 'flying',
      kind: 'melee',
      desc: 'A wide wing sweep that pushes foes back.',
      cd: 0.55,
      dmg: 14,
      radius: 58,
      arc: 1.9,
      knock: 70
    },

    // ---------------- NORMAL (extra) ----------------
    {
      id: 'body-slam',
      name: 'Body Slam',
      type: 'normal',
      kind: 'melee',
      desc: 'A full-weight tackle: slow, short and brutal.',
      cd: 0.95,
      dmg: 30,
      radius: 46,
      arc: 2.2,
      knock: 140
    },

    {
      id: 'hyper-voice',
      name: 'Hyper Voice',
      type: 'normal',
      kind: 'nova',
      desc: 'A sound wave that spreads in every direction.',
      cd: 1.15,
      dmg: 12,
      speed: 260,
      count: 9,
      pierce: 1,
      life: 0.9,
      size: 7
    },

    // ---------------- POISON (extra) ----------------
    {
      id: 'poison-sting',
      name: 'Poison Sting',
      type: 'poison',
      kind: 'projectile',
      desc: 'A quick poisonous sting.',
      cd: 0.34,
      dmg: 8,
      speed: 420,
      count: 1,
      spread: 0.08,
      pierce: 0,
      life: 1.0,
      size: 4,
      poison: 1
    },

    {
      id: 'toxic',
      name: 'Toxic',
      type: 'poison',
      kind: 'trail',
      desc: 'You leave pools of poison that badly poison whoever steps on them.',
      cd: 0.3,
      dmg: 6,
      radius: 26,
      dur: 3,
      poison: 1
    },

    // ---------------- GROUND (extra) ----------------
    {
      id: 'bulldoze',
      name: 'Bulldoze',
      type: 'ground',
      kind: 'aura',
      desc: 'Shakes the ground: damages and slows everything nearby.',
      cd: 0.7,
      dmg: 11,
      radius: 80,
      slow: 0.35
    },

    // ---------------- BUG ----------------
    {
      id: 'bug-bite',
      name: 'Bug Bite',
      type: 'bug',
      kind: 'melee',
      desc: 'A quick bite in a short arc.',
      cd: 0.42,
      dmg: 11,
      radius: 44,
      arc: 1.6,
      knock: 40
    },

    {
      id: 'string-shot',
      name: 'String Shot',
      type: 'bug',
      kind: 'mine',
      desc: 'Leaves webs on the ground that trap and greatly slow whoever steps on them.',
      cd: 1.1,
      dmg: 14,
      count: 2,
      radius: 56,
      dur: 7,
      slow: 0.6
    },

    {
      id: 'bug-buzz',
      name: 'Bug Buzz',
      type: 'bug',
      kind: 'aura',
      desc: 'A constant vibration that pounds everything nearby.',
      cd: 0.45,
      dmg: 8,
      radius: 66
    },

    // ---------------- ROCK ----------------
    {
      id: 'rock-throw',
      name: 'Rock Throw',
      type: 'rock',
      kind: 'projectile',
      desc: 'A heavy boulder that pushes the enemy back.',
      cd: 0.7,
      dmg: 24,
      speed: 260,
      count: 1,
      spread: 0.12,
      pierce: 0,
      life: 1.4,
      size: 9,
      knock: 90
    },

    {
      id: 'rock-slide',
      name: 'Rock Slide',
      type: 'rock',
      kind: 'meteor',
      desc: 'Rocks fall from the sky onto nearby enemies.',
      cd: 1.3,
      dmg: 21,
      count: 3,
      radius: 46,
      knock: 50
    }, // (12-10-2026: was 26; killed twice the average)

    // ---------------- ICE ----------------
    {
      id: 'ice-beam',
      name: 'Ice Beam',
      type: 'ice',
      kind: 'beam',
      desc: 'An icy beam that almost freezes foes solid.',
      cd: 1.1,
      dmg: 20,
      radius: 220,
      width: 30,
      slow: 0.7
    },

    {
      id: 'powder-snow',
      name: 'Powder Snow',
      type: 'ice',
      kind: 'aura',
      desc: 'A blizzard around you that slows foes.',
      cd: 0.55,
      dmg: 8,
      radius: 76,
      slow: 0.45
    },

    // ---------------- FIGHTING ----------------
    {
      id: 'karate-chop',
      name: 'Karate Chop',
      type: 'fighting',
      kind: 'melee',
      desc: 'A sharp, powerful blow straight ahead.',
      cd: 0.5,
      dmg: 18,
      radius: 50,
      arc: 1.2,
      knock: 110
    },

    {
      id: 'aura-sphere',
      name: 'Aura Sphere',
      type: 'fighting',
      kind: 'projectile',
      desc: 'An energy sphere that never misses.',
      cd: 0.62,
      dmg: 17,
      speed: 300,
      count: 1,
      spread: 0.1,
      pierce: 0,
      life: 2.0,
      size: 8,
      homing: 4
    },

    // ---------------- GHOST ----------------
    {
      id: 'lick',
      name: 'Lick',
      type: 'ghost',
      kind: 'melee',
      desc: 'A ghostly lick that briefly paralyzes.',
      cd: 0.48,
      dmg: 12,
      radius: 48,
      arc: 1.8,
      slow: 0.4
    },

    {
      id: 'shadow-ball',
      name: 'Shadow Ball',
      type: 'ghost',
      kind: 'projectile',
      desc: 'A shadowy orb that pierces several foes.',
      cd: 0.66,
      dmg: 19,
      speed: 280,
      count: 1,
      spread: 0.1,
      pierce: 2,
      life: 1.6,
      size: 9
    },

    // ---------------- DRAGON ----------------
    {
      id: 'dragon-rage',
      name: 'Dragon Rage',
      type: 'dragon',
      kind: 'beam',
      desc: 'Draconic flames in a straight line.',
      cd: 1.0,
      dmg: 24,
      radius: 230,
      width: 34
    },

    {
      id: 'dragon-dance',
      name: 'Dragon Dance',
      type: 'dragon',
      kind: 'buff',
      desc: 'Deals no damage: builds ATTACK faster than Swords Dance.',
      cd: 0.7,
      stat: 'atk',
      amount: 0.11,
      dur: 7,
      stacks: 5
    },

    // ---------------- FAIRY ----------------
    {
      id: 'fairy-wind',
      name: 'Fairy Wind',
      type: 'fairy',
      kind: 'nova',
      desc: 'A magical breeze in every direction.',
      cd: 1.0,
      dmg: 11,
      speed: 230,
      count: 10,
      pierce: 0,
      life: 1.2,
      size: 7
    },

    {
      id: 'dazzling-gleam',
      name: 'Dazzling Gleam',
      type: 'fairy',
      kind: 'aura',
      desc: 'A flash of light all around you.',
      cd: 0.5,
      dmg: 9,
      radius: 72
    },

    // ---------------- STEEL ----------------
    {
      id: 'metal-claw',
      name: 'Metal Claw',
      type: 'steel',
      kind: 'melee',
      desc: 'A steel swipe in an arc.',
      cd: 0.5,
      dmg: 15,
      radius: 50,
      arc: 1.6,
      knock: 60
    },

    {
      id: 'flash-cannon',
      name: 'Flash Cannon',
      type: 'steel',
      kind: 'beam',
      desc: 'A piercing beam of metallic light.',
      cd: 1.05,
      dmg: 23,
      radius: 220,
      width: 30
    },

    // ---------------- DARK ----------------
    {
      id: 'bite',
      name: 'Bite',
      type: 'dark',
      kind: 'melee',
      desc: 'A quick bite that knocks foes back.',
      cd: 0.45,
      dmg: 14,
      radius: 46,
      arc: 1.5,
      knock: 70
    },

    {
      id: 'dark-pulse',
      name: 'Dark Pulse',
      type: 'dark',
      kind: 'nova',
      desc: 'A wave of dark energy in every direction.',
      cd: 1.15,
      dmg: 14,
      speed: 240,
      count: 10,
      pierce: 1,
      life: 1.1,
      size: 8
    },

    {
      id: 'night-shade',
      name: 'Night Shade',
      type: 'dark',
      kind: 'aura',
      desc: 'A shadow surrounds you and consumes what is near.',
      cd: 0.5,
      dmg: 9,
      radius: 72
    },

    // ---------------- NEW (2026-10-10): same shapes, different mechanics ----------------
    {
      id: 'bonemerang',
      name: 'Bonemerang',
      type: 'ground',
      kind: 'boomerang',
      desc: 'A bone that flies out and back, hitting hard.',
      cd: 0.95,
      dmg: 16,
      speed: 300,
      count: 1,
      radius: 230,
      size: 8,
      knock: 40
    },

    {
      id: 'psycho-cut',
      name: 'Psycho Cut',
      type: 'psychic',
      kind: 'boomerang',
      desc: 'Psychic blades that come back to you.',
      cd: 0.8,
      dmg: 9,
      speed: 360,
      count: 2,
      spread: 0.6,
      radius: 200,
      size: 7
    },

    {
      id: 'spikes',
      name: 'Spikes',
      type: 'ground',
      kind: 'mine',
      desc: 'Scatters spikes that burst when stepped on.',
      cd: 1.2,
      dmg: 18,
      count: 2,
      radius: 60,
      dur: 8
    },

    {
      id: 'toxic-spikes',
      name: 'Toxic Spikes',
      type: 'poison',
      kind: 'mine',
      desc: 'Poison spikes that badly poison when they burst.',
      cd: 1.1,
      dmg: 11,
      count: 2,
      radius: 56,
      dur: 8,
      poison: 2
    },

    {
      id: 'hail',
      name: 'Hail',
      type: 'ice',
      kind: 'meteor',
      desc: 'Hailstones fall on enemies and slow them.',
      cd: 1.2,
      dmg: 18,
      count: 4,
      radius: 40,
      slow: 0.4
    },

    {
      id: 'meteor-mash',
      name: 'Meteor Mash',
      type: 'steel',
      kind: 'meteor',
      desc: 'Two steel meteors that crush where they land.',
      cd: 1.4,
      dmg: 34,
      count: 2,
      radius: 54,
      knock: 80
    },

    {
      id: 'will-o-wisp',
      name: 'Will-O-Wisp',
      type: 'fire',
      kind: 'turret',
      desc: 'Leaves a floating flame that fires on its own and burns.',
      cd: 3.5,
      dmg: 15,
      rate: 0.55,
      dur: 6,
      count: 1,
      range: 300,
      speed: 300,
      size: 7,
      burn: 1
    },

    {
      id: 'substitute',
      name: 'Substitute',
      type: 'normal',
      kind: 'turret',
      desc: 'A decoy that stays behind shooting for you.',
      cd: 4.0,
      dmg: 14,
      rate: 0.4,
      dur: 6,
      count: 1,
      range: 280,
      speed: 320,
      size: 6
    },

    {
      id: 'aerial-ace',
      name: 'Aerial Ace',
      type: 'flying',
      kind: 'dash',
      desc: 'You dive and slash everything you pass through.',
      cd: 0.75,
      dmg: 18,
      radius: 120,
      width: 40,
      knock: 60
    },

    {
      id: 'flame-wheel',
      name: 'Flame Wheel',
      type: 'fire',
      kind: 'trail',
      desc: 'You run wrapped in fire, leaving a trail of flames.',
      cd: 0.28,
      dmg: 10,
      radius: 28,
      dur: 2.6,
      burn: 1
    },

    {
      id: 'bubble-beam',
      name: 'Bubble Beam',
      type: 'water',
      kind: 'cone',
      desc: 'A short fan of bubbles that slows.',
      cd: 0.65,
      dmg: 6,
      count: 7,
      arc: 1.0,
      speed: 340,
      life: 0.45,
      size: 6,
      slow: 0.3
    },

    {
      id: 'hex',
      name: 'Hex',
      type: 'ghost',
      kind: 'chain',
      desc: 'A curse that jumps between enemies. Much more damage if they are burned, poisoned or slowed.',
      cd: 0.9,
      dmg: 17,
      count: 4,
      radius: 150,
      hex: 1.7
    }
  ];

  // Melee (12-10-2026): +20 % damage and +25 % range and arc
  // (and -25 % damage taken while it is your active attack, in player.js).
  // They hit hard, but you had to take far more risk than with ranged ones.
  for (const m of RAW) {
    if (m.kind !== 'melee') continue;
    m.dmg = Math.round(m.dmg * 1.2);
    m.radius = Math.round(m.radius * 1.25);
    if (m.arc) m.arc = Math.min(3, +(m.arc * 1.25).toFixed(2));
  }

  // Move pool per type. Everyone has the `normal` pool.
  const POOL = {};
  for (const m of RAW) (POOL[m.type] = POOL[m.type] || []).push(m.id);

  const BY_ID = {};
  for (const m of RAW) {
    m.ups = LADDERS[m.kind];
    m.maxLvl = m.ups.length + 1;
    BY_ID[m.id] = m;
  }

  /** Moves this Pokémon can learn (its types + normal). */
  function poolFor(mon) {
    const ids = new Set(POOL.normal);
    for (const t of mon.types) for (const id of POOL[t] || []) ids.add(id);
    return [...ids];
  }

  /**
   * Move instance in a run: the base numbers of `def` with every ladder
   * upgrade up to `lvl` already applied.
   */
  function instance(id, lvl = 1) {
    const def = BY_ID[id];
    const s = Object.assign({}, def, { id, def, lvl, t: 0 });
    delete s.ups;
    for (let i = 0; i < lvl - 1; i++) applyMods(s, def.ups[i].m);
    return s;
  }

  const MULT = ['dmg', 'cd', 'speed', 'radius', 'dur', 'amount', 'arc', 'width', 'spread', 'life', 'size', 'rate'];
  const ADD = ['count', 'pierce', 'stacks'];

  function applyMods(s, m) {
    for (const k in m) {
      if (MULT.includes(k) && s[k] != null) s[k] *= m[k];
      else if (ADD.includes(k)) s[k] = (s[k] || 0) + m[k];
      else s[k] = m[k];
    }
  }

  /** Levels up an existing instance. */
  function levelUp(s) {
    if (s.lvl >= s.def.maxLvl) return false;
    applyMods(s, s.def.ups[s.lvl - 1].m);
    s.lvl++;
    return true;
  }

  /** Text of the next upgrade, for the level-up card. */
  function nextUpText(s) {
    return s.lvl >= s.def.maxLvl ? null : s.def.ups[s.lvl - 1].t;
  }

  /** Starting move based on the main type (if the Pokémon has none of its own). */
  const START = {
    fire: 'ember',
    water: 'water-gun',
    grass: 'vine-whip',
    electric: 'thunder-shock',
    psychic: 'confusion',
    poison: 'sludge',
    ground: 'mud-shot',
    flying: 'gust',
    bug: 'bug-bite',
    rock: 'rock-throw',
    ice: 'ice-beam',
    fighting: 'karate-chop',
    ghost: 'shadow-ball',
    dragon: 'dragon-rage',
    fairy: 'fairy-wind',
    steel: 'metal-claw',
    dark: 'bite',
    normal: 'tackle'
  };
  function startFor(mon) {
    if (mon.start && BY_ID[mon.start]) return mon.start;
    for (const t of mon.types) if (START[t]) return START[t];
    return 'tackle';
  }

  // ---------------- move evolution ----------------
  /*
   * A move at MAX LEVEL evolves if during that run you have ever taken the
   * upgrade it requires (`needs`, an id from LevelUp.STATS). A golden card
   * shows up. Buffs do not evolve.
   */
  const NEED_NAME = {
    hp: 'Vigor',
    atk: 'Power',
    spd: 'Sprint',
    cd: 'Reflexes',
    def: 'Armor',
    rgn: 'Synthesis',
    mag: 'Magnet',
    xp: 'Learning'
  };
  const EVO = {
    tackle: ['Take Down', 'hp'],
    'quick-attack': ['Extreme Speed', 'spd'],
    'body-slam': ['Giga Impact', 'atk'],
    'hyper-voice': ['Uproar', 'cd'],
    ember: ['Fire Blast', 'atk'],
    flamethrower: ['Overheat', 'cd'],
    'fire-spin': ['Sacred Fire', 'rgn'],
    'heat-wave': ['Eruption', 'hp'],
    'water-gun': ['Scald', 'atk'],
    bubble: ['Surf', 'spd'],
    'hydro-pump': ['Hydro Cannon', 'atk'],
    'vine-whip': ['Power Whip', 'atk'],
    'razor-leaf': ['Leaf Storm', 'cd'],
    'leaf-storm': ['Petal Dance', 'rgn'],
    'giga-drain': ['Frenzy Plant', 'hp'],
    'thunder-shock': ['Thunder', 'atk'],
    discharge: ['Electric Terrain', 'def'],
    thunderbolt: ['Zap Cannon', 'cd'],
    confusion: ['Psyshock', 'cd'],
    psybeam: ['Future Sight', 'atk'],
    psychic: ['Expanding Force', 'mag'],
    sludge: ['Sludge Bomb', 'atk'],
    'poison-sting': ['Poison Jab', 'spd'],
    toxic: ['Poison Gas', 'rgn'],
    'mud-shot': ['Earth Power', 'atk'],
    bulldoze: ['Earthquake', 'atk'],
    gust: ['Hurricane', 'spd'],
    'wing-attack': ['Brave Bird', 'atk'],
    'bug-bite': ['X-Scissor', 'atk'],
    'string-shot': ['Sticky Web', 'cd'],
    'bug-buzz': ['Swarm', 'rgn'],
    'rock-throw': ['Stone Edge', 'atk'],
    'rock-slide': ['Stealth Rock', 'cd'],
    'ice-beam': ['Blizzard', 'atk'],
    'powder-snow': ['Icy Wind', 'spd'],
    'karate-chop': ['Close Combat', 'atk'],
    'aura-sphere': ['Focus Blast', 'cd'],
    lick: ['Shadow Punch', 'atk'],
    'shadow-ball': ['Phantom Force', 'cd'],
    'dragon-rage': ['Draco Meteor', 'atk'],
    'fairy-wind': ['Moonblast', 'atk'],
    'dazzling-gleam': ['Misty Terrain', 'rgn'],
    'metal-claw': ['Iron Head', 'atk'],
    'flash-cannon': ['Steel Beam', 'def'],
    bite: ['Crunch', 'atk'],
    'dark-pulse': ['Snarl', 'spd'],
    'night-shade': ['Nightmare', 'rgn'],
    bonemerang: ['Bone Rush', 'atk'],
    'psycho-cut': ['Psychic Fangs', 'cd'],
    spikes: ['Fissure', 'atk'],
    'toxic-spikes': ['Gunk Shot', 'rgn'],
    hail: ['Avalanche', 'cd'],
    'meteor-mash': ['Magnet Bomb', 'atk'],
    'will-o-wisp': ['Inferno', 'cd'],
    substitute: ['Double Team', 'def'],
    'aerial-ace': ['Acrobatics', 'spd'],
    'flame-wheel': ['Flare Blitz', 'spd'],
    'bubble-beam': ['Aqua Tail', 'atk'],
    hex: ['Poltergeist', 'mag']
  };
  // What it gains when evolving, depending on how it works.
  const EVO_MODS = {
    projectile: {
      t: '×1.8 damage, +2 projectiles, +2 pierce and bigger',
      m: { dmg: 1.8, count: 2, pierce: 2, size: 1.3, spread: 1.1 }
    },
    melee: { t: '×1.9 damage, more range and hits in 360°', m: { dmg: 1.9, radius: 1.3, arc: 9 } },
    beam: { t: '×1.8 damage, a 50% wider and longer beam', m: { dmg: 1.8, width: 1.5, radius: 1.2, cd: 0.85 } },
    orbit: { t: '+2 orbs, ×1.7 damage and more radius', m: { count: 2, dmg: 1.7, radius: 1.15 } },
    nova: { t: '+6 projectiles, ×1.6 damage and +1 pierce', m: { count: 6, dmg: 1.6, pierce: 1 } },
    aura: { t: '×1.8 damage and 35% more radius', m: { dmg: 1.8, radius: 1.35 } },
    boomerang: { t: '×1.8 damage, +1 boomerang and more range', m: { dmg: 1.8, count: 1, radius: 1.2, size: 1.2 } },
    chain: { t: '×1.7 damage and +3 jumps', m: { dmg: 1.7, count: 3, radius: 1.2 } },
    mine: { t: '×1.8 damage, +2 mines and a bigger blast', m: { dmg: 1.8, count: 2, radius: 1.25 } },
    meteor: { t: '×1.7 damage, +2 meteors and more radius', m: { dmg: 1.7, count: 2, radius: 1.2 } },
    turret: { t: '×1.8 damage, +1 at a time and fires faster', m: { dmg: 1.8, count: 1, rate: 0.8 } },
    dash: { t: '×1.9 damage, more distance and less cooldown', m: { dmg: 1.9, radius: 1.25, cd: 0.8 } },
    trail: { t: '×1.8 damage, bigger and longer-lasting pools', m: { dmg: 1.8, radius: 1.25, dur: 1.3 } },
    cone: { t: '×1.7 damage, +4 shots and +1 pierce', m: { dmg: 1.7, count: 4, pierce: 1 } }
  };

  /** Can it evolve now? → { name, needs, needName, text, ready } or null */
  function evoInfo(m, statsTaken) {
    const e = EVO[m.id];
    if (!e || m.evolved || m.lvl < m.def.maxLvl || !EVO_MODS[m.kind]) return null;
    const [name, needs] = e;
    return { name, needs, needName: NEED_NAME[needs], text: EVO_MODS[m.kind].t, ready: !!(statsTaken && statsTaken[needs]) };
  }

  /** Evolves an instance (changes name and power; it keeps the same type). */
  function evolve(m) {
    const e = EVO[m.id];
    if (!e || m.evolved) return false;
    applyMods(m, EVO_MODS[m.kind].m);
    m.baseName = m.name;
    m.name = e[0];
    m.evolved = true;
    return true;
  }

  G.Moves = { ALL: RAW, BY_ID, POOL, poolFor, instance, levelUp, nextUpText, startFor, EVO, NEED_NAME, evoInfo, evolve };
})();
