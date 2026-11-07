// The menu fits without scrolling at phone, tablet and computer sizes, including a phone on its side (762x341).
const { chromium, FILE, shot, watch, ok } = require('./lib');
(async () => {
  const b = await chromium.launch(); const log = [];
  for (const [w, h] of [[762, 341], [740, 360], [915, 412], [412, 915], [1000, 640], [1280, 720]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }); watch(p, log);
    await p.goto(FILE); await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const s = document.querySelector('#mStage'), pn = document.querySelector('#menuPanel').getBoundingClientRect();
      return { down: s.scrollHeight - s.clientHeight, across: s.scrollWidth - s.clientWidth, fits: pn.top >= -1 && pn.left >= -1 && pn.bottom <= innerHeight + 1 && pn.right <= innerWidth + 1 };
    });
    ok(r.down <= 1 && r.across <= 1 && r.fits, `${w}x${h}: the menu fits on screen without scrolling${r.fits ? '' : ' (panel off screen)'}${r.down > 1 ? ` (needs ${r.down}px down)` : ''}${r.across > 1 ? ` (needs ${r.across}px across)` : ''}`);
    if (w === 762) await p.screenshot({ path: shot('fit-phone-sideways.png') });
    await p.close();
  }
  ok(!log.length, 'console clean' + (log.length ? ':\n  ' + log.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
