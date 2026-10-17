/* ============ tiles.js — world pixel art, painted in code ============
 * Everything is painted at ART resolution (16 px per tile) by writing into an
 * ImageData, then drawn scaled ×Sprites.PX without smoothing. That way the
 * tiles share the pixel size of the Mystery Dungeon sprites.
 *
 * Autotiling: each tile looks at its 8 neighbours when painted (wall edges,
 * front face, rounded corners, shoreline foam...).
 */
import { U } from '../core/util.js';

export const Tiles = (() => {
  const T = 16; // art pixels per tile

  const BIOMES = [
    {
      name: 'Shady Forest',
      liquid: 'water',
      floor: ['#3e7a39', '#44813d', '#397134'],
      dirt: ['#7d6742', '#735e3b', '#86704a'],
      speck: '#2f5f2b',
      light: '#5f9d50',
      flowers: ['#f4d65c', '#f39ac0', '#eef2ff'],
      wallTop: ['#5d6e49', '#677a50', '#566544'],
      wallLight: '#88a06e',
      wallEdge: '#26301f',
      wallFace: ['#3e4934', '#363f2d'],
      wallFaceDark: '#232a1d',
      liq: '#3b7fc6',
      liqDeep: '#2c64a6',
      foam: '#b3defa',
      shore: '#2b5b2a',
      prop: 'tree',
      leaf: ['#235a2b', '#2f7535', '#45943f', '#64b252'],
      trunk: ['#5b3b22', '#7a5130'],
      rock: ['#5e6670', '#7f8893', '#a1aab4'],
      grass: ['#2f6b2c', '#4c9a3f', '#7cc45a']
    },
    {
      name: 'Crystal Cave',
      liquid: 'water',
      floor: ['#4d5778', '#535e81', '#47506f'],
      dirt: ['#3c4462', '#424a69', '#37405b'],
      speck: '#3b4363',
      light: '#6a78a4',
      flowers: ['#8fe3ff', '#c9a6ff', '#7ef0d0'],
      wallTop: ['#5f5089', '#695996', '#56497d'],
      wallLight: '#a08ddc',
      wallEdge: '#1f1934',
      wallFace: ['#3f3463', '#382e59'],
      wallFaceDark: '#221c3a',
      liq: '#2a9cab',
      liqDeep: '#1d7c8a',
      foam: '#aaf4f7',
      shore: '#33405e',
      prop: 'crystal',
      leaf: ['#5ad1e8', '#8fe7f5', '#c8f7ff', '#ffffff'],
      trunk: ['#3a4a78', '#4e64a0'],
      rock: ['#555d79', '#737c9c', '#959fc0'],
      grass: ['#3d5c8a', '#5a86c0', '#8ab8ee']
    },
    {
      name: 'Ash Volcano',
      liquid: 'lava',
      floor: ['#5b4537', '#644c3c', '#533f32'],
      dirt: ['#403530', '#473b34', '#392f2b'],
      speck: '#47362b',
      light: '#806452',
      flowers: ['#ff8d3d', '#ffc45e', '#e06a4a'],
      wallTop: ['#3c3634', '#443d3a', '#35302e'],
      wallLight: '#625752',
      wallEdge: '#141110',
      wallFace: ['#2b2624', '#25201f'],
      wallFaceDark: '#151211',
      liq: '#e45a1f',
      liqDeep: '#b9401a',
      foam: '#ffd46a',
      shore: '#3a2a22',
      prop: 'dead',
      leaf: ['#4a3a30', '#5e4a3c', '#6f5a49', '#806a58'],
      trunk: ['#3a2e27', '#52423a'],
      rock: ['#4e4642', '#6a605b', '#877c76'],
      grass: ['#6b4a2a', '#94693a', '#c4914e']
    }
  ];
  const NORMAL = 3; // biomes that take turns during a run
  const ARENA = 3; // from here on, the rift arenas (one per type)

  // ---------------- rift arenas ----------------
  /*
   * Each type has its own arena: palette, terrain and weather.
   *   liquid   pools: water (slows) · swamp (slows more) · lava (burns) ·
   *            poison (poisons) · spark (shocks) · ice (slippery)
   *   pools    how much terrain is pool (0 = none)
   *   pillars  chance of a 2×2 pillar (cover) per block
   *   props    density of trees / rocks / grass
   *   weather  weather it brings (see systems/weather.js) or null
   */
  const ARENA_THEMES = {
    normal: {
      name: 'Eternal Meadow',
      floor: '#6f8a4f',
      wall: '#8a7f6a',
      liquid: 'water',
      liq: '#4f8fd0',
      prop: 'tree',
      leaf: '#5aa04a',
      trunk: '#6b4a2a',
      flowers: ['#f4d65c', '#ffffff', '#f39ac0'],
      grass: '#5a9a40',
      rock: '#8a8a8a',
      pools: 0,
      pillars: 0.035,
      props: { tree: 0.025, grass: 0.05 },
      weather: null
    },
    fire: {
      name: 'Igneous Volcano',
      floor: '#5b3a2e',
      wall: '#3a2826',
      liquid: 'lava',
      liq: '#e45a1f',
      foam: '#ffd46a',
      prop: 'dead',
      leaf: '#5e4a3c',
      trunk: '#3a2e27',
      flowers: ['#ff8d3d', '#ffc45e', '#e06a4a'],
      grass: '#94693a',
      rock: '#6a605b',
      pools: 0.31,
      pillars: 0.03,
      props: { tree: 0.01 },
      weather: 'sun'
    },
    water: {
      name: 'Sea Grotto',
      floor: '#3c6a80',
      wall: '#2a4660',
      liquid: 'water',
      liq: '#2f86d6',
      foam: '#bfeaff',
      prop: 'crystal',
      leaf: '#5fd0e8',
      trunk: '#2a4a78',
      flowers: ['#ff9ec4', '#7ef0d0', '#ffffff'],
      grass: '#3f8a9a',
      rock: '#5d7a90',
      pools: 0.33,
      pillars: 0.02,
      props: { tree: 0.015 },
      weather: 'rain'
    },
    grass: {
      name: 'Emerald Jungle',
      floor: '#3a7a32',
      wall: '#4a6a36',
      liquid: 'swamp',
      liq: '#4f6b2a',
      foam: '#9ac25a',
      prop: 'tree',
      leaf: '#3f9a3a',
      trunk: '#5b3b22',
      flowers: ['#f4d65c', '#ff8ad8', '#ffffff'],
      grass: '#4caa3f',
      rock: '#6a7a5a',
      pools: 0.22,
      pillars: 0,
      props: { tree: 0.05, grass: 0.12 },
      weather: null
    },
    electric: {
      name: 'Volt Plant',
      floor: '#4a4840',
      wall: '#3a3a48',
      liquid: 'spark',
      liq: '#e8c020',
      foam: '#fff6c0',
      prop: 'crystal',
      leaf: '#ffd23f',
      trunk: '#5a5030',
      flowers: ['#ffe14d', '#ffffff', '#7fd0ff'],
      grass: '#8a8a40',
      rock: '#70707a',
      pools: 0.28,
      pillars: 0.04,
      props: { tree: 0.01 },
      weather: 'rain'
    },
    ice: {
      name: 'Eternal Glacier',
      floor: '#b8cfe0',
      wall: '#7f9fc0',
      liquid: 'ice',
      liq: '#9fd8f0',
      foam: '#ffffff',
      prop: 'crystal',
      leaf: '#bfe8ff',
      trunk: '#6f8fb0',
      flowers: ['#ffffff', '#9fe0ff', '#d8f1ff'],
      grass: '#9fc0d8',
      rock: '#8fa8c0',
      pools: 0.36,
      pillars: 0.02,
      props: { tree: 0.02 },
      weather: 'snow'
    },
    fighting: {
      name: 'Ancient Dojo',
      floor: '#8a6a46',
      wall: '#5e4232',
      liquid: 'water',
      liq: '#4f8fd0',
      prop: 'tree',
      leaf: '#4f8a3a',
      trunk: '#5b3b22',
      flowers: ['#ff5f6d', '#f4d65c', '#ffffff'],
      grass: '#6a8a40',
      rock: '#8a7a6a',
      pools: 0,
      pillars: 0.075,
      props: { tree: 0.008 },
      weather: null
    },
    poison: {
      name: 'Toxic Swamp',
      floor: '#46384f',
      wall: '#33263f',
      liquid: 'poison',
      liq: '#9a4fc0',
      foam: '#e0a6ff',
      prop: 'dead',
      leaf: '#5a4a6a',
      trunk: '#3a2f45',
      flowers: ['#c86bdc', '#8bd94a', '#e0a6ff'],
      grass: '#6a5a8a',
      rock: '#5a4f6a',
      pools: 0.31,
      pillars: 0.015,
      props: { tree: 0.02 },
      weather: null
    },
    ground: {
      name: 'Red Desert',
      floor: '#b08a52',
      wall: '#8a5e34',
      liquid: 'swamp',
      liq: '#9a7a48',
      foam: '#d6b98a',
      prop: 'dead',
      leaf: '#8a6a40',
      trunk: '#6a4a2a',
      flowers: ['#e06a4a', '#f4d65c', '#ffffff'],
      grass: '#b0904a',
      rock: '#9a7a5a',
      pools: 0.25,
      pillars: 0.04,
      props: { tree: 0.01, rock: 0.015 },
      weather: 'sand'
    },
    flying: {
      name: 'Sky Peak',
      floor: '#9fb8d8',
      wall: '#dfe8f4',
      liquid: 'water',
      liq: '#7fb8ff',
      prop: 'tree',
      leaf: '#e8f2ff',
      trunk: '#9aa8c0',
      flowers: ['#ffffff', '#ffe14d', '#bfe0ff'],
      grass: '#b8d0e8',
      rock: '#c0ccdc',
      pools: 0,
      pillars: 0.02,
      props: { tree: 0.025 },
      weather: null
    },
    psychic: {
      name: 'Mind Temple',
      floor: '#5e4470',
      wall: '#3e2a55',
      liquid: 'water',
      liq: '#8a5ad0',
      prop: 'crystal',
      leaf: '#ff8ad8',
      trunk: '#5a3a7a',
      flowers: ['#ff8ad8', '#c9a6ff', '#ffffff'],
      grass: '#8a5a9a',
      rock: '#7a6a8a',
      pools: 0,
      pillars: 0.045,
      props: { tree: 0.02 },
      weather: null
    },
    bug: {
      name: 'Hive Forest',
      floor: '#5a6a2a',
      wall: '#5e4a26',
      liquid: 'swamp',
      liq: '#6a7a2a',
      foam: '#c4d65a',
      prop: 'tree',
      leaf: '#8aaa30',
      trunk: '#5b3b22',
      flowers: ['#f4d65c', '#ffffff', '#c4d65a'],
      grass: '#8aaa30',
      rock: '#7a7a5a',
      pools: 0.2,
      pillars: 0,
      props: { tree: 0.04, grass: 0.12 },
      weather: null
    },
    rock: {
      name: 'Ancient Quarry',
      floor: '#7a6a58',
      wall: '#55473a',
      liquid: 'water',
      liq: '#4f8fd0',
      prop: 'dead',
      leaf: '#6a5a4a',
      trunk: '#4a3e32',
      flowers: ['#c9b28a', '#ffffff', '#a89070'],
      grass: '#8a7a5a',
      rock: '#8a7a6a',
      pools: 0,
      pillars: 0.08,
      props: { rock: 0.03 },
      weather: 'sand'
    },
    ghost: {
      name: 'Gloomy Graveyard',
      floor: '#383447',
      wall: '#24202e',
      liquid: 'water',
      liq: '#3a3a6a',
      prop: 'dead',
      leaf: '#4a4060',
      trunk: '#2e2838',
      flowers: ['#9a8ad0', '#5fe0c0', '#c9cfdc'],
      grass: '#4a4a60',
      rock: '#5a5670',
      pools: 0,
      pillars: 0.03,
      props: { tree: 0.03 },
      weather: 'fog'
    },
    dragon: {
      name: 'Dragon Sanctuary',
      floor: '#363a5e',
      wall: '#24264a',
      liquid: 'lava',
      liq: '#7b5cff',
      foam: '#c9a6ff',
      prop: 'crystal',
      leaf: '#7b5cff',
      trunk: '#2a2a5a',
      flowers: ['#7b5cff', '#ffd23f', '#ffffff'],
      grass: '#4a4a8a',
      rock: '#5a5a8a',
      pools: 0.22,
      pillars: 0.04,
      props: { tree: 0.015 },
      weather: null
    },
    dark: {
      name: 'Dark Alley',
      floor: '#2c282e',
      wall: '#1c181f',
      liquid: 'water',
      liq: '#2a2a3a',
      prop: 'dead',
      leaf: '#3a3040',
      trunk: '#241e28',
      flowers: ['#ff5f6d', '#6b5c52', '#9a8a9a'],
      grass: '#3a343a',
      rock: '#4a444a',
      pools: 0,
      pillars: 0.05,
      props: { tree: 0.02 },
      weather: null
    },
    steel: {
      name: 'Steel Fortress',
      floor: '#6d7888',
      wall: '#465060',
      liquid: 'water',
      liq: '#4f8fd0',
      prop: 'crystal',
      leaf: '#c9d2de',
      trunk: '#5d6773',
      flowers: ['#c9d2de', '#ffd23f', '#ffffff'],
      grass: '#8a96a6',
      rock: '#9aa6b5',
      pools: 0,
      pillars: 0.08,
      props: { tree: 0.01 },
      weather: null
    },
    fairy: {
      name: 'Enchanted Forest',
      floor: '#4f7f5a',
      wall: '#7a5a8a',
      liquid: 'water',
      liq: '#8fd8ff',
      foam: '#ffe0f4',
      prop: 'tree',
      leaf: '#e08ad0',
      trunk: '#6b4a5a',
      flowers: ['#ff8ad8', '#ffffff', '#c9a6ff'],
      grass: '#c48ad8',
      rock: '#9a8aa8',
      pools: 0.16,
      pillars: 0,
      props: { tree: 0.05, grass: 0.1 },
      weather: null
    },
    // Arceus's arena at minute 30 (systems/judgment.js): ash, ruins and
    // dead trees, with a clearing where it lands (clear). Not part of any rift.
    judgment: {
      name: 'Ruins of Judgment',
      floor: '#4a4240',
      wall: '#2e2829',
      liquid: 'lava',
      liq: '#e8a82a',
      foam: '#fff1b8',
      prop: 'dead',
      leaf: '#3e3633',
      trunk: '#2a2321',
      flowers: ['#8a7f76', '#e8a82a', '#5a514c'],
      grass: '#5e544c',
      rock: '#6a625c',
      pools: 0,
      pillars: 0.03,
      props: { tree: 0.012, rock: 0.02 },
      weather: null,
      clear: 4.5
    }
  };
  const ARENA_TYPES = Object.keys(ARENA_THEMES);

  /** Lightens (k>0) or darkens (k<0) a color. */
  function shade(hex, k) {
    const c = rgb(hex).map(v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }

  /** Full biome palette from an arena's few colors. */
  function arenaBiome(th) {
    const f = th.floor,
      w = th.wall,
      L = th.liq;
    return {
      name: 'Rift · ' + th.name,
      liquid: th.liquid,
      floor: [f, shade(f, 0.05), shade(f, -0.06)],
      dirt: [shade(f, -0.16), shade(f, -0.12), shade(f, -0.2)],
      speck: shade(f, -0.25),
      light: shade(f, 0.22),
      flowers: th.flowers,
      wallTop: [w, shade(w, 0.07), shade(w, -0.07)],
      wallLight: shade(w, 0.32),
      wallEdge: shade(w, -0.7),
      wallFace: [shade(w, -0.3), shade(w, -0.38)],
      wallFaceDark: shade(w, -0.55),
      liq: L,
      liqDeep: shade(L, -0.22),
      foam: th.foam || shade(L, 0.55),
      shore: shade(f, -0.32),
      prop: th.prop,
      leaf: [shade(th.leaf, -0.35), shade(th.leaf, -0.15), th.leaf, shade(th.leaf, 0.3)],
      trunk: [shade(th.trunk, -0.2), th.trunk],
      rock: [shade(th.rock, -0.2), th.rock, shade(th.rock, 0.22)],
      grass: [shade(th.grass, -0.28), th.grass, shade(th.grass, 0.28)]
    };
  }
  for (const t of ARENA_TYPES) BIOMES.push(arenaBiome(ARENA_THEMES[t]));
  BIOMES[ARENA + ARENA_TYPES.indexOf('judgment')].name = ARENA_THEMES.judgment.name;

  // ---------------- color / pixel utilities ----------------

  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // ABGR packing (little-endian) to write straight into a Uint32Array.
  function pack(hex, a = 255) {
    const [r, g, b] = rgb(hex);
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  /** Mixes two hex colors and returns the packed value. */
  function mixPack(h1, h2, t) {
    const a = rgb(h1),
      b = rgb(h2);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
  }

  /** Pixel canvas: set(x,y,color) and canvas() at the end. */
  function Pix(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    // Kept in CPU memory: on mobile (Firefox above all) GPU-backed canvases filled with
    // putImageData sometimes came out empty, leaving black holes in the ground.
    const c = cv.getContext('2d', { willReadFrequently: true });
    const img = c.createImageData(w, h);
    const buf = new Uint32Array(img.data.buffer);
    return {
      w,
      h,
      buf, // row-major pixels, for the hot loops (paintFloor writes them directly)
      set(x, y, col) {
        if (x >= 0 && y >= 0 && x < w && y < h) buf[y * w + x] = col;
      },
      get(x, y) {
        return buf[y * w + x];
      },
      canvas() {
        c.putImageData(img, 0, 0);
        return cv;
      }
    };
  }

  const H = (x, y, s) => U.hash(x, y, s);

  // ---------------- ground chunk ----------------

  /**
   * The chunk's dirt mask at pixel resolution (plus one extra row
   * above to detect edges). Noise is evaluated every 4 px and interpolated:
   * ~30 times fewer calls than evaluating it pixel by pixel.
   * Built on demand, row by row (upTo), so a chunk can be painted over several frames.
   * mask[(y + 1) * W + x] is 1 for dirt (chunk-local coordinates; y may be -1).
   */
  function dirtMask(gx0, gy0, W, field, seed) {
    const S = 4,
      gw = W / S + 3;
    const grid = new Float32Array(gw * gw);
    const mask = new Uint8Array(W * (W + 1));
    // The per-pixel jitter hash is the same for each 2×2 block (gx0, gy0 are even): one row of it, reused.
    const jit = new Float64Array(W / 2);
    let gridRows = 0,
      next = -1, // next mask row to build
      jitY = NaN;
    function gridTo(j) {
      for (; gridRows <= j; gridRows++)
        for (let i = 0; i < gw; i++) grid[gridRows * gw + i] = field(gx0 + (i - 1) * S, gy0 + (gridRows - 1) * S);
    }
    function upTo(yMax) {
      for (; next <= yMax; next++) {
        const y = next;
        const fy = (y + S) / S,
          j = Math.floor(fy),
          v = fy - j;
        gridTo(j + 1);
        const hy = (gy0 + y) >> 1;
        if (hy !== jitY) {
          for (let i = 0; i < W / 2; i++) jit[i] = H((gx0 >> 1) + i, hy, seed + 9);
          jitY = hy;
        }
        const g0 = j * gw + 1,
          g1 = g0 + gw,
          o = (y + 1) * W;
        for (let x = 0; x < W; x++) {
          // (x + S) / S split exactly into its whole part and fraction (S = 4).
          const i = x >> 2,
            u = (x & 3) * 0.25;
          const a = grid[g0 + i],
            b = grid[g0 + i + 1];
          const c = grid[g1 + i],
            d = grid[g1 + i + 1];
          let val = (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
          val += (jit[x >> 1] - 0.5) * 0.05;
          mask[o + x] = val > 0.64 ? 1 : 0;
        }
      }
    }
    return { mask, upTo };
  }

  /**
   * Paints an n×n tile chunk, a row of tiles at a time. `at(tx,ty)` returns the global
   * terrain type ('floor' | 'wall' | 'liquid'), so autotiling can see past the chunk edge.
   * job.step(deadline) paints rows until performance.now() passes `deadline` (always at
   * least one) and returns the canvas once the chunk is complete, else null. A whole chunk
   * takes 10-40 ms on a phone: in one go it was a visible hitch (worst when entering or
   * leaving a rift, where every chunk on screen is new); a row is ~1/16 of that.
   */
  function chunkJob(cx, cy, n, at, dirtField, bi, seed = 0) {
    const B = BIOMES[bi];
    const P = Pix(n * T, n * T);
    const C = {};
    for (const k of ['floor', 'dirt', 'wallTop', 'wallFace', 'flowers', 'grass']) C[k] = B[k].map(h => pack(h));
    for (const k of ['speck', 'light', 'wallLight', 'wallEdge', 'wallFaceDark', 'liq', 'liqDeep', 'foam', 'shore']) C[k] = pack(B[k]);
    C.liqLight = mixPack(B.liq, B.foam, 0.28);

    const tx0 = cx * n,
      ty0 = cy * n;
    const dirt = dirtMask(tx0 * T, ty0 * T, n * T, dirtField, seed);
    let j = 0;

    return {
      step(deadline) {
        while (j < n) {
          dirt.upTo(j * T + T - 1);
          for (let i = 0; i < n; i++) {
            const tx = tx0 + i,
              ty = ty0 + j;
            const ox = i * T,
              oy = j * T;
            const kind = at(tx, ty);

            // 1) Ground under everything (rounded wall corners let it show).
            paintFloor(P, C, ox, oy, tx, ty, dirt.mask, at);

            if (kind === 'wall') paintWall(P, C, ox, oy, tx, ty, at);
            else if (kind === 'liquid') paintLiquid(P, C, ox, oy, tx, ty, at);
          }
          j++;
          if (performance.now() > deadline) break;
        }
        return j < n ? null : P.canvas();
      }
    };
  }

  /** `mask`: the chunk's dirt mask (dirtMask), indexed (ly + 1) * width + lx. */
  function paintFloor(P, C, ox, oy, tx, ty, mask, at) {
    const W = P.w,
      buf = P.buf;
    let dirtCount = 0;
    for (let y = 0; y < T; y++) {
      const gy = ty * T + y,
        ly = oy + y; // chunk-local
      // Smooth tone, constant over 8×8 px: two values per tile row (gx >> 3 = tx * 2 + (x >> 3)).
      const bandA = H(tx * 2, gy >> 3, 11) * 0.7,
        bandB = H(tx * 2 + 1, gy >> 3, 11) * 0.7;
      const row = (ly + 1) * W + ox,
        up = ly * W + ox, // the pixel above
        out = ly * W + ox;
      for (let x = 0; x < T; x++) {
        const gx = tx * T + x;
        const dirt = mask[row + x] === 1;
        if (dirt) dirtCount++;
        const pal = dirt ? C.dirt : C.floor;
        // Tone from smooth noise + per-pixel dithering.
        const band = (x < 8 ? bandA : bandB) + H(gx, gy, 12) * 0.5;
        let col = pal[Math.min(pal.length - 1, Math.floor((band * pal.length) / 1.2))];
        const r = H(gx, gy, 13);
        if (r < 0.035) col = C.speck;
        else if (r > 0.985) col = C.light;
        // Dirt edge: dark lip on top, grass creeping in below.
        const dirtUp = mask[up + x] === 1;
        if (dirt && !dirtUp) col = C.speck;
        else if (!dirt && dirtUp && r < 0.5) col = C.light;
        buf[out + x] = col;
      }
    }
    const dirt = dirtCount > (T * T) / 2;
    // Contact shadow under walls directly to the north.
    if (at(tx, ty - 1) === 'wall') {
      for (let x = 0; x < T; x++) {
        P.set(ox + x, oy, C.wallFaceDark);
        if ((x + ty) % 2) P.set(ox + x, oy + 1, C.speck);
      }
    }

    // Details: tuft, pebble or flower.
    const d = H(tx, ty, 14);
    const dx = ox + 3 + Math.floor(H(tx, ty, 15) * 10),
      dy = oy + 4 + Math.floor(H(tx, ty, 16) * 9);
    if (dirt) {
      if (d < 0.22) {
        P.set(dx, dy, C.light);
        P.set(dx + 1, dy, C.light);
        P.set(dx, dy + 1, C.speck);
        P.set(dx + 1, dy + 1, C.speck);
      }
      return;
    }
    if (d < 0.18) {
      // tuft
      P.set(dx, dy, C.light);
      P.set(dx - 1, dy - 1, C.light);
      P.set(dx + 1, dy - 1, C.light);
      P.set(dx, dy - 2, C.light);
      P.set(dx, dy + 1, C.speck);
    } else if (d < 0.26) {
      // flower
      const fc = C.flowers[Math.floor(H(tx, ty, 17) * C.flowers.length)];
      P.set(dx, dy - 1, fc);
      P.set(dx - 1, dy, fc);
      P.set(dx + 1, dy, fc);
      P.set(dx, dy + 1, fc);
      P.set(dx, dy, C.light);
    } else if (d < 0.32) {
      // pebble
      P.set(dx, dy, C.light);
      P.set(dx + 1, dy, C.light);
      P.set(dx, dy + 1, C.speck);
      P.set(dx + 1, dy + 1, C.speck);
    }
  }

  function paintWall(P, C, ox, oy, tx, ty, at) {
    const W = (x, y) => at(x, y) === 'wall';
    const n = W(tx, ty - 1),
      s = W(tx, ty + 1),
      w = W(tx - 1, ty),
      e = W(tx + 1, ty);
    const FACE = s ? 0 : 6; // visible front-face rows

    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        // Rounded outer corners: let the ground show.
        if (!n && !w && x + y < 3) continue;
        if (!n && !e && T - 1 - x + y < 3) continue;
        if (!s && !w && x + (T - 1 - y) < 2) continue;
        if (!s && !e && T - 1 - x + (T - 1 - y) < 2) continue;

        const gx = tx * T + x,
          gy = ty * T + y;
        let col;
        if (y >= T - FACE) {
          // Front face: vertical streaks and dark base.
          const fy = y - (T - FACE);
          col = C.wallFace[(x + (H(gx, 0, 21) < 0.5 ? 0 : 1)) % 3 === 0 ? 1 : 0];
          if (fy === 0) col = C.wallEdge;
          else if (y === T - 1) col = C.wallFaceDark;
          else if (H(gx, gy, 22) < 0.08) col = C.wallFaceDark;
        } else {
          // Dithered top face.
          col = C.wallTop[Math.floor(H(gx >> 1, gy >> 1, 23) * 2.2 + H(gx, gy, 24) * 0.8) % C.wallTop.length];
          if (H(gx, gy, 25) < 0.05) col = C.wallLight;
          // Edges: light to the north, dark outline on the sides.
          if (!n && y === 0) col = C.wallEdge;
          else if (!n && y === 1) col = C.wallLight;
          if (!w && x === 0) col = C.wallEdge;
          if (!e && x === T - 1) col = C.wallEdge;
        }
        P.set(ox + x, oy + y, col);
      }
    }
  }

  function paintLiquid(P, C, ox, oy, tx, ty, at) {
    const L = (x, y) => at(x, y) === 'liquid';
    const n = L(tx, ty - 1),
      s = L(tx, ty + 1),
      w = L(tx - 1, ty),
      e = L(tx + 1, ty);
    const nw = L(tx - 1, ty - 1),
      ne = L(tx + 1, ty - 1),
      sw = L(tx - 1, ty + 1),
      se = L(tx + 1, ty + 1);
    const BIG = 99;

    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        // Rounded outer corners: let the ground beneath show.
        if (!n && !w && x + y < 3) continue;
        if (!n && !e && T - 1 - x + y < 3) continue;
        if (!s && !w && x + (T - 1 - y) < 3) continue;
        if (!s && !e && T - 1 - x + (T - 1 - y) < 3) continue;

        // Distance to the shore within the tile (includes inner corners).
        let d = Math.min(n ? BIG : y, s ? BIG : T - 1 - y, w ? BIG : x, e ? BIG : T - 1 - x);
        if (n && w && !nw) d = Math.min(d, Math.hypot(x, y) - 0.5);
        if (n && e && !ne) d = Math.min(d, Math.hypot(T - 1 - x, y) - 0.5);
        if (s && w && !sw) d = Math.min(d, Math.hypot(x, T - 1 - y) - 0.5);
        if (s && e && !se) d = Math.min(d, Math.hypot(T - 1 - x, T - 1 - y) - 0.5);

        const gx = tx * T + x,
          gy = ty * T + y;
        const r = H(gx, gy, 31);
        let col;
        if (d < 1)
          col = C.shore; // dirt lip
        else if (d < 2)
          col = C.foam; // foam
        else if (d < 4)
          col = C.liqLight; // shallow water
        else if (d < 6) col = r < 0.5 ? C.liq : C.liqLight;
        else col = d < 8 && r < 0.5 ? C.liq : C.liqDeep;
        if (d >= 6 && d < BIG && r < 0.08) col = C.liq;

        // Scattered ripples: a few 3 px horizontal dashes.
        if (d >= 3 && H(gx >> 2, gy, 33) < 0.045 && (gx & 3) !== 3) col = C.liqLight;
        if (d >= 3 && H(gx, gy, 34) < 0.004) col = C.foam;
        P.set(ox + x, oy + y, col);
      }
    }
  }

  // ---------------- scenery object sprites ----------------

  const propCache = new Map(); // "biome/type/variant" -> canvas

  function propSprite(bi, type, variant = 0) {
    const k = bi + '/' + type + '/' + variant;
    let cv = propCache.get(k);
    if (!cv) {
      cv = PAINT[type](BIOMES[bi], variant);
      propCache.set(k, cv);
    }
    return cv;
  }

  function disc(P, cx, cy, r, colFn) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) {
          const c = colFn(x, y, d / r);
          if (c != null) P.set(x, y, c);
        }
      }
  }

  function outline(P, col) {
    // 1 px outline around everything opaque.
    const marks = [];
    for (let y = 0; y < P.h; y++)
      for (let x = 0; x < P.w; x++) {
        if (P.get(x, y) >>> 24) continue;
        const near = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ].some(([a, b]) => {
          const xx = x + a,
            yy = y + b;
          return xx >= 0 && yy >= 0 && xx < P.w && yy < P.h && P.get(xx, yy) >>> 24;
        });
        if (near) marks.push([x, y]);
      }
    for (const [x, y] of marks) P.set(x, y, col);
  }

  const PAINT = {
    tree(B) {
      const P = Pix(30, 40);
      const L = B.leaf.map(h => pack(h)),
        Tr = B.trunk.map(h => pack(h));
      const edge = pack('#14200f');
      if (B.prop === 'crystal') return PAINT.crystal(B);
      if (B.prop === 'dead') return PAINT.deadtree(B);
      for (let y = 26; y < 38; y++) for (let x = 13; x < 18; x++) P.set(x, y, Tr[x === 13 || x === 17 ? 0 : 1]);
      P.set(12, 37, Tr[0]);
      P.set(18, 37, Tr[0]);
      P.set(11, 38, Tr[0]);
      P.set(19, 38, Tr[0]);
      const blobs = [
        [15, 20, 10],
        [9, 16, 7],
        [21, 16, 7],
        [15, 10, 8],
        [10, 23, 6],
        [20, 23, 6]
      ];
      for (const [bx, by, br] of blobs) {
        disc(P, bx, by, br, (x, y, d) => {
          // Light from the top left.
          const lit = ((x - bx) * -0.6 + (y - by) * -0.8) / br;
          const idx = lit > 0.45 ? 3 : lit > 0.05 ? 2 : lit > -0.45 ? 1 : 0;
          return H(x, y, 41) < 0.12 && idx > 0 ? L[idx - 1] : L[idx];
        });
      }
      outline(P, edge);
      return P.canvas();
    },

    crystal(B) {
      const P = Pix(26, 40);
      const L = B.leaf.map(h => pack(h)),
        D = B.trunk.map(h => pack(h));
      const spires = [
        [13, 2, 5, 38],
        [7, 14, 4, 38],
        [19, 12, 4, 38]
      ];
      for (const [cx, top, half, bot] of spires) {
        for (let y = top; y <= bot; y++) {
          const t = Math.min(1, (y - top) / 8);
          const hw = Math.round(half * t);
          for (let x = cx - hw; x <= cx + hw; x++) {
            const side = x < cx ? (x === cx - hw ? 3 : 2) : x === cx ? 1 : 0;
            P.set(x, y, side >= 2 ? L[side] : y > bot - 4 ? D[1] : L[side]);
          }
        }
      }
      outline(P, D[0]);
      return P.canvas();
    },

    deadtree(B) {
      const P = Pix(28, 40);
      const Tr = B.trunk.map(h => pack(h)),
        L = B.leaf.map(h => pack(h));
      for (let y = 12; y < 38; y++) for (let x = 12; x < 16; x++) P.set(x, y, Tr[x < 14 ? 0 : 1]);
      const branch = (x0, y0, dx, len) => {
        for (let i = 0; i < len; i++) {
          P.set(x0 + dx * i, y0 - i, L[1]);
          P.set(x0 + dx * i, y0 - i + 1, L[0]);
        }
      };
      branch(12, 20, -1, 9);
      branch(15, 17, 1, 10);
      branch(13, 13, -1, 7);
      branch(14, 12, 1, 6);
      outline(P, pack('#0f0b09'));
      return P.canvas();
    },

    rock(B, variant) {
      const P = Pix(22, 17);
      const R = B.rock.map(h => pack(h));
      const shine = pack('#ffffff');
      // Squat boulder: ellipse wider than tall, flat base.
      for (let y = 2; y <= 15; y++)
        for (let x = 1; x <= 20; x++) {
          const nx = (x - 10.5) / 9.5,
            ny = (y - 9.5) / 7;
          const d = nx * nx + ny * ny + (H(x, y, 61) - 0.5) * 0.08;
          if (d > 1) continue;
          const lit = -nx * 0.55 - ny * 0.85 + (H(x, y, 62) - 0.5) * 0.25;
          let c = R[lit > 0.4 ? 2 : lit > -0.15 ? 1 : 0];
          if (y >= 14) c = R[0];
          P.set(x, y, c);
        }
      // Shine and texture.
      [
        [6, 5],
        [7, 5],
        [6, 6],
        [8, 4]
      ].forEach(([x, y]) => P.set(x, y, shine));
      [
        [13, 8],
        [14, 9],
        [9, 11],
        [16, 11],
        [11, 7]
      ].forEach(([x, y]) => P.set(x, y, R[0]));
      // Cracks on the damaged variant.
      if (variant === 1) {
        const dark = pack('#1b1d22');
        [
          [9, 4],
          [10, 5],
          [10, 6],
          [11, 7],
          [10, 8],
          [12, 8],
          [13, 9],
          [8, 9],
          [7, 10]
        ].forEach(([x, y]) => P.set(x, y, dark));
      }
      outline(P, pack('#17191d'));
      return P.canvas();
    },

    grass(B, variant) {
      // Fan-shaped tuft of blades: each blade is a curve leaning
      // outward, with a dark base and a light tip. Variant 1 is the
      // "swaying in the wind" frame.
      const P = Pix(20, 17);
      const Gc = B.grass.map(h => pack(h));
      const dark = pack(B.speck);
      const sway = variant === 1 ? 1.2 : 0;
      const blades = 11;
      // Back ones first (darker), then the front ones.
      for (let pass = 0; pass < 2; pass++) {
        for (let b = pass; b < blades; b += 2) {
          const t = b / (blades - 1); // 0 left .. 1 right
          const x0 = 3 + t * 13 + (H(b, 7, 52) - 0.5) * 2;
          const hgt = 8 + Math.floor(H(b, 3, 51) * 6) + (Math.abs(t - 0.5) < 0.25 ? 3 : 0);
          const lean = (t - 0.5) * 7 + sway * (0.6 + H(b, 1, 53));
          for (let i = 0; i <= hgt; i++) {
            const k = i / hgt;
            const x = Math.round(x0 + lean * k * k);
            const y = 16 - i;
            let c = k > 0.78 ? Gc[2] : k > 0.25 ? Gc[1] : Gc[0];
            if (pass === 0 && k <= 0.78) c = Gc[0];
            P.set(x, y, c);
            if (i < hgt * 0.45) P.set(x + 1, y, k < 0.15 ? dark : Gc[0]);
          }
        }
      }
      outline(P, pack('#0e1d0c'));
      return P.canvas();
    },

    // ---------- interactive objects ----------

    /** Power altar. variant = effect*2 + (used ? 1 : 0). */
    altar(B, variant) {
      const P = Pix(18, 27);
      const R = B.rock.map(h => pack(h));
      const eff = variant >> 1,
        used = variant & 1;
      const ORB = [
        ['#ff5f6d', '#c23a4b', '#ffd3d8'],
        ['#5fd4ff', '#2a8fd0', '#d8f6ff'],
        ['#ff8ad8', '#b03d84', '#ffe0f4'],
        ['#ffd23f', '#c08a10', '#fff3b0']
      ][eff];
      const O = (used ? ['#6b7380', '#4a505c', '#9aa2ae'] : ORB).map(h => pack(h));
      // Steps, column and slab.
      for (let y = 21; y <= 25; y++) for (let x = 1; x <= 16; x++) P.set(x, y, R[y === 21 ? 2 : y >= 24 ? 0 : 1]);
      for (let y = 12; y <= 20; y++) for (let x = 5; x <= 12; x++) P.set(x, y, R[x === 5 ? 2 : x >= 11 ? 0 : 1]);
      for (let y = 10; y <= 11; y++) for (let x = 3; x <= 14; x++) P.set(x, y, R[y === 10 ? 2 : 1]);
      // Runes in its color on the column.
      [
        [7, 14],
        [8, 15],
        [10, 14],
        [9, 17],
        [7, 18],
        [10, 18]
      ].forEach(([x, y]) => P.set(x, y, O[1]));
      // Orb.
      disc(P, 8.5, 5.5, 4.2, (x, y, d) => {
        const lit = (8.5 - x) * 0.5 + (5.5 - y) * 0.7;
        return lit > 1.6 ? O[2] : d > 0.75 ? O[1] : O[0];
      });
      outline(P, pack('#120e1a'));
      return P.canvas();
    },

    /** Healing spring. variant 1 = dried up. */
    spring(B, variant) {
      const P = Pix(34, 16);
      const R = B.rock.map(h => pack(h));
      const W = (variant ? ['#2f5f68', '#3a6f7a', '#4f8a92'] : ['#2ba8b8', '#5fe8d8', '#b8fff4']).map(h => pack(h));
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 34; x++) {
          const nx = (x - 16.5) / 16.5,
            ny = (y - 8) / 7.5;
          const d = nx * nx + ny * ny;
          if (d > 1) continue;
          if (d > 0.62) {
            P.set(x, y, R[(H(x, y, 71) < 0.5 ? 1 : 0) + (ny < -0.2 ? 1 : 0)]);
            continue;
          }
          const wave = Math.sin(x * 0.7 + y * 1.3) > 0.6;
          P.set(x, y, d < 0.18 ? W[2] : wave ? W[2] : d < 0.4 ? W[1] : W[0]);
        }
      if (!variant)
        [
          [10, 6],
          [11, 5],
          [22, 9],
          [23, 8],
          [16, 11]
        ].forEach(([x, y]) => P.set(x, y, pack('#ffffff')));
      outline(P, pack('#14161c'));
      return P.canvas();
    },

    /** Big locked chest. */
    bigchest() {
      const P = Pix(24, 20);
      const wood = pack('#6b3a1e'),
        woodL = pack('#8e5329'),
        woodD = pack('#432210');
      const iron = pack('#9aa6b5'),
        ironD = pack('#5d6773'),
        gold = pack('#f2c443'),
        goldD = pack('#b5832a');
      for (let y = 2; y < 19; y++)
        for (let x = 1; x < 23; x++) {
          let c = y < 8 ? woodL : wood;
          if (y === 8 || y === 9) c = ironD;
          if (x === 1 || x === 22 || y === 18) c = woodD;
          if (x === 5 || x === 6 || x === 17 || x === 18) c = x === 5 || x === 17 ? iron : ironD;
          if (y === 2 && x > 1 && x < 22) c = iron;
          P.set(x, y, c);
        }
      // Padlock.
      for (let x = 10; x <= 13; x++) {
        P.set(x, 5, iron);
      }
      P.set(9, 6, iron);
      P.set(14, 6, iron);
      P.set(9, 7, iron);
      P.set(14, 7, iron);
      for (let y = 8; y <= 13; y++) for (let x = 8; x <= 15; x++) P.set(x, y, (x + y) % 4 ? gold : goldD);
      P.set(11, 10, woodD);
      P.set(12, 10, woodD);
      P.set(11, 11, woodD);
      P.set(11, 12, woodD);
      outline(P, pack('#1e0f06'));
      return P.canvas();
    },

    /** Mystery Dungeon trap. variant: 0 poison · 1 sticky · 2 explosive. */
    trap(B, variant) {
      const P = Pix(14, 14);
      const COL = [
        ['#b45ec4', '#e6a3f0'],
        ['#8bd94a', '#d2ff9a'],
        ['#ff7b3d', '#ffd08a']
      ][variant];
      const c = pack(COL[0]),
        l = pack(COL[1]);
      const base = pack('#2a2238'),
        baseL = pack('#3b3150');
      for (let y = 1; y < 13; y++)
        for (let x = 1; x < 13; x++) {
          const edge = x === 1 || y === 1 || x === 12 || y === 12;
          P.set(x, y, edge ? c : (x + y) % 2 ? base : baseL);
        }
      const sym = [
        // poison: dotted skull
        [
          [5, 4],
          [6, 4],
          [7, 4],
          [8, 4],
          [4, 5],
          [9, 5],
          [4, 6],
          [6, 6],
          [7, 6],
          [9, 6],
          [5, 7],
          [8, 7],
          [5, 8],
          [6, 8],
          [7, 8],
          [8, 8],
          [5, 9],
          [8, 9]
        ],
        // sticky: drops
        [
          [4, 4],
          [4, 5],
          [3, 6],
          [5, 6],
          [4, 7],
          [8, 5],
          [8, 6],
          [7, 7],
          [9, 7],
          [8, 8],
          [6, 9],
          [5, 10],
          [7, 10],
          [6, 11]
        ],
        // explosive: mine
        [
          [6, 3],
          [7, 3],
          [5, 4],
          [8, 4],
          [4, 5],
          [9, 5],
          [4, 6],
          [6, 6],
          [7, 6],
          [9, 6],
          [4, 7],
          [6, 7],
          [7, 7],
          [9, 7],
          [4, 8],
          [9, 8],
          [5, 9],
          [8, 9],
          [6, 10],
          [7, 10]
        ]
      ][variant];
      for (const [x, y] of sym) P.set(x, y, l);
      outline(P, pack('#0c0812'));
      return P.canvas();
    },

    /** Rift to the legendary's arena. variant = frame 0..3. */
    rift(B, variant) {
      const P = Pix(30, 46);
      const glow = pack('#7b3cff'),
        mid = pack('#b48aff'),
        core = pack('#140a26'),
        white = pack('#f2e6ff');
      for (let y = 2; y < 44; y++) {
        const t = (y - 2) / 42;
        const w = Math.sin(t * Math.PI) * 9 + 1;
        const off = Math.round(Math.sin(t * 9 + variant * 1.6) * 2.2 + (H(y, variant, 91) - 0.5) * 2);
        for (let x = -Math.ceil(w) - 2; x <= Math.ceil(w) + 2; x++) {
          const ax = Math.abs(x) / w;
          const px = 15 + x + off;
          if (ax <= 0.45) P.set(px, y, core);
          else if (ax <= 0.75) P.set(px, y, H(px, y, 92 + variant) < 0.15 ? white : mid);
          else if (ax <= 1.15 || H(px, y, 93 + variant) < 0.3) P.set(px, y, glow);
        }
      }
      // Sparks in the centre.
      for (let i = 0; i < 6; i++) P.set(13 + Math.floor(H(i, variant, 94) * 5), 8 + Math.floor(H(i, variant, 95) * 30), white);
      return P.canvas();
    },

    chest() {
      const P = Pix(16, 14);
      const gold = pack('#f2c443'),
        goldD = pack('#b5832a'),
        wood = pack('#8a4f2a'),
        woodD = pack('#5e3418');
      const lid = pack('#c4662e');
      for (let y = 2; y < 13; y++)
        for (let x = 1; x < 15; x++) {
          let c = y < 6 ? lid : wood;
          if (y === 6) c = goldD;
          if (x === 1 || x === 14) c = woodD;
          if ((x === 4 || x === 11) && y > 1) c = y < 6 ? gold : goldD;
          if (y === 12) c = woodD;
          P.set(x, y, c);
        }
      for (let x = 6; x < 10; x++) for (let y = 5; y < 9; y++) P.set(x, y, (x + y) % 3 ? gold : goldD);
      outline(P, pack('#2a160a'));
      return P.canvas();
    }
  };

  function clearProps() {
    propCache.clear();
  }

  return {
    T,
    BIOMES,
    NORMAL,
    ARENA,
    ARENA_THEMES,
    ARENA_TYPES,
    chunkJob,
    propSprite,
    clearProps,
    /** Biome index of a type's arena. */
    arenaBiome: type => ARENA + Math.max(0, ARENA_TYPES.indexOf(type))
  };
})();
