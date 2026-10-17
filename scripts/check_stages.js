/* check_stages.js — checks the Story mode data (src/js/data/stages.js):
 *   node scripts/check_stages.js
 * Every Pokémon name exists in the Pokédex and has sprites, no route or wave is empty,
 * and every leader sprite of a region with `art` is in public/assets/trainers/.
 * Exits with 1 if something is wrong (npm run check:stages; npm run build runs it first). */
const fs = require('fs'),
  path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const load = f => import(pathToFileURL(path.join(ROOT, 'src/js/data', f)).href);

(async () => {
  const { Stages } = await load('stages.js');
  const { DEX_BY } = await load('pokedex.js');
  const { SPRITE_META } = await load('sprites-meta.js');
  const errors = [];
  if (Stages.missing.length) errors.push('unknown Pokémon names: ' + [...new Set(Stages.missing)].join(', '));
  const ok = d => DEX_BY[d] && SPRITE_META[d];

  let stages = 0;
  for (const r of Stages.REGIONS) {
    if (r.stages.length !== 8) errors.push(`${r.id}: ${r.stages.length} stages (expected 8)`);
    for (const s of r.stages) {
      stages++;
      for (const l of s.legs) {
        if (l.mons.length < 3) errors.push(`${s.id} · ${l.name}: only ${l.mons.length} Pokémon`);
        for (const d of l.mons) if (!ok(d)) errors.push(`${s.id} · ${l.name}: no sprites for #${d}`);
      }
      if (s.minis.length !== 3) errors.push(`${s.id}: ${s.minis.length} mini-bosses (expected 3)`);
      s.gym.waves.forEach((w, i) => {
        if (!w.length || w.length > 2) errors.push(`${s.id}: wave ${i + 1} has ${w.length} Pokémon (1-2)`);
        for (const m of w) if (!ok(m.dex)) errors.push(`${s.id}: no sprites for gym #${m.dex}`);
      });
      const art = Stages.leaderArt(s);
      if (art && !fs.existsSync(path.join(ROOT, 'public', art))) errors.push(`${s.id}: missing ${art}`);
    }
  }

  if (errors.length) {
    console.error(errors.map(e => '✗ ' + e).join('\n'));
    process.exit(1);
  }
  console.log(`ok: ${stages} stages in ${Stages.REGIONS.length} regions`);
})();
