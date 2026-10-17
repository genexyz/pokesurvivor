/* ============ stages.js — Story mode: regions, stages and gym leaders ============
 *
 * Nine regions (the collection's order), eight stages each, played in order inside a
 * region (stage N opens once stage N-1 is cleared; every region's first stage is open).
 * A stage is a fixed-length run through three themed routes, with mini-bosses on the
 * way and a battle against the region's leader in a closed arena at the end.
 *
 * Each stage is written compactly with S(id, name, legs, minis, gym):
 *   legs    three routes [name, biome, 'Pokémon, Pokémon, ...'], starting at LEG_AT.
 *           Only the current route's Pokémon spawn.
 *           biome: an index of Tiles.BIOMES (0 forest, 1 cave, 2 volcano) or an arena
 *           type ('normal', 'rock', 'water'...) to borrow that palette.
 *   minis   three mini-bosses 'A, B, C' at MINI_AT. Each one grants a bond.
 *   gym     city (the arena is "<city> Gym") or site (its full name), leader, badge,
 *           type (arena and badge icon), waves: 'A, B | C*' = A and B together, then C
 *           (at most 2 at once; * = an ace with ×1.3 HP, *1.2 for another factor).
 *           A region can set the leader's title and the battle's name (Alola: trials).
 * Pokémon are written by name (as in pokedex.js) and turned into dex numbers here;
 * scripts/check_stages.js checks that every name exists.
 *
 * Difficulty: `pace` = at the gym, enemies are as tough as endless at that second
 * (Balance.story). 180 → 600 through a region's eight stages, +30 per region after
 * Kanto (Paldea: 420 → 840). Combat stats are never written here.
 *
 * Leader art: public/assets/trainers/<region>/<leader, letters only>.png (Stages.leaderArt),
 * official sprites from Smogon's sprite repository (CREDITS.md). Regions without
 * `art` show only the leader's ace.
 *
 * Saved progress: save.story[stage id] = { at, clears, best } (core/db.js).
 */
import { DEX } from './pokedex.js';

const LEG_AT = [0, 180, 390],
  MINI_AT = [150, 330, 510];

function S(id, name, legs, minis, gym) {
  return { id, name, legs, minis, gym };
}

const KANTO = [
  S(
    'kanto_1',
    'Viridian Forest',
    [
      ['Route 1', 'normal', 'Pidgey, Rattata, Caterpie, Weedle, Spearow'],
      ['Viridian Forest', 0, 'Caterpie, Metapod, Weedle, Kakuna, Pikachu, Pidgey'],
      ['Route 2', 'rock', 'Nidoran♀, Nidoran♂, Spearow, Mankey, Rattata, Geodude']
    ],
    'Pidgeotto, Beedrill, Butterfree',
    { city: 'Pewter', leader: 'Brock', badge: 'Boulder Badge', type: 'rock', waves: 'Geodude, Onix*' }
  ),
  S(
    'kanto_2',
    'Mt. Moon',
    [
      ['Route 3', 'normal', 'Spearow, Jigglypuff, Nidoran♀, Nidoran♂, Mankey, Ekans, Sandshrew'],
      ['Mt. Moon', 1, 'Zubat, Geodude, Paras, Clefairy, Sandshrew'],
      ['Nugget Bridge', 'water', 'Oddish, Bellsprout, Abra, Psyduck, Goldeen, Venonat']
    ],
    'Clefable, Parasect, Golduck',
    { city: 'Cerulean', leader: 'Misty', badge: 'Cascade Badge', type: 'water', waves: 'Staryu | Starmie*' }
  ),
  S(
    'kanto_3',
    'S.S. Anne',
    [
      ['Route 6', 'normal', 'Pidgey, Oddish, Bellsprout, Meowth, Mankey, Psyduck'],
      ["Diglett's Cave", 1, 'Diglett, Dugtrio, Zubat, Geodude'],
      ['S.S. Anne', 'water', 'Tentacool, Krabby, Shellder, Magnemite, Voltorb, Machop']
    ],
    'Dugtrio, Machoke, Magneton',
    { city: 'Vermilion', leader: 'Lt. Surge', badge: 'Thunder Badge', type: 'electric', waves: 'Voltorb, Pikachu | Raichu*' }
  ),
  S(
    'kanto_4',
    'Rock Tunnel',
    [
      ['Route 9', 'normal', 'Spearow, Ekans, Sandshrew, Rattata, Voltorb, Mankey'],
      ['Rock Tunnel', 1, 'Zubat, Geodude, Machop, Onix, Cubone'],
      ['Route 7', 'grass', 'Oddish, Gloom, Bellsprout, Weepinbell, Vulpix, Growlithe, Meowth']
    ],
    'Graveler, Marowak, Persian',
    { city: 'Celadon', leader: 'Erika', badge: 'Rainbow Badge', type: 'grass', waves: 'Tangela, Victreebel | Vileplume*' }
  ),
  S(
    'kanto_5',
    'Cycling Road',
    [
      ['Cycling Road', 'normal', 'Doduo, Fearow, Raticate, Grimer, Koffing, Machoke'],
      ['Safari Zone', 'grass', 'Nidorino, Exeggcute, Rhyhorn, Venomoth, Scyther, Tauros'],
      ['Fuchsia City', 'poison', 'Grimer, Koffing, Venonat, Arbok, Golbat, Venomoth']
    ],
    'Dodrio, Kangaskhan, Pinsir',
    { city: 'Fuchsia', leader: 'Koga', badge: 'Soul Badge', type: 'poison', waves: 'Koffing, Muk | Weezing*' }
  ),
  S(
    'kanto_6',
    'Silph Co.',
    [
      ['Pokémon Tower', 'ghost', 'Gastly, Haunter, Cubone, Golbat'],
      ['Silph Co.', 'steel', 'Raticate, Arbok, Golbat, Machoke, Magneton, Porygon'],
      ['Saffron City', 'psychic', 'Abra, Kadabra, Drowzee, Hypno, Slowpoke, Mr. Mime']
    ],
    'Gengar, Hypno, Lapras',
    { city: 'Saffron', leader: 'Sabrina', badge: 'Marsh Badge', type: 'psychic', waves: 'Kadabra, Mr. Mime | Alakazam*' }
  ),
  S(
    'kanto_7',
    'Pokémon Mansion',
    [
      ['Seafoam Islands', 'ice', 'Seel, Dewgong, Golduck, Slowbro, Horsea, Tentacruel, Jynx'],
      ['Pokémon Mansion', 2, 'Growlithe, Ponyta, Vulpix, Magmar, Weezing, Muk, Ditto'],
      ['Cinnabar Volcano', 'fire', 'Ninetales, Rapidash, Magmar, Weezing, Electrode, Ditto']
    ],
    'Cloyster, Magmar, Ninetales',
    { city: 'Cinnabar', leader: 'Blaine', badge: 'Volcano Badge', type: 'fire', waves: 'Growlithe, Rapidash | Arcanine*' }
  ),
  S(
    'kanto_8',
    'Victory Road',
    [
      ['Route 23', 'ground', 'Fearow, Arbok, Sandslash, Ponyta, Nidorino, Nidorina, Primeape'],
      ['Victory Road', 1, 'Machoke, Graveler, Onix, Marowak, Golbat, Machamp'],
      ['Viridian City', 0, 'Dugtrio, Sandslash, Rhyhorn, Nidorino, Nidorina, Persian']
    ],
    'Primeape, Machamp, Golem',
    { city: 'Viridian', leader: 'Giovanni', badge: 'Earth Badge', type: 'ground', waves: 'Dugtrio, Nidoqueen | Nidoking*1.2, Rhydon*' }
  )
];

