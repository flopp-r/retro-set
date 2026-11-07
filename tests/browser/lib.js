// Shared bits for the browser tests: Playwright, the address of the local test site, and where screenshots go.
// run-all.js builds the game and starts the site; AGENTS.md (Testing) explains the set-up.
const path = require('path'), os = require('os'), fs = require('fs');

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) {} }
  console.error('Playwright not found. Install it (npm install --no-save playwright), or set PLAYWRIGHT_MODULE to its folder.');
  process.exit(2);
}
const pw = loadPlaywright();

const ROOT = path.resolve(__dirname, '..', '..');                                  // the repository
const WORK = process.env.RS_WORK || path.join(os.tmpdir(), 'retro-set-browser-tests');  // test site and screenshots
const FILE = 'file://' + path.join(ROOT, 'index.html');                             // the built game, opened from disk
// the current build served like GitHub Pages (under /retro-set/). Ports differ from Retro Rack's, so both projects'
// tests can run at once.
const SITE = { new: 'http://127.0.0.1:8180/retro-set/' };
const PORTS = { new: 8180, app: 8190 };
const shot = name => { const d = path.join(WORK, 'shots'); fs.mkdirSync(d, { recursive: true }); return path.join(d, name); };
// software WebGL, as in a Claude Code cloud session (no graphics card)
const GL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

// The game's default picture (pixel size 1x, full colours) is slow to draw in software, so test pages start at 3x and
// 8 shades, unless they bring settings of their own or the address asks for the real defaults (?realdefaults).
function quick() {
  try { if (!/realdefaults/.test(location.search) && !localStorage.getItem('retroSet.settings')) localStorage.setItem('retroSet.settings', JSON.stringify({ pixel: 3, levels: 8 })); } catch (e) {}
}
const chromium = Object.create(pw.chromium);
chromium.launch = async (o = {}, ...more) => {
  const b = await pw.chromium.launch({ args: GL, ...o }, ...more), newContext = b.newContext.bind(b);
  b.newContext = async (...args) => { const c = await newContext(...args); await c.addInitScript(quick); return c; };
  b.newPage = async (...o) => { const c = await b.newContext(...o), p = await c.newPage(); p.on('close', () => c.close().catch(() => {})); return p; };
  return b;
};
// collects anything that reaches the browser console, so each test can check it stayed clean
function watch(p, log = []) {
  p.on('console', m => { if (!/GPU stall due to ReadPixels/.test(m.text())) log.push(`[${m.type()}] ${m.text()}`); });
  p.on('pageerror', e => log.push(`[pageerror] ${e.message}`));
  p.on('requestfailed', r => log.push(`[requestfailed] ${r.url()}`));
  return log;
}
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };

module.exports = { ...pw, chromium, ROOT, WORK, FILE, SITE, PORTS, shot, watch, ok };
