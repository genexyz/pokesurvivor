/* ============ gacha-ui.js — per-generation banners and pull animation ============
 * The logic (odds, pity, shiny, duplicates) lives in systems/gacha.js.
 */
import { DEX, DEX_BY } from '../data/pokedex.js';
import { DB } from '../core/db.js';
import { Audio } from '../core/audio.js';
import { Gacha } from '../systems/gacha.js';
import { Progress } from '../systems/progress.js';
import { Icons } from './icons.js';
import { UI } from './ui.js';
import { Slots } from './slots.js';

export const GachaUI = (() => {
  const $ = UI.$;
  let busy = false;
  let gen = 1;

  function init() {
    $('pull-1').onclick = () => pull(1);
    $('pull-10').onclick = () => pull(10, 't1');
    $('pull-10b').onclick = () => pull(10, 't10');
    $('pull-close').onclick = close;

    const tabs = $('gacha-gens');
    Gacha.BANNERS.forEach(b => {
      const t = document.createElement('button');
      t.className = 'gen-tab';
      t.dataset.gen = b.gen;
      t.innerHTML = `<b>${b.name}</b><small>Gen ${b.gen}</small>`;
      t.onclick = () => {
        gen = b.gen;
        refresh();
      };
      tabs.appendChild(t);
    });
  }

  function open() {
    UI.show('scr-gacha', true);
    refresh();
  }

  function refresh() {
    const s = DB.save;
    const banner = Gacha.BANNERS[gen - 1];
    document.querySelectorAll('#gacha-gens .gen-tab').forEach(t => t.classList.toggle('on', +t.dataset.gen === gen));

    const all = DEX.filter(p => p.gen === gen);
    const owned = all.filter(p => s.owned[p.dex]).length;
    const shinies = all.filter(p => s.shiny && s.shiny[p.dex]).length;
    const [c1, c2, c3] = banner.color;
    $('banner').style.background = `radial-gradient(circle at 80% 30%, rgba(255,210,63,.3), transparent 45%),
       radial-gradient(circle at 15% 80%, rgba(196,123,255,.3), transparent 50%),
       linear-gradient(135deg, ${c1}, ${c2} 55%, ${c3})`;
    $('banner-title').textContent = banner.name + ' Mystery';
    $('banner-desc').textContent = `The ${all.length} Pokémon of generation ${gen}. The legendaries await!`;
    $('gacha-owned').innerHTML = `You have ${owned} of ${all.length}` + (shinies ? ` · ${Icons.html('shiny', 12)} ${shinies} shiny` : '');

    const feat = $('gacha-feat');
    feat.innerHTML = '';
    for (const dex of Gacha.featured(gen)) {
      feat.appendChild(UI.spriteCanvas(dex, 170, 190, { lively: true, scale: 2, dir: 1 }));
    }

    const pity = (s.pity && s.pity[gen]) || 0;
    $('gacha-pity').textContent = `Pulls without a legendary in ${banner.name}: ${pity} / ${Gacha.PITY_5}`;

    $('gacha-rates').innerHTML =
      '<h3>Odds</h3>' +
      Gacha.RATES.slice()
        .reverse()
        .map(
          ([r, w]) => `
      <div><span style="color:${Gacha.RARITY_COLOR[r]}">${UI.stars(r, 10)} ${Gacha.RARITY_NAME[r]}</span>
      <span>${w}% · ${Gacha.pool(r, gen).length}</span></div>`
        )
        .join('') +
      `<div><span>${Icons.html('shiny', 12)} Shiny</span><span>1%</span></div>
       <p class="note">· The ×10 pull guarantees at least one Epic.<br>
       · After ${Gacha.PITY_5} pulls without a Legendary on a banner, the next one is.<br>
       · Duplicates give PokéCoins. Shinies never repeat.<br>
       · Tickets are earned by playing: some Pokémon drop them when defeated, and
         bosses and rift legendaries sometimes give ×10 tickets.</p>`;

    const t = s.tickets;
    $('cost-1').innerHTML = `${Icons.html('ticket', 18)} 1`;
    $('cost-10').innerHTML = `${Icons.html('ticket', 18)} 10`;
    $('cost-10b').innerHTML = `${Icons.html('ticket10', 18)} 1`;
    $('gacha-tickets').innerHTML =
      `You have ${Icons.html('ticket', 18)} <b>${t.t1}</b> tickets and ${Icons.html('ticket10', 18)} <b>${t.t10}</b> ×10 tickets`;
    $('pull-1').disabled = !Gacha.costOf(s, 1);
    $('pull-10').disabled = !Gacha.costOf(s, 10, 't1');
    $('pull-10b').disabled = !Gacha.costOf(s, 10, 't10');
    UI.refreshCoins();
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function pull(n, use = 't1') {
    if (busy) return;
    const res = Gacha.pull(DB.save, n, gen, use);
    if (!res) {
      Audio.sfx('error');
      UI.toast('Not enough tickets: earn them by playing');
      return;
    }
    Progress.checkAch();
    DB.commit(true);
    busy = true;

    const best = Math.max(...res.map(r => r.rarity));
    const fx = $('pull-fx'),
      slot = $('slot'),
      out = $('pull-results');
    out.innerHTML = '';
    $('pull-close').classList.add('hidden');
    slot.style.display = '';
    fx.classList.remove('hidden');

    // The slot machine (ui/slots.js), then the cards.
    await Slots.play(slot, res);
    Audio.sfx('burst', { rarity: best });
    slot.style.display = 'none';

    for (const r of res) {
      const mon = DEX_BY[r.dex];
      const c = document.createElement('div');
      c.className = 'pcard r' + r.rarity + (r.shiny ? ' shiny' : '');
      c.style.setProperty('--rc', r.shiny ? '#9ae6ff' : Gacha.RARITY_COLOR[r.rarity]);
      c.innerHTML = `<div class="stars">${UI.stars(r.rarity, 24)}</div>`;
      c.appendChild(UI.spriteCanvas(r.dex, 132, 120, { lively: r.rarity >= 4 || r.shiny, scale: 2, shiny: r.shiny }));
      const tag = r.isNew
        ? `<span class="new">${r.shiny ? 'NEW SHINY!' : 'NEW!'}</span>`
        : `Duplicate · <span class="coin"></span> +${r.refund}`;
      c.insertAdjacentHTML('beforeend', `<b>${r.shiny ? Icons.html('shiny', 12) + ' ' : ''}${mon.name}</b><div class="tag">${tag}</div>`);
      out.appendChild(c);
      Audio.sfx('reveal', { rarity: r.rarity });
      await wait(n === 10 ? 150 : 0);
    }
    $('pull-close').classList.remove('hidden');
    busy = false;
  }

  function close() {
    $('pull-fx').classList.add('hidden');
    refresh();
  }

  return {
    init,
    open,
    get open_() {
      return !$('pull-fx').classList.contains('hidden');
    }
  };
})();
