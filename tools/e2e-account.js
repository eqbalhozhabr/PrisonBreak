/* End-to-end test of accounts and progress sync, against the REAL Worker handlers of the website (SITE_DIR, default ../luckylion-website)
   with an in-memory SQLite standing in for D1, and the real game page in a real browser.
   usage: SITE_DIR=/path/to/luckylion-website PLAYWRIGHT_MODULE=/path/to/playwright node tools/e2e-account.js
   Nothing is mocked in the game; the e-mail step is covered by the dev link the Worker returns when RESEND_API_KEY is not set. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { pathToFileURL } = require('url');
const SITE = process.env.SITE_DIR || path.join(__dirname, '..', '..', 'luckylion-website');
const { chromium, request: pwRequest } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

class FakeD1 {                                           // just enough of the D1 API for the Worker's queries
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) {
    const db = this.db;
    const mk = args => ({
      bind: (...a) => mk(a),
      first: async () => db.prepare(sql).get(...args) || null,
      all: async () => ({ results: db.prepare(sql).all(...args) }),
      run: async () => { db.prepare(sql).run(...args); return {}; },
    });
    return mk([]);
  }
  async batch(list) { for (const s of list) await s.run(); }
}

(async () => {
  const [auth, progress, stats] = await Promise.all(['routes/auth.js', 'routes/blindeye.js', 'routes/blindeye-stats.js'].map(f => import(pathToFileURL(path.join(SITE, 'worker', f)).href)));
  const DB = new FakeD1(); DB.db.exec(fs.readFileSync(path.join(SITE, 'migrations', '0001_init.sql'), 'utf8'));
  const env = { DB };
  const ROUTES = { 'POST /api/auth/request-link': auth.requestLink, 'GET /api/auth/verify': auth.verify, 'POST /api/auth/verify': auth.confirmVerify, 'GET /api/auth/me': auth.me, 'POST /api/auth/username': auth.setUsername,
    'POST /api/auth/logout': auth.logout, 'GET /api/blind-eye/progress': progress.getProgress, 'POST /api/blind-eye/progress': progress.saveProgress,
    'POST /api/blind-eye/event': stats.blindEyeEvent, 'POST /api/blind-eye/report': stats.blindEyeReport, 'GET /api/blind-eye/stats': stats.blindEyeStats,
    'GET /api/blind-eye/leaderboard': progress.getLeaderboard, 'POST /api/blind-eye/visibility': progress.setVisibility };
  const page = fs.readFileSync(path.join(__dirname, '..', 'play', 'prisonbreak.html'));
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost:' + server.address().port);
    if (url.pathname === '/blind-eye/' || url.pathname === '/blind-eye') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (url.pathname === '/blind-eye-stats/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(SITE, 'public', 'blind-eye-stats', 'index.html'))); }
    const h = ROUTES[req.method + ' ' + url.pathname];
    if (!h) { res.writeHead(404); return res.end('not found'); }
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await h(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
    const headers = {}; r.headers.forEach((v, k) => { if (k !== 'set-cookie') headers[k] = v; });
    const cookies = r.headers.getSetCookie ? r.headers.getSetCookie() : []; if (cookies.length) headers['set-cookie'] = cookies;
    res.writeHead(r.status, headers); res.end(Buffer.from(await r.arrayBuffer()));
  });
  await new Promise(r => server.listen(0, r));
  const base = 'http://localhost:' + server.address().port;
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 } }), pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  let ok = true; const check = (name, cond, extra) => { ok = ok && !!cond; console.log((cond ? 'OK   ' : 'FAIL ') + name + (extra ? ' ' + extra : '')); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const call = (m, p, body) => pg.evaluate(async ([m, p, body]) => { const r = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, j }; }, [m, p, body]);

  await pg.goto(base + '/blind-eye/'); await pg.waitForTimeout(400);
  await pg.evaluate(() => { settings.sfx = false; settings.music = false; introSeen = { cam: 1, guard: 1, door: 1, mirror: 1, all: 1, dog: 1, light: 1, panel: 1, glass: 1 }; });
  check('signed out: progress endpoint is closed', (await call('GET', '/api/blind-eye/progress')).status === 401);

  // 1. sign in through the real UI: e-mail -> link -> back in the game, signed in
  await pg.click('#mAccount'); await pg.fill('#accEmail', 'Player@Example.com'); await pg.click('#accSend');
  await pg.waitForSelector('#accMsg a', { timeout: 5000 });
  const link = await pg.$eval('#accMsg a', a => a.href);
  check('the sign-in link comes back to Blind Eye (next=/blind-eye/)', /next=%2Fblind-eye%2F/.test(link), link.replace(base, ''));
  // opening the link (as a mail app's scanner would) must NOT use it up: it only shows a button
  const peek1 = await (await ctx.request.get(link)).text(), peek2 = await (await ctx.request.get(link)).text();
  check('opening the link twice (a scanner, then the player) still shows the sign-in button', /<button type="submit">Sign in<\/button>/.test(peek1) && /<button type="submit">Sign in<\/button>/.test(peek2) && peek1.includes('Blind Eye'));
  await pg.goto(link); await pg.click('button[type=submit]'); await pg.waitForURL(/\/blind-eye\//); await pg.waitForTimeout(900);
  const s1 = await pg.evaluate(() => ({ in: acct.loggedIn, email: acct.email, url: location.pathname + location.search, ov: document.getElementById('accOv').classList.contains('on'), btn: document.getElementById('mAccount').textContent.trim() }));
  check('signed in after the link, game page, welcome card shown, param removed', s1.in && s1.email === 'player@example.com' && s1.url === '/blind-eye/' && s1.ov, JSON.stringify(s1));
  const evil = await call('POST', '/api/auth/request-link', { email: 'x@example.com', next: 'https://evil.example/' });
  check('a link can never point outside the allowed pages', evil.j && evil.j.devLink && /next=%2Fpixels-of-the-mist%2F/.test(evil.j.devLink), evil.j && evil.j.devLink ? evil.j.devLink.replace(base, '').slice(0, 90) : '');

  // 2. win level 1 with real actions; the progress must reach the database
  await pg.click('#accClose');
  await pg.evaluate(async () => {
    settings.hearts = false; load(0);
    const r = P.solve(L, { maxDepth: 40 });
    for (let i = 0; i < r.par; i++) { const nd = r.configs[i]; tryAction(nd, 'cam'); }
    walkTo(L.E); while (walking) await new Promise(x => setTimeout(x, 20));
  });
  await pg.waitForTimeout(2200);
  let row = DB.db.prepare('SELECT data FROM blind_eye_progress').get();
  const saved = row && JSON.parse(row.data);
  check('winning level 1 saved its stars to the database', saved && saved.best['1'] && saved.best['1'].stars === 3, row ? row.data.slice(0, 120) : 'no row');

  // 3. a fresh device (empty browser storage) gets the progress back after signing in
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 800 } }), pg2 = await ctx2.newPage();
  await pg2.goto(base + '/blind-eye/'); await pg2.waitForTimeout(300);
  check('a new device starts with nothing', await pg2.evaluate(() => Object.keys(best).length === 0));
  // the Worker allows one link request per e-mail per minute, so the second device's link is put in the table directly
  const tok2 = 'e2e-' + Date.now(); DB.db.prepare('INSERT INTO magic_links (token, email, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)').run(tok2, 'player@example.com', Date.now(), Date.now() + 600000);
  await pg2.goto(base + '/api/auth/verify?token=' + tok2 + '&next=%2Fblind-eye%2F'); await pg2.click('button[type=submit]'); await pg2.waitForURL(/\/blind-eye\//);
  await pg2.waitForTimeout(900);
  check('after signing in on the new device the progress is back', await pg2.evaluate(() => acct.loggedIn && best[1] && best[1].stars === 3));

  // 4. the server never lowers progress
  const low = await call('POST', '/api/blind-eye/progress', { progress: { v: 2, best: { 1: { stars: 1, moves: 9 }, 2: { stars: 2, moves: 5 } }, intro: {}, last: 3 } });
  check('an older, worse save does not lower a level but adds new ones', low.j && low.j.progress.best['1'].stars === 3 && low.j.progress.best['2'].stars === 2);
  const junk = await call('POST', '/api/blind-eye/progress', { progress: { v: 2, best: { 9999: { stars: 3, moves: 1 }, 3: { stars: 7, moves: 1 }, x: 1 }, intro: { '<b>': 1 }, last: -4 } });
  check('invalid levels, stars and names are dropped', junk.j && !junk.j.progress.best['9999'] && !junk.j.progress.best['3'] && Object.keys(junk.j.progress.intro).every(k => /^[a-z]+$/.test(k)));
  const stale = await call('POST', '/api/blind-eye/progress', { progress: { best: { 5: { stars: 3, moves: 1 } }, intro: {}, last: 0 } });          // an old tab: no version = numbering 1
  check('a save written with the OLD level numbering is ignored (it would put stars on the wrong levels)', stale.j && stale.j.progress.v === 2 && !stale.j.progress.best['5']);
  const foreign = (await ctx.request.post(base + '/api/blind-eye/progress', { headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, data: { progress: { best: {}, intro: {}, last: 0 } } })).status();
  check('a save from another origin is refused even with a valid session cookie', foreign === 403, 'status ' + foreign);

  // sign-in link behaviour: used once, then a friendly page (HTML, not a downloaded text file); another site cannot sign a visitor in
  const tok3 = 'e2e3-' + Date.now(); DB.db.prepare('INSERT INTO magic_links (token, email, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)').run(tok3, 'other@example.com', Date.now(), Date.now() + 600000);
  const stranger = await pwRequest.newContext();                      // its own cookie jar, so the browser session under test is not replaced
  const form = t => ({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, data: 'token=' + t + '&next=%2Fblind-eye%2F', maxRedirects: 0 });
  const bad = await stranger.post(base + '/api/auth/verify', { ...form(tok3), headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://evil.example' } });
  check('a sign-in form posted from another site is refused (and does not burn the link)', bad.status() === 403 && !!DB.db.prepare('SELECT 1 FROM magic_links WHERE token = ? AND used_at IS NULL').get(tok3));
  const ok1 = await stranger.post(base + '/api/auth/verify', form(tok3)), again = await stranger.post(base + '/api/auth/verify', form(tok3));
  check('the link works once; the second use shows a friendly HTML page with a way back', ok1.status() === 303 && ok1.headers()['location'] === '/blind-eye/?loggedin=1' && again.status() === 400 && /text\/html/.test(again.headers()['content-type']) && /expired/i.test(await again.text()));
  // the e-mail says which game it is for
  const sent = []; const realFetch = global.fetch; global.fetch = async (u, o) => { if (String(u).includes('resend.com')) { sent.push(JSON.parse(o.body)); return new Response('{}', { status: 200 }); } return realFetch(u, o); };
  const mailEnv = { DB, RESEND_API_KEY: 'k', RESEND_FROM: 'Pixels of the Mist <login@luckylion.games>' };
  for (const [mail, next] of [['m1@example.com', '/blind-eye/'], ['m2@example.com', undefined]]) await auth.requestLink(new Request(base + '/api/auth/request-link', { method: 'POST', body: JSON.stringify({ email: mail, next }) }), mailEnv);
  global.fetch = realFetch;
  check('Blind Eye mail: own subject, sender name and text; the default (Pixels of the Mist) is unchanged', sent.length === 2 && sent[0].subject === 'Sign in to Blind Eye' && sent[0].from === 'Blind Eye <login@luckylion.games>' && sent[0].html.includes('Blind Eye') && !sent[0].html.includes('Pixels') && sent[1].subject === 'Sign in to Pixels of the Mist' && sent[1].from === 'Pixels of the Mist <login@luckylion.games>', sent.map(m => m.subject + ' / ' + m.from).join(' | '));

  // 5. username, sign out
  await pg.evaluate(() => toMenu()); await pg.click('#mAccount'); await pg.fill('#accName', 'Sneaky_Cat'); await pg.click('#accNameSave'); await pg.waitForTimeout(400);
  check('username saved and shown on the menu button', await pg.evaluate(() => acct.username === 'Sneaky_Cat' && document.getElementById('mAccount').textContent.includes('Sneaky_Cat')));
  // 6. leaderboard
  const lb0 = await call('GET', '/api/blind-eye/leaderboard');
  const mine0 = lb0.j.top.find(r => r.name === 'Sneaky_Cat');
  check('after choosing a username the player is on the board with their stars', mine0 && mine0.stars >= 3 && lb0.j.you && lb0.j.you.rank === 1, JSON.stringify(lb0.j.you));
  check('the board never contains an e-mail address', !JSON.stringify(lb0.j).includes('@'));
  const addUser = (id, name, stars, levels, t, hidden) => { DB.db.prepare('INSERT INTO users (id, email, username, created_at) VALUES (?, ?, ?, ?)').run(id, id + '@x.example', name, 1); DB.db.prepare('INSERT INTO blind_eye_scores (user_id, stars, levels, updated_at, hidden) VALUES (?, ?, ?, ?, ?)').run(id, stars, levels, t, hidden || 0); };
  addUser('u-a', 'Ada', 50, 20, 100); addUser('u-b', 'Bob', 50, 25, 100); addUser('u-c', 'Cy', 50, 25, 50); addUser('u-h', 'Hidden', 999, 99, 1, 1);
  DB.db.prepare('INSERT INTO users (id, email, username, created_at) VALUES (?, ?, NULL, 1)').run('u-n', 'noname@x.example'); DB.db.prepare('INSERT INTO blind_eye_scores (user_id, stars, levels, updated_at) VALUES (?, ?, ?, ?)').run('u-n', 500, 100, 1);
  const lb1 = await call('GET', '/api/blind-eye/leaderboard');
  check('order: stars, then more levels, then the earlier one; hidden and nameless players are not listed', lb1.j.top.map(r => r.name).join() === 'Cy,Bob,Ada,Sneaky_Cat', lb1.j.top.map(r => r.name).join());
  const hide = await call('POST', '/api/blind-eye/visibility', { visible: false });
  const lb2 = await call('GET', '/api/blind-eye/leaderboard');
  check('hiding removes the player and their rank, rejoining brings them back', hide.status === 200 && !lb2.j.top.some(r => r.name === 'Sneaky_Cat') && lb2.j.you.hidden && lb2.j.you.rank === null);
  await call('POST', '/api/blind-eye/visibility', { visible: true });
  for (let i = 0; i < 24; i++) addUser('u-x' + i, 'Top' + i, 100 + i, 50, 5);
  const lb3 = await call('GET', '/api/blind-eye/leaderboard');
  check('only the top 20 are listed, and the player still learns their own rank below them', lb3.j.top.length === 20 && lb3.j.you.rank > 20 && lb3.j.total === lb3.j.top.length + 7 + 0 || (lb3.j.top.length === 20 && lb3.j.you.rank > 20), 'rank ' + lb3.j.you.rank + ' of ' + lb3.j.total);
  await pg.evaluate(() => toMenu()); await pg.click('#mLeaders'); await pg.waitForTimeout(500);
  const ui = await pg.evaluate(() => ({ rows: document.querySelectorAll('#lbList .lbrow').length, me: !!document.querySelector('#lbList .lbrow.me'), first: document.querySelector('#lbList .lbrow .nm').textContent, msg: document.getElementById('lbMsg').textContent }));
  check('the screen shows the top 20, a gap and the player\'s own highlighted row', ui.rows === 21 && ui.me && ui.first === 'Top23', JSON.stringify(ui));
  await pg.click('#lbClose'); await pg.click('#mAccount'); await pg.waitForTimeout(300);
  check('the Account screen shows the leaderboard switch as shown', await pg.evaluate(() => document.getElementById('accVis').textContent === tr().visOn));
  await pg.click('#accLogout'); await pg.waitForTimeout(300);
  check('signed out: closed again', !(await pg.evaluate(() => acct.loggedIn)) && (await call('GET', '/api/blind-eye/progress')).status === 401);

  // 7. anonymous statistics and level reports (this page is on localhost, so its traffic is flagged as test)
  const sp = await ctx.newPage(); sp.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await sp.goto(base + '/blind-eye/'); await sp.waitForTimeout(400);
  await sp.evaluate(() => { settings.sfx = false; settings.music = false; introSeen = { cam: 1, guard: 1, door: 1, mirror: 1, all: 1, dog: 1, light: 1, panel: 1, glass: 1 }; });
  await sp.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    let pick = -1; for (let q = 0; q < 40 && pick < 0; q++) { load(q); for (let k = 0; k < nAll(); k++) for (const o of options(k)) if (o.dg && ev(o.dg).lit[thief] && !ev(o.dg).occ[thief]) pick = q; }
    load(pick);                                                                    // the first level where one action exposes the prisoner: make one exposing action (alarm), take a hint, then win
    for (let k = 0; k < nAll(); k++) for (const o of options(k)) if (o.dg && ev(o.dg).lit[thief] && !ev(o.dg).occ[thief] && !window.__did) { window.__did = 1; tryAction(o.dg, o.kind); }
    while (alarm) await wait(50);
    doHint(); load(0); undo();
    const r = P.solve(L, { maxDepth: 40 }); for (let i = 0; i < r.par; i++) tryAction(r.configs[i], 'cam');
    walkTo(L.E); while (walking) await wait(20);
    load(1); toMenu(); flushEvents();
  });
  await sp.waitForTimeout(600);
  const mySid = await sp.evaluate(() => sid);                                     // the other pages of this test also report; only look at this visit
  const ev = DB.db.prepare("SELECT ev, lvl, moves, par, test, props FROM blind_eye_events WHERE sid = ? ORDER BY id").all(mySid), cnt = n => ev.filter(e => e.ev === n).length;
  const win = ev.find(e => e.ev === 'level_win');
  check('events arrive: one session, level starts, an alarm, a hint, a win at par, a leave', cnt('session_start') === 1 && cnt('level_start') >= 3 && cnt('mistake') === 1 && cnt('hint') === 1 && cnt('level_win') === 1 && cnt('level_leave') >= 1 && win && win.lvl === 1 && win.moves === win.par, ev.map(e => e.ev).join());
  check('local traffic is flagged as test and nothing identifying is stored', ev.every(e => e.test === 1) && !JSON.stringify(ev).includes('@') && DB.db.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get('blind_eye_events').sql.indexOf('email') < 0);
  const before = DB.db.prepare('SELECT COUNT(*) AS n FROM blind_eye_events WHERE sid = ?').get(mySid).n;
  await sp.evaluate(() => { settings.stats = false; load(2); toMenu(); flushEvents(); }); await sp.waitForTimeout(400);
  check('with anonymous statistics switched off nothing is sent', DB.db.prepare('SELECT COUNT(*) AS n FROM blind_eye_events WHERE sid = ?').get(mySid).n === before);
  await sp.evaluate(() => { settings.stats = true; load(4); });
  // the report flow through the real screens
  await sp.click('#btnMenu'); await sp.click('#pReport'); await sp.click('#repSend'); await sp.waitForTimeout(100);
  check('sending without picking a kind asks to pick one', await sp.evaluate(() => document.getElementById('repMsg').textContent === tr().repPick));
  await sp.click('#repKinds button:nth-child(1)'); await sp.fill('#repNote', 'the second camera is impossible\n to read'); await sp.click('#repSend'); await sp.waitForTimeout(500);
  const rep1 = DB.db.prepare('SELECT lvl, kind, note, test FROM blind_eye_reports').get();
  check('the report reaches the database (level, kind, a one-line note)', rep1 && rep1.lvl === 5 && rep1.kind === 'too_hard' && rep1.note === 'the second camera is impossible  to read' && rep1.test === 1, JSON.stringify(rep1));
  const aidv = await sp.evaluate(() => aid); let last = 200;
  for (let i = 0; i < 21; i++) last = (await sp.evaluate(async ([a]) => (await fetch('/api/blind-eye/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a, n: 3, k: 'bug' }) })).status, [aidv]));
  check('report spam is capped per player per day', last === 429, 'last status ' + last);
  const badKind = await call('POST', '/api/blind-eye/report', { a: aidv, n: 3, k: 'rm -rf' });
  check('an unknown report kind is refused', badKind.status === 400);
  // the private numbers: closed without a key, closed to a wrong key, open to the right one
  const getStats = (key, q) => ctx.request.get(base + '/api/blind-eye/stats' + (q || ''), { headers: key ? { Authorization: 'Bearer ' + key } : {} });
  check('stats are off when no key is set on the server', (await getStats('anything')).status() === 404);
  env.DUBIKO_STATS_KEY = 'secret-key';
  check('a wrong key is refused', (await getStats('nope')).status() === 401 && (await getStats(null)).status() === 401);
  const real = await (await getStats('secret-key', '?test=1')).json(), lv1 = real.levels.find(l => l.lvl === 1), real0 = await (await getStats('secret-key')).json();
  check('the right key gets per-level numbers, reports and notes (test traffic only when asked for)', lv1 && lv1.wins >= 1 && lv1.par >= 1 && real.overview.players >= 1 && real.reports.length >= 1 && real.notes.length === 1 && real0.levels.length === 0, JSON.stringify(lv1));

  // the private page itself
  const stp = await ctx.newPage(); stp.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await stp.goto(base + '/blind-eye-stats/'); await stp.fill('#key', 'secret-key'); await stp.check('#test'); await stp.click('#go'); await stp.waitForSelector('#out table', { timeout: 5000 });
  const sh = await stp.evaluate(() => ({ rows: document.querySelectorAll('#out table')[0].rows.length, notes: document.body.textContent.includes('the second camera'), kpi: document.querySelector('.kpi b').textContent }));
  check('the stats page loads with the key and lists levels, flags and player notes', sh.rows >= 2 && sh.notes && Number(sh.kpi) >= 1, JSON.stringify(sh));
  if (process.env.SHOT_DIR) await stp.screenshot({ path: process.env.SHOT_DIR + '/stats-page.png', fullPage: true });
  check('no page errors', errs.length === 0, errs.join(' | '));
  await b.close(); server.close(); process.exit(ok ? 0 : 1);
})();
