/* ============ gacha.js — one banner per generation ============
 * Pure logic: doesn't touch the UI. The screen lives in ui/gacha-ui.js.
 *
 * 9 banners (Kanto ... Paldea). Each one with its own pity.
 * Odds per pull:  1★ 45% · 2★ 30% · 3★ 17% · 4★ 6.5% · 5★ 1.5%
 * Guarantees:
 *   - the ×10 pull brings at least one 4★ or higher
 *   - after 70 pulls without a 5★ on that banner, the next one is a guaranteed 5★
 * Shiny: 1 in 100 pulls comes out in its shiny version.
 * Duplicates: turned into Pokécoins (duplicate shinies, triple).
 * All of these numbers live in Balance.gacha. Pulls roll on Math.random on
 * purpose: a run seed must not make the gacha predictable.
 *
 * Pulls cost TICKETS (earned by playing):
 *   ×1   1 ticket
 *   ×10  10 normal tickets, or 1 ×10 ticket (you choose which)
 */
import { U } from '../core/util.js';
import { Balance } from '../data/balance.js';
import { DEX } from '../data/pokedex.js';
import { SPRITE_META } from '../data/sprites-meta.js';
import { Sprites } from '../core/sprites.js';
import { Spawner } from './spawner.js';

export const Gacha = (() => {
  /** What does a pull of n cost? → { t1, t10 } or null if you can't afford it. */
  /** @param use  't1' (normal tickets) or 't10' (one ×10 ticket, only for the ×10 pull) */
  function costOf(save, n, use = 't1') {
    const t = save.tickets || { t1: 0, t10: 0 };
    if (n === 10 && use === 't10') return t.t10 >= 1 ? { t1: 0, t10: 1 } : null;
    return t.t1 >= n ? { t1: n, t10: 0 } : null;
  }
  const B = Balance.gacha;
  // Shiny roll with the debug override (for testing and videos), shared with the spawner.
  const shinies = Spawner.shinyRoller(() => B.shinyRate, Math.random);

  const RARITY_NAME = { 1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Epic', 5: 'Legendary' };
  const RARITY_COLOR = { 1: '#9fb1c9', 2: '#5fe08a', 3: '#4fb4ff', 4: '#c47bff', 5: '#ffcb3d' };

  const BANNERS = [
    { gen: 1, name: 'Kanto', color: ['#3a1d6e', '#1b2f78', '#0f4d6e'] },
    { gen: 2, name: 'Johto', color: ['#5a2a1a', '#7a3d1f', '#2d4a6e'] },
    { gen: 3, name: 'Hoenn', color: ['#0f4d6e', '#1b6a5a', '#2a3d78'] },
    { gen: 4, name: 'Sinnoh', color: ['#2a2a5e', '#3d3d8a', '#5a2a6e'] },
    { gen: 5, name: 'Unova', color: ['#1a1a2a', '#3a3a4e', '#2a4a6e'] },
    { gen: 6, name: 'Kalos', color: ['#4a1a3a', '#2a3a7a', '#1a5a7a'] },
    { gen: 7, name: 'Alola', color: ['#7a3a1a', '#1a6a6a', '#2a4a8a'] },
    { gen: 8, name: 'Galar', color: ['#4a1a5a', '#1a3a6a', '#6a1a3a'] },
    { gen: 9, name: 'Paldea', color: ['#6a2a1a', '#4a1a5a', '#1a4a6a'] }
  ];

  function inBanner(p, gen) {
    return p.gen === gen && !!SPRITE_META[p.dex];
  }

  /** Pokémon of one rarity in a banner. */
  function pool(rarity, gen) {
    return DEX.filter(p => inBanner(p, gen) && p.rarity === rarity);
  }

  /** Nearest non-empty pool (some generations have almost-empty rarities). */
  function poolNear(rarity, gen) {
    for (const d of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
      const r = rarity + d;
      if (r < 1 || r > 5) continue;
      const p = pool(r, gen);
      if (p.length) return { rarity: r, list: p };
    }
    return { rarity, list: DEX.filter(p => inBanner(p, gen)) };
  }

  function rollRarity(min = 1) {
    const rates = B.rates.filter(([r]) => r >= min);
    const total = rates.reduce((a, [, w]) => a + w, 0);
    let x = Math.random() * total;
    for (const [r, w] of rates) {
      x -= w;
      if (x <= 0) return r;
    }
    return rates[rates.length - 1][0];
  }

  /** The 3 strongest of the generation, for the banner poster. */
  function featured(gen) {
    return DEX.filter(p => inBanner(p, gen) && p.rarity === 5)
      .sort((a, b) => b.bst - a.bst)
      .slice(0, 3)
      .map(p => p.dex);
  }

  /**
   * Makes `n` pulls on banner `gen` against the save `save` (modifies it).
   * Returns null if there are no coins, or the list of results:
   *   { dex, rarity, shiny, isNew, refund }
   */
  function pull(save, n, gen = 1, use = 't1') {
    const cost = costOf(save, n, use);
    if (!cost) return null;
    save.tickets.t1 -= cost.t1;
    save.tickets.t10 -= cost.t10;
    save.pity = save.pity || {};
    save.shiny = save.shiny || {};
    save.pity[gen] = save.pity[gen] || 0;

    const out = [];
    for (let i = 0; i < n; i++) {
      save.pity[gen]++;
      let want;
      if (save.pity[gen] >= B.pity5) want = 5;
      else if (n === 10 && i === n - 1 && !out.some(r => r.rarity >= B.tenMin)) want = rollRarity(B.tenMin);
      else want = rollRarity();

      const { rarity, list } = poolNear(want, gen);
      if (rarity === 5) save.pity[gen] = 0;
      let mon = U.pick(list);
      let shiny = Sprites.hasShiny(mon.dex) && shinies.roll();
      // Shinies don't repeat: if you already have that one, another of the same rarity
      // whose shiny you're missing comes out; if you have them all, it comes out normal.
      if (shiny && save.shiny[mon.dex]) {
        const missing = list.filter(p => Sprites.hasShiny(p.dex) && !save.shiny[p.dex]);
        if (missing.length) mon = U.pick(missing);
        else shiny = false;
      }

      let isNew = false,
        refund = 0;
      if (shiny) {
        isNew = !save.shiny[mon.dex];
        if (isNew) save.shiny[mon.dex] = { at: Date.now(), from: 'gacha' };
        else refund = B.refund[rarity] * B.shinyRefundK;
        if (!save.owned[mon.dex]) save.owned[mon.dex] = { at: Date.now(), from: 'gacha' };
      } else {
        isNew = !save.owned[mon.dex];
        if (isNew) save.owned[mon.dex] = { at: Date.now(), from: 'gacha' };
        else refund = B.refund[rarity];
      }
      save.coins += refund;
      out.push({ dex: mon.dex, rarity, shiny, isNew, refund });
    }
    save.stats.pulls = (save.stats.pulls || 0) + n;
    return out;
  }

  return {
    debugForceShiny(n = 1) {
      shinies.force(n);
    },
    costOf,
    get RATES() {
      return B.rates;
    },
    get PITY_5() {
      return B.pity5;
    },
    get SHINY_RATE() {
      return B.shinyRate;
    },
    get REFUND() {
      return B.refund;
    },
    RARITY_NAME,
    RARITY_COLOR,
    BANNERS,
    pool,
    featured,
    pull
  };
})();
