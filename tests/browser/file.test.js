// The built file opened straight from disk (as a downloaded copy): the version shows, no install bits, the board is drawn, clean console.
const { chromium, FILE, shot, watch, ok } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 480, height: 360 } }); const log = watch(p);
  await p.goto(FILE); await p.waitForTimeout(2000);
  const i = await p.evaluate(() => ({ ver: document.querySelector('#ver').textContent, manifest: !!document.querySelector('link[rel=manifest]'),
    sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller), icon: (document.querySelector('link[rel=icon]') || {}).href || '',
    state: window.__rs.state, frames: window.__rs.frames, tris: window.__rs.triangles, start: window.__rs.start }));
  ok(/^Version [0-9a-f]{8}$/.test(i.ver), `menu shows "${i.ver}"`);
  ok(!i.manifest && !i.sw, 'no install link or service worker when opened from disk');
  ok(i.icon.startsWith('data:image/png;base64,'), 'tab icon is built into the file');
  ok(i.state === 'menu', `the page starts in the menu (state ${i.state})`);
  await p.waitForTimeout(500);
  const later = await p.evaluate(() => window.__rs.frames);
  ok(later > i.frames && i.tris > 100, `the scene is drawn and keeps drawing (${i.tris} triangles a frame, ${later - i.frames} frames in 0.5 s)`);
  ok(i.start === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'core.js reaches the page (the starting position)');
  await p.screenshot({ path: shot('file-menu.png') });
  // the game's real defaults: the sharpest picture (the other tests start at 3x and 8 shades to save time)
  const q = await b.newPage({ viewport: { width: 480, height: 360 } }); watch(q, log);
  await q.goto(FILE + '?realdefaults'); await q.waitForTimeout(1500);
  const d = await q.evaluate(() => ({ pixel: window.__rs.S.pixel, levels: window.__rs.S.levels, w: document.querySelector('#view').width }));
  ok(d.pixel === 1 && d.levels === 256 && d.w === 480, `real defaults: pixel size 1x and full colour, one game pixel per page pixel (${JSON.stringify(d)})`);
  await q.screenshot({ path: shot('file-defaults.png') });
  ok(!log.length, 'console clean' + (log.length ? ':\n  ' + log.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
