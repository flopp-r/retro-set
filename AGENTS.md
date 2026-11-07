# Retro Set: guide for AI assistants and developers

This is the main guide for anyone, person or AI, who changes this project. Claude Code reads it through `CLAUDE.md`; other AI coding tools (OpenAI Codex, Cursor, GitHub Copilot and others) read `AGENTS.md` directly. A chat AI that can't open the repository can be given `CONTEXT.md` instead: this guide, the other notes, a map of the code and the full source in one file (`CONTEXT-SHORT.md` is the same without the source).

## Start here

**What it is.** Retro Set will be a 3D pixel-art chess game, a sister to the owner's pool game Retro Rack (https://github.com/flopp-r/retro-rack, live at https://flopp-r.github.io/retro-rack/). Like Retro Rack it is one self-contained web page, hosted on GitHub Pages from this repository, and installable as an app. Live (once GitHub Pages is switched on): https://flopp-r.github.io/retro-set/

**Where it's up to.** The owner chose 3D pixel art, classic piece shapes, the full rules without clocks, and all three ways of playing, built in stages (`HANDOVER.md`, section 4). Stage 1 is built: two players on one device, with the full rules, take back, resigning, agreed draws, and Resume after a reload. Stage 2 is built: eight computer opponents from 100 to 1500, their strength measured against Stockfish and each other. Next: Stage 3, online play. Agree the details of each with the owner before building it.

