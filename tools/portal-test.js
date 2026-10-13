/* Tests the CrazyGames build (dist-crazygames/) in a real browser at the iframe sizes the platform lists, and checks the portal rules:
   zero requests to any other origin except the platform's own SDK script (answered here by a mock SDK) and none to /api, no page errors, the page never
   scrolls, nothing on screen needs a server or an ad, level 1 can be played with real clicks and the keyboard, the desktop landscape layout is used on a
   mouse + wide window and the phone layout on touch, saves go through SDK.data, gameplayStart/Stop follow the play state, muteAudio wins, and the
   Full-Launch ad path (CG_ADS) works when switched on but is off by default.   usage: PLAYWRIGHT_MODULE=... node tools/portal-test.js [shotdir] */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const SIZES = [[907, 510], [1216, 684], [1077, 606], [821, 462], [1366, 768], [1920, 1080], [1536, 864], [1280, 720], [800, 450], [1080, 607], [390, 844], [844, 390]];
const PHONE = new Set(['390x844', '844x390', '800x450p']);                 // sizes also run on a touch phone (800x450 is both: a window on a desktop, a phone on the portal's mobile site)

/* A stand-in for the CrazyGames SDK: in-memory data module that reports every write to the test, a call log, a mute setting, and an ad that finishes or fails. */
function mockSdk(o) {
  return `(function () {
  var D = ${JSON.stringify(o.data || {})}, calls = [], listeners = [];
  window.__cgCalls = calls;
  var SDK = {
    init: function () { return ${o.initFails ? "Promise.reject(new Error('init failed'))" : 'Promise.resolve()'}; },
    game: { settings: { muteAudio: false, disableChat: false }, gameplayStart: function () { calls.push('start'); }, gameplayStop: function () { calls.push('stop'); },
      loadingStart: function () { calls.push('loadingStart'); }, loadingStop: function () { calls.push('loadingStop'); },
      addSettingsChangeListener: function (f) { listeners.push(f); }, removeSettingsChangeListener: function () {} },
    data: { getItem: function (k) { return Object.prototype.hasOwnProperty.call(D, k) ? D[k] : null; }, setItem: function (k, v) { D[k] = String(v); if (window.__cgSet) window.__cgSet(k, String(v)); },
      removeItem: function (k) { delete D[k]; }, clear: function () { D = {}; } },
    ad: { requestAd: function (type, cb) { calls.push('ad:' + type); cb.adStarted(); setTimeout(function () { window.__adPlayingSeen = window.cgAdPlayingProbe && window.cgAdPlayingProbe(); ${o.adFails ? "cb.adError({ code: 'unfilled' })" : 'cb.adFinished()'}; }, 80); } },
  };
  window.__setMute = function (v) { SDK.game.settings.muteAudio = v; listeners.forEach(function (f) { f(); }); };
  window.CrazyGames = { SDK: SDK };
})();`;
}

