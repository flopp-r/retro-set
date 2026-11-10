// Retro Set in the browser: rendering, the board and pieces, input, camera, the game screens, saving and the
// installable app. The rules themselves are in core.js (C here); this file only shows them and asks them.
(() => {
'use strict';
const C = CORE;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const BUILD = '__BUILD__';   // version: tools/build.js fills in a fingerprint of the game code
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ settings
// pixel: game pixels are this many screen pixels across (0 is Max: one per real screen pixel); levels: shades per
// colour channel (256 is full colour; fewer turns on the dithering); turn: in a game on one device, the view turns
// round to the player whose move it is
const DEFAULTS = { pixel: 1, levels: 256, dither: true, outline: true, turn: true, set: 'classic', finish: 'classic' };
const S = { ...DEFAULTS };
try { Object.assign(S, JSON.parse(localStorage.getItem('retroSet.settings') || '{}')); } catch (e) {}
S.set = SETS.byId(S.set).id; S.finish = SETS.finish(S.finish).id;
const saveS = () => { try { localStorage.setItem('retroSet.settings', JSON.stringify(S)); } catch (e) {} };

// ------------------------------------------------------------------ renderer + post
// The scene is drawn small into a render target, then a shader adds outlines where the depth jumps, a vignette and,
// below full colour, Bayer dithering; the canvas is scaled up with hard pixel edges. The same pipeline as Retro Rack.
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
THREE.ColorManagement.enabled = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(1);
renderer.info.autoReset = false;   // counted per frame (see the main loop), so the tests see the scene, not just the last pass
const scene = new THREE.Scene();
const ROOM = new THREE.Color('#1a1433');
scene.background = ROOM;
scene.fog = new THREE.Fog(ROOM, 4, 11);
const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 12);   // seeing no further than the fog: the floor fades out with no edge for the outlines to find

const postMat = new THREE.ShaderMaterial({
  uniforms: {
    tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
    uLevels: { value: 8 }, uDither: { value: 1 }, uOutline: { value: 1 }, uNear: { value: camera.near }, uFar: { value: camera.far },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uRes;
    uniform float uLevels, uDither, uOutline, uNear, uFar;
    varying vec2 vUv;
    float linZ(float d){ return uNear*uFar/(uFar - d*(uFar-uNear)); }
    float b2(vec2 v){ return mod(2.0*v.x + 3.0*v.y, 4.0); }
    float bayer4(vec2 p){ vec2 q = mod(floor(p), 4.0); return (4.0*b2(mod(q,2.0)) + b2(floor(q/2.0)) + 0.5)/16.0; }
    void main(){
      vec2 px = 1.0/uRes;
      vec3 col = texture2D(tColor, vUv).rgb;
      if (uOutline > 0.5) {
        float dc = texture2D(tDepth, vUv).x;
        float dl = texture2D(tDepth, vUv - vec2(px.x,0.0)).x, dr = texture2D(tDepth, vUv + vec2(px.x,0.0)).x;
        float dd = texture2D(tDepth, vUv - vec2(0.0,px.y)).x, du = texture2D(tDepth, vUv + vec2(0.0,px.y)).x;
        float zc = linZ(dc);
        float lap = abs(dl + dr - 2.0*dc) + abs(du + dd - 2.0*dc);
        float dz = lap * zc*zc*(uFar-uNear)/(uNear*uFar);
        float zmax = max(max(linZ(dl),linZ(dr)), max(linZ(du),linZ(dd)));
        float edge = step(0.02*zc + 0.012, dz) * step(0.03*zc + 0.015, zmax - zc);
        if (dc >= 0.99999) edge = 0.0;
        col = mix(col, col*0.22 + vec3(0.035,0.025,0.07), edge*0.9);
      }
      vec2 c = vUv - 0.5; col *= 1.0 - 0.55*dot(c,c);
      if (uLevels < 200.0) {
        float t = (bayer4(gl_FragCoord.xy) - 0.5) * uDither;
        col = floor(col*(uLevels-1.0) + 0.5 + t) / (uLevels-1.0);
      }
      gl_FragColor = vec4(clamp(col,0.0,1.0), 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const postScene = new THREE.Scene();
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
let rt = null, VW = 1, VH = 1;
// Pixel size 0 is Max: one game pixel per real screen pixel (at most 3 per CSS pixel), so a screen scaled above 100%,
// or a phone, shows finer detail than 1×; on a screen at 100% it's the same as 1×.
const screenDpr = () => Math.min(3, Math.max(1, devicePixelRatio || 1));
function resize() {
  const px = S.pixel === 0 ? 1 / screenDpr() : clamp(Math.round(S.pixel), 1, 6);
  VW = Math.max(80, Math.ceil(innerWidth / px)); VH = Math.max(60, Math.ceil(innerHeight / px));
  renderer.setSize(VW, VH, false);
  canvas.style.width = VW * px + 'px'; canvas.style.height = VH * px + 'px';
  camera.aspect = VW / VH; camera.updateProjectionMatrix();
  if (rt) { rt.depthTexture.dispose(); rt.dispose(); }
  rt = new THREE.WebGLRenderTarget(VW, VH, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
  rt.depthTexture = new THREE.DepthTexture(VW, VH); rt.depthTexture.type = THREE.UnsignedIntType;
  postMat.uniforms.tColor.value = rt.texture; postMat.uniforms.tDepth.value = rt.depthTexture;
  postMat.uniforms.uRes.value.set(VW, VH);
}
function applyLook() {
  postMat.uniforms.uLevels.value = S.levels;
  postMat.uniforms.uDither.value = S.dither ? 1 : 0;
  postMat.uniforms.uOutline.value = S.outline ? 1 : 0;
}

// ------------------------------------------------------------------ textures
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}

// ------------------------------------------------------------------ scene: lights + room
// physically based light units (three.js r155+), as in Retro Rack
const PI = Math.PI;
scene.add(new THREE.HemisphereLight(0xb7c0ff, 0x2a1a3a, 0.32 * PI));
const sun = new THREE.DirectionalLight(0xfff0d8, 0.17 * PI); sun.position.set(0.6, 3, 1.2); scene.add(sun);
// two low lights from opposite corners, warm and cool, so the upright faces of the pieces differ from one another and
// their shapes show from either side of the board (the lamp and sun are overhead, and light every side face alike)
for (const [x, z, col] of [[1, 0.8, 0xffe2c0], [-1, -0.8, 0xc8d4ff]]) { const f = new THREE.DirectionalLight(col, 0.16 * PI); f.position.set(x, 0.55, z); scene.add(f); }
const lamp = new THREE.PointLight(0xffdca4, 0.75 * PI, 5, 0.43); lamp.position.set(0, 0.7, 0); scene.add(lamp);
const FLOOR_Y = -0.75;   // the floor reaches past the fog, so its edge never shows
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ color: 0x2a1d40 }));
  floor.rotation.x = -PI / 2; floor.position.y = FLOOR_Y; scene.add(floor);
}

// ------------------------------------------------------------------ board
// Squares of 5.7 cm with a 3 cm border, on a small round table. Square s (0 = a1 … 63 = h8) is centred at
// (sqX(s), 0, sqZ(s)); White sits at +z, so from White's side a1 is at the near left.
const SQ = 0.057, BORDER = 0.03, B = 8 * SQ + 2 * BORDER, TABLE_Y = -0.02;
const sqX = s => ((s & 7) - 3.5) * SQ, sqZ = s => (3.5 - (s >> 3)) * SQ;
const LIGHT_SQ = '#c4a67c', DARK_SQ = '#5a3b78', FRAME = '#3a2452';
// the coordinates round the border, in a tiny pixel font (3 × 5): files along White's and Black's edges, ranks up the
// sides, each set the right way up for the player sitting nearest
const GLYPH = {
  a: ['.#.', '#.#', '###', '#.#', '#.#'], b: ['##.', '#.#', '##.', '#.#', '##.'], c: ['.##', '#..', '#..', '#..', '.##'], d: ['##.', '#.#', '#.#', '#.#', '##.'],
  e: ['###', '#..', '##.', '#..', '###'], f: ['###', '#..', '##.', '#..', '#..'], g: ['.##', '#..', '#.#', '#.#', '.##'], h: ['#.#', '#.#', '###', '#.#', '#.#'],
  1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'], 4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'], 6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
};
const boardTex = canvasTex(144, 144, (g) => {   // 16 px a square, 8 px of border
  g.fillStyle = FRAME; g.fillRect(0, 0, 144, 144);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { g.fillStyle = (f + r) & 1 ? LIGHT_SQ : DARK_SQ; g.fillRect(8 + f * 16, 8 + (7 - r) * 16, 16, 16); }
  g.fillStyle = '#c9b48f';
  const glyph = (ch, x, y, flip) => GLYPH[ch].forEach((row, j) => [...row].forEach((p, i) => { if (p === '#') g.fillRect(flip ? x + 2 - i : x + i, flip ? y + 4 - j : y + j, 1, 1); }));
  for (let i = 0; i < 8; i++) {
    glyph(C.FILES[i], 8 + i * 16 + 7, 137, false); glyph(C.FILES[i], 8 + i * 16 + 6, 2, true);
    glyph(String(i + 1), 3, 8 + (7 - i) * 16 + 6, false); glyph(String(i + 1), 138, 8 + (7 - i) * 16 + 5, true);
  }
});
const woodMat = new THREE.MeshLambertMaterial({ color: 0x6b3a22 });
{
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24), woodMat);
  table.position.y = TABLE_Y - 0.02; scene.add(table);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, TABLE_Y - 0.04 - FLOOR_Y, 8), woodMat);
  leg.position.y = (TABLE_Y - 0.04 + FLOOR_Y) / 2; scene.add(leg);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(B, -TABLE_Y, B), new THREE.MeshLambertMaterial({ color: FRAME }));
  frame.position.y = TABLE_Y / 2; scene.add(frame);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(B, B), new THREE.MeshLambertMaterial({ map: boardTex }));
  top.rotation.x = -PI / 2; top.position.y = 0.0005; scene.add(top);
}
// marks on the squares: the last move, the piece picked up, a king in check, and where the picked-up piece can go
// (a dot on an empty square, a ring round a piece it can take)
const markMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
const MARKS = new THREE.Group(); scene.add(MARKS);
const squareGeo = new THREE.PlaneGeometry(SQ, SQ), dotGeo = new THREE.CircleGeometry(SQ * 0.17, 8), ringGeo = new THREE.RingGeometry(SQ * 0.37, SQ * 0.47, 12);
const MM = { last: markMat('#ffc56b', 0.3), sel: markMat('#ffc56b', 0.6), check: markMat('#ff6f8f', 0.65), go: markMat('#6cb8ff', 0.8) };
function mark(geo, mat, s, y) { const m = new THREE.Mesh(geo, mat); m.rotation.x = -PI / 2; m.position.set(sqX(s), y, sqZ(s)); MARKS.add(m); }
function showMarks() {
  MARKS.clear();
  if (!G || state === 'menu') return;
  const last = G.list[G.list.length - 1];
  if (last) { mark(squareGeo, MM.last, last.m.from, 0.0008); mark(squareGeo, MM.last, last.m.to, 0.0008); }
  if (C.inCheck(G.pos)) mark(squareGeo, MM.check, G.pos.b.indexOf(G.pos.turn === 'w' ? 'K' : 'k'), 0.001);
  if (sel >= 0) mark(squareGeo, MM.sel, sel, 0.0012);
  for (const s of new Set(targets.map(m => m.to))) mark(G.pos.b[s] || targets.some(m => m.to === s && m.ep) ? ringGeo : dotGeo, MM.go, s, 0.0014);
}

