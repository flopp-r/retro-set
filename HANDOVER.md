# Retro Set: decisions, history and changes

This file records why Retro Set is the way it is: the decisions and their reasons, reference numbers, the ideas list, and a dated list of every change shipped. Read it together with `AGENTS.md`, which explains how the code works and how to change it.

---

## 1. Current status

- The game is live at https://flopp-r.github.io/retro-set/, served by GitHub Pages from the public repository `github.com/flopp-r/retro-set` (branch `main`, root folder).
- Stage 1 (two players on one device, the full rules) and Stage 2 (ten computer opponents, Torben 100 to Ted 1500) are built; Stage 3 (online) is next. See section 4.
- There is no relay and no online play yet.
- Everything in section 9 (changes shipped) is live. The version shown at the bottom of the menu matches the `BUILD` value in the committed `index.html`.

---

## 2. Working preferences

Personal working preferences are kept in the owner's own Claude Code settings, not in this public repository. Project conventions (plain-language explanations, UK English, metric units, a clean console, testing before pushing) are in `AGENTS.md`.

---

## 3. How the project got here (short history)

1. **Set up from Retro Rack (7 November 2026):** the owner asked for a retro-themed chess game in the style of Retro Rack, their 3D pixel-art pool game, and for the way of working there to be brought across before anything was built. Copied from Retro Rack (as of its pull request #32): the guide for AI assistants (`AGENTS.md`, with `CLAUDE.md` pointing to it), these notes, the README, the build that makes one self-contained `index.html`, the context packs for other AIs, the core and browser tests and their runner, the installable app (manifest, network-first service worker, icons drawn by a script), three.js r159 and the two pixel fonts, and the pixel-art rendering pipeline. A placeholder scene (an empty board) gave the build and the tests something real to draw. The owner then switched on GitHub Pages.
2. **Stage 1 (7 November 2026):** the owner chose the look, the ways of playing, the rules and the pieces (section 4), and the first stage was built: the rules engine, the 3D pieces, two players on one device.
3. **Stage 2 (7 November 2026):** the computer opponents: an engine, eight named bots from 100 to 1500, and a tool that measures their strength against Stockfish and each other.
4. **Ten bots with real blunders (7 November 2026):** the owner renamed the bots and asked for ten, and for real blunders as well as middling moves, most at the low levels but still present at the top. Every bot was re-tuned and re-measured.

---

## 4. Key decisions and why

**Delivery (carried over from Retro Rack)**
- **One self-contained `index.html`,** with fonts and three.js inlined, so the game works offline as a single downloaded file and GitHub Pages can serve it with no build step on the server.
- **three.js is pinned at r159** (ES-module build, wrapped by `tools/build.js`), the same file as Retro Rack's, so code ported between the games behaves the same. Upgrading is possible but not needed; if you do, re-check lighting, the `DepthTexture` outline pass and the console.
- **The same pixel-art look:** Retro Rack's low-resolution render target and post-processing shader (outlines, vignette, dithering), its palette and its fonts, so the two games look like a family.
- **The version is a fingerprint of the code,** shown at the bottom of the menu, so the owner can see an update has arrived (and, if online play comes, players can compare versions).
- **The context packs** (`CONTEXT.md`, `CONTEXT-SHORT.md`) are remade by every build and checked by the tests, so any AI can be given the whole project in one file and it's never out of date.
- **Separate from Retro Rack:** its own repository, site, storage keys (`retroSet.` rather than `retroRack.`) and, if online play comes, its own relay, so a change to one game can't break the other. Code is shared by copying, not by a shared library, because each game is one self-contained page.

**The game (chosen by the owner, 7 November 2026)**
- **3D pixel art,** like Retro Rack, rather than a flat 2D board: the setup was already in place and the two games match. A 2D board would have been lighter on phones.
- **All three ways of playing:** two on one device, against the computer, and online. Built in stages, each its own pull request, because all three need the board, the pieces and the rules first: Stage 1 two on one device, Stage 2 the computer, Stage 3 online (which needs its own relay; the owner sets up the Cloudflare Worker, as for Retro Rack).
- **The full rules, no clocks:** castling, en passant, promotion to any piece, check, checkmate, stalemate, and every draw (repetition, fifty moves, too few pieces, agreement). Clocks can come later. "Basic rules first" was advised against: the missing rules are the ones that cause bugs when added later.
- **Classic piece shapes** (Staunton), low-poly and outlined like Retro Rack's balls, rather than toy-like or character pieces: easiest to read at a glance.

**Stage 1: two players on one device (7 November 2026)**
- **The rules engine is plain and checked against the published move counts** (perft) for five standard positions, which catch nearly every move-generation bug (castling through check, en passant pins, promotions). Positions are copied, never changed, so take back is just the previous position, and the computer player can search without undoing moves.
- **Repetition and the fifty-move rule draw at once,** as chess.com does, rather than a player having to claim them (the official rule): there's nobody to claim to on a shared screen, and a claim button would be one more thing on a phone. Too few pieces to mate is the standard list (kings alone, a single bishop or knight, bishops all on one colour of square).
- **Tap a piece then a square, or drag it:** both work on a phone and a computer. Dragging across empty space turns the view; the piece doesn't follow the finger while dragged (it may later).
- **The view turns round to the player to move** (on by default, "Turn the board" in the Menu panel), like turning a real board on a table between two people; off, it stays where it's put, and Turn swings it round by hand.
- **Take back as often as you like,** also after a mate or a draw on the board (friendly games), but not after a resignation or an agreed draw, which aren't moves.
- **Resigning and agreeing a draw need a second tap** within 3 seconds, so a stray tap can't end a game.
- **Knights look to their owner's left:** facing forward, each player only saw the back of a flat head. Side on they read like a printed diagram.
- **Coordinates on all four sides,** each set for the player nearest, in a 3 × 5 pixel font drawn into the board's texture (no font to wait for).
- **A game in progress is saved after every move** and offered as Resume on the home screen, so a closed tab or a phone call doesn't lose it. Starting a new game replaces it, and the Two players card says so.

**Stage 2: the computer opponents (7 November 2026)**
- **What the owner asked for:** opponents from 100 to 1500, "very accurate, like chess.com bots". Chosen from the options put to the owner: **eight named bots** at 100, 300, 500, 700, 900, 1100, 1300 and 1500, each with a pixel face and a line about how it plays (15 bots, one every 100 points, was the alternative: twice the faces, and 100 points is hard to feel); **you pick your colour**, Random to start with.
- **How accurate a rating can be (said to the owner before building):** a rating only means something against a pool of players. Chess.com's, lichess's and FIDE's scales differ, by hundreds of points at the low end, and chess.com's own bots are widely felt not to play like people of their stated rating. Nothing here can match chess.com's numbers without playing chess.com's players. Three ways to anchor the numbers were offered: tune each bot's mistakes to published figures for human players at each rating (most like people, most work), anchor to Stockfish's calibrated strength setting and measure the gaps between bots, or measure the gaps only. **The owner chose Stockfish plus measured gaps.**
- **The anchor:** Stockfish 19 (stockfish.js, the full single-threaded engine, installed by the tool into a temporary folder, never part of the game, so its GPL licence doesn't touch the game) has a strength setting, `UCI_Elo`, from 1320 up, calibrated by its makers against an engine rating list (CCRL) rather than people. Nell (1500) is tuned to score 50% against it at 1500, and Tariq (1300) 47% against it at 1320 (20 points above him). Below 1320 there's nothing to anchor to, so each lower bot is tuned to score 24% against the bot above (a 200-point gap). The errors add up down the chain, so the lowest bots are the least certain; the margins are in section 5.
- **Stockfish's time:** 60 ms a move rather than the minute-per-game time its setting was calibrated at. At its weakest settings it chooses after a search only one or two moves deep, which takes a fraction of that, so more time changes little; this was a judgement, not measured.
- **The engine was strengthened before tuning:** at first, looking 3 moves ahead at full effort only just beat Stockfish 1500 (55%, 40 games), which left no room for Nell to make mistakes. Better judgement of positions (passed pawns, pawn weaknesses, rooks on open files, the bishop pair, king shelter) and looking further when in check took that to 64% (80 games); looking 4 moves ahead, 81% (80 games, about 1750). So Nell looks 4 moves ahead and makes slips on purpose, rather than being a machine with nothing to give.
- **Human-like weakness, not random weakness:** the low bots look only one move ahead, so they see a piece left to be taken but miss forks, pins and other threats, as beginners do; every bot sometimes picks a less good move, more often the worse its level (a temperature), plus an occasional outright blunder. The first plan had Pip and Mabel not even following captures through (so they'd grab defended pieces), but measured, that was about 760 points below Dev even at its best, below 100 on this scale, so every bot follows captures through and the knob does the weakening. Styles add a little character (Mabel pushes pawns, Dev grabs captures, Ruth castles early, Tariq likes checks); each bot is tuned with its style on, so the style doesn't change its rating. Bots that look one move ahead still spot a mate in one and avoid stalemate, or they'd never finish a won game.
- **The bot thinks for half a second to a second or so** before moving, even when it has chosen sooner, so the reply doesn't snap back.
- **Take back against the computer** goes back to before your last move, taking its reply too (as on chess.com). **A draw is offered, not agreed:** the bot accepts when a quick search says it's half a pawn or more worse, or, from move 30, level.
- **No resigning by the bots**: they play on to the end, which suits beginners practising mating.

**Bots: ten opponents and real blunders (7 November 2026)**
- **The owner's names, ten of them:** Torben, Alfie, Ollie, Dom, Joseph, Barney, Magnus, Jake, Daws and Ted, weakest to strongest. Of the three options put to the owner (ten bots from 100 to 1500, ten from 100 to 1900, or eight with the first eight names) the owner chose **ten from 100 to 1500**: steps of 150 (the last one 200), so both Stockfish anchors (1500 and 1320) still fit. The lines and faces were written for the game (the owner's choice); the repository is public, so nothing personal is said about anyone.
- **Old saves carry on:** a game or a menu choice from before the renaming moves to the nearest new bot (Pip to Torben, Mabel to Alfie, Dev to Dom, Priya to Joseph, Gus to Barney, Ruth to Jake, Tariq to Daws, Nell to Ted).
- **Real blunders, not random moves:** before, a bot's "blunder" was any legal move at random, which often wasn't a blunder at all. Now each bot has a set chance each move (30% Torben, 24% Alfie, 19% Ollie, 15% Dom, 12% Joseph, 9% Barney, 7% Magnus, 5% Jake, 4% Daws, 3% Ted) of a move that really loses at least two pawns' worth: leaving a piece to be taken, grabbing a pawn that can't be held, walking into a mate or missing one. Of those, it picks the one that looks best at a glance (the position straight after the move, not the reply), as people do: a blunder looks like a good idea. This is chess.com's sense of a blunder: a move much worse than the best one. The chances were set by hand, falling with strength but never zero, as asked; only the middling-move setting (the temperature) was tuned for the ratings.
- **The trade-off (told to the owner):** with blunders this frequent, the low bots' ratings come mostly from their blunders, so tuning turned their temperature down: they play fewer middling moves between the blunders than before (Torben's temperature 93, against 107 for the old 100 bot). Lower blunder chances would bring the middling moves back.
- **Measuring took three rounds:** a tuning run (80 games a step) and then two corrections, each followed by a fresh check of 240 games a bot, ending with every bot within 30 points of its target (section 5). Each correction used the rating points per step of the knob; the second one took them from the bot's two checks, because the tuning steps were too noisy at the low levels, where blunders make strength change slowly with the knob.

**Decisions still to make**
- **Stage 3, online:** the same as Retro Rack's online play (rooms with codes, a listed rooms board, Rejoin, quick chat), on a new relay.
- **The board and the room:** the square colours and the room are placeholders.
- **Later extras, if wanted:** clocks, sound, puzzles (as Retro Rack has trick shots), a career against named computer players, looks to earn (boards, piece sets, rooms), a replay of the game move by move.

---

## 5. Reference numbers

**The board and pieces** (sizes not checked against the FIDE equipment standards; check those if the set is redesigned)
- Squares 5.7 cm, a 3 cm border, so the board is 51.6 cm across. A light square at each player's right (h1 and a8).
- Light squares `#c4a67c`, dark squares `#5a3b78`, the frame `#3a2452`. White pieces `#efe1c3`, black pieces `#2c2140`. The light squares were darkened from `#d8c3a0` because under the lamp they washed out next to the white pieces.
- Piece heights: king 8.7 cm, queen 7.7, bishop 6.8, knight 6.3, rook 5.3, pawn 4.3. Bases 2.9 cm (pawn) to 3.8 cm (king) across. Pieces taken stand at 80% size.

**The computer opponents** (measured with `tools/sim-bots.js`, 7 November 2026)

| Bot | Target | Looks ahead | Blunder chance | k | Temperature | Style | Measured against | Measured rating |
|---|---|---|---|---|---|---|---|---|
| Ted | 1500 | 4 moves | 3% | 0.046 | 11 | none | Stockfish 1500: 53.5% | 1525 ±45 |
| Daws | 1300 | 3 | 4% | 0.062 | 14 | checks +25 | Stockfish 1320: 45.4% | 1288 ±45 |
| Jake | 1150 | 2 | 5% | 0.062 | 14 | none | Daws: 34.8% | 1179 ±64 |
| Magnus | 1000 | 2 | 7% | 0.076 | 17 | castling +40 | Jake: 27.1% | 1007 ±81 |
| Barney | 850 | 2 | 9% | 0.133 | 34 | none | Magnus: 28.7% | 849 ±95 |
| Joseph | 700 | 1 | 12% | 0.111 | 27 | none | Barney: 29.4% | 697 ±107 |
| Dom | 550 | 1 | 15% | 0.157 | 42 | queen moves +25 | Joseph: 31.5% | 562 ±118 |
| Ollie | 400 | 1 | 19% | 0.237 | 74 | captures +80 | Dom: 30.0% | 415 ±128 |
| Alfie | 250 | 1 | 24% | 0.248 | 78 | pawn moves +30 | Ollie: 30.2% | 270 ±137 |
| Torben | 100 | 1 | 30% | 0.279 | 93 | none | Alfie: 29.6% | 119 ±145 |

- Each measurement is 240 games. Each rating builds on the measured rating of the bot above, so the margins (about two standard errors) add up down the chain: the lowest bots are the least certain. Every bot follows captures through to the end.
- The rounds: the tuning run put the bots in place; the first check (240 games a bot) measured Ted 1525 ±45 but Daws 72 short and the gaps below nearer 190 than 150, down to Torben at −91; the first correction overshot at the bottom (Torben 271), since there strength changes faster with the knob than the tuning steps showed; the second, using each bot's two checks, gave the figures above (Ted from the first check, unchanged since).
- **The mix of moves** (each bot playing itself for 5 games, every move after the 8th judged by a 3-move search with captures followed: good is within half a pawn of the best, a blunder two pawns or more worse; about 350 to 550 moves a bot, so ±3 to 4%): Torben 45% good, 28% middling, 27% blunders; Alfie 47 / 28 / 25; Ollie 56 / 25 / 19; Dom 62 / 20 / 18; Joseph 69 / 18 / 13; Barney 73 / 16 / 11; Magnus 81 / 9 / 10; Jake 85 / 9 / 6; Daws 95 / 1 / 4; Ted 90 / 4 / 6. The judge looks no further than Daws and less far than Ted, so for those two the figures mostly show where it disagrees with them (Ted's set blunder chance is 3%).
- Looking 1 move ahead without following captures measured about 760 points below the 500 bot of the first eight, so no bot does that.
- Stockfish: stockfish.js 19.0.1, the full single-threaded engine, 60 ms a move, `UCI_LimitStrength` on.

**The camera in a game**
- Tilted 0.95 rad (54°) down to start, between 0.35 and 1.45 rad when tilted by hand; zoom 0.6 to 2.2 times the distance that fits the board.

**Rendering** (as in Retro Rack)
- Default pixel size 1× (one game pixel per page pixel) and 256 shades (full colour, no dithering). Max draws one game pixel per real screen pixel, up to 3 per page pixel.

---

## 6. How things are tested

- **Rules:** `tests/core.test.js` (28 tests): perft counts for five standard positions, castling, en passant, promotion, pins, checkmate, stalemate, each draw, resigning, take back, notation and saving, and that the context packs are up to date.
- **Engine and bots:** `tests/bots.test.js` (18 tests): the cast, blunder chances, the renaming, the knob, the evaluation, mates, captures, what happens without following captures, real blunders, seeds, legal moves, a whole bot game. Their strength: `tools/sim-bots.js` (section 5).
- **The browser:** headless Chromium (Playwright) with software WebGL (SwiftShader). The page exposes `window.__rs` (state, position, moves, where each square is on the screen and so on) to make scripting easy; the `play` and `cpu` tests play with real mouse taps and drags at those positions. `node tests/browser/run-all.js` runs them all (see `AGENTS.md`, Testing): `file`, `fit`, `play`, `cpu` and `app`.
- **Software WebGL is slow,** so keep test windows small (about 480×360) unless the size is what's being tested.

---

## 7. Ideas list (discussed; the ones built since say so)

- **Two players on one device, with the full rules:** built (Stage 1).
- **The computer opponents:** built (Stage 2).
- **Online play (Stage 3):** next.
- **Nell's thinking** comes in steps of up to about a tenth of a second (one candidate move searched 3 moves deep at a time), so on a slow phone the picture may stutter while she thinks; the search could pause more often if that shows.
- **Possible for the bots later:** more of them (above 1500, or in between); a hint button; the bots saying something now and then (as chess.com's do); tuning the weakest bots to human mistake figures as well, if the owner finds them unlike real beginners.
- **Small things noticed in Stage 1:** the piece could follow the finger while dragged; sound (a wooden "tock" on a move); a bigger move list on phones.
- **Still open** are listed in section 4, "Decisions still to make".
- **From Retro Rack, ready to port when wanted:** the menu screens with sliding panels and Play again, Settings with tabs, the phone layout, sound and volume, vibration, fullscreen and the sideways hint, the computer player's search spread across frames, online rooms with Rejoin and the version check, the players' ideas box, the career, and the locker of looks.

---

## 8. How changes are made

- Work happens in Claude Code, which pushes to GitHub through its GitHub connector.
- **Node.js** is needed for `node tools/build.js` and `node tests/core.test.js`. If it's missing, install the LTS version from nodejs.org.
- **The routine** (details in `AGENTS.md`, "How changes are made"): describe a change; Claude Code explains the options and builds the one chosen on a branch, rebuilds `index.html`, runs the tests and opens a pull request. When the owner says "merge it", it is squash-merged into `main`, and the live site updates a minute or two later (Ctrl+F5 to see it).
- **Keep it to one change at a time.**
- **To undo a change,** revert it and push the revert, so the site goes back to how it was.

**Suggested first message in a new session:**
> Read AGENTS.md and HANDOVER.md. Run the tests and the build, and tell me whether everything is working. Don't change or push anything yet.

**To give another AI the whole project:** give it the link https://raw.githubusercontent.com/flopp-r/retro-set/main/CONTEXT.md (or the file itself). If it can't take a file that size, use `CONTEXT-SHORT.md`.

---

## 9. Changes shipped

Every change merged into `main`, newest last. The version is the fingerprint shown at the bottom of the menu.

| Date | Pull request | Version | What changed |
|---|---|---|---|
| 7 Nov 2026 | (first commit, no pull request) | 2cc43742 | The working setup from Retro Rack: guides, one-file build, context packs, tests, installable app; a placeholder board. |
| 7 Nov 2026 | #1 | 4e335390 | Stage 1: two players on one device with the full rules; low-poly classic pieces; tap or drag to move; take back, resign, agree a draw; the view turning to the player to move; Resume after a reload. |
| 7 Nov 2026 | #2 | 4be88115 | Stage 2: eight computer opponents from 100 to 1500 (Pip to Nell), measured against Stockfish and each other; the Vs computer screen, your colour, take back of both moves, draw offers, Resume against the computer. |
