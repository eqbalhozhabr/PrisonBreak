/* Draws the three CrazyGames cover images from the game's own pixel sprites (camera, prisoner) and its pixel font, at an exact integer scale so every
   pixel stays crisp.  usage: PLAYWRIGHT_MODULE=... node tools/media/make-covers.js [outdir]    (needs dist-crazygames/index.html: run tools/package-portal.js first)
   Rules from the playbook: landscape 1920x1080, portrait 800x1200, square 800x800; only the game title as text; no border; nothing important in the top-left
   "labels" zone (landscape 764x216, portrait 320x120, square 280x240 px). */
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const COVERS = [
  { name: 'cover-landscape-1920x1080', W: 1920, H: 1080, S: 4, cam: [318, 22, 5], floor: 212, thief: [118, 208], tit: { x: 326, y: 104, size: 24, gap: 6 }, beamTo: [150, 244] },
  { name: 'cover-portrait-800x1200', W: 800, H: 1200, S: 4, cam: [118, 18, 5], floor: 178, thief: [58, 184], tit: { x: 28, y: 226, size: 24, gap: 6, center: true }, beamTo: [60, 120] },
  { name: 'cover-square-800x800', W: 800, H: 800, S: 4, cam: [122, 12, 4], floor: 142, thief: [56, 146], tit: { x: 20, y: 156, size: 16, gap: 4, one: true, center: true }, beamTo: [64, 110] },
];
(async () => {
  const out = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'releases', 'crazygames'));
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const c of COVERS) {
    const pg = await b.newPage({ viewport: { width: c.W, height: c.H }, deviceScaleFactor: 1 });
    await pg.goto('file://' + path.join(__dirname, '..', '..', 'dist-crazygames', 'index.html')); await pg.waitForTimeout(400);
    await pg.evaluate(async c => {
      await document.fonts.load("24px 'Press Start 2P'"); await document.fonts.ready;
      document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#000';
      const cv = document.createElement('canvas'); cv.width = c.W / c.S; cv.height = c.H / c.S; cv.style.cssText = `width:${c.W}px;height:${c.H}px;image-rendering:pixelated;display:block;position:fixed;left:0;top:0`;
      document.body.appendChild(cv); const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; const w = cv.width, h = cv.height;
      // brick wall
      g.fillStyle = '#121723'; g.fillRect(0, 0, w, h); const bw = 12, bh = 6;
      for (let r = 0; r * bh < h; r++) for (let k = -1; k * bw < w + bw; k++) { const x = k * bw + (r % 2 ? bw / 2 : 0), y = r * bh, q = hash(k + 7, r, 3); g.fillStyle = q < .3 ? '#1d2433' : q < .7 ? '#1a2130' : '#202839'; g.fillRect(x + 1, y + 1, bw - 1, bh - 1); g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x + 1, y + 1, bw - 1, 1); }
      // floor
      const fy = c.floor; g.fillStyle = '#2a3142'; g.fillRect(0, fy, w, h - fy); g.fillStyle = '#3a4560'; g.fillRect(0, fy, w, 1); g.fillStyle = '#0d1017'; g.fillRect(0, fy - 1, w, 1);
      for (let y = fy + 8; y < h; y += 16) for (let x = ((y / 16) | 0) % 2 ? 7 : 0; x < w; x += 14) { g.fillStyle = '#232a3b'; g.fillRect(x, y, 7, 1); }
      // the camera on the wall and its beam
      const [cx, cy, cs] = c.cam, sp = camSprite(1), cw = 14 * cs, ch = 12 * cs, lensX = cx + 10.5 * cs, lensY = cy + 5 * cs;
      const [tx, ty] = c.beamTo; g.fillStyle = 'rgba(255,59,82,.30)'; g.beginPath(); g.moveTo(lensX, lensY); g.lineTo(tx - 46, fy + (h - fy) * .86); g.lineTo(tx + 46, fy + (h - fy) * .86); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,59,82,.16)'; g.beginPath(); g.ellipse(tx, fy + (h - fy) * .86, 54, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#232b3d'; g.fillRect(cx - 4 * cs, cy - 6, 5 * cs, ch + 12);                                    // the wall plate it hangs on
      g.drawImage(sp, cx, cy, cw, ch);
      // the prisoner stands in the dark, just outside the light, mid-step
      const th = person('thief', 1, 1), s2 = 4; g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(c.thief[0], c.thief[1] + 1, 20, 5, 0, 0, 7); g.fill();
      g.drawImage(th, c.thief[0] - th.width * s2 / 2, c.thief[1] - (th.height - 1) * s2, th.width * s2, th.height * s2);
      // title: the only text. Two lines (BLIND / EYE) or one line, with a hard pixel shadow
      const T = c.tit; g.font = `${T.size}px 'Press Start 2P'`; g.textBaseline = 'top'; g.textAlign = T.center ? 'center' : 'left';
      const line = (txt, x, y, col) => { g.fillStyle = '#16101f'; g.fillText(txt, x + 2, y + 2); g.fillStyle = col; g.fillText(txt, x, y); };
      if (T.one) { const full = 'BLIND EYE', wd = g.measureText(full).width, x0 = Math.round((w - wd) / 2); g.textAlign = 'left'; line('BLIND ', x0, T.y, '#e8ecf4'); line('EYE', x0 + g.measureText('BLIND ').width, T.y, '#ff3b52'); }
      else { const x = T.center ? Math.round(w / 2) : T.x; line('BLIND', x, T.y, '#e8ecf4'); line('EYE', x, T.y + T.size + T.gap, '#ff3b52'); }
      // a dark edge fade keeps the corners calm
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .45, w / 2, h / 2, Math.max(w, h) * .8); vg.addColorStop(0, 'rgba(6,8,13,0)'); vg.addColorStop(1, 'rgba(6,8,13,.55)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    }, c);
    await pg.waitForTimeout(150); await pg.screenshot({ path: path.join(out, c.name + '.png') }); await pg.close(); console.log('wrote', c.name + '.png');
  }
  await b.close();
})();
