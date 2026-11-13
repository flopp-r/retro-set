// Trading: the Trade page of the Cosmetics tab (open trade rooms, a code, a link), a trade room kept apart from the game rooms, each player seeing the other's things but never their coins, "Only what I don't have", marking and asking (Add and No), offers of several things and coins, Ready, a changed offer clearing both marks, the 5-second countdown and backing out of it, nothing moving until it ends, the swap in both lockers, a worn look given away, doctored messages, leaving and coming back, a reload, a full room, and two versions.
const { chromium, SITE, RELAY, shot, watch, ok } = require('./lib');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch (e) {} await sleep(150); } return false; }
(async () => {
  const b = await chromium.launch(), log = [];
  // a player with a name and a locker of their own (each in its own browser context, so its own storage)
  const mk = async (name, locker, site = SITE.new, size = { width: 820, height: 480 }) => {
    const c = await b.newContext({ viewport: size, reducedMotion: 'reduce' });
    await c.addInitScript(([n, l]) => { try { localStorage.setItem('retroSet.name', n); if (!localStorage.getItem('retroSet.locker')) localStorage.setItem('retroSet.locker', JSON.stringify({ ...l, daily: { last: '2099-01-01', streak: 1 } })); } catch (e) {} }, [name, locker]);
    const pg = await c.newPage(); watch(pg, log); await pg.goto(site + RELAY); await pg.waitForTimeout(900); return pg;
  };
  const tr = pg => pg.evaluate(() => JSON.parse(JSON.stringify(window.__rs.trade)));
  const lock = pg => pg.evaluate(() => JSON.parse(JSON.stringify(window.__rs.lock)));
  const txt = (pg, sel) => pg.evaluate(sel => document.querySelector(sel).textContent, sel);
  const names = (pg, sel) => pg.evaluate(sel => [...document.querySelectorAll(sel)].map(t => (t.querySelector('.tName') || t).textContent), sel);
  const side = async (pg, s, f) => { await pg.click(`#trSideSeg .btn[data-side="${s}"]`); if (f) await pg.click(`#trFilter .btn[data-f="${f}"]`); };
  const both = async f => (await f(A)) && (await f(B));

  const A = await mk('Ada', { coins: 500, owned: { 'finish:neon': 2, 'set:blocks': 1, 'board:ocean': 1 }, wear: { set: 'blocks' }, cases: { gold: 2 }, keys: { any: 1 } });
  const B = await mk('Bo', { coins: 100, owned: { 'finish:neon': 1, 'finish:wood': 1, 'avatar:robot': 1 }, cases: { bronze: 1 }, keys: { board: 1 } });

  const ca = (await lock(A)).coins, cb = (await lock(B)).coins;   // what each starts with (the day's gift is on top of the locker given)
  // --- the Trade page, and a listed trade room
  await A.click('.hTab[data-go="trade"]');
  ok((await A.evaluate(() => [...document.querySelectorAll('.hTab')].map(t => t.textContent + (t.getAttribute('aria-selected') === 'true' ? '*' : '')))).join() === 'Play,Locker,Store,Trade*' && await A.isVisible('#cTrade') && !(await A.isVisible('#cLocker')), 'Trade is a section of the top bar, beside Locker and Store');
  ok(await until(async () => /No open trade rooms/.test(await txt(A, '#trRooms')) && await txt(A, '#trLive') === 'Live'), 'it watches the open trade rooms (none yet)');
  await A.screenshot({ path: shot('trade-page.png') });
  await A.click('#bTrCreate');
  ok(await until(async () => (await tr(A)).link === 'online'), 'Create trade room opens a trade room');
  let a = await tr(A), bo;
  const code = a.code;
  ok(/^[A-Z0-9]{5}$/.test(code) && await txt(A, '#trCodeBig') === code && new RegExp('#trade=' + code + '$').test(await A.inputValue('#trLink')) && /Waiting for a trade partner\. Listed/.test(await txt(A, '#trNote')) && !(await A.isVisible('#bTrReady')),
    `the room shows its code and an invite link ending #trade=${code}, and waits`);
  // --- separate from the game rooms: listed under trade rooms only
  await B.click('#bOnline');
  ok(await until(async () => await txt(B, '#roomsLive') === 'Live') && /No open rooms/.test(await txt(B, '#roomList')), 'the Online screen\'s open rooms don\'t list a trade room');
  await B.click('#mBack'); await B.click('.hTab[data-go="trade"]');
  ok(await until(async () => /Ada's Trade Room/.test(await txt(B, '#trRooms'))), 'the Trade page lists it: "Ada\'s Trade Room"');
  await B.click('#trRooms .roomItem .btn');
  ok(await until(() => both(async pg => (await tr(pg)).seen)), 'Join brings the second player in');
  ok(await txt(A, '#trTitle') === 'Trade with Bo' && await txt(B, '#trTitle') === 'Trade with Ada' && await A.isVisible('#bTrReady') && await A.evaluate(() => document.querySelector('#bTrReady').disabled), 'each sees who they are trading with; Ready waits for something to be offered');
  // --- the other player's things, never their coins
  a = await tr(A); bo = await tr(B);
  ok(JSON.stringify(a.inv.items) === JSON.stringify({ 'finish:wood': 1, 'finish:neon': 1, 'avatar:robot': 1 }) && a.inv.cases.bronze === 1 && a.inv.keys.board === 1 && a.inv.coins === 0 && bo.inv.coins === 0 && bo.inv.items['finish:neon'] === 2 && bo.inv.cases.gold === 2,
    'each page has the other\'s looks, cases and keys (not the free looks), and not how many coins they have');
  await side(A, 'theirs', 'finish');
  ok((await names(A, '#trGrid .tile')).join() === 'Wood' && await A.evaluate(() => document.querySelector('#bTrNew').getAttribute('aria-pressed')) === 'true', 'Their items, with "Only what I don\'t have" on: Bo\'s Wood, but not the Neon Ada already has');
  await A.click('#bTrNew');
  ok((await names(A, '#trGrid .tile')).join() === 'Wood,Neon' && await A.evaluate(() => document.querySelector('#trGrid .tile[data-id="finish:neon"]').classList.contains('have')), 'switched off, everything of Bo\'s in the slot shows, the ones Ada has dimmed');
  await side(A, 'theirs', 'cases');
  ok((await names(A, '#trGrid .tile')).join() === 'Bronze Case,Board Key', 'and Bo\'s unopened cases and keys');
  await A.click('#bTrNew');
  // --- mark and ask: a short notice on the other screen, with Add and No
  await side(A, 'theirs', 'finish'); await A.click('#trGrid .tile[data-id="finish:wood"]');
  ok(await A.evaluate(() => document.querySelector('#trGrid .tile[data-id="finish:wood"]').classList.contains('marked')) && (await tr(A)).marks.join() === 'finish:wood', 'tapping one of their things marks it');
  await A.click('#bTrAsk');
  ok(await until(async () => await txt(B, '#trNote') === 'Ada requests Wood.') && await B.isVisible('#bTrAdd') && await B.isVisible('#bTrNo') && /Request sent to Bo: Wood/.test(await txt(A, '#trNote')), 'Ask for it sends a short notice: "Ada asks for Wood." with Add and No');
  await A.screenshot({ path: shot('trade-ask-a.png') }); await B.screenshot({ path: shot('trade-ask-b.png') });
  await B.click('#bTrAdd');
  ok(await until(async () => (await tr(A)).theirs.items['finish:wood'] === 1) && (await names(A, '#trTheirs .chip2')).join() === 'Wood' && (await names(B, '#trMine .chip2')).join() === 'Wood', 'Add puts it into what they give, on both screens');
  await side(A, 'theirs', 'avatar'); await A.click('#trGrid .tile[data-id="avatar:robot"]'); await A.click('#bTrAsk');
  await until(async () => /requests Robot/.test(await txt(B, '#trNote'))); await B.click('#bTrNo');
  ok(await until(async () => await txt(A, '#trNote') === 'Bo declined the request for Robot.') && !(await tr(B)).mine.items['avatar:robot'] && !(await B.isVisible('#bTrAdd')), 'No leaves it out, and the asker is told');
  // --- an offer of several things, and coins
  await side(A, 'mine', 'finish'); await A.click('#trGrid .tile[data-id="finish:neon"]');
  ok(await A.evaluate(() => { const t = document.querySelector('#trGrid .tile[data-id="finish:neon"]'); return t.classList.contains('inOffer') && t.querySelector('.tNum').textContent === '1/2'; }), 'tapping one of your own things offers it: one of the two Neons (1/2)');
  await side(A, 'mine', 'cases'); await A.click('#trGrid .tile[data-id="case:gold"]');
  await A.fill('#trCoins', '50');
  ok(await until(async () => { const t = (await tr(B)).theirs; return t.items['finish:neon'] === 1 && t.cases.gold === 1 && t.coins === 50; }) && (await names(B, '#trTheirs .chip2')).join() === 'Neon,Gold Case' && /\+ 50 coins/.test(await txt(B, '#trTheirCoins')),
    'the other player sees the whole offer: Neon, a Gold case and 50 coins');
  ok(!new RegExp(ca).test(await B.evaluate(() => document.querySelector('#tradePanel').textContent)), 'but nowhere how many coins Ada has');
  await A.fill('#trCoins', '99999');
  ok(await until(async () => (await tr(A)).mine.coins === ca) && await A.inputValue('#trCoins') === String(ca), `coins can't be offered beyond what you hold (${ca})`);
  await A.fill('#trCoins', '50'); await until(async () => (await tr(B)).theirs.coins === 50);
  // --- Ready, and a changed offer clearing both marks
  await A.click('#bTrReady');
  ok(await until(async () => (await tr(B)).ready[1]) && (await tr(A)).ready[0] && /Ada is ready/.test(await txt(B, '#trNote')) && /Waiting for Bo\./.test(await txt(A, '#trNote')) && await txt(B, '#trTheirsH') === 'Ada\'s Offer · Ready', 'Ready shows on both screens');
  await side(B, 'mine', 'cases'); await B.click('#trGrid .tile[data-id="case:bronze"]');
  ok(await until(() => both(async pg => { const t = await tr(pg); return !t.ready[0] && !t.ready[1]; })) && /changed their offer\. Ready status cleared/.test(await txt(A, '#trNote')) && /Offer changed\. Ready status cleared/.test(await txt(B, '#trNote')), 'changing an offer clears Ready for both, and says so');
  // --- both ready: the countdown, and backing out of it
  const before = [await lock(A), await lock(B)];
  await A.click('#bTrReady'); await until(async () => (await tr(B)).ready[1]); await B.click('#bTrReady');
  ok(await until(() => both(async pg => (await tr(pg)).counting)), 'with both ready, a countdown starts on both screens');
  ok(/^Trading in [45]…$/.test(await txt(A, '#trNote')) && await A.isVisible('#bTrBack') && await B.isVisible('#bTrBack') && !(await A.isVisible('#bTrReady')), `it counts down from 5 ("${await txt(A, '#trNote')}"), with Back out in place of Ready`);
  await A.screenshot({ path: shot('trade-countdown.png') });
  await sleep(1500);
  ok(JSON.stringify(await lock(A)) === JSON.stringify(before[0]) && JSON.stringify(await lock(B)) === JSON.stringify(before[1]), 'nothing moves while it runs');
  await B.click('#bTrBack');
  ok(await until(() => both(async pg => { const t = await tr(pg); return !t.counting && !t.ready[0] && !t.ready[1]; })) && /Bo backed out/.test(await txt(A, '#trNote')) && /You backed out/.test(await txt(B, '#trNote')), 'Back out stops it on both screens and clears Ready');
  await sleep(4500);
  ok(JSON.stringify(await lock(A)) === JSON.stringify(before[0]) && JSON.stringify(await lock(B)) === JSON.stringify(before[1]) && (await tr(A)).trades === 0, 'and nothing was traded');
  // a changed offer stops a countdown too
  await A.click('#bTrReady'); await until(async () => (await tr(B)).ready[1]); await B.click('#bTrReady'); await until(() => both(async pg => (await tr(pg)).counting));
  await A.fill('#trCoins', '60');
  ok(await until(() => both(async pg => { const t = await tr(pg); return !t.counting && !t.ready[0] && !t.ready[1]; })) && (await tr(B)).theirs.coins === 60, 'changing an offer during the countdown stops it');
  await A.fill('#trCoins', '50'); await until(async () => (await tr(B)).theirs.coins === 50);
  // --- the trade itself
  await A.click('#bTrReady'); await until(async () => (await tr(B)).ready[1]); await B.click('#bTrReady');
  const t0 = Date.now();
  ok(await until(() => both(async pg => (await tr(pg)).trades === 1), 12000), 'left to run, the countdown ends in the trade');
  const took = Date.now() - t0;
  ok(took > 4500, `after its 5 seconds (${(took / 1000).toFixed(1)} s)`);
  let la = await lock(A), lb = await lock(B);
  ok(la.owned['finish:neon'] === 1 && la.owned['finish:wood'] === 1 && la.cases.gold === 1 && la.cases.bronze === 1 && la.coins === ca - 50, `Ada's locker: one Neon and a Gold case fewer, 50 coins fewer, Wood and a Bronze case more (${la.coins} coins)`);
  ok(lb.owned['finish:neon'] === 2 && !lb.owned['finish:wood'] && lb.cases.gold === 1 && lb.cases.bronze === 0 && lb.coins === cb + 50, `Bo's locker: the other way round (${lb.coins} coins)`);
  ok(/^Trade complete\. You received Wood, Bronze Case\.$/.test(await txt(A, '#trNote')) && /You received Neon, Gold Case, 50 coins/.test(await txt(B, '#trNote')), `both are told what they got ("${await txt(A, '#trNote')}")`);
  ok(await until(async () => { const t = await tr(A); return !t.inv.items['finish:wood'] && t.inv.items['finish:neon'] === 2 && !Object.keys(t.mine.items).length && !Object.keys(t.theirs.items).length; }), 'the offers are empty again and each page has the other\'s new list');
  await A.screenshot({ path: shot('trade-done.png') });
  // --- a gift of a worn look, and its only copy
  await A.evaluate(() => { window.__rs.tradeSecs = 1; }); await B.evaluate(() => { window.__rs.tradeSecs = 1; });
  await side(A, 'mine', 'set');
  ok(await A.evaluate(() => document.querySelector('#trGrid .tile[data-id="set:blocks"]').classList.contains('worn')) && (await A.evaluate(() => window.__rs.worn.set)) === 'blocks', 'the look you are wearing is marked in your list');
  await A.click('#trGrid .tile[data-id="set:blocks"]'); await until(async () => (await tr(B)).theirs.items['set:blocks'] === 1);
  await A.click('#bTrReady'); await until(async () => (await tr(B)).ready[1]); await B.click('#bTrReady');
  ok(await until(() => both(async pg => (await tr(pg)).trades === 2)), 'a one-sided trade (a gift) goes through the same way');
  la = await lock(A); lb = await lock(B);
  ok(!la.owned['set:blocks'] && la.wear.set === 'classic' && (await A.evaluate(() => window.__rs.worn.set)) === 'classic' && lb.owned['set:blocks'] === 1, 'giving away the only copy of a worn look puts the free one back on');
  // --- messages a modified copy could send
  await side(A, 'mine', 'finish'); await A.click('#trGrid .tile[data-id="finish:wood"]'); await until(async () => (await tr(B)).theirs.items['finish:wood'] === 1);
  await B.evaluate(() => window.__rs.tradeSend({ t: 'toffer', offer: { items: { 'finish:molten': 3, 'finish:neon': 9, 'finish:classic': 1, 'made:up': 1 }, cases: { lucky: 5 }, keys: { nope: 2 }, coins: -5 } }));
  ok(await until(async () => { const t = (await tr(A)).theirs; return JSON.stringify(t.items) === JSON.stringify({ 'finish:neon': 2 }) && !Object.keys(t.cases).length && !Object.keys(t.keys).length && t.coins === 0; }), 'an offer of things the sender hasn\'t shown, free looks, made-up looks or negative coins is cut down to what they have');
  await B.evaluate(() => window.__rs.tradeSend({ t: 'tready', on: true, h: 'not the same trade' }));
  ok(await until(async () => /out of sync/.test(await txt(A, '#trNote'))) && !(await tr(A)).ready[1] && await until(async () => !Object.keys((await tr(A)).theirs.items).length), 'a Ready for a different trade isn\'t counted, and the two pages are put back in step');
  la = await lock(A);
  await B.evaluate(() => { window.__rs.tradeSend({ t: 'tdone', h: 'x' }); window.__rs.tradeSend({ t: 'tdone' }); }); await sleep(600);
  ok(JSON.stringify(await lock(A)) === JSON.stringify(la) && (await tr(A)).trades === 2, 'a "done" out of nowhere changes nothing');
  // the other page going silent at the end: nothing moves, and after 4 seconds it's called off (Wood is still in Ada's offer)
  ok(await until(async () => (await tr(B)).theirs.items['finish:wood'] === 1), 'after being put back in step, each page has the other\'s offer again');
  await A.click('#bTrReady'); await until(async () => (await tr(B)).ready[1]);
  await B.evaluate(() => { window.__rs.tradeSecs = 60; }); await B.click('#bTrReady');   // B's countdown runs on, so B never sends its "done"
  la = await lock(A); lb = await lock(B);
  ok(await until(async () => (await tr(A)).sent, 5000) && /Completing trade/.test(await txt(A, '#trNote')), 'at the end of the countdown a page waits for the other to say it is going ahead');
  ok(await until(async () => /No response from Bo\. Trade cancelled/.test(await txt(A, '#trNote')), 7000) && !(await tr(A)).sent && JSON.stringify(await lock(A)) === JSON.stringify(la), 'if it never does, after 4 seconds the trade is called off and nothing has moved');
  ok(await until(async () => !(await tr(B)).counting && !(await tr(B)).ready[0]) && JSON.stringify(await lock(B)) === JSON.stringify(lb), 'the other page is told it is off, so its own countdown stops, and nothing moved there either');
  await side(A, 'mine', 'finish'); await A.click('#trGrid .tile[data-id="finish:wood"]'); await until(async () => !(await tr(B)).theirs.items['finish:wood']);
  await A.evaluate(() => { window.__rs.tradeSecs = 5; }); await B.evaluate(() => { window.__rs.tradeSecs = 5; });
  // --- leaving, the invite link, a reload, a full room
  await B.click('#bTrLeave');
  ok(await until(async () => !(await tr(A)).seen) && /Bo left the trade room/.test(await txt(A, '#trNote')) && await A.isVisible('#trWait') && !(await B.isVisible('#tradeBox')) && await B.isVisible('#cTrade') && !/#trade/.test(B.url()), 'Leave goes back to the Trade page; the other player is told and waits in the room');
  await B.goto(SITE.new + RELAY + '#trade=' + code); await B.reload();
  ok(await until(() => both(async pg => (await tr(pg)).seen)) && await txt(B, '#trTitle') === 'Trade with Ada', 'opening the invite link joins the trade room');
  await A.reload();
  ok(await until(() => both(async pg => { const t = await tr(pg); return t.seen && t.peer; })) && (await tr(A)).code === code && await txt(A, '#trTitle') === 'Trade with Bo', 'a reload comes back into the same room');
  const C = await mk('Cy', { coins: 5 });
  await C.click('.hTab[data-go="trade"]'); await C.fill('#trCode', code.toLowerCase()); await C.click('#bTrJoin');
  ok(await until(async () => /is full/.test(await txt(C, '#trMenuNote'))) && !(await C.isVisible('#tradeBox')), 'a third person is told the room has two people in it');
  // the same code typed into the Online screen is a game room of its own: nobody walks into a trade from there
  await C.click('.hTab[data-go="home"]'); await C.click('#bOnline'); await C.fill('#netCode', code); await C.click('#bJoin'); await sleep(1500);
  ok((await C.evaluate(() => window.__rs.net)).peer === false && (await C.evaluate(() => window.__rs.state)) === 'lobby' && (await tr(A)).peer, 'the same code on the Online screen is an empty game room: trade rooms and game rooms are separate');
  await C.click('#bLobbyCancel'); await C.close();
  // Esc backs out of a countdown, then leaves
  await side(A, 'mine', 'finish'); await A.click('#trGrid .tile[data-id="finish:wood"]'); await until(async () => (await tr(B)).theirs.items['finish:wood'] === 1);
  await A.click('#bTrReady'); await until(async () => (await tr(B)).ready[1]); await B.click('#bTrReady'); await until(() => both(async pg => (await tr(pg)).counting));
  await A.keyboard.press('Escape');
  ok(await until(() => both(async pg => !(await tr(pg)).counting)) && (await tr(A)).on, 'Esc backs out of a countdown');
  await A.keyboard.press('Escape');
  ok(await until(async () => !(await tr(A)).on) && await until(async () => !(await tr(B)).seen), 'and otherwise leaves the room');
  await B.click('#bTrLeave');
  // --- a phone on its side
  const P = await mk('Pat', { coins: 80, owned: Object.fromEntries(['wood', 'chalk', 'sea', 'forest', 'marble', 'metal', 'ember', 'candy', 'neon', 'ice', 'obsidian', 'royal', 'circuit', 'rainbow', 'molten'].map(f => ['finish:' + f, 1])), cases: { silver: 2 }, keys: { any: 1 } }, SITE.new, { width: 762, height: 341 });
  await P.goto(SITE.new + RELAY + '#trade=' + code + 'P'); await P.reload();
  await B.goto(SITE.new + RELAY + '#trade=' + code + 'P'); await B.reload();
  ok(await until(async () => (await tr(P)).seen && (await tr(B)).seen), 'a phone on its side joins a trade');
  await side(B, 'theirs', 'finish'); await side(P, 'mine', 'finish'); await P.click('#trGrid .tile[data-id="finish:ice"]'); await P.click('#trGrid .tile[data-id="finish:ember"]');
  const fits = await P.evaluate(() => { const r = document.querySelector('#tradePanel').getBoundingClientRect(), g = document.querySelector('#trGrid'), f = document.querySelector('#trFoot').getBoundingClientRect(); return { in: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, tiles: g.children.length, grid: g.scrollHeight <= g.clientHeight + 1, foot: f.bottom <= r.bottom }; });
  ok(fits.in && fits.tiles === 15 && fits.grid && fits.foot, `the trade room fits a phone on its side with a slot's fifteen looks showing, nothing scrolling (${JSON.stringify(fits)})`);
  await P.screenshot({ path: shot('trade-phone.png') });
  await side(B, 'mine', 'finish'); await B.click('#trGrid .tile[data-id="finish:neon"]'); await side(P, 'theirs', 'set'); await P.click('#bTrNew');
  const fits2 = await P.evaluate(() => { const r = document.querySelector('#tradePanel').getBoundingClientRect(), n = document.querySelector('#bTrNew').getBoundingClientRect(), h = document.querySelector('#trHead').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && n.width > 0 && n.bottom <= h.bottom + 1 && h.height < 40; });
  ok(fits2, 'and on Their items, with its switch in the top row');
  await P.screenshot({ path: shot('trade-phone-theirs.png') }); await B.screenshot({ path: shot('trade-their-items.png') });
  await P.close(); await B.click('#bTrLeave');
  // --- two versions can't trade
  const V = await mk('Vee', { coins: 5, owned: { 'finish:sea': 1 } }, SITE.alt);
  await V.goto(SITE.alt + RELAY + '#trade=' + code + 'V'); await V.reload();
  await B.goto(SITE.new + RELAY + '#trade=' + code + 'V'); await B.reload();
  ok(await until(async () => (await tr(V)).verBad && (await tr(B)).verBad) && /Version mismatch/.test(await txt(B, '#trNote')) && await B.evaluate(() => document.querySelector('#bTrReady').disabled), 'two different versions are told to reload, and can\'t press Ready');
  await V.close();
  ok(!log.length, 'console clean' + (log.length ? ':\n  ' + log.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
