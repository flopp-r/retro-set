// ============================================================================
//  RETRO SET — the computer opponents: who they are, how they look and how they play
// ============================================================================
// No DOM here: this file also runs in Node, for the tests and tools/sim-bots.js. Each bot's rating is the target its
// settings were tuned to, by playing thousands of games: the top two against Stockfish at its calibrated strength
// settings (1500 and 1320), then each of the others 150 points below the bot above it. See HANDOVER.md, section 5,
// for the measured results.
const BOTS = (() => {
'use strict';

// The strength knob, from 0 (the engine's best at that depth) upwards: how readily the bot plays a middling move, as a
// temperature in centipawns (at k 1.4 it's above 1000, close to random). tools/sim-bots.js tunes k.
const knob = k => ({ temp: Math.round(5 + 595 * Math.pow(k, 1.5)) });
// look: the pixel portrait (game.js draws it: sprite style, skin, hair, shirt). cfg: see think() in core.js. depth, qs
// and blunder (the chance, each move, of a real blunder: a move losing a piece or more) are chosen by hand, falling as
// the bots get stronger but never zero; k is found by tools/sim-bots.js. style: bonuses (centipawns) for the moves the
// bot likes.
const LIST = [
  { id: 'torben', name: 'Torben', rating: 100, look: { s: 'cap', skin: '#f6d2b4', hair: '#d9a441', shirt: '#6cb8ff' },
    blurb: 'Beginner. Knows the moves; frequently leaves pieces undefended.', cfg: { depth: 1, qs: true, blunder: 0.30, k: 0.279 } },
  { id: 'alfie', name: 'Alfie', rating: 250, look: { s: 'man', skin: '#f2c49b', hair: '#b5432a', shirt: '#1d8a74' },
    blurb: 'Novice. Advances pawns at the expense of development.', cfg: { depth: 1, qs: true, blunder: 0.24, k: 0.248, style: { pawn: 30 } } },
  { id: 'ollie', name: 'Ollie', rating: 400, look: { s: 'glasses', skin: '#d9a07a', hair: '#1a1206', shirt: '#ff6f8f' },
    blurb: 'Novice. Accepts offered material without checking for traps.', cfg: { depth: 1, qs: true, blunder: 0.19, k: 0.237, style: { capture: 80 } } },
  { id: 'dom', name: 'Dom', rating: 550, look: { s: 'beard', skin: '#a8714a', hair: '#1a1206', shirt: '#ffc56b' },
    blurb: 'Aggressive. Develops the queen early and attacks.', cfg: { depth: 1, qs: true, blunder: 0.15, k: 0.157, style: { queen: 25 } } },
  { id: 'joseph', name: 'Joseph', rating: 700, look: { s: 'man', skin: '#6b4429', hair: '#1a1206', shirt: '#56399a' },
    blurb: 'Knows standard openings; loses direction in the middlegame.', cfg: { depth: 1, qs: true, blunder: 0.12, k: 0.111 } },
  { id: 'barney', name: 'Barney', rating: 850, look: { s: 'bald', skin: '#f2c49b', hair: '#c9c3bd', shirt: '#b04a7a' },
    blurb: 'Club level. Punishes undefended pieces.', cfg: { depth: 2, qs: true, blunder: 0.09, k: 0.133 } },
  { id: 'magnus', name: 'Magnus', rating: 1000, look: { s: 'long', skin: '#f6d2b4', hair: '#d9a441', shirt: '#f7ead2' },
    blurb: 'Positional. Castles early and waits for errors.', cfg: { depth: 2, qs: true, blunder: 0.07, k: 0.076, style: { castle: 40 } } },
  { id: 'jake', name: 'Jake', rating: 1150, look: { s: 'cap', skin: '#d9a07a', hair: '#5a3420', shirt: '#7a8b3a' },
    blurb: 'Consistent. Rarely blunders material; occasionally drifts.', cfg: { depth: 2, qs: true, blunder: 0.05, k: 0.062 } },
  { id: 'daws', name: 'Daws', rating: 1300, look: { s: 'glasses', skin: '#f2c49b', hair: '#5a3420', shirt: '#1d8a74' },
    blurb: 'Tactical. Prioritises checks and captures.', cfg: { depth: 3, qs: true, blunder: 0.04, k: 0.062, style: { check: 25 } } },
  { id: 'ted', name: 'Ted', rating: 1500, look: { s: 'beard', skin: '#f6d2b4', hair: '#c9c3bd', shirt: '#56399a' },
    blurb: 'The strongest opponent. Concedes very little.', cfg: { depth: 4, qs: true, blunder: 0.03, k: 0.046 } },
];
// the bots before they were renamed (a saved game or menu choice carries on against the nearest new one)
const RENAMED = { pip: 'torben', mabel: 'alfie', dev: 'dom', priya: 'joseph', gus: 'barney', ruth: 'jake', tariq: 'daws', nell: 'ted' };
// a bot's full settings for think(): its own, with the knob turned into a temperature
const settings = (bot, k = bot.cfg.k) => ({ ...bot.cfg, ...knob(k) });
const byId = id => LIST.find(b => b.id === (RENAMED[id] || id));

return { LIST, knob, settings, byId };
})();
if (typeof module !== 'undefined') module.exports = BOTS;
