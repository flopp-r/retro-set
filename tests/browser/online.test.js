// Online play against the local relay: two windows playing with real taps, positions identical on both screens, a reload mid-game, duplicated tabs, different versions, chat, a draw offer declined and accepted, resigning, Play again with the colours swapped, a doctored move refused, and no moving while the other player is away.
const { chromium, SITE, WORK, RELAY, shot, watch, ok } = require('./lib');
const fs = require('fs'), path = require('path');
const NEW = SITE.new + RELAY, ALT = SITE.alt + RELAY;
const logs = {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const run = Date.now().toString(36).slice(-3).toUpperCase();   // fresh room codes each run

let b;
async function win(name, url) {
  const ctx = await b.newContext({ viewport: { width: 640, height: 480 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(n => { try { localStorage.setItem('retroSet.name', n); } catch (e) {} }, name);
  // record every message the page shows, so short-lived ones can't be missed
  await ctx.addInitScript(() => {
    window.__toasts = []; let last = '';
    new MutationObserver(() => { const t = document.querySelector('#toast'); if (t && !t.hidden && t.textContent && t.textContent !== last) { last = t.textContent; window.__toasts.push(last); } })
      .observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  const p = await ctx.newPage(); logs[name] = watch(p, logs[name] || []);
  await p.goto(url); return p;
}
const info = p => p.evaluate(() => ({ ...window.__rs.net, state: window.__rs.state, fen: window.__rs.fen, moves: window.__rs.moves.join(' '), result: window.__rs.result,
  lobby: document.querySelector('#lobbyStatus').textContent, note: document.querySelector('#netNote').textContent, toasts: window.__toasts || [], ver: document.querySelector('#ver').textContent }));
async function until(fn, ms = 20000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch (e) {} await sleep(250); } return false; }
const tap = async (p, n) => { const [x, y] = await p.evaluate(n => window.__rs.squareScreen(n), n); await p.mouse.click(x, y); await sleep(120); };
// the player whose move it is plays from-to by tapping; then both windows must show the same position
async function play(a, c, from, to) {
  const [ia, ic] = [await info(a), await info(c)], turn = ia.fen.split(' ')[1], mover = ia.me === turn ? a : c, n0 = ia.moves ? ia.moves.split(' ').length : 0;
  await tap(mover, from); await tap(mover, to);
  return until(async () => { const [x, y] = [await info(a), await info(c)]; return x.moves.split(' ').filter(Boolean).length === n0 + 1 && x.fen === y.fen && x.state === 'play' && y.state === 'play'; });
}
const same = async (a, c) => { const [x, y] = [await info(a), await info(c)]; return x.fen === y.fen && x.moves === y.moves; };

(async () => {
  b = await chromium.launch();

  console.log('--- 1. Two windows: a game through the relay');
  const room1 = 'S' + run + 'A';
  const host = await win('Host', NEW + '#room=' + room1);
  ok(await until(async () => /Waiting for your friend/.test((await info(host)).lobby)), 'an invite link opens the waiting room');
  const guest = await win('Guest', NEW + '#room=' + room1);
  ok(await until(async () => (await info(host)).started && (await info(guest)).started), 'the game starts for both when the friend opens the link');
  let [h, g] = [await info(host), await info(guest)];
  ok(h.seat === 0 && g.seat === 1 && h.me !== g.me, `one plays White, the other Black (host ${h.me}, guest ${g.me})`);
  ok(await host.evaluate(() => document.querySelector('#plW .plName').textContent + ' v ' + document.querySelector('#plB .plName').textContent) === (h.me === 'w' ? 'You v Guest' : 'Guest v You'), 'the bar names you and your opponent');
  const white = h.me === 'w' ? host : guest, black = h.me === 'w' ? guest : host;
  await tap(black, 'e7');
  ok(await black.evaluate(() => window.__rs.sel) === '', "Black can't pick up a piece while it's White's move");
  ok(await play(host, guest, 'e2', 'e4'), 'White taps e2 then e4: the move shows on both screens');
  ok(await play(host, guest, 'e7', 'e5'), 'Black replies: both screens again');
  ok(await play(host, guest, 'g1', 'f3'), 'and a knight');
  ok(await same(host, guest) && (await info(host)).moves === 'e4 e5 Nf3', `the same position and moves on both (${(await info(host)).moves})`);
  // on a phone on its side, the connection line under the bar still leaves the buttons clear
  await host.setViewportSize({ width: 762, height: 341 }); await sleep(400);
  const phone = await host.evaluate(() => { const m = document.querySelector('#bar').getBoundingClientRect(), t = document.querySelector('#tools').getBoundingClientRect(); return { gap: Math.round(t.top - m.bottom), net: document.querySelector('#net').textContent, chat: !document.querySelector('#bChat').hidden }; });
  ok(phone.gap > 0 && phone.net === 'Guest is connected' && phone.chat, `on a phone: "${phone.net}" under the bar, the Chat button showing, ${phone.gap}px clear of the buttons`);
  await host.screenshot({ path: shot('online-phone.png') });
  await host.setViewportSize({ width: 640, height: 480 }); await sleep(300);

  console.log('--- 2. A reload mid-game keeps the seat and the game');
  const before = await info(guest);
  await guest.reload();
  ok(await until(async () => { const i = await info(guest); return i.started && i.state === 'play'; }), 'the reloaded window is back in the game');
  const after = await info(guest);
  ok(after.cid === before.cid && after.seat === before.seat && after.me === before.me, `same player id, seat and colour (${after.me})`);
  ok(await same(host, guest), 'the same position on both');
  ok(await play(host, guest, 'b8', 'c6'), 'play carries on after the reload');

  console.log('--- 3. Chat, and a draw offer declined then accepted');
  await host.click('#bChat'); await host.click('#chatPop [data-i="0"]');
  ok(await until(async () => (await info(guest)).toasts.some(t => t === 'Host: Good move!')), 'quick chat: the guest sees "Host: Good move!"');
  await guest.click('#bMenu'); await guest.click('#bDraw');
  ok(await until(async () => host.isVisible('#offer')) && /Guest offers a draw/.test(await host.textContent('#offerTxt')), 'the guest offers a draw: the host is asked');
  await host.click('#bOfferNo');
  ok(await until(async () => (await info(guest)).toasts.some(t => /declined the draw/.test(t))) && !(await info(host)).result, 'declined: the guest is told, and the game goes on');
  await guest.click('#bMenu'); await guest.click('#bDraw');
  await until(async () => host.isVisible('#offer')); await host.click('#bOfferYes');
  ok(await until(async () => { const [x, y] = [await info(host), await info(guest)]; return x.result && y.result && x.result.why === 'agreed' && y.result.why === 'agreed'; }), 'accepted: a draw on both screens');

  console.log('--- 4. Play again: both ask, and the colours swap');
  const meBefore = (await info(host)).me;
  await until(async () => host.isVisible('#over')); await until(async () => guest.isVisible('#over'));
  await host.click('#bAgain');
  ok(await until(async () => /Waiting for Guest/.test(await host.textContent('#bAgain')) && /accept/.test(await guest.textContent('#bAgain'))), 'the host asks: their button waits, the guest\'s says accept');
  await guest.click('#bAgain');
  ok(await until(async () => { const [x, y] = [await info(host), await info(guest)]; return x.state === 'play' && y.state === 'play' && !x.moves && !y.moves && x.games === 1; }), 'a new game starts for both');
  ok((await info(host)).me !== meBefore && (await info(guest)).me === meBefore, `the colours swapped (the host now plays ${(await info(host)).me})`);

  console.log('--- 5. A doctored move is refused, and the games stay in step');
  ok(await play(host, guest, 'd2', 'd4'), 'a normal move first');
  { const [x] = [await info(host)], mover = x.fen.split(' ')[1] === x.me ? host : guest, other = mover === host ? guest : host;
    await mover.evaluate(() => window.__rs.send({ t: 'move', n: window.__rs.moves.length + 1, u: 'e8e1', fen: 'nonsense' }));
    ok(await until(async () => (await info(other)).toasts.some(t => /isn't legal/.test(t))), 'an illegal move from a modified copy is ignored, with a message');
    ok(await until(async () => (await info(other)).toasts.some(t => /back in step/.test(t))) && await same(host, guest), 'the whole game is fetched again, and both screens still match'); }

  console.log('--- 6. No moving while the other player is away');
  { const x = await info(host), mover = x.fen.split(' ')[1] === x.me ? host : guest, away = mover === host ? guest : host, moverName = mover === host ? 'Host' : 'Guest';
    const n0 = (await info(mover)).moves;
    await away.context().setOffline(true); await away.evaluate(() => { /* the socket drops when offline */ });
    await away.close();
    ok(await until(async () => (await info(mover)).peer === false, 15000), `${moverName}'s game notices the other player has gone`);
    const [from, to] = (await info(mover)).me === 'w' ? ['g1', 'f3'] : ['g8', 'f6'];
    await tap(mover, from); await tap(mover, to); await sleep(300);
    const m = await info(mover);
    ok(m.moves === n0 && m.toasts.some(t => /Waiting for .* to reconnect/.test(t)), `the move is held back: "${m.toasts.find(t => /reconnect/.test(t))}"`);
    await mover.click('#bMenu'); await mover.click('#bQuit');
    await mover.context().close(); }

  console.log('--- 7. Resigning');
  const room2 = 'S' + run + 'B';
  const r1 = await win('Ann', NEW + '#room=' + room2); await sleep(1200);
  const r2 = await win('Bob', NEW + '#room=' + room2);
  await until(async () => (await info(r1)).started && (await info(r2)).started);
  await r2.click('#bMenu'); await r2.click('#bResign'); await r2.click('#bResign');
  ok(await until(async () => r1.isVisible('#over') && r2.isVisible('#over')), 'the result shows on both screens');
  ok(await r1.textContent('#overTitle') === 'Bob resigns' && await r1.textContent('#overWhy') === 'You win' && await r2.textContent('#overTitle') === 'You resign', `"${await r1.textContent('#overTitle')}", "${await r1.textContent('#overWhy')}" / "${await r2.textContent('#overTitle')}"`);

  console.log('--- 8. Duplicating a tab during a game');
  const [dup] = await Promise.all([r1.context().waitForEvent('page'), r1.evaluate(() => window.open(location.href))]);
  logs['Ann duplicate'] = watch(dup, []);
  ok(await until(async () => /already has two players/.test((await info(dup)).note), 15000), 'the copy is told the room is full');
  ok((await info(dup)).cid !== (await info(r1)).cid, 'the copy gets its own player id');
  await sleep(800);
  ok((await info(r1)).peer && (await info(r1)).link === 'online' && (await info(r1)).seat === 0, 'the original keeps its seat and connection');
  await dup.close();

  console.log('--- 9. Duplicating a waiting host tab gives you an opponent (playing yourself in two tabs)');
  const room3 = 'S' + run + 'C';
  const solo = await win('Solo', NEW + '#room=' + room3);
  await until(async () => /Waiting/.test((await info(solo)).lobby));
  const [twin] = await Promise.all([solo.context().waitForEvent('page'), solo.evaluate(() => window.open(location.href))]);
  logs['Solo duplicate'] = watch(twin, []);
  ok(await until(async () => (await info(solo)).started && (await info(twin)).started), 'the copy joins as the second player and the game starts');
  ok(await play(solo, twin, 'e2', 'e4'), 'a move shows in both tabs');

  console.log('--- 10. Two different versions');
  const room4 = 'S' + run + 'D';
  const va = await win('Version A', NEW + '#room=' + room4); await sleep(1200);
  const vb = await win('Version B', ALT + '#room=' + room4);
  ok(await until(async () => /different versions/.test((await info(va)).lobby) && /different versions/.test((await info(vb)).lobby), 15000), `both are told, and neither starts: "${(await info(va)).lobby}"`);
  ok((await info(va)).state === 'lobby' && (await info(vb)).state === 'lobby', 'both stay in the waiting room');

  console.log('--- 11. Mid-game, one player reloads onto a different version');
  const live = path.join(WORK, 'www-new/index.html'), keep = fs.readFileSync(live);
  fs.copyFileSync(path.join(WORK, 'www-alt/index.html'), live);
  await twin.reload();
  await sleep(1500); fs.writeFileSync(live, keep);
  ok(await until(async () => { const i = await info(twin); return i.started && i.state === 'play'; }), 'the game carries on rather than blocking');
  ok((await info(twin)).ver === 'Version deadbeef', `the reloaded tab really is on the other version (${(await info(twin)).ver})`);
  ok(await until(async () => (await info(solo)).toasts.some(t => /different versions/.test(t)) && (await info(twin)).toasts.some(t => /different versions/.test(t)), 8000), 'both are warned');
  ok(await same(solo, twin), 'and both screens still match');

  console.log('--- Console');
  for (const [k, v] of Object.entries(logs)) ok(!v.length, `${k}: console ${v.length ? 'NOT clean:\n  ' + v.join('\n  ') : 'clean'}`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
