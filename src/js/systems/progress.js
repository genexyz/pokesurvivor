/* ============ progress.js — missions, achievements and account stats ============
 * The game reports what happens with Progress.event(kind, data):
 *
 *   kill      { types, boss, legend }  (also on co-op copies)
 *   chest     locked chest opened
 *   item      { id }        item equipped
 *   evolve    { move }      move evolved
 *   rift      { type }      rift fight won
 *   runEnd    { time, level, coins, types, group }
 *   judge     you reach Arceus's Judgment (minute 30)
 *   judgeEnd  { time, bosses }  survived against Arceus (when the run ends)
 *   missionDone { daily }   (fired by claim)
 *
 * and this updates in the save:
 *   stats.bossesTotal · riftWins · evolutions · missionsDone · groupRuns
 *   stats.judged · judgeTime (best time against Arceus) · judgeBosses (best boss count)
 *   legends{dex} · arenas{type} · itemsFound{id} · evoMoves{id} · ach{id}
 *   missions { day, daily[], rerolled, week, weekly[] }
 *
 * Missions: 3 daily + 2 weekly (Balance.run.missions), drawn with a seed from the date and
 * the account (the same ones on any computer). The reward is claimed
 * by hand; achievements are granted automatically when earned.
 */
import { U } from '../core/util.js';
import { RNG } from '../core/rng.js';
import { Balance } from '../data/balance.js';
import { DB } from '../core/db.js';
import { Audio } from '../core/audio.js';
import { MissionDefs } from '../data/missions.js';
import { AchDefs } from '../data/achievements.js';
import { Rift } from './rift.js';
import { Story } from './story.js';
import { Judgment } from './judgment.js';
import { Ranking } from '../net/ranking.js';
import { Icons } from '../ui/icons.js';
import { UI } from '../ui/ui.js';

