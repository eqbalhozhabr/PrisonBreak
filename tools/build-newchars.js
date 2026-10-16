/* Builds play/prisonbreak-newchars.html and play/artifact-newchars.html: the ORIGINAL game (play/prisonbreak.html and play/artifact.html, unchanged) with the owner's new
   characters (art/thief, art/guard, art/dog) instead of the code-drawn people and dog. A test of how the new characters feel in the first version's look; nothing else changes.
   node tools/build-newchars.js */
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const sheet = (dir, file) => ({ png: 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'art', dir, file + '.png')).toString('base64'), man: JSON.parse(rd(`art/${dir}/${file}.json`)) });
const NEW = { thief: sheet('thief', 'thief'), guard: sheet('guard', 'guard'), dog: sheet('dog', 'dog_half') };
const inject = `
/* ---- the owner's character sheets (art/thief, art/guard, art/dog): they replace person() and dogSprite() below ---- */
const NEWCH = ${JSON.stringify(NEW)};
const newImgs = {}; for (const k of Object.keys(NEWCH)) { const im = new Image(); im.src = NEWCH[k].png; newImgs[k] = im; }
const newCache = new Map();
function newFrame(kind, view, anim, k) {
  const sp = NEWCH[kind], img = newImgs[kind]; if (!img.complete || !img.naturalWidth) return null;
  const row = sp.man.rows.find(r => r.name === anim + '_' + view); if (!row) return null; const key = kind + view + anim + (k % row.frames), hit = newCache.get(key); if (hit) return hit;
  const [cw, ch] = sp.man.cell, gy = sp.man.anchor[1] + 1, c = document.createElement('canvas'); c.width = cw; c.height = gy; c.getContext('2d').drawImage(img, (k % row.frames) * cw, row.row * ch, cw, gy, 0, 0, cw, gy);
  if (LCD) lcdTone(c, kind);
  newCache.set(key, c); return c;
}
/* the olive-screen look ('lcd'): the characters are drawn in the screen's own inks: black for the dark parts, a mid green-grey for the middle tones (hair, uniform, fur), the pale paper tone
   for the light parts (stripes, skin), pink for the reds, amber for the gold. The game's own faint shadow (to the lower right) is added by drawSprite. */
/* the prisoner: the sheet's thin white-and-black stripes turned the figure into a walking skeleton on the olive screen. So the body is closed into a solid silhouette (gaps between the limbs
   filled) and striped evenly: one ink line in every three rows over the pale tone. The head keeps its own colours: pink hair (the player's accent, like the red beams), pale skin. */
function thiefTone(c) {
  const w = c.width, h = c.height, g = c.getContext('2d'), id = g.getImageData(0, 0, w, h), d = id.data, INK = [20, 22, 20], LIGHT = [226, 230, 198], PINK = [208, 48, 56];
  const has = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0, put = (i, o) => { d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255; }, body = y => y % 3 === 1 ? INK : LIGHT, gaps = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (!d[i + 3]) { if ((has(x - 1, y) && has(x + 1, y)) || (has(x, y - 1) && has(x, y + 1))) gaps.push(i); continue; }
    const r = d[i], gg = d[i + 1], b = d[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn) / mx : 0, L = (.299 * r + .587 * gg + .114 * b) / 255;
    let hu = 0; if (mx !== mn) { if (mx === r) hu = ((gg - b) / (mx - mn) + 6) % 6; else if (mx === gg) hu = (b - r) / (mx - mn) + 2; else hu = (r - gg) / (mx - mn) + 4; hu *= 60; }
    if (sat > .3 && mx > 110) put(i, sat > .45 && (hu < 32 || hu > 340) ? PINK : L > .5 ? LIGHT : PINK); else put(i, body(y));
  }
  for (const i of gaps) put(i, body((i >> 2) / w | 0));
  g.putImageData(id, 0, 0);
}
function lcdTone(c, kind) {
  if (kind === 'thief') return thiefTone(c);
  const g = c.getContext('2d'), id = g.getImageData(0, 0, c.width, c.height), d = id.data, INK = [20, 22, 20], MID = [92, 100, 90], PAPER = [172, 178, 152], PINK = [208, 48, 56], AMBER = [208, 166, 84];
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue; const r = d[i], gg = d[i + 1], b = d[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn) / mx : 0, L = (.299 * r + .587 * gg + .114 * b) / 255;
    let h = 0; if (mx !== mn) { if (mx === r) h = ((gg - b) / (mx - mn) + 6) % 6; else if (mx === gg) h = (b - r) / (mx - mn) + 2; else h = (r - gg) / (mx - mn) + 4; h *= 60; }
    const T = kind === 'thief' ? { paper: .6, mid: 9 } : kind === 'guard' ? { paper: .55, mid: .15 } : { paper: .7, mid: .2 };            // the prisoner is only ink and paper (stripes); the guard's uniform and the dog's fur get the middle tone
    let o; if (sat > .7 && mx > 150 && (h < 14 || h > 340)) o = PINK; else if (sat > .5 && mx > 170 && h >= 28 && h < 55) o = AMBER; else if (L > T.paper) o = PAPER; else if (L > T.mid) o = MID; else o = INK;
    d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
  }
  g.putImageData(id, 0, 0);
}
const newRow = (kind, name) => NEWCH[kind].man.rows.find(r => r.name === name);
function person(kind, dir, frame) {                                    // dir: 0 away, 1 side (right; the caller mirrors it for left), 2 toward us. frame 0 stands, 1 and 2 walk
  const view = dir === 0 ? 'N' : dir === 1 ? 'E' : 'S', t = performance.now(), moving = frame > 0, r = newRow(kind, (moving ? 'walk_' : 'idle_') + view);
  return (r && newFrame(kind, view, moving ? 'walk' : 'idle', Math.floor(t / (moving ? 110 : r.ms)) % 4)) || personOld(kind, dir, frame);
}
function dogSprite(frame) {                                            // the sheet's SE view faces right and toward us; the caller mirrors it for left
  const t = performance.now(), moving = frame > 0, r = newRow('dog', (moving ? 'walk_' : 'idle_') + 'SE');
  return (r && newFrame('dog', 'SE', moving ? 'walk' : 'idle', Math.floor(t / (moving ? 115 : r.ms)) % 4)) || dogSpriteOld(frame);
}
`;
function patch(html) {
  html = html.replace('ctx.translate(cx + scale * 2.2, footY + scale * 1.6)', 'ctx.translate(cx + scale * 1.1, footY + scale * .8)').replace('ctx.globalAlpha = a0 * .28;', 'ctx.globalAlpha = a0 * .24;');      // the olive-screen shadow: closer and fainter, the new characters are slim
  if (!html.includes('const sc = cs * .047,') || !html.includes('sc * 1.05')) throw new Error('scale anchors not found');
  html = html.replace('const sc = cs * .047,', () => 'const dprS = window.devicePixelRatio || 1, sc = Math.max(1, Math.round(cs * .047 * dprS)) / dprS,').replace('sc * 1.05', 'sc');      // whole device pixels per sprite pixel: crisp, no uneven pixels
  if (!html.includes('function person(kind, dir, frame) {') || !html.includes('function dogSprite(frame) {') || !html.includes('const sprites = new Map();')) throw new Error('anchors not found');
  return html.replace('function person(kind, dir, frame) {', 'function personOld(kind, dir, frame) {').replace('function dogSprite(frame) {', 'function dogSpriteOld(frame) {').replace('const sprites = new Map();', () => 'const sprites = new Map();' + inject);
}
for (const [src, out] of [['play/prisonbreak.html', 'play/prisonbreak-newchars.html'], ['play/artifact.html', 'play/artifact-newchars.html'], ['play/blind-eye-lcd.html', 'play/blind-eye-lcd-newchars.html']]) { fs.writeFileSync(path.join(root, out), patch(rd(src))); console.log('wrote', out); }
{ const h = fs.readFileSync(path.join(root, 'play/blind-eye-lcd-newchars.html'), 'utf8'), title = h.match(/<title>[\s\S]*?<\/title>/)[0], style = h.match(/<style>[\s\S]*?<\/style>/)[0], body = h.match(/<body>([\s\S]*)<\/body>/)[1];       // a fragment for the Artifact tool
  fs.writeFileSync(path.join(root, 'play/artifact-lcd-newchars.html'), title + '\n' + style + '\n' + body); console.log('wrote play/artifact-lcd-newchars.html'); }
