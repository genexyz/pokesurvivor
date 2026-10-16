/* ============ upgrades.js — permanent upgrades between runs ============
 * Bought with PokéCoins in the menu. `per` is what each level grants.
 */
G.Upgrades = (() => {
  const LIST = [
    { id: 'hp', icon: 'heart', name: 'Vitality', unit: '+8 HP', max: 10, base: 60, grow: 1.35 },
    { id: 'atk', icon: 'fist', name: 'Strength', unit: '+4% damage', max: 10, base: 80, grow: 1.38 },
    { id: 'spd', icon: 'boot', name: 'Stride', unit: '+3% speed', max: 8, base: 70, grow: 1.4 },
    { id: 'cd', icon: 'clock', name: 'Reflexes', unit: '-3% cooldown', max: 8, base: 90, grow: 1.42 },
    { id: 'def', icon: 'shield', name: 'Armor', unit: '+2% defense', max: 8, base: 80, grow: 1.4 },
    { id: 'regen', icon: 'sprout', name: 'Synthesis', unit: '+0.2 HP/s', max: 5, base: 120, grow: 1.5 },
    { id: 'magnet', icon: 'magnet', name: 'Magnet', unit: '+12% pickup', max: 6, base: 50, grow: 1.4 },
    { id: 'xp', icon: 'book', name: 'Wisdom', unit: '+5% experience', max: 8, base: 100, grow: 1.42 },
    { id: 'coins', icon: 'coin', name: 'Fortune', unit: '+8% PokéCoins', max: 8, base: 120, grow: 1.45 },
    { id: 'moves', icon: 'cards', name: 'Repertoire', unit: 'Start with 2 moves', max: 1, base: 1500, grow: 1 },
    { id: 'crit', icon: 'star', name: 'Critical Hit', unit: '+3% critical chance (x1.5 damage)', max: 10, base: 90, grow: 1.4 },
    { id: 'reroll', icon: 'up', name: 'Card reroll', unit: '+1 level-up card reroll per run', max: 5, base: 150, grow: 1.6 },
    { id: 'ban', icon: 'ban', name: 'Ban', unit: 'Ban 1 move: it never shows up in your cards', max: 3, base: 300, grow: 1.9 }
  ];
  const BY = {};
  for (const u of LIST) BY[u.id] = u;

  function cost(id, lvl) {
    const u = BY[id];
    return Math.round((u.base * Math.pow(u.grow, lvl)) / 10) * 10;
  }

  /** Purchased levels -> modifiers for G.Player. */
  function perks(levels = {}) {
    // Never above the max (a hand-edited save gives no extra power).
    const L = id => Math.max(0, Math.min(BY[id].max, Math.floor(+levels[id] || 0)));
    return {
      hp: L('hp') * 8,
      atkMul: 1 + L('atk') * 0.04,
      spdMul: 1 + L('spd') * 0.03,
      cdMul: 1 - L('cd') * 0.03,
      dmgReduce: L('def') * 0.02,
      regen: L('regen') * 0.2,
      magnetMul: 1 + L('magnet') * 0.12,
      xpMul: 1 + L('xp') * 0.05,
      coinMul: 1 + L('coins') * 0.08,
      startMoves: 1 + L('moves'),
      crit: L('crit') * 0.03,
      rerolls: L('reroll'),
      bans: L('ban')
    };
  }

  return { LIST, BY, cost, perks };
})();
