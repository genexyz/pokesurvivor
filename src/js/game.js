/* ============ game.js — game flow and main loop ============
 *
 *   login ──> personality test ──────> menu ──> run ──> summary ──> menu
 *                (first time only)         │
 *                                          ├─ Pokémon (collection)
 *                                          ├─ Upgrades
 *                                          └─ Gacha
 *
 * Loop states: 'ui' (menus, with the world in the background), 'playing',
 * 'levelup', 'paused', 'over'.
 *
 * Co-op (Coop.active): the host runs enemies, items and experience;
 * each player runs their own Pokémon. Pause doesn't stop the game, level
 * cards wait until everyone has picked, and a fallen teammate gets back up
 * if another one stays beside them. See net/coop.js.
 */
import { U } from './core/util.js';
import { RNG } from './core/rng.js';
import { Balance } from './data/balance.js';
import { I18n } from './core/i18n.js';
import { Settings } from './core/settings.js';
import { BIOME_MUSIC } from './data/music.js';
import { DEX_BY } from './data/pokedex.js';
import { DB } from './core/db.js';
import { Audio } from './core/audio.js';
import { Input } from './core/input.js';
import { Touch } from './core/touch.js';
import { Sprites } from './core/sprites.js';
import { Camera } from './core/camera.js';
import { Moves } from './data/moves.js';
import { startMoveOf } from './data/starters.js';
import { Upgrades } from './data/upgrades.js';
import { Items } from './data/items.js';
import { World } from './world/world.js';
import { FX } from './entities/fx.js';
import { Projectiles } from './entities/projectile.js';
import { EnemyMgr } from './entities/enemy.js';
import { Pickups } from './entities/pickup.js';
import { Player } from './entities/player.js';
import { Combat } from './systems/combat.js';
import { Spawner } from './systems/spawner.js';
import { LevelUp } from './systems/levelup.js';
import { Interact } from './systems/interact.js';
import { Rift } from './systems/rift.js';
import { Judgment } from './systems/judgment.js';
import { Events } from './systems/events.js';
import { Weather } from './systems/weather.js';
import { Path } from './systems/pathing.js';
import { Progress } from './systems/progress.js';
import { Hazards } from './systems/hazards.js';
import { Recount } from './systems/recount.js';
import { Story } from './systems/story.js';
import { Social } from './net/social.js';
import { Coop } from './net/coop.js';
import { Ranking } from './net/ranking.js';
import { Icons } from './ui/icons.js';
import { UI } from './ui/ui.js';
import { HUD } from './ui/hud.js';
import { LoginUI } from './ui/login.js';
import { TestUI } from './ui/test.js';
import { MenuUI } from './ui/menu.js';
import { PlayUI } from './ui/play-ui.js';
import { GachaUI } from './ui/gacha-ui.js';
import { MoveTip } from './ui/move-tip.js';
import { RunUI } from './ui/run-ui.js';
import { LobbyUI, SocialUI } from './ui/social-ui.js';
import { RankingUI } from './ui/ranking-ui.js';
import { ModUI } from './ui/mod-ui.js';
import { GoalsUI, ProfileUI } from './ui/goals-ui.js';
import { SettingsUI } from './ui/settings-ui.js';
import { NewsUI } from './ui/news-ui.js';
import { Updater } from './core/updater.js';

