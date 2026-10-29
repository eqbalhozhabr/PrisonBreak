/* Looks for small levels in which the Stealth rules (src/stealth.js) change the best plan: levels where crawling saves moves, where a lure saves moves, or both.
   node tools/gen-stealth-tests.js [seconds] [out.json]  -> writes the levels found (map, meta, stealth params, the three pars) */
'use strict';
const fs = require('fs'), path = require('path');
const P = require('../src/prison.js'), S = require('../src/stealth.js');
const secs = +process.argv[2] || 120, out = process.argv[3] || path.join(__dirname, '..', 'play', 'stealth-tests.json');
const BASE = { camNear: 2, guardNear: 1, crawl: 1, throwR: 3, hearR: 4, lureStep: 1 };
const CLASSIC = { camNear: 99, guardNear: 99, crawl: 1, lures: 0 };
const want = { crawl: 6, lure: 8, both: 6 }, found = { crawl: [], lure: [], both: [] }, seen = new Set();
if (fs.existsSync(out)) { const old = JSON.parse(fs.readFileSync(out, 'utf8')).found; for (const k in found) { found[k] = old[k] || []; found[k].forEach(r => seen.add(r.map.join('/'))); } }      // keeps what an earlier run found
const GMIN = +(process.env.GMIN || 1), GMAX = +(process.env.GMAX || 3);
const rnd = P.mulberry32(20261029), t0 = Date.now(), pick = a => a[(rnd() * a.length) | 0];
const solve = (L, st, cap) => { L.stealth = st; return S.solveStealth(L, { maxStates: cap || 150000, maxCost: 22 }); };
let tried = 0;
while (Date.now() - t0 < secs * 1000 && (found.crawl.length < want.crawl || found.lure.length < want.lure || found.both.length < want.both)) {
  const sz = pick([6, 6, 7, 7]), spec = { w: sz, h: sz, blocks: 2 + ((rnd() * 4) | 0), cams: 1 + ((rnd() * 2) | 0), guards: GMIN + ((rnd() * (GMAX - GMIN + 1)) | 0), doors: 0, mirrors: 0, range: 3, cap: 20000 };
  const L = P._layout(rnd, spec); if (!L) continue;
  for (const c of L.cams) c.d = (rnd() * 4) | 0;
  for (const g of L.guards) { g.i = (rnd() * g.rail.length) | 0; g.f = (rnd() * 2) | 0; }
  const busy = new Set([...L.guards, ...(L.dogs || [])].flatMap(g => g.rail).concat(L.toggles.map(t => t.c))), floor = [];
  for (let c = 0; c < L.w * L.h; c++) if (!L.wall[c] && !L.glass[c] && !busy.has(c)) floor.push(c);
  if (!floor.length) continue;
  L.S = pick(floor); if (L.S === L.E || busy.has(L.E)) continue;
  tried++;
  const m = P.toMap(L), key = m.map.join('/'); if (seen.has(key)) continue; seen.add(key);
  { const Q = P.parseLevel(m.map, m.meta); if (Q.S < 0 || Q.E < 0) continue; }                       // the picture must keep both S and E
  const A = solve(L, CLASSIC); if (!A || !A.solvable || A.par < 4 || A.par > 11) continue;
  const B = solve(L, Object.assign({}, BASE, { lures: 0 })); if (!B || !B.solvable) continue;
  const C = L.guards.length ? solve(L, Object.assign({}, BASE, { lures: 2 })) : B; if (!C || !C.solvable) continue;
  const rec = (kind) => ({ kind, map: m.map, meta: m.meta, classicPar: A.par, crawlPar: B.par, par: C.par, lures: C.lures, crawled: C.crawled, stealth: Object.assign({}, BASE, { lures: C.lures }) });
  let kind = null;
  if (C.lures >= 1 && C.crawled >= 1 && C.par <= A.par - 3) kind = 'both';
  else if (C.lures >= 1 && C.par <= B.par - 2 && B.crawled === 0) kind = 'lure';
  else if (B.crawled >= 1 && B.par <= A.par - 2 && C.lures === 0) kind = 'crawl';
  if (kind && found[kind].length < want[kind]) { found[kind].push(rec(kind)); console.log(kind, 'classic', A.par, 'crawl', B.par, 'full', C.par, 'lures', C.lures, 'crawled', C.crawled, `(${tried} tried)`); }
}
fs.writeFileSync(out, JSON.stringify({ params: BASE, tried, found }, null, 1));
console.log('wrote', out, { crawl: found.crawl.length, lure: found.lure.length, both: found.both.length, tried });
