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
// round to the player whose move it is; set and finish: the pieces (sets.js); hints: dots and rings where a picked-up
// piece can go; autoQueen: a pawn reaching the end becomes a queen without asking; confirm: a move waits for a tap on
// Confirm; flat: in a game, look straight down at flat pictures of the pieces; coords: the letters and numbers round
// the board; lastMove: the last move's squares tinted; volume: 0 to 1 (0.75 the loudness the sounds were made at);
// vibrate: a buzz for a capture and for check, on phones that can; mySet: online, both sides wear your pieces
const DEFAULTS = { pixel: 1, levels: 256, dither: true, outline: true, turn: true, set: 'classic', finish: 'classic',
  hints: true, autoQueen: false, confirm: false, flat: false, coords: true, lastMove: true, volume: 0.75, vibrate: true, mySet: false };
const S = { ...DEFAULTS };
try { Object.assign(S, JSON.parse(localStorage.getItem('retroSet.settings') || '{}')); } catch (e) {}
S.set = SETS.byId(S.set).id; S.finish = SETS.finish(S.finish).id;
if (!(S.volume >= 0 && S.volume <= 1)) S.volume = DEFAULTS.volume;
// what is worn in each of the locker's seven slots (looks.js): the pieces' set and finish are S.set and S.finish
const W = { board: 'standard', room: 'parlour', fx: 'none', avatar: 'plain', marks: 'standard' };
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
  if (FLAT && SHOWN && !GLIDE) { placeAll(SHOWN); showMarks(); }   // flat pictures are drawn to suit the size
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
const SQ = 0.057, BORDER = 0.03, B = 8 * SQ + 2 * BORDER, TABLE_Y = -0.02, FLOOR_Y = -0.75;
scene.add(new THREE.HemisphereLight(0xb7c0ff, 0x2a1a3a, 0.32 * PI));
const sun = new THREE.DirectionalLight(0xfff0d8, 0.17 * PI); sun.position.set(0.6, 3, 1.2); scene.add(sun);
// two low lights from opposite corners, warm and cool, so the upright faces of the pieces differ from one another and
// their shapes show from either side of the board (the lamp and sun are overhead, and light every side face alike)
for (const [x, z, col] of [[1, 0.8, 0xffe2c0], [-1, -0.8, 0xc8d4ff]]) { const f = new THREE.DirectionalLight(col, 0.16 * PI); f.position.set(x, 0.55, z); scene.add(f); }
const lamp = new THREE.PointLight(0xffdca4, 0.75 * PI, 5, 0.43); lamp.position.set(0, 0.7, 0); scene.add(lamp);
// The room (the Room slot, W.room): the colour of the air, the floor and the table, and a few things standing round the
// edge (props). The lights over the board stay as they are in every room, so the pieces always read the same.
const ROOMS = {
  parlour: { bg: '#1a1433', floor: '#2a1d40', table: '#6b3a22' },
  library: { bg: '#17100b', floor: '#3b2515', table: '#1f4a36', leg: '#4a2a16', props: 'shelves' },
  cafe: { bg: '#2b2420', floor: '#ffffff', tiles: ['#b9afa2', '#5a4a44'], table: '#bdb9b0', leg: '#3a3a3e', props: 'cafe' },
  park: { bg: '#8cc0e6', floor: '#4f8a3c', table: '#85857f', props: 'trees' },
  arcade: { bg: '#0a0716', floor: '#ffffff', tiles: ['#141030', '#141030', '#ff4fb4'], table: '#221a44', props: 'cabinets' },
  space: { bg: '#04030a', floor: null, table: '#1a1830', props: 'stars' },
};
const lam = (color, more) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...more });
const floorMat = lam('#2a1d40'), tableMat = lam('#6b3a22', { flatShading: false }), legMat = lam('#6b3a22', { flatShading: false });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);   // it reaches past the fog, so its edge never shows
floor.rotation.x = -PI / 2; floor.position.y = FLOOR_Y; scene.add(floor);
const table = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24), tableMat); table.position.y = TABLE_Y - 0.02; scene.add(table);
const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, TABLE_Y - 0.04 - FLOOR_Y, 8), legMat); leg.position.y = (TABLE_Y - 0.04 + FLOOR_Y) / 2; scene.add(leg);
const PROPS = new THREE.Group(); scene.add(PROPS);
const prop = (geo, mat, x, y, z, ry = 0, to = PROPS) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; to.add(m); return m; };
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d), cylG = (r0, r1, h, n = 8) => new THREE.CylinderGeometry(r1, r0, h, n);
// floor tiles: a tiny picture repeated (two colours chequered; a third makes it lines on a ground instead)
const TILES = {};
function tiles(cols) {
  const k = cols.join();
  if (!TILES[k]) {
    const t = canvasTex(8, 8, g => { g.fillStyle = cols[0]; g.fillRect(0, 0, 8, 8); g.fillStyle = cols[2] || cols[1]; if (cols[2]) { g.fillRect(0, 0, 8, 1); g.fillRect(0, 0, 1, 8); } else { g.fillRect(0, 0, 4, 4); g.fillRect(4, 4, 4, 4); } });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(50, 50); TILES[k] = t;
  }
  return TILES[k];
}
const PROPS_OF = {
  shelves(rnd) {   // bookcases in a ring, and a rug under the table
    const wood = lam('#3a2414'), books = ['#8a2f3a', '#2f5a4a', '#c9a24a', '#2f4f7a', '#6a3c7a', '#b5653a'].map(c => lam(c));
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * 2 * PI + 0.35, g = new THREE.Group(); g.position.set(Math.sin(a) * 2.3, FLOOR_Y, Math.cos(a) * 2.3); g.rotation.y = a + PI; PROPS.add(g);
      prop(boxG(1, 1.9, 0.32), wood, 0, 0.95, 0, 0, g);
      for (let row = 0; row < 4; row++) for (let x = -0.44; x < 0.38;) { const w = 0.05 + rnd() * 0.05, h = 0.24 + rnd() * 0.1; prop(boxG(w, h, 0.12), books[Math.floor(rnd() * 6)], x + w / 2, 0.16 + row * 0.44 + h / 2, 0.13, 0, g); x += w + 0.004; }
    }
    prop(new THREE.CircleGeometry(1.15, 20), lam('#6a2030'), 0, FLOOR_Y + 0.003, 0).rotation.x = -PI / 2;
  },
  cafe(rnd) {   // little round tables with stools, and a counter
    const top = lam('#e6e2da'), dark = lam('#3a3a3e'), seat = lam('#b5653a');
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * 2 * PI + 0.5, r = 1.9 + rnd() * 0.7, x = Math.sin(a) * r, z = Math.cos(a) * r;
      prop(cylG(0.3, 0.3, 0.03, 10), top, x, FLOOR_Y + 0.7, z); prop(cylG(0.03, 0.03, 0.7, 6), dark, x, FLOOR_Y + 0.35, z);
      for (const s of [-1, 1]) { const b = a + s * 0.24; prop(cylG(0.13, 0.13, 0.04, 8), seat, Math.sin(b) * (r + 0.1), FLOOR_Y + 0.45, Math.cos(b) * (r + 0.1)); prop(cylG(0.025, 0.025, 0.45, 5), dark, Math.sin(b) * (r + 0.1), FLOOR_Y + 0.225, Math.cos(b) * (r + 0.1)); }
    }
    prop(boxG(2.4, 1, 0.5), lam('#5a3a2a'), 0, FLOOR_Y + 0.5, -3.2); prop(boxG(2.5, 0.05, 0.6), top, 0, FLOOR_Y + 1.02, -3.2); prop(boxG(0.4, 0.45, 0.3), lam('#c4cbd6'), -0.7, FLOOR_Y + 1.27, -3.2);
  },
  trees(rnd) {   // trees and a bench, on grass
    const trunk = lam('#6a4426'), leaf = [lam('#2f6a2c'), lam('#3f8a3a'), lam('#4f9a40')], wood = lam('#8a5a32');
    for (let i = 0; i < 11; i++) {
      const a = i / 11 * 2 * PI + rnd() * 0.3, r = 2.1 + rnd() * 2.6, x = Math.sin(a) * r, z = Math.cos(a) * r, k = 0.8 + rnd() * 0.6;
      prop(cylG(0.09 * k, 0.06 * k, 0.9 * k, 6), trunk, x, FLOOR_Y + 0.45 * k, z);
      prop(cylG(0.52 * k, 0, 1 * k, 7), leaf[i % 3], x, FLOOR_Y + 1.3 * k, z); prop(cylG(0.38 * k, 0, 0.8 * k, 7), leaf[(i + 1) % 3], x, FLOOR_Y + 1.85 * k, z);
    }
    prop(boxG(1.1, 0.05, 0.3), wood, 0, FLOOR_Y + 0.42, 1.25); prop(boxG(1.1, 0.3, 0.05), wood, 0, FLOOR_Y + 0.62, 1.4);
    for (const x of [-0.45, 0.45]) prop(boxG(0.06, 0.42, 0.28), wood, x, FLOOR_Y + 0.21, 1.25);
  },
  cabinets() {   // arcade machines in a ring, their screens lit, and two coloured lights
    const body = lam('#1c1636'), cols = ['#35e0ff', '#ff4fb4', '#ffc56b', '#7dffb0'];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * 2 * PI + 0.4, g = new THREE.Group(); g.position.set(Math.sin(a) * 2.3, FLOOR_Y, Math.cos(a) * 2.3); g.rotation.y = a + PI; PROPS.add(g);
      const lit = new THREE.MeshBasicMaterial({ color: cols[i % 4] });
      prop(boxG(0.62, 1.6, 0.6), body, 0, 0.8, 0, 0, g); prop(boxG(0.46, 0.34, 0.02), lit, 0, 1.12, 0.31, 0, g); prop(boxG(0.62, 0.14, 0.04), lit, 0, 1.5, 0.32, 0, g); prop(boxG(0.5, 0.05, 0.22), lam('#3a2f66'), 0, 0.82, 0.38, 0, g);
    }
    for (const [x, z, c] of [[-1.5, 1.1, 0xff4fb4], [1.5, -1.1, 0x35e0ff]]) { const l = new THREE.PointLight(c, 0.5 * PI, 5, 0.6); l.position.set(x, 0.9, z); PROPS.add(l); }
  },
  stars(rnd) {   // stars all round, a planet, and a lit rim on the table, which floats
    const pos = [];
    for (let i = 0; i < 700; i++) { const u = rnd() * 2 - 1, a = rnd() * 2 * PI, r = Math.sqrt(1 - u * u) * 9.5; pos.push(Math.cos(a) * r, u * 9.5, Math.sin(a) * r); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    PROPS.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#e8ecff', size: 1.5, sizeAttenuation: false, fog: false, depthWrite: false })));
    prop(new THREE.SphereGeometry(1.2, 10, 7), lam('#c9703a', { fog: false }), -4.6, 0.3, -6.2);
    prop(new THREE.TorusGeometry(1.9, 0.09, 3, 24), lam('#e0c890', { fog: false }), -4.6, 0.3, -6.2).rotation.x = 1.25;
    prop(new THREE.TorusGeometry(0.42, 0.012, 4, 24), new THREE.MeshBasicMaterial({ color: '#6cb8ff' }), 0, TABLE_Y - 0.04, 0).rotation.x = PI / 2;
  },
};
let roomOn = '';
function applyRoom() {
  const r = ROOMS[W.room] || ROOMS.parlour;
  if (roomOn === W.room) return; roomOn = W.room;
  ROOM.set(r.bg); scene.fog.color.set(r.bg);
  floor.visible = r.floor !== null; if (r.floor) floorMat.color.set(r.floor);
  floorMat.map = r.tiles ? tiles(r.tiles) : null; floorMat.needsUpdate = true;
  tableMat.color.set(r.table); legMat.color.set(r.leg || r.table); leg.visible = r.floor !== null;
  PROPS.traverse(o => { if (o.geometry) o.geometry.dispose(); }); PROPS.clear();
  if (r.props) PROPS_OF[r.props](C.rng(7));
}

