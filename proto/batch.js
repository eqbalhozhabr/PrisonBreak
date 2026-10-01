// node proto/batch.js W H cams guards iters seed  -> prints one JSON line
const P = require('../src/prison.js');
const [W, H, nc, ng, iters, seed] = process.argv.slice(2).map(Number);
const g = P.generate(seed, W, H, nc, ng, iters);
if (!g) process.exit(0);
const r = g.result;
console.log(JSON.stringify(Object.assign({ name: `gen ${W}x${H} s${seed}`, par: r.par, used: new Set(r.who).size, states: r.explored }, P.toMap(g.level))));
