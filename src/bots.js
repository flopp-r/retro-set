// ============================================================================
//  RETRO SET — the computer opponents: who they are, how they look and how they play
// ============================================================================
// No DOM here: this file also runs in Node, for the tests and tools/sim-bots.js. Each bot's rating is the target its
// settings were tuned to, by playing thousands of games: Ted and Daws against Stockfish at its calibrated strength
// settings (1500 and 1320), Jake 150 below Daws; the seven easy bots (the owner's choice, 14 November 2026) from
// Magnus, anchored to Torben as he was before (measured at 119), down in steps of 100, Torben near random. The
// weakest measure below zero. See HANDOVER.md, section 5, for the measured results.
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
  { id: 'torben', name: 'Torben', rating: -500, look: { s: 'cap', skin: '#f6d2b4', hair: '#d9a441', shirt: '#6cb8ff' },
    blurb: 'Absolute beginner. Moves almost at random.', cfg: { depth: 1, qs: true, blunder: 0.60, k: 0.505 } },
  { id: 'alfie', name: 'Alfie', rating: -400, look: { s: 'man', skin: '#f2c49b', hair: '#b5432a', shirt: '#1d8a74' },
    blurb: 'Beginner. Advances pawns and leaves pieces undefended.', cfg: { depth: 1, qs: true, blunder: 0.54, k: 0.43, style: { pawn: 30 } } },
  { id: 'ollie', name: 'Ollie', rating: -300, look: { s: 'glasses', skin: '#d9a07a', hair: '#1a1206', shirt: '#ff6f8f' },
    blurb: 'Beginner. Accepts offered material without checking for traps.', cfg: { depth: 1, qs: true, blunder: 0.48, k: 0.452, style: { capture: 80 } } },
  { id: 'dom', name: 'Dom', rating: -200, look: { s: 'beard', skin: '#a8714a', hair: '#1a1206', shirt: '#ffc56b' },
    blurb: 'Beginner. Brings the queen out early and attacks with it.', cfg: { depth: 1, qs: true, blunder: 0.43, k: 0.385, style: { queen: 25 } } },
  { id: 'joseph', name: 'Joseph', rating: -100, look: { s: 'man', skin: '#6b4429', hair: '#1a1206', shirt: '#56399a' },
    blurb: 'Beginner. Takes free pieces; misses most threats.', cfg: { depth: 1, qs: true, blunder: 0.38, k: 0.352 } },
  { id: 'barney', name: 'Barney', rating: 0, look: { s: 'bald', skin: '#f2c49b', hair: '#c9c3bd', shirt: '#b04a7a' },
    blurb: 'Improving beginner. Usually takes undefended pieces.', cfg: { depth: 1, qs: true, blunder: 0.34, k: 0.321 } },
  { id: 'magnus', name: 'Magnus', rating: 100, look: { s: 'long', skin: '#f6d2b4', hair: '#d9a441', shirt: '#f7ead2' },
    blurb: 'The strongest beginner. Castles early; still loses pieces.', cfg: { depth: 1, qs: true, blunder: 0.30, k: 0.296, style: { castle: 40 } } },
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
// a rating as the screen shows it: the weakest bots measure below zero, written with a true minus sign
const rated = r => r < 0 ? '\u2212' + -r : String(r);

return { LIST, knob, settings, byId, rated };
})();
if (typeof module !== 'undefined') module.exports = BOTS;
