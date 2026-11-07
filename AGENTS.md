# Retro Set: guide for AI assistants and developers

This is the main guide for anyone, person or AI, who changes this project. Claude Code reads it through `CLAUDE.md`; other AI coding tools (OpenAI Codex, Cursor, GitHub Copilot and others) read `AGENTS.md` directly. A chat AI that can't open the repository can be given `CONTEXT.md` instead: this guide, the other notes, a map of the code and the full source in one file (`CONTEXT-SHORT.md` is the same without the source).

## Start here

**What it is.** Retro Set will be a 3D pixel-art chess game, a sister to the owner's pool game Retro Rack (https://github.com/flopp-r/retro-rack, live at https://flopp-r.github.io/retro-rack/). Like Retro Rack it is one self-contained web page, hosted on GitHub Pages from this repository, and installable as an app. Live (once GitHub Pages is switched on): https://flopp-r.github.io/retro-set/

**Where it's up to.** The working setup is in place, copied from Retro Rack: this guide and the other notes, the one-file build, the context packs, the tests, and the installable app. The page itself is a placeholder: the title screen in front of an empty board, drawn with Retro Rack's pixel-art pipeline. The game (rules, pieces, menus, opponents) hasn't been designed yet; the decisions waiting for the owner are listed in `HANDOVER.md` (section 4). Agree each one with the owner before building it.

**Read in this order**
1. This file: how it works, the rules, and how to test and ship a change.
2. `HANDOVER.md`: why things are the way they are, reference numbers, the decisions still to make, and a dated list of every change shipped.
3. `README.md`: how the owner set it up, and what players see.
4. The code: `src/core.js` (the chess rules and the computer player, to come), then `src/game.js` (everything in the browser). Both are split into sections marked `// ------ name`; the map in `CONTEXT.md` lists them with line numbers.

**Rules that must never be broken**
1. **`index.html` is built output.** Edit `src/`, then run `node tools/build.js`, and commit both.
2. **A clean console:** no errors, warnings or deprecated APIs.
3. **`main` is live.** Pushing to `main` deploys the site. Work on a branch and test first.
4. **`src/core.js` has no DOM.** The rules and the computer player must also run in Node, for the tests and tools.
5. **The repository is public.** Never commit personal details, passwords, tokens or keys.
6. **Once there is online play:** both browsers must agree on every position, and both players need the same version. Ask the owner before changing online messages or behaviour, and keep old fields working where possible.

## Project conventions

