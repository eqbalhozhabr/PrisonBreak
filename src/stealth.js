/* Blind Eye, "Stealth" rule set: three layers on top of the classic rules in src/prison.js (which this file only reads, never changes).
 *
 *  1. Two-zone sight (stance). Every sight line has a NEAR part (the first `camNear` / `guardNear` cells from its source) and a FAR part (the rest).
 *     A near cell is lethal in any stance. A far cell is lethal only to a prisoner who stands: he can CRAWL through it, at a cost of `crawl` moves per
 *     far cell he enters. Searchlights and dogs are all "near": light and scent defeat the crawl. Mirrors keep counting the distance along the bent line.
 *  2. Crawl. Walking on dark cells stays free. Entering a far cell costs `crawl`; leaving it onto a dark cell is free. After every action the
 *     prisoner's own cell must not be near-lit (he may be lying in a far cell while the world changes around him).
 *  3. Lure (distraction). The prisoner throws a stone at a cell within `throwR` (Chebyshev) of where he is. Every guard within `hearR` (Manhattan) of
 *     that cell turns to face it, along his rail (if the cell is ahead of him he faces forward, if behind, backward, if level with him he is unmoved)
 *     and, with `lureStep` (on by default), also walks one step toward it to investigate. Turning alone proved almost useless on the classic levels
 *     (it helped 4 in 100 random layouts), turning and stepping helps about 1 in 3. One lure is one action and spends one of the level's `lures` (a level can give none).
 *
 *  Cost of a plan = actions (including lures) + crawled cells.  The exact solver below is a Dijkstra-style search over
 *  (configuration, lures left, the prisoner's cell). A level carries its own `stealth` object; missing keys take DEFAULTS.
 */
