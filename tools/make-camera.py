#!/usr/bin/env python3
"""The security camera: a small voxel model (wall plate, arm, ball joint, body, sun shield, lens ring, glass, status LED) rendered pixel by pixel for the four isometric directions
and three states (LED bright, LED dim, off). Every screen pixel casts a ray through the model through the same projection as the world (a 32 x 22 diamond:
1 unit across = 1 px, 1 unit along a diagonal = 22/32 px down), the first voxel it meets gives the colour, shaded by which face it hits: top light, the face toward +Y mid, the face toward +X dark.
No outline. The camera looks along +X in the model, hanging from a wall plate at X = 0.
Directions: SE = lens toward us and right, SW = toward us and left, NW / NE = away from us (back view).
usage: python3 tools/make-camera.py     writes art/camera/camera.png + camera.json + camera-preview.png"""
import json, math, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..', 'art', 'camera')
K = 22 / 32
CW, CH, OX, OY = 36, 36, 18, 24

def hx(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
BASE = dict(metal=hx('#e6eaf4'), shield=hx('#9aa3b8'), arm=hx('#7f889d'), joint=hx('#6b7388'), plate=hx('#69718a'), ring=hx('#4a5166'), bolt=hx('#aab2c6'))
FACE = dict(top=1.0, left=.76, right=.52)                                       # light from the upper left

def build_voxels(state):
    v = {}
    def box(x0, x1, y0, y1, z0, z1, ident):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                for z in range(z0, z1 + 1): v[(x, y, z)] = ident
    box(0, 0, -3, 3, 2, 9, 'plate'); v[(0, -2, 3)] = 'bolt'; v[(0, 2, 3)] = 'bolt'; v[(0, -2, 8)] = 'bolt'; v[(0, 2, 8)] = 'bolt'
    box(1, 3, -1, 0, 5, 6, 'arm'); box(3, 4, -1, 0, 4, 7, 'joint')
    box(4, 12, -2, 2, 4, 7, 'metal')                                              # body, 9 long
    box(4, 12, -2, 2, 8, 8, 'ring')                                               # a dark gap under the shield
    box(4, 14, -3, 3, 9, 9, 'shield')                                             # the sun shield reaches past the lens
    box(13, 13, -2, 2, 4, 7, 'ring'); box(14, 14, -1, 1, 5, 6, 'glass')           # lens ring and glass
    v[(6, 0, 9)] = 'led'                                                           # the recording lamp on top, visible from every side
    for z in range(4, 8): v[(8, 2, z)] = 'seam'                                    # a seam line across the side
    return v

def rotate(vox, k):
    out = {}
    for (x, y, z), ident in vox.items():
        for _ in range(k): x, y = -y - 1, x
        out[(x, y, z)] = ident
    return out

def colour(ident, face, state):
    if ident == 'led': return {'on': hx('#ff4a3a'), 'dim': hx('#8e2c2a'), 'off': hx('#3a2a30')}[state]
    if ident == 'ledfoot': return tuple(int(q * FACE[face]) for q in BASE['metal'])
    if ident == 'seam': return tuple(int(q * FACE[face] * .78) for q in BASE['metal'])
    if ident == 'glass':
        if face == 'right': return {'on': hx('#2a3d66'), 'dim': hx('#1e2c4a'), 'off': hx('#12151f')}[state]
        return hx('#0c0e16')
    b = BASE[ident]; return tuple(int(q * FACE[face]) for q in b)

def render(vox, state):
    img = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); px = img.load()
    xs = [p[0] for p in vox]; ys = [p[1] for p in vox]; zmax = max(p[2] for p in vox) + 2
    for j in range(CH):
        for i in range(CW):
            sx, sy = i + .5 - OX + .0113, j + .5 - OY + .0071                      # (a hair off the pixel centre: no ray runs exactly along an edge)
            prev = None; ppos = None; z = zmax
            while z > -1:
                b = (sy + z) / K; X, Y = (sx + b) / 2, (b - sx) / 2
                cell = (math.floor(X), math.floor(Y), math.floor(z))
                if cell in vox:
                    face = 'top'
                    if prev is not None:                                             # the face the ray came through: of the boundaries it crossed, the last one
                        cur = (X, Y, z); best = -1
                        for a, name in ((2, 'top'), (1, 'left'), (0, 'right')):
                            if prev[a] != cell[a]:
                                t = (ppos[a] - prev[a]) / ((ppos[a] - cur[a]) or 1e-9)
                                if t > best: best, face = t, name
                    px[i, j] = colour(vox[cell], face, state) + (255,); break
                prev = cell; ppos = (X, Y, z); z -= .05
    return img

def build():
    os.makedirs(OUT, exist_ok=True); dirs = [('SE', 0), ('SW', 1), ('NW', 2), ('NE', 3)]; states = ['on', 'dim', 'off']
    sheet = Image.new('RGBA', (len(states) * CW, len(dirs) * CH), (0, 0, 0, 0)); rows = []
    for r, (name, k) in enumerate(dirs):
        vox = rotate(build_voxels('on'), k)
        for s, st in enumerate(states): sheet.paste(render(vox, st), (s * CW, r * CH))
        lx, ly = 14.5, 0.5
        for _ in range(k): lx, ly = -ly, lx
        rows.append(dict(name=name, row=r, frames=len(states), lens=[round(OX + (lx - ly), 1), round(OY + (lx + ly) * K - 6.0, 1)]))
    sheet.save(os.path.join(OUT, 'camera.png'))
    json.dump(dict(file='camera.png', cell=[CW, CH], anchor=[OX, OY], states=states, rows=rows,
                   note='anchor = the point on the wall plane (X=Y=0, Z=0) in the cell; put it at the wall top minus 7 px and a little toward the room; lens = pixel of the lens centre in the cell'), open(os.path.join(OUT, 'camera.json'), 'w'), indent=1)
    prev = Image.new('RGBA', (len(states) * CW + 4, len(dirs) * CH + 4), (53, 39, 74, 255)); prev.alpha_composite(sheet, (2, 2)); prev.resize((prev.width * 8, prev.height * 8), Image.NEAREST).save(os.path.join(OUT, 'camera-preview.png'))

if __name__ == '__main__':
    build(); print('built camera')
