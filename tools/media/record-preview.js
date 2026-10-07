/* Records the two CrazyGames hover-preview videos from the portal build, deterministically (virtual clock, 30 fps, no sound).
   A bot plays a few short levels with real mouse clicks; every frame is a 1080x1920 screenshot (viewport 540x960 at DPR 2).
   usage: node tools/media/record-preview.js <outdir> [covers-dir]   (needs dist-crazygames/ from tools/package-portal.js and ffmpeg)
   env: PLAYWRIGHT_MODULE, CHROMIUM, LEVELS ("1,4,..." level ids to play), FRAMES (default 560) */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.resolve(process.argv[2] || 'preview'), covers = path.resolve(process.argv[3] || out);
const FRAMES = Number(process.env.FRAMES || 560), STEP = 1000 / 30;
const SHOW = (process.env.LEVELS || '1,4,7,37,57,97,117').split(',').map(Number);
fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
for (const f of fs.readdirSync(path.join(out, 'frames'))) fs.unlinkSync(path.join(out, 'frames', f));
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await pg.addInitScript(() => {
    let now = 1000, q = [], timers = [], tid = 1, seed = 12345;
    performance.now = () => now; Date.now = () => 1.75e12 + now;
    Math.random = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    window.requestAnimationFrame = f => { q.push(f); return q.length; };
    window.setTimeout = (f, ms = 0, ...a) => { timers.push({ id: tid, t: now + ms, f, a }); return tid++; };
    window.setInterval = (f, ms = 0, ...a) => { timers.push({ id: tid, t: now + Math.max(1, ms), f, a, iv: Math.max(1, ms) }); return tid++; };
    window.clearTimeout = window.clearInterval = id => { timers = timers.filter(x => x.id !== id); };
    window.__step = ms => {
      now += ms; timers.sort((x, y) => x.t - y.t);
      while (timers.length && timers[0].t <= now) { const x = timers.shift(); if (x.iv) { x.t += x.iv; timers.push(x); timers.sort((p, r) => p.t - r.t); } x.f(...x.a); }
      const cb = q; q = []; cb.forEach(f => f(now));
    };
  });
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto('file://' + path.join(__dirname, '..', '..', 'dist-crazygames', 'index.html')); await pg.waitForTimeout(500);
  await pg.evaluate(() => { settings.sfx = false; settings.music = false; settings.vibrate = false; settings.hearts = false; introSeen = { cam: 1, guard: 1, door: 1, mirror: 1, all: 1, dog: 1, light: 1, panel: 1, glass: 1 }; });
  let n = 0;
  const frame = async () => { if (n >= FRAMES) throw new Error('done'); await pg.evaluate(ms => window.__step(ms), STEP); await pg.screenshot({ path: path.join(out, 'frames', 'f' + String(n++).padStart(5, '0') + '.png') }); };
  const frames = async k => { for (let i = 0; i < k; i++) await frame(); };
  const settle = async () => { for (let t = 0; t < 300 && await pg.evaluate(() => !!walking); t++) await frame(); await frames(10); };
  const click = async p => { await pg.mouse.click(p[0], p[1]); await frame(); };
  const play = async id => {
    await pg.evaluate(id => { load(LEVELS.findIndex(l => l.id === id)); }, id); await frames(14);
    const sol = await pg.evaluate(() => { const r = P.solve(L, { maxDepth: 60 }); return r && r.solvable ? { par: r.par, who: r.who, configs: r.configs } : null; });
    for (let s = 0; s < sol.par; s++) {
      const target = await pg.evaluate(({ next, remaining }) => {
        const e2 = P.evalConfig(L, next, false);
        for (let c = 0; c < L.w * L.h; c++) {
          if (L.wall[c] || e2.lit[c] || e2.occ[c] || (c !== thief && !pathTo(c))) continue;
          const r2 = P.solve(L, { digits: next, thief: c, maxDepth: 60 });
          if (r2 && r2.solvable && r2.par === remaining) return c;
        }
        return -1;
      }, { next: sol.configs[s], remaining: sol.par - s - 1 });
      if (target >= 0 && target !== await pg.evaluate(() => thief)) {
        if (await pg.evaluate(t => sel >= nCam() && (sel < nCam() + nGuard() || (sel >= dogBase() && sel < lightBase())) && walkerRail(sel).rail.includes(t), target)) await click(await pg.evaluate(() => thiefPoint()));
        await click(await pg.evaluate(c => cellPoint(c), target)); await settle();
      }
      const who = sol.who[s], info = await pg.evaluate(w => ({ kind: kindOf(w), tap: tapPoint(w) }), who);
      if (info.kind === 'guard' || info.kind === 'dog') { if (!(await pg.evaluate(w => sel === w, who))) { await click(info.tap); await frames(8); } }
      else await click(info.tap);
      if (info.kind === 'guard' || info.kind === 'dog') {
        const btn = await pg.evaluate(({ w, next }) => options(w).findIndex(o => o.dg && o.dg.join() === next.join()), { w: who, next: sol.configs[s] });
        await pg.evaluate(k => document.querySelectorAll('#ctx button')[k].click(), btn); await frame();
      }
      await frames(14);
    }
    await click(await pg.evaluate(() => cellPoint(L.E))); await settle(); await frames(12);
  };
  try {
    await frames(24);                                              // the menu, as the player first sees it
    await pg.click('#mPlay'); await frames(20);
    for (const id of SHOW) await play(id);
    await frames(FRAMES);
  } catch (e) { if (e.message !== 'done') throw e; }
  await b.close();
  console.log('frames:', n, 'page errors:', errs.length ? errs.join(' | ') : 'none');
  // encode: sharp strip in the centre, blurred darkened copy behind; the cover is the first frame (0.5 s)
  const ff = a => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { cwd: out });
  const fr = ['-framerate', '30', '-i', 'frames/f%05d.png'], enc = ['-an', '-c:v', 'libx264', '-crf', '18', '-r', '30'];
  ff([...fr, '-vf', 'split[a][b];[a]scale=1920:3413,crop=1920:1080,boxblur=30:3,eq=brightness=-0.15[bg];[b]scale=-2:1080:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:0,format=yuv420p', ...enc, 'land_game.mp4']);
  ff(['-loop', '1', '-t', '0.5', '-framerate', '30', '-i', path.join(covers, 'cover-landscape-1920x1080.png'), '-vf', 'scale=1920:1080,format=yuv420p', ...enc, 'land_cover.mp4']);
  fs.writeFileSync(path.join(out, 'l.txt'), "file 'land_cover.mp4'\nfile 'land_game.mp4'\n");
  ff(['-f', 'concat', '-safe', '0', '-i', 'l.txt', '-c', 'copy', '-movflags', '+faststart', 'preview-landscape-1920x1080.mp4']);
  ff([...fr, '-vf', 'split[a][b];[a]scale=1080:1920,crop=1080:1620,boxblur=30:3,eq=brightness=-0.15[bg];[b]scale=-2:1620:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:0,format=yuv420p', ...enc, 'port_game.mp4']);
  ff(['-loop', '1', '-t', '0.5', '-framerate', '30', '-i', path.join(covers, 'cover-portrait-800x1200.png'), '-vf', 'scale=1080:1620,format=yuv420p', ...enc, 'port_cover.mp4']);
  fs.writeFileSync(path.join(out, 'p.txt'), "file 'port_cover.mp4'\nfile 'port_game.mp4'\n");
  ff(['-f', 'concat', '-safe', '0', '-i', 'p.txt', '-c', 'copy', '-movflags', '+faststart', 'preview-portrait-1080x1620.mp4']);
  for (const f of ['land_game.mp4', 'land_cover.mp4', 'port_game.mp4', 'port_cover.mp4', 'l.txt', 'p.txt']) fs.unlinkSync(path.join(out, f));
  console.log('wrote preview-landscape-1920x1080.mp4 and preview-portrait-1080x1620.mp4 in', out);
})().catch(e => { console.error(e); process.exit(1); });
