/* Records the two CrazyGames hover-preview videos from the portal build, deterministically (virtual clock, 30 fps, no sound).
   A bot plays real levels with real mouse clicks. The tour goes from the easiest first level up through every item the game adds (guard, door, mirror, dog,
   searchlight, power panel, glass) to a large late level, so a viewer sees that the later stages are a different game from the first ones.
   - landscape 1920x1080: the DESKTOP layout (a 1280x720 page at DPR 1.5), nothing cropped or blurred
   - portrait 1080x1620 (2:3): the PHONE layout (a 540x960 touch page at DPR 2); the 911x1620 strip sits on a blurred, darkened copy of itself
   usage: node tools/media/record-preview.js <outdir> [covers-dir]   (needs dist-crazygames/ from tools/package-portal.js and ffmpeg)
   env: PLAYWRIGHT_MODULE, CHROMIUM, TOUR ("id:frames,id:frames,..."), FRAMES (cap per video, default 585), ONLY (landscape|portrait) */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.resolve(process.argv[2] || 'preview'), covers = path.resolve(process.argv[3] || out);
const CAP = Number(process.env.FRAMES || 585), STEP = 1000 / 30, SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
// level id : frame budget for that level (the bot stops after the action that crosses the budget; a level that is solved sooner ends sooner)
const TOUR = (process.env.TOUR || '1:56,7:64,37:60,57:64,97:64,117:54,137:54,157:54,176:92').split(',').map(s => s.split(':').map(Number));
fs.mkdirSync(out, { recursive: true });

async function record(mode, b) {
  const dir = path.join(out, 'frames-' + mode); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const phone = mode === 'portrait';
  const ctx = await b.newContext(phone ? { viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  const pg = await ctx.newPage(); await pg.route(SDK_URL, r => r.abort());
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
  await pg.goto('file://' + path.join(__dirname, '..', '..', 'dist-crazygames', 'index.html')); await pg.waitForFunction(() => typeof settings !== 'undefined', null, { timeout: 8000 });
  await pg.evaluate(() => { settings.sfx = false; settings.music = false; settings.vibrate = false; settings.hearts = false; introSeen = { cam: 1, guard: 1, door: 1, mirror: 1, all: 1, dog: 1, light: 1, panel: 1, glass: 1 }; });
  if (await pg.evaluate(() => document.body.classList.contains('desk')) === phone) throw new Error('wrong layout for ' + mode);
  let n = 0;
  const frame = async () => { if (n >= CAP) throw new Error('done'); await pg.evaluate(ms => window.__step(ms), STEP); await pg.screenshot({ path: path.join(dir, 'f' + String(n++).padStart(5, '0') + '.png') }); };
  const frames = async k => { for (let i = 0; i < k; i++) await frame(); };
  const walkEnd = async () => {
    for (let t = 0; t < 300 && await pg.evaluate(() => !!walking); t++) await frame();
    if (await pg.evaluate(() => document.getElementById('winOv').classList.contains('on'))) {            // the escape card is not part of the tour: drop the frame that shows it
      n--; fs.unlinkSync(path.join(dir, 'f' + String(n).padStart(5, '0') + '.png')); await pg.evaluate(() => document.getElementById('winOv').classList.remove('on'));
    }
  };
  const settle = async () => { await walkEnd(); await frames(6); };
  const click = async p => { await pg.mouse.click(p[0], p[1]); await frame(); };
  const play = async (id, budget) => {
    const t0 = n;
    await pg.evaluate(id => { load(LEVELS.findIndex(l => l.id === id)); }, id); await frames(12);
    const sol = await pg.evaluate(() => { const r = P.solve(L, { maxDepth: 60 }); return r && r.solvable ? { par: r.par, who: r.who, configs: r.configs } : null; });
    for (let s = 0; s < sol.par; s++) {
      if (n - t0 >= budget) return;                                                 // the next action would not fit: cut to the next level here
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
      if (info.kind === 'guard' || info.kind === 'dog') { if (!(await pg.evaluate(w => sel === w, who))) { await click(info.tap); await frames(6); } }
      else await click(info.tap);
      if (info.kind === 'guard' || info.kind === 'dog') {
        const btn = await pg.evaluate(({ w, next }) => options(w).findIndex(o => o.dg && o.dg.join() === next.join()), { w: who, next: sol.configs[s] });
        await pg.evaluate(k => document.querySelectorAll('#ctx button')[k].click(), btn); await frame();
      }
      await frames(12);
    }
    await click(await pg.evaluate(() => cellPoint(L.E))); await walkEnd();                       // the level ends as the prisoner reaches the exit
  };
  const log = [];
  try {
    await frames(14);                                                                // the menu, as the player first sees it
    await pg.click('#mPlay'); await frames(8);
    for (const [id, budget] of TOUR) { const f0 = n; await play(id, budget); log.push(id + ':' + (n - f0)); }
    await frames(CAP);
  } catch (e) { if (e.message !== 'done') throw e; }
  await ctx.close();
  console.log(mode, 'frames:', n, 'per level:', log.join(' '), 'page errors:', errs.length ? errs.join(' | ') : 'none');
  return dir;
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ff = a => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { cwd: out });
  const enc = ['-an', '-c:v', 'libx264', '-crf', '18', '-r', '30'];
  // the cover is the first 0.5 s (a seamless hover), the footage follows
  const join = (cover, game, name, txt) => {
    ff(['-loop', '1', '-t', '0.5', '-framerate', '30', '-i', cover.img, '-vf', cover.vf, ...enc, cover.tmp]);
    fs.writeFileSync(path.join(out, txt), `file '${cover.tmp}'\nfile '${game}'\n`);
    ff(['-f', 'concat', '-safe', '0', '-i', txt, '-c', 'copy', '-movflags', '+faststart', name]);
    for (const f of [cover.tmp, game, txt]) fs.unlinkSync(path.join(out, f));
  };
  if (process.env.ONLY !== 'portrait') {
    const dir = await record('landscape', b);
    ff(['-framerate', '30', '-i', path.join(dir, 'f%05d.png'), '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', ...enc, 'land_game.mp4']);
    join({ img: path.join(covers, 'cover-landscape-1920x1080.png'), vf: 'scale=1920:1080,format=yuv420p', tmp: 'land_cover.mp4' }, 'land_game.mp4', 'preview-landscape-1920x1080.mp4', 'l.txt');
  }
  if (process.env.ONLY !== 'landscape') {
    const dir = await record('portrait', b);
    ff(['-framerate', '30', '-i', path.join(dir, 'f%05d.png'), '-vf', 'split[a][b];[a]scale=1080:1920,crop=1080:1620,boxblur=30:3,eq=brightness=-0.15[bg];[b]scale=-2:1620:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:0,format=yuv420p', ...enc, '-movflags', '+faststart', 'port_game.mp4']);
    join({ img: path.join(covers, 'cover-portrait-800x1200.png'), vf: 'scale=1080:1620,format=yuv420p', tmp: 'port_cover.mp4' }, 'port_game.mp4', 'preview-portrait-1080x1620.mp4', 'p.txt');
  }
  await b.close();
  console.log('wrote the preview videos in', out);
})().catch(e => { console.error(e); process.exit(1); });
