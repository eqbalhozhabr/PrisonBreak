/* ------------------------------------------------------------------------------------------------------------------ the game itself (replaces the lab's solver playback): taps, actions, walking, the alarm, the exit */
const LEVELS = window.PRISON_LEVELS.slice(0, 196);
let li = 0, dg = [], thiefCell = 0, hist = [], moves = 0, sel = -1, walking = null, alarm = null, exiting = null, gBusy = false, loadToken = 0, winShown = false, lastTip = '', tipKind = '';
const WALK_MS = 165;
const kindOfK = k => k < nCam() ? 'cam' : k < nCam() + nGd() ? 'guard' : k < dogBase() ? L.toggles[k - nCam() - nGd()].kind : k < lightBase() ? 'dog' : k < panelBase() ? 'light' : 'panel';
const nLt = () => (L.lights || []).length, nPn = () => (L.panels || []).length, nDg = () => (L.dogs || []).length;
const dogBase = () => nCam() + nGd() + nTg(), lightBase = () => dogBase() + nDg(), panelBase = () => lightBase() + nLt(), nAll = () => panelBase() + nPn();
const viewDg = () => alarm ? alarm.nd : dg;
const ev = d => { P.prepare(L); return P.evalConfig(L, d || dg, false); };
const evR = d => { P.prepare(L); return P.evalConfig(L, d || dg, true); };
const panelOf = k => { if (k >= dogBase()) return -1; const j = (L.panels || []).findIndex(p => p.links.includes(k)); return j < 0 ? -1 : panelBase() + j; };
function watcherCell(k) { return k < nCam() ? L.cams[k].c : k < nCam() + nGd() ? L.guards[k - nCam()].rail[dg[k] >> 1] : k < dogBase() ? L.toggles[k - nCam() - nGd()].c : k < lightBase() ? L.dogs[k - dogBase()].rail[dg[k]] : k < panelBase() ? L.lights[k - lightBase()].c : L.panels[k - panelBase()].c; }
function walkerRail(k) { return k < dogBase() ? { rail: L.guards[k - nCam()].rail, cur: dg[k] >> 1 } : { rail: L.dogs[k - dogBase()].rail, cur: dg[k] }; }
const dogHere = (d, c) => L.dogs.some((o, q) => o.rail[d[dogBase() + q]] === c);

/* the tip line under the title */
const TIPS = window.TIPS || {};
function setTip(t, cls) { lastTip = t; tipKind = cls || ''; const el = document.getElementById('tip'); if (el) { el.textContent = t; el.className = cls || ''; el.style.visibility = t ? 'visible' : 'hidden'; } }
const tipFor = id => TIPS[id] || '';

