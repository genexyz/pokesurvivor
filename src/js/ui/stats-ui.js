/* ============ stats-ui.js — your run in numbers ============
 * Shared by the pause (Stats and Damage tabs), the end of the run, the level-up
 * cards (how much a stat card raises it) and the move tooltip (ui/move-tip.js).
 *
 * The altar power is left out of every number: it only lasts a few seconds, so
 * "+20% damage" during Fury would be a lie about your build (it has its own line).
 */
import { U } from '../core/util.js';
import { Balance } from '../data/balance.js';
import { Moves } from '../data/moves.js';
import { LevelUp } from '../systems/levelup.js';
import { Recount } from '../systems/recount.js';
import { Icons } from './icons.js';

export const StatsUI = (() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pct = U.pct,
    num = U.num;
  const CARD = {};
  for (const s of LevelUp.STATS) CARD[s.id] = s;

  /** A player stat without the active altar power or Mega Evolution. */
  const MEGA_STAT = { atkMul: 'atk', spdMul: 'spd', cdMul: 'cd' };
  function base(p, stat) {
    const pw = p.power;
    let v = pw && pw.def.stat === stat ? p[stat] / (p._powerK || 1) : p[stat];
    if (p.form && p._megaK) {
      if (MEGA_STAT[stat]) v /= p._megaK[MEGA_STAT[stat]];
      else if (stat === 'dmgReduce') v -= p._megaK.def;
    }
    return v;
  }
  const signed = (v, d = 0) =>
    (v >= 0 ? '+' : '-') +
    Math.abs(v * 100)
      .toFixed(d)
      .replace(/\.0+$/, '') +
    '%';

  // id: level-card id (cards taken / max), or null for stats no card raises.
  const ROWS = [
    { id: 'hp', icon: 'heart', name: 'HP', val: p => `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`, cmp: p => p.maxHp },
    { id: 'atk', icon: 'fist', name: 'Damage', val: p => signed(base(p, 'atkMul') - 1), cmp: p => base(p, 'atkMul') },
    { id: 'spd', icon: 'boot', name: 'Speed', val: p => signed(base(p, 'spdMul') - 1), cmp: p => base(p, 'spdMul') },
    { id: 'cd', icon: 'clock', name: 'Cooldown', val: p => signed(base(p, 'cdMul') - 1), cmp: p => base(p, 'cdMul') },
    {
      id: 'def',
      icon: 'shield',
      name: 'Damage reduction',
      val: p => pct(Math.min(Balance.player.reductionCap, base(p, 'dmgReduce'))) + '%',
      cmp: p => base(p, 'dmgReduce')
    },
    { id: 'rgn', icon: 'sprout', name: 'Regeneration', val: p => num(p.regenFlat) + ' HP/s', cmp: p => p.regenFlat },
    {
      id: 'mag',
      icon: 'magnet',
      name: 'Pickup radius',
      val: p => signed(base(p, 'magnet') / Balance.player.magnet - 1),
      cmp: p => base(p, 'magnet')
    },
    { id: 'xp', icon: 'book', name: 'Experience', val: p => signed(p.xpMul - 1), cmp: p => p.xpMul },
    { id: null, icon: 'shiny', name: 'Critical hit', val: p => pct(p.critChance) + '%' },
    { id: null, icon: 'coin', name: 'PokéCoins', val: p => signed(p.coinMul - 1) }
  ];
  const ROW = {};
  for (const r of ROWS) if (r.id) ROW[r.id] = r;

  function taken(p, id) {
    const n = p.statsTaken[id] || 0,
      max = CARD[id] && CARD[id].max;
    return max ? `${n}/${max}` : n ? `×${n}` : '';
  }

  /**
   * What a stat card would do: "before → after · n/max" (null for cards that are not
   * a stat, like the berry). Applied to a copy of the player, with the card's own code.
   */
  function preview(p, id) {
    const row = ROW[id],
      card = CARD[id];
    if (!row || !card) return null;
    const q = Object.create(p);
    card.apply(q);
    const before = row.val(p),
      after = row.val(q);
    const t = card.max ? ` · ${(p.statsTaken[id] || 0) + 1}/${card.max}` : '';
    return before === after ? null : `${before} → ${after}${t}`;
  }

  // ---------------- moves ----------------
  const PER_TICK = { aura: true, trail: true };

  /** The numbers of a move with your current build: [[label, value], ...]. */
  function moveFacts(p, m) {
    const out = [];
    const atk = p.atk / (p.power && p.power.def.stat === 'atkMul' ? p._powerK || 1 : 1);
    if (m.kind === 'buff') {
      out.push(['Effect', `+${pct(m.amount)}% × ${m.stacks || 1}`]);
      if (m.dur) out.push(['Lasts', num(m.dur) + ' s']);
    } else if (m.dmg) {
      const d = Math.round(m.dmg * atk);
      out.push([PER_TICK[m.kind] ? 'Damage per tick' : 'Damage', (m.count > 1 ? `${d} ×${m.count}` : d) + '']);
    }
    if (m.kind !== 'orbit') out.push(['Cooldown', num(Math.max(Balance.combat.minCd, m.cd * base(p, 'cdMul'))) + ' s']);
    if (m.dealt) out.push(['Damage dealt', Recount.fmt(m.dealt)]);
    return out;
  }

  /** A move as a level-up style card (pause list and tooltip). */
  function moveCard(p, m, key) {
    const evo = Moves.evoInfo(m, p.statsTaken);
    const next = Moves.nextUpText(m);
    const col = U.TYPE_COLOR[m.type] || '#8fa3c4';
    const facts = moveFacts(p, m)
      .map(([k, v]) => `<span><small>${k}</small> <b>${v}</b></span>`)
      .join('');
    return `<div class="card move-card${m.evolved ? ' evo' : ''}">
      <div class="ico" style="background:${col}33">${Icons.html('move:' + m.id, 32)}</div>
      <div class="txt"><div class="nm">${m.name} <span class="tag-chip" style="background:${col}">${U.TYPE_NAME[m.type] || m.type}</span>
        <span class="tag-chip lv">Lv.${m.lvl}</span></div>
        <div class="ds">${m.desc || ''}</div>
        <div class="mt-st">${facts}</div>
        ${next ? `<div class="ds"><small>Next: ${next}</small></div>` : ''}
        ${evo ? `<div class="ds"><small><span>Evolves into ${evo.name}</span> · <span>${evo.ready ? 'Ready to evolve!' : `Needs ${evo.needName}`}</span></small></div>` : ''}
      </div>
      ${key ? `<div class="key">${key}</div>` : ''}
    </div>`;
  }

  // ---------------- whole blocks ----------------

  /** Stats tab: every stat, the level cards taken, active buffs and power, and your moves. */
  function statsHtml(p) {
    const rows = ROWS.map(
      r =>
        `<div class="st-row">${Icons.html(r.icon, 18)}<span>${r.name}</span><b>${r.val(p)}</b><small>${r.id ? taken(p, r.id) : ''}</small></div>`
    ).join('');
    const fx = [];
    const LBL = { atk: 'Damage', spd: 'Speed', def: 'Damage reduction', regen: 'Regeneration' };
    for (const k in p.buffs) {
      const b = p.buffs[k];
      if (b.n <= 0) continue;
      const v = k === 'regen' ? `+${num(b.n * b.amount)} HP/s` : `+${pct(b.n * b.amount)}%`;
      fx.push(
        `<div class="st-row">${b.src ? Icons.html('move:' + b.src, 18) : ''}<span><span>${LBL[k]}</span> ×${b.n}/${b.max}</span><b>${v}</b><small>${Math.ceil(b.t)} s</small></div>`
      );
    }
    if (p.power) {
      const pw = p.power;
      fx.push(
        `<div class="st-row">${Icons.html(pw.def.icon, 18)}<span>${pw.def.name}</span><b>${pw.def.desc}</b><small>${Math.ceil(pw.t)} s</small></div>`
      );
    }
    if (p.form && p._megaK) {
      const k = p._megaK;
      fx.push(
        `<div class="st-row">${Icons.html('star', 18)}<span>${esc(p.form.name)}</span><b><span>damage ×${num(k.atk)}</span> · <span>+${pct(k.spd - 1)}% speed</span> · <span>-${pct(1 - k.cd)}% cooldown</span> · <span>+${pct(k.def)}% reduction</span></b><small>${Math.ceil(p.megaT)} s</small></div>`
      );
    }
    const moves = p.slots.map((g, i) => g.map(m => moveCard(p, m, g.length > 1 ? '' : i + 1)).join('')).join('');
    return (
      `<div class="stats-list">${rows}</div>` +
      (fx.length ? `<h3 class="st-h">Active effects</h3><div class="stats-list">${fx.join('')}</div>` : '') +
      `<h3 class="st-h">Your moves</h3><div class="cards move-cards">${moves}</div>`
    );
  }

  function bars(rows, colorOf, iconOf) {
    return rows
      .map(
        r => `<div class="dmg-row">${iconOf(r)}<span class="dmg-name"${r.color ? ' translate="no"' : ''}>${esc(r.name)}</span>
          <span class="dmg-bar"><i style="width:${Math.max(2, r.pct * 100).toFixed(1)}%;background:${colorOf(r)}"></i></span>
          <b>${Recount.fmt(r.dmg)}</b><small>${Math.round(r.pct * 100)}%</small></div>`
      )
      .join('');
  }

  /** Damage tab and end of the run: total, per second, your moves and (co-op) the group. */
  function damageHtml(d) {
    if (!d || !d.total) return '<p class="sub">No damage yet.</p>';
    const head = `<div class="dmg-head"><span>Total <b>${Recount.fmt(d.total)}</b></span><span><b>${Recount.fmt(d.dps)}</b> per second</span></div>`;
    const team = d.team
      ? `<h3 class="st-h">Group</h3>` +
        bars(
          d.team,
          r => r.color,
          r => `<i class="dmg-dot" style="background:${r.color}"></i>`
        )
      : '';
    const mine = bars(
      d.rows,
      r => (r.type && U.TYPE_COLOR[r.type]) || '#b0b8c8',
      r => (r.id ? Icons.html('move:' + r.id, 18) : '<i class="dmg-dot"></i>')
    );
    return head + team + (d.team ? '<h3 class="st-h">Your moves</h3>' : '') + mine;
  }

  return { preview, moveFacts, moveCard, statsHtml, damageHtml };
})();