const JOHTO = [
  S(
    'johto_1',
    'Sprout Tower',
    [
      ['Route 29', 'normal', 'Pidgey, Sentret, Rattata, Hoothoot, Hoppip'],
      ['Sprout Tower', 0, 'Bellsprout, Gastly, Rattata, Zubat'],
      ['Route 32', 'grass', 'Mareep, Wooper, Ekans, Bellsprout, Hoppip, Zubat']
    ],
    'Noctowl, Furret, Flaaffy',
    { city: 'Violet', leader: 'Falkner', badge: 'Zephyr Badge', type: 'flying', waves: 'Pidgey, Hoothoot | Pidgeotto*' }
  ),
  S(
    'johto_2',
    'Ilex Forest',
    [
      ['Union Cave', 1, 'Zubat, Geodude, Onix, Sandshrew, Wooper'],
      ['Slowpoke Well', 'water', 'Slowpoke, Zubat, Rattata, Koffing'],
      ['Ilex Forest', 0, 'Caterpie, Metapod, Weedle, Kakuna, Paras, Oddish, Psyduck']
    ],
    'Slowbro, Arbok, Beedrill',
    { city: 'Azalea', leader: 'Bugsy', badge: 'Hive Badge', type: 'bug', waves: 'Metapod, Kakuna | Scyther*' }
  ),
  S(
    'johto_3',
    'National Park',
    [
      ['Route 34', 'normal', 'Drowzee, Abra, Ditto, Snubbull, Jigglypuff'],
      ['National Park', 'grass', 'Sunkern, Caterpie, Weedle, Pidgey, Nidoran♀, Nidoran♂, Venonat'],
      ['Goldenrod City', 'steel', 'Meowth, Grimer, Magnemite, Voltorb, Rattata']
    ],
    'Granbull, Raticate, Wigglytuff',
    { city: 'Goldenrod', leader: 'Whitney', badge: 'Plain Badge', type: 'normal', waves: 'Clefairy | Miltank*' }
  ),
  S(
    'johto_4',
    'Burned Tower',
    [
      ['Route 37', 'normal', 'Growlithe, Vulpix, Stantler, Ledyba, Spinarak, Hoothoot'],
      ['Burned Tower', 2, 'Koffing, Rattata, Magmar, Raticate, Weezing'],
      ['Bell Tower', 'ghost', 'Gastly, Haunter, Misdreavus, Murkrow']
    ],
    'Arcanine, Ariados, Houndoom',
    { city: 'Ecruteak', leader: 'Morty', badge: 'Fog Badge', type: 'ghost', waves: 'Gastly, Haunter | Gengar*' }
  ),
  S(
    'johto_5',
    'Mt. Mortar',
    [
      ['Route 41', 'water', 'Tentacool, Krabby, Mantine, Chinchou, Shellder'],
      ['Mt. Mortar', 1, 'Machop, Geodude, Zubat, Marill, Rattata, Tyrogue'],
      ['Cianwood City', 'fighting', 'Hitmonlee, Hitmonchan, Mankey, Primeape, Heracross']
    ],
    'Lanturn, Hitmontop, Ursaring',
    { city: 'Cianwood', leader: 'Chuck', badge: 'Storm Badge', type: 'fighting', waves: 'Primeape | Poliwrath*' }
  ),
  S(
    'johto_6',
    'Glitter Lighthouse',
    [
      ['Route 38', 'normal', 'Miltank, Tauros, Farfetch’d, Raticate, Magnemite, Meowth'],
      ['Glitter Lighthouse', 'steel', 'Magnemite, Magneton, Electabuzz, Voltorb, Gastly'],
      ['Olivine Docks', 'water', 'Krabby, Tentacool, Shellder, Staryu, Slowpoke']
    ],
    'Ampharos, Electabuzz, Skarmory',
    { city: 'Olivine', leader: 'Jasmine', badge: 'Mineral Badge', type: 'steel', waves: 'Magnemite, Magneton | Steelix*' }
  ),
  S(
    'johto_7',
    'Lake of Rage',
    [
      ['Route 43', 'normal', 'Girafarig, Pidgeotto, Venonat, Noctowl, Flaaffy'],
      ['Lake of Rage', 'water', 'Magikarp, Gyarados, Psyduck, Golduck'],
      ['Ice Path', 'ice', 'Swinub, Jynx, Delibird, Sneasel, Zubat, Golbat']
    ],
    'Gyarados, Dewgong, Jynx',
    { city: 'Mahogany', leader: 'Pryce', badge: 'Glacier Badge', type: 'ice', waves: 'Seel, Dewgong | Piloswine*' }
  ),
  S(
    'johto_8',
    "Dragon's Den",
    [
      ['Route 45', 'rock', 'Gligar, Graveler, Skarmory, Phanpy, Donphan, Teddiursa'],
      ['Ice Path', 'ice', 'Swinub, Delibird, Sneasel, Jynx, Golbat'],
      ["Dragon's Den", 'dragon', 'Dratini, Dragonair, Magikarp, Horsea, Seadra']
    ],
    'Gligar, Donphan, Dragonair',
    { city: 'Blackthorn', leader: 'Clair', badge: 'Rising Badge', type: 'dragon', waves: 'Dragonair, Gyarados | Kingdra*' }
  )
];

