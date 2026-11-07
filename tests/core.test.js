// Tests of src/core.js (the chess rules), and a check that the context packs match the code and notes.
// Run with:  node tests/core.test.js   (no installs needed)
const assert = require('assert');
const fs = require('fs'), path = require('path');
const C = require('../src/core.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
// plays moves given as e2e4 and so on, failing on any that isn't legal
const moves = (list, g = C.newGame()) => { for (const s of list.split(' ')) { const n = C.playUci(g, s); assert.ok(n, `${s} should be legal after ${g.list.map(x => x.san).join(' ') || 'the start'}`); g = n; } return g; };
const sans = g => g.list.map(x => x.san).join(' ');
const legal = fen => C.legalMoves(C.parseFen(fen)).map(C.uci).sort();

console.log('\nPositions');
test('core.js runs in Node without a browser', () => assert.strictEqual(typeof C.legalMoves, 'function'));
test('the starting position has the 32 pieces in their places, White to move', () => {
  const p = C.parseFen(C.START);
  assert.strictEqual(p.b.filter(Boolean).length, 32);
  assert.strictEqual(p.b[C.sq('e1')], 'K'); assert.strictEqual(p.b[C.sq('d8')], 'q'); assert.strictEqual(p.b[C.sq('a1')], 'R');
  assert.strictEqual(p.turn, 'w'); assert.strictEqual(p.castle, 'KQkq');
});
test('FEN reads and writes back unchanged', () => {
  for (const f of [C.START, 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', '8/8/8/3pP3/8/8/8/4K2k w - d6 0 3'])
    assert.strictEqual(C.toFen(C.parseFen(f)), f);
});
test('a broken FEN is refused', () => {
  for (const f of ['', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1', 'rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', '8/8/8/8/8/8/8/8 w - - 0 1', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1'])
    assert.throws(() => C.parseFen(f), `"${f}" was accepted`);
});

console.log('\nMove generation (perft: positions after n moves, against the published counts)');
const PERFT = [
  ['the starting position', C.START, [20, 400, 8902, 197281]],
  ['"Kiwipete": castling, pins, en passant', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['an endgame with en passant and checks along the rank', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['promotions and castling out of check', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['a promotion with a capture, and a discovered check', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
];
for (const [name, fen, counts] of PERFT) test(name, () => {
  const p = C.parseFen(fen);
  assert.deepStrictEqual(counts.map((_, i) => C.perft(p, i + 1)), counts);
});

console.log('\nSpecial moves');
test('castling both ways, and the rook moves with the king', () => {
  const g = moves('e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 e1g1');
  assert.strictEqual(g.pos.b[C.sq('g1')], 'K'); assert.strictEqual(g.pos.b[C.sq('f1')], 'R'); assert.strictEqual(g.pos.b[C.sq('h1')], '');
  assert.strictEqual(g.pos.castle, 'kq');
  const q = moves('d2d4 d7d5 b1c3 b8c6 c1f4 c8f5 d1d2 d8d7 e1c1');
  assert.strictEqual(q.pos.b[C.sq('c1')], 'K'); assert.strictEqual(q.pos.b[C.sq('d1')], 'R'); assert.strictEqual(q.list[8].san, 'O-O-O');
});
test('no castling out of, through or into check, or after the king or rook has moved', () => {
  // the black bishop on c4 covers f1, so White can't castle king's side
  assert.ok(!legal('4k3/8/8/8/2b5/8/8/4K2R w K - 0 1').includes('e1g1'));
  assert.ok(!legal('4k3/8/8/8/8/8/8/R3K2r w Q - 0 1').includes('e1c1'), 'castled out of check');
  assert.ok(legal('1r2k3/8/8/8/8/8/8/R3K3 w Q - 0 1').includes('e1c1'), 'a rook covering b1 stopped queen\'s side castling (the king never crosses b1)');
  const g = moves('e2e4 e7e5 e1e2 e8e7 e2e1 e7e8');
  assert.strictEqual(g.pos.castle, '');
  const r = moves('h2h4 a7a5 h1h3 a8a6');
  assert.strictEqual(r.pos.castle, 'Qk');
});
test('taking a rook on its home square takes away that castling right', () => {
  const g = moves('b2b3 g7g5 c1b2 g5g4 b2h8');
  assert.strictEqual(g.pos.castle, 'KQq');
});
test('en passant: only straight after the two-square move', () => {
  const g = moves('e2e4 a7a6 e4e5 d7d5');
  assert.strictEqual(C.toFen(g.pos).split(' ')[3], 'd6');
  const ep = moves('e5d6', g);
  assert.strictEqual(ep.pos.b[C.sq('d5')], ''); assert.strictEqual(ep.list[4].san, 'exd6');
  assert.ok(!C.playUci(moves('h2h3 h7h6', g), 'e5d6'), 'en passant was still allowed a move later');
});
test('en passant is refused when it would leave the king in check', () => {
  // after d7-d5, exd6 would open the fifth rank to the rook on h5
  assert.ok(!legal('8/8/8/K2pP2r/8/8/8/7k w - d6 0 1').includes('e5d6'));
});
test('promotion to any piece, and the move needs the choice', () => {
  const fen = '8/4P3/8/8/8/8/k7/4K3 w - - 0 1';
  assert.deepStrictEqual(legal(fen).filter(m => m.startsWith('e7e8')), ['e7e8b', 'e7e8n', 'e7e8q', 'e7e8r']);
  const g = C.newGame(fen);
  assert.strictEqual(C.play(g, { from: C.sq('e7'), to: C.sq('e8') }), null, 'a promotion was played without a choice');
  const n = C.play(g, { from: C.sq('e7'), to: C.sq('e8'), promo: 'n' });
  assert.strictEqual(n.pos.b[C.sq('e8')], 'N'); assert.strictEqual(n.list[0].san, 'e8=N');
  assert.strictEqual(C.playUci(C.newGame('4k3/8/8/8/8/8/3p4/6K1 b - - 0 1'), 'd2d1q').list[0].san, 'd1=Q+');
});
test('a pinned piece can\'t move off the line of the pin', () => {
  const ms = legal('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1');
  assert.ok(!ms.some(m => m.startsWith('e2')), 'the pinned bishop moved');
});

console.log('\nEnd of the game');
test('checkmate: the fool\'s mate', () => {
  const g = moves('f2f3 e7e5 g2g4 d8h4');
  assert.strictEqual(sans(g), 'f3 e5 g4 Qh4#');
  assert.deepStrictEqual(g.result, { score: '0-1', why: 'checkmate' });
  assert.strictEqual(C.playUci(g, 'a2a3'), null, 'a move was played after the game ended');
});
test('stalemate', () => {
  const g = moves('b1b6', C.newGame('k7/8/8/2K5/8/8/8/1Q6 w - - 0 1'));
  assert.deepStrictEqual(g.result, { score: '1/2-1/2', why: 'stalemate' }, 'expected stalemate after Qb6');
});
test('a third repetition is a draw', () => {
  const g = moves('g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1');
  assert.strictEqual(g.result, null, 'drawn too soon');
  assert.deepStrictEqual(moves('f6g8', g).result, { score: '1/2-1/2', why: 'repetition' });
});
test('fifty moves each without a capture or a pawn move is a draw', () => {
  const g = C.newGame('4k3/8/8/8/8/8/8/R3K3 w - - 99 80');
  assert.deepStrictEqual(moves('a1a2', g).result, { score: '1/2-1/2', why: 'fifty' });
  assert.strictEqual(moves('e1d1', C.newGame('4k3/8/8/8/8/8/8/R3K3 w - - 98 80')).result, null);
});
test('mate on the fiftieth move still counts as mate', () => {
  const g = moves('h1h8', C.newGame('4k3/R7/4K3/8/8/8/8/7R w - - 99 80'));
  assert.strictEqual(g.result.why, 'checkmate');
});
test('too few pieces to mate is a draw', () => {
  for (const f of ['4k3/8/8/8/8/8/8/4K3 w - - 0 1', '4k3/8/8/8/8/8/8/2B1K3 w - - 0 1', '4k3/8/8/8/8/8/8/1N2K3 w - - 0 1', '2b1k3/8/8/8/8/8/8/4KB2 w - - 0 1'])
    assert.deepStrictEqual(C.newGame(f).result, { score: '1/2-1/2', why: 'material' }, f);
  for (const f of ['1b2k3/8/8/8/8/8/8/4KB2 w - - 0 1', '4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1', '4k3/8/8/8/8/8/P7/4K3 w - - 0 1'])
    assert.strictEqual(C.newGame(f).result, null, f + ' was called a draw');
  assert.strictEqual(moves('e1d1', C.newGame('4k3/8/8/8/8/8/8/3rK3 w - - 0 1')).result.why, 'material', 'taking the last piece didn\'t draw');
});
test('resigning and agreeing a draw', () => {
  const g = moves('e2e4');
  assert.deepStrictEqual(C.finish(g, '1-0', 'resigned').result, { score: '1-0', why: 'resigned' });
  assert.deepStrictEqual(C.finish(g, '1/2-1/2', 'agreed').result, { score: '1/2-1/2', why: 'agreed' });
});
test('taking a move back', () => {
  const g = moves('e2e4 e7e5 g1f3');
  const u = C.undo(g);
  assert.strictEqual(sans(u), 'e4 e5'); assert.strictEqual(u.pos.turn, 'w'); assert.strictEqual(u.keys.length, 3);
  assert.strictEqual(C.toFen(C.undo(C.undo(u)).pos), C.START);
  const m = C.undo(moves('f2f3 e7e5 g2g4 d8h4'));
  assert.strictEqual(m.result, null, 'the mate wasn\'t taken back');
});

console.log('\nNotation');
test('moves are written as in a score sheet', () => {
  assert.strictEqual(sans(moves('e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3 c8f5 f1c4 e7e6 e1g1')), 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 Bf5 Bc4 e6 O-O');
});
test('two pieces that could reach the same square are told apart', () => {
  // knights on b1 and f3 can both go to d2: by file; rooks on a1 and a5 can both go to a3: by rank
  const n = C.newGame('4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1');
  assert.strictEqual(C.play(n, { from: C.sq('b1'), to: C.sq('d2') }).list[0].san, 'Nbd2');
  const r = C.newGame('4k3/8/8/R7/8/8/8/R3K3 w - - 0 1');
  assert.strictEqual(C.play(r, { from: C.sq('a5'), to: C.sq('a3') }).list[0].san, 'R5a3');
  // queens on d1, f1 and d3 can all reach e2: by square
  const q = C.newGame('7k/8/8/8/8/3Q4/8/3Q1QK1 w - - 0 1');
  assert.strictEqual(C.play(q, { from: C.sq('d1'), to: C.sq('e2') }).list[0].san, 'Qd1e2');
});
test('a game saved as e2e4-style moves plays back the same', () => {
  const g = moves('e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6');
  const saved = g.list.map(x => C.uci(x.m)).join(' ');
  assert.strictEqual(C.toFen(moves(saved).pos), C.toFen(g.pos));
});

console.log('\nNotes');
test('CONTEXT.md and CONTEXT-SHORT.md are up to date (if not, run node tools/build.js)', () => {
  const made = require('../tools/make-context.js').make();
  for (const [f, text] of Object.entries(made)) {
    const p = path.join(__dirname, '..', f);
    assert.ok(fs.existsSync(p), `${f} is missing`);
    assert.ok(fs.readFileSync(p, 'utf8') === text, `${f} is out of date`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