// ------------------------------------------------------------------ board
// Squares of 5.7 cm with a 3 cm border, on a small round table. Square s (0 = a1 … 63 = h8) is centred at
// (sqX(s), 0, sqZ(s)); White sits at +z, so from White's side a1 is at the near left.
const sqX = s => ((s & 7) - 3.5) * SQ, sqZ = s => (3.5 - (s >> 3)) * SQ;
// The board (the Board slot, W.board): light and dark squares, the frame, the coordinates' ink; tex: a pattern drawn
// into every square; glow: a colour that shines by itself wherever the pattern says; anim: the glow swells and fades.
const BOARDS = {
  standard: { l: '#c4a67c', d: '#5a3b78', f: '#3a2452', ink: '#c9b48f' },
  tournament: { l: '#b4b38c', d: '#55804a', f: '#2f4a2c', ink: '#c9c8a2' },
  walnut: { l: '#bc9c6c', d: '#704226', f: '#3c2414', ink: '#c9a878' },
  slate: { l: '#969ba6', d: '#525a68', f: '#2c313a', ink: '#a4a9b4' },
  ocean: { l: '#8cb0c0', d: '#2c6690', f: '#173a55', ink: '#a4c8d6' },
  rosewood: { l: '#bea486', d: '#822c38', f: '#4a1620', ink: '#d0b698' },
  mint: { l: '#98bca4', d: '#2c7668', f: '#16423a', ink: '#b0d2bc' },
  sand: { l: '#c2aa74', d: '#9a6a34', f: '#6a4420', ink: '#d6be88' },
  hall: { l: '#b2b0a8', d: '#454b58', f: '#1c1f26', ink: '#cfae6a', tex: 'veins' },
  grid: { l: '#34306a', d: '#17123a', f: '#0b0818', ink: '#35e0ff', tex: 'grid', glow: '#35e0ff' },
  galaxy: { l: '#5a4f9a', d: '#221c50', f: '#0d0a24', ink: '#b8c4ff', tex: 'stars', glow: '#ffffff' },
  lava: { l: '#6a3220', d: '#2a1512', f: '#120807', ink: '#ffb060', tex: 'cracks', glow: '#e04a10', anim: true },
};
// the patterns: each draws one square (16 px), and, on the glow pass, what shines; both passes must ask rnd for the
// same numbers, so the two pictures line up
const PATTERN = {
  veins(g, x0, y0, light, rnd, glow) {
    for (let v = 0; v < 2; v++) { let x = Math.floor(rnd() * 16), y = 0; const d = rnd() < 0.5 ? 1 : -1; for (let i = 0; i < 16; i++) { if (!glow && x >= 0 && x < 16) { g.fillStyle = light ? '#b4b0a6' : '#7a8296'; g.fillRect(x0 + x, y0 + y, 1, 1); } y++; if (rnd() < 0.6) x += d; } }
  },
  grid(g, x0, y0, light, rnd, glow, b) { g.fillStyle = glow ? '#888' : b.glow; g.globalAlpha = glow ? 1 : 0.5; g.fillRect(x0, y0, 16, 1); g.fillRect(x0, y0, 1, 16); g.globalAlpha = 1; },
  stars(g, x0, y0, light, rnd, glow) { const n = 2 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) { const x = Math.floor(rnd() * 16), y = Math.floor(rnd() * 16), big = rnd() < 0.3; g.fillStyle = glow ? (big ? '#fff' : '#555') : big ? '#ffffff' : '#b8c4ff'; g.fillRect(x0 + x, y0 + y, 1, 1); } },
  cracks(g, x0, y0, light, rnd, glow) {
    for (let v = 0; v < (light ? 0 : 1); v++) { let x = Math.floor(rnd() * 16), y = Math.floor(rnd() * 16); for (let i = 0; i < 10; i++) { g.fillStyle = glow ? '#fff' : '#b03c14'; if (x >= 0 && x < 16 && y >= 0 && y < 16) g.fillRect(x0 + x, y0 + y, 1, 1); const r = rnd(); if (r < 0.4) x++; else if (r < 0.6) x--; else if (r < 0.85) y++; else y--; } }
  },
};
// the coordinates round the border, in a tiny pixel font (3 × 5): files along White's and Black's edges, ranks up the
// sides, each set the right way up for the player sitting nearest
const GLYPH = {
  a: ['.#.', '#.#', '###', '#.#', '#.#'], b: ['##.', '#.#', '##.', '#.#', '##.'], c: ['.##', '#..', '#..', '#..', '.##'], d: ['##.', '#.#', '#.#', '#.#', '##.'],
  e: ['###', '#..', '##.', '#..', '###'], f: ['###', '#..', '##.', '#..', '#..'], g: ['.##', '#..', '#.#', '#.#', '.##'], h: ['#.#', '#.#', '###', '#.#', '#.#'],
  1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'], 4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'], 6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
};
const drawBoard = (coords, id = 'standard', glow = false) => canvasTex(144, 144, (g) => {   // 16 px a square, 8 px of border
  const b = BOARDS[id], rnd = C.rng(id.length * 977 + id.charCodeAt(0));
  g.fillStyle = glow ? '#000' : b.f; g.fillRect(0, 0, 144, 144);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const light = (f + r) & 1, x0 = 8 + f * 16, y0 = 8 + (7 - r) * 16;
    g.fillStyle = glow ? '#000' : light ? b.l : b.d; g.fillRect(x0, y0, 16, 16);
    if (b.tex) PATTERN[b.tex](g, x0, y0, light, rnd, glow, b);
  }
  if (!coords || glow) return;
  g.fillStyle = b.ink;
  const glyph = (ch, x, y, flip) => GLYPH[ch].forEach((row, j) => [...row].forEach((p, i) => { if (p === '#') g.fillRect(flip ? x + 2 - i : x + i, flip ? y + 4 - j : y + j, 1, 1); }));
  for (let i = 0; i < 8; i++) {
    glyph(C.FILES[i], 8 + i * 16 + 7, 137, false); glyph(C.FILES[i], 8 + i * 16 + 6, 2, true);
    glyph(String(i + 1), 3, 8 + (7 - i) * 16 + 6, false); glyph(String(i + 1), 138, 8 + (7 - i) * 16 + 5, true);
  }
});
const BOARD_TEX = {};   // each board's pictures, with the coordinates and without
const frameMat = lam('#3a2452', { flatShading: false }), topMat = new THREE.MeshLambertMaterial({ map: drawBoard(true) });
const frameBox = new THREE.Mesh(new THREE.BoxGeometry(B, -TABLE_Y, B), frameMat); frameBox.position.y = TABLE_Y / 2; scene.add(frameBox);
const boardTop = new THREE.Mesh(new THREE.PlaneGeometry(B, B), topMat); boardTop.rotation.x = -PI / 2; boardTop.position.y = 0.0005; scene.add(boardTop);
function applyBoard() {
  const id = BOARDS[W.board] ? W.board : 'standard', b = BOARDS[id], k = id + (S.coords ? '+' : '-');
  const t = BOARD_TEX[k] || (BOARD_TEX[k] = { map: drawBoard(!!S.coords, id), glow: b.glow ? drawBoard(false, id, true) : null });
  topMat.map = t.map; topMat.emissiveMap = t.glow; topMat.emissive.set(t.glow ? b.glow : '#000000'); topMat.emissiveIntensity = 0.85; topMat.needsUpdate = true;
  frameMat.color.set(b.f);
}
// marks on the squares: the last move (S.lastMove), the piece picked up, a king in check, where the picked-up piece
// can go (S.hints: a dot on an empty square, a ring round a piece it can take), and a move waiting to be confirmed.
// Their look is the Square marks slot (W.marks): the colours; shape: the last move and the piece picked up as corner
// brackets, or the last move as an arrow; dot: the shape of the dots; anim: the tints breathe or flicker, slowly.
const MARK_LOOKS = {
  standard: { last: '#ffc56b', go: '#6cb8ff', check: '#ff6f8f' },
  mint: { last: '#7dffb0', go: '#f7ead2', check: '#ff6f8f' },
  rose: { last: '#ff9ab0', go: '#ffc56b', check: '#ff3050' },
  mono: { last: '#ffffff', go: '#ffffff', check: '#ff6f8f' },
  corners: { last: '#ff8a1a', go: '#6cb8ff', check: '#ff6f8f', shape: 'corners' },
  arrow: { last: '#ff8a1a', go: '#6cb8ff', check: '#ff6f8f', shape: 'arrow' },
  pulse: { last: '#c58cff', go: '#6cb8ff', check: '#ff6f8f', anim: 'pulse' },
  stars: { last: '#ffc56b', go: '#fff0a0', check: '#ff6f8f', dot: 'star' },
  flame: { last: '#ff8a3a', go: '#ffd9a0', check: '#ff3030', dot: 'diamond', anim: 'flicker' },
};
const markMat = (color, opacity) => { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }); m.userData.o = opacity; return m; };
const MARKS = new THREE.Group(); scene.add(MARKS);
// a flat shape from rectangles [x, y, w, h] or corner points, lying in the mark's own plane
const shapeGeo = pts => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(([x, y]) => [x, y, 0]), 3)); return g; };
const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y], [x + w, y + h], [x, y + h]];
const squareGeo = new THREE.PlaneGeometry(SQ, SQ), ringGeo = new THREE.RingGeometry(SQ * 0.37, SQ * 0.47, 12);
const DOTS = { dot: new THREE.CircleGeometry(SQ * 0.17, 8), diamond: new THREE.CircleGeometry(SQ * 0.2, 4),
  star: shapeGeo([0, 1, 2, 3, 4].flatMap(i => { const a = i * 2 * PI / 5, p = (b, r) => [Math.sin(b) * r * SQ, Math.cos(b) * r * SQ]; return [[0, 0], p(a, 0.24), p(a - 0.63, 0.1), [0, 0], p(a + 0.63, 0.1), p(a, 0.24)]; })) };
const cornerGeo = shapeGeo([-1, 1].flatMap(sx => [-1, 1].flatMap(sy => { const h = SQ / 2, n = SQ * 0.36, t = SQ * 0.12; return [...rectPts(sx > 0 ? h - n : -h, sy > 0 ? h - t : -h, n, t), ...rectPts(sx > 0 ? h - t : -h, sy > 0 ? h - n : -h, t, n)]; })));
const MM = { last: markMat('#ffc56b', 0.3), sel: markMat('#ffc56b', 0.6), check: markMat('#ff6f8f', 0.65), go: markMat('#6cb8ff', 0.8), to: markMat('#6cb8ff', 0.55), edge: markMat('#ffc56b', 0.95) };
let MK = MARK_LOOKS.standard;
function applyMarks() {
  MK = MARK_LOOKS[W.marks] || MARK_LOOKS.standard;
  MM.last.color.set(MK.last); MM.sel.color.set(MK.last); MM.edge.color.set(MK.last); MM.check.color.set(MK.check); MM.go.color.set(MK.go); MM.to.color.set(MK.go);
  for (const k in MM) MM[k].opacity = MM[k].userData.o;
}
function mark(geo, mat, s, y) { const m = new THREE.Mesh(geo, mat); m.rotation.x = -PI / 2; m.position.set(sqX(s), y, sqZ(s)); MARKS.add(m); }
// the last move as an arrow from one square to the other
function arrow(from, to) {
  const ax = sqX(from), ay = -sqZ(from), bx = sqX(to), by = -sqZ(to), len = Math.hypot(bx - ax, by - ay), dx = (bx - ax) / len, dy = (by - ay) / len, px = -dy, py = dx;
  const s = SQ * 0.28, h = SQ * 0.5, w = SQ * 0.12, hw = SQ * 0.3, at = (t, u) => [ax + dx * t + px * u, ay + dy * t + py * u];
  const m = new THREE.Mesh(shapeGeo([at(s, -w), at(len - h, -w), at(len - h, w), at(s, -w), at(len - h, w), at(s, w), at(len - h, -hw), at(len, 0), at(len - h, hw)]), MM.edge);
  m.rotation.x = -PI / 2; m.position.y = 0.0009; MARKS.add(m);
}
function showMarks() {
  MARKS.traverse(o => { if (o.geometry && o.material === MM.edge && MK.shape === 'arrow') o.geometry.dispose(); }); MARKS.clear();
  if (!G || state === 'menu') { if (PRE && PRE.slot === 'marks' && state === 'menu') sampleMarks(); return; }
  const last = G.list[G.list.length - 1], tint = MK.shape === 'corners' ? cornerGeo : squareGeo, mat = MK.shape === 'corners' ? MM.edge : null;
  if (last && S.lastMove) { if (MK.shape === 'arrow') arrow(last.m.from, last.m.to); else { mark(tint, mat || MM.last, last.m.from, 0.0008); mark(tint, mat || MM.last, last.m.to, 0.0008); } }
  if (C.inCheck(G.pos)) mark(squareGeo, MM.check, G.pos.b.indexOf(G.pos.turn === 'w' ? 'K' : 'k'), 0.001);
  if (sel >= 0) mark(tint, mat || MM.sel, sel, 0.0012);
  if (pending) { mark(tint, mat || MM.sel, pending.from, 0.0012); mark(squareGeo, MM.to, pending.to, 0.0012); }
  if (S.hints) for (const s of new Set(targets.map(m => m.to))) mark(G.pos.b[s] || targets.some(m => m.to === s && m.ep) ? ringGeo : DOTS[MK.dot || 'dot'], MM.go, s, 0.0014);
}
// the looks that move (not with reduced motion): the marks' tints, a board's glow, and the two moving finishes
function looksTick(t) {
  if (MK.anim) { const k = MK.anim === 'pulse' ? 0.7 + 0.3 * Math.sin(t * 2.4) : 0.78 + 0.14 * Math.sin(t * 7) + 0.08 * Math.sin(t * 11.3); for (const m of [MM.last, MM.sel, MM.edge]) m.opacity = m.userData.o * k; }
  if ((BOARDS[W.board] || {}).anim) topMat.emissiveIntensity = 0.75 + 0.25 * Math.sin(t * 1.1);
  SETS.tick(t);
}

// ------------------------------------------------------------------ pieces
// The shapes and what they're made of come from sets.js: S.set is the piece set in use and S.finish its finish. Each
// piece is one mesh with a material for the body, the trim and the glow. Every piece faces the other side; knights
// look to their owner's left and a little forwards, so each player sees the head side on, as in a diagram.
// In the flat view (S.flat, in a game only: FLAT) each piece is instead its picture lying on the square, drawn by
// pieceIcon(), the right way up for the side the view is on (cam.base). The pictures never turn with the view: in the
// flat view dragging doesn't turn it, and turning the board (after a move, or the Turn button) is a flip, at once, not a
// swing round. The picture is drawn about
// as many pixels tall as a square is on the screen (flatH, between 12 and 64), so big game pixels don't mangle it.
let FLAT = false, flatH = 48;
const FLAT_MAT = {}, flatGeo = new THREE.PlaneGeometry(SQ * 0.76, SQ * 0.95).translate(0, 0, 0.003);
// whose set and finish a side's pieces wear: yours, except online, where the other side wears the other player's
// (unless "My set only" is on, or they sent none)
const lookOf = c => NET.on && NET.peerLook && !S.mySet && c !== NET.me ? NET.peerLook : S;
function flatMat(ch) {
  const lk = lookOf(C.colour(ch)), key = `${lk.set} ${lk.finish} ${ch} ${flatH}`;
  if (!FLAT_MAT[key]) {
    const t = new THREE.CanvasTexture(pieceIcon(C.kind(ch), C.colour(ch), Math.round(flatH * 0.8), flatH, 0.6, lk.set, lk.finish)); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    FLAT_MAT[key] = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5 });
  }
  return FLAT_MAT[key];
}
const wantFlat = () => S.flat && state !== 'menu' && state !== 'lobby';
function makePiece(ch) {
  if (FLAT) { const f = new THREE.Mesh(flatGeo, flatMat(ch)); f.rotation.set(-PI / 2, 0, cam.base); f.userData.ch = ch; return f; }
  const k = C.kind(ch), c = C.colour(ch), lk = lookOf(c), g = new THREE.Mesh(SETS.geo(lk.set, k), SETS.mats(lk.finish, c));
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
  SHOWN = g; FLAT = wantFlat(); pending = null; $('#confirm').hidden = true;
  if (FLAT) flatH = clamp(Math.round(0.95 * SQ * VH / (2 * Math.tan(camera.fov * PI / 360) * cam.playDist()) / 2) * 2, 12, 64);
  PIECES.clear(); onSq = new Array(64).fill(null);
  for (let s = 0; s < 64; s++) if (g.pos.b[s]) { const m = makePiece(g.pos.b[s]); m.position.set(sqX(s), 0, sqZ(s)); m.userData.sq = s; PIECES.add(m); onSq[s] = m; }
  const n = { w: 0, b: 0 };
  for (const { m } of g.list) if (m.cap) { const by = C.colour(m.p), t = makePiece(m.cap); t.scale.setScalar(0.8); t.position.set(...trayPos(by, n[by]++)); PIECES.add(t); }
}
// changes the piece set and finish (ids from sets.js; anything unknown becomes Classic) and sets the table again
function setLook(set, fin) {
  S.set = SETS.byId(set).id; S.finish = SETS.finish(fin).id; saveS();
  if (SHOWN && !GLIDE) placeAll(SHOWN);
}
// the flat view switched, or a game begun or left: set the table again if the pieces are the wrong sort
function refit() { $('#bView').textContent = S.flat ? '3D' : '2D'; if (SHOWN && !GLIDE && FLAT !== wantFlat()) { placeAll(SHOWN); showMarks(); } }
// a little picture of a piece (the promotion buttons), drawn pixel by pixel from the set's own shape seen from the
// front, in the finish's colours. fit 0: every kind at the same scale (the king fills the height); 1: this kind
// fills the height; between, the sizes are drawn closer together
function pieceIcon(k, c, W = 24, H = 30, fit = false, set = S.set, fin0 = S.finish) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), geo = SETS.geo(set, k), pos = geo.attributes.position.array, fin = SETS.finish(fin0)[c];
  const tall = x => SETS.geo(set, x).boundingBox.max.y, sc = (H - 2) / lerp(tall('K'), tall(k), +fit), flip = k === 'N' ? -1 : 1;
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
// the Avatar slot's extra heads: x and y are the look's own two colours (a hat, a helmet, a robot's eyes)
Object.assign(SPRITES, {
  beanie: ['..xxxx..', '.xxxxxx.', '..ffff..', '...ff...', ...BODY], shades: ['..hhhh..', '.gggggg.', '..ffff..', '...ff...', ...BODY],
  headset: ['.xhhhhx.', '.xffffx.', '.yffff..', '...ff...', ...BODY], helm: ['..yxxx..', '.xxggxx.', '..xxxx..', '...xx...', ...BODY],
  jester: ['.y.xx.y.', '.xyxxyx.', '..ffff..', '...ff...', ...BODY], robot: ['...yy...', '.xxxxxx.', '.xyxxyx.', '..xggx..', ...BODY],
  wizard: ['...xx...', '..xxxx..', '.xyxxyx.', '..ffff..', ...BODY],
});
const AVATARS = {
  plain: { s: 'man', skin: '#f2c49b', hair: '#5a3420', shirt: '#6cb8ff' }, curly: { s: 'long', skin: '#c98f62', hair: '#2a1a12', shirt: '#ff6f8f' },
  cap: { s: 'cap', skin: '#f2c49b', hair: '#5a3420', shirt: '#7dffb0' }, specs: { s: 'glasses', skin: '#e8b58a', hair: '#b5653a', shirt: '#ffc56b' },
  beard: { s: 'beard', skin: '#d9a070', hair: '#3a2a20', shirt: '#c58cff' }, beanie: { s: 'beanie', skin: '#e8b58a', hair: '#3a2a20', shirt: '#f7ead2', x: '#ff6f8f' },
  shades: { s: 'shades', skin: '#c98f62', hair: '#1a1433', shirt: '#2a2140' }, headset: { s: 'headset', skin: '#f2c49b', hair: '#b5653a', shirt: '#4e3270', x: '#35e0ff', y: '#35e0ff' },
  knight: { s: 'helm', skin: '#f2c49b', hair: '#5a3420', shirt: '#9aa3ad', x: '#c4cbd6', y: '#ff6f8f' }, jester: { s: 'jester', skin: '#f2c49b', hair: '#5a3420', shirt: '#7dffb0', x: '#c58cff', y: '#ffc56b' },
  robot: { s: 'robot', skin: '#c4cbd6', hair: '#c4cbd6', shirt: '#7a8494', x: '#c4cbd6', y: '#35e0ff' }, wizard: { s: 'wizard', skin: '#f2c49b', hair: '#f7ead2', shirt: '#4e3270', x: '#6a3cc0', y: '#ffc56b' },
};
const SPRITE_COL = { h: '#5a3420', f: '#f2c49b', p: '#1a1433', b: '#0d0a1c', g: '#0d0a1c', x: '#c4cbd6', y: '#ffc56b' };
function drawSprite(g, name, x0, y0, shirt, pal) {
  SPRITES[name].forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; g.fillStyle = ch === 's' ? shirt : (pal && pal[ch]) || SPRITE_COL[ch]; g.fillRect(x0 + x, y0 + y, 1, 1); } });
}
function portrait(look, scale) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 10; c.height = 14;
  drawSprite(g, look.s, 1, 1, look.shirt, { f: look.skin, h: look.hair, x: look.x, y: look.y });
  const img = new Image(); img.src = c.toDataURL(); img.className = 'portrait'; img.alt = ''; img.width = 10 * scale; img.height = 14 * scale;
  return img;
}