// ------------------------------------------------------------------ pieces
// The shapes and what they're made of come from sets.js: S.set is the piece set in use and S.finish its finish. Each
// piece is one mesh with a material for the body, the trim and the glow. Every piece faces the other side; knights
// look to their owner's left and a little forwards, so each player sees the head side on, as in a diagram.
function makePiece(ch) {
  const k = C.kind(ch), c = C.colour(ch), g = new THREE.Mesh(SETS.geo(S.set, k), SETS.mats(S.finish, c));
  g.rotation.y = k === 'N' ? (c === 'w' ? 5 * PI / 6 : -PI / 6) : c === 'w' ? 0 : PI;
  g.userData.ch = ch;
  return g;
}
// pieces taken stand on the table beside the board, on the side of the player who took them
const trayPos = (by, i) => { const sg = by === 'w' ? 1 : -1; return [sg * (B / 2 + 0.03 + (i >> 3) * 0.032), TABLE_Y, sg * (0.2 - (i & 7) * 0.034)]; };
const PIECES = new THREE.Group(); scene.add(PIECES);
let onSq = new Array(64).fill(null);   // the piece standing on each square
let SHOWN = null;   // the game whose pieces are on the table (also the one behind the menu)
function placeAll(g) {
  SHOWN = g; PIECES.clear(); onSq = new Array(64).fill(null);
  for (let s = 0; s < 64; s++) if (g.pos.b[s]) { const m = makePiece(g.pos.b[s]); m.position.set(sqX(s), 0, sqZ(s)); m.userData.sq = s; PIECES.add(m); onSq[s] = m; }
  const n = { w: 0, b: 0 };
  for (const { m } of g.list) if (m.cap) { const by = C.colour(m.p), t = makePiece(m.cap); t.scale.setScalar(0.8); t.position.set(...trayPos(by, n[by]++)); PIECES.add(t); }
}
// changes the piece set and finish (ids from sets.js; anything unknown becomes Classic) and sets the table again
function setLook(set, fin) {
  S.set = SETS.byId(set).id; S.finish = SETS.finish(fin).id; saveS();
  if (SHOWN && !GLIDE) placeAll(SHOWN);
}
// a little picture of a piece (the promotion buttons), drawn pixel by pixel from the set's own shape seen from the
// front, in the finish's colours, every kind at the same scale (the king fills the height) unless fit is set
function pieceIcon(k, c, W = 24, H = 30, fit = false) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), geo = SETS.geo(S.set, k), pos = geo.attributes.position.array, fin = SETS.finish(S.finish)[c];
  const sc = (H - 2) / SETS.geo(S.set, fit ? k : 'K').boundingBox.max.y, flip = k === 'N' ? -1 : 1;   // fit: this kind fills the height
  const slot = new Int8Array(W * H).fill(-1), depth = new Float32Array(W * H).fill(Infinity);
  for (const gr of geo.groups) for (let i = gr.start * 3; i < (gr.start + gr.count) * 3; i += 9) {
    const X = [0, 3, 6].map(j => W / 2 + flip * pos[i + j] * sc), Y = [0, 3, 6].map(j => H - 1 - pos[i + j + 1] * sc), Z = (pos[i + 2] + pos[i + 5] + pos[i + 8]) / 3;
    const area = (X[1] - X[0]) * (Y[2] - Y[0]) - (X[2] - X[0]) * (Y[1] - Y[0]);
    if (Math.abs(area) < 1e-6) continue;
    for (let y = Math.max(0, Math.floor(Math.min(...Y))); y <= Math.min(H - 1, Math.ceil(Math.max(...Y))); y++) for (let x = Math.max(0, Math.floor(Math.min(...X))); x <= Math.min(W - 1, Math.ceil(Math.max(...X))); x++) {
      const px = x + 0.5, py = y + 0.5;
      const u = ((X[1] - px) * (Y[2] - py) - (X[2] - px) * (Y[1] - py)) / area, v = ((X[2] - px) * (Y[0] - py) - (X[0] - px) * (Y[2] - py)) / area;
      if (u < 0 || v < 0 || u + v > 1 || Z >= depth[y * W + x]) continue;
      depth[y * W + x] = Z; slot[y * W + x] = gr.materialIndex;
    }
  }
  const cols = [fin.body, fin.trim, fin.glow].map(h => new THREE.Color(h)), at = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? -1 : slot[y * W + x];
  const pale = cols[0].r * 0.3 + cols[0].g * 0.6 + cols[0].b * 0.1 > 0.4, white = new THREE.Color('#ffffff');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = at(x, y);
    if (s >= 0) g.fillStyle = '#' + (x < W / 2 ? cols[s].clone().lerp(white, pale ? 0.35 : 0.14) : cols[s]).getHexString();
    else if (at(x + 1, y) >= 0 || at(x - 1, y) >= 0 || at(x, y + 1) >= 0 || at(x, y - 1) >= 0) g.fillStyle = pale ? '#0d0a1c' : '#c9b48f';
    else continue;
    g.fillRect(x, y, 1, 1);
  }
  return cv;
}

// ------------------------------------------------------------------ faces
// The bots' pixel portraits: Retro Rack's arcade-style people (the same sprites as its career opponents), drawn with a
// look { s: style, skin, hair, shirt }.
const BODY = ['.ssssss.', 's.ssss.s', 's.ssss.s', 'f.ssss.f', '..pppp..', '..p..p..', '..p..p..', '.bb..bb.'];
const SPRITES = {
  man: ['..hhhh..', '.hffffh.', '..ffff..', '...ff...', ...BODY],
  long: ['..hhhh..', '.hhffhh.', '.hffffh.', '.h.ff.h.', ...BODY],
  bald: ['..ffff..', '.ffffff.', '..ffff..', '...ff...', ...BODY],
  cap: ['..ssss..', '.sssssss', '..ffff..', '...ff...', ...BODY],
  glasses: ['..hhhh..', '.hggggh.', '..ffff..', '...ff...', ...BODY],
  beard: ['..hhhh..', '.hffffh.', '..hhhh..', '...hh...', ...BODY],
};
const SPRITE_COL = { h: '#5a3420', f: '#f2c49b', p: '#1a1433', b: '#0d0a1c', g: '#0d0a1c' };
function drawSprite(g, name, x0, y0, shirt, pal) {
  SPRITES[name].forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; g.fillStyle = ch === 's' ? shirt : (pal && pal[ch]) || SPRITE_COL[ch]; g.fillRect(x0 + x, y0 + y, 1, 1); } });
}
function portrait(look, scale) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 10; c.height = 14;
  drawSprite(g, look.s, 1, 1, look.shirt, { f: look.skin, h: look.hair });
  const img = new Image(); img.src = c.toDataURL(); img.className = 'portrait'; img.alt = ''; img.width = 10 * scale; img.height = 14 * scale;
  return img;
}