(async () => {
  const dist = path.join(__dirname, '..', 'dist-crazygames', 'index.html'), shots = process.argv[2];
  const server = http.createServer((req, res) => { if (req.url.split('?')[0] === '/' || req.url.startsWith('/index.html')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(dist)); } else { res.writeHead(404); res.end(); } });
  await new Promise(r => server.listen(0, r)); const base = 'http://localhost:' + server.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  let ok = true; const check = (name, cond, extra) => { ok = ok && !!cond; console.log((cond ? 'OK   ' : 'FAIL ') + name + (extra ? ' ' + extra : '')); };
  const owner = process.env.OWNER_NAME || '[Owner name]';
  /* one page with the mock SDK routed in; `saved` is the platform-side data that survives between pages (the player's cloud save) */
  async function open(o, ctxOpts) {
    const ctx = await b.newContext(Object.assign({ deviceScaleFactor: 1 }, ctxOpts)), pg = await ctx.newPage(), st = { outside: [], sdkReqs: 0, errs: [], saved: Object.assign({}, o.data) };
    pg.on('request', r => { const u = r.url(); if (u === SDK_URL) { st.sdkReqs++; return; } if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) st.outside.push(u); if (u.includes('/api/')) st.outside.push(u); });
    pg.on('pageerror', e => st.errs.push(String(e).slice(0, 160)));
    await pg.exposeFunction('__cgSet', (k, v) => { st.saved[k] = v; });
    await pg.route(SDK_URL, r => o.blocked ? r.abort() : r.fulfill({ status: 200, contentType: 'application/javascript', body: mockSdk(Object.assign({}, o, { data: st.saved })) }));
    await pg.goto(base); await pg.waitForFunction(() => typeof settings !== 'undefined', null, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(250);
    st.pg = pg; st.ctx = ctx; return st;
  }
  const quiet = () => { settings.sfx = false; settings.music = false; introSeen = { cam: 1, guard: 1, door: 1, mirror: 1, all: 1, dog: 1, light: 1, panel: 1, glass: 1 }; };

  // ---- layouts at the platform's iframe sizes: desktop (mouse) everywhere, phone (touch) at the phone sizes
  const runs = []; for (const [w, h] of SIZES) { const key = w + 'x' + h; if (key !== '390x844' && key !== '844x390') runs.push([w, h, 'desk']); if (PHONE.has(key) || (key === '800x450')) runs.push([w, h, 'phone']); }
  for (const [w, h, mode] of runs) {
    const phone = mode === 'phone', st = await open({}, { viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone }), pg = st.pg, label = `${w}x${h} ${mode}`;
    await pg.evaluate(quiet);
    const wantDesk = !phone && w >= 780 && w >= h * 1.25;
    const menu = await pg.evaluate(() => { const vis = [...document.querySelectorAll('#menu button')].filter(x => x.offsetParent), q = id => document.getElementById(id).getBoundingClientRect(), br = document.querySelector('.mbrand').getBoundingClientRect(), pn = document.querySelector('.mpanel').getBoundingClientRect();
      return { desk: document.body.classList.contains('desk'), foot: document.getElementById('menuFoot').textContent, acct: document.getElementById('mAccount').offsetParent === null ? 'none' : 'shown', duo: getComputedStyle(document.querySelector('.duo')).display,
        bottom: Math.max(...vis.map(x => x.getBoundingClientRect().bottom)), top: Math.min(...vis.map(x => x.getBoundingClientRect().top)), right: Math.max(...vis.map(x => x.getBoundingClientRect().right)),
        side: br.width > 0 && pn.width > 0 && br.right <= pn.left + 2, prog: document.getElementById('menuProg').offsetParent !== null, keys: document.getElementById('menuKeys').offsetParent !== null, logoIn: q('logo').top >= 0 && q('logo').bottom <= innerHeight }; });
    if (shots) await pg.screenshot({ path: `${shots}/portal-menu-${w}x${h}-${mode}.png` });
    await pg.evaluate(() => load(56)); await pg.waitForTimeout(300);
    const g = await pg.evaluate(() => { const r = cv.getBoundingClientRect(), vis = el => el && el.offsetParent !== null; return { sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, cvIn: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, cs, hintTag: !!document.querySelector('#bar .adtag'),
      bar: [...document.querySelectorAll('#bar button')].every(b => { const q = b.getBoundingClientRect(); return q.right <= innerWidth && q.bottom <= innerHeight && q.width > 40; }), us: getComputedStyle(document.body).userSelect,
      side: document.getElementById('bar').getBoundingClientRect().left >= r.right - 2, goal: vis(document.getElementById('goal')), keys: vis(document.getElementById('keys')), hud: document.querySelector('.hud').getBoundingClientRect().bottom <= innerHeight }; });
    if (shots) await pg.screenshot({ path: `${shots}/portal-game-${w}x${h}-${mode}.png` });
    // the big panels must fit the window without the page scrolling
    const panels = {}; for (const [id, open] of [['lvOv', 'openLevels()'], ['setOv', "syncSettingsUI(); show('setOv')"], ['howOv', "show('howOv')"], ['pauseOv', "show('pauseOv')"], ['introOv', "showIntro('mirror', false)"]]) {
      await pg.evaluate(open); await pg.waitForTimeout(120);
      panels[id] = await pg.evaluate(id => { const c = document.querySelector('#' + id + ' .card').getBoundingClientRect(); return c.left >= 0 && c.right <= innerWidth && c.top >= -1 && c.bottom <= innerHeight + 1 || document.querySelector('#' + id + ' .card').scrollHeight > document.querySelector('#' + id + ' .card').clientHeight; }, id);
      if (shots && (id === 'lvOv' || id === 'setOv' || id === 'introOv')) await pg.screenshot({ path: `${shots}/portal-${id}-${w}x${h}-${mode}.png` });
      await pg.evaluate(() => { document.querySelectorAll('.overlay.on').forEach(o => o.classList.remove('on')); closeIntro && closeIntro(); });
    }
    check(label + ': ' + (wantDesk ? 'desktop landscape layout on' : 'phone layout (desktop layout off)'), menu.desk === wantDesk);
    check(label + ': menu fits, owner shown, no account/ranking' + (wantDesk ? ', title left of the button panel, progress + key list shown' : ''), menu.foot.includes(owner) && menu.acct === 'none' && menu.duo === 'none' && menu.bottom <= h + 1 && menu.top >= 0 && menu.right <= w && menu.logoIn && (!wantDesk || (menu.side && menu.prog && menu.keys)) && (wantDesk || (!menu.prog && !menu.keys)), JSON.stringify({ foot: menu.foot, bottom: Math.round(menu.bottom) }));
    check(label + ': game fits, never scrolls, board big enough, no ad tag, user-select none' + (wantDesk ? ', side panel to the right' + (h > 620 ? ' with star goals + keys' : '') : ''), g.sw <= w && g.sh <= h + 1 && g.cvIn && g.bar && !g.hintTag && g.us === 'none' && g.cs >= 28 && g.hud && (!wantDesk || g.side) && (!wantDesk || h <= 620 || (g.goal && g.keys)) && (wantDesk || (!g.goal && !g.keys)), JSON.stringify({ cs: g.cs, sw: g.sw, sh: g.sh }));
    check(label + ': levels / settings / how-to / pause / intro panels fit the window', Object.values(panels).every(Boolean), JSON.stringify(panels));
    check(label + ': one outside request only (the SDK script), no page errors', st.outside.length === 0 && st.errs.length === 0 && st.sdkReqs === 1, st.outside.concat(st.errs).join(' | ') + ' sdk=' + st.sdkReqs);
    await st.ctx.close();
  }

  // ---- behaviour on a desktop-sized page with the SDK
  let st = await open({}, { viewport: { width: 907, height: 510 } }); let pg = st.pg;
  const boot = await pg.evaluate(() => window.__cgCalls.slice()); await pg.evaluate(quiet); await pg.evaluate(() => load(0));
  await pg.evaluate(() => { guideDone = {}; load(0); }); await pg.waitForTimeout(300);
  const gd = await pg.evaluate(() => ({ step: guideStep && guideStep.type, hand: document.getElementById('guideHand').style.display, skip: document.getElementById('guideSkip').style.display, hearts: heartsOn() }));
  check('level 1 starts with the tutorial hand on the camera (and a Skip button); no hearts while it leads', gd.step === 'tap' && gd.hand === 'block' && gd.skip !== 'none' && gd.hearts === false, JSON.stringify(gd));
  const sol = await pg.evaluate(() => { const r = P.solve(L, { maxDepth: 40 }); return { par: r.par, who: r.who, tap: tapPoint(r.who[0]), goal: cellPoint(L.E) }; });
  await pg.mouse.click(...sol.tap); await pg.waitForTimeout(120);
  const mv = await pg.evaluate(() => moves);
  await pg.mouse.click(...sol.goal); for (let i = 0; i < 80 && !(await pg.evaluate(() => document.getElementById('winOv').classList.contains('on'))); i++) await pg.waitForTimeout(50);
  check('level 1 is won with real clicks (par ' + sol.par + ')', mv === sol.par && await pg.evaluate(() => document.getElementById('winOv').classList.contains('on')));
  // saves: written to SDK.data (and mirrored in localStorage)
  await pg.waitForTimeout(200);
  const best1 = await pg.evaluate(() => ({ sdk: CG.data.getItem('pb_best3'), ls: localStorage.getItem('pb_best3'), sdkOn: !!CG }));
  check('progress is written to SDK.data (and mirrored in localStorage)', best1.sdkOn && best1.sdk && JSON.parse(best1.sdk)['1'] && st.saved.pb_best3 && best1.ls === best1.sdk, JSON.stringify(best1).slice(0, 120));
  // gameplay events follow the play state: start while playing, stop on every panel/menu
  await pg.evaluate(() => { document.getElementById('winOv').classList.remove('on'); window.__cgCalls.length = 0; load(1); }); await pg.waitForTimeout(600);
  const c1 = await pg.evaluate(() => window.__cgCalls.slice());
  await pg.evaluate(() => show('pauseOv')); await pg.waitForTimeout(600); const c2 = await pg.evaluate(() => window.__cgCalls.slice());
  await pg.evaluate(() => hide('pauseOv')); await pg.waitForTimeout(600); const c3 = await pg.evaluate(() => window.__cgCalls.slice());
  await pg.evaluate(() => toMenu()); await pg.waitForTimeout(600); const c4 = await pg.evaluate(() => window.__cgCalls.slice());
  check('gameplayStart when a level is played, gameplayStop on pause and menu, start again on resume', c1.join() === 'start' && c2.join() === 'start,stop' && c3.join() === 'start,stop,start' && c4.join() === 'start,stop,start,stop', [c1, c2, c3, c4].map(x => x.join('>')).join(' | '));
  check('loadingStart before init and loadingStop when the game is up are reported', boot.join() === 'loadingStart,loadingStop', boot.join());
  // platform mute setting wins over our own toggles
  const mute = await pg.evaluate(() => { settings.sfx = true; settings.music = true; const before = cgMuted(); window.__setMute(true); return { before, after: cgMuted() }; });
  check('muteAudio from the SDK mutes sound and music even when they are on in settings', mute.before === false && mute.after === true, JSON.stringify(mute));
  // portal rules: no ads in Basic Launch, free hints, no server, nothing queued
  const rules = await pg.evaluate(async () => {
    load(6); const out = {}; out.adsOff = !adsOn() && CG_ADS === false;
    document.querySelector('#bar button:nth-child(3)').click(); out.noAdScreen = !document.getElementById('adOv').classList.contains('on'); out.hintGiven = hintWho >= 0 || document.getElementById('tip').textContent.length > 0;
    for (let i = 0; i < 3; i++) { caught(); document.getElementById('caughtOv').classList.remove('on'); caughtOn = false; }
    caught(); out.noGate = document.getElementById('caughtRetry').getAttribute('aria-label') === tr().retry && document.getElementById('caughtRevive').offsetParent === null && document.getElementById('caughtReport').offsetParent === null;
    out.noAdWords = !/\bad\b/i.test(document.getElementById('caughtText').textContent) && [...document.querySelectorAll('.adtag')].every(e => e.offsetParent === null);
    document.getElementById('caughtRetry').click(); out.retryFree = !document.getElementById('adOv').classList.contains('on') && !caughtOn;
    out.statsOff = getComputedStyle(document.getElementById('sStats').closest('.set')).display === 'none';
    show('winOv'); out.reportHidden = ['pReport', 'winReport', 'caughtReport'].every(id => { const el = document.getElementById(id); return getComputedStyle(el).display === 'none' || el.closest('.web-only') && getComputedStyle(el.closest('.web-only')).display === 'none'; }); hide('winOv');
    out.noReportScreen = getComputedStyle(document.getElementById('repOv')).display === 'none';
    out.flush = (track('x'), evq.length === 0);
    return out;
  });
  check('portal rules: no ads in Basic Launch (hints free, 3 catches never need an ad, no ad words), no revive, no level-report buttons (pause, win, caught), no stats UI, nothing queued for a server', Object.values(rules).every(Boolean), JSON.stringify(rules));
  // keyboard
  await pg.evaluate(() => { load(0); }); const free = await pg.evaluate(() => { const e = ev(); for (let m = 0; m < 4; m++) { const x = thief % L.w + DX[m], y = ((thief / L.w) | 0) + DY[m], c = y * L.w + x; if (x >= 0 && y >= 0 && x < L.w && y < L.h && !L.wall[c] && !e.lit[c] && !e.occ[c]) return ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'][m]; } return null; });
  const t0 = await pg.evaluate(() => thief); if (free) { await pg.keyboard.press(free); await pg.waitForTimeout(400); }
  const movedByKey = !free || await pg.evaluate(t => thief !== t, t0);
  await pg.evaluate(() => { const r = P.solve(L, { maxDepth: 40 }); tryAction(r.configs[0], 'cam'); }); const m1 = await pg.evaluate(() => moves); await pg.keyboard.press('Backspace'); const m2 = await pg.evaluate(() => moves);
  await pg.evaluate(() => { const r = P.solve(L, { maxDepth: 40 }); if (r.par) tryAction(r.configs[0], 'cam'); }); await pg.keyboard.press('Space'); for (let i = 0; i < 60 && !(await pg.evaluate(() => document.getElementById('winOv').classList.contains('on'))); i++) await pg.waitForTimeout(50);
  check('keyboard works (arrow walks, Backspace undoes, Space reaches the exit) and the page never scrolls', movedByKey && m1 === 1 && m2 === 0 && await pg.evaluate(() => document.getElementById('winOv').classList.contains('on') && document.documentElement.scrollTop === 0 && document.body.scrollTop === 0), JSON.stringify({ free, movedByKey, m1, m2 }));
  await pg.evaluate(() => { document.querySelectorAll('.overlay.on').forEach(o => o.classList.remove('on')); toMenu(); }); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
  check('Enter starts the game from the main menu (desktop)', await pg.evaluate(() => inGame && !document.getElementById('menu').classList.contains('on')));
  check('no outside requests except the SDK, no page errors in the behaviour run', st.outside.length === 0 && st.errs.length === 0 && st.sdkReqs === 1, st.outside.concat(st.errs).join(' | '));
  const savedForLater = Object.assign({}, st.saved); await st.ctx.close();

  // ---- a new device: empty localStorage, same CrazyGames save -> the progress comes back
  st = await open({ data: savedForLater }, { viewport: { width: 1280, height: 720 } }); pg = st.pg;
  const back = await pg.evaluate(() => ({ stars: best[1] && best[1].stars, ls: localStorage.getItem('pb_best3'), prog: document.getElementById('menuProg').textContent }));
  check('progress saved in SDK.data comes back on a new device with an empty localStorage', back.stars >= 1 && back.ls === null, JSON.stringify(back));
  await st.ctx.close();

  // ---- Full Launch path (off in the shipped build): rewarded video for a hint, error = no reward, blocked UI while waiting
  for (const fails of [false, true]) {
    st = await open({ adFails: fails }, { viewport: { width: 1280, height: 720 } }); pg = st.pg; await pg.evaluate(quiet);
    const ad = await pg.evaluate(async () => {
      CG_ADS = true; window.cgAdPlayingProbe = () => cgMuted(); load(6); const out = { gate: adsOn(), adTag: !!document.querySelector('#bar .adtag') === false }; buildBar(); out.adTag = !!document.querySelector('#bar .adtag');
      const before = hintsUsed; document.querySelector('#bar button:nth-child(3)').click(); out.blocked = document.getElementById('adOv').classList.contains('on');
      await new Promise(r => setTimeout(r, 400)); out.hintsDelta = hintsUsed - before; out.closed = !document.getElementById('adOv').classList.contains('on'); out.calls = window.__cgCalls.filter(c => c.startsWith('ad:')); out.mutedDuring = window.__adPlayingSeen === true; out.mutedAfter = cgAdPlaying;
      return out;
    });
    check('Full Launch path (CG_ADS on), ad ' + (fails ? 'fails: no reward' : 'finishes: hint rewarded') + ', screen blocked meanwhile, muted only while it plays', ad.gate && ad.adTag && ad.blocked && ad.closed && ad.calls.join() === 'ad:rewarded' && ad.hintsDelta === (fails ? 0 : 1) && ad.mutedDuring && !ad.mutedAfter, JSON.stringify(ad));
    await st.ctx.close();
  }

  // ---- no SDK (blocked / ad blocker) or an SDK whose init fails: the game still starts and saves in localStorage
  for (const [name, o] of [['SDK script blocked', { blocked: true }], ['SDK init fails', { initFails: true }]]) {
    st = await open(o, { viewport: { width: 1280, height: 720 } }); pg = st.pg; await pg.evaluate(quiet); await pg.evaluate(() => { load(0); best[1] = { stars: 3, moves: 1 }; store.set('pb_best3', best); });
    const r = await pg.evaluate(() => ({ cg: CG === null, ls: !!localStorage.getItem('pb_best3'), menu: typeof toMenu === 'function' }));
    check(name + ': the game starts without it and saves to localStorage', r.cg && r.ls && r.menu && st.errs.length === 0, JSON.stringify(r) + st.errs.join('|'));
    await st.ctx.close();
  }
  await b.close(); server.close(); process.exit(ok ? 0 : 1);
})();