// ------------------------------------------------------------------ audio
// Retro Rack's little synthesiser: every sound is made from a few tones (blip) and bursts of filtered noise (hiss), so
// there are no sound files. Browsers only allow sound after a tap or a key, so the first one starts it (ensureAudio).
const AU = { ctx: null, noise: null, master: null }, SFX_LOG = [];   // SFX_LOG: the last sounds asked for, for the tests
let sfxCount = 0;
function ensureAudio() {
  if (!S.volume) return;
  if (!AU.ctx) {
    try {
      AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const len = Math.floor(AU.ctx.sampleRate * 0.4), buf = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      AU.noise = buf; AU.master = AU.ctx.createGain(); AU.master.connect(AU.ctx.destination);
    } catch (e) { AU.ctx = null; }
  }
  if (AU.master) AU.master.gain.value = 0.7 * S.volume / 0.75;
  if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume().catch(() => {});
}
function blip(f, dur, vol, type = 'sine', f2 = 0, delay = 0) {
  const c = AU.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + dur + 0.02);
}
function hiss(dur, vol, fc, q, type = 'bandpass', delay = 0) {
  const c = AU.ctx, t = c.currentTime + delay, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = AU.noise; f.type = type; f.frequency.value = fc; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(AU.master); src.start(t, Math.random() * 0.2); src.stop(t + dur + 0.02);
}
// move: a piece set down on wood; capture: a heavier knock and a second piece; castle: two pieces; promo, check, win,
// lose, draw and ui: square-wave notes, as on an old games machine
function sfx(kind) {
  if (!S.volume) return;
  if (kind !== 'tick') { SFX_LOG.push(kind); sfxCount++; if (SFX_LOG.length > 40) SFX_LOG.shift(); }
  if (!AU.ctx) return;
  const tock = (d = 0, f = 210) => { blip(f, 0.07, 0.34, 'sine', f * 0.57, d); hiss(0.03, 0.2, 1900, 1.2, 'bandpass', d); };
  try {
    if (kind === 'move') tock();
    else if (kind === 'capture') { blip(150, 0.11, 0.42, 'sine', 70); hiss(0.05, 0.3, 1300, 1); blip(260, 0.05, 0.16, 'triangle', 150, 0.07); }
    else if (kind === 'castle') { tock(); tock(0.12, 180); }
    else if (kind === 'promo') { tock(); [392, 523, 659].forEach((f, i) => blip(f, 0.09, 0.05, 'square', 0, 0.05 + i * 0.07)); }
    else if (kind === 'check') { blip(880, 0.07, 0.05, 'square', 0, 0.1); blip(660, 0.1, 0.05, 'square', 0, 0.18); }
    else if (kind === 'ui') blip(660, 0.05, 0.045, 'square');
    else if (kind === 'win') [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.14, 0.07, 'square', 0, 0.4 + i * 0.1));
    else if (kind === 'lose') [392, 330, 262, 196].forEach((f, i) => blip(f, 0.18, 0.06, 'square', 0, 0.4 + i * 0.13));
    else if (kind === 'tick') blip(880, 0.018, 0.022, 'square');
    else if (kind.startsWith('prize')) { const tier = +kind.slice(5) || 0; [523, 659, 784, 1046, 1318].slice(0, 2 + tier).forEach((f, i) => blip(f, 0.12 + tier * 0.02, 0.06, 'square', 0, i * 0.09)); }
    else if (kind === 'draw') [440, 440].forEach((f, i) => blip(f, 0.16, 0.06, 'square', 0, 0.4 + i * 0.2));
  } catch (e) {}
}
addEventListener('pointerdown', ensureAudio, true); addEventListener('keydown', ensureAudio, true);
addEventListener('click', e => { if (e.target.closest && e.target.closest('.btn, .card, .botCard, .hTab, .sTab, .iconBtn')) sfx('ui'); }, true);

// ------------------------------------------------------------------ phone and screen comforts
// Vibration: only Android lets web pages vibrate, so its setting only shows on touch screens that offer it.
const canVibrate = 'vibrate' in navigator && matchMedia('(pointer: coarse)').matches;
function buzz(pattern) {
  if (!canVibrate || !S.vibrate) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;   // refused (with a console warning) before the first tap
  try { navigator.vibrate(pattern); } catch (e) {}
}
// Fullscreen: iPhones don't allow it for web pages, so its row only shows where the browser does
const canFull = !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
for (const b of document.querySelectorAll('#sFull .btn')) b.onclick = () => {
  if (!!+b.dataset.v === !!document.fullscreenElement) return;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
};
document.addEventListener('fullscreenchange', () => renderSettings());
// "Turn your phone sideways": only on a phone held upright; it goes when the phone is turned, and OK hides it for good
const portraitPhone = matchMedia('(pointer: coarse) and (orientation: portrait) and (max-width: 600px)');
let rotateOff = false;
try { rotateOff = localStorage.getItem('retroSet.rotateHint') === 'off'; } catch (e) {}
function updateRotateHint() { $('#rotate').hidden = rotateOff || !portraitPhone.matches; }
portraitPhone.addEventListener('change', updateRotateHint);
$('#bRotateOk').onclick = () => { rotateOff = true; try { localStorage.setItem('retroSet.rotateHint', 'off'); } catch (e) {} updateRotateHint(); };
updateRotateHint();

// ------------------------------------------------------------------ game state
// state: 'menu', 'play' (waiting for a move), 'think' (the computer choosing its move), 'anim' (a move gliding into
// place), 'promo' (choosing what a pawn becomes) or 'over'. G is the game (see core.js); sel is the square of the piece
// picked up, targets its legal moves. vs: null for two players on one device, or { bot (its id), me ('w' or 'b') }.
let state = 'menu', G = null, sel = -1, targets = [], promoAt = null, vs = null, botRnd = null;
let pending = null;   // a move chosen but waiting for Confirm (S.confirm): { from, to, promo }
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
  vs = opp || null; THINK = null; EARN = null;
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
  animate(glide, () => { G = n; placeAll(G); landed(m); afterMove(); });
  return true;
}
// a move arriving: its sound, and on a phone a buzz for a capture and for check
function landed(m) {
  const check = !G.result && C.inCheck(G.pos);
  sfx(m.cap ? 'capture' : m.castle ? 'castle' : m.promo ? 'promo' : 'move');
  if (check) sfx('check');
  if (check) buzz([30, 50, 30]); else if (m.cap) buzz(25);
  if (m.cap) fx('cap', m.ep ? m.to + (C.colour(m.p) === 'w' ? -8 : 8) : m.to);
  if (check) fx('check', G.pos.b.indexOf(G.pos.turn === 'w' ? 'K' : 'k'));
  if (G.result && G.result.why === 'checkmate') fx('mate');
}
// With Confirm moves on, a move chosen waits (pending, its squares marked) for the Confirm button; a tap anywhere
// else drops it. Only your own moves: the computer's and the other player's go straight to tryMove().
function choose(want) {
  if (!S.confirm) { tryMove(want); return; }
  const n = C.play(G, want); if (!n) return;
  pending = want; sel = -1; targets = [];
  $('#confirmTxt').textContent = `Play ${n.list[n.list.length - 1].san}?`; $('#confirm').hidden = false; showMarks();
}
function dropPending() { if (!pending) return; pending = null; $('#confirm').hidden = true; showMarks(); }
$('#bConfirm').onclick = () => {
  const p = pending; if (!p) return;
  dropPending();
  if (state !== 'play' || !mine(p.from)) return;
  if (NET.on && (!NET.peer || NET.link !== 'online')) { toast(`Waiting for ${NET.peerName} to reconnect`); return; }
  tryMove(p);
};
$('#bCancelMove').onclick = dropPending;
function afterMove() {
  state = G.result ? 'over' : 'play';
  if (S.turn && !vs && !NET.on && state === 'play') cam.base = G.pos.turn === 'w' ? 0 : PI;
  gamePaid(); save(); hud(); showMarks();
  if (G.result) { const me = meCol(), won = G.result.score === '1-0' ? 'w' : G.result.score === '0-1' ? 'b' : ''; sfx(!won ? 'draw' : me && won !== me ? 'lose' : 'win'); }
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
    b.onclick = () => { const p = promoAt; $('#promo').hidden = true; state = 'play'; promoAt = null; choose({ ...p, promo: k }); };
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
    it.obj.position.set(lerp(it.from.x, it.to[0], e), lerp(it.from.y, it.to[1], e) + (FLAT ? 0 : Math.sin(PI * k) * it.hop), lerp(it.from.z, it.to[2], e));
    if (it.shrink) it.obj.scale.setScalar(lerp(1, it.shrink, e));
  }
  if (GLIDE.t >= GLIDE.end) { const then = GLIDE.then; GLIDE = null; then(); }
}

