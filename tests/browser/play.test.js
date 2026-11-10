// Two players on one device: tapping and dragging moves, take back, castling, taking, promotion, checkmate, resigning, a draw, the view turning, the back gesture, and Resume after a reload.
const { chromium, SITE, shot, watch, ok } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 800, height: 500 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const log = watch(p);
  const rs = f => p.evaluate(f);
  const at = n => p.evaluate(n => window.__rs.squareScreen(n), n);
  const tap = async n => { const [x, y] = await at(n); await p.mouse.click(x, y); await p.waitForTimeout(120); };
  const move = async (a, z) => { await tap(a); await tap(z); await p.waitForTimeout(150); };
  const fresh = async fen => { await p.evaluate(f => window.__rs.start2(f), fen); await p.waitForTimeout(200); };
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  await p.goto(SITE.new); await p.waitForTimeout(1200);
  ok(await rs(() => window.__rs.pieces) === 32, 'the full set stands on the board behind the menu');
  await p.click('#bLocal'); await p.waitForTimeout(300);
  ok(await rs(() => window.__rs.state === 'play' && window.__rs.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w')), 'Two players starts a game from the starting position');

  await tap('e2');
  ok(await rs(() => window.__rs.sel) === 'e2', 'tapping a white pawn picks it up');
  await tap('e4');
  let i = await rs(() => ({ m: window.__rs.moves.join(' '), view: window.__rs.view, turn: document.querySelector('#turnLine').textContent }));
  ok(i.m === 'e4' && i.turn === 'Black to move', `tapping a square moves it there (${i.m}; "${i.turn}")`);
  ok(Math.abs(i.view.base - Math.PI) < 1e-6, 'the view turns round to Black');
  // dragging a piece: press on it, move, let go on the square
  { const [x0, y0] = await at('e7'), [x1, y1] = await at('e5');
    await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await p.mouse.move(x1, y1, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(200); }
  ok(await rs(() => window.__rs.moves.join(' ')) === 'e4 e5', 'dragging a piece onto a square moves it');
  await move('g1', 'g3');
  i = await rs(() => ({ m: window.__rs.moves.join(' '), sel: window.__rs.sel }));
  ok(i.m === 'e4 e5' && i.sel === '', `an illegal move isn't played, and the piece is put down (${i.m})`);
  await tap('d2'); await tap('e2'); await p.waitForTimeout(100);
  ok(await rs(() => window.__rs.sel) === '', 'tapping an empty square that isn\'t a move puts the piece down');
  // turning the view by dragging across empty space
  { const yaw0 = (await rs(() => window.__rs.view)).yaw; await p.mouse.move(60, 250); await p.mouse.down(); await p.mouse.move(200, 250, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
    const yaw1 = (await rs(() => window.__rs.view)).yaw; ok(Math.abs(yaw1 - yaw0) > 0.3, `dragging across empty space turns the view (${(yaw1 - yaw0).toFixed(2)} rad)`); }
  await p.click('#bUndo'); await p.waitForTimeout(200);
  i = await rs(() => ({ m: window.__rs.moves.join(' '), base: window.__rs.view.base }));
  ok(i.m === 'e4' && Math.abs(i.base - Math.PI) < 1e-6, `Take back takes back the last move and turns to the player again (${i.m})`);

  // castling, taking (the piece goes beside the board) and promotion
  await fresh('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  await move('e1', 'g1');
  ok((await rs(() => window.__rs.fen)).startsWith('r3k2r/8/8/8/8/8/8/R4RK1 b kq'), 'tapping the king two squares along castles (the rook jumps over)');
  await fresh('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
  await move('e4', 'd5');
  i = await rs(() => ({ m: window.__rs.moves.join(' '), taken: window.__rs.taken, pieces: window.__rs.pieces }));
  ok(i.m === 'exd5' && i.taken === 1 && i.pieces === 3, `a capture takes the pawn off and stands it beside the board (${JSON.stringify(i)})`);
  await fresh('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
  await move('e7', 'e8');
  const promo = await rs(() => ({ open: !document.querySelector('#promo').hidden, names: [...document.querySelectorAll('#promoBtns .btn')].map(b => b.textContent) }));
  ok(promo.open && promo.names.join(',') === 'Queen,Rook,Bishop,Knight', `a pawn reaching the end asks what it becomes (${promo.names})`);
  await p.screenshot({ path: shot('play-promotion.png') });
  await p.click('#promoBtns [data-p="n"]'); await p.waitForTimeout(200);
  ok((await rs(() => window.__rs.fen)).startsWith('4N3/') && (await rs(() => window.__rs.moves[0])) === 'e8=N', 'choosing Knight makes it a knight');

  // checkmate, with the result panel; a finished game isn't kept for Resume
  await fresh(START);
  for (const [a, z] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) await move(a, z);
  await p.waitForTimeout(300);
  i = await rs(() => ({ m: window.__rs.moves.join(' '), r: window.__rs.result, over: !document.querySelector('#over').hidden, t: document.querySelector('#overTitle').textContent, w: document.querySelector('#overWhy').textContent, saved: localStorage.getItem('retroSet.game') }));
  ok(i.m === 'f3 e5 g4 Qh4#' && i.over && i.t === 'Checkmate' && i.w === 'Black wins', `the fool's mate ends the game: "${i.t}", "${i.w}" (${i.m})`);
  ok(i.saved === null, 'a finished game is forgotten (no Resume for it)');
  await p.screenshot({ path: shot('play-checkmate.png') });
  await p.click('#bLook'); await p.waitForTimeout(150);
  await p.click('#bMenu'); await p.waitForTimeout(150);
  ok(await rs(() => !document.querySelector('#over').hidden), 'after See the board, Menu shows the result again');
  await p.keyboard.press('Escape'); await p.click('#bUndo'); await p.waitForTimeout(200);
  ok(await rs(() => window.__rs.state === 'play' && window.__rs.moves.length === 3), 'Take back after the mate carries the game on');

  // resigning and agreeing a draw need a second tap
  await fresh(START);
  await p.click('#bMenu'); await p.waitForTimeout(100);
  ok(await rs(() => document.querySelector('#bResign').textContent) === 'White resigns', 'the menu panel offers the player to move a resignation');
  await p.click('#bResign'); await p.waitForTimeout(100);
  ok(await rs(() => window.__rs.result === null && document.querySelector('#bResign').textContent.startsWith('Sure')), 'one tap only asks if you\'re sure');
  await p.click('#bResign'); await p.waitForTimeout(300);
  i = await rs(() => ({ t: document.querySelector('#overTitle').textContent, w: document.querySelector('#overWhy').textContent }));
  ok(i.t === 'White resigns' && i.w === 'Black wins', `a second tap resigns ("${i.t}", "${i.w}")`);
  ok(await rs(() => document.querySelector('#bUndo').disabled), 'a resignation can\'t be taken back');
  await fresh(START); await move('e2', 'e4');
  await p.click('#bMenu'); await p.click('#bDraw'); await p.click('#bDraw'); await p.waitForTimeout(300);
  ok(await rs(() => window.__rs.result && window.__rs.result.why === 'agreed' && document.querySelector('#overTitle').textContent === 'Draw'), 'Agree a draw, tapped twice, draws the game');

  // the view stays put with "Turn the board" off; the back gesture opens and closes the menu panel
  await fresh(START);
  await p.click('#bMenu'); await p.click('.sTab[data-tab="game"]'); await p.click('#sTurn [data-v="0"]'); await p.click('.sTab[data-tab="match"]'); await p.click('#bResumeGame');
  await move('d2', 'd4');
  ok(await rs(() => window.__rs.S.turn === false && window.__rs.view.base === 0), 'with Turn the board off, the view stays on White\'s side');
  await p.click('#bMenu'); await p.click('.sTab[data-tab="game"]'); await p.click('#sTurn [data-v="1"]'); await p.click('.sTab[data-tab="match"]'); await p.click('#bResumeGame');
  await p.goBack(); await p.waitForTimeout(200);
  ok(await rs(() => !document.querySelector('#pause').hidden && location.href.startsWith('http')), 'the back gesture opens the menu panel instead of leaving');
  await p.goBack(); await p.waitForTimeout(200);
  ok(await rs(() => document.querySelector('#pause').hidden && window.__rs.state === 'play'), 'going back again closes it');

  // Resume after a reload
  await p.click('#bMenu'); await p.click('#bQuit'); await p.waitForTimeout(200);
  await p.click('#bLocal'); await p.waitForTimeout(200);
  await move('e2', 'e4'); await move('c7', 'c5');
  await p.reload(); await p.waitForTimeout(1200);
  i = await rs(() => ({ shown: !document.querySelector('#bResume').hidden, txt: document.querySelector('#bResume').textContent, card: document.querySelector('#bLocal .cardTxt').textContent }));
  ok(i.shown && /two players, move 2/.test(i.txt), `after a reload the home screen offers "${i.txt}"`);
  ok(/replaces/.test(i.card), `and the Two players card says a new game replaces it ("${i.card}")`);
  await p.click('#bResume'); await p.waitForTimeout(300);
  ok(await rs(() => window.__rs.moves.join(' ')) === 'e4 c5', 'Resume carries on from the same position');
  await p.screenshot({ path: shot('play-resumed.png') });

  ok(!log.length, 'console clean' + (log.length ? ':\n  ' + log.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
