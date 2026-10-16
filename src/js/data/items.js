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
  const pct = G.U.pct;
  /**
   * An item that multiplies a stat while held: by (1 + val), or by (1 - val)
   * with `down`. The factor applied is kept on the player, so a live balance
   * change never leaves the stat wrong when the item comes off.
   */
  function mult(id, name, stat, val, text, down = false) {
    const it = {
      id,
      name,
      val,
      get desc() {
        return text(pct(it.val));
      },
      on: p => {
        p._itemK = down ? 1 - it.val : 1 + it.val;
        p[stat] *= p._itemK;
      },
      off: p => {
        p[stat] /= p._itemK || 1;
      }
    };
    return it;
  }
  const SASH = G.Balance.items.focusSash;
  const LIST = [
    {
      id: 'leftovers',
      name: 'Leftovers',
      val: 0.015, // fraction of max HP healed per second
      get desc() {
        return `You recover ${pct(this.val)}% of your HP per second.`;
      },
      on: p => {
        p._itemRegen = p.maxHp * BY.leftovers.val;
        p.regenFlat += p._itemRegen;
      },
      off: p => {
        p.regenFlat -= p._itemRegen || 0;
      }
    },
    mult('choiceband', 'Choice Band', 'atkMul', 0.4, x => `+${x}% damage, but you can't switch moves.`),
    mult('quickclaw', 'Quick Claw', 'cdMul', 0.2, x => `-${x}% cooldown on all your moves.`, true),
    {
      id: 'focussash',
      name: 'Focus Sash',
      get desc() {
        return `A hit that would knock you out leaves you at 1 HP (every ${G.U.num(SASH.cooldown)} s).`;
      },
      on: () => {},
      off: () => {}
    },
    { id: 'shellbell', name: 'Shell Bell', desc: 'You heal from the damage you deal.', on: () => {}, off: () => {} },
    mult('amuletcoin', 'Amulet Coin', 'coinMul', 0.5, x => `+${x}% PokéCoins at the end of the run.`),
    mult('luckyegg', 'Lucky Egg', 'xpMul', 0.3, x => `+${x}% experience.`),
    mult('lifeorb', 'Life Orb', 'atkMul', 0.3, x => `+${x}% damage, but each attack costs a little HP.`),
    mult('choicescarf', 'Choice Scarf', 'spdMul', 0.35, x => `+${x}% speed.`),
    { id: 'rockyhelmet', name: 'Rocky Helmet', desc: 'Foes that hit you in melee take damage.', on: () => {}, off: () => {} },
    {
      id: 'assaultvest',
      name: 'Assault Vest',
      val: 0.2, // damage reduction while held
      get desc() {
        return `+${pct(this.val)}% damage reduction.`;
      },
      on: p => {
        p._itemDef = BY.assaultvest.val;
        p.dmgReduce += p._itemDef;
      },
      off: p => {
        p.dmgReduce -= p._itemDef || 0;
      }
    }
  ];
  const BY = {};
  for (const it of LIST) BY[it.id] = it;

  // Item drops and chest rolls use the seeded 'loot' stream.
  const R = G.RNG.stream('loot');

  /** A random one, different from the one you already hold. */
  function roll(except) {
    const pool = LIST.filter(i => i.id !== except);
    return R.pick(pool).id;
  }

  return { LIST, BY, roll };
})();