// ------------------------------------------------------------------ effects
// The Effects slot (W.fx): what happens over the board on a capture, a check and a checkmate. Little flat-coloured
// bits, each with a speed, a weight and a life, or a path of its own (fn). Only on your own screen, and never with
// reduced motion.
const FXG = new THREE.Group(); scene.add(FXG);
let BITS = [], LATER = [];   // the bits in the air, and bursts still to come ([seconds from now, what to do])
const bitGeo = new THREE.BoxGeometry(1, 1, 1), discGeo = new THREE.CircleGeometry(1, 16), hoopGeo = new THREE.RingGeometry(0.82, 1, 24), BIT_MAT = {};
const bitMat = c => BIT_MAT[c] || (BIT_MAT[c] = new THREE.MeshBasicMaterial({ color: c }));
function bit(geo, col, x, y, z, o) { const m = new THREE.Mesh(geo, o.fade ? new THREE.MeshBasicMaterial({ color: col, transparent: true, depthWrite: false }) : bitMat(col)); m.position.set(x, y, z); m.scale.setScalar(o.size); FXG.add(m); BITS.push({ m, v: [0, 0, 0], g: 0, life: 0.6, age: 0, spin: 0, ...o }); return m; }
// n bits thrown outwards and upwards from a square
function burst(at, n, cols, o) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 2 * PI, sp = o.speed * (0.4 + Math.random() * 0.6); bit(bitGeo, cols[i % cols.length], at[0], at[1] + 0.02, at[2], { ...o, size: o.size * (0.7 + Math.random() * 0.6), life: o.life * (0.7 + Math.random() * 0.5), v: [Math.cos(a) * sp, o.up * (0.5 + Math.random() * 0.5), Math.sin(a) * sp] }); }
}
const CONF = ['#ff6f8f', '#ffc56b', '#6cb8ff', '#7dffb0', '#c58cff'], FIRE = ['#ff6f8f', '#ffc56b', '#6cb8ff', '#fff4d0'];
const hoop = (at, col) => { bit(hoopGeo, col, at[0], 0.004, at[2], { size: 0.01, grow: 0.085, life: 0.5, fade: true }).rotation.x = -PI / 2; };
function bolt(at, col) {   // a jagged line down to the square, then a flash of sparks
  let x = at[0], z = at[2];
  for (let i = 0; i < 6; i++) { const nx = at[0] + (i < 5 ? (Math.random() - 0.5) * 0.03 : 0), nz = at[2] + (i < 5 ? (Math.random() - 0.5) * 0.03 : 0), m = bit(bitGeo, col, (x + nx) / 2, 0.33 - i * 0.055, (z + nz) / 2, { size: 1, life: 0.22, keep: true }); m.scale.set(0.006, 0.062, 0.006); m.rotation.z = (nx - x) / 0.055; m.rotation.x = -(nz - z) / 0.055; x = nx; z = nz; }
  burst(at, 8, [col, '#ffffff'], { speed: 0.3, up: 0.25, g: 1.4, life: 0.35, size: 0.006 });
}
function hole(at) {   // a dark disc that opens and closes, and bits spiralling into it
  bit(discGeo, '#0d0a1c', at[0], 0.005, at[2], { size: 0.001, life: 0.9, fn: (b, k) => b.m.scale.setScalar(0.03 * Math.sin(PI * k)) }).rotation.x = -PI / 2;
  for (let i = 0; i < 16; i++) { const a0 = i / 16 * 2 * PI, r0 = 0.05 + Math.random() * 0.02; bit(bitGeo, i % 2 ? '#c58cff' : '#6cb8ff', at[0], 0.02, at[2], { size: 0.006, life: 0.9, fn: (b, k) => { const r = r0 * (1 - k), a = a0 + k * 7; b.m.position.set(at[0] + Math.cos(a) * r, 0.012 + 0.03 * (1 - k), at[2] + Math.sin(a) * r); b.m.scale.setScalar(0.006 * (1 - k * 0.7)); } }); }
}
const above = () => [(Math.random() - 0.5) * 0.4, 0.16 + Math.random() * 0.14, (Math.random() - 0.5) * 0.4];
const FX_LOOKS = {
  dust: { cap: at => burst(at, 9, ['#cfc6b8', '#a89f92'], { speed: 0.1, up: 0.16, g: 0.12, life: 0.6, size: 0.011 }) },
  sparks: { cap: at => burst(at, 18, ['#ffe08a', '#ffb347', '#fff4d0'], { speed: 0.4, up: 0.5, g: 1.7, life: 0.5, size: 0.006 }) },
  confetti: { cap: at => burst(at, 16, CONF, { speed: 0.26, up: 0.6, g: 1, life: 1, size: 0.008, spin: 9 }),
    mate: () => { for (let i = 0; i < 6; i++) LATER.push([i * 0.22, () => burst(above(), 22, CONF, { speed: 0.3, up: 0.3, g: 0.8, life: 1.4, size: 0.009, spin: 9 })]); } },
  shockwave: { cap: at => hoop(at, '#6cb8ff'), check: at => { hoop(at, '#ff6f8f'); LATER.push([0.18, () => hoop(at, '#ff6f8f')]); } },
  lightning: { cap: at => bolt(at, '#cfe8ff'), check: at => bolt(at, '#ffb0c0') },
  fireworks: { cap: at => burst([at[0], 0.09, at[2]], 20, FIRE, { speed: 0.3, up: 0.22, g: 0.5, life: 0.7, size: 0.006 }),
    mate: () => { for (let i = 0; i < 7; i++) LATER.push([i * 0.3, () => burst(above(), 26, [FIRE[i % 4], '#ffffff'], { speed: 0.42, up: 0.18, g: 0.45, life: 0.9, size: 0.007 })]); } },
  blackhole: { cap: hole },
};
// what: 'cap' (a capture), 'check' or 'mate'; s: the square it happens on
function fx(what, s) {
  const f = (FX_LOOKS[W.fx] || {})[what];
  if (f && !reduceMotion) f(s === undefined ? null : [sqX(s), 0, sqZ(s)]);
}
function fxTick(dt) {
  if (LATER.length) { for (const l of LATER) l[0] -= dt; const due = LATER.filter(l => l[0] <= 0); LATER = LATER.filter(l => l[0] > 0); for (const l of due) l[1](); }
  if (!BITS.length) return;
  for (const b of BITS) {
    b.age += dt; const k = Math.min(1, b.age / b.life);
    if (b.fn) { b.fn(b, k); continue; }
    b.v[1] -= b.g * dt; b.m.position.x += b.v[0] * dt; b.m.position.y = Math.max(0.003, b.m.position.y + b.v[1] * dt); b.m.position.z += b.v[2] * dt;
    if (b.spin) { b.m.rotation.x += b.spin * dt; b.m.rotation.z += b.spin * 0.7 * dt; }
    if (b.grow) b.m.scale.setScalar(b.size + b.grow * k); else if (!b.keep) b.m.scale.setScalar(b.size * (1 - k * k));
    if (b.fade) b.m.material.opacity = 1 - k;
  }
  for (const b of BITS) if (b.age >= b.life) { FXG.remove(b.m); if (b.fade) b.m.material.dispose(); }
  BITS = BITS.filter(b => b.age < b.life);
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
  dropPending();
  const mv = targets.filter(m => m.to === s);
  if (sel >= 0 && mv.length) {
    if (NET.on && (!NET.peer || NET.link !== 'online')) { toast(`Waiting for ${NET.peerName} to reconnect`); clearSel(); return; }   // the move would go nowhere
    if (mv[0].promo && !S.autoQueen) askPromo(sel, s); else choose({ from: sel, to: s, promo: mv[0].promo ? 'q' : undefined });
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
  if (own) dropPending();
  drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false, s, own, was: sel === s };
  if (own && !drag.was) select(s);
});
canvas.addEventListener('pointermove', e => {
  if (!PTR.has(e.pointerId)) return;
  PTR.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && PTR.size === 2) { const [a, b] = [...PTR.values()]; cam.zoom = clamp(pinch.zoom * pinch.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), 0.6, 2.2); return; }
  if (!drag) return;
  if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) drag.moved = true;
  if (drag.moved && !drag.own && !FLAT) {   // turning the view (not the flat view, which stays square on)
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
  if (e.key === 'Escape' && TR.on) { if (TR.count) trBackOut(); else leaveTrade(); return; }
  if (e.key === 'Escape' && OPENING) { if (OPENING.stage === 'spin') showPrize(); else closeOpen(); return; }
  if (e.key === 'Escape' && state === 'menu' && screen === 'cos' && COS.page === 'slot') { cosPage('locker'); return; }
  if (e.key === 'Escape' && state === 'menu' && screen !== 'home') { $('#mBack').click(); return; }
  if (e.key === 'Escape' && state === 'lobby') { clearRejoin(); toMenu('online'); return; }
  if (e.key !== 'Escape' || state === 'menu') return;
  if (pending) dropPending();
  else if (!$('#chatPop').hidden) $('#chatPop').hidden = true;
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
  // the space the menu leaves free: below the top bar, beside the panel (or below it on an upright phone), above the
  // Play screen's tiles; the picture is centred in it, and drawn smaller if it's much less than the whole screen
  shift() {
    let l = 0, t = $('#topBar').getBoundingClientRect().bottom, b = innerHeight;
    const p = $('#menuPanel').getBoundingClientRect(), h = $('#sc-home').getBoundingClientRect();
    if (p.width) { if (innerWidth <= 560) t = Math.max(t, p.bottom); else l = p.right; }
    if (h.height) b = Math.max(t + 40, h.top + 30);
    const fit = clamp(Math.min(innerWidth / Math.max(80, innerWidth - l), innerHeight / Math.max(80, b - t)), 1, 1.9);
    return [clamp((l + innerWidth) / 2 / innerWidth - 0.5, 0, 0.3), clamp((t + b) / 2 / innerHeight - 0.5, -0.1, 0.35), fit];
  },
  goal() {
    if (this.mode === 'menu') { const [offX, offY, fit] = this.shift(); return { yaw: this.a, pitch: 0.53, dist: 1.22 * Math.max(1, 0.9 / camera.aspect) * fit, offX, offY, ty: -0.02 }; }
    const short = innerHeight < 500;   // a phone on its side: more room for the bar along the top and the buttons
    return { yaw: this.base + (FLAT ? 0 : this.yawOff), pitch: FLAT ? 1.54 : this.pitch, dist: this.playDist(), offX: 0, offY: short ? 0.03 : 0.02, ty: 0.01 };
  },
  playDist() {   // how far back the view sits in a game: far enough for the board to fit, times the zoom
    const v = Math.tan(camera.fov * PI / 360), h = v * camera.aspect;
    return Math.max(0.34 / h, (innerHeight < 500 ? 0.37 : 0.3) / v) * this.zoom;
  },
  update(dt) {
    if (this.mode === 'menu' && !reduceMotion) this.a += dt * 0.08;
    const g = this.goal(), c = this.cur, k = reduceMotion ? 1 : 1 - Math.exp(-dt * 5);
    c.yaw += wrapA(g.yaw - c.yaw) * (FLAT ? 1 : k);   // the flat view flips at once: its pictures must never be seen at an angle
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
    pl.querySelector('.plName').textContent = !me ? turnName(c) : c === me ? 'You' : NET.on ? NET.peerName : `${bot.name} ${BT.rated(bot.rating)}`;
    const face = pl.querySelector('.plFace'); face.textContent = '';
    if (its) face.append(portrait(bot.look, 2)); else if (me && c === me) face.append(portrait(AVATARS[W.avatar] || AVATARS.plain, 2));   // the computer's face, and yours
    else if (NET.on && me && NET.peerLook) face.append(portrait(AVATARS[NET.peerLook.avatar] || AVATARS.plain, 2));   // and online, the other player's
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
  const win = !winner ? 'Draw' : me && winner === me ? 'You win' : `${who(winner)} wins`;
  return {
    checkmate: ['Checkmate', win], stalemate: ['Stalemate', 'Draw: no legal moves'],
    repetition: ['Draw', 'Threefold repetition'], fifty: ['Draw', 'Fifty-move rule'],
    material: ['Draw', 'Insufficient material'], agreed: ['Draw', 'By agreement'],
    resigned: [me && loser === me ? 'You resign' : `${who(loser)} resigns`, win],
  }[r.why] || ['Game over', win];
}
function showOver() {
  const [title, why] = resultText(G.result);
  $('#overTitle').textContent = title; $('#overWhy').textContent = why;
  { const n = Math.ceil(G.list.length / 2); $('#overMoves').textContent = `${n} move${n === 1 ? '' : 's'}`; }
  $('#overEarn').textContent = earnText(EARN); $('#overEarn').hidden = !earnText(EARN);
  $('#pause').hidden = true; $('#over').hidden = false; updateAgainBtn();
}
function closePanels() { for (const s of ['#pause', '#promo', '#over', '#offer', '#chatPop']) $(s).hidden = true; promoAt = null; disarm(); }
function togglePause(open = $('#pause').hidden) {
  if (open && state === 'over') { showOver(); return; }
  if (open && state === 'promo') cancelPromo();
  $('#pause').hidden = !open;
  if (open) {
    disarm();
    $('#bResign').textContent = meCol() ? 'Resign' : `${turnName(G.pos.turn)} Resigns`;
    $('#bDraw').textContent = meCol() ? 'Offer Draw' : 'Agree Draw';
    showSettings($('#setGame'), true);
  }
}
// ------------------------------------------------------------------ settings panel
// One box of tabs and pages (#setBox) serves both the menu's Settings tab and the game's Menu panel, where a Match tab
// comes first; showSettings() moves it into whichever is open. Each setting is a row of buttons (.seg[data-key], a
// button's data-v the value it sets), so a new setting is a row in shell.html, a default, and a line in applySetting().
const SET = { tab: 'game', inGame: false };
function settingsTab(name) {
  if (name === 'match' && !SET.inGame) name = 'game';
  SET.tab = name;
  for (const t of document.querySelectorAll('.sTab')) { const on = t.dataset.tab === name; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; }
  for (const pg of document.querySelectorAll('.sPage')) pg.classList.toggle('off', pg.dataset.tab !== name);
}
function showSettings(host, inGame) {
  const box = $('#setBox'); host.append(box); box.hidden = false; box.classList.toggle('inGame', inGame); SET.inGame = inGame;
  settingsTab(inGame ? 'match' : SET.tab); renderSettings();
}
function renderSettings() {
  for (const seg of document.querySelectorAll('#setBox .seg[data-key]')) for (const b of seg.children) b.setAttribute('aria-pressed', String(Number(b.dataset.v) === Number(S[seg.dataset.key])));
  for (const e of document.querySelectorAll('#setBox .onlyLocal')) e.hidden = SET.inGame && !!meCol();   // turning the board is for a shared device
  $('#rowVibrate').hidden = !canVibrate; $('#rowFull').hidden = !canFull;
  for (const b of document.querySelectorAll('#sFull .btn')) b.setAttribute('aria-pressed', String(!!+b.dataset.v === !!document.fullscreenElement));
}
function applySetting(k) {
  if (k === 'pixel') resize();
  else if (k === 'levels' || k === 'dither' || k === 'outline') applyLook();
  else if (k === 'coords') applyBoard();
  else if (k === 'flat') refit();
  else if (k === 'mySet') { if (SHOWN && !GLIDE) placeAll(SHOWN); }
  else if (k === 'turn') { if (S.turn && G && !vs && !NET.on && state !== 'menu') cam.base = G.pos.turn === 'w' ? 0 : PI; }
  else if (k === 'volume') { ensureAudio(); sfx('move'); }
  else if (k === 'confirm' && !S.confirm) dropPending();
  showMarks();
}
for (const seg of document.querySelectorAll('#setBox .seg[data-key]')) for (const b of seg.children) b.onclick = () => {
  const k = seg.dataset.key, v = Number(b.dataset.v);
  S[k] = typeof DEFAULTS[k] === 'boolean' ? !!v : v; saveS(); applySetting(k); renderSettings();
};
for (const t of document.querySelectorAll('.sTab')) t.onclick = () => settingsTab(t.dataset.tab);
// left and right step through the settings' tabs while they show
addEventListener('keydown', e => {
  if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || /^(INPUT|TEXTAREA)$/.test(e.target.tagName) || !$('#setBox').offsetParent) return;
  const tabs = [...document.querySelectorAll('.sTab')].filter(t => t.offsetParent), i = tabs.findIndex(t => t.dataset.tab === SET.tab);
  settingsTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].dataset.tab);
});
$('#bView').onclick = () => { S.flat = !S.flat; saveS(); refit(); };

