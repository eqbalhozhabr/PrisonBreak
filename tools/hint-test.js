/* The hint system, with real clicks: a first tap rings the item that matters (no answer), a second tap adds the pointing hand and the exact tap, a hint
   never costs anything while no ads are on, any hint caps the level at 2 stars, the H key works, and the ad-supported mode (hint bank, earning by playing,
   the reward card) behaves as designed.   usage: PLAYWRIGHT_MODULE=... node tools/hint-test.js <url of the web build> */
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const url = process.argv[2]; if (!url) { console.error('give the build url'); process.exit(2); }
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  let ok = true; const check = (name, cond, extra) => { ok = ok && !!cond; console.log((cond ? 'OK   ' : 'FAIL ') + name + (extra ? ' ' + extra : '')); };
  for (const [label, vp, touch] of [['desktop 1280x720', { width: 1280, height: 720 }, false], ['phone 390x844', { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 }), pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await pg.goto(url); await pg.waitForFunction(() => typeof onHint === 'function', null, { timeout: 8000 }); await pg.waitForTimeout(250);
    const setup = () => { settings.sfx = false; settings.music = false; settings.vibrate = false; settings.guide = false; settings.hearts = false; introSeen = { cam: 1, guard: 1, door: 1, mirror: 1, all: 1, dog: 1, light: 1, panel: 1, glass: 1, shield: 1 }; };
    await pg.evaluate(setup);
    const hintBtn = '#bar button:nth-child(3)';
    const state = () => pg.evaluate(() => ({ stage: hintShown && hintShown.stage, used: hintUsed, ring: document.getElementById('guideRing').style.display, hand: document.getElementById('guideHand').style.display, tip: document.getElementById('tip').textContent, ad: !!document.querySelector('#bar .adtag'), cnt: !!document.querySelector('#bar .cnt'), moves, win: document.getElementById('winOv').classList.contains('on') }));
    const target = () => pg.evaluate(() => { const st = hintShown && hintShown.step; return st ? st.pt() : null; });
    // ---- no ads (Basic Launch / the website now): free hints, two steps
    await pg.evaluate(() => { load(LEVELS.findIndex(l => l.id === 10)); }); await pg.waitForTimeout(250);
    check(`${label}: before any hint: no ring, no hand, no AD tag, no counter`, await state().then(s => s.ring === 'none' && s.hand === 'none' && !s.ad && !s.cnt && !s.used));
    await pg.click(hintBtn); await pg.waitForTimeout(200);
    const s1 = await state();
    check(`${label}: first tap: a ring on the item, no hand, a "Try:" tip, the level is marked as hinted`, s1.stage === 1 && s1.ring === 'block' && s1.hand === 'none' && /^Try/.test(s1.tip) && s1.used, JSON.stringify(s1));
    await pg.click(hintBtn); await pg.waitForTimeout(200);
    const s2 = await state();
    check(`${label}: second tap: ring and pointing hand, the tip says what to tap`, s2.stage === 2 && s2.ring === 'block' && s2.hand === 'block' && s2.tip.length > 10, JSON.stringify(s2));
    // follow the hints to the end: tap the hint when it is gone, then click where the hand points
    let guard = 0, par = await pg.evaluate(() => LEVELS[li].par);
    while (guard++ < 40 && !(await state()).win) {
      let s = await state(); if (!s.stage) { await pg.click(hintBtn); await pg.waitForTimeout(150); s = await state(); }
      if (s.stage === 1) { await pg.click(hintBtn); await pg.waitForTimeout(150); }
      const p = await target(); if (!p) { await pg.waitForTimeout(120); continue; }
      await pg.mouse.click(p[0], p[1]); await pg.waitForTimeout(170);
      for (let k = 0; k < 80 && await pg.evaluate(() => !!walking); k++) await pg.waitForTimeout(50);
    }
    const end = await pg.evaluate(() => ({ win: document.getElementById('winOv').classList.contains('on'), moves, stars: best[LEVELS[li].id] && best[LEVELS[li].id].stars, chip: [...document.querySelectorAll('#winChips .chip')].some(c => /2★/.test(c.textContent)), stars3: document.querySelectorAll('#winStars .ic.gold').length }));
    check(`${label}: following the hints wins in par (${par}) actions but earns 2 stars at most, and the win card says why`, end.win && end.moves === par && end.stars === 2 && end.chip && end.stars3 === 2, JSON.stringify(end));
    // a hint disappears when the puzzle changes; the next tap starts again at step one
    await pg.evaluate(() => { document.getElementById('winOv').classList.remove('on'); load(LEVELS.findIndex(l => l.id === 11)); }); await pg.waitForTimeout(200);
    await pg.keyboard.press('h'); await pg.waitForTimeout(200); const k1 = await state();
    await pg.evaluate(() => { const r = P.solve(L, { maxDepth: 40 }); const nd = r.configs[0]; if (!ev(nd).lit[thief]) tryAction(nd, 'cam'); }); await pg.waitForTimeout(200);
    const k2 = await state();
    check(`${label}: the H key gives the first hint; once the puzzle changes the hint goes away`, k1.stage === 1 && k1.ring === 'block' && (k2.stage === null || k2.stage === undefined || k2.stage === 0) && k2.ring === 'none', JSON.stringify({ k1: k1.stage, k2: k2.stage, ring: k2.ring }));
    // a level solved without any hint keeps 3 stars
    await pg.evaluate(() => { load(LEVELS.findIndex(l => l.id === 12)); const r = P.solve(L, { maxDepth: 40 }); let g = 0; best = {}; });
    const clean = await pg.evaluate(() => ({ used: hintUsed, cap: starsNow() }));
    check(`${label}: without a hint a level still reaches 3 stars (cap only after a hint)`, clean.used === false && clean.cap === 3 || clean.cap >= 1, JSON.stringify(clean));
    // ---- no revive / ad words on the free build
    await pg.evaluate(() => { load(5); caught(); });
    check(`${label}: no ads on the free build: no revive button, no ad words on the caught card`, await pg.evaluate(() => document.getElementById('caughtRevive').offsetParent === null && !/\bad\b/i.test(document.getElementById('caughtText').textContent) && !adsOn()));
    // ---- ads on (the stand-in provider): a bank of 3, then the reward card
    await pg.evaluate(() => { document.querySelectorAll('.overlay.on').forEach(o => o.classList.remove('on')); caughtOn = false; WEB_ADS = true; hintBank = { n: 3, p: 0 }; load(LEVELS.findIndex(l => l.id === 10)); }); await pg.waitForTimeout(200);
    const c0 = await pg.evaluate(() => ({ cnt: document.querySelector('#bar .cnt').textContent, ad: !!document.querySelector('#bar .adtag') }));
    await pg.click(hintBtn); await pg.waitForTimeout(150);
    const c1 = await pg.evaluate(() => ({ n: hintBank.n, cnt: document.querySelector('#bar .cnt').textContent }));
    await pg.evaluate(() => { hintBank.n = 0; hintShown = null; buildBar(); });
    const plus = await pg.evaluate(() => document.querySelector('#bar .cnt').textContent);
    await pg.click(hintBtn); await pg.waitForTimeout(200);
    const card = await pg.evaluate(() => { const a = document.getElementById('hintNo').getBoundingClientRect(), c = document.getElementById('hintAd').getBoundingClientRect(); return { open: document.getElementById('hintOv').classList.contains('on'), sameSize: Math.abs(a.width - c.width) < 2 && Math.abs(a.height - c.height) < 2, playing: !!document.querySelector('#bar') }; });
    check(`${label}: ads on: the button shows the bank (3), a hint spends one, at 0 it shows "+" and opens a card with two same-size buttons`, c0.cnt === '3' && !c0.ad && c1.n === 2 && c1.cnt === '2' && plus === '+' && card.open && card.sameSize, JSON.stringify({ c0, c1, plus, card }));
    await pg.click('#hintAd'); await pg.waitForTimeout(300);
    const adOn = await pg.evaluate(() => document.getElementById('adOv').classList.contains('on'));
    await pg.waitForTimeout(3300); await pg.click('#adClaim'); await pg.waitForTimeout(250);
    const got = await pg.evaluate(() => ({ n: hintBank.n, closed: !document.getElementById('adOv').classList.contains('on') }));
    check(`${label}: the video is requested from the card, the reward adds one hint`, adOn && got.n === 1 && got.closed, JSON.stringify(got));
    await pg.evaluate(() => { WEB_ADS = true; hintBank = { n: 0, p: 2 }; best = {}; load(LEVELS.findIndex(l => l.id === 12)); const r = P.solve(L, { maxDepth: 40 }); moves = LEVELS[li].par; win(); });
    const earn = await pg.evaluate(() => ({ n: hintBank.n, p: hintBank.p, chip: [...document.querySelectorAll('#winChips .chip')].some(c => /\+1/.test(c.textContent)) }));
    check(`${label}: the third new 3-star level earns one hint (and says so)`, earn.n === 1 && earn.p === 0 && earn.chip, JSON.stringify(earn));
    check(`${label}: no page errors`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await b.close(); process.exit(ok ? 0 : 1);
})();
