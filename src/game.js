// Retro Set in the browser: rendering, camera, menus and the installable app. For now the room and an empty board
// stand behind the title screen while the game itself is agreed with the owner (see AGENTS.md and HANDOVER.md).
(() => {
'use strict';
const C = CORE;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const BUILD = '__BUILD__';   // version: tools/build.js fills in a fingerprint of the game code
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ settings
// pixel: game pixels are this many screen pixels across (0 is Max: one per real screen pixel); levels: shades per
// colour channel (256 is full colour; fewer turns on the dithering)
const DEFAULTS = { pixel: 1, levels: 256, dither: true, outline: true };
const S = { ...DEFAULTS };
try { Object.assign(S, JSON.parse(localStorage.getItem('retroSet.settings') || '{}')); } catch (e) {}

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
  frameBoard();
}
// the board sits in the space the menu panel leaves: to its right, or below it on an upright phone; further away when
// the screen is narrower than it is tall, so it still fits across
function frameBoard() {
  const r = $('#menuPanel').getBoundingClientRect(), tall = innerWidth <= 560;
  const sx = tall ? 0 : clamp((r.right + innerWidth) / 2 / innerWidth - 0.5, 0, 0.25);
  const sy = tall ? clamp((r.bottom + innerHeight) / 2 / innerHeight - 0.5, 0, 0.3) : 0;
  camera.setViewOffset(VW, VH, -sx * VW, -sy * VH, VW, VH);
  cam.dist = 1.05 * Math.max(1, 0.9 / camera.aspect);
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
const sun = new THREE.DirectionalLight(0xfff0d8, 0.4 * PI); sun.position.set(0.6, 3, 1.2); scene.add(sun);
const lamp = new THREE.PointLight(0xffdca4, 1.1 * PI, 5, 0.43); lamp.position.set(0, 0.7, 0); scene.add(lamp);
const FLOOR_Y = -0.75;   // the floor reaches past the fog, so its edge never shows
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ color: 0x2a1d40 }));
  floor.rotation.x = -PI / 2; floor.position.y = FLOOR_Y; scene.add(floor);
}

// ------------------------------------------------------------------ board (placeholder)
// An empty board on a small table, so the build, the picture and the tests have something real to draw. The sizes
// and colours are placeholders until the board is designed: squares of 5.7 cm (a club board), a 3 cm border.
const SQ = 0.057, BORDER = 0.03, B = 8 * SQ + 2 * BORDER;
const squaresTex = canvasTex(8, 8, (g) => {
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { g.fillStyle = (r + f) & 1 ? '#5a3b78' : '#d8c3a0'; g.fillRect(f, r, 1, 1); }
});
const woodMat = new THREE.MeshLambertMaterial({ color: 0x6b3a22 });
{
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24), woodMat);
  table.position.y = -0.04; scene.add(table);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, -FLOOR_Y - 0.06, 8), woodMat);
  leg.position.y = (FLOOR_Y - 0.06) / 2; scene.add(leg);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(B, 0.02, B), new THREE.MeshLambertMaterial({ color: 0x3a2452 }));
  frame.position.y = -0.01; scene.add(frame);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(8 * SQ, 8 * SQ), new THREE.MeshLambertMaterial({ map: squaresTex }));
  top.rotation.x = -PI / 2; top.position.y = 0.0005; scene.add(top);   // a light square at each player's right (h1 and a8)
}

// ------------------------------------------------------------------ camera
// behind the menu the view circles the board slowly; with reduced motion it holds still
const cam = { a: 0.5, dist: 1.05, h: 0.62,
  update(dt) {
    if (!reduceMotion) this.a += dt * 0.08;
    camera.position.set(Math.sin(this.a) * this.dist, this.h * this.dist / 1.05, Math.cos(this.a) * this.dist);   // the same angle down from further away
    camera.lookAt(0, -0.02, 0);
  } };

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
let state = 'menu', frames = 0, lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  cam.update(dt);
  renderer.info.reset();
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  frames++;
}
addEventListener('resize', resize);
resize(); applyLook();
if (document.fonts) document.fonts.ready.then(frameBoard);   // the panel's height can change once the fonts are in
requestAnimationFrame(frame);
// for the browser tests: what the page is doing, without reaching into its internals
window.__rs = { get state() { return state; }, get frames() { return frames; }, get triangles() { return renderer.info.render.triangles; }, S, start: C.START };
})();