// ------------------------------------------------------------------ locker
// The Cosmetics tab: the locker (what's worn in each of the seven slots, and the cases and keys in hand), one slot's
// looks (tap one to see it on the board, Equip to wear it), the shop (cases and keys for coins) and opening a case.
// The rules are in looks.js (LK); the locker itself is LOCK, saved in localStorage (retroSet.locker). Every change goes
// through lockerEdit(), which reads the saved copy, changes it and writes it straight back, so two open pages don't
// undo each other's changes.
const LK = LOOKS;
// Dev mode, for the owner to try every look: typing the dev word as the name on the Online screen switches it on or
// off. Only a fingerprint of the word is here (the repository is public); it is Retro Rack's, so the same word works
// in both games. While it's on the locker is a separate test locker with everything.
const DEVW = { print: 'f5fbd99c8a9a458d2267847deb9aab64fd2f699c0746cea014e74f8cc48e6ee5' };
let DEV = false;
try { DEV = localStorage.getItem('retroSet.dev') === '1'; } catch (e) {}
const lockKey = () => DEV ? 'retroSet.lockerDev' : 'retroSet.locker';
function readLocker() {
  try { const raw = localStorage.getItem(lockKey()); if (raw) return LK.validate(JSON.parse(raw)); } catch (e) {}
  return DEV ? LK.full() : LK.fresh();
}
let LOCK = readLocker();
function lockerEdit(fn) { const l = readLocker(), out = fn(l); LOCK = l; try { localStorage.setItem(lockKey(), JSON.stringify(l)); } catch (e) {} showCoins(); return out; }
function showCoins() { $('#coins').textContent = LOCK.coins.toLocaleString('en-GB') + (DEV ? ' (test)' : ''); }
async function isDevWord(v) {
  if (!v || v.length > 40 || !(window.crypto && crypto.subtle)) return false;
  try { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('retroRack:' + v.trim().toLowerCase())); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('') === DEVW.print; }
  catch (e) { return false; }
}
function setDev(on) {
  DEV = !!on; try { if (DEV) localStorage.setItem('retroSet.dev', '1'); else { localStorage.removeItem('retroSet.dev'); localStorage.removeItem('retroSet.lockerDev'); } } catch (e) {}
  LOCK = readLocker(); PRE = null; dress(); showCoins(); $('#ver').textContent = `Version ${BUILD}${DEV ? ' DEV' : ''}`; if (screen === 'cos') renderCos();
}
$('#netName').addEventListener('input', async () => { const v = $('#netName').value; if (!(await isDevWord(v)) || $('#netName').value !== v) return; $('#netName').value = ''; setDev(!DEV); menuNote(DEV ? 'Developer mode enabled: test locker active.' : 'Developer mode disabled: your locker is restored.'); });
// PRE: a look being tried on in the locker ({ slot, id }), shown on the board but not worn. dress() puts on what the
// locker says is worn, with the look being tried in its place.
let PRE = null;
function dress() {
  const w = { ...LOCK.wear }; if (PRE) w[PRE.slot] = PRE.id;
  Object.assign(W, { board: w.board, room: w.room, fx: w.fx, avatar: w.avatar, marks: w.marks });
  if (S.set !== w.set || S.finish !== w.finish) setLook(w.set, w.finish);
  applyBoard(); applyRoom(); applyMarks(); showMarks();
}
// the marks as they'd look in a game, for trying a Square marks look on behind the menu
function sampleMarks() {
  const tint = MK.shape === 'corners' ? cornerGeo : squareGeo, mat = MK.shape === 'corners' ? MM.edge : null;
  if (MK.shape === 'arrow') arrow(12, 28); else { mark(tint, mat || MM.last, 12, 0.0008); mark(tint, mat || MM.last, 28, 0.0008); }
  mark(squareGeo, MM.check, 60, 0.001); mark(tint, mat || MM.sel, 6, 0.0012);
  for (const s of [21, 23]) mark(DOTS[MK.dot || 'dot'], MM.go, s, 0.0014);
}
// ---- pictures: every look, case and key as a small pixel picture
const RARE_COL = r => LK.RARITY[r].colour;
const FX_ICON = {   // 9 × 9, the letters a look's own colours
  none: [['#6b6480'], ['.........', '..aaaaa..', '.a....aa.', '.a...a.a.', '.a..a..a.', '.a.a...a.', '.aa....a.', '..aaaaa..', '.........']],
  dust: [['#cfc6b8', '#a89f92'], ['.........', '..aa.....', '.aaaa.bb.', '.aaaa.bbb', '..aa..bb.', '....aa...', '...aaaa..', '....aa...', '.........']],
  sparks: [['#ffe08a', '#ffb347'], ['a...b...a', '.a..b..a.', '..a.b.a..', '.........', 'bbb.a.bbb', '.........', '..a.b.a..', '.a..b..a.', 'a...b...a']],
  confetti: [['#ff6f8f', '#6cb8ff', '#7dffb0', '#ffc56b'], ['a...c....', '..b...d..', '.....a...', '.d.....c.', '...b.....', 'c.....a..', '..a..d...', '.....b..c', '.d.......']],
  shockwave: [['#6cb8ff', '#ff6f8f'], ['..aaaaa..', '.a.....a.', 'a..bbb..a', 'a.b...b.a', 'a.b...b.a', 'a.b...b.a', 'a..bbb..a', '.a.....a.', '..aaaaa..']],
  lightning: [['#cfe8ff', '#ffe08a'], ['.....aa..', '....aa...', '...aa....', '..aaaaa..', '....aa...', '...aa....', '..aa..b..', '.aa..b.b.', '.a....b..']],
  fireworks: [['#ff6f8f', '#ffc56b', '#6cb8ff'], ['..a...c..', '.a.a.c.c.', '..a...c..', '....b....', '...b.b...', '.b.....b.', '...b.b...', '....b....', '....b....']],
  blackhole: [['#c58cff', '#0d0a1c', '#6cb8ff'], ['..a...c..', '.a.aaa...', '..abbba.c', '.abbbbba.', '.abbbbba.', 'cabbbbba.', '..abbba..', '...aaa.a.', '.c....a..']],
};
const CASE_COL = { bronze: '#b5713a', silver: '#c4cbd6', gold: '#ffc56b', diamond: '#8fe6ff', lucky: '#ff6f8f' };
const KEY_COL = { any: '#ffc56b', set: '#f7ead2', finish: '#c58cff', board: '#7dffb0', room: '#6cb8ff', fx: '#ff6f8f', avatar: '#ffb347', marks: '#b9c2cf' };
const CASE_ROWS = ['................', '................', '..xxxxxxxxxxxx..', '.xxyyyyyyyyyyxx.', '.xyyyyyyyyyyyyx.', '.xyyyyyyyyyyyyx.', '.xxxxxxddxxxxxx.', '.xyyyyyddyyyyyx.', '.xyyyyyyyyyyyyx.', '.xyyyyyyyyyyyyx.', '.xyyyyyyyyyyyyx.', '.xxxxxxxxxxxxxx.', '................'];
const KEY_ROWS = ['................', '..xxxx..........', '.xx..xx.........', '.x....xxxxxxxxx.', '.x....xxxxxxxxx.', '.xx..xx....x.x..', '..xxxx.....x.x..', '................'];
function rowsPic(rows, cols, w = rows[0].length, h = rows.length) {
  const cv = document.createElement('canvas'), g = cv.getContext('2d'); cv.width = w; cv.height = h;
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (cols[r[x]]) { g.fillStyle = cols[r[x]]; g.fillRect(x, y, 1, 1); } });
  return cv;
}
const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
const casePic = g => rowsPic(CASE_ROWS, { x: shade(CASE_COL[g], 0.55), y: CASE_COL[g], d: g === 'lucky' ? '#fff4d0' : '#0d0a1c' });
const keyPic = k => rowsPic(KEY_ROWS, { x: KEY_COL[k] });
function lookPic(it) {
  const cv = document.createElement('canvas'), g = cv.getContext('2d'); cv.width = 32; cv.height = 30; g.imageSmoothingEnabled = false;
  if (it.slot === 'set') g.drawImage(pieceIcon('N', 'w', 24, 30, 1, it.id, 'classic'), 4, 0);
  else if (it.slot === 'finish') { g.drawImage(pieceIcon('P', 'w', 20, 28, 1, 'classic', it.id), 0, 1); g.drawImage(pieceIcon('P', 'b', 20, 28, 1, 'classic', it.id), 12, 1); }
  else if (it.slot === 'board') {
    const b = BOARDS[it.id]; g.fillStyle = b.f; g.fillRect(2, 1, 28, 28);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) & 1 ? b.d : b.l; g.fillRect(4 + x * 6, 3 + y * 6, 6, 6); if (b.glow) { g.fillStyle = b.glow; if (b.tex === 'grid') { g.fillRect(4 + x * 6, 3 + y * 6, 6, 1); g.fillRect(4 + x * 6, 3 + y * 6, 1, 6); } else g.fillRect(5 + x * 6 + (x * 3 + y) % 4, 4 + y * 6 + (y * 2 + x) % 4, 1, 1); } }
  } else if (it.slot === 'room') {
    const r = ROOMS[it.id]; g.fillStyle = r.bg; g.fillRect(0, 0, 32, 30);
    if (r.floor === null) { g.fillStyle = '#e8ecff'; for (const [x, y] of [[3, 4], [9, 22], [15, 3], [22, 8], [27, 24], [6, 13], [29, 15], [19, 26]]) g.fillRect(x, y, 1, 1); }
    else { g.fillStyle = r.tiles ? r.tiles[0] : r.floor; g.fillRect(0, 17, 32, 13); if (r.tiles) { g.fillStyle = r.tiles[2] || r.tiles[1]; for (let x = 0; x < 32; x += 8) g.fillRect(x, 17, r.tiles[2] ? 1 : 4, 13); } }
    g.fillStyle = r.leg || r.table; if (r.floor !== null) g.fillRect(14, 16, 4, 10);
    g.fillStyle = r.table; g.fillRect(8, 11, 16, 1); g.fillRect(5, 12, 22, 3); g.fillRect(8, 15, 16, 1);
  } else if (it.slot === 'fx') { const [cols, rows] = FX_ICON[it.id] || FX_ICON.none; g.drawImage(rowsPic(rows, { a: cols[0], b: cols[1], c: cols[2], d: cols[3] }), 3, 2, 27, 27); }
  else if (it.slot === 'avatar') { const a = AVATARS[it.id] || AVATARS.plain, c = document.createElement('canvas'); c.width = 10; c.height = 14; drawSprite(c.getContext('2d'), a.s, 1, 1, a.shirt, { f: a.skin, h: a.hair, x: a.x, y: a.y }); g.drawImage(c, 6, 1, 20, 28); }
  else {
    const m = MARK_LOOKS[it.id] || MARK_LOOKS.standard;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { g.fillStyle = (x + y) & 1 ? '#5a3b78' : '#c4a67c'; g.fillRect(4 + x * 8, 3 + y * 8, 8, 8); }
    g.fillStyle = m.last;
    if (m.shape === 'arrow') { g.fillRect(7, 22, 2, 2); g.fillRect(9, 20, 2, 2); g.fillRect(11, 18, 2, 2); g.fillRect(13, 14, 4, 4); g.fillRect(15, 12, 4, 2); g.fillRect(17, 14, 2, 4); }
    else if (m.shape === 'corners') for (const [x, y] of [[4, 19], [12, 11]]) { g.fillRect(x, y, 3, 1); g.fillRect(x, y, 1, 3); g.fillRect(x + 5, y + 7, 3, 1); g.fillRect(x + 7, y + 5, 1, 3); g.fillRect(x + 5, y, 3, 1); g.fillRect(x + 7, y, 1, 3); g.fillRect(x, y + 7, 3, 1); g.fillRect(x, y + 5, 1, 3); }
    else { g.globalAlpha = 0.6; g.fillRect(4, 19, 8, 8); g.fillRect(12, 11, 8, 8); g.globalAlpha = 1; }
    g.fillStyle = m.go; if (m.dot === 'star') { g.fillRect(23, 5, 2, 4); g.fillRect(22, 6, 4, 2); } else if (m.dot === 'diamond') { g.fillRect(23, 5, 2, 4); g.fillRect(22, 6, 4, 2); g.fillRect(23, 6, 2, 2); } else g.fillRect(22, 5, 4, 4);
  }
  return cv;
}
// ---- the screens
const COS = { page: 'locker', slot: 'set', sel: '', shop: 'case:bronze' };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
function tile(pic, name, opts = {}) {
  const b = el('button', 'tile' + (opts.worn ? ' worn' : '')); b.type = 'button';
  if (opts.slot) b.append(el('span', 'tSlot', opts.slot));
  b.append(pic); const n = el('span', 'tName', name); if (opts.colour) n.style.color = opts.colour; b.append(n);
  if (opts.num) b.append(el('span', 'tNum', opts.num));
  if (opts.pressed !== undefined) b.setAttribute('aria-pressed', String(opts.pressed));
  if (opts.data) Object.assign(b.dataset, opts.data);
  return b;
}
const wornKey = slot => LK.key(slot, LOCK.wear[slot]);
function cosPage(page) { if (COS.page === 'slot' && page !== 'slot' && PRE) { PRE = null; dress(); } COS.page = page; renderCos(); updateLobbyWatch(); }
function renderCos() {
  showCoins();
  for (const [id, page] of [['#cLocker', 'locker'], ['#cSlot', 'slot'], ['#cShop', 'shop'], ['#cTrade', 'trade']]) $(id).hidden = COS.page !== page;
  navTabs();
  if (COS.page === 'locker') {
    const all = LK.progress(LOCK); $('#lockTotal').textContent = `Collection ${all.have}/${all.of}`;
    const grid = $('#slotGrid'); grid.textContent = '';
    for (const s of LK.SLOTS) { const it = LK.ALL[wornKey(s.id)], p = LK.progress(LOCK, s.id), b = tile(lookPic(it), it.name, { slot: s.name, colour: RARE_COL(it.rarity), num: `${p.have}/${p.of}`, data: { slot: s.id } }); b.onclick = () => { COS.slot = s.id; COS.sel = wornKey(s.id); cosPage('slot'); }; grid.append(b); }
    const held = $('#held'); held.textContent = '';
    for (const g of LK.GRADE_IDS) if (LOCK.cases[g]) { const c = el('button', 'chip2'); c.type = 'button'; c.dataset.grade = g; c.append(casePic(g), `${LK.GRADES[g].name} ×${LOCK.cases[g]}`); c.onclick = () => openCase(g); held.append(c); }
    for (const k of LK.KEY_IDS) if (LOCK.keys[k]) { const c = el('span', 'chip2'); c.dataset.key = k; c.append(keyPic(k), `${LK.KEYS[k].name} ×${LOCK.keys[k]}`); held.append(c); }
    if (!held.children.length) held.append(el('span', 'note', 'No cases or keys. Cases are earned against the computer; keys are sold in the Store.'));
  } else if (COS.page === 'trade') renderTradePage();
  else if (COS.page === 'slot') {
    const s = LK.SLOTS.find(x => x.id === COS.slot), p = LK.progress(LOCK, s.id), grid = $('#itemGrid'); grid.textContent = '';
    $('#slotTitle').textContent = `${s.name} · ${p.have}/${p.of}`;
    for (const it of LK.slotItems(s.id)) if (LK.owns(LOCK, it.key)) {
      const n = LK.count(LOCK, it.key), b = tile(lookPic(it), it.name, { colour: RARE_COL(it.rarity), worn: it.key === wornKey(s.id), pressed: it.key === COS.sel, num: n > 1 ? '×' + n : '', data: { item: it.key } });
      b.onclick = () => { COS.sel = it.key; PRE = { slot: it.slot, id: it.id }; dress(); if (it.slot === 'fx') { fx('cap', 28); LATER.push([0.9, () => fx('check', 60)], [1.8, () => fx('mate')]); } renderCos(); };
      grid.append(b);
    }
    const it = LK.ALL[COS.sel] || LK.ALL[wornKey(s.id)], worn = it.key === wornKey(s.id);
    $('#itemInfo').textContent = `${it.name} · ${LK.RARITY[it.rarity].name}${it.free ? ' · Default' : ''}`; $('#itemInfo').style.color = RARE_COL(it.rarity);
    $('#bEquip').textContent = worn ? 'Equipped' : 'Equip'; $('#bEquip').disabled = worn;
  } else {
    const cases = $('#shopCases'), keys = $('#shopKeys'); cases.textContent = ''; keys.textContent = '';
    for (const g of LK.GRADE_IDS) { const b = tile(casePic(g), `${LK.GRADES[g].price}`, { slot: g === 'lucky' ? 'Lucky Box' : LK.GRADES[g].name.replace(' Case', ''), pressed: COS.shop === 'case:' + g, num: LOCK.cases[g] ? '×' + LOCK.cases[g] : '', data: { buy: 'case:' + g } }); b.onclick = () => { COS.shop = 'case:' + g; renderCos(); }; cases.append(b); }
    for (const k of LK.KEY_IDS) { const b = tile(keyPic(k), `${LK.KEYS[k].price}`, { slot: k === 'any' ? 'Standard' : LK.KEYS[k].name.replace(' Key', '').replace('Square marks', 'Marks'), pressed: COS.shop === 'key:' + k, num: LOCK.keys[k] ? '×' + LOCK.keys[k] : '', data: { buy: 'key:' + k } }); b.onclick = () => { COS.shop = 'key:' + k; renderCos(); }; keys.append(b); }
    const [kind, id] = COS.shop.split(':'), price = kind === 'case' ? LK.GRADES[id].price : LK.KEYS[id].price;
    $('#shopInfo').textContent = kind === 'case'
      ? `${LK.GRADES[id].name}: ${LK.GRADES[id].odds.map((o, i) => o ? `${o}% ${LK.RARITIES[i]}` : '').filter(Boolean).join(', ')}.${LK.GRADES[id].fresh ? ' No duplicates.' : ''}`
      : `${LK.KEYS[id].name}: opens any case. ${id === 'any' ? 'Item from any category.' : `Item guaranteed from ${LK.SLOTS.find(s => s.id === id).name}.`}`;
    $('#bBuy').textContent = LOCK.coins >= price ? `Buy · ${price}` : 'Not Enough Coins'; $('#bBuy').disabled = LOCK.coins < price;
  }
}
$('#bSlotBack').onclick = () => cosPage('locker');
$('#bEquip').onclick = () => { const k = COS.sel; if (!LK.ALL[k] || !lockerEdit(l => LK.wear(l, k))) return; PRE = null; dress(); renderCos(); };
$('#bBuy').onclick = () => { const [kind, id] = COS.shop.split(':'); lockerEdit(l => kind === 'case' ? LK.buyCase(l, id) : LK.buyKey(l, id)); renderCos(); };
// ---- opening a case: pick a key (a small panel), then the reel and the prize fill the whole screen
let OPENING = null;   // { grade, key, stage: 'pick' | 'spin' | 'prize', res }
function openCase(grade) { OPENING = { grade, key: LK.KEY_IDS.find(k => LOCK.keys[k]) || '', stage: 'pick', res: null }; renderOpen(); }
function closeOpen() { OPENING = null; clearTimeout(reelT); $('#openBox').hidden = true; $('#reelScreen').hidden = true; if (screen === 'cos') renderCos(); }
function renderOpen() {
  const o = OPENING, g = LK.GRADES[o.grade], pick = o.stage === 'pick', rs = $('#reelScreen');
  $('#openBox').hidden = !pick; rs.hidden = pick;
  if (pick) {
    $('#openTitle').textContent = `Open ${g.name}`;
    const keys = $('#openKeys'); keys.textContent = '';
    for (const k of LK.KEY_IDS) if (LOCK.keys[k]) { const b = el('button', 'btn', `${LK.KEYS[k].name} ×${LOCK.keys[k]}`); b.type = 'button'; b.dataset.key = k; b.setAttribute('aria-pressed', String(k === o.key)); b.onclick = () => { o.key = k; renderOpen(); }; keys.append(b); }
    $('#openNote').textContent = !LOCK.cases[o.grade] ? 'None remaining.' : !o.key ? 'A key is required. Keys are sold in the Store.' : o.key === 'any' ? 'Standard Key: item from any category.' : `Item guaranteed from ${LK.SLOTS.find(s => s.id === o.key).name}.`;
    $('#bOpen').textContent = o.res ? 'Open Another' : 'Open'; $('#bOpen').disabled = !o.key || !LOCK.cases[o.grade];
    return;
  }
  const r = o.res, won = o.stage === 'prize', tier = r.item ? LK.RARITIES.indexOf(r.item.rarity) : 0;
  $('#rsTitle').textContent = g.name;
  rs.style.setProperty('--rc', r.item ? RARE_COL(r.item.rarity) : '#ffc56b');
  rs.classList.toggle('lit', won); rs.classList.toggle('rays', won && tier >= 2);   // rays for an epic or better
  $('#reelStrip').classList.toggle('done', won);
  if (!won) return;
  $('#prizeName').textContent = r.item ? r.item.name : 'Collection Complete';
  $('#prizeNote').textContent = !r.item ? `Every item owned: +${r.coins} coins` : `${LK.RARITY[r.item.rarity].name} · ${LK.SLOTS.find(s => s.id === r.item.slot).name} · ${r.dupe ? `Duplicate: +${r.coins} coins` : 'New'}`;
  $('#bPrizeEquip').hidden = !r.item || r.item.key === wornKey(r.item.slot);
  $('#bOpenMore').hidden = !LOCK.cases[o.grade] || !LK.KEY_IDS.some(k => LOCK.keys[k]);
}
let reelT = 0;
function showPrize() { clearTimeout(reelT); if (!OPENING || OPENING.stage !== 'spin') return; OPENING.stage = 'prize'; const r = OPENING.res, strip = $('#reelStrip'); strip.style.transition = 'none'; strip.style.transform = `translateX(${strip.dataset.end}px)`; sfx('prize' + (r.item ? LK.RARITIES.indexOf(r.item.rarity) : 0)); renderOpen(); }
const REEL = { n: 30, at: 25, secs: 5.5 };   // tiles on the reel, which one is the prize, and how long it spins
$('#bOpen').onclick = () => {
  const o = OPENING; if (!o) return;
  const res = lockerEdit(l => LK.open(l, o.grade, o.key, Math.random));
  if (res.why) { renderOpen(); return; }
  o.res = res; o.stage = 'spin';
  // the reel: looks drawn at random from what the key could give, the prize among them, gliding to a stop on it
  const strip = $('#reelStrip'), pool = LK.ITEMS.filter(it => !it.free && (o.key === 'any' || it.slot === o.key)); strip.textContent = ''; strip.classList.remove('done');
  for (let i = 0; i < REEL.n; i++) { const it = i === REEL.at && res.item ? res.item : pool[Math.floor(Math.random() * pool.length)], t = el('div', 'reelTile' + (i === REEL.at ? ' won' : '')); t.style.background = shade(RARE_COL(it.rarity), 0.5); t.style.borderColor = RARE_COL(it.rarity); t.append(lookPic(it)); strip.append(t); }
  renderOpen();
  const step = strip.children[0].offsetWidth + 6, end = -(REEL.at * step + step / 2 - 3 - $('#reel').clientWidth / 2) + (Math.random() - 0.5) * step * 0.6;
  strip.dataset.end = end; strip.style.transition = 'none'; strip.style.transform = 'translateX(0)';
  if (reduceMotion) { showPrize(); return; }
  void strip.offsetWidth; strip.style.transition = `transform ${REEL.secs}s cubic-bezier(.08,.6,.12,1)`; strip.style.transform = `translateX(${end}px)`;
  reelT = setTimeout(showPrize, REEL.secs * 1000 + 250);
  // a tick as each look passes the marker
  let last = -1; const mid = $('#reel').clientWidth / 2;
  const tick = () => { if (!OPENING || OPENING.stage !== 'spin') return; const x = new DOMMatrixReadOnly(getComputedStyle(strip).transform).m41, i = Math.floor((mid - x) / step); if (i !== last) { last = i; sfx('tick'); } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
};
$('#reel').onclick = showPrize;   // a tap skips to the prize
$('#bPrizeEquip').onclick = () => { const it = OPENING && OPENING.res && OPENING.res.item; if (it && lockerEdit(l => LK.wear(l, it.key))) { dress(); renderOpen(); } };
$('#bOpenMore').onclick = () => { const o = OPENING; if (!o) return; o.stage = 'pick'; if (!LOCK.keys[o.key]) o.key = LK.KEY_IDS.find(k => LOCK.keys[k]) || ''; renderOpen(); };
$('#bOpenClose').onclick = closeOpen; $('#bPrizeClose').onclick = closeOpen;
{ const ov = $('#openBox'); let down = false; ov.addEventListener('pointerdown', e => { down = e.target === ov; }); ov.addEventListener('click', e => { if (e.target === ov && down) closeOpen(); }); }
// ---- earning: a game against the computer, and the day's gift
let EARN = null;   // what the game just finished paid, for the result panel
function gamePaid() {
  if (!G.result || !vs || vs.paid) return;
  vs.paid = true;
  const bot = botOf(), won = G.result.score === '1-0' ? 'w' : G.result.score === '0-1' ? 'b' : '';
  EARN = lockerEdit(l => LK.gameOver(l, { id: bot.id, rating: bot.rating, top: BT.LIST.indexOf(bot) >= BT.LIST.length - 3 }, !won ? 'draw' : won === vs.me ? 'win' : 'loss'));
}
// what a game paid, in words: "+80 coins · 3 Bronze Cases · First-win bonus: Silver Case"
const caseWords = (g, n) => g === 'lucky' ? (n > 1 ? `${n} Super Lucky Boxes` : '1 Super Lucky Box') : `${n} ${LK.GRADES[g].name}${n > 1 ? 's' : ''}`;
const earnText = e => {
  if (!e || (!e.coins && !e.cases.length)) return '';
  const won = e.first ? e.cases.slice(0, -1) : e.cases, out = [`+${e.coins} coins`];
  for (const g of [...new Set(won)]) out.push(caseWords(g, won.filter(x => x === g).length));
  if (e.first) { const g = e.cases[e.cases.length - 1]; out.push('First-win bonus: ' + (g === 'lucky' ? 'Super Lucky Box' : LK.GRADES[g].name)); }
  return out.join(' · ');
};
const today = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
function dailyGift(day = today()) {
  const g = lockerEdit(l => LK.daily(l, day)); if (!g) return;
  $('#gift').textContent = `Daily reward: +${g.coins} coins${g.lucky ? ' + Super Lucky Box' : ''} · Day ${g.streak} of 7`; $('#gift').hidden = false;
  if (screen === 'cos') renderCos();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) dailyGift(); });
