// The menu's tabs and the settings: Play and Settings along the top, the settings' own tabs (with Match first in a game), every setting doing what it says and kept through a reload, move hints, always queen, confirming moves, the flat view, the board's coordinates and last move, the display settings, sound, and the sideways hint on a phone.
const { chromium, SITE, shot, watch, ok } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 640, height: 420 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const log = watch(p);
  const rs = (f, a) => p.evaluate(f, a);
  const tap = async n => { const [x, y] = await rs(n => window.__rs.squareScreen(n), n); await p.mouse.click(x, y); await p.waitForTimeout(120); };
  const fresh = async fen => { await rs(f => window.__rs.start2(f), fen); await p.waitForTimeout(200); };
  // sets a setting from the game's Menu panel, as a player would
  const set = async (tab, key, v) => { await p.click('#bMenu'); await p.click(`.sTab[data-tab="${tab}"]`); await p.click(`.seg[data-key="${key}"] .btn[data-v="${v}"]`); await p.click('.sTab[data-tab="match"]'); await p.click('#bResumeGame'); await p.waitForTimeout(120); };
  const shown = sel => rs(sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent && getComputedStyle(e).visibility !== 'hidden').map(e => e.dataset.tab || e.dataset.go || e.textContent), sel);

  await p.goto(SITE.new); await p.waitForTimeout(1200);
  // --- the menu's tabs
  let i = await rs(() => ({ tabs: [...document.querySelectorAll('.hTab')].map(t => t.textContent + (t.getAttribute('aria-selected') === 'true' ? '*' : '')), cards: document.querySelector('#bLocal').offsetParent !== null }));
  ok(i.tabs.join() === 'Play*,Cosmetics,Settings' && i.cards, `the menu has Play, Cosmetics and Settings along the top, Play first (${i.tabs.join(', ')})`);
  await p.click('.hTab[data-go="settings"]'); await p.waitForTimeout(150);
  ok((await shown('.sTab')).join() === 'game,board,display,device' && (await shown('.sPage')).join() === 'game', `Settings has four tabs of its own, opening on Game (${(await shown('.sTab')).join(', ')})`);
  for (const t of ['board', 'display', 'device']) { await p.click(`.sTab[data-tab="${t}"]`); ok((await shown('.sPage')).join() === t, `the ${t} tab shows its page and hides the others`); }
  await p.keyboard.press('ArrowLeft');
  ok(await rs(() => window.__rs.tab) === 'display', 'the left arrow key steps to the tab before');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  ok(await rs(() => window.__rs.tab) === 'game', 'the right arrow key steps on, and round to the first');
  await p.screenshot({ path: shot('settings-menu.png') });
  await p.goBack(); await p.waitForTimeout(200);
  ok(await rs(() => document.querySelector('#sc-settings').hidden && !document.querySelector('#sc-home').hidden && location.href.startsWith('http')), 'the back gesture goes from Settings to Play, not off the page');
  await p.click('.hTab[data-go="settings"]'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(await rs(() => !document.querySelector('#sc-home').hidden), 'Esc does too');
  await p.click('#bCpu'); await p.waitForTimeout(100);
  ok(await rs(() => document.querySelector('#hTabs').hidden && !document.querySelector('#mTop').hidden), 'a screen further in has its Back bar instead of the tabs');
  await p.click('#mBack');

  // --- a setting changed in the menu is saved, and is in force in a game
  await p.click('.hTab[data-go="settings"]'); await p.click('.sTab[data-tab="game"]'); await p.click('.seg[data-key="hints"] .btn[data-v="0"]');
  i = await rs(() => ({ s: window.__rs.S.hints, saved: JSON.parse(localStorage.getItem('retroSet.settings')).hints, pressed: document.querySelector('.seg[data-key="hints"] .btn[data-v="0"]').getAttribute('aria-pressed') }));
  ok(i.s === false && i.saved === false && i.pressed === 'true', `Move hints Off is saved and its button lit (${JSON.stringify(i)})`);
  await p.click('.hTab[data-go="home"]');
  await fresh(); await tap('e2');
  const off = await rs(() => window.__rs.marks);
  ok(await rs(() => window.__rs.sel) === 'e2' && off === 1, `with hints off, a picked-up piece shows no dots (${off} mark)`);
  await tap('e2');
  // --- in a game: the Menu panel has Match first, then the same tabs
  await p.click('#bMenu'); await p.waitForTimeout(100);
  ok((await shown('.sTab')).join() === 'match,game,board,display,device' && (await shown('.sPage')).join() === 'match' && await p.isVisible('#bResign'), `in a game, Menu opens on a Match tab, before the settings' tabs (${(await shown('.sTab')).join(', ')})`);
  await p.click('.sTab[data-tab="game"]');
  ok(await p.isVisible('#sTurn'), 'Turn the board shows on a shared device');
  await p.click('.seg[data-key="hints"] .btn[data-v="1"]'); await p.click('.sTab[data-tab="match"]'); await p.click('#bResumeGame');
  await tap('e2');
  ok(await rs(() => window.__rs.marks) === 3, 'with hints back on, the dots show (the piece and its two squares)');
  await tap('e4');
  // --- the last move
  const withLast = await rs(() => window.__rs.marks);
  await set('board', 'lastMove', 0);
  const noLast = await rs(() => window.__rs.marks);
  ok(withLast === 2 && noLast === 0, `Last move Off takes the tint off the two squares (${withLast} marks, then ${noLast})`);
  await set('board', 'lastMove', 1);
  // --- coordinates
  await set('board', 'coords', 0);
  ok(await rs(() => !window.__rs.coords), 'Coordinates Off draws the board without its letters and numbers');
  await p.screenshot({ path: shot('settings-no-coords.png') });
  await set('board', 'coords', 1);
  ok(await rs(() => window.__rs.coords), 'and On puts them back');

  // --- always queen
  await fresh('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
  await tap('e7'); await tap('e8');
  ok(await p.isVisible('#promo'), 'a pawn reaching the end asks what it becomes');
  await p.click('#bPromoCancel');
  await set('game', 'autoQueen', 1);
  await fresh('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
  await tap('e7'); await tap('e8'); await p.waitForTimeout(150);
  i = await rs(() => ({ m: window.__rs.moves.join(' '), promo: !document.querySelector('#promo').hidden }));
  ok(i.m === 'e8=Q' && !i.promo, `with Always queen on, it becomes a queen without asking (${i.m})`);
  await set('game', 'autoQueen', 0);

  // --- confirming moves
  await fresh();
  await set('game', 'confirm', 1);
  await tap('e2'); await tap('e4');
  i = await rs(() => ({ pend: window.__rs.pending, m: window.__rs.moves.length, txt: document.querySelector('#confirmTxt').textContent, bar: !document.querySelector('#confirm').hidden, marks: window.__rs.marks }));
  ok(i.pend === 'e2e4' && i.m === 0 && i.bar && i.txt === 'Play e4?' && i.marks === 2, `with Confirm moves on, a move waits, its squares marked, behind a bar saying "${i.txt}"`);
  await p.screenshot({ path: shot('settings-confirm.png') });
  await p.click('#bCancelMove');
  ok(await rs(() => !window.__rs.pending && window.__rs.moves.length === 0 && document.querySelector('#confirm').hidden), 'Cancel drops it');
  await tap('e2'); await tap('e4'); await tap('a5');
  ok(await rs(() => !window.__rs.pending && window.__rs.moves.length === 0), 'so does a tap somewhere else');
  await tap('e2'); await tap('e4'); await p.keyboard.press('Escape');
  ok(await rs(() => !window.__rs.pending && document.querySelector('#pause').hidden), 'and Esc (without opening the Menu)');
  await tap('e2'); await tap('e4'); await p.click('#bConfirm'); await p.waitForTimeout(150);
  ok(await rs(() => window.__rs.moves.join(' ')) === 'e4' && await rs(() => document.querySelector('#confirm').hidden), 'Confirm plays it');
  // a promotion: the piece is chosen first, then confirmed
  await fresh('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
  await tap('e7'); await tap('e8'); await p.click('#promoBtns [data-p="n"]'); await p.waitForTimeout(100);
  i = await rs(() => ({ pend: window.__rs.pending, txt: document.querySelector('#confirmTxt').textContent }));
  ok(i.pend === 'e7e8n' && i.txt === 'Play e8=N?', `a promotion is chosen, then confirmed ("${i.txt}")`);
  await p.click('#bConfirm'); await p.waitForTimeout(150);
  ok(await rs(() => window.__rs.moves.join(' ')) === 'e8=N', 'and played as chosen');
  // the computer's reply isn't held back
  await rs(() => { window.__rs.quick = true; window.__rs.startCpu('torben', 'w'); }); await p.waitForTimeout(200);
  await p.click('#bMenu'); await p.click('.sTab[data-tab="game"]');
  ok(!(await p.isVisible('#sTurn')), 'against the computer, Turn the board is left out');
  await p.click('.sTab[data-tab="match"]'); await p.click('#bResumeGame');
  await tap('e2'); await tap('e4'); await p.click('#bConfirm');
  await p.waitForFunction(() => window.__rs.moves.length === 2 && window.__rs.state === 'play', null, { timeout: 8000 });
  ok(await rs(() => !window.__rs.pending && document.querySelector('#confirm').hidden), 'the computer\'s reply is played without waiting for Confirm');
  await p.click('#bMenu'); await p.click('#bQuit'); await p.waitForTimeout(150);
  await fresh(); await set('game', 'confirm', 0);

  // --- the flat view
  i = await rs(() => ({ flat: window.__rs.flat, label: document.querySelector('#bView').textContent, tris: window.__rs.tris }));
  await p.click('#bView'); await p.waitForTimeout(300);
  let f = await rs(() => ({ flat: window.__rs.flat, label: document.querySelector('#bView').textContent, tris: window.__rs.tris, pitch: window.__rs.pitch, n: window.__rs.pieces, s: window.__rs.S.flat }));
  ok(!i.flat && i.label === '2D' && f.flat && f.label === '3D' && f.s && f.n === 32 && f.tris === 64 && f.pitch > 1.5, `the 2D button looks straight down at flat pictures of the pieces (${f.tris} triangles for the 32, where the solid ones took ${i.tris})`);
  await p.screenshot({ path: shot('settings-flat.png') });
  await tap('g1'); await tap('f3'); await p.waitForTimeout(150);
  await tap('d7'); await tap('d5'); await p.waitForTimeout(150);
  ok(await rs(() => window.__rs.moves.join(' ')) === 'Nf3 d5', 'moves by taps work in the flat view, for both sides as the view turns');
  // the pictures never turn with the view: dragging doesn't turn the flat view, and a turn of the board is a flip
  const norm = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), near = (a, b2) => Math.abs(norm(a - b2)) < 1e-6 || Math.abs(norm(a - b2) - 2 * Math.PI) < 1e-6;
  let v0 = await rs(() => ({ v: window.__rs.view, a: window.__rs.flatAngles }));
  await p.mouse.move(20, 200); await p.mouse.down(); await p.mouse.move(120, 230, { steps: 5 }); await p.mouse.move(260, 260, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(250);
  let v1 = await rs(() => ({ v: window.__rs.view, a: window.__rs.flatAngles }));
  ok(v1.v.off === v0.v.off && near(v1.v.yaw, v0.v.yaw) && v1.a.length === 1 && near(v1.a[0], v1.v.base), `dragging across the flat view doesn't turn it, and every picture stays as it was (${JSON.stringify(v1.a)})`);
  await p.click('#bFlip'); await p.waitForTimeout(120);
  let v2 = await rs(() => ({ v: window.__rs.view, a: window.__rs.flatAngles }));
  ok(near(v2.v.yaw, v2.v.base) && near(v2.v.base, v0.v.base + Math.PI) && v2.a.length === 1 && near(v2.a[0], v2.v.base), 'Turn flips the flat view at once, the pictures upright for the other side, with no swing round');
  await p.click('#bFlip'); await p.waitForTimeout(120);
  await p.click('#bMenu'); await p.click('.sTab[data-tab="board"]');
  ok(await rs(() => document.querySelector('.seg[data-key="flat"] .btn[data-v="1"]').getAttribute('aria-pressed')) === 'true', 'the Board tab shows Flat view on');
  await p.click('.sTab[data-tab="match"]'); await p.click('#bQuit'); await p.waitForTimeout(200);
  ok(await rs(() => !window.__rs.flat && window.__rs.state === 'menu'), 'behind the menu the pieces are solid again');
  await p.click('#bResume'); await p.waitForTimeout(250);
  ok(await rs(() => window.__rs.flat && window.__rs.moves.length === 2), 'and flat again when the game is resumed');
  await p.click('#bView'); await p.waitForTimeout(200);
  ok(await rs(() => !window.__rs.flat && window.__rs.pitch < 1.2 && document.querySelector('#bView').textContent === '2D'), 'the button (now 3D) goes back to the solid pieces and the usual angle');

  // --- display
  await set('display', 'pixel', 2);
  i = await rs(() => ({ w: document.querySelector('#view').width, px: window.__rs.S.pixel }));
  ok(i.px === 2 && i.w === 320, `Pixel size 2x draws half as many pixels across (${i.w} for a 640 window)`);
  await set('display', 'levels', 16); await set('display', 'dither', 0); await set('display', 'outline', 0);
  i = await rs(() => window.__rs.S);
  ok(i.levels === 16 && i.dither === false && i.outline === false, 'Colours, Dithering and Outlines are set from the Display tab');
  await p.screenshot({ path: shot('settings-display.png') });
  await set('display', 'outline', 1); await set('display', 'dither', 1);

  // --- sound
  await fresh('4k3/8/8/3p4/4P3/8/8/R3K3 w Q - 0 1');
  let n0 = await rs(() => window.__rs.soundCount);
  await tap('e4'); await tap('d5'); await p.waitForTimeout(150);
  ok((await rs(n => window.__rs.soundsFrom(n), n0)).join() === 'capture', 'a capture makes the capture sound');
  await fresh('3k4/8/8/8/8/8/8/R3K3 w Q - 0 1');
  n0 = await rs(() => window.__rs.soundCount);
  await tap('e1'); await tap('c1'); await p.waitForTimeout(150);
  ok((await rs(n => window.__rs.soundsFrom(n), n0)).join() === 'castle,check', `castling makes its two knocks, and giving check its warning (${(await rs(n => window.__rs.soundsFrom(n), n0)).join()})`);
  await fresh('rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2');
  n0 = await rs(() => window.__rs.soundCount);
  await tap('d8'); await tap('h4'); await p.waitForTimeout(250);
  ok((await rs(n => window.__rs.soundsFrom(n), n0)).join() === 'move,win', `checkmate: the move, then the winning notes (${(await rs(n => window.__rs.soundsFrom(n), n0)).join()})`);
  await p.click('#bOverMenu'); await p.waitForTimeout(150);
  await p.click('.hTab[data-go="settings"]'); await p.click('.sTab[data-tab="device"]');
  n0 = await rs(() => window.__rs.soundCount);
  await p.click('.seg[data-key="volume"] .btn[data-v="0.25"]');
  ok(await rs(() => window.__rs.S.volume) === 0.25 && (await rs(n => window.__rs.soundsFrom(n), n0)).includes('move'), 'changing the volume plays a move, to hear it by');
  await p.click('.seg[data-key="volume"] .btn[data-v="0"]');
  n0 = await rs(() => window.__rs.soundCount);
  await p.click('.hTab[data-go="home"]'); await fresh(); await tap('e2'); await tap('e4'); await p.waitForTimeout(150);
  ok(await rs(() => window.__rs.soundCount) === n0 && await rs(() => window.__rs.moves.join()) === 'e4', 'with Sound off, nothing plays');
  i = await rs(() => ({ vib: document.querySelector('#rowVibrate').hidden, full: document.querySelector('#rowFull').hidden, can: !!document.fullscreenEnabled }));
  ok(i.vib && i.full === !i.can, 'Vibration is left out on a computer; Fullscreen shows where the browser allows it');

  // --- everything is kept through a reload
  await set('board', 'coords', 0); await set('game', 'autoQueen', 1);
  await p.reload(); await p.waitForTimeout(1200);
  i = await rs(() => ({ S: window.__rs.S, coords: window.__rs.coords, w: document.querySelector('#view').width }));
  ok(i.S.volume === 0 && i.S.coords === false && !i.coords && i.S.autoQueen === true && i.S.pixel === 2 && i.S.levels === 16 && i.w === 320, 'the settings are kept through a reload and in force at once');
  await p.click('.hTab[data-go="settings"]'); await p.click('.sTab[data-tab="display"]');
  ok(await rs(() => document.querySelector('.seg[data-key="pixel"] .btn[data-v="2"]').getAttribute('aria-pressed')) === 'true', 'and the Settings tab shows them');

  // --- the sideways hint, on a phone held upright
  const phone = await b.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const q = await phone.newPage(); watch(q, log);
  await q.goto(SITE.new); await q.waitForTimeout(1000);
  ok(await q.isVisible('#rotate'), 'a phone held upright is told a sideways phone gives a bigger board');
  await q.screenshot({ path: shot('settings-rotate.png') });
  await q.tap('#bRotateOk'); await q.reload(); await q.waitForTimeout(800);
  ok(!(await q.isVisible('#rotate')), 'OK hides the hint for good');
  ok(!(await p.isVisible('#rotate')), 'a computer never sees it');
  ok(!log.length, 'console clean' + (log.length ? ':\n  ' + log.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
