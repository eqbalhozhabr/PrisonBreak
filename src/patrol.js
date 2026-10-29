/* Blind Eye, "Patrol" prototype: the same prisoner-and-guards idea without the visible grid and without the player moving the guards.
 *
 *  - The world is still a hidden grid of small cells (the picture hides it), but time runs in TICKS and everyone moves on their own:
 *    guards walk a fixed patrol loop (one cell per tick, with holds and look-arounds), cameras pan on a fixed schedule.
 *  - The prisoner acts once per turn: walk one cell (8 directions, no corner cutting), crawl one cell (two ticks), get down / stand up, wait, or throw a stone.
 *    Every action lets the world advance by its number of ticks. The player's score is the time (ticks) it takes.
 *  - Sight is a true cone: a facing (8 directions), a half angle, a NEAR range and a FAR range, blocked by walls. Inside NEAR he is seen in any stance. In the FAR part
 *    he is seen only while standing, and only after `delay` ticks in a row (the guard "makes up his mind"). Guards also hear: a prisoner who walks (not crawls)
 *    within `hear` cells of a guard is caught whatever the cone says.
 *  - A thrown stone makes a noise at its landing cell. A guard within `noiseR` cells who is on patrol (or looking around) walks there by the shortest way,
 *    looks around for `linger` ticks, walks back to the patrol point he left and carries on. The thrower has `throws` stones in a level.
 *  - Detection ends the attempt. The exact solver (Dijkstra over ticks) gives the fastest safe plan = par.
 */
