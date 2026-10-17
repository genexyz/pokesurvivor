/* ============ icons.js — pixel art icons (they replace emojis) ============
 * Everything is drawn from character maps, just like the tiles, so the
 * interface shares its style with the Mystery Dungeon sprites.
 *
 *   Icons.html('coin', 18)     <img> for the DOM
 *   Icons.draw(ctx, 'coin', x, y, 18)   on the canvas
 *   Icons.url('star')          data URL (for CSS)
 *   'move:<id>'                  type emblem + family badge
 *   'type:<type>'                emblem only
 *   'mega:<dex>'                 that partner's Mega Stone (assets/items/, PokeAPI's item sprite)
 */
import { U } from '../core/util.js';
import { Moves } from '../data/moves.js';
import { Gacha } from '../systems/gacha.js';
import { Stages } from '../data/stages.js';
import { Megas } from '../data/megas.js';

export const Icons = (() => {
  const K = '#1b1528'; // outline

  // ---------------- interface icons (12×12) ----------------
  const MEDAL = [
    '.kkk....kkk.',
    '.krk....kqk.',
    '..krk..kqk..',
    '...krkkqk...',
    '....kkkk....',
    '...kmmmmk...',
    '..kmwmmmnk..',
    '.kmwmsmmmnk.',
    '.kmmsssmmnk.',
    '.kmmmsmmmnk.',
    '..kmmmmmnk..',
    '...kkkkkk...'
  ];

  const UI = {
    gear: {
      pal: { g: '#c9d6ff', d: '#7f93c9' },
      rows: [
        '....kkkk....',
        '.kk.kggk.kk.',
        '.kgkkggkkgk.',
        '..kggggggk..',
        'kkggkkkkggkk',
        'kgggk..kgddk',
        'kgggk..kgddk',
        'kkggkkkkddkk',
        '..kggddddk..',
        '.kgkkddkkdk.',
        '.kk.kddk.kk.',
        '....kkkk....'
      ]
    },
    full: {
      pal: { w: '#f4f8ff' },
      rows: [
        'kkkkk..kkkkk',
        'kwwwk..kwwwk',
        'kwkk....kkwk',
        'kwk......kwk',
        'kkk......kkk',
        '............',
        '............',
        'kkk......kkk',
        'kwk......kwk',
        'kwkk....kkwk',
        'kwwwk..kwwwk',
        'kkkkk..kkkkk'
      ]
    },
    phone: {
      pal: { b: '#2c519f', s: '#9fd8ff', w: '#e6f4ff' },
      rows: [
        '...kkkkkk...',
        '...kbbbbk...',
        '...kssssk...',
        '...kswssk...',
        '...kssssk...',
        '...kssssk...',
        '...kssssk...',
        '...kssssk...',
        '...kssssk...',
        '...kbbbbk...',
        '...kbwwbk...',
        '...kkkkkk...'
      ]
    },
    // Little flag: report a leaderboard record.
    flag: {
      pal: { r: '#ff5f6d', w: '#c9cfdc' },
      rows: [
        '.kk.........',
        '.kwkkkkkk...',
        '.kwkrrrrrk..',
        '.kwkrrrrrrk.',
        '.kwkrrrrrk..',
        '.kwkrrrrk...',
        '.kwkkkkk....',
        '.kwk........',
        '.kwk........',
        '.kwk........',
        'kkwkk.......',
        'kkkkk.......'
      ]
    },
    // Forbidden (Veto: banned move).
    ban: {
      pal: { r: '#ff5f6d' },
      rows: [
        '...kkkkkk...',
        '..krrrrrrk..',
        '.krrkkkkrrk.',
        'krrk..krrrrk',
        'krk..krrkkrk',
        'krk.krrk.krk',
        'krkkrrk..krk',
        'krrrrk..krrk',
        '.krrkkkkrrk.',
        '..krrrrrrk..',
        '...kkkkkk...',
        '............'
      ]
    },
    heart: {
      pal: { r: '#ff5f6d', s: '#c23a4b', w: '#ffd3d8' },
      rows: [
        '............',
        '.kkk....kkk.',
        'kwwrk..krrrk',
        'kwrrrkkrrrsk',
        'krrrrrrrrrsk',
        'krrrrrrrrrsk',
        '.krrrrrrrsk.',
        '..krrrrrsk..',
        '...krrrsk...',
        '....krsk....',
        '.....kk.....',
        '............'
      ]
    },
    fist: {
      pal: { r: '#ff5f6d', s: '#c23a4b', w: '#ffd3d8', c: '#e8e8f0' },
      rows: [
        '............',
        '..kkkkkk....',
        '.krrrrrrk...',
        'krwwrrrrrkk.',
        'krwrrrrrrrrk',
        'krrrrrrrkrsk',
        'krrrrrrrkrsk',
        '.krrrrrrskk.',
        '..kssssssk..',
        '..kcccccck..',
        '..kkkkkkkk..',
        '............'
      ]
    },
    up: {
      pal: { g: '#5fe08a', d: '#2f9a52', w: '#c8ffd8' },
      rows: [
        '.....kk.....',
        '....kwgk....',
        '...kwgggk...',
        '..kwgggggk..',
        '.kwgggggggk.',
        'kkkkggggkkkk',
        '...kggggk...',
        '...kggggk...',
        '...kggddk...',
        '...kgdddk...',
        '...kddddk...',
        '...kkkkkk...'
      ]
    },
    boot: {
      pal: { b: '#4fb4ff', d: '#2a6fb0', w: '#e6f4ff', g: '#e8e8f0' },
      rows: [
        '............',
        '....kkkk....',
        '....kbbk....',
        '....kbbk....',
        '....kbbk....',
        '....kbbbkk..',
        '...kbwbbbbk.',
        '..kbbbbbbbbk',
        '..kdddddddbk',
        '..kgggggggk.',
        '...kkkkkkk..',
        '............'
      ]
    },
    // Bond (legendary reward): two linked chain links.
    bond: {
      pal: { y: '#ffd23f', w: '#fff3b0', p: '#ff8ad8', q: '#ffd3f1' },
      rows: [
        '.kkkkk......',
        'kwyyyyk.....',
        'kykkkyk.....',
        'kyk.kyk.....',
        'kykkkyk.....',
        'kyyyyykkkkk.',
        '.kkkkkqppppk',
        '.....kpkkkpk',
        '.....kpk.kpk',
        '.....kpkkkpk',
        '.....kpppppk',
        '......kkkkk.'
      ]
    },
    clock: {
      pal: { w: '#f4f4ff', y: '#ffd23f', o: '#c9c9e0' },
      rows: [
        '....kkkk....',
        '..kkyyyykk..',
        '.kyywwwwyyk.',
        '.kywwwkwwyk.',
        'kywwwwkwwwyk',
        'kywwwwkwwwyk',
        'kywwwwkkkwyk',
        'kywwwwwwwwyk',
        '.kywwwwwwyk.',
        '.kyyowwwyyk.',
        '..kkyyyykk..',
        '....kkkk....'
      ]
    },
    shield: {
      pal: { s: '#9fb1c9', d: '#5d6f8c', w: '#e6eef8', r: '#4fb4ff' },
      rows: [
        '............',
        '.kkkkkkkkkk.',
        '.kwwsssssdk.',
        '.kwssrrssdk.',
        '.kwssrrssdk.',
        '.kssrrrrsdk.',
        '.kssrrrrsdk.',
        '..kssrrsdk..',
        '..kssssddk..',
        '...ksssdk...',
        '....kddk....',
        '.....kk.....'
      ]
    },
    sprout: {
      pal: { g: '#5fe08a', d: '#2f9a52', b: '#8a5a2b' },
      rows: [
        '............',
        '..kkk..kkk..',
        '.kgggk.kgggk',
        '.kggggkgggdk',
        '..kdggkggdk.',
        '...kkdgdkk..',
        '.....kgk....',
        '.....kgk....',
        '...kkkdkkk..',
        '..kbbbbbbbk.',
        '..kbbbbbbbk.',
        '...kkkkkkk..'
      ]
    },
    magnet: {
      pal: { r: '#ff5f6d', s: '#c23a4b', w: '#e8e8f0' },
      rows: [
        '............',
        '..kkkkkkkk..',
        '.krrrrrrrrk.',
        'krrsskkssrrk',
        'krrk....krrk',
        'krrk....krrk',
        'krrk....krrk',
        'kwwk....kwwk',
        'kwwk....kwwk',
        'kkkk....kkkk',
        '............',
        '............'
      ]
    },
    book: {
      pal: { c: '#4fb4ff', d: '#2a6fb0', p: '#f4f4ff', y: '#ffd23f' },
      rows: [
        '............',
        '.kkkkkkkkkk.',
        '.kcccccccck.',
        '.kcyyyyyyck.',
        '.kcccccccck.',
        '.kccyyyyyck.',
        '.kcccccccck.',
        '.kcccccccck.',
        '.kddddddddk.',
        '.kppppppppk.',
        '.kkkkkkkkkk.',
        '............'
      ]
    },
    coin: {
      pal: { y: '#ffd23f', o: '#c08a10', w: '#fff4b0' },
      rows: [
        '....kkkk....',
        '..kkyyyykk..',
        '.kyywwyyyyk.',
        '.kywyyyyyok.',
        'kyyyyooyyyok',
        'kywyoyyoyyok',
        'kyyyoyyoyyok',
        'kyyyyooyyyok',
        '.kyyyyyyyok.',
        '.kooyyyyook.',
        '..kkooookk..',
        '....kkkk....'
      ]
    },
    cards: {
      pal: { a: '#ffd23f', b: '#4fb4ff', w: '#e6f4ff' },
      rows: [
        '............',
        '.kkkkkk.....',
        '.kaaaaakkkk.',
        '.kaaaakbbbbk',
        '.kaaaakbwwbk',
        '.kaaaakbwwbk',
        '.kaaaakbbbbk',
        '.kaaaakbwwbk',
        '.kkkkkkbwwbk',
        '......kbbbbk',
        '......kkkkkk',
        '............'
      ]
    },
    berry: {
      pal: { r: '#ff7a9e', s: '#c23a6b', w: '#ffd3e0', g: '#5fe08a', d: '#2f9a52' },
      rows: [
        '............',
        '.....kkk....',
        '....kgggk...',
        '..kkkgdkkk..',
        '.krrrkkrrrk.',
        'krwwrrrrrrsk',
        'krwrrrrrrrsk',
        'krrrrrrrrrsk',
        'krrrrrrrrssk',
        '.krrrrrrssk.',
        '..kkssssskk.',
        '....kkkkk...'
      ]
    },
    bomb: {
      pal: { b: '#3a3a4a', w: '#8a8aa0', f: '#ffd23f', r: '#ff7b3d' },
      rows: [
        '........r...',
        '.......rfr..',
        '......kfr...',
        '.....kfk....',
        '...kkkkkk...',
        '..kbbbbbbk..',
        '.kbwwbbbbbk.',
        '.kbwbbbbbbk.',
        '.kbbbbbbbbk.',
        '.kbbbbbbbbk.',
        '..kbbbbbbk..',
        '...kkkkkk...'
      ]
    },
    star: {
      pal: { y: '#ffd23f', o: '#c08a10', w: '#fff4b0' },
      rows: [
        '.....kk.....',
        '.....kk.....',
        '....kwyk....',
        '....kyyk....',
        'kkkkwyyykkkk',
        'kwyyyyyyyyok',
        '.kyyyyyyyok.',
        '..kyyyyyyk..',
        '..kyyyoyyk..',
        '.kyok..koyk.',
        '.kok....kok.',
        '.kk......kk.'
      ]
    },
    // Shiny mark: the red star from the games' summary screen, with a sparkle.
    shiny: {
      pal: { y: '#ff4d5e', w: '#ffd0d6', o: '#b8283a', x: '#fff6b0' },
      rows: [
        '.....kk...x.',
        '.....kk..xxx',
        '....kwyk..x.',
        '....kyyk....',
        'kkkkwyyykkkk',
        'kwyyyyyyyyok',
        '.kyyyyyyyok.',
        '..kyyyyyyk..',
        '..kyyyoyyk..',
        '.kyok..koyk.',
        '.kok....kok.',
        '.kk......kk.'
      ]
    },
    crown: {
      pal: { y: '#ffd23f', o: '#c08a10', r: '#ff5f6d' },
      rows: [
        '............',
        '............',
        'k....k....k.',
        'kk..kyk..kk.',
        'kyk.kyk.kyk.',
        'kyykyyykyyk.',
        'kyyyyyyyyyk.',
        'kyyryyyryyk.',
        'kyyyyyyyyyk.',
        'koooooooook.',
        'kkkkkkkkkkk.',
        '............'
      ]
    },
    user: {
      pal: { u: '#b9cbf0', d: '#7f93c0' },
      rows: [
        '............',
        '....kkkk....',
        '...kuuuuk...',
        '...kuuuuk...',
        '...kuuuuk...',
        '....kuuk....',
        '..kkkuukkk..',
        '.kuuuuuuuuk.',
        '.kuuuuuuuuk.',
        '.kdduuuuddk.',
        '.kkkkkkkkkk.',
        '............'
      ]
    },
    cursor: {
      pal: { y: '#ffd23f' },
      rows: [
        'k.......',
        'kk......',
        'kyk.....',
        'kyyk....',
        'kyyyk...',
        'kyyyyk..',
        'kyyyk...',
        'kyyk....',
        'kyk.....',
        'kk......',
        'k.......',
        '........'
      ]
    },
    sound: {
      pal: { w: '#e8eef8' },
      rows: [
        '............',
        '.....kk.....',
        '....kwk..k..',
        '...kwwk...k.',
        'kkkwwwk.k..k',
        'kwwwwwk..k.k',
        'kwwwwwk..k.k',
        'kkkwwwk.k..k',
        '...kwwk...k.',
        '....kwk..k..',
        '.....kk.....',
        '............'
      ]
    },
    mute: {
      pal: { w: '#e8eef8', r: '#ff5f6d' },
      rows: [
        '............',
        '.....kk.....',
        '....kwk.....',
        '...kwwk.....',
        'kkkwwwk.r..r',
        'kwwwwwk..rr.',
        'kwwwwwk..rr.',
        'kkkwwwk.r..r',
        '...kwwk.....',
        '....kwk.....',
        '.....kk.....',
        '............'
      ]
    },
    ticket: {
      pal: { y: '#ffd23f', d: '#c08a10', w: '#fff3b0', r: '#ff5f6d' },
      rows: [
        '............',
        '............',
        'kkkkkkkkkkkk',
        'kwyyydyyyyyk',
        'kyyyyyyrryyk',
        '.kyyydyrryk.',
        '.kyyyyyrryk.',
        'kyyyydyyyyyk',
        'kddddddddddk',
        'kkkkkkkkkkkk',
        '............',
        '............'
      ]
    },
    ticket10: {
      pal: { p: '#c47bff', q: '#8a3fd0', w: '#f0d8ff', y: '#ffd23f' },
      rows: [
        '............',
        '............',
        'kkkkkkkkkkkk',
        'kwpppqppyypk',
        'kppppqpyyypk',
        '.kpppqpyyyk.',
        '.kpppqppyyk.',
        'kppppqpppppk',
        'kqqqqqqqqqqk',
        'kkkkkkkkkkkk',
        '............',
        '............'
      ]
    },
    wsun: {
      pal: { y: '#ffd23f', o: '#ff9a3d' },
      rows: [
        '.....yy.....',
        '..y..yy..y..',
        '...y....y...',
        '....kkkk....',
        'yy.kyyyyk.yy',
        'yy.kyyoyk.yy',
        '...kyooyk...',
        '....kkkk....',
        '...y....y...',
        '..y..yy..y..',
        '.....yy.....',
        '............'
      ]
    },
    wrain: {
      pal: { w: '#e8eef8', g: '#9fb1c9', b: '#4fb4ff' },
      rows: [
        '............',
        '...kkkk.....',
        '..kwwwwkkk..',
        '.kwwwwwwwwk.',
        'kwwwwwwwwwgk',
        'kggggggggggk',
        '.kkkkkkkkkk.',
        '..b...b...b.',
        '.b...b...b..',
        '..b...b...b.',
        '.b...b...b..',
        '............'
      ]
    },
    wsand: {
      pal: { s: '#e0bf73', d: '#9a7a3a' },
      rows: [
        '............',
        '..ssssss....',
        '........ss..',
        'ssssssss..s.',
        '.........s..',
        '..dddddd....',
        '........dd..',
        'dddddd....d.',
        '.........d..',
        '...sssss....',
        '............',
        '............'
      ]
    },
    wsnow: {
      pal: { w: '#ffffff', c: '#9fe0ff' },
      rows: [
        '.....w......',
        '...w.w.w....',
        '....www.....',
        '.w..cwc..w..',
        '..w.cwc.w...',
        'wwwwwwwwwww.',
        '..w.cwc.w...',
        '.w..cwc..w..',
        '....www.....',
        '...w.w.w....',
        '.....w......',
        '............'
      ]
    },
    wfog: {
      pal: { g: '#c9cfdc', d: '#8f98ab' },
      rows: [
        '............',
        '............',
        '..gggggg....',
        '.g......gg..',
        '............',
        '....gggggg..',
        '..dd......d.',
        '............',
        '.ggggggg....',
        'g.......gg..',
        '............',
        '............'
      ]
    },
    // Gacha slot machine balls (one per rarity).
    ball2: {
      pal: { r: '#3d7bff', s: '#2a56b8', w: '#cfe0ff', b: '#f4f4f4' },
      rows: [
        '....kkkk....',
        '..kkrrrrkk..',
        '.krwrrrrrrk.',
        '.krwrrrrrsk.',
        'krrrrkkrrssk',
        'kkkkkbbkkkkk',
        'kbbbkbbkbbbk',
        'kbbbbkkbbbbk',
        '.kbbbbbbbbk.',
        '.kbbbbbbbbk.',
        '..kkbbbbkk..',
        '....kkkk....'
      ]
    },
    ball3: {
      pal: { r: '#3a3a46', s: '#1d1d26', w: '#ffd23f', b: '#f4f4f4' },
      rows: [
        '....kkkk....',
        '..kkrrrrkk..',
        '.krwrrrrrrk.',
        '.krwrrrrrsk.',
        'krrrrkkrrssk',
        'kkkkkbbkkkkk',
        'kbbbkbbkbbbk',
        'kbbbbkkbbbbk',
        '.kbbbbbbbbk.',
        '.kbbbbbbbbk.',
        '..kkbbbbkk..',
        '....kkkk....'
      ]
    },
    ball4: {
      pal: { r: '#8a3fd0', s: '#5e2a96', w: '#ff8ad8', b: '#f4f4f4' },
      rows: [
        '....kkkk....',
        '..kkrrrrkk..',
        '.krwrrrrrrk.',
        '.krwrrrrrsk.',
        'krrrrkkrrssk',
        'kkkkkbbkkkkk',
        'kbbbkbbkbbbk',
        'kbbbbkkbbbbk',
        '.kbbbbbbbbk.',
        '.kbbbbbbbbk.',
        '..kkbbbbkk..',
        '....kkkk....'
      ]
    },
    ballLux: {
      pal: { r: '#30303a', s: '#18181e', w: '#ff5f6d', b: '#ffd23f' },
      rows: [
        '....kkkk....',
        '..kkrrrrkk..',
        '.krwrrrrrrk.',
        '.krwrrrrrsk.',
        'krrrrkkrrssk',
        'kkkkkbbkkkkk',
        'kbbbkbbkbbbk',
        'kbbbbkkbbbbk',
        '.kbbbbbbbbk.',
        '.kbbbbbbbbk.',
        '..kkbbbbkk..',
        '....kkkk....'
      ]
    },
    // ---------- held items (data/items.js) ----------
    leftovers: {
      pal: { r: '#ff5f6d', d: '#b8283a', w: '#ffd8d8', g: '#5fe08a' },
      rows: [
        '.....kgk....',
        '....kggk....',
        '..kkkkkkkk..',
        '.krwrrrrrrk.',
        'krwrrrrrrrdk',
        'krrrrrrrrrdk',
        'krrrrrrrrrdk',
        'krrrrrrrrddk',
        '.krrrrrrrdk.',
        '..kdrrrrdk..',
        '...kkkkkk...',
        '............'
      ]
    },
    choiceband: {
      pal: { p: '#ff8ad8', q: '#c04a98', w: '#ffe0f4' },
      rows: [
        '............',
        '............',
        '...kkkkkk...',
        '.kkppwwppkk.',
        'kpp......ppk',
        'kq........qk',
        'kq........qk',
        'kpp......ppk',
        '.kkppppppkk.',
        '...kkkkkk...',
        '............',
        '............'
      ]
    },
    quickclaw: {
      pal: { y: '#ffd23f', o: '#c08a10', b: '#8a5a2b' },
      rows: [
        '........kk..',
        '.......kyk..',
        '......kyok..',
        '..kk..kyok..',
        '.kyk.kyok...',
        '.kyokyok....',
        '.kyyyok..kk.',
        '.kbbbbk.kyk.',
        'kbbbbbbkyok.',
        'kbbbbbbyok..',
        '.kkkkkkkk...',
        '............'
      ]
    },
    focussash: {
      pal: { o: '#ff9a3d', d: '#c0601a', w: '#ffd0a0' },
      rows: [
        '.kk.........',
        'kook........',
        'kwook.......',
        '.kwook......',
        '..kwook.....',
        '...kwook....',
        '....kwook...',
        '.....kwook..',
        '......kwook.',
        '.......koodk',
        '........kddk',
        '.........kk.'
      ]
    },
    shellbell: {
      pal: { p: '#ff9ec4', q: '#c05a88', w: '#ffe0ee', y: '#ffd23f' },
      rows: [
        '.....kk.....',
        '....kyyk....',
        '...kkkkkk...',
        '..kwppppqk..',
        '.kwppppppqk.',
        '.kpppppppqk.',
        'kpppppppppqk',
        'kppqpqpqppqk',
        'kkkkkkkkkkkk',
        '....kyyk....',
        '.....kk.....',
        '............'
      ]
    },
    amuletcoin: {
      pal: { y: '#ffd23f', o: '#c08a10', w: '#fff3b0', r: '#ff5f6d' },
      rows: [
        '..kk....kk..',
        '..krk..krk..',
        '...krkkrk...',
        '....kkkk....',
        '...kyyyyk...',
        '..kywyyyok..',
        '..kyyooyok..',
        '..kyyooyok..',
        '..kyyyyyok..',
        '...kooook...',
        '....kkkk....',
        '............'
      ]
    },
    luckyegg: {
      pal: { w: '#fffaf0', s: '#e0d6c8', r: '#ff5f6d' },
      rows: [
        '....kkkk....',
        '...kwwwwk...',
        '..kwwrwwwk..',
        '..kwwwwwwk..',
        '.kwrwwwwrwk.',
        '.kwwwwwwwwk.',
        '.kwwwrwwwsk.',
        '.kwwwwwwwsk.',
        '.kwrwwwwssk.',
        '..kwwwwssk..',
        '...kkkkkk...',
        '............'
      ]
    },
    lifeorb: {
      pal: { p: '#c04a98', d: '#7a1f5a', w: '#ffb0e0', r: '#ff3048' },
      rows: [
        '....kkkk....',
        '..kkpppdkk..',
        '.kwwpppppdk.',
        '.kwpprrpppk.',
        'kppprrrrppdk',
        'kpprrrrrrpdk',
        'kpprrrrrrpdk',
        'kppprrrrppdk',
        '.kpppprppdk.',
        '.kdpppppddk.',
        '..kkddddkk..',
        '....kkkk....'
      ]
    },
    choicescarf: {
      pal: { b: '#4fb4ff', d: '#2a6fb0', w: '#cfe8ff' },
      rows: [
        '............',
        '............',
        'kkkkkkkkkk..',
        'kwbbbbbbbbk.',
        'kbbbbbbbbdk.',
        'kkkkkkkbbdk.',
        '......kbbdk.',
        '......kbbdk.',
        '.....kbbbdk.',
        '.....kbbddk.',
        '.....kkkkkk.',
        '............'
      ]
    },
    rockyhelmet: {
      pal: { g: '#9aa6b5', d: '#5d6773', w: '#e0e6ee' },
      rows: [
        '............',
        '.k...k...k..',
        'kgk.kgk.kgk.',
        '.kkkkkkkkk..',
        'kwggggggggk.',
        'kwgggggggdk.',
        'kggggggggdk.',
        'kgggkkkkgdk.',
        'kggk....kdk.',
        'kkk......kk.',
        '............',
        '............'
      ]
    },
    assaultvest: {
      pal: { g: '#4f8a3a', d: '#2f5a22', y: '#ffd23f' },
      rows: [
        '............',
        '.kkk....kkk.',
        'kggk....kggk',
        'kgggkkkkgggk',
        'kgggyggygggk',
        'kgggggggggdk',
        'kggyggggygdk',
        'kgggggggggdk',
        'kgggggggggdk',
        'kddddddddddk',
        'kkkkkkkkkkkk',
        '............'
      ]
    },
    // ---------- story gym badges (data/stages.js: 'badge:' + stage id) ----------
    // Boulder Badge: grey octagon
    'badge:kanto_1': {
      pal: { d: '#6f7480', g: '#a9aeb8', w: '#e3e6ec' },
      rows: [
        '...kkkkkk...',
        '..kddddddk..',
        '.kddwwwwddk.',
        'kddwwggggddk',
        'kdwwggggggdk',
        'kdwggggggddk',
        'kdwgggggdddk',
        'kdggggggdddk',
        'kddggggdddk.',
        '.kdddddddk..',
        '..kddddddk..',
        '...kkkkkk...'
      ]
    },
    // Cascade Badge: blue drop
    'badge:kanto_2': {
      pal: { b: '#4fa8ff', d: '#2a5fb0', w: '#cfeaff' },
      rows: [
        '.....kk.....',
        '....kbbk....',
        '....kbbk....',
        '...kwbbbk...',
        '..kwbbbbbk..',
        '.kwbbbbbbbk.',
        '.kwbbbbbbdk.',
        'kbbbbbbbbddk',
        'kbbbbbbbdddk',
        '.kbbbbbdddk.',
        '..kkddddkk..',
        '....kkkk....'
      ]
    },
    // Thunder Badge: orange star
    'badge:kanto_3': {
      pal: { y: '#ffd23f', o: '#ff9a2e', r: '#c8561a' },
      rows: [
        '.....kk.....',
        '....kyyk....',
        '.kk.kyyk.kk.',
        '.kykkyykkyk.',
        '..kyyooyyk..',
        'kkyyorroyykk',
        'kyyyorroyyyk',
        '.kkyyooyykk.',
        '..kyykkyyk..',
        '.kyk.kk.kyk.',
        '.kk.kyyk.kk.',
        '.....kk.....'
      ]
    },
    // Rainbow Badge: flower
    'badge:kanto_4': {
      pal: { r: '#ff5f6d', o: '#ff9a2e', y: '#ffd23f', g: '#5fe08a', b: '#4fa8ff', p: '#c47bff', w: '#fff3b0' },
      rows: [
        '....kkkk....',
        '...krrrok...',
        '.kkkrrook...',
        'kppkkookykk.',
        'kpppkwwkyyyk',
        'kpppkwwkyyyk',
        '.kkbbkkgyyk.',
        '..kbbbkggkk.',
        '..kbbbkgggk.',
        '...kbbkgggk.',
        '....kkkkkk..',
        '............'
      ]
    },
    // Soul Badge: pink heart
    'badge:kanto_5': {
      pal: { p: '#ff7ac8', d: '#c03a8a', w: '#ffd0ec' },
      rows: [
        '............',
        '.kkk....kkk.',
        'kwwpk..kppdk',
        'kwppppkppppk',
        'kwpppppppddk',
        'kpppppppppdk',
        '.kpppppppdk.',
        '..kpppppddk.',
        '...kpppddk..',
        '....kppdk...',
        '.....kdk....',
        '......k.....'
      ]
    },
    // Marsh Badge: gold rings
    'badge:kanto_6': {
      pal: { y: '#ffd23f', d: '#c08a10', w: '#fff3b0' },
      rows: [
        '...kkkkkk...',
        '..kwwyyyyk..',
        '.kwykkkkydk.',
        'kwyk....kydk',
        'kyk.kkkk.kdk',
        'kyk.kwyk.kdk',
        'kyk.kydk.kdk',
        'kyk.kkkk.kdk',
        'kyyk....kddk',
        '.kyykkkkddk.',
        '..kddddddk..',
        '...kkkkkk...'
      ]
    },
    // Volcano Badge: flame
    'badge:kanto_7': {
      pal: { r: '#ff5f3d', o: '#ff9a2e', y: '#ffd23f', d: '#b8283a' },
      rows: [
        '.....k......',
        '....krk.....',
        '....krrk.k..',
        '...krrrkkrk.',
        '..krrorrrrk.',
        '..krooorrrdk',
        '.krroyyorrdk',
        '.kroyyyyordk',
        '.kroyyyyordk',
        '.krroyyorrdk',
        '..kdrrrrddk.',
        '...kkkkkkk..'
      ]
    },
    // Earth Badge: green leaf
    'badge:kanto_8': {
      pal: { g: '#5fe08a', d: '#2f9a52', w: '#c8ffd8' },
      rows: [
        '.....kk.....',
        '....kwgk....',
        '...kwgggk...',
        '..kwggdggk..',
        '.kwgggdgggk.',
        'kwggggdggggk',
        'kgggggdgggdk',
        '.kggggdggdk.',
        '..kgggdgdk..',
        '...kggddk...',
        '....kgdk....',
        '.....kk.....'
      ]
    },
    // ---------- achievement medals (bronze, silver, gold) ----------
    medal1: { pal: { r: '#ff5f6d', q: '#b8283a', m: '#d08a4a', n: '#8a5226', w: '#ffd0a0', s: '#ffe8c8' }, rows: MEDAL },
    medal2: { pal: { r: '#4fb4ff', q: '#2a6fb0', m: '#c9d2de', n: '#7d8899', w: '#ffffff', s: '#ffffff' }, rows: MEDAL },
    medal3: { pal: { r: '#c47bff', q: '#7a3fb0', m: '#ffd23f', n: '#c08a10', w: '#fff3b0', s: '#fffbe0' }, rows: MEDAL },
    medalOff: { pal: { r: '#3a4870', q: '#2a3458', m: '#3a4870', n: '#2a3458', w: '#4a5a88', s: '#4a5a88' }, rows: MEDAL },
    trophy: {
      pal: { y: '#ffd23f', d: '#c08a10', w: '#fff3b0' },
      rows: [
        '............',
        '..kkkkkkkk..',
        'kkkwyyyydkkk',
        'k.kwyyyydk.k',
        'k.kwyyyydk.k',
        '.kkwyyyydkk.',
        '...kyyyyk...',
        '....kyyk....',
        '....kyyk....',
        '...kddddk...',
        '..kyyyyyyk..',
        '..kkkkkkkk..'
      ]
    },
    friends: {
      pal: { b: '#4fb4ff', d: '#2a6fb0', g: '#5fe08a', h: '#2f9a52' },
      rows: [
        '............',
        '..kkk..kkk..',
        '.kbbbkkgggk.',
        '.kbbbkkgggk.',
        '..kkk..kkk..',
        '............',
        '.kkkkkkkkkk.',
        'kbbbbkkggggk',
        'kbbbbkkggggk',
        'kddddkkhhhhk',
        'kkkkkkkkkkkk',
        '............'
      ]
    },
    ball: {
      pal: { r: '#ff4d4d', w: '#f4f4f4', s: '#c23a3a' },
      rows: [
        '....kkkk....',
        '..kkrrrrkk..',
        '.krwrrrrrrk.',
        '.krwrrrrrsk.',
        'krrrrkkrrssk',
        'kkkkkwwkkkkk',
        'kwwwkwwkwwwk',
        'kwwwwkkwwwwk',
        '.kwwwwwwwwk.',
        '.kwwwwwwwwk.',
        '..kkwwwwkk..',
        '....kkkk....'
      ]
    }
  };
  // Palette variants.
  UI.starDim = { rows: UI.star.rows, pal: { y: '#3a4870', o: '#2a3458', w: '#4a5a88' } };

  // ---------------- type glyphs (8×8, white on the emblem) ----------------
  const TYPE_GLYPH = {
    normal: ['..####..', '.#....#.', '#......#', '#..##..#', '#..##..#', '#......#', '.#....#.', '..####..'],
    fire: ['...#....', '...##...', '..###.#.', '.#####..', '.######.', '##.####.', '##..###.', '.######.'],
    water: ['...##...', '...##...', '..####..', '.######.', '.##.###.', '.#.####.', '.######.', '..####..'],
    grass: ['.....###', '...#####', '..######', '.####.##', '.###.###', '.##.####', '.#.####.', '#.......'],
    electric: ['....###.', '...###..', '..###...', '.######.', '...###..', '..###...', '.##.....', '#.......'],
    psychic: ['.######.', '#......#', '#.####.#', '#.#..#.#', '#.#.##.#', '#.#....#', '#.######', '#.......'],
    ice: ['...#....', '.#.#.#..', '..###...', '#######.', '..###...', '.#.#.#..', '...#....', '........'],
    fighting: ['.######.', '########', '########', '#.#.#.##', '########', '.#######', '..#####.', '..####..'],
    poison: ['.....##.', '....####', '.....##.', '.###....', '#####...', '#####.##', '.###.###', '.....##.'],
    ground: ['........', '...##...', '..####..', '.##..##.', '.######.', '##.##.##', '########', '........'],
    flying: ['#.......', '##......', '###.....', '####....', '######..', '########', '.#######', '...####.'],
    bug: ['.#....#.', '..#..#..', '..####..', '.##.###.', '########', '###.####', '.######.', '..####..'],
    rock: ['...###..', '..#####.', '.###.###', '######.#', '##.#####', '#######.', '.#####..', '........'],
    ghost: ['..####..', '.######.', '##.##.##', '##.##.##', '########', '########', '########', '#.#..#.#'],
    dragon: ['#.......', '##....#.', '.##..##.', '.######.', '..####..', '.######.', '##.##.##', '#..##..#'],
    dark: ['..####..', '.###....', '###.....', '###.....', '###.....', '###.....', '.###....', '..####..'],
    steel: ['..####..', '.######.', '###..###', '##....##', '##....##', '###..###', '.######.', '..####..'],
    fairy: ['...#....', '...#....', '..###...', '#######.', '..###...', '..#.#...', '.#...#..', '........']
  };

  // Move family badge (5×5).
  const KIND_GLYPH = {
    projectile: ['..#..', '...#.', '#####', '...#.', '..#..'],
    melee: ['....#', '...#.', '..#..', '.#...', '#....'],
    beam: ['.....', '#####', '.....', '#####', '.....'],
    orbit: ['.###.', '#...#', '#...#', '#...#', '.###.'],
    nova: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'],
    aura: ['.###.', '#...#', '#.#.#', '#...#', '.###.'],
    buff: ['..#..', '.###.', '#####', '..#..', '..#..'],
    boomerang: ['####.', '#....', '#....', '#....', '#....'],
    chain: ['##...', '..#..', '...##', '..#..', '##...'],
    mine: ['..#..', '.###.', '##.##', '.###.', '..#..'],
    meteor: ['....#', '...#.', '.##..', '####.', '.##..'],
    turret: ['.###.', '.#.#.', '.###.', '..#..', '#####'],
    dash: ['#.#..', '.#.#.', '..#.#', '.#.#.', '#.#..'],
    trail: ['#....', '.....', '..#..', '.....', '....#'],
    cone: ['....#', '..###', '#####', '..###', '....#']
  };

  // ---------------- render ----------------

  const cache = new Map(); // key -> canvas at 1×
  const urls = new Map();

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = c => Math.max(0, Math.min(255, Math.round(c * k)));
    return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // ---------- generated gym badges: a shape per type, colored by the type (badgeOf) ----------
  const BADGE_SHAPES = {
    octagon: [
      '...kkkkkk...',
      '..kddddddk..',
      '.kddwwwwddk.',
      'kddwwmmmmddk',
      'kdwwmmmmmmdk',
      'kdwmmmmmmddk',
      'kdwmmmmmdddk',
      'kdmmmmmmdddk',
      'kddmmmmdddk.',
      '.kdddddddk..',
      '..kddddddk..',
      '...kkkkkk...'
    ],
    drop: [
      '.....kk.....',
      '....kmmk....',
      '....kmmk....',
      '...kwmmmk...',
      '..kwmmmmmk..',
      '.kwmmmmmmmk.',
      '.kwmmmmmmdk.',
      'kmmmmmmmmddk',
      'kmmmmmmmdddk',
      '.kmmmmmdddk.',
      '..kkddddkk..',
      '....kkkk....'
    ],
    star: [
      '.....kk.....',
      '....kmmk....',
      '.kk.kmmk.kk.',
      '.kmkkmmkkmk.',
      '..kmmwwmmk..',
      'kkmmwddwmmkk',
      'kmmmwddwmmmk',
      '.kkmmwwmmkk.',
      '..kmmkkmmk..',
      '.kmk.kk.kmk.',
      '.kk.kmmk.kk.',
      '.....kk.....'
    ],
    heart: [
      '............',
      '.kkk....kkk.',
      'kwwmk..kmmdk',
      'kwmmmmkmmmmk',
      'kwmmmmmmmddk',
      'kmmmmmmmmmdk',
      '.kmmmmmmmdk.',
      '..kmmmmmddk.',
      '...kmmmddk..',
      '....kmmdk...',
      '.....kdk....',
      '......k.....'
    ],
    rings: [
      '...kkkkkk...',
      '..kwwmmmmk..',
      '.kwmkkkkmdk.',
      'kwmk....kmdk',
      'kmk.kkkk.kdk',
      'kmk.kwmk.kdk',
      'kmk.kmdk.kdk',
      'kmk.kkkk.kdk',
      'kmmk....kddk',
      '.kmmkkkkddk.',
      '..kddddddk..',
      '...kkkkkk...'
    ],
    flame: [
      '.....k......',
      '....kmk.....',
      '....kmmk.k..',
      '...kmmmkkmk.',
      '..kmmwmmmmk.',
      '..kmwwwmmmdk',
      '.kmmwwwwmmdk',
      '.kmwwwwwwmdk',
      '.kmwwwwwwmdk',
      '.kmmwwwwmmdk',
      '..kdmmmmddk.',
      '...kkkkkkk..'
    ],
    leaf: [
      '.....kk.....',
      '....kwmk....',
      '...kwmmmk...',
      '..kwmmdmmk..',
      '.kwmmmdmmmk.',
      'kwmmmmdmmmmk',
      'kmmmmmdmmmdk',
      '.kmmmmdmmdk.',
      '..kmmmdmdk..',
      '...kmmddk...',
      '....kmdk....',
      '.....kk.....'
    ],
    wing: [
      '............',
      '.........kk.',
      '.......kkwk.',
      '.....kkwwmk.',
      '...kkwwmmmk.',
      '.kkwwmmmmdk.',
      'kwwmmmmmddk.',
      'kmmmmmmddk..',
      '.kmmmmddk...',
      '..kmmddk....',
      '...kddk.....',
      '....kk......'
    ],
    bolt: [
      '......kkkk..',
      '.....kwwmk..',
      '....kwmmk...',
      '...kwmmk....',
      '..kwmmkkkkk.',
      '.kwmmmmmmmk.',
      '.kkkkkmmmk..',
      '....kmmmk...',
      '...kmmdk....',
      '..kmddk.....',
      '..kddk......',
      '..kkk.......'
    ],
    snow: [
      '.....kk.....',
      '..k..kk..k..',
      '.kwk.kk.kmk.',
      '..kwkwmkmk..',
      'kk.kwmmmk.kk',
      'kwwwmwdmmmdk',
      'kmmmmdwmddk.',
      'kk.kmmmdk.kk',
      '..kmkmdkdk..',
      '.kmk.kk.kdk.',
      '..k..kk..k..',
      '.....kk.....'
    ],
    fist: [
      '............',
      '..kkkkkkk...',
      '.kwkwkwkwk..',
      '.kwkmkmkmkk.',
      '.kmkmkmkmkmk',
      '.kmmmmmmmkmk',
      '.kmmmmmmmmdk',
      '.kmmmmmmmmdk',
      '..kmmmmmmdk.',
      '..kmmmmmddk.',
      '..kdddddddk.',
      '..kkkkkkkk..'
    ],
    fang: [
      '.kk......kk.',
      'kwmk....kmdk',
      'kwmmk..kmmdk',
      '.kwmmkkmmdk.',
      '.kwmmmmmmdk.',
      '..kmmmmmmk..',
      '..kmmmmmdk..',
      '...kmmmdk...',
      '...kmmmdk...',
      '....kmdk....',
      '....kmdk....',
      '.....kk.....'
    ],
    shield: [
      '.kkkkkkkkkk.',
      'kwwwwmmmmmdk',
      'kwmmmmmmmmdk',
      'kwmmkkkkmmdk',
      'kwmkwwmdkmdk',
      'kmmkwmmdkmdk',
      'kmmkmmddkmdk',
      '.kmmkkkkmdk.',
      '.kmmmmmmmdk.',
      '..kmmmmmdk..',
      '...kmmmdk...',
      '....kkkk....'
    ],
    bug: [
      '..k......k..',
      '...k....k...',
      '...kkkkkk...',
      '..kwmmmmdk..',
      '.kkkkkkkkkk.',
      'kwmmmkkmmmdk',
      'kwmmmkkmmmdk',
      'kmmmmkkmmmdk',
      'kmmmmkkmmddk',
      '.kmmmkkmmdk.',
      '..kmmkkmdk..',
      '...kkkkkk...'
    ],
    eye: [
      '............',
      '....kkkk....',
      '..kkwwmmkk..',
      '.kwwmkkmmdk.',
      'kwmmkddkmmdk',
      'kwmkdwwdkmdk',
      'kmmkdwwdkmdk',
      'kmmmkddkmmdk',
      '.kmmmkkmmdk.',
      '..kkmmmdkk..',
      '....kkkk....',
      '............'
    ],
    moon: [
      '....kkkk....',
      '..kkwwmmk...',
      '.kwwmmkk....',
      '.kwmmk......',
      'kwmmk.......',
      'kwmmk.......',
      'kmmmk.......',
      'kmmmk.....k.',
      '.kmmmk...kdk',
      '.kmmmmkkkmdk',
      '..kkmmmmddk.',
      '....kkkkkk..'
    ],
    sparkle: [
      '.....kk.....',
      '....kwmk....',
      '....kwmk....',
      '...kwmmdk...',
      'kkkkwmmmkkkk',
      'kwwwmmmmmmdk',
      'kmmmmmmmdddk',
      'kkkkmmmdkkkk',
      '...kmmmdk...',
      '....kmdk....',
      '....kmdk....',
      '.....kk.....'
    ],
    peak: [
      '............',
      '.....kk.....',
      '....kwmk....',
      '...kwwmmk...',
      '...kwmmmdk..',
      '..kwmmkmmdk.',
      '..kwmk.kmdk.',
      '.kwmmk.kmmdk',
      '.kmmk...kmdk',
      'kmmmk...kmdk',
      'kmmddkkkkddk',
      'kkkkkkkkkkkk'
    ]
  };
  const TYPE_BADGE = {
    normal: 'rings',
    fire: 'flame',
    water: 'drop',
    grass: 'leaf',
    electric: 'bolt',
    ice: 'snow',
    fighting: 'fist',
    poison: 'heart',
    ground: 'peak',
    flying: 'wing',
    psychic: 'eye',
    bug: 'bug',
    rock: 'octagon',
    ghost: 'moon',
    dragon: 'fang',
    dark: 'moon',
    steel: 'shield',
    fairy: 'sparkle'
  };

  /** Mixes a color towards another (k = 0 → a, 1 → b). */
  function mix(a, b, k) {
    const ca = parseInt(a.slice(1), 16),
      cb = parseInt(b.slice(1), 16);
    const ch = sh => Math.round(((ca >> sh) & 255) * (1 - k) + ((cb >> sh) & 255) * k);
    return '#' + [16, 8, 0].map(sh => ch(sh).toString(16).padStart(2, '0')).join('');
  }

  // 'badge:<stage id>' for every story stage without a hand-drawn badge (Kanto's are above):
  // the shape of its gym's type (or the gym's own `icon`), in that type's colors.
  for (const r of Stages.REGIONS)
    for (const st of r.stages) {
      const k = 'badge:' + st.id;
      if (UI[k]) continue;
      const col = U.TYPE_COLOR[st.gym.type] || '#b0a99f';
      UI[k] = {
        pal: { w: mix(col, '#ffffff', 0.55), m: col, d: shade(col, 0.6) },
        rows: BADGE_SHAPES[st.gym.icon || TYPE_BADGE[st.gym.type]]
      };
    }

  function fromRows(def) {
    const h = def.rows.length,
      w = Math.max(...def.rows.map(r => r.length));
    const pad = def.outline ? 1 : 0;
    const cv = document.createElement('canvas');
    cv.width = w + pad * 2;
    cv.height = h + pad * 2;
    const c = cv.getContext('2d', { willReadFrequently: true }); // read in svgOf()
    const pal = Object.assign({ k: K }, def.pal);
    if (def.outline) {
      c.fillStyle = K;
      def.rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch === '.' || ch === ' ') return;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
          ])
            c.fillRect(x + pad + dx, y + pad + dy, 1, 1);
        })
      );
    }
    def.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.' || ch === ' ' || !pal[ch]) return;
        c.fillStyle = pal[ch];
        c.fillRect(x + pad, y + pad, 1, 1);
      })
    );
    return cv;
  }

  /** Round type emblem (16×16), with an optional family badge. */
  function emblem(type, kind) {
    const S = 16;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d', { willReadFrequently: true }); // read in svgOf()
    const col = U.TYPE_COLOR[type] || '#b0a99f';
    const dark = shade(col, 0.55),
      lite = shade(col, 1.3);
    // Disc with outline, shadow bottom-right and highlight top-left.
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        if (d > 7.6) continue;
        let f = col;
        if (d > 6.6) f = K;
        else if (x - 7.5 + (y - 7.5) > 6) f = dark;
        else if (x - 7.5 + (y - 7.5) < -6.5) f = lite;
        c.fillStyle = f;
        c.fillRect(x, y, 1, 1);
      }
    const g = TYPE_GLYPH[type] || TYPE_GLYPH.normal;
    // Glyph shadow and glyph.
    c.fillStyle = dark;
    g.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '#') c.fillRect(x + 5, y + 5, 1, 1);
      })
    );
    c.fillStyle = '#ffffff';
    g.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '#') c.fillRect(x + 4, y + 4, 1, 1);
      })
    );

    if (kind && KIND_GLYPH[kind]) {
      c.fillStyle = K;
      c.fillRect(9, 9, 7, 7);
      c.fillStyle = '#2b3454';
      c.fillRect(10, 10, 5, 5);
      c.fillStyle = '#ffd23f';
      KIND_GLYPH[kind].forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch === '#') c.fillRect(x + 10, y + 10, 1, 1);
        })
      );
    }
    return cv;
  }

  /** Mega Stone: a coloured orb until its sprite (16×16, scripts/fetch_sprites.py) loads, then
   *  the sprite, drawn into the same canvas (cached and drawn every frame, so it updates on its own). */
  function stone(def) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 16;
    const c = cv.getContext('2d');
    c.fillStyle = K;
    c.beginPath();
    c.arc(8, 8, 7, 0, 6.2832);
    c.fill();
    c.fillStyle = def ? def.aura : '#c98aff';
    c.beginPath();
    c.arc(8, 8, 5.5, 0, 6.2832);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)';
    c.fillRect(5, 4, 2, 2);
    if (def) {
      const img = new Image();
      img.onload = () => {
        c.clearRect(0, 0, 16, 16);
        c.drawImage(img, 0, 0, 16, 16);
      };
      img.src = `assets/items/${def.stone}.png`;
    }
    return cv;
  }

  function canvas(name) {
    let cv = cache.get(name);
    if (cv) return cv;
    if (name.startsWith('move:')) {
      const m = Moves.BY_ID[name.slice(5)];
      cv = emblem(m ? m.type : 'normal', m ? m.kind : null);
    } else if (name.startsWith('type:')) {
      cv = emblem(name.slice(5));
    } else if (name.startsWith('mega:')) {
      cv = stone(Megas.of(+name.slice(5)));
    } else {
      cv = fromRows(UI[name] || UI.star);
    }
    cache.set(name, cv);
    return cv;
  }

  function url(name) {
    let u = urls.get(name);
    if (!u) {
      // Interface icons straight from their drawing; emblems (types, moves) from the canvas.
      const plain = !name.startsWith('move:') && !name.startsWith('type:');
      u = plain ? svgOfRows(UI[name] || UI.star) : svgOf(canvas(name));
      urls.set(name, u);
    }
    return u;
  }

  /**
   * The icon as text SVG (one rectangle per run of equal pixels).
   * toDataURL() did the same as PNG, but the first time the browser takes
   * ~175 ms to set it up, and that blocked page load (Lighthouse).
   */
  function svgDoc(W, H, rects) {
    return (
      'data:image/svg+xml,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${rects}</svg>`
      )
    );
  }

  /** Same as fromRows() but without a canvas (or pixel reads). */
  function svgOfRows(def) {
    const h = def.rows.length,
      w = Math.max(...def.rows.map(r => r.length));
    const pad = def.outline ? 1 : 0;
    const pal = Object.assign({ k: K }, def.pal);
    const px = new Map();
    if (def.outline)
      def.rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch === '.' || ch === ' ') return;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
          ])
            px.set(x + pad + dx + ',' + (y + pad + dy), K);
        })
      );
    def.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.' || ch === ' ' || !pal[ch]) return;
        px.set(x + pad + ',' + (y + pad), pal[ch]);
      })
    );
    let out = '';
    for (const [k, c] of px) {
      const [x, y] = k.split(',');
      out += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
    }
    return svgDoc(w + pad * 2, h + pad * 2, out);
  }

  function svgOf(cv) {
    const W = cv.width,
      H = cv.height;
    const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    let out = '';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W;) {
        const i = (y * W + x) * 4,
          a = d[i + 3];
        if (!a) {
          x++;
          continue;
        }
        let n = 1;
        while (
          x + n < W &&
          d[i + n * 4] === d[i] &&
          d[i + n * 4 + 1] === d[i + 1] &&
          d[i + n * 4 + 2] === d[i + 2] &&
          d[i + n * 4 + 3] === a
        )
          n++;
        const hex = '#' + ((1 << 24) | (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).slice(1);
        out += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${hex}"${a < 255 ? ` fill-opacity="${(a / 255).toFixed(3)}"` : ''}/>`;
        x += n;
      }
    }
    return svgDoc(W, H, out);
  }

  /**
   * Snaps the size to an integer multiple of the icon's resolution: a 16 px
   * icon drawn at 24 would double some pixels and not others.
   */
  function snap(name, size) {
    const w = canvas(name).width;
    return w * Math.max(1, Math.round(size / w));
  }

  /** Pixelated <img> for the DOM. */
  function html(name, size = 20, cls = '') {
    const cv = canvas(name),
      w = snap(name, size),
      h = (w * cv.height) / cv.width;
    return `<img class="pix ${cls}" src="${url(name)}" width="${w}" height="${h}" alt="" draggable="false">`;
  }

  function draw(ctx, name, x, y, size) {
    const cv = canvas(name);
    const s2 = snap(name, size);
    x += (size - s2) / 2;
    y += (size - s2) / 2;
    size = s2;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, Math.round(x), Math.round(y), size, (size * cv.height) / cv.width);
    ctx.imageSmoothingEnabled = prev;
  }

  /**
   * Shiny twinkle, drawn pixel by pixel (not an icon): a cross that appears,
   * grows, sprouts diagonal tips and fades out, like in the games.
   * phase 0..1 · px = on-screen pixel size.
   */
  function twinkle(ctx, x, y, phase, px = 2) {
    const st = phase < 0.15 ? 0 : phase < 0.32 ? 1 : phase < 0.62 ? 2 : phase < 0.82 ? 1 : 0;
    const X = Math.round(x / px) * px,
      Y = Math.round(y / px) * px;
    const dot = (dx, dy, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(X + dx * px, Y + dy * px, px, px);
    };
    const ARM = '#fff3a8',
      TIP = '#9ae6ff';
    dot(0, 0, '#ffffff');
    if (st >= 1)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ])
        dot(dx, dy, ARM);
    if (st >= 2) {
      for (const [dx, dy] of [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2]
      ])
        dot(dx, dy, ARM);
      for (const [dx, dy] of [
        [3, 0],
        [-3, 0],
        [0, 3],
        [0, -3]
      ])
        dot(dx, dy, TIP);
      for (const [dx, dy] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1]
      ])
        dot(dx, dy, TIP);
    }
  }

  /**
   * Rarity as a Poké Ball: Poké (Common), Great (Uncommon), Ultra (Rare),
   * Luxury (Epic) and Master (Legendary).
   */
  const RARITY_BALL = { 1: 'ball', 2: 'ball2', 3: 'ball3', 4: 'ballLux', 5: 'ball4' };
  function rarity(n, size = 12) {
    return `<span class="rarity-ball" title="${(Gacha && Gacha.RARITY_NAME[n]) || ''}">${html(RARITY_BALL[n] || 'ball', size)}</span>`;
  }

  /** Exposes to CSS the icons used by the stylesheets. */
  function installCss() {
    const r = document.documentElement.style;
    r.setProperty('--ico-coin', `url("${url('coin')}")`);
    r.setProperty('--ico-cursor', `url("${url('cursor')}")`);
  }

  return { canvas, url, html, draw, twinkle, rarity, RARITY_BALL, installCss, UI, TYPE_GLYPH };
})();
