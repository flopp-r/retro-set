# Retro Set: decisions, history and changes

This file records why Retro Set is the way it is: the decisions and their reasons, reference numbers, the ideas list, and a dated list of every change shipped. Read it together with `AGENTS.md`, which explains how the code works and how to change it.

---

## 1. Current status

- The game is live at https://flopp-r.github.io/retro-set/, served by GitHub Pages from the public repository `github.com/flopp-r/retro-set` (branch `main`, root folder).
- Stage 1 (two players on one device, the full rules) is built; Stage 2 (the computer) and Stage 3 (online) are next. See section 4.
- There is no relay and no online play yet.
- Everything in section 9 (changes shipped) is live. The version shown at the bottom of the menu matches the `BUILD` value in the committed `index.html`.

---

## 2. Working preferences

Personal working preferences are kept in the owner's own Claude Code settings, not in this public repository. Project conventions (plain-language explanations, UK English, metric units, a clean console, testing before pushing) are in `AGENTS.md`.

---

## 3. How the project got here (short history)

1. **Set up from Retro Rack (7 November 2026):** the owner asked for a retro-themed chess game in the style of Retro Rack, their 3D pixel-art pool game, and for the way of working there to be brought across before anything was built. Copied from Retro Rack (as of its pull request #32): the guide for AI assistants (`AGENTS.md`, with `CLAUDE.md` pointing to it), these notes, the README, the build that makes one self-contained `index.html`, the context packs for other AIs, the core and browser tests and their runner, the installable app (manifest, network-first service worker, icons drawn by a script), three.js r159 and the two pixel fonts, and the pixel-art rendering pipeline. A placeholder scene (an empty board) gave the build and the tests something real to draw. The owner then switched on GitHub Pages.
2. **Stage 1 (7 November 2026):** the owner chose the look, the ways of playing, the rules and the pieces (section 4), and the first stage was built: the rules engine, the 3D pieces, two players on one device.

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

**Decisions still to make**
- **Stage 2, the computer:** how many skill levels, whether they have names and faces (as Retro Rack's career opponents do), and whether you pick your colour.
- **Stage 3, online:** the same as Retro Rack's online play (rooms with codes, a listed rooms board, Rejoin, quick chat), on a new relay.
- **The board and the room:** the square colours and the room are placeholders.
- **Later extras, if wanted:** clocks, sound, puzzles (as Retro Rack has trick shots), a career against named computer players, looks to earn (boards, piece sets, rooms), a replay of the game move by move.

---

## 5. Reference numbers

**The board and pieces** (sizes not checked against the FIDE equipment standards; check those if the set is redesigned)
- Squares 5.7 cm, a 3 cm border, so the board is 51.6 cm across. A light square at each player's right (h1 and a8).
- Light squares `#c4a67c`, dark squares `#5a3b78`, the frame `#3a2452`. White pieces `#efe1c3`, black pieces `#2c2140`. The light squares were darkened from `#d8c3a0` because under the lamp they washed out next to the white pieces.
- Piece heights: king 8.7 cm, queen 7.7, bishop 6.8, knight 6.3, rook 5.3, pawn 4.3. Bases 2.9 cm (pawn) to 3.8 cm (king) across. Pieces taken stand at 80% size.

**The camera in a game**
- Tilted 0.95 rad (54°) down to start, between 0.35 and 1.45 rad when tilted by hand; zoom 0.6 to 2.2 times the distance that fits the board.

**Rendering** (as in Retro Rack)
- Default pixel size 1× (one game pixel per page pixel) and 256 shades (full colour, no dithering). Max draws one game pixel per real screen pixel, up to 3 per page pixel.

---

## 6. How things are tested

- **Rules:** `tests/core.test.js` (28 tests): perft counts for five standard positions, castling, en passant, promotion, pins, checkmate, stalemate, each draw, resigning, take back, notation and saving, and that the context packs are up to date.
- **The browser:** headless Chromium (Playwright) with software WebGL (SwiftShader). The page exposes `window.__rs` (state, position, moves, where each square is on the screen and so on) to make scripting easy; the `play` test plays with real mouse taps and drags at those positions. `node tests/browser/run-all.js` runs them all (see `AGENTS.md`, Testing): `file`, `fit`, `play` and `app`.
- **Software WebGL is slow,** so keep test windows small (about 480×360) unless the size is what's being tested.

---

## 7. Ideas list (discussed; the ones built since say so)

- **Two players on one device, with the full rules:** built (Stage 1).
- **The computer opponent (Stage 2) and online play (Stage 3):** next, in that order.
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
