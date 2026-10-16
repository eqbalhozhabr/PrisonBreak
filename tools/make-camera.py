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
SCALE = {'camera': .6, 'searchlight': .62, 'panel': .6}                        # how many pixels one model unit is: the gadgets are small next to a 22-px guard
CW, CH, OX, OY = 26, 26, 13, 18

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

def model_camera_mount():
    """the part that stays on the wall: plate, arm and the joint's ball (symmetric about Y = 0; the head turns on the joint at X = 4)"""
    v, box = vox_builder()
    box(0, 0, -3, 2, 2, 9, 'plate'); v[(0, -2, 3)] = 'bolt'; v[(0, 1, 3)] = 'bolt'; v[(0, -2, 8)] = 'bolt'; v[(0, 1, 8)] = 'bolt'
    box(1, 3, -1, 0, 5, 6, 'arm'); box(3, 4, -1, 0, 4, 7, 'joint')
    return v

def model_camera_head():
    """the part that turns: body, sun shield, lens, recording lamp; coordinates are relative to the pivot (the joint, X = 4)"""
    v, box = vox_builder()
    box(0, 8, -2, 1, 4, 7, 'metal'); box(0, 8, -2, 1, 8, 8, 'ring'); box(0, 10, -3, 2, 9, 9, 'shield')
    box(9, 9, -2, 1, 4, 7, 'ring'); box(10, 10, -1, 0, 5, 6, 'glass'); v[(2, 0, 9)] = 'led'
    for z in range(4, 8): v[(4, 1, z)] = 'seam'
    return v

def model_light_mount():
    v, box = vox_builder()
    box(0, 0, -4, 3, 1, 11, 'plate'); v[(0, -3, 2)] = 'bolt'; v[(0, 2, 2)] = 'bolt'; v[(0, -3, 10)] = 'bolt'; v[(0, 2, 10)] = 'bolt'
    box(1, 4, -4, -4, 3, 9, 'arm'); box(1, 4, 3, 3, 3, 9, 'arm'); box(3, 4, -1, 0, 5, 6, 'joint')
    return v

def model_light_head():
    """the drum, an octagon in section (6 x 6), turning on the yoke's pivot (X = 4); big bright lens in front"""
    v, box = vox_builder()
    def oct_ok(y, z, r): return abs(y + .5) <= r and abs(z - 5.5) <= r and abs(y + .5) + abs(z - 5.5) <= r + 1.5
    for x in range(-1, 7):
        for y in range(-3, 3):
            for z in range(3, 9):
                if oct_ok(y, z, 2.5): v[(x, y, z)] = 'drum' if x < 4 else 'drumdark'
    for y in range(-3, 3):
        for z in range(3, 9):
            if oct_ok(y, z, 2.5): v[(7, y, z)] = 'ring'
    for y in range(-2, 2):
        for z in range(4, 8):
            if oct_ok(y, z, 1.5): v[(8, y, z)] = 'lamp'
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

def render(vox, state, sc):
    img = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); px = img.load()
    zmax = (max(p[2] for p in vox) + 2) * sc
    for j in range(CH):
        for i in range(CW):
            sx, sy = i + .5 - OX + .0113, j + .5 - OY + .0071                      # (a hair off the pixel centre: no ray runs exactly along an edge)
            prev = None; ppos = None; z = zmax
            while z > -1:
                b = (sy + z) / K; X, Y = (sx + b) / 2, (b - sx) / 2
                cell = (math.floor(X / sc), math.floor(Y / sc), math.floor(z / sc))
                if cell in vox:
                    face = 'top'
                    if prev is not None:                                             # the face the ray came through: of the boundaries it crossed, the last one
                        cur = (X / sc, Y / sc, z / sc); best = -1
                        for a, name in ((2, 'top'), (1, 'left'), (0, 'right')):
                            if prev[a] != cell[a]:
                                t = (ppos[a] - prev[a]) / ((ppos[a] - cur[a]) or 1e-9)
                                if t > best: best, face = t, name
                    px[i, j] = colour(vox[cell], face, state) + (255,); break
                prev = cell; ppos = (X / sc, Y / sc, z / sc); z -= .05
    return img

MODELS = {                                   # name: (voxel model, states, lens point in the model (for a head), scale key, wall mount?)
    'camera_mount': (model_camera_mount, ['x'], None, 'camera', True),
    'camera_head': (model_camera_head, ['on', 'dim', 'off'], (10.5, 0.0, 6.0), 'camera', False),
    'searchlight_mount': (model_light_mount, ['x'], None, 'searchlight', True),
    'searchlight_head': (model_light_head, ['on', 'dim'], (8.5, 0.0, 5.5), 'searchlight', False),
    'panel': (model_panel, ['amber', 'cyan', 'magenta'], None, 'panel', True),
}
PIVOT = (4.0, 0.0)                                                             # where a head sits on its mount, in the mount's model coordinates

def build(name):
    fn, states, lens, skey, mount = MODELS[name]; sc = SCALE[skey]; folder = name.split('_')[0]; out = os.path.join(ART, folder); os.makedirs(out, exist_ok=True)
    dirs = [('SE', 0), ('SW', 1), ('NW', 2), ('NE', 3)]
    sheet = Image.new('RGBA', (len(states) * CW, len(dirs) * CH), (0, 0, 0, 0)); rows = []
    for r, (dn, k) in enumerate(dirs):
        vox = rotate(fn(), k)
        for si, st in enumerate(states): sheet.paste(render(vox, st if st != 'x' else 'on', sc), (si * CW, r * CH))
        row = dict(name=dn, row=r, frames=len(states))
        if lens:
            lx, ly = lens[0], lens[1]
            for _ in range(k): lx, ly = -ly, lx
            row['lens'] = [round(OX + (lx - ly) * sc, 1), round(OY + (lx + ly) * K * sc - lens[2] * sc, 1)]
        if mount and name != 'panel':
            px, py = PIVOT
            for _ in range(k): px, py = -py, px
            row['pivot'] = [round((px - py) * sc, 1), round((px + py) * K * sc, 1)]                 # where the head's origin lies relative to the mount's origin on the screen
        rows.append(row)
    sheet.save(os.path.join(out, f'{name}.png'))
    json.dump(dict(file=f'{name}.png', cell=[CW, CH], anchor=[OX, OY], states=states, rows=rows, scale=sc, plate_top=round((11 if skey != 'camera' else 9) * sc),
                   note='anchor = the point on the wall plane (X=Y=0, Z=0) in the cell (for a head: the pivot); put it at the wall top minus the plate height and a little toward the room'), open(os.path.join(out, f'{name}.json'), 'w'), indent=1)
    prev = Image.new('RGBA', (len(states) * CW + 4, len(dirs) * CH + 4), (53, 39, 74, 255)); prev.alpha_composite(sheet, (2, 2)); prev.resize((prev.width * 10, prev.height * 10), Image.NEAREST).save(os.path.join(out, f'{name}-preview.png'))

if __name__ == '__main__':
    for n in MODELS: build(n)
    print('built', list(MODELS))