- Explain changes in plain language, say what will change on screen, and keep jargon out of summaries.
- UK English and metric units everywhere: in the UI, comments and messages.
- Ask before large redesigns, as well as before anything that changes online play (rule 6 above).
- Every menu screen must fit a phone held sideways (762×341) without scrolling. A long list may scroll inside its panel; the screen itself still fits.
- Code style: match the file you're in. Compact, mostly one statement per idea, comments only where the reason isn't obvious. No build step beyond `tools/build.js`, and no frameworks or npm packages in the game.
- Browser storage keys start with `retroSet.` (Retro Rack's start with `retroRack.`, so the two games never read each other's saves on the same site). Wrap every access in try/catch: storage can be missing or blocked.

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
| `src/core.js` | The chess rules and the computer player (to come). No DOM; also runs in Node for tests and tools. For now it holds the starting position. |
| `src/game.js` | Everything in the browser: rendering, camera, menus, the installable app. For now the room, the empty board and the title screen. |
| `src/shell.html` | Page markup and CSS, with placeholders the build fills in (fonts, favicon, `__BUNDLE__`). |
| `vendor/` | three.js r159 ES-module build and the two pixel fonts (with their licences), the same files as Retro Rack's. |
| `tools/build.js` | Builds `index.html`: inlines fonts, three.js and the game code into one self-contained file. The game's source files are listed in `CODE` at its top. |
| `tools/make-context.js` | Makes `CONTEXT.md` and `CONTEXT-SHORT.md`; the build runs it. New source files go in its `SOURCE` list. |
| `tools/make-icons.js` | Draws the app icons (a pixel-art pawn on a chequerboard). |
| `tests/core.test.js` | Tests of `src/core.js` (the rules, as they're built), plus a check that the context packs are up to date. |
| `tests/browser/` | Browser tests: real pages in headless Chromium. `run-all.js` runs them; see Testing. |
| `package.json` | npm shortcuts for the commands below (`npm run build`, `npm test`, `npm run test:browser`). Nothing to install. |
| `.nojekyll` | Stops GitHub Pages running Jekyll over the repository. |

## Commands

No installs are needed for the game itself, only Node.

- `node tools/build.js`: rebuild `index.html` after any change in `src/`. It also remakes `CONTEXT.md` and `CONTEXT-SHORT.md`, so run it after changing the notes too.
- `node tests/core.test.js` (or `npm test`): the core tests. They must pass before pushing.
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
- Today it holds `START`, the standard starting position in FEN (Forsyth–Edwards Notation: the pieces rank by rank from Black's side, then who moves, castling rights, the en passant square, the halfmove clock and the move number).
- To come, once agreed with the owner: the board, legal moves (castling, en passant, promotion), check, mate and the draws, and the computer player. Two habits carried over from Retro Rack, because they made its tests and online play dependable:
  - No `Math.random` in `core.js`: anything random (the computer's choice between equal moves, say) takes a seeded generator, so a test or a replay repeats exactly.
  - The computer player as a generator (`function*`), so its search can be spread across frames and the page never freezes (see `planBot` in Retro Rack's `core.js`).

### Browser (`src/game.js`)
- **Rendering** (the renderer + post section, the same as Retro Rack's): the scene is drawn at low resolution into a render target; a post-processing shader then adds outlines where the depth jumps, a vignette and, below full colour, Bayer dithering and colour quantisation; the canvas is scaled up with hard pixel edges. Lights use three.js physical units; colour management is off, so colours appear exactly as written. `resize()` sets the drawing size from `S.pixel` (game pixels per screen pixel; 0 is Max, one per real screen pixel, as in Retro Rack).
- **Settings:** `S` in localStorage (`retroSet.settings`), with `DEFAULTS` at the top of the file: `pixel` 1 and `levels` 256 (the sharpest picture), `dither` and `outline` on. There is no Settings panel yet.
- **The scene** (placeholder): a dark floor, a round wooden table and an empty board (8 × 5.7 cm squares with a 3 cm border, a light square at each player's right), lit by a hemisphere light, a directional light and a lamp. Behind the menu the camera circles slowly (`cam`); with reduced motion it holds still. `frameBoard()` shifts the picture (`camera.setViewOffset`) so the board sits in the space the menu panel leaves, to its right or, on an upright phone, below it, and moves the camera back on screens narrower than they are tall.
- **States:** `state` is `menu` for now; the game's states come with the game.
- **Installable app:** `game.js` adds the manifest link and registers `sw.js` only on http(s), so a copy opened from disk stays quiet. The version line (`#ver`) shows `BUILD`, which `tools/build.js` stamps with a fingerprint of the game code.
- **For the tests:** `window.__rs` gives the state, the frame count, the triangles drawn each frame, the settings and the starting position, so tests can check the page without reaching into its internals. Add to it as the game grows (Retro Rack's `window.__rr` is the model).

### Page (`src/shell.html`)
- The markup and all the CSS. The palette (`:root`), the fonts and the panel and button styles are Retro Rack's. The menu is a panel on the left (`#menu`, `#menuPanel`) holding a stack of screens (`#mStage`, `.mScreen`); there is one screen (`sc-home`) for now. The media query for short screens (500 px or less) is the phone-on-its-side layout.

### Online play
Not built. If the owner chooses it, follow Retro Rack's design: the browser in each seat runs the full game and a small relay only forwards messages; the receiver checks every move is legal with `core.js` before playing it, and both sides compare positions after each move; the version check before a game starts; reconnecting by a per-tab client id. Chess sends moves, not physics, so agreeing on positions is far easier than in pool, but the version check still matters, because a rules change would make the two browsers disagree.

## Testing

1. **Core:** `node tests/core.test.js` must report 0 failed. Today it checks that `core.js` runs in Node, the starting position, and that `CONTEXT.md` and `CONTEXT-SHORT.md` match the code and notes (if not, run the build). The rules tests go here as the rules are built: every special move, check, mate, stalemate and each draw, and known positions with a known number of legal moves (perft counts) to catch move-generation bugs.
2. **Browser tests:** `node tests/browser/run-all.js` builds the game, serves a copy of it locally like GitHub Pages (under `/retro-set/`, on port 8180, so Retro Rack's tests can run at the same time), then runs every `*.test.js` in `tests/browser/` in headless Chromium and prints a summary. Each check prints `PASS` or `FAIL`, and each file also fails if anything reaches the browser console.
   - Needs Playwright with Chromium (preinstalled in Claude Code's cloud sessions; elsewhere `npm install --no-save playwright` then `npx playwright install chromium`). Nothing is written into the repository; screenshots go to a temporary folder, printed at the end.
   - Software rendering is slow, so `lib.js` starts test pages at pixel size 3× and 8 shades rather than the game's sharper defaults, unless a test sets its own settings or opens the page with `?realdefaults` (as the check of the defaults does). Keep test windows small (about 480×360) unless the size is what's being tested.
   - The files: `file` (the page opened from disk: the version, no install bits, the board drawn, the real defaults), `fit` (the menu fits at phone, tablet and computer sizes, including a phone on its side), `app` (installable app, offline start, updates arriving; over http).
   - New features get a new test file, or new checks in the file that fits. A test that reloads a page or uses two pages needs storage to carry over, so it runs over http (`SITE.new`), not from disk.
3. **By eye:** for gameplay or UI changes, open `index.html` in a browser and try the change, watching the console.

## Keeping the notes current

Update this file, `HANDOVER.md` and `README.md` in the same change as the code, then rebuild so the context packs follow. In `HANDOVER.md`, add the change to the list of changes shipped once it is merged. Notes go stale quietly, so when you find one that no longer matches the code, fix it.

## Ideas list

The decisions waiting for the owner, and the ideas list, are in `HANDOVER.md` (sections 4 and 7).
