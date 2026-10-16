/* ============ starters.js — starting partners and personality test ============
 * Like in Mystery Dungeon: a few questions decide your personality, and your
 * personality decides your partner. You can turn it down and pick another.
 *
 * Stats come from G.DEX; only the traits and the starting move go here.
 */
G.STARTERS = [
  { dex: 1, start: 'vine-whip', traits: ['loyal', 'patient'] },
  { dex: 4, start: 'ember', traits: ['brave', 'hasty'] },
  { dex: 7, start: 'water-gun', traits: ['careful', 'loyal'] },
  { dex: 152, start: 'vine-whip', traits: ['gentle', 'patient'] },
  { dex: 155, start: 'ember', traits: ['timid', 'hasty'] },
  { dex: 158, start: 'water-gun', traits: ['impish', 'brave'] },
  { dex: 252, start: 'razor-leaf', traits: ['calm', 'clever'] },
  { dex: 255, start: 'ember', traits: ['jolly', 'brave'] },
  { dex: 258, start: 'water-gun', traits: ['determined', 'loyal'] },
  { dex: 387, start: 'vine-whip', traits: ['patient', 'determined'] },
  { dex: 390, start: 'ember', traits: ['impish', 'jolly'] },
  { dex: 393, start: 'bubble', traits: ['proud', 'careful'] },
  { dex: 495, start: 'razor-leaf', traits: ['proud', 'clever'] },
  { dex: 498, start: 'ember', traits: ['determined', 'jolly'] },
  { dex: 501, start: 'water-gun', traits: ['brave', 'impish'] },
  { dex: 650, start: 'vine-whip', traits: ['impish', 'determined'] },
  { dex: 653, start: 'ember', traits: ['clever', 'calm'] },
  { dex: 656, start: 'water-gun', traits: ['calm', 'clever'] },
  { dex: 722, start: 'razor-leaf', traits: ['calm', 'gentle'] },
  { dex: 725, start: 'ember', traits: ['lonely', 'proud'] },
  { dex: 728, start: 'bubble', traits: ['jolly', 'gentle'] },
  { dex: 810, start: 'vine-whip', traits: ['jolly', 'impish'] },
  { dex: 813, start: 'ember', traits: ['hasty', 'jolly'] },
  { dex: 816, start: 'water-gun', traits: ['timid', 'clever'] },
  { dex: 906, start: 'razor-leaf', traits: ['lonely', 'clever'] },
  { dex: 909, start: 'ember', traits: ['relaxed', 'determined'] },
  { dex: 912, start: 'water-gun', traits: ['proud', 'careful'] },
  { dex: 54, start: 'confusion', traits: ['quirky', 'timid'] },
  { dex: 79, start: 'confusion', traits: ['relaxed', 'patient'] }
];

G.STARTER_BY = {};
for (const s of G.STARTERS) G.STARTER_BY[s.dex] = s;

/** Starting move of any Pokémon (starter or from the gacha). */
G.startMoveOf = dex => {
  const s = G.STARTER_BY[dex];
  return s ? s.start : G.Moves.startFor(G.DEX_BY[dex]);
};

/** Display name of each trait. */
G.TRAIT_NAME = {
  brave: 'Brave',
  timid: 'Timid',
  impish: 'Impish',
  jolly: 'Jolly',
  calm: 'Calm',
  relaxed: 'Relaxed',
  lonely: 'Lonely',
  hasty: 'Hasty',
  quirky: 'Quirky',
  loyal: 'Loyal',
  patient: 'Patient',
  gentle: 'Gentle',
  clever: 'Clever',
  determined: 'Determined',
  proud: 'Proud',
  careful: 'Careful'
};

/** Old (Spanish) trait ids -> current ids, to migrate saved personalities. */
G.TRAIT_LEGACY = {
  valiente: 'brave',
  tímido: 'timid',
  travieso: 'impish',
  alegre: 'jolly',
  sereno: 'calm',
  tranquilo: 'relaxed',
  solitario: 'lonely',
  impulsivo: 'hasty',
  caótico: 'quirky',
  leal: 'loyal',
  paciente: 'patient',
  dulce: 'gentle',
  astuto: 'clever',
  tenaz: 'determined',
  orgulloso: 'proud',
  prudente: 'careful'
};