addEventListener('storage', e => { if (e.key === lockKey()) { LOCK = readLocker(); dress(); showCoins(); if (screen === 'cos') renderCos(); trFit(); } });   // changed in another open page

// ------------------------------------------------------------------ HUD: the panels' buttons
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
const BACK = { cpu: 'home', online: 'home', room: 'online', settings: 'home', cos: 'home' };   // where Back goes from each screen
// The screens with a Back bar, and where they sit (shown as a path, so you always know where you are); the sections
// along the top bar (Play, Locker, Store, Trade) are tabs instead. Settings opens from the cog at the right of the bar,
// lit while it's open, and closes with it (or Esc, or the back gesture).
const PATH = { cpu: ['Play', 'Vs Computer'], online: ['Play', 'Online'], room: ['Play', 'Online', 'New Room'] };
const TAB_PAGE = { locker: 'locker', store: 'shop', trade: 'trade' };   // a top-bar tab, and the Cosmetics page it shows
function navTabs() {
  const on = screen === 'cos' ? (COS.page === 'shop' ? 'store' : COS.page === 'trade' ? 'trade' : 'locker') : screen === 'settings' ? '' : 'home';
  for (const t of document.querySelectorAll('.hTab')) t.setAttribute('aria-selected', String(t.dataset.go === on));
  $('#bSettings').setAttribute('aria-pressed', String(screen === 'settings'));
}
function menuGo(name) {
  if (screen === 'cos' && name !== 'cos' && PRE) { PRE = null; dress(); }   // a look being tried on comes off
  screen = name;
  for (const sc of document.querySelectorAll('#menu .mScreen')) sc.hidden = sc.id !== 'sc-' + name;
  $('#menuPanel').hidden = name === 'home';
  const path = PATH[name], t = $('#mTitle'); $('#mTop').hidden = !path; t.textContent = '';
  if (path) path.forEach((p, i) => { if (i) t.append(' / '); t.append(i < path.length - 1 ? el('span', 'crumb', p) : p); });
  navTabs();
  if (name === 'settings') showSettings($('#setHome'), false);
  if (name === 'cos') { if (COS.page === 'slot') COS.page = 'locker'; renderCos(); }
  if (name === 'cpu') renderCpu();
  if (name === 'room') renderRoom();
  if (name === 'home') refreshHome(); else arm();
  updateLobbyWatch();
}
function refreshHome() {
  const saved = loadSaved(), b = $('#bResume');
  b.hidden = !saved;
  $('#bLocal .cardTxt').textContent = saved && !saved.vs ? 'New match replaces saved match' : '2 players · 1 device';
  $('#bCpu .cardTxt').textContent = saved && saved.vs ? 'New match replaces saved match' : `${BT.LIST.length - 3} easy · 3 hard`;   // the three strongest are the hard ones (as in gamePaid())
  if (saved) { const bot = saved.vs && BT.byId(saved.vs.bot); b.textContent = `Continue: ${bot ? 'vs ' + bot.name : 'Local Match'} · Move ${Math.ceil((saved.g.list.length + 1) / 2)}`; }
  $('#bOnline .cardTxt').textContent = relayBase() ? 'Public and private rooms' : 'Unavailable';
  cardIcons(); updateRejoin();
}
// the tiles' pictures: the opponent picked, a globe, and a pawn of each side in the finish worn
const GLOBE = ['...aaaaa...', '..abbabba..', '.abbbabbba.', 'abbbbabbbba', 'aaaaaaaaaaa', 'abbbbabbbba', 'aaaaaaaaaaa', 'abbbbabbbba', '.abbbabbba.', '..abbabba..', '...aaaaa...'];
const ICONS = {};
function cardIcons() {
  const put = (id, key, make) => { const box = $(id + ' .cardIcon'); if (ICONS[id] === key) return; ICONS[id] = key; box.textContent = ''; box.append(make()); };
  const bot = BT.byId(M.bot);
  put('#bCpu', bot.id, () => portrait(bot.look, 4));
  put('#bOnline', 'globe', () => rowsPic(GLOBE, { a: '#6cb8ff', b: '#1d2f5c' }));
  put('#bLocal', LOCK.wear.finish, () => lookPic(LK.ALL[LK.key('finish', LOCK.wear.finish)]));
}
function renderRoom() {
  for (const b of document.querySelectorAll('#sNetColour .btn')) b.setAttribute('aria-pressed', String(b.dataset.v === M.netColour));
  for (const b of document.querySelectorAll('#sListed .btn')) b.setAttribute('aria-pressed', String(!!+b.dataset.v === (M.listed !== false)));
  $('#listedTxt').textContent = M.listed !== false ? 'Shown in Open Rooms.' : 'Joinable by code or invite link only.';
}
for (const b of document.querySelectorAll('#sNetColour .btn')) b.onclick = () => { M.netColour = b.dataset.v; saveM(); renderRoom(); };
for (const b of document.querySelectorAll('#sListed .btn')) b.onclick = () => { M.listed = !!+b.dataset.v; saveM(); renderRoom(); };
function renderCpu() {
  const grid = $('#botGrid'); grid.textContent = '';
  for (const bot of BT.LIST) {
    const b = document.createElement('button'); b.className = 'botCard'; b.type = 'button'; b.dataset.bot = bot.id; b.setAttribute('aria-pressed', String(M.bot === bot.id));
    const name = document.createElement('span'); name.className = 'botName'; name.textContent = bot.name;
    const elo = document.createElement('span'); elo.className = 'botElo'; elo.textContent = BT.rated(bot.rating);
    b.append(portrait(bot.look, 2), name, elo);
    b.onclick = () => { M.bot = bot.id; saveM(); renderCpu(); };
    grid.append(b);
  }
  const bot = BT.byId(M.bot);
  $('#botBlurb').textContent = `${bot.name} · ${BT.rated(bot.rating)}: ${bot.blurb}`;
  for (const b of document.querySelectorAll('#sColour .btn')) b.setAttribute('aria-pressed', String(b.dataset.v === M.colour));
}
for (const b of document.querySelectorAll('#sColour .btn')) b.onclick = () => { M.colour = b.dataset.v; saveM(); renderCpu(); };
// back to the menus, on the home screen (or, leaving an online game or room, the Online screen); leaving online on
// purpose forgets the game for Rejoin, and tells the other player
function toMenu(to = 'home') {
  if (NET.on) { clearRejoin(); leaveOnline(); }
  state = 'menu'; THINK = null; closePanels(); clearSel();
  cam.mode = 'menu'; cam.a = cam.cur.yaw;
  $('#hud').hidden = true; $('#lobby').hidden = true; $('#menu').hidden = false; refit();
  if (to === 'home' && armed) { armed = false; history.back(); }
  menuGo(to); showMarks();
}
for (const t of document.querySelectorAll('.hTab')) t.onclick = () => {
  const go = t.dataset.go, page = TAB_PAGE[go];
  if (go === 'home') { if (screen === 'home') return; if (armed) { armed = false; history.back(); } menuGo('home'); return; }
  if (screen === 'cos' && (COS.page === page || (page === 'locker' && COS.page === 'slot'))) return;
  if (PRE) { PRE = null; dress(); }
  COS.page = page; menuGo('cos');
};
$('#bSettings').onclick = () => { if (screen === 'settings') $('#mBack').click(); else menuGo('settings'); };
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
  if (state === 'menu') {
    if (TR.on) { if (TR.count) trBackOut(); else leaveTrade(); arm(); } else if (OPENING) { if (OPENING.stage === 'spin') showPrize(); else closeOpen(); arm(); } else if (screen === 'cos' && COS.page === 'slot') { cosPage('locker'); arm(); } else if (screen !== 'home') menuGo(BACK[screen] || 'home');
    return;
  }
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
function sendHello() { netSend({ t: 'hello', name: NET.myName, started: NET.started, n: NET.started && G ? G.list.length : 0, v: BUILD, look: { set: LOCK.wear.set, finish: LOCK.wear.finish, avatar: LOCK.wear.avatar } }); }
// the other player's looks, from their hello: only ids the catalogue knows; anything else is the free look
const peerLook = l => { const ok = (slot, d) => l && typeof l[slot] === 'string' && LK.ALL[LK.key(slot, l[slot])] ? l[slot] : d; return { set: ok('set', 'classic'), finish: ok('finish', 'classic'), avatar: ok('avatar', 'plain') }; };
function netConnect() {
  let ws;
  const listQ = NET.list && !NET.started ? `&list=1&name=${encodeURIComponent(NET.myName)}&mode=${encodeURIComponent(M.netColour)}` : '';
  try { ws = new WebSocket(`${relayBase()}/room/${NET.code}?cid=${NET.cid}${listQ}`); }
  catch (e) { lobbyStatus('Unable to reach the server. Check the relay address in config.js.'); return; }
  NET.ws = ws; NET.link = 'connecting'; netBadge();
  ws.onopen = () => { NET.retry = 0; };
  ws.onmessage = e => { if (e.data === 'pong') return; let m; try { m = JSON.parse(e.data); } catch (err) { return; } onNet(m); };
  ws.onclose = ev => {
    if (NET.ws === ws) NET.ws = null;
    if (!NET.on || ev.code === 4000 || ev.code === 4001) return;
    NET.link = 'reconnecting'; netBadge();
    lobbyStatus(NET.retry > 2 ? 'Unable to reach the server. Check your connection.' : 'Connecting…');
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
      lobbyStatus(NET.peer ? 'Connected. Starting match…' : waitText());
      if (NET.peer) sendHello();
      if (NET.started) hud();
      break;
    case 'full':
      clearRejoin(); toMenu('online'); menuNote('That room is full.'); break;
    case 'peer':
      NET.peer = !!m.on; netBadge();
      if (m.on) sendHello();
      else if (NET.started) toast(`${NET.peerName} disconnected. Waiting to reconnect…`);
      else lobbyStatus(waitText());
      break;
    case 'hello':
      NET.peerName = cleanName(m.name); NET.peer = true; netBadge();
      { const was = NET.peerLook, lk = peerLook(m.look); NET.peerLook = lk; if ((!was || was.set !== lk.set || was.finish !== lk.finish) && NET.started && SHOWN && !GLIDE) placeAll(SHOWN); hud(); }
      NET.peerVer = typeof m.v === 'string' ? m.v.slice(0, 16) : '';
      NET.verWarn = '';
      if (NET.peerVer !== BUILD) {
        const why = `Version mismatch with ${NET.peerName}.`;
        if (!NET.started && !m.started) {   // nothing to lose yet, so don't start a game that might not match
          lobbyStatus(`${why} Both players must update (Ctrl+F5 on a computer; close and reopen on a phone), then rejoin room ${NET.code}.`);
          break;
        }
        // mid-game: carry on (each move is checked, and a mismatch fetches the whole game) but say so
        NET.verWarn = `${why} If the games go out of sync, update (Ctrl+F5 on a computer; close and reopen on a phone) and rejoin room ${NET.code}.`;
        if (NET.started) toast(NET.verWarn);
      }
      if (NET.started) netSendState();
      else if (NET.seat === 0 && !m.started) hostStart();
      else lobbyStatus(`Connected to ${NET.peerName}. Starting match…`);
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
  if (!relayBase()) { menuNote('Online play is unavailable: no relay address is set in config.js.'); return; }
  if (!code || code.length < 4) { menuNote('Enter a valid room code (5 characters).'); return; }
  NET.on = true; NET.code = code; NET.cid = getCid(); NET.myName = cleanName($('#netName').value, 'Player'); NET.peerName = 'Friend'; NET.peerLook = null;
  try { localStorage.setItem('retroSet.name', NET.myName); } catch (e) {}
  holdSeat();
  Object.assign(NET, { started: false, games: 0, queue: [], hold: [], again: [false, false], retry: 0, peer: false, peerVer: '', verWarn: '', list: listed, rejoin, drawOffered: false });
  vs = null; THINK = null; menuNote('');
  try { history.replaceState(null, '', '#room=' + code); } catch (e) {}
  state = 'lobby'; $('#menu').hidden = true; $('#lobby').hidden = false; arm(); refit();
  $('#lobbyCode').textContent = code; $('#lobbyLink').value = inviteLink();
  $('#lobbyNote').textContent = listed
    ? 'Listed in Open Rooms. Players can also join with the code or invite link.'
    : 'Private room. Players join with the code or invite link.';
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
    if (!g) { toast(`Game state mismatch with ${NET.peerName}. Both players must update (Ctrl+F5 on a computer; close and reopen on a phone).`); return; }
  }
  if (done(m.result) && !g.result) g = C.finish(g, m.result.score, m.result.why);
  const back = !NET.started;
  NET.white = m.white === 1 ? 1 : 0; NET.me = NET.seat === NET.white ? 'w' : 'b';
  if (Number.isInteger(m.games)) NET.games = m.games;
  Object.assign(NET, { started: true, queue: NET.queue.filter(q => q.n > g.list.length), hold: [] });
  G = g; state = G.result ? 'over' : 'play'; sel = -1; targets = []; closePanels(); placeAll(G);
  if (back) Object.assign(cam, { mode: 'play', base: NET.me === 'w' ? 0 : PI, yawOff: 0, pitch: 0.95, zoom: 1 });
  showGameUI(); hud(); showMarks();
  toast(m.fix ? `Game resynchronised with ${NET.peerName}` : `Reconnected to ${NET.peerName}`);
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
  if (!n) { toast(`Illegal move from ${NET.peerName} rejected`); netSend({ t: 'resync' }); return; }
  if (typeof m.fen === 'string' && m.fen !== C.toFen(n.pos)) { toast(`Position mismatch. Resynchronising with ${NET.peerName}…`); netSend({ t: 'resync' }); return; }
  if (state === 'promo') cancelPromo();
  tryMove({ from: C.sq(m.u.slice(0, 2)), to: C.sq(m.u.slice(2, 4)), promo: m.u[4] || '' });
}
function netOfferDraw() {
  if (!NET.started || G.result) return;
  if (!NET.peer) { toast(`Waiting for ${NET.peerName} to reconnect`); return; }
  NET.drawOffered = true; netSend({ t: 'drawOffer' }); toast(`Draw offered to ${NET.peerName}`);
}
$('#bOfferYes').onclick = () => { $('#offer').hidden = true; if (!G || G.result) return; netSend({ t: 'drawYes' }); G = C.finish(G, '1/2-1/2', 'agreed'); afterMove(); };
$('#bOfferNo').onclick = () => { $('#offer').hidden = true; netSend({ t: 'drawNo' }); };
function netBadge() {
  const el = $('#net');
  if (!NET.on) { el.textContent = ''; return; }
  const ok = NET.link === 'online' && NET.peer;
  el.textContent = NET.link !== 'online' ? 'Reconnecting…' : ok ? `${NET.peerName} is connected` : `${NET.peerName} is disconnected`;
  el.dataset.ok = ok ? '1' : '0';
}
// quick chat: preset messages only, so there's nothing to moderate in listed rooms
const CHAT = ['Good luck', 'Well played', 'Good game', 'Thank you', 'Nice move', 'Sorry', 'Impressive', 'Rematch?'];
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
  b.textContent = !NET.on ? 'Rematch' : NET.again[NET.seat] ? `Waiting for ${NET.peerName}…` : NET.again[1 - NET.seat] ? 'Accept Rematch' : 'Rematch';
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
// Two tabs of one browser (playing yourself) share this list, and each reads it, changes it and writes it back: when
// both save at the same moment one can write over the other's entry. So a tab that sees the list change without its
// own entry in it, while it's in a game, puts itself back.
addEventListener('storage', e => { if (e.key === REJOIN_KEY && NET.on && NET.started && !rejoinList().some(r => r.cid === NET.cid)) saveRejoin(); });
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
  b.hidden = !r; if (r) b.textContent = `Rejoin: vs ${cleanName(r.peer)}`;
}
addEventListener('storage', e => { if (e.key === REJOIN_KEY && state === 'menu') updateRejoin(); });
addEventListener('focus', () => { if (state === 'menu') updateRejoin(); });
const waitText = () => NET.rejoin ? `Waiting for ${cleanName(NET.rejoin.peer)} to reconnect…` : 'Waiting for an opponent…';
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
    await navigator.clipboard.writeText(link); lobbyStatus('Invite link copied.');
  } catch (e) { const i = $('#lobbyLink'); i.focus(); i.select(); try { document.execCommand('copy'); lobbyStatus('Invite link copied.'); } catch (e2) { lobbyStatus('Copy the link below to share it.'); } }
};
try { $('#netName').value = localStorage.getItem('retroSet.name') || ''; } catch (e) {}
// the open rooms list: watched live from the relay while the Online screen is showing
const LW = { ws: null, rooms: [], off: 0, retry: 0, timer: 0, pending: 0, want: false, failed: false, loaded: false };
const COLOUR_NAME = { white: 'Host plays White', black: 'Host plays Black', random: 'Random colours' };
function updateLobbyWatch() {
  const want = state === 'menu' && !NET.on && !TR.on && (screen === 'online' || (screen === 'cos' && COS.page === 'trade')) && !!relayBase() && document.visibilityState === 'visible';
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
// both lists come from the one watch: game rooms on the Online screen, trade rooms on the Cosmetics tab's Trade page
function renderRooms() {
  const live = !relayBase() ? '' : LW.ws && LW.ws.readyState === 1 ? 'Live' : LW.failed ? "Can't reach the relay" : 'Connecting…', now = Date.now() + LW.off;
  const show = (box, liveEl, rooms, none, title, sub, join) => {
    const note = t => { box.textContent = ''; box.append(el('div', 'note', t)); };
    liveEl.textContent = live;
    if (!relayBase()) { note('Online play is unavailable: no relay address is set in config.js.'); return; }
    if (!rooms.length) { note(LW.loaded ? none : 'Searching for open rooms…'); return; }
    box.textContent = '';
    for (const r of rooms) {
      const row = el('div', 'roomItem'), info = el('div'), mins = Math.max(0, Math.round((now - Number(r.at)) / 60000)), b = el('button', 'btn', 'Join'); b.type = 'button';
      info.append(el('div', 'rn', title(r)), el('div', 'rm', `${sub(r)}${mins < 1 ? 'Just opened' : 'Waiting ' + mins + ' min'}`));
      b.addEventListener('click', () => join(r)); row.append(info, b); box.append(row);
    }
  };
  show($('#roomList'), $('#roomsLive'), LW.rooms.filter(r => !isTradeRoom(r)), 'No open rooms. Listed rooms appear here.',
    r => `${cleanName(r.name, 'Player')}'s Room`, r => `${COLOUR_NAME[r.mode] || COLOUR_NAME.random}, `, r => startOnline(cleanCode(r.code)));
  show($('#trRooms'), $('#trLive'), LW.rooms.filter(isTradeRoom), 'No open trade rooms. Listed rooms appear here.',
    r => `${cleanName(r.name, 'Player')}'s Trade Room`, () => '', r => startTrade(cleanCode(String(r.code).slice(TR_PRE.length))));
}

// ------------------------------------------------------------------ trading
// Swapping cosmetics with another player, in a trade room: a room of the relay kept apart from the game rooms by its
// name ('TRADE' + the code; a game's code is never that long, so neither kind of player can walk into the other's
// room). Each player sees the other's looks, cases and keys (never their coins), puts together what they give, and can
// ask for things. Both press Ready; changing either offer clears both marks. With both ready a 5-second countdown runs
// on each screen, and either can back out. At its end each page tells the other it's going ahead ('tdone'), and makes
// the swap in its own locker once it has both sent that and received the other's. Nothing but the two pages keeps the
// lockers, so this is an honour system (HANDOVER.md, section 4).
const TR = { on: false, ws: null, code: '', cid: '', seat: 0, peer: false, seen: false, link: '', peerName: 'Friend', myName: 'Player', list: false, retry: 0, timer: 0,
  inv: LK.noOffer(), mine: LK.noOffer(), theirs: LK.noOffer(), invKey: '', ready: [false, false],   // ready: [me, them]
  count: 0, sec: 0, tick: 0, wait: 0, sent: '', got: '', asks: [], marks: [], side: 'mine', filter: 'set', onlyNew: true, verBad: false, flash: '', flashT: 0, trades: 0 };
const TR_PRE = 'TRADE';
let TR_SECS = 5;
const isTradeRoom = r => { const c = String(r && r.code || ''); return c.startsWith(TR_PRE) && c.length > 8; };
// one thing that can be traded, by its id: a look ('finish:neon'), a case ('case:gold') or a key ('key:any')
function thing(id) {
  const [a, b] = String(id).split(':');
  if (a === 'case') return LK.GRADES[b] ? { kind: 'cases', k: b, name: LK.GRADES[b].name, pic: () => casePic(b) } : null;
  if (a === 'key') return LK.KEYS[b] ? { kind: 'keys', k: b, name: LK.KEYS[b].name, pic: () => keyPic(b) } : null;
  const it = LK.ALL[id]; return it && !it.free ? { kind: 'items', k: id, name: it.name, pic: () => lookPic(it), colour: RARE_COL(it.rarity), item: it } : null;
}
const held = (o, id) => { const t = thing(id); return t ? o[t.kind][t.k] || 0 : 0; };
const setHeld = (o, id, n) => { const t = thing(id); if (n > 0) o[t.kind][t.k] = n; else delete o[t.kind][t.k]; };
const things = o => [...LK.ITEMS.filter(it => o.items[it.key]).map(it => it.key), ...LK.GRADE_IDS.filter(g => o.cases[g]).map(g => 'case:' + g), ...LK.KEY_IDS.filter(k => o.keys[k]).map(k => 'key:' + k)];
const trClamp = (o, inv) => { for (const id of things(o)) setHeld(o, id, Math.min(held(o, id), held(inv, id))); return o; };
const trWords = o => { const w = things(o).map(id => (held(o, id) > 1 ? held(o, id) + ' × ' : '') + thing(id).name); if (o.coins) w.push(o.coins + ' coins'); return w.length ? w.join(', ') : 'nothing'; };
const trHash = (give, get) => LK.offerKey(give) + '|' + LK.offerKey(get);   // a trade as its giver sees it; the other player's is the same two the other way round
function trSend(o) { if (TR.ws && TR.ws.readyState === 1) TR.ws.send(JSON.stringify(o)); }
function trHello(re) { const inv = LK.inventory(LOCK); TR.invKey = LK.offerKey(inv); trSend({ t: 'thello', name: TR.myName, v: BUILD, inv, offer: TR.mine, re: !!re }); }
function trSay(text) { TR.flash = text; clearTimeout(TR.flashT); TR.flashT = setTimeout(() => { TR.flash = ''; renderTrade(); }, 7000); }
function trMenuNote(t) { $('#trMenuNote').textContent = t; }
const tradeLink = () => location.href.split('#')[0] + '#trade=' + TR.code;
// the countdown: 5 seconds on this screen once both are ready, a tick each second
function trCount(on) {
  clearInterval(TR.tick); TR.tick = 0; TR.count = 0;
  if (!on) return;
  TR.count = performance.now() + TR_SECS * 1000; TR.sec = TR_SECS; sfx('tick');
  TR.tick = setInterval(() => { const s = Math.ceil((TR.count - performance.now()) / 1000); if (s <= 0) trFinish(); else if (s !== TR.sec) { TR.sec = s; sfx('tick'); renderTrade(); } }, 100);
}
function trUnready() { TR.ready = [false, false]; TR.sent = TR.got = ''; clearTimeout(TR.wait); trCount(false); }
function trBoth() {
  const both = TR.ready[0] && TR.ready[1] && TR.peer && !TR.verBad;
  if (both && !TR.count && !TR.sent) trCount(true); else if (!both && TR.count) trCount(false);
  renderTrade();
}
// the countdown has run out here: say so to the other player, and swap once they have said so too
function trFinish() {
  trCount(false); LOCK = readLocker();
  if (!TR.ready[0] || !TR.ready[1] || !LK.canGive(LOCK, TR.mine)) { trUnready(); trFit(true); return; }
  TR.sent = trHash(TR.mine, TR.theirs); trSend({ t: 'tdone', h: TR.sent }); trSwap(); renderTrade();
  // the other page has 4 seconds to say it's going ahead too; silent, the trade is off here
  const h = TR.sent; clearTimeout(TR.wait); TR.wait = setTimeout(() => { if (TR.on && TR.sent === h && TR.got !== h) { trUnready(); trSend({ t: 'tready', on: false }); trSay(`No response from ${TR.peerName}. Trade cancelled.`); renderTrade(); } }, 4000);
}
function trSwap() {
  if (!TR.sent || TR.sent !== TR.got) return;
  const give = TR.mine, get = TR.theirs, ok = lockerEdit(l => LK.trade(l, give, get));
  TR.mine = LK.noOffer(); TR.theirs = LK.noOffer(); TR.asks = []; TR.marks = []; trUnready();
  if (ok) { TR.trades++; sfx('prize1'); dress(); trSay(LK.offerEmpty(get) ? `Trade complete. You gave ${trWords(give)}.` : `Trade complete. You received ${trWords(get)}.`); }
  else trSay('Trade failed: an offered item is no longer in your locker.');
  trHello();
}
// my offer changed: both Ready marks go, and the other player is told
function trChanged() {
  const was = TR.ready[0] || TR.ready[1]; trUnready(); trSend({ t: 'toffer', offer: TR.mine });
  if (was) trSay('Offer changed. Ready status cleared.');
  renderTrade();
}
// the locker changed (another open page spent something): the offer keeps to what's really held, and the other player
// gets the new list. Not once this page has said it's going ahead: the swap itself checks again.
function trFit(force) {
  if (!TR.on || TR.sent) return;
  const inv = LK.inventory(LOCK), was = LK.offerKey(TR.mine);
  trClamp(TR.mine, inv); TR.mine.coins = Math.min(TR.mine.coins, LOCK.coins);
  if (force || LK.offerKey(inv) !== TR.invKey || LK.offerKey(TR.mine) !== was) { trUnready(); trHello(); if (LK.offerKey(TR.mine) !== was) trSay('Locker changed. Your offer has been updated.'); }
  renderTrade();
}
function trPut(id, d) {
  if (TR.sent || !thing(id)) return;
  setHeld(TR.mine, id, Math.max(0, Math.min(held(LK.inventory(LOCK), id), held(TR.mine, id) + d)));
  TR.asks = TR.asks.filter(a => a !== id);
  trChanged();
}
function trMark(id) {
  if (TR.sent) return;
  if (held(TR.theirs, id) >= held(TR.inv, id)) { trSay('Already in the offer.'); renderTrade(); return; }
  TR.marks = TR.marks.includes(id) ? TR.marks.filter(m => m !== id) : [...TR.marks, id].slice(-8);
  renderTrade();
}
function trBackOut() {
  if (!TR.count) return;
  trUnready(); trSend({ t: 'tready', on: false }); trSay('You backed out. Trade cancelled.'); renderTrade();
}
function onTrade(m) {
  switch (m.t) {
    case 'welcome': TR.seat = m.seat === 1 ? 1 : 0; TR.peer = !!m.peer; TR.link = 'online'; if (TR.peer) trHello(); renderTrade(); break;
    case 'full': leaveTrade('That trade room is full.'); break;
    case 'peer':
      TR.peer = !!m.on; trUnready();
      if (m.on) trHello(); else if (TR.seen) trSay(`${TR.peerName} disconnected. Trade cancelled.`);
      renderTrade(); break;
    case 'thello':
      TR.peerName = cleanName(m.name); TR.peer = true; TR.seen = true; TR.verBad = m.v !== BUILD;
      TR.inv = LK.cleanOffer(m.inv); TR.inv.coins = 0; TR.theirs = trClamp(LK.cleanOffer(m.offer), TR.inv);
      TR.marks = TR.marks.filter(id => held(TR.inv, id) > held(TR.theirs, id)); trUnready();
      if (m.re) trHello();
      renderTrade(); break;
    case 'toffer': {
      const was = TR.ready[0] || TR.ready[1];
      TR.theirs = trClamp(LK.cleanOffer(m.offer), TR.inv); TR.marks = TR.marks.filter(id => held(TR.inv, id) > held(TR.theirs, id)); trUnready();
      if (was) trSay(`${TR.peerName} changed their offer. Ready status cleared.`);
      renderTrade(); break;
    }
    case 'task':   // they ask for things of mine: a short notice, with Add and No
      for (const id of Array.isArray(m.ids) ? m.ids.slice(0, 8) : []) if (typeof id === 'string' && thing(id) && held(LK.inventory(LOCK), id) > held(TR.mine, id) && !TR.asks.includes(id) && TR.asks.length < 8) TR.asks.push(id);
      if (TR.asks.length) sfx('ui');
      renderTrade(); break;
    case 'tno': if (typeof m.id === 'string' && thing(m.id)) { trSay(`${TR.peerName} declined the request for ${thing(m.id).name}.`); renderTrade(); } break;
    case 'tready':
      if (TR.verBad || !TR.seen) break;
      if (m.on && m.h !== trHash(TR.theirs, TR.mine)) { trUnready(); trHello(true); trSay('Offers were out of sync and have been refreshed. Review the trade, then press Ready.'); renderTrade(); break; }
      if (!m.on && (TR.count || TR.sent)) { trUnready(); trSay(`${TR.peerName} backed out. Trade cancelled.`); }   // out of the countdown: both start again
      else TR.ready[1] = !!m.on;
      trBoth(); break;
    case 'tdone':
      if (!TR.verBad && TR.ready[0] && TR.ready[1] && m.h === trHash(TR.theirs, TR.mine)) { TR.got = trHash(TR.mine, TR.theirs); trSwap(); renderTrade(); }
      break;
    case 'tbye':
      TR.peer = false; TR.seen = false; TR.inv = LK.noOffer(); TR.theirs = LK.noOffer(); TR.asks = []; TR.marks = []; trUnready();
      trSay(`${TR.peerName} left the trade room.`); renderTrade(); break;
  }
}
function trConnect() {
  let ws;
  const listQ = TR.list ? `&list=1&name=${encodeURIComponent(TR.myName)}` : '';
  try { ws = new WebSocket(`${relayBase()}/room/${TR_PRE}${TR.code}?cid=${TR.cid}${listQ}`); }
  catch (e) { leaveTrade("Couldn't reach the relay. Check the relay address in config.js."); return; }
  TR.ws = ws; TR.link = 'connecting'; renderTrade();
  ws.onopen = () => { TR.retry = 0; };
  ws.onmessage = e => { if (e.data === 'pong' || !TR.on || TR.ws !== ws) return; let m; try { m = JSON.parse(e.data); } catch (err) { return; } if (m && typeof m.t === 'string') onTrade(m); };
  ws.onclose = ev => {
    if (TR.ws === ws) TR.ws = null;
    if (!TR.on || ev.code === 4000 || ev.code === 4001) return;
    TR.link = 'reconnecting'; TR.peer = false; trUnready(); renderTrade();
    clearTimeout(TR.timer); TR.timer = setTimeout(() => { if (TR.on && !TR.ws) trConnect(); }, Math.min(8000, 600 * Math.pow(2, TR.retry++)));
  };
}
setInterval(() => { if (TR.ws && TR.ws.readyState === 1) TR.ws.send('ping'); }, 20000);
function startTrade(code, listed = false) {
  if (NET.on || TR.on) return;
  if (!relayBase()) { trMenuNote('Trading is unavailable: no relay address is set in config.js.'); return; }
  if (!code || code.length < 4) { trMenuNote('Enter a valid room code (5 characters).'); return; }
  Object.assign(TR, { on: true, code, cid: getCid(), myName: cleanName($('#netName').value, 'Player'), peerName: 'Friend', list: listed, retry: 0, peer: false, seen: false, link: 'connecting',
    inv: LK.noOffer(), mine: LK.noOffer(), theirs: LK.noOffer(), asks: [], marks: [], side: 'mine', verBad: false, flash: '' });
  trUnready(); trMenuNote(''); LOCK = readLocker();
  try { history.replaceState(history.state, '', '#trade=' + code); } catch (e) {}
  $('#tradeBox').hidden = false; arm(); updateLobbyWatch(); trConnect();
}
function leaveTrade(note = '') {
  if (!TR.on) return;
  trSend({ t: 'tbye' }); TR.on = false; clearTimeout(TR.timer); clearTimeout(TR.flashT); trUnready();
  const ws = TR.ws; TR.ws = null; if (ws) { try { ws.close(1000, 'bye'); } catch (e) {} }
  try { history.replaceState(history.state, '', location.href.split('#')[0]); } catch (e) {}
  $('#tradeBox').hidden = true; trMenuNote(note); updateLobbyWatch(); if (screen === 'cos') renderCos();
}
// what the grid shows: one side's things in one slot (or its cases and keys); for theirs, perhaps only the looks I lack
const TR_FILTERS = [...LK.SLOTS.map(s => [s.id, s.name.replace('Square marks', 'Marks')]), ['cases', 'Cases & keys']];
function trList(side, f) {
  const inv = side === 'mine' ? LK.inventory(LOCK) : TR.inv;
  if (f === 'cases') return things({ items: {}, cases: inv.cases, keys: inv.keys });
  return LK.slotItems(f).filter(it => inv.items[it.key] && !(side === 'theirs' && TR.onlyNew && LK.owns(LOCK, it.key))).map(it => it.key);
}
for (const [f, name] of TR_FILTERS) { const b = el('button', 'btn', name); b.type = 'button'; b.dataset.f = f; b.onclick = () => { TR.filter = f; renderTrade(); }; $('#trFilter').append(b); }
function renderTrade() {
  if (!TR.on) return;
  const name = TR.peerName, wait = !TR.seen, mine = TR.side === 'mine', inv = mine ? LK.inventory(LOCK) : TR.inv, offer = mine ? TR.mine : TR.theirs;
  $('#trTitle').textContent = wait ? 'Trade Room' : `Trade with ${name}`;
  for (const id of ['#trOffers', '#trBar', '#trGrid', '#trSideSeg']) $(id).hidden = wait;
  $('#trWait').hidden = !wait;
  if (wait) { $('#trCodeBig').textContent = TR.code; $('#trLink').value = tradeLink(); }
  // the two offers
  const strip = (box, o, own) => {
    const ids = things(o), few = ids.length <= 2; box.textContent = '';   // more than two things: pictures only, so they all show
    for (const id of ids) {
      const t = thing(id), n = held(o, id), c = el(own ? 'button' : 'span', 'chip2'); c.dataset.id = id; c.title = own ? `${t.name}: take it out of the trade` : t.name; c.setAttribute('aria-label', n > 1 ? `${t.name} ×${n}` : t.name);
      if (own) { c.type = 'button'; c.disabled = !!TR.sent; c.onclick = () => trPut(id, -1); }
      c.append(t.pic(), few ? (n > 1 ? `${t.name} ×${n}` : t.name) : n > 1 ? `×${n}` : ''); box.append(c);
    }
  };
  strip($('#trMine'), TR.mine, true); strip($('#trTheirs'), TR.theirs, false);
  $('#trMineH').textContent = 'Your Offer' + (TR.ready[0] ? ' · Ready' : ''); $('#trTheirsH').textContent = `${name}'s Offer` + (TR.ready[1] ? ' · Ready' : '');
  $('#trMine').parentNode.classList.toggle('ready', TR.ready[0]); $('#trTheirs').parentNode.classList.toggle('ready', TR.ready[1]);
  const ci = $('#trCoins'); ci.max = LOCK.coins; ci.disabled = !!TR.sent;
  if (document.activeElement !== ci || (Math.floor(+ci.value) || 0) !== TR.mine.coins) ci.value = TR.mine.coins || '';
  $('#trTheirCoins').textContent = TR.theirs.coins ? `+ ${TR.theirs.coins.toLocaleString('en-GB')} coins` : '';
  // whose things, which slot
  for (const b of document.querySelectorAll('#trSideSeg .btn')) b.setAttribute('aria-pressed', String(b.dataset.side === TR.side));
  for (const b of document.querySelectorAll('#trFilter .btn')) { b.setAttribute('aria-pressed', String(b.dataset.f === TR.filter)); b.classList.toggle('none', !trList(TR.side, b.dataset.f).length); }
  $('#bTrNew').hidden = mine; $('#bTrNew').setAttribute('aria-pressed', String(TR.onlyNew));
  const grid = $('#trGrid'), ids = trList(TR.side, TR.filter); grid.textContent = '';
  for (const id of ids) {
    const t = thing(id), have = held(inv, id), off = held(offer, id);
    const b = tile(t.pic(), t.name, { colour: t.colour, worn: mine && t.item && t.k === wornKey(t.item.slot), num: off && have > 1 ? `${off}/${have}` : have > 1 ? '×' + have : '', data: { id } });
    if (off) b.classList.add('inOffer');
    if (!mine && TR.marks.includes(id)) b.classList.add('marked');
    if (!mine && t.item && LK.owns(LOCK, id)) b.classList.add('have');
    b.disabled = !!TR.sent; b.onclick = () => mine ? trPut(id, off < have ? 1 : -off) : trMark(id);
    grid.append(b);
  }
  if (!ids.length) grid.append(el('div', 'note', mine ? 'No tradeable items in this category. Default items cannot be traded.' : TR.filter !== 'cases' && TR.onlyNew ? `${name} has no items here that you don't own.` : `${name} has no items in this category.`));
  // the foot: what's going on, something asked for, and Ready
  const ask = TR.asks[0], asks = $('#trAsks'), note = $('#trNote'); asks.textContent = '';
  if (ask && !TR.count && !TR.sent) {
    const yes = el('button', 'btn', 'Add'), no = el('button', 'btn', 'Decline'); yes.type = no.type = 'button'; yes.id = 'bTrAdd'; no.id = 'bTrNo';
    yes.onclick = () => trPut(ask, 1); no.onclick = () => { TR.asks.shift(); trSend({ t: 'tno', id: ask }); renderTrade(); };
    asks.append(yes, no);
  }
  note.classList.toggle('count', !!TR.count);
  note.textContent = TR.link !== 'online' ? 'Connecting to the relay…'
    : wait ? TR.flash || (TR.list ? 'Waiting for a trade partner. Listed in Open Trade Rooms.' : 'Waiting for a trade partner. Share the code or invite link.')
    : TR.verBad ? `Version mismatch with ${name}. Both players must update (Ctrl+F5 on a computer) to trade.`
    : !TR.peer ? TR.flash || `${name} disconnected. Waiting to reconnect…`
    : TR.sent ? 'Completing trade…'
    : TR.count ? `Trading in ${TR.sec}…`
    : ask ? `${name} requests ${thing(ask).name}${TR.asks.length > 1 ? ` (+${TR.asks.length - 1} more)` : ''}.`
    : TR.flash ? TR.flash
    : TR.ready[0] ? `Waiting for ${name}.`
    : TR.ready[1] ? `${name} is ready.`
    : mine ? 'Select items to add them to your offer.' : 'Select items, then Request.';
  const live = !wait && TR.peer && !TR.verBad && TR.link === 'online';
  $('#bTrAsk').hidden = wait || mine || !!TR.count || !!TR.sent; $('#bTrAsk').disabled = !TR.marks.length || !live; $('#bTrAsk').textContent = TR.marks.length > 1 ? `Request ${TR.marks.length}` : 'Request';
  $('#bTrBack').hidden = !TR.count;
  $('#bTrReady').hidden = wait || !!TR.count || !!TR.sent; $('#bTrReady').disabled = !live || (LK.offerEmpty(TR.mine) && LK.offerEmpty(TR.theirs));
  $('#bTrReady').setAttribute('aria-pressed', String(TR.ready[0])); $('#bTrReady').textContent = TR.ready[0] ? 'Not Ready' : 'Ready';
}
for (const b of document.querySelectorAll('#trSideSeg .btn')) b.onclick = () => { TR.side = b.dataset.side; renderTrade(); };
$('#bTrNew').onclick = () => { TR.onlyNew = !TR.onlyNew; renderTrade(); };
$('#trCoins').addEventListener('input', () => { const n = Math.max(0, Math.min(LOCK.coins, Math.floor(+$('#trCoins').value) || 0)); if (n !== TR.mine.coins && !TR.sent) { TR.mine.coins = n; trChanged(); } });
$('#bTrAsk').onclick = () => {
  if (!TR.marks.length) return;
  trSend({ t: 'task', ids: TR.marks }); trSay(`Request sent to ${TR.peerName}: ${TR.marks.map(id => thing(id).name).join(', ')}.`); TR.marks = []; renderTrade();
};
$('#bTrReady').onclick = () => {
  if (TR.count || TR.sent) return;
  LOCK = readLocker();
  if (!TR.ready[0] && !LK.canGive(LOCK, TR.mine)) { trFit(true); return; }
  TR.ready[0] = !TR.ready[0]; TR.flash = '';
  trSend({ t: 'tready', on: TR.ready[0], h: trHash(TR.mine, TR.theirs) }); trBoth();
};
$('#bTrBack').onclick = trBackOut;
$('#bTrLeave').onclick = () => leaveTrade();
$('#bTrCopy').onclick = async () => {
  const link = tradeLink(), say = t => { TR.flash = t; renderTrade(); };
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: 'Retro Set', text: 'Trade with me', url: link }); return; }
    await navigator.clipboard.writeText(link); say('Invite link copied.');
  } catch (e) { const i = $('#trLink'); i.focus(); i.select(); try { document.execCommand('copy'); say('Invite link copied.'); } catch (e2) { say('Copy the link to share it.'); } }
};
// the Trade page of the Cosmetics tab: the open trade rooms, join with a code, and make a room
function renderTradePage() {
  for (const b of document.querySelectorAll('#trListed .btn')) b.setAttribute('aria-pressed', String(!!+b.dataset.v === (M.trListed !== false)));
  renderRooms();
}
for (const b of document.querySelectorAll('#trListed .btn')) b.onclick = () => { M.trListed = !!+b.dataset.v; saveM(); renderTradePage(); };
$('#bTrCreate').onclick = () => startTrade(newCode(), M.trListed !== false);
$('#bTrJoin').onclick = () => startTrade(cleanCode($('#trCode').value));
$('#trCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#bTrJoin').click(); });

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
    const v = d.vs && BT.byId(d.vs.bot) && /^[wb]$/.test(d.vs.me) ? { bot: BT.byId(d.vs.bot).id, me: d.vs.me, paid: !!d.vs.paid } : null;   // paid: the game has ended once and paid out (then a move was taken back)
    return g.result ? null : { g, vs: v };
  } catch (e) { return null; }
}

