const P = require('../src/prison.js');
const [W, H, nc, ng, iters, ...seeds] = process.argv.slice(2).map(Number);
for (const seed of seeds) {
  const t = Date.now();
  const g = P.generate(seed, W, H, nc, ng, iters);
  if (!g) { console.log('seed', seed, 'no level'); continue; }
  const r = g.result;
  console.log(`--- seed ${seed}  ${W}x${H}  cams=${nc} guards=${ng}  par=${r.par}  watchers used=${new Set(r.who).size}  states=${r.explored}  ${Date.now() - t}ms`);
  P.prepare(g.level);
  console.log('start:\n' + P.draw(g.level, P.initialDigits(g.level)));
  if (process.env.SHOW) r.configs.forEach((c, i) => console.log(`after action ${i + 1} (watcher ${r.who[i]}):\n` + P.draw(g.level, c)));
}
