/* ============ levelup.js — the three level-up cards ============
 * Card types:
 *   new   learn a new move (only if any of the 4 slots is free; a link frees slots)
 *   up    upgrade a move you already have
 *   stat  permanent upgrade for the run
 */
G.LevelUp = (() => {
  const B = G.Balance.levelup;
  const R = G.RNG.stream('levelup');
  // Stat cards: `val` is what one card grants (its text is built from it).
  const pct = G.U.pct,
    num = G.U.num;
  const STATS = [
    {
      id: 'hp',
      icon: 'heart',
      title: 'Vigor',
      val: 20,
      get desc() {
        return `+${num(this.val)} max HP (and heals it).`;
      },
      apply: pl => pl.addMaxHp(BY.hp.val)
    },
    {
      id: 'atk',
      icon: 'fist',
      title: 'Power',
      val: 0.1,
      get desc() {
        return `+${pct(this.val)}% damage with every move.`;
      },
      apply: pl => (pl.atkMul *= 1 + BY.atk.val),
      max: 40
    },
    {
      id: 'spd',
      icon: 'boot',
      title: 'Sprint',
      val: 0.07,
      get desc() {
        return `+${pct(this.val)}% movement speed.`;
      },
      apply: pl => (pl.spdMul *= 1 + BY.spd.val),
      max: 8
    },
    {
      id: 'cd',
      icon: 'clock',
      title: 'Reflexes',
      val: 0.08,
      get desc() {
        return `-${pct(this.val)}% cooldown on every move.`;
      },
      apply: pl => (pl.cdMul *= 1 - BY.cd.val),
      max: 10
    },
    {
      id: 'def',
      icon: 'shield',
      title: 'Armor',
      val: 0.06,
      get desc() {
        return `+${pct(this.val)}% damage reduction.`;
      },
      apply: pl => (pl.dmgReduce = Math.min(B.armorCap, pl.dmgReduce + BY.def.val)),
      max: 12
    },
    {
      id: 'rgn',
      icon: 'sprout',
      title: 'Synthesis',
      val: 0.9,
      get desc() {
        return `+${num(this.val)} HP regenerated per second.`;
      },
      apply: pl => (pl.regenFlat += BY.rgn.val)
    },
    {
      id: 'mag',
      icon: 'magnet',
      title: 'Magnet',
      val: 0.3,
      get desc() {
        return `+${pct(this.val)}% experience pickup radius.`;
      },
      apply: pl => (pl.magnet *= 1 + BY.mag.val),
      max: 6
    },
    {
      id: 'xp',
      icon: 'book',
      title: 'Learning',
      val: 0.12,
      get desc() {
        return `+${pct(this.val)}% experience gained.`;
      },
      apply: pl => (pl.xpMul *= 1 + BY.xp.val),
      max: 8
    },
    {
      id: 'heal',
      icon: 'berry',
      title: 'Sitrus Berry',
      val: 0.45,
      get desc() {
        return `Restores ${pct(this.val)}% of your HP right now.`;
      },
      apply: pl => pl.heal(pl.maxHp * BY.heal.val)
    }
  ];
  const BY = {};
  for (const s of STATS) BY[s.id] = s;

  /** Builds the set of candidate cards, with weights. */
  function candidates(pl) {
    const out = [];

    // --- new moves ---
    if (pl.slots.length < pl.maxMoves) {
      // With `buffCap` buffs no more are offered: buffs deal no damage and
      // filling all 4 slots with them leaves the run at a dead end.
      const buffs = pl.moves.filter(m => m.kind === 'buff').length;
      const pool = G.Moves.poolFor(pl.mon).filter(
        id => !pl.hasMove(id) && !(pl.banned && pl.banned.has(id)) && !(buffs >= B.buffCap && G.Moves.BY_ID[id].kind === 'buff')
      );
      for (const id of R.pickN(pool, B.newSample)) {
        const d = G.Moves.BY_ID[id];
        out.push({
          w: B.weight.new,
          type: 'new',
          key: 'new:' + id,
          icon: 'move:' + id,
          color: G.U.TYPE_COLOR[d.type],
          tag: G.U.TYPE_NAME[d.type],
          title: d.name,
          desc: d.desc,
          apply: p => p.addMove(id)
        });
      }
    }

    // --- evolutions: move maxed out + its condition met ---
    const waiting = {}; // stat -> move waiting for it to evolve
    for (const m of pl.moves) {
      const ev = G.Moves.evoInfo(m, pl.statsTaken);
      if (!ev) continue;
      if (!ev.ready) {
        waiting[ev.needs] = m;
        continue;
      }
      out.push({
        w: B.weight.evo,
        type: 'evo',
        key: 'evo:' + m.id,
        icon: 'move:' + m.id,
        color: '#ffd23f',
        tag: 'EVOLUTION',
        title: m.name + ' → ' + ev.name,
        desc: ev.text,
        apply: p => {
          G.Moves.evolve(m);
          G.FX.ring(p.x, p.y, 8, 120, '#ffd23f', 0.8, 6);
          G.FX.burst(p.x, p.y - p.bodyH * 0.5, '#ffe14d', 40, 240);
          G.Audio.sfx('legend');
          G.Progress.event('evolve', { move: m.id });
        }
      });
    }

    // --- upgrades for moves you already have ---
    for (const m of pl.moves) {
      const txt = G.Moves.nextUpText(m);
      if (!txt) continue;
      out.push({
        w: B.weight.up,
        type: 'up',
        key: 'up:' + m.id,
        icon: 'move:' + m.id,
        color: G.U.TYPE_COLOR[m.type],
        tag: 'Lv.' + m.lvl + ' > ' + (m.lvl + 1),
        title: m.name,
        desc: txt,
        apply: () => G.Moves.levelUp(m)
      });
    }

    // --- stats ---
    // The ones that unlock an evolution always show up, flagged.
    // Each upgrade has a cap on how many times (`max`): in very long runs they
    // stacked endlessly (speed, cooldown and experience through the roof) and the
    // game ended up freezing. The ones an evolution needs always show up.
    const room = s => !s.max || (pl.statsTaken[s.id] || 0) < s.max;
    const pickStats = R.pickN(
      STATS.filter(s => !waiting[s.id] && room(s)),
      B.statSample
    ).concat(STATS.filter(s => waiting[s.id]));
    for (const s of pickStats) {
      const evoFor = waiting[s.id];
      out.push({
        w: evoFor ? B.weight.statEvo : pl.slots.length < pl.maxMoves ? B.weight.statFreeSlots : B.weight.stat,
        type: 'stat',
        key: 'stat:' + s.id,
        icon: s.icon,
        color: evoFor ? '#ffd23f' : '#8fa3c4',
        tag: evoFor ? 'Evolves ' + evoFor.name : 'Upgrade',
        title: s.title,
        desc: s.desc,
        apply: p => {
          s.apply(p);
          p.statsTaken[s.id] = (p.statsTaken[s.id] || 0) + 1;
        }
      });
    }

    return out;
  }

  /** Returns `n` (G.Balance.levelup.offer) different cards, picked by weight. */
  function offer(pl, n = B.offer) {
    const pool = candidates(pl);
    const picked = [];
    const used = new Set();
    // If an evolution is ready, its golden card always shows up.
    const evo = pool.findIndex(c => c.type === 'evo');
    if (evo >= 0) {
      const c = pool.splice(evo, 1)[0];
      used.add(c.key);
      picked.push(c);
    }

    while (picked.length < n && pool.length) {
      const idx = R.weighted(pool.map(c => c.w));
      const c = pool.splice(idx, 1)[0];
      if (used.has(c.key)) continue;
      used.add(c.key);
      picked.push(c);
    }
    return picked;
  }

  return { offer, STATS };
})();
