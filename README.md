# Retro Set

3D pixel-art chess, a sister to Retro Rack. Play a friend on one device or online, or ten computer opponents from 100 to 1500, with the full rules.

Play it at https://flopp-r.github.io/retro-set/

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The game. It works on its own, even opened straight from your computer. |
| `config.js` | One setting: your relay address, so online play knows where to connect. |
| `relay/` | A tiny Cloudflare Worker that passes messages between the two players of an online game. |
| `sw.js`, `manifest.webmanifest`, `icons/` | Let people install the game as an app and play it offline. |
| `src/`, `vendor/`, `tools/`, `tests/` | The source code, the 3D engine and fonts, the build tool and the tests. `index.html` is built from these. |
| `AGENTS.md`, `CLAUDE.md`, `HANDOVER.md` | Notes for AI assistants and developers: how the project fits together and how to change it (`CLAUDE.md` points Claude Code to `AGENTS.md`), and its history and decisions. |
| `CONTEXT.md`, `CONTEXT-SHORT.md` | The whole project in one file, for an AI that can't open this repository (see "Asking another AI about the project" below). Made by the build; don't edit them. |

Everything here runs on free plans. You need a GitHub account and, for online play, a Cloudflare account; everything is done in your web browser.

---

## Step 1: Put the game on GitHub Pages

Do this once, after the setup has been merged into the `main` branch (it's done already for Retro Set).

1. Sign in to github.com and open https://github.com/flopp-r/retro-set.
2. Go to the repository's **Settings**, then **Pages** in the left sidebar. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose the **main** branch and the **/ (root)** folder, then click **Save**.
3. Wait a minute or two and refresh the page. It will show the site address, `https://flopp-r.github.io/retro-set/`. Open it: you should see the Retro Set title in front of a board, and the version at the bottom of the panel.

GitHub occasionally renames buttons. If something doesn't match exactly, look for the closest option with the same meaning.

## Step 2: Put the relay on Cloudflare

Online play needs a relay: a tiny program on Cloudflare that passes the moves between the two players. Retro Set has its own, separate from Retro Rack's, so a change to one game can't break the other. You do this once, the same way as for Retro Rack.

1. In the Cloudflare dashboard, open **Workers & Pages** (it may be under **Compute** in the sidebar) and click **Create application** (once just **Create**).
2. Choose **Import a repository** and click **Get started**. If asked, give Cloudflare access to the `retro-set` repository (in GitHub's settings for the Cloudflare app, add `retro-set` to the repositories it can see).
3. Pick the `retro-set` repository.
4. Set the project name to exactly `retro-set-relay`. It must match the name in `relay/wrangler.jsonc`.
5. Open the advanced or build settings and set the **Root directory** (sometimes called **Path**) to `relay`. Leave the build command empty (Cloudflare may fill in `npm run build`: delete it, or the build fails, because the relay has nothing to build), and leave the deploy command as `npx wrangler deploy`.
6. Click **Save and Deploy** and wait for the build to finish, which takes a minute or two.
7. Open the new Worker. Its address looks like `https://retro-set-relay.yourname.workers.dev`. Visit that address in your browser; it should say **Retro Set relay is running.**

Cloudflare occasionally renames buttons. If something doesn't match exactly, look for the closest option with the same meaning.

## Step 3: Connect the game to the relay

1. On GitHub, open `config.js` in the repository and click the **pencil** icon to edit it.
2. Paste your relay address between the quotes on the last line, so it looks like this:

   ```js
   window.RETRO_SET_RELAY = "https://retro-set-relay.yourname.workers.dev";
   ```

3. Click **Commit changes**. GitHub Pages updates within a minute or two. (Or give Claude Code the address: it's public, not a secret, and it can make the change.)

From then on, every change to `relay/` merged into `main` is deployed to Cloudflare by itself.

---

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
| Torben | 100 | Has just learnt how the pieces move, and leaves them anywhere. |
| Alfie | 250 | Loves pushing pawns, and forgets the pieces behind them. |
| Ollie | 400 | Grabs anything you offer, even when it's a trap. |
| Dom | 550 | Gets the queen out early and goes hunting. |
| Joseph | 700 | Knows a few openings, then loses the thread. |
| Barney | 850 | A club-night regular. Takes any piece you leave loose. |
| Magnus | 1000 | Plays it safe: castles early and waits for you to slip. |
| Jake | 1150 | Steady. Rarely hangs a piece, but sometimes drifts. |
| Daws | 1300 | Sharp tactics: looks for checks and captures first. |
| Ted | 1500 | The strongest here. Gives very little away. |

- **How they play:** like people, every one of them makes real blunders (leaving a piece to be taken, grabbing a pawn that can't be held, missing a mate), Torben on nearly a third of his moves and Ted on about one in thirty, as well as plenty of middling moves.
- **What the ratings mean:** they're measured, not guessed. Ted and Daws were tuned by playing hundreds of games against Stockfish at its official strength settings (1500 and 1320), and each of the others to be 150 points below the one above, which means the stronger one wins about seven games in ten. Measured over 240 games each, every bot came out within 30 points of its rating (the lower the bot, the wider the margin: about ±45 for Ted up to ±145 for Torben). They are close to, but not the same as, chess.com ratings: every site's scale is a little different, especially at the low end.
- **Take back** undoes your last move and the computer's reply. **Menu** has **Offer a draw** (the computer accepts only if it thinks it's worse, or the game is level late on) and **Resign**.

## Playing online

1. Open the game, choose **Online**, and type your name.
2. To join a friend, pick their room from **Open rooms** and click **Join**, or type their code into **Join with code**.
3. To host, click **Create a room**, choose your colour (**White**, **Random** or **Black**) and **Listed** or **Private**, then click **Create room**. You get a five-character room code and an invite link: click **Copy invite link** and send it. Opening the link joins your room straight away.
4. Listed rooms show under **Open rooms** for anyone; private ones are only for people with the code or the link.

- **In the game:** the line under the names says whether your opponent is connected. **Chat** sends a quick message from a short list. **Menu** has **Offer a draw** (your opponent accepts or declines), **Resign** and **Quit**. There's no take back online.
- **Play again:** when a game ends, both press **Play again** and a new game starts with the colours swapped.
- **Lost connection or reloaded the page?** You go straight back to your seat, and the game carries on.
- **Closed the app by accident?** For 3 hours the home screen shows **Rejoin your game with …**. If your opponent's game is still open, you're back exactly where you were; if both of you closed it, a fresh game starts in the same room.
- **Play yourself:** open a room in one tab, then open the invite link (or duplicate the tab) for the other side.
- **Versions:** both players need the same version. If not, the game says so: reload (Ctrl+F5 on a computer, or close and reopen the app on a phone).

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
- **The Online card says "Not set up yet":** the relay address isn't in `config.js` yet (steps 2 and 3).
- **Stuck on "Connecting…":** check the address in `config.js`. It should start with `https://` and end with `workers.dev`, with nothing else inside the quotes. Visit the address directly to confirm it says the relay is running.
- **Cloudflare build fails mentioning the name:** make sure the Worker is called `retro-set-relay`, or change `"name"` in `relay/wrangler.jsonc` to match.
- **"That room already has two players in it":** someone else is in that room. Create a new one.
- **"…different versions of Retro Set":** both players reload (Ctrl+F5 on a computer, or close and reopen the app on a phone), then come back to the room.
- **You still see the old version after an update:** press Ctrl+F5 on a computer, or close and reopen the app on a phone. The version is shown at the bottom of the menu, so you can compare it with the one Claude Code tells you.
