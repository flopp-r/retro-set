// Retro Set's piece sets and finishes. A set is the shape of the six kinds of piece; a finish is what they're made of
// (the colours of the two sides, and how the surface takes the light). Any set can wear any finish. Every shape is
// built here from a few simple solids, in millimetres, as triangles in three slots: 0 the body, 1 the trim (collars,
// crowns, crosses and the like) and 2 the glow (lights, on the sets that have them). A finish gives each slot its
// material. Needs three.js (THREE), so it runs in the browser only; game.js uses it as SETS.
const SETS = (() => {
const T = THREE, PI = Math.PI;
const E = new T.Euler(), Q = new T.Quaternion(), M = new T.Matrix4(), V = new T.Vector3(), P0 = new T.Vector3(), S1 = new T.Vector3();

// ------------------------------------------------------------------ the modelling kit
// maker() is a piece under construction. at: [x, y, z] of the solid's middle (a lathe's or slab's origin);
// rot: [rx, ry, rz]; sc: [sx, sy, sz]. Model space: y up, the piece's front towards -z (knights' heads towards +x).
function maker() {
  const tri = [[], [], []];
  const put = (g0, slot, at, rot, sc) => {
    const g = g0.index ? g0.toNonIndexed() : g0, p = g.attributes.position;
    E.set(...(rot || [0, 0, 0])); M.compose(P0.set(...(at || [0, 0, 0])), Q.setFromEuler(E), S1.set(...(sc || [1, 1, 1])));
    for (let i = 0; i < p.count; i++) { V.fromBufferAttribute(p, i).applyMatrix4(M); tri[slot].push(V.x, V.y, V.z); }
    return m;
  };
  const clip = (poly, nx, ny, nz, d, sg) => {   // the part of a polygon on one side of a plane
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = sg * (a[0] * nx + a[1] * ny + a[2] * nz - d), db = sg * (b[0] * nx + b[1] * ny + b[2] * nz - d);
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
    }
    return out;
  };
  const m = {
    tri,
    box: (w, h, d, at, slot = 0, rot) => put(new T.BoxGeometry(w, h, d), slot, at, rot),
    cyl: (r0, r1, h, n, at, slot = 0, rot) => put(new T.CylinderGeometry(r1, r0, h, n), slot, at, rot),   // r0 at the bottom, r1 at the top
    ball: (r, at, slot = 0, sc, w = 6, h = 4) => put(new T.SphereGeometry(r, w, h), slot, at, null, sc),
    gem: (r, at, slot = 0, sc, rot) => put(new T.OctahedronGeometry(r), slot, at, rot, sc),
    ring: (r, tube, n, at, slot = 0, rot = [PI / 2, 0, 0], arc = 2 * PI) => put(new T.TorusGeometry(r, tube, 4, n, arc), slot, at, rot),   // lying flat unless turned
    // a side view (points [x, y]) given thickness, centred on z
    slab(outline, depth, at, slot = 0, rot, bevel = 0) {
      const g = new T.ExtrudeGeometry(new T.Shape(outline.map(([x, y]) => new T.Vector2(x, y))), { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 1, curveSegments: 1 });
      g.translate(0, 0, -depth / 2);
      return put(g, slot, at, rot);
    },
    // a profile of [radius, height, slot of the band up to this point] turned round the upright, with n flat sides
    lathe(pts, n, slot = 0, at = [0, 0, 0], a0 = 0) {
      const [ox, oy, oz] = at;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [r0, y0] = pts[i], [r1, y1, s] = pts[i + 1], t = tri[s === undefined ? slot : s];
        for (let j = 0; j < n; j++) {
          const a = a0 + j * 2 * PI / n, b = a0 + (j + 1) * 2 * PI / n, sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b);
          const A = [ox + r0 * sa, oy + y0, oz + r0 * ca], B = [ox + r0 * sb, oy + y0, oz + r0 * cb], Cc = [ox + r1 * sb, oy + y1, oz + r1 * cb], D = [ox + r1 * sa, oy + y1, oz + r1 * ca];
          if (r0 > 0) t.push(...A, ...B, ...D);
          if (r1 > 0) t.push(...B, ...Cc, ...D);
        }
      }
      return m;
    },
    // cuts away whatever lies inside every one of the planes ([nx, ny, nz, d]: inside is where n·p < d)
    carve(planes) {
      for (let s = 0; s < 3; s++) {
        const a = tri[s], keep = []; let rest = [];
        for (let i = 0; i < a.length; i += 9) rest.push([[a[i], a[i + 1], a[i + 2]], [a[i + 3], a[i + 4], a[i + 5]], [a[i + 6], a[i + 7], a[i + 8]]]);
        for (const [nx, ny, nz, d] of planes) {
          const next = [];
          for (const poly of rest) { const o = clip(poly, nx, ny, nz, d, 1), n = clip(poly, nx, ny, nz, d, -1); if (o.length > 2) keep.push(o); if (n.length > 2) next.push(n); }
          rest = next;
        }
        tri[s] = [];
        for (const poly of keep) for (let i = 1; i + 1 < poly.length; i++) tri[s].push(...poly[0], ...poly[i], ...poly[i + 1]);
      }
      return m;
    },
    merge(o) { for (let s = 0; s < 3; s++) for (const v of o.tri[s]) tri[s].push(v); return m; },
    // nudges every corner a little (the same corner always the same way), for a hand-cut look; the foot stays flat
    jitter(amt) {
      for (const t of tri) for (let i = 0; i < t.length; i += 3) {
        if (t[i + 1] < 0.5) continue;
        let h = (Math.round(t[i] * 20) * 73856093) ^ (Math.round(t[i + 1] * 20) * 19349663) ^ (Math.round(t[i + 2] * 20) * 83492791);
        for (let k = 0; k < 3; k++) { h = Math.imul(h ^ (h >>> 15), 2246822519) ^ (k + 1) * 374761393; t[i + k] += (((h >>> 8) & 1023) / 1023 - 0.5) * 2 * amt; }
      }
      return m;
    },
    geo() {
      const n = tri[0].length + tri[1].length + tri[2].length, pos = new Float32Array(n), g = new T.BufferGeometry();
      let o = 0;
      for (let s = 0; s < 3; s++) { if (tri[s].length) g.addGroup(o / 3, tri[s].length / 3, s); for (const v of tri[s]) pos[o++] = v * 0.001; }
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
      return g;
    },
  };
  return m;
}
// n things evenly round a circle of radius r: f(x, z, angle)
const round = (n, r, f, a0 = 0) => { for (let i = 0; i < n; i++) { const a = a0 + i * 2 * PI / n; f(Math.sin(a) * r, Math.cos(a) * r, a); } };
// the bishop's cut: a slot sloping down into one side of the head (or, with no slope, a cleft straight down from the
// top to height y), with a smaller copy of the head inside so the cut shows a floor rather than a hole. head(k) makes
// the head at k times its width; w is half the cut's width.
function mitre(m, head, y, w, slope = 0.62) {
  const c = Math.cos(slope), s = Math.sin(slope), d = c * y - s * 2;   // the cut's middle passes through (2, y), rising outwards
  m.merge(head(maker(), 1).carve(slope ? [[-s, c, 0, d + w], [s, -c, 0, w - d], [-1, 0, 0, 1]] : [[1, 0, 0, w], [-1, 0, 0, w], [0, -1, 0, -y]]));
  return slope ? m.merge(head(maker(), 0.72)) : m.box(2 * w + 0.6, 1.2, 15, [0, y, 0]);
}

