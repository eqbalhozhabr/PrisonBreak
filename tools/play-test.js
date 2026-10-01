/* Plays levels in a real browser with real mouse clicks (taps on the canvas and on the bar buttons) and checks that the
   exact solution wins with moves === par.   usage: node tools/play-test.js <url> [levels: "all" | "1,2,31" | "every:6"] [shotdir]
   env: PLAYWRIGHT_MODULE (path to playwright), CHROMIUM (browser executable) */
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const url = process.argv[2] || 'http://localhost:8123/play/index.html', which = process.argv[3] || 'every:6', shots = process.argv[4];
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: false });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).split('\n').slice(0, 4).join(' | '))); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(url); await pg.waitForTimeout(300);
  await pg.evaluate(() => { settings.unlockAll = true; settings.hearts = false; settings.sfx = false; settings.music = false; settings.vibrate = false; introSeen = { cam: 1, guard: 1, door: 1, mirror: 1, all: 1, dog: 1, light: 1 }; });
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
        // a selected guard would take a tap on its own rail; let go of it by tapping the prisoner, as a player would
        if (await pg.evaluate(t => sel >= nCam() && (sel < nCam() + nGuard() || (sel >= dogBase() && sel < lightBase())) && walkerRail(sel).rail.includes(t), target)) await click(await pg.evaluate(() => thiefPoint()));
        await click(await pg.evaluate(c => cellPoint(c), target)); await waitWalk();
        if (await pg.evaluate(() => thief) !== target) { err = `tap on tile ${target} did not walk there (step ${s})`; break; }
      }
      // 2. the action, by tapping the object (and the bar button for guards)
      const who = sol.who[s], info = await pg.evaluate(w => ({ kind: kindOf(w), tap: tapPoint(w) }), who);
      if (info.kind === 'guard' || info.kind === 'dog') { if (!(await pg.evaluate(w => sel === w, who))) await click(info.tap); }     // tapping an already selected guard would turn it round
      else await click(info.tap);
      if (info.kind === 'guard' || info.kind === 'dog') {
        const btn = await pg.evaluate(({ w, next }) => options(w).findIndex(o => o.dg && o.dg.join() === next.join()), { w: who, next: sol.configs[s] });
        if (btn < 0) { err = 'no guard button for step ' + s; break; }
        await pg.evaluate(k => document.querySelectorAll('#ctx button')[k].click(), btn);
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
  // the board must never move: selecting a guard or a camera must not change the canvas box or the board offset
  const stable = await pg.evaluate(async () => {
    const gi = LEVELS.findIndex(l => l.map.some(r => /[a-d]/.test(r)));
    load(gi); await new Promise(r => setTimeout(r, 120));
    const snap = () => { const r = cv.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height), Math.round(ox), Math.round(oy), Math.round(cs)].join(); };
    const before = snap(), pt = tapPoint(nCam());
    onTap(pt[0] - cv.getBoundingClientRect().left - ox, pt[1] - cv.getBoundingClientRect().top - oy);
    await new Promise(r => setTimeout(r, 250));
    const afterSelect = snap(), r = cv.getBoundingClientRect();
    return { before, afterSelect, bitmapMatches: Math.round(r.height) === Math.round(H) && Math.round(r.width) === Math.round(W) };
  });
  const stableOk = stable.before === stable.afterSelect && stable.bitmapMatches;
  console.log('board stays put when a guard is selected:', JSON.stringify(stable), stableOk ? 'OK' : 'FAIL'); ok = ok && stableOk;
  // nothing may change place as the game goes on: HUD, tip, board, button rows and every button keep their boxes through selections,
  // actions, the hint label changing, bigger numbers and hearts mode
  const shift = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const box = e => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)].join(','); };
    const snap = () => { const o = { hud: box(document.querySelector('.hud')), tip: box(document.getElementById('tip')), stage: box(document.getElementById('stage')), ctx: box(document.getElementById('ctx')), bar: box(document.getElementById('bar')) };
      document.querySelectorAll('.hud > *').forEach((e, i) => { o['hud' + i] = box(e); }); document.querySelectorAll('#bar button').forEach((e, i) => { o['bar' + i] = box(e); }); return o; };
    const gi = LEVELS.findIndex(l => l.map.some(r => /[a-d]/.test(r)));
    load(gi); await wait(150); const base = snap(), bad = [];
    const check = name => { const now = snap(); for (const k of Object.keys(base)) if (now[k] !== base[k]) bad.push(name + ' ' + k + ': ' + base[k] + ' -> ' + now[k]); };
    const p = tapPoint(nCam()); onTap(p[0] - cv.getBoundingClientRect().left - ox, p[1] - cv.getBoundingClientRect().top - oy); await wait(150); check('guard selected');
    const turn = options(sel)[2]; tryAction(turn.dg, turn.kind); await wait(150); check('after an action');
    hintsUsed = 1; buildBar(); await wait(150); check('hint label with the AD tag');
    moves = 10; syncUI(); await wait(100); check('moves = 10');
    settings.hearts = true; syncUI(); await wait(100); check('hearts mode'); settings.hearts = false; syncUI();
    settings.lang = 'fa'; applyLang(); syncUI(); buildBar(); await wait(150);
    const fa = snap(); for (const k of ['stage', 'tip', 'ctx', 'bar']) if (fa[k].split(',')[1] !== base[k].split(',')[1] || fa[k].split(',')[3] !== base[k].split(',')[3]) bad.push('persian ' + k + ' moved vertically');
    settings.lang = 'en'; applyLang(); syncUI(); buildBar();
    // the middle slot of the context row holds the same kind of button for every object
    const slots = [];
    const dgi = LEVELS.findIndex(l => l.meta.dogs);
    for (const [name, idx] of [['guard', gi], ['camera', 0], ['dog', dgi]]) { load(idx); sel = name === 'guard' ? nCam() : name === 'dog' ? dogBase() : 0; buildBar(); await wait(80); const btns = [...document.querySelectorAll('#ctx button')], tops = new Set(btns.map(b => Math.round(b.getBoundingClientRect().top))); if (tops.size > 1) base.ctxRowSplit = 'x'; const cb = btns.map(b => b.style.gridColumn + ':' + Math.round(b.getBoundingClientRect().left)); slots.push(name + ' ' + cb.join(' ')); }
    if (base.ctxRowSplit) bad.push('the context buttons are not all in one row');
    return { bad, slots };
  });
  console.log('layout never shifts:', shift.bad.length ? JSON.stringify(shift.bad) : 'no change in any state', '| slots:', shift.slots.join(' ; '), shift.bad.length ? 'FAIL' : 'OK'); ok = ok && shift.bad.length === 0;
  // guard controls on the guard itself: tap selects, tap again turns it, tap a rail tile walks it (one action per step) facing the way it walks
  const gc = await pg.evaluate(() => {
    const gi = LEVELS.findIndex(l => l.map.some(r => /[a-d]/.test(r)));
    load(gi); const k = nCam(), g = L.guards[0], out = {};
    const tapW = () => { const p = tapPoint(k); onTap(p[0] - cv.getBoundingClientRect().left - ox, p[1] - cv.getBoundingClientRect().top - oy); };
    const ev0 = () => ({ f: dg[k] & 1, i: dg[k] >> 1, moves });
    const a = ev0(); tapW(); out.afterFirstTap = { sel: sel === k, ...ev0() };
    if (!ev(options(k)[2].dg).lit[thief]) { tapW(); out.afterSecondTap = ev0(); }
    return { gi: gi + 1, railLen: g.rail.length, ...out };
  });
  const turnOk = gc.afterFirstTap.sel && gc.afterFirstTap.moves === 0 && (!gc.afterSecondTap || (gc.afterSecondTap.f !== gc.afterFirstTap.f && gc.afterSecondTap.moves === 1));
  console.log('guard: first tap selects, second tap turns it:', JSON.stringify(gc), turnOk ? 'OK' : 'FAIL'); ok = ok && turnOk;
  const walkRes = await pg.evaluate(async () => {
    const gi = LEVELS.findIndex(l => l.map.some(r => /[a-d]/.test(r)));
    load(gi); const k = nCam(), g = L.guards[0], e0 = ev(); let result = null;
    // choose a rail cell the guard can reach without exposing the prisoner
    sel = k;
    for (let ti = 0; ti < g.rail.length && !result; ti++) {
      load(gi); sel = k; const cur = dg[k] >> 1; if (ti === cur) continue;
      await guardGoTo(k, g.rail[ti]);
      const now = dg[k] >> 1, expectFacing = ti > cur ? 0 : 1;
      if (now === ti) result = { from: cur, to: ti, steps: Math.abs(ti - cur), moves, facing: dg[k] & 1, expectFacing };
    }
    return result;
  });
  const walkOk = !walkRes || (walkRes.moves === walkRes.steps && walkRes.facing === walkRes.expectFacing);
  console.log('guard: tapping a rail tile walks it, one action per step, facing the way it walks:', JSON.stringify(walkRes), walkOk ? 'OK' : 'FAIL'); ok = ok && walkOk;
  // item introductions: shown once at the level that brings the item, not again after "Got it"
  const intro = await pg.evaluate(() => {
    introSeen = {}; const out = [];
    for (const idx of [0, 15, 45, 65, 85, 105, 125]) { load(idx); out.push([LEVELS[idx].id, introKind, document.getElementById('introOv').classList.contains('on')]); closeIntro(); }
    load(15); out.push(['again', introKind]);
    introSeen = { cam: 1, guard: 1, door: 1, mirror: 1, all: 1, dog: 1, light: 1 }; return out;
  });
  const introOk = JSON.stringify(intro) === JSON.stringify([[1, 'cam', true], [16, 'guard', true], [46, 'door', true], [66, 'mirror', true], [86, 'all', true], [106, 'dog', true], [126, 'light', true], ['again', null]]);
  console.log('introductions:', JSON.stringify(intro), introOk ? 'OK' : 'FAIL'); ok = ok && introOk;
  // dogs: tap selects (no turning), tapping a rail tile walks the dog one action per step, a door cannot close on a dog in the doorway, scent is drawn
  const dg1 = await pg.evaluate(async () => {
    const di = LEVELS.findIndex(l => l.meta.dogs); load(di); const k = dogBase(), d = L.dogs[0], out = { level: di + 1 };
    const p = tapPoint(k); onTap(p[0] - cv.getBoundingClientRect().left - ox, p[1] - cv.getBoundingClientRect().top - oy);
    out.selected = sel === k; out.movesAfterSelect = moves;
    out.buttons = [...document.querySelectorAll('#ctx button')].map(b => b.disabled ? 'x' : 'ok').join('');
    out.scent = Array.from(ev().scent).reduce((a, b) => a + b, 0);
    const start = dg[k];
    let target = -1; for (let i = 0; i < d.rail.length; i++) { const o = options(k)[i > start ? 1 : 0]; if (i !== start && o && o.dg && !ev(o.dg).lit[thief] && !ev(o.dg).occ[thief]) { target = i; break; } }
    if (target >= 0) { await guardGoTo(k, d.rail[target]); out.walked = { from: start, to: dg[k], steps: Math.abs(dg[k] - start), moves }; }
    // a door standing under the dog: closing it is refused
    load(di); const ti = L.toggles.findIndex(t => t.kind === 'door' && dogHere(dg, t.c));
    if (ti >= 0) { const kk = nCam() + nGuard() + ti; out.doorStuck = options(kk)[0].dg === null; }
    return out;
  });
  const dgOk = dg1.selected && dg1.movesAfterSelect === 0 && dg1.scent > 0 && (!dg1.walked || (dg1.walked.moves === dg1.walked.steps && dg1.walked.steps > 0)) && (dg1.doorStuck === undefined || dg1.doorStuck === true);
  console.log('dog: select, rail walk, scent, door in the doorway:', JSON.stringify(dg1), dgOk ? 'OK' : 'FAIL'); ok = ok && !!dgOk;
  // searchlights: a tap on the lamp is a Wait (one action, the lamp swings a quarter turn clockwise); any other action swings it too; the next position is previewed
  const lt = await pg.evaluate(async () => {
    const li = LEVELS.findIndex(l => l.map.some(r => /[0-3]/.test(r))); load(li); const k = lightBase(), out = { level: li + 1 };
    const d0 = dg[k], p = tapPoint(k);
    out.preview = nLight() > 0 && P.sweep(L, dg)[k] === (d0 + 1) % 4;
    if (!ev(options(k)[0].dg).lit[thief]) { onTap(p[0] - cv.getBoundingClientRect().left - ox, p[1] - cv.getBoundingClientRect().top - oy); out.waitMoves = moves; out.turned = dg[k] === (d0 + 1) % 4; out.lampOnly = dg.slice(0, k).join() === initialDigitsHead(k); }
    return out;
    function initialDigitsHead(n) { return P.initialDigits(L).slice(0, n).join(); }
  });
  const ltOk = lt.preview && (lt.waitMoves === undefined || (lt.waitMoves === 1 && lt.turned && lt.lampOnly));
  console.log('searchlight: tap = wait, swings a quarter turn:', JSON.stringify(lt), ltOk ? 'OK' : 'FAIL'); ok = ok && !!ltOk;
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
  const gate = await pg.evaluate(() => { settings.unlockAll = false; best = {}; const a = chapterLocked(1); best = {}; for (let id = 1; id <= 6; id++) best[id] = { stars: 3 }; const c = chapterLocked(1); best = {}; return [a, c]; });
  console.log('star gate check (locked with 0 stars, open with 18):', JSON.stringify(gate), gate[0] === true && gate[1] === false ? 'OK' : 'FAIL'); ok = ok && gate[0] === true && gate[1] === false;
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
