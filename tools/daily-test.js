/* The daily challenge, with real clicks: the menu button and the card (three tiers, streak, countdown), playing the day's levels, the stars and the day streak (kept apart from the
   numbered levels), the next tier, and the next day.   usage: PLAYWRIGHT_MODULE=... node tools/daily-test.js <url of the build> */
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const url = process.argv[2]; if (!url) { console.error('give the build url'); process.exit(2); }
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  let ok = true; const check = (name, cond, extra) => { ok = ok && !!cond; console.log((cond ? 'OK   ' : 'FAIL ') + name + (extra ? ' ' + extra : '')); };
  for (const [label, vp, touch] of [['desktop 1280x720', { width: 1280, height: 720 }, false], ['phone 390x844', { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 }), pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await pg.goto(url); await pg.waitForFunction(() => typeof openDaily === 'function', null, { timeout: 8000 }); await pg.waitForTimeout(250);
    await pg.evaluate(() => { settings.sfx = false; settings.music = false; settings.vibrate = false; settings.guide = false; settings.hearts = false; introSeen = { cam: 1, guard: 1, door: 1, mirror: 1, all: 1, dog: 1, light: 1, panel: 1, glass: 1, shield: 1 }; dailyStore = { days: {}, streak: 0, last: '' }; store.set('pb_daily', dailyStore); best = {}; store.set('pb_best3', best); dailyNow = () => Date.parse('2026-11-02T10:30:00Z'); });
    check(`${label}: the menu has a Daily button`, await pg.evaluate(() => document.getElementById('mDaily').offsetParent !== null));
    await pg.click('#mDaily'); await pg.waitForTimeout(250);
    const card = await pg.evaluate(() => ({ open: document.getElementById('dailyOv').classList.contains('on'), rows: [...document.querySelectorAll('#dailyRows button')].map(x => x.textContent.trim().split(/\s+/)[0]), date: document.getElementById('dailyDate').textContent, left: document.getElementById('dailyLeft').textContent, streak: document.querySelector('#dailyChips .chip').textContent.trim() }));
    check(`${label}: the card shows today's date, three tiers, a 0 streak and the time left (13:30:00 at 10:30 UTC)`, card.open && card.rows.join().toUpperCase() === 'EASY,MEDIUM,HARD' && card.date === '2026-11-02' && /^13:29:5\d|^13:30:00/.test(card.left) && card.streak === '0', JSON.stringify(card));
    const solve = async () => {                                                        // play the level by clicking where the solver points, until it is won
      for (let i = 0; i < 60 && !(await pg.evaluate(() => document.getElementById('winOv').classList.contains('on'))); i++) {
        const st = await pg.evaluate(() => { const s = stepFor(); const p = s && s.pt(); return p ? { type: s.type, p } : null; });
        if (!st) { await pg.waitForTimeout(100); continue; }
        await pg.mouse.click(st.p[0], st.p[1]); await pg.waitForTimeout(170); for (let k = 0; k < 80 && await pg.evaluate(() => !!walking); k++) await pg.waitForTimeout(50);
      }
    };
    const day = await pg.evaluate(() => dailyIndex());
    const tiers = [];
    for (let tier = 0; tier < 3; tier++) {
      if (tier === 0) await pg.click('#dailyRows button[data-t="0"]'); else await pg.click('#winNext');
      await pg.waitForTimeout(300);
      const head = await pg.evaluate(() => ({ label: document.getElementById('lvLabel').textContent, sub: document.getElementById('blockLabel').textContent, par: Number(document.getElementById('par').textContent), reports: [...document.querySelectorAll('.web-only')].every(e => e.offsetParent === null) }));
      await solve();
      const w = await pg.evaluate(() => ({ win: document.getElementById('winOv').classList.contains('on'), moves, par: curLv().par, stars: document.querySelectorAll('#winStars .ic.gold').length, gate: document.getElementById('winGate').textContent.trim(), nextDisabled: document.getElementById('winNext').disabled }));
      tiers.push({ head, w });
      check(`${label}: tier ${tier + 1}: "${head.label}" (${head.sub}) solved by following the solver in par ${w.par}, 3 stars, streak chip ${w.gate}`, w.win && w.moves === w.par && w.stars === 3 && /^daily · /i.test(head.label) && head.sub === '2026-11-02' && w.gate.startsWith('1') && w.nextDisabled === (tier === 2), JSON.stringify({ head, w }));
    }
    const saved = await pg.evaluate(() => ({ daily: dailyStore, best: Object.keys(best).length, ls: JSON.parse(localStorage.getItem('pb_daily') || '{}') }));
    check(`${label}: the three results are saved under today's date with a streak of 1, the numbered levels' stars are untouched`, JSON.stringify(saved.daily.days['2026-11-02']) === '[3,3,3]' && saved.daily.streak === 1 && saved.best === 0 && saved.ls.streak === 1, JSON.stringify(saved));
    // the next day: new levels, the streak goes to 2; a day skipped: back to 1
    await pg.evaluate(() => { toMenu(); dailyNow = () => Date.parse('2026-11-03T00:00:10Z'); });
    const idx2 = await pg.evaluate(() => dailyIndex());
    await pg.click('#mDaily'); await pg.waitForTimeout(150); await pg.click('#dailyRows button[data-t="0"]'); await pg.waitForTimeout(250); await solve();
    const s2 = await pg.evaluate(() => ({ streak: dailyStore.streak, gate: document.getElementById('winGate').textContent.trim() }));
    await pg.evaluate(() => { toMenu(); dailyNow = () => Date.parse('2026-11-06T12:00:00Z'); });
    await pg.click('#mDaily'); await pg.waitForTimeout(150); await pg.click('#dailyRows button[data-t="0"]'); await pg.waitForTimeout(250); await solve();
    const s3 = await pg.evaluate(() => ({ streak: dailyStore.streak }));
    check(`${label}: another day gives other levels (index ${day} -> ${idx2}), the streak counts to 2, and after a skipped day it restarts at 1`, idx2 !== day && s2.streak === 2 && s3.streak === 1, JSON.stringify({ s2, s3 }));
    // the daily levels never reach the statistics or the numbered progress
    check(`${label}: nothing was queued for the statistics, the report flag is hidden`, await pg.evaluate(() => (track('x'), evq.length === 0) && document.getElementById('pReport').offsetParent === null));
    check(`${label}: no page errors`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await b.close(); process.exit(ok ? 0 : 1);
})();
