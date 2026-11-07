// Playing the computer: the ten bots on the picker, your colour, the bot replying (and not moved by you), take back, a draw offer declined and accepted, resigning, mating the bot, the back gesture on the picker, and Resume after a reload.
const { chromium, SITE, shot, watch, ok } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 800, height: 500 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const log = watch(p);
  const rs = f => p.evaluate(f);
  const tap = async n => { const [x, y] = await p.evaluate(n => window.__rs.squareScreen(n), n); await p.mouse.click(x, y); await p.waitForTimeout(120); };
  const replies = async n => { for (let i = 0; i < 100 && (await rs(() => window.__rs.moves.length)) < n; i++) await p.waitForTimeout(100); await p.waitForTimeout(150); };

  await p.goto(SITE.new); await p.waitForTimeout(1000);
  await p.click('#bCpu'); await p.waitForTimeout(200);
  let i = await rs(() => ({ cards: [...document.querySelectorAll('.botCard')].map(c => c.textContent), title: document.querySelector('#mTitle').textContent }));
  ok(i.cards.length === 10 && i.cards[0] === 'Torben100' && i.cards[9] === 'Ted1500' && i.title === 'Vs computer', `Vs computer shows the ten bots (${i.cards.join(', ')})`);
  await p.click('[data-bot="daws"]'); await p.click('#sColour [data-v="white"]');
  ok(await rs(() => document.querySelector('#botBlurb').textContent.startsWith('Daws, 1300:')), 'picking a bot shows its line');
  await p.screenshot({ path: shot('cpu-picker.png') });
  await p.click('#bPlay'); await p.waitForTimeout(300);
  await rs(() => { window.__rs.quick = true; });
  i = await rs(() => ({ w: document.querySelector('#plW .plName').textContent, b: document.querySelector('#plB .plName').textContent, face: !!document.querySelector('#plB .plFace img'), turn: document.querySelector('#turnLine').textContent }));
  ok(i.w === 'You' && i.b === 'Daws 1300' && i.face && i.turn === 'Your move', `the bar shows You against Daws with a face (${JSON.stringify(i)})`);

  await tap('e2'); await tap('e4'); await replies(2);
  i = await rs(() => ({ m: window.__rs.moves, state: window.__rs.state }));
  ok(i.m.length === 2 && i.m[0] === 'e4' && i.state === 'play', `the bot replies to your move (${i.m.join(' ')})`);
  const blackPawn = (await rs(() => window.__rs.fen)).split('/')[1].indexOf('p') >= 0 ? 'a7' : 'b7';
  await tap(blackPawn);
  ok(await rs(() => window.__rs.sel) === '', 'you can\'t pick up the bot\'s pieces');
  await p.click('#bUndo'); await p.waitForTimeout(200);
  i = await rs(() => ({ m: window.__rs.moves.length, state: window.__rs.state, dis: document.querySelector('#bUndo').disabled }));
  ok(i.m === 0 && i.state === 'play' && i.dis, `Take back takes back your move and the bot's reply together (${i.m} moves left)`);

  // a draw offer at the start is declined; in a position the bot is losing, it's accepted
  await p.click('#bMenu'); await p.waitForTimeout(100);
  ok(await rs(() => document.querySelector('#bDraw').textContent === 'Offer a draw' && document.querySelector('#bResign').textContent === 'Resign' && document.querySelector('.onlyLocal').hidden), 'the menu panel offers a draw and resigning, without Turn the board');
  await p.click('#bDraw'); await p.waitForTimeout(150);
  i = await rs(() => ({ toast: document.querySelector('#toast').textContent, shown: !document.querySelector('#toast').hidden, r: window.__rs.result }));
  ok(i.shown && /declines/.test(i.toast) && !i.r, `a level game: "${i.toast}"`);
  await rs(() => window.__rs.startCpu('barney', 'w', '4k3/8/8/8/8/8/PPP5/QK6 w - - 0 1')); await p.waitForTimeout(200);
  await p.click('#bMenu'); await p.click('#bDraw'); await p.waitForTimeout(300);
  i = await rs(() => ({ toast: document.querySelector('#toast').textContent, r: window.__rs.result }));
  ok(i.r && i.r.why === 'agreed' && /accepts/.test(i.toast), `a queen and three pawns down, the bot accepts: "${i.toast}"`);

  // resigning, and mating the bot
  await rs(() => window.__rs.startCpu('barney', 'w')); await p.waitForTimeout(200);
  await p.click('#bMenu'); await p.click('#bResign'); await p.click('#bResign'); await p.waitForTimeout(300);
  i = await rs(() => ({ t: document.querySelector('#overTitle').textContent, w: document.querySelector('#overWhy').textContent }));
  ok(i.t === 'You resign' && i.w === 'Barney wins', `resigning: "${i.t}", "${i.w}"`);
  await rs(() => window.__rs.startCpu('torben', 'w', '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1')); await p.waitForTimeout(200);
  await tap('a1'); await tap('a8'); await p.waitForTimeout(300);
  i = await rs(() => ({ t: document.querySelector('#overTitle').textContent, w: document.querySelector('#overWhy').textContent }));
  ok(i.t === 'Checkmate' && i.w === 'You win', `mating the bot: "${i.t}", "${i.w}"`);
  await p.screenshot({ path: shot('cpu-win.png') });

  // playing Black: the bot moves first and the view is from Black's side
  await p.click('#bOverMenu'); await p.waitForTimeout(200);
  await p.click('#bCpu'); await p.click('[data-bot="ted"]'); await p.click('#sColour [data-v="black"]'); await p.click('#bPlay');
  await rs(() => { window.__rs.quick = true; }); await replies(1);
  i = await rs(() => ({ m: window.__rs.moves.length, base: window.__rs.view.base, me: window.__rs.vs.me }));
  ok(i.m === 1 && i.me === 'b' && Math.abs(i.base - Math.PI) < 1e-6, `as Black, Ted opens and the board faces you (${JSON.stringify(i)})`);
  ok(await rs(() => document.querySelector('#bUndo').disabled), 'Take back is off until you\'ve moved');

  // Resume after a reload keeps the opponent and your colour
  await p.reload(); await p.waitForTimeout(1000);
  i = await rs(() => ({ txt: document.querySelector('#bResume').textContent, cpu: document.querySelector('#bCpu .cardTxt').textContent }));
  ok(/vs Ted/.test(i.txt) && /replaces/.test(i.cpu), `after a reload: "${i.txt}", and the Vs computer card says a new game replaces it`);
  await p.click('#bResume'); await p.waitForTimeout(300);
  i = await rs(() => ({ vs: window.__rs.vs, m: window.__rs.moves.length, b: document.querySelector('#plW .plName').textContent }));
  ok(i.vs && i.vs.bot === 'ted' && i.vs.me === 'b' && i.m === 1 && i.b === 'Ted 1500', `Resume carries on against Ted, as Black (${JSON.stringify(i)})`);

  await p.click('#bMenu'); await p.click('#bQuit'); await p.waitForTimeout(200);
  // a game saved against a bot from before the renaming carries on against the nearest new one
  await p.evaluate(() => { localStorage.setItem('retroSet.game', JSON.stringify({ v: 1, start: window.__rs.start, moves: ['e2e4'], vs: { bot: 'gus', me: 'w' } })); localStorage.setItem('retroSet.menu', JSON.stringify({ bot: 'nell', colour: 'white' })); });
  await p.reload(); await p.waitForTimeout(1000);
  i = await rs(() => document.querySelector('#bResume').textContent);
  ok(/vs Barney/.test(i), `a saved game against Gus resumes against Barney ("${i}")`);
  await p.click('#bCpu'); await p.waitForTimeout(150);
  ok(await rs(() => document.querySelector('.botCard[aria-pressed="true"]').dataset.bot) === 'ted', 'and Nell, picked before, is now Ted');
  await p.click('#mBack'); await p.waitForTimeout(150);
  await rs(() => localStorage.removeItem('retroSet.game')); await p.reload(); await p.waitForTimeout(900);

  // the picker: the back gesture and Esc go back to the home screen
  await p.click('#bCpu'); await p.waitForTimeout(150); await p.goBack(); await p.waitForTimeout(200);
  ok(await rs(() => !document.querySelector('#sc-home').hidden && location.href.startsWith('http')), 'the back gesture on the picker goes back to the home screen, not off the page');
  await p.click('#bCpu'); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(await rs(() => !document.querySelector('#sc-home').hidden), 'so does Esc');
  ok(!log.length, 'console clean' + (log.length ? ':\n  ' + log.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