// ------------------------------------------------------------------ classic
// Staunton shapes, each kind given one thing nothing else has: the pawn a plain ball, the bishop a tall pointed head
// with the cut, the rook battlements, the queen a ring of points, the king a big cross, the knight a horse's head.
const foot = rb => [[0, 0], [rb, 0], [rb, 4], [rb * 0.86, 6.5], [rb * 0.86, 9], [rb * 0.66, 12]];
const HORSE = [[-10, 0], [-11.5, 13], [-10, 27], [-7, 35], [-3.5, 41.5], [-1, 47], [1.5, 42], [6, 40], [13, 32], [17, 26.5], [16.5, 22], [10.5, 20.5], [5, 23.5], [6.5, 12], [10.5, 0]];
const classic = {
  P: m => m.lathe([...foot(14), [5, 21], [9.6, 23, 1], [9.6, 25.5, 1], [4.8, 27.5], [0, 27.5]], 12).ball(8.6, [0, 34, 0], 0, null, 8, 5),
  R: m => { m.lathe([...foot(16), [10.5, 16], [9.6, 34], [12.8, 37.5, 1], [12.8, 40, 1], [13.4, 41], [13.4, 45], [9.8, 45], [9.8, 42.5], [0, 42.5]], 12); round(6, 11.6, (x, z, a) => m.box(6.4, 5.5, 3.6, [x, 47.7, z], 0, [0, a, 0])); return m; },
  B: m => mitre(m.lathe([...foot(15.5), [8, 16.5], [5, 34], [10, 36, 1], [10, 38.5, 1], [5.4, 40]], 12),
    (h, k) => h.lathe([[5.4 * k, 40], [8.4 * k, 44], [9.8 * k, 50], [9 * k, 56.5], [6.2 * k, 62.5], [2.8 * k, 67.5], [0, 70.5]], 12), 55.5, 1.4).ball(2.6, [0, 71.8, 0], 1, null, 6, 4),
  Q: m => { m.lathe([...foot(18), [9.8, 17.5], [6, 44], [11, 46.5, 1], [11, 49, 1], [6.8, 50.5], [6.4, 54], [11.8, 66], [11.8, 67.5], [8, 67.5], [5, 71.5], [0, 72.5]], 12); round(8, 10.4, (x, z) => m.gem(2.4, [x, 69.6, z], 1, [1, 1.5, 1])); return m.ball(3.2, [0, 75.2, 0], 1, null, 6, 4); },
  K: m => m.lathe([...foot(19), [10.6, 18.5], [6.6, 50], [11.5, 52.5, 1], [11.5, 55, 1], [7.4, 56.5], [7, 60], [10.6, 72], [9.6, 74], [5, 75.5], [0, 75.5]], 12).box(4.4, 17, 4.4, [0, 84, 0], 1).box(14.5, 4.4, 4.4, [0, 86, 0], 1),
  N: m => m.lathe([...foot(16), [10.5, 16.5], [10.5, 19, 1], [0, 19, 1]], 12).slab(HORSE, 11, [0, 19, 0], 0, null, 1.2),
};

