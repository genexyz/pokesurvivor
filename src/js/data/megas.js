/* ============ megas.js — Mega Evolution and Primal Reversion forms ============
 * One entry per partner that can Mega Evolve during a run (systems/mega.js).
 *   key      sprite key (assets/pokemon/{key}/, MEGA_META) from scripts/fetch_sprites.py --megas
 *   item     its Mega Stone / Orb; stone = icon in assets/items/{stone}.png
 *   profile  stat multipliers in Balance.mega.profiles (atk, spd, cd, def); k overrides some
 *   aura     colour of the aura, rings and HUD
 * Only forms with a Mystery Dungeon sprite are listed: a form whose sheet isn't
 * downloaded (no MEGA_META entry) simply can't Mega Evolve.
 * The types stay the base ones.
 */
import { MEGA_META } from './sprites-meta-mega.js';

export const Megas = (() => {
  const m = (dex, key, name, item, stone, profile, aura, kind = 'mega') => ({ dex, key, name, item, stone, profile, aura, kind });
  const p = (dex, key, name, item, stone, profile, aura) => m(dex, key, name, item, stone, profile, aura, 'primal');
  const LIST = [
    m(6, 'm6x', 'Mega Charizard X', 'Charizardite X', 'charizardite-x', 'atk', '#4fb3ff'),
    m(65, 'm65', 'Mega Alakazam', 'Alakazite', 'alakazite', 'cd', '#ffd23f'),
    m(80, 'm80', 'Mega Slowbro', 'Slowbronite', 'slowbronite', 'def', '#ff9ed8'),
    m(94, 'm94', 'Mega Gengar', 'Gengarite', 'gengarite', 'cd', '#b06bff'),
    m(115, 'm115', 'Mega Kangaskhan', 'Kangaskhanite', 'kangaskhanite', 'atk', '#e0b070'),
    m(142, 'm142', 'Mega Aerodactyl', 'Aerodactylite', 'aerodactylite', 'spd', '#c9a6ff'),
    m(150, 'm150y', 'Mega Mewtwo Y', 'Mewtwonite Y', 'mewtwonite-y', 'cd', '#d77bff'),
    m(208, 'm208', 'Mega Steelix', 'Steelixite', 'steelixite', 'def', '#b0b8c8'),
    m(227, 'm227', 'Mega Skarmory', 'Skarmorite', 'skarmorite', 'def', '#ff6b6b'),
    m(229, 'm229', 'Mega Houndoom', 'Houndoominite', 'houndoominite', 'def', '#ff7b3d'),
    m(248, 'm248', 'Mega Tyranitar', 'Tyranitarite', 'tyranitarite', 'atk', '#7fd07f'),
    m(282, 'm282', 'Mega Gardevoir', 'Gardevoirite', 'gardevoirite', 'cd', '#7dffb0'),
    m(302, 'm302', 'Mega Sableye', 'Sablenite', 'sablenite', 'def', '#ff4d9a'),
    m(303, 'm303', 'Mega Mawile', 'Mawilite', 'mawilite', 'atk', '#ff8ad8'),
    m(308, 'm308', 'Mega Medicham', 'Medichamite', 'medichamite', 'atk', '#ff6b4d'),
    m(310, 'm310', 'Mega Manectric', 'Manectite', 'manectite', 'spd', '#ffe14d'),
    m(319, 'm319', 'Mega Sharpedo', 'Sharpedonite', 'sharpedonite', 'spd', '#5fb8ff'),
    m(323, 'm323', 'Mega Camerupt', 'Cameruptite', 'cameruptite', 'def', '#ff5a2d'),
    m(334, 'm334', 'Mega Altaria', 'Altarianite', 'altarianite', 'def', '#9fe8ff'),
    m(354, 'm354', 'Mega Banette', 'Banettite', 'banettite', 'def', '#c47bff'),
    m(359, 'm359', 'Mega Absol', 'Absolite', 'absolite', 'spd', '#e6ecff'),
    m(362, 'm362', 'Mega Glalie', 'Glalitite', 'glalitite', 'def', '#7fe0ff'),
    m(380, 'm380', 'Mega Latias', 'Latiasite', 'latiasite', 'cd', '#ff6b8a'),
    m(381, 'm381', 'Mega Latios', 'Latiosite', 'latiosite', 'cd', '#5f8aff'),
    p(382, 'm382', 'Primal Kyogre', 'Blue Orb', 'blue-orb', 'cd', '#3d8bff'),
    p(383, 'm383', 'Primal Groudon', 'Red Orb', 'red-orb', 'atk', '#ff4d2d'),
    m(384, 'm384', 'Mega Rayquaza', 'Meteorite', 'meteorite', 'spd', '#7dff9a'),
    m(428, 'm428', 'Mega Lopunny', 'Lopunnite', 'lopunnite', 'spd', '#ffcf8a'),
    m(448, 'm448', 'Mega Lucario', 'Lucarionite', 'lucarionite', 'atk', '#4f9dff'),
    m(475, 'm475', 'Mega Gallade', 'Galladite', 'galladite', 'atk', '#5fe08a'),
    p(483, 'm483', 'Primal Dialga', 'Adamant Orb', 'adamant-orb', 'cd', '#9fd0ff'),
    m(491, 'm491', 'Mega Darkrai', 'Darkranite', 'darkranite', 'cd', '#ff4d6d'),
    m(530, 'm530', 'Mega Excadrill', 'Excadrite', 'excadrite', 'atk', '#c0c8d8'),
    m(560, 'm560', 'Mega Scrafty', 'Scraftinite', 'scraftinite', 'atk', '#ff9a3d'),
    m(604, 'm604', 'Mega Eelektross', 'Eelektrossite', 'eelektrossite', 'cd', '#ffe14d'),
    m(670, 'm670', 'Mega Floette', 'Floettite', 'floettite', 'cd', '#ff7bb0'),
    m(691, 'm691', 'Mega Dragalge', 'Dragalgite', 'dragalgite', 'cd', '#a06bff'),
    m(718, 'm718', 'Mega Zygarde', 'Zygardite', 'zygardite', 'def', '#5fe08a'),
    m(719, 'm719', 'Mega Diancie', 'Diancite', 'diancite', 'cd', '#ff9ed8'),
    m(780, 'm780', 'Mega Drampa', 'Drampanite', 'drampanite', 'cd', '#9fe8b0'),
    m(807, 'm807', 'Mega Zeraora', 'Zeraorite', 'zeraorite', 'spd', '#7fe0ff'),
    m(978, 'm978', 'Mega Tatsugiri', 'Tatsugirinite', 'tatsugirinite', 'def', '#ff9a6b')
  ];
  const BY_DEX = {};
  for (const e of LIST) if (MEGA_META[e.key]) BY_DEX[e.dex] = e;

  return {
    LIST,
    /** The Mega form of that partner, or null. */
    of: dex => BY_DEX[dex] || null
  };
})();
