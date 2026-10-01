/* Plays levels in a real browser with real mouse clicks (taps on the canvas and on the bar buttons) and checks that the
   exact solution wins with moves === par.   usage: node tools/play-test.js <url> [levels: "all" | "1,2,31" | "every:6"] [shotdir]
   env: PLAYWRIGHT_MODULE (path to playwright), CHROMIUM (browser executable) */
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const url = process.argv[2] || 'http://localhost:8123/play/index.html', which = process.argv[3] || 'every:6', shots = process.argv[4];
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: false });
  const errs = []; pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(url); await pg.waitForTimeout(300);
  await pg.evaluate(() => { settings.unlockAll = true; settings.hearts = false; settings.sfx = false; settings.vibrate = false; });
  const n = await pg.evaluate(() => LEVELS.length);
  let idx = [];
  if (which === 'all') idx = [...Array(n).keys()];
  else if (which.startsWith('every:')) { const k = Number(which.slice(6)); for (let i = 0; i < n; i += k) idx.push(i); idx.push(n - 1); }
  else idx = which.split(',').map(x => Number(x) - 1);
  let ok = true;
  const click = async ([x, y]) => { await pg.mouse.click(x, y); };
  const waitWalk = async () => { for (let t = 0; t < 400 && await pg.evaluate(() => !!walking); t++) await pg.waitForTimeout(25); };
  for (const i of [...new Set(idx)]) {
    await pg.evaluate(i => { load(i); }, i); await pg.waitForTimeout(60);
    const sol = await pg.evaluate(() => { const r = P.solve(L, { maxDepth: 60 }); return r && r.solvable ? { par: r.par, who: r.who, configs: r.configs } : null; });
    if (!sol) { console.log(`level ${i + 1}: FAIL no solution`); ok = false; continue; }
    let err = null;
    for (let s = 0; s < sol.par && !err; s++) {
      // 1. walk to a dark tile from which the rest is still optimal, by tapping it
      const target = await pg.evaluate(({ next, remaining }) => {
        const e2 = P.evalConfig(L, next, false);
        for (let c = 0; c < L.w * L.h; c++) {
          if (L.wall[c] || e2.lit[c] || e2.occ[c] || (c !== thief && !pathTo(c))) continue;
          const r2 = P.solve(L, { digits: next, thief: c, maxDepth: 60 });
          if (r2 && r2.solvable && r2.par === remaining) return c;
        }
        return -1;
      }, { next: sol.configs[s], remaining: sol.par - s - 1 });
      if (target < 0) { err = 'no safe tile at step ' + s; break; }
      if (target !== await pg.evaluate(() => thief)) {
        await click(await pg.evaluate(c => cellPoint(c), target)); await waitWalk();
        if (await pg.evaluate(() => thief) !== target) { err = `tap on tile ${target} did not walk there (step ${s})`; break; }
      }
      // 2. the action, by tapping the object (and the bar button for guards)
      const who = sol.who[s], info = await pg.evaluate(w => ({ kind: kindOf(w), tap: tapPoint(w) }), who);
      await click(info.tap);
      if (info.kind === 'guard') {
        const btn = await pg.evaluate(({ w, next }) => options(w).findIndex(o => o.dg && o.dg.join() === next.join()), { w: who, next: sol.configs[s] });
        if (btn < 0) { err = 'no guard button for step ' + s; break; }
        await pg.evaluate(k => document.querySelectorAll('#bar button')[k].click(), btn);
      }
      const m = await pg.evaluate(() => moves);
      if (m !== s + 1) { err = `action ${s + 1} (${info.kind}) not applied; moves=${m}`; break; }
      const same = await pg.evaluate(next => dg.join() === next.join(), sol.configs[s]);
      if (!same) { err = `action ${s + 1} (${info.kind}) changed the wrong thing`; break; }
    }
    if (!err) {
      await click(await pg.evaluate(() => cellPoint(L.E))); await waitWalk();
      let won = await pg.evaluate(() => document.getElementById('winOv').classList.contains('on'));
      if (!won) { await pg.evaluate(() => document.querySelectorAll('#bar button')[document.querySelectorAll('#bar button').length - 2].click()); await waitWalk(); won = await pg.evaluate(() => document.getElementById('winOv').classList.contains('on')); if (won) err = 'tapping the exit tile did not work (the Go to exit button did)'; }
      if (!won) err = err || 'did not win';
      const mv = await pg.evaluate(() => moves);
      if (!err && mv !== sol.par) err = `moves ${mv} != par ${sol.par}`;
    }
    ok = ok && !err;
    console.log(`level ${i + 1}: ${err ? 'FAIL ' + err : 'OK par ' + sol.par}`);
    if (shots && !err && (i === 0 || i === 30 || i === 60 || i === 80)) { await pg.evaluate(() => { document.getElementById('winOv').classList.remove('on'); }); await pg.screenshot({ path: `${shots}/won-${i + 1}.png` }); }
  }
  // hearts mode: crossing a beam costs a heart and the run still ends at the exit
  const hm = await pg.evaluate(async () => {
    settings.hearts = true;
    for (let i = 0; i < LEVELS.length; i++) {
      load(i); if (P.solve(L, { maxDepth: 60 }).par < 1) continue;
      const p = pathTo(L.E); if (!p) continue;
      walkTo(L.E); while (walking) await new Promise(r => setTimeout(r, 20));
      const out = { level: i + 1, hearts, lost, won: document.getElementById('winOv').classList.contains('on'), caught: caughtOn };
      settings.hearts = false; return out;
    }
    settings.hearts = false; return null;
  });
  const hmOk = hm && (hm.won || hm.caught) && hm.hearts === 3 - hm.lost;
  console.log('hearts check:', JSON.stringify(hm), hmOk ? 'OK' : 'FAIL'); ok = ok && !!hmOk;
  const gate = await pg.evaluate(() => { settings.unlockAll = false; best = {}; const a = chapterLocked(1); best = { 1: { stars: 3 }, 2: { stars: 3 }, 3: { stars: 3 }, 4: { stars: 3 } }; const c = chapterLocked(1); best = {}; return [a, c]; });
  console.log('star gate check (locked with 0 stars, open with 12):', JSON.stringify(gate), gate[0] === true && gate[1] === false ? 'OK' : 'FAIL'); ok = ok && gate[0] === true && gate[1] === false;
  const refused = await pg.evaluate(() => {
    settings.hearts = false;
    for (let i = 0; i < LEVELS.length; i++) {
      load(i);
      for (let k = 0; k < nAll(); k++) for (const o of options(k)) {
        if (!o.dg) continue;
        const e = ev(o.dg);
        if (e.lit[thief] || e.occ[thief]) { const before = moves; tryAction(o.dg, o.kind); return { level: i + 1, watcher: k, refused: moves === before }; }
      }
    }
    return null;
  });
  console.log('refusal check:', JSON.stringify(refused), refused && refused.refused ? 'OK' : 'FAIL'); ok = ok && !!(refused && refused.refused);
  console.log('page errors:', errs.length ? errs : 'none');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
