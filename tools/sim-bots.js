// Measures the computer opponents' strength by playing games with the real rules and engine: against Stockfish at its
// calibrated strength settings (the anchor), and against each other (the 200-point gaps). Usage:
//   node tools/sim-bots.js match <a> <b> [games]   a, b: a bot (pip, mabel …), a bot with another knob setting
//                                                  (nell@0.15, or nell@0.15/4 to look 4 moves ahead), or Stockfish
//                                                  at a strength (sf1320, sf1500)
//   node tools/sim-bots.js tune [games] [bot]      finds each bot's knob: Nell and Tariq against Stockfish, then each
//                                                  of the others 200 points below the bot above it; prints the values
//                                                  to put into src/bots.js. Given a bot, it starts there, the bots
//                                                  above keeping their values in src/bots.js
//   node tools/sim-bots.js check [games] [bot]     plays each bot against its anchor or the bot above, and prints the
//                                                  measured ratings (given a bot, from there down)
// Stockfish (stockfish.js 19, GPL-3.0) is installed into a temporary folder on first use. It is only used here to
// measure; it is never part of the game. Its strength setting (UCI_Elo, 1320 at the lowest) is calibrated by its
// makers against other engines' ratings, not against people. Games run on every core, in worker threads.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os'), fs = require('fs');
const C = require('../src/core.js'), BOTS = require('../src/bots.js');

const SF_VERSION = '19.0.1', SF_MS = 60;   // Stockfish's time a move: its weakened play picks its move after a very shallow search, so more time changes little
const MAX_PLY = 240;                       // a game still going after this is decided on material (see adjudicate)

// a player spec: { bot, cfg } or { sf: elo }
function spec(name) {
  const m = /^sf(\d+)$/.exec(name);
  if (m) return { name, sf: +m[1] };
  const [id, rest] = name.split('@'), [k, d] = (rest || '').split('/'), bot = BOTS.byId(id);   // nell@0.1/4: knob 0.1, 4 moves deep
  if (!bot) throw new Error(`No bot called "${id}" (the bots: ${BOTS.LIST.map(b => b.id).join(', ')}; or sf1320 and so on)`);
  const cfg = BOTS.settings(bot, k ? +k : undefined);
  if (d) cfg.depth = +d;
  return { name, bot: id, cfg };
}
const material = b => b.reduce((a, p) => a + (p ? (p === p.toUpperCase() ? 1 : -1) * C.VALUE[C.kind(p)] : 0), 0);
// a game that runs on: decided for the side a clear piece ahead (it would win against an opponent of this strength), else drawn
const adjudicate = g => { const d = material(g.pos.b); return d >= 300 ? 1 : d <= -300 ? 0 : 0.5; };
const elo = s => s <= 0 ? -999 : s >= 1 ? 999 : -400 * Math.log10(1 / s - 1);
const expected = d => 1 / (1 + Math.pow(10, -d / 400));

// ------------------------------------------------------------------ a worker: plays games
if (!isMainThread) {
  const { spawn } = require('child_process');
  let sf = null, buf = '', waiters = [];
  const send = s => sf.stdin.write(s + '\n'), wait = re => new Promise(res => waiters.push({ re, res }));
  async function engine() {
    if (sf) return;
    sf = spawn(process.execPath, [workerData.sfPath], { stdio: 'pipe' });
    sf.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); for (const w of waiters.slice()) if (w.re.test(l)) { waiters.splice(waiters.indexOf(w), 1); w.res(l); } } });
    send('uci'); await wait(/^uciok/);
    send('setoption name UCI_LimitStrength value true');
  }
  async function sfMove(g, elo) {
    send(`setoption name UCI_Elo value ${elo}`);
    send(`position fen ${g.start} moves ${g.list.map(x => C.uci(x.m)).join(' ')}`);
    send(`go movetime ${SF_MS}`);
    return (await wait(/^bestmove/)).split(' ')[1];
  }
  async function playGame({ white, black, seed }) {
    let g = C.newGame(), lopsided = 0;
    const rnd = C.rng(seed);
    if (white.sf || black.sf) { await engine(); send('ucinewgame'); send('isready'); await wait(/^readyok/); }
    while (!g.result && g.list.length < MAX_PLY) {
      const p = g.pos.turn === 'w' ? white : black;
      const n = p.sf ? C.playUci(g, await sfMove(g, p.sf)) : C.play(g, C.runThink(g, p.cfg, rnd));
      if (!n) throw new Error('an illegal move from ' + p.name);
      g = n;
      // a side three minor pieces' worth ahead for 6 moves in a row has won, at these strengths: stop early to save time
      lopsided = Math.abs(material(g.pos.b)) >= 700 && g.list.length > 30 ? lopsided + 1 : 0;
      if (lopsided >= 6) break;
    }
    const score = g.result ? (g.result.score === '1-0' ? 1 : g.result.score === '0-1' ? 0 : 0.5) : adjudicate(g);
    return { score, plies: g.list.length, why: g.result ? g.result.why : 'adjudicated' };
  }
  parentPort.on('message', async job => { if (job === 'stop') { if (sf) sf.kill(); process.exit(0); } parentPort.postMessage({ id: job.id, ...(await playGame(job)) }); });
  return;
}

