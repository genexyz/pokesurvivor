/* ============ updater.js — automatic updates ============
 * When a new version is published (npm run build writes version.json with
 * the fingerprint of the game bundle, also in <meta name="ps-version">), every player gets it without losing anything:
 *
 *   - Every 5 min (and when coming back to the tab) version.json is checked
 *     (a static file from our own server: it costs nothing).
 *   - If NOT in a run: a "updating in 5 s…" notice and the page reloads.
 *     If the player is in the gacha, the upgrade shop, the settings or typing
 *     in a field, it waits until they finish. In a co-op room it reloads
 *     anyway (decided on 12-10-2026).
 *   - If IN A RUN: nothing is touched. When it ends, the run is saved as
 *     usual (records, coins, tickets, leaderboard) and, back in the menu, the
 *     page reloads.
 *   - Before reloading it waits for the save to reach the cloud (a few
 *     seconds at most; otherwise it stays in this browser and is uploaded on
 *     the next visit).
 *   - REQUIRED version (npm run build --force, alias --forzar, writes force:true
 *     in version.json): whoever is in a run sees a 10 s notice and the run
 *     ends as if abandoned (coins, tickets, records and leaderboard are
 *     saved), it is uploaded to the cloud and the page reloads. Only players
 *     who already have this updater.js understand it (since 15-10-2026).
 * It only works on the published site (with the ps-version meta); with npm run dev or
 * by double-clicking (file://) it does nothing.
 */
import { DB } from './db.js';
import { UI } from '../ui/ui.js';
import { Game } from '../game.js';

export const Updater = (() => {
  const EVERY = 5 * 60 * 1000,
    COUNTDOWN = 5,
    FORCED = 10;
  // Written by the ps-release plugin in vite.config.mjs (same value as version.json).
  const tag = document.querySelector('meta[name="ps-version"]');
  const mine = tag ? tag.content : null;
  let pending = false,
    forced = false,
    lastCheck = 0,
    timer = 0,
    counting = false;

  async function check() {
    if (!mine || pending) return;
    lastCheck = Date.now();
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (j && j.v && j.v !== mine) {
        pending = true;
        forced = !!j.force;
        console.log('[Update] new version', j.v, '(this one is', mine + ')', forced ? 'REQUIRED' : '');
      }
    } catch (e) {
      /* offline: check again next time */
    }
  }

  /** Can the page reload now without interrupting anything? */
  function safe() {
    if (!Game || Game.state !== 'ui') return false; // in a run or on the summary
    if (['scr-gacha', 'scr-upgrades', 'scr-settings'].some(id => document.getElementById(id) && UI.isOpen(id))) return false;
    const fx = document.getElementById('pull-fx');
    if (fx && !fx.classList.contains('hidden')) return false; // gacha pull in progress
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false; // typing (password, nickname...)
    return true;
  }

  async function reload() {
    // Let the save reach the cloud before reloading (6 s at most).
    const dirty = DB.syncState && DB.syncState !== 'ok' && DB.syncState !== 'local';
    if (dirty) {
      try {
        await Promise.race([DB.flush(), new Promise(r => setTimeout(r, 6000))]);
      } catch (e) {
        /* it stays in this browser */
      }
    }
    location.reload();
  }

  function countdown() {
    counting = true;
    let n = COUNTDOWN;
    const tick = () => {
      if (!safe()) {
        counting = false;
        UI.toast('', 1);
        return;
      } // a run has started: wait
      if (n <= 0) {
        reload();
        return;
      }
      UI.toast('A new version of the game is out: updating in ' + n + ' s…', 1500);
      n--;
      setTimeout(tick, 1000);
    };
    tick();
  }

  /** Is a run being played (which a required version must end)? */
  function inRun() {
    return Game && Game.state !== 'ui' && Game.state !== 'over';
  }

  /** Required version during a run: notice, the run ends (everything is saved) and the page reloads. */
  function forceEnd() {
    counting = true;
    let n = FORCED;
    const tick = () => {
      if (!inRun()) {
        reload();
        return;
      } // the player ended it themselves
      if (n <= 0) {
        Game.quit(); // like abandoning: earnings are saved
        setTimeout(reload, 4000); // let the record and leaderboard go out
        return;
      }
      UI.toast('Required update: your run is saved and the game reloads in ' + n + ' s…', 1500);
      n--;
      setTimeout(tick, 1000);
    };
    tick();
  }

  function loop() {
    if (pending && forced && !counting && inRun()) {
      forceEnd();
      return;
    }
    if (pending && forced && !counting && Game && Game.state === 'over') {
      reload();
      return;
    } // summary: already saved
    if (pending && !counting && safe()) countdown();
    if (!pending && Date.now() - lastCheck > EVERY) check();
  }

  function init() {
    if (!mine || !location.protocol.startsWith('http')) return;
    clearInterval(timer);
    timer = setInterval(loop, 2000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > 60000) check();
    });
    setTimeout(check, 30000);
  }

  return {
    init,
    check,
    get pending() {
      return pending;
    },
    get version() {
      return mine;
    }
  };
})();