// ------------------------------------------------------------------ game state
// state: 'menu', 'play' (waiting for a move), 'think' (the computer choosing its move), 'anim' (a move gliding into
// place), 'promo' (choosing what a pawn becomes) or 'over'. G is the game (see core.js); sel is the square of the piece
// picked up, targets its legal moves. vs: null for two players on one device, or { bot (its id), me ('w' or 'b') }.
let state = 'menu', G = null, sel = -1, targets = [], promoAt = null, vs = null, botRnd = null;
const BT = BOTS;
const turnName = c => c === 'w' ? 'White' : 'Black';
const botOf = () => vs && BT.byId(vs.bot);
const botTurn = () => !!vs && G.pos.turn !== vs.me;
const meCol = () => NET.on ? NET.me : vs ? vs.me : '';   // your colour against the computer or online ('' on a shared device)
const myMoves = () => !NET.on && (!vs || G.list.some(x => C.colour(x.m.p) === vs.me));   // take back: off online; against the computer, needs a move of yours
function select(s) { sel = s; targets = s >= 0 ? C.legalMoves(G.pos).filter(m => m.from === s) : []; showMarks(); }
const clearSel = () => select(-1);
const mine = s => s >= 0 && state === 'play' && !botTurn() && (!NET.on || G.pos.turn === NET.me) && C.colour(G.pos.b[s]) === G.pos.turn;
// starts a game (g: a game to carry on, else a new one) against opp ({ bot, me }) or, with no opp, for two players
function startGame(g, opp) {
  vs = opp || null; THINK = null;
  if (vs) botRnd = C.rng(Math.floor(Math.random() * 4294967296));
  G = g || C.newGame(); state = G.result ? 'over' : 'play'; sel = -1; targets = [];
  closePanels(); placeAll(G);
  Object.assign(cam, { mode: 'play', base: vs ? (vs.me === 'w' ? 0 : PI) : S.turn && G.pos.turn === 'b' ? PI : 0, yawOff: 0, pitch: 0.95, zoom: 1 });
  $('#menu').hidden = true; $('#hud').hidden = false;
  save(); hud(); showMarks(); arm();
  if (state === 'over') showOver(); else if (botTurn()) startThink();
}
const startLocal = g => startGame(g, null);
// a new game against the bot picked in the menu, in the colour picked (Random tosses a coin each game)
function startCpu() {
  const me = M.colour === 'white' ? 'w' : M.colour === 'black' ? 'b' : Math.random() < 0.5 ? 'w' : 'b';
  startGame(null, { bot: M.bot, me });
}
// The computer's move: think() (core.js) is a generator, stepped for at most 12 ms a frame so the page never freezes,
// and the move waits until the bot has "thought" for half a second to a second or so, so it doesn't snap back at once.
let THINK = null;   // { it, ready (the earliest time to move), move (once chosen) }
let QUICK = false;  // the tests skip the pause
function startThink() {
  state = 'think';
  THINK = { it: C.think(G, BT.settings(botOf()), botRnd), ready: performance.now() + (QUICK ? 0 : 500 + botRnd() * 700), move: undefined };
  hud();
}
function thinkTick(now) {
  if (state !== 'think' || !THINK) return;
  const end = performance.now() + 12;
  while (THINK.move === undefined && performance.now() < end) { const r = THINK.it.next(); if (r.done) THINK.move = r.value; }
  if (THINK.move === undefined || now < THINK.ready || !$('#pause').hidden) return;   // not while the Menu panel is open
  const m = THINK.move; THINK = null; state = 'play';
  if (m) tryMove({ from: m.from, to: m.to, promo: m.promo });
}
// plays a move given as { from, to, promo }: the pieces glide into place, then the game moves on
function tryMove(want) {
  const n = C.play(G, want);
  if (!n) return false;
  const m = n.list[n.list.length - 1].m, by = C.colour(m.p), glide = [];
  glide.push({ obj: onSq[m.from], to: [sqX(m.to), 0, sqZ(m.to)], hop: C.kind(m.p) === 'N' ? 0.03 : 0, delay: 0, dur: 0.28 });
  if (m.castle) { const h = by === 'w' ? 0 : 56, [rf, rt] = m.castle === 'K' ? [h + 7, h + 5] : [h, h + 3]; glide.push({ obj: onSq[rf], to: [sqX(rt), 0, sqZ(rt)], hop: 0.02, delay: 0.08, dur: 0.28 }); }
  if (NET.on && NET.started && by === NET.me) netSend({ t: 'move', n: n.list.length, u: C.uci(m), fen: C.toFen(n.pos) });   // online, your move goes at once
  if (m.cap) {
    const at = m.ep ? m.to + (by === 'w' ? -8 : 8) : m.to, taken = G.list.filter(x => x.m.cap && C.colour(x.m.p) === by).length;
    glide.push({ obj: onSq[at], to: trayPos(by, taken), hop: 0.05, delay: 0.2, dur: 0.38, shrink: 0.8 });
  }
  sel = -1; targets = []; state = 'anim'; showMarks();
  animate(glide, () => { G = n; placeAll(G); afterMove(); });
  return true;
}
function afterMove() {
  state = G.result ? 'over' : 'play';
  if (S.turn && !vs && !NET.on && state === 'play') cam.base = G.pos.turn === 'w' ? 0 : PI;
  save(); hud(); showMarks();
  if (state === 'over') setTimeout(() => { if (state === 'over' && G.result) showOver(); }, reduceMotion ? 0 : 500);
  else if (botTurn()) startThink();
  if (NET.on) { saveRejoin(); const held = NET.hold; NET.hold = []; for (const m of held) onNet(m); netProcessQueue(); }
}
// Take back: one move on a shared device; against the computer, back to before your last move (its reply goes too)
function takeBack() {
  if (NET.on || !G || !G.list.length || state === 'anim' || state === 'promo' || (G.result && /resigned|agreed/.test(G.result.why)) || !myMoves()) return;
  let n = C.undo(G);
  if (vs) { THINK = null; while (n.list.length && n.pos.turn !== vs.me) n = C.undo(n); }
  G = n; state = 'play'; closePanels(); clearSel(); placeAll(G);
  if (S.turn && !vs) cam.base = G.pos.turn === 'w' ? 0 : PI;
  save(); hud(); showMarks();
  if (botTurn()) startThink();   // only when the computer is White and every move was taken back
}
// Against the computer, a draw is offered rather than agreed: it accepts when it thinks it's worse by half a pawn or
// more, or, from move 30, when it thinks the game is level
function offerDraw() {
  const bot = botOf(), sc = C.negamax(G.pos, 2, -Infinity, Infinity, 0, { nodes: 0, qs: true }), its = G.pos.turn === vs.me ? -sc : sc;
  if (its <= -50 || (G.list.length >= 60 && its <= 50)) { G = C.finish(G, '1/2-1/2', 'agreed'); THINK = null; afterMove(); toast(`${bot.name} accepts the draw.`); }
  else toast(`${bot.name} declines the draw.`);
}
let toastT = 0;
function toast(text) { const t = $('#toast'); t.textContent = text; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
function askPromo(from, to) {
  promoAt = { from, to }; state = 'promo';
  const box = $('#promoBtns'); box.textContent = '';
  for (const [k, name] of [['q', 'Queen'], ['r', 'Rook'], ['b', 'Bishop'], ['n', 'Knight']]) {
    const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.dataset.p = k;
    b.append(pieceIcon(k.toUpperCase(), G.pos.turn), name);
    b.onclick = () => { const p = promoAt; $('#promo').hidden = true; state = 'play'; promoAt = null; tryMove({ ...p, promo: k }); };
    box.append(b);
  }
  $('#promo').hidden = false;
}
function cancelPromo() { $('#promo').hidden = true; if (state === 'promo') state = 'play'; promoAt = null; }

// ------------------------------------------------------------------ moving pieces
let GLIDE = null;   // { items, t, then }
function animate(items, then) {
  if (reduceMotion) { then(); return; }
  for (const it of items) it.from = it.obj.position.clone();
  GLIDE = { items, t: 0, then, end: Math.max(...items.map(it => it.delay + it.dur)) };
}
function glideTick(dt) {
  if (!GLIDE) return;
  GLIDE.t += dt;
  for (const it of GLIDE.items) {
    const k = clamp((GLIDE.t - it.delay) / it.dur, 0, 1), e = ease(k);
    it.obj.position.set(lerp(it.from.x, it.to[0], e), lerp(it.from.y, it.to[1], e) + Math.sin(PI * k) * it.hop, lerp(it.from.z, it.to[2], e));
    if (it.shrink) it.obj.scale.setScalar(lerp(1, it.shrink, e));
  }
  if (GLIDE.t >= GLIDE.end) { const then = GLIDE.then; GLIDE = null; then(); }
}

// ------------------------------------------------------------------ input
// Tap a piece then a square, or drag a piece onto a square. Drag anywhere else to turn the view round the board,
// up and down to tilt it; the mouse wheel or a pinch zooms.
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
function squareAt(x, y) {
  const r = canvas.getBoundingClientRect();
  ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(onSq.filter(Boolean), true)[0];
  if (h) { let o = h.object; while (o.parent !== PIECES) o = o.parent; return o.userData.sq; }
  if (!ray.ray.intersectPlane(ground, hitP)) return -1;
  const f = Math.floor(hitP.x / SQ + 4), rk = Math.floor(4 - hitP.z / SQ);
  return f >= 0 && f < 8 && rk >= 0 && rk < 8 ? rk * 8 + f : -1;
}
function tap(s) {
  if (state !== 'play') return;
  const mv = targets.filter(m => m.to === s);
  if (sel >= 0 && mv.length) {
    if (NET.on && (!NET.peer || NET.link !== 'online')) { toast(`Waiting for ${NET.peerName} to reconnect`); clearSel(); return; }   // the move would go nowhere
    if (mv[0].promo) askPromo(sel, s); else tryMove({ from: sel, to: s });
    return;
  }
  if (mine(s) && s !== sel) select(s); else clearSel();
}
const PTR = new Map();
let drag = null, pinch = null;
canvas.addEventListener('pointerdown', e => {
  if (state === 'menu' || state === 'lobby') return;
  canvas.setPointerCapture(e.pointerId); PTR.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (PTR.size === 2) { const [a, b] = [...PTR.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: cam.zoom }; drag = null; return; }
  const s = squareAt(e.clientX, e.clientY), own = mine(s);
  drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false, s, own, was: sel === s };
  if (own && !drag.was) select(s);
});
canvas.addEventListener('pointermove', e => {
  if (!PTR.has(e.pointerId)) return;
  PTR.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && PTR.size === 2) { const [a, b] = [...PTR.values()]; cam.zoom = clamp(pinch.zoom * pinch.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), 0.6, 2.2); return; }
  if (!drag) return;
  if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) drag.moved = true;
  if (drag.moved && !drag.own) {   // turning the view
    cam.yawOff -= (e.clientX - drag.x) * 0.008; cam.pitch = clamp(cam.pitch + (e.clientY - drag.y) * 0.005, 0.35, 1.45);
  }
  drag.x = e.clientX; drag.y = e.clientY;
});
function pointerEnd(e) {
  if (!PTR.has(e.pointerId)) return;
  PTR.delete(e.pointerId);
  if (PTR.size < 2) pinch = null;
  const d = drag; drag = null;
  if (!d || e.type === 'pointercancel') return;
  if (!d.moved) { if (d.own) { if (d.was) clearSel(); } else tap(d.s); }
  else if (d.own) { const s = squareAt(e.clientX, e.clientY); if (s !== d.s) tap(s); }
}
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('wheel', e => { if (state === 'menu' || state === 'lobby') return; e.preventDefault(); cam.zoom = clamp(cam.zoom * Math.pow(1.1, Math.sign(e.deltaY)), 0.6, 2.2); }, { passive: false });
addEventListener('keydown', e => {
  if (e.key === 'Escape' && state === 'menu' && screen !== 'home') { $('#mBack').click(); return; }
  if (e.key === 'Escape' && state === 'lobby') { clearRejoin(); toMenu('online'); return; }
  if (e.key !== 'Escape' || state === 'menu') return;
  if (!$('#chatPop').hidden) $('#chatPop').hidden = true;
  else if (!$('#promo').hidden) cancelPromo(); else if (!$('#over').hidden) $('#over').hidden = true; else togglePause();
});

