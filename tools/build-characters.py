#!/usr/bin/env python3
"""Builds the animated sheets from the frames that tools/extract-sprites.py cut out of the owner's reference images.
The pixels are the owner's. What this script adds is only what a loose AI sheet needs before it can animate:
  * walk cycles are put together from the sheet's own frames, ordered by stride (narrow -> wide -> narrow)
  * a few frames have a head of another size (the sheet drifts from row to row): those get the head of the cycle's master frame
  * front / back cycles have only two distinct leg poses in the sheet: the mirrored pose is made by flipping the LEGS only (the belt, holster and badge stay on their own side)
  * idle has one pose per view in the sheet: a breath is made by letting the head sink one pixel
usage: python3 tools/build-characters.py            writes art/<name>/<name>.png + .json + a preview gif, and art/together-preview.gif"""
import json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', 'art')
CW, CH, GROUND, AX = 20, 26, 23, 10
BG = {'thief': (52, 41, 79), 'guard': (51, 39, 75)}

def load(name, rc): return np.array(Image.open(os.path.join(ROOT, name, 'raw', f'frame_{rc}.png')).convert('RGBA'))
def near(px, hexcol, tol=40):
    c = np.array([int(hexcol[i:i + 2], 16) for i in (1, 3, 5)]); return (np.abs(px[..., :3].astype(int) - c).sum(-1) < tol) & (px[..., 3] > 0)
def bbox(f): ys, xs = np.where(f[..., 3] > 0); return ys.min(), ys.max(), xs.min(), xs.max()

PAL = {  # which colours are skin / the first stripe, per character (matches art/<name>/palette.json from the extractor)
    'thief': dict(collar=['#dadadc'], skin=[]),
    'guard': dict(collar=[], skin=['#cc9473', '#ac7d65']),
}

def collar_row(name, f):
    top, bottom, _, _ = bbox(f)
    if PAL[name]['collar']:
        m = np.zeros(f.shape[:2], bool)
        for c in PAL[name]['collar']: m |= near(f, c, 30)
        rows = np.where(m.sum(1) >= 2)[0]; return int(rows.min()) if len(rows) else top + 7
    m = np.zeros(f.shape[:2], bool)
    for c in PAL[name]['skin']: m |= near(f, c, 45)
    rows = [r for r in range(top, top + 9) if m[r].any()]; return (max(rows) + 1) if rows else top + 8                  # the row after the last skin row of the neck

def swap_head(name, target, master):
    """the master frame's head (everything above its collar) put on the target's collar"""
    ct, cm = collar_row(name, target), collar_row(name, master); out = target.copy()
    out[:ct] = 0; tm, _, _, _ = bbox(master)
    shift = ct - cm
    for y in range(tm, cm):
        ny = y + shift
        if 0 <= ny < CH:
            row = master[y]; mask = row[:, 3] > 0; out[ny][mask] = row[mask]
    return out

def flip_legs(f, belt):
    """the rows below `belt` mirrored about the column AX (a foot that was on the left is now on the right)"""
    out = f.copy(); out[belt:] = 0
    for y in range(belt, CH):
        for x in range(CW):
            if f[y, x, 3] > 0:
                nx = 2 * AX - 1 - x
                if 0 <= nx < CW: out[y, nx] = f[y, x]
    return out

def sink_head(name, f, dy=1):
    ct = collar_row(name, f); out = f.copy(); top = bbox(f)[0]
    out[top:ct] = 0
    for y in range(top, ct):
        ny = y + dy; row = f[y]; mask = row[:, 3] > 0; out[ny][mask] = row[mask]
    return out

def belt_row(name, f):
    top, bottom, _, _ = bbox(f); return top + int(round((bottom - top) * .55))                   # about the hips

