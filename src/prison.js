/* PrisonBreak proof-of-concept: rules, exact solver, generator.
 *
 * Rules (v0):
 *  - Grid with walls. The thief starts on S and must reach E.
 *  - Cameras sit in wall cells and face N/E/S/W. One action turns a camera 90 degrees (either way).
 *  - Guards stand on a straight rail of floor cells. One action steps a guard along its rail
 *    (and makes it face that way) or flips it. A guard sees `range` cells ahead.
 *  - Walls and guards stop sight. Guards block movement.
 *  - The thief may stand only on dark cells. Walking is free; only watcher actions are counted.
 *    A watcher action is illegal if it lights the thief's cell (the thief picks the best cell in
 *    his dark region before each action).
 *  - Par = minimum number of watcher actions (exact, by BFS).
 */
(function () {
'use strict';
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* level = { w,h, wall:Uint8Array, S, E, cams:[{c,d}], guards:[{rail:[cells], i, f, range}] }
   watcher state digits: cam -> facing 0..3 ; guard -> i*2+f  (f=0 faces toward rail[last], 1 toward rail[0]) */
function radices(L) {
  return L.cams.map(() => 4).concat(L.guards.map(g => g.rail.length * 2));
}
function initialDigits(L) {
  return L.cams.map(c => c.d).concat(L.guards.map(g => g.i * 2 + g.f));
}
function guardFacingDir(g, f) {            // direction index the guard looks
  const a = g.rail[0], b = g.rail[g.rail.length - 1];
  const w = L_W;                           // set by prepare()
  const ax = a % w, ay = (a / w) | 0, bx = b % w, by = (b / w) | 0;
  let d;
  if (ax === bx) d = by > ay ? 2 : 0; else d = bx > ax ? 1 : 3;
  return f === 0 ? d : (d + 2) % 4;
}
let L_W = 0;

/* Lit cells + blocked cells for one configuration. With wantRays it also returns, per watcher,
   the cells its sight line covers (the renderer draws cones from these). */
function evalConfig(L, digits, wantRays) {
  const { w, h, wall } = L, n = w * h;
  const lit = new Uint8Array(n), occ = new Uint8Array(n);
  const gpos = L.guards.map((g, k) => g.rail[digits[L.cams.length + k] >> 1]);
  for (const c of gpos) occ[c] = 1;
  const rays = wantRays ? [] : null;
  const cast = (start, d, range, who) => {
    const cells = [];
    let x = start % w, y = (start / w) | 0;
    for (let s = 0; s < range; s++) {
      x += DX[d]; y += DY[d];
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      const c = y * w + x;
      if (wall[c] || occ[c]) break;
      lit[c] = 1; cells.push(c);
    }
    if (rays) rays.push({ src: start, d, cells, who });
  };
  L.cams.forEach((cm, k) => cast(cm.c, digits[k], 99, k));
  L.guards.forEach((g, k) => {
    const v = digits[L.cams.length + k];
    cast(gpos[k], guardFacingDir(g, v & 1), g.range, L.cams.length + k);
  });
  return { lit, occ, rays };
}

function prepare(L) { L_W = L.w; }

/* Exact BFS over (configuration, dark region the thief is in). */
function solve(L, opts) {
  prepare(L);
  const { w, h, wall } = L, n = w * h;
  const rad = radices(L);
  let total = 1; for (const r of rad) total *= r;
  if (total > 2.5e6) return null;
  const mul = new Array(rad.length); { let m = 1; for (let i = rad.length - 1; i >= 0; i--) { mul[i] = m; m *= rad[i]; } }
  const encode = d => d.reduce((s, v, i) => s + v * mul[i], 0);
  const decode = id => rad.map((r, i) => ((id / mul[i]) | 0) % r);

  const compCache = new Map();
  const comps = (id) => {                  // region labelling for a configuration
    let c = compCache.get(id);
    if (c) return c;
    const dg = decode(id), { lit, occ } = evalConfig(L, dg);
    const lab = new Int8Array(n).fill(-1);
    let k = 0;
    for (let s = 0; s < n; s++) {
      if (wall[s] || lit[s] || occ[s] || lab[s] >= 0) continue;
      const st = [s]; lab[s] = k;
      while (st.length) {
        const c0 = st.pop(), x = c0 % w, y = (c0 / w) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d], ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (wall[q] || lit[q] || occ[q] || lab[q] >= 0) continue;
          lab[q] = k; st.push(q);
        }
      }
      k++;
    }
    c = { lab, k };
    compCache.set(id, c);
    return c;
  };
  const neighbours = (id) => {             // [{id2, w}] watcher actions
    const dg = decode(id), out = [];
    L.cams.forEach((cm, k) => {
      for (const dd of [1, 3]) { const d2 = dg.slice(); d2[k] = (dg[k] + dd) % 4; out.push([encode(d2), k]); }
    });
    L.guards.forEach((g, j) => {
      const k = L.cams.length + j, v = dg[k], i = v >> 1, f = v & 1;
      const others = L.guards.map((_, q) => q === j ? -1 : g.rail.length && L.guards[q].rail[dg[L.cams.length + q] >> 1]);
      const free = ni => !others.includes(g.rail[ni]);
      const dirF = f === 0 ? 1 : -1;       // f=0 looks toward rail end
      for (const s of [1, -1]) {
        const ni = i + s;
        if (ni < 0 || ni >= g.rail.length || !free(ni)) continue;
        const nf = s === 1 ? 0 : 1;
        const d2 = dg.slice(); d2[k] = ni * 2 + nf; out.push([encode(d2), k]);
      }
      const d2 = dg.slice(); d2[k] = i * 2 + (1 - f); out.push([encode(d2), k]);
    });
    return out;
  };

  const start = encode((opts && opts.digits) || initialDigits(L));
  const S0 = opts && opts.thief != null ? opts.thief : L.S;
  const c0 = comps(start);
  if (c0.lab[S0] < 0) return { solvable: false, reason: 'start lit' };
  const key = (id, k) => id * 16 + k;
  const dist = new Map(), par = new Map();
  let frontier = [[start, c0.lab[S0]]];
  dist.set(key(start, c0.lab[S0]), 0);
  let goal = null, depth = 0;
  const isGoal = (id, k) => comps(id).lab[L.E] === k;
  if (isGoal(start, c0.lab[S0])) goal = key(start, c0.lab[S0]);
  while (frontier.length && goal === null) {
    const next = [];
    depth++;
    for (const [id, k] of frontier) {
      const cur = comps(id);
      for (const [id2, who] of neighbours(id)) {
        const nc = comps(id2), seen = new Set();
        for (let x = 0; x < n; x++) {
          if (cur.lab[x] !== k) continue;
          const k2 = nc.lab[x];
          if (k2 < 0 || seen.has(k2)) continue;
          seen.add(k2);
          const kk = key(id2, k2);
          if (dist.has(kk)) continue;
          dist.set(kk, depth); par.set(kk, [key(id, k), who]);
          next.push([id2, k2]);
          if (nc.lab[L.E] === k2) { goal = kk; }
        }
      }
      if (goal !== null) break;
    }
    frontier = next;
    if (depth > (opts && opts.maxDepth || 60)) break;
  }
  if (goal === null) return { solvable: false, explored: dist.size };
  const path = [], who = [];
  let kk = goal;
  while (par.has(kk)) { const [p, wh] = par.get(kk); path.push(Math.floor(kk / 16)); who.push(wh); kk = p; }
  path.reverse(); who.reverse();
  return { solvable: true, par: depth, explored: dist.size, configs: path.map(decode), who, rad };
}