(function () {
'use strict';
const DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [-1, -1, 0, 1, 1, 1, 0, -1];          // 0 = north, clockwise in steps of 45 degrees
const DEFAULTS = { gNear: 3, gFar: 6, gHalf: 38, cNear: 3.5, cFar: 8, cHalf: 26, hear: 1.6, noiseR: 5, throwR: 5, linger: 4, delay: 2 };
const vec = f => { const a = f * Math.PI / 4; return [Math.sin(a), -Math.cos(a)]; };
const dirOf = (dx, dy) => { for (let d = 0; d < 8; d++) if (DX[d] === Math.sign(dx) && DY[d] === Math.sign(dy)) return d; return 0; };

/* spec: { w, h, map:[rows with # . S E], guards:[{way:[[x,y,hold,look[]],...], f?, start?}], cams:[{x,y,pan:[f..],dwell}], throws, p:{overrides} } */
function parse(spec) {
  const h = spec.map.length, w = spec.map[0].length, wall = new Uint8Array(w * h), L = { w, h, wall, S: -1, E: -1, guards: [], cams: [], throws: spec.throws || 0, p: Object.assign({}, DEFAULTS, spec.p || {}), name: spec.name, id: spec.id, dist: new Map() };
  spec.map.forEach((row, y) => { if (row.length !== w) throw new Error('ragged row ' + y); [...row].forEach((ch, x) => { const c = y * w + x; if (ch === '#') wall[c] = 1; else if (ch === 'S') L.S = c; else if (ch === 'E') L.E = c; }); });
  for (const g of spec.guards || []) L.guards.push(expandGuard(L, g));
  for (const q of spec.cams || []) { const F = []; for (const f of q.pan) for (let k = 0; k < (q.dwell || 3); k++) F.push(f); L.cams.push({ c: q.y * w + q.x, F, start: q.start || 0 }); }
  L.camPeriod = L.cams.reduce((m, q) => lcm(m, q.F.length), 1);
  return L;
}
const gcd = (a, b) => b ? gcd(b, a % b) : a, lcm = (a, b) => a / gcd(a, b) * b;
const free = (L, x, y) => x >= 0 && y >= 0 && x < L.w && y < L.h && !L.wall[y * L.w + x];
/* may a body step from cell c in direction d? (no corner cutting) */
function canStep(L, c, d) {
  const x = c % L.w, y = (c / L.w) | 0, nx = x + DX[d], ny = y + DY[d];
  if (!free(L, nx, ny)) return false;
  if (DX[d] && DY[d] && (!free(L, nx, y) || !free(L, x, ny))) return false;
  return true;
}
const stepTo = (L, c, d) => c + DY[d] * L.w + DX[d];
/* BFS distance from `target` over walkable cells (8 directions, no corner cutting); cached per level */
function distFrom(L, target) {
  let D = L.dist.get(target); if (D) return D;
  D = new Int16Array(L.w * L.h).fill(-1); D[target] = 0; const q = [target];
  for (let i = 0; i < q.length; i++) { const c = q[i]; for (let d = 0; d < 8; d++) { const n = stepTo(L, c, d); if (!canStep(L, c, d) || D[n] >= 0) continue; D[n] = D[c] + 1; q.push(n); } }
  L.dist.set(target, D); return D;
}
/* the neighbour of c that is closest to the target (ties: lowest direction); returns the direction or -1 */
function nextDir(L, c, target) {
  const D = distFrom(L, target); let best = -1, bd = D[c];
  for (let d = 0; d < 8; d++) if (canStep(L, c, d)) { const n = stepTo(L, c, d); if (D[n] >= 0 && D[n] < bd) { bd = D[n]; best = d; } }
  return best;
}
function expandGuard(L, g) {
  const way = g.way.map(([x, y, hold, look]) => ({ c: y * L.w + x, hold: hold || 0, look: look || null })), P = [];
  let f = g.f != null ? g.f : 0, c = way[0].c;
  for (let i = 0; i < way.length; i++) {
    const wp = way[i]; for (let k = 0; k < wp.hold; k++) { if (wp.look) f = wp.look[k % wp.look.length]; P.push({ c: wp.c, f }); }
    const to = way[(i + 1) % way.length].c; let cur = wp.c;
    while (cur !== to) { const d = nextDir(L, cur, to); if (d < 0) throw new Error('patrol leg has no way'); cur = stepTo(L, cur, d); f = d; P.push({ c: cur, f }); }
  }
  if (!P.length) throw new Error('empty patrol');
  const near = g.near != null ? g.near : L.p.gNear, far = g.far != null ? g.far : L.p.gFar, half = g.half != null ? g.half : L.p.gHalf;
  return { P, start: g.start || 0, near, far, half: Math.cos(half * Math.PI / 180), halfDeg: half, hear: g.hear != null ? g.hear : L.p.hear };
}

/* ------------------------------------------------------------------ sight */
function los(L, ax, ay, bx, by, skipA, skipB) {                                            // ax.. are cell centres in cell units
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy), n = Math.max(1, Math.ceil(d * 5));
  for (let i = 1; i < n; i++) { const x = ax + dx * i / n, y = ay + dy * i / n, cx = Math.floor(x), cy = Math.floor(y), c = cy * L.w + cx; if (c !== skipA && c !== skipB && !free(L, cx, cy)) return false; }
  return true;
}
/* 0 unseen, 1 far (standing only), 2 near */
function look(L, src, c, f, tc, stance) {
  const sx = c % L.w, sy = (c / L.w) | 0, tx = tc % L.w, ty = (tc / L.w) | 0, dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy);
  if (d < 0.01) return 2;
  if (d > src.far) return 0;
  const [fx, fy] = vec(f); if ((dx * fx + dy * fy) / d < src.half - 1e-9) return 0;
  if (!los(L, sx + .5, sy + .5, tx + .5, ty + .5, c, tc)) return 0;
  if (d <= src.near) return 2;
  return stance === 1 ? 0 : 1;
}