/* ---------------------------------------------------------------- actions (as in the main game) */
function options(k) {
  if (k >= panelBase()) { const d = P.panelApply(L, dg, k - panelBase()); return [{ kind: 'panel', dg: d ? P.sweep(L, d) : null }]; }
  if (k >= lightBase()) return [{ kind: 'wait', dg: P.sweep(L, dg) }];
  return options0(k).map(o => o.dg ? Object.assign({}, o, { dg: P.sweep(L, o.dg) }) : o);
}
function options0(k) {
  if (k < nCam()) return [{ kind: 'cam', dg: Object.assign(dg.slice(), { [k]: (dg[k] + 1) % 4 }) }];
  if (k < nCam() + nGd()) {
    const g = L.guards[k - nCam()], v = dg[k], i = v >> 1, f = v & 1, out = [];
    const blocked = ni => L.guards.some((o, q) => q !== k - nCam() && o.rail[dg[nCam() + q] >> 1] === g.rail[ni]);
    for (const s of [-1, 1]) { const ni = i + s; out.push({ kind: 'guardStep', dg: (ni >= 0 && ni < g.rail.length && !blocked(ni)) ? Object.assign(dg.slice(), { [k]: ni * 2 + (s === 1 ? 0 : 1) }) : null }); }
    out.push({ kind: 'turn', dg: Object.assign(dg.slice(), { [k]: i * 2 + (1 - f) }) });
    return out;
  }
  if (k >= dogBase()) {
    const j = k - dogBase(), o = L.dogs[j], i = dg[k], out = [];
    const taken = cell => L.guards.some((g, q) => g.rail[dg[nCam() + q] >> 1] === cell) || L.dogs.some((od, q) => q !== j && od.rail[dg[dogBase() + q]] === cell) ||
      L.toggles.some((t, q) => t.c === cell && (t.kind === 'mirror' || dg[nCam() + nGd() + q] === 1));
    for (const s of [-1, 1]) { const ni = i + s; out.push({ kind: 'dogStep', dg: (ni >= 0 && ni < o.rail.length && !taken(o.rail[ni])) ? Object.assign(dg.slice(), { [k]: ni }) : null }); }
    return out;
  }
  const t = L.toggles[k - nCam() - nGd()], stuck = t.kind === 'door' && dg[k] === 0 && dogHere(dg, t.c);
  return [{ kind: t.kind, dg: stuck ? null : Object.assign(dg.slice(), { [k]: 1 - dg[k] }) }];
}
function pushHist() { hist.push({ dg: dg.slice(), thiefCell, moves }); }
function startAlarm(nd) { alarm = { nd, t: 0 }; flash = 1; setTip('Spotted! That action was cancelled: move him to a dark tile first.', 'warn'); }
function endAlarm() { alarm = null; flash = 0; }
function tryAction(nd) {
  if (walking || exiting || alarm) return;
  if (!nd) { setTip('That cannot move right now.', 'warn'); return; }
  const e = ev(nd);
  if (e.occ[thiefCell]) { setTip('Not allowed: something would stand on the prisoner.', 'warn'); flash = 1; return; }
  if (e.lit[thiefCell]) return startAlarm(nd);
  pushHist(); dg = nd; moves++; setTip(''); syncGameUI();
}
function pathTo(target) {
  const e = ev(), n = L.w * L.h, cost = new Float64Array(n).fill(Infinity), prev = new Int16Array(n).fill(-2), open = [thiefCell]; cost[thiefCell] = 0; prev[thiefCell] = -1;
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (cost[open[i]] < cost[open[bi]]) bi = i;
    const c = open.splice(bi, 1)[0]; if (c === target) break; const x = c % L.w, y = (c / L.w) | 0;
    for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue; const m = ny * L.w + nx; if (L.wall[m] || e.occ[m] || e.lit[m]) continue; const c2 = cost[c] + 1; if (c2 < cost[m]) { cost[m] = c2; prev[m] = c; open.push(m); } }
  }
  if (prev[target] === -2) return null; const path = []; for (let c = target; c !== thiefCell; c = prev[c]) path.push(c); return path.reverse();
}
function walkTo(c) {
  if (exiting || alarm) return; const path = pathTo(c);
  if (!path) { setTip('The prisoner cannot get there from here.', 'warn'); flash = 1; return; }
  if (!path.length) return; pushHist(); setTip(''); walking = { path, t: 0 };
}
async function guardGoTo(k, cell) {
  const ti = walkerRail(k).rail.indexOf(cell); if (ti < 0 || gBusy) return; gBusy = true; const token = loadToken;
  try { for (let n = 0; n < 8; n++) { if (token !== loadToken) return; const cur = walkerRail(k).cur; if (cur === ti) break; const o = options(k)[ti > cur ? 1 : 0]; if (!o.dg) break; const before = moves; tryAction(o.dg); if (moves === before) break; await new Promise(r => setTimeout(r, 190)); } }
  finally { if (token === loadToken) { gBusy = false; sel = -1; setTip(''); } }
}
function undo() { if (walking || exiting || alarm || !hist.length) return; const h = hist.pop(); dg = h.dg; thiefCell = h.thiefCell; moves = h.moves; sel = -1; setTip(''); const c = thiefCell; thief = [c % W, (c / W) | 0]; syncGameUI(); }

