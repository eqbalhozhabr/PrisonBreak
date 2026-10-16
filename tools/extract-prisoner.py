"""The owner's new prisoner sheet (art/reference/15.webp: 4 idle + 6 walk frames, one 3/4 view) as a black pen drawing:
only ink, transparent everywhere else, the way the console-screen reference characters are drawn. Ink = the sheet's black outline plus its dark stripes and dark hair;
the light stripes, skin and the sheet's background are left transparent.  Output: art/prisoner/prisoner_pen.png (+ .json): a high-resolution 1-bit master that the game
scales down to the exact device-pixel size at run time (see tools/build-newchars.js)."""
import json, numpy as np
from PIL import Image
SRC = 'art/reference/15.webp'; OUT = 'art/prisoner/'
INK_BELOW = 100                      # luminance: outline ~0-20, dark stripes/hair ~85, light stripes ~165, background ~183
a = np.array(Image.open(SRC).convert('L')).astype(int)
fg = a < 173
def runs(v, gap):
    idx = np.where(v)[0]; out = []; s = p = idx[0]
    for i in idx[1:]:
        if i - p > gap: out.append((s, p)); s = i
        p = i
    out.append((s, p)); return out
bands = [r for r in runs(fg.sum(1) > 0, 3) if r[1] - r[0] > 100]          # the two figure rows (the captions are shorter)
frames = []
for (y0, y1), name in zip(bands, ('idle', 'walk')):
    for (x0, x1) in runs(fg[y0:y1 + 1].sum(0) > 0, 8):
        ink = (a[y0:y1 + 1, x0:x1 + 1] < INK_BELOW); ys, xs = np.nonzero(ink)
        top, bot = ys.min(), ys.max(); torso = ink[int(top + .35 * (bot - top)):int(top + .6 * (bot - top))]
        cx = x0 + int(np.nonzero(torso)[1].mean()); frames.append((name, ink[top:bot + 1], cx - x0, bot - top + 1))
CW, CH = 220, int(max(f[3] for f in frames))                                    # one cell: the feet on the bottom row, the torso centre on the middle column
sheet = np.zeros((CH, CW * len(frames), 4), np.uint8); rows = {'idle': 0, 'walk': 0}
for i, (name, ink, cx, h) in enumerate(frames):
    rows[name] += 1; w = ink.shape[1]; left = CW // 2 - cx
    cell = np.zeros((CH, CW), bool); xs0 = max(0, left); xs1 = min(CW, left + w); cell[CH - h:, xs0:xs1] = ink[:, xs0 - left:xs1 - left]
    sheet[:, i * CW:(i + 1) * CW, 3] = cell * 255; sheet[:, i * CW:(i + 1) * CW, :3] = (20, 22, 20)
Image.fromarray(sheet).save(OUT + 'prisoner_pen.png', optimize=True)
man = {'file': 'prisoner_pen.png', 'cell': [CW, CH], 'frames': {'idle': [0, rows['idle']], 'walk': [rows['idle'], rows['walk']]}, 'ms': {'idle': 330, 'walk': 110},
       'source': SRC, 'height': int(np.median([f[3] for f in frames])), 'note': 'high-resolution 1-bit master; feet on the last row, torso centre on the middle column'}
json.dump(man, open(OUT + 'prisoner_pen.json', 'w'), indent=1); print(man, sheet.shape)
bg = Image.new('RGBA', (sheet.shape[1], CH), (176, 184, 160, 255)); bg.alpha_composite(Image.fromarray(sheet)); bg.convert('RGB').save(OUT + 'contact.png')
