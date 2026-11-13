// "Rejoin": close a player's page completely mid-game (like swiping the app away), reopen it fresh, and Rejoin; leaving on purpose forgets it; both leaving; it expiring; two tabs on one device; the home screen still fitting a phone on its side.
const { chromium, SITE, RELAY, shot, ok } = require('./lib');
const BASE = SITE.new + RELAY;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const logs = [];
let b;
async function ctxFor(name) {
  const ctx = await b.newContext({ viewport: { width: 900, height: 560 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(n => { try { localStorage.setItem('retroSet.name', n); } catch (e) {} }, name);
  return ctx;
}
async function open(ctx, name, url = BASE) {
  const p = await ctx.newPage();
  p.on('console', m => { if (!/GPU stall/.test(m.text())) logs.push(`${name} [${m.type()}] ${m.text()}`); });
  p.on('pageerror', e => logs.push(`${name} [pageerror] ${e.message}`));
  await p.goto(url); await sleep(1000); return p;
}
const info = p => p.evaluate(() => ({ ...window.__rs.net, state: window.__rs.state, fen: window.__rs.fen, moves: window.__rs.moves.join(' ') }));
const until = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch (e) {} await sleep(250); } return false; };
const tap = async (p, n) => { const [x, y] = await p.evaluate(n => window.__rs.squareScreen(n), n); await p.mouse.click(x, y); await sleep(120); };
async function play(a, c, from, to) {
  const ia = await info(a), mover = ia.fen.split(' ')[1] === ia.me ? a : c, n0 = ia.moves.split(' ').filter(Boolean).length;
  await tap(mover, from); await tap(mover, to);
  return until(async () => { const [x, y] = [await info(a), await info(c)]; return x.moves.split(' ').filter(Boolean).length === n0 + 1 && x.fen === y.fen; });
}
async function toOnline(p) { if (!(await p.isVisible('#netCode'))) await p.click('#bOnline'); }
const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('retroSet.rejoin') || '[]'));
// a private room, made through the menus: Online, Create a room, Private, Create room; the friend types the code
async function newRoom(h, g) {
  await toOnline(h); await h.click('#bCreate'); await h.click('#sListed [data-v="0"]'); await h.click('#bStart'); await sleep(1000);
  const code = await h.textContent('#lobbyCode');
  await toOnline(g); await g.fill('#netCode', code); await g.click('#bJoin');
  await until(async () => (await info(h)).started && (await info(g)).started);
  return code;
}

