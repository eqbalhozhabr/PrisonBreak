/* Generates levels for the ramp in level-specs.js.  usage: node tools/gen-levels.js <from> <to> <out.jsonl>
   Every level is proved by the exact solver before it is written (par must match). */
'use strict';
const fs = require('fs'), P = require('../src/prison.js'), { specFor } = require('./level-specs.js');
const [from, to, out] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
for (let n = from; n <= to; n++) {
  const spec = specFor(n), t0 = Date.now(); spec.timeMs = Math.min(spec.timeMs, Number(process.env.GEN_TIME_MS || spec.timeMs));
  let res = null, target = spec.par, tries = 0;
  while (!res && target >= 1) {
    for (let a = 0; a < 2 && !res; a++) { tries++; res = P.genLevel(spec, n * 1000 + tries, target, 2500); }
    if (!res) target--;
  }
  if (!res) { console.error(`level ${n}: FAILED`); continue; }
  const m = P.toMap(res.level);
  const back = P.parseLevel(m.map, m.meta); P.prepare(back);
  const chk = P.solve(back, { maxDepth: 40 });
  if (!chk || !chk.solvable || chk.par !== res.par) { console.error(`level ${n}: round-trip mismatch, retrying`); n--; continue; }
  fs.appendFileSync(out, JSON.stringify({ n, block: spec.name, map: m.map, meta: m.meta, par: res.par, wanted: spec.par, used: res.used, total: res.total }) + '\n');
  console.error(`level ${n} ${spec.name}: par ${res.par}/${spec.par} used ${res.used}/${res.total} ${Date.now() - t0}ms`);
}
