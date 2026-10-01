/* Generates levels for the ramp in level-specs.js.  usage: node tools/gen-levels.js <from> <to> <out.jsonl>   or   node tools/gen-levels.js 1,5,9 - <out.jsonl>
   Every level is proved by the exact solver before it is written (par must match, and so must the round trip through the ASCII form).
   Each level has a wanted par and a wanted number of walks (see phasesDP in src/prison.js). If the layout search cannot reach both, it
   first accepts fewer walks, then a smaller par; the result says what was actually achieved. */
'use strict';
const fs = require('fs'), P = require('../src/prison.js'), { specFor } = require('./level-specs.js');
const out = process.argv[4], ids = process.argv[2].includes(',') ? process.argv[2].split(',').map(Number) : Array.from({ length: Number(process.argv[3]) - Number(process.argv[2]) + 1 }, (_, i) => Number(process.argv[2]) + i);
const cap = Number(process.env.GEN_TIME_MS || 0);
for (let ix = 0; ix < ids.length; ix++) {
  let n = ids[ix];
  const base = specFor(n), t0 = Date.now();
  let res = null, tries = 0;
  const maxDp = Number(process.env.MAX_DP || 2), maxDw = Number(process.env.MAX_DW || 3);
  for (let dp = 0; dp <= maxDp && !res; dp++) for (let dw = 0; dw <= maxDw && !res; dw++) {
    const par = base.par - dp, w = Math.max(1, base.phases - dw);
    if (par < 1 || (dw > 0 && w === base.phases - dw + 0 && w < 1)) continue;
    const spec = Object.assign({}, base, { phasesLo: w, phasesHi: w === 1 ? 1 : w + 1 });
    spec.timeMs = Math.min(base.timeMs, cap || base.timeMs) * (dp + dw === 0 ? 1 : .4);
    for (let a = 0; a < 2 && !res; a++) { tries++; res = P.genLevel(spec, n * 1000 + tries + (Number(process.env.SEED_OFFSET) || 0), par, 2500); }
  }
  if (!res) { console.error(`level ${n}: FAILED`); continue; }
  const m = P.toMap(res.level);
  const back = P.parseLevel(m.map, m.meta); P.prepare(back);
  const chk = P.solve(back, { maxDepth: 40 });
  if (!chk || !chk.solvable || chk.par !== res.par) { console.error(`level ${n}: round-trip mismatch, retrying`); ix--; continue; }
  fs.appendFileSync(out, JSON.stringify({ n, block: base.name, map: m.map, meta: m.meta, par: res.par, phases: res.phases, wantedPar: base.par, wantedPhases: base.phases, used: res.used, total: res.total }) + '\n');
  console.error(`level ${n} ${base.name}: par ${res.par}/${base.par} walks ${res.phases}/${base.phases} used ${res.used}/${res.total} ${Date.now() - t0}ms`);
}
