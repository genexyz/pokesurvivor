/* ============ upgrades.js — permanent upgrades between runs ============
 * Bought with PokéCoins in the menu. `per` is what each level grants (the
 * single source: perks() multiplies it by the level and `unit`, the label,
 * is built from it with `text`).
 */
G.Upgrades = (() => {
  const num = G.U.num,
    pct = G.U.pct;
  const LIST = [
    { id: 'hp', icon: 'heart', name: 'Vitality', text: x => `+${num(x)} HP`, per: 8, max: 10, base: 60, grow: 1.35 },
    { id: 'atk', icon: 'fist', name: 'Strength', text: x => `+${pct(x)}% damage`, per: 0.04, max: 10, base: 80, grow: 1.38 },
    { id: 'spd', icon: 'boot', name: 'Stride', text: x => `+${pct(x)}% speed`, per: 0.03, max: 8, base: 70, grow: 1.4 },
    { id: 'cd', icon: 'clock', name: 'Reflexes', text: x => `-${pct(x)}% cooldown`, per: 0.03, max: 8, base: 90, grow: 1.42 },
    { id: 'def', icon: 'shield', name: 'Armor', text: x => `+${pct(x)}% defense`, per: 0.02, max: 8, base: 80, grow: 1.4 },
    { id: 'regen', icon: 'sprout', name: 'Synthesis', text: x => `+${num(x)} HP/s`, per: 0.2, max: 5, base: 120, grow: 1.5 },
    { id: 'magnet', icon: 'magnet', name: 'Magnet', text: x => `+${pct(x)}% pickup`, per: 0.12, max: 6, base: 50, grow: 1.4 },
    { id: 'xp', icon: 'book', name: 'Wisdom', text: x => `+${pct(x)}% experience`, per: 0.05, max: 8, base: 100, grow: 1.42 },
    { id: 'coins', icon: 'coin', name: 'Fortune', text: x => `+${pct(x)}% PokéCoins`, per: 0.08, max: 8, base: 120, grow: 1.45 },
    { id: 'moves', icon: 'cards', name: 'Repertoire', text: x => `Start with ${num(1 + x)} moves`, per: 1, max: 1, base: 1500, grow: 1 },
    {
      id: 'crit',
      icon: 'star',
      name: 'Critical Hit',
      text: x => `+${pct(x)}% critical chance (x${num(G.Balance.combat.crit.mul)} damage)`,
      per: 0.03,
      max: 10,
      base: 90,
      grow: 1.4
    },
    {
      id: 'reroll',
      icon: 'up',
      name: 'Card reroll',
      text: x => `+${num(x)} level-up card reroll per run`,
      per: 1,
      max: 5,
      base: 150,
      grow: 1.6
    },
    {
      id: 'ban',
      icon: 'ban',
      name: 'Ban',
      text: x => `Ban ${num(x)} move: it never shows up in your cards`,
      per: 1,
      max: 3,
      base: 300,
      grow: 1.9
    }
  ];
  const BY = {};
  for (const u of LIST) {
    BY[u.id] = u;
    Object.defineProperty(u, 'unit', { get: () => u.text(u.per), enumerable: true });
  }

  function cost(id, lvl) {
    const u = BY[id];
    return Math.round((u.base * Math.pow(u.grow, lvl)) / 10) * 10;
  }

  /** Purchased levels -> modifiers for G.Player. */
  function perks(levels = {}) {
    // Never above the max (a hand-edited save gives no extra power).
    const L = id => Math.max(0, Math.min(BY[id].max, Math.floor(+levels[id] || 0)));
    const per = id => L(id) * BY[id].per;
    return {
      hp: per('hp'),
      atkMul: 1 + per('atk'),
      spdMul: 1 + per('spd'),
      cdMul: 1 - per('cd'),
      dmgReduce: per('def'),
      regen: per('regen'),
      magnetMul: 1 + per('magnet'),
      xpMul: 1 + per('xp'),
      coinMul: 1 + per('coins'),
      startMoves: 1 + per('moves'),
      crit: per('crit'),
      rerolls: per('reroll'),
      bans: per('ban')
    };
  }

  return { LIST, BY, cost, perks };
})();