**Read in this order**
1. This file: how it works, the rules, and how to test and ship a change.
2. `HANDOVER.md`: why things are the way they are, reference numbers, the decisions still to make, and a dated list of every change shipped.
3. `README.md`: how the owner set it up, and what players see.
4. The code: `src/core.js` (the chess rules and the computer player's engine), `src/bots.js` (the computer opponents), then `src/game.js` (everything in the browser). Both are split into sections marked `// ------ name`; the map in `CONTEXT.md` lists them with line numbers.

**Rules that must never be broken**
1. **`index.html` is built output.** Edit `src/`, then run `node tools/build.js`, and commit both.
2. **A clean console:** no errors, warnings or deprecated APIs.
3. **`main` is live.** Pushing to `main` deploys the site. Work on a branch and test first.
4. **`src/core.js` and `src/bots.js` have no DOM.** The rules, the engine and the bots must also run in Node, for the tests and tools.
5. **A bot's rating is measured, never guessed.** Changing the engine (evaluation, search) or a bot's settings changes its strength: re-run `node tools/sim-bots.js tune`, put the new values into `src/bots.js`, then `check`, and record the results in `HANDOVER.md` (section 5).
6. **The repository is public.** Never commit personal details, passwords, tokens or keys.
7. **Once there is online play:** both browsers must agree on every position, and both players need the same version. Ask the owner before changing online messages or behaviour, and keep old fields working where possible.

## Project conventions

- Explain changes in plain language, say what will change on screen, and keep jargon out of summaries.
- UK English and metric units everywhere: in the UI, comments and messages.
- Ask before large redesigns, as well as before anything that changes online play (rule 7 above).
- Every menu screen must fit a phone held sideways (762×341) without scrolling. A long list may scroll inside its panel; the screen itself still fits.
- Code style: match the file you're in. Compact, mostly one statement per idea, comments only where the reason isn't obvious. No build step beyond `tools/build.js`, and no frameworks or npm packages in the game.
- Browser storage keys start with `retroSet.` (Retro Rack's start with `retroRack.`, so the two games never read each other's saves on the same site): `retroSet.settings`, `retroSet.game` and `retroSet.menu` so far. Wrap every access in try/catch: storage can be missing or blocked.

## Reusing Retro Rack

Most of what this game will need beyond the chess itself already exists in Retro Rack and has been tested there: the menu screens and their sliding panel, Settings with tabs, the phone layout, sound, the computer player's search spread across frames, online rooms through a Cloudflare relay (with reconnecting, Rejoin and the version check), the career and the locker of looks. When the owner asks for one of these, port it from Retro Rack rather than writing it again, and keep the look (palette, fonts, pixel-art buttons) the same, so the two games feel like a family.

- Read Retro Rack's `AGENTS.md` for how each piece works, and its source for the code. If the repository isn't attached to the session, it's public: `https://raw.githubusercontent.com/flopp-r/retro-rack/main/CONTEXT.md` has its notes and full source in one file.
- Copy the code into this repository (there is no shared library; each game is one self-contained page), then adapt it: names, storage keys, and anything pool-specific.
- Retro Rack's `HANDOVER.md` records why each piece is the way it is, including ideas tried and dropped. Check it before redesigning something it already settled.

## Files

| Path | What it is |
|---|---|
| `AGENTS.md` | This guide. `CLAUDE.md` just points Claude Code here. |
| `HANDOVER.md` | Decisions and why, reference numbers, the ideas list, and the list of changes shipped. |
| `README.md` | Setting up the site, installing the app, and asking another AI about the project. |
| `CONTEXT.md`, `CONTEXT-SHORT.md` | **Generated** by the build: the context packs for AI assistants (see top). Never edit by hand. |
| `index.html` | **Built output.** Never edit by hand; edit `src/` and run the build. It is committed because GitHub Pages serves it. |
| `sw.js` | The service worker for the installable app. Network first: the saved copy is only used offline. |
| `manifest.webmanifest`, `icons/` | The app's name, colours and icons. The icons are generated by `tools/make-icons.js`. |
| `src/core.js` | The chess rules (positions, legal moves, check, mate, the draws, notation, games) and the computer player's engine (evaluation, search, the human-like choice). No DOM; also runs in Node for tests and tools. |
| `src/bots.js` | The eight computer opponents: names, faces, lines, ratings and settings, and the strength knob. No DOM; also runs in Node. |
| `src/game.js` | Everything in the browser: rendering, the board and pieces, input, camera, the game's bar and panels, menus, saving, the installable app. |
| `src/shell.html` | Page markup and CSS, with placeholders the build fills in (fonts, favicon, `__BUNDLE__`). |
| `vendor/` | three.js r159 ES-module build and the two pixel fonts (with their licences), the same files as Retro Rack's. |
| `tools/build.js` | Builds `index.html`: inlines fonts, three.js and the game code into one self-contained file. The game's source files are listed in `CODE` at its top. |
| `tools/make-context.js` | Makes `CONTEXT.md` and `CONTEXT-SHORT.md`; the build runs it. New source files go in its `SOURCE` list. |
| `tools/make-icons.js` | Draws the app icons (a pixel-art pawn on a chequerboard). |
| `tools/sim-bots.js` | Measures and tunes the bots' strength: games against Stockfish at its calibrated strength settings and against each other, on every core. Installs Stockfish into a temporary folder; it is never part of the game. |
| `tests/core.test.js` | Tests of the rules in `src/core.js` (move counts against published figures, every special move, each way a game ends, notation), plus a check that the context packs are up to date. |
| `tests/bots.test.js` | Tests of the engine and the bots: the cast, the knob, the evaluation, mates, captures, the weakest bots' mistakes, seeds, legal moves from every bot, a whole bot game. |
| `tests/browser/` | Browser tests: real pages in headless Chromium. `run-all.js` runs them; see Testing. |
| `package.json` | npm shortcuts for the commands below (`npm run build`, `npm test`, `npm run test:browser`). Nothing to install. |
| `.nojekyll` | Stops GitHub Pages running Jekyll over the repository. |

## Commands

No installs are needed for the game itself, only Node.

- `node tools/build.js`: rebuild `index.html` after any change in `src/`. It also remakes `CONTEXT.md` and `CONTEXT-SHORT.md`, so run it after changing the notes too.
- `node tests/core.test.js` and `node tests/bots.test.js` (`npm test` runs both): the rules and the engine tests. They must pass before pushing.
- `node tools/sim-bots.js match <a> <b> [games]`: play two players against each other and print the score and the rating gap (a bot such as `nell`, a bot with another knob or depth such as `nell@0.2/4`, or Stockfish at a strength such as `sf1500`). `tune [games]` finds every bot's knob (about 1½ hours on 4 cores); `check [games]` measures them all. The first run installs Stockfish (npm) into a temporary folder.
- `node tests/browser/run-all.js [words]`: run the browser tests (all of them, or only files whose names contain the words). See Testing.
- `node tools/make-icons.js`: redraw the app icons (pixel art, no installs). The build inlines `icons/favicon-32.png`.
- To look at the game: open `index.html` in a browser. The installable-app parts need the page served over http, since service workers don't run from `file://`; the `app` browser test does that.

## Deployment (automatic on push to `main`)

- **GitHub Pages** serves the repository root (`index.html`) at https://flopp-r.github.io/retro-set/ within a minute or two, once the owner has switched it on (repository Settings, Pages, branch `main`, folder `/ (root)`; see `README.md`). Browsers cache; tell the owner to press Ctrl+F5 after an update.
- There is no relay yet. If online play is chosen, it gets its own Cloudflare Worker (named `retro-set-relay`, in a `relay/` folder, deployed by Cloudflare Workers Builds the way Retro Rack's is), never Retro Rack's relay, so a change to one game can't break the other. Keep it on the free plan: the WebSocket Hibernation API, no polling, no per-message storage writes.

## How changes are made

1. Agree the change with the owner first: explain the trade-offs, recommend one, then build what they pick.
2. Work on a branch. Edit `src/` (and the notes), run `node tools/build.js`, run the tests (see Testing), and commit `src/`, `index.html` and the context packs together.
3. Open a pull request into `main`. When the owner says to merge, squash-merge it.
4. GitHub Pages publishes within a minute or two; the "pages build and deployment" run in the repository's Actions confirms it. Read the version from the committed `index.html` (`const BUILD = '…'`), not from memory, and tell the owner, who checks it at the bottom of the menu after pressing Ctrl+F5.

## Architecture

### Core (`src/core.js`)
- One object, `CORE`, made inside a function so nothing leaks into the page; at the bottom, `module.exports = CORE` when running in Node. The build puts it first in the page, so `game.js` uses it as `C`.
- **Squares** are numbered 0 to 63: a1 = 0, b1 = 1 … h8 = 63 (rank × 8 + file); `sq('e4')` and `sqName(28)` convert. **Pieces** are letters, `PNBRQK` White and `pnbrqk` Black (`colour()`, `kind()`).
- **A position** is `{ b, turn, castle, ep, half, full }`: `b` is 64 strings (a piece letter, or `''` for an empty square), then who moves (`'w'`/`'b'`), the castling rights (`'KQkq'` or part of it), the en passant square (or -1), the halfmove clock (moves since a capture or a pawn move) and the move number. `parseFen()` and `toFen()` read and write FEN (Forsyth–Edwards Notation); `START` is the starting position.
- **Moves:** `legalMoves(pos)` gives every legal move as `{ from, to, p, cap, promo, ep, dbl, castle }` (the piece, the piece taken, what a pawn becomes, an en passant capture, a pawn's two-square advance, `'K'` or `'Q'` for castling). `pseudoMoves()` makes them, and a move is legal if the mover's king isn't attacked afterwards (`attacked()`, `inCheck()`). `makeMove()` returns the next position; castling rights go when the king or a rook moves or a rook is taken on its home square (`LOSE`). `perft(pos, n)` counts the positions n moves on, the standard check on move generation.
- **Games** never change: `newGame(fen)`, `play(game, { from, to, promo })` (null if the move isn't legal), `playUci(game, 'e2e4')`, `undo(game)` and `finish(game, score, why)` (resigning, an agreed draw) each return a new game `{ start, pos, list, keys, result }`. `list` holds each move with its notation (`san()`: Nf3, exd5, O-O, e8=Q+, Qh4#) and the position after it; `keys` the repetition key of each position (`repKey()`: the pieces, the side to move, castling, and an en passant square only when the capture can really be played).
- **The end** (`judge()`, after every move): checkmate, stalemate, a third repetition, fifty moves each with no capture or pawn move, and too few pieces to mate (`deadPosition()`: kings alone, one bishop or knight, or only bishops all on one colour of square). The repetition and fifty-move draws happen at once, as on most online sites, rather than being claimed. `result` is `{ score: '1-0' | '0-1' | '1/2-1/2', why }`, `why` one of `checkmate`, `stalemate`, `repetition`, `fifty`, `material`, `resigned`, `agreed`.
- **The computer player** (the computer player section): `evaluate(pos)` scores a position for the side to move in centipawns (100 = a pawn): material (`VALUE`) and where the pieces stand (`PST`, the "simplified evaluation function" tables; the king's table moves from sheltering to coming out as pieces come off), passed pawns (more the further on), doubled and isolated pawns, rooks on open files, the bishop pair, and the king's pawn shelter while there's a middlegame. `negamax()` searches a set number of moves ahead with alpha-beta pruning, captures first (`order()`), one move further when in check; `quiesce()` then follows captures until the position is quiet. `think(game, cfg, rnd)` chooses a move: it scores every legal move by searching the reply, adds the bot's style bonuses, then picks with a softmax over the scores at temperature `cfg.temp` (the higher, the likelier a worse move), with a chance `cfg.blunder` of any legal move instead. Looking one move ahead (`depth` 1) with captures followed through, it sees a piece left to be taken but not a fork, a pin or any other threat (the low bots' blind spot); it also checks for a mate in one and a stalemate. Without following captures (`qs` false) it grabs defended pieces and loses them: measured, that is weaker than the 100 bot even at its best, so every bot follows captures through. A move repeating the position a third time scores 0. In the first 8 moves the temperature is at least 30, so games don't all open the same way. Moves scoring far below the best so far are only searched far enough to show it (the `floor`).
- Two habits carried over from Retro Rack: no `Math.random` in `core.js` (choices take a seeded generator, `rng(seed)`, so a test or a measurement repeats exactly), and the computer player as a generator (`think` is a `function*`, yielding after each move it scores, so the page spreads the thinking over frames; `runThink()` runs it to the end at once, for the tests and tools).

### The bots (`src/bots.js`, `tools/sim-bots.js`)
- `LIST` holds the eight bots, weakest first: `id`, `name`, `rating` (the target it was tuned to), `look` (the portrait), `blurb` (the line on the picker) and `cfg`: `depth` and `qs` (follow captures through) chosen by hand, `k` (the strength knob) found by `tools/sim-bots.js`, and `style` bonuses for the moves the bot likes (`capture`, `check`, `pawn`, `castle`, centipawns). `knob(k)` turns k into `temp` and `blunder` (0 is the engine's best at that depth; from 1.41 every move is random); `settings(bot)` gives `think()` its full settings.
- **How the ratings are anchored:** Nell (1500) is tuned to score 50% against Stockfish at `UCI_Elo` 1500, and Tariq (1300) to score 47% against Stockfish at 1320 (its lowest setting, so 20 points above him). Each bot below is tuned to score 24% against the one above it, which is what a 200-point gap means. Stockfish's strength setting is calibrated by its makers against engine rating lists (CCRL), not against people, and the gaps are measured between bots, so the ratings are as accurate as that anchor and the number of games (`HANDOVER.md`, section 5, has the measured figures with their margins). They are not chess.com ratings: chess.com's, lichess's and FIDE's scales differ, by hundreds of points at the low end.
- **`tools/sim-bots.js`** plays games in worker threads (one a core): bots run `runThink()`, Stockfish (stockfish.js 19, the full single-threaded engine, as a child process speaking UCI) gets 60 ms a move, which is plenty at its weakest settings since they choose after a very shallow search. A game still going after 240 half-moves is decided on material (a side three pawns ahead wins, else a draw); one a clear rook-and-minor ahead for 6 half-moves after move 15 is stopped as won. `tune` steps each bot's knob from 0 up until it's below its target, then closes in by straight-line steps in rating points; `check` replays each bot against its reference and prints the measured rating.

### Browser (`src/game.js`)
- **Rendering** (the renderer + post section, the same as Retro Rack's): the scene is drawn at low resolution into a render target; a post-processing shader then adds outlines where the depth jumps, a vignette and, below full colour, Bayer dithering and colour quantisation; the canvas is scaled up with hard pixel edges. Lights use three.js physical units; colour management is off, so colours appear exactly as written. `resize()` sets the drawing size from `S.pixel` (game pixels per screen pixel; 0 is Max, one per real screen pixel, as in Retro Rack).
- **Settings:** `S` in localStorage (`retroSet.settings`), with `DEFAULTS` at the top of the file: `pixel` 1 and `levels` 256 (the sharpest picture), `dither` and `outline` on, and `turn` (on a shared device the view turns round to the player to move; switched in the game's Menu panel). There is no Settings panel yet. The menu's choices are `M` (`retroSet.menu`: the bot picked, your colour).
- **The board** (the board section): squares of 5.7 cm with a 3 cm border on a round wooden table. Square `s` is centred at (`sqX(s)`, 0, `sqZ(s)`); White sits at +z, so from White's side a1 is at the near left. The squares and the coordinates are one small texture (`boardTex`, 16 px a square), the letters and numbers in a 3 × 5 pixel font (`GLYPH`) on all four sides, each set the right way up for the player nearest. Marks on the squares (`showMarks()`, `MARKS`): the last move, the piece picked up, a king in check (rose), and where the piece can go (a blue dot, or a ring round a piece it can take).
- **The pieces** (the pieces section): classic Staunton shapes, low-poly: each turned on a lathe with 10 flat sides from a profile (`PROFILE`, [radius, height] in metres), plus the rook's battlements, the queen's crown points, the king's cross and the knight's head (`KNIGHT_HEAD`, a side view extruded). `PIECE_GEO` holds each kind's parts once; `makePiece()` builds one, `placeAll(game)` sets out the whole board, with the pieces taken standing beside it on the taker's side (`trayPos()`). Knights look to their owner's left, so each player sees the head side on. `pieceIcon()` draws a pixel picture of a piece from the same profiles (the promotion buttons).
- **States:** `menu`, `play` (waiting for a move), `think` (the computer choosing), `anim` (pieces gliding), `promo` (choosing what a pawn becomes) and `over`. `G` is the game (see Core), `sel` the square picked up and `targets` its legal moves. `vs` is null for two players on one device, or `{ bot, me }` against the computer. `startGame(game, opp)` starts either; `startLocal()` and `startCpu()` (the bot and colour from `M`, Random tossing a coin each game) call it.
- **The computer's turn** (`startThink()`, `thinkTick()`): `C.think()` is stepped for at most 12 ms a frame, and the move waits until the bot has thought for 0.5 to 1.2 s, so it never snaps back instantly (`QUICK` skips the wait for the tests); it holds while the Menu panel is open. Against the computer the view stays on your side (Turn still swings it), you can't pick up its pieces (`mine()`), Take back goes back to before your last move (its reply too), Agree a draw becomes Offer a draw (`offerDraw()`: the bot accepts when a quick search says it's half a pawn or more worse, or, from move 30, level; `toast()` says which), and the result names you and the bot (`resultText()`).
- **Faces** (the faces section): the bots' portraits are Retro Rack's pixel people (`SPRITES`, `drawSprite()`, `portrait()`), on the picker and in the bar beside the bot's name.
- **Moving:** tap a piece then a square, or drag a piece onto a square (`squareAt()` raycasts the pieces, then the board's plane; `tap()`, and the pointer handlers in the input section). `tryMove()` plays it with `C.play()`, then the pieces glide (`animate()`, `glideTick()`: a knight hops, a castling rook jumps, a taken piece flies to the side), then `placeAll()` and `afterMove()`. A pawn reaching the end opens the promotion choice first (`askPromo()`). With reduced motion nothing glides.
- **The camera** (`cam`): behind the menu it circles slowly (with reduced motion it holds still), the picture shifted (`camera.setViewOffset`) into the space the menu panel leaves: to its right, or below it on an upright phone. In a game it looks down from the side of the player to move (`base`, turned by `afterMove()` when `S.turn` is on, or by the Turn button) plus however far the player has turned it (`yawOff`, by dragging across empty space; up and down tilts, `pitch`), far enough back for the board to fit the screen, times `zoom` (the mouse wheel or a pinch). Every value glides to its goal (`cam.goal()`, `cam.update()`).
- **The game's screen:** the bar along the top (White, whose move it is with the last move, Black), the moves on the right (hidden on phones), and Menu, Take back and Turn at the bottom left (`hud()`). The panels: Menu (`#pause`: Turn the board, Resume, Agree a draw, Resign, Quit to menu; resigning and the draw need a second tap within 3 seconds, `confirmTap()`), the promotion choice (`#promo`) and the result (`#over`, `showOver()`, `resultText()`: Play again, See the board, Main menu). Take back works any number of times, also after a mate or a draw on the board, but not after a resignation or an agreed draw. Esc, the back gesture and a tap outside close a panel; in a game the back gesture opens the Menu panel instead of leaving the page (one history entry kept armed, `arm()`).
- **Menus:** `menuGo(name)` shows a screen (`home` or `cpu`) with a Back bar (`#mTop`) away from home; the back gesture and Esc go back. Home has Resume (when a game is saved), Two players, Vs computer, and Online (shown but switched off until Stage 3); `refreshHome()` keeps it current, and the card for the kind of game saved says a new one replaces it. Vs computer (`renderCpu()`): the eight bots as cards (face, name, rating), the picked one's line, You play White / Random / Black, and Play. `toMenu()` goes back home.
- **Saving:** the game is saved after every move (`save()`, localStorage `retroSet.game`: `{ v: 1, start, moves, vs }`, the moves written as e2e4, `vs` the bot and your colour or null), and `loadSaved()` replays it for Resume, checking every move again (it returns `{ g, vs }`). A finished game is forgotten.
- **Installable app:** `game.js` adds the manifest link and registers `sw.js` only on http(s), so a copy opened from disk stays quiet. The version line (`#ver`) shows `BUILD`, which `tools/build.js` stamps with a fingerprint of the game code.
- **For the tests:** `window.__rs` gives the state, the frame count, the triangles drawn each frame, the settings, the position (`fen`), the moves, the result, the piece picked up, the view, the pieces on the board and beside it, `start2(fen)` (a two-player game from any position), `startCpu(bot, me, fen)` (a game against a bot), `vs`, `quick` (set it to skip the bot's pause) and `squareScreen(name)` (where a square is on the screen, to tap it), so tests can check the page without reaching into its internals. Add to it as the game grows (Retro Rack's `window.__rr` is the model).

### Page (`src/shell.html`)
- The markup and all the CSS. The palette (`:root`, with the two piece colours), the fonts, and the panel, button and card styles are Retro Rack's. The menu is a panel on the left (`#menu`, `#menuPanel`) holding a stack of screens (`#mStage`, `.mScreen`); the screens are `sc-home` and `sc-cpu` (`#botGrid`, `#botBlurb`, `#sColour`, `#bPlay`), under the Back bar `#mTop`. In a game: `#hud` (`#bar` with each side's `.plFace` and `.plName`, `#toast`, `#movesBox`, `#tools`) and the panels `#pause`, `#promo` and `#over` (`.overlay`, `.ovPanel`). The media query for short screens (500 px or less) is the phone-on-its-side layout; at 760 px wide or 500 px tall the moves panel hides; at 440 px wide the bar shows only the colour chips.

### Online play
Not built. If the owner chooses it, follow Retro Rack's design: the browser in each seat runs the full game and a small relay only forwards messages; the receiver checks every move is legal with `core.js` before playing it, and both sides compare positions after each move; the version check before a game starts; reconnecting by a per-tab client id. Chess sends moves, not physics, so agreeing on positions is far easier than in pool, but the version check still matters, because a rules change would make the two browsers disagree.

## Testing

1. **Rules and engine:** `node tests/core.test.js` and `node tests/bots.test.js` must report 0 failed. The bots' strength is measured separately, with `tools/sim-bots.js` (see The bots).
   - `core.test.js` counts the positions a few moves on from five standard test positions against the published figures (perft: the starting position to 4 moves, 197,281; "Kiwipete" to 3; and three more that test en passant, promotions and castling), then checks every special move, each way a game ends, take back, notation, and that `CONTEXT.md` and `CONTEXT-SHORT.md` match the code and notes (if not, run the build).
   - `bots.test.js` checks the cast (eight bots, 100 to 1500 in steps of 200), the knob, the evaluation (level at the start, the same from either side), a mate in one at every depth, taking a hanging queen, saving an attacked queen, the weakest bots' habit of grabbing defended pawns, seeds, a legal move from every bot, and a whole bot game.
2. **Browser tests:** `node tests/browser/run-all.js` builds the game, serves a copy of it locally like GitHub Pages (under `/retro-set/`, on port 8180, so Retro Rack's tests can run at the same time), then runs every `*.test.js` in `tests/browser/` in headless Chromium and prints a summary. Each check prints `PASS` or `FAIL`, and each file also fails if anything reaches the browser console.
   - Needs Playwright with Chromium (preinstalled in Claude Code's cloud sessions; elsewhere `npm install --no-save playwright` then `npx playwright install chromium`). Nothing is written into the repository; screenshots go to a temporary folder, printed at the end.
   - Software rendering is slow, so `lib.js` starts test pages at pixel size 3× and 8 shades rather than the game's sharper defaults, unless a test sets its own settings or opens the page with `?realdefaults` (as the check of the defaults does). Keep test windows small (about 480×360) unless the size is what's being tested.
   - The files: `file` (the page opened from disk: the version, no install bits, the board drawn, the real defaults), `fit` (every screen fits at seven sizes from an upright phone to a computer, including a phone on its side: the home screen with and without Resume, Vs computer, the game's bar and buttons apart, the Menu, promotion and result panels; over http), `play` (two players on one device, with real taps and drags: picking up and moving, an illegal move refused, turning the view, take back, castling, a capture going beside the board, promotion, the fool's mate and its result, resigning and an agreed draw with their second tap, Turn the board off, the back gesture, and Resume after a reload; over http), `cpu` (playing the computer: the eight bots on the picker, your colour, the bot replying and its pieces out of your reach, take back of both moves, a draw offer declined and accepted, resigning, mating the bot, playing Black, Resume keeping the bot and colour, the back gesture and Esc on the picker; over http), `app` (installable app, offline start, updates arriving; over http).
   - New features get a new test file, or new checks in the file that fits. A test that reloads a page or uses two pages needs storage to carry over, so it runs over http (`SITE.new`), not from disk.
3. **By eye:** for gameplay or UI changes, open `index.html` in a browser and try the change, watching the console.

## Keeping the notes current

Update this file, `HANDOVER.md` and `README.md` in the same change as the code, then rebuild so the context packs follow. In `HANDOVER.md`, add the change to the list of changes shipped once it is merged. Notes go stale quietly, so when you find one that no longer matches the code, fix it.

## Ideas list

The decisions waiting for the owner, and the ideas list, are in `HANDOVER.md` (sections 4 and 7).
