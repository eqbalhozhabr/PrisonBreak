/* Looks for patrol layouts that make a fixed map interesting: the fastest safe plan is clearly longer than the free walk (and, for the stone levels,
   needs the stone).  node tools/gen-patrol-levels.js <mapId> [seconds]   (prints the best candidates as level specs) */
'use strict';
const Pt = require('../src/patrol.js');
const base = require('./patrol-levels.js');
const id = +process.argv[2] || 1, secs = +process.argv[3] || 40, B = base.find(s => s.id === id);
let seed = id * 7919 + 13; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[(rnd() * a.length) | 0];
const L0 = Pt.parse(Object.assign({}, B, { guards: [], cams: [] }));
const floor = []; for (let c = 0; c < L0.w * L0.h; c++) if (!L0.wall[c] && c !== L0.S && c !== L0.E) floor.push(c);
const cell = c => [c % L0.w, (c / L0.w) | 0];
const wallsAround = [];
for (let c = 0; c < L0.w * L0.h; c++) if (L0.wall[c]) { const [x, y] = cell(c); if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < L0.w && y + dy < L0.h && !L0.wall[(y + dy) * L0.w + x + dx])) wallsAround.push(c); }
const best = []; const t0 = Date.now(); let n = 0;
const wantStone = !!B.throws;
const lineFree = (x0, y0, x1, y1) => { const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0); for (let x = x0, y = y0; ; x += dx, y += dy) { if (L0.wall[y * L0.w + x]) return false; if (x === x1 && y === y1) return true; } };
function legTo(x, y) {                                                    // another waypoint on the same row or column, 2..8 cells away, a straight free line
  for (let tries = 0; tries < 20; tries++) { const horiz = rnd() < .5, d = (2 + ((rnd() * 7) | 0)) * (rnd() < .5 ? -1 : 1), nx = horiz ? x + d : x, ny = horiz ? y : y + d; if (nx > 0 && ny > 0 && nx < L0.w - 1 && ny < L0.h - 1 && !L0.wall[ny * L0.w + nx] && lineFree(x, y, nx, ny)) return [nx, ny]; }
  return null;
}
const holdSpec = () => [(rnd() * 4) | 0, rnd() < .5 ? [(rnd() * 8) | 0, (rnd() * 8) | 0] : null];
while (Date.now() - t0 < secs * 1000) {
  const guards = [], ng = B.id >= 3 ? 1 + ((rnd() * 2) | 0) : 1, cams = [];
  if (!B.keepGuards) for (let g = 0; g < ng; g++) {
    const [x, y] = cell(pick(floor)), way = [[x, y, ...holdSpec()]], p1 = legTo(x, y); if (!p1) continue; way.push([p1[0], p1[1], ...holdSpec()]);
    if (rnd() < .5) { const p2 = legTo(p1[0], p1[1]); if (p2) { way.push([p2[0], p2[1], ...holdSpec()]); const p3 = [x, p2[1]]; if (p3[1] !== y && !L0.wall[p3[1] * L0.w + p3[0]] && lineFree(p2[0], p2[1], p3[0], p3[1]) && lineFree(p3[0], p3[1], x, y)) way.push([p3[0], p3[1], ...holdSpec()]); } }
    guards.push({ way, f: (rnd() * 8) | 0, start: (rnd() * 6) | 0 });
  }
  if (B.keepGuards) guards.push(...B.guards);
  if ((B.forceCam || rnd() < .5) && !B.noCams) { const [x, y] = cell(pick(wallsAround)); const f = (rnd() * 8) | 0; cams.push({ x, y, pan: [f, (f + 1) % 8, (f + 2) % 8, (f + 1) % 8], dwell: 3 + ((rnd() * 3) | 0) }); }
  const spec = Object.assign({}, B, { guards, cams }); let L; try { L = Pt.parse(spec); } catch (e) { continue; }
  n++;
  const st = Pt.initial(L), s0 = Pt.tick(L, st, -1, false); if (s0.caught) continue;
  const sp = Object.assign({}, spec, { throws: 0 }), L1 = Pt.parse(sp), r1 = Pt.solve(L1, { maxTicks: 40, maxStates: 100000 });
  let r = r1, score;
  if (wantStone) { const r2 = Pt.solve(L, { maxTicks: 40, maxStates: 120000 }); if (!r2 || !r2.solvable) continue; const used = r2.plan.some(a => a.t === 'throw'); if (!used) continue; r = r2; score = (r1.solvable ? r1.par - r2.par : 15) + (r2.par - Pt.freeWalk(L)) * .3; if (r1.solvable && r1.par - r2.par < 3) continue; }
  else { if (!r1 || !r1.solvable) continue; score = r1.par - Pt.freeWalk(L); }
  if (!r.solvable) continue;
  best.push({ score, par: r.par, free: Pt.freeWalk(L), spec: { guards, cams }, plan: r.plan.length }); best.sort((a, b) => b.score - a.score); if (best.length > 3) best.pop();
}
console.log('tried', n);
for (const b of best) console.log(JSON.stringify({ score: +b.score.toFixed(1), par: b.par, free: b.free, guards: b.spec.guards, cams: b.spec.cams }));
