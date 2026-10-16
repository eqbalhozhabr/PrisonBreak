#!/usr/bin/env python3
"""Builds the dog's animated sheet from the frames tools/extract-dog.py cut out of the owner's reference (art/reference/13.jpg).
The pixels are the owner's. The sheet gives four DIAGONAL directions per pose (isometric): SE = toward us facing right, SW = toward us facing left, NE = away from us facing right, NW = away facing left.
  * walk: the three walk poses of the sheet, played 1 - 2 - 3 - 2
  * idle: one pose in the sheet; a breath is made by letting the head and chest sink one pixel while the legs stay
usage: python3 tools/build-dog.py [half]     writes art/dog/dog.png + dog.json + dog-preview.gif   (half: use the half-size frames instead)"""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', 'art')
HALF = len(sys.argv) > 1 and sys.argv[1] == 'half'
SUB = 'raw_half' if HALF else 'raw'; Z = 2 if HALF else 1
CW, CH, GROUND, AX = 48 // Z, 42 // Z, 38 // Z, 24 // Z
BG = (53, 39, 74)
DIRS = ['SE', 'SW', 'NE', 'NW']                                    # sheet columns 0..3

def load(rc): return np.array(Image.open(os.path.join(ROOT, 'dog', SUB, f'frame_{rc}.png')).convert('RGBA'))
def bbox(f): ys, xs = np.where(f[..., 3] > 0); return ys.min(), ys.max(), xs.min(), xs.max()

def sink_upper(f, dy=1, frac=.52):
    """head, neck and chest sink `dy` pixels (a breath) while everything from the belly down stays"""
    top, bottom, _, _ = bbox(f); belt = top + int(round((bottom - top) * frac)); out = f.copy(); out[top:belt] = 0
    for y in range(top, belt):
        row = f[y]; mask = row[:, 3] > 0; out[y + dy][mask] = row[mask]
    return out

def build():
    A = {}
    for c, d in enumerate(DIRS):
        base = load(f'0{c}'); down = sink_upper(base); A[('idle', d)] = [base, down, sink_upper(base, 2) if not HALF else down, down]
        A[('walk', d)] = [load(f'1{c}'), load(f'2{c}'), load(f'3{c}'), load(f'2{c}')]
    anims = [('idle', 4, 420), ('walk', 4, 150)]
    sheet = Image.new('RGBA', (4 * CW, len(DIRS) * len(anims) * CH), (0, 0, 0, 0)); rows = []; r = 0
    for d in DIRS:
        for an, n, ms in anims:
            for k, f in enumerate(A[(an, d)]): sheet.paste(Image.fromarray(f, 'RGBA'), (k * CW, r * CH))
            rows.append(dict(name=f'{an}_{d}', view=d, row=r, frames=n, ms=ms, loop=True)); r += 1
    out = os.path.join(ROOT, 'dog'); name = 'dog_half' if HALF else 'dog'; sheet.save(os.path.join(out, f'{name}.png'))
    json.dump(dict(file=f'{name}.png', cell=[CW, CH], anchor=[AX, GROUND], diagonal=True, views=DIRS, source='art/reference/13.jpg',
                   note='ground point (the feet) at the anchor; four diagonal directions, no mirroring needed; pixels are the owner\'s reference, cut by tools/extract-dog.py', rows=rows), open(os.path.join(out, f'{name}.json'), 'w'), indent=1)
    imgs = []
    for k in range(8):
        W = Image.new('RGBA', (CW * 4, CH * 2), BG + (255,))
        for c, d in enumerate(DIRS):
            W.alpha_composite(Image.fromarray(A[('walk', d)][k % 4], 'RGBA'), (c * CW, 0)); W.alpha_composite(Image.fromarray(A[('idle', d)][(k // 2) % 4], 'RGBA'), (c * CW, CH))
        imgs.append(W.resize((W.width * (6 if not HALF else 10), W.height * (6 if not HALF else 10)), Image.NEAREST).convert('P', palette=Image.ADAPTIVE, colors=40))
    imgs[0].save(os.path.join(out, f'{name}-preview.gif'), save_all=True, append_images=imgs[1:], duration=150, loop=0, disposal=2)
    return A

if __name__ == '__main__':
    build(); print('built dog', 'half' if HALF else 'full')