// ------------------------------------------------------------------ camera
// Behind the menu the view circles the board slowly (with reduced motion it holds still) and the picture is shifted
// into the space the menu panel leaves: to its right, or below it on an upright phone. In a game it looks down from
// the side of the player to move (base, plus however far the player has turned it, yawOff), far enough back for the
// whole board to fit. Every value glides to where it should be.
const cam = {
  mode: 'menu', a: 0.5, base: 0, yawOff: 0, pitch: 0.95, zoom: 1,
  cur: { yaw: 0.5, pitch: 0.53, dist: 1.22, offX: 0, offY: 0, ty: -0.02 },
  shift() {
    const r = $('#menuPanel').getBoundingClientRect(), tall = innerWidth <= 560;
    return [tall ? 0 : clamp((r.right + innerWidth) / 2 / innerWidth - 0.5, 0, 0.25), tall ? clamp((r.bottom + innerHeight) / 2 / innerHeight - 0.5, 0, 0.3) : 0];
  },
  goal() {
    if (this.mode === 'menu') { const [offX, offY] = this.shift(); return { yaw: this.a, pitch: 0.53, dist: 1.22 * Math.max(1, 0.9 / camera.aspect), offX, offY, ty: -0.02 }; }
    const v = Math.tan(camera.fov * PI / 360), h = v * camera.aspect;
    const short = innerHeight < 500;   // a phone on its side: more room for the bar along the top and the buttons
    return { yaw: this.base + this.yawOff, pitch: this.pitch, dist: Math.max(0.34 / h, (short ? 0.37 : 0.3) / v) * this.zoom, offX: 0, offY: short ? 0.03 : 0.02, ty: 0.01 };
  },
  update(dt) {
    if (this.mode === 'menu' && !reduceMotion) this.a += dt * 0.08;
    const g = this.goal(), c = this.cur, k = reduceMotion ? 1 : 1 - Math.exp(-dt * 5);
    c.yaw += wrapA(g.yaw - c.yaw) * k;
    for (const p of ['pitch', 'dist', 'offX', 'offY', 'ty']) c[p] = lerp(c[p], g[p], k);
    const cp = Math.cos(c.pitch);
    camera.position.set(Math.sin(c.yaw) * cp * c.dist, Math.sin(c.pitch) * c.dist, Math.cos(c.yaw) * cp * c.dist);
    camera.lookAt(0, c.ty, 0);
    camera.setViewOffset(VW, VH, -c.offX * VW, -c.offY * VH, VW, VH);
  },
};

// ------------------------------------------------------------------ HUD and panels
function hud() {
  if (!G) return;
  const over = !!G.result, check = !over && C.inCheck(G.pos);
  $('#plW').classList.toggle('active', !over && G.pos.turn === 'w'); $('#plB').classList.toggle('active', !over && G.pos.turn === 'b');
  const bot = botOf(), me = meCol();
  for (const c of ['w', 'b']) {   // the names (and against the computer, its face)
    const pl = $(c === 'w' ? '#plW' : '#plB'), its = bot && c !== vs.me;
    pl.querySelector('.plName').textContent = !me ? turnName(c) : c === me ? 'You' : NET.on ? NET.peerName : `${bot.name} ${bot.rating}`;
    const face = pl.querySelector('.plFace'); face.textContent = ''; if (its) face.append(portrait(bot.look, 2));
  }
  const tl = $('#turnLine'), ch = check ? ': check!' : '';
  tl.textContent = over ? resultText(G.result)[0] : state === 'think' ? `${bot.name} is thinking…` : !me ? `${turnName(G.pos.turn)} to move${ch}` : G.pos.turn === me ? `Your move${ch}` : `${NET.peerName} to move${ch}`;
  $('#bChat').hidden = !NET.on; $('#bUndo').hidden = NET.on; netBadge();   // online there's no take back, as in Retro Rack
  requestAnimationFrame(barEdge);
  tl.classList.toggle('check', check);
  const last = G.list[G.list.length - 1];
  $('#lastMove').textContent = last ? `${Math.ceil(G.list.length / 2)}.${G.list.length % 2 ? '' : '..'} ${last.san}` : '';
  const list = $('#moveList'); list.textContent = '';
  for (let i = 0; i < G.list.length; i += 2) {
    const row = document.createElement('div'); row.className = 'mvRow';
    const n = document.createElement('span'); n.className = 'mvN'; n.textContent = i / 2 + 1 + '.'; row.append(n);
    for (const j of [i, i + 1]) { const sp = document.createElement('span'); sp.textContent = G.list[j] ? G.list[j].san : ''; if (j === G.list.length - 1) sp.className = 'now'; row.append(sp); }
    list.append(row);
  }
  list.scrollTop = list.scrollHeight;
  $('#bUndo').disabled = !G.list.length || (over && /resigned|agreed/.test(G.result.why)) || !myMoves();
}
// --bb: where the bar ends, so messages sit just below it however tall it is (the connection line makes it taller)
function barEdge() { const r = $('#bar').getBoundingClientRect(); if (r.height) document.documentElement.style.setProperty('--bb', Math.round(r.bottom) + 'px'); }
addEventListener('resize', () => requestAnimationFrame(barEdge));
function resultText(r) {
  const me = meCol(), who = c => !me ? turnName(c) : c === me ? 'You' : NET.on ? NET.peerName : botOf().name;
  const winner = r.score === '1-0' ? 'w' : r.score === '0-1' ? 'b' : '', loser = winner && C.other(winner);
  const win = !winner ? 'A draw' : me && winner === me ? 'You win' : `${who(winner)} wins`;
  return {
    checkmate: ['Checkmate', win], stalemate: ['Stalemate', 'A draw: no legal move, but not in check'],
    repetition: ['Draw', 'The same position three times'], fifty: ['Draw', 'Fifty moves each with no capture or pawn move'],
    material: ['Draw', 'Not enough pieces left to checkmate'], agreed: ['Draw', vs ? 'Agreed' : 'Agreed by both players'],
    resigned: [me && loser === me ? 'You resign' : `${who(loser)} resigns`, win],
  }[r.why] || ['Game over', win];
}
function showOver() {
  const [title, why] = resultText(G.result);
  $('#overTitle').textContent = title; $('#overWhy').textContent = why;
  $('#overMoves').textContent = `${Math.ceil(G.list.length / 2)} moves`;
  $('#pause').hidden = true; $('#over').hidden = false; updateAgainBtn();
}
function closePanels() { for (const s of ['#pause', '#promo', '#over', '#offer', '#chatPop']) $(s).hidden = true; promoAt = null; disarm(); }
function togglePause(open = $('#pause').hidden) {
  if (open && state === 'over') { showOver(); return; }
  if (open && state === 'promo') cancelPromo();
  $('#pause').hidden = !open;
  if (open) {
    disarm();
    $('#bResign').textContent = meCol() ? 'Resign' : `${turnName(G.pos.turn)} resigns`;
    $('#bDraw').textContent = meCol() ? 'Offer a draw' : 'Agree a draw';
    for (const e of document.querySelectorAll('.onlyLocal')) e.hidden = !!meCol();   // turning the board is for a shared device
    for (const b of document.querySelectorAll('#sTurn .btn')) b.setAttribute('aria-pressed', String(!!+b.dataset.v === S.turn));
    renderLook();
  }
}
// The Menu panel's choice of piece set and finish, stepped through with < and >. (A stand-in until the shop: every
// set and finish is free to use.) Finishes marked trial are left out.
const FINS = SETS.FINISHES.filter(f => !f.trial);
function renderLook() { $('#setName').textContent = 'Set: ' + SETS.byId(S.set).name; $('#finName').textContent = 'Finish: ' + SETS.finish(S.finish).name; }
const stepIn = (list, id, d) => list[(Math.max(0, list.findIndex(x => x.id === id)) + d + list.length) % list.length].id;
for (const b of document.querySelectorAll('#pkSet .btn')) b.onclick = () => { setLook(stepIn(SETS.LIST, S.set, +b.dataset.d), S.finish); renderLook(); };
for (const b of document.querySelectorAll('#pkFin .btn')) b.onclick = () => { setLook(S.set, stepIn(FINS, S.finish, +b.dataset.d)); renderLook(); };
// a button that needs a second tap within 3 seconds, for the ones that end the game
const ARMED = new Map();
function confirmTap(btn, sure, act) {
  if (ARMED.has(btn)) { disarm(); act(); return; }
  disarm(); btn.dataset.label = btn.textContent; btn.textContent = sure; btn.classList.add('warn');
  ARMED.set(btn, setTimeout(disarm, 3000));
}
function disarm() { for (const [b, t] of ARMED) { clearTimeout(t); b.textContent = b.dataset.label; b.classList.remove('warn'); } ARMED.clear(); }
$('#bMenu').onclick = () => togglePause(true);
$('#bUndo').onclick = takeBack;
$('#bFlip').onclick = () => { cam.base += PI; };
$('#bResumeGame').onclick = () => togglePause(false);
$('#bDraw').onclick = e => {
  if (NET.on) { $('#pause').hidden = true; netOfferDraw(); return; }
  if (vs) { $('#pause').hidden = true; offerDraw(); return; }
  confirmTap(e.currentTarget, 'Both agree?', () => { G = C.finish(G, '1/2-1/2', 'agreed'); afterMove(); $('#pause').hidden = true; });
};
$('#bResign').onclick = e => confirmTap(e.currentTarget, 'Sure? Tap again', () => {
  const loser = meCol() || G.pos.turn;
  THINK = null; G = C.finish(G, loser === 'w' ? '0-1' : '1-0', 'resigned'); $('#pause').hidden = true;
  if (NET.on) netSend({ t: 'resign' });
  afterMove();
});
$('#bQuit').onclick = () => toMenu(NET.on ? 'online' : 'home');
for (const b of document.querySelectorAll('#sTurn .btn')) b.onclick = () => {
  S.turn = !!+b.dataset.v; saveS(); togglePause(true);
  if (S.turn && G) cam.base = G.pos.turn === 'w' ? 0 : PI;
};
$('#bPromoCancel').onclick = cancelPromo;
$('#bAgain').onclick = () => NET.on ? askRematch() : vs ? startCpu() : startLocal();
$('#bLook').onclick = () => { $('#over').hidden = true; };
$('#bOverMenu').onclick = () => toMenu(NET.on ? 'online' : 'home');
for (const id of ['#pause', '#promo', '#over']) {   // a tap outside the panel closes it (only if the press began outside too)
  const ov = $(id); let down = false;
  ov.addEventListener('pointerdown', e => { down = e.target === ov; });
  ov.addEventListener('click', e => { if (e.target === ov && down) { if (id === '#promo') cancelPromo(); else ov.hidden = true; } });
}

