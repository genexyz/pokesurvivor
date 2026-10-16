/* ============ stages.js — Story mode: regions, stages and gym leaders ============
 *
 * Each region is a list of stages played in order (stage N opens once stage N-1 is
 * cleared). A stage is a fixed-length run through themed routes, with mini-bosses
 * on the way and a gym battle in a closed arena at the end:
 *
 *   legs    the routes: from (stage second), name, biome, music and wild Pokémon.
 *           Only the current leg's Pokémon spawn.
 *           biome: an index of Tiles.BIOMES (0 forest, 1 cave, 2 volcano) or an
 *           arena type ('normal', 'rock', 'water'...) to borrow that palette.
 *   minis   mini-bosses: second they appear and dex. Each one grants a bond.
 *   gym     leader, badge, arena type and team in waves (at most 2 at once; the
 *           last wave holds the ace). `k` scales one member's HP (aces are tougher).
 *   pace    how hard it gets: at the gym, enemies are as tough as endless at
 *           second `pace` (the run is squeezed or stretched to it, see Balance.story).
 *
 * Combat stats are never written here: they come from the endless curves at the
 * stage's pace (systems/story.js, Balance.story). A region with `stages: []` shows
 * as "coming soon".
 *
 * Saved progress: save.story[stage id] = { at, clears, best } (core/db.js).
 */

const KANTO = [
  {
    id: 'kanto_1',
    name: 'Viridian Forest',
    pace: 180,
    legs: [
      { from: 0, name: 'Route 1', biome: 'normal', music: 'forest', mons: [16, 19, 10, 13, 21] },
      { from: 180, name: 'Viridian Forest', biome: 0, music: 'forest', mons: [10, 11, 13, 14, 25, 16] },
      { from: 390, name: 'Route 2', biome: 'rock', music: 'forest', mons: [29, 32, 21, 56, 19, 74] }
    ],
    minis: [
      { at: 150, dex: 17 }, // Pidgeotto
      { at: 330, dex: 15 }, // Beedrill
      { at: 510, dex: 12 } // Butterfree
    ],
    gym: {
      name: 'Pewter Gym',
      leader: 'Brock',
      badge: 'Boulder Badge',
      type: 'rock',
      waves: [[{ dex: 74 }, { dex: 95, k: 1.3 }]] // Geodude, Onix
    }
  },
  {
    id: 'kanto_2',
    name: 'Mt. Moon',
    pace: 240,
    legs: [
      { from: 0, name: 'Route 3', biome: 'normal', music: 'forest', mons: [21, 39, 29, 32, 56, 23, 27] },
      { from: 180, name: 'Mt. Moon', biome: 1, music: 'cave', mons: [41, 74, 46, 35, 27] },
      { from: 390, name: 'Nugget Bridge', biome: 'water', music: 'forest', mons: [43, 69, 63, 54, 118, 48] }
    ],
    minis: [
      { at: 150, dex: 36 }, // Clefable
      { at: 330, dex: 47 }, // Parasect
      { at: 510, dex: 55 } // Golduck
    ],
    gym: {
      name: 'Cerulean Gym',
      leader: 'Misty',
      badge: 'Cascade Badge',
      type: 'water',
      waves: [[{ dex: 120 }], [{ dex: 121, k: 1.3 }]] // Staryu → Starmie
    }
  },
  {
    id: 'kanto_3',
    name: 'S.S. Anne',
    pace: 300,
    legs: [
      { from: 0, name: 'Route 6', biome: 'normal', music: 'forest', mons: [16, 43, 69, 52, 56, 54] },
      { from: 180, name: "Diglett's Cave", biome: 1, music: 'cave', mons: [50, 51, 41, 74] },
      { from: 390, name: 'S.S. Anne', biome: 'water', music: 'cave', mons: [72, 98, 90, 81, 100, 66] }
    ],
    minis: [
      { at: 150, dex: 51 }, // Dugtrio
      { at: 330, dex: 67 }, // Machoke
      { at: 510, dex: 82 } // Magneton
    ],
    gym: {
      name: 'Vermilion Gym',
      leader: 'Lt. Surge',
      badge: 'Thunder Badge',
      type: 'electric',
      waves: [[{ dex: 100 }, { dex: 25 }], [{ dex: 26, k: 1.3 }]] // Voltorb + Pikachu → Raichu
    }
  },
  {
    id: 'kanto_4',
    name: 'Rock Tunnel',
    pace: 360,
    legs: [
      { from: 0, name: 'Route 9', biome: 'normal', music: 'forest', mons: [21, 23, 27, 19, 100, 56] },
      { from: 180, name: 'Rock Tunnel', biome: 1, music: 'cave', mons: [41, 74, 66, 95, 104] },
      { from: 390, name: 'Route 7', biome: 'grass', music: 'forest', mons: [43, 44, 69, 70, 37, 58, 52] }
    ],
    minis: [
      { at: 150, dex: 75 }, // Graveler
      { at: 330, dex: 105 }, // Marowak
      { at: 510, dex: 53 } // Persian
    ],
    gym: {
      name: 'Celadon Gym',
      leader: 'Erika',
      badge: 'Rainbow Badge',
      type: 'grass',
      waves: [[{ dex: 114 }, { dex: 71 }], [{ dex: 45, k: 1.3 }]] // Tangela + Victreebel → Vileplume
    }
  },
  {
    id: 'kanto_5',
    name: 'Cycling Road',
    pace: 420,
    legs: [
      { from: 0, name: 'Cycling Road', biome: 'normal', music: 'forest', mons: [84, 22, 20, 88, 109, 67] },
      { from: 180, name: 'Safari Zone', biome: 'grass', music: 'forest', mons: [33, 102, 111, 49, 123, 128] },
      { from: 390, name: 'Fuchsia City', biome: 'poison', music: 'cave', mons: [88, 109, 48, 24, 42, 49] }
    ],
    minis: [
      { at: 150, dex: 85 }, // Dodrio
      { at: 330, dex: 115 }, // Kangaskhan
      { at: 510, dex: 127 } // Pinsir
    ],
    gym: {
      name: 'Fuchsia Gym',
      leader: 'Koga',
      badge: 'Soul Badge',
      type: 'poison',
      waves: [[{ dex: 109 }, { dex: 89 }], [{ dex: 110, k: 1.3 }]] // Koffing + Muk → Weezing
    }
  },
  {
    id: 'kanto_6',
    name: 'Silph Co.',
    pace: 480,
    legs: [
      { from: 0, name: 'Pokémon Tower', biome: 'ghost', music: 'cave', mons: [92, 93, 104, 42] },
      { from: 180, name: 'Silph Co.', biome: 'steel', music: 'cave', mons: [20, 24, 42, 67, 82, 137] },
      { from: 390, name: 'Saffron City', biome: 'psychic', music: 'forest', mons: [63, 64, 96, 97, 79, 122] }
    ],
    minis: [
      { at: 150, dex: 94 }, // Gengar
      { at: 330, dex: 97 }, // Hypno
      { at: 510, dex: 131 } // Lapras
    ],
    gym: {
      name: 'Saffron Gym',
      leader: 'Sabrina',
      badge: 'Marsh Badge',
      type: 'psychic',
      waves: [[{ dex: 64 }, { dex: 122 }], [{ dex: 65, k: 1.3 }]] // Kadabra + Mr. Mime → Alakazam
    }
  },
  {
    id: 'kanto_7',
    name: 'Pokémon Mansion',
    pace: 540,
    legs: [
      { from: 0, name: 'Seafoam Islands', biome: 'ice', music: 'cave', mons: [86, 87, 55, 80, 116, 73, 124] },
      { from: 180, name: 'Pokémon Mansion', biome: 2, music: 'volcano', mons: [58, 77, 37, 126, 110, 89, 132] },
      { from: 390, name: 'Cinnabar Volcano', biome: 'fire', music: 'volcano', mons: [38, 78, 126, 110, 101, 132] }
    ],
    minis: [
      { at: 150, dex: 91 }, // Cloyster
      { at: 330, dex: 126 }, // Magmar
      { at: 510, dex: 38 } // Ninetales
    ],
    gym: {
      name: 'Cinnabar Gym',
      leader: 'Blaine',
      badge: 'Volcano Badge',
      type: 'fire',
      waves: [[{ dex: 58 }, { dex: 78 }], [{ dex: 59, k: 1.3 }]] // Growlithe + Rapidash → Arcanine
    }
  },
  {
    id: 'kanto_8',
    name: 'Victory Road',
    pace: 600,
    legs: [
      { from: 0, name: 'Route 23', biome: 'ground', music: 'forest', mons: [22, 24, 28, 77, 33, 30, 57] },
      { from: 180, name: 'Victory Road', biome: 1, music: 'cave', mons: [67, 75, 95, 105, 42, 68] },
      { from: 390, name: 'Viridian City', biome: 0, music: 'volcano', mons: [51, 28, 111, 33, 30, 53] }
    ],
    minis: [
      { at: 150, dex: 57 }, // Primeape
      { at: 330, dex: 68 }, // Machamp
      { at: 510, dex: 76 } // Golem
    ],
    gym: {
      name: 'Viridian Gym',
      leader: 'Giovanni',
      badge: 'Earth Badge',
      type: 'ground',
      waves: [
        [{ dex: 51 }, { dex: 31 }], // Dugtrio + Nidoqueen
        [
          { dex: 34, k: 1.2 },
          { dex: 112, k: 1.3 }
        ] // Nidoking + Rhydon
      ]
    }
  }
];