const HOENN = [
  S(
    'hoenn_1',
    'Petalburg Woods',
    [
      ['Route 101', 'normal', 'Zigzagoon, Wurmple, Poochyena, Lotad, Seedot, Ralts'],
      ['Petalburg Woods', 0, 'Wurmple, Silcoon, Cascoon, Shroomish, Slakoth, Taillow'],
      ['Route 104', 'water', 'Wingull, Marill, Taillow, Zigzagoon']
    ],
    'Linoone, Beautifly, Dustox',
    { city: 'Rustboro', leader: 'Roxanne', badge: 'Stone Badge', type: 'rock', waves: 'Geodude | Nosepass*' }
  ),
  S(
    'hoenn_2',
    'Granite Cave',
    [
      ['Route 106', 'water', 'Tentacool, Wingull, Marill, Magikarp'],
      ['Granite Cave', 1, 'Zubat, Makuhita, Abra, Geodude, Sableye, Aron'],
      ['Dewford Beach', 'fighting', 'Machop, Meditite, Makuhita, Wingull']
    ],
    'Pelipper, Lairon, Mawile',
    { city: 'Dewford', leader: 'Brawly', badge: 'Knuckle Badge', type: 'fighting', waves: 'Machop, Meditite | Hariyama*' }
  ),
  S(
    'hoenn_3',
    'New Mauville',
    [
      ['Route 109', 'water', 'Tentacool, Wingull, Corphish, Zigzagoon'],
      ['Route 110', 'normal', 'Electrike, Minun, Plusle, Oddish, Gulpin, Wingull'],
      ['New Mauville', 'electric', 'Magnemite, Voltorb, Electrike, Magneton']
    ],
    'Manectric, Swalot, Electrode',
    { city: 'Mauville', leader: 'Wattson', badge: 'Dynamo Badge', type: 'electric', waves: 'Voltorb, Magneton | Manectric*' }
  ),
  S(
    'hoenn_4',
    'Fiery Path',
    [
      ['Route 111', 'ground', 'Sandshrew, Trapinch, Cacnea, Baltoy'],
      ['Fiery Path', 2, 'Numel, Koffing, Grimer, Slugma, Torkoal, Machop'],
      ['Mt. Chimney', 'fire', 'Numel, Slugma, Spoink, Magcargo, Camerupt']
    ],
    'Vibrava, Camerupt, Magcargo',
    { city: 'Lavaridge', leader: 'Flannery', badge: 'Heat Badge', type: 'fire', waves: 'Slugma, Numel | Torkoal*' }
  ),
  S(
    'hoenn_5',
    'Route 118',
    [
      ['Route 117', 'normal', 'Illumise, Volbeat, Roselia, Marill, Oddish, Zigzagoon'],
      ['Route 118', 'water', 'Electrike, Linoone, Kecleon, Wingull, Carvanha'],
      ['Petalburg City', 'normal', 'Spinda, Skitty, Zangoose, Seviper']
    ],
    'Sharpedo, Zangoose, Seviper',
    { city: 'Petalburg', leader: 'Norman', badge: 'Balance Badge', type: 'normal', waves: 'Vigoroth, Spinda | Slaking*' }
  ),
  S(
    'hoenn_6',
    'Weather Institute',
    [
      ['Route 119', 'grass', 'Tropius, Oddish, Kecleon, Linoone, Castform'],
      ['Weather Institute', 'steel', 'Carvanha, Poochyena, Mightyena, Castform'],
      ['Fortree Treetops', 'flying', 'Swablu, Taillow, Swellow, Pelipper, Skarmory']
    ],
    'Mightyena, Swellow, Skarmory',
    { city: 'Fortree', leader: 'Winona', badge: 'Feather Badge', type: 'flying', waves: 'Swablu, Pelipper | Altaria*' }
  ),
  S(
    'hoenn_7',
    'Mt. Pyre',
    [
      ['Route 120', 'normal', 'Shuppet, Duskull, Kecleon, Oddish, Gloom, Wingull'],
      ['Mt. Pyre', 'ghost', 'Shuppet, Duskull, Vulpix, Chimecho, Meditite'],
      ['Mossdeep City', 'psychic', 'Spoink, Grumpig, Solrock, Lunatone, Natu, Xatu']
    ],
    'Banette, Dusclops, Grumpig',
    {
      city: 'Mossdeep',
      leader: 'Tate & Liza',
      badge: 'Mind Badge',
      type: 'psychic',
      waves: 'Claydol, Xatu | Solrock*1.2, Lunatone*1.2'
    }
  ),
  S(
    'hoenn_8',
    'Seafloor Cavern',
    [
      ['Route 124', 'water', 'Tentacool, Wingull, Pelipper, Chinchou, Clamperl, Relicanth'],
      ['Seafloor Cavern', 1, 'Zubat, Golbat, Sharpedo, Carvanha, Wailmer'],
      ['Sootopolis City', 'water', 'Luvdisc, Corsola, Horsea, Seadra, Whiscash']
    ],
    'Sharpedo, Gorebyss, Whiscash',
    { city: 'Sootopolis', leader: 'Juan', badge: 'Rain Badge', type: 'water', waves: 'Whiscash, Sealeo | Crawdaunt*1.2, Kingdra*' }
  )
];

