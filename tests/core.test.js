// Tests of src/core.js, and a check that the context packs match the code and notes. Run with:  node tests/core.test.js
// (no installs needed). The chess rules tests (legal moves, check, mate, draws) go here as the rules are built.
const assert = require('assert');
const fs = require('fs'), path = require('path');
const C = require('../src/core.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

console.log('\nCore');
test('core.js runs in Node without a browser', () => {
  assert.strictEqual(typeof C, 'object');
});
test('the starting position has the 32 pieces in their places, White to move', () => {
  const [placement, turn, castling] = C.START.split(' ');
  const ranks = placement.split('/');
  assert.strictEqual(ranks.length, 8);
  for (const r of ranks) assert.strictEqual(r.replace(/\d/g, d => '.'.repeat(+d)).length, 8, `rank "${r}" isn't 8 squares`);
  assert.strictEqual(placement.replace(/[^a-zA-Z]/g, '').length, 32);
  assert.strictEqual(ranks[0], 'rnbqkbnr'); assert.strictEqual(ranks[7], 'RNBQKBNR');
  assert.strictEqual(turn, 'w'); assert.strictEqual(castling, 'KQkq');
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
