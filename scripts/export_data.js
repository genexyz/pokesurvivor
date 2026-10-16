/* Exports the game data to JSON to generate the web pages (make_seo_pages.py).
 *   node scripts/export_data.js  ->  .cache/gamedata.json
 * Imports the game's own data modules (src/js, ES modules) in Node with a few
 * browser stubs, in English (the source language), plus the Spanish dictionary
 * (lang-es.js) as `es`. Only data modules: they must stay importable without a browser. */
const fs = require('fs'),
  path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..');

// Browser stubs, just enough for the data modules (and what they import) to load.
const noop = () => {};
const fakeCtx = new Proxy({}, { get: () => noop });
const stubs = {
  window: globalThis,
  location: { pathname: '/', protocol: 'file:', search: '' },
  navigator: { language: 'en', languages: ['en'] },
  localStorage: { getItem: () => 'en', setItem: noop, removeItem: noop },
  document: {
    documentElement: {},
    createElement: () => ({ getContext: () => fakeCtx, width: 0, height: 0 }),
    addEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    body: {}
  },
  addEventListener: noop,
  matchMedia: () => ({ matches: false }),
  CanvasRenderingContext2D: function () {},
  Image: function () {},
  requestAnimationFrame: noop
};
for (const [k, v] of Object.entries(stubs)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });

const load = f => import(pathToFileURL(path.join(ROOT, 'src', 'js', f)).href);

(async () => {
  const [{ U }, { ES, ES_EXACT }, { DEX }, { Moves }, { Types }, { Items }, { AchDefs }, { CHANGELOG }, { Tiles }] = await Promise.all(
    [
      'core/util.js',
      'data/lang-es.js',
      'data/pokedex.js',
      'data/moves.js',
      'data/types.js',
      'data/items.js',
      'data/achievements.js',
      'data/changelog.js',
      'world/tiles.js'
    ].map(load)
  );

  const moves = Object.values(Moves.BY_ID).map(m => {
    const inst = Moves.instance(m.id, m.maxLvl || 5);
    const evo = Moves.evoInfo(inst, {});
    return {
      id: m.id,
      name: m.name,
      type: m.type,
      kind: m.kind,
      desc: m.desc,
      maxLvl: m.maxLvl,
      evo: evo ? { name: evo.name, needs: evo.needName, text: evo.text } : null
    };
  });
  const out = {
    dex: DEX,
    legends: DEX.filter(p => p.leg).map(p => p.dex),
    moves,
    items: (Items.LIST || []).map(i => ({ id: i.id, name: i.name, desc: i.desc })),
    achievements: (AchDefs.LIST || []).map(a => ({
      id: a.id,
      cat: a.cat,
      name: a.name,
      desc: a.desc,
      tier: a.tier,
      title: a.title || '',
      reward: a.reward || {}
    })),
    achCats: AchDefs.CATS || null,
    types: Types.CHART,
    typeColor: U.TYPE_COLOR,
    typeName: U.TYPE_NAME,
    typeOrder: Object.keys(U.TYPE_NAME),
    matrix: Object.fromEntries(
      Object.keys(U.TYPE_NAME).map(a => [a, Object.fromEntries(Object.keys(U.TYPE_NAME).map(d => [d, Types.mult(a, [d])]))])
    ),
    // (Without the Arceus arena: the rift ones are one per type.)
    arenas: Object.fromEntries(
      Object.entries(Tiles.ARENA_THEMES || {})
        .filter(([k]) => k !== 'judgment')
        .map(([k, v]) => [k, v.name])
    ),
    changelog: CHANGELOG || [],
    es: { ...ES, ...ES_EXACT }
  };
  fs.mkdirSync(path.join(ROOT, '.cache'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, '.cache', 'gamedata.json'), JSON.stringify(out));
  console.log(
    'ok:',
    out.dex.length,
    'Pokémon,',
    out.moves.length,
    'moves,',
    out.items.length,
    'items,',
    out.achievements.length,
    'achievements,',
    Object.keys(out.arenas).length,
    'arenas,',
    Object.keys(out.es).length,
    'translations'
  );
})().catch(e => {
  console.error(e);
  process.exit(1);
});