// ------------------------------------------------------------------ menus
// The menu's screens: home, Vs computer (the bots, your colour), Online (your name, the open rooms, join with a code)
// and New room (your colour, listed or private). M holds the choices, kept between visits.
const M = { bot: 'barney', colour: 'random', netColour: 'random', listed: true };
try { Object.assign(M, JSON.parse(localStorage.getItem('retroSet.menu') || '{}')); } catch (e) {}
M.bot = (BT.byId(M.bot) || BT.byId('barney')).id;   // a bot from before the renaming becomes the nearest new one
const saveM = () => { try { localStorage.setItem('retroSet.menu', JSON.stringify(M)); } catch (e) {} };
let screen = 'home';
const BACK = { cpu: 'home', online: 'home', room: 'online' };   // where Back goes from each screen
function menuGo(name) {
  screen = name;
  for (const sc of document.querySelectorAll('#menuPanel .mScreen')) sc.hidden = sc.id !== 'sc-' + name;
  const sc = $('#sc-' + name);
  $('#mTop').hidden = name === 'home'; $('#mTitle').textContent = sc.dataset.title || '';
  if (name === 'cpu') renderCpu();
  if (name === 'room') renderRoom();
  if (name === 'home') refreshHome(); else arm();
  updateLobbyWatch();
}
function refreshHome() {
  const saved = loadSaved(), b = $('#bResume');
  b.hidden = !saved;
  $('#bLocal .cardTxt').textContent = saved && !saved.vs ? 'New game (replaces the saved one)' : 'One device, take turns';
  $('#bCpu .cardTxt').textContent = saved && saved.vs ? 'New game (replaces the saved one)' : `${BT.LIST.length === 10 ? 'Ten' : BT.LIST.length} opponents, ${BT.LIST[0].rating} to ${BT.LIST[BT.LIST.length - 1].rating}`;
  if (saved) { const bot = saved.vs && BT.byId(saved.vs.bot); b.textContent = `Resume: ${bot ? 'vs ' + bot.name : 'two players'}, move ${Math.ceil((saved.g.list.length + 1) / 2)}`; }
  $('#bOnline .cardTxt').textContent = relayBase() ? 'Rooms and invite links' : 'Not set up yet';
  updateRejoin();
}
function renderRoom() {
  for (const b of document.querySelectorAll('#sNetColour .btn')) b.setAttribute('aria-pressed', String(b.dataset.v === M.netColour));
  for (const b of document.querySelectorAll('#sListed .btn')) b.setAttribute('aria-pressed', String(!!+b.dataset.v === (M.listed !== false)));
  $('#listedTxt').textContent = M.listed !== false ? 'Shown in Open rooms.' : 'Code or link only.';
}
for (const b of document.querySelectorAll('#sNetColour .btn')) b.onclick = () => { M.netColour = b.dataset.v; saveM(); renderRoom(); };
for (const b of document.querySelectorAll('#sListed .btn')) b.onclick = () => { M.listed = !!+b.dataset.v; saveM(); renderRoom(); };
function renderCpu() {
  const grid = $('#botGrid'); grid.textContent = '';
  for (const bot of BT.LIST) {
    const b = document.createElement('button'); b.className = 'botCard'; b.type = 'button'; b.dataset.bot = bot.id; b.setAttribute('aria-pressed', String(M.bot === bot.id));
    const name = document.createElement('span'); name.className = 'botName'; name.textContent = bot.name;
    const elo = document.createElement('span'); elo.className = 'botElo'; elo.textContent = bot.rating;
    b.append(portrait(bot.look, 2), name, elo);
    b.onclick = () => { M.bot = bot.id; saveM(); renderCpu(); };
    grid.append(b);
  }
  const bot = BT.byId(M.bot);
  $('#botBlurb').textContent = `${bot.name}, ${bot.rating}: ${bot.blurb}`;
  for (const b of document.querySelectorAll('#sColour .btn')) b.setAttribute('aria-pressed', String(b.dataset.v === M.colour));
}
for (const b of document.querySelectorAll('#sColour .btn')) b.onclick = () => { M.colour = b.dataset.v; saveM(); renderCpu(); };
// back to the menus, on the home screen (or, leaving an online game or room, the Online screen); leaving online on
// purpose forgets the game for Rejoin, and tells the other player
function toMenu(to = 'home') {
  if (NET.on) { clearRejoin(); leaveOnline(); }
  state = 'menu'; THINK = null; closePanels(); clearSel();
  cam.mode = 'menu'; cam.a = cam.cur.yaw;
  $('#hud').hidden = true; $('#lobby').hidden = true; $('#menu').hidden = false;
  if (to === 'home' && armed) { armed = false; history.back(); }
  menuGo(to); showMarks();
}
$('#bLocal').onclick = () => startLocal();
$('#bCpu').onclick = () => menuGo('cpu');
$('#bOnline').onclick = () => menuGo('online');
$('#bPlay').onclick = () => startCpu();
$('#mBack').onclick = () => { const to = BACK[screen] || 'home'; if (to === 'home' && armed) { armed = false; history.back(); } menuGo(to); };
$('#bResume').onclick = () => { const s = loadSaved(); if (s) startGame(s.g, s.vs); };
// The phone's back gesture: while in a game one history entry is kept armed, so going back opens the menu panel
// (or closes the one that's open) instead of leaving the page.
let armed = false;
function arm() { if (armed) return; try { history.pushState({ rs: 1 }, ''); armed = true; } catch (e) {} }
addEventListener('popstate', () => {
  armed = false;
  if (state === 'menu') { if (screen !== 'home') menuGo(BACK[screen] || 'home'); return; }
  if (state === 'lobby') { clearRejoin(); toMenu('online'); return; }   // going back cancels the waiting room
  if (!$('#offer').hidden) $('#bOfferNo').click(); else if (!$('#promo').hidden) cancelPromo(); else if (!$('#over').hidden) $('#over').hidden = true; else togglePause();
  arm();
});

// ------------------------------------------------------------------ online play
// Retro Rack's online play, for chess. Each browser runs the full game; only the moves travel, through a small relay
// (relay/, a Cloudflare Worker) that passes messages between the two seats of a room and keeps the list of open rooms.
// The receiving browser plays a move only if it's legal, and checks it reaches the same position as the sender's;
// if not, it asks for the whole game again. Seat 0 (whoever opened the room) hosts: it picks the colours and starts
// each game. NET.me is the colour this browser plays.
const NET = { on: false, ws: null, code: '', cid: '', seat: 0, me: 'w', white: 0, link: '', peer: false, peerName: 'Friend', myName: 'Player',
  started: false, games: 0, queue: [], hold: [], again: [false, false], retry: 0, timer: 0, list: false, rejoin: null, peerVer: '', verWarn: '', unlock: null, drawOffered: false };