const SINNOH = [
  S(
    'sinnoh_1',
    'Oreburgh Mine',
    [
      ['Route 201', 'normal', 'Starly, Bidoof, Kricketot, Shinx, Abra'],
      ['Route 204', 0, 'Starly, Budew, Wurmple, Bidoof, Shinx, Psyduck'],
      ['Oreburgh Mine', 1, 'Geodude, Onix, Zubat, Machop']
    ],
    'Staravia, Luxio, Graveler',
    { city: 'Oreburgh', leader: 'Roark', badge: 'Coal Badge', type: 'rock', waves: 'Geodude, Onix | Cranidos*' }
  ),
  S(
    'sinnoh_2',
    'Eterna Forest',
    [
      ['Floaroma Meadow', 'grass', 'Combee, Burmy, Cherubi, Pachirisu, Buneary, Shellos'],
      ['Eterna Forest', 0, 'Buneary, Hoothoot, Kricketune, Wurmple, Silcoon, Beautifly, Gastly'],
      ['Route 205', 'water', 'Shellos, Buizel, Psyduck, Drifloon']
    ],
    'Vespiquen, Kricketune, Drifblim',
    { city: 'Eterna', leader: 'Gardenia', badge: 'Forest Badge', type: 'grass', waves: 'Cherubi, Turtwig | Roserade*' }
  ),
  S(
    'sinnoh_3',
    'Mt. Coronet',
    [
      ['Mt. Coronet', 1, 'Geodude, Zubat, Meditite, Machop, Bronzor, Chingling'],
      ['Route 210', 'normal', 'Ponyta, Bibarel, Scyther, Psyduck, Machop, Noctowl'],
      ['Route 215', 'fighting', 'Abra, Kadabra, Lickitung, Croagunk, Riolu']
    ],
    'Bronzong, Rapidash, Toxicroak',
    { city: 'Veilstone', leader: 'Maylene', badge: 'Cobble Badge', type: 'fighting', waves: 'Meditite, Machoke | Lucario*' }
  ),
  S(
    'sinnoh_4',
    'Great Marsh',
    [
      ['Route 212', 'water', 'Wooper, Quagsire, Croagunk, Shellos, Gastrodon, Roselia'],
      ['Great Marsh', 'poison', 'Skorupi, Carnivine, Yanma, Croagunk, Tangela, Wooper'],
      ['Valley Windworks', 'electric', 'Pachirisu, Shinx, Drifloon, Buizel']
    ],
    'Gastrodon, Drapion, Yanmega',
    { city: 'Pastoria', leader: 'Crasher Wake', badge: 'Fen Badge', type: 'water', waves: 'Gyarados, Quagsire | Floatzel*' }
  ),
  S(
    'sinnoh_5',
    'Old Chateau',
    [
      ['Route 209', 'normal', 'Staravia, Bibarel, Chansey, Bonsly, Mime Jr., Roselia'],
      ['Solaceon Ruins', 'psychic', 'Chingling, Bronzor, Natu, Girafarig'],
      ['Old Chateau', 'ghost', 'Gastly, Haunter, Duskull, Misdreavus, Drifloon']
    ],
    'Sudowoodo, Bronzong, Dusclops',
    { city: 'Hearthome', leader: 'Fantina', badge: 'Relic Badge', type: 'ghost', waves: 'Duskull, Haunter | Mismagius*' }
  ),
  S(
    'sinnoh_6',
    'Iron Island',
    [
      ['Route 213', 'water', 'Wingull, Pelipper, Buizel, Floatzel, Shellos, Remoraid'],
      ['Iron Island', 1, 'Geodude, Graveler, Onix, Bronzor, Riolu, Zubat'],
      ['Canalave City', 'steel', 'Magnemite, Magneton, Bronzor, Skarmory, Shieldon']
    ],
    'Steelix, Skarmory, Magnezone',
    { city: 'Canalave', leader: 'Byron', badge: 'Mine Badge', type: 'steel', waves: 'Bronzor, Steelix | Bastiodon*' }
  ),
  S(
    'sinnoh_7',
    'Route 217',
    [
      ['Mt. Coronet', 1, 'Zubat, Golbat, Geodude, Graveler, Chingling, Bronzor'],
      ['Route 216', 'ice', 'Snover, Sneasel, Swinub, Machoke, Zubat'],
      ['Route 217', 'ice', 'Snover, Abomasnow, Sneasel, Snorunt, Medicham']
    ],
    'Glalie, Abomasnow, Weavile',
    { city: 'Snowpoint', leader: 'Candice', badge: 'Icicle Badge', type: 'ice', waves: 'Sneasel, Medicham | Abomasnow*' }
  ),
  S(
    'sinnoh_8',
    'Sunyshore',
    [
      ['Route 222', 'normal', 'Electabuzz, Luxio, Mr. Mime, Wingull, Gastrodon, Floatzel'],
      ['Solar Panels', 'electric', 'Magnemite, Magneton, Raichu, Pachirisu, Electrode'],
      ['Route 223', 'water', 'Tentacruel, Pelipper, Mantine, Wailmer']
    ],
    'Electabuzz, Tentacruel, Electrode',
    { city: 'Sunyshore', leader: 'Volkner', badge: 'Beacon Badge', type: 'electric', waves: 'Raichu, Ambipom | Octillery*1.2, Luxray*' }
  )
];

const UNOVA = [
  S(
    'unova_1',
    'Dreamyard',
    [
      ['Route 1', 'normal', 'Patrat, Lillipup, Purrloin'],
      ['Route 2', 0, 'Patrat, Lillipup, Purrloin, Pidove'],
      ['Dreamyard', 'psychic', 'Munna, Patrat, Purrloin, Pansage, Pansear, Panpour']
    ],
    'Watchog, Herdier, Liepard',
    { city: 'Striaton', leader: 'Cilan', badge: 'Trio Badge', type: 'grass', waves: 'Lillipup | Pansage*' }
  ),
  S(
    'unova_2',
    'Wellspring Cave',
    [
      ['Route 3', 'normal', 'Pidove, Tympole, Purrloin, Patrat, Lillipup'],
      ['Wellspring Cave', 1, 'Roggenrola, Woobat, Drilbur'],
      ['Nacrene City', 'normal', 'Minccino, Audino, Herdier']
    ],
    'Simisage, Boldore, Unfezant',
    { city: 'Nacrene', leader: 'Lenora', badge: 'Basic Badge', type: 'normal', waves: 'Herdier | Watchog*' }
  ),
  S(
    'unova_3',
    'Pinwheel Forest',
    [
      ['Pinwheel Outskirts', 'normal', 'Timburr, Sawk, Tympole, Pidove'],
      ['Pinwheel Forest', 0, 'Sewaddle, Venipede, Cottonee, Petilil, Swadloon'],
      ['Castelia City', 'steel', 'Pidove, Trubbish, Patrat, Liepard']
    ],
    'Gurdurr, Whirlipede, Garbodor',
    { city: 'Castelia', leader: 'Burgh', badge: 'Insect Badge', type: 'bug', waves: 'Whirlipede, Dwebble | Leavanny*' }
  ),
  S(
    'unova_4',
    'Desert Resort',
    [
      ['Route 4', 'ground', 'Sandile, Darumaka, Scraggy, Minccino, Trubbish'],
      ['Desert Resort', 'ground', 'Sandile, Darumaka, Maractus, Dwebble, Scraggy, Sigilyph'],
      ['Relic Castle', 'ghost', 'Yamask, Sandile, Krokorok']
    ],
    'Krokorok, Sigilyph, Cofagrigus',
    { city: 'Nimbasa', leader: 'Elesa', badge: 'Bolt Badge', type: 'electric', waves: 'Emolga, Joltik | Eelektross*' }
  ),
  S(
    'unova_5',
    'Cold Storage',
    [
      ['Route 5', 'normal', 'Gothita, Solosis, Minccino, Liepard, Trubbish'],
      ['Driftveil Drawbridge', 'water', 'Ducklett, Swanna, Pidove'],
      ['Cold Storage', 'steel', 'Vanillite, Klink, Timburr, Patrat']
    ],
    'Swanna, Klang, Gothorita',
    { city: 'Driftveil', leader: 'Clay', badge: 'Quake Badge', type: 'ground', waves: 'Krokorok, Palpitoad | Excadrill*' }
  ),
  S(
    'unova_6',
    'Chargestone Cave',
    [
      ['Route 6', 'grass', 'Deerling, Foongus, Karrablast, Tympole, Swadloon'],
      ['Chargestone Cave', 'electric', 'Joltik, Ferroseed, Klink, Tynamo, Boldore'],
      ['Mistralton City', 'flying', 'Ducklett, Woobat, Pidove, Unfezant']
    ],
    'Galvantula, Escavalier, Ferrothorn',
    { city: 'Mistralton', leader: 'Skyla', badge: 'Jet Badge', type: 'flying', waves: 'Swoobat, Unfezant | Swanna*' }
  ),
  S(
    'unova_7',
    'Twist Mountain',
    [
      ['Route 7', 'normal', 'Deerling, Pidove, Eelektrik, Foongus, Watchog'],
      ['Twist Mountain', 'ice', 'Cubchoo, Boldore, Gurdurr, Woobat'],
      ['Icirrus City', 'water', 'Karrablast, Palpitoad, Vanillish, Tympole']
    ],
    'Beartic, Gigalith, Seismitoad',
    { city: 'Icirrus', leader: 'Brycen', badge: 'Freeze Badge', type: 'ice', waves: 'Vanillish, Cryogonal | Beartic*' }
  ),
  S(
    'unova_8',
    'Dragonspiral Tower',
    [
      ['Route 8', 'grass', 'Palpitoad, Karrablast, Croagunk, Foongus'],
      ['Dragonspiral Tower', 'dragon', 'Druddigon, Golett, Mienfoo, Unfezant'],
      ['Opelucid City', 'steel', 'Garbodor, Liepard, Gothorita, Duosion, Pawniard']
    ],
    'Golurk, Mienshao, Bisharp',
    { city: 'Opelucid', leader: 'Drayden', badge: 'Legend Badge', type: 'dragon', waves: 'Fraxure, Druddigon | Haxorus*' }
  )
];

