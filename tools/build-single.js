/* Inlines src/prison.js and play/levels.js into one file so the game opens by double-click.
   writes play/prisonbreak.html (standalone) and play/artifact.html (fragment for the Artifact tool). */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
let html = rd('play/index.html');
html = html.replace('<script src="../src/prison.js"></script>', () => '<script>\n' + rd('src/prison.js') + '\n</script>')
           .replace('<script src="levels.js"></script>', () => '<script>\n' + rd('play/levels.js') + '\n</script>');
fs.writeFileSync(path.join(root, 'play/prisonbreak.html'), html);
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const style = html.match(/<style>[\s\S]*?<\/style>/)[0];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
fs.writeFileSync(path.join(root, 'play/artifact.html'), title + '\n' + style + '\n' + body);
console.log('wrote play/prisonbreak.html', html.length, 'bytes; play/artifact.html');