/* ------------------------------------------------------------------ state */
/* st = { p, s (0 stand, 1 prone), th (stones left), t (camera phase), g:[{pi,c,f,m,tg,cn,hm,sus}], cs:[sus] }  m: 0 patrol, 1 go to noise, 2 look around, 3 go back */
function initial(L) {
  return { p: L.S, s: 0, th: L.throws, t: 0, tk: 0, g: L.guards.map(g => { const e = g.P[g.start % g.P.length]; return { pi: g.start % g.P.length, c: e.c, f: e.f, m: 0, tg: -1, cn: 0, hm: 0, sus: 0 }; }), cs: L.cams.map(() => 0) };
}
const clone = st => ({ p: st.p, s: st.s, th: st.th, t: st.t, tk: st.tk, g: st.g.map(q => Object.assign({}, q)), cs: st.cs.slice() });
const key = st => st.p + ',' + st.s + ',' + st.th + ',' + st.t + '|' + st.g.map(q => q.pi + ':' + q.c + ':' + q.f + ':' + q.m + ':' + q.tg + ':' + q.cn + ':' + q.hm + ':' + q.sus).join(';') + '|' + st.cs.join('');
const camFacing = (L, st, k) => { const q = L.cams[k]; return q.F[(st.t + q.start) % q.F.length]; };

/* one tick of the world. noise: landing cell of a stone this tick (or -1); moved: the prisoner walked this tick (footsteps). Returns { st, caught } */
function tick(L, st0, noise, moved) {
  const st = clone(st0); st.tk++;
  L.guards.forEach((G, i) => {
    const g = st.g[i];
    if (noise >= 0 && (g.m === 0 || g.m === 2)) {
      const dx = (g.c % L.w) - (noise % L.w), dy = ((g.c / L.w) | 0) - ((noise / L.w) | 0);
      if (Math.hypot(dx, dy) <= L.p.noiseR) { if (g.m === 0) g.hm = g.pi; g.m = 1; g.tg = noise; }
    }
    if (g.m === 0) { g.pi = (g.pi + 1) % G.P.length; g.c = G.P[g.pi].c; g.f = G.P[g.pi].f; }
    else if (g.m === 1) {
      if (g.c === g.tg) { g.m = 2; g.cn = L.p.linger; }
      else { const d = nextDir(L, g.c, g.tg); if (d >= 0) { g.c = stepTo(L, g.c, d); g.f = d; } if (g.c === g.tg) { g.m = 2; g.cn = L.p.linger; } }
    } else if (g.m === 2) { g.f = (g.f + 2) % 8; if (--g.cn <= 0) g.m = 3; }
    else if (g.m === 3) {
      const home = G.P[g.hm].c;
      if (g.c === home) { g.m = 0; g.pi = g.hm; g.f = G.P[g.hm].f; }
      else { const d = nextDir(L, g.c, home); if (d >= 0) { g.c = stepTo(L, g.c, d); g.f = d; } if (g.c === home) { g.m = 0; g.pi = g.hm; g.f = G.P[g.hm].f; } }
    }
  });
  if (L.cams.length) st.t = (st.t + 1) % L.camPeriod;
  // who sees him now
  let caught = null;
  const seeing = (lv, src, k, kind, sus, set) => {
    if (lv === 2) { caught = caught || { src: kind + k, lvl: 2 }; set(0); return; }
    if (lv === 1) { const v = sus + 1; set(v); if (v >= L.p.delay) caught = caught || { src: kind + k, lvl: 1 }; return; }
    set(0);
  };
  L.guards.forEach((G, i) => {
    const g = st.g[i]; let lv = look(L, G, g.c, g.f, st.p, st.s);
    if (moved && st.s === 0 && lv < 2) { const dx = (g.c % L.w) - (st.p % L.w), dy = ((g.c / L.w) | 0) - ((st.p / L.w) | 0); if (Math.hypot(dx, dy) <= G.hear) lv = 2; }
    seeing(lv, G, i, 'g', g.sus, v => { g.sus = v; });
  });
  L.cams.forEach((q, k) => {
    const src = { near: L.p.cNear, far: L.p.cFar, half: Math.cos(L.p.cHalf * Math.PI / 180) };
    seeing(look(L, src, q.c, camFacing(L, st, k), st.p, st.s), src, k, 'c', st.cs[k], v => { st.cs[k] = v; });
  });
  return { st, caught };
}