export const Game = (() => {
  let cv,
    ctx,
    dpr = 1,
    w = 0,
    h = 0;
  let state = 'ui';
  let time = 0,
    last = 0,
    pendingLevels = 0;
  let pl = null;
  let caught = []; // shinies caught in this run
  let biome = -1;
  // Run tuning (biome length, revive, death delays, end-of-run coins): Balance.run;
  // pickup effects (berry, bomb): Balance.drops.
  const BR = Balance.run,
    BD = Balance.drops;
  const levelupR = RNG.stream('levelup');

  const st = {
    get time() {
      return time;
    }
  };

  // ---------------- boot ----------------

  let pullFx = null;
  function init() {
    cv = document.getElementById('game');
    ctx = cv.getContext('2d');
    pullFx = document.getElementById('pull-fx');
    resize();
    addEventListener('resize', resize);
    // Resolution setting, or automatic quality dropping to low: new canvas size.
    Settings.on(k => {
      if (k === 'res' || k === 'quality' || k === 'autoLevel') resize();
    });
    watchDpr();
    Touch.init(cv);
    // On mobile: switching apps or turning it to portrait pauses the run.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) autoPause();
      // The sound engine stops in the background (not in co-op: the run goes on there).
      if (!document.hidden || !Coop.active) Audio.background(document.hidden);
    });
    RunUI.wirePause(() => {
      state = 'playing';
      UI.hideAll();
    }, quitRun);
    Backdrop.init();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  /*
   * Internal resolution (setting `res`). At most ×1.5: on ×2 screens drawing twice the
   * pixels was one of the most expensive things, and with pixel art it doesn't show.
   *   'high'  up to ×1.5 · 'low'  ×1 (much lighter on big or ×2 screens; text a bit blockier)
   *   'auto'  ×1.5, and ×1 when the effects quality is (or drops to) low
   */
  function computeDpr() {
    const raw = window.devicePixelRatio || 1;
    const res = Settings.get('res');
    if (res === 'low' || (res !== 'high' && Settings.fx === 0)) return 1;
    return Math.min(1.5, raw);
  }
  /** Moving the window to a screen with another pixel density also resizes. */
  function watchDpr() {
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const on = () => {
      mq.removeEventListener('change', on);
      resize();
      watchDpr();
    };
    mq.addEventListener('change', on);
  }

  function resize() {
    dpr = computeDpr();
    w = cv.clientWidth;
    h = cv.clientHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    Camera.resize(w, h, dpr);
    checkOrientation();
  }

  /** Mobile in portrait: prompt to rotate it (and pause). */
  function checkOrientation() {
    const portrait = Touch.active && innerHeight > innerWidth;
    const el = document.getElementById('rotate');
    if (!el) return;
    if (portrait && !document.getElementById('rotate-ico').innerHTML)
      document.getElementById('rotate-ico').innerHTML = Icons.html('phone', 48);
    el.classList.toggle('hidden', !portrait);
    if (portrait) autoPause();
  }

  /** Auto-pause (solo only: in a group the others keep playing). */
  function autoPause() {
    Touch.reset();
    if (state === 'playing' && !Coop.active) {
      state = 'paused';
      RunUI.showPause();
    }
  }

  /** Pause/resume (Esc or P key, or the mobile pause button). */
  let holdBy = []; // group: who is choosing a fusion (everything stopped)

  function togglePause() {
    // In a group, pause doesn't stop the game (the others keep playing).
    if (Coop.active) {
      if (state !== 'playing') return;
      if (UI.isOpen('scr-pause')) UI.hide('scr-pause');
      else {
        RunUI.showPause(true);
        Audio.sfx('pause');
      }
      return;
    }
    if (state === 'playing') {
      state = 'paused';
      RunUI.showPause();
      Audio.sfx('pause');
    } else if (state === 'paused') {
      state = 'playing';
      UI.hideAll();
    }
  }

  // ---------------- run ----------------

  // Seed for the next solo runs (?seed=CODE in the URL or the dev panel); null = random.
  let fixedSeed = RNG.parse(new URLSearchParams(location.search).get('seed'));

  /**
   * @param coop     { seed, host, members } for a group run
   * @param stageId  a story stage (data/stages.js); solo only, a group run is always endless
   */
  function startRun(coop = null, stageId = null) {
    // First of all: every system rolls its run from these streams (core/rng.js).
    if (coop) RNG.start(coop.seed);
    else if (fixedSeed != null) RNG.start(fixedSeed, true);
    else RNG.start();
    holdBy = [];
    awayBy = null;
    Story.begin(coop ? null : stageId); // before Spawner.reset: it rolls the stage's cast
    const save = DB.save;
    const mon = DEX_BY[save.partner];
    const perks = Upgrades.perks(DB.upgradesOf(mon.dex));

    UI.hideAll();
    UI.chrome(false);
    FX.clear();
    Projectiles.clear();
    Combat.clearFields();
    EnemyMgr.clear();
    Pickups.clear();
    Spawner.reset();
    Rift.reset();
    Judgment.reset();
    Events.reset();
    Weather.reset();
    Path.clear();
    Hazards.clear();
    World.reset(RNG.seed);
    World.setBiome(0, true);
    biome = 0;
    time = 0;
    pendingLevels = 0;
    runReal = performance.now();
    tampered = false;

    pl = new Player(mon, perks, !!save.partnerShiny && DB.ownsShiny(mon.dex));
    Recount.reset(pl);
    banked = { t1: 0, t10: 0 };
    caught = [];
    // Shortcuts: moves with a fixed slot (save.pbind[dex] = [id of 1, id of 2, ...]),
    // before learning anything: addMove already places them.
    ((save.pbind && save.pbind[mon.dex]) || []).forEach((id, i) => {
      if (id) pl.bind[id] = i;
    });
    pl.addMove(startMoveOf(mon.dex));
    // "Veto" upgrade: moves you don't want to be offered.
    pl.banned = new Set(((save.pban && save.pban[mon.dex]) || []).slice(0, perks.bans));
    // "Repertoire" upgrade: a second random attack move.
    if (perks.startMoves >= 2) {
      const pool = Moves.poolFor(mon).filter(id => !pl.hasMove(id) && !pl.banned.has(id) && Moves.BY_ID[id].kind !== 'buff');
      if (pool.length) pl.addMove(levelupR.pick(pool));
      pl.setActive(0);
    }

    if (coop) {
      Coop.begin(coop, pl, coopApi);
      Social.setPlaying(true);
    }
    Camera.x = pl.x;
    Camera.y = pl.y;
    Camera.shake = 0;
    // Local sprite sheets: the partner and the first enemies.
    Sprites.preload([mon.dex], 8000, pl.shiny);
    Audio.music(BIOME_MUSIC[0]);
    // For the leaderboard: the server records when the run starts (anti-cheat). Story runs aren't ranked.
    if (!Story.active && (!coop || Coop.isHost)) Ranking.runStarted(coop ? 'g' : 's');
    deathT = 0;

    state = 'playing';
  }

  function quitRun() {
    if (Coop.active) Coop.leave();
    endRun(false);
  }

  /** Every player in the run (you first). */
  function everyone() {
    return Coop.active ? Coop.players() : [pl];
  }

  /** Experience needed for the next level (locked chests). */
  function levelXp() {
    if (!pl) return BR.levelXpFallback;
    const k = (Coop.active ? Coop.xpFactor() : 1) * (pl.xpMul || 1);
    return Math.ceil((pl.xpNext - pl.xp + 1) / k);
  }

  // Full-screen flash (trip to the rift).
  let flashT = 0,
    flashDur = 1,
    flashCol = '#fff';
  function flash(col, dur) {
    flashCol = col;
    flashDur = dur;
    flashT = dur;
  }

  function teamState() {
    return {
      time,
      level: pl.level,
      xp: pl.xp,
      xpNext: pl.xpNext,
      kills: pl.kills,
      bosses: pl.bosses,
      coins: pl.coins,
      t1: pl.t1,
      t10: pl.t10
    };
  }
  function summary() {
    return { t: time, ki: pl.kills, bo: pl.bosses, co: pl.coins, lv: pl.level, t1: pl.t1, t10: pl.t10 };
  }

  /** What co-op needs from the game. */
  /**
   * Collected tickets are saved as soon as you pick them up (like shinies):
   * before, only at the end, and if the tab was closed suddenly they were lost.
   * `banked` = the ones from this run that are already in the save.
   */
  let banked = { t1: 0, t10: 0 };
  function bankTickets(save_ = true) {
    const sv = DB.save;
    if (!sv || !pl) return;
    sv.tickets = sv.tickets || { t1: 0, t10: 0 };
    const d1 = Math.max(0, pl.t1 - banked.t1),
      d10 = Math.max(0, pl.t10 - banked.t10);
    if (!d1 && !d10) return;
    sv.tickets.t1 += d1;
    sv.tickets.t10 += d10;
    banked = { t1: pl.t1, t10: pl.t10 };
    if (save_) DB.commit('run');
  }

  const coopApi = {
    team: teamState,
    summary,
    // Guest: the host sends the clock and the team stats.
    syncTeam(t) {
      if (Math.abs(t.time - time) > 0.4) time = t.time;
      if (t.level > pl.level) Audio.sfx('xp');
      pl.level = t.level;
      pl.xp = t.xp;
      pl.xpNext = t.xpNext;
      pl.kills = t.kills;
      pl.bosses = t.bosses;
      pl.coins = t.coins;
      if (t.t1 > pl.t1 || t.t10 > pl.t10) Audio.sfx('shiny');
      pl.t1 = t.t1 || 0;
      pl.t10 = t.t10 || 0;
      bankTickets();
    },
    levelStart(level) {
      // (If you had the item choice open, it comes back afterwards: afterLevelUp.)
      if (state === 'choice' && openItem && Coop.active) Coop.holdEnd();
      state = 'levelup';
      UI.hide('scr-pause');
      Audio.sfx('levelup');
      RunUI.showLevelUp(
        level,
        LevelUp.offer(pl),
        card => {
          Audio.sfx('confirm');
          card.apply(pl);
          Coop.localPicked();
        },
        true
      );
    },
    waiting(names) {
      RunUI.setWaiting(names);
    },
    resume() {
      RunUI.closeLevelUp();
      if (state === 'levelup') {
        state = holdBy.length ? 'held' : 'playing';
        afterLevelUp();
      }
    },
    /** Are you choosing something that pauses the run (item or bond)? */
    choosing() {
      return state === 'choice';
    },
    inLevelUp() {
      return state === 'levelup';
    },
    shiny(dex) {
      onShinyCaught({ dex, name: (DEX_BY[dex] || {}).name || '' });
    },
    over(d) {
      if (d)
        Object.assign(pl, {
          kills: d.ki,
          bosses: d.bo,
          coins: d.co,
          level: Math.max(pl.level, d.lv || 1),
          t1: d.t1 || pl.t1,
          t10: d.t10 || pl.t10
        });
      if (d && d.t) time = d.t;
      if (d && d.why === 'host') UI.toast('The host has ended the game', 3200);
      endRun(!(d && d.why === 'host'));
    },
    lost(msg) {
      UI.toast(msg, 3600);
      endRun(false);
    },
    item(id) {
      offerItem(id);
    },
    mateLeft() {},
    /** Group: who is choosing a fusion. While anyone is, everything is stopped. */
    hold(names) {
      holdBy = names || [];
      const mine = UI.isOpen('scr-bond');
      if (holdBy.length) {
        if (state === 'playing') state = 'held';
        if (pl && pl.bonds > 0) offerBond(true); // if you have a bond too, you choose at the same time
        const others = holdBy.filter(n => n !== (Social.me && Social.me.name) && n !== 'You');
        if (!mine && others.length)
          Spawner.say(others.length > 1 ? `Paused: ${others.join(', ')} are choosing…` : `Paused: ${others[0]} is choosing…`, 999, true);
        else if (!others.length) Spawner.say(awayBy ? awayText() : '', awayBy ? 999 : 0, true); // only you: no stale notice
      } else {
        if (state === 'held' && !awayBy) state = 'playing';
        Spawner.say(awayBy ? awayText() : '', awayBy ? 999 : 0, true);
      }
    },
    /** Group (guest): the host has left the tab or isn't responding: everything stopped. */
    away(name) {
      awayBy = name || null;
      if (awayBy) {
        if (state === 'playing') state = 'held';
        Spawner.say(awayText(), 999, true);
      } else if (!holdBy.length) {
        if (state === 'held') state = 'playing';
        Spawner.say('', 0, true);
      }
    }
  };
  let awayBy = null;
  const awayText = () => `Paused: waiting for ${awayBy} (host)…`;

  /** You brought a lost Pokémon home and it joins you (events.js). */
  const onRescue = (dex, name) => {
    if (!DB.save || !pl) return;
    const isNew = !DB.owns(dex);
    if (isNew) {
      DB.grant(dex, 'rescue');
      DB.commit(true);
    } else pl.coins += BR.rescueDupCoins;
    Spawner.say(isNew ? `${name} joins your team!` : `${name} thanks you! (+${U.num(BR.rescueDupCoins)} coins, you already had it)`, 4);
    Audio.sfx('shinyGet');
  };

  /** A wild shiny falls: you keep it (and the normal version if you didn't have it). */
  const onShinyCaught = e => {
    if (!DB.save || !pl) return;
    if (Coop.isHost) Coop.shinyCaught(e);
    const isNew = DB.grantShiny(e.dex, 'wild');
    DB.save.stats.shinies++;
    DB.commit(true);
    caught.push({ dex: e.dex, isNew });
    Spawner.say(isNew ? `You got a shiny ${e.name}!` : `Another shiny ${e.name}! (+${U.num(BR.shinyDupCoins)} coins)`, 4);
    if (!isNew) pl.coins += BR.shinyDupCoins;
    Audio.sfx('shinyGet');
  };

  /** @param won  a story stage was cleared (its gym beaten) */
  function endRun(dead = true, won = false) {
    if (state === 'over' || !pl) return;
    const coop = !!pl.uid; // only group runs give it a uid
    const wasHost = !!pl.coopHost;
    const team = coop ? Coop.members.slice() : [];
    const damage = Recount.snapshot(time); // before Coop.end(): the teammates are still there
    if (Coop.active) Coop.end();
    if (coop) Social.setPlaying(false);
    state = 'over';
    Audio.music(null);
    Audio.sfx(won ? 'legend' : dead ? 'gameover' : 'back');
    const save = DB.save;
    const mul = pl.coinMul;
    // Story: the clear is saved and its reward added (it doesn't touch the endless records).
    const story = Story.finish(won, time);
    if (story && story.reward) pl.t1 += story.reward.t1;
    const C = BR.coins;
    const parts = {
      time: Math.floor(time / C.perSeconds),
      defeated: Math.floor(pl.kills * C.perKill),
      bosses: pl.bosses * C.perBoss,
      collected: pl.coins
    };
    let coins = Math.round((parts.time + parts.defeated + parts.bosses + parts.collected) * mul);
    if (story && story.reward) coins += story.reward.coins;
    const record = !story && time > save.stats.bestTime;

    save.coins += coins;
    bankTickets(false);
    save.stats.runs++;
    save.stats.totalKills += pl.kills;
    if (!story) save.stats.bestTime = Math.max(save.stats.bestTime, Math.floor(time));
    if (coop) save.stats.bestGroupTime = Math.max(save.stats.bestGroupTime || 0, Math.floor(time));
    save.stats.bestLevel = Math.max(save.stats.bestLevel, pl.level);
    save.stats.coinsEarned += coins;
    const judge = Judgment.summary();
    if (judge) Progress.event('judgeEnd', judge);
    Judgment.reset();
    Progress.event('runEnd', { time, level: pl.level, coins: pl.coins, types: pl.mon.types, group: coop, story: !!story });
    Progress.checkAch();
    // To the cloud when the run ends (at most every 30 min); if the score makes
    // a top list (today, week or month), right away (below, after submitting it to the leaderboard).
    DB.commit('run');
    if (Social.me) Social.publishProfile();

    // Leaderboard: solo, each player submits their own; in a group the host submits it.
    const mark = { t: Math.floor(time), lv: pl.level, kills: pl.kills };
    // If the run was tampered with (see clean()), it isn't submitted to the leaderboard (silently); everything else is.
    // (Nor is a run with a chosen seed: you could pick an easy one.)
    const ok = clean() && !RNG.custom && !story;
    const sent =
      ok && !coop
        ? Ranking.submitSolo(Object.assign(mark, { dex: pl.dex, shiny: pl.shiny }))
        : ok && wasHost
          ? Ranking.submitGroup(Object.assign(mark, { members: team }))
          : null;
    if (sent)
      sent
        .then(b => {
          if (b && b.some(p => p !== 'a')) DB.commit(true);
        })
        .catch(() => {});

    RunUI.showOver(
      {
        dead,
        time,
        level: pl.level,
        kills: pl.kills,
        bosses: pl.bosses,
        coins,
        record,
        t1: pl.t1,
        t10: pl.t10,
        judge,
        moves: pl.moves,
        player: pl,
        damage,
        caught,
        story,
        breakdown:
          Object.entries(parts)
            .filter(([, v]) => v)
            .map(([k, v]) => I18n.f(k + ' {x}', v))
            .join(' · ') +
          (mul > 1 ? ' ' + I18n.f('· ×{x} Fortune', mul.toFixed(2)) : '') +
          (story && story.reward ? ' ' + I18n.f('· gym +{x}', story.reward.coins) : '')
      },
      () => {
        pl = null;
        Story.end();
        Flow.afterRun();
      },
      // Story: play a stage again (or the next one) straight from the summary.
      story
        ? id => {
            pl = null;
            Story.end();
            Flow.replay(id);
          }
        : null
    );
  }

  /*
   * Clean run? Only things no legitimate player can do, with
   * huge margins (the 10-10 system gave false positives):
   *   - the run clock runs faster than real time (speed hacks)
   *   - your Pokémon's functions replaced (that's how you make yourself invincible)
   *   - HP, attack, speed or cooldown far beyond what's possible
   *   - the testing functions were used (skipping the clock...)
   * If anything trips, that run isn't submitted to the leaderboard (silently), nothing more.
   */
  let runReal = 0,
    tampered = false;
  function clean() {
    if (tampered) return false;
    if (time > (performance.now() - runReal) / 1000 + 10) return false;
    for (const k of ['hurt', 'update', 'heal', 'gainXp']) if (Object.prototype.hasOwnProperty.call(pl, k)) return false;
    if (!isFinite(pl.hp) || !isFinite(pl.maxHp) || pl.hp > pl.maxHp + 1 || pl.maxHp > 50000) return false;
    if (pl.atkMul > 2000 || pl.spdMul > 25 || pl.cdMul < 0.03 || pl.level > 20 + time / 3) return false;
    return true;
  }

  // ---------------- level up ----------------

  function maybeLevelUp() {
    if (pendingLevels <= 0 || state !== 'playing') return;
    if (Coop.active) {
      // In a group, the cards show up for everyone at once and wait until they pick.
      if (Coop.players().every(p => p.dead)) return;
      pendingLevels--;
      Coop.levelStart(pl.level);
      return;
    }
    // Never open cards with the Pokémon fainted (dying and picking up XP on the same frame).
    if (pl.dead) return;
    pendingLevels--;
    state = 'levelup';
    Audio.sfx('levelup');
    RunUI.showLevelUp(pl.level, LevelUp.offer(pl), card => {
      Audio.sfx('confirm');
      card.apply(pl);
      state = 'playing';
    });
  }

  // ---------------- bonds ----------------

  /**
   * Legendary bond: you choose which moves get fused.
   * If it isn't possible right now (no two free moves), it is kept until you learn
   * another move. Checked every frame: if another screen covers it (level
   * cards in a group, pause), it shows up again when that one closes.
   * @param quiet  don't announce it if it isn't possible yet
   */
  function offerBond(quiet = false) {
    if (!pl || pl.bonds <= 0 || pl.dead || (state !== 'playing' && state !== 'held') || Rift.inArena) return;
    if (['scr-bond', 'scr-pause', 'scr-item', 'scr-levelup'].some(UI.isOpen)) return;
    const opt = pl.bondOptions();
    if (!opt) {
      if (!quiet) Spawner.say('Bond saved: learn another move to use it', 3, true);
      return;
    }
    // The game stops; in a group, for everyone until each one has chosen (Coop.holdStart).
    state = 'choice';
    if (Coop.active) Coop.holdStart();
    Audio.sfx('levelup');
    RunUI.showBond(opt, picked => {
      const group = pl.fuse(picked, opt.group);
      Audio.sfx('legend');
      FX.ring(pl.x, pl.y, 8, 130, '#ff8ad8', 0.8, 6);
      FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#ffb3e6', 40, 240);
      Spawner.say(`Bond! ${group.length} moves at once`, 2.6, true);
      if (state === 'choice') state = holdBy.length ? 'held' : 'playing';
      if (Coop.active) Coop.holdEnd();
    });
  }

  // ---------------- pickups ----------------

  const PICK_SFX = {
    xp: 'xp',
    xpBig: 'xp',
    coin: 'coin',
    heal: 'heal',
    bomb: 'break',
    magnet: 'confirm',
    ticket: 'shiny',
    ticket10: 'legend',
    item: 'legend'
  };

  /*
   * Co-op: the item choice and the level cards must not cover each other.
   * If an item arrives while the cards are open, it waits until you pick a card; and if
   * the cards arrive while the item choice is open, that one comes back once you're
   * done. (Before, one closed the other, nobody could finish choosing and the
   * run stayed stuck for everyone.)
   */
  let openItem = null; // { cur, next, take } unfinished item choice
  const laterItems = []; // items picked up while the level cards were open
  function afterLevelUp() {
    if (state !== 'playing' && state !== 'held') return;
    if (openItem && !UI.isOpen('scr-item')) {
      const o = openItem;
      if (o.mine) {
        state = 'choice';
        if (Coop.active) Coop.holdStart();
      }
      RunUI.showItemChoice(o.cur, o.next, o.take);
      return;
    }
    if (laterItems.length) offerItem(laterItems.shift());
  }

  /** With no item held, does this one ask first? (setting `itemConfirm`) */
  function confirmFirst(id) {
    const rule = Settings.get('itemConfirm');
    return rule === 'always' || (rule !== 'never' && !!Items.BY[id].drawback);
  }

  /**
   * You picked up an item. Holding none: you equip it, unless it asks first (see
   * confirmFirst; then you can also go on without it). Holding one: you choose.
   */
  function offerItem(id) {
    if (!pl || !Items.BY[id]) return;
    // One choice at a time: a second item (e.g. two in the same co-op batch) waits its
    // turn. Replacing the open one left its pause unreleased and the group stuck.
    if (state === 'levelup' || UI.isOpen('scr-levelup') || openItem || UI.isOpen('scr-item')) {
      laterItems.push(id);
      return;
    }
    let mine = false; // this choice is the one that stopped the game
    const take = got => {
      openItem = null;
      if (got && got !== pl.item) {
        pl.equip(got);
        Spawner.say(`You're holding ${Items.BY[got].name}!`, 2.6, true);
        Progress.event('item', { id: got });
      } else if (!got && !pl.item) {
        Spawner.say('Still no item', 2, true);
      }
      if (!mine) {
        afterLevelUp();
        return;
      }
      if (state === 'choice') state = holdBy.length ? 'held' : 'playing';
      if (Coop.active) Coop.holdEnd();
      afterLevelUp();
    };
    if (!pl.item && !confirmFirst(id)) {
      take(id);
      return;
    }
    if (pl.item === id) {
      Spawner.say(`You already hold ${Items.BY[id].name}`, 2, true);
      return;
    }
    // The game stops while you choose; in a group, for everyone (as with
    // fusions). Before, in a group it kept going and you got hit while choosing.
    if (state === 'playing' || state === 'held') {
      mine = true;
      state = 'choice';
      if (Coop.active) Coop.holdStart();
    }
    openItem = {
      cur: pl.item,
      next: id,
      take,
      get mine() {
        return mine;
      }
    };
    RunUI.showItemChoice(pl.item, id, take);
  }

  /** @param who  who picked it up (in co-op it can be a teammate) */
  function onCollect(p, who = pl) {
    const mine = who === pl;
    if (Coop.active && !Coop.isHost) {
      // Copy of a host item: the host decides the effect.
      if (mine) Audio.sfx(PICK_SFX[p.kind]);
      return;
    }
    if (Coop.active) Coop.collected(p, who);
    if (mine || p.kind === 'bomb') Audio.sfx(PICK_SFX[p.kind]);
    if (p.kind === 'xp' || p.kind === 'xpBig') {
      pendingLevels += pl.gainXp(p.value * (Coop.active ? Coop.xpFactor() : 1));
      return;
    }
    if (p.kind === 'coin') {
      pl.coins += p.value;
      FX.dmgText(who.x, who.y - who.bodyH - 6, '+' + p.value, '#ffd23f');
      return;
    }
    if (p.kind === 'item') {
      if (mine) offerItem(p.value);
      return;
    }
    if (p.kind === 'ticket' || p.kind === 'ticket10') {
      if (p.kind === 'ticket') pl.t1++;
      else pl.t10++;
      bankTickets();
      FX.dmgText(
        who.x,
        who.y - who.bodyH - 8,
        p.kind === 'ticket' ? '+1 ticket' : 'Ticket ×10!',
        p.kind === 'ticket' ? '#ffd23f' : '#d9a6ff',
        true
      );
      FX.ring(who.x, who.y, 6, 50, p.kind === 'ticket' ? '#ffd23f' : '#c47bff', 0.4, 3);
      return;
    }
    if (p.kind === 'heal') {
      if (mine) pl.heal(pl.maxHp * BD.berryHeal);
      FX.ring(who.x, who.y, 6, 60, '#5fe08a', 0.4, 3);
      return;
    }
    if (p.kind === 'magnet') {
      Pickups.pullAll();
      FX.ring(who.x, who.y, 10, 420, '#ff9ed8', 0.6, 4);
      return;
    }
    if (p.kind === 'bomb') {
      if (U.dist2(who.x, who.y, pl.x, pl.y) < 500 * 500) Camera.kick(0.8);
      const R = Camera.outerRadius();
      FX.ring(who.x, who.y, 20, R, '#ff7b3d', 0.5, 6);
      for (const e of EnemyMgr.all()) {
        if (mine ? !Camera.sees(e.x, e.y, 0) : U.dist2(e.x, e.y, who.x, who.y) > R * R) continue;
        const d = BD.bomb.base + pl.level * BD.bomb.perLevel;
        e.hurt(d, '#ff7b3d', e.x - who.x, e.y - who.y, BD.bomb.knock);
        Recount.other(who, d);
      }
    }
  }

  // ---------------- keyboard ----------------

  function handleKeys() {
    if (SettingsUI.isOpen) {
      if (Input.tap('escape')) SettingsUI.close();
      return;
    }
    // Arceus's Judgment: Space, Enter or Esc skip the animation (when allowed).
    if (Judgment.cinematic && state === 'playing') {
      if (['space', 'enter', 'escape'].some(k => Input.tap(k))) Judgment.skip();
      return;
    }
    if (state === 'levelup') {
      for (let i = 0; i < 3; i++) {
        if (Input.tap('digit' + (i + 1)) || Input.tap('numpad' + (i + 1))) RunUI.pick(i);
      }
      if (Input.tap('keyr')) RunUI.reroll();
      return;
    }
    if (UI.isOpen('scr-bond')) {
      for (let i = 0; i < 4; i++) {
        if (Input.tap('digit' + (i + 1)) || Input.tap('numpad' + (i + 1))) RunUI.pickBond(i);
      }
      return;
    }
    if (UI.isOpen('scr-item')) {
      for (let i = 0; i < 2; i++) {
        if (Input.tap('digit' + (i + 1)) || Input.tap('numpad' + (i + 1))) RunUI.pickItem(i);
      }
      if (Input.tap('escape')) RunUI.pickItem(0); // the safe choice: keep yours / go on without
      return;
    }
    if (state === 'ui') {
      // Gacha pull on screen: Space/Enter skip the slot machine or continue, Esc continues.
      if (['space', 'enter', 'escape'].some(k => Input.tap(k) && GachaUI.key(k))) return;
      // Esc on a menu sub-screen goes back to the menu.
      if (
        Input.tap('escape') &&
        !UI.isOpen('scr-profile') &&
        ['scr-play', 'scr-dex', 'scr-upgrades', 'scr-gacha', 'scr-friends', 'scr-rank', 'scr-goals'].some(UI.isOpen) &&
        document.getElementById('pull-fx').classList.contains('hidden')
      )
        MenuUI.open();
      return;
    }
    if (Input.tap('escape') || Input.tap('keyp')) {
      togglePause();
      return;
    }
    if (state !== 'playing' || !pl) return;
    for (let i = 0; i < 4; i++) {
      if (Input.tap('digit' + (i + 1)) || Input.tap('numpad' + (i + 1))) pl.setActive(i);
    }
    if (Input.tap('keyq')) pl.cycle(-1);
    if (Input.tap('keye') || Input.tap('tab')) pl.cycle(1);
    if (Input.tap('keyr')) Settings.set('recount', !Settings.get('recount')); // damage meter
  }

  // ---------------- loop ----------------

  let deathT = 0;

  let frameDt = 0,
    speedK = 1;
  let fpsShown = 60,
    fpsAcc = 0,
    fpsN = 0,
    workMs = 0, // average time to compute + draw a frame (FPS counter)
    workShown = 0;
  // The next frame is requested BEFORE anything else: if something fails midway, the
  // game keeps going (before, it froze forever and you had to reload;
  // a huge run was lost that way when a rift opened).
  // If it fails frame after frame (the game no longer advances or shows), the
  // run is ended after ~3 s and saved: time, defeated,
  // records and leaderboard. Better that than a black screen and losing everything.
  let loopErrs = 0,
    errRun = 0;
  /*
   * Frame cap (setting `fpsCap`, 0 = whatever the screen gives). Menus and the solo
   * pause run at most at 30: nothing there needs more, and the laptop cools down.
   * The next frame is due at nextAt; frames that come early are skipped. Counting
   * from the due time (not from the last frame) keeps 60 on 75/144 Hz screens.
   */
  let nextAt = 0;
  function targetFps() {
    const cap = Settings.get('fpsCap') | 0;
    const idle = state === 'ui' || (state === 'paused' && !Coop.active);
    return idle ? Math.min(cap || 30, 30) : cap;
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    const fps = targetFps();
    if (fps) {
      if (ts < nextAt - 1) return;
      nextAt = Math.max(nextAt + 1000 / fps, ts);
    }
    try {
      const t0 = performance.now();
      frame(ts, fps);
      workMs += (performance.now() - t0 - workMs) * 0.1;
      errRun = 0;
    } catch (e) {
      if (loopErrs++ < 5) console.error('[Game] frame error:', e);
      Input.endFrame();
      if (++errRun === 180 && pl && state !== 'ui' && state !== 'over') {
        try {
          UI.hideAll();
          quitRun();
          UI.toast('The game crashed: your run has been saved up to this point', 5000);
        } catch (e2) {
          console.error('[Game] could not end the run:', e2);
        }
      }
    }
  }

  function frame(ts, fps) {
    const real = (ts - last) / 1000 || 0;
    // With a 30 cap a frame can be a bit longer than 1/30 s: a lower limit there
    // would turn the game into slow motion.
    const dt = Math.min(fps && fps <= 30 ? 1 / 20 : 1 / 30, real) * speedK;
    last = ts;
    if (state === 'playing') Settings.sample(real, fps);
    fpsAcc += real;
    fpsN++;
    if (fpsAcc >= 0.5) {
      fpsShown = Math.round(fpsN / fpsAcc);
      workShown = workMs;
      fpsAcc = 0;
      fpsN = 0;
    }
    frameDt = state === 'playing' ? dt : 0;

    handleKeys();

    if (state === 'playing') update(dt);
    else if (pl && state !== 'ui') {
      FX.update(dt * 0.25);
      pl.anim.update(dt * 0.25);
    }
    // The network is always serviced (also with the level cards open).
    if (Coop.active && pl && state !== 'ui' && state !== 'over') Coop.tick(dt);

    if (pl && state !== 'ui') render();
    // (Not under the gacha's pull screen: it is opaque and covers everything.)
    else if (!pullFx || pullFx.classList.contains('hidden')) Backdrop.render(ctx, w, h, dpr, dt);
    UI.tick(dt);

    Input.endFrame();
  }

  function update(dt) {
    const coop = Coop.active;
    if (flashT > 0) flashT -= dt;
    // Arceus's Judgment: while the animation plays, everything else stops.
    if (Judgment.cinematic) {
      Judgment.cineTick(dt);
      pl.anim.update(dt);
      if (coop) for (const p of Coop.puppets()) p.netUpdate(dt);
      World.update(dt, Camera);
      FX.update(dt);
      Audio.music(Judgment.music);
      return;
    }
    // After fainting, let the Faint animation play before the summary.
    // (Not in the rift arena: there fainting just sends you back.)
    if (pl.dead && !coop && !Rift.inArena) {
      deathT += dt;
      pl.update(dt);
      EnemyMgr.update(dt * 0.3, pl);
      FX.update(dt);
      Camera.follow(pl.x, pl.y, dt);
      if (deathT > BR.deathDelay.solo) {
        deathT = 0;
        endRun(true);
      }
      return;
    }
    time += dt;

    // (A story stage picks its own biomes, one per route: systems/story.js.)
    const b = Math.floor(time / BR.biomeLength);
    if (!Story.active && b !== biome && !Rift.inArena && !Judgment.active) {
      biome = b;
      World.setBiome(b);
      Audio.sfx('biome');
      Spawner.say('— ' + World.biomeName() + ' —', 3);
      FX.ring(pl.x, pl.y, 10, Camera.outerRadius(), '#ffffff', 0.7, 6);
    }

    pl.frozen = coop && (UI.isOpen('scr-pause') || UI.isOpen('scr-item'));
    pl.update(dt);
    if (coop) {
      for (const p of Coop.puppets()) {
        p.netUpdate(dt);
        Combat.ghostOrbit(p, dt, time);
      }
      if (pl.dead) reviveTick(dt);
    }
    // (Arriving at a story gym, the camera shows the leader for a moment.)
    const focus = Story.focus;
    Camera.follow(focus ? focus.x : pl.x, focus ? focus.y : pl.y, dt);
    World.update(dt, Camera);

    const all = everyone();
    if (!coop || Coop.isHost) {
      Path.update(dt, all);
      Spawner.update(dt, all, time);
    } else Spawner.tickBanner(dt);
    EnemyMgr.update(dt, all);
    EnemyMgr.rebuildGrid();
    Combat.tick(dt, pl, time);
    Projectiles.update(dt, pl, EnemyMgr.all());
    Combat.resolve(dt, pl, time);
    Combat.updateFields(dt);
    Pickups.update(dt, all, onCollect);
    Hazards.update(dt);
    Interact.update(dt, pl);
    // Story stages have no rifts, events or Judgment: the routes and the gym instead.
    if (Story.active) Story.update(dt, pl, time);
    else {
      Rift.update(dt, pl, time);
      Judgment.update(dt, pl, time);
      Events.update(dt, all, time);
    }
    Weather.update(dt, time, pl);
    FX.update(dt);

    Audio.music(
      Judgment.active
        ? Judgment.music
        : Rift.inArena
          ? 'rift'
          : EnemyMgr.bossAlive()
            ? 'boss'
            : Story.active
              ? Story.music
              : BIOME_MUSIC[biome % BIOME_MUSIC.length]
    );
    if (!coop || Coop.isHost) maybeLevelUp();
    if (pl.bonds > 0) offerBond(true);
    if (Coop.isHost) checkAllDown(dt);
  }

  /** Fainted in a group: a teammate next to you gradually revives you. */
  function reviveTick(dt) {
    const R = Balance.player.revive;
    const helper = Coop.puppets().some(p => !p.dead && U.dist2(p.x, p.y, pl.x, pl.y) < R.radius * R.radius);
    pl.reviveT = helper ? (pl.reviveT || 0) + dt : Math.max(0, (pl.reviveT || 0) - dt * R.decay);
    if (pl.reviveT >= R.time) pl.revive();
  }

  /** Host: if everyone faints, it ends (after showing the last one fall). */
  function checkAllDown(dt) {
    if (Rift.inArena || !Coop.players().every(p => p.dead)) {
      deathT = 0;
      return;
    }
    deathT += dt;
    if (deathT > BR.deathDelay.group) {
      deathT = 0;
      Coop.over(summary());
      endRun(true);
    }
  }

  // ---------------- drawing ----------------

  function drawScene(cam, extra) {
    const t = performance.now() / 1000;
    World.drawGround(ctx, cam);
    World.drawLiquid(ctx, cam, t);
    Hazards.draw(ctx);
    Combat.drawGroundFields(ctx);
    Pickups.draw(ctx);

    // Everything with "feet" is sorted by Y: props, enemies, player.
    // (The list and its entries are reused every frame: no garbage per frame.)
    sceneN = 0;
    sceneItems.length = 0;
    // Flat ones (springs, traps) always below everything else.
    for (const p of World.visibleProps(cam)) sceneAdd(p.flat ? p.y - 4000 : p.y, p, null);
    for (const e of EnemyMgr.drawables(cam)) sceneAdd(e.y, null, e);
    for (const e of extra) sceneAdd(e.y, null, e);
    const rift = Rift.drawable();
    if (rift) sceneAdd(rift.y, null, rift);
    const arceus = pl && state !== 'ui' ? Judgment.drawable() : null;
    if (arceus) sceneAdd(arceus.y, null, arceus);
    const leader = pl && state !== 'ui' ? Story.drawable() : null;
    if (leader) sceneAdd(leader.y, null, leader);
    if (pl && state !== 'ui') for (const d of Events.drawables()) sceneAdd(d.y, null, d);
    sceneItems.sort(byY);
    for (const it of sceneItems) {
      if (it.prop) World.drawProp(ctx, it.prop, t);
      else it.ent.draw(ctx);
    }
  }
  const scenePool = [],
    sceneItems = [];
  let sceneN = 0;
  const byY = (a, b) => a.y - b.y;
  function sceneAdd(y, prop, ent) {
    let it = scenePool[sceneN];
    if (!it) scenePool[sceneN] = it = { y: 0, prop: null, ent: null };
    sceneN++;
    it.y = y;
    it.prop = prop;
    it.ent = ent;
    sceneItems.push(it);
  }

  // Fog gradient, rebuilt only when the screen size or the fog (in steps) changes.
  const fogCache = { key: '', g: null };
  function fogGradient(fog) {
    const k = Math.round(fog * 40);
    const key = w + '|' + h + '|' + k;
    if (fogCache.key !== key) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.62);
      g.addColorStop(0, 'rgba(200,205,220,0)');
      g.addColorStop(1, `rgba(200,205,220,${(0.45 * k) / 40})`);
      fogCache.key = key;
      fogCache.g = g;
    }
    return fogCache.g;
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    ctx.scale(Camera.scale, Camera.scale);
    Camera.apply(ctx);
    drawScene(Camera, Coop.active ? [pl, ...Coop.puppets()] : [pl]);
    Projectiles.draw(ctx);
    Combat.drawAirFields(ctx);
    FX.draw(ctx);
    Judgment.drawAir(ctx);
    ctx.restore();

    Weather.draw(ctx, w, h, frameDt);
    World.drawVignette(ctx, w, h);
    // Fog: the vignette closes in a bit (without covering the center).
    const fog = Weather.vignette;
    if (fog > 0) {
      ctx.fillStyle = fogGradient(fog);
      ctx.fillRect(0, 0, w, h);
    }
    if (!Judgment.cinematic) HUD.draw(ctx, w, h, pl, st);
    else MoveTip.hide();
    Judgment.drawOverlay(ctx, w, h);
    Touch.draw(ctx);
    if (Settings.get('fps')) {
      ctx.save();
      ctx.font = '700 11px Pixelify, monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = fpsShown >= 50 ? '#5fe08a' : fpsShown >= 30 ? '#ffd23f' : '#ff5f6d';
      // And how long a frame takes to compute and draw (what decides heat and battery).
      ctx.fillText(fpsShown + ' FPS · ' + workShown.toFixed(1) + ' ms', w - 10, h - 8);
      ctx.restore();
    }
    if (flashT > 0) {
      ctx.save();
      // "Fewer flashes": the screen flash is reduced to a third.
      ctx.globalAlpha = Math.min(1, (flashT / flashDur) * 1.4) * (Settings.get('calm') ? 0.3 : 1);
      ctx.fillStyle = flashCol;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // ---------------- menu background ----------------

  /**
   * The real world, with wild Pokémon wandering and the camera drifting.
   * That way the menu shows what the game looks like from the very first second.
   */
  const Backdrop = (() => {
    let wanderers = [],
      t = 0,
      ready = false,
      biomeT = 0,
      bi = 0;
    const CAST = [1, 4, 7, 25, 133, 52, 39, 35, 16, 43, 60, 69, 74, 92, 129, 147, 113, 143, 54, 79];

    function init() {
      World.reset(4242);
      World.setBiome(0, true);
      Camera.x = 0;
      Camera.y = 0;
      wanderers = CAST.map(dex => spawn(dex, true));
      ready = true;
    }

    function spawn(dex, anywhere) {
      const a = new Sprites.Animator(dex, 1);
      const r = Sprites.bodyRadius(dex);
      let x = 0,
        y = 0;
      for (let i = 0; i < 20; i++) {
        x = Camera.x + U.rand(-1, 1) * (anywhere ? Camera.w * 0.6 : Camera.w * 0.7);
        y = Camera.y + U.rand(-1, 1) * (anywhere ? Camera.h * 0.6 : Camera.h * 0.7);
        if (World.isFree(x, y, r)) break;
      }
      return {
        dex,
        anim: a,
        x,
        y,
        r,
        vx: 0,
        vy: 0,
        t: 0,
        draw(ctx) {
          Sprites.drawShadow(ctx, this.dex, this.x, this.y);
          this.anim.draw(ctx, this.x, this.y);
        }
      };
    }

    function step(dt) {
      t += dt;
      World.update(dt, Camera);
      // Slow camera drift.
      Camera.x += Math.cos(t * 0.05) * 14 * dt;
      Camera.y += Math.sin(t * 0.037) * 10 * dt;
      Camera.follow(Camera.x, Camera.y, dt);

      biomeT += dt;
      if (biomeT > 30) {
        biomeT = 0;
        bi = (bi + 1) % 3;
        World.setBiome(bi);
      }

      for (const wd of wanderers) {
        wd.t -= dt;
        if (wd.t <= 0) {
          // Wanders, stops, or "attacks" the air now and then.
          wd.t = U.rand(1, 3.5);
          const r = Math.random();
          if (r < 0.55) {
            const a = Math.random() * 6.2832,
              s = U.rand(25, 55);
            wd.vx = Math.cos(a) * s;
            wd.vy = Math.sin(a) * s;
          } else {
            wd.vx = wd.vy = 0;
            if (r > 0.85) wd.anim.play(U.pick(['Attack', 'Shoot', 'Charge']));
          }
        }
        wd.x += wd.vx * dt;
        wd.y += wd.vy * dt;
        World.collide(wd);
        const moving = Math.abs(wd.vx) + Math.abs(wd.vy) > 1;
        if (moving) wd.anim.dir = Sprites.dirFromAngle(Math.atan2(wd.vy, wd.vx));
        wd.anim.loop(moving ? 'Walk' : 'Idle');
        wd.anim.update(dt);
        // If it ends up off camera, it reappears inside.
        if (!Camera.sees(wd.x, wd.y, 120)) Object.assign(wd, spawn(wd.dex, false));
      }
    }

    function render(ctx, w, h, dpr, dt) {
      if (!ready) return;
      step(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Cleared like a run frame: if a ground chunk fails to draw, sprites don't smear over it.
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.scale(Camera.scale, Camera.scale);
      Camera.apply(ctx);
      drawScene(Camera, wanderers);
      ctx.restore();
      World.drawVignette(ctx, w, h);
    }

    /** When coming back from a run, restores the menu world. */
    function restore() {
      World.reset(4242);
      World.setBiome(bi, true);
      FX.clear();
      Projectiles.clear();
      Combat.clearFields();
      EnemyMgr.clear();
      Pickups.clear();
      wanderers = CAST.map(dex => spawn(dex, true));
    }

    return { init, render, restore };
  })();

  return {
    init,
    startRun,
    onRescue,
    onShinyCaught,
    everyone,
    levelXp,
    flash,
    offerBond,
    togglePause,
    /** The story gym was beaten (systems/story.js). */
    winStory() {
      endRun(false, true);
    },
    /** Abandons the current run (e.g. when logging out from Settings). */
    quit() {
      if (state !== 'ui' && state !== 'over') quitRun();
    },
    /**
     * Testing tools (the dev panel, ui/dev-ui.js, and the console in npm run dev).
     * Anything that changes the run marks it as tampered: no leaderboard.
     */
    debug: {
      /** Jumps the run clock to `t` seconds. */
      time(t) {
        tampered = true;
        time = t;
      },
      /** Game speed (0.5 = slow motion for videos; above 1 counts as tampering). */
      speed(k) {
        if (k > 1) tampered = true;
        speedK = k;
      },
      /** Gains `n` levels (their cards are offered one after another). */
      levels(n = 1) {
        tampered = true;
        pl.level += n;
        pendingLevels += n;
      },
      heal() {
        tampered = true;
        pl.heal(pl.maxHp);
      },
      god(on) {
        tampered = true;
        pl.god = !!on;
      },
      get godOn() {
        return !!(pl && pl.god);
      },
      boss() {
        tampered = true;
        Spawner.debugBoss();
      },
      /** Knocks out every enemy (they drop their loot as usual). */
      killAll() {
        tampered = true;
        for (const e of EnemyMgr.all())
          if (!e.dead && !e.remote) {
            e.hp = 0;
            e.die();
          }
      },
      /** Seed for the next solo runs (null = random); same as ?seed=CODE. */
      get nextSeed() {
        return fixedSeed;
      },
      set nextSeed(s) {
        fixedSeed = s;
      }
    },
    toUI() {
      state = 'ui';
      Backdrop.restore();
    },
    get state() {
      return state;
    },
    /** Internal resolution multiplier in use (settings show it). */
    get dpr() {
      return dpr;
    },
    /** Seconds into the current run. */
    get time() {
      return time;
    },
    get player() {
      return pl;
    },
    st
  };
})();

