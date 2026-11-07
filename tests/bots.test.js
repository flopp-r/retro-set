// Tests of the computer player (the engine in src/core.js) and the bots (src/bots.js). Run with:  node tests/bots.test.js
// (no installs needed). Their strength is measured separately, by tools/sim-bots.js, because that takes thousands of games.
const assert = require('assert');
const C = require('../src/core.js'), BOTS = require('../src/bots.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const best = (fen, cfg) => { const g = C.newGame(fen); return C.san(g.pos, C.runThink(g, { temp: 1, blunder: 0, ...cfg }, C.rng(7))); };
// the same position seen from the other side: ranks flipped, colours swapped
const mirror = fen => { const [p, t, c, e] = fen.split(' '); const sw = s => s.replace(/[a-z]/gi, ch => ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase());
  return [sw(p.split('/').reverse().join('/')), t === 'w' ? 'b' : 'w', c === '-' ? '-' : [...sw(c)].sort().join(''), e === '-' ? '-' : e[0] + (9 - e[1]), 0, 1].join(' '); };

console.log('\nThe bots');
test('eight bots, 100 to 1500 in steps of 200, each with a name, a face, a line and settings', () => {
  assert.deepStrictEqual(BOTS.LIST.map(b => b.rating), [100, 300, 500, 700, 900, 1100, 1300, 1500]);
  assert.strictEqual(new Set(BOTS.LIST.map(b => b.id)).size, 8);
  for (const b of BOTS.LIST) {
    assert.ok(b.name && b.blurb && b.look && b.look.s && b.look.skin && b.look.hair && b.look.shirt, b.id + ' is missing something');
    assert.ok(b.cfg.depth >= 1 && b.cfg.depth <= 4 && b.cfg.k >= 0 && b.cfg.k <= 1.42, b.id + '\'s settings are out of range');
  }
});
test('stronger bots look at least as far ahead', () => {
  for (let i = 1; i < BOTS.LIST.length; i++) assert.ok(BOTS.LIST[i].cfg.depth >= BOTS.LIST[i - 1].cfg.depth, BOTS.LIST[i].id);
});
test('the knob: 0 is the engine\'s best, turning it up only ever makes mistakes likelier, and at the top every move is random', () => {
  assert.deepStrictEqual(BOTS.knob(0), { temp: 5, blunder: 0 });
  let last = BOTS.knob(0);
  for (let k = 0.05; k <= 1.42; k += 0.05) { const n = BOTS.knob(k); assert.ok(n.temp >= last.temp && n.blunder >= last.blunder, 'at ' + k); last = n; }
  assert.strictEqual(BOTS.knob(1.42).blunder, 1);
});

console.log('\nThe engine');
test('the starting position is level, and a position scores the same from either side', () => {
  assert.strictEqual(C.evaluate(C.parseFen(C.START)), 0);
  for (const f of ['r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', '4k3/8/4P3/8/8/8/8/4K3 w - - 0 1'])
    assert.strictEqual(C.evaluate(C.parseFen(f)), C.evaluate(C.parseFen(mirror(f))), f);
});
test('an extra queen counts for about a queen; a passed pawn near promotion counts for more than one at home', () => {
  const q = C.evaluate(C.parseFen('4k3/8/8/8/8/8/8/3QK3 w - - 0 1'));
  assert.ok(q > 850 && q < 1100, 'queen worth ' + q);
  assert.ok(C.evaluate(C.parseFen('4k3/8/4P3/8/8/8/8/4K3 w - - 0 1')) > C.evaluate(C.parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1')) + 60);
});
test('finds a mate in one (the back rank), looking one move ahead and further', () => {
  for (const depth of [1, 2, 3]) assert.strictEqual(best('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', { depth, qs: depth > 1 }), 'Ra8#', 'at depth ' + depth);
});
test('takes a queen left hanging', () => {
  assert.strictEqual(best('4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1', { depth: 1, qs: true }), 'Qxd5');
});
test('looking two moves ahead, saves its queen from a pawn', () => {
  const m = best('4k3/8/8/8/3q4/4P3/8/4K3 b - - 0 1', { depth: 2, qs: true });
  assert.ok(m.startsWith('Q') && m !== 'Qxe3', 'played ' + m);
});
test('following captures through, it doesn\'t take a defended pawn with its queen', () => {
  assert.notStrictEqual(best('4k3/8/2p5/3p4/8/8/3Q4/4K3 w - - 0 1', { depth: 1, qs: true }), 'Qxd5');
});
test('looking one move ahead without following captures, it does (why every bot follows captures: measured, that alone is weaker than 100)', () => {
  assert.strictEqual(best('4k3/8/2p5/3p4/8/8/3Q4/4K3 w - - 0 1', { depth: 1, qs: false }), 'Qxd5');
});
test('the same seed gives the same choice; different seeds vary a weak bot\'s moves', () => {
  const g = C.newGame(), cfg = BOTS.settings(BOTS.byId('mabel'));
  assert.strictEqual(C.uci(C.runThink(g, cfg, C.rng(42))), C.uci(C.runThink(g, cfg, C.rng(42))));
  const seen = new Set(); for (let s = 1; s <= 20; s++) seen.add(C.uci(C.runThink(g, cfg, C.rng(s))));
  assert.ok(seen.size >= 4, 'only ' + seen.size + ' different first moves in 20 games');
});
test('every bot plays a legal move, and the thinking can be spread out (it yields)', () => {
  const g = C.newGame('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
  for (const b of BOTS.LIST) {
    const it = C.think(g, BOTS.settings(b), C.rng(3)); let r, steps = 0;
    while (!(r = it.next()).done) steps++;
    assert.ok(C.play(g, r.value), b.id + ' played an illegal move');
    if (b.cfg.k < 1) assert.ok(steps > 0 || BOTS.settings(b).blunder > 0, b.id + ' never yielded');
  }
});
test('a whole game between two bots ends properly', () => {
  let g = C.newGame(); const rnd = C.rng(5), w = BOTS.settings(BOTS.byId('dev')), b = BOTS.settings(BOTS.byId('mabel'));
  while (!g.result && g.list.length < 300) g = C.play(g, C.runThink(g, g.pos.turn === 'w' ? w : b, rnd));
  assert.ok(g.list.length > 10);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