const KALOS = [
  S(
    'kalos_1',
    'Santalune Forest',
    [
      ['Route 2', 'normal', 'Fletchling, Bunnelby, Scatterbug, Zigzagoon, Pidgey'],
      ['Santalune Forest', 0, 'Scatterbug, Spewpa, Weedle, Caterpie, Pikachu, Pansage'],
      ['Route 22', 'normal', 'Litleo, Skiddo, Bunnelby, Azurill, Dunsparce']
    ],
    'Fletchinder, Diggersby, Talonflame',
    { city: 'Santalune', leader: 'Viola', badge: 'Bug Badge', type: 'bug', waves: 'Surskit | Vivillon*' }
  ),
  S(
    'kalos_2',
    'Glittering Cave',
    [
      ['Route 7', 'grass', 'Flabébé, Smoochum, Roselia, Ducklett, Hoppip, Combee'],
      ['Connecting Cave', 1, 'Zubat, Whismur, Axew, Meditite'],
      ['Glittering Cave', 1, 'Cubone, Rhyhorn, Machop, Onix, Lunatone, Solrock']
    ],
    'Kangaskhan, Marowak, Hawlucha',
    { city: 'Cyllage', leader: 'Grant', badge: 'Cliff Badge', type: 'rock', waves: 'Amaura | Tyrunt*' }
  ),
  S(
    'kalos_3',
    'Tower of Mastery',
    [
      ['Route 10', 'normal', 'Eevee, Sigilyph, Nosepass, Golett, Yanma, Snubbull'],
      ['Geosenge Town', 'rock', 'Houndour, Emolga, Electrike, Hawlucha'],
      ['Tower of Mastery', 'fighting', 'Mienfoo, Machop, Meditite, Riolu, Sawk']
    ],
    'Golurk, Houndoom, Mienshao',
    { city: 'Shalour', leader: 'Korrina', badge: 'Rumble Badge', type: 'fighting', waves: 'Mienfoo, Machoke | Hawlucha*' }
  ),
  S(
    'kalos_4',
    'Azure Bay',
    [
      ['Route 12', 'water', 'Tauros, Miltank, Wingull, Tentacool, Pachirisu, Exeggcute'],
      ['Azure Bay', 'water', 'Tentacool, Wingull, Chinchou, Remoraid, Lapras'],
      ['Route 13', 'ground', 'Trapinch, Dugtrio, Gible, Slugma, Sandshrew']
    ],
    'Lapras, Tentacruel, Gabite',
    { city: 'Coumarine', leader: 'Ramos', badge: 'Plant Badge', type: 'grass', waves: 'Jumpluff, Weepinbell | Gogoat*' }
  ),
  S(
    'kalos_5',
    'Kalos Power Plant',
    [
      ['Route 13', 'ground', 'Trapinch, Gible, Dugtrio, Slugma, Graveler'],
      ['Kalos Power Plant', 'electric', 'Magnemite, Pikachu, Helioptile, Dedenne'],
      ['Lumiose City', 'steel', 'Klefki, Honedge, Pawniard, Furfrou, Litleo']
    ],
    'Heliolisk, Magneton, Doublade',
    { city: 'Lumiose', leader: 'Clemont', badge: 'Voltage Badge', type: 'electric', waves: 'Emolga, Magneton | Heliolisk*' }
  ),
  S(
    'kalos_6',
    'Poké Ball Factory',
    [
      ['Route 14', 'poison', 'Skrelp, Karrablast, Ekans, Haunter, Quagsire'],
      ['Laverre Outskirts', 'fairy', 'Spritzee, Swirlix, Floette, Snubbull, Mawile'],
      ['Poké Ball Factory', 'steel', 'Klefki, Pawniard, Magnemite, Honedge']
    ],
    'Dragalge, Slurpuff, Florges',
    { city: 'Laverre', leader: 'Valerie', badge: 'Fairy Badge', type: 'fairy', waves: 'Mawile, Mr. Mime | Sylveon*' }
  ),
  S(
    'kalos_7',
    'Frost Cavern',
    [
      ['Route 16', 'grass', 'Weepinbell, Floatzel, Skorupi, Zubat, Golbat, Klefki'],
      ['Frost Cavern', 'ice', 'Bergmite, Cryogonal, Piloswine, Vanillish, Beartic'],
      ['Anistar City', 'psychic', 'Espurr, Inkay, Sigilyph, Meowstic']
    ],
    'Avalugg, Drapion, Malamar',
    { city: 'Anistar', leader: 'Olympia', badge: 'Psychic Badge', type: 'psychic', waves: 'Sigilyph, Slowking | Meowstic*' }
  ),
  S(
    'kalos_8',
    'Winding Woods',
    [
      ['Terminus Cave', 1, 'Durant, Graveler, Noibat, Lairon, Pupitar'],
      ['Route 19', 'poison', 'Haunter, Quagsire, Carnivine, Goomy, Weepinbell'],
      ['Winding Woods', 'ghost', 'Phantump, Pumpkaboo, Foongus, Noctowl, Jigglypuff']
    ],
    'Aggron, Sliggoo, Trevenant',
    { city: 'Snowbelle', leader: 'Wulfric', badge: 'Iceberg Badge', type: 'ice', waves: 'Abomasnow, Cryogonal | Avalugg*' }
  )
];

