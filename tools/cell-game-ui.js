/*CONTROLS-BEGIN*/
/* ------------------------------------------------------------------------------------------------------------------ the page around the canvas: bars, the win card, the level list, input */
const $g = id => document.getElementById(id);
function syncUI() { }                                                                       // (the lab's toolbar hook; the game has its own bars)
let freeze = false; st.auto = false; st.rot = 0; UI_PAD = 150; VIGNETTE = false;
const save = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
let best = save.get('cg_best', {});
const parOf = () => LEVELS[li].par || 0;
function syncGameUI() {
  $g('title').textContent = `Level ${LEVELS[li].id}`; $g('moves').innerHTML = `Moves <b>${moves}</b>` + (parOf() ? ` <span>par ${parOf()}</span>` : '');
  $g('undo').disabled = !hist.length || !!walking || !!exiting || !!alarm;
}
function showWin() {
  const id = LEVELS[li].id, par = parOf(), stars = !par || moves <= par ? 3 : moves <= par + 2 ? 2 : 1, b = best[id];
  if (!b || stars > b.stars || (stars === b.stars && moves < b.moves)) { best[id] = { stars, moves }; save.set('cg_best', best); }
  $g('winTitle').textContent = 'Escaped!'; $g('winStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars); $g('winInfo').textContent = `${moves} moves` + (par ? ` · par ${par}` : '');
  $g('next').style.display = li < LEVELS.length - 1 && li < 19 ? '' : 'none'; $g('winOv').classList.add('on'); buildLevelGrid();
}
function hideWin() { $g('winOv').classList.remove('on'); }
function buildLevelGrid() {
  const g = $g('grid'); g.innerHTML = '';
  for (let i = 0; i < 20; i++) { const b = document.createElement('button'), r = best[LEVELS[i].id]; b.className = 'lv' + (i === li ? ' cur' : '') + (r ? ' done' : ''); b.innerHTML = `<b>${LEVELS[i].id}</b><i>${r ? '★'.repeat(r.stars) : ''}</i>`; b.onclick = () => { $g('lvOv').classList.remove('on'); loadGameLevel(i); save.set('cg_last', i); }; g.appendChild(b); }
}
$g('undo').onclick = undo;
$g('restart').onclick = () => loadGameLevel(li);
$g('toExit').onclick = () => { if (!walking && !alarm && !exiting) walkTo(L.E); };
$g('menu').onclick = () => { buildLevelGrid(); $g('lvOv').classList.add('on'); };
$g('lvClose').onclick = () => $g('lvOv').classList.remove('on');
$g('next').onclick = () => { loadGameLevel(li + 1); save.set('cg_last', li); };
$g('again').onclick = () => loadGameLevel(li);
$g('winLevels').onclick = () => { hideWin(); $g('menu').click(); };
cv.addEventListener('pointerdown', e => {
  if (document.querySelector('.ov.on') || walking || gBusy || exiting || alarm) return;
  const r = cv.getBoundingClientRect(); onTap((e.clientX - r.left) * (LW / r.width), (e.clientY - r.top) * (LH / r.height)); syncGameUI();
});
addEventListener('keydown', e => {
  if (document.querySelector('.ov.on')) return;
  if (e.key === 'Backspace') { e.preventDefault(); undo(); return; }
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!walking && !alarm && !exiting) walkTo(L.E); return; }
  const m = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[e.key]; if (m === undefined || walking || alarm || exiting) return; e.preventDefault();
  const x = thiefCell % L.w + DX[m], y = ((thiefCell / L.w) | 0) + DY[m]; if (x >= 0 && y >= 0 && x < L.w && y < L.h) walkTo(y * L.w + x);
});
addEventListener('resize', () => { layout(); buildFloor(); });
/* selection marks, drawn over the finished picture: the selected guard or dog and the tiles of its rail */
function overlayHook(t) {
  if (sel < 0 || sel >= panelBase() || !isIso()) return;
  const kind = kindOfK(sel); ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1;
  if (kind === 'guard' || kind === 'dog') {
    const rail = walkerRail(sel).rail; ctx.setLineDash([2, 2]);
    for (const c of rail) { const x = c % W, y = (c / W) | 0, p = cellPoly(x, y); ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.stroke(); }
    ctx.setLineDash([]); const c = watcherCell(sel), x = c % W, y = (c / W) | 0, p = cellPoly(x, y); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,214,90,${.7 + .3 * Math.sin(t / 160)})`; ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}
function boot() {
  const qid = +(new URLSearchParams(location.search).get('level') || 0), idx = qid ? Math.max(0, LEVELS.findIndex(l => l.id === qid)) : Math.min(19, save.get('cg_last', 0));
  loadGameLevel(idx); requestAnimationFrame(frame);
}
Promise.all(Object.values(sheets).map(i => i.complete ? 0 : new Promise(r => i.onload = r))).then(boot);
window.game = { load: i => loadGameLevel(i), tap: (x, y) => { onTap(x, y); syncGameUI(); }, state: () => ({ li, moves, thiefCell, dg: dg.slice(), won: winShown, walking: !!walking, alarm: !!alarm, exiting: !!exiting, W, H, LW, LH }), frame, cellScreen: c => proj(c % W + .5, ((c / W) | 0) + .5), L: () => L, watchers: () => targets().map(t => ({ k: t.k, x: t.cx, y: t.cy })), undo, walkTo, options, tryAction, setNow: () => 0 };
