// Runs the browser tests: builds the game, serves a copy of it locally like GitHub Pages, then runs each *.test.js in
// this folder in turn and prints a summary. Usage:
//   node tests/browser/run-all.js            every test
//   node tests/browser/run-all.js fit file   only tests whose file name contains one of the words
// Needs Playwright with Chromium. (When online play is added, this also starts the relay locally, as Retro Rack's does.)
const { spawn, execFileSync } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');
const { ROOT, WORK, PORTS } = require('./lib');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.md': 'text/plain' };
const say = t => console.log(`\x1b[36m${t}\x1b[0m`);

// a static server that behaves like GitHub Pages for this repository: everything under /retro-set/
function serve(dir, port) {
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (!p.startsWith('/retro-set/')) { res.writeHead(404); return res.end('not found'); }
      p = p.slice('/retro-set'.length); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(dir, p);
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'max-age=600' });
      fs.createReadStream(f).pipe(res);
    });
    s.on('error', reject); s.listen(port, '127.0.0.1', () => resolve(s));
  });
}
function copySite(dir, html) {
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const f of ['sw.js', 'manifest.webmanifest', 'README.md']) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  fs.cpSync(path.join(ROOT, 'icons'), path.join(dir, 'icons'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

(async () => {
  const only = process.argv.slice(2);
  const tests = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!only.length || only.some(w => f.includes(w)))).sort();
  if (!tests.length) { console.error('No tests match.'); process.exit(2); }
  fs.mkdirSync(WORK, { recursive: true });

  say('Building index.html…');
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build.js')], { stdio: 'inherit' });
  copySite(path.join(WORK, 'www-new'), fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));

  let server;
  try { server = await serve(path.join(WORK, 'www-new'), PORTS.new); }
  catch (e) { console.error(`Couldn't start the test site (${e.message}). Is something else using port ${PORTS.new}?`); process.exit(2); }
  process.on('SIGINT', () => { server.close(); process.exit(130); });

  const results = [];
  for (const t of tests) {
    say(`\n=== ${t}`);
    const t0 = Date.now(); let pass = 0, fail = 0;
    const code = await new Promise(resolve => {
      const c = spawn(process.execPath, [path.join(__dirname, t)], { cwd: WORK, env: { ...process.env, RS_WORK: WORK } });
      let buf = '';
      const line = l => { if (/^PASS /.test(l)) pass++; if (/^FAIL /.test(l)) fail++; console.log(l); };
      c.stdout.on('data', d => { buf += d; const ls = buf.split('\n'); buf = ls.pop(); ls.forEach(line); });
      c.stderr.on('data', d => process.stderr.write(d));
      c.on('close', k => { if (buf) line(buf); resolve(k); });
    });
    results.push({ t, pass, fail, code, s: Math.round((Date.now() - t0) / 1000) });
  }
  server.close();

  say('\n=== Summary');
  for (const r of results) console.log(`${r.fail || r.code ? 'FAIL' : 'ok  '}  ${r.t.padEnd(28)} ${String(r.pass).padStart(3)} passed, ${r.fail} failed${r.code ? `, exit code ${r.code}` : ''}  (${r.s} s)`);
  const bad = results.filter(r => r.fail || r.code).length;
  console.log(bad ? `\n${bad} test file(s) failed.` : `\nAll ${results.reduce((a, r) => a + r.pass, 0)} checks passed. Screenshots: ${path.join(WORK, 'shots')}`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
