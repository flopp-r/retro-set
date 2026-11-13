// The cosmetics: the Cosmetics tab, a new player's locker and starter kit, the day's gift, a slot's looks (only what's owned), trying a look on and Equip, opening a case with a key (the reel, the prize, a slot's key), the shop, what a game against the computer pays (once), dev mode with a stand-in word, another open page, and online each side wearing its owner's pieces and avatar.
const { chromium, SITE, RELAY, shot, watch, ok } = require('./lib');
const crypto = require('crypto');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch (e) {} await sleep(200); } return false; }
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 700, height: 440 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const log = watch(p);
  const rs = (f, a) => p.evaluate(f, a);
  const tap = async n => { const [x, y] = await rs(n => window.__rs.squareScreen(n), n); await p.mouse.click(x, y); await p.waitForTimeout(120); };
  const lock = () => rs(() => JSON.parse(JSON.stringify(window.__rs.lock)));
  const txt = sel => rs(sel => document.querySelector(sel).textContent, sel);
  const tiles = sel => rs(sel => [...document.querySelectorAll(sel)].map(t => t.querySelector('.tName').textContent), sel);

  await p.goto(SITE.new); await p.waitForTimeout(1200);
  // --- a new player
  let l = await lock();
  ok((await rs(() => [...document.querySelectorAll('.hTab')].map(t => t.textContent))).join() === 'Play,Cosmetics,Settings', 'the menu has a Cosmetics tab between Play and Settings');
  ok(l.coins === 290 && l.cases.silver === 1 && l.keys.any === 1 && Object.keys(l.owned).length === 7, `a new locker: the starter kit (250 coins, a Silver case, a standard key) and the seven free looks, plus the day's gift (${l.coins} coins)`);
  ok(/\+40 coins/.test(await txt('#gift')) && /day 1 of 7/.test(await txt('#gift')) && await p.isVisible('#gift'), `the home screen says what today's gift was ("${await txt('#gift')}")`);
  await p.click('.hTab[data-go="cos"]'); await p.waitForTimeout(150);
  let ov = await rs(() => ({ slots: [...document.querySelectorAll('#slotGrid .tile')].map(t => `${t.querySelector('.tSlot').textContent}=${t.querySelector('.tName').textContent} ${t.querySelector('.tNum').textContent}`), held: [...document.querySelectorAll('#held .chip2')].map(c => c.textContent), coins: document.querySelector('#coins').textContent }));
  ok(ov.slots.join('; ') === 'Pieces=Classic 1/7; Finish=Classic 1/16; Board=Standard 1/12; Room=Parlour 1/6; Effects=None 1/8; Avatar=Player 1/12; Square marks=Standard 1/9', `the locker shows what is worn in all seven slots at once, and how much of each is owned (${ov.slots.join('; ')})`);
  ok(ov.held.join('; ') === 'Silver case ×1; Standard key ×1' && ov.coins === '290', `and the cases and keys in hand, unopened (${ov.held.join('; ')})`);
  await p.screenshot({ path: shot('locker-new.png') });
  // --- a slot shows only what's owned
  await p.click('#slotGrid .tile[data-slot="set"]'); await p.waitForTimeout(100);
  ok((await tiles('#itemGrid .tile')).join() === 'Classic' && await txt('#slotTitle') === 'Pieces: 1 of 7' && await rs(() => document.querySelector('#bEquip').disabled && document.querySelector('#bEquip').textContent === 'Equipped'), 'a slot lists only the looks owned, with the one worn marked Equipped');
  await p.click('#bSlotBack');

  // --- opening a case: it needs a key; the prize is new, and can be put on
  await p.click('#held .chip2[data-grade="silver"]'); await p.waitForTimeout(100);
  ok(await p.isVisible('#openBox') && await txt('#openTitle') === 'Open a Silver case' && (await rs(() => [...document.querySelectorAll('#openKeys .btn')].map(k => k.textContent))).join() === 'Standard key ×1', 'tapping a case offers the keys in hand to open it with');
  await p.click('#bOpen'); await p.waitForTimeout(150);
  l = await lock();
  const won = Object.keys(l.owned).find(k => !['set:classic', 'finish:classic', 'board:standard', 'room:parlour', 'fx:none', 'avatar:plain', 'marks:standard'].includes(k));
  ok(await rs(() => window.__rs.opening) === 'prize' && l.cases.silver === 0 && l.keys.any === 0 && l.opened === 1 && won && /New!/.test(await txt('#prizeNote')), `opening takes the case and the key and gives a new look (${won}: "${await txt('#prizeName')}", "${await txt('#prizeNote')}")`);
  await p.screenshot({ path: shot('locker-prize.png') });
  await p.click('#bPrizeEquip'); l = await lock();
  ok(l.wear[won.split(':')[0]] === won.split(':')[1] && !(await p.isVisible('#bPrizeEquip')) && !(await p.isVisible('#bOpenMore')), 'Equip on the prize puts it on; with no case or key left there is nothing more to open');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(!(await p.isVisible('#openBox')) && !(await p.isVisible('#reelScreen')) && (await rs(() => document.querySelectorAll('#held .chip2').length)) === 0 && /No cases or keys/.test(await txt('#held')), 'Esc closes it, and the locker says there are no cases or keys left');

  // --- trying a look on, and Equip
  await rs(() => window.__rs.lockerEdit(x => { for (const k in x.owned) if (k.startsWith('board:') && k !== 'board:standard') delete x.owned[k];   // a board the case above may have given
    for (const k of ['board:ocean', 'board:lava', 'set:blocks', 'marks:arrow', 'fx:sparks', 'room:library']) x.owned[k] = 1; x.owned['board:ocean'] = 3; x.wear = { set: 'classic', finish: 'classic', board: 'standard', room: 'parlour', fx: 'none', avatar: 'plain', marks: 'standard' }; }));
  await p.click('.hTab[data-go="home"]'); await p.click('.hTab[data-go="cos"]');
  await p.click('#slotGrid .tile[data-slot="board"]'); await p.waitForTimeout(100);
  ok((await tiles('#itemGrid .tile')).join() === 'Standard,Ocean,Lava' && await rs(() => document.querySelector('.tile[data-item="board:ocean"] .tNum').textContent) === '×3', 'the looks owned are listed in the catalogue\'s order, a duplicate with its count');
  await p.click('.tile[data-item="board:ocean"]'); await p.waitForTimeout(150);
  let w = await rs(() => ({ worn: window.__rs.worn.board, saved: window.__rs.lock.wear.board, info: document.querySelector('#itemInfo').textContent, equip: document.querySelector('#bEquip').textContent, off: document.querySelector('#bEquip').disabled }));
  ok(w.worn === 'ocean' && w.saved === 'standard' && w.equip === 'Equip' && !w.off && /Ocean, common/.test(w.info), `tapping a look shows it on the board behind the menu without wearing it yet (${JSON.stringify(w)})`);
  await p.screenshot({ path: shot('locker-try.png') });
  await p.click('#bSlotBack'); await p.waitForTimeout(100);
  ok(await rs(() => window.__rs.worn.board === 'standard' && window.__rs.lock.wear.board === 'standard'), 'going back without Equip takes it off again');
  await p.click('#slotGrid .tile[data-slot="board"]'); await p.click('.tile[data-item="board:ocean"]'); await p.click('#bEquip'); await p.waitForTimeout(100);
  ok(await rs(() => window.__rs.worn.board === 'ocean' && window.__rs.lock.wear.board === 'ocean' && document.querySelector('#bEquip').disabled && document.querySelector('.tile[data-item="board:ocean"]').classList.contains('worn')), 'Equip wears it, and marks it');
  await p.click('#bSlotBack'); await p.click('#slotGrid .tile[data-slot="set"]'); await p.click('.tile[data-item="set:blocks"]'); await p.waitForTimeout(150);
  const tris = await rs(() => window.__rs.tris);
  await p.click('#bEquip'); await p.waitForTimeout(100);
  ok(tris < 5000 && await rs(() => window.__rs.S.set === 'blocks' && window.__rs.lock.wear.set === 'blocks'), `a piece set is tried on and worn the same way (${tris} triangles: the Blocks set)`);
  // marks are shown as they'd be in a game; an effect plays once
  await p.click('#bSlotBack'); await p.click('#slotGrid .tile[data-slot="marks"]'); await p.click('.tile[data-item="marks:arrow"]'); await p.waitForTimeout(150);
  ok(await rs(() => window.__rs.marks) >= 4, 'trying Square marks on shows a sample of them on the board');
  await p.click('#bSlotBack'); await p.waitForTimeout(100);
  ok(await rs(() => window.__rs.marks) === 0, 'which goes when the look comes off');
  await p.keyboard.press('Escape');
  ok(await rs(() => !document.querySelector('#sc-home').hidden), 'Esc from the locker goes back to Play');
  await p.reload(); await p.waitForTimeout(1200);
  ok(await rs(() => window.__rs.worn.board === 'ocean' && window.__rs.S.set === 'blocks' && window.__rs.tris < 5000), 'what is worn is kept through a reload');
  ok(!(await p.isVisible('#gift')), 'the day\'s gift comes once: not again on a reload');

  // --- the shop
  await rs(() => window.__rs.lockerEdit(x => { x.coins = 200; }));
  await p.click('.hTab[data-go="cos"]'); await p.click('.cTab[data-c="shop"]'); await p.waitForTimeout(100);
  ok((await rs(() => [...document.querySelectorAll('#shopCases .tile')].map(t => t.querySelector('.tSlot').textContent + ' ' + t.querySelector('.tName').textContent))).join() === 'Bronze 40,Silver 90,Gold 200,Diamond 420,Lucky Box 1500' && (await rs(() => document.querySelectorAll('#shopKeys .tile').length)) === 8, 'the shop sells the five cases and the eight keys');
  ok(/Bronze case: 62% common, 28% rare, 8% epic, 1.6% legendary, 0.4% mythic\./.test(await txt('#shopInfo')) && await txt('#bBuy') === 'Buy for 40', `a case says its chances before you buy ("${await txt('#shopInfo')}")`);
  await p.click('#bBuy'); await p.click('.tile[data-buy="key:finish"]');
  ok(/Finish key: opens any case, and the look is always for Finish\./.test(await txt('#shopInfo')), `a slot's key says what it guarantees ("${await txt('#shopInfo')}")`);
  await p.click('#bBuy'); l = await lock();
  ok(l.coins === 50 && l.cases.bronze === 1 && l.keys.finish === 1 && await txt('#coins') === '50', `buying takes the coins (${l.coins} left)`);
  await p.click('.tile[data-buy="case:lucky"]');
  ok(await txt('#bBuy') === 'Need 1500' && await rs(() => document.querySelector('#bBuy').disabled) && /Never a duplicate/.test(await txt('#shopInfo')), 'a Super Lucky Box says it never gives a duplicate, and can\'t be bought without the coins');
  await p.screenshot({ path: shot('locker-shop.png') });
  await p.click('.cTab[data-c="locker"]'); await p.click('#held .chip2[data-grade="bronze"]'); await p.waitForTimeout(100);
  ok(/The look will be for Finish/.test(await txt('#openNote')), 'with a Finish key the case says the look will be a finish');
  const before = Object.keys((await lock()).owned);
  await p.click('#bOpen'); await p.waitForTimeout(150);
  const got = Object.keys((await lock()).owned).find(k => !before.includes(k));
  ok(got && got.startsWith('finish:'), `and it is (${got})`);
  await p.click('#bPrizeClose');

  // --- the reel, where motion is allowed
  const ctx2 = await b.newContext({ viewport: { width: 700, height: 440 } });
  const q = await ctx2.newPage(); watch(q, log);
  await q.goto(SITE.new); await q.waitForTimeout(1200);
  await q.click('.hTab[data-go="cos"]'); await q.click('#held .chip2[data-grade="silver"]'); await q.click('#bOpen'); await q.waitForTimeout(400);
  const spin = await q.evaluate(() => { const r = document.querySelector('#reelScreen').getBoundingClientRect(), t = document.querySelector('.reelTile').getBoundingClientRect();
    return { stage: window.__rs.opening, tiles: document.querySelectorAll('#reelStrip .reelTile').length, full: !document.querySelector('#reelScreen').hidden && r.left <= 0 && r.top <= 0 && r.width >= innerWidth && r.height >= innerHeight, tile: Math.round(t.height), h: innerHeight, pick: document.querySelector('#openBox').hidden, lit: document.querySelector('#reelScreen').classList.contains('lit') }; });
  ok(spin.stage === 'spin' && spin.tiles > 20 && spin.pick && !spin.lit, `with motion allowed the reel spins first (${spin.tiles} looks on it)`);
  ok(spin.full && spin.tile >= spin.h * 0.3, `and it takes up the whole screen, each look ${spin.tile} px tall in a ${spin.h} px window`);
  await q.screenshot({ path: shot('locker-reel.png') });
  await q.waitForTimeout(1200);
  ok(await q.evaluate(() => window.__rs.opening) === 'spin', 'a second and a half later it is still turning');
  await q.click('#reel'); await q.waitForTimeout(150);
  ok(await q.evaluate(() => window.__rs.opening === 'prize' && document.querySelector('#reelScreen').classList.contains('lit') && !!document.querySelector('#prizeName').textContent), 'a tap on the reel skips to the prize, shown across the whole screen');
  await ctx2.close();

  // --- what a game pays
  await p.click('.hTab[data-go="home"]');
  const MATE = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2';   // Black mates with Qh4
  const c0 = (await lock()).coins;
  await rs(f => { window.__rs.quick = true; window.__rs.startCpu('torben', 'b', f); }, MATE); await p.waitForTimeout(250);
  await tap('d8'); await tap('h4'); await p.waitForTimeout(300);
  l = await lock(); let e = await rs(() => window.__rs.earn);
  ok(l.coins === c0 + 80 && e.coins === 80 && e.cases.join() === 'bronze,bronze,bronze,silver' && l.cases.bronze >= 3 && l.beaten.join() === 'torben', `beating Torben pays 80 coins and three Bronze cases, and for the first win a Silver case too (${JSON.stringify(e)})`);
  ok(await p.isVisible('#overEarn') && await txt('#overEarn') === '+80 coins, 3 Bronze cases, first win: a Silver case' && await txt('#overMoves') === '1 move', `the result says so, and "1 move", not "1 moves" ("${await txt('#overEarn')}")`);
  await p.screenshot({ path: shot('locker-earn.png') });
  await p.click('#bLook'); await p.click('#bUndo'); await p.waitForTimeout(150); await tap('d8'); await tap('h4'); await p.waitForTimeout(300);
  ok((await lock()).coins === c0 + 80, 'taking the mate back and playing it again pays nothing more: a game pays once');
  await p.click('#bAgain'); await p.waitForTimeout(200);
  await rs(f => window.__rs.startCpu('torben', 'b', f), MATE); await p.waitForTimeout(200); await tap('d8'); await tap('h4'); await p.waitForTimeout(300);
  e = await rs(() => window.__rs.earn);
  ok(e.coins === 80 && e.cases.join() === 'bronze,bronze,bronze' && !e.first && await txt('#overEarn') === '+80 coins, 3 Bronze cases', 'a second win against the same bot pays the coins and three cases ("+80 coins, 3 Bronze cases")');
  await rs(() => window.__rs.startCpu('ted', 'w')); await p.waitForTimeout(200);
  const c1 = (await lock()).coins;
  await p.click('#bMenu'); await p.click('#bResign'); await p.click('#bResign'); await p.waitForTimeout(250);
  ok((await lock()).coins === c1 && !(await p.isVisible('#overEarn')), 'a loss pays nothing');
  await p.click('#bOverMenu'); await p.waitForTimeout(150);
  await rs(f => window.__rs.start2(f), MATE); await p.waitForTimeout(200); await tap('d8'); await tap('h4'); await p.waitForTimeout(300);
  ok((await lock()).coins === c1 && !(await p.isVisible('#overEarn')), 'nor does a game for two players on one device');
  await p.click('#bOverMenu'); await p.waitForTimeout(150);
  // --- the day's gift over days running
  const c2 = (await lock()).coins;
  const days = await rs(() => { const r = []; for (const d of ['2031-03-01', '2031-03-02', '2031-03-02', '2031-03-03']) { const c = window.__rs.lock.coins; window.__rs.day(d); r.push(window.__rs.lock.coins - c); } return r; });
  ok(days.join() === '40,50,0,60' && /day 3 of 7/.test(await txt('#gift')), `the gift grows over days running and comes once a day (${days.join(', ')} coins)`);

  // --- dev mode, with a stand-in word
  const real = await lock();
  await rs(print => { window.__rs.DEVW.print = print; }, crypto.createHash('sha256').update('retroRack:testword').digest('hex'));
  await p.click('#bOnline'); await p.fill('#netName', 'testword'); await until(() => rs(() => window.__rs.dev));
  l = await lock();
  ok(await rs(() => window.__rs.dev) && Object.keys(l.owned).length === 70 && l.coins === 100000 && / DEV$/.test(await txt('#ver')) && await rs(() => document.querySelector('#netName').value) === '', 'typing the dev word as the online name switches on a test locker with every look (and clears the box)');
  await p.click('#mBack'); await p.click('.hTab[data-go="cos"]'); await p.click('#slotGrid .tile[data-slot="finish"]'); await p.waitForTimeout(100);
  ok((await tiles('#itemGrid .tile')).length === 16 && /\(test\)/.test(await txt('#coins')), 'in dev mode a slot shows every look, and the coins say they are the test locker\'s');
  await p.screenshot({ path: shot('locker-dev.png') });
  await p.click('.tile[data-item="finish:rainbow"]'); await p.click('#bEquip');
  await p.click('.hTab[data-go="home"]'); await p.click('#bOnline'); await p.fill('#netName', 'testword'); await until(() => rs(() => !window.__rs.dev));
  l = await lock();
  ok(!(await rs(() => window.__rs.dev)) && l.coins === real.coins && Object.keys(l.owned).length === Object.keys(real.owned).length && await rs(() => window.__rs.S.finish) !== 'rainbow', 'the word again switches it off: the real locker is back, untouched, and the test locker\'s looks come off');
  await p.click('#mBack');

  // --- another open page: a change made there shows here
  const p2 = await ctx.newPage(); watch(p2, log);
  await p2.goto(SITE.new); await p2.waitForTimeout(1000);
  await rs(() => window.__rs.day());   // today's gift now, so it can't arrive in the middle of the check
  await p.click('.hTab[data-go="cos"]'); const cBefore = await txt('#coins'), c3 = (await lock()).coins;
  await p2.evaluate(() => window.__rs.lockerEdit(x => { x.coins += 1000; }));
  ok(await until(async () => (await txt('#coins')) !== cBefore) && (await lock()).coins === c3 + 1000, 'coins earned in another open page show here at once, and neither page undoes the other');
  await p2.close(); await ctx.close();

  // --- online: each side wears its owner's pieces and avatar
  const code = 'LK' + Date.now().toString(36).slice(-3).toUpperCase();
  const mk = async (name, wear) => {
    const c = await b.newContext({ viewport: { width: 640, height: 440 }, reducedMotion: 'reduce' });
    await c.addInitScript(([n, w]) => { try { localStorage.setItem('retroSet.name', n); if (!localStorage.getItem('retroSet.locker')) localStorage.setItem('retroSet.locker', JSON.stringify({ coins: 0, owned: Object.fromEntries(Object.entries(w).map(([s, id]) => [s + ':' + id, 1])), wear: w, daily: { last: '2099-01-01', streak: 1 } })); } catch (e) {} }, [name, wear]);
    const pg = await c.newPage(); watch(pg, log); await pg.goto(SITE.new + RELAY + '#room=' + code); return pg;
  };
  const A = await mk('Ada', { set: 'blocks', finish: 'neon', avatar: 'robot' }), B = await mk('Bo', { set: 'classic', finish: 'wood', avatar: 'cap' });
  ok(await until(async () => (await A.evaluate(() => window.__rs.net.started)) && (await B.evaluate(() => window.__rs.net.started))), 'two players with different looks start an online game');
  const side = async pg => pg.evaluate(() => ({ me: window.__rs.net.me, of: window.__rs.lookOf, peer: window.__rs.peerLook, faces: [...document.querySelectorAll('#bar .plFace img')].length }));
  let a = await side(A), bo = await side(B);
  const other = c => c === 'w' ? 'b' : 'w';
  ok(a.of[a.me].set === 'blocks' && a.of[a.me].finish === 'neon' && a.of[other(a.me)].set === 'classic' && a.of[other(a.me)].finish === 'wood' && bo.of[bo.me].finish === 'wood' && bo.of[other(bo.me)].set === 'blocks' && bo.of[other(bo.me)].finish === 'neon',
    `each side's pieces wear their owner's set and finish, on both screens (${JSON.stringify(a.of)})`);
  ok(a.peer.avatar === 'cap' && bo.peer.avatar === 'robot' && a.faces === 2 && bo.faces === 2, 'and each player\'s avatar shows beside their name, on both screens');
  await A.screenshot({ path: shot('locker-online.png') });
  await B.click('#bMenu'); await B.click('.sTab[data-tab="board"]'); await B.click('.seg[data-key="mySet"] .btn[data-v="1"]'); await B.click('.sTab[data-tab="match"]'); await B.click('#bResumeGame');
  bo = await side(B);
  ok(bo.of.w.set === 'classic' && bo.of.b.set === 'classic' && bo.of.w.finish === 'wood' && bo.of.b.finish === 'wood', 'with "My set only" on, both sides wear your own pieces');
  await A.evaluate(() => window.__rs.send({ t: 'hello', name: 'Ada', started: true, n: 0, v: document.querySelector('#ver').textContent.replace('Version ', ''), look: { set: 'made-up', finish: 7, avatar: '<img>' } }));
  ok(await until(async () => { const pl = await B.evaluate(() => window.__rs.peerLook); return pl.set === 'classic' && pl.finish === 'classic' && pl.avatar === 'plain'; }), 'looks the catalogue doesn\'t know, sent by a modified copy, become the free ones');
  ok(!log.length, 'console clean' + (log.length ? ':\n  ' + log.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
