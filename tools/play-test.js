/* Plays every shipped level in a real browser through the page's own UI functions and checks
   that the exact-par solution wins with moves === par.  usage: node tools/play-test.js [url] [shotdir] */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const url = process.argv[2] || 'http://localhost:8123/play/index.html', shots = process.argv[3];
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const errs = []; pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(url); await pg.waitForTimeout(300);
  await pg.evaluate(() => setHeartsMode(false));
  const n = await pg.evaluate(() => LEVELS.length);
  let ok = true;
  for (let i = 0; i < n; i++) {
    const res = await pg.evaluate(async (i) => {
      load(i);
      const r = P.solve(L, { maxDepth: 40 });
      for (let s = 0; s < r.par; s++) {
        const next = r.configs[s], e2 = P.evalConfig(L, next), remaining = r.par - s - 1;
        // pick a cell the thief can reach now, that stays dark after the action, from which the rest is still par-optimal
        let target = -1;
        for (let c = 0; c < L.w * L.h && target < 0; c++) {
          if (L.wall[c] || e2.lit[c] || e2.occ[c] || (c !== thief && !pathTo(c))) continue;
          const r2 = P.solve(L, { digits: next, thief: c, maxDepth: 40 });
          if (r2 && r2.solvable && r2.par === remaining) target = c;
        }
        if (target < 0) return { err: 'no safe cell at step ' + s };
        if (target !== thief) { walkTo(target); while (walking) await new Promise(r => setTimeout(r, 20)); }
        tryAction(next);
        if (moves !== s + 1) return { err: 'action refused at step ' + s };
      }
      walkTo(L.E); while (walking) await new Promise(r => setTimeout(r, 20));
      return { moves, par: LEVELS[li].par, won: document.getElementById('winOv').classList.contains('on'), thief, E: L.E };
    }, i);
    const pass = !res.err && res.won && res.moves === res.par;
    ok = ok && pass;
    console.log(`level ${i + 1}: ${pass ? 'OK' : 'FAIL'} ${JSON.stringify(res)}`);
    if (shots && (i === 0 || i === 3 || i === 6 || i === n - 1)) { await pg.evaluate(i => { document.getElementById('winOv').classList.remove('on'); load(i); }, i); await pg.waitForTimeout(150); await pg.screenshot({ path: `${shots}/level-${i + 1}.png` }); }
  }
  // negative test: an action that would light the thief must be refused (search the levels for one)
  const refused = await pg.evaluate(() => {
    for (let i = 0; i < LEVELS.length; i++) {
      load(i);
      for (let k = 0; k < nc() + L.guards.length; k++) for (const o of options(k)) {
        if (!o.dg) continue;
        const e = ev(o.dg);
        if (e.lit[thief] || e.occ[thief]) { const before = moves; tryAction(o.dg); return { level: i + 1, watcher: k, refused: moves === before }; }
      }
    }
    return null;
  });
  // hearts mode: crossing one beam costs exactly one heart and still reaches the exit
  const hm = await pg.evaluate(async () => {
    setHeartsMode(true); load(0);
    walkTo(L.E); while (walking) await new Promise(r => setTimeout(r, 20));
    const out = { hearts, lost, won: document.getElementById('winOv').classList.contains('on') };
    setHeartsMode(false); return out;
  });
  console.log('hearts check:', JSON.stringify(hm), hm.hearts === 2 && hm.lost === 1 && hm.won ? 'OK' : 'FAIL');
  if (!(hm.hearts === 2 && hm.lost === 1 && hm.won)) ok = false;
  // star gate: chapter 2 needs stars, unlocking all bypasses it
  const gate = await pg.evaluate(() => { localStorage.clear(); unlockAll = false; best = {}; const a = chapterLocked(1); best = { 1: { stars: 3 }, 2: { stars: 2 } }; const b = chapterLocked(1); return [a, b]; });
  console.log('gate check (locked with 0 stars, open with 5):', JSON.stringify(gate), gate[0] === true && gate[1] === false ? 'OK' : 'FAIL');
  if (!(gate[0] === true && gate[1] === false)) ok = false;
  console.log('refusal check:', refused);
  console.log('page errors:', errs.length ? errs : 'none');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
