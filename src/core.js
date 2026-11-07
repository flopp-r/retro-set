// ============================================================================
//  RETRO SET — core: the chess rules and the computer player
// ============================================================================
// No DOM here: this file also runs in Node, for the tests and tools. Squares are numbered 0 to 63, a1 = 0, b1 = 1 …
// h8 = 63 (rank × 8 + file). A position is { b, turn, castle, ep, half, full }: b is 64 strings, a piece letter
// ('PNBRQK' White, 'pnbrqk' Black) or '' for an empty square; the rest are as in FEN (see START).
const CORE = (() => {
'use strict';

// the standard starting position, in FEN (Forsyth–Edwards Notation): the pieces rank by rank from Black's side
// (upper case White, lower case Black, digits for empty squares), then who moves, castling rights, the en passant
// square, the halfmove clock (moves since a capture or a pawn move) and the move number
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILES = 'abcdefgh';
const sq = name => FILES.indexOf(name[0]) + 8 * (name[1] - 1);
const sqName = s => FILES[s & 7] + ((s >> 3) + 1);
const colour = p => !p ? '' : p === p.toUpperCase() ? 'w' : 'b';
const other = c => c === 'w' ? 'b' : 'w';
const kind = p => p.toUpperCase();
const pieceOf = (c, k) => c === 'w' ? k : k.toLowerCase();
const shade = s => ((s & 7) + (s >> 3)) & 1;   // 0 for dark squares (a1), 1 for light

// ---------------------------------------------------------------- positions
function parseFen(fen) {
  const [place, turn = 'w', castle = '-', ep = '-', half = '0', full = '1'] = String(fen).trim().split(/\s+/);
  const ranks = place.split('/'), b = new Array(64).fill('');
  if (ranks.length !== 8 || !/^[wb]$/.test(turn) || !/^(-|K?Q?k?q?)$/.test(castle) || !/^(-|[a-h][36])$/.test(ep)) throw new Error('Not a valid FEN: ' + fen);
  ranks.forEach((r, i) => {
    let f = 0;
    for (const ch of r) {
      if (/[1-8]/.test(ch)) f += +ch;
      else if (/[pnbrqkPNBRQK]/.test(ch) && f < 8) b[(7 - i) * 8 + f++] = ch;
      else throw new Error('Not a valid FEN: ' + fen);
    }
    if (f !== 8) throw new Error('Not a valid FEN: ' + fen);
  });
  if (b.filter(p => p === 'K').length !== 1 || b.filter(p => p === 'k').length !== 1) throw new Error('Each side needs one king: ' + fen);
  return { b, turn, castle: castle === '-' ? '' : castle, ep: ep === '-' ? -1 : sq(ep), half: +half || 0, full: +full || 1 };
}
function toFen(pos) {
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    let row = '', gap = 0;
    for (let f = 0; f < 8; f++) { const p = pos.b[r * 8 + f]; if (p) { row += (gap || '') + p; gap = 0; } else gap++; }
    rows.push(row + (gap || ''));
  }
  return `${rows.join('/')} ${pos.turn} ${pos.castle || '-'} ${pos.ep >= 0 ? sqName(pos.ep) : '-'} ${pos.half} ${pos.full}`;
}

// ---------------------------------------------------------------- attacks and moves
const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const at = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1;

// is square s attacked by any piece of colour `by`?
function attacked(b, s, by) {
  const f = s & 7, r = s >> 3, pk = k => pieceOf(by, k);
  const pr = by === 'w' ? r - 1 : r + 1;   // a white pawn attacks from the rank below
  for (const df of [-1, 1]) { const t = at(f + df, pr); if (t >= 0 && b[t] === pk('P')) return true; }
  for (const [df, dr] of KNIGHT) { const t = at(f + df, r + dr); if (t >= 0 && b[t] === pk('N')) return true; }
  for (const [df, dr] of KING) { const t = at(f + df, r + dr); if (t >= 0 && b[t] === pk('K')) return true; }
  for (const [dirs, a] of [[DIAG, pk('B')], [ORTH, pk('R')]]) for (const [df, dr] of dirs) {
    for (let x = f + df, y = r + dr; x >= 0 && x < 8 && y >= 0 && y < 8; x += df, y += dr) {
      const p = b[y * 8 + x];
      if (p) { if (p === a || p === pk('Q')) return true; break; }
    }
  }
  return false;
}
const kingSq = (b, c) => b.indexOf(pieceOf(c, 'K'));
function inCheck(pos) { const k = kingSq(pos.b, pos.turn); return k >= 0 && attacked(pos.b, k, other(pos.turn)); }

// A move is { from, to, p (the piece moving), cap (the piece taken, or ''), promo (the piece it becomes, or ''),
// ep (an en passant capture), dbl (a pawn's two-square advance), castle ('K' king's side, 'Q' queen's side, or '') }.
function pseudoMoves(pos) {
  const { b, turn: c } = pos, out = [];
  const add = (from, to, extra) => out.push({ from, to, p: b[from], cap: b[to], promo: '', ep: false, dbl: false, castle: '', ...extra });
  for (let s = 0; s < 64; s++) {
    const p = b[s];
    if (!p || colour(p) !== c) continue;
    const k = kind(p), f = s & 7, r = s >> 3;
    if (k === 'P') {
      const dir = c === 'w' ? 1 : -1, home = c === 'w' ? 1 : 6, last = c === 'w' ? 7 : 0;
      const step = (to, extra) => { if (to >> 3 === last) for (const q of 'QRBN') add(s, to, { ...extra, promo: pieceOf(c, q) }); else add(s, to, extra); };
      const one = at(f, r + dir);
      if (one >= 0 && !b[one]) { step(one); const two = at(f, r + 2 * dir); if (r === home && !b[two]) add(s, two, { dbl: true }); }
      for (const df of [-1, 1]) {
        const to = at(f + df, r + dir);
        if (to < 0) continue;
        if (b[to] && colour(b[to]) !== c) step(to);
        else if (to === pos.ep && !b[to]) add(s, to, { ep: true, cap: pieceOf(other(c), 'P') });
      }
    } else if (k === 'N' || k === 'K') {
      for (const [df, dr] of k === 'N' ? KNIGHT : KING) { const to = at(f + df, r + dr); if (to >= 0 && colour(b[to]) !== c) add(s, to); }
      if (k === 'K') {
        const home = c === 'w' ? 0 : 56, them = other(c), rook = pieceOf(c, 'R');
        const safe = (...ss) => ss.every(x => !attacked(b, x, them)), empty = (...ss) => ss.every(x => !b[x]);
        if (s === home + 4 && pos.castle.includes(pieceOf(c, 'K')) && b[home + 7] === rook && empty(home + 5, home + 6) && safe(home + 4, home + 5, home + 6)) add(s, home + 6, { castle: 'K' });
        if (s === home + 4 && pos.castle.includes(pieceOf(c, 'Q')) && b[home] === rook && empty(home + 1, home + 2, home + 3) && safe(home + 4, home + 3, home + 2)) add(s, home + 2, { castle: 'Q' });
      }
    } else {
      for (const [df, dr] of k === 'B' ? DIAG : k === 'R' ? ORTH : [...DIAG, ...ORTH]) {
        for (let x = f + df, y = r + dr; x >= 0 && x < 8 && y >= 0 && y < 8; x += df, y += dr) {
          const to = y * 8 + x;
          if (b[to]) { if (colour(b[to]) !== c) add(s, to); break; }
          add(s, to);
        }
      }
    }
  }
  return out;
}
// moving a king or a rook, or having a rook taken, loses those castling rights
const LOSE = { 0: 'Q', 4: 'KQ', 7: 'K', 56: 'q', 60: 'kq', 63: 'k' };
function makeMove(pos, m) {
  const b = pos.b.slice(), c = pos.turn;
  b[m.to] = m.promo || m.p; b[m.from] = '';
  if (m.ep) b[m.to + (c === 'w' ? -8 : 8)] = '';
  if (m.castle) { const h = c === 'w' ? 0 : 56; if (m.castle === 'K') { b[h + 5] = b[h + 7]; b[h + 7] = ''; } else { b[h + 3] = b[h]; b[h] = ''; } }
  let castle = pos.castle;
  for (const s of [m.from, m.to]) for (const ch of LOSE[s] || '') castle = castle.replace(ch, '');
  return { b, turn: other(c), castle, ep: m.dbl ? (m.from + m.to) / 2 : -1, half: kind(m.p) === 'P' || m.cap ? 0 : pos.half + 1, full: pos.full + (c === 'b' ? 1 : 0) };
}
function legalMoves(pos) {
  return pseudoMoves(pos).filter(m => { const n = makeMove(pos, m), k = kingSq(n.b, pos.turn); return k < 0 || !attacked(n.b, k, n.turn); });
}
// counts the positions reached after `depth` moves: a standard check on move generation ("perft")
function perft(pos, depth) {
  if (depth === 0) return 1;
  const ms = legalMoves(pos);
  if (depth === 1) return ms.length;
  let n = 0; for (const m of ms) n += perft(makeMove(pos, m), depth - 1);
  return n;
}

// ---------------------------------------------------------------- notation
// standard algebraic notation (SAN), as in the move list: Nf3, exd5, O-O, e8=Q+, Qh4#
function san(pos, m, legal = legalMoves(pos)) {
  let s;
  if (m.castle) s = m.castle === 'K' ? 'O-O' : 'O-O-O';
  else if (kind(m.p) === 'P') s = (m.cap ? FILES[m.from & 7] + 'x' : '') + sqName(m.to) + (m.promo ? '=' + kind(m.promo) : '');
  else {
    const rivals = legal.filter(o => o.p === m.p && o.to === m.to && o.from !== m.from);
    let d = '';
    if (rivals.length) {
      const sameFile = rivals.some(o => (o.from & 7) === (m.from & 7)), sameRank = rivals.some(o => o.from >> 3 === m.from >> 3);
      d = !sameFile ? FILES[m.from & 7] : !sameRank ? String((m.from >> 3) + 1) : sqName(m.from);
    }
    s = kind(m.p) + d + (m.cap ? 'x' : '') + sqName(m.to);
  }
  const n = makeMove(pos, m);
  if (inCheck(n)) s += legalMoves(n).length ? '+' : '#';
  return s;
}
const uci = m => sqName(m.from) + sqName(m.to) + (m.promo ? m.promo.toLowerCase() : '');   // e2e4, e7e8q: how games are saved

// ---------------------------------------------------------------- games
// A game is { start (FEN), pos, list: [{ m, san, pos (after the move) }], keys, result }. keys hold each position's
// repetition key; result is null while it's on, else { score: '1-0' | '0-1' | '1/2-1/2', why }. Games never change:
// play(), undo() and finish() return new ones.
// Two positions repeat when the same pieces stand on the same squares, with the same side to move, castling rights
// and en passant capture (counted only when one can really be played), as the rules of chess say.
function repKey(pos) {
  const ep = pos.ep >= 0 && legalMoves(pos).some(m => m.ep) ? pos.ep : -1;
  return toFen({ ...pos, ep }).split(' ').slice(0, 4).join(' ');
}
// no sequence of legal moves could ever give mate: kings alone, a single bishop or knight, or only bishops all on
// squares of one colour
function deadPosition(b) {
  const rest = [];
  for (let s = 0; s < 64; s++) if (b[s] && kind(b[s]) !== 'K') rest.push([kind(b[s]), s]);
  if (!rest.length || (rest.length === 1 && 'BN'.includes(rest[0][0]))) return true;
  return rest.every(([k]) => k === 'B') && rest.every(([, s]) => shade(s) === shade(rest[0][1]));
}
// Checkmate and stalemate end the game; so do a third repetition and fifty moves each without a capture or a pawn
// move, which here are drawn at once (as most online sites do) rather than waiting for a player to claim them.
function judge(g) {
  const moves = legalMoves(g.pos);
  if (!moves.length) return inCheck(g.pos) ? { score: g.pos.turn === 'w' ? '0-1' : '1-0', why: 'checkmate' } : { score: '1/2-1/2', why: 'stalemate' };
  const last = g.keys[g.keys.length - 1];
  if (g.keys.filter(k => k === last).length >= 3) return { score: '1/2-1/2', why: 'repetition' };
  if (g.pos.half >= 100) return { score: '1/2-1/2', why: 'fifty' };
  if (deadPosition(g.pos.b)) return { score: '1/2-1/2', why: 'material' };
  return null;
}
function newGame(fen = START) {
  const pos = parseFen(fen), g = { start: toFen(pos), pos, list: [], keys: [repKey(pos)], result: null };
  g.result = judge(g);
  return g;
}
// plays a move given as { from, to, promo } (promo: 'q', 'r', 'b' or 'n', either case); returns the new game, or null
// if the move isn't legal or the game is over
function play(g, want) {
  if (g.result) return null;
  const legal = legalMoves(g.pos), pr = (want.promo || '').toLowerCase();
  const m = legal.find(x => x.from === want.from && x.to === want.to && x.promo.toLowerCase() === pr);
  if (!m) return null;
  const pos = makeMove(g.pos, m), n = { ...g, pos, list: [...g.list, { m, san: san(g.pos, m, legal), pos }], keys: [...g.keys, repKey(pos)], result: null };
  n.result = judge(n);
  return n;
}
const playUci = (g, s) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(s) ? play(g, { from: sq(s.slice(0, 2)), to: sq(s.slice(2, 4)), promo: s[4] || '' }) : null;
function undo(g) {
  if (!g.list.length) return g;
  const list = g.list.slice(0, -1);
  return { ...g, list, pos: list.length ? list[list.length - 1].pos : parseFen(g.start), keys: g.keys.slice(0, -1), result: null };
}
// a result the board didn't decide: a resignation ('resigned', the winner's score) or an agreed draw ('agreed')
const finish = (g, score, why) => g.result ? g : { ...g, result: { score, why } };

// ---------------------------------------------------------------- the computer player
// A small engine: it scores a position by material and where the pieces stand, and searches a set number of moves
// ahead (negamax with alpha-beta), then follows captures until the position is quiet (so it doesn't stop in the middle
// of an exchange). Each computer opponent (see bots.js) weakens it the way people of that strength play: the low ones
// look only one move ahead, so they miss forks, pins and threats; every one of them plays a middling move now and then,
// more often the weaker it is (a softmax over the moves' scores, with a temperature); and every one blunders now and
// then: a move that really loses material, picked because it looks good at a glance. Strength is measured, not
// guessed: see tools/sim-bots.js.
const VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
const PHASE = { P: 0, N: 1, B: 1, R: 2, Q: 4, K: 0 };   // how much of the middlegame is left: 24 with every piece on
// where each piece likes to stand, in centipawns, from White's side with a8 first (as a board is printed): the
// "simplified evaluation function" tables (Tomasz Michniewski). KE is the king in the endgame.
const PST = {
  P: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  R: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  K: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  KE: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
};
// the score of a position for the side to move, in centipawns (100 = a pawn): material and where the pieces stand
// (the king's table moving from staying sheltered to coming out as the pieces come off), then the pawns (passed pawns
// worth more the further on they are, doubled and isolated pawns worth less), rooks on open files, the bishop pair,
// and the pawns sheltering a castled king while there's still a middlegame
const PASSED_MG = [0, 5, 5, 10, 15, 25, 40, 0], PASSED_EG = [0, 10, 15, 25, 45, 75, 120, 0];
function evaluate(pos) {
  const b = pos.b, wp = [0, 0, 0, 0, 0, 0, 0, 0], bp = [0, 0, 0, 0, 0, 0, 0, 0], wMax = new Array(8).fill(-1), bMin = new Array(8).fill(8);
  const wMin = new Array(8).fill(8), bMax = new Array(8).fill(-1);
  let sc = 0, phase = 0, wk = 4, bk = 60, wb = 0, bb = 0;
  for (let s = 0; s < 64; s++) {
    const p = b[s];
    if (!p) continue;
    const k = kind(p), w = p === k, f = s & 7, r = s >> 3;
    if (k === 'K') { if (w) wk = s; else bk = s; continue; }
    const v = VALUE[k] + PST[k][w ? s ^ 56 : s];
    sc += w ? v : -v; phase += PHASE[k];
    if (k === 'P') { if (w) { wp[f]++; wMax[f] = Math.max(wMax[f], r); wMin[f] = Math.min(wMin[f], r); } else { bp[f]++; bMin[f] = Math.min(bMin[f], r); bMax[f] = Math.max(bMax[f], r); } }
    if (k === 'B') { if (w) wb++; else bb++; }
  }
  const t = Math.min(phase, 24) / 24;
  let x = t * (PST.K[wk ^ 56] - PST.K[bk]) + (1 - t) * (PST.KE[wk ^ 56] - PST.KE[bk]);
  if (wb >= 2) x += 30; if (bb >= 2) x -= 30;
  for (let s = 0; s < 64; s++) {
    const p = b[s];
    if (p !== 'P' && p !== 'p' && p !== 'R' && p !== 'r') continue;
    const f = s & 7, r = s >> 3, lo = Math.max(0, f - 1), hi = Math.min(7, f + 1);
    if (p === 'P') {
      let free = true; for (let g = lo; g <= hi; g++) if (bMax[g] > r) free = false;   // no black pawn ahead on this file or beside it
      if (free) x += t * PASSED_MG[r] + (1 - t) * PASSED_EG[r];
      if ((f === 0 || !wp[f - 1]) && (f === 7 || !wp[f + 1])) x -= 12;
    } else if (p === 'p') {
      let free = true; for (let g = lo; g <= hi; g++) if (wMin[g] < r) free = false;
      if (free) x -= t * PASSED_MG[7 - r] + (1 - t) * PASSED_EG[7 - r];
      if ((f === 0 || !bp[f - 1]) && (f === 7 || !bp[f + 1])) x += 12;
    } else {
      const own = p === 'R' ? wp[f] : bp[f], theirs = p === 'R' ? bp[f] : wp[f], v = !own ? (theirs ? 9 : 18) : 0;
      x += p === 'R' ? v : -v;
    }
  }
  for (let f = 0; f < 8; f++) { if (wp[f] > 1) x -= 12 * (wp[f] - 1); if (bp[f] > 1) x += 12 * (bp[f] - 1); }
  // the king's pawn shelter: own pawns just in front of it and beside, while there's a middlegame to be safe from
  const shelter = (k, pawn, dir) => { let n = 0; for (let df = -1; df <= 1; df++) for (const dr of [1, 2]) { const q = at((k & 7) + df, (k >> 3) + dir * dr); if (q >= 0 && b[q] === pawn) n++; } return Math.min(n, 3); };
  if ((wk >> 3) <= 1) x += 10 * t * shelter(wk, 'P', 1);
  if ((bk >> 3) >= 6) x -= 10 * t * shelter(bk, 'p', -1);
  sc += Math.round(x);
  return pos.turn === 'w' ? sc : -sc;
}
const MATE = 100000;
// captures first, the most valuable piece taken by the least valuable taker; promotions with them
const order = ms => ms.sort((a, b) => ((b.cap ? VALUE[kind(b.cap)] * 10 - VALUE[kind(b.p)] : 0) + (b.promo ? 8000 : 0)) - ((a.cap ? VALUE[kind(a.cap)] * 10 - VALUE[kind(a.p)] : 0) + (a.promo ? 8000 : 0)));
const leaves = (pos, n) => { const k = kingSq(n.b, pos.turn); return k >= 0 && attacked(n.b, k, n.turn); };   // a move that leaves the mover's own king attacked
function quiesce(pos, alpha, beta, ctx) {
  ctx.nodes++;
  const stand = evaluate(pos);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  for (const m of order(pseudoMoves(pos).filter(m => m.cap || m.promo))) {
    const n = makeMove(pos, m);
    if (leaves(pos, n)) continue;
    const sc = -quiesce(n, -beta, -alpha, ctx);
    if (sc >= beta) return sc;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}
function negamax(pos, depth, alpha, beta, ply, ctx) {
  const chk = inCheck(pos);
  if (chk && ctx.qs && ply < 12) depth++;   // in check: look one move further, so the search never stops with a king attacked
  if (depth <= 0) { if (ctx.qs) return quiesce(pos, alpha, beta, ctx); ctx.nodes++; return evaluate(pos); }
  ctx.nodes++;
  if (pos.half >= 100) return 0;
  let legal = 0, best = -Infinity;
  for (const m of order(pseudoMoves(pos))) {
    const n = makeMove(pos, m);
    if (leaves(pos, n)) continue;
    legal++;
    const sc = -negamax(n, depth - 1, -beta, -alpha, ply + 1, ctx);
    if (sc > best) best = sc;
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) break;
  }
  if (!legal) return chk ? -MATE + ply : 0;
  return best;
}
// a seeded random number generator (mulberry32): the computer's choices repeat exactly for the same seed
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Chooses the computer's move. A generator: it yields after scoring each move, so the page can spread the thinking
// over several frames; run it to the end (see runThink) and its return value is the move. cfg: depth (moves looked
// ahead), qs (follow captures to the end), temp (centipawns: how readily it picks a middling move), blunder (the chance,
// each move, of a blunder: see below), and style bonuses in centipawns for the moves the player likes (capture, check,
// pawn, castle, queen).
const BLUNDER = 200;   // a blunder loses at least this much (centipawns): a piece, two pawns, or walking into a mate
const pick = (items, w, rnd) => { let r = rnd() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; };
function* think(g, cfg, rnd) {
  const pos = g.pos, moves = legalMoves(pos), ctx = { nodes: 0, qs: !!cfg.qs }, st = cfg.style || {};
  if (!moves.length) return null;
  const slip = rnd() < (cfg.blunder || 0);   // this move, a blunder (if there's one to make)
  // the opening: a little more variety, so the same moves aren't played every game
  const temp = Math.max(1, cfg.temp || 1, g.list.length < 8 ? 30 : 0), scored = [];
  // a move scoring far below the best so far would almost never be picked, so its exact score isn't needed: the search
  // only has to show it's below this floor (much quicker)
  let floor = -Infinity;
  for (const m of order(moves.slice())) {
    const n = makeMove(pos, m), k = repKey(n);
    // a move that repeats the position a third time is a draw; otherwise search the reply
    // (looking one move ahead, the search doesn't see the reply, so a mate in one or a stalemate is checked here)
    const shallow = (cfg.depth || 1) <= 1 && !legalMoves(n).length;
    const raw = g.keys.filter(x => x === k).length >= 2 ? 0 : shallow ? (inCheck(n) ? MATE : 0) : -negamax(n, (cfg.depth || 1) - 1, -Infinity, -floor, 1, ctx);
    floor = Math.max(floor, raw - Math.max(60, 12 * temp));
    let sc = raw;
    if (m.cap) sc += st.capture || 0;
    if (kind(m.p) === 'P') sc += st.pawn || 0;
    if (m.castle) sc += st.castle || 0;
    if (kind(m.p) === 'Q') sc += st.queen || 0;
    if (st.check && inCheck(n)) sc += st.check;
    scored.push([m, sc]);
    yield ctx.nodes;
  }
  const top = Math.max(...scored.map(x => x[1]));
  if (slip) {
    // A blunder, the way people make one: of the moves that lose at least BLUNDER, the one that looks best at a glance,
    // judging only the position straight after it, not the reply (grabbing a pawn the queen can't hold, say). With no
    // such move to make, the move is chosen as usual.
    const bad = scored.filter(([, sc]) => sc <= top - BLUNDER);
    if (bad.length) {
      const glance = bad.map(([m]) => -evaluate(makeMove(pos, m))), hi = Math.max(...glance);
      return pick(bad, glance.map(v => Math.exp(Math.max(-50, (v - hi) / 50))), rnd)[0];
    }
  }
  return pick(scored, scored.map(([, sc]) => Math.exp(Math.max(-50, (sc - top) / temp))), rnd)[0];
}
// runs think() to the end at once (the tests and the tools; the page spreads it over frames instead)
function runThink(g, cfg, rnd) { const it = think(g, cfg, rnd); let r; while (!(r = it.next()).done); return r.value; }

return { START, FILES, sq, sqName, colour, other, kind, shade, parseFen, toFen, attacked, inCheck, pseudoMoves, legalMoves, makeMove, perft,
  san, uci, repKey, deadPosition, judge, newGame, play, playUci, undo, finish, VALUE, evaluate, negamax, rng, think, runThink };
})();
if (typeof module !== 'undefined') module.exports = CORE;