// ------------------------------------------------------------------ ornate
// The classic shapes dressed up: turned (baluster) stems, double collars, a ring of beads round every foot, a mane on
// the knight, an arched crown on the king. The trim carries most of it.
const ofoot = rb => [[0, 0], [rb, 0], [rb, 3], [rb * 0.9, 4.5], [rb * 0.9, 7, 1], [rb * 0.76, 8.5], [rb * 0.78, 11], [rb * 0.58, 14]];
const beads = (m, rb) => { round(12, rb * 0.92, (x, z) => m.gem(1.5, [x, 5.7, z], 1)); return m; };
const collars = (r, y, n) => [[r, y, 1], [r, y + 1.6, 1], [r * 0.62, y + 2.6], [r * 0.84, y + 3.6, 1], [r * 0.84, y + 4.8, 1], [n, y + 5.8]];
const MANE = [[-10.5, 12], [-14, 15], [-12, 19], [-15, 23], [-12.5, 27], [-14.5, 31], [-11, 34], [-12, 38.5], [-7.5, 40], [-7.5, 44.5], [-3, 44], [-3.5, 41.5], [-7, 35], [-10, 27], [-11.5, 13]];
const ornate = {
  P: m => beads(m, 14.5).lathe([...ofoot(14.5), [5.4, 17], [7.4, 20.5], [4.6, 24.5], ...collars(9.6, 26, 4.6), [0, 31.8]], 12).ball(8, [0, 38.2, 0], 0, null, 8, 5).ring(8.1, 0.9, 10, [0, 38.2, 0], 1),
  R: m => { beads(m, 16.5).lathe([...ofoot(16.5), [10.6, 15], [9, 22], [9.6, 24, 1], [9.6, 26, 1], [9, 28], [9.8, 36], [13, 40, 1], [13.8, 42, 1], [13.8, 47.5], [10.4, 47.5], [10.4, 44], [0, 44]], 12); round(8, 12.1, (x, z, a) => m.box(5, 5.5, 3.4, [x, 50.2, z], 1, [0, a, 0])); return m; },
  B: m => mitre(beads(m, 16).lathe([...ofoot(16), [6, 17], [8.2, 22], [4.8, 30], [4.6, 37], ...collars(10, 39, 5.4)], 12),
    (h, k) => h.lathe([[5.4 * k, 44.8], [7.6 * k, 48], [9 * k, 53, k === 1 ? 1 : 0], [9 * k, 55, k === 1 ? 1 : 0], [8 * k, 60], [5.4 * k, 66], [2.6 * k, 71], [0, 73.5]], 12), 61, 1.3).ball(2.6, [0, 74.8, 0], 1, null, 6, 4).gem(1.6, [0, 78.2, 0], 1, [1, 1.8, 1]),
  Q: m => {
    beads(m, 18.5).lathe([...ofoot(18.5), [6.8, 18], [9.4, 24], [5.4, 34], [5.2, 44], ...collars(11, 46, 6.6), [6.2, 55.5], [9, 62], [12.2, 68, 1], [12.2, 70, 1], [8.4, 70], [5.2, 74.5, 1], [0, 75.5, 1]], 12);
    round(8, 11, (x, z, a) => { m.cyl(1.9, 0.5, 6.5, 4, [x * 1.04, 73.2, z * 1.04], 1, [0, a, 0]); m.ball(1.5, [x * 1.07, 77.3, z * 1.07], 1, null, 5, 3); });
    return m.ball(3.3, [0, 78.4, 0], 1, null, 6, 4).gem(1.7, [0, 83, 0], 1, [1, 1.7, 1]);
  },
  K: m => {
    beads(m, 19.5).lathe([...ofoot(19.5), [7.4, 18.5], [10, 25], [5.8, 36], [5.6, 49], ...collars(11.6, 51, 7.2), [7, 60.5], [10.8, 70, 1], [11.4, 72, 1], [11.4, 74.5, 1], [10, 75.5], [6, 79], [0, 80.5]], 12);
    round(4, 7.2, (x, z, a) => m.box(2, 2, 11, [x, 80.2, z], 1, [0.62, a, 0]), PI / 4);   // the crown's arches
    round(8, 11.5, (x, z) => m.gem(1.5, [x, 76.6, z], 1, [1, 1.6, 1]));
    return m.ball(3.2, [0, 85.2, 0], 1, null, 6, 4).box(3.6, 13, 3.6, [0, 93.5, 0], 1).box(12, 3.6, 3.6, [0, 94.5, 0], 1).box(5.6, 2.2, 4, [0, 99.6, 0], 1).box(2.2, 5.6, 4, [-5.6, 94.5, 0], 1).box(2.2, 5.6, 4, [5.6, 94.5, 0], 1);
  },
  N: m => beads(m, 16.5).lathe([...ofoot(16.5), [10.6, 16], [11.4, 17.5, 1], [11.4, 19.5, 1], [10, 21], [0, 21]], 12).slab(HORSE, 11, [0, 21, 0], 0, null, 1.2).slab(MANE, 5, [0, 21, 0], 1)
    .box(3.2, 1.6, 12.6, [10.5, 49.6, 0], 1, [0, 0, -0.9]).box(1.6, 9, 12.6, [5.6, 53, 0], 1, [0, 0, 0.5]),   // the bridle: a noseband and a cheek strap
};