/* ============ Flow — screen transitions ============ */
export const Flow = {
  boot() {
    UI.initChrome();
    LoginUI.init();
    TestUI.init();
    MenuUI.init();
    PlayUI.init();
    GachaUI.init();
    MoveTip.init();
    SocialUI.init();
    RankingUI.init();
    ModUI.init();
    GoalsUI.init();
    ProfileUI.init();
    SettingsUI.init();
    NewsUI.init();
    Updater.init();
    // Your name at the top right opens your profile.
    document.getElementById('user-pill').onclick = () => GoalsUI.open('profile');
    Audio.music('village'); // plays after the first click (the browser requires it)
    Game.init();
    // The database (cloud or local) restores the previous session.
    DB.ready().then(restored => {
      document.getElementById('boot').classList.add('hidden');
      // In another task: creating the audio to check it costs ~60 ms and must not block loading.
      setTimeout(
        () =>
          this.tapToStart(() => {
            if (restored) this.afterLogin();
            else this.toLogin();
          }),
        0
      );
    });
  },
  /**
   * "Tap to start": browsers don't let a website play sound until
   * something is touched. With this screen the music starts as soon as you enter.
   * (If the browser already allows sound, it doesn't show.)
   */
  tapToStart(then) {
    Audio.unlock();
    if (Audio.canPlay()) {
      then();
      return;
    }
    const el = document.getElementById('tap-start');
    el.classList.remove('hidden');
    const go = e => {
      if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      Audio.unlock();
      el.classList.add('hidden');
      el.removeEventListener('click', go);
      removeEventListener('keydown', go, true);
      then();
    };
    el.addEventListener('click', go);
    addEventListener('keydown', go, true);
  },
  toLogin() {
    Audio.music('village');
    LoginUI.open();
  },
  afterLogin() {
    Audio.music('village');
    if (!DB.save.partner) TestUI.start();
    else this.goMenu();
  },
  goMenu() {
    if (Game.state !== 'ui') Game.toUI();
    Audio.music('village');
    MenuUI.open();
  },
  /** When closing the summary: to the room if you're still in one, otherwise to the menu. */
  afterRun() {
    if (Social.room) {
      if (Game.state !== 'ui') Game.toUI();
      Audio.music('village');
      if (Social.room.isHost) Social.setOpen(true);
      LobbyUI.open();
    } else this.goMenu();
  },
  /** Solo run: endless, or a story stage (data/stages.js). */
  play(stageId = null) {
    Game.startRun(null, stageId);
  },
  /** From the summary: another story stage right away (back to the menu if an update is waiting). */
  replay(stageId) {
    if (Updater.pending || Social.room) this.afterRun();
    else this.play(stageId);
  },
  /** Starts the group run (the host sends it to everyone). */
  startCoop(cfg) {
    if (Game.state !== 'ui' || !Social.room) return;
    LobbyUI.close();
    Game.startRun(cfg);
  }
};
