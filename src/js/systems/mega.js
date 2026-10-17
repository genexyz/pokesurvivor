/* ============ mega.js — Mega Evolution during a run ============
 * If your partner has a Mega or Primal form (data/megas.js), a boss or a chest
 * drops its Mega Stone (a pickup only you see and only you can take). With
 * the stone, defeating foes fills the Mega meter; when it's full, Space (A on a
 * controller, or the HUD button) Mega Evolves you for Balance.mega.dur seconds
 * (Player.megaStart / megaEnd). Then the meter rests for `lockout` seconds and
 * charges again.
 *
 * Every client runs this for its own partner: in co-op the stone is local and
 * kills arrive on every screen (enemy.js calls onKill for copies too). The
 * others see your Mega sprite through the player state (net/coop.js, `mg`).
 */
import { U } from '../core/util.js';
import { RNG } from '../core/rng.js';
import { Balance } from '../data/balance.js';
import { Audio } from '../core/audio.js';
import { Sprites } from '../core/sprites.js';
import { Megas } from '../data/megas.js';
import { Pickups } from '../entities/pickup.js';
import { Spawner } from './spawner.js';
import { Progress } from './progress.js';
import { Game } from '../game.js';

export const Mega = (() => {
  const B = Balance.mega;
  // Its own stream: rolling for the stone never shifts the loot.
  const R = RNG.stream('mega');
  let pl = null,
    def = null,
    dropped = false,
    bosses = 0,
    told = false; // "ready" notice already shown for this charge

  /** New run: `p` is your player. */
  function reset(p) {
    pl = p;
    def = Megas.of(p.dex);
    dropped = false;
    bosses = 0;
    told = false;
    if (!def) return;
    Sprites.pin(p.dex, def.key);
    Sprites.preload([def.key], 8000, p.shiny);
  }

  function drop(x, y) {
    dropped = true;
    Pickups.dropLocal('stone', x, y - 12, def.dex);
  }

  /** A foe fainted (on the host, solo or as a copy on a guest). */
  function onKill(e) {
    if (!def || !pl) return;
    if (e.boss && !e.judge && !dropped && !pl.megaStone) {
      bosses++;
      if (e.legend || bosses >= B.drop.pityBosses || R.chance(B.drop.boss)) drop(e.x, e.y);
    }
    if (!pl.megaStone || pl.form || pl.megaLock > 0 || pl.dead) return;
    if (U.dist2(e.x, e.y, pl.x, pl.y) > B.radius * B.radius) return;
    charge(e.boss ? B.perBoss : e.golden ? B.perElite : B.perKill);
  }

  /** A chest was opened (big: the locked one). */
  function onChest(p, big) {
    if (!def || !pl || dropped || pl.megaStone) return;
    if (Game.time >= B.drop.pityTime || R.chance(big ? B.drop.bigchest : B.drop.chest)) drop(p.x, p.y);
  }

  function charge(n) {
    pl.megaCharge = Math.min(B.goal, pl.megaCharge + n);
    if (pl.megaCharge >= B.goal && !told) {
      told = true;
      Spawner.say('Mega Evolution ready!', 2.4, true);
      Audio.sfx('levelup');
    }
  }

  /** Every frame (game seconds). */
  function update(dt) {
    if (!def || !pl || !pl.megaStone || pl.form || pl.megaLock > 0 || pl.dead) return;
    charge(B.passive * dt);
  }

  /** You picked up the stone. */
  function collect(p) {
    if (!def || p.megaStone) return;
    p.megaStone = true;
    p.megaCharge = B.goal * B.startFrac;
    Spawner.say(`You got the ${def.item}!`, 3.2, true);
    Audio.sfx('legend');
  }

  function ready(p = pl) {
    return !!(def && p && p.megaStone && !p.form && !p.dead && p.megaLock <= 0 && p.megaCharge >= B.goal);
  }

  /** Space / A / HUD button. */
  function tryEvolve(p = pl) {
    if (!ready(p)) return false;
    told = false;
    p.megaStart(def);
    Progress.event('mega', { dex: def.dex });
    return true;
  }

  return {
    reset,
    onKill,
    onChest,
    update,
    collect,
    ready,
    tryEvolve,
    /** Your partner's Mega form this run (null if it has none). */
    get def() {
      return def;
    },
    /** Testing (dev panel): the stone in hand and the meter full. */
    debugGive() {
      if (!def || !pl) return;
      collect(pl);
      pl.megaLock = 0;
      charge(B.goal);
    }
  };
})();