// Alola has no gyms: island trials (Captains) and grand trials (Kahunas), won for a Z-Crystal.
const TRIAL = { title: 'Captain', battle: 'Trial' },
  GRAND = { title: 'Kahuna', battle: 'Grand trial' };
const ALOLA = [
  S(
    'alola_1',
    'Verdant Cavern',
    [
      ['Route 1', 'normal', 'Pikipek, Yungoos, Rattata, Grubbin, Caterpie'],
      ["Hau'oli City", 'normal', 'Meowth, Wingull, Abra, Magnemite'],
      ['Verdant Cavern', 1, 'Zubat, Diglett, Yungoos, Rattata']
    ],
    'Pikipek, Raticate, Charjabug',
    { ...TRIAL, site: 'Verdant Cavern', leader: 'Ilima', badge: 'Normalium Z', type: 'normal', waves: 'Yungoos | Smeargle*' }
  ),
  S(
    'alola_2',
    'Ten Carat Hill',
    [
      ['Route 2', 'normal', 'Spearow, Makuhita, Crabrawler, Cutiefly'],
      ["Hau'oli Cemetery", 'ghost', 'Gastly, Misdreavus, Drifloon'],
      ['Ten Carat Hill', 1, 'Zubat, Roggenrola, Carbink, Rockruff']
    ],
    'Fearow, Haunter, Hariyama',
    { ...GRAND, site: 'Iki Town', leader: 'Hala', badge: 'Fightinium Z', type: 'fighting', waves: 'Mankey, Makuhita | Crabrawler*' }
  ),
  S(
    'alola_3',
    'Brooklet Hill',
    [
      ['Route 4', 'normal', 'Lillipup, Eevee, Pikipek, Fomantis, Caterpie, Metapod'],
      ['Paniola Ranch', 'grass', 'Mudbray, Tauros, Miltank, Lillipup, Mareanie'],
      ['Brooklet Hill', 'water', 'Wishiwashi, Dewpider, Surskit, Psyduck, Poliwag']
    ],
    'Tauros, Araquanid, Masquerain',
    { ...TRIAL, site: 'Brooklet Hill', leader: 'Lana', badge: 'Waterium Z', type: 'water', waves: 'Dewpider | Wishiwashi*' }
  ),
  S(
    'alola_4',
    'Wela Volcano Park',
    [
      ['Route 7', 'water', 'Tentacool, Wingull, Finneon, Staryu, Wishiwashi'],
      ['Wela Volcano Park', 'fire', 'Cubone, Kangaskhan, Fletchinder, Salandit, Magby'],
      ['Route 8', 2, 'Salandit, Stufful, Fletchinder, Pikipek']
    ],
    'Torkoal, Salazzle, Bewear',
    {
      ...TRIAL,
      site: 'Wela Volcano Park',
      leader: 'Kiawe',
      badge: 'Firium Z',
      type: 'fire',
      waves: 'Fletchinder, Salandit | Marowak*'
    }
  ),
  S(
    'alola_5',
    'Lush Jungle',
    [
      ['Route 8', 'normal', 'Stufful, Pikipek, Crabrawler, Salandit'],
      ['Lush Jungle', 'grass', 'Fomantis, Morelull, Paras, Bonsly, Passimian, Comfey'],
      ['Deep Jungle', 0, 'Bounsweet, Steenee, Pikipek, Caterpie']
    ],
    'Bewear, Passimian, Kommo-o',
    { ...TRIAL, site: 'Lush Jungle', leader: 'Mallow', badge: 'Grassium Z', type: 'grass', waves: 'Steenee, Comfey | Lurantis*' }
  ),
  S(
    'alola_6',
    'Memorial Hill',
    [
      ["Diglett's Tunnel", 1, 'Diglett, Zubat, Larvitar, Roggenrola'],
      ['Konikoni City', 'normal', 'Meowth, Pikipek, Mareanie, Corsola'],
      ['Memorial Hill', 'ghost', 'Zubat, Gastly, Phantump, Sandygast']
    ],
    'Dugtrio, Toxapex, Palossand',
    { ...GRAND, site: 'Ruins of Life', leader: 'Olivia', badge: 'Rockium Z', type: 'rock', waves: 'Nosepass, Boldore | Lycanroc*' }
  ),
  S(
    'alola_7',
    'Thrifty Megamart',
    [
      ['Route 10', 'normal', 'Fearow, Pancham, Skarmory, Ledian'],
      ['Route 11', 'grass', 'Paras, Pancham, Klefki, Pikipek'],
      ['Abandoned Megamart', 'ghost', 'Haunter, Gastly, Klefki, Mimikyu']
    ],
    'Pangoro, Skarmory, Dhelmise',
    {
      ...TRIAL,
      site: 'Thrifty Megamart',
      leader: 'Acerola',
      badge: 'Ghostium Z',
      type: 'ghost',
      waves: 'Sableye, Drifblim | Mimikyu*'
    }
  ),
  S(
    'alola_8',
    'Vast Poni Canyon',
    [
      ['Haina Desert', 'ground', 'Sandile, Krokorok, Trapinch, Dugtrio, Sandygast'],
      ['Poni Wilds', 'water', 'Tentacruel, Wingull, Exeggcute, Granbull'],
      ['Vast Poni Canyon', 'rock', 'Jangmo-o, Hakamo-o, Boldore, Murkrow, Lycanroc']
    ],
    'Krookodile, Exeggutor, Hakamo-o',
    {
      ...GRAND,
      site: 'Ruins of Hope',
      leader: 'Hapu',
      badge: 'Groundium Z',
      type: 'ground',
      waves: 'Dugtrio, Gastrodon | Flygon*1.2, Mudsdale*'
    }
  )
];