function relayBase() {
  let u = '';
  try { u = new URLSearchParams(location.search).get('relay') || ''; } catch (e) {}
  u = String(u || window.RETRO_SET_RELAY || '').trim().replace(/\/+$/, '');
  if (!u) return '';
  if (u.startsWith('https://')) u = 'wss://' + u.slice(8);
  else if (u.startsWith('http://')) u = 'ws://' + u.slice(7);
  else if (!/^wss?:\/\//.test(u)) u = 'wss://' + u;
  return u;
}
const CODE_CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode(n = 5) { const a = new Uint32Array(n); crypto.getRandomValues(a); return Array.from(a, v => CODE_CH[v % CODE_CH.length]).join(''); }
const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const cleanName = (s, d = 'Friend') => String(s || '').replace(/[<>]/g, '').trim().slice(0, 14) || d;
function getCid() { try { let c = sessionStorage.getItem('rs.cid'); if (!c) { c = newCode(12); sessionStorage.setItem('rs.cid', c); } return c; } catch (e) { return newCode(12); } }
// "Duplicate tab" copies sessionStorage, player id included, and two tabs with one id fight over one seat.
// An open page marks the id as in use until it closes, so a copy made while the original is still open
// sees the mark and picks a fresh id. A reload clears the mark first, so it keeps its seat.
try {
  if (sessionStorage.getItem('rs.live') === '1') sessionStorage.removeItem('rs.cid');
  sessionStorage.setItem('rs.live', '1');
  const mark = v => { try { sessionStorage.setItem('rs.live', v); } catch (e) {} };
  addEventListener('pagehide', () => mark('0'));
  addEventListener('pageshow', e => { if (e.persisted) mark('1'); });
  // phones may unload a background tab after freezing it, with no pagehide; coming back is then a reload, not a copy
  document.addEventListener('freeze', () => mark('0'));
  document.addEventListener('resume', () => mark('1'));
} catch (e) {}
function netSend(o) { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(o)); }
function sendHello() { netSend({ t: 'hello', name: NET.myName, started: NET.started, n: NET.started && G ? G.list.length : 0, v: BUILD }); }
function netConnect() {
  let ws;
  const listQ = NET.list && !NET.started ? `&list=1&name=${encodeURIComponent(NET.myName)}&mode=${encodeURIComponent(M.netColour)}` : '';
  try { ws = new WebSocket(`${relayBase()}/room/${NET.code}?cid=${NET.cid}${listQ}`); }
  catch (e) { lobbyStatus("Couldn't reach the relay. Check the relay address in config.js."); return; }
  NET.ws = ws; NET.link = 'connecting'; netBadge();
  ws.onopen = () => { NET.retry = 0; };
  ws.onmessage = e => { if (e.data === 'pong') return; let m; try { m = JSON.parse(e.data); } catch (err) { return; } onNet(m); };
  ws.onclose = ev => {
    if (NET.ws === ws) NET.ws = null;
    if (!NET.on || ev.code === 4000 || ev.code === 4001) return;
    NET.link = 'reconnecting'; netBadge();
    lobbyStatus(NET.retry > 2 ? "Still can't reach the relay. Check your connection and the relay address." : 'Connecting…');
    const d = Math.min(8000, 600 * Math.pow(2, NET.retry++));
    clearTimeout(NET.timer); NET.timer = setTimeout(() => { if (NET.on && !NET.ws) netConnect(); }, d);
  };
}
setInterval(() => { if (NET.ws && NET.ws.readyState === 1) NET.ws.send('ping'); }, 20000);
function onNet(m) {
  // anything that changes the game waits while a move glides into place (afterMove hands it back)
  if (state === 'anim' && ['state', 'resign', 'drawYes'].includes(m.t)) { NET.hold.push(m); return; }
  switch (m.t) {
    case 'welcome':
      NET.seat = m.seat === 1 ? 1 : 0; NET.peer = !!m.peer; NET.link = 'online'; netBadge();
      lobbyStatus(NET.peer ? 'Connected. Starting…' : waitText());
      if (NET.peer) sendHello();
      if (NET.started) hud();
      break;
    case 'full':
      clearRejoin(); toMenu('online'); menuNote('That room already has two players in it.'); break;
    case 'peer':
      NET.peer = !!m.on; netBadge();
      if (m.on) sendHello();
      else if (NET.started) toast(`${NET.peerName} disconnected. Waiting for them to come back`);
      else lobbyStatus(waitText());
      break;
    case 'hello':
      NET.peerName = cleanName(m.name); NET.peer = true; netBadge();
      NET.peerVer = typeof m.v === 'string' ? m.v.slice(0, 16) : '';
      NET.verWarn = '';
      if (NET.peerVer !== BUILD) {
        const why = `You and ${NET.peerName} have different versions of Retro Set.`;
        if (!NET.started && !m.started) {   // nothing to lose yet, so don't start a game that might not match
          lobbyStatus(`${why} Both of you reload it to get the latest (Ctrl+F5 on a computer, or close and reopen it on a phone), then come back to room ${NET.code}.`);
          break;
        }
        // mid-game: carry on (each move is checked, and a mismatch fetches the whole game) but say so
        NET.verWarn = `${why} If the games stop matching, reload it (Ctrl+F5 on a computer, or close and reopen it on a phone) and come back to room ${NET.code}.`;
        if (NET.started) toast(NET.verWarn);
      }
      if (NET.started) netSendState();
      else if (NET.seat === 0 && !m.started) hostStart();
      else lobbyStatus(`Connected to ${NET.peerName}. Starting…`);
      if (NET.started) hud();
      break;
    case 'setup': if (NET.seat === 1 && (NET.started || NET.peerVer === BUILD)) startOnlineGame(m); break;
    case 'state': adoptState(m); break;
    case 'resync': if (NET.started) netSendState(true); break;
    case 'move': if (Number.isInteger(m.n) && typeof m.u === 'string') { NET.queue.push(m); NET.queue.sort((a, b) => a.n - b.n); netProcessQueue(); } break;
    case 'again': NET.again[1 - NET.seat] = true; tryRematch(); break;
    case 'bye': NET.peer = false; netBadge(); clearRejoin(); toast(`${NET.peerName} left the game`); break;
    case 'chat': if (Number.isInteger(m.i) && CHAT[m.i]) toast(`${NET.peerName}: ${CHAT[m.i]}`); break;
    case 'resign': if (NET.started && G && !G.result) { G = C.finish(G, NET.me === 'w' ? '1-0' : '0-1', 'resigned'); closePanels(); afterMove(); } break;
    case 'drawOffer': if (NET.started && G && !G.result) { $('#offerTxt').textContent = `${NET.peerName} offers a draw.`; $('#offer').hidden = false; } break;
    case 'drawYes': if (NET.started && G && !G.result && NET.drawOffered) { NET.drawOffered = false; G = C.finish(G, '1/2-1/2', 'agreed'); closePanels(); afterMove(); toast(`${NET.peerName} accepted the draw`); } break;
    case 'drawNo': if (NET.drawOffered) { NET.drawOffered = false; toast(`${NET.peerName} declined the draw`); } break;
  }
}
function menuNote(t) { $('#netNote').textContent = t; }
function lobbyStatus(t) { $('#lobbyStatus').textContent = t; }
function inviteLink() { return location.href.split('#')[0] + '#room=' + NET.code; }
function startOnline(code, listed = false, rejoin = null) {
  if (!relayBase()) { menuNote('Online play needs the relay address first: it goes into config.js, next to this file (the README explains how).'); return; }
  if (!code || code.length < 4) { menuNote('Room codes are 5 letters and numbers.'); return; }
  NET.on = true; NET.code = code; NET.cid = getCid(); NET.myName = cleanName($('#netName').value, 'Player'); NET.peerName = 'Friend';
  try { localStorage.setItem('retroSet.name', NET.myName); } catch (e) {}
  holdSeat();
  Object.assign(NET, { started: false, games: 0, queue: [], hold: [], again: [false, false], retry: 0, peer: false, peerVer: '', verWarn: '', list: listed, rejoin, drawOffered: false });
  vs = null; THINK = null; menuNote('');
  try { history.replaceState(null, '', '#room=' + code); } catch (e) {}
  state = 'lobby'; $('#menu').hidden = true; $('#lobby').hidden = false; arm();
  $('#lobbyCode').textContent = code; $('#lobbyLink').value = inviteLink();
  $('#lobbyNote').textContent = listed
    ? 'Your room is listed under Open rooms, so friends can join from there. They can also use the link or the code.'
    : 'This room is private. Your friend can open the link, or type the code into Join with code.';
  lobbyStatus('Connecting…'); updateLobbyWatch(); netConnect();
}
function leaveOnline() {
  if (!NET.on) return;
  netSend({ t: 'bye' });
  NET.on = false; NET.started = false; clearTimeout(NET.timer); freeSeat();
  const ws = NET.ws; NET.ws = null; if (ws) { try { ws.close(1000, 'bye'); } catch (e) {} }
  try { history.replaceState(history.state, '', location.href.split('#')[0]); } catch (e) {}
  $('#lobby').hidden = true; $('#chatPop').hidden = true; netBadge();
}
function showGameUI() { arm(); $('#menu').hidden = true; $('#lobby').hidden = true; $('#over').hidden = true; $('#hud').hidden = false; }
// the host picks the colours: the first game as chosen for the room (Random tosses a coin); each rematch swaps them
function hostStart() {
  NET.white = NET.games ? 1 - NET.white : M.netColour === 'white' ? 0 : M.netColour === 'black' ? 1 : Math.random() < 0.5 ? 0 : 1;
  const setup = { t: 'setup', start: C.START, white: NET.white, games: NET.games };
  netSend(setup); startOnlineGame(setup);
}
function startOnlineGame(m) {
  let g; try { g = C.newGame(typeof m.start === 'string' ? m.start : C.START); } catch (e) { return; }
  NET.white = m.white === 1 ? 1 : 0; NET.me = NET.seat === NET.white ? 'w' : 'b';
  if (Number.isInteger(m.games)) NET.games = m.games;
  Object.assign(NET, { started: true, queue: [], hold: [], again: [false, false], drawOffered: false });
  G = g; state = 'play'; sel = -1; targets = []; closePanels(); placeAll(G);
  Object.assign(cam, { mode: 'play', base: NET.me === 'w' ? 0 : PI, yawOff: 0, pitch: 0.95, zoom: 1 });
  showGameUI(); hud(); showMarks();
  toast(`You play ${NET.me === 'w' ? 'White' : 'Black'} against ${NET.peerName}`);
  saveRejoin();
}
// the whole game (its start, every move, and a resignation or agreed draw): for a player coming back, or to put the
// two games back in step after a mismatch (fix)
function netSendState(fix) {
  if (!NET.started || !G) return;
  const r = G.result && /resigned|agreed/.test(G.result.why) ? G.result : null;
  netSend({ t: 'state', fix: !!fix, start: G.start, moves: G.list.map(x => C.uci(x.m)), white: NET.white, games: NET.games, result: r });
}
function adoptState(m) {
  if (typeof m.start !== 'string' || !Array.isArray(m.moves)) return;
  const done = r => r && ['resigned', 'agreed'].includes(r.why) && ['1-0', '0-1', '1/2-1/2'].includes(r.score);
  // only a game further on than ours (or ended where ours isn't), unless it's the fix after a mismatch
  if (NET.started && !m.fix && !(m.moves.length > G.list.length || (done(m.result) && !G.result))) return;
  let g; try { g = C.newGame(m.start); } catch (e) { return; }
  for (const u of m.moves) {
    g = C.playUci(g, String(u));
    if (!g) { toast(`Your game and ${NET.peerName}'s don't match. Both of you reload it (Ctrl+F5 on a computer, or close and reopen it on a phone).`); return; }
  }
  if (done(m.result) && !g.result) g = C.finish(g, m.result.score, m.result.why);
  const back = !NET.started;
  NET.white = m.white === 1 ? 1 : 0; NET.me = NET.seat === NET.white ? 'w' : 'b';
  if (Number.isInteger(m.games)) NET.games = m.games;
  Object.assign(NET, { started: true, queue: NET.queue.filter(q => q.n > g.list.length), hold: [] });
  G = g; state = G.result ? 'over' : 'play'; sel = -1; targets = []; closePanels(); placeAll(G);
  if (back) Object.assign(cam, { mode: 'play', base: NET.me === 'w' ? 0 : PI, yawOff: 0, pitch: 0.95, zoom: 1 });
  showGameUI(); hud(); showMarks();
  toast(m.fix ? `Your game was put back in step with ${NET.peerName}'s` : `Back in the game with ${NET.peerName}`);
  if (NET.verWarn) setTimeout(() => { if (NET.on) toast(NET.verWarn); }, 2800);
  if (state === 'over') showOver();
  saveRejoin(); netProcessQueue();
}
// the other player's moves, in order: each must be the next move, theirs to make, legal here, and reach the same
// position as theirs; anything else asks for the whole game again
function netProcessQueue() {
  if (!NET.started || !G || state === 'anim' || state === 'lobby') return;
  NET.queue = NET.queue.filter(q => q.n > G.list.length);
  const m = NET.queue[0];
  if (!m) return;
  if (m.n !== G.list.length + 1) { NET.queue = []; netSend({ t: 'resync' }); return; }   // a move went missing
  NET.queue.shift();
  if (G.result || G.pos.turn === NET.me) return;
  const n = C.playUci(G, m.u);
  if (!n) { toast(`Ignored a move from ${NET.peerName} that isn't legal here`); netSend({ t: 'resync' }); return; }
  if (typeof m.fen === 'string' && m.fen !== C.toFen(n.pos)) { toast(`That move didn't give the same position on both screens, so your game is being put back in step`); netSend({ t: 'resync' }); return; }
  if (state === 'promo') cancelPromo();
  tryMove({ from: C.sq(m.u.slice(0, 2)), to: C.sq(m.u.slice(2, 4)), promo: m.u[4] || '' });
}
function netOfferDraw() {
  if (!NET.started || G.result) return;
  if (!NET.peer) { toast(`Waiting for ${NET.peerName} to reconnect`); return; }
  NET.drawOffered = true; netSend({ t: 'drawOffer' }); toast(`Draw offered. Waiting for ${NET.peerName}`);
}
$('#bOfferYes').onclick = () => { $('#offer').hidden = true; if (!G || G.result) return; netSend({ t: 'drawYes' }); G = C.finish(G, '1/2-1/2', 'agreed'); afterMove(); };
$('#bOfferNo').onclick = () => { $('#offer').hidden = true; netSend({ t: 'drawNo' }); };
function netBadge() {
  const el = $('#net');
  if (!NET.on) { el.textContent = ''; return; }
  const ok = NET.link === 'online' && NET.peer;
  el.textContent = NET.link !== 'online' ? 'Reconnecting to the relay…' : ok ? `${NET.peerName} is connected` : `${NET.peerName} is not connected`;
  el.dataset.ok = ok ? '1' : '0';
}
// quick chat: preset messages only, so there's nothing to moderate in listed rooms
const CHAT = ['Good move!', 'Unlucky', 'Good luck', 'Good game', 'Thanks!', 'Oops!', 'Wow!', 'One more?'];
let lastChat = 0;
function sendChat(i) {
  if (!NET.on || performance.now() - lastChat < 1200) return;
  lastChat = performance.now(); netSend({ t: 'chat', i }); toast(`You: ${CHAT[i]}`); $('#chatPop').hidden = true;
}
CHAT.forEach((txt, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = txt; b.dataset.i = i; b.addEventListener('click', () => sendChat(i)); $('#chatPop').appendChild(b); });
$('#bChat').onclick = () => { $('#chatPop').hidden = !$('#chatPop').hidden; };
// Play again: both players ask, then the host starts the next game with the colours swapped
function updateAgainBtn() {
  const b = $('#bAgain');
  b.textContent = !NET.on ? 'Play again' : NET.again[NET.seat] ? `Waiting for ${NET.peerName}…` : NET.again[1 - NET.seat] ? 'Play again: accept' : 'Play again';
}
function askRematch() { if (NET.again[NET.seat]) return; NET.again[NET.seat] = true; netSend({ t: 'again' }); tryRematch(); }
function tryRematch() {
  if (!NET.on) return;
  if (NET.again[0] && NET.again[1]) { NET.again = [false, false]; if (NET.seat === 0) { NET.games++; hostStart(); } }
  else if (!$('#over').hidden) updateAgainBtn();
}
// "Rejoin": an online game left by accident (app closed, tab shut, battery died) can be picked up again for a few
// hours. The room and this player's id are kept on the device, so the relay gives back the same seat, and the
// opponent's game (if it's still open) sends the whole game, just as after a reload. Leaving on purpose forgets it.
// There's one entry per player id, because two tabs on one device can each hold a seat in the same game.
const REJOIN_MS = 3 * 60 * 60 * 1000, REJOIN_KEY = 'retroSet.rejoin';
function rejoinList() {
  try { const l = JSON.parse(localStorage.getItem(REJOIN_KEY) || '[]'); return Array.isArray(l) ? l.filter(r => r && r.code && r.cid && Date.now() - r.at < REJOIN_MS) : []; } catch (e) { return []; }
}
function putRejoin(l) { try { if (l.length) localStorage.setItem(REJOIN_KEY, JSON.stringify(l)); else localStorage.removeItem(REJOIN_KEY); } catch (e) {} }
function saveRejoin() {
  if (!NET.on || !NET.started) return;
  putRejoin([{ code: NET.code, cid: NET.cid, peer: NET.peerName, at: Date.now() }, ...rejoinList().filter(r => r.cid !== NET.cid)].slice(0, 4));
}
function clearRejoin() { if (NET.cid) putRejoin(rejoinList().filter(r => r.cid !== NET.cid)); }
// A page in an online room holds a lock named after its player id; the browser frees it when the page closes.
// So another tab never offers to take over a seat that's still being played.
const seatLock = cid => 'retroSet.seat.' + cid;
function holdSeat() {
  const cid = NET.cid;
  if (!navigator.locks || NET.unlock) return;
  navigator.locks.request(seatLock(cid), () => NET.on && NET.cid === cid && !NET.unlock ? new Promise(res => { NET.unlock = res; }) : null).catch(() => {});
}
function freeSeat() { if (NET.unlock) { NET.unlock(); NET.unlock = null; } }
async function rejoinChoice() {
  let l = relayBase() ? rejoinList() : [];
  if (l.length && navigator.locks) {
    try { const q = await navigator.locks.query(), busy = new Set([...q.held, ...q.pending].map(k => k.name)); l = l.filter(r => !busy.has(seatLock(r.cid))); } catch (e) {}
  }
  return state === 'menu' && !NET.on ? l[0] || null : null;
}
async function updateRejoin() {
  const r = await rejoinChoice(), b = $('#bRejoin');
  b.hidden = !r; if (r) b.textContent = `Rejoin your game with ${cleanName(r.peer)}`;
}
addEventListener('storage', e => { if (e.key === REJOIN_KEY && state === 'menu') updateRejoin(); });
addEventListener('focus', () => { if (state === 'menu') updateRejoin(); });
const waitText = () => NET.rejoin ? `Waiting for ${cleanName(NET.rejoin.peer)} to come back…` : 'Waiting for your friend to join…';
$('#bRejoin').onclick = async () => {
  const r = await rejoinChoice(); if (!r) { updateRejoin(); return; }
  try { sessionStorage.setItem('rs.cid', r.cid); } catch (e) {}   // the same player id gets the same seat back
  startOnline(cleanCode(r.code), false, r);
};
$('#bCreate').onclick = () => menuGo('room');
$('#bStart').onclick = () => startOnline(newCode(), M.listed !== false);
$('#bJoin').onclick = () => startOnline(cleanCode($('#netCode').value));
$('#netCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#bJoin').click(); });
$('#bLobbyCancel').onclick = () => { clearRejoin(); toMenu('online'); };
$('#bCopyLink').onclick = async () => {
  const link = inviteLink();
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: 'Retro Set', text: 'Play chess with me', url: link }); return; }
    await navigator.clipboard.writeText(link); lobbyStatus('Invite link copied. Send it to your friend.');
  } catch (e) { const i = $('#lobbyLink'); i.focus(); i.select(); try { document.execCommand('copy'); lobbyStatus('Invite link copied.'); } catch (e2) { lobbyStatus('Copy the link below and send it to your friend.'); } }
};
try { $('#netName').value = localStorage.getItem('retroSet.name') || ''; } catch (e) {}
// the open rooms list: watched live from the relay while the Online screen is showing
const LW = { ws: null, rooms: [], off: 0, retry: 0, timer: 0, pending: 0, want: false, failed: false, loaded: false };
const COLOUR_NAME = { white: 'They play White', black: 'They play Black', random: 'Colours at random' };
function updateLobbyWatch() {
  const want = state === 'menu' && !NET.on && screen === 'online' && !!relayBase() && document.visibilityState === 'visible';
  LW.want = want;
  // short delay, so opening an invite link (which jumps straight into a room) never starts a list connection
  if (want && !LW.ws && !LW.pending) LW.pending = setTimeout(() => { LW.pending = 0; if (LW.want && !LW.ws) lobbyConnect(); }, 300);
  if (!want && LW.ws) {
    const ws = LW.ws; LW.ws = null;
    if (ws.readyState === 0) ws.onopen = () => { try { ws.close(1000); } catch (e) {} };
    else { try { ws.close(1000); } catch (e) {} }
  }
  renderRooms();
}
function lobbyConnect() {
  let ws;
  try { ws = new WebSocket(`${relayBase()}/lobby`); } catch (e) { LW.failed = true; renderRooms(); return; }
  LW.ws = ws; renderRooms();
  ws.onopen = () => { LW.retry = 0; LW.failed = false; renderRooms(); };
  ws.onmessage = e => {
    if (e.data === 'pong') return;
    let m; try { m = JSON.parse(e.data); } catch (err) { return; }
    if (m.t === 'rooms' && Array.isArray(m.rooms)) { LW.rooms = m.rooms; LW.off = (Number(m.now) || Date.now()) - Date.now(); LW.loaded = true; renderRooms(); }
  };
  ws.onclose = () => {
    if (LW.ws === ws) LW.ws = null;
    if (!LW.want) return;
    LW.failed = LW.retry > 1; renderRooms();
    clearTimeout(LW.timer); LW.timer = setTimeout(() => { if (LW.want && !LW.ws) lobbyConnect(); }, Math.min(10000, 1000 * Math.pow(2, LW.retry++)));
  };
}
setInterval(() => { if (LW.ws && LW.ws.readyState === 1) LW.ws.send('ping'); }, 25000);
setInterval(() => { if (LW.want) renderRooms(); }, 30000);
document.addEventListener('visibilitychange', () => { updateLobbyWatch(); if (!document.hidden && state === 'menu') updateRejoin(); });
function renderRooms() {
  const el = $('#roomList'), live = $('#roomsLive');
  const note = t => { el.textContent = ''; const d = document.createElement('div'); d.className = 'note'; d.textContent = t; el.appendChild(d); };
  if (!relayBase()) { live.textContent = ''; note('Online play isn\'t set up yet: it needs the relay address in config.js (the README explains how).'); return; }
  live.textContent = LW.ws && LW.ws.readyState === 1 ? 'Live' : LW.failed ? "Can't reach the relay" : 'Connecting…';
  if (!LW.rooms.length) { note(LW.loaded ? 'No open rooms right now. Create a listed room and it will show up here.' : 'Looking for open rooms…'); return; }
  el.textContent = '';
  const now = Date.now() + LW.off;
  for (const r of LW.rooms) {
    const row = document.createElement('div'); row.className = 'roomItem';
    const info = document.createElement('div');
    const n = document.createElement('div'); n.className = 'rn'; n.textContent = `${cleanName(r.name, 'Player')}'s room`;
    const mins = Math.max(0, Math.round((now - Number(r.at)) / 60000));
    const d = document.createElement('div'); d.className = 'rm'; d.textContent = `${COLOUR_NAME[r.mode] || COLOUR_NAME.random}, ${mins < 1 ? 'just opened' : mins + ' min waiting'}`;
    info.append(n, d);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = 'Join';
    b.addEventListener('click', () => startOnline(cleanCode(r.code)));
    row.append(info, b); el.appendChild(row);
  }
}