// ------------------------------------------------------------------ minimal
// Plain turned forms with no collars or mouldings: each kind is one clean shape and one mark on top.
const minimal = {
  P: m => m.lathe([[0, 0], [11, 0], [6, 21], [0, 21]], 16).ball(8.4, [0, 26, 0], 0, null, 10, 6),
  R: m => { m.lathe([[0, 0], [13, 0], [13, 37], [0, 37]], 16); for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) m.box(8.6, 7, 8.6, [x * 6.3, 40.5, z * 6.3]); return m; },
  B: m => mitre(m.lathe([[0, 0], [12, 0], [7, 40]], 16), (h, k) => h.lathe([[7 * k, 40], [9.4 * k, 46], [8.6 * k, 54], [4.6 * k, 62], [0, 68]], 16), 53.5, 1.7),
  Q: m => m.lathe([[0, 0], [13, 0], [6, 50], [13.6, 63], [13.6, 64.5], [10.5, 64.5], [0, 59]], 16).ball(5.6, [0, 65, 0], 1, null, 10, 6),
  K: m => m.lathe([[0, 0], [14, 0], [6.6, 56], [10.5, 66], [10.5, 68], [0, 68]], 16).box(5, 17, 5, [0, 76.5, 0], 1).box(15, 5, 5, [0, 78, 0], 1),
  N: m => m.lathe([[0, 0], [13, 0], [12.4, 6], [0, 6]], 16).slab([[-10, 0], [-10, 30], [-3.5, 50], [5, 48], [15.5, 36], [14, 28], [5.5, 30], [7, 0]], 14, [0, 6, 0]),
};

// ------------------------------------------------------------------ blocks
// Every piece stacked from little cubes (4.4 mm), like 3D pixel art. A layer is [width, how many cubes high, slot].
const U = 4.4;
const stack = (m, layers, y = 0) => { for (const [w, n = 1, s = 0] of layers) { m.box(w * U, n * U, w * U, [0, (y + n / 2) * U, 0], s); y += n; } return y; };
const cubes = (m, list, s = 0) => { for (const [x, y, z, w = 1, h = 1, d = w] of list) m.box(w * U, h * U, d * U, [x * U, (y + h / 2) * U, z * U], s); return m; };
const NAG = ['..#....', '.###...', '.####..', '.#####.', '.######', '.###.##', '.###...', '.####..', '.####..'];   // the knight from the side, top row first
const blocks = {
  P: m => { stack(m, [[5], [3, 2], [5, 1, 1], [3], [5, 3]]); return m; },
  R: m => { const y = stack(m, [[7], [5, 5], [7, 1, 1], [7]]); return cubes(m, [[2.5, y, 2.5, 2, 1.5], [2.5, y, -2.5, 2, 1.5], [-2.5, y, 2.5, 2, 1.5], [-2.5, y, -2.5, 2, 1.5]]); },
  B: m => { const y = stack(m, [[7], [5], [3, 5], [5, 1, 1], [3]]); cubes(m, [[-1.5, y, 0, 2, 3, 5], [1.5, y, 0, 2, 3, 5], [0, y, 0, 1, 1, 5]]); stack(m, [[3, 2], [1, 2, 1]], y + 3); return m; },   // the cut: a gap down the head
  Q: m => { const y = stack(m, [[7], [5], [3, 8], [5, 1, 1], [3], [5], [7]]); cubes(m, [[3, y, 3], [3, y, -3], [-3, y, 3], [-3, y, -3], [3, y, 0], [-3, y, 0], [0, y, 3], [0, y, -3]], 1); stack(m, [[3], [1, 2, 1]], y); return m; },
  K: m => { const y = stack(m, [[7], [5], [3, 9], [5, 1, 1], [3], [5], [7, 2]]); return cubes(m, [[0, y, 0, 1, 5], [0, y + 2.5, 0, 3, 1, 1]], 1); },
  N: m => {
    const y = stack(m, [[7], [5]]);
    NAG.forEach((row, j) => { for (let a = 0; a < 7; a++) { if (row[a] !== '#') continue; let b = a; while (row[b + 1] === '#') b++; cubes(m, [[(a + b) / 2 - 3, y + NAG.length - 1 - j, 0, b - a + 1, 1, 3]]); a = b; } });
    return cubes(m, [[1, y + 5, 0, 1, 1, 3.4]], 1);   // an eye
  },
};

