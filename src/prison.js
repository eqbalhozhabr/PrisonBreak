/* Blind Eye: rules, exact solver, and the level generator.
 *
 * Rules
 *  - Grid with walls. The thief starts on S and must reach E.
 *  - Cameras sit in wall cells and face N/E/S/W. One action turns a camera 90 degrees either way.
 *  - Guards stand on a straight rail of floor cells. One action steps a guard along its rail (it keeps
 *    facing the way it faced) or flips it around. A guard sees `range` cells ahead.
 *  - Doors (floor cells) open or close with one action. A closed door blocks movement and sight.
 *  - Mirrors (floor cells, pillars) flip between "/" and "\" with one action and bend any sight line
 *    that reaches them by 90 degrees.
 *  - Walls, guards and closed doors stop sight. Guards, closed doors and mirrors block movement.
 *  - The thief may stand only on dark cells. Walking is free; only actions on watchers/objects count.
 *    An action is illegal if it lights the thief's cell (he picks the best cell in his dark region
 *    before each action).
 *  - Par = the fewest actions, by exact search.
 *
 * Cameras only turn clockwise (a 270 degree turn costs 3). Every other action can be undone by one action.
 * The generator searches backwards from "the exit is reachable" over the whole state graph, which gives the
 * par of every possible starting state at once.
 */