def make(name):
    L = lambda rc: load(name, rc)
    A = {}
    # idle: S 00, N 01, E 02
    for v, rc in (('S', '00'), ('N', '01'), ('E', '02')):
        base = L(rc); bob = sink_head(name, base); A[('idle', v)] = [base, bob, bob, base]
    # walk: S from row 1 (front 3/4), N from row 2, E from row 1 + row 3 with the head of frame 12
    s10, s11 = L('10'), L('11'); b = belt_row(name, s11)
    A[('walk', 'S')] = [s11, s10, flip_legs(s11, b), flip_legs(s10, b)]
    A[('walk', 'N')] = [L('20'), L('21'), L('22'), L('23')]
    m12 = L('12'); e = [swap_head(name, L('32'), m12), m12, L('13'), swap_head(name, L('33'), m12)]
    A[('walk', 'E')] = e
    return A

def build(name):
    A = make(name); VIEWS = ['S', 'N', 'E']; ANIMS = [('idle', 4, 450), ('walk', 4, 130)]
    sheet = Image.new('RGBA', (4 * CW, len(VIEWS) * len(ANIMS) * CH), (0, 0, 0, 0)); rows = []; r = 0
    for v in VIEWS:
        for an, n, ms in ANIMS:
            for k, f in enumerate(A[(an, v)]): sheet.paste(Image.fromarray(f, 'RGBA'), (k * CW, r * CH))
            rows.append(dict(name=f'{an}_{v}', view=v, row=r, frames=n, ms=ms, loop=True)); r += 1
    out = os.path.join(ROOT, name); sheet.save(os.path.join(out, f'{name}.png'))
    json.dump(dict(file=f'{name}.png', cell=[CW, CH], anchor=[AX, GROUND], mirror_left_from='E', source=f'art/reference/{ "11" if name == "thief" else "12"}.webp',
                   note='ground point (the feet) at the anchor; W is the mirror of E; pixels are the owner\'s reference, cut and cleaned by tools/extract-sprites.py + tools/build-characters.py', rows=rows),
              open(os.path.join(out, f'{name}.json'), 'w'), indent=1)
    return A

def gif(frames_by_col, path, Z=10, ms=130):
    imgs = []
    for k in range(max(len(c) for c in frames_by_col)):
        W = Image.new('RGBA', (CW * len(frames_by_col), CH), BG['thief'] + (255,))
        for c, col in enumerate(frames_by_col):
            W.alpha_composite(Image.fromarray(col[k % len(col)], 'RGBA'), (c * CW, 0))
        imgs.append(W.resize((W.width * Z, W.height * Z), Image.NEAREST).convert('P', palette=Image.ADAPTIVE, colors=40))
    imgs[0].save(path, save_all=True, append_images=imgs[1:], duration=ms, loop=0, disposal=2)

def mirror(f): return f[:, ::-1].copy()

if __name__ == '__main__':
    As = {n: build(n) for n in ('thief', 'guard')}
    for n, A in As.items():
        cols = [A[('walk', 'S')], A[('walk', 'E')], [mirror(f) for f in A[('walk', 'E')]], A[('walk', 'N')]]
        idle = [A[('idle', 'S')], A[('idle', 'E')], [mirror(f) for f in A[('idle', 'E')]], A[('idle', 'N')]]
        # a two-row preview: walk on top, idle below
        imgs = []
        for k in range(8):
            W = Image.new('RGBA', (CW * 4, CH * 2), BG[n] + (255,))
            for c in range(4):
                W.alpha_composite(Image.fromarray(cols[c][k % 4], 'RGBA'), (c * CW, 0)); W.alpha_composite(Image.fromarray(idle[c][(k // 2) % 4], 'RGBA'), (c * CW, CH))
            imgs.append(W.resize((W.width * 10, W.height * 10), Image.NEAREST).convert('P', palette=Image.ADAPTIVE, colors=40))
        imgs[0].save(os.path.join(ROOT, n, f'{n}-preview.gif'), save_all=True, append_images=imgs[1:], duration=130, loop=0, disposal=2)
    both = [As['guard'][('walk', 'E')], [mirror(f) for f in As['thief'][('walk', 'E')]], As['guard'][('walk', 'S')], As['thief'][('walk', 'S')]]
    gif(both, os.path.join(ROOT, 'together-preview.gif'))
    print('built', list(As))
