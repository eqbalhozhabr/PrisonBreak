/* Builds play/stealth-lab.html (and play/artifact-stealth-lab.html, the same page as a fragment for the Artifact tool) from tools/stealth-lab.html,
   the two rule files and the level data: play/stealth-tests.json (tools/gen-stealth-tests.js) and play/stealth-levels.js (tools/make-stealth-levels.js).
   node tools/build-stealth-lab.js */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
global.window = {}; vm.runInThisContext(rd('play/stealth-levels.js'));
const tests = JSON.parse(rd('play/stealth-tests.json')).found, LV = [];
const KIND = { crawl: 'crawling pays', lure: 'a lure pays', both: 'crawl + lure' };
let n = 0;
for (const kind of ['crawl', 'lure', 'both']) for (const t of tests[kind]) { n++; LV.push({ tag: 'T', id: n, label: `Test ${n} · ${KIND[kind]}`, short: 'T' + n, map: t.map, meta: t.meta, par: t.par, classicPar: t.classicPar, stealth: t.stealth }); }
for (const l of window.STEALTH_LEVELS) LV.push({ tag: 'C', id: l.id, label: 'Level ' + l.id, short: String(l.id), map: l.map, meta: l.meta, par: l.par, classicPar: l.classicPar, stealth: l.stealth, mark: l.stealth.lures ? '✦' : l.par < l.classicPar ? '↓' : '' });
let html = rd('tools/stealth-lab.html');
const put = (tag, code) => { if (!html.includes(tag)) throw new Error('missing ' + tag); html = html.replace(tag, () => code); };
put('/*PRISON*/', rd('src/prison.js')); put('/*STEALTH*/', rd('src/stealth.js')); put('/*LEVELS*/', JSON.stringify(LV));
fs.writeFileSync(path.join(root, 'play/stealth-lab.html'), html);
const title = html.match(/<title>[\s\S]*?<\/title>/)[0], style = html.match(/<style>[\s\S]*?<\/style>/)[0], body = html.match(/<body>([\s\S]*)<\/body>/)[1];
fs.writeFileSync(path.join(root, 'play/artifact-stealth-lab.html'), title + '\n<meta name="claude:viewport-fit-sides" content="cover">\n' + style + '\n' + body);
console.log('wrote play/stealth-lab.html', { tests: n, levels: window.STEALTH_LEVELS.length, kb: Math.round(html.length / 1024) });