/* ---------------------------------------------------------------- taps: what is under the finger (canvas pixels) */
function gadgetPoint(m, man, pivotRow) {                                                                // where a wall gadget's head sits on the canvas
  const ix = m.horiz ? 0 : (m.far ? 1 : -1), iy = m.horiz ? (m.far ? 1 : -1) : 0, [o1, o2] = projR(m.mx + ix * .1, m.my + iy * .1, Math.max(m.h - man.plate_top + 1, 0));
  return [o1 + (pivotRow ? pivotRow.pivot[0] : 0), o2 + (pivotRow ? pivotRow.pivot[1] : 0)];
}
function targets() {
  const out = [], push = (k, x, y, w0, w1, h0, h1) => out.push({ k, x0: x - w0, x1: x + w1, y0: y - h0, y1: y + h1, cx: x, cy: y - (h0 - h1) / 2 });
  for (let k = 0; k < nAll(); k++) {
    const kind = kindOfK(k);
    if (kind === 'guard') { const g = gdraw[k - nCam()], p = proj(g[0] + .5, g[1] + .5); push(k, p[0], p[1], 9, 9, 25, 2); }
    else if (kind === 'dog') { const j = k - dogBase(), p = railXY(L.dogs[j], ddraw[j]), q = proj(p[0] + .5, p[1] + .5); push(k, q[0], q[1], 11, 11, 16, 3); }
    else if (kind === 'cam' || kind === 'light') {
      const e = kind === 'cam' ? camEdge[k] : lightEdge[k - lightBase()]; if (!e) continue; const man = kind === 'cam' ? SP.cammount.man : SP.lightmount.man, dd = dgNow[kind === 'cam' ? k : k]; const row = man.rows.find(r => r.name === wallDirName(e)), p = gadgetPoint(e, man, row); push(k, p[0], p[1], 10, 10, 14, 4);
    } else if (kind === 'panel') { const pm = panelMount(L.panels[k - panelBase()].c); if (!pm) continue; const p = gadgetPoint(pm.e, SP.panel.man, null); push(k, p[0], p[1], 9, 9, 15, 4); }
    else if (kind === 'mirror') { const t = L.toggles[k - nCam() - nGd()], p = proj(t.c % W + .5, ((t.c / W) | 0) + .5, 6); push(k, p[0], p[1], 10, 10, 10, 10); }
    else if (kind === 'door') { const t = L.toggles[k - nCam() - nGd()], p = proj(t.c % W + .5, ((t.c / W) | 0) + .5, 5); push(k, p[0], p[1], 11, 11, 11, 9); }
  }
  return out;
}
function hitTest(x, y) {
  let best = null, bd = 1e9; for (const t of targets()) if (x >= t.x0 && x < t.x1 && y >= t.y0 && y < t.y1) { const d = Math.hypot(x - t.cx, y - t.cy); if (d < bd) { bd = d; best = t; } }
  if (best) return { watcher: best.k };
  const tp = proj(thief[0] + .5, thief[1] + .5); if (x >= tp[0] - 7 && x < tp[0] + 7 && y >= tp[1] - 22 && y < tp[1] + 3) return { thief: true };
  const [rx, ry] = unprojR(x, y), [X, Y] = unrot(rx, ry), cx = Math.floor(X), cy = Math.floor(Y);
  if (cx < 0 || cy < 0 || cx >= W || cy >= H) return null; return { cell: cy * W + cx };
}
function onTap(x, y) {
  const h = hitTest(x, y); if (!h) return;
  if (h.thief) { sel = -1; setTip(''); return; }
  if (h.watcher !== undefined) {
    const k = h.watcher, kind = kindOfK(k);
    if (kind === 'dog') { if (sel !== k) { sel = k; setTip('Dog selected: tap a tile of its rail to send it there, tap the prisoner to let go.'); } return; }
    if (kind === 'guard') { if (sel === k) { const o = options(k)[2]; tryAction(o.dg); } else { sel = k; setTip('Guard selected: tap it again to turn, tap a rail tile to send it, tap the prisoner to let go.'); } return; }
    const pn = panelOf(k); if (pn >= 0) { sel = pn; setTip('Wired things only change through their panel: tap the panel.'); return; }
    sel = k; const o = options(k)[0]; tryAction(o.dg); return;
  }
  if (sel >= nCam() && (sel < nCam() + nGd() || (sel >= dogBase() && sel < lightBase())) && walkerRail(sel).rail.includes(h.cell)) { guardGoTo(sel, h.cell); return; }
  if (L.glass && L.glass[h.cell]) { setTip('Glass: light goes through it, the prisoner cannot.', 'warn'); flash = 1; return; }
  if (!L.wall[h.cell]) walkTo(h.cell);
}

/* ---------------------------------------------------------------- the exit */
function startExit() { if (!door) { winGame(); return; } exiting = { t0: now }; sel = -1; }
function winGame() { if (winShown) return; winShown = true; showWin(); }