// ------------------------------------------------------------------ the main thread
function ensureStockfish() {
  const dir = path.join(os.tmpdir(), 'retro-set-stockfish'), mod = path.join(dir, 'node_modules', 'stockfish');
  if (!fs.existsSync(path.join(mod, 'package.json'))) {
    console.log(`Installing Stockfish ${SF_VERSION} into ${dir} (first run only)…`);
    fs.mkdirSync(dir, { recursive: true });
    require('child_process').execFileSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', '--prefix', dir, `stockfish@${SF_VERSION}`], { stdio: 'inherit' });
  }
  return require(mod).findEngine('single');
}
let pool = null;
function startPool() {
  const sfPath = ensureStockfish(), n = Math.max(1, os.cpus().length);
  const workers = Array.from({ length: n }, () => new Worker(__filename, { workerData: { sfPath } }));
  return { workers, stop: () => workers.forEach(w => w.postMessage('stop')) };
}
// plays `games` games between a and b, half with each colour; returns a's score (0 to 1) and the numbers behind it
function match(a, b, games) {
  return new Promise(resolve => {
    const jobs = Array.from({ length: games }, (_, i) => ({ id: i, white: i % 2 ? b : a, black: i % 2 ? a : b, seed: 1000003 * (i + 1) + games }));
    let next = 0, done = 0, pts = 0, w = 0, l = 0, d = 0, plies = 0;
    const why = {};
    const feed = wk => { if (next < jobs.length) wk.postMessage(jobs[next++]); };
    const onMsg = r => {
      const aWhite = r.id % 2 === 0, s = aWhite ? r.score : 1 - r.score;
      pts += s; plies += r.plies; why[r.why] = (why[r.why] || 0) + 1;
      if (s === 1) w++; else if (s === 0) l++; else d++;
      if (++done === games) { for (const wk of pool.workers) wk.off('message', wk._h); resolve({ score: pts / games, w, l, d, plies: plies / games, why }); }
    };
    for (const wk of pool.workers) { wk._h = r => { onMsg(r); feed(wk); }; wk.on('message', wk._h); feed(wk); }
  });
}
// the uncertainty of a score: about 2 standard errors, in rating points
function band(r, games) {
  const v = (r.w * Math.pow(1 - r.score, 2) + r.l * Math.pow(r.score, 2) + r.d * Math.pow(0.5 - r.score, 2)) / games, se = Math.sqrt(v / games);
  return Math.round((elo(Math.min(0.999, r.score + 2 * se)) - elo(Math.max(0.001, r.score - 2 * se))) / 2);
}
const line = (a, b, r, games) => `${a.name.padEnd(12)} v ${b.name.padEnd(12)} ${(r.score * 100).toFixed(1).padStart(5)}%  (${r.w} won, ${r.d} drawn, ${r.l} lost; ${Math.round(r.plies)} plies a game)  ${elo(r.score) >= 0 ? '+' : ''}${Math.round(elo(r.score))} ±${band(r, games)}`;

// each bot's reference and its rating gap to it: the top two against Stockfish, each of the rest against the bot above
const CHAIN = BOTS.LIST.slice().reverse().map((b, i, all) => i === 0 ? [b.id, 'sf1500', b.rating - 1500] : i === 1 ? [b.id, 'sf1320', b.rating - 1320] : [b.id, all[i - 1].id, b.rating - all[i - 1].rating]);

