/* End-to-end test of accounts and progress sync, against the REAL Worker handlers of the website (SITE_DIR, default ../luckylion-website)
   with an in-memory SQLite standing in for D1, and the real game page in a real browser.
   usage: SITE_DIR=/path/to/luckylion-website PLAYWRIGHT_MODULE=/path/to/playwright node tools/e2e-account.js
   Nothing is mocked in the game; the e-mail step is covered by the dev link the Worker returns when RESEND_API_KEY is not set. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { pathToFileURL } = require('url');
const SITE = process.env.SITE_DIR || path.join(__dirname, '..', '..', 'luckylion-website');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

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
  const [auth, progress] = await Promise.all(['routes/auth.js', 'routes/blindeye.js'].map(f => import(pathToFileURL(path.join(SITE, 'worker', f)).href)));
  const DB = new FakeD1(); DB.db.exec(fs.readFileSync(path.join(SITE, 'migrations', '0001_init.sql'), 'utf8'));
  const env = { DB };
  const ROUTES = { 'POST /api/auth/request-link': auth.requestLink, 'GET /api/auth/verify': auth.verify, 'GET /api/auth/me': auth.me, 'POST /api/auth/username': auth.setUsername,
    'POST /api/auth/logout': auth.logout, 'GET /api/blind-eye/progress': progress.getProgress, 'POST /api/blind-eye/progress': progress.saveProgress };
  const page = fs.readFileSync(path.join(__dirname, '..', 'play', 'prisonbreak.html'));
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost:' + server.address().port);
    if (url.pathname === '/blind-eye/' || url.pathname === '/blind-eye') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(page); }
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
  await pg.goto(link); await pg.waitForTimeout(900);
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
  await pg2.goto(base + '/api/auth/verify?token=' + tok2 + '&next=%2Fblind-eye%2F');
  await pg2.waitForTimeout(900);
  check('after signing in on the new device the progress is back', await pg2.evaluate(() => acct.loggedIn && best[1] && best[1].stars === 3));

  // 4. the server never lowers progress
  const low = await call('POST', '/api/blind-eye/progress', { progress: { best: { 1: { stars: 1, moves: 9 }, 2: { stars: 2, moves: 5 } }, intro: {}, last: 3 } });
  check('an older, worse save does not lower a level but adds new ones', low.j && low.j.progress.best['1'].stars === 3 && low.j.progress.best['2'].stars === 2);
  const junk = await call('POST', '/api/blind-eye/progress', { progress: { best: { 9999: { stars: 3, moves: 1 }, 3: { stars: 7, moves: 1 }, x: 1 }, intro: { '<b>': 1 }, last: -4 } });
  check('invalid levels, stars and names are dropped', junk.j && !junk.j.progress.best['9999'] && !junk.j.progress.best['3'] && Object.keys(junk.j.progress.intro).every(k => /^[a-z]+$/.test(k)));
  const foreign = (await ctx.request.post(base + '/api/blind-eye/progress', { headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, data: { progress: { best: {}, intro: {}, last: 0 } } })).status();
  check('a save from another origin is refused even with a valid session cookie', foreign === 403, 'status ' + foreign);

  // 5. username, sign out
  await pg.evaluate(() => toMenu()); await pg.click('#mAccount'); await pg.fill('#accName', 'Sneaky_Cat'); await pg.click('#accNameSave'); await pg.waitForTimeout(400);
  check('username saved and shown on the menu button', await pg.evaluate(() => acct.username === 'Sneaky_Cat' && document.getElementById('mAccount').textContent.includes('Sneaky_Cat')));
  await pg.click('#accLogout'); await pg.waitForTimeout(300);
  check('signed out: closed again', !(await pg.evaluate(() => acct.loggedIn)) && (await call('GET', '/api/blind-eye/progress')).status === 401);

  check('no page errors', errs.length === 0, errs.join(' | '));
  await b.close(); server.close(); process.exit(ok ? 0 : 1);
})();
