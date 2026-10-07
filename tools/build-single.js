/* Inlines src/prison.js, play/levels.js and the pixel fonts into play/index.html, so the game is one file that opens by double-click.
   usage: node tools/build-single.js                 -> play/prisonbreak.html (the site build) and play/artifact.html (fragment for the Artifact tool)
          node tools/build-single.js --target crazygames [--out dist-crazygames]
                                                       -> dist-crazygames/index.html: the portal build (no server, accounts, ads or outside links; the owner's
                                                          personal name from the OWNER_NAME environment variable). Use tools/package-portal.js to check and zip it. */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const target = arg('target') || 'web';
let build = new Date().toISOString().slice(0, 10);
try { build += '-' + execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch (e) {}
const owner = process.env.OWNER_NAME || '[Owner name]', year = String(new Date().getFullYear());
const T = target === 'crazygames'
  ? { TARGET: 'crazygames', SITE_PATH: 'the website', SITE_RE: 'portal\\\\.invalid', POM_EN: '', POM_FA: '', OWNER: owner, YEAR: year,
      PORTAL_META: `<meta name="author" content="${owner}">\n<meta name="copyright" content="© ${year} ${owner}">\n<meta name="description" content="Blind Eye: a pixel-art stealth puzzle. Turn cameras, move guards, close doors and flip mirrors so the prisoner can slip out unseen.">` }
  : { TARGET: 'web', SITE_PATH: 'luckylion.games/blind-eye', SITE_RE: 'luckylion\\\\.games', POM_EN: ' It is the same account as Pixels of the Mist.', POM_FA: ' همان حساب Pixels of the Mist است.', OWNER: '', YEAR: year, PORTAL_META: '' };
let html = rd('play/index.html').replace("'__BUILD__'", () => JSON.stringify(build));
html = html.replace(/<!--@PORTAL_META@-->/, () => T.PORTAL_META).replace(/@(TARGET|SITE_PATH|SITE_RE|POM_EN|POM_FA|OWNER|YEAR)@/g, (m, k) => T[k]);
html = html.replace('<script src="../src/prison.js"></script>', () => '<script>\n' + rd('src/prison.js') + '\n</script>')
           .replace('<script src="levels.js"></script>', () => '<script>\n' + rd('play/levels.js') + '\n</script>');
// inline the pixel fonts so the single file also works offline
html = html.replace(/url\(fonts\/([^)]+)\)/g, (m, f) => {
  const mime = f.endsWith('.woff2') ? 'font/woff2' : 'font/ttf';
  return 'url(data:' + mime + ';base64,' + fs.readFileSync(path.join(root, 'play/fonts', f)).toString('base64') + ')';
});
if (target === 'crazygames') {
  const out = path.resolve(root, arg('out') || 'dist-crazygames');
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'index.html'), html);
  console.log('wrote', path.relative(root, path.join(out, 'index.html')), html.length, 'bytes (portal build ' + build + ', owner "' + owner + '")');
} else {
  fs.writeFileSync(path.join(root, 'play/prisonbreak.html'), html);
  const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
  const style = html.match(/<style>[\s\S]*?<\/style>/)[0];
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  fs.writeFileSync(path.join(root, 'play/artifact.html'), title + '\n' + style + '\n' + body);
  console.log('wrote play/prisonbreak.html', html.length, 'bytes; play/artifact.html');
}