// ------------------------------------------------------------------ figures
// Little medieval people on round stands: a foot soldier with shield and spear, a castle tower with a flag, a rider on
// a horse, a bishop with mitre and crook, a queen in a wide gown, a king with crown, cape and sword.
const stand = (m, rb, sx = 1) => { const s = maker().lathe([[0, 0], [rb, 0], [rb, 3], [rb * 0.86, 4.5], [0, 4.5]], 10); for (let i = 0; i < s.tri[0].length; i += 3) s.tri[0][i] *= sx; return m.merge(s); };
const figures = {
  P: m => stand(m, 13).lathe([[8, 4.5], [6, 17], [6.6, 23], [3, 25.5], [0, 25.5]], 8).ball(5, [0, 29.5, 0])
    .cyl(7.4, 7, 1.3, 8, [0, 32.4, 0], 1).cyl(5.2, 0.6, 5.6, 8, [0, 35.6, 0], 1)                    // a kettle helmet
    .box(9.5, 12, 1.6, [-2.5, 15.5, -7], 1, [0.12, 0, 0]).gem(2, [-2.5, 15.5, -8], 0, [1, 1, 0.5])   // the shield and its boss
    .box(1.4, 33, 1.4, [8.2, 21, -1.5]).gem(1.9, [8.2, 39.5, -1.5], 1, [1, 2.2, 1]),               // the spear
  R: m => {
    stand(m, 16).lathe([[12.4, 4.5], [10.6, 37], [13.4, 40.5, 1], [13.4, 45], [0, 45]], 8, 0, [0, 0, 0], PI / 8);
    round(4, 11.4, (x, z, a) => m.box(8.4, 6, 4.4, [x, 48, z], 0, [0, a, 0]));
    m.box(6.4, 11, 1.6, [0, 10, -11.4], 1).box(1.6, 6, 1.6, [0, 28, -10.6], 1).box(1.6, 6, 1.6, [10.6, 28, 0], 1).box(1.6, 6, 1.6, [-10.6, 28, 0], 1);   // the door and arrow slits
    return m.box(1.3, 15, 1.3, [0, 52.5, 0]).box(8, 5, 0.9, [4.4, 57.2, 0], 1);                      // the flag
  },
  N: m => stand(m, 15.5, 1.18)
    .box(25, 10.5, 9.5, [0, 23.2, 0]).box(13.5, 7, 10.4, [-4, 24.4, 0], 1)                           // the horse and its cloth
    .box(3.4, 14, 3.4, [9, 11.5, 3]).box(3.4, 14, 3.4, [9, 11.5, -3]).box(3.4, 14, 3.4, [-9.5, 11.5, 3]).box(3.4, 14, 3.4, [-9.5, 11.5, -3])
    .box(6.4, 15, 6.6, [12.4, 32.4, 0], 0, [0, 0, -0.5]).box(11, 6, 6, [18.4, 38.4, 0], 0, [0, 0, -0.42])   // neck and head
    .box(1.8, 4, 1.6, [14.6, 43.6, 2]).box(1.8, 4, 1.6, [14.6, 43.6, -2]).box(1.8, 12, 5.6, [9.4, 36, 0], 1, [0, 0, -0.5])   // ears, mane
    .box(3, 11, 3, [-14, 22.4, 0], 0, [0, 0, -0.45])                                                 // tail
    .box(7, 12, 8.4, [-3.4, 34.4, 0]).ball(4.2, [-3.4, 44.2, 0]).cyl(4.9, 4.4, 4.4, 6, [-3.4, 46.6, 0], 1).gem(1.8, [-3.4, 51, 0], 1, [1, 2, 1])   // the rider, helmet and plume
    .box(8.4, 10, 1.5, [-3, 33.4, -5.4], 1).box(1.3, 34, 1.3, [1, 40, 5.4], 1, [0, 0, -0.5]),          // shield and lance
  B: m => stand(m, 14.5).lathe([[10, 4.5], [7, 30], [6.6, 41], [7.8, 44], [3.6, 47.5], [0, 47.5]], 8).ball(5.2, [0, 51.6, 0])
    .gem(6.4, [0, 59.4, 0], 1, [1, 1.3, 0.56]).box(1.6, 11, 4, [0, 58.8, 0], 0)                      // the mitre and its band
    .box(3.2, 33, 1.2, [0, 25.5, -7.4], 1, [-0.085, 0, 0])                                           // a stole down the front
    .box(1.5, 51, 1.5, [10, 30, -1]).ring(3.6, 0.95, 7, [6.4, 55.5, -1], 1, [0, 0, -0.6], 1.55 * PI),   // the crook
  Q: m => {
    stand(m, 16).lathe([[13.4, 4.5], [12.2, 10, 1], [5.4, 42], [7.6, 50], [3.8, 54], [0, 54]], 10).ball(5.4, [0, 58.9, 0]);
    m.box(10.4, 17, 3.4, [0, 53.5, 5]).ring(6.4, 1, 8, [0, 51.1, 0], 1);                             // hair, a necklace
    m.cyl(5, 5.6, 3.4, 8, [0, 64.5, 0], 1); round(5, 5, (x, z) => m.gem(1.5, [x, 67.9, z], 1, [1, 1.9, 1]));
    return m;
  },
  K: m => {
    stand(m, 16.5).lathe([[12.6, 4.5], [8.6, 45], [10.2, 52], [10.2, 56, 1], [4.6, 59.5, 1], [0, 59.5]], 8).ball(6, [0, 64.6, 0]);
    m.box(15.5, 45, 2.2, [0, 31, 8.2], 1, [0.1, 0, 0]).box(6.6, 5.6, 3, [0, 60.6, -4.6]);             // a cape, a beard
    m.cyl(6.4, 7.2, 5, 8, [0, 71.4, 0], 1); round(4, 6.5, (x, z) => m.gem(1.7, [x, 75.4, z], 1, [1, 1.9, 1]), PI / 4);
    m.box(2, 9, 2, [0, 78.4, 0], 1).box(6.4, 2, 2, [0, 79.6, 0], 1);
    return m.box(2.2, 27, 1.3, [0, 18, -11.4], 0, [-0.1, 0, 0]).box(9, 1.8, 1.8, [0, 32.4, -10], 1).box(1.8, 5, 1.8, [0, 35.6, -9.7], 1);   // the sword
  },
};