(function () {
'use strict';
const P = (typeof module !== 'undefined' && module.exports) ? require('./prison.js') : window.Prison;
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const DEFAULTS = { camNear: 2, guardNear: 2, crawl: 1, lures: 0, throwR: 3, hearR: 4, lureStep: 1 };
const params = L => Object.assign({}, DEFAULTS, L.stealth || {});
const nOf = L => [L.cams.length, L.guards.length, (L.toggles || []).length, (L.dogs || []).length, (L.lights || []).length];

/* cls: 0 dark, 1 far (lethal standing only), 2 near / lit / scented (lethal always). occ: cells nobody can stand on. rays: for drawing, each with .near = number of near cells (Infinity for a light). */
function evalStealth(L, dg, wantRays) {
  P.prepare(L);
  const st = params(L), e = P.evalConfig(L, dg, true), n = L.w * L.h, cls = new Uint8Array(n), [nc, ng] = nOf(L);
  let base = 0;
  for (const sg of e.rays) {
    if (sg.first) base = 0;
    const near = sg.who < nc ? st.camNear : sg.who < nc + ng ? st.guardNear : Infinity; sg.near = near;
    sg.cells.forEach((c, i) => { const d = base + i + 1, v = d <= near ? 2 : 1; if (v > cls[c]) cls[c] = v; sg.d0 = base; });
    base += sg.cells.length + (sg.mirror !== undefined ? 1 : 0);
  }
  for (let c = 0; c < n; c++) if (e.scent[c]) cls[c] = 2;
  return { cls, occ: e.occ, rays: wantRays ? e.rays : null, scent: e.scent };
}

/* the digits after a lure thrown at cell T (guards turn; with lureStep they also take a step), then the searchlights swing. */
function lureApply(L, dg, T) {
  P.prepare(L);
  const st = params(L), [nc] = nOf(L), d2 = dg.slice(), tx = T % L.w, ty = (T / L.w) | 0;
  L.guards.forEach((g, k) => {
    const v = dg[nc + k], i = v >> 1, gp = g.rail[i], gx = gp % L.w, gy = (gp / L.w) | 0;
    if (Math.abs(gx - tx) + Math.abs(gy - ty) > st.hearR) return;
    const d0 = P.guardFacingDir(g, 0), dot = (tx - gx) * DX[d0] + (ty - gy) * DY[d0];
    if (!dot) return;
    let ni = i; const f = dot > 0 ? 0 : 1;
    if (st.lureStep) { const s = dot > 0 ? 1 : -1, q = i + s; if (q >= 0 && q < g.rail.length && !L.guards.some((o, z) => z !== k && o.rail[dg[nc + z] >> 1] === g.rail[q])) ni = q; }
    d2[nc + k] = ni * 2 + f;
  });
  return P.sweep(L, d2);
}
/* the cells a stone can be thrown at from cell p */
function throwCells(L, p) {
  const st = params(L), out = [], px = p % L.w, py = (p / L.w) | 0;
  for (let y = Math.max(0, py - st.throwR); y <= Math.min(L.h - 1, py + st.throwR); y++) for (let x = Math.max(0, px - st.throwR); x <= Math.min(L.w - 1, px + st.throwR); x++) { const c = y * L.w + x; if (!L.wall[c]) out.push(c); }
  return out;
}
/* every distinct lure from cell p: [newDigits, T] */
function lures(L, dg, p) {
  const seen = new Set(), out = [];
  for (const T of throwCells(L, p)) { const d2 = lureApply(L, dg, T), k = d2.join(','); if (k === dg.join(',') || seen.has(k)) continue; seen.add(k); out.push([d2, T]); }
  return out;
}

/* cheapest walk inside one configuration from a to b: { cost (crawled cells), path:[cells after a], crawl:[bool per cell] } or null */
function walkPath(L, ev, a, b) {
  const st = params(L), { w, h, wall } = L, n = w * h, cost = new Int32Array(n).fill(1e9), prev = new Int32Array(n).fill(-1);
  const ok = c => !wall[c] && !ev.occ[c] && ev.cls[c] < 2;
  if (!ok(a) || !ok(b)) return null;
  const buckets = [[a]]; cost[a] = 0;
  for (let d = 0; d < buckets.length; d++) {
    const q = buckets[d]; if (!q) continue;
    for (let i = 0; i < q.length; i++) {
      const c = q[i]; if (cost[c] < d) continue;
      if (c === b) { const path = [], crawl = []; for (let x = b; x !== a; x = prev[x]) { path.push(x); crawl.push(ev.cls[x] === 1); } return { cost: d, path: path.reverse(), crawl: crawl.reverse() }; }
      const x = c % w, y = (c / w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k], ny = y + DY[k]; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const r = ny * w + nx; if (!ok(r)) continue;
        const nd = d + (ev.cls[r] === 1 ? st.crawl : 0);
        if (nd < cost[r]) { cost[r] = nd; prev[r] = c; (buckets[nd] = buckets[nd] || []).push(r); }
      }
    }
  }
  return null;
}

/* Exact search. opts: { digits, thief, lures (left), maxCost, maxStates }. Returns { solvable, par, actions, crawled, lures, steps:[{t:'act'|'lure'|'move', ...}], explored } */
function solveStealth(L, opts) {
  opts = opts || {}; P.prepare(L);
  const st = params(L), n = L.w * L.h, rad = P.radices(L), maxStates = opts.maxStates || 1.2e6, maxCost = opts.maxCost || 40;
  let total = 1; for (const r of rad) total *= r;
  if (total > 2.5e6) return null;
  const mul = new Array(rad.length); { let m = 1; for (let i = rad.length - 1; i >= 0; i--) { mul[i] = m; m *= rad[i]; } }
  const encode = d => d.reduce((s, v, i) => s + v * mul[i], 0), decode = id => rad.map((r, i) => ((id / mul[i]) | 0) % r);
  const cache = new Map(), ev = id => { let c = cache.get(id); if (!c) { c = evalStealth(L, decode(id), false); cache.set(id, c); } return c; };
  const M = (opts.lures != null ? opts.lures : st.lures) + 1;
  const key = (id, ch, cell) => (id * M + ch) * n + cell;
  const id0 = encode(opts.digits || P.initialDigits(L)), cell0 = opts.thief != null ? opts.thief : L.S, ch0 = M - 1;
  const e0 = ev(id0);
  if (cell0 < 0 || L.E < 0) return { solvable: false, reason: 'no start or exit' };
  if (e0.cls[cell0] >= 2 || e0.occ[cell0]) return { solvable: false, reason: 'start lit' };
  const dist = new Map(), par = new Map(), buckets = [[[id0, ch0, cell0]]];
  dist.set(key(id0, ch0, cell0), 0);
  const push = (d, id, ch, cell, from, step) => {
    const k = key(id, ch, cell), old = dist.get(k);
    if (old !== undefined && old <= d) return;
    dist.set(k, d); par.set(k, [from, step]); (buckets[d] = buckets[d] || []).push([id, ch, cell]);
  };
  let goal = null, goalCost = 0;
  for (let d = 0; d <= maxCost && goal === null; d++) {
    const q = buckets[d]; if (!q) continue;
    for (let i = 0; i < q.length && goal === null; i++) {
      const [id, ch, cell] = q[i], k = key(id, ch, cell);
      if (dist.get(k) < d) continue;
      if (cell === L.E) { goal = k; goalCost = d; break; }
      if (dist.size > maxStates) return { solvable: false, capped: true, explored: dist.size };
      const cur = ev(id), x = cell % L.w, y = (cell / L.w) | 0;
      for (let dd = 0; dd < 4; dd++) {                                                  // walk (free on dark cells) or crawl (far cells)
        const nx = x + DX[dd], ny = y + DY[dd]; if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        const r = ny * L.w + nx; if (L.wall[r] || cur.occ[r] || cur.cls[r] >= 2) continue;
        push(d + (cur.cls[r] === 1 ? st.crawl : 0), id, ch, r, k, { t: 'move', cell: r, crawl: cur.cls[r] === 1 });
      }
      const dg = decode(id);
      for (const [d2, who] of P.actions(L, dg)) {                                       // an ordinary action
        const id2 = encode(d2), e2 = ev(id2); if (e2.cls[cell] >= 2 || e2.occ[cell]) continue;
        push(d + 1, id2, ch, cell, k, { t: 'act', who, d: d2 });
      }
      if (ch > 0) for (const [d2, T] of lures(L, dg, cell)) {                           // a lure
        const id2 = encode(d2), e2 = ev(id2); if (e2.cls[cell] >= 2 || e2.occ[cell]) continue;
        push(d + 1, id2, ch - 1, cell, k, { t: 'lure', T, d: d2 });
      }
    }
  }
  if (goal === null) return { solvable: false, explored: dist.size };
  const steps = []; let kk = goal;
  while (par.has(kk)) { const [p, s] = par.get(kk); steps.push(s); kk = p; }
  steps.reverse();
  const crawled = steps.filter(s => s.t === 'move' && s.crawl).length * st.crawl, nl = steps.filter(s => s.t === 'lure').length;
  return { solvable: true, par: goalCost, actions: steps.filter(s => s.t !== 'move').length, crawled, lures: nl, steps, explored: dist.size };
}

const api = { DEFAULTS, params, evalStealth, lureApply, lures, throwCells, walkPath, solveStealth };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.Stealth = api;
})();
