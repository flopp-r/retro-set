# Retro Set

3D pixel-art chess, a sister to Retro Rack. **Under construction:** the working setup is in place and the page shows an empty board; the game comes next.

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
