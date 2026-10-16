/* Builds play/cell-game.html (a playable preview of the first 20 levels in the new look; not part of the shipped game):
   the renderer comes from tools/cell-lab.html, its solver playback and controls are replaced by the game logic (tools/cell-game-logic.js) and the page UI (tools/cell-game-ui.js).   node tools/build-cell-game.js */
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const sprites = {};
const add = (key, dir, file) => { sprites[key] = { png: 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'art', dir, file + '.png')).toString('base64'), man: JSON.parse(rd(`art/${dir}/${file}.json`)) }; };
add('thief', 'thief', 'thief'); add('guard', 'guard', 'guard'); add('camera', 'camera', 'camera_head'); add('cammount', 'camera', 'camera_mount'); add('light', 'searchlight', 'searchlight_head'); add('lightmount', 'searchlight', 'searchlight_mount'); add('panel', 'panel', 'panel'); add('dog', 'dog', 'dog_half'); add('dogfull', 'dog', 'dog');
const lab = rd('tools/cell-lab.html'), m = lab.match(/<script>\n'use strict';[\s\S]*<\/script><\/body><\/html>\s*$/); if (!m) throw new Error('lab script not found');
let code = m[0].replace(/^<script>\n/, '').replace(/<\/script><\/body><\/html>\s*$/, '');
const a = code.indexOf('/*PLAYBACK-BEGIN*/'), b = code.indexOf('/*PLAYBACK-END*/') + '/*PLAYBACK-END*/'.length, c = code.indexOf('/*CONTROLS-BEGIN*/');
if (a < 0 || b < a || c < b) throw new Error('markers missing');
code = code.slice(0, a) + rd('tools/cell-game-logic.js') + code.slice(b, c) + rd('tools/cell-game-ui.js');
code = code.replace("const LV = window.PRISON_LEVELS,", "const LV = window.PRISON_LEVELS,");
const tips = { 1: 'Cameras throw red light, and the prisoner must stay out of it: red tiles are lit, a blinking lens means the camera is watching. Tap the camera to turn its head, then send the prisoner to the exit door.',
  2: 'A camera only turns clockwise, so turning it left takes three taps. Walking costs nothing; only actions are counted.',
  4: 'Move the prisoner to a dark tile before you turn a camera onto the tile he stands on.',
  7: 'New: guards walk their rail, facing the way they go. Tap to select, tap again to turn, tap a rail tile to send it there. It sees 3 tiles ahead and is blind behind.',
  11: 'Walls and guards stop sight. Park a guard in front of a camera to use it as a shield.' };
const font = 'data:font/ttf;base64,' + fs.readFileSync(path.join(root, 'play/fonts/silkscreen-700.ttf')).toString('base64');
const html = rd('tools/cell-game.html').replace('url(fonts/silkscreen-700.ttf)', () => 'url(' + font + ')').replace('/*PRISON*/', () => rd('src/prison.js')).replace('/*LEVELS*/', () => rd('play/levels.js')).replace('/*SPRITES*/', () => 'window.SPRITES=' + JSON.stringify(sprites) + ';').replace('/*TIPS*/', () => JSON.stringify(tips)).replace('/*RENDER*/', () => code);
fs.writeFileSync(path.join(root, 'play/cell-game.html'), html); console.log('wrote play/cell-game.html', html.length, 'bytes');