/** Short description of each trait, for the result screen. */
G.TRAIT_TEXT = {
  brave: "You don't think twice when someone needs help.",
  hasty: 'You act first and think later. Sometimes it works!',
  careful: 'You measure every step before taking it.',
  loyal: 'Your friends know they can always count on you.',
  patient: 'You know how to wait for the right moment.',
  gentle: 'Your kindness calms everyone around you.',
  timid: "It's hard for you to take the first step, but you feel deeply.",
  impish: 'You always have a joke ready.',
  calm: 'You keep calm when things get complicated.',
  clever: 'You see solutions where others see problems.',
  jolly: 'You spread energy wherever you go.',
  determined: "Giving up isn't in your plans.",
  proud: 'You push yourself to be the best, and you almost always are.',
  lonely: "You do your own thing and don't care.",
  relaxed: 'Nothing fazes you. Nothing.',
  quirky: "Not even you know what you'll do next."
};

G.PERSONALITY_TEST = [
  {
    q: "There's a fight in the middle of town! What do you do?",
    a: [
      { t: 'I jump in to help without thinking.', p: { brave: 2, hasty: 1 } },
      { t: 'I look for someone who can stop it.', p: { careful: 2, loyal: 1 } },
      { t: 'I watch everything from afar.', p: { calm: 1, timid: 1, lonely: 1 } },
      { t: 'I laugh and cheer both of them on.', p: { impish: 2, quirky: 1 } }
    ]
  },
  {
    q: 'You find a wallet on the ground.',
    a: [
      { t: 'I take it to the police right away.', p: { loyal: 2, gentle: 1 } },
      { t: 'I look for its owner even if it takes hours.', p: { determined: 2, patient: 1 } },
      { t: "First I check what's inside…", p: { clever: 2, impish: 1 } },
      { t: "I don't even touch it, just in case.", p: { careful: 1, timid: 2 } }
    ]
  },
  {
    q: 'Your ideal day off is…',
    a: [
      { t: 'An adventure with no plan at all.', p: { hasty: 2, jolly: 1 } },
      { t: 'Reading, thinking, being calm.', p: { calm: 2, relaxed: 1 } },
      { t: 'Hanging out with all my friends.', p: { jolly: 2, loyal: 1 } },
      { t: 'Training to get better.', p: { determined: 2, proud: 1 } }
    ]
  },
  {
    q: 'You have an important exam tomorrow.',
    a: [
      { t: 'I study until late at night.', p: { determined: 2, careful: 1 } },
      { t: 'I review just enough: I trust myself.', p: { proud: 2, calm: 1 } },
      { t: 'I get really stressed.', p: { timid: 2, gentle: 1 } },
      { t: "Exam? I'll see tomorrow.", p: { quirky: 2, relaxed: 1 } }
    ]
  },
  {
    q: 'What do your friends say about you?',
    a: [
      { t: "That I'm the funniest one in the group.", p: { jolly: 2, impish: 1 } },
      { t: 'That they can always count on me.', p: { loyal: 2, gentle: 1 } },
      { t: "That I'm a bit mysterious.", p: { lonely: 2, clever: 1 } },
      { t: 'That I never give up.', p: { brave: 1, determined: 2 } }
    ]
  },
  {
    q: 'The path splits: one dark and short, the other long and sunny.',
    a: [
      { t: 'The dark one, more excitement!', p: { brave: 2, hasty: 1 } },
      { t: 'The long one, no rush.', p: { patient: 2, careful: 1 } },
      { t: 'I sit down to think it over.', p: { relaxed: 2, calm: 1 } },
      { t: 'Neither: I make a new shortcut.', p: { clever: 2, quirky: 1 } }
    ]
  },
  {
    q: 'Someone mocks you in front of everyone.',
    a: [
      { t: 'I answer back on the spot.', p: { proud: 2, hasty: 1 } },
      { t: 'I ignore them completely.', p: { calm: 2, lonely: 1 } },
      { t: "It hurts, even if I don't say it.", p: { timid: 2, gentle: 1 } },
      { t: 'I hit back with a better joke.', p: { impish: 2, clever: 1 } }
    ]
  },
  {
    q: 'What matters most to you?',
    a: [
      { t: 'Friendship.', p: { loyal: 2, jolly: 1 } },
      { t: 'Freedom.', p: { lonely: 2, hasty: 1 } },
      { t: 'Calm.', p: { relaxed: 2, patient: 1 } },
      { t: 'Being the best.', p: { proud: 2, determined: 1 } }
    ]
  }
];

/** Trait scores -> { trait, dex } with the best-matching partner. */
G.personalityResult = scores => {
  const trait = Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0];
  let best = [],
    bestScore = -1;
  for (const s of G.STARTERS) {
    // The main trait counts double.
    const v = (scores[s.traits[0]] || 0) * 2 + (scores[s.traits[1]] || 0);
    if (v > bestScore) {
      bestScore = v;
      best = [s];
    } else if (v === bestScore) best.push(s);
  }
  return { trait, dex: G.U.pick(best).dex };
};
