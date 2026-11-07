# Retro Set: decisions, history and changes

This file records why Retro Set is the way it is: the decisions and their reasons, reference numbers, the ideas list, and a dated list of every change shipped. Read it together with `AGENTS.md`, which explains how the code works and how to change it.

---

## 1. Current status

- The repository is `github.com/flopp-r/retro-set` (public). The working setup is in place; the game itself hasn't been designed yet (see section 4, "Decisions still to make").
- The page is a placeholder: the title screen in front of an empty board in a dark room.
- GitHub Pages isn't switched on yet. Once `main` holds the setup, the owner turns it on (repository Settings, Pages, branch `main`, folder `/ (root)`; see `README.md`), and the site appears at https://flopp-r.github.io/retro-set/.
- There is no relay and no online play.

---

## 2. Working preferences

Personal working preferences are kept in the owner's own Claude Code settings, not in this public repository. Project conventions (plain-language explanations, UK English, metric units, a clean console, testing before pushing) are in `AGENTS.md`.

---

## 3. How the project got here (short history)

1. **Set up from Retro Rack (7 November 2026):** the owner asked for a retro-themed chess game in the style of Retro Rack, their 3D pixel-art pool game, and for the way of working there to be brought across before anything was built. Copied from Retro Rack (as of its pull request #32): the guide for AI assistants (`AGENTS.md`, with `CLAUDE.md` pointing to it), these notes, the README, the build that makes one self-contained `index.html`, the context packs for other AIs, the core and browser tests and their runner, the installable app (manifest, network-first service worker, icons drawn by a script), three.js r159 and the two pixel fonts, and the pixel-art rendering pipeline. A placeholder scene (an empty board) gives the build and the tests something real to draw.

---

## 4. Key decisions and why

**Delivery (carried over from Retro Rack)**
- **One self-contained `index.html`,** with fonts and three.js inlined, so the game works offline as a single downloaded file and GitHub Pages can serve it with no build step on the server.
- **three.js is pinned at r159** (ES-module build, wrapped by `tools/build.js`), the same file as Retro Rack's, so code ported between the games behaves the same. Upgrading is possible but not needed; if you do, re-check lighting, the `DepthTexture` outline pass and the console.
- **The same pixel-art look:** Retro Rack's low-resolution render target and post-processing shader (outlines, vignette, dithering), its palette and its fonts, so the two games look like a family.
- **The version is a fingerprint of the code,** shown at the bottom of the menu, so the owner can see an update has arrived (and, if online play comes, players can compare versions).
- **The context packs** (`CONTEXT.md`, `CONTEXT-SHORT.md`) are remade by every build and checked by the tests, so any AI can be given the whole project in one file and it's never out of date.
- **Separate from Retro Rack:** its own repository, site, storage keys (`retroSet.` rather than `retroRack.`) and, if online play comes, its own relay, so a change to one game can't break the other. Code is shared by copying, not by a shared library, because each game is one self-contained page.

**Decisions still to make (each to be agreed with the owner before it's built)**
1. **The look of the game.** The setup assumes 3D pixel art like Retro Rack (three.js and the pixel-art pipeline are in place). A 2D pixel-art board is the alternative: simpler and lighter on phones, but less like Retro Rack. If 2D is chosen, three.js and the pipeline come out.
2. **Who you play:** the computer (and how many skill levels), two people on one device, online against a friend (needs a relay, as in Retro Rack), or a mix. This decides the order of the work.
3. **How much of the rules:** the full rules (castling, en passant, promotion to any piece, checkmate and stalemate, and the draws: threefold repetition, the fifty-move rule, insufficient material, agreement), and whether to have clocks.
4. **The set itself:** the style of the pieces (classic Staunton shapes in pixel art, or something more playful), the board, and the room.
5. **Later extras, if wanted:** puzzles (as Retro Rack has trick shots), a career against named computer players, looks to earn (boards, piece sets, rooms), a replay of the game move by move.

---

## 5. Reference numbers

**The placeholder board** (to be replaced when the set is designed)
- Squares 5.7 cm, a 3 cm border, so the board is 51.6 cm across. A light square at each player's right (h1 and a8).
- Light squares `#d8c3a0`, dark squares `#5a3b78`, the frame `#3a2452`, from Retro Rack's palette.
- These sizes are placeholders, not checked against the FIDE equipment standards; check those when the set is designed.

**Rendering** (as in Retro Rack)
- Default pixel size 1× (one game pixel per page pixel) and 256 shades (full colour, no dithering). Max draws one game pixel per real screen pixel, up to 3 per page pixel.

---

## 6. How things are tested

- **Core:** `tests/core.test.js` (3 tests): `core.js` runs in Node, the starting position, and that the context packs are up to date. The rules tests will go here.
- **The browser:** headless Chromium (Playwright) with software WebGL (SwiftShader). The page exposes `window.__rs` (state, frame count, triangles drawn, settings) to make scripting easy. `node tests/browser/run-all.js` runs them all (see `AGENTS.md`, Testing): `file`, `fit` and `app`.
- **Software WebGL is slow,** so keep test windows small (about 480×360) unless the size is what's being tested.

---

## 7. Ideas list (discussed; the ones built since say so)

- **The first decisions** are in section 4, "Decisions still to make".
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
