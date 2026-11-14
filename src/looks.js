// ============================================================================
//  RETRO SET — the cosmetics: what there is to own, the cases and keys, and the locker
// ============================================================================
// No DOM here: this file also runs in Node, for the tests and tools/sim-shop.js. It knows what each look is called,
// which slot it fills and how rare it is; what a look looks like is drawn elsewhere (sets.js, game.js), by its id.
// Nothing here uses Math.random: every draw takes a generator (CORE.rng), so a test or a measurement repeats exactly.
const LOOKS = (() => {
'use strict';

// ------------------------------------------------------------------ the catalogue
// The seven slots of the locker, in the order the overview shows them.
const SLOTS = [
  { id: 'set', name: 'Pieces' }, { id: 'finish', name: 'Finish' }, { id: 'board', name: 'Board' }, { id: 'room', name: 'Room' },
  { id: 'fx', name: 'Effects' }, { id: 'avatar', name: 'Avatar' }, { id: 'marks', name: 'Square marks' },
];
// Five rarities, as in Retro Rack: the colour, and the coins a duplicate pays (it stays in the locker as well).
const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY = {
  common: { name: 'Common', colour: '#b9c2cf', dupe: 15 }, rare: { name: 'Rare', colour: '#6cb8ff', dupe: 35 }, epic: { name: 'Epic', colour: '#c58cff', dupe: 80 },
  legendary: { name: 'Legendary', colour: '#ffc56b', dupe: 180 }, mythic: { name: 'Mythic', colour: '#ff6f8f', dupe: 400 },
};
// Every look: [id, name, rarity] by slot; the first of each slot is free (everyone owns it, and a new locker wears it).
// An id is unique within its slot only, so a look's full name is 'slot:id' (key()).
const BY_SLOT = {
  set: [['classic', 'Classic', 'free'], ['minimal', 'Minimal', 'common'], ['carved', 'Carved', 'rare'], ['blocks', 'Blocks', 'rare'], ['ornate', 'Ornate', 'epic'],
    ['scifi', 'Sci-fi', 'legendary'], ['figures', 'Figures', 'mythic']],
  finish: [['classic', 'Classic', 'free'], ['wood', 'Wood', 'common'], ['chalk', 'Chalk', 'common'], ['sea', 'Sea', 'common'], ['forest', 'Forest', 'common'],
    ['marble', 'Marble', 'rare'], ['metal', 'Metal', 'rare'], ['ember', 'Ember', 'rare'], ['candy', 'Candy', 'rare'],
    ['neon', 'Neon', 'epic'], ['ice', 'Ice', 'epic'], ['obsidian', 'Obsidian', 'epic'], ['royal', 'Royal', 'legendary'], ['circuit', 'Circuit', 'legendary'],
    ['rainbow', 'Rainbow', 'mythic'], ['molten', 'Molten', 'mythic']],
  board: [['standard', 'Standard', 'free'], ['tournament', 'Tournament', 'common'], ['walnut', 'Walnut', 'common'], ['slate', 'Slate', 'common'], ['ocean', 'Ocean', 'common'],
    ['rosewood', 'Rosewood', 'rare'], ['mint', 'Mint', 'rare'], ['sand', 'Sand', 'rare'], ['hall', 'Marble hall', 'epic'], ['grid', 'Neon grid', 'epic'],
    ['galaxy', 'Galaxy', 'legendary'], ['lava', 'Lava', 'mythic']],
  room: [['parlour', 'Parlour', 'free'], ['library', 'Library', 'rare'], ['cafe', 'Café', 'rare'], ['park', 'Park', 'epic'], ['arcade', 'Arcade', 'legendary'], ['space', 'Deep space', 'mythic']],
  fx: [['none', 'None', 'free'], ['dust', 'Dust', 'common'], ['sparks', 'Sparks', 'rare'], ['confetti', 'Confetti', 'rare'], ['shockwave', 'Shockwave', 'epic'],
    ['lightning', 'Lightning', 'epic'], ['fireworks', 'Fireworks', 'legendary'], ['blackhole', 'Black hole', 'mythic']],
  avatar: [['plain', 'Player', 'free'], ['curly', 'Curly', 'common'], ['cap', 'Cap', 'common'], ['specs', 'Specs', 'common'], ['beard', 'Beard', 'common'],
    ['beanie', 'Beanie', 'rare'], ['shades', 'Shades', 'rare'], ['headset', 'Headset', 'rare'], ['knight', 'Knight', 'epic'], ['jester', 'Jester', 'epic'],
    ['robot', 'Robot', 'legendary'], ['wizard', 'Wizard', 'mythic']],
  marks: [['standard', 'Standard', 'free'], ['mint', 'Mint', 'common'], ['rose', 'Rose', 'common'], ['mono', 'Mono', 'common'], ['corners', 'Corners', 'rare'],
    ['arrow', 'Arrow', 'rare'], ['pulse', 'Pulse', 'epic'], ['stars', 'Stars', 'epic'], ['flame', 'Flame', 'legendary']],
};
const key = (slot, id) => slot + ':' + id;
const ITEMS = [], ALL = {};
for (const s of SLOTS) for (const [id, name, rarity] of BY_SLOT[s.id]) { const it = { key: key(s.id, id), id, slot: s.id, name, rarity: rarity === 'free' ? 'common' : rarity, free: rarity === 'free' }; ITEMS.push(it); ALL[it.key] = it; }
const FREE = ITEMS.filter(it => it.free).map(it => it.key);
const slotItems = slot => ITEMS.filter(it => it.slot === slot);

// ------------------------------------------------------------------ cases and keys
// A case's grade sets the chance of each rarity (percent: common, rare, epic, legendary, mythic); its price is what the
// shop asks. The Super Lucky Box never gives a duplicate. Every case needs a key: the standard key opens it for any
// slot, a slot's own key guarantees a look for that slot. A key never changes the rarity.
const GRADES = {
  bronze: { name: 'Bronze Case', odds: [62, 28, 8, 1.6, 0.4], price: 40 },
  silver: { name: 'Silver Case', odds: [38, 38, 18, 5, 1], price: 90 },
  gold: { name: 'Gold Case', odds: [14, 36, 32, 14, 4], price: 200 },
  diamond: { name: 'Diamond Case', odds: [0, 20, 42, 28, 10], price: 420 },
  lucky: { name: 'Super Lucky Box', odds: [0, 6, 34, 38, 22], price: 1500, fresh: true },
};
const GRADE_IDS = Object.keys(GRADES);
const KEYS = { any: { name: 'Standard Key', price: 60 } };
for (const s of SLOTS) KEYS[s.id] = { name: s.name + ' Key', price: 110, slot: s.id };
const KEY_IDS = Object.keys(KEYS);
// OWNED_WEIGHT: how likely a look you own is to come up again, against one you don't (1 would be an even draw).
// PITY: an epic or better is certain within this many cases. LUCKY_FULL: a Super Lucky Box with nothing left to give.
const OWNED_WEIGHT = 0.3, PITY = 6, LUCKY_FULL = 1000;

// ------------------------------------------------------------------ earning
// A win against the computer pays coins by the bot's rating (60 for a bot rated 0 or below: the easiest measure below
// zero) and drops WIN_CASES cases (three, since a game of chess
// takes a while: the owner's choice), the grade by how strong the bot is; the first win against each bot brings one
// more case, one grade better (a Super Lucky Box for the three strongest). A draw
// pays a quarter and drops nothing. Opening the game on a new day pays a gift that grows over a week of days running;
// the seventh day in a row brings a Super Lucky Box, and the week starts again.
const winCoins = rating => 60 + Math.round(Math.max(0, rating) / 5), WIN_CASES = 3;
const gradeFor = rating => rating < 500 ? 'bronze' : rating < 950 ? 'silver' : rating < 1250 ? 'gold' : 'diamond';
const better = g => GRADE_IDS[Math.min(GRADE_IDS.indexOf(g) + 1, GRADE_IDS.indexOf('diamond'))];
const DAILY = [40, 50, 60, 70, 80, 90, 120];
const START = { coins: 250, cases: { silver: 1 }, keys: { any: 1 } };

// ------------------------------------------------------------------ the locker
// { v, coins, owned: { 'slot:id': how many }, cases: { grade: n }, keys: { key: n }, wear: { slot: id }, beaten: [bot
// ids], daily: { last: 'YYYY-MM-DD', streak }, pity, opened }. Every function below takes a locker and changes it in
// place, returning what happened; validate() makes a clean one from anything saved or sent.
const count = (l, k) => l.owned[k] || 0, owns = (l, k) => count(l, k) > 0;
function fresh() {
  const l = { v: 1, coins: START.coins, owned: {}, cases: {}, keys: {}, wear: {}, beaten: [], daily: { last: '', streak: 0 }, pity: 0, opened: 0 };
  for (const g of GRADE_IDS) l.cases[g] = START.cases[g] || 0;
  for (const k of KEY_IDS) l.keys[k] = START.keys[k] || 0;
  for (const k of FREE) { l.owned[k] = 1; l.wear[ALL[k].slot] = ALL[k].id; }
  return l;
}
const whole = (v, max = 1e9) => Number.isFinite(+v) ? Math.max(0, Math.min(max, Math.floor(+v))) : 0;
function validate(d) {
  const l = fresh();
  if (!d || typeof d !== 'object') return l;
  l.coins = whole(d.coins); l.pity = whole(d.pity, PITY); l.opened = whole(d.opened);
  for (const it of ITEMS) { const n = whole(d.owned && d.owned[it.key], 999); if (n || it.free) l.owned[it.key] = Math.max(n, it.free ? 1 : 0); }
  for (const g of GRADE_IDS) l.cases[g] = whole(d.cases && d.cases[g], 9999);
  for (const k of KEY_IDS) l.keys[k] = whole(d.keys && d.keys[k], 9999);
  for (const s of SLOTS) { const id = d.wear && d.wear[s.id]; if (typeof id === 'string' && owns(l, key(s.id, id))) l.wear[s.id] = id; }
  if (Array.isArray(d.beaten)) l.beaten = [...new Set(d.beaten.filter(x => typeof x === 'string' && x.length < 24))].slice(0, 64);
  if (d.daily && /^\d{4}-\d\d-\d\d$/.test(d.daily.last)) l.daily = { last: d.daily.last, streak: whole(d.daily.streak, 7) };
  return l;
}
// puts a look on, if it's owned
function wear(l, k) { const it = ALL[k]; if (!it || !owns(l, k)) return false; l.wear[it.slot] = it.id; return true; }
function buyCase(l, grade) { const g = GRADES[grade]; if (!g) return 'unknown'; if (l.coins < g.price) return 'coins'; l.coins -= g.price; l.cases[grade]++; return ''; }
function buyKey(l, id) { const k = KEYS[id]; if (!k) return 'unknown'; if (l.coins < k.price) return 'coins'; l.coins -= k.price; l.keys[id]++; return ''; }

// Opens a case with a key: { item, dupe, coins } (the look won, whether it was owned already, the coins paid for a
// duplicate), or { why } when it can't be opened. The rarity comes from the case's odds; a rarity with nothing left to
// win in the key's slot gives way to the nearest one that has (rarer first), so a full shelf of commons stops coming
// up; within the rarity, looks you own are less likely than ones you don't (never, for a Super Lucky Box).
function open(l, grade, keyId, rnd) {
  const g = GRADES[grade], k = KEYS[keyId];
  if (!g || !k) return { why: 'unknown' };
  if (!l.cases[grade]) return { why: 'case' };
  if (!l.keys[keyId]) return { why: 'key' };
  let pool = ITEMS.filter(it => !it.free && (!k.slot || it.slot === k.slot));
  if (g.fresh && !pool.some(it => !owns(l, it.key))) pool = ITEMS.filter(it => !it.free);   // that slot is complete: any slot
  l.cases[grade]--; l.keys[keyId]--; l.opened++;
  const left = r => pool.filter(it => it.rarity === r && !owns(l, it.key)).length, any = r => pool.some(it => it.rarity === r);
  if (g.fresh && !RARITIES.some(left)) { l.coins += LUCKY_FULL; return { item: null, dupe: false, coins: LUCKY_FULL }; }
  let x = rnd() * 100, ri = 0;
  while (ri < 4 && x >= g.odds[ri]) x -= g.odds[ri++];
  if (l.pity >= PITY - 1 && ri < 2) ri = 2;
  // the nearest rarity with something to win (or, failing that, something at all): rarer first, then commoner
  const order = [ri, ...[1, 2, 3, 4].flatMap(d => [ri + d, ri - d])].filter(i => i >= 0 && i < 5);
  const pick = order.find(i => left(RARITIES[i])) ?? order.find(i => any(RARITIES[i]));
  const rarity = RARITIES[pick];
  l.pity = pick >= 2 ? 0 : l.pity + 1;
  const cands = pool.filter(it => it.rarity === rarity && !(g.fresh && owns(l, it.key))), w = cands.map(it => owns(l, it.key) ? OWNED_WEIGHT : 1);
  let y = rnd() * w.reduce((a, b) => a + b, 0), i = 0;
  while (i < cands.length - 1 && y >= w[i]) y -= w[i++];
  const item = cands[i], dupe = owns(l, item.key), coins = dupe ? RARITY[item.rarity].dupe : 0;
  l.owned[item.key] = count(l, item.key) + 1; l.coins += coins;
  return { item, dupe, coins };
}

// The end of a game against the computer: bot is { id, rating, top } (top: one of the three strongest), result 'win',
// 'draw' or 'loss'. Returns { coins, cases: [grades] } and adds them.
function gameOver(l, bot, result) {
  const out = { coins: 0, cases: [] };
  if (result === 'draw') out.coins = Math.round(winCoins(bot.rating) / 4);
  if (result === 'win') {
    out.coins = winCoins(bot.rating); for (let i = 0; i < WIN_CASES; i++) out.cases.push(gradeFor(bot.rating));
    if (!l.beaten.includes(bot.id)) { l.beaten.push(bot.id); out.cases.push(bot.top ? 'lucky' : better(gradeFor(bot.rating))); out.first = true; }
  }
  l.coins += out.coins; for (const g of out.cases) l.cases[g]++;
  return out;
}
// The day's gift, once a local date (YYYY-MM-DD): { coins, streak, lucky }, or null if it's been had today.
const nextDay = d => { const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + 1)); return t.toISOString().slice(0, 10); };
function daily(l, day) {
  if (!/^\d{4}-\d\d-\d\d$/.test(day) || day === l.daily.last) return null;
  const streak = l.daily.last && nextDay(l.daily.last) === day && l.daily.streak < 7 ? l.daily.streak + 1 : 1;
  l.daily = { last: day, streak };
  const out = { coins: DAILY[streak - 1], streak, lucky: streak === 7 };
  l.coins += out.coins; if (out.lucky) l.cases.lucky++;
  return out;
}
// ------------------------------------------------------------------ trading
// An offer is what one player puts into a trade: { items: { 'slot:id': how many }, cases: { grade: n }, keys: { key: n },
// coins }. The free looks can't be traded: everyone has them. cleanOffer() makes a safe offer of anything (what the
// other player sent, say): only things that exist, in whole numbers.
const noOffer = () => ({ items: {}, cases: {}, keys: {}, coins: 0 });
function cleanOffer(o) {
  const out = noOffer();
  if (!o || typeof o !== 'object') return out;
  for (const it of ITEMS) { const n = whole(o.items && o.items[it.key], 999); if (n && !it.free) out.items[it.key] = n; }
  for (const g of GRADE_IDS) { const n = whole(o.cases && o.cases[g], 9999); if (n) out.cases[g] = n; }
  for (const k of KEY_IDS) { const n = whole(o.keys && o.keys[k], 9999); if (n) out.keys[k] = n; }
  out.coins = whole(o.coins);
  return out;
}
const offerEmpty = o => !o.coins && !Object.keys(o.items).length && !Object.keys(o.cases).length && !Object.keys(o.keys).length;
// an offer as one string, the same however it was put together, so two players can check they mean the same trade
const offerKey = o => JSON.stringify([Object.keys(o.items).sort().map(k => [k, o.items[k]]), GRADE_IDS.map(g => o.cases[g] || 0), KEY_IDS.map(k => o.keys[k] || 0), o.coins]);
// whether a locker holds everything in an offer
const canGive = (l, o) => l.coins >= o.coins && Object.keys(o.items).every(k => !ALL[k].free && count(l, k) >= o.items[k]) && Object.keys(o.cases).every(g => l.cases[g] >= o.cases[g]) && Object.keys(o.keys).every(k => l.keys[k] >= o.keys[k]);
// what a locker shows the other player in a trade: the looks, cases and keys that could be offered, never the coins
function inventory(l) { const items = {}; for (const it of ITEMS) if (!it.free && owns(l, it.key)) items[it.key] = count(l, it.key); return cleanOffer({ items, cases: l.cases, keys: l.keys }); }
// One side of a trade: the locker gives `give` and takes `get`. A look given away to the last copy comes off (its slot
// goes back to the free look). False, with nothing changed, if the locker doesn't hold what it's to give.
function trade(l, give, get) {
  if (!canGive(l, give)) return false;
  for (const k in give.items) { l.owned[k] -= give.items[k]; if (!l.owned[k]) { delete l.owned[k]; const it = ALL[k]; if (l.wear[it.slot] === it.id) l.wear[it.slot] = slotItems(it.slot)[0].id; } }
  for (const g in give.cases) l.cases[g] -= give.cases[g];
  for (const k in give.keys) l.keys[k] -= give.keys[k];
  for (const k in get.items) l.owned[k] = count(l, k) + get.items[k];
  for (const g in get.cases) l.cases[g] += get.cases[g];
  for (const k in get.keys) l.keys[k] += get.keys[k];
  l.coins += get.coins - give.coins;
  return true;
}
// how much of the catalogue a locker holds: { have, of } overall, or for one slot
function progress(l, slot) { const its = slot ? slotItems(slot) : ITEMS; return { have: its.filter(it => owns(l, it.key)).length, of: its.length }; }
// a locker with every look, plenty of coins, cases and keys (dev mode's test locker)
function full() { const l = fresh(); for (const it of ITEMS) l.owned[it.key] = 1; l.coins = 100000; for (const g of GRADE_IDS) l.cases[g] = 50; for (const k of KEY_IDS) l.keys[k] = 50; return l; }

return { SLOTS, RARITIES, RARITY, ITEMS, ALL, FREE, GRADES, GRADE_IDS, KEYS, KEY_IDS, OWNED_WEIGHT, PITY, LUCKY_FULL, DAILY, START,
  key, slotItems, winCoins, WIN_CASES, gradeFor, count, owns, fresh, validate, wear, buyCase, buyKey, open, gameOver, daily, nextDay, progress, full,
  noOffer, cleanOffer, offerEmpty, offerKey, canGive, inventory, trade };
})();
if (typeof module !== 'undefined') module.exports = LOOKS;
