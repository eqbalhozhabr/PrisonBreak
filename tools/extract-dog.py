#!/usr/bin/env python3
"""Cuts the guard dog out of the owner's reference sheet (art/reference/13.jpg) - the pixels are the owner's.
The sheet is a 200 x 200 pixel image enlarged 10x. Four columns are four diagonal directions (toward us facing right / left, away from us facing right / left),
the first row is idle, the next three rows are three walk poses. The dog was drawn about 33 px tall next to people of 20 px, so besides the full-size
frames this also writes a half-size set (2 x 2 blocks -> 1 pixel by majority, which also drops the 1-px black outline the people do not have).
usage: python3 tools/extract-dog.py     writes art/dog/raw/frame_<row><col>.png (full) and art/dog/raw_half/..., plus contact sheets"""
import importlib.util, json, os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', 'art')
spec = importlib.util.spec_from_file_location('ex', os.path.join(HERE, 'extract-sprites.py')); EX = importlib.util.module_from_spec(spec); _a = sys.argv; sys.argv = ['x']; spec.loader.exec_module(EX); sys.argv = _a
N, P = 200, 10
BG = (53, 39, 74)
SEEDS = ['#2f201b', '#010002', '#723b20', '#6b381f', '#502a1a', '#914c25', '#1d1311', '#b73723', '#844725', '#db6127', '#8a8683', '#902622']
CELL_W, CELL_H, GROUND, AX = 48, 42, 38, 24                      # a full-size cell (the half-size cell is exactly half of this)

def hx(h): return [int(h[i:i + 2], 16) for i in (1, 3, 5)]

def sample(path):
    im = np.array(Image.open(path).convert('RGB')).astype(float); out = np.zeros((N, N, 3), np.uint8)
    for j in range(N):
        for i in range(N): out[j, i] = np.median(im[j * P + 2:j * P + 8, i * P + 2:i * P + 8].reshape(-1, 3), axis=0)
    return out

def components(mask):
    h, w = mask.shape; lab = np.zeros((h, w), int); n = 0; boxes = {}
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not lab[y, x]:
                n += 1; st = [(y, x)]; lab[y, x] = n; ys = [y]; xs = [x]
                while st:
                    cy, cx = st.pop()
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; st.append((ny, nx)); ys.append(ny); xs.append(nx)
                boxes[n] = (min(ys), max(ys) + 1, min(xs), max(xs) + 1, len(ys))
    return lab, boxes

def dilate(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1): out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out

def drop_outline(f):
    """the people have no outline: every pixel of the 1-px black outline takes the commonest colour of its non-outline neighbours (a pixel with none stays as it is)"""
    h, w = f.shape[:2]; out = f.copy(); outline = lambda c: sum(int(v) for v in c[:3]) < 30
    for y in range(h):
        for x in range(w):
            if f[y, x, 3] > 0 and outline(f[y, x]):
                cnt = {}
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and f[ny, nx, 3] > 0 and not outline(f[ny, nx]): c = tuple(int(v) for v in f[ny, nx]); cnt[c] = cnt.get(c, 0) + 1
                if cnt: out[y, x, :3] = max(cnt, key=cnt.get)[:3]
    return out

def half(f):
    """2 x 2 blocks -> one pixel: solid when at least 2 of its 4 pixels are, coloured by the commonest colour of the block (on a tie the darker one)"""
    h, w = f.shape[:2]; out = np.zeros((h // 2, w // 2, 4), np.uint8)
    for y in range(h // 2):
        for x in range(w // 2):
            blk = [tuple(int(v) for v in f[2 * y + dy, 2 * x + dx]) for dy in (0, 1) for dx in (0, 1) if f[2 * y + dy, 2 * x + dx, 3] > 0]
            if len(blk) >= 2:
                cnt = {}
                for c in blk: cnt[c] = cnt.get(c, 0) + 1
                best = max(cnt.values()); out[y, x] = min([c for c in blk if cnt[c] == best], key=lambda c: sum(c[:3]))
    return out

def run():
    a = sample(os.path.join(ROOT, 'reference', '13.jpg')); bg = np.array(BG)
    fg = np.abs(a.astype(int) - bg).sum(2) > 40; white = dilate(a.min(2) > 170, 2); fg &= ~white
    lab, boxes = components(dilate(fg, 2)); big = [b for b in boxes.values() if b[4] > 120]
    cy = sorted(b[0] for b in big); rows = [[], [], [], []]
    ordered = sorted(big, key=lambda b: (b[0] + b[1]) / 2)
    for k, b in enumerate(ordered): rows[min(3, k // 4)].append(b)
    assert all(len(r) == 4 for r in rows), [len(r) for r in rows]
    pal = np.array([hx(c) for c in SEEDS], float); X = a[fg].astype(float); C = pal.copy()
    for _ in range(20):
        l = np.argmin(((X[:, None] - C[None]) ** 2).sum(2), axis=1); C = np.array([X[l == i].mean(0) if (l == i).any() else C[i] for i in range(len(C))])
    C = np.round(C).astype(int)
    for sub in ('raw', 'raw_half'): os.makedirs(os.path.join(ROOT, 'dog', sub), exist_ok=True)
    frames = {}
    for r, row in enumerate(rows):
        for c, b in enumerate(sorted(row, key=lambda b: b[2])):
            y0, y1, x0, x1 = max(0, b[0] - 1), min(N, b[1] + 1), max(0, b[2] - 1), min(N, b[3] + 1)
            m = EX.keep_main(fg[y0:y1, x0:x1]); sub = a[y0:y1, x0:x1].astype(int); ys, xs = np.where(m)
            snapped = C[np.argmin(((sub[:, :, None] - C[None, None]) ** 2).sum(3), axis=2)]
            cx = int(round(xs.mean())); cell = np.zeros((CELL_H, CELL_W, 4), np.uint8)
            for y, x in zip(ys, xs):
                ty = GROUND - (ys.max() - y); tx = AX + (x - cx)
                if 0 <= ty < CELL_H and 0 <= tx < CELL_W: cell[ty, tx, :3] = snapped[y, x]; cell[ty, tx, 3] = 255
            Image.fromarray(cell, 'RGBA').save(os.path.join(ROOT, 'dog', 'raw', f'frame_{r}{c}.png')); frames[(r, c)] = cell
            Image.fromarray(half(drop_outline(cell)), 'RGBA').save(os.path.join(ROOT, 'dog', 'raw_half', f'frame_{r}{c}.png'))
    for sub, Z, cw, chh in (('raw', 6, CELL_W, CELL_H), ('raw_half', 12, CELL_W // 2, CELL_H // 2)):
        sheet = Image.new('RGBA', (4 * cw * Z, 4 * chh * Z), BG + (255,)); d = ImageDraw.Draw(sheet)
        for (r, c), cell in frames.items():
            im = Image.open(os.path.join(ROOT, 'dog', sub, f'frame_{r}{c}.png')); sheet.alpha_composite(im.resize((cw * Z, chh * Z), Image.NEAREST), (c * cw * Z, r * chh * Z)); d.text((c * cw * Z + 4, r * chh * Z + 4), f'{r}{c}', fill=(255, 255, 255, 255))
        sheet.save(os.path.join(ROOT, 'dog', f'contact_{sub}.png'))
    json.dump(dict(palette=['#%02x%02x%02x' % tuple(int(v) for v in col) for col in C]), open(os.path.join(ROOT, 'dog', 'palette.json'), 'w'))
    print('dog frames', len(frames))

if __name__ == '__main__':
    run()