// ------------------------------------------------------------------ sci-fi
// Six-sided machines with lights (the glow slot): a hovering drone, a gun turret, a walker's head, a signal spire with
// a tilted ring, a queen with a ring of spikes round a floating core, a king with an aerial and a halo.
const pad = (m, rb) => m.lathe([[0, 0], [rb, 0], [rb, 2.5], [rb * 0.8, 5], [rb * 0.8, 6.5, 2], [rb * 0.55, 6.5], [0, 6.5]], 6);
const scifi = {
  P: m => pad(m, 13).cyl(2.6, 2.6, 14, 6, [0, 13.5, 0], 1).lathe([[0, 18], [9, 22], [10.4, 25], [10.4, 27.5, 2], [9, 30.5], [5, 34], [0, 34]], 6),
  R: m => {
    pad(m, 16).lathe([[13, 6.5], [11, 22], [11.2, 25, 2], [10.6, 30], [13.6, 33.5, 1], [13.6, 39], [10.6, 39], [10.6, 36.5], [0, 36.5]], 6);
    round(6, 12.2, (x, z, a) => m.box(4.2, 6.5, 3.4, [x, 42.2, z], 0, [0, a, 0]), PI / 6);
    return m.cyl(2, 2, 4, 6, [0, 38.5, 0], 2);
  },
  N: m => pad(m, 15).cyl(3.4, 3.4, 9, 6, [-2, 11, 0], 1)
    .slab([[-9, 0], [-12, 20], [-6, 34], [3, 39], [19, 30], [20, 25], [8.5, 21.5], [4, 13], [7, 0]], 11, [0, 14, 0], 0, null, 1)
    .slab([[-10, 22], [-17, 40], [-4.5, 35.5]], 3, [0, 14, 0], 1).box(4.6, 2.6, 13.6, [9, 44.6, 0], 2, [0, 0, -0.52]),   // a fin and the eye
  B: m => pad(m, 14).lathe([[9, 6.5], [4.6, 30], [4.4, 42], [0, 42]], 6).lathe([[0, 41], [6.6, 50], [3.4, 62, 1], [0, 71, 2]], 6)
    .ring(10.5, 1.1, 6, [0, 49, 0], 2, [PI / 2 - 0.5, 0, 0.42]),
  Q: m => {
    pad(m, 17).lathe([[11, 6.5], [5.4, 44], [5.6, 46.5, 2], [9, 54], [12, 58, 1], [12, 60, 1], [7, 60], [0, 57]], 6);
    round(6, 10.6, (x, z, a) => m.cyl(1.9, 0.3, 13, 4, [x * 1.12, 65.6, z * 1.12], 1, [0.22, a, 0]), PI / 6);
    return m.gem(4.8, [0, 68, 0], 2, [1, 1.35, 1]);
  },
  K: m => {
    pad(m, 18).lathe([[12, 6.5], [6.4, 48], [6.6, 50.5, 2], [10, 58], [11.4, 61, 1], [11.4, 66, 1], [8, 68], [0, 68]], 6);
    m.box(3.2, 23, 3.2, [0, 79.5, 0], 1).box(14.5, 3.2, 3.2, [0, 82, 0], 1);
    m.gem(2.2, [0, 92.4, 0], 2).gem(2.2, [8.6, 82, 0], 2).gem(2.2, [-8.6, 82, 0], 2);
    return m.ring(10.4, 1.1, 6, [0, 72.5, 0], 2);
  },
};