/* ASCII picture of a configuration: # wall, . dark, ~ lit, G guard, C camera, S/E. */
function draw(L, digits) {
  prepare(L);
  const { lit, occ } = evalConfig(L, digits);
  const ar = ['^', '>', 'v', '<'];
  let s = '';
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < L.w; x++) {
      const c = y * L.w + x;
      let ch = L.wall[c] ? '#' : lit[c] ? '~' : '.';
      if (c === L.S) ch = lit[c] ? '!' : 'S';
      if (c === L.E) ch = lit[c] ? 'e' : 'E';
      const cam = L.cams.findIndex(q => q.c === c);
      if (cam >= 0) ch = ar[digits[cam]];
      L.guards.forEach((g, k) => {
        const v = digits[L.cams.length + k];
        if (g.rail[v >> 1] === c) ch = 'abcdefgh'[k];
      });
      s += ch;
    }
    s += '\n';
  }
  return s;
}

/* ------------------------------------------------------------ generator */
function randomLevel(rnd, W, H, nCam, nGuard) {
  const n = W * H, wall = new Uint8Array(n);
  const wallCount = Math.floor(n * (0.14 + rnd() * 0.12));
  for (let i = 0; i < wallCount; i++) wall[(rnd() * n) | 0] = 1;
  // border cells are mounts for cameras, so keep a free ring of floor but allow camera mounts as extra wall
  const floor = []; for (let c = 0; c < n; c++) if (!wall[c]) floor.push(c);
  const pick = arr => arr[(rnd() * arr.length) | 0];
  const S = pick(floor);
  let E = pick(floor), guard = 0;
  while ((E === S || Math.abs(E % W - S % W) + Math.abs(((E / W) | 0) - ((S / W) | 0)) < 4) && guard++ < 50) E = pick(floor);
  const L = { w: W, h: H, wall, S, E, cams: [], guards: [] };
  const mounts = [];
  for (let c = 0; c < n; c++) {
    if (!wall[c]) continue;
    for (let d = 0; d < 4; d++) {
      const x = c % W + DX[d], y = ((c / W) | 0) + DY[d];
      if (x >= 0 && y >= 0 && x < W && y < H && !wall[y * W + x]) { mounts.push([c, d]); break; }
    }
  }
  const usedMount = new Set();
  for (let i = 0; i < nCam && mounts.length; i++) {
    const [c] = pick(mounts);
    if (usedMount.has(c)) continue;
    usedMount.add(c);
    L.cams.push({ c, d: (rnd() * 4) | 0 });
  }
  for (let i = 0; i < nGuard; i++) {
    for (let tries = 0; tries < 30; tries++) {
      const len = 3 + ((rnd() * 2) | 0), horiz = rnd() < 0.5;
      const x0 = (rnd() * W) | 0, y0 = (rnd() * H) | 0, rail = [];
      for (let k = 0; k < len; k++) {
        const x = x0 + (horiz ? k : 0), y = y0 + (horiz ? 0 : k);
        if (x >= W || y >= H) break;
        const c = y * W + x;
        if (wall[c] || c === S || c === E) break;
        rail.push(c);
      }
      if (rail.length >= 3 && !L.guards.some(g => g.rail.some(c => rail.includes(c)))) {
        L.guards.push({ rail, i: (rnd() * rail.length) | 0, f: (rnd() * 2) | 0, range: 3 });
        break;
      }
    }
  }
  return L;
}
function clone(L) {
  return { w: L.w, h: L.h, wall: L.wall.slice(), S: L.S, E: L.E,
    cams: L.cams.map(c => ({ ...c })), guards: L.guards.map(g => ({ ...g, rail: g.rail.slice() })) };
}
function score(L) {
  const r = solve(L, { maxDepth: 40 });
  if (!r || !r.solvable) return { s: -1, r };
  const used = new Set(r.who).size;
  return { s: r.par * 10 + used * 6, r };
}
function mutate(L, rnd) {
  const M = clone(L), n = L.w * L.h, k = rnd();
  if (k < 0.3) {                         // flip a wall (keeping S, E, watchers valid)
    const c = (rnd() * n) | 0;
    const busy = c === L.S || c === L.E || L.cams.some(q => q.c === c) || L.guards.some(g => g.rail.includes(c));
    if (!busy) M.wall[c] ^= 1;
  } else if (k < 0.5 && M.cams.length) {
    const q = M.cams[(rnd() * M.cams.length) | 0]; q.d = (rnd() * 4) | 0;
  } else if (k < 0.7 && M.guards.length) {
    const g = M.guards[(rnd() * M.guards.length) | 0];
    g.i = (rnd() * g.rail.length) | 0; g.f = (rnd() * 2) | 0;
  } else if (k < 0.8) {
    const fl = []; for (let c = 0; c < n; c++) if (!M.wall[c]) fl.push(c);
    M.S = fl[(rnd() * fl.length) | 0];
  } else if (k < 0.9) {
    const fl = []; for (let c = 0; c < n; c++) if (!M.wall[c]) fl.push(c);
    M.E = fl[(rnd() * fl.length) | 0];
  } else if (M.cams.length) {
    const q = M.cams[(rnd() * M.cams.length) | 0];
    const mounts = [];
    for (let c = 0; c < n; c++) if (M.wall[c] && !M.cams.some(z => z.c === c)) {
      for (let d = 0; d < 4; d++) { const x = c % L.w + DX[d], y = ((c / L.w) | 0) + DY[d]; if (x >= 0 && y >= 0 && x < L.w && y < L.h && !M.wall[y * L.w + x]) { mounts.push(c); break; } }
    }
    if (mounts.length) q.c = mounts[(rnd() * mounts.length) | 0];
  }
  // camera mounts must stay walls with a floor neighbour; guard rails must stay floor
  for (const q of M.cams) if (!M.wall[q.c]) return L;
  for (const g of M.guards) for (const c of g.rail) if (M.wall[c]) return L;
  if (M.wall[M.S] || M.wall[M.E] || M.S === M.E) return L;
  for (const g of M.guards) if (g.rail.includes(M.S) || g.rail.includes(M.E)) return L;   // ASCII format cannot show S/E on a rail
  return M;
}
function generate(seed, W, H, nCam, nGuard, iters) {
  const rnd = mulberry32(seed);
  let best = null, bs = { s: -1 };
  for (let t = 0; t < 40 && bs.s < 0; t++) { const L = randomLevel(rnd, W, H, nCam, nGuard); const sc = score(L); if (sc.s > bs.s) { best = L; bs = sc; } }
  if (!best) return null;
  for (let i = 0; i < iters; i++) {
    const M = mutate(best, rnd);
    if (M === best) continue;
    const sc = score(M);
    if (sc.s > bs.s) { best = M; bs = sc; }
  }
  return { level: best, result: bs.r, score: bs.s };
}

