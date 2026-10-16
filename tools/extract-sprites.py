#!/usr/bin/env python3
"""Cuts the character sprites out of the owner's reference sheets (art/reference/*.webp) - the pixels are the owner's, not redrawn.
Each sheet is a 100 x 100 pixel image that was enlarged 10.24x (and blurred a little): we sample the centre of every source pixel, snap
the colours to a small palette, cut the 4 x 4 figures, and put each one in a cell with the feet on the ground line and the head over the anchor.
Writes the 16 raw frames (art/<name>/raw/frame_<row><col>.png) and a labelled contact sheet; tools/build-characters.py turns them into animations.
usage: python3 tools/extract-sprites.py thief|guard"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', 'art')
P = 1024 / 100
CELL_W, CELL_H, GROUND, AX = 20, 26, 23, 10          # a cell; the feet are on row GROUND; the head centre column is AX
BANDS = [(5, 27), (31, 51), (53, 74), (79, 102)]       # source rows of the four figure rows (the labels sit in between)
XR = [(2, 22), (27, 45), (53, 73), (78, 98)]           # source columns of the four figure columns

def hx(h): return [int(h[i:i + 2], 16) for i in (1, 3, 5)]
CFG = {
    'thief': dict(src='11.webp', bg=(52, 41, 79), thr=45,
                  palette=['#d7d7d8', '#a9a8ac', '#22262c', '#c7693e', '#b14f45', '#deb47e', '#c78f75', '#ba806e']),
    'guard': dict(src='12.webp', bg=(51, 39, 75), thr=30, fixed=True,           # fixed: the blur turns the tiny gold badge and buckle into a few mixed pixels, k-means would swallow them
                  palette=['#2c4558', '#223a50', '#1b2d40', '#0f2130', '#141923', '#2a1913', '#492f26', '#694f41', '#cc9473', '#ac7d65', '#d69f55', '#8a8580', '#251f2c', '#9c8456', '#74706c']),
}

def sample(path):
    im = np.array(Image.open(path).convert('RGB')).astype(float); out = np.zeros((100, 100, 3), np.uint8)
    for j in range(100):
        for i in range(100):
            x0, y0 = int((i + .5) * P - 2), int((j + .5) * P - 2); out[j, i] = np.median(im[y0:y0 + 5, x0:x0 + 5].reshape(-1, 3), axis=0)
    return out

def keep_main(m):
    """keeps the biggest 8-connected blob and any blob of 3+ pixels that touches it within 2 pixels (a hand or a foot can float apart in these sheets)"""
    h, w = m.shape; lab = np.zeros((h, w), int); n = 0; sizes = {}
    for y in range(h):
        for x in range(w):
            if m[y, x] and not lab[y, x]:
                n += 1; st = [(y, x)]; lab[y, x] = n; cnt = 0
                while st:
                    cy, cx = st.pop(); cnt += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; st.append((ny, nx))
                sizes[n] = cnt
    if not sizes: return m
    main = max(sizes, key=sizes.get); out = lab == main; ys, xs = np.where(out)
    for k, sz in sizes.items():
        if k == main: continue
        by, bx = np.where(lab == k)
        near = any(abs(by - yy).min() <= 2 and abs(bx - xx).min() <= 2 for yy, xx in zip(ys, xs)) if sz < 12 else True
        if near and sz >= 1 and (sz >= 2 or True):
            # a lone pixel counts only if it is close to the body (a hand), never if it floats far below or beside it
            d = min(np.hypot(by[:, None] - ys[None], bx[:, None] - xs[None]).min(1)) if len(ys) < 400 else 9
            if d <= 2.5: out |= lab == k
    return out

def run(name):
    cfg = CFG[name]; src = os.path.join(ROOT, 'reference', cfg['src']); a = sample(src); bg = np.array(cfg['bg'])
    pal = np.array([hx(c) for c in cfg['palette']], float)
    fg = np.abs(a.astype(int) - bg).sum(2) > cfg['thr']
    X = a[fg].astype(float); C = pal.copy()                                   # refine the palette on the real pixels (a few k-means steps from the chosen seeds)
    for _ in range(0 if cfg.get('fixed') else 25):
        l = np.argmin(((X[:, None] - C[None]) ** 2).sum(2), axis=1); C = np.array([X[l == i].mean(0) if (l == i).any() else C[i] for i in range(len(C))])
    C = np.round(C).astype(int)
    outdir = os.path.join(ROOT, name, 'raw'); os.makedirs(outdir, exist_ok=True); frames = {}
    for r, (y0, y1) in enumerate(BANDS):
        for c, (x0, x1) in enumerate(XR):
            sub = a[y0:y1, x0:x1].astype(int); m = np.abs(sub - bg).sum(2) > cfg['thr']
            m = keep_main(m)                                                      # drop specks (the sheet's labels bleed in at the edges)
            ys, xs = np.where(m)
            if not len(ys): continue
            snapped = C[np.argmin(((sub[:, :, None] - C[None, None]) ** 2).sum(3), axis=2)]
            top = ys.min(); head = xs[ys <= top + 3]; hx0 = int(round(head.mean()))
            if name == 'guard':                                                   # a grey pixel next to the face is the neck in shade, not the belt buckle
                grey = np.array(hx('#8a8580')); skin = np.array(hx('#ac7d65'))
                for y, x in zip(ys, xs):
                    if y <= top + 8 and ((snapped[y, x] == C[11]).all() or (snapped[y, x] == C[12]).all()): snapped[y, x] = skin
            cell = np.zeros((CELL_H, CELL_W, 4), np.uint8)
            for y, x in zip(ys, xs):
                cy = GROUND - (ys.max() - y); cx = AX + (x - hx0)
                if 0 <= cy < CELL_H and 0 <= cx < CELL_W: cell[cy, cx, :3] = snapped[y, x]; cell[cy, cx, 3] = 255
            im = Image.fromarray(cell, 'RGBA'); im.save(os.path.join(outdir, f'frame_{r}{c}.png')); frames[(r, c)] = im
    Z = 10; sheet = Image.new('RGBA', (4 * CELL_W * Z, 4 * CELL_H * Z + 0), tuple(cfg['bg']) + (255,)); d = ImageDraw.Draw(sheet)
    for (r, c), im in frames.items():
        sheet.alpha_composite(im.resize((CELL_W * Z, CELL_H * Z), Image.NEAREST), (c * CELL_W * Z, r * CELL_H * Z)); d.text((c * CELL_W * Z + 4, r * CELL_H * Z + 4), f'{r}{c}', fill=(255, 255, 255, 255))
    sheet.save(os.path.join(ROOT, name, 'contact.png'))
    json.dump(dict(palette=['#%02x%02x%02x' % tuple(int(v) for v in col) for col in C]), open(os.path.join(ROOT, name, 'palette.json'), 'w'))
    print(name, 'palette', ['#%02x%02x%02x' % tuple(int(v) for v in col) for col in C])

if __name__ == '__main__':
    run(sys.argv[1])