(async () => {
  b = await chromium.launch();
  const hc = await ctxFor('Sam'), gc = await ctxFor('Alex');
  let h = await open(hc, 'Sam'), g = await open(gc, 'Alex');
  ok(await h.isHidden('#bRejoin'), 'no Rejoin button before any online game');

  console.log('--- the guest closes the app mid-game, reopens it, and rejoins');
  await newRoom(h, g);
  ok(await play(h, g, 'e2', 'e4') && await play(h, g, 'e7', 'e5'), 'two moves play out in both windows');
  const before = await info(g), fen = before.fen;
  await g.close();                                        // like swiping the app away: no goodbye is sent
  ok(await until(async () => (await info(h)).peer === false), "Sam's game notices Alex has gone");
  g = await open(gc, 'Alex');                             // reopened from the icon: a fresh page, no room in the address
  ok(await g.isVisible('#bRejoin') && (await g.textContent('#bRejoin')) === 'Rejoin: vs Sam', `home screen offers "${await g.textContent('#bRejoin')}"`);
  await g.click('#bRejoin');
  ok(await until(async () => { const i = await info(g); return i.started && i.state === 'play'; }), 'Rejoin puts Alex back in the game');
  const after = await info(g);
  ok(after.seat === before.seat && after.cid === before.cid && after.me === before.me, `same seat (${after.seat}), colour and player id`);
  ok((await info(g)).fen === fen && (await info(h)).fen === fen, 'the position is exactly as it was');
  ok(await play(h, g, 'g1', 'f3'), 'play carries on: the next move shows in both windows');

  console.log('--- leaving on purpose forgets it, for both players');
  ok((await saved(h)).length === 1 && (await saved(g)).length === 1, 'before that, each device has its one saved game');
  await g.click('#bMenu'); await g.click('#bQuit'); await sleep(1000);
  ok(!(await saved(g)).length, 'Alex quits: Alex\'s saved game is forgotten');
  ok(!(await saved(h)).length, 'Sam is told Alex left on purpose, so Sam\'s is forgotten too');
  ok(await g.isVisible('#sc-online'), 'quitting an online game goes back to the Online screen');
  await h.click('#bMenu'); await h.click('#bQuit'); await sleep(500);
  { const p = await open(gc, 'Alex'); ok(await p.isHidden('#bRejoin') && await p.isVisible('#bOnline'), 'reopened afterwards: home has no Rejoin button'); await p.close(); }

  console.log('--- both players close their apps; each rejoins');
  await newRoom(h, g);
  ok(await play(h, g, 'd2', 'd4'), 'a new game, one move played');
  const hs = (await info(h)).seat, gs = (await info(g)).seat;
  await h.close(); await g.close(); await sleep(1500);
  g = await open(gc, 'Alex'); await g.click('#bRejoin'); await sleep(1500);
  ok((await info(g)).state === 'lobby' && /Waiting for Sam to reconnect/.test(await g.textContent('#lobbyStatus')), `first back waits: "${await g.textContent('#lobbyStatus')}"`);
  h = await open(hc, 'Sam'); ok(await h.isVisible('#bRejoin'), 'Sam is offered Rejoin too');
  await h.click('#bRejoin');
  ok(await until(async () => (await info(h)).started && (await info(g)).started), 'when Sam rejoins, a fresh game starts in the same room');
  ok((await info(h)).seat === hs && (await info(g)).seat === gs, `each player is back in their own seat (${hs} and ${gs})`);
  ok((await info(h)).fen === (await info(g)).fen, 'the same position on both');

  console.log('--- it expires');
  await h.evaluate(() => { const l = JSON.parse(localStorage.getItem('retroSet.rejoin')); for (const r of l) r.at -= 4 * 3600 * 1000; localStorage.setItem('retroSet.rejoin', JSON.stringify(l)); });
  await h.close(); h = await open(hc, 'Sam');
  ok(await h.isHidden('#bRejoin'), 'after more than 3 hours the button is gone');
  await g.close(); await h.close();

  console.log('--- one device, two tabs (playing yourself): rejoin takes the closed tab\'s seat, never the open one');
  const tc = await ctxFor('Tess');
  let A = await open(tc, 'Tess A'), B = await open(tc, 'Tess B');
  await newRoom(A, B);
  ok(await play(A, B, 'c2', 'c4'), 'a move shows in both tabs');
  const aI = await info(A), bI = await info(B);
  ok((await saved(A)).length === 2, 'two saved entries, one per seat');
  let C = await open(tc, 'Tess C');
  ok(await C.isHidden('#bRejoin'), 'a third tab, with both seats still open: no Rejoin button');
  await B.close(); await sleep(1500);
  await A.evaluate(cid => { const l = JSON.parse(localStorage.getItem('retroSet.rejoin')); l.sort((x, y) => (y.cid === cid) - (x.cid === cid)); localStorage.setItem('retroSet.rejoin', JSON.stringify(l)); }, aI.cid);   // the open tab's entry is the newest
  await C.close(); C = await open(tc, 'Tess C');
  ok(await C.isVisible('#bRejoin'), 'after closing one tab, a new tab offers Rejoin');
  await C.click('#bRejoin');
  ok(await until(async () => { const i = await info(C); return i.started && i.state === 'play'; }), 'the new tab is back in the game');
  const cI = await info(C), aNow = await info(A);
  ok(cI.cid === bI.cid && cI.seat === bI.seat, `it took the closed tab's seat (${cI.seat}), not the open one's`);
  ok(aNow.peer === true && aNow.state === 'play' && aNow.seat === aI.seat, 'the open tab was left alone and sees its opponent back');
  ok(aNow.fen === cI.fen, 'the same position on both');
  await tc.close();

  console.log('--- a phone on its side: home still fits with Rejoin and Resume');
  const pc = await b.newContext({ viewport: { width: 762, height: 341 }, reducedMotion: 'reduce' });
  await pc.addInitScript(() => {
    localStorage.setItem('retroSet.rejoin', JSON.stringify([{ code: 'ABCDE', cid: 'XYZXYZXYZXYZ', peer: 'Samantha', at: Date.now() }]));
    localStorage.setItem('retroSet.game', JSON.stringify({ v: 1, start: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: ['e2e4'], vs: null }));
  });
  const ph = await open(pc, 'Phone');
  const fit = await ph.evaluate(() => { const s = document.querySelector('#mStage'), r = document.querySelector('#bRejoin').getBoundingClientRect(), q = document.querySelector('#bResume').getBoundingClientRect(); return { over: s.scrollHeight - s.clientHeight, shown: r.width > 0 && q.width > 0 }; });
  ok(fit.shown && fit.over <= 1, `Rejoin and Resume both show, no scrolling (${JSON.stringify(fit)})`);
  await ph.screenshot({ path: shot('rejoin-phone.png') });

  ok(!logs.length, 'console clean' + (logs.length ? ':\n  ' + logs.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