// ------------------------------------------------------------------ carved
// Short, heavy pieces with eight flat sides, every corner cut a little unevenly as if by hand.
const cfoot = rb => [[0, 0], [rb, 0], [rb, 5], [rb * 0.8, 8]];
const NAG_C = [[-12, 0], [-13.5, 14], [-10.5, 26], [-4.5, 32], [-1, 37.5], [2.5, 32], [9, 30], [17, 22], [17, 15.5], [10, 13], [6, 16.5], [8.5, 0]];
const carved = {
  P: m => m.lathe([...cfoot(14), [7.6, 13], [10.4, 15, 1], [10.4, 17.5, 1], [6.4, 19], [0, 19]], 8).ball(8.6, [0, 25.2, 0], 0, null, 8, 4),
  R: m => { m.lathe([...cfoot(17), [12.6, 24], [15.6, 27.5, 1], [15.6, 32], [0, 32]], 8, 0, [0, 0, 0], PI / 8); round(4, 11.8, (x, z, a) => m.box(10.5, 7, 6, [x, 35.5, z], 0, [0, a, 0])); return m; },
  B: m => mitre(m.lathe([...cfoot(16), [9, 24], [11.6, 26, 1], [11.6, 28.8, 1], [8.4, 30]], 8),
    (h, k) => h.lathe([[8.4 * k, 30], [11.4 * k, 36], [11.4 * k, 44], [9.4 * k, 53], [5.4 * k, 60], [0, 61]], 8), 45, 3, 0),   // cleft straight down: two horns
  Q: m => { m.lathe([...cfoot(17), [9.4, 30], [12.6, 32.5, 1], [12.6, 35, 1], [9, 36.5], [14, 49], [14, 51], [8.5, 51], [0, 54]], 8); round(8, 12.2, (x, z) => m.gem(3, [x, 52.6, z], 1, [1, 1.4, 1]), PI / 8); return m.ball(4.6, [0, 58.4, 0], 1, null, 6, 4); },
  K: m => m.lathe([...cfoot(18), [10.4, 36], [13.6, 38.5, 1], [13.6, 41.2, 1], [10, 42.6], [12.8, 52], [11.6, 54.5], [0, 54.5]], 8).box(6, 16, 6, [0, 62.5, 0], 1).box(16, 5.6, 6, [0, 64, 0], 1),
  N: m => m.lathe([...cfoot(16.5), [13, 9.5], [0, 9.5]], 8).slab(NAG_C, 15, [0, 9.5, 0], 0, null, 1.6),
};
const ROUGH = { carved: 0.55 };   // how far each corner is nudged, in mm
const STRETCH = { figures: [1.25, 1.06, 1.25], figuresN: [1.08, 1.06, 1.25] };   // the little people made stockier, so they read from above (the horse less so: it's long already)

// ------------------------------------------------------------------ the lists
const LIST = [
  { id: 'classic', name: 'Classic', make: classic }, { id: 'ornate', name: 'Ornate', make: ornate }, { id: 'minimal', name: 'Minimal', make: minimal },
  { id: 'blocks', name: 'Blocks', make: blocks }, { id: 'figures', name: 'Figures', make: figures }, { id: 'scifi', name: 'Sci-fi', make: scifi },
  { id: 'carved', name: 'Carved', make: carved },
];
const byId = id => LIST.find(s => s.id === id) || LIST[0];
const GEO = {};
// the shape of one kind of piece ('P', 'N', 'B', 'R', 'Q' or 'K') in a set, made once
function geo(set, kind) {
  const s = byId(set), key = s.id + kind;
  if (!GEO[key]) {
    const m = s.make[kind](maker()), k = STRETCH[key] || STRETCH[s.id];
    if (k) for (const t of m.tri) for (let i = 0; i < t.length; i++) t[i] *= k[i % 3];
    if (ROUGH[s.id]) m.jitter(ROUGH[s.id]);
    GEO[key] = m.geo();
  }
  return GEO[key];
}

