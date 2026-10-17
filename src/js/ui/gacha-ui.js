/* ============ gacha-ui.js — per-generation banners and pull animation ============
 * The logic (odds, pity, shiny, duplicates) lives in systems/gacha.js.
 */
import { DEX, DEX_BY } from '../data/pokedex.js';
import { DB } from '../core/db.js';
import { Audio } from '../core/audio.js';
import { Settings } from '../core/settings.js';
import { Gacha } from '../systems/gacha.js';
import { Progress } from '../systems/progress.js';
import { Icons } from './icons.js';
import { UI } from './ui.js';
import { Slots } from './slots.js';

export const GachaUI = (() => {
  const $ = UI.$;
  let busy = false;
  let skipped = false; // this pull shows the cards without (the rest of) the slot machine
  let gen = 1;

  function init() {
    $('pull-1').onclick = () => pull(1);
    $('pull-10').onclick = () => pull(10, 't1');
    $('pull-10b').onclick = () => pull(10, 't10');
    $('pull-close').onclick = close;
    $('pull-skip').onclick = skip;
    $('gacha-skip').onclick = () => {
      Settings.set('gachaSkip', !Settings.get('gachaSkip'));
      syncSkip();
    };

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
    syncSkip();
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
    // Enter must not press the focused pull button again (it is the key to continue).
    if (document.activeElement) document.activeElement.blur();

    const best = Math.max(...res.map(r => r.rarity));
    const fx = $('pull-fx'),
      slot = $('slot'),
      out = $('pull-results');
    out.innerHTML = '';
    $('pull-summary').innerHTML = '';
    $('pull-close').classList.add('hidden');
    // The slot machine (ui/slots.js), then the cards. With "Open without animation"
    // (or Skip / Space / Enter halfway) the cards come out at once.
    skipped = !!Settings.get('gachaSkip');
    slot.style.display = skipped ? 'none' : '';
    fx.classList.remove('hidden');
    if (!skipped) {
      $('pull-skip').classList.remove('hidden');
      await Slots.play(slot, res);
      $('pull-skip').classList.add('hidden');
    }
    Audio.sfx('burst', { rarity: best });
    if (skipped) {
      // The slot machine's big moments, so a skipped pull still sounds like one.
      if (res.some(r => r.shiny)) Audio.sfx('shiny');
      else if (best >= 5) Audio.sfx('legend');
      Audio.sfx('reveal', { rarity: best });
    }
    slot.style.display = 'none';
    $('pull-summary').innerHTML = summary(res);

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
      if (!skipped) {
        Audio.sfx('reveal', { rarity: r.rarity });
        await wait(n === 10 ? 150 : 0);
      }
    }
    $('pull-close').classList.remove('hidden');
    busy = false;
  }

  /** One line for a ×10: what's new, the best rarities, shinies and coins from duplicates. */
  function summary(res) {
    if (res.length < 2) return '';
    const parts = [];
    const fresh = res.filter(r => r.isNew).length;
    if (fresh) parts.push(`<span>${fresh} new</span>`);
    for (const k of [5, 4]) {
      const c = res.filter(r => r.rarity === k).length;
      if (c) parts.push(`<span style="color:${Gacha.RARITY_COLOR[k]}">${c} ${Gacha.RARITY_NAME[k]}</span>`);
    }
    const sh = res.filter(r => r.shiny).length;
    if (sh) parts.push(`${Icons.html('shiny', 12)} <span>${sh} shiny</span>`);
    const coins = res.reduce((a, r) => a + (r.isNew ? 0 : r.refund || 0), 0);
    if (coins) parts.push(`<span class="coin"></span> +${coins}`);
    return parts.join(' · ');
  }

  /** Skip the rest of the slot machine (button, Space or Enter). */
  function skip() {
    if (!busy || skipped) return;
    skipped = true;
    Slots.stop();
  }

  function close() {
    if (busy) return;
    $('pull-fx').classList.add('hidden');
    refresh();
  }

  /** Keys while the pull is on screen: Space/Enter skip the animation or continue; Esc continues. */
  function key(k) {
    if ($('pull-fx').classList.contains('hidden')) return false;
    if (busy) {
      if (k === 'space' || k === 'enter') skip();
    } else if (k === 'space' || k === 'enter' || k === 'escape') close();
    return true;
  }

  function syncSkip() {
    const b = $('gacha-skip'),
      on = !!Settings.get('gachaSkip');
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
  }

  return {
    init,
    open,
    key,
    get open_() {
      return !$('pull-fx').classList.contains('hidden');
    }
  };
})();
