/* ============ util.js — shared helpers ============ */
import { I18n } from './i18n.js';

/** Height at which projectiles and effects fly above the ground plane. */
export const LIFT = 18;

export const U = {
  clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  },
  lerp(a, b, t) {
    return a + (b - a) * t;
  },
  rand(a, b) {
    return a + Math.random() * (b - a);
  },
  randInt(a, b) {
    return Math.floor(a + Math.random() * (b - a + 1));
  },
  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  /** Picks n distinct random elements. */
  pickN(arr, n) {
    const c = arr.slice();
    const out = [];
    while (out.length < n && c.length) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
    return out;
  },

  dist(ax, ay, bx, by) {
    return Math.hypot(bx - ax, by - ay);
  },
  dist2(ax, ay, bx, by) {
    const dx = bx - ax,
      dy = by - ay;
    return dx * dx + dy * dy;
  },

  /** Normalizes a vector; returns [0,0] if it is zero. */
  norm(x, y) {
    const m = Math.hypot(x, y);
    return m > 1e-6 ? [x / m, y / m] : [0, 0];
  },

  /** Framerate-independent interpolation. */
  damp(a, b, rate, dt) {
    return b + (a - b) * Math.exp(-rate * dt);
  },

  /** Deterministic 2D hash -> [0,1). So the map is always generated the same. */
  hash(x, y, seed = 0) {
    // All in 32-bit integers with Math.imul: this is the most-called function
    // when baking the map, and this way V8 never leaves the fast path.
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  },

  /** A number for on-screen text, in the game's language (1.5 / 1,5). */
  num(v) {
    return (+v).toLocaleString(I18n ? I18n.locale : 'en-US', { maximumFractionDigits: 2 });
  },
  /** A fraction as a percentage number for text: 0.4 -> "40". */
  pct(v) {
    return U.num(Math.round(v * 10000) / 100);
  },

  /**
   * Text folded for searching: no accents, case, spaces or symbols ("Flabébé" ->
   * "flabebe", "Mr. Mime" -> "mrmime", "Nidoran♀" -> "nidoranf"). NFD splits each
   * accent from its letter, and the last step drops it with the rest of the symbols.
   */
  fold(s) {
    return String(s)
      .normalize('NFD')
      .replace(/♀/g, 'f')
      .replace(/♂/g, 'm')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  },

  /** "3:07" from seconds. */
  mmss(s) {
    const m = Math.floor(s / 60);
    return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  },

  /** Pokémon type colors (for projectiles, tags and effects). */
  TYPE_COLOR: {
    normal: '#b0a99f',
    fire: '#ff7b3d',
    water: '#4b9bff',
    grass: '#5fcb6a',
    electric: '#ffd33d',
    ice: '#7fe0e0',
    fighting: '#e0533d',
    poison: '#b45ec4',
    ground: '#d6b25c',
    flying: '#9bb8ff',
    psychic: '#ff5f9e',
    bug: '#a3c43d',
    rock: '#bfa96b',
    ghost: '#7a6bc4',
    dragon: '#6b58ff',
    dark: '#6b5c52',
    steel: '#a8b8c4',
    fairy: '#ff9ed8'
  },

  TYPE_NAME: {
    normal: 'Normal',
    fire: 'Fire',
    water: 'Water',
    grass: 'Grass',
    electric: 'Electric',
    ice: 'Ice',
    fighting: 'Fighting',
    poison: 'Poison',
    ground: 'Ground',
    flying: 'Flying',
    psychic: 'Psychic',
    bug: 'Bug',
    rock: 'Rock',
    ghost: 'Ghost',
    dragon: 'Dragon',
    dark: 'Dark',
    steel: 'Steel',
    fairy: 'Fairy'
  }
};