// ------------------------------------------------------------------ saving
// The game on the board is saved after every move (the starting position, the moves as e2e4 and so on, and against the
// computer which bot and your colour), so a reload or a closed tab can carry on from the home screen's Resume button.
// A finished game is forgotten.
const SAVE = 'retroSet.game';
function save() {
  if (NET.on) return;   // an online game isn't kept for Resume (Rejoin brings it back), and leaves the saved one alone
  try {
    if (G && !G.result) localStorage.setItem(SAVE, JSON.stringify({ v: 1, start: G.start, moves: G.list.map(x => C.uci(x.m)), vs }));
    else localStorage.removeItem(SAVE);
  } catch (e) {}
}
function loadSaved() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE) || 'null');
    if (!d || !Array.isArray(d.moves)) return null;
    let g = C.newGame(d.start);
    for (const s of d.moves) { g = C.playUci(g, String(s)); if (!g) return null; }
    const v = d.vs && BT.byId(d.vs.bot) && /^[wb]$/.test(d.vs.me) ? { bot: BT.byId(d.vs.bot).id, me: d.vs.me } : null;
    return g.result ? null : { g, vs: v };
  } catch (e) { return null; }
}

// ------------------------------------------------------------------ installable app
// Only on a real web address: a downloaded copy opened from disk can't install or use a service worker.
$('#ver').textContent = `Version ${BUILD}`;
if (/^https?:$/.test(location.protocol)) {
  const link = document.createElement('link'); link.rel = 'manifest'; link.href = 'manifest.webmanifest';
  const icon = document.createElement('link'); icon.rel = 'apple-touch-icon'; icon.href = 'icons/icon-192.png';
  document.head.append(link, icon);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* the game works without it */ });
}