(function () {
'use strict';
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const MIRROR = [[1, 0, 3, 2], [3, 2, 1, 0]];       // state 0 = "/", state 1 = "\"; indexed by travel direction

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(a, b) { let h = Math.imul(a ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(b + 0x7F4A7C15, 0xC2B2AE35); h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; return h >>> 0; }

/* level = { w,h, wall:Uint8Array, S, E, cams:[{c,d}], guards:[{rail:[cells], i, f, range}], toggles:[{c, kind:'door'|'mirror', s}] }
   digits: cameras (facing 0..3), guards (i*2+f), toggles (0/1: door 1 = closed, mirror 0 = "/" 1 = "\"). */
let L_W = 0;
function prepare(L) { L_W = L.w; }
const counts = L => [L.cams.length, L.guards.length, (L.toggles || []).length];
function radices(L) {
  return L.cams.map(() => 4).concat(L.guards.map(g => g.rail.length * 2), (L.toggles || []).map(() => 2));
}
function initialDigits(L) {
  return L.cams.map(c => c.d).concat(L.guards.map(g => g.i * 2 + g.f), (L.toggles || []).map(t => t.s));
}
function guardFacingDir(g, f) {            // direction index the guard looks (f=0 toward the last rail cell)
  const w = L_W, a = g.rail[0], b = g.rail[g.rail.length - 1];
  const ax = a % w, ay = (a / w) | 0, bx = b % w, by = (b / w) | 0;
  const d = ax === bx ? (by > ay ? 2 : 0) : (bx > ax ? 1 : 3);
  return f === 0 ? d : (d + 2) % 4;
}

/* Lit cells + blocked cells for one configuration. With wantRays it also returns the sight-line
   segments (a mirror starts a new segment) so the renderer can draw cones. */
function evalConfig(L, digits, wantRays) {
  const { w, h, wall } = L, n = w * h, [nc, ng] = counts(L), tog = L.toggles || [];
  const lit = new Uint8Array(n), occ = new Uint8Array(n), opq = new Uint8Array(n), mir = new Int8Array(n).fill(-1);
  const gpos = L.guards.map((g, k) => g.rail[digits[nc + k] >> 1]);
  for (const c of gpos) { occ[c] = 1; opq[c] = 1; }
  tog.forEach((t, j) => {
    const v = digits[nc + ng + j];
    if (t.kind === 'door') { if (v === 1) { occ[t.c] = 1; opq[t.c] = 1; } }
    else { occ[t.c] = 1; mir[t.c] = v; }
  });
  const rays = wantRays ? [] : null;
  const cast = (start, d0, range, who) => {
    let d = d0, x = start % w, y = (start / w) | 0, cur = { src: start, d, cells: [], who, first: true };
    const segs = [];
    for (let s = 0; s < range; s++) {
      x += DX[d]; y += DY[d];
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      const c = y * w + x;
      if (wall[c]) break;
      if (mir[c] >= 0) { segs.push(cur); d = MIRROR[mir[c]][d]; cur = { src: c, d, cells: [], who, first: false }; continue; }
      if (opq[c]) break;
      lit[c] = 1; cur.cells.push(c);
    }
    segs.push(cur);
    if (rays) for (const sg of segs) rays.push(sg);
  };
  L.cams.forEach((cm, k) => cast(cm.c, digits[k], 99, k));
  L.guards.forEach((g, k) => cast(gpos[k], guardFacingDir(g, digits[nc + k] & 1), g.range, nc + k));
  return { lit, occ, rays };
}

/* dark, free regions of one configuration */
function labelConfig(L, dg) {
  const { w, h, wall } = L, n = w * h, { lit, occ } = evalConfig(L, dg, false), lab = new Int8Array(n).fill(-1);
  let k = 0;
  const st = [];
  for (let s = 0; s < n; s++) {
    if (wall[s] || lit[s] || occ[s] || lab[s] >= 0) continue;
    st.push(s); lab[s] = k;
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
  return { lab, k };
}

/* every single action from a configuration: [newDigits, which watcher] */
function actions(L, dg) {
  const [nc, ng] = counts(L), out = [];
  L.cams.forEach((cm, k) => { const d2 = dg.slice(); d2[k] = (dg[k] + 1) % 4; out.push([d2, k]); });   // clockwise only
  L.guards.forEach((g, j) => {
    const k = nc + j, v = dg[k], i = v >> 1, f = v & 1;
    const taken = ni => L.guards.some((o, q) => q !== j && o.rail[dg[nc + q] >> 1] === g.rail[ni]);
    for (const s of [1, -1]) {
      const ni = i + s;
      if (ni < 0 || ni >= g.rail.length || taken(ni)) continue;
      const d2 = dg.slice(); d2[k] = ni * 2 + f; out.push([d2, k]);
    }
    const d2 = dg.slice(); d2[k] = i * 2 + (1 - f); out.push([d2, k]);
  });
  (L.toggles || []).forEach((t, j) => {
    const k = nc + ng + j, d2 = dg.slice(); d2[k] = 1 - dg[k]; out.push([d2, k]);
  });
  return out;
}

/* Exact BFS over (configuration, dark region the thief is in). opts: digits/thief to start elsewhere. */
function solve(L, opts) {
  prepare(L);
  const n = L.w * L.h, rad = radices(L);
  let total = 1; for (const r of rad) total *= r;
  if (total > 2.5e6) return null;
  const mul = new Array(rad.length); { let m = 1; for (let i = rad.length - 1; i >= 0; i--) { mul[i] = m; m *= rad[i]; } }
  const encode = d => d.reduce((s, v, i) => s + v * mul[i], 0);
  const decode = id => rad.map((r, i) => ((id / mul[i]) | 0) % r);
  const cache = new Map();
  const comps = id => { let c = cache.get(id); if (!c) { c = labelConfig(L, decode(id)); cache.set(id, c); } return c; };

  const start = encode((opts && opts.digits) || initialDigits(L));
  const S0 = opts && opts.thief != null ? opts.thief : L.S;
  const c0 = comps(start);
  if (S0 < 0 || c0.lab[S0] < 0) return { solvable: false, reason: 'start lit' };
  if (L.E < 0) return { solvable: false, reason: 'no exit' };
  const frozen = opts && opts.frozen;
  const key = (id, k) => id * 16 + k;
  const dist = new Map(), par = new Map();
  let frontier = [[start, c0.lab[S0]]], goal = null, depth = 0;
  dist.set(key(start, c0.lab[S0]), 0);
  if (c0.lab[L.E] === c0.lab[S0]) goal = key(start, c0.lab[S0]);
  while (frontier.length && goal === null) {
    const next = [];
    depth++;
    for (const [id, k] of frontier) {
      const cur = comps(id);
      for (const [d2, who] of actions(L, decode(id))) {
        if (frozen && frozen.has(who)) continue;
        const id2 = encode(d2), nc2 = comps(id2), seen = new Set();
        for (let x = 0; x < n; x++) {
          if (cur.lab[x] !== k) continue;
          const k2 = nc2.lab[x];
          if (k2 < 0 || seen.has(k2)) continue;
          seen.add(k2);
          const kk = key(id2, k2);
          if (dist.has(kk)) continue;
          dist.set(kk, depth); par.set(kk, [key(id, k), who]);
          next.push([id2, k2]);
          if (nc2.lab[L.E] === k2) goal = kk;
        }
      }
      if (goal !== null) break;
    }
    frontier = next;
    if (depth > (opts && opts.maxDepth || 60)) break;
  }
  if (goal === null) return { solvable: false, explored: dist.size };
  const who = [], ids = [];
  let kk = goal;
  while (par.has(kk)) { const [p, wh] = par.get(kk); ids.push(Math.floor(kk / 16)); who.push(wh); kk = p; }
  ids.reverse(); who.reverse();
  return { solvable: true, par: depth, explored: dist.size, configs: ids.map(decode), who, rad };
}

/* ASCII of a configuration: # wall . dark ~ lit, S/E, arrows = cameras, a-d guards, X/x doors, / \ mirrors */
function draw(L, digits) {
  prepare(L);
  const { lit } = evalConfig(L, digits, false), [nc, ng] = counts(L), ar = ['^', '>', 'v', '<'];
  let s = '';
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < L.w; x++) {
      const c = y * L.w + x;
      let ch = L.wall[c] ? '#' : lit[c] ? '~' : '.';
      if (c === L.S) ch = lit[c] ? '!' : 'S';
      if (c === L.E) ch = lit[c] ? 'e' : 'E';
      const cam = L.cams.findIndex(q => q.c === c);
      if (cam >= 0) ch = ar[digits[cam]];
      L.guards.forEach((g, k) => { if (g.rail[digits[nc + k] >> 1] === c) ch = 'abcd'[k]; });
      (L.toggles || []).forEach((t, j) => { if (t.c === c) ch = t.kind === 'door' ? (digits[nc + ng + j] ? 'X' : 'x') : (digits[nc + ng + j] ? '\\' : '/'); });
      s += ch;
    }
    s += '\n';
  }
  return s;
}

/* ASCII level format: # wall, . floor, S start, E exit, ^ > v < camera (on a wall cell), a..d guard rail cells,
   X closed door, x open door, / \ mirror. meta.guards: {a:{i,f,range}} start index on the rail, facing, range. */
function parseLevel(map, meta) {
  const h = map.length, w = map[0].length, wall = new Uint8Array(w * h);
  const L = { w, h, wall, S: -1, E: -1, cams: [], guards: [], toggles: [] };
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
      else if (ch === 'X' || ch === 'x') L.toggles.push({ c, kind: 'door', s: ch === 'X' ? 1 : 0 });
      else if (ch === '/' || ch === '\\') L.toggles.push({ c, kind: 'mirror', s: ch === '/' ? 0 : 1 });
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
  const rows = [], ar = ['^', '>', 'v', '<'];
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
      (L.toggles || []).forEach(t => { if (t.c === c) ch = t.kind === 'door' ? (t.s ? 'X' : 'x') : (t.s ? '\\' : '/'); });
      r += ch;
    }
    rows.push(r);
  }
  const guards = {};
  L.guards.forEach((g, k) => { guards['abcd'[k]] = { i: g.i, f: g.f, range: g.range }; });
  return { map: rows, meta: { guards } };
}