export const Stages = (() => {
  // Same order as the collection's regions (gen 1..9). Empty = coming soon.
  const REGIONS = [
    { id: 'kanto', name: 'Kanto', stages: KANTO },
    { id: 'johto', name: 'Johto', stages: [] },
    { id: 'hoenn', name: 'Hoenn', stages: [] },
    { id: 'sinnoh', name: 'Sinnoh', stages: [] },
    { id: 'unova', name: 'Unova', stages: [] },
    { id: 'kalos', name: 'Kalos', stages: [] },
    { id: 'alola', name: 'Alola', stages: [] },
    { id: 'galar', name: 'Galar', stages: [] },
    { id: 'paldea', name: 'Paldea', stages: [] }
  ];

  const BY_ID = {};
  for (const r of REGIONS)
    r.stages.forEach((s, i) => {
      s.region = r.id;
      s.n = i + 1;
      s.prev = i ? r.stages[i - 1].id : null;
      s.next = r.stages[i + 1] ? r.stages[i + 1].id : null;
      BY_ID[s.id] = s;
    });

  /** Your progress on a stage (or null if never cleared). */
  const record = (save, id) => (save && save.story && save.story[id]) || null;

  return {
    REGIONS,
    BY_ID,
    record,
    /** Cleared at least once (= its badge is yours). */
    cleared: (save, id) => !!record(save, id),
    /** Can be played: the first of its region, or the one before is cleared. */
    unlocked(save, id) {
      const s = BY_ID[id];
      return !!s && (!s.prev || !!record(save, s.prev));
    },
    /** Badges earned in a region. */
    badges: (save, region) => (REGIONS.find(r => r.id === region) || { stages: [] }).stages.filter(s => record(save, s.id)).length
  };
})();
