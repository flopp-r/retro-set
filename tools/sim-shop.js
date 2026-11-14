// Measures how long the locker takes to fill: plays out many pretend players, day by day, with the real rules in
// src/looks.js, and prints how many days they needed. Run with:  node tools/sim-shop.js [players] [wins a day]
// The pretend player logs in every day, wins 3 or 4 games (by default) against bots that get stronger as the days go
// by, opens every case they can find a key for, and spends what's left on more cases and keys, aiming type keys at the
// slot they're furthest behind in. Nothing here is part of the game.
const C = require('../src/core.js'), L = require('../src/looks.js'), BOTS = require('../src/bots.js');
const RATINGS = BOTS.LIST.map(b => b.rating), IDS = BOTS.LIST.map(b => b.id);
const players = +process.argv[2] || 400, perDay = +process.argv[3] || 3.5, MAX = 400;
// the slot with most still to win, if a type key would help; otherwise the standard key
const behind = l => { const left = L.SLOTS.map(s => [s.id, L.slotItems(s.id).filter(it => !L.owns(l, it.key)).length]).sort((a, b) => b[1] - a[1]); return left[0][1] ? left[0][0] : null; };
function spend(l, rnd, log) {
  for (let guard = 0; guard < 500; guard++) {
    const have = [...L.GRADE_IDS].reverse().find(g => l.cases[g]);
    if (!have) {   // no case in hand: buy the best one that leaves enough for a key
      const g = [...L.GRADE_IDS].reverse().find(g => l.coins >= L.GRADES[g].price + L.KEYS.any.price && (g !== 'lucky' || L.progress(l).have < L.ITEMS.length));
      if (!g) return; L.buyCase(l, g); continue;
    }
    let key = L.KEY_IDS.find(k => l.keys[k]);
    if (!key) {   // a type key once the easy looks are in, a standard key before
      const slot = behind(l), want = slot && L.progress(l).have > 30 && l.coins >= L.KEYS[slot].price ? slot : 'any';
      if (l.coins < L.KEYS[want].price) return;
      L.buyKey(l, want); key = want;
    }
    const r = L.open(l, have, key, rnd); log.opens++; if (r.dupe) log.dupes++;
  }
}
const days = [], logs = [];
for (let p = 0; p < players; p++) {
  const rnd = C.rng(1000 + p), l = L.fresh(), log = { opens: 0, dupes: 0, at: {} };
  let day = '2026-01-01', d = 0;
  for (d = 1; d <= MAX; d++) {
    L.daily(l, day); day = L.nextDay(day);
    const wins = Math.floor(perDay) + (rnd() < perDay % 1 ? 1 : 0), top = Math.min(9, 1 + Math.floor(d * 0.6));   // stronger bots as the days go by
    for (let w = 0; w < wins; w++) { const i = Math.floor(rnd() * (top + 1)); L.gameOver(l, { id: IDS[i], rating: RATINGS[i], top: i >= 7 }, 'win'); spend(l, rnd, log); }
    spend(l, rnd, log);
    const have = L.progress(l).have;
    for (const n of [35, 50, 60, 70]) if (have >= n && !log.at[n]) log.at[n] = d;
    if (have === L.ITEMS.length) break;
  }
  days.push(d); logs.push(log);
}
const q = (a, f) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * f)], mean = a => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`${players} players, ${perDay} wins a day, ${L.ITEMS.length} looks (${L.FREE.length} free)`);
for (const n of [35, 50, 60, 70]) console.log(`  ${n} looks: day ${q(logs.map(x => x.at[n] || MAX), 0.5)} (middle player), ${q(logs.map(x => x.at[n] || MAX), 0.1)} to ${q(logs.map(x => x.at[n] || MAX), 0.9)} for most`);
console.log(`  cases opened: ${Math.round(mean(logs.map(x => x.opens)))} on average, ${Math.round(100 * mean(logs.map(x => x.dupes / x.opens)))}% of them duplicates`);
module.exports = { median: q(days, 0.5) };
