/* ============ items.js — held items (one per run) ============
 * Found in chests (sometimes in normal ones, often in locked ones) and
 * dropped by bosses. You can only hold ONE; if you find another, you choose
 * which one to keep. They last for the whole run.
 *
 *   on(pl)   equip it (what it does while held)
 *   off(pl)  unequip it (undoes on)
 * Items that react to something (lethal hit, damage dealt...) are checked
 * by the player with pl.hasItem(id).
 */
G.Items = (() => {
  const LIST = [
    {
      id: 'leftovers',
      name: 'Leftovers',
      desc: 'You recover 1.5% of your HP per second.',
      on: p => {
        p.regenFlat += p.maxHp * 0.015;
        p._itemRegen = p.maxHp * 0.015;
      },
      off: p => {
        p.regenFlat -= p._itemRegen || 0;
      }
    },
    {
      id: 'choiceband',
      name: 'Choice Band',
      desc: "+40% damage, but you can't switch moves.",
      on: p => {
        p.atkMul *= 1.4;
      },
      off: p => {
        p.atkMul /= 1.4;
      }
    },
    {
      id: 'quickclaw',
      name: 'Quick Claw',
      desc: '-20% cooldown on all your moves.',
      on: p => {
        p.cdMul *= 0.8;
      },
      off: p => {
        p.cdMul /= 0.8;
      }
    },
    {
      id: 'focussash',
      name: 'Focus Sash',
      desc: 'A hit that would knock you out leaves you at 1 HP (every 60 s).',
      on: () => {},
      off: () => {}
    },
    { id: 'shellbell', name: 'Shell Bell', desc: 'You heal from the damage you deal.', on: () => {}, off: () => {} },
    {
      id: 'amuletcoin',
      name: 'Amulet Coin',
      desc: '+50% PokéCoins at the end of the run.',
      on: p => {
        p.coinMul *= 1.5;
      },
      off: p => {
        p.coinMul /= 1.5;
      }
    },
    {
      id: 'luckyegg',
      name: 'Lucky Egg',
      desc: '+30% experience.',
      on: p => {
        p.xpMul *= 1.3;
      },
      off: p => {
        p.xpMul /= 1.3;
      }
    },
    {
      id: 'lifeorb',
      name: 'Life Orb',
      desc: '+30% damage, but each attack costs a little HP.',
      on: p => {
        p.atkMul *= 1.3;
      },
      off: p => {
        p.atkMul /= 1.3;
      }
    },
    {
      id: 'choicescarf',
      name: 'Choice Scarf',
      desc: '+35% speed.',
      on: p => {
        p.spdMul *= 1.35;
      },
      off: p => {
        p.spdMul /= 1.35;
      }
    },
    { id: 'rockyhelmet', name: 'Rocky Helmet', desc: 'Foes that hit you in melee take damage.', on: () => {}, off: () => {} },
    {
      id: 'assaultvest',
      name: 'Assault Vest',
      desc: '+20% damage reduction.',
      on: p => {
        p.dmgReduce += 0.2;
      },
      off: p => {
        p.dmgReduce -= 0.2;
      }
    }
  ];
  const BY = {};
  for (const it of LIST) BY[it.id] = it;

  /** A random one, different from the one you already hold. */
  function roll(except) {
    const pool = LIST.filter(i => i.id !== except);
    return G.U.pick(pool).id;
  }

  return { LIST, BY, roll };
})();