/* the prisoner's possible actions from a state: { t:'move', d } | { t:'stance' } | { t:'wait' } | { t:'throw', T } */
function actions(L, st) {
  const out = [], occ = new Set(st.g.map(g => g.c));
  for (let d = 0; d < 8; d++) if (canStep(L, st.p, d) && !occ.has(stepTo(L, st.p, d))) out.push({ t: 'move', d });
  out.push({ t: 'stance' }, { t: 'wait' });
  if (st.th > 0) {
    const px = st.p % L.w, py = (st.p / L.w) | 0, R = L.p.throwR;
    for (let y = Math.max(0, py - R); y <= Math.min(L.h - 1, py + R); y++) for (let x = Math.max(0, px - R); x <= Math.min(L.w - 1, px + R); x++) {
      const c = y * L.w + x; if (L.wall[c] || c === st.p) continue;
      if (Math.hypot(x - px, y - py) > R) continue;
      if (st.g.some(g => g.m === 0 || g.m === 2 ? Math.hypot((g.c % L.w) - x, ((g.c / L.w) | 0) - y) <= L.p.noiseR : false)) out.push({ t: 'throw', T: c });   // only stones somebody can hear
    }
  }
  return out;
}
/* apply an action: returns { frames:[state after each tick], caught, ticks } (frames stop at the tick he is caught) */
function step(L, st0, act) {
  let st = clone(st0), ticks = 1, noise = -1, moved = false;
  if (act.t === 'move') { st.p = stepTo(L, st.p, act.d); ticks = st.s === 1 ? 2 : 1; moved = st.s === 0; }
  else if (act.t === 'stance') st.s = 1 - st.s;
  else if (act.t === 'throw') { st.th--; noise = act.T; }
  const frames = []; let caught = null;
  for (let i = 0; i < ticks && !caught; i++) { const r = tick(L, st, i === 0 ? noise : -1, i === 0 && moved); st = r.st; caught = r.caught; frames.push(st); }
  return { frames, caught, ticks, last: st };
}
const won = (L, st) => st.p === L.E;

/* exact search: fewest ticks to stand on the exit unseen. opts: { st, maxTicks, maxStates } */
function solve(L, opts) {
  opts = opts || {}; const st0 = opts.st || initial(L), maxT = opts.maxTicks || 80, maxS = opts.maxStates || 2e6;
  const dist = new Map(), par = new Map(), buckets = [[st0]]; dist.set(key(st0), 0);
  let goal = null;
  for (let d = 0; d <= maxT && !goal; d++) {
    const q = buckets[d]; if (!q) continue;
    for (let i = 0; i < q.length && !goal; i++) {
      const st = q[i], k = key(st); if (dist.get(k) < d) continue;
      if (won(L, st)) { goal = k; break; }
      if (dist.size > maxS) return { solvable: false, capped: true, explored: dist.size };
      for (const a of actions(L, st)) {
        const r = step(L, st, a); if (r.caught) continue;
        const ns = r.last, nd = d + r.ticks, nk = key(ns), old = dist.get(nk);
        if (old !== undefined && old <= nd) continue;
        dist.set(nk, nd); par.set(nk, [k, a]); (buckets[nd] = buckets[nd] || []).push(ns);
      }
    }
  }
  if (!goal) return { solvable: false, explored: dist.size };
  const plan = []; let kk = goal; while (par.has(kk)) { const [p, a] = par.get(kk); plan.push(a); kk = p; } plan.reverse();
  return { solvable: true, par: dist.get(goal), plan, explored: dist.size };
}
/* the shortest walk with no guards at all, in ticks (for judging how much the patrols matter) */
const freeWalk = L => { const D = distFrom(L, L.E); return D[L.S]; };

const api = { DX, DY, DEFAULTS, parse, initial, clone, key, tick, actions, step, won, solve, look, distFrom, nextDir, canStep, stepTo, vec, freeWalk, camFacing, los };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.Patrol = api;
})();
