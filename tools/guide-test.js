/* Plays every guided-tutorial level (the first three and the first level of each new item) by doing nothing but clicking where the pointing hand points,
   with real mouse clicks, and checks: the hand is always shown on a real target, the level is won in exactly par actions, no hearts are lost, the level is
   remembered as done and the hand does not come back, Skip turns the guide off, and the Settings switch turns it on again.
   usage: PLAYWRIGHT_MODULE=... node tools/guide-test.js <url of the web or the portal build> */
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const url = process.argv[2]; if (!url) { console.error('give the build url, e.g. file://$PWD/play/prisonbreak.html'); process.exit(2); }
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  let ok = true; const check = (name, cond, extra) => { ok = ok && !!cond; console.log((cond ? 'OK   ' : 'FAIL ') + name + (extra ? ' ' + extra : '')); };
  for (const [label, vp, touch] of [['desktop 1280x720', { width: 1280, height: 720 }, false], ['phone 390x844', { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 }), pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await pg.goto(url); await pg.waitForFunction(() => typeof GUIDED !== 'undefined', null, { timeout: 8000 }); await pg.waitForTimeout(250);
    await pg.evaluate(() => { settings.sfx = false; settings.music = false; settings.vibrate = false; settings.guide = true; guideDone = {}; introSeen = { cam: 1, guard: 1, door: 1, mirror: 1, all: 1, dog: 1, light: 1, panel: 1, glass: 1 }; });
    const ids = await pg.evaluate(() => [...GUIDED].sort((a, c) => a - c));
    const rows = [];
    for (const id of ids) {
      await pg.evaluate(id => { load(LEVELS.findIndex(l => l.id === id)); }, id); await pg.waitForTimeout(200);
      const par = await pg.evaluate(() => LEVELS[li].par); let steps = [], won = false, hidden = 0;
      for (let i = 0; i < 40 && !won; i++) {
        const st = await pg.evaluate(() => { const g = guideStep, hand = document.getElementById('guideHand'), p = g && g.pt(); return g && p ? { type: g.type, p, shown: hand.style.display === 'block', text: document.getElementById('tip').textContent } : null; });
        if (!st) { hidden++; await pg.waitForTimeout(120); won = await pg.evaluate(() => document.getElementById('winOv').classList.contains('on')); continue; }
        steps.push(st.type); if (!st.shown || !st.text) hidden++;
        await pg.mouse.click(st.p[0], st.p[1]); await pg.waitForTimeout(160);
        for (let k = 0; k < 60 && await pg.evaluate(() => !!walking); k++) await pg.waitForTimeout(50);
        won = await pg.evaluate(() => document.getElementById('winOv').classList.contains('on'));
      }
      const r = await pg.evaluate(id => ({ moves, lost, done: !!guideDone[id], hearts, win: document.getElementById('winOv').classList.contains('on') }), id);
      rows.push({ id, par, moves: r.moves, steps: steps.join('>'), lost: r.lost });
      check(`${label}: level ${id} won by following the hand in par (${par}) actions, no hearts lost, remembered as done`, r.win && r.moves === par && r.lost === 0 && r.done && hidden <= 6, JSON.stringify({ moves: r.moves, steps: steps.join('>'), hiddenFrames: hidden }));
    }
    // done levels do not show the hand again; Skip turns it off everywhere; the Settings switch turns it back on
    await pg.evaluate(() => { guideDone = {}; load(LEVELS.findIndex(l => l.id === 2)); }); await pg.waitForTimeout(250);
    const before = await pg.evaluate(() => ({ hand: document.getElementById('guideHand').style.display, skip: document.getElementById('guideSkip').style.display }));
    await pg.click('#guideSkip'); await pg.waitForTimeout(250);
    const after = await pg.evaluate(() => ({ hand: document.getElementById('guideHand').style.display, off: !settings.guide }));
    await pg.evaluate(() => { document.getElementById('sGuide').click(); load(LEVELS.findIndex(l => l.id === 3)); }); await pg.waitForTimeout(250);
    const again = await pg.evaluate(() => ({ hand: document.getElementById('guideHand').style.display, on: settings.guide }));
    check(`${label}: the hand and a Skip button show on a tutorial level, Skip hides them for good, the Settings switch brings them back`, before.hand === 'block' && before.skip !== 'none' && after.hand === 'none' && after.off && again.hand === 'block' && again.on, JSON.stringify({ before, after, again }));
    await pg.evaluate(() => { load(LEVELS.findIndex(l => l.id === 10)); }); await pg.waitForTimeout(200);
    check(`${label}: an ordinary level (10) has no hand and keeps hearts`, await pg.evaluate(() => document.getElementById('guideHand').style.display === 'none' && heartsOn() === settings.hearts));
    check(`${label}: no page errors`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await b.close(); process.exit(ok ? 0 : 1);
})();
