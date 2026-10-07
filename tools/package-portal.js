/* Builds the CrazyGames version of the game, checks it, and zips it.
   usage: OWNER_NAME="Your Name" node tools/package-portal.js [--allow-placeholder]
   The zip has index.html at its root (relative paths only, everything inlined, one file) and lands in releases/crazygames/.
   The checks are the safety net from the playbook: the build must not contain the website's domain, another game's name, or an unreplaced token;
   it must contain the owner's name; it must make no outside request (no http(s) addresses). */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist-crazygames');
const owner = process.env.OWNER_NAME || '';
if (!owner && !process.argv.includes('--allow-placeholder')) { console.error('Set OWNER_NAME to the personal name shown in the game (or pass --allow-placeholder for a trial build).'); process.exit(2); }
fs.rmSync(dist, { recursive: true, force: true });
execFileSync('node', [path.join(__dirname, 'build-single.js'), '--target', 'crazygames', '--out', dist], { stdio: 'inherit', env: Object.assign({}, process.env) });
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8'), problems = [];
const forbidden = /luckylion|pixels of the mist|zenith|dubiko|eqbalhozhabr/i.exec(html); if (forbidden) problems.push('forbidden text in the bundle: ' + forbidden[0]);
const token = /@[A-Z_]{3,}@/.exec(html); if (token) problems.push('unreplaced build token: ' + token[0]);
if (!html.includes(owner || '[Owner name]')) problems.push('the owner name is missing from the bundle');
const urls = [...html.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map(m => m[0]); if (urls.length) problems.push('outside addresses in the bundle: ' + [...new Set(urls)].join(', '));
if (/\bfetch\(\s*['"]https?:/.test(html) || /<script[^>]+src=["']http/.test(html) || /<link[^>]+href=["']http/.test(html)) problems.push('an outside resource is loaded');
if (problems.length) { console.error('PORTAL CHECK FAILED:\n - ' + problems.join('\n - ')); process.exit(1); }
const files = fs.readdirSync(dist), size = files.reduce((n, f) => n + fs.statSync(path.join(dist, f)).size, 0);
let commit = 'nogit'; try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim(); } catch (e) {}
const outDir = path.join(root, 'releases', 'crazygames'); fs.mkdirSync(outDir, { recursive: true });
const zip = path.join(outDir, `blind-eye-crazygames-${new Date().toISOString().slice(0, 10)}-${commit}${owner ? '' : '-PLACEHOLDER-NAME'}.zip`);
fs.rmSync(zip, { force: true });
execFileSync('python3', ['-I', '-c', 'import sys, zipfile, os\nz = zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_DEFLATED)\nfor f in sorted(os.listdir(sys.argv[2])): z.write(os.path.join(sys.argv[2], f), f)\nz.close()', zip, dist]);
console.log(`OK: ${files.length} file(s), ${(size / 1024).toFixed(0)} KB unzipped, ${(fs.statSync(zip).size / 1024).toFixed(0)} KB zipped\n -> ${path.relative(root, zip)}\n    limits: <= 50 MB total (20 MB for the mobile homepage), <= 1500 files${owner ? '' : '\n    WARNING: placeholder owner name; rebuild with OWNER_NAME before submitting.'}`);