// ------------------------------------------------------------------ main loop
let frames = 0, lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  glideTick(dt); thinkTick(now);
  cam.update(dt);
  renderer.info.reset();
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  frames++;
}
addEventListener('resize', resize);
resize(); applyLook();
{ const s = loadSaved(); placeAll(s ? s.g : C.newGame()); }   // behind the menu: the game waiting to be resumed, or a fresh set
menuGo('home');
requestAnimationFrame(frame);
{ // opening an invite link joins the room straight away
  const m = /#room=([A-Za-z0-9]+)/.exec(location.hash);
  if (m) { const code = cleanCode(m[1]); $('#netCode').value = code; if (relayBase()) startOnline(code); else { menuGo('online'); menuNote('This is an invite link, but online play needs the relay address in config.js first.'); } }
}
// for the browser tests: what the page is doing, without reaching into its internals
window.__rs = {
  get state() { return state; }, get frames() { return frames; }, get triangles() { return renderer.info.render.triangles; }, S, start: C.START,
  get fen() { return G ? C.toFen(G.pos) : ''; }, get moves() { return G ? G.list.map(x => x.san) : []; }, get result() { return G && G.result; },
  get sel() { return sel >= 0 ? C.sqName(sel) : ''; }, get view() { return { base: cam.base, yaw: cam.cur.yaw }; },
  get pieces() { return onSq.filter(Boolean).length; }, get taken() { return PIECES.children.length - onSq.filter(Boolean).length; },
  start2(fen) { startLocal(C.newGame(fen)); },   // a two-player game from a given position
  startCpu(bot, me, fen) { startGame(C.newGame(fen), { bot, me }); },   // a game against a bot, from a given position
  get vs() { return vs; }, set quick(v) { QUICK = !!v; },
  look(set, fin) { setLook(set, fin); }, sets: SETS.LIST.map(x => x.id), finishes: SETS.FINISHES.map(x => x.id), get tris() { return PIECES.children.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0); }, icon: (k, c, w, h) => pieceIcon(k, c, w, h).toDataURL(),
  camSet(o) { Object.assign(cam, o); },   // the view in a game: pitch, zoom, yawOff
  shape(k) { const b = SETS.geo(S.set, k).boundingBox; return { h: b.max.y, w: Math.max(b.max.x - b.min.x, b.max.z - b.min.z), low: b.min.y }; },   // a kind's size in the set in use, in metres
  mask(k) { const c = pieceIcon(k, 'w', 48, 60, true), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let m = ''; for (let i = 3; i < d.length; i += 4) m += d[i] ? 1 : 0; return m; },   // its outline from the front, filling the height, as filled or empty pixels
  get net() { return { on: NET.on, seat: NET.seat, me: NET.me, cid: NET.cid, code: NET.code, peer: NET.peer, link: NET.link, started: NET.started, peerName: NET.peerName, games: NET.games }; },
  send(o) { netSend(o); },   // a raw message, as a modified copy of the game could send
  squareScreen(name) {   // where a square's middle is on the screen, in page pixels
    const s = C.sq(name), v = new THREE.Vector3(sqX(s), 0.004, sqZ(s)).project(camera), r = canvas.getBoundingClientRect();
    return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
  },
};
})();