const GALAR = [
  S(
    'galar_1',
    'Wild Area',
    [
      ['Route 2', 'normal', 'Skwovet, Rookidee, Wooloo, Nickit, Blipbug'],
      ['Wild Area', 'grass', 'Wooloo, Bunnelby, Nickit, Yamper, Gossifleur, Chewtle'],
      ['Route 3', 'rock', 'Roggenrola, Sizzlipede, Cutiefly, Rookidee']
    ],
    'Greedent, Corvisquire, Dubwool',
    { city: 'Turffield', leader: 'Milo', badge: 'Grass Badge', type: 'grass', waves: 'Gossifleur | Eldegoss*' }
  ),
  S(
    'galar_2',
    'Galar Mine',
    [
      ['Galar Mine', 1, 'Roggenrola, Boldore, Diglett, Woobat, Drilbur'],
      ['Route 4', 'grass', 'Yamper, Wooloo, Meowth, Milcery'],
      ['Galar Mine No. 2', 'water', 'Chewtle, Shellos, Croagunk, Binacle, Wooper']
    ],
    'Boldore, Boltund, Barraskewda',
    { city: 'Hulbury', leader: 'Nessa', badge: 'Water Badge', type: 'water', waves: 'Goldeen, Arrokuda | Drednaw*' }
  ),
  S(
    'galar_3',
    'Bridge Field',
    [
      ['Route 5', 'normal', 'Applin, Pumpkaboo, Skwovet, Dewpider'],
      ['Bridge Field', 'grass', 'Pancham, Hatenna, Impidimp, Pumpkaboo'],
      ['Motostoke Outskirts', 2, 'Sizzlipede, Litwick, Growlithe, Vulpix, Salandit']
    ],
    'Flapple, Pangoro, Lampent',
    { city: 'Motostoke', leader: 'Kabu', badge: 'Fire Badge', type: 'fire', waves: 'Ninetales, Arcanine | Centiskorch*' }
  ),
  S(
    'galar_4',
    'Stow-on-Side',
    [
      ['Route 6', 'ground', 'Silicobra, Hawlucha, Torkoal, Durant, Heatmor, Mudbray'],
      ['Stow-on-Side', 'rock', 'Rufflet, Duskull, Sandaconda, Roggenrola'],
      ['Glimwood Tangle', 'fairy', 'Impidimp, Hatenna, Morelull, Ponyta']
    ],
    'Sandaconda, Braviary, Morgrem',
    { city: 'Stow-on-Side', leader: 'Bea', badge: 'Fighting Badge', type: 'fighting', waves: 'Hitmontop, Pangoro | Machamp*' }
  ),
  S(
    'galar_5',
    'Glimwood Tangle',
    [
      ['Glimwood Tangle', 'fairy', 'Impidimp, Hatenna, Morelull, Ponyta, Spritzee'],
      ['Route 7', 'dark', 'Thievul, Zigzagoon, Morgrem, Karrablast, Toxel'],
      ['Route 8', 'steel', 'Sawk, Hawlucha, Rhyhorn, Onix, Durant']
    ],
    'Hattrem, Toxtricity, Grapploct',
    { city: 'Ballonlea', leader: 'Opal', badge: 'Fairy Badge', type: 'fairy', waves: 'Weezing, Mawile | Togekiss*1.2, Alcremie*' }
  ),
  S(
    'galar_6',
    'Route 9',
    [
      ['Route 8', 'steel', 'Sawk, Hawlucha, Rhyhorn, Durant, Axew'],
      ['Route 9', 'ice', 'Snom, Eiscue, Pelipper, Wingull, Clobbopus'],
      ['Circhester Bay', 'water', 'Cramorant, Pincurchin, Arrokuda, Mantine']
    ],
    'Fraxure, Frosmoth, Barbaracle',
    { city: 'Circhester', leader: 'Gordie', badge: 'Rock Badge', type: 'rock', waves: 'Shuckle, Barbaracle | Stonjourner*1.2, Gigalith*' }
  ),
  S(
    'galar_7',
    'Spikemuth',
    [
      ['Route 9 Tunnel', 1, 'Woobat, Duskull, Gothita, Drilbur'],
      ['Route 9 Coast', 'water', 'Cramorant, Pincurchin, Wingull, Pyukumuku'],
      ['Spikemuth', 'dark', 'Scraggy, Purrloin, Inkay, Stunky, Morpeko, Nickit']
    ],
    'Gothorita, Skuntank, Liepard',
    { city: 'Spikemuth', leader: 'Piers', badge: 'Dark Badge', type: 'dark', waves: 'Scrafty, Toxicroak | Obstagoon*' }
  ),
  S(
    'galar_8',
    'Hammerlocke Hills',
    [
      ['Route 10', 'ice', 'Snorunt, Vanillish, Snover, Cubchoo, Klang'],
      ['Lake of Outrage', 'water', 'Lapras, Gyarados, Seaking, Dragonair'],
      ['Hammerlocke Hills', 'dragon', 'Drakloak, Fraxure, Noibat, Applin, Trapinch']
    ],
    'Abomasnow, Gyarados, Haxorus',
    { city: 'Hammerlocke', leader: 'Raihan', badge: 'Dragon Badge', type: 'dragon', waves: 'Flygon, Gigalith | Sandaconda*1.2, Duraludon*' }
  )
];