// ------------------------------------------------------------------ installable app
// Only on a real web address: a downloaded copy opened from disk can't install or use a service worker.
$('#ver').textContent = `Version ${BUILD}${DEV ? ' DEV' : ''}`;
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
  glideTick(dt); thinkTick(now); fxTick(dt);
  cam.update(dt);
  if (!reduceMotion) looksTick(now / 1000);
  if (FLAT) for (const m of PIECES.children) m.rotation.z = cam.base;   // flat pictures face the side the view is on, and nothing else
  renderer.info.reset();
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  frames++;
}
addEventListener('resize', resize);
resize(); applyLook(); dress(); refit();
{ const s = loadSaved(); placeAll(s ? s.g : C.newGame()); }   // behind the menu: the game waiting to be resumed, or a fresh set
showCoins(); menuGo('home'); dailyGift();
requestAnimationFrame(frame);
{ // opening an invite link joins the room straight away
  const m = /#room=([A-Za-z0-9]+)/.exec(location.hash);
  if (m) { const code = cleanCode(m[1]); $('#netCode').value = code; if (relayBase()) startOnline(code); else { menuGo('online'); menuNote('Online play is unavailable: no relay address is set in config.js.'); } }
}
{ // and a trade room's link opens the room
  const m = /#trade=([A-Za-z0-9]+)/.exec(location.hash);
  if (m) { const code = cleanCode(m[1]); COS.page = 'trade'; menuGo('cos'); $('#trCode').value = code; startTrade(code); }
}
// for the browser tests: what the page is doing, without reaching into its internals
window.__rs = {
  get state() { return state; }, get frames() { return frames; }, get triangles() { return renderer.info.render.triangles; }, S, start: C.START,
  get fen() { return G ? C.toFen(G.pos) : ''; }, get moves() { return G ? G.list.map(x => x.san) : []; }, get result() { return G && G.result; },
  get sel() { return sel >= 0 ? C.sqName(sel) : ''; }, get view() { return { base: cam.base, yaw: cam.cur.yaw, off: cam.yawOff }; }, get flatAngles() { return FLAT ? [...new Set(PIECES.children.map(m => m.rotation.z))] : []; },
  get pieces() { return onSq.filter(Boolean).length; }, get taken() { return PIECES.children.length - onSq.filter(Boolean).length; },
  start2(fen) { startLocal(C.newGame(fen)); },   // a two-player game from a given position
  startCpu(bot, me, fen) { startGame(C.newGame(fen), { bot, me }); },   // a game against a bot, from a given position
  get vs() { return vs; }, set quick(v) { QUICK = !!v; },
  look(set, fin) { setLook(set, fin); }, sets: SETS.LIST.map(x => x.id), finishes: SETS.FINISHES.map(x => x.id), get tris() { return PIECES.children.reduce((n, m) => n + (m.geometry.index || m.geometry.attributes.position).count / 3, 0); }, icon: (k, c, w, h) => pieceIcon(k, c, w, h).toDataURL(),
  camSet(o) { Object.assign(cam, o); },
  fx(what, sq) { fx(what, sq === undefined ? undefined : C.sq(sq)); }, get bits() { return BITS.length; }, avatar: id => portrait(AVATARS[id], 4).src, avatars: Object.keys(AVATARS),
  wear(slot, id) { if (slot === 'set') setLook(id, S.finish); else if (slot === 'finish') setLook(S.set, id); else { W[slot] = id; applyBoard(); applyRoom(); applyMarks(); showMarks(); } }, get worn() { return { set: S.set, finish: S.finish, ...W }; },
  get lock() { return LOCK; }, lockerEdit, LK, DEVW, get dev() { return DEV; }, get earn() { return EARN; }, day(d) { dailyGift(d); }, get opening() { return OPENING && OPENING.stage; }, showPrize,
  get lookOf() { return { w: { set: lookOf('w').set, finish: lookOf('w').finish }, b: { set: lookOf('b').set, finish: lookOf('b').finish } }; }, get peerLook() { return NET.peerLook || null; },   // the view in a game: pitch, zoom, yawOff
  get pending() { return pending ? C.sqName(pending.from) + C.sqName(pending.to) + (pending.promo || '') : ''; }, get flat() { return FLAT; },
  get coords() { return topMat.map === (BOARD_TEX[(BOARDS[W.board] ? W.board : 'standard') + '+'] || {}).map; }, get soundCount() { return sfxCount; }, soundsFrom(n) { return SFX_LOG.slice(Math.max(0, SFX_LOG.length - (sfxCount - n))); }, get tab() { return SET.tab; }, get pitch() { return cam.cur.pitch; }, get marks() { return MARKS.children.length; },
  shape(k) { const b = SETS.geo(S.set, k).boundingBox; return { h: b.max.y, w: Math.max(b.max.x - b.min.x, b.max.z - b.min.z), low: b.min.y }; },   // a kind's size in the set in use, in metres
  mask(k) { const c = pieceIcon(k, 'w', 48, 60, true), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let m = ''; for (let i = 3; i < d.length; i += 4) m += d[i] ? 1 : 0; return m; },   // its outline from the front, filling the height, as filled or empty pixels
  get net() { return { on: NET.on, seat: NET.seat, me: NET.me, cid: NET.cid, code: NET.code, peer: NET.peer, link: NET.link, started: NET.started, peerName: NET.peerName, games: NET.games }; },
  send(o) { netSend(o); },   // a raw message, as a modified copy of the game could send
  get trade() { return { on: TR.on, code: TR.code, seat: TR.seat, peer: TR.peer, seen: TR.seen, link: TR.link, peerName: TR.peerName, inv: TR.inv, mine: TR.mine, theirs: TR.theirs, ready: TR.ready.slice(), counting: !!TR.count, sec: TR.sec, sent: !!TR.sent,
    asks: TR.asks.slice(), marks: TR.marks.slice(), side: TR.side, filter: TR.filter, onlyNew: TR.onlyNew, verBad: TR.verBad, flash: TR.flash, trades: TR.trades }; },
  set tradeSecs(n) { TR_SECS = n; }, tradeSend(o) { trSend(o); }, startTrade,
  squareScreen(name) {   // where a square's middle is on the screen, in page pixels
    const s = C.sq(name), v = new THREE.Vector3(sqX(s), 0.004, sqZ(s)).project(camera), r = canvas.getBoundingClientRect();
    return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
  },
};
})();