// Finishes. For each side (w, b): the body, trim and glow colours, and dark, a little light of its own so a dark piece
// never goes flat black. lit and trimLit: how much of the glow's and the trim's colour shines by itself (0 to 1);
// shine: a polished surface that catches the lamp (none for matt), gloss how tight its highlights are, spec their colour;
// anim: a finish that moves (tick()). The ids and names match the Finish slot in looks.js.
const FINISHES = [
  { id: 'classic', name: 'Classic', w: { body: '#efe1c3', trim: '#b98a4e', glow: '#ffc56b' }, b: { body: '#4b446e', trim: '#d9b877', glow: '#6cb8ff', dark: '#0c0a18' } },
  { id: 'wood', name: 'Wood', w: { body: '#edd6a6', trim: '#a8743c', glow: '#ffe9a8' }, b: { body: '#6a3c22', trim: '#2e1a10', glow: '#ff9a4a', dark: '#120905' } },
  { id: 'chalk', name: 'Chalk', w: { body: '#f4f1ea', trim: '#c9c2b4', glow: '#ffffff' }, b: { body: '#474b54', trim: '#25272d', glow: '#aab4c4', dark: '#0a0b0d' } },
  { id: 'sea', name: 'Sea', w: { body: '#e6f4f7', trim: '#7fc4d8', glow: '#bff2ff' }, b: { body: '#24597f', trim: '#8fd0e8', glow: '#6fe0ff', dark: '#061018' } },
  { id: 'forest', name: 'Forest', w: { body: '#f1ead0', trim: '#8a9a4a', glow: '#e0f0a0' }, b: { body: '#34633a', trim: '#c9b060', glow: '#b8f08a', dark: '#07100a' } },
  { id: 'marble', name: 'Marble', shine: 0.22, w: { body: '#eceae4', trim: '#9aa3ad', glow: '#bfe6ff' }, b: { body: '#3f5550', trim: '#cfae6a', glow: '#8ff0c8', dark: '#07100e' } },
  { id: 'metal', name: 'Metal', shine: 0.6, w: { body: '#c4cbd6', trim: '#eef2f8', glow: '#8fd8ff', gloss: 24 }, b: { body: '#7a5230', trim: '#d9a94a', glow: '#ffb060', gloss: 24, spec: '#ffd9a0', dark: '#140c05' } },
  { id: 'ember', name: 'Ember', w: { body: '#f6e6cf', trim: '#d9703a', glow: '#ffc08a' }, b: { body: '#822424', trim: '#ffb347', glow: '#ff7a3a', dark: '#160505' } },
  { id: 'candy', name: 'Candy', w: { body: '#ffd9e6', trim: '#ffffff', glow: '#fff0a8' }, b: { body: '#2f8578', trim: '#d6fff2', glow: '#a8fff0', dark: '#081816' } },
  { id: 'neon', name: 'Neon', lit: 0.9, trimLit: 0.55, w: { body: '#cfd6e6', trim: '#35e0ff', glow: '#b8fbff' }, b: { body: '#2a2140', trim: '#ff4fb4', glow: '#ffb3e6', dark: '#0b0814' } },
  { id: 'ice', name: 'Ice', shine: 0.5, w: { body: '#eaf7ff', trim: '#9fdcff', glow: '#ffffff', gloss: 60 }, b: { body: '#2c5490', trim: '#bfe6ff', glow: '#8fd8ff', gloss: 60, dark: '#060c18' } },
  { id: 'obsidian', name: 'Obsidian', shine: 0.7, w: { body: '#e9dfc9', trim: '#b7a27a', glow: '#fff0c8', gloss: 50 }, b: { body: '#2f2a3c', trim: '#9288b4', glow: '#c8b8ff', gloss: 80, spec: '#cfc8ff', dark: '#0a0810' } },
  { id: 'royal', name: 'Royal', shine: 0.25, trimLit: 0.25, w: { body: '#f7efdc', trim: '#e0b040', glow: '#fff0a0' }, b: { body: '#45246c', trim: '#f0c048', glow: '#ffd870', dark: '#0c0616' } },
  { id: 'circuit', name: 'Circuit', lit: 0.9, trimLit: 0.5, w: { body: '#d9dfd6', trim: '#2fd27a', glow: '#8fffc0' }, b: { body: '#24322a', trim: '#39ff8a', glow: '#b8ffd6', dark: '#060a08' } },
  { id: 'rainbow', name: 'Rainbow', anim: 'rainbow', lit: 0.8, trimLit: 0.5, w: { body: '#f6f2ff', trim: '#ff6f8f', glow: '#ffc56b' }, b: { body: '#2d2746', trim: '#6cb8ff', glow: '#7dffb0', dark: '#0b0814' } },
  { id: 'molten', name: 'Molten', anim: 'molten', lit: 0.9, trimLit: 0.6, w: { body: '#ffe9c4', trim: '#ffb347', glow: '#fff0a0' }, b: { body: '#33191a', trim: '#ff5a1a', glow: '#ffb060', dark: '#120605' } },
];
const finish = id => FINISHES.find(f => f.id === id) || FINISHES[0];
const MATS = {};
function mats(fin, c) {
  const f = finish(fin), key = f.id + c;
  if (!MATS[key]) {
    const d = f[c], shine = d.shine === undefined ? f.shine || 0 : d.shine;
    const mk = (col, glow) => {
      const o = { color: col, flatShading: true, side: T.DoubleSide };
      if (glow) o.emissive = new T.Color(col).multiplyScalar(glow); else if (d.dark) o.emissive = d.dark;
      return shine ? new T.MeshPhongMaterial({ ...o, specular: new T.Color(d.spec || '#ffffff').multiplyScalar(shine), shininess: d.gloss || 40 }) : new T.MeshLambertMaterial(o);
    };
    MATS[key] = [mk(d.body), mk(d.trim, f.trimLit), mk(d.glow, f.lit === undefined ? 0.5 : f.lit)];
  }
  return MATS[key];
}
// The two finishes that move: Rainbow's trim and lights drift round the colours (the two sides half a turn apart), and
// Molten's glow swells and fades. Slowly: nothing changes faster than about once every three seconds. t in seconds.
function tick(t) {
  for (const key in MATS) {
    const f = finish(key.slice(0, -1)), c = key.slice(-1); if (!f.anim) continue;
    const [, trim, glow] = MATS[key];
    if (f.anim === 'rainbow') { const h = (t * 0.05 + (c === 'b' ? 0.5 : 0)) % 1; trim.color.setHSL(h, 0.85, 0.6); trim.emissive.setHSL(h, 0.85, 0.3); glow.color.setHSL((h + 0.15) % 1, 0.9, 0.7); glow.emissive.setHSL((h + 0.15) % 1, 0.9, 0.5); }
    else { const p = 0.5 + 0.35 * Math.sin(t * 1.3 + (c === 'b' ? 2 : 0)); trim.emissive.set(f[c].trim).multiplyScalar(p); glow.emissive.set(f[c].glow).multiplyScalar(Math.min(1, p + 0.25)); }
  }
}
return { LIST, FINISHES, byId, finish, geo, mats, tick };
})();