const PALDEA = [
  S(
    'paldea_1',
    'South Province',
    [
      ['South Province', 'normal', 'Lechonk, Tarountula, Nymble, Hoppip, Fletchling, Pawmi'],
      ['Poco Path', 'grass', 'Smoliv, Skwovet, Scatterbug, Wooper, Rookidee'],
      ['Cortondo Outskirts', 0, 'Sunkern, Kricketot, Combee, Spewpa']
    ],
    'Pawmo, Spidops, Lokix',
    { city: 'Cortondo', leader: 'Katy', badge: 'Bug Badge', type: 'bug', waves: 'Nymble, Tarountula | Teddiursa*' }
  ),
  S(
    'paldea_2',
    'Artazon Fields',
    [
      ['South Province Area Three', 'normal', 'Lechonk, Smoliv, Tarountula, Fidough, Buizel'],
      ['Artazon Fields', 'grass', 'Sunkern, Bramblin, Petilil, Hoppip, Skiddo'],
      ['South Province Area Five', 'water', 'Wingull, Finizen, Psyduck, Buizel']
    ],
    'Dachsbun, Arboliva, Floatzel',
    { city: 'Artazon', leader: 'Brassius', badge: 'Grass Badge', type: 'grass', waves: 'Petilil, Smoliv | Sudowoodo*' }
  ),
  S(
    'paldea_3',
    'East Province',
    [
      ['East Province', 'normal', 'Pawmo, Shinx, Tadbulb, Mareep, Wattrel'],
      ['East Province Area Two', 'rock', 'Nacli, Roggenrola, Geodude, Crabrawler'],
      ['Levincia City', 'electric', 'Tadbulb, Voltorb, Magnemite, Pachirisu, Wattrel']
    ],
    'Luxio, Naclstack, Flaaffy',
    { city: 'Levincia', leader: 'Iono', badge: 'Electric Badge', type: 'electric', waves: 'Wattrel, Bellibolt | Mismagius*' }
  ),
  S(
    'paldea_4',
    'Asado Desert',
    [
      ['Asado Desert', 'ground', 'Sandile, Silicobra, Hippopotas, Rellor, Cacnea, Orthworm'],
      ['West Province', 'normal', 'Flittle, Skwovet, Lechonk, Rookidee'],
      ['Cascarrafa Waterways', 'water', 'Wiglett, Finizen, Veluza, Magikarp, Arrokuda']
    ],
    'Krokorok, Orthworm, Veluza',
    { city: 'Cascarrafa', leader: 'Kofu', badge: 'Water Badge', type: 'water', waves: 'Veluza, Wugtrio | Crabominable*' }
  ),
  S(
    'paldea_5',
    'Medali',
    [
      ['West Province Area Three', 'grass', 'Skiddo, Bramblin, Flabébé, Hawlucha, Fomantis'],
      ['Medali Streets', 'normal', 'Lechonk, Girafarig, Indeedee, Deerling, Tandemaus'],
      ['Medali Plateau', 'rock', 'Nacli, Phanpy, Bonsly, Rockruff']
    ],
    'Lurantis, Oinkologne, Maushold',
    { city: 'Medali', leader: 'Larry', badge: 'Normal Badge', type: 'normal', waves: 'Komala, Dudunsparce | Staraptor*' }
  ),
  S(
    'paldea_6',
    'Glaseado Mountain',
    [
      ['Glaseado Foothills', 'ice', 'Snom, Snover, Cetoddle, Swablu'],
      ['Dalizapa Passage', 1, 'Bronzor, Snorunt, Shuppet, Greavard'],
      ['Montenevera Stage', 'ghost', 'Greavard, Shuppet, Misdreavus, Sinistea']
    ],
    'Cetitan, Bronzong, Dusclops',
    { city: 'Montenevera', leader: 'Ryme', badge: 'Ghost Badge', type: 'ghost', waves: 'Banette, Mimikyu | Houndstone*1.2, Toxtricity*' }
  ),
  S(
    'paldea_7',
    'Alfornada Cavern',
    [
      ['Alfornada Cavern', 1, 'Gligar, Noibat, Varoom, Zubat, Phanpy'],
      ['West Province Area One', 'grass', 'Flittle, Espurr, Indeedee, Girafarig, Hatenna'],
      ['Alfornada', 'psychic', 'Natu, Gothita, Bronzor, Rellor']
    ],
    'Gliscor, Hattrem, Gothorita',
    { city: 'Alfornada', leader: 'Tulip', badge: 'Psychic Badge', type: 'psychic', waves: 'Farigiraf, Gardevoir | Florges*' }
  ),
  S(
    'paldea_8',
    'Glaseado Summit',
    [
      ['Glaseado Mountain', 'ice', 'Snom, Cetoddle, Frigibax, Snover, Swinub, Bergmite'],
      ['Casseroya Lake', 'water', 'Tatsugiri, Lapras, Wingull, Finizen, Dondozo'],
      ['North Province', 'rock', 'Glimmet, Nacli, Roggenrola, Crabrawler']
    ],
    'Arctibax, Dondozo, Garganacl',
    { city: 'Glaseado', leader: 'Grusha', badge: 'Ice Badge', type: 'ice', waves: 'Frosmoth, Beartic | Cetitan*1.2, Altaria*' }
  )
];

export const Stages = (() => {
  // Same order as the collection's regions (gen 1..9). `art`: leader sprites exist.
  const REGIONS = [
    { id: 'kanto', name: 'Kanto', stages: KANTO, art: true },
    { id: 'johto', name: 'Johto', stages: JOHTO, art: true },
    { id: 'hoenn', name: 'Hoenn', stages: HOENN, art: true },
    { id: 'sinnoh', name: 'Sinnoh', stages: SINNOH, art: true },
    { id: 'unova', name: 'Unova', stages: UNOVA, art: true },
    { id: 'kalos', name: 'Kalos', stages: KALOS },
    { id: 'alola', name: 'Alola', stages: ALOLA },
    { id: 'galar', name: 'Galar', stages: GALAR },
    { id: 'paldea', name: 'Paldea', stages: PALDEA }
  ];

  const BY_NAME = {};
  for (const p of DEX) BY_NAME[p.name] = p.dex;
  const missing = [];
  const dex = n => {
    const d = BY_NAME[n.trim()];
    if (!d) missing.push(n.trim());
    return d;
  };
  const list = s => s.split(',').map(dex).filter(Boolean);
  /** 'A, B | C*' -> [[{ dex: A }, { dex: B }], [{ dex: C, k: 1.3 }]] */
  const waves = s =>
    s.split('|').map(w =>
      w
        .split(',')
        .map(m => {
          const [, name, star, k] = /^\s*(.+?)(\*([\d.]+)?)?\s*$/.exec(m);
          const d = dex(name);
          return d && (star ? { dex: d, k: k ? +k : 1.3 } : { dex: d });
        })
        .filter(Boolean)
    );

  const BY_ID = {};
  REGIONS.forEach((r, ri) =>
    r.stages.forEach((s, i) => {
      s.region = r.id;
      s.n = i + 1;
      s.pace = 180 + 60 * i + 30 * ri;
      s.prev = i ? r.stages[i - 1].id : null;
      s.next = r.stages[i + 1] ? r.stages[i + 1].id : null;
      s.legs = s.legs.map(([name, biome, mons], j) => ({ from: LEG_AT[j], name, biome, mons: list(mons) }));
      s.minis = list(s.minis).map((d, j) => ({ at: MINI_AT[j], dex: d }));
      const g = s.gym;
      g.name = g.site || g.city + ' Gym';
      g.title = g.title || 'Gym Leader';
      g.battle = g.battle || 'Gym battle';
      g.waves = waves(g.waves);
      BY_ID[s.id] = s;
    })
  );
  if (missing.length) console.warn('[Stages] unknown Pokémon:', missing.join(', '));

  /** Your progress on a stage (or null if never cleared). */
  const record = (save, id) => (save && save.story && save.story[id]) || null;
  const regionOf = s => REGIONS.find(r => r.id === s.region);

  return {
    REGIONS,
    BY_ID,
    missing,
    record,
    /** Cleared at least once (= its badge is yours). */
    cleared: (save, id) => !!record(save, id),
    /** Can be played: the first of its region, or the one before is cleared. */
    unlocked(save, id) {
      const s = BY_ID[id];
      return !!s && (!s.prev || !!record(save, s.prev));
    },
    /** The leader's sprite ('Lt. Surge' -> assets/trainers/kanto/ltsurge.png), or null if the region has none. */
    leaderArt: s => (regionOf(s).art ? `assets/trainers/${s.region}/${s.gym.leader.toLowerCase().replace(/[^a-z]/g, '')}.png` : null),
    /** The leader's ace: the last Pokémon of the last wave. */
    ace: s => s.gym.waves[s.gym.waves.length - 1].slice(-1)[0].dex,
    /** Badges earned in a region. */
    badges: (save, region) => (REGIONS.find(r => r.id === region) || { stages: [] }).stages.filter(s => record(save, s.id)).length
  };
})();
