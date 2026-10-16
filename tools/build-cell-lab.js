/* Builds play/cell-lab.html (an environment study, not shipped): tools/cell-lab.html with src/prison.js, play/levels.js and the character sprite sheets (art/thief, art/guard) inlined.   node tools/build-cell-lab.js */
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const sprites = {};
const add = (key, dir, file) => { sprites[key] = { png: 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'art', dir, file + '.png')).toString('base64'), man: JSON.parse(rd(`art/${dir}/${file}.json`)) }; };
add('thief', 'thief', 'thief'); add('guard', 'guard', 'guard'); add('camera', 'camera', 'camera'); add('light', 'searchlight', 'searchlight'); add('panel', 'panel', 'panel'); add('dog', 'dog', 'dog_half'); add('dogfull', 'dog', 'dog');
const html = rd('tools/cell-lab.html').replace('/*PRISON*/', () => rd('src/prison.js')).replace('/*LEVELS*/', () => rd('play/levels.js')).replace('/*SPRITES*/', () => 'window.SPRITES=' + JSON.stringify(sprites) + ';');
fs.writeFileSync(path.join(root, 'play/cell-lab.html'), html); console.log('wrote play/cell-lab.html', html.length, 'bytes');
