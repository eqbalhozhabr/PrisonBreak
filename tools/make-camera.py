#!/usr/bin/env python3
"""Wall-mounted gadgets, modelled in voxels and rendered pixel by pixel for the four isometric directions: the security camera, the searchlight and the power panel.
Every screen pixel casts a ray through the model through the same projection as the world (a 32 x 22 diamond: 1 unit across = 1 px, 1 unit along a diagonal = 22/32 px down);
the first voxel it meets gives the colour, shaded by the face it hits: top light, the face toward +Y mid, the face toward +X dark. No outline.
In the model the gadget looks along +X and hangs from a wall plate at X = 0. Directions: SE = toward us and right, SW = toward us and left, NW / NE = away from us (back view).
usage: python3 tools/make-camera.py     writes art/camera/camera.png (+json, preview), art/searchlight/searchlight.png, art/panel/panel.png"""
import json, math, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ART = os.path.join(HERE, '..', 'art')
K = 22 / 32
CW, CH, OX, OY = 36, 36, 18, 24

def hx(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
BASE = dict(metal=hx('#e6eaf4'), shield=hx('#9aa3b8'), arm=hx('#7f889d'), joint=hx('#6b7388'), plate=hx('#69718a'), ring=hx('#4a5166'), bolt=hx('#aab2c6'),
            drum=hx('#7d869c'), drumdark=hx('#555d74'), box=hx('#8d96ac'), lever=hx('#d8dde8'))
FACE = dict(top=1.0, left=.76, right=.52)                                       # light from the upper left

def vox_builder():
    v = {}
    def box(x0, x1, y0, y1, z0, z1, ident):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                for z in range(z0, z1 + 1): v[(x, y, z)] = ident
    return v, box

def model_camera():
    v, box = vox_builder()
    box(0, 0, -3, 3, 2, 9, 'plate'); v[(0, -2, 3)] = 'bolt'; v[(0, 2, 3)] = 'bolt'; v[(0, -2, 8)] = 'bolt'; v[(0, 2, 8)] = 'bolt'
    box(1, 3, -1, 0, 5, 6, 'arm'); box(3, 4, -1, 0, 4, 7, 'joint')
    box(4, 12, -2, 2, 4, 7, 'metal'); box(4, 12, -2, 2, 8, 8, 'ring'); box(4, 14, -3, 3, 9, 9, 'shield')       # body, a dark gap, the sun shield
    box(13, 13, -2, 2, 4, 7, 'ring'); box(14, 14, -1, 1, 5, 6, 'glass'); v[(6, 0, 9)] = 'led'                 # lens ring, glass, the recording lamp
    for z in range(4, 8): v[(8, 2, z)] = 'seam'
    return v

def model_light():
    """a searchlight: wall plate, a yoke, a drum (octagonal section) and a big bright lens"""
    v, box = vox_builder()
    box(0, 0, -4, 4, 1, 11, 'plate'); v[(0, -3, 2)] = 'bolt'; v[(0, 3, 2)] = 'bolt'; v[(0, -3, 10)] = 'bolt'; v[(0, 3, 10)] = 'bolt'
    box(1, 4, -4, -4, 3, 9, 'arm'); box(1, 4, 4, 4, 3, 9, 'arm')                                              # the yoke arms
    for x in range(3, 11):                                                                                    # the drum, an octagon in section (Y -3..3, Z 3..9)
        for y in range(-3, 4):
            for z in range(3, 10):
                if abs(y) + abs(z - 6) <= 4 and not (abs(y) == 3 and abs(z - 6) == 3): v[(x, y, z)] = 'drum' if x < 8 else 'drumdark'
    for y in range(-3, 4):
        for z in range(3, 10):
            if abs(y) + abs(z - 6) <= 4 and not (abs(y) == 3 and abs(z - 6) == 3): v[(11, y, z)] = 'ring'
    for y in range(-2, 3):
        for z in range(4, 9):
            if abs(y) + abs(z - 6) <= 3: v[(12, y, z)] = 'lamp'                                              # the lens
    return v

def model_panel():
    """a power panel: a box on the wall with a lever and a coloured tag lamp on top (the lamp colour says which items the panel switches)"""
    v, box = vox_builder()
    box(0, 0, -4, 4, 2, 11, 'plate'); v[(0, -3, 3)] = 'bolt'; v[(0, 3, 3)] = 'bolt'; v[(0, -3, 10)] = 'bolt'; v[(0, 3, 10)] = 'bolt'
    box(1, 3, -3, 3, 3, 10, 'box')                                                                            # the cabinet
    box(4, 4, -2, 2, 4, 9, 'ring')                                                                            # a dark front plate on it
    box(4, 4, -1, -1, 5, 8, 'lever'); box(5, 5, -1, -1, 7, 8, 'lever')                                        # the lever
    for y in (0, 2): v[(4, y, 8)] = 'ledfront'
    for y in (-1, 0, 1): v[(2, y, 11)] = 'tag'; v[(3, y, 11)] = 'tag'                                         # the tag lamp, on top
    return v

def rotate(vox, k):
    out = {}
    for (x, y, z), ident in vox.items():
        for _ in range(k): x, y = -y - 1, x
        out[(x, y, z)] = ident
    return out

def colour(ident, face, state):
    sh = lambda c: tuple(int(q * FACE[face]) for q in c)
    if ident == 'led': return {'on': hx('#ff4a3a'), 'dim': hx('#8e2c2a'), 'off': hx('#3a2a30')}[state]
    if ident == 'seam': return tuple(int(q * FACE[face] * .78) for q in BASE['metal'])
    if ident == 'glass':
        if face == 'right': return {'on': hx('#2a3d66'), 'dim': hx('#1e2c4a'), 'off': hx('#12151f')}[state]
        return hx('#0c0e16')
    if ident == 'lamp': return {'on': hx('#fff3b8'), 'dim': hx('#d9b45e')}[state] if face != 'left' else {'on': hx('#ffe48a'), 'dim': hx('#b8943e')}[state]
    if ident in ('tag', 'ledfront'): return {'amber': hx('#ffb43a'), 'cyan': hx('#40d8f0'), 'magenta': hx('#e868e8')}[state]
    return sh(BASE[ident])

def render(vox, state):
    img = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); px = img.load()
    zmax = max(p[2] for p in vox) + 2
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