(async () => {
  const [cmd, x, y, z] = process.argv.slice(2);
  if (!['match', 'tune', 'check'].includes(cmd)) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 10).join('\n')); return; }
  pool = startPool();
  const t0 = Date.now();
  try {
    if (cmd === 'match') {
      const a = spec(x), b = spec(y), games = +z || 100;
      console.log(line(a, b, await match(a, b, games), games));
    }
    if (cmd === 'tune') {
      // each bot's knob, top down (so each reference already has its tuned value): k = 0 first (its best), then
      // stepping the knob up until it's below the target, then closing in by straight-line steps in rating points
      // tune 80 mabel: start the chain at Mabel, the bots above keeping their values in src/bots.js
      const games = +x || 80, tuned = Object.fromEntries(BOTS.LIST.map(b => [b.id, b.cfg.k])), E = s => elo(Math.min(0.98, Math.max(0.02, s)));
      const from = y ? CHAIN.findIndex(c => c[0] === y) : 0;
      if (from < 0) throw new Error(`No bot called "${y}" in the chain`);
      for (const [id, ref, gap] of CHAIN.slice(from)) {
        const bot = BOTS.byId(id), want = E(expected(gap));
        const refSpec = ref.startsWith('sf') ? spec(ref) : { name: ref, bot: ref, cfg: BOTS.settings(BOTS.byId(ref), tuned[ref]) };
        const at = async k => {
          const me = { name: `${id}@${k.toFixed(3)}`, cfg: BOTS.settings(bot, k) }, r = await match(me, refSpec, games);
          console.log('  ' + line(me, refSpec, r, games)); return E(r.score);
        };
        // start from the bot's current value, step until the target is between two tries, then close in
        let lo = null, hi = null, k0 = tuned[id], e0 = await at(k0);
        if (e0 >= want) { lo = [k0, e0]; for (let k = k0 + 0.03; k <= 1.6; k += 0.03) { const e = await at(k); if (e < want) { hi = [k, e]; break; } lo = [k, e]; } }
        else { hi = [k0, e0]; for (let k = Math.max(0, k0 - 0.03); ; k = Math.max(0, k - 0.03)) { const e = await at(k); if (e >= want) { lo = [k, e]; break; } hi = [k, e]; if (k === 0) break; } }
        if (!lo) { console.log(`${bot.name} can't reach ${bot.rating} at depth ${bot.cfg.depth}: give it a deeper search or fewer blunders\n`); tuned[id] = 0; continue; }
        if (!hi) { console.log(`${bot.name} is still too strong with the knob at its top\n`); tuned[id] = lo[0]; continue; }
        let k = lo[0];
        for (let i = 0; i < 2; i++) {
          k = lo[0] + (want - lo[1]) * (hi[0] - lo[0]) / (hi[1] - lo[1]);
          k = Math.min(hi[0] - 0.01, Math.max(lo[0] + 0.01, k));
          const e = await at(k);
          if (e >= want) lo = [k, e]; else hi = [k, e];
        }
        tuned[id] = Math.round((lo[0] + (want - lo[1]) * (hi[0] - lo[0]) / (hi[1] - lo[1])) * 1000) / 1000;
        console.log(`${bot.name} (${bot.rating}): k = ${tuned[id]}  (want ${(expected(gap) * 100).toFixed(1)}% against ${ref})\n`);
      }
      console.log('Put these into src/bots.js:'); for (const [id] of CHAIN.slice(from)) console.log(`  ${id}: k ${tuned[id]}`);
    }
    if (cmd === 'check') {
      // each bot against its reference, top down; its rating builds on the reference's measured rating (not its target),
      // so the margins add up down the chain (as the square root of the sum of their squares)
      // check 240 tariq: start at Tariq; a reference not measured in this run counts at its target rating
      const games = +x || 200, got = {}, err = {}, from = y ? CHAIN.findIndex(c => c[0] === y) : 0;
      if (from < 0) throw new Error(`No bot called "${y}" in the chain`);
      for (const [id, ref, gap] of CHAIN.slice(from)) {
        const a = spec(id), b = spec(ref), r = await match(a, b, games), bot = BOTS.byId(id), d = elo(r.score), e = band(r, games);
        const base = ref.startsWith('sf') ? +ref.slice(2) : got[ref] ?? BOTS.byId(ref).rating, baseErr = ref.startsWith('sf') ? 0 : err[ref] ?? 0;
        got[id] = Math.round(base + d); err[id] = Math.round(Math.sqrt(e * e + baseErr * baseErr));
        console.log(`${line(a, b, r, games)}  → ${bot.name} measures ${got[id]} ±${err[id]} (target ${bot.rating})`);
      }
    }
  } finally { pool.stop(); console.log(`(${Math.round((Date.now() - t0) / 1000)} s)`); }
})().catch(e => { console.error(e); process.exit(1); });