/* ------------------------------------------------------------- generator */
/* Whole state graph of a layout: every configuration, its dark regions, and the distance (in actions) from
   every (configuration, region) to "the exit is reachable". Returns null if the layout has too many states. */
function buildGraph(L, cap) {
  prepare(L);
  const n = L.w * L.h, rad = radices(L);
  let total = 1; for (const r of rad) total *= r;
  if (total > cap) return null;
  const mul = new Array(rad.length); { let m = 1; for (let i = rad.length - 1; i >= 0; i--) { mul[i] = m; m *= rad[i]; } }
  const encode = d => d.reduce((s, v, i) => s + v * mul[i], 0);
  const decode = id => rad.map((r, i) => ((id / mul[i]) | 0) % r);
  const labs = new Int8Array(total * n), kc = new Uint8Array(total), base = new Int32Array(total + 1);
  for (let id = 0; id < total; id++) {
    const { lab, k } = labelConfig(L, decode(id));
    labs.set(lab, id * n); kc[id] = k; base[id + 1] = base[id] + k;
  }
  const nodes = base[total];
  const dist = new Int16Array(nodes).fill(-1), parent = new Int32Array(nodes).fill(-1), via = new Int16Array(nodes).fill(-1);
  const cfgOf = new Int32Array(nodes);
  for (let id = 0; id < total; id++) for (let k = 0; k < kc[id]; k++) cfgOf[base[id] + k] = id;
  const queue = new Int32Array(nodes); let qh = 0, qt = 0;
  for (let id = 0; id < total; id++) { const k = labs[id * n + L.E]; if (k >= 0) { const nd = base[id] + k; dist[nd] = 0; queue[qt++] = nd; } }
  const rev = Array.from({ length: total }, () => []);              // rev[c2] = [[c, who]] for every action c -> c2
  for (let id = 0; id < total; id++) for (const [d2, who] of actions(L, decode(id))) rev[encode(d2)].push([id, who]);
  while (qh < qt) {
    const nd = queue[qh++], id = cfgOf[nd], k = nd - base[id], d0 = dist[nd];
    for (const [id2, who] of rev[id]) {
      let seen = 0;
      for (let x = 0; x < n; x++) {
        if (labs[id * n + x] !== k) continue;
        const k2 = labs[id2 * n + x];
        if (k2 < 0 || (seen >> k2 & 1)) continue;
        seen |= 1 << k2;
        const nd2 = base[id2] + k2;
        if (dist[nd2] >= 0) continue;
        dist[nd2] = d0 + 1; parent[nd2] = nd; via[nd2] = who; queue[qt++] = nd2;
      }
    }
  }
  return { n, total, rad, labs, kc, base, dist, parent, via, cfgOf, decode };
}

