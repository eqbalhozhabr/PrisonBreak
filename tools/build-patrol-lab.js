/* Builds play/patrol-lab.html (and play/artifact-patrol-lab.html, the same page as a fragment for the Artifact tool) from tools/patrol-lab.html,
   src/patrol.js and the levels in tools/patrol-levels.js (each solved exactly here, so the page does not have to).   node tools/build-patrol-lab.js */
'use strict';
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const Pt = require('../src/patrol.js'), specs = require('./patrol-levels.js');
const LV = specs.map(sp => {
  const L = Pt.parse(sp), r = Pt.solve(L, { maxTicks: 90, maxStates: 3e6 });
  if (!r.solvable) throw new Error('level ' + sp.id + ' has no safe plan');
  const spec = JSON.parse(JSON.stringify(sp)); for (const k of ['noCams', 'keepGuards', 'forceCam']) delete spec[k];
  return { id: sp.id, name: sp.name, par: r.par, free: Pt.freeWalk(L), spec };
});
let html = rd('tools/patrol-lab.html');
const put = (tag, code) => { if (!html.includes(tag)) throw new Error('missing ' + tag); html = html.replace(tag, () => code); };
put('/*PATROL*/', rd('src/patrol.js')); put('/*LEVELS*/', JSON.stringify(LV));
fs.writeFileSync(path.join(root, 'play/patrol-lab.html'), html);
const title = html.match(/<title>[\s\S]*?<\/title>/)[0], style = html.match(/<style>[\s\S]*?<\/style>/)[0], body = html.match(/<body>([\s\S]*)<\/body>/)[1];
fs.writeFileSync(path.join(root, 'play/artifact-patrol-lab.html'), title + '\n<meta name="claude:viewport-fit-sides" content="cover">\n' + style + '\n' + body);
console.log('wrote play/patrol-lab.html', { levels: LV.map(l => `${l.id}:${l.par}/${l.free}`).join(' '), kb: Math.round(html.length / 1024) });
