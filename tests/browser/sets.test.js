// The piece sets and finishes: every set stands on the board, each kind is a different shape and size from the rest (the pawn and the bishop above all), the chooser in the Menu panel, the choice kept through a reload, moves by real taps with another set, the promotion pictures, clean console.
const { chromium, SITE, shot, watch, ok } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 640, height: 420 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const log = watch(p);
  const rs = (f, a) => p.evaluate(f, a);
  const tap = async n => { const [x, y] = await rs(n => window.__rs.squareScreen(n), n); await p.mouse.click(x, y); await p.waitForTimeout(120); };
  await p.goto(SITE.new); await p.waitForTimeout(1200);
  const i = await rs(() => ({ sets: window.__rs.sets, fins: window.__rs.finishes, set: window.__rs.S.set, fin: window.__rs.S.finish }));
  ok(i.sets.join() === 'classic,ornate,minimal,blocks,figures,scifi,carved', `seven piece sets (${i.sets.join(', ')})`);
  ok(i.fins.includes('classic') && i.fins.length >= 5 && i.set === 'classic' && i.fin === 'classic', `finishes apart from the shapes, and Classic in Classic to start with (${i.fins.join(', ')})`);

  // every set: all 32 pieces, sizes that make sense, and no two kinds alike
  await rs(() => window.__rs.start2());
  for (const set of i.sets) {
    const d = await rs(set => {
      window.__rs.look(set, 'classic');
      const o = { n: window.__rs.pieces, tris: window.__rs.tris, sh: {}, mk: {} };
      for (const k of 'PNBRQK') { o.sh[k] = window.__rs.shape(k); o.mk[k] = window.__rs.mask(k); }
      return o;
    }, set);
    const h = k => Math.round(d.sh[k].h * 1000), wide = Math.max(...'PNBRQK'.split('').map(k => d.sh[k].w)), low = Math.min(...'PNBRQK'.split('').map(k => d.sh[k].low));
    ok(d.n === 32 && d.tris > 1000 && d.tris < 40000, `${set}: 32 pieces on the board (${d.tris} triangles in all)`);
    ok(h('K') > h('Q') && h('Q') > h('B') && h('B') > h('P') + 15 && h('R') > h('P') && h('N') > h('P') && h('K') <= 105,
      `${set}: the king tallest, then the queen, the bishop well above the pawn (mm: K ${h('K')}, Q ${h('Q')}, B ${h('B')}, N ${h('N')}, R ${h('R')}, P ${h('P')})`);
    ok(wide < 0.05 && low > -0.0012, `${set}: every piece fits its square and stands on the board (widest ${Math.round(wide * 1000)} mm of 57)`);
    // how unlike two kinds are in shape alone: each outline is drawn from the front filling the same height, and the
    // pixels only one of the two fills are counted as a share of the pixels either fills
    const unlike = (a, c) => { let x = 0, u = 0; for (let j = 0; j < a.length; j++) { if (a[j] === '1' || c[j] === '1') u++; if (a[j] !== c[j]) x++; } return x / u; };
    let worst = 1, pair = '';
    for (const a of 'PNBRQK') for (const c of 'PNBRQK') if (a < c) { const u = unlike(d.mk[a], d.mk[c]); if (u < worst) { worst = u; pair = a + c; } }
    ok(worst >= 0.12, `${set}: no two kinds are the same shape at different sizes (the closest pair, ${pair}, differ in ${Math.round(worst * 100)}% of their outline)`);
    ok(unlike(d.mk.P, d.mk.B) >= 0.3, `${set}: the pawn and the bishop are easy to tell apart (${Math.round(unlike(d.mk.P, d.mk.B) * 100)}% different in shape)`);
    await p.waitForTimeout(150);
    if (set === 'figures' || set === 'classic') await p.screenshot({ path: shot(`sets-${set}.png`) });
  }

  // a move and a capture by real taps, with a set made of many parts
  await rs(() => { window.__rs.start2('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'); window.__rs.look('figures', 'wood'); });
  await p.waitForTimeout(300);
  await tap('e4');
  ok(await rs(() => window.__rs.sel) === 'e4', 'tapping a piece of another set picks it up');
  await tap('d5'); await p.waitForTimeout(200);
  let g = await rs(() => ({ m: window.__rs.moves.join(' '), taken: window.__rs.taken, n: window.__rs.pieces }));
  ok(g.m === 'exd5' && g.taken === 1 && g.n === 3, `it moves and takes as usual (${JSON.stringify(g)})`);

  // the chooser in the Menu panel
  await p.click('#bMenu'); await p.waitForTimeout(150);
  let c = await rs(() => [document.querySelector('#setName').textContent, document.querySelector('#finName').textContent]);
  ok(c[0] === 'Set: Figures' && c[1] === 'Finish: Wood', `the Menu panel shows the set and finish in use (${c.join(', ')})`);
  await p.click('#pkSet .btn[data-d="1"]'); await p.click('#pkFin .btn[data-d="1"]'); await p.waitForTimeout(150);
  c = await rs(() => [document.querySelector('#setName').textContent, document.querySelector('#finName').textContent, window.__rs.S.set, window.__rs.S.finish, window.__rs.pieces, window.__rs.taken]);
  ok(c[0] === 'Set: Sci-fi' && c[2] === 'scifi' && c[3] !== 'wood' && c[4] === 3 && c[5] === 1, `> steps to the next set and finish, and the pieces on the table change at once (${c.join(', ')})`);
  for (let k = 0; k < 12; k++) await p.click('#pkFin .btn[data-d="1"]');
  const seen = new Set(); for (let k = 0; k < 12; k++) { await p.click('#pkFin .btn[data-d="-1"]'); seen.add(await rs(() => window.__rs.S.finish)); }
  ok(seen.size >= 5 && ![...seen].some(f => /^opt/.test(f)), `< and > go round every finish (${[...seen].join(', ')})`);
  await p.click('#pkSet .btn[data-d="-1"]'); await p.click('#pkSet .btn[data-d="-1"]'); await p.click('#pkSet .btn[data-d="-1"]');
  ok(await rs(() => window.__rs.S.set) === 'minimal', '< steps back through the sets');
  await p.screenshot({ path: shot('sets-chooser.png') });
  await p.click('#bResumeGame');

  // the promotion pictures are drawn from the set in use
  await rs(() => window.__rs.start2('8/4P3/8/8/8/8/8/k6K w - - 0 1')); await p.waitForTimeout(200);
  await tap('e7'); await tap('e8'); await p.waitForTimeout(200);
  const pr = await rs(() => [...document.querySelectorAll('#promoBtns canvas')].map(cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let j = 3; j < d.length; j += 4) if (d[j]) n++; return n; }));
  ok(pr.length === 4 && pr.every(n => n > 60) && new Set(pr).size === 4, `the promotion buttons show four different pieces of the set (${pr.join(', ')} pixels)`);
  await p.screenshot({ path: shot('sets-promo.png') });
  await p.keyboard.press('Escape');

  // kept through a reload; an unknown choice becomes Classic
  const fin = await rs(() => window.__rs.S.finish);
  await p.reload(); await p.waitForTimeout(1200);
  c = await rs(() => [window.__rs.S.set, window.__rs.S.finish, window.__rs.pieces]);
  ok(c[0] === 'minimal' && c[1] === fin && c[2] > 0, `the choice is kept through a reload (${c.join(', ')})`);
  await rs(() => localStorage.setItem('retroSet.settings', JSON.stringify({ pixel: 3, levels: 8, set: 'nope', finish: 'gone' })));
  await p.reload(); await p.waitForTimeout(1200);
  c = await rs(() => [window.__rs.S.set, window.__rs.S.finish, window.__rs.pieces]);
  ok(c[0] === 'classic' && c[1] === 'classic' && c[2] > 0, `a set or finish the game doesn't know becomes Classic (${c.join(', ')})`);
  ok(!log.length, 'console clean' + (log.length ? ':\n  ' + log.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
