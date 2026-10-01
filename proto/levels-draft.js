const P = require('../src/prison.js');
const defs = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
for (const d of defs) {
  const L = P.parseLevel(d.map, d.meta);
  P.prepare(L);
  const r = P.solve(L, { maxDepth: 40 });
  console.log(`== ${d.name}: ` + (r && r.solvable ? `par=${r.par} states=${r.explored} watchers=${[...new Set(r.who)].join(',')}` : 'UNSOLVABLE/INVALID ' + JSON.stringify(r)));
  console.log(P.draw(L, P.initialDigits(L)));
  if (process.env.SHOW && r && r.solvable) r.configs.forEach((c, i) => console.log(`-- after action ${i + 1} (watcher ${r.who[i]})\n` + P.draw(L, c)));
}
