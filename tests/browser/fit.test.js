// Every screen fits without scrolling at phone, tablet and computer sizes, including a phone on its side (762x341): the home screen (with and without a game to resume), every Settings tab, the Cosmetics tab (the locker, opening a case, the shop, a full slot, the Trade page and a trade room), Vs computer, Online, New room, the waiting room, the game's bar and buttons, the Confirm bar, and every tab of the game's Menu panels (menu, promotion, result, a draw offer, quick chat).
const { chromium, SITE, RELAY, shot, watch, ok } = require('./lib');   // over http: the checks reload the page, and storage must carry over
const overlap = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
(async () => {
  const b = await chromium.launch(); const log = [];
  for (const [w, h] of [[762, 341], [740, 360], [915, 412], [412, 915], [375, 667], [1000, 640], [1280, 720]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }); watch(p, log);
    const fits = sel => p.evaluate(sel => {
      const el = document.querySelector(sel), r = el.getBoundingClientRect();
      return { down: el.scrollHeight - el.clientHeight, across: el.scrollWidth - el.clientWidth, on: r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 };
    }, sel);
    const say = (r, what) => `${w}x${h}: ${what} fits on screen without scrolling${r.on ? '' : ' (off screen)'}${r.down > 1 ? ` (needs ${r.down}px down)` : ''}${r.across > 1 ? ` (needs ${r.across}px across)` : ''}`;
    const good = r => r.down <= 1 && r.across <= 1 && r.on;
    await p.goto(SITE.new + RELAY); await p.waitForTimeout(700);
    await p.evaluate(() => localStorage.removeItem('retroSet.game')); await p.reload(); await p.waitForTimeout(500);
    // the Play screen: the top bar, and the tiles along the bottom, apart and on the screen
    const homeFits = () => p.evaluate(() => { const b = document.querySelector('#topBar').getBoundingClientRect(), h = document.querySelector('#sc-home').getBoundingClientRect(), tabs = [...document.querySelectorAll('#topBar .hTab, #coins, #bSettings')].map(e => e.getBoundingClientRect());
      return { down: 0, across: Math.max(document.querySelector('#topBar').scrollWidth - document.querySelector('#topBar').clientWidth, document.querySelector('#sc-home').scrollWidth - document.querySelector('#sc-home').clientWidth), on: h.top >= b.bottom - 1 && h.bottom <= innerHeight + 1 && tabs.every(r => r.right <= innerWidth + 1 && r.bottom <= b.bottom + 1) }; });
    let r = await homeFits(), r2;
    ok(good(r), say(r, 'the Play screen'));
    // with a game to resume, the home screen has its Resume button too
    await p.evaluate(() => localStorage.setItem('retroSet.game', JSON.stringify({ v: 1, start: window.__rs.start, moves: ['e2e4', 'e7e5'] }))); await p.reload(); await p.waitForTimeout(500);
    r = await homeFits();
    ok(good(r) && await p.isVisible('#bResume'), say(r, 'the Play screen with Continue'));
    if (w === 762) await p.screenshot({ path: shot('fit-home-phone.png') });
    // Settings: each of its tabs, in the menu
    await p.click('#bSettings'); await p.waitForTimeout(150);
    for (const t of ['game', 'board', 'display', 'device']) {
      await p.click(`.sTab[data-tab="${t}"]`); await p.waitForTimeout(60);
      r = await fits('#mStage'); r2 = await fits('#menuPanel');
      ok(good(r) && good(r2), say({ ...r, on: r2.on }, `Settings, ${t}`));
    }
    if (w === 762) await p.screenshot({ path: shot('fit-settings-phone.png') });
    await p.click('.hTab[data-go="home"]'); await p.waitForTimeout(150);
    // Cosmetics: the locker, the case-opening panel and its prize, the shop, and a slot with every look in it
    await p.click('.hTab[data-go="locker"]'); await p.waitForTimeout(150);
    r = await fits('#mStage'); r2 = await fits('#menuPanel');
    ok(good(r) && good(r2), say({ ...r, on: r2.on }, 'Cosmetics, the locker'));
    if (w === 762) await p.screenshot({ path: shot('fit-locker-phone.png') });
    await p.click('#held .chip2[data-grade="silver"]'); await p.waitForTimeout(100);
    r = await fits('#openPanel'); ok(good(r) && await p.isVisible('#openBox'), say(r, 'opening a case'));
    await p.click('#bOpen'); await p.waitForTimeout(150);
    const pz = await p.evaluate(() => { const on = s => { const r = document.querySelector(s).getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; }, rs = document.querySelector('#reelScreen').getBoundingClientRect();
      return { full: rs.left <= 0 && rs.top <= 0 && rs.width >= innerWidth && rs.height >= innerHeight, on: ['#rsTitle', '.reelTile.won', '#prizeName', '#prizeNote', '#prizeBtns'].every(on) }; });
    ok(pz.full && pz.on, `${w}x${h}: a case's reel and prize take up the whole screen, the look, its name and the buttons all on it (${JSON.stringify(pz)})`);
    await p.click('#bPrizeClose');
    await p.click('.hTab[data-go="store"]'); await p.waitForTimeout(100);
    for (const buy of ['case:bronze', 'case:lucky', 'key:marks']) { await p.click(`.tile[data-buy="${buy}"]`); r = await fits('#mStage'); r2 = await fits('#menuPanel'); ok(good(r) && good(r2), say({ ...r, on: r2.on }, `the shop, ${buy}`)); }
    if (w === 762) await p.screenshot({ path: shot('fit-shop-phone.png') });
    await p.evaluate(() => window.__rs.lockerEdit(l => { for (const it of window.__rs.LK.ITEMS) l.owned[it.key] = 2; }));
    await p.click('.hTab[data-go="locker"]'); await p.click('#slotGrid .tile[data-slot="finish"]'); await p.waitForTimeout(100);
    r = await fits('#mStage'); r2 = await fits('#menuPanel');
    ok(good(r) && good(r2) && (await p.evaluate(() => document.querySelectorAll('#itemGrid .tile').length)) === 16, say({ ...r, on: r2.on }, 'a slot with all sixteen of its looks'));
    if (w === 762) await p.screenshot({ path: shot('fit-slot-phone.png') });
    // Trade: its page, the trade room waiting, then with someone in it: your things, theirs, something asked for, the countdown
    await p.click('#bSlotBack'); await p.click('.hTab[data-go="trade"]'); await p.waitForTimeout(350);
    r = await fits('#mStage'); r2 = await fits('#menuPanel');
    ok(good(r) && good(r2), say({ ...r, on: r2.on }, 'Cosmetics, the Trade page'));
    if (w === 762) await p.screenshot({ path: shot('fit-trade-page-phone.png') });
    await p.evaluate(() => window.__rs.lockerEdit(l => { l.cases.gold = 3; l.keys.any = 2; l.coins = 900; }));
    await p.click('#trListed .btn[data-v="0"]'); await p.click('#bTrCreate'); await p.waitForFunction(() => window.__rs.trade.link === 'online');
    r = await fits('#tradePanel'); ok(good(r) && await p.isVisible('#trWait'), say(r, 'a trade room, waiting'));
    const q = await b.newPage({ viewport: { width: 500, height: 400 }, reducedMotion: 'reduce' }); watch(q, log);
    await q.goto(SITE.new + RELAY); await q.waitForTimeout(500); await q.evaluate(() => { localStorage.setItem('retroSet.name', 'Wolfeschlegels'); window.__rs.lockerEdit(l => { for (const it of window.__rs.LK.ITEMS) l.owned[it.key] = 2; }); });
    await q.goto(SITE.new + RELAY + '#trade=' + await p.evaluate(() => window.__rs.trade.code)); await q.reload();
    await p.waitForFunction(() => window.__rs.trade.seen); await q.waitForFunction(() => window.__rs.trade.seen);
    await p.click('#trFilter .btn[data-f="finish"]'); for (const id of ['finish:neon', 'finish:molten', 'finish:ice']) await p.click(`#trGrid .tile[data-id="${id}"]`);
    await p.click('#trFilter .btn[data-f="cases"]'); await p.click('#trGrid .tile[data-id="case:gold"]'); await p.fill('#trCoins', '120'); await p.click('#trFilter .btn[data-f="finish"]');
    r = await fits('#tradePanel'); ok(good(r) && (await p.evaluate(() => document.querySelectorAll('#trGrid .tile').length)) === 15, say(r, 'a trade room, your fifteen finishes and an offer of four things and coins'));
    if (w === 762) await p.screenshot({ path: shot('fit-trade-phone.png') });
    await q.click('#trSideSeg .btn[data-side="theirs"]'); await q.click('#bTrNew'); await q.click('#trFilter .btn[data-f="board"]'); await q.click('#trGrid .tile[data-id="board:lava"]'); await q.click('#bTrAsk');
    await p.waitForFunction(() => window.__rs.trade.asks.length === 1);
    await p.click('#trSideSeg .btn[data-side="theirs"]'); await p.click('#bTrNew'); await p.waitForTimeout(60);
    r = await fits('#tradePanel'); ok(good(r) && (await p.evaluate(() => document.querySelectorAll('#trGrid .tile').length)) === 15 && await p.isVisible('#bTrAdd') && await p.isVisible('#bTrNew'), say(r, 'a trade room, their things, with something asked for'));
    if (w === 762) await p.screenshot({ path: shot('fit-trade-theirs-phone.png') });
    if (w === 375) await p.screenshot({ path: shot('fit-trade-theirs-upright.png') });
    await p.click('#bTrNo'); await p.click('#bTrReady'); await q.waitForFunction(() => window.__rs.trade.ready[1]); await q.click('#bTrReady'); await p.waitForFunction(() => window.__rs.trade.counting);
    r = await fits('#tradePanel'); ok(good(r) && await p.isVisible('#bTrBack'), say(r, 'a trade room, counting down'));
    await p.click('#bTrBack'); await p.click('#bTrLeave'); await q.close();
    await p.click('.hTab[data-go="home"]'); await p.waitForTimeout(150);
    // Vs computer: the eight bots, the line about the one picked, your colour and Play
    await p.click('#bCpu'); await p.waitForTimeout(200);
    r = await fits('#mStage'); r2 = await fits('#menuPanel');
    const play = await p.evaluate(() => { const r = document.querySelector('#bPlay').getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth; });
    ok(good(r) && good(r2) && play, say({ ...r, on: r2.on && play }, 'Vs computer'));
    if (w === 762) await p.screenshot({ path: shot('fit-cpu-phone.png') });
    await p.click('#mBack'); await p.waitForTimeout(150);
    // Online: your name, the open rooms, join with a code, create a room; then New room; then the waiting room
    await p.click('#bOnline'); await p.waitForTimeout(250);
    r = await fits('#mStage'); r2 = await fits('#menuPanel');
    const create = await p.evaluate(() => { const r = document.querySelector('#bCreate').getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth; });
    ok(good(r) && good(r2) && create, say({ ...r, on: r2.on && create }, 'Online'));
    if (w === 762) await p.screenshot({ path: shot('fit-online-phone.png') });
    await p.click('#bCreate'); await p.waitForTimeout(150);
    r = await fits('#mStage'); r2 = await fits('#menuPanel');
    ok(good(r) && good(r2), say({ ...r, on: r2.on }, 'New room'));
    await p.click('#bStart'); await p.waitForTimeout(400);
    r = await fits('#lobbyPanel');
    ok(good(r) && await p.isVisible('#lobby'), say(r, 'the waiting room'));
    if (w === 762) await p.screenshot({ path: shot('fit-waiting-phone.png') });
    await p.click('#bLobbyCancel'); await p.waitForTimeout(200);
    await p.evaluate(() => { while (document.querySelector('#mBack') && !document.querySelector('#mTop').hidden) document.querySelector('#mBack').click(); });
    // in a game: the bar, the moves and the buttons keep clear of each other
    await p.click('#bResume'); await p.waitForTimeout(300);
    const boxes = await p.evaluate(() => Object.fromEntries(['#plW', '#mid', '#plB', '#movesBox', '#tools'].map(s => { const e = document.querySelector(s), r = e.getBoundingClientRect(); return [s, getComputedStyle(e).display === 'none' ? null : { left: r.left, right: r.right, top: r.top, bottom: r.bottom }]; })));
    const bad = []; const ks = Object.keys(boxes);
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) if (overlap(boxes[ks[i]], boxes[ks[j]])) bad.push(`${ks[i]} and ${ks[j]}`);
    const inView = Object.values(boxes).every(r => !r || (r.left >= 0 && r.right <= w && r.top >= 0 && r.bottom <= h));
    ok(!bad.length && inView, `${w}x${h}: the game's bar, moves and buttons are on screen and don't overlap${bad.length ? ': ' + bad.join(', ') : ''}`);
    if (w === 762) await p.screenshot({ path: shot('fit-game-phone.png') });
    // a draw offer and the quick chat buttons, as they appear in an online game
    await p.evaluate(() => { document.querySelector('#offerTxt').textContent = 'Alexander offers a draw.'; document.querySelector('#offer').hidden = false; });
    r = await fits('#offer .ovPanel'); ok(good(r), say(r, 'a draw offer'));
    await p.evaluate(() => { document.querySelector('#offer').hidden = true; document.querySelector('#bChat').hidden = false; document.querySelector('#chatPop').hidden = false; });
    const chat = await p.evaluate(() => { const c = document.querySelector('#chatPop').getBoundingClientRect(), t = document.querySelector('#tools').getBoundingClientRect(), b = document.querySelector('#bar').getBoundingClientRect();
      return { on: c.top >= 0 && c.left >= 0 && c.bottom <= innerHeight && c.right <= innerWidth, clear: c.bottom <= t.top + 1 && c.top >= b.bottom - 1 }; });
    ok(chat.on && chat.clear, `${w}x${h}: the quick chat buttons are on screen, clear of the bar and the buttons below (${JSON.stringify(chat)})`);
    await p.evaluate(() => { document.querySelector('#chatPop').hidden = true; document.querySelector('#bChat').hidden = true; });
    // a move waiting for Confirm: its bar is on screen, clear of the bar above and the buttons below
    await p.evaluate(() => { document.querySelector('#confirmTxt').textContent = 'Play Qxh7#?'; document.querySelector('#confirm').hidden = false; });
    const conf = await p.evaluate(() => { const c = document.querySelector('#confirm').getBoundingClientRect(), t = document.querySelector('#tools').getBoundingClientRect(), b = document.querySelector('#bar').getBoundingClientRect();
      return { on: c.top >= 0 && c.left >= 0 && c.bottom <= innerHeight && c.right <= innerWidth, clear: c.bottom <= t.top + 1 && c.top >= b.bottom - 1 }; });
    ok(conf.on && conf.clear, `${w}x${h}: the Confirm bar is on screen, clear of the bar and the buttons below (${JSON.stringify(conf)})`);
    await p.evaluate(() => { document.querySelector('#confirm').hidden = true; });
    await p.click('#bMenu'); await p.waitForTimeout(150);
    for (const t of ['match', 'game', 'board', 'display', 'device']) {
      await p.click(`.sTab[data-tab="${t}"]`); await p.waitForTimeout(60);
      r = await fits('#pause .ovPanel'); ok(good(r), say(r, `the menu panel, ${t}`));
    }
    if (w === 762) await p.screenshot({ path: shot('fit-menu-phone.png') });
    await p.click('.sTab[data-tab="match"]'); await p.click('#bResumeGame');
    await p.evaluate(() => window.__rs.start2('8/4P3/8/8/8/8/k7/4K3 w - - 0 1')); await p.waitForTimeout(200);
    for (const n of ['e7', 'e8']) { const [x, y] = await p.evaluate(n => window.__rs.squareScreen(n), n); await p.mouse.click(x, y); await p.waitForTimeout(150); }
    r = await fits('#promo .ovPanel'); ok(good(r) && await p.isVisible('#promo'), say(r, 'the promotion choice'));
    if (w === 762) await p.screenshot({ path: shot('fit-promo-phone.png') });
    await p.click('#bPromoCancel'); await p.click('#bMenu'); await p.click('#bResign'); await p.click('#bResign'); await p.waitForTimeout(200);
    r = await fits('#over .ovPanel'); ok(good(r) && await p.isVisible('#over'), say(r, 'the result panel'));
    await p.close();
  }
  ok(!log.length, 'console clean' + (log.length ? ':\n  ' + log.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
