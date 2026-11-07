// Every screen fits without scrolling at phone, tablet and computer sizes, including a phone on its side (762x341): the home screen (with and without a game to resume), the game's bar and buttons, and its panels (menu, promotion, result).
const { chromium, SITE, shot, watch, ok } = require('./lib');   // over http: the checks reload the page, and storage must carry over
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
    await p.goto(SITE.new); await p.waitForTimeout(700);
    await p.evaluate(() => localStorage.removeItem('retroSet.game')); await p.reload(); await p.waitForTimeout(500);
    let r = await fits('#mStage'), r2 = await fits('#menuPanel');
    ok(good(r) && good(r2), say({ ...r, on: r2.on }, 'the home screen'));
    // with a game to resume, the home screen has its Resume button too
    await p.evaluate(() => localStorage.setItem('retroSet.game', JSON.stringify({ v: 1, start: window.__rs.start, moves: ['e2e4', 'e7e5'] }))); await p.reload(); await p.waitForTimeout(500);
    r = await fits('#mStage'); r2 = await fits('#menuPanel');
    ok(good(r) && good(r2) && await p.isVisible('#bResume'), say({ ...r, on: r2.on }, 'the home screen with Resume'));
    if (w === 762) await p.screenshot({ path: shot('fit-home-phone.png') });
    // in a game: the bar, the moves and the buttons keep clear of each other
    await p.click('#bResume'); await p.waitForTimeout(300);
    const boxes = await p.evaluate(() => Object.fromEntries(['#plW', '#mid', '#plB', '#movesBox', '#tools'].map(s => { const e = document.querySelector(s), r = e.getBoundingClientRect(); return [s, getComputedStyle(e).display === 'none' ? null : { left: r.left, right: r.right, top: r.top, bottom: r.bottom }]; })));
    const bad = []; const ks = Object.keys(boxes);
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) if (overlap(boxes[ks[i]], boxes[ks[j]])) bad.push(`${ks[i]} and ${ks[j]}`);
    const inView = Object.values(boxes).every(r => !r || (r.left >= 0 && r.right <= w && r.top >= 0 && r.bottom <= h));
    ok(!bad.length && inView, `${w}x${h}: the game's bar, moves and buttons are on screen and don't overlap${bad.length ? ': ' + bad.join(', ') : ''}`);
    if (w === 762) await p.screenshot({ path: shot('fit-game-phone.png') });
    await p.click('#bMenu'); await p.waitForTimeout(150);
    r = await fits('#pause .ovPanel'); ok(good(r), say(r, 'the menu panel'));
    await p.click('#bResumeGame');
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
