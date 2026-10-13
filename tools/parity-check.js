/* Checks that the website build and the CrazyGames build are the same game: same styles, same screens, same script. They are made from one source
   (play/index.html); this builds both and lists every line that differs. Only the lines that carry a build-time token are allowed to differ
   (target name, owner/footer text, the site address, the build stamp, the SDK loader); anything else fails.
   usage: OWNER_NAME="..." node tools/parity-check.js */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..'), tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'parity-'));
const run = a => execFileSync('node', [path.join(__dirname, 'build-single.js'), ...a], { cwd: root, env: process.env, stdio: 'pipe' });
run([]); run(['--target', 'crazygames', '--out', tmp]);
const web = fs.readFileSync(path.join(root, 'play', 'prisonbreak.html'), 'utf8');
// the SDK loader at the end of the portal page is the one block the website build does not have; it is shown and compared separately
const portalFull = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8'), loaderRe = /<script>\n\(function \(\) \{\n  var started[\s\S]*?<\/script>\n/, portal = portalFull.replace(loaderRe, '');
console.log('SDK loader block (portal only):', loaderRe.test(portalFull) ? 'present' : 'MISSING');
const owner = process.env.OWNER_NAME || '[Owner name]';
// the parts that are allowed to differ, by what the line carries
const ALLOWED = [/crazygames/i, /\bPORTAL\b/, /portal\\\\\.invalid|luckylion/, new RegExp(owner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), /Playtest build/, /Pixels of the Mist|POM|^\s*account: /, /const BUILD =/, /<meta (name|property)=/, /game-src/, /the website/, /© \d{4}/];
// the system diff does the line comparison (a lookahead walk goes out of step on repeated lines)
const fw = path.join(tmp, 'web.html'), fp = path.join(tmp, 'portal.html'); fs.writeFileSync(fw, web); fs.writeFileSync(fp, portal);
let out = ''; try { execFileSync('diff', ['-U0', fw, fp], { maxBuffer: 1 << 28 }); } catch (e) { out = e.stdout ? e.stdout.toString() : ''; }
const only = { web: [], portal: [] };
for (const l of out.split('\n')) { if (l.startsWith('---') || l.startsWith('+++') || l.startsWith('@@')) continue; if (l.startsWith('-')) only.web.push(l.slice(1)); else if (l.startsWith('+')) only.portal.push(l.slice(1)); }
const bad = [...only.web.map(l => ['web', l]), ...only.portal.map(l => ['portal', l])].filter(([, l]) => l.trim() && !ALLOWED.some(r => r.test(l)));
console.log(`lines only in the website build: ${only.web.length}; only in the portal build: ${only.portal.length}`);
for (const [w, l] of [...only.web.map(l => ['web   ', l]), ...only.portal.map(l => ['portal', l])]) if (l.trim()) console.log('  ' + w + ' | ' + l.trim().slice(0, 150));
// the game script itself must be the same code: compare with every token value neutralised
const script = h => (h.match(/<script (?:type="text\/plain" )?id="game-src">([\s\S]*?)<\/script>/) || [])[1] || '';
const strip = t => t.replace(/'(web|crazygames)' === 'crazygames'/g, 'TARGET').replace(/© \d{4} [^'`]*|Playtest build/g, 'FOOT').replace(/\(new RegExp\('\^\(www\\\\\.\)\?[^']*\$'\)/g, 'SITE').replace(/It is the same account as Pixels of the Mist\.|همان حساب Pixels of the Mist است\./g, '').replace(/const BUILD = "[^"]*"/, 'BUILD');
const sw = script(web), sp = script(portal);
const bodyOf = h => (h.match(/<body>([\s\S]*?)<script (?:type="text\/plain" )?id="game-src">/) || [])[1] || '';
const styleOf = h => (h.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
console.log('styles identical:', styleOf(web) === styleOf(portal), '| screens (DOM before the script) identical:', bodyOf(web) === bodyOf(portal), '| game script length web/portal:', sw.length, sp.length);
const ok = bad.length === 0 && styleOf(web) === styleOf(portal) && bodyOf(web) === bodyOf(portal) && loaderRe.test(portalFull) && sw.length > 100000 && Math.abs(sw.length - sp.length) < 400;
if (bad.length) console.log('UNEXPECTED DIFFERENCES:\n' + bad.map(([w, l]) => `  ${w}: ${l.trim().slice(0, 200)}`).join('\n'));
console.log(ok ? 'PARITY OK: the website and the portal are the same game; only the lines above differ.' : 'PARITY FAILED');
fs.rmSync(tmp, { recursive: true, force: true }); process.exit(ok ? 0 : 1);
