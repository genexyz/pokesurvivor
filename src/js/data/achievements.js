/* ============ achievements.js — achievements, medals and titles ============
 * Each achievement: medal (bronze 1, silver 2, gold 3), a reward when earned
 * and, sometimes, a profile title. Checked in systems/progress.js.
 *
 *   value(save) -> current progress (number) · goal -> what must be reached
 *
 * There is also one achievement for EACH legendary: defeating it in a rift.
 */
import { DEX, DEX_BY } from './pokedex.js';
import { SPRITE_META } from './sprites-meta.js';
import { Moves } from './moves.js';

export const AchDefs = (() => {
  const own = s => Object.keys(s.owned || {}).filter(d => DEX_BY[d]).length;
  const shinies = s => Object.keys(s.shiny || {}).length;
  const legends = s => Object.keys(s.legends || {}).length;
  const st = k => s => (s.stats && s.stats[k]) || 0;
  const count = k => s => Object.keys(s[k] || {}).length;
  const kanto = s => Object.keys(s.story || {}).filter(id => id.startsWith('kanto_')).length;

  const CATS = [
    ['collection', 'Collection'],
    ['survival', 'Survival'],
    ['combat', 'Combat'],
    ['story', 'Story'],
    ['rifts', 'Rifts'],
    ['legendaries', 'Legendaries'],
    ['other', 'Missions & more']
  ];

  const LIST = [
    // ---------- collection ----------
    {
      id: 'own1',
      cat: 'collection',
      tier: 1,
      name: 'First partner',
      desc: 'Own 1 Pokémon.',
      value: own,
      goal: 1,
      reward: { coins: 100 }
    },
    { id: 'own10', cat: 'collection', tier: 1, name: 'Small team', desc: 'Own 10 Pokémon.', value: own, goal: 10, reward: { t1: 2 } },
    {
      id: 'own50',
      cat: 'collection',
      tier: 2,
      name: 'Collector',
      desc: 'Own 50 Pokémon.',
      value: own,
      goal: 50,
      reward: { t1: 5 },
      title: 'Collector'
    },
    {
      id: 'own100',
      cat: 'collection',
      tier: 2,
      name: 'A hundred friends',
      desc: 'Own 100 Pokémon.',
      value: own,
      goal: 100,
      reward: { t10: 1 }
    },
    {
      id: 'own250',
      cat: 'collection',
      tier: 3,
      name: 'Pokémon Master',
      desc: 'Own 250 Pokémon.',
      value: own,
      goal: 250,
      reward: { t10: 2 },
      title: 'Pokémon Master'
    },
    { id: 'own500', cat: 'collection', tier: 3, name: 'Encyclopedia', desc: 'Own 500 Pokémon.', value: own, goal: 500, reward: { t10: 3 } },
    {
      id: 'ownAll',
      cat: 'collection',
      tier: 3,
      name: 'Pokémon Professor',
      desc: 'Own every Pokémon in the game.',
      value: own,
      goal: 966,
      reward: { t10: 10 },
      title: 'Pokémon Professor'
    },
    {
      id: 'shiny1',
      cat: 'collection',
      tier: 1,
      name: 'Something shines',
      desc: 'Get 1 shiny.',
      value: shinies,
      goal: 1,
      reward: { t1: 3 },
      title: 'Brilliant'
    },
    {
      id: 'shiny5',
      cat: 'collection',
      tier: 2,
      name: 'An eye for shine',
      desc: 'Get 5 shinies.',
      value: shinies,
      goal: 5,
      reward: { t10: 1 }
    },
    {
      id: 'shiny20',
      cat: 'collection',
      tier: 3,
      name: 'Shiny hunter',
      desc: 'Get 20 shinies.',
      value: shinies,
      goal: 20,
      reward: { t10: 2 },
      title: 'Shiny hunter'
    },
    {
      id: 'pulls100',
      cat: 'collection',
      tier: 2,
      name: 'Slot machine',
      desc: 'Make 100 gacha pulls.',
      value: st('pulls'),
      goal: 100,
      reward: { t10: 1 },
      title: 'Lucky'
    },

    // ---------- survival ----------
    {
      id: 'time5',
      cat: 'survival',
      tier: 1,
      name: 'Warming up',
      desc: 'Survive 5 minutes.',
      value: s => Math.floor(st('bestTime')(s) / 60),
      goal: 5,
      reward: { coins: 200 }
    },
    {
      id: 'time10',
      cat: 'survival',
      tier: 2,
      name: 'Hard to beat',
      desc: 'Survive 10 minutes.',
      value: s => Math.floor(st('bestTime')(s) / 60),
      goal: 10,
      reward: { t1: 4 }
    },
    {
      id: 'time15',
      cat: 'survival',
      tier: 2,
      name: 'Tough',
      desc: 'Survive 15 minutes.',
      value: s => Math.floor(st('bestTime')(s) / 60),
      goal: 15,
      reward: { t10: 1 }
    },
    {
      id: 'time20',
      cat: 'survival',
      tier: 3,
      name: 'Survivor',
      desc: 'Survive 20 minutes.',
      value: s => Math.floor(st('bestTime')(s) / 60),
      goal: 20,
      reward: { t10: 2 },
      title: 'Survivor'
    },
    {
      id: 'lvl20',
      cat: 'survival',
      tier: 1,
      name: 'Growing up',
      desc: 'Reach level 15 in a run.',
      value: st('bestLevel'),
      goal: 15,
      reward: { t1: 2 }
    },
    {
      id: 'lvl40',
      cat: 'survival',
      tier: 3,
      name: 'Unstoppable',
      desc: 'Reach level 30 in a run.',
      value: st('bestLevel'),
      goal: 30,
      reward: { t10: 1 },
      title: 'Unstoppable'
    },
    // Arceus's Judgment (minute 30, see systems/judgment.js).
    {
      id: 'judge',
      cat: 'survival',
      tier: 2,
      name: 'The Judgment',
      desc: 'Reach the Judgment of Arceus (minute 30).',
      value: st('judged'),
      goal: 1,
      reward: { t10: 1 },
      title: 'Judged'
    },
    {
      id: 'judge60',
      cat: 'survival',
      tier: 3,
      name: 'Before the Creator',
      desc: 'Survive 1 minute against Arceus.',
      value: st('judgeTime'),
      goal: 60,
      reward: { t10: 2 },
      title: 'Chosen of Arceus'
    },
    {
      id: 'judgeBoss',
      cat: 'survival',
      tier: 3,
      name: 'Divine challenge',
      desc: 'Defeat 3 legendaries against Arceus in a single run.',
      value: st('judgeBosses'),
      goal: 3,
      reward: { t10: 2 }
    },
    {
      id: 'runs50',
      cat: 'survival',
      tier: 2,
      name: 'Explorer',
      desc: 'Play 50 runs.',
      value: st('runs'),
      goal: 50,
      reward: { t10: 1 },
      title: 'Explorer'
    },

    // ---------- combat ----------
    {
      id: 'kills1k',
      cat: 'combat',
      tier: 1,
      name: 'First battles',
      desc: 'Defeat 1,000 Pokémon.',
      value: st('totalKills'),
      goal: 1000,
      reward: { t1: 2 }
    },
    {
      id: 'kills10k',
      cat: 'combat',
      tier: 2,
      name: 'Veteran',
      desc: 'Defeat 10,000 Pokémon.',
      value: st('totalKills'),
      goal: 10000,
      reward: { t10: 1 },
      title: 'Veteran'
    },
    {
      id: 'kills100k',
      cat: 'combat',
      tier: 3,
      name: 'Living legend',
      desc: 'Defeat 100,000 Pokémon.',
      value: st('totalKills'),
      goal: 100000,
      reward: { t10: 3 },
      title: 'Living legend'
    },
    {
      id: 'boss1',
      cat: 'combat',
      tier: 1,
      name: 'Giant slayer',
      desc: 'Defeat a boss.',
      value: st('bossesTotal'),
      goal: 1,
      reward: { t1: 2 }
    },
    {
      id: 'boss25',
      cat: 'combat',
      tier: 2,
      name: 'Boss hunter',
      desc: 'Defeat 25 bosses.',
      value: st('bossesTotal'),
      goal: 25,
      reward: { t10: 1 },
      title: 'Boss hunter'
    },
    {
      id: 'boss100',
      cat: 'combat',
      tier: 3,
      name: 'Terror of bosses',
      desc: 'Defeat 100 bosses.',
      value: st('bossesTotal'),
      goal: 100,
      reward: { t10: 2 }
    },
    {
      id: 'evo1',
      cat: 'combat',
      tier: 1,
      name: 'Evolution',
      desc: 'Evolve a move.',
      value: st('evolutions'),
      goal: 1,
      reward: { t1: 3 }
    },
    {
      id: 'evo25',
      cat: 'combat',
      tier: 2,
      name: 'Evolutionist',
      desc: 'Evolve 25 moves.',
      value: st('evolutions'),
      goal: 25,
      reward: { t10: 1 },
      title: 'Evolutionist'
    },
    {
      id: 'evoAll',
      cat: 'combat',
      tier: 3,
      name: 'Move master',
      desc: 'Evolve all 47 different moves.',
      value: count('evoMoves'),
      goal: 47,
      reward: { t10: 3 },
      title: 'Move master'
    },
    {
      id: 'items5',
      cat: 'combat',
      tier: 1,
      name: 'Full bag',
      desc: 'Find 5 different items.',
      value: count('itemsFound'),
      goal: 5,
      reward: { t1: 3 }
    },
    {
      id: 'itemsAll',
      cat: 'combat',
      tier: 2,
      name: 'Item collector',
      desc: 'Find all 11 items.',
      value: count('itemsFound'),
      goal: 11,
      reward: { t10: 1 },
      title: 'Antiquarian'
    },

    // ---------- story (badges: data/stages.js) ----------
    {
      id: 'badge1',
      cat: 'story',
      tier: 1,
      name: 'First badge',
      desc: 'Beat a gym leader in Story mode.',
      value: count('story'),
      goal: 1,
      reward: { t1: 3 },
      title: 'Trainer'
    },
    {
      id: 'kanto4',
      cat: 'story',
      tier: 2,
      name: 'Halfway there',
      desc: 'Earn 4 Kanto badges.',
      value: kanto,
      goal: 4,
      reward: { t10: 1 }
    },
    {
      id: 'kanto8',
      cat: 'story',
      tier: 3,
      name: 'Kanto champion',
      desc: 'Earn all 8 Kanto badges.',
      value: kanto,
      goal: 8,
      reward: { t10: 2 },
      title: 'Kanto champion'
    },

    // ---------- rifts ----------
    {
      id: 'rift1',
      cat: 'rifts',
      tier: 1,
      name: 'The other side',
      desc: 'Win your first rift battle.',
      value: st('riftWins'),
      goal: 1,
      reward: { t1: 3 },
      title: 'Brave'
    },
    {
      id: 'rift10',
      cat: 'rifts',
      tier: 2,
      name: 'Rift jumper',
      desc: 'Win 10 rift battles.',
      value: st('riftWins'),
      goal: 10,
      reward: { t10: 1 }
    },
    {
      id: 'arenas',
      cat: 'rifts',
      tier: 3,
      name: 'Rift traveler',
      desc: 'Win in all 18 arenas (one per type).',
      value: count('arenas'),
      goal: 18,
      reward: { t10: 2 },
      title: 'Rift traveler'
    },

    // ---------- legendaries (counter; the individual ones are added below) ----------
    {
      id: 'leg10',
      cat: 'legendaries',
      tier: 2,
      name: 'Legend hunter',
      desc: 'Defeat 10 different legendaries.',
      value: legends,
      goal: 10,
      reward: { t10: 1 },
      title: 'Legend hunter'
    },
    {
      id: 'leg30',
      cat: 'legendaries',
      tier: 3,
      name: 'Myth tamer',
      desc: 'Defeat 30 different legendaries.',
      value: legends,
      goal: 30,
      reward: { t10: 2 }
    },
    {
      id: 'legAll',
      cat: 'legendaries',
      tier: 3,
      name: 'Legend',
      desc: 'Defeat every legendary.',
      value: legends,
      goal: 87,
      reward: { t10: 5 },
      title: 'Legend'
    },

    // ---------- missions & more ----------
    {
      id: 'mis10',
      cat: 'other',
      tier: 1,
      name: 'Reliable',
      desc: 'Complete 10 missions.',
      value: st('missionsDone'),
      goal: 10,
      reward: { t1: 3 }
    },
    {
      id: 'mis50',
      cat: 'other',
      tier: 2,
      name: 'Steady',
      desc: 'Complete 50 missions.',
      value: st('missionsDone'),
      goal: 50,
      reward: { t10: 1 },
      title: 'Steady'
    },
    {
      id: 'mis200',
      cat: 'other',
      tier: 3,
      name: 'Tireless',
      desc: 'Complete 200 missions.',
      value: st('missionsDone'),
      goal: 200,
      reward: { t10: 3 }
    },
    {
      id: 'group1',
      cat: 'other',
      tier: 1,
      name: 'In good company',
      desc: 'Play a group game.',
      value: st('groupRuns'),
      goal: 1,
      reward: { t1: 2 }
    },
    {
      id: 'group10',
      cat: 'other',
      tier: 2,
      name: 'Loyal partner',
      desc: 'Play 10 group games.',
      value: st('groupRuns'),
      goal: 10,
      reward: { t10: 1 },
      title: 'Loyal partner'
    }
  ];

  // One achievement per legendary: "Defeat Mewtwo"...
  for (const p of DEX.filter(p => p.leg && SPRITE_META[p.dex])) {
    LIST.push({
      id: 'leg_' + p.dex,
      cat: 'legendaries',
      tier: 2,
      dex: p.dex,
      name: 'Defeat ' + p.name,
      desc: 'Defeat ' + p.name + ' in a rift.',
      value: s => (s.legends && s.legends[p.dex] ? 1 : 0),
      goal: 1,
      reward: { t1: 1 }
    });
  }
  const totalLegends = LIST.filter(a => a.dex).length;
  for (const a of LIST)
    if (a.id === 'legAll') {
      a.goal = totalLegends;
      a.desc = `Defeat all ${totalLegends} legendaries.`;
    }
  // Goals that depend on the game data.
  for (const a of LIST)
    if (a.id === 'ownAll') {
      a.goal = DEX.length;
      a.desc = `Own all ${DEX.length} Pokémon in the game.`;
    }
  const evoTotal = Object.keys(Moves.EVO).length;
  for (const a of LIST)
    if (a.id === 'evoAll') {
      a.goal = evoTotal;
      a.desc = `Evolve all ${evoTotal} different moves.`;
    }

  const BY = {};
  for (const a of LIST) BY[a.id] = a;

  return { CATS, LIST, BY };
})();
