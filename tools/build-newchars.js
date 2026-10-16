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
  newCache.set(key, c); return c;
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
  if (!html.includes('const sc = cs * .047,') || !html.includes('sc * 1.05')) throw new Error('scale anchors not found');
  html = html.replace('const sc = cs * .047,', () => 'const dprS = window.devicePixelRatio || 1, sc = Math.max(1, Math.round(cs * .047 * dprS)) / dprS,').replace('sc * 1.05', 'sc');      // whole device pixels per sprite pixel: crisp, no uneven pixels
  if (!html.includes('function person(kind, dir, frame) {') || !html.includes('function dogSprite(frame) {') || !html.includes('const sprites = new Map();')) throw new Error('anchors not found');
  return html.replace('function person(kind, dir, frame) {', 'function personOld(kind, dir, frame) {').replace('function dogSprite(frame) {', 'function dogSpriteOld(frame) {').replace('const sprites = new Map();', () => 'const sprites = new Map();' + inject);
}
for (const [src, out] of [['play/prisonbreak.html', 'play/prisonbreak-newchars.html'], ['play/artifact.html', 'play/artifact-newchars.html']]) { fs.writeFileSync(path.join(root, out), patch(rd(src))); console.log('wrote', out); }
