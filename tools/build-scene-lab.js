/* Builds play/scene-lab.html (a style study, not shipped): tools/scene-lab.html with src/prison.js and play/levels.js inlined.   node tools/build-scene-lab.js */
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = rd('tools/scene-lab.html').replace('/*PRISON*/', () => rd('src/prison.js')).replace('/*LEVELS*/', () => rd('play/levels.js'));
fs.writeFileSync(path.join(root, 'play/scene-lab.html'), html); console.log('wrote play/scene-lab.html', html.length, 'bytes');
