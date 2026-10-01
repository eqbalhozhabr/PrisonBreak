/* Rebuilds shipped levels whose walk count ("phases", see phasesDP in src/prison.js) is below the target of their block.
   A new candidate replaces the old one only if it needs MORE walks and at least as many actions (par never goes down).
   usage: node tools/regen-low.js <ids "15,23,33" | "low"> <out.jsonl>
   env: BUDGET_MS (fixed time per level; default 90 s + 15 s per par), SEED_OFFSET, STEP (how many consecutive tries per target before lowering it) */
'use strict';
const fs = require('fs'), path = require('path'), P = require('../src/prison.js'), { specFor } = require('./level-specs.js');
global.window = {};
new Function('window', fs.readFileSync(path.join(__dirname, '..', 'play', 'levels.js'), 'utf8'))(global.window);
const LV = global.window.PRISON_LEVELS, byId = new Map(LV.map(l => [l.id, l]));
const ids = process.argv[2] === 'low' ? LV.filter(l => l.walks < specFor(l.id).phases).map(l => l.id) : process.argv[2].split(',').map(Number);
const out = process.argv[3];
for (const n of ids) {
  const cur = byId.get(n), base = specFor(n), t0 = Date.now();
  const budget = Number(process.env.BUDGET_MS || 0) || 60000 + 12000 * base.par;
  let best = null, tries = 0;
  const better = (a, b) => !b || a.phases > b.phases || (a.phases === b.phases && a.par > b.par);
  while (Date.now() - t0 < budget && !(best && best.phases >= base.phases && best.par >= base.par)) {
    // aim at the block's wanted walks first; after a few misses settle for one less, but never at or below what the level already has
    const w = Math.max(cur.walks + 1, base.phases - Math.floor(tries / (Number(process.env.STEP) || 6)));
    const spec = Object.assign({}, base, { phasesLo: w, phasesHi: w + 1, timeMs: Math.min(base.timeMs, Math.max(15000, budget / 5)) });
    tries++;
    const res = P.genLevel(spec, n * 7919 + tries * 104729 + (Number(process.env.SEED_OFFSET) || 0), Math.max(base.par, cur.par), 2500);
    if (!res || res.par < cur.par || res.phases <= cur.walks) continue;
    const m = P.toMap(res.level), back = P.parseLevel(m.map, m.meta); P.prepare(back);
    const chk = P.solve(back, { maxDepth: 40 });
    if (!chk || !chk.solvable || chk.par !== res.par) continue;
    const an = P.analyze(back, 400000);
    if (!an || an.par !== res.par || an.phases <= cur.walks) continue;
    const cand = { n, block: base.name, map: m.map, meta: m.meta, par: res.par, phases: an.phases, wantedPar: base.par, wantedPhases: base.phases, used: res.used, total: res.total };
    if (better(cand, best)) best = cand;
  }
  if (best) fs.appendFileSync(out, JSON.stringify(best) + '\n');
  console.error(`level ${n} ${base.name}: walks ${cur.walks} -> ${best ? best.phases : cur.walks} (want ${base.phases}), par ${cur.par} -> ${best ? best.par : cur.par} (want ${base.par}), ${tries} tries, ${Math.round((Date.now() - t0) / 1000)}s${best ? '' : '  UNCHANGED'}`);
}