/* ASCII level format: # wall, . floor, S start, E exit, ^ > v < camera (on a wall cell, facing that way),
   a..d = rail cells of guard a..d (floor). meta.guards: {a:{i,f,range}} start index on rail and facing. */
function parseLevel(map, meta) {
  const h = map.length, w = map[0].length, wall = new Uint8Array(w * h);
  const L = { w, h, wall, S: -1, E: -1, cams: [], guards: [] };
  const rails = {};
  map.forEach((row, y) => {
    if (row.length !== w) throw new Error('ragged map row ' + y);
    [...row].forEach((ch, x) => {
      const c = y * w + x;
      if (ch === '#') wall[c] = 1;
      else if (ch === 'S') L.S = c;
      else if (ch === 'E') L.E = c;
      else if ('^>v<'.includes(ch)) { wall[c] = 1; L.cams.push({ c, d: '^>v<'.indexOf(ch) }); }
      else if (/[a-d]/.test(ch)) (rails[ch] = rails[ch] || []).push(c);
    });
  });
  Object.keys(rails).sort().forEach(k => {
    const g = Object.assign({ i: 0, f: 0, range: 3 }, (meta && meta.guards || {})[k]);
    g.rail = rails[k].sort((a, b) => a - b);
    L.guards.push(g);
  });
  return L;
}

function toMap(L) {
  const rows = [];
  const ar = ['^', '>', 'v', '<'];
  for (let y = 0; y < L.h; y++) {
    let r = '';
    for (let x = 0; x < L.w; x++) {
      const c = y * L.w + x;
      let ch = L.wall[c] ? '#' : '.';
      if (c === L.S) ch = 'S';
      if (c === L.E) ch = 'E';
      const cam = L.cams.find(q => q.c === c);
      if (cam) ch = ar[cam.d];
      L.guards.forEach((g, k) => { if (g.rail.includes(c)) ch = 'abcd'[k]; });
      r += ch;
    }
    rows.push(r);
  }
  const guards = {};
  L.guards.forEach((g, k) => { guards['abcd'[k]] = { i: g.i, f: g.f, range: g.range }; });
  return { map: rows, meta: { guards } };
}

const api = { toMap, solve, draw, generate, mulberry32, initialDigits, evalConfig, prepare, parseLevel, guardFacingDir, radices };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.Prison = api;
})();