/* ---------------------------------------------------------------- per-frame animation state (the renderer reads these) */
function initAnim() {
  dgNow = viewDg().slice();
  gdraw = L.guards.map((g, j) => { const c = guardCell(j, dgNow); return [c % W, (c / W) | 0]; }); gdist = L.guards.map(() => 0);
  gface = L.guards.map((g, j) => Object.assign(faceOf(P.guardFacingDir(g, dgNow[L.cams.length + j] & 1)), { moving: false }));
  ddraw = (L.dogs || []).map((d, j) => dogDigit(j)); ddist = (L.dogs || []).map(() => 0); dmove = (L.dogs || []).map(() => false);
  dface = (L.dogs || []).map((d, j) => { const i = dogDigit(j), a = d.rail[Math.min(i + 1, d.rail.length - 1)], b = d.rail[i], p = d.rail[Math.max(i - 1, 0)]; const dx = (a % W) - (b % W) || ((b % W) - (p % W)), dy = ((a / W) | 0) - ((b / W) | 0) || (((b / W) | 0) - ((p / W) | 0)); return diagOf(dx || 1, dy); });
  doorO = (L.toggles || []).map((t, j) => t.kind === 'door' ? (doorDigit(j) === 1 ? 0 : 1) : 0); mirA = (L.toggles || []).map((t, j) => t.kind === 'mirror' ? doorDigit(j) : 0);
  thief = [thiefCell % W, (thiefCell / W) | 0]; thiefView = { view: 'S', flip: false }; thiefDist = 0; thiefMoving = false; thiefAlpha = 1; doorOpen = 0; flash = 0;
}
function loadGameLevel(i) {
  li = Math.max(0, Math.min(LEVELS.length - 1, i)); const lv = LEVELS[li]; L = P.parseLevel(lv.map, lv.meta); P.prepare(L); W = L.w; H = L.h;
  dg = P.initialDigits(L); cfgs = [dg.slice()]; thiefCell = L.S; hist = []; moves = 0; sel = -1; walking = null; alarm = null; exiting = null; gBusy = false; winShown = false; loadToken++;
  initAnim(); rebuild(); setTip(tipFor(lv.id) || 'Tap a dark tile to walk. Tap a camera to turn it clockwise.'); syncGameUI(); hideWin();
}
function advance(dt) {
  dgNow = viewDg();
  for (let j = 0; j < L.guards.length; j++) {
    const c = guardCell(j, dgNow), tx = c % W, ty = (c / W) | 0, g = gdraw[j], k = 1 - Math.pow(.001, dt / 450), ddx = (tx - g[0]) * k, ddy = (ty - g[1]) * k;
    g[0] += ddx; g[1] += ddy;
    if (Math.hypot(tx - g[0], ty - g[1]) > .06) { gdist[j] += Math.hypot(ddx, ddy); gface[j] = Object.assign(screenDir(tx - g[0], ty - g[1]), { moving: true }); }
    else gface[j] = Object.assign(faceOf(P.guardFacingDir(L.guards[j], dgNow[L.cams.length + j] & 1)), { moving: false });
  }
  (L.dogs || []).forEach((d, j) => { const t = dogDigit(j), cur = ddraw[j]; dmove[j] = false;
    if (Math.abs(t - cur) > .01) { const step = Math.min(Math.abs(t - cur), dt / 1000 * 4.5), dir = Math.sign(t - cur), a = railXY(d, cur); ddraw[j] = cur + dir * step; const b = railXY(d, ddraw[j]); ddist[j] += step; dmove[j] = true;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-4) dface[j] = diagOf(b[0] - a[0], b[1] - a[1]); } });
  (L.toggles || []).forEach((t, j) => { if (t.kind === 'mirror') mirA[j] += Math.sign(doorDigit(j) - mirA[j]) * Math.min(Math.abs(doorDigit(j) - mirA[j]), dt / 260); });
  (L.toggles || []).forEach((t, j) => { if (t.kind !== 'door') return; const want = doorDigit(j) === 1 ? 0 : 1; doorO[j] += Math.sign(want - doorO[j]) * Math.min(Math.abs(want - doorO[j]), dt / 320); });
  if (alarm) { alarm.t += dt; flash = 1; if (alarm.t > 900) endAlarm(); } else if (flash > 0) flash = Math.max(0, flash - dt / 260);
  // the prisoner: tile by tile, in between smoothly
  thiefMoving = false;
  if (walking) {
    walking.t += dt;
    while (walking && walking.t >= WALK_MS) { walking.t -= WALK_MS; const next = walking.path.shift(); thiefCell = next; if (!walking.path.length) { walking = null; if (thiefCell === L.E) startExit(); } }
    const cx = thiefCell % W, cy = (thiefCell / W) | 0;
    if (walking) { const n = walking.path[0], nx = n % W, ny = (n / W) | 0, f = walking.t / WALK_MS; thief = [cx + (nx - cx) * f, cy + (ny - cy) * f]; thiefView = screenDir(nx - cx, ny - cy); thiefMoving = true; thiefDist += dt / WALK_MS; } else thief = [cx, cy];
  } else if (!exiting) thief = [thiefCell % W, (thiefCell / W) | 0];
  if (exiting) {
    const t = now - exiting.t0, ex = L.E % W, ey = (L.E / W) | 0, dx = DX[door.d], dy = DY[door.d], p = clamp((t - 380) / 760, 0, 1); thiefView = screenDir(dx, dy);
    doorOpen = t < 380 ? t / 380 : t < 1250 ? 1 : Math.max(0, 1 - (t - 1250) / 350);
    thief = [ex + dx * .98 * p, ey + dy * .98 * p]; thiefMoving = p > 0 && p < 1; thiefDist += dt / WALK_MS; thiefAlpha = 1 - clamp((p - .5) / .45, 0, 1);
    if (t > 1650) { exiting = null; thiefAlpha = 0; doorOpen = 0; winGame(); }
  }
}
