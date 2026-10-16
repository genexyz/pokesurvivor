/* ============ missions.js — daily and weekly mission templates ============
 * Every day 3 dailies come out and every week 2 weeklies (Spain time), with
 * random goals and types. They are completed by playing and the reward is
 * claimed on the Missions screen. The logic is in systems/progress.js.
 *
 *   ev      event that advances it (see Progress.event)
 *   match   (data, param) -> does this event count?
 *   value   data -> how much it is worth; with mode 'max' the highest is kept,
 *           with 'add' (default) it is summed (1 if there is no value)
 *   param   'type': picks a random Pokémon type for the mission
 */
import { U } from '../core/util.js';
import { I18n } from '../core/i18n.js';

export const MissionDefs = (() => {
  const T = t => U.TYPE_NAME[t];
  const min = d => Math.floor(d.time / 60);

  const daily = [
    { id: 'kill', ev: 'kill', goals: [300, 500, 800], reward: { t1: 2, coins: 150 }, text: n => `Defeat ${n} Pokémon` },
    {
      id: 'killType',
      ev: 'kill',
      param: 'type',
      goals: [30, 50, 80],
      reward: { t1: 2, coins: 200 },
      match: (d, t) => d.types.includes(t),
      text: (n, t) => `Defeat ${n} ${T(t)}-type Pokémon`
    },
    {
      id: 'survive',
      ev: 'runEnd',
      mode: 'max',
      value: min,
      goals: [5, 7, 9],
      reward: { t1: 3, coins: 200 },
      text: n => `Survive ${n} minutes in a run`
    },
    {
      id: 'level',
      ev: 'runEnd',
      mode: 'max',
      value: d => d.level,
      goals: [8, 12, 15],
      reward: { t1: 2, coins: 200 },
      text: n => `Reach level ${n} in a run`
    },
    {
      id: 'boss',
      ev: 'kill',
      match: d => d.boss,
      goals: [1, 2],
      reward: { t1: 3, coins: 250 },
      text: n => (n === 1 ? 'Defeat a boss' : `Defeat ${n} bosses`)
    },
    {
      id: 'chest',
      ev: 'chest',
      goals: [1, 2],
      reward: { t1: 2, coins: 200 },
      text: n => (n === 1 ? 'Open a locked chest' : `Open ${n} locked chests`)
    },
    {
      id: 'coins',
      ev: 'runEnd',
      value: d => d.coins,
      goals: [100, 200, 300],
      reward: { t1: 2, coins: 150 },
      text: n => `Collect ${n} coins in your runs`
    },
    {
      id: 'playType',
      ev: 'runEnd',
      param: 'type',
      mode: 'max',
      value: min,
      goals: [3],
      reward: { t1: 3, coins: 200 },
      match: (d, t) => d.types.includes(t),
      text: (n, t) => `Survive ${n} minutes with a ${T(t)}-type Pokémon`
    },
    { id: 'item', ev: 'item', goals: [1], reward: { t1: 2, coins: 150 }, text: () => 'Find a held item' },
    { id: 'evolve', ev: 'evolve', goals: [1], reward: { t1: 3, coins: 250 }, text: () => 'Evolve a move' }
  ];

  const weekly = [
    {
      id: 'wkill',
      ev: 'kill',
      goals: [4000, 6000],
      reward: { t10: 1, coins: 800 },
      text: n => `Defeat ${n.toLocaleString(I18n.locale)} Pokémon`
    },
    {
      id: 'wrift',
      ev: 'rift',
      goals: [1, 2],
      reward: { t10: 1, coins: 1000 },
      text: n => (n === 1 ? 'Win a rift battle' : `Win ${n} rift battles`)
    },
    { id: 'wboss', ev: 'kill', match: d => d.boss, goals: [4, 6], reward: { t10: 1, coins: 900 }, text: n => `Defeat ${n} bosses` },
    {
      id: 'wsurvive',
      ev: 'runEnd',
      mode: 'max',
      value: min,
      goals: [12, 15],
      reward: { t10: 1, coins: 1000 },
      text: n => `Survive ${n} minutes in a run`
    },
    { id: 'wevolve', ev: 'evolve', goals: [3, 5], reward: { t10: 1, coins: 900 }, text: n => `Evolve ${n} moves` },
    {
      id: 'wdaily',
      ev: 'missionDone',
      match: d => d.daily,
      goals: [8, 12],
      reward: { t10: 1, coins: 800 },
      text: n => `Complete ${n} daily missions`
    }
  ];

  const BY = {};
  for (const m of daily.concat(weekly)) BY[m.id] = m;

  return { daily, weekly, BY };
})();