MODELS = {
    'camera': (model_camera, ['on', 'dim', 'off'], (14.5, 0.5, 6.0)),
    'searchlight': (model_light, ['on', 'dim'], (12.5, 0.5, 6.0)),
    'panel': (model_panel, ['amber', 'cyan', 'magenta'], None),
}

def build(name):
    fn, states, lens = MODELS[name]; out = os.path.join(ART, name); os.makedirs(out, exist_ok=True)
    dirs = [('SE', 0), ('SW', 1), ('NW', 2), ('NE', 3)]
    sheet = Image.new('RGBA', (len(states) * CW, len(dirs) * CH), (0, 0, 0, 0)); rows = []
    for r, (dn, k) in enumerate(dirs):
        vox = rotate(fn(), k)
        for s, st in enumerate(states): sheet.paste(render(vox, st), (s * CW, r * CH))
        row = dict(name=dn, row=r, frames=len(states))
        if lens:
            lx, ly = lens[0], lens[1]
            for _ in range(k): lx, ly = -ly, lx
            row['lens'] = [round(OX + (lx - ly), 1), round(OY + (lx + ly) * K - lens[2], 1)]
        rows.append(row)
    sheet.save(os.path.join(out, f'{name}.png'))
    json.dump(dict(file=f'{name}.png', cell=[CW, CH], anchor=[OX, OY], states=states, rows=rows,
                   note='anchor = the point on the wall plane (X=Y=0, Z=0) in the cell; put it at the wall top minus 8 px and a little toward the room; lens = pixel of the lens centre in the cell'), open(os.path.join(out, f'{name}.json'), 'w'), indent=1)
    prev = Image.new('RGBA', (len(states) * CW + 4, len(dirs) * CH + 4), (53, 39, 74, 255)); prev.alpha_composite(sheet, (2, 2)); prev.resize((prev.width * 8, prev.height * 8), Image.NEAREST).save(os.path.join(out, f'{name}-preview.png'))

if __name__ == '__main__':
    for n in MODELS: build(n)
    print('built', list(MODELS))
