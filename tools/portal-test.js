/* Tests the CrazyGames build (dist-crazygames/) in a real browser at the iframe sizes the platform lists, and checks the portal rules:
   zero requests to any other origin (and none to /api), no page errors, the page never scrolls, nothing on screen needs a server or an ad,
   level 1 can be played with real clicks and the keyboard.   usage: PLAYWRIGHT_MODULE=... node tools/portal-test.js [shotdir] */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const SIZES = [[907, 510], [1216, 684], [1077, 606], [821, 462], [1366, 768], [1920, 1080], [1536, 864], [1280, 720], [800, 450], [1080, 607], [390, 844], [844, 390]];
(async () => {
  const dist = path.join(__dirname, '..', 'dist-crazygames', 'index.html'), shots = process.argv[2];
  const server = http.createServer((req, res) => { if (req.url.split('?')[0] === '/' || req.url.startsWith('/index.html')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(dist)); } else { res.writeHead(404); res.end(); } });
  await new Promise(r => server.listen(0, r)); const base = 'http://localhost:' + server.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  let ok = true; const check = (name, cond, extra) => { ok = ok && !!cond; console.log((cond ? 'OK   ' : 'FAIL ') + name + (extra ? ' ' + extra : '')); };
  const owner = process.env.OWNER_NAME || '[Owner name]';
  for (const [w, h] of SIZES) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const outside = [], errs = []; pg.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) outside.push(u); if (u.includes('/api/')) outside.push(u); });
    pg.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    await pg.goto(base); await pg.waitForTimeout(350);
    await pg.evaluate(() => { settings.sfx = false; settings.music = false; introSeen = { cam: 1, guard: 1, door: 1, mirror: 1, all: 1, dog: 1, light: 1, panel: 1, glass: 1 }; });
    const menu = await pg.evaluate(() => ({ foot: document.getElementById('menuFoot').textContent, acct: document.getElementById('mAccount').offsetParent === null ? 'none' : 'shown', duo: getComputedStyle(document.querySelector('.duo')).display, bottom: Math.max(...[...document.querySelectorAll('#menu button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().bottom)), top: Math.min(...[...document.querySelectorAll('#menu button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().top)) }));
    if (shots) await pg.screenshot({ path: `${shots}/portal-menu-${w}x${h}.png` });
    await pg.evaluate(() => load(56)); await pg.waitForTimeout(350);
    const g = await pg.evaluate(() => { const r = cv.getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, cvIn: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, cs, hintTag: !!document.querySelector('#bar .adtag'), bar: [...document.querySelectorAll('#bar button')].every(b => { const q = b.getBoundingClientRect(); return q.right <= innerWidth && q.bottom <= innerHeight && q.width > 40; }), us: getComputedStyle(document.body).userSelect }; });
    if (shots) await pg.screenshot({ path: `${shots}/portal-game-${w}x${h}.png` });
    const label = `${w}x${h}`;
    check(label + ': menu fits, owner shown, no account/ranking', menu.foot.includes(owner) && menu.acct === 'none' && menu.duo === 'none' && menu.bottom <= h + 1 && menu.top >= 0, JSON.stringify({ foot: menu.foot, bottom: Math.round(menu.bottom) }));
    check(label + ': game fits, never scrolls, board big enough, no ad tag, user-select none', g.sw <= w && g.sh <= h + 1 && g.cvIn && g.bar && !g.hintTag && g.us === 'none' && g.cs >= 28, JSON.stringify({ cs: g.cs, sw: g.sw, sh: g.sh }));
    check(label + ': zero outside requests, no page errors', outside.length === 0 && errs.length === 0, outside.concat(errs).join(' | '));
    await pg.close();
  }
  // behaviour of the portal build: real clicks, keyboard, no ads
  const pg = await b.newPage({ viewport: { width: 907, height: 510 } }); const errs = [], outside = [];
  pg.on('pageerror', e => errs.push(String(e).slice(0, 160))); pg.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:')) outside.push(u); });
  await pg.goto(base); await pg.waitForTimeout(300);
  await pg.evaluate(() => { settings.sfx = false; settings.music = false; introSeen = { cam: 1 }; load(0); });
  const sol = await pg.evaluate(() => { const r = P.solve(L, { maxDepth: 40 }); return { par: r.par, who: r.who, tap: tapPoint(r.who[0]), goal: cellPoint(L.E) }; });
  await pg.mouse.click(...sol.tap); await pg.waitForTimeout(120);
  const mv = await pg.evaluate(() => moves);
  await pg.mouse.click(...sol.goal); for (let i = 0; i < 80 && !(await pg.evaluate(() => document.getElementById('winOv').classList.contains('on'))); i++) await pg.waitForTimeout(50);
  check('level 1 is won with real clicks (par ' + sol.par + ')', mv === sol.par && await pg.evaluate(() => document.getElementById('winOv').classList.contains('on')));
  // keyboard: an arrow key walks him one tile, Backspace undoes an action, Space sends him to the exit (level 1 solved first, so the way is clear)
  await pg.evaluate(() => { load(0); }); const free = await pg.evaluate(() => { const e = ev(); for (let m = 0; m < 4; m++) { const x = thief % L.w + DX[m], y = ((thief / L.w) | 0) + DY[m], c = y * L.w + x; if (x >= 0 && y >= 0 && x < L.w && y < L.h && !L.wall[c] && !e.lit[c] && !e.occ[c]) return ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'][m]; } return null; });
  const t0 = await pg.evaluate(() => thief); if (free) { await pg.keyboard.press(free); await pg.waitForTimeout(400); }
  const movedByKey = !free || await pg.evaluate(t => thief !== t, t0);
  await pg.evaluate(() => { const r = P.solve(L, { maxDepth: 40 }); tryAction(r.configs[0], 'cam'); }); const m1 = await pg.evaluate(() => moves); await pg.keyboard.press('Backspace'); const m2 = await pg.evaluate(() => moves);
  await pg.evaluate(() => { const r = P.solve(L, { maxDepth: 40 }); if (r.par) tryAction(r.configs[0], 'cam'); }); await pg.keyboard.press('Space'); for (let i = 0; i < 60 && !(await pg.evaluate(() => document.getElementById('winOv').classList.contains('on'))); i++) await pg.waitForTimeout(50);
  check('keyboard works (arrow walks, Backspace undoes, Space reaches the exit) and the page never scrolls', movedByKey && m1 === 1 && m2 === 0 && await pg.evaluate(() => document.getElementById('winOv').classList.contains('on') && document.documentElement.scrollTop === 0 && document.body.scrollTop === 0), JSON.stringify({ free, movedByKey, m1, m2 }));
  const rules = await pg.evaluate(async () => {
    load(6); const hintBefore = document.querySelector('#bar button:nth-child(3)'); const out = {};
    hintBefore.click(); out.noAdScreen = !document.getElementById('adOv').classList.contains('on'); out.hintGiven = hintWho >= 0 || document.getElementById('tip').textContent.length > 0;
    for (let i = 0; i < 3; i++) { caught(); document.getElementById('caughtOv').classList.remove('on'); caughtOn = false; }
    caught(); out.noGate = document.getElementById('caughtRetry').textContent === tr().retry && document.getElementById('caughtRevive').offsetParent === null && document.getElementById('caughtReport').offsetParent === null;
    document.getElementById('caughtRetry').click(); out.retryFree = !document.getElementById('adOv').classList.contains('on') && !caughtOn;
    out.statsOff = getComputedStyle(document.getElementById('sStats').parentElement.parentElement).display === 'none' || getComputedStyle(document.getElementById('sStats').closest('.set')).display === 'none';
    out.reportHidden = document.getElementById('pReport').offsetParent === null;
    out.flush = (track('x'), evq.length === 0);
    return out;
  });
  check('portal rules: hints free (no ad screen), 3 catches never need an ad, no revive/report/stats UI, nothing queued for a server', Object.values(rules).every(Boolean), JSON.stringify(rules));
  check('no outside requests and no page errors in the behaviour run', outside.length === 0 && errs.length === 0, outside.concat(errs).join(' | '));
  await b.close(); server.close(); process.exit(ok ? 0 : 1);
})();
