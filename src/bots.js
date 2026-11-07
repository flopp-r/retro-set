// ============================================================================
//  RETRO SET — the computer opponents: who they are, how they look and how they play
// ============================================================================
// No DOM here: this file also runs in Node, for the tests and tools/sim-bots.js. Each bot's rating is the target its
// settings were tuned to, by playing thousands of games: the top two against Stockfish at its calibrated strength
// settings (1320 and 1500), then each of the others 200 points below the bot above it. See HANDOVER.md, section 5,
// for the measured results.
const BOTS = (() => {
'use strict';

// The strength knob, from 0 (the engine's best at that depth) up to 1.41 (any legal move): how readily the bot picks a worse
// move (temp, in centipawns) and how often it plays any legal move at all (blunder). tools/sim-bots.js tunes k.
const knob = k => ({ temp: Math.round(5 + 595 * Math.pow(k, 1.5)), blunder: Math.min(1, Math.round(500 * k * k) / 1000) });   // above 1.41, every move is random
// look: the pixel portrait (game.js draws it: sprite style, skin, hair, shirt). cfg: see think() in core.js; depth and
// qs are chosen by hand, k by tools/sim-bots.js. style: bonuses (centipawns) for the moves the bot likes.
const LIST = [
  { id: 'pip', name: 'Pip', rating: 100, look: { s: 'cap', skin: '#f6d2b4', hair: '#d9a441', shirt: '#6cb8ff' },
    blurb: 'Has just learnt how the pieces move. Anything can happen.', cfg: { depth: 1, qs: true, k: 0.309 } },
  { id: 'mabel', name: 'Mabel', rating: 300, look: { s: 'long', skin: '#f2c49b', hair: '#c9c3bd', shirt: '#b04a7a' },
    blurb: 'Loves pushing her pawns, and often leaves a piece hanging.', cfg: { depth: 1, qs: true, k: 0.238, style: { pawn: 30 } } },
  { id: 'dev', name: 'Dev', rating: 500, look: { s: 'man', skin: '#a8714a', hair: '#1a1206', shirt: '#ff6f8f' },
    blurb: 'Grabs anything you offer, even when it\'s a trap.', cfg: { depth: 1, qs: true, k: 0.205, style: { capture: 80 } } },
  { id: 'priya', name: 'Priya', rating: 700, look: { s: 'glasses', skin: '#d9a07a', hair: '#1a1206', shirt: '#1d8a74' },
    blurb: 'Knows a few openings, then loses the thread.', cfg: { depth: 1, qs: true, k: 0.133 } },
  { id: 'gus', name: 'Gus', rating: 900, look: { s: 'beard', skin: '#f2c49b', hair: '#b5432a', shirt: '#56399a' },
    blurb: 'A club-night regular. Takes any piece you leave loose.', cfg: { depth: 2, qs: true, k: 0.16 } },
  { id: 'ruth', name: 'Ruth', rating: 1100, look: { s: 'long', skin: '#6b4429', hair: '#1a1206', shirt: '#ffc56b' },
    blurb: 'Patient and careful: castles early and waits for you to slip.', cfg: { depth: 2, qs: true, k: 0.112, style: { castle: 40 } } },
  { id: 'tariq', name: 'Tariq', rating: 1300, look: { s: 'man', skin: '#d9a07a', hair: '#5a3420', shirt: '#f7ead2' },
    blurb: 'Sharp tactics. Looks for checks and captures first.', cfg: { depth: 3, qs: true, k: 0.129, style: { check: 25 } } },
  { id: 'nell', name: 'Nell', rating: 1500, look: { s: 'glasses', skin: '#f6d2b4', hair: '#5a3420', shirt: '#6cb8ff' },
    blurb: 'The club champion. Rarely gives anything away.', cfg: { depth: 4, qs: true, k: 0.095 } },
];
// a bot's full settings for think(): its own, with the knob turned into temp and blunder
const settings = (bot, k = bot.cfg.k) => ({ ...bot.cfg, ...knob(k) });
const byId = id => LIST.find(b => b.id === id);

return { LIST, knob, settings, byId };
})();
if (typeof module !== 'undefined') module.exports = BOTS;