export const Progress = (() => {
  const TYPES = Object.keys(U.TYPE_NAME);
  const BR = Balance.run;
  let achT = 0,
    toastQ = [],
    toastT = 0;

  // ---------------- missions ----------------

  /** A generator seeded by a text (FNV-1a + mulberry32, the same as the run streams in core/rng.js). */
  function rng(seedStr) {
    const st = new RNG.Stream(seedStr);
    st.reseed(0); // state = hash of the text
    return () => st.next();
  }

  function make(def, r) {
    const goal = def.goals[Math.floor(r() * def.goals.length)];
    const param = def.param === 'type' ? TYPES[Math.floor(r() * TYPES.length)] : null;
    return { id: def.id, goal, param, prog: 0, claimed: false, told: false };
  }

  function pickSet(defs, n, r, avoid = []) {
    const pool = defs.filter(d => !avoid.includes(d.id));
    const out = [];
    while (out.length < n && pool.length) out.push(make(pool.splice(Math.floor(r() * pool.length), 1)[0], r));
    return out;
  }

  /** Creates the day's / week's missions if they have changed. */
  function ensure(s) {
    if (!s) return;
    const ids = Ranking.periodIds();
    const key = String(s.created || 0);
    s.missions = s.missions || {};
    const M = s.missions;
    if (M.day !== ids.d) {
      M.day = ids.d;
      M.rerolled = false;
      M.daily = pickSet(MissionDefs.daily, BR.missions.daily, rng(ids.d + key));
    }
    if (M.week !== ids.w) {
      M.week = ids.w;
      M.weekly = pickSet(MissionDefs.weekly, BR.missions.weekly, rng(ids.w + key));
    }
  }

  function text(m) {
    return MissionDefs.BY[m.id].text(m.goal, m.param);
  }
  function done(m) {
    return m.prog >= m.goal;
  }

  function advance(list, kind, d) {
    for (const m of list || []) {
      if (m.claimed || done(m)) continue;
      const def = MissionDefs.BY[m.id];
      if (!def || def.ev !== kind) continue;
      if (def.match && !def.match(d, m.param)) continue;
      const v = def.value ? def.value(d) : 1;
      m.prog = def.mode === 'max' ? Math.max(m.prog, v) : m.prog + v;
      if (done(m) && !m.told) {
        m.told = true;
        notify('Mission complete: ' + text(m), 'Claim your reward in Missions');
      }
    }
  }

  /** Claims the reward of a finished mission. */
  function claim(m, weekly = false) {
    const s = DB.save;
    if (!s || m.claimed || !done(m)) return false;
    m.claimed = true;
    grant(MissionDefs.BY[m.id].reward);
    s.stats.missionsDone = (s.stats.missionsDone || 0) + 1;
    event('missionDone', { daily: !weekly });
    DB.commit(true);
    return true;
  }

  /** Swaps an unfinished daily for another one (once a day). */
  function reroll(i) {
    const s = DB.save;
    ensure(s);
    const M = s.missions;
    const m = M.daily[i];
    if (!m || M.rerolled || m.claimed) return false;
    const r = rng(M.day + 'cambio' + Date.now());
    const [n] = pickSet(
      MissionDefs.daily,
      1,
      r,
      M.daily.map(x => x.id)
    );
    if (!n) return false;
    M.daily[i] = n;
    M.rerolled = true;
    DB.commit();
    return true;
  }

  function grant(r) {
    const s = DB.save;
    if (!r) return;
    s.tickets = s.tickets || { t1: 0, t10: 0 };
    if (r.coins) s.coins += r.coins;
    if (r.t1) s.tickets.t1 += r.t1;
    if (r.t10) s.tickets.t10 += r.t10;
    if (UI && UI.refreshCoins && !document.getElementById('topbar').classList.contains('hidden')) UI.refreshCoins();
  }

  function rewardText(r) {
    const p = [];
    if (r.t10) p.push(Icons.html('ticket10', 12) + ' ' + r.t10 + ' ×10');
    if (r.t1) p.push(Icons.html('ticket', 12) + ' ' + r.t1);
    if (r.coins) p.push('<span class="coin"></span> ' + r.coins);
    return p.join(' &nbsp;');
  }

  // ---------------- events ----------------

  function event(kind, d = {}) {
    const s = DB.save;
    if (!s) return;
    ensure(s);
    const S = s.stats;
    switch (kind) {
      case 'kill':
        if (d.boss) S.bossesTotal = (S.bossesTotal || 0) + 1;
        if (d.legend) {
          s.legends = s.legends || {};
          if (!s.legends[d.legend]) s.legends[d.legend] = Date.now();
        }
        break;
      case 'rift':
        S.riftWins = (S.riftWins || 0) + 1;
        if (d.type) {
          s.arenas = s.arenas || {};
          s.arenas[d.type] = s.arenas[d.type] || Date.now();
        }
        break;
      case 'evolve':
        S.evolutions = (S.evolutions || 0) + 1;
        s.evoMoves = s.evoMoves || {};
        s.evoMoves[d.move] = s.evoMoves[d.move] || Date.now();
        break;
      case 'item':
        s.itemsFound = s.itemsFound || {};
        s.itemsFound[d.id] = s.itemsFound[d.id] || Date.now();
        break;
      case 'runEnd':
        if (d.group) S.groupRuns = (S.groupRuns || 0) + 1;
        break;
      case 'judge':
        S.judged = (S.judged || 0) + 1;
        break;
      case 'judgeEnd':
        S.judgeTime = Math.max(S.judgeTime || 0, Math.floor(d.time));
        S.judgeBosses = Math.max(S.judgeBosses || 0, d.bosses);
        break;
    }
    advance(s.missions.daily, kind, d);
    advance(s.missions.weekly, kind, d);
    // Achievements are checked at most once per second (there are hundreds of kills).
    if (kind !== 'kill' || d.boss || d.legend) checkAch();
    else if (performance.now() - achT > 1000) checkAch();
  }

  /** An enemy has fallen (host, solo, or a copy on the guest). */
  function kill(e) {
    // The legendaries of Arceus's Judgment don't count as bosses (neither for
    // missions nor for boss achievements): they have their own counter.
    if (Judgment.active && e.boss) {
      Judgment.bossDown();
      event('kill', { types: e.types || [], boss: false, legend: 0 });
      return;
    }
    if (e.boss) Story.onKill(e); // a story mini-boss grants a bond
    const legend = e.legend || (Rift.inArena && e.boss) ? e.dex : 0;
    event('kill', { types: e.types || [], boss: !!e.boss, legend });
  }

  // ---------------- achievements ----------------

  function checkAch() {
    const s = DB.save;
    if (!s) return;
    achT = performance.now();
    s.ach = s.ach || {};
    for (const a of AchDefs.LIST) {
      if (s.ach[a.id]) continue;
      if (a.value(s) < a.goal) continue;
      s.ach[a.id] = Date.now();
      grant(a.reward);
      notify('Achievement: ' + a.name + '!', a.title ? 'New title: ' + a.title : '', a);
    }
  }

  /** Titles you own (from the achievements earned), as { id, title }. */
  function titles() {
    const s = DB.save;
    return AchDefs.LIST.filter(a => a.title && s && s.ach && s.ach[a.id]).map(a => ({ id: a.id, title: a.title }));
  }

  /** Text of a profile title. It is stored as the achievement id; profiles published
   * by older versions still hold the Spanish text itself, shown as is. */
  function titleText(t) {
    const a = t && AchDefs.BY[t];
    return a && a.title ? a.title : t || '';
  }

  /** Mission rewards waiting to be claimed (for the menu badge). */
  function pending() {
    const s = DB.save;
    if (!s) return 0;
    ensure(s);
    return [...s.missions.daily, ...s.missions.weekly].filter(m => done(m) && !m.claimed).length;
  }

  // ---------------- notices ----------------

  function notify(title, sub, ach) {
    toastQ.push({ title, sub, ach });
    if (toastQ.length === 1) showNext();
  }

  function showNext() {
    const n = toastQ[0];
    if (!n) return;
    let el = document.getElementById('ach-pop');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ach-pop';
      el.className = 'box ach-pop';
      document.body.appendChild(el);
    }
    const icon = n.ach ? (n.ach.dex ? '' : Icons.html('medal' + n.ach.tier, 24)) : Icons.html('medal2', 24);
    el.innerHTML = `${icon}<div><b>${n.title}</b>${n.sub ? `<small>${n.sub}</small>` : ''}</div>`;
    if (n.ach && n.ach.dex) el.prepend(UI.spriteCanvas(n.ach.dex, 48, 40, { scale: 1 }));
    el.classList.remove('hidden');
    Audio.sfx(n.ach ? 'legend' : 'confirm');
    clearTimeout(toastT);
    toastT = setTimeout(() => {
      el.classList.add('hidden');
      toastQ.shift();
      setTimeout(showNext, 250);
    }, 2800);
  }

  return { ensure, event, kill, claim, reroll, checkAch, titles, titleText, pending, text, done, rewardText, grant };
})();
