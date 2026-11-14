// Tests of the cosmetics (src/looks.js): the catalogue, cases and keys, opening, duplicates, the Super Lucky Box, what a
// game and a day pay, the saved locker, and the pace (tools/sim-shop.js). Run with:  node tests/looks.test.js
const assert = require('assert');
const C = require('../src/core.js'), L = require('../src/looks.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
// a locker with n of every case and key, to open things with
const stocked = (n = 500) => { const l = L.fresh(); for (const g of L.GRADE_IDS) l.cases[g] = n; for (const k of L.KEY_IDS) l.keys[k] = n; return l; };

console.log('\nThe catalogue');
test('70 looks in seven slots, the first of each free, every name and key its own', () => {
  assert.strictEqual(L.ITEMS.length, 70);
  assert.deepStrictEqual(L.SLOTS.map(s => L.slotItems(s.id).length), [7, 16, 12, 6, 8, 12, 9]);
  assert.strictEqual(new Set(L.ITEMS.map(it => it.key)).size, 70);
  for (const s of L.SLOTS) { const its = L.slotItems(s.id); assert.ok(its[0].free && its.slice(1).every(it => !it.free), s.id); assert.strictEqual(new Set(its.map(it => it.name)).size, its.length, s.id + ' has two looks with one name'); }
  assert.strictEqual(L.FREE.length, 7);
});
test('five rarities, and every slot has something at three of them or more', () => {
  assert.deepStrictEqual(L.RARITIES, ['common', 'rare', 'epic', 'legendary', 'mythic']);
  for (const it of L.ITEMS) assert.ok(L.RARITY[it.rarity], it.key);
  for (const s of L.SLOTS) assert.ok(new Set(L.slotItems(s.id).filter(it => !it.free).map(it => it.rarity)).size >= 3, s.id);
  for (let i = 1; i < 5; i++) assert.ok(L.RARITY[L.RARITIES[i]].dupe > L.RARITY[L.RARITIES[i - 1]].dupe, 'a rarer duplicate pays more');
});
test('the piece sets are the ones sets.js makes', () => {
  assert.deepStrictEqual(L.slotItems('set').map(it => it.id).sort(), ['blocks', 'carved', 'classic', 'figures', 'minimal', 'ornate', 'scifi']);
});

console.log('\nCases and keys');
test('five cases, each one\'s odds adding up to 100 and better than the one before; the Super Lucky Box on top', () => {
  assert.deepStrictEqual(L.GRADE_IDS, ['bronze', 'silver', 'gold', 'diamond', 'lucky']);
  let last = -1, price = 0;
  for (const g of L.GRADE_IDS) {
    const o = L.GRADES[g].odds; assert.ok(Math.abs(o.reduce((a, b) => a + b, 0) - 100) < 1e-9, g);
    const good = o[2] + o[3] + o[4]; assert.ok(good > last, g + ' is no better than the case below'); last = good;
    assert.ok(L.GRADES[g].price > price, g); price = L.GRADES[g].price;
  }
  assert.strictEqual(L.GRADES.lucky.name, 'Super Lucky Box'); assert.ok(L.GRADES.lucky.fresh && !L.GRADES.diamond.fresh);
});
test('a standard key and one for each slot, the slot keys dearer', () => {
  assert.deepStrictEqual(L.KEY_IDS, ['any', ...L.SLOTS.map(s => s.id)]);
  for (const s of L.SLOTS) { assert.strictEqual(L.KEYS[s.id].slot, s.id); assert.ok(L.KEYS[s.id].price > L.KEYS.any.price); }
});
test('a case needs a key, and a key a case; opening takes one of each', () => {
  const l = L.fresh(); l.cases.silver = 0;
  assert.strictEqual(L.open(l, 'silver', 'any', C.rng(1)).why, 'case');
  l.cases.silver = 1; l.keys.any = 0;
  assert.strictEqual(L.open(l, 'silver', 'any', C.rng(1)).why, 'key');
  l.keys.any = 1;
  const r = L.open(l, 'silver', 'any', C.rng(1));
  assert.ok(r.item && !r.dupe && L.owns(l, r.item.key) && l.cases.silver === 0 && l.keys.any === 0 && l.opened === 1);
  assert.strictEqual(L.open(l, 'nope', 'any', C.rng(1)).why, 'unknown');
});
test('a slot\'s key always gives a look for that slot, whatever the case', () => {
  for (const s of L.SLOTS) for (const g of L.GRADE_IDS) {
    const l = stocked(), rnd = C.rng(7);
    for (let i = 0; i < 4; i++) { const r = L.open(l, g, s.id, rnd); assert.ok(r.item && r.item.slot === s.id, `${g} with the ${s.id} key gave ${r.item && r.item.key}`); }
  }
});
test('a Super Lucky Box with a key for a slot that is complete gives a new look from another slot', () => {
  const l = stocked(), rnd = C.rng(7);
  for (const it of L.slotItems('room')) l.owned[it.key] = 1;
  const r = L.open(l, 'lucky', 'room', rnd);
  assert.ok(r.item && r.item.slot !== 'room' && !r.dupe);
});
test('the rarities come out as the case says (a bronze case, 4,000 opened afresh)', () => {
  const n = { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 }, rnd = C.rng(3);
  for (let i = 0; i < 4000; i++) { const l = stocked(1); l.pity = 0; n[L.open(l, 'bronze', 'any', rnd).item.rarity]++; }
  L.RARITIES.forEach((r, i) => { const want = L.GRADES.bronze.odds[i] * 40; assert.ok(Math.abs(n[r] - want) < 5 * Math.sqrt(want) + 8, `${r}: ${n[r]} of 4000, expected about ${Math.round(want)}`); });
});
test('an epic or better is certain within six cases', () => {
  const l = stocked(), rnd = C.rng(11); let gap = 0, worst = 0;
  for (let i = 0; i < 300; i++) { const r = L.open(l, 'bronze', 'any', rnd); if (L.RARITIES.indexOf(r.item.rarity) >= 2) gap = 0; else worst = Math.max(worst, ++gap); }
  assert.ok(worst < L.PITY, `${worst} cases in a row without one`);
});
test('a duplicate pays coins by its rarity and stays in the locker, counted', () => {
  const l = stocked(), rnd = C.rng(5); let dupes = 0;
  for (let i = 0; i < 200; i++) {
    const before = l.coins, r = L.open(l, 'bronze', 'any', rnd);
    if (r.dupe) { dupes++; assert.strictEqual(l.coins - before, L.RARITY[r.item.rarity].dupe); assert.ok(L.count(l, r.item.key) >= 2); }
    else assert.strictEqual(l.coins, before);
  }
  assert.ok(dupes > 20, 'only ' + dupes + ' duplicates in 200 bronze cases');
});
test('looks you own come up less often than ones you don\'t', () => {
  const rnd = C.rng(9); let own = 0;
  for (let i = 0; i < 2000; i++) { const l = stocked(1); l.owned['finish:wood'] = 1; l.owned['finish:chalk'] = 1; const r = L.open(l, 'bronze', 'finish', rnd); if (r.dupe) own++; }
  // two of the four common finishes owned: an even draw would repeat one about 31% of the time (62% common, half of them)
  assert.ok(own > 100 && own < 400, own + ' of 2000');
});
test('a rarity with nothing left to win gives way to the next one that has', () => {
  const l = stocked(), rnd = C.rng(13);
  for (const it of L.ITEMS) if (it.rarity === 'common' || it.rarity === 'rare') l.owned[it.key] = 1;
  for (let i = 0; i < 40; i++) { const r = L.open(l, 'bronze', 'any', rnd); if (!r.dupe) assert.ok(L.RARITIES.indexOf(r.item.rarity) >= 2, r.item.key); }
  assert.ok(L.progress(l).have > 52, 'the commons and rares were all in hand, so every case should have gone to something new');
});
test('the Super Lucky Box never gives a duplicate, and pays coins once there is nothing left', () => {
  const l = stocked(), rnd = C.rng(17); let n = 0;
  while (L.progress(l).have < 70) { const r = L.open(l, 'lucky', n % 2 ? 'any' : 'avatar', rnd); assert.ok(r.item && !r.dupe, 'a duplicate from a Super Lucky Box'); n++; }
  assert.strictEqual(n, 63);
  const coins = l.coins, r = L.open(l, 'lucky', 'any', rnd);
  assert.ok(r.item === null && l.coins === coins + L.LUCKY_FULL);
});
test('buying: a case or a key costs its price, and not without the coins', () => {
  const l = L.fresh(); l.coins = L.GRADES.gold.price + L.KEYS.board.price;
  assert.strictEqual(L.buyCase(l, 'gold'), ''); assert.strictEqual(L.buyKey(l, 'board'), '');
  assert.ok(l.coins === 0 && l.cases.gold === 1 && l.keys.board === 1);
  assert.strictEqual(L.buyCase(l, 'bronze'), 'coins'); assert.strictEqual(L.buyKey(l, 'any'), 'coins'); assert.strictEqual(L.buyKey(l, 'x'), 'unknown');
});

console.log('\nEarning');
test('a win pays more the stronger the bot and drops three cases of its grade; a draw a quarter and no case; a loss nothing', () => {
  const l = L.fresh(); l.beaten = ['torben', 'barney', 'ted'];
  const a = L.gameOver(l, { id: 'torben', rating: 100 }, 'win'), b = L.gameOver(l, { id: 'barney', rating: 850 }, 'win'), c = L.gameOver(l, { id: 'ted', rating: 1500, top: true }, 'win');
  assert.ok(a.coins < b.coins && b.coins < c.coins);
  assert.deepStrictEqual([a.cases, b.cases, c.cases], [['bronze', 'bronze', 'bronze'], ['silver', 'silver', 'silver'], ['diamond', 'diamond', 'diamond']]);
  const d = L.gameOver(l, { id: 'ted', rating: 1500, top: true }, 'draw'), e = L.gameOver(l, { id: 'ted', rating: 1500, top: true }, 'loss');
  assert.ok(d.coins === Math.round(c.coins / 4) && !d.cases.length && e.coins === 0 && !e.cases.length);
});
test('a bot rated below zero (the easiest measure there) pays what a bot rated 0 does, never less', () => {
  const l = L.fresh(); l.beaten = ['torben', 'barney'];
  const a = L.gameOver(l, { id: 'torben', rating: -500 }, 'win'), b = L.gameOver(l, { id: 'barney', rating: 0 }, 'win');
  assert.ok(a.coins === 60 && b.coins === 60 && L.winCoins(100) === 80, a.coins + ', ' + b.coins);
  assert.deepStrictEqual(a.cases, ['bronze', 'bronze', 'bronze']);
});
test('the first win against a bot brings one more, better case: a Super Lucky Box for the three strongest', () => {
  const l = L.fresh();
  const a = L.gameOver(l, { id: 'torben', rating: 100 }, 'win'), b = L.gameOver(l, { id: 'torben', rating: 100 }, 'win'), c = L.gameOver(l, { id: 'jake', rating: 1150, top: true }, 'win');
  assert.deepStrictEqual(a.cases, ['bronze', 'bronze', 'bronze', 'silver']); assert.ok(a.first && !b.first); assert.deepStrictEqual(b.cases, ['bronze', 'bronze', 'bronze']);
  assert.deepStrictEqual(c.cases, ['gold', 'gold', 'gold', 'lucky']);
  assert.ok(l.cases.bronze === 6 && l.cases.silver === 2 && l.cases.gold === 3 && l.cases.lucky === 1);   // a new locker starts with one silver case
});
test('the day\'s gift comes once a day, grows over days running, and the seventh brings a Super Lucky Box', () => {
  const l = L.fresh(); let day = '2026-02-26'; const got = [];
  for (let i = 0; i < 8; i++) { const g = L.daily(l, day); got.push(g); assert.strictEqual(L.daily(l, day), null, 'twice in one day'); day = L.nextDay(day); }
  assert.deepStrictEqual(got.map(g => g.streak), [1, 2, 3, 4, 5, 6, 7, 1]);
  assert.deepStrictEqual(got.map(g => g.coins), [...L.DAILY, L.DAILY[0]]);
  assert.deepStrictEqual(got.map(g => g.lucky), [false, false, false, false, false, false, true, false]);
  assert.strictEqual(l.cases.lucky, 1);
  assert.strictEqual(L.nextDay('2026-02-28'), '2026-03-01');
  const m = L.fresh(); L.daily(m, '2026-03-01'); L.daily(m, '2026-03-02');
  assert.strictEqual(L.daily(m, '2026-03-05').streak, 1, 'a missed day starts the week again');
});

console.log('\nThe locker');
test('a new locker: the seven free looks, worn, and the starter kit', () => {
  const l = L.fresh();
  assert.deepStrictEqual(Object.keys(l.owned).sort(), [...L.FREE].sort());
  assert.deepStrictEqual(l.wear, { set: 'classic', finish: 'classic', board: 'standard', room: 'parlour', fx: 'none', avatar: 'plain', marks: 'standard' });
  assert.ok(l.coins === L.START.coins && l.cases.silver === 1 && l.keys.any === 1 && L.progress(l).have === 7);
});
test('wearing: only what is owned', () => {
  const l = L.fresh();
  assert.ok(!L.wear(l, 'set:figures') && l.wear.set === 'classic');
  l.owned['set:figures'] = 1;
  assert.ok(L.wear(l, 'set:figures') && l.wear.set === 'figures' && !L.wear(l, 'set:nope'));
});
test('a saved locker comes back as it was; rubbish comes back as a new one', () => {
  const l = stocked(3), rnd = C.rng(21);
  for (let i = 0; i < 12; i++) L.open(l, 'gold', 'any', rnd);
  L.gameOver(l, { id: 'dom', rating: 550 }, 'win'); L.daily(l, '2026-06-15'); L.wear(l, Object.keys(l.owned).find(k => !L.ALL[k].free));
  assert.deepStrictEqual(L.validate(JSON.parse(JSON.stringify(l))), l);
  for (const bad of [null, 7, 'x', [], { coins: -5, owned: { 'set:figures': 'lots', 'made:up': 3 }, wear: { set: 'figures', board: 9 }, cases: { gold: 1e99 }, daily: { last: 'yesterday' }, beaten: 'all' }]) {
    const v = L.validate(bad);
    assert.ok(v.coins >= 0 && L.FREE.every(k => L.owns(v, k)) && !('made:up' in v.owned) && v.wear.set === 'classic' && v.wear.board === 'standard' && v.daily.last === '' && Array.isArray(v.beaten));
  }
});
test('the test locker has everything', () => { const l = L.full(); assert.strictEqual(L.progress(l).have, 70); assert.ok(L.wear(l, 'room:space')); });

console.log('\nTrading');
test('an offer is cleaned of anything that isn\'t real: free looks, made-up things, fractions and minus numbers', () => {
  const o = L.cleanOffer({ items: { 'set:classic': 1, 'set:blocks': 2.9, 'made:up': 3, 'board:ocean': -1 }, cases: { gold: '2', tin: 5 }, keys: { any: 1, nope: 1 }, coins: -50 });
  assert.deepStrictEqual(o, { items: { 'set:blocks': 2 }, cases: { gold: 2 }, keys: { any: 1 }, coins: 0 });
  for (const bad of [null, 7, 'x', []]) assert.ok(L.offerEmpty(L.cleanOffer(bad)));
  assert.ok(!L.offerEmpty(L.cleanOffer({ coins: 1 })));
});
test('an offer reads the same however it was put together', () => {
  const a = L.cleanOffer({ items: { 'fx:dust': 1, 'board:ocean': 2 }, keys: { any: 1 }, coins: 30 }), b = L.cleanOffer({ coins: 30, keys: { any: 1 }, items: { 'board:ocean': 2, 'fx:dust': 1 } });
  assert.strictEqual(L.offerKey(a), L.offerKey(b));
  assert.notStrictEqual(L.offerKey(a), L.offerKey(L.cleanOffer({ items: { 'fx:dust': 1, 'board:ocean': 2 }, keys: { any: 1 }, coins: 31 })));
});
test('what the other player is shown: the looks, cases and keys that could be traded, never the coins or the free looks', () => {
  const l = L.fresh(); l.owned['room:park'] = 2; l.coins = 999;
  assert.deepStrictEqual(L.inventory(l), { items: { 'room:park': 2 }, cases: { silver: 1 }, keys: { any: 1 }, coins: 0 });
});
test('a trade swaps looks, cases, keys and coins, and both lockers end up with what the other gave', () => {
  const a = L.fresh(), b = L.fresh();
  Object.assign(a.owned, { 'set:blocks': 1, 'board:ocean': 3 }); a.cases.gold = 2; a.coins = 500;
  Object.assign(b.owned, { 'finish:neon': 1 }); b.keys.room = 1; b.coins = 40;
  const fromA = L.cleanOffer({ items: { 'set:blocks': 1, 'board:ocean': 2 }, cases: { gold: 1 }, coins: 120 }), fromB = L.cleanOffer({ items: { 'finish:neon': 1 }, keys: { room: 1 } });
  assert.ok(L.canGive(a, fromA) && L.canGive(b, fromB));
  assert.ok(L.trade(a, fromA, fromB) && L.trade(b, fromB, fromA));
  assert.ok(!L.owns(a, 'set:blocks') && L.count(a, 'board:ocean') === 1 && a.cases.gold === 1 && a.coins === 380 && L.owns(a, 'finish:neon') && a.keys.room === 1);
  assert.ok(L.owns(b, 'set:blocks') && L.count(b, 'board:ocean') === 2 && b.cases.gold === 1 && b.coins === 160 && !L.owns(b, 'finish:neon') && b.keys.room === 0);
  assert.deepStrictEqual(L.validate(JSON.parse(JSON.stringify(a))), a);
});
test('a look traded away to the last copy comes off; with a copy to spare it stays on', () => {
  const l = L.fresh(); Object.assign(l.owned, { 'set:blocks': 1, 'board:ocean': 2 }); L.wear(l, 'set:blocks'); L.wear(l, 'board:ocean');
  assert.ok(L.trade(l, L.cleanOffer({ items: { 'set:blocks': 1, 'board:ocean': 1 } }), L.noOffer()));
  assert.ok(l.wear.set === 'classic' && l.wear.board === 'ocean');
});
test('a trade for more than the locker holds is refused, and nothing changes', () => {
  const l = L.fresh(); l.owned['fx:dust'] = 1; const before = JSON.stringify(l);
  for (const o of [{ items: { 'fx:dust': 2 } }, { items: { 'fx:sparks': 1 } }, { coins: l.coins + 1 }, { cases: { lucky: 1 } }, { keys: { board: 1 } }]) assert.strictEqual(L.trade(l, L.cleanOffer(o), L.cleanOffer({ coins: 5 })), false);
  assert.strictEqual(JSON.stringify(l), before);
});

console.log('\nThe pace');
test('a regular player (3 or 4 wins a day) fills the locker in about two weeks', () => {
  const log = console.log; console.log = () => {}; process.argv[2] = '150';
  let m; try { m = require('../tools/sim-shop.js').median; } finally { console.log = log; }
  assert.ok(m >= 11 && m <= 17, `the middle player of 150 took ${m} days`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
