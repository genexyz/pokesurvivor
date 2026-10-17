/* ============ perks.js — Trainer perks ============
 * Small run modifiers unlocked by achievements (`ach`) and equipped before a run
 * on the Play screen. Slots: Balance.perks.slots (achievements needed for each).
 * Equipped ids live in save.perks; the numbers are in Balance.perks.
 *
 * apply() sets what is the player's own (works for each player in co-op);
 * on() answers for what belongs to the world (shiny rate, rifts), which only
 * the host's (or solo player's) perks change.
 */
import { Balance } from './balance.js';
import { Items } from './items.js';

export const Perks = (() => {
  const B = Balance.perks;
  const LIST = [
    { id: 'cards', icon: 'cards', ach: 'evo25', name: 'Keen eye', desc: 'Level-ups show 4 cards instead of 3.' },
    { id: 'bossBond', icon: 'bond', ach: 'boss25', name: 'Bond hunter', desc: 'Defeating a boss also gives you a bond.' },
    { id: 'item', icon: 'leftovers', ach: 'time20', name: 'Packed bag', desc: 'Start every run with a random held item.' },
    { id: 'shiny', icon: 'shiny', ach: 'shiny20', name: 'Lucky star', desc: 'Wild shinies appear twice as often.' },
    { id: 'reroll', icon: 'up', ach: 'leg10', name: 'Second chance', desc: 'One more level-up card reroll per run.' },
    { id: 'rift', icon: 'type:psychic', ach: 'arenas', name: 'Rift sense', desc: 'Rifts stay open 20 seconds longer.' },
    {
      id: 'lastStand',
      icon: 'focussash',
      ach: 'flawless1',
      name: 'Last stand',
      desc: 'Once per run, a knockout hit leaves you at 30% HP instead.'
    },
    { id: 'magnet', icon: 'magnet', ach: 'kills10k', name: 'Magnetic', desc: 'You pick things up from 40% farther away.' }
  ];
  const BY = {};
  for (const p of LIST) BY[p.id] = p;
  const byAch = {};
  for (const p of LIST) byAch[p.ach] = p;

  let worldIds = []; // perks of whoever runs the world this run (solo or host)

  const unlocked = (s, id) => !!(s && s.ach && BY[id] && s.ach[BY[id].ach]);

  /** Perk slots this save has (by achievements earned). */
  function slots(s) {
    const n = Object.keys((s && s.ach) || {}).length;
    return B.slots.filter(need => n >= need).length;
  }

  /** The equipped perks that are still valid (known, unlocked, within the slots). */
  function equipped(s) {
    const list = (Array.isArray(s && s.perks) ? s.perks : []).filter((id, i, a) => a.indexOf(id) === i && unlocked(s, id));
    return list.slice(0, slots(s));
  }

  /** Run start: the player's own perks. `world`: this computer runs the world (solo or host). */
  function apply(pl, ids, world = true) {
    worldIds = world ? ids.slice() : [];
    pl.perks = ids.slice();
    const has = id => ids.includes(id);
    if (has('cards')) pl.cardOffer = Balance.levelup.perkOffer;
    if (has('bossBond')) pl.bossBond = true;
    if (has('reroll')) pl.rerollBonus += B.rerolls;
    if (has('magnet')) pl.magnet *= B.magnet;
    if (has('lastStand')) pl.lastStand = true;
    if (has('item')) pl.equip(Items.roll());
  }

  /** A world perk is active this run. */
  const on = id => worldIds.includes(id);

  return { LIST, BY, byAch, B, unlocked, slots, equipped, apply, on };
})();