function floorConnected(L, extraBlock) {
  const { w, h, wall } = L, n = w * h, seen = new Uint8Array(n);
  let s = -1, count = 0;
  for (let c = 0; c < n; c++) if (!wall[c] && !(extraBlock && extraBlock[c])) { count++; if (s < 0) s = c; }
  if (s < 0) return false;
  const st = [s]; seen[s] = 1; let got = 1;
  while (st.length) {
    const c = st.pop(), x = c % w, y = (c / w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d]; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = ny * w + nx;
      if (wall[q] || (extraBlock && extraBlock[q]) || seen[q]) continue;
      seen[q] = 1; got++; st.push(q);
    }
  }
  return got === count;
}

/* spec: { w,h, blocks, cams, guards, doors, mirrors, cap, minUnused } */
function randomLayout(rnd, spec) {
  const { w, h } = spec, n = w * h, wall = new Uint8Array(n);
  for (let x = 0; x < w; x++) { wall[x] = 1; wall[(h - 1) * w + x] = 1; }
  for (let y = 0; y < h; y++) { wall[y * w] = 1; wall[y * w + w - 1] = 1; }
  const pick = a => a[(rnd() * a.length) | 0];
  const shapes = [[[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [0, 1]]];
  const L = { w, h, wall, S: -1, E: -1, cams: [], guards: [], toggles: [] };
  for (let b = 0, tries = 0; b < spec.blocks && tries < 60; tries++) {
    const sh = pick(shapes), x0 = 1 + ((rnd() * (w - 2)) | 0), y0 = 1 + ((rnd() * (h - 2)) | 0), cells = sh.map(([dx, dy]) => (y0 + dy) * w + x0 + dx);
    if (sh.some(([dx, dy]) => x0 + dx >= w - 1 || y0 + dy >= h - 1) || cells.some(c => wall[c])) continue;
    cells.forEach(c => { wall[c] = 1; });
    if (!floorConnected(L)) { cells.forEach(c => { wall[c] = 0; }); continue; }
    b++;
  }
  const floor = []; for (let c = 0; c < n; c++) if (!wall[c]) floor.push(c);
  if (floor.length < 6) return null;
  L.E = pick(floor);
  const used = new Set([L.E]);
  // guards: straight rails of 3-4 floor cells
  for (let g = 0; g < spec.guards; g++) {
    let placed = false;
    for (let tries = 0; tries < 60 && !placed; tries++) {
      const len = 3 + ((rnd() * 2) | 0), horiz = rnd() < .5, x0 = (rnd() * w) | 0, y0 = (rnd() * h) | 0, rail = [];
      for (let k = 0; k < len; k++) {
        const x = x0 + (horiz ? k : 0), y = y0 + (horiz ? 0 : k);
        if (x >= w || y >= h) break;
        const c = y * w + x; if (wall[c] || used.has(c)) break; rail.push(c);
      }
      if (rail.length < 3) continue;
      rail.forEach(c => used.add(c));
      L.guards.push({ rail, i: 0, f: 0, range: spec.range || 3 }); placed = true;
    }
    if (!placed) return null;
  }
  const free = () => floor.filter(c => !used.has(c));
  // doors prefer corridor cells (walls on two opposite sides)
  for (let d = 0; d < spec.doors; d++) {
    const cand = free(), corr = cand.filter(c => { const x = c % w, y = (c / w) | 0; return (wall[c - 1] && wall[c + 1] && !wall[c - w] && !wall[c + w]) || (wall[c - w] && wall[c + w] && !wall[c - 1] && !wall[c + 1]); });
    const pool = corr.length && rnd() < .8 ? corr : cand; if (!pool.length) return null;
    const c = pick(pool); used.add(c); L.toggles.push({ c, kind: 'door', s: 0 });
  }
  const pillars = new Uint8Array(n);
  for (let m = 0; m < spec.mirrors; m++) {
    const cand = free(); if (!cand.length) return null;
    const c = pick(cand); used.add(c); pillars[c] = 1; L.toggles.push({ c, kind: 'mirror', s: 0 });
  }
  if (!floorConnected(L, pillars)) return null;
  // cameras on wall cells that touch the floor
  const mounts = [];
  for (let c = 0; c < n; c++) {
    if (!wall[c]) continue;
    const x = c % w, y = (c / w) | 0;
    if (x > 0 && !wall[c - 1] || x < w - 1 && !wall[c + 1] || y > 0 && !wall[c - w] || y < h - 1 && !wall[c + w]) mounts.push(c);
  }
  for (let k = 0; k < spec.cams; k++) {
    if (!mounts.length) return null;
    const c = mounts.splice((rnd() * mounts.length) | 0, 1)[0];
    L.cams.push({ c, d: 0 });
  }
  return L;
}

function mounts(L) {
  const { w, h, wall } = L, out = [];
  for (let c = 0; c < w * h; c++) {
    if (!wall[c]) continue;
    const x = c % w, y = (c / w) | 0;
    if (x > 0 && !wall[c - 1] || x < w - 1 && !wall[c + 1] || y > 0 && !wall[c - w] || y < h - 1 && !wall[c + w]) out.push(c);
  }
  return out;
}
function cloneLevel(L) {
  return { w: L.w, h: L.h, wall: L.wall.slice(), S: L.S, E: L.E, cams: L.cams.map(c => ({ ...c })),
    guards: L.guards.map(g => ({ ...g, rail: g.rail.slice() })), toggles: L.toggles.map(t => ({ ...t })) };
}
/* One random change to a layout (walls, exit, a camera mount, a guard rail, a door or a mirror). null if it breaks the layout. */
function mutateLayout(L, rnd) {
  const M = cloneLevel(L), { w, h } = M, n = w * h, pick = a => a[(rnd() * a.length) | 0];
  const busy = new Set([M.E]);
  M.guards.forEach(g => g.rail.forEach(c => busy.add(c))); M.toggles.forEach(t => busy.add(t.c)); M.cams.forEach(c => busy.add(c.c));
  const k = rnd();
  if (k < .35) {                                                   // flip an interior wall cell
    const c = (1 + ((rnd() * (h - 2)) | 0)) * w + 1 + ((rnd() * (w - 2)) | 0);
    if (busy.has(c)) return null;
    M.wall[c] ^= 1;
  } else if (k < .5) {                                             // move the exit
    const fl = []; for (let c = 0; c < n; c++) if (!M.wall[c] && !busy.has(c)) fl.push(c);
    if (!fl.length) return null; M.E = pick(fl);
  } else if (k < .72 && M.cams.length) {                           // move a camera to another mount
    const ms = mounts(M).filter(c => !M.cams.some(q => q.c === c)); if (!ms.length) return null;
    pick(M.cams).c = pick(ms);
  } else if (k < .84 && M.guards.length) {                         // slide or re-draw a guard rail
    const g = pick(M.guards), len = g.rail.length, horiz = (g.rail[0] % w) !== (g.rail[len - 1] % w);
    const x0 = (g.rail[0] % w) + (rnd() < .5 ? 0 : (horiz ? (rnd() < .5 ? -1 : 1) : 0)), y0 = ((g.rail[0] / w) | 0) + (rnd() < .5 ? 0 : (horiz ? 0 : (rnd() < .5 ? -1 : 1)));
    const nr = []; for (let q = 0; q < len; q++) { const x = x0 + (horiz ? q : 0), y = y0 + (horiz ? 0 : q); if (x < 0 || y < 0 || x >= w || y >= h) return null; nr.push(y * w + x); }
    if (nr.some(c => M.wall[c] || c === M.E || (busy.has(c) && !g.rail.includes(c)))) return null;
    g.rail = nr; g.i = Math.min(g.i, len - 1);
  } else if (M.toggles.length) {                                   // move a door or mirror
    const t = pick(M.toggles), fl = []; for (let c = 0; c < n; c++) if (!M.wall[c] && !busy.has(c)) fl.push(c);
    if (!fl.length) return null; t.c = pick(fl);
  } else return null;
  for (const c of M.cams) if (!M.wall[c.c]) return null;
  if (!mounts(M).length || M.wall[M.E]) return null;
  for (const g of M.guards) if (g.rail.some(c => M.wall[c])) return null;
  for (const t of M.toggles) if (M.wall[t.c]) return null;
  const pillars = new Uint8Array(n); M.toggles.forEach(t => { if (t.kind === 'mirror') pillars[t.c] = 1; });
  if (!floorConnected(M, pillars)) return null;
  // a camera whose neighbours became all wall can light nothing
  for (const c of M.cams) {
    const x = c.c % w, y = (c.c / w) | 0;
    if (!(x > 0 && !M.wall[c.c - 1] || x < w - 1 && !M.wall[c.c + 1] || y > 0 && !M.wall[c.c - w] || y < h - 1 && !M.wall[c.c + w])) return null;
  }
  return M;
}

/* How many watchers/objects the level cannot be solved without: freeze each one and see whether par gets worse. */
function necessary(L, par) {
  const total = L.cams.length + L.guards.length + L.toggles.length;
  let cnt = 0;
  for (let k = 0; k < total; k++) { const r = solve(L, { frozen: new Set([k]), maxDepth: par }); if (!r || !r.solvable || r.par > par) cnt++; }
  return cnt;
}

/* Chooses a starting state at exactly `t` actions from the exit in which enough of the watchers matter. */
function pickStart(L, g, rnd, t, minUsed) {
  const cands = [];
  for (let nd = 0; nd < g.dist.length; nd++) if (g.dist[nd] === t) cands.push(nd);
  if (!cands.length) return null;
  let best = -1, bestScore = -1;
  for (let s = 0; s < Math.min(120, cands.length); s++) {
    const nd = cands[(rnd() * cands.length) | 0], users = new Set();
    for (let q = nd; g.parent[q] >= 0; q = g.parent[q]) users.add(g.via[q]);
    const sc = users.size + rnd() * .5;
    if (users.size >= minUsed && sc > bestScore) { best = nd; bestScore = sc; }
  }
  return best < 0 ? null : best;
}
function applyStart(L, g, nd, rnd) {
  const id = g.cfgOf[nd], k = nd - g.base[id], dg = g.decode(id), nc = L.cams.length, ng = L.guards.length;
  const marked = new Set(L.toggles.map(t => t.c)); L.guards.forEach(gd => gd.rail.forEach(c => marked.add(c)));      // the ASCII form cannot show S on these
  const cells = []; for (let x = 0; x < g.n; x++) if (g.labs[id * g.n + x] === k && x !== L.E && !marked.has(x)) cells.push(x);
  if (!cells.length) return false;
  L.S = cells[(rnd() * cells.length) | 0];
  L.cams.forEach((c, i) => { c.d = dg[i]; });
  L.guards.forEach((gd, i) => { gd.i = dg[nc + i] >> 1; gd.f = dg[nc + i] & 1; });
  L.toggles.forEach((tg, i) => { tg.s = dg[nc + ng + i]; });
  return true;
}

/* Builds one level whose par is `target` (or one less). A random layout is grown by hill-climbing on the largest
   par its whole state graph contains, then a starting state at the wanted par is chosen. null when attempts run out. */
function genLevel(spec, seed, target, iters) {
  const rnd = mulberry32(seed);
  let L = null;
  for (let t = 0; t < 40 && !L; t++) L = randomLayout(rnd, spec);
  if (!L) return null;
  const total = L.cams.length + L.guards.length + L.toggles.length, minUsed = total - (total <= 3 ? 0 : (spec.minUnused == null ? 1 : spec.minUnused));
  let cur = buildGraph(L, spec.cap || 20000), curScore = -1;
  const maxOf = g => { let m = 0; for (let i = 0; i < g.dist.length; i++) if (g.dist[i] > m) m = g.dist[i]; return m; };
  if (cur) curScore = maxOf(cur);
  const t0 = Date.now(), budget = spec.timeMs || 25000;
  for (let it = 0; it < (iters || 400); it++) {
    if (Date.now() - t0 > budget) return null;
    if (cur && curScore >= target - 1) {
      for (let tryNo = 0; tryNo < 8; tryNo++) {
        const t = tryNo % 2 ? Math.max(1, target - 1) : target;
        const nd = pickStart(L, cur, rnd, t, Math.max(1, minUsed - 1));
        if (nd === null) continue;
        if (!applyStart(L, cur, nd, rnd)) continue;
        const r = solve(L, { maxDepth: 40 });
        if (!r || !r.solvable || r.par !== t) continue;
        const need = necessary(L, t);
        if (need >= minUsed) return { level: L, par: t, used: need, total, states: r.explored, iters: it };
      }
    }
    const M = mutateLayout(L, rnd); if (!M) continue;
    const g = buildGraph(M, spec.cap || 20000); if (!g) continue;
    const sc = Math.min(maxOf(g), target + 1);
    if (!cur || sc >= curScore) { L = M; cur = g; curScore = sc; }
  }
  return null;
}

const api = { _layout: randomLayout, solve, draw, mulberry32, hash2, initialDigits, evalConfig, prepare, parseLevel, toMap, guardFacingDir, radices, actions, genLevel, buildGraph };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.Prison = api;
})();
