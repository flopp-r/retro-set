# Retro Set

3D pixel-art chess, a sister to Retro Rack. Play a friend on one device, or eight computer opponents from 100 to 1500, with the full rules. Online play is coming next.

Play it at https://flopp-r.github.io/retro-set/

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The game. It works on its own, even opened straight from your computer. |
| `sw.js`, `manifest.webmanifest`, `icons/` | Let people install the game as an app and play it offline. |
| `src/`, `vendor/`, `tools/`, `tests/` | The source code, the 3D engine and fonts, the build tool and the tests. `index.html` is built from these. |
| `AGENTS.md`, `CLAUDE.md`, `HANDOVER.md` | Notes for AI assistants and developers: how the project fits together and how to change it (`CLAUDE.md` points Claude Code to `AGENTS.md`), and its history and decisions. |
| `CONTEXT.md`, `CONTEXT-SHORT.md` | The whole project in one file, for an AI that can't open this repository (see "Asking another AI about the project" below). Made by the build; don't edit them. |

Everything here runs on free plans. You need a GitHub account, and everything is done in your web browser.

---

## Putting the game on GitHub Pages

Do this once, after the setup has been merged into the `main` branch.

1. Sign in to github.com and open https://github.com/flopp-r/retro-set.
2. Go to the repository's **Settings**, then **Pages** in the left sidebar. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose the **main** branch and the **/ (root)** folder, then click **Save**.
3. Wait a minute or two and refresh the page. It will show the site address, `https://flopp-r.github.io/retro-set/`. Open it: you should see the Retro Set title in front of a board, and the version at the bottom of the panel.

GitHub occasionally renames buttons. If something doesn't match exactly, look for the closest option with the same meaning.

## How to play

- **Moving:** tap a piece, then the square to move it to (blue dots show where it can go; a ring means it can take a piece there). Or drag the piece onto the square. To castle, move the king two squares towards the rook.
- **Promotion:** when a pawn reaches the far side, choose what it becomes.
- **The view:** drag across an empty part of the screen to turn the board round, or up and down to tilt it. Zoom with the mouse wheel, or pinch on a phone. After each move the view turns round to the player whose move it is; switch that off under **Menu**, **Turn the board**. The **Turn** button swings the board round by hand.
- **Take back** undoes the last move (as often as you like).
- **Menu:** resign, agree a draw (both need a second tap, so a slip can't end the game), or quit. On a phone, the back gesture opens it.
- **The end of a game:** checkmate, stalemate, the same position three times, fifty moves each without a capture or a pawn move, or too few pieces left to checkmate.
- **Resume:** a game in progress is saved after every move. If you close the page, the home screen offers **Resume** next time.

## Playing the computer

Choose **Vs computer**, pick an opponent and your colour (White, Black or Random), then **Play**.

| Opponent | Rating | How they play |
|---|---|---|
| Pip | 100 | Has just learnt how the pieces move. |
| Mabel | 300 | Loves pushing pawns; often leaves a piece hanging. |
| Dev | 500 | Grabs anything you offer, even when it's a trap. |
| Priya | 700 | Knows a few openings, then loses the thread. |
| Gus | 900 | Takes any piece you leave loose. |
| Ruth | 1100 | Patient: castles early and waits for you to slip. |
| Tariq | 1300 | Sharp tactics: checks and captures first. |
| Nell | 1500 | The club champion. Rarely gives anything away. |

- **What the ratings mean:** they're measured, not guessed. Nell and Tariq were tuned by playing hundreds of games against Stockfish at its official strength settings (1500 and 1320), and each of the others to be 200 points below the one above, which means the stronger one wins about three games in four. Measured over 240 games each, every bot came out within 25 points of its rating (the lower the bot, the wider the margin: about ±55 for Nell up to ±135 for Pip). They are close to, but not the same as, chess.com ratings: every site's scale is a little different, especially at the low end.
- **Take back** undoes your last move and the computer's reply. **Menu** has **Offer a draw** (the computer accepts only if it thinks it's worse, or the game is level late on) and **Resign**.

## Installing it as an app

- **On a computer (Edge or Chrome):** open the game's address, then click the install icon at the right-hand end of the address bar (or the browser's menu, then **Apps**, then **Install this site as an app**).
- **On Android (Chrome):** open the address, tap the menu (⋮), then **Add to home screen** or **Install app**.
- **On iPhone or iPad (Safari):** open the address, tap **Share**, then **Add to Home Screen**.

The app updates itself: when you're online it always loads the latest version, and the saved copy is only used when there's no internet.

## Updating later

- **With Claude Code:** open this repository in Claude Code and describe the change. It reads `AGENTS.md` (through `CLAUDE.md`) to learn how the project works, explains the options, then edits the source in `src/`, rebuilds `index.html`, runs the tests and opens a pull request. When you say merge, the site updates by itself a minute or two later (press Ctrl+F5 to see it). Other AI coding tools read `AGENTS.md` directly.

## Asking another AI about the project

To give an AI that can't open this repository (ChatGPT, Gemini or Claude in a browser, say) the whole picture, paste it this link and ask your question:

https://raw.githubusercontent.com/flopp-r/retro-set/main/CONTEXT.md

It holds the notes, a map of the code and all the source code written for the game. If the AI can't open links, download the file and attach it. If it says the file is too big, use `CONTEXT-SHORT.md` instead (the notes and the map, without the code). Both are remade by every build, so they always match the latest version.

## If something isn't working

- **GitHub Pages shows a 404:** give it a few more minutes, and make sure Pages is set to the `main` branch and the `/ (root)` folder, with `index.html` at the top level of the repository.
- **You still see the old version after an update:** press Ctrl+F5 on a computer, or close and reopen the app on a phone. The version is shown at the bottom of the menu, so you can compare it with the one Claude Code tells you.
