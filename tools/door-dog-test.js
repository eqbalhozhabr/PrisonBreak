/* Dog levels, doors and cones, with real clicks and the real canvas:
   - a selected dog or guard never takes a tap on a door tile for a move: the door switches (open doors: anywhere on the tile), the dog stays put
   - a guard or dog is let go after every step (arrow button or rail tile), so the next tap cannot send it on again
   - when a dog is woken it runs along the scent (open floor round walls and closed doors), never through them in a straight line
   - a camera cone is drawn inside the camera's own tile when a door or wall is right in front of it, and for the camera that faces away from us
   usage: PLAYWRIGHT_MODULE=... node tools/door-dog-test.js <url of the web build> */
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const url = process.argv[2]; if (!url) { console.error('give the build url'); process.exit(2); }
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  let ok = true; const check = (name, cond, extra) => { ok = ok && !!cond; console.log((cond ? 'OK   ' : 'FAIL ') + name + (extra ? ' ' + extra : '')); };
  for (const [label, vp, touch] of [['desktop 1280x720', { width: 1280, height: 720 }, false], ['phone 390x844', { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 }), pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await pg.goto(url); await pg.waitForFunction(() => typeof scentPath === 'function', null, { timeout: 8000 }); await pg.waitForTimeout(250);
    await pg.evaluate(() => { settings.sfx = false; settings.music = false; settings.vibrate = false; settings.guide = false; settings.hearts = false; introSeen = { cam: 1, guard: 1, door: 1, mirror: 1, all: 1, dog: 1, light: 1, panel: 1, glass: 1 }; });
    const wait = ms => pg.waitForTimeout(ms);
    // ---- 1. a door tile on the rail of the selected dog
    const found = await pg.evaluate(() => { for (let i = 0; i < LEVELS.length; i++) { load(i); P.prepare(L); for (let j = 0; j < L.dogs.length; j++) for (const t of L.toggles) if (t.kind === 'door' && L.dogs[j].rail.includes(t.c)) { const k = dogBase() + j, tg = nCam() + nGuard() + L.toggles.indexOf(t); if (!panelOf(tg) || panelOf(tg) < 0) return { i, k, tg, cell: t.c }; } } return null; });
    check(`${label}: a level with a door on a dog's rail exists`, !!found);
    if (found) {
      await pg.evaluate(f => { load(f.i); sel = f.k; buildBar(); }, found); await wait(150);
      // make sure the dog is not standing in that doorway, and the door is open (the case the tester described)
      await pg.evaluate(f => { const j = f.k - dogBase(), rail = L.dogs[j].rail, here = rail.indexOf(L.toggles[f.tg - nCam() - nGuard()].c); if (dg[f.k] === here) { const o = options(f.k).find(o => o.kind === 'dogStep' && o.dg); if (o) { tryAction(o.dg, o.kind); } } sel = f.k; buildBar(); }, found); await wait(150);
      const before = await pg.evaluate(f => ({ dog: dg[f.k], door: dg[f.tg], moves, open: dg[f.tg] === 0 }), found);
      const at = await pg.evaluate(f => { const c = f.cell, x = c % L.w, y = (c / L.w) | 0; ensureSize(); const r = cv.getBoundingClientRect(); return [r.left + ox + FX(x + .6), r.top + oy + FY(y) + cellH * .8]; }, found);   // the middle of the tile, low down and beside the lever box (the old hit area was only the small box at the top left)
      await pg.mouse.click(at[0], at[1]); await wait(250);
      const after = await pg.evaluate(f => ({ dog: dg[f.k], door: dg[f.tg], moves, sel, walking: !!walking }), found);
      check(`${label}: with the dog selected, a tap on the door tile (level ${found.i + 1}) switches the door, the dog stays, nothing walks`, after.door !== before.door && after.dog === before.dog && after.moves === before.moves + 1 && !after.walking && after.sel === found.tg, JSON.stringify({ before, after }));
    }
    // ---- 2. an open door switches from anywhere on its tile (nothing selected)
    const open = await pg.evaluate(() => { for (let i = 0; i < LEVELS.length; i++) { load(i); P.prepare(L); for (let j = 0; j < L.toggles.length; j++) { const t = L.toggles[j]; if (t.kind === 'door') { const tg = nCam() + nGuard() + j; if (panelOf(tg) < 0 && dg[tg] === 0) return { i, tg, cell: t.c }; } } } return null; });
    if (open) {
      await pg.evaluate(f => { load(f.i); sel = -1; buildBar(); }, open); await wait(150);
      const pt = await pg.evaluate(f => { const c = f.cell, x = c % L.w, y = (c / L.w) | 0; ensureSize(); const r = cv.getBoundingClientRect(); return [r.left + ox + FX(x + .38), r.top + oy + FY(y) + cellH * .8]; }, open);
      const s0 = await pg.evaluate(f => ({ door: dg[f.tg], moves, thief }), open); await pg.mouse.click(pt[0], pt[1]); await wait(250);
      const s1 = await pg.evaluate(f => ({ door: dg[f.tg], moves, thief, walking: !!walking }), open);
      check(`${label}: an open door (level ${open.i + 1}) closes when the middle of its tile is tapped (low down and beside the lever box too), the prisoner does not walk`, s1.door === 1 && s1.moves === s0.moves + 1 && s1.thief === s0.thief && !s1.walking, JSON.stringify({ s0, s1 }));
    }
    // the door posts at the sides of an open door tile are floor: a tap there walks the prisoner into the doorway
    if (open) {
      await pg.evaluate(f => { load(f.i); sel = -1; buildBar(); const e = ev(); window.__doorFloor = !e.lit[f.cell] && !e.occ[f.cell] && !!pathTo(f.cell); }, open); await wait(150);
      const can = await pg.evaluate(() => window.__doorFloor);
      if (can) {
        const pt = await pg.evaluate(f => cellPoint(f.cell), open); await pg.mouse.click(pt[0], pt[1]);
        for (let k = 0; k < 60 && await pg.evaluate(() => !!walking); k++) await wait(60); await wait(150);
        const w1 = await pg.evaluate(f => ({ thief, at: f.cell, door: dg[f.tg] }), open);
        check(`${label}: a tap beside the lever, on a door post, still walks the prisoner into the doorway`, w1.thief === w1.at && w1.door === 0, JSON.stringify(w1));
      }
    }
    // ---- 3. released after every step
    const g = await pg.evaluate(() => { for (let i = 0; i < LEVELS.length; i++) { load(i); if (L.guards.length && L.guards[0].rail.length >= 3) return { i, k: nCam() }; } return null; });
    await pg.evaluate(f => { load(f.i); sel = f.k; buildBar(); }, g); await wait(150);
    const stepBtn = await pg.evaluate(() => { const o = options(sel).findIndex(o => o.kind === 'guardStep' && o.dg); return o; });
    const m0 = await pg.evaluate(() => moves); await pg.evaluate(i => document.querySelectorAll('#ctx button')[i].click(), stepBtn); await wait(150);
    const sg = await pg.evaluate(() => ({ moves, sel }));
    check(`${label}: a guard is let go after a step taken with the arrow button`, sg.sel === -1 && sg.moves === m0 + 1, JSON.stringify(sg));
    const d = await pg.evaluate(() => { for (let i = 96; i < LEVELS.length; i++) { load(i); if (L.dogs.length) return { i, k: dogBase() }; } return null; });
    await pg.evaluate(f => { load(f.i); sel = f.k; buildBar(); }, d); await wait(150);
    const dstep = await pg.evaluate(() => options(sel).findIndex(o => o.kind === 'dogStep' && o.dg)), dm0 = await pg.evaluate(() => moves);
    await pg.evaluate(i => document.querySelectorAll('#ctx button')[i].click(), dstep); await wait(150);
    const sd = await pg.evaluate(() => ({ moves, sel }));
    check(`${label}: a dog is let go after a step taken with the arrow button`, sd.sel === -1 && sd.moves === dm0 + 1, JSON.stringify(sd));
    // ---- 4. the woken dog follows the scent
    const al = await pg.evaluate(() => {
      for (let i = 96; i < LEVELS.length; i++) {
        load(i); P.prepare(L);
        for (let k = 0; k < nAll(); k++) for (const o of options(k)) {
          if (!o.dg) continue; const e = ev(o.dg); if (e.occ[thief] || !e.lit[thief] || !e.scent[thief] || !L.dogs.length) continue;
          const sp = spotters(o.dg); if (!sp.dogs.length) continue;
          const j = sp.dogs[0], c = L.dogs[j].rail[o.dg[dogBase() + j]], path = scentPath(c, thief, e), man = Math.abs(c % L.w - thief % L.w) + Math.abs(((c / L.w) | 0) - ((thief / L.w) | 0));
          if (path.length - 1 > man + 1) return { i, k, nd: o.dg, kind: o.kind, len: path.length - 1, man };            // a detour: the straight line would cross something
        }
      }
      return null;
    });
    check(`${label}: a level where the scent path is a real detour was found`, !!al, JSON.stringify(al));
    if (al) {
      const res = await pg.evaluate(async al => {
        load(al.i); settings.hearts = true; tryAction(al.nd, al.kind);
        const path = alarm ? alarm.dogs[0].path : null, samples = []; const t0 = performance.now();
        while (alarm && performance.now() - t0 < 2500) { const q = ddraw[alarm.dogs[0].j]; if (q) samples.push([q.x, q.y]); await new Promise(r => requestAnimationFrame(r)); }
        return { samples, path: (path || []).map(c => [c % L.w, (c / L.w) | 0]), n: samples.length };
      }, al).catch(() => null);
      // distance of every sample from the polyline of the path
      const dist = (p, a, c) => { const vx = c[0] - a[0], vy = c[1] - a[1], l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2)); return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy)); };
      let worst = 0; if (res && res.path && res.path.length > 1) for (const s of res.samples) { let m = 9; for (let i = 0; i + 1 < res.path.length; i++) m = Math.min(m, dist(s, res.path[i], res.path[i + 1])); worst = Math.max(worst, m); }
      check(`${label}: the woken dog runs along the scented path (never more than 0.1 tile off it, path of ${al.len} steps instead of the straight ${al.man})`, res && res.n > 10 && res.path.length === al.len + 1 && worst < 0.1, JSON.stringify({ n: res && res.n, worst: +worst.toFixed(3) }));
    }
    // ---- 5. cones in the camera's own tile, and for the camera facing away
    const cone = async (map, tile) => {                                                    // the cones drawn with their apex inside the camera's own tile
      await pg.evaluate(map => { if (!window.__fb) { window.__fb = fillBeam; window.__polys = []; fillBeam = (poly, o, f, pulse) => { window.__polys.push(poly.map(q => q.slice())); return window.__fb(poly, o, f, pulse); }; } window.__polys.length = 0; LEVELS.push({ id: 999, map, meta: { guards: {} }, par: 0, walks: 1 }); load(LEVELS.length - 1); window.__custom = true; }, map); await wait(300);
      return pg.evaluate(tile => {
        const x = tile % L.w, y = (tile / L.w) | 0, X0 = FX(x) - 2, X1 = FX(x + 1) + 2, Y0 = FY(y) - wallH - 6, Y1 = FY(y) + cellH + 2; let best = 0;
        for (const poly of window.__polys) { const a = poly[0]; if (a[0] < X0 || a[0] > X1 || a[1] < Y0 || a[1] > Y1) continue; let ar = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; ar += p[0] * q[1] - q[0] * p[1]; } best = Math.max(best, Math.abs(ar) / 2); }
        return Math.round(best);
      }, tile);
    };
    const doorMap = ['#######', '>X....#', '#.....#', '#..S.E#', '#####^#', '#######'], wallMap = ['#######', '>#....#', '#.....#', '#.S..E#', '###v###', '#######'], upMap = ['#######', '#.S.E.#', '#.....#', '#######', '###^###', '#######'];
    const rDoor = await cone(doorMap, 7), rWall = await cone(wallMap, 7), rUp = await cone(upMap, 4 * 7 + 3), rDown = await cone(wallMap, 4 * 7 + 3);
    await pg.evaluate(() => { load(0); if (window.__custom) { LEVELS.pop(); window.__custom = false; } fillBeam = window.__fb || fillBeam; window.__fb = null; });
    check(`${label}: a cone shows inside the camera's own tile when a closed door (${rDoor} px²), a wall (${rWall}) or a wall above the camera that faces away (${rUp}) is right in front of it, and below (${rDown})`, rDoor > 150 && rWall > 150 && rUp > 150 && rDown > 150, JSON.stringify({ rDoor, rWall, rUp, rDown }));
    check(`${label}: no page errors`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await b.close(); process.exit(ok ? 0 : 1);
})();
