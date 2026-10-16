#!/usr/bin/env python3
"""The guard sprite, same skeleton idea as tools/make-thief.py (and the same cell, anchor and manifest format) so the two always fit together.
Pixel art only, no outline, light from the upper left, flat tones: blue uniform, cap with a gold badge, brown belt, holster and boots.
Views: S (toward us), N (away), E (profile facing right; W is its mirror).  Animations: idle (4 frames, a bored but watchful stand), walk (6 frames, an upright patrol).
usage: python3 tools/make-guard.py [outdir]"""
import importlib.util, json, math, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('thief', os.path.join(HERE, 'make-thief.py')); T = importlib.util.module_from_spec(spec)
_argv, sys.argv = sys.argv, ['x']; spec.loader.exec_module(T); sys.argv = _argv
Grid, seg, ik, CW, CH, GX, GY = T.Grid, T.seg, T.ik, T.CW, T.CH, T.GX, T.GY
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'art', 'guard')

def hx(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
SH_L, SH, SH_S = hx('#3d6288'), hx('#2f4f72'), hx('#223a58')            # shirt: lit, mid, shade
TR_L, TR, TR_S = hx('#3a5c82'), hx('#2b4a6c'), hx('#1c3350')            # trousers
CAP_D = hx('#0f1a28')                                                    # cap band and brim
GOLD, GOLD_S = hx('#e8b04c'), hx('#b8832f')
SK_L, SK, SK_S = hx('#efc29a'), hx('#dba27c'), hx('#b87a5c')
HR, HR_S = hx('#6b4332'), hx('#4a2c20')
BELT, BELT_S, BUCKLE = hx('#5a3a26'), hx('#3d2517'), hx('#9a9aa2')
HOLS, HOLS_L = hx('#241410'), hx('#3a2418')
BOOT, BOOT_L, BOOT_S = hx('#3a2418'), hx('#573522'), hx('#25140c')
EYE = hx('#16131f')
FAR = hx('#0f1b2c')                                                      # the far leg, clearly darker than the near one

def tube(g, a, b, ra, rb, tones, far=False, flat=False):
    lit, mid, sh = tones
    def inside(x, y): d, t, _ = seg(x, y, a, b); return d <= ra + (rb - ra) * t
    def color(x, y):
        d, t, (qx, qy) = seg(x, y, a, b); r = ra + (rb - ra) * t; n = ((x - qx) * -.8 + (y - qy) * .6) / max(r, .5)
        if far: return FAR
        if flat: return sh if n < -.6 else mid
        return lit if n > .5 else sh if n < -.5 else mid
    g.paint(inside, color)

def boot(g, foot, view):
    fx, fy = foot
    if view == 'E':
        g.paint(lambda x, y: fx - 1.2 <= x <= fx + 2.7 and fy - 1.2 <= y <= fy + .9, lambda x, y: BOOT_L if (y > fy + .1 and x < fx + 1.0) else BOOT_S if y < fy - .6 else BOOT)
    else:
        g.paint(lambda x, y: abs(x - fx) <= 1.7 and fy - 1.2 <= y <= fy + .9, lambda x, y: BOOT_L if (x < fx - .5 and y > fy - .2) else BOOT_S if (x > fx + .8 or y < fy - .6) else BOOT)

def hand(g, w, far=False):
    g.paint(lambda x, y: abs(x - w[0]) <= 1.0 and abs(y - w[1]) <= 1.0, lambda x, y: SK_S if far else SK)

def cap(g, cx, cy, view, sway=0.0):
    """cy is the top of the forehead: the band sits on it, the crown above, a gold badge in the middle (front) and a brim"""
    if view == 'E':
        g.paint(lambda x, y: ((x - cx + .6) / 4.7) ** 2 + ((y - cy - 2.4) / 2.5) ** 2 <= 1 and y > cy, lambda x, y: SH_L if (x < cx - 2.0 and y > cy + 2.0) else SH_S if y < cy + 1.0 else SH)
        g.paint(lambda x, y: cx - 4.3 <= x <= cx + 3.2 and cy - 1.0 <= y <= cy + .9, lambda x, y: CAP_D)
        g.paint(lambda x, y: cx + 3.0 <= x <= cx + 5.6 and cy - .1 <= y <= cy + .9, lambda x, y: CAP_D)                   # the brim
        g.put(cx + 1.4, cy + 2.0, GOLD); g.put(cx + 2.0, cy + 2.0, GOLD)
        return
    g.paint(lambda x, y: ((x - cx) / 5.2) ** 2 + ((y - cy - 2.4) / 2.6) ** 2 <= 1 and y > cy, lambda x, y: SH_L if (x < cx - 3.0 and y > cy + 1.8) else SH_S if (x > cx + 3.2 or y < cy + 1.0) else SH)
    g.paint(lambda x, y: abs(x - cx) <= 4.3 and cy - 1.0 <= y <= cy + .9, lambda x, y: CAP_D)
    if view == 'S':
        g.paint(lambda x, y: abs(x - cx) <= 5.1 and cy - 1.0 <= y <= cy - .1, lambda x, y: CAP_D)                          # the visor
        g.paint(lambda x, y: -1.0 <= x - cx <= 1.0 and cy + 1.6 <= y <= cy + 3.4, lambda x, y: GOLD_S if (x - cx > .2) else GOLD)

def head(g, c, view, turn=0.0, blink=False):
    cx, cy = c                                           # cy = forehead line; the chin is 4.6 below
    chin = cy - 4.6
    if view == 'N':
        g.paint(lambda x, y: abs(x - cx) <= 3.2 and chin + .2 <= y <= cy, lambda x, y: HR_S if (y < chin + 1.6) else HR)                       # hair at the nape
        g.paint(lambda x, y: 3.0 <= abs(x - cx) <= 4.2 and cy - 3.0 <= y <= cy - 1.0, lambda x, y: SK_S if x > cx else SK)                   # ears
        g.paint(lambda x, y: abs(x - cx) <= 2.1 and chin - .4 <= y <= chin + .3, lambda x, y: SK_S)
        cap(g, cx, cy, 'N'); return
    if view == 'S':
        fx = cx + turn * .9
        g.paint(lambda x, y: abs(x - fx) <= 3.2 and chin <= y <= cy and not (abs(x - fx) > 2.4 and y < chin + 1.0), lambda x, y: SK_L if (x < fx - 1.6) else SK_S if (x > fx + 1.9 or y < chin + .9) else SK)
        g.paint(lambda x, y: 3.0 <= abs(x - cx) <= 4.0 and cy - 3.2 <= y <= cy, lambda x, y: HR_S if x > cx else HR)                          # side hair
        if not blink: g.put(fx - 1.6, cy - 2.6, EYE); g.put(fx + 1.0, cy - 2.6, EYE)
        g.put(fx - .3, cy - 3.8, SK_S); g.put(fx + .5, cy - 3.8, SK_S)                                                                       # nose / mouth shadow
        cap(g, cx, cy, 'S'); return
    fx = cx + .9 + turn * .6
    g.paint(lambda x, y: ((x - fx) / 3.0) ** 2 + ((y - cy + 2.4) / 2.5) ** 2 <= 1.0 and y <= cy, lambda x, y: SK_L if (x < fx - 1.2 and y > cy - 3.4) else SK_S if y < chin + .8 else SK)
    g.put(fx + 2.6, cy - 2.6, SK)                                                                           # nose
    if not blink: g.put(fx + 1.2, cy - 2.0, EYE)
    g.paint(lambda x, y: cx - 3.8 <= x <= cx - .4 and cy - 4.0 <= y <= cy, lambda x, y: HR_S if x < cx - 2.4 else HR)                         # hair at the back
    g.put(cx - .2, cy - 2.2, SK_S)                                                                                                           # the ear
    cap(g, cx, cy, 'E')

# ------------------------------------------------------------------------------------------------------ poses
H0 = 12.8
def pose_for(view, anim, k, n):
    if anim == 'idle':
        breath = [0, .5, .5, 0][k]; turn = [0, 0, -1.0, .9][k]
        return dict(hipy=H0, breath=breath, turn=turn, blink=(k == 1), lean=0.3, armswing=0.0, foot=[(-1.4, 0), (1.6, 0)] if view == 'E' else [(0, 0), (0, 0)], hand_up=[0, .4, .4, 0][k])
    S, LIFT = 6.0, 1.7; ph = k / n
    def foot(p):
        p %= 1.0
        if p < .55: return (S / 2 - S * p / .55, 0.0)
        u = (p - .55) / .45; return (-S / 2 + S * u, LIFT * math.sin(math.pi * u))
    a, b = foot(ph), foot(ph + .5)
    return dict(hipy=H0 - .55 * (.5 + .5 * math.cos(4 * math.pi * ph)), breath=0, turn=0, blink=False, lean=.5, armswing=math.sin(2 * math.pi * ph + math.pi), foot=[a, b], hand_up=0)

def draw(view, pose):
    g = Grid(); hipy = pose['hipy']; lean = pose['lean']; E = view == 'E'
    waist = hipy + 1.0; shoulder = waist + 8.0 + pose['breath'] * .5; sgn = 1 if view == 'S' else -1
    neck = (lean if E else 0.0, shoulder)
    cxh = neck[0] + (.8 if E else 0.0); cyh = shoulder + 4.9                                   # forehead line
    if E:
        hip = (0.0, hipy); legs = []
        for n, f in enumerate(pose['foot']):
            fp = (f[0], f[1] + 1.2); legs.append((n, hip, ik(hip, fp, 6.1, 6.1, +1), fp))
        for n, hp, kn, fp in sorted(legs, key=lambda t: 0 if t[0] == 1 else 1):
            far = n == 1
            tube(g, hp, kn, 1.7, 1.55, (TR_L, TR, TR_S), far, True); tube(g, kn, fp, 1.55, 1.4, (TR_L, TR, TR_S), far, True); boot(g, (fp[0], fp[1] - 1.2 + 1.2), 'E')
        sw = pose['armswing'] * 24 * math.pi / 180
        def arm(shd, swing, bend, far):
            e = (shd[0] + math.sin(swing) * 4.6, shd[1] - math.cos(swing) * 4.6); wa = swing + bend; w = (e[0] + math.sin(wa) * 4.2, e[1] - math.cos(wa) * 4.2)
            tube(g, shd, e, 1.45, 1.3, (SH_L, SH, SH_S), far); tube(g, e, w, 1.3, 1.1, (SH_L, SH, SH_S), far); hand(g, (w[0], w[1] - .9), far)
        arm((neck[0] - .2, shoulder - 1.0), -sw, .22, True)
        def inside(x, y):
            t = (y - waist) / (shoulder - waist); return -.02 <= t <= 1.0 and abs(x - lean * t * .8) <= 3.3 + .3 * t
        g.paint(inside, lambda x, y: SH_L if x - lean * ((y - waist) / (shoulder - waist)) * .8 < -1.6 else SH_S if x - lean * ((y - waist) / (shoulder - waist)) * .8 > 2.0 else SH)
        g.paint(lambda x, y: waist - .6 <= y <= waist + 1.0 and abs(x) <= 3.0, lambda x, y: BELT_S if x > 1.6 else BELT)
        g.paint(lambda x, y: -2.4 <= x <= -.4 and waist - 4.6 <= y <= waist + .4, lambda x, y: HOLS_L if x < -1.6 else HOLS)                      # holster at the back of the hip
        g.put(neck[0] + 2.0, shoulder - 2.6, GOLD)
        arm((neck[0] + .2, shoulder - 1.0), sw, .3 + (.15 if pose['hand_up'] else 0), False)
    else:
        for n, f in enumerate(pose['foot']):
            side = -1 if n == 0 else 1; fy = f[1] - sgn * f[0] * .24 + 1.2
            hp = (side * 1.8, hipy); fp = (side * 2.0, fy)
            tube(g, hp, fp, 1.75, 1.55, (TR_L, TR, TR_S)); boot(g, (fp[0], fp[1] - 1.2 + 1.2), view)
        hs = 'left' if view == 'S' else 'right'                                                                                            # the holster is on the guard's right hip
        hx0 = -4.4 if view == 'S' else 2.9
        g.paint(lambda x, y: hx0 <= x <= hx0 + 1.6 and waist - 5.0 <= y <= waist + .4, lambda x, y: HOLS_L if x < hx0 + .8 else HOLS)
        def inside(x, y):
            t = (y - waist) / (shoulder - waist)
            if not (-.02 <= t <= 1.0): return False
            hw = 3.7 + .9 * t; return abs(x) <= hw and not (t > .88 and abs(x) > hw - .9)
        g.paint(inside, lambda x, y: SH_L if x < -2.6 else SH_S if x > 2.6 else SH)
        g.paint(lambda x, y: waist - .6 <= y <= waist + 1.0 and abs(x) <= 3.9, lambda x, y: BELT_S if x > 2.0 else BELT)
        if view == 'S':
            g.paint(lambda x, y: -.9 <= x <= .9 and waist - .6 <= y <= waist + 1.0, lambda x, y: BUCKLE)
            g.paint(lambda x, y: 0 <= x <= 1 and waist + 1.0 <= y <= shoulder - .8, lambda x, y: SH_S)                                    # the placket
            g.paint(lambda x, y: 1.6 <= x <= 3.2 and shoulder - 3.6 <= y <= shoulder - 2.0, lambda x, y: GOLD_S if y < shoulder - 3.0 else GOLD)  # chest badge
            g.paint(lambda x, y: abs(x) <= 1.8 and shoulder - .2 <= y <= shoulder + .6, lambda x, y: SH_L)                                     # collar
        g.paint(lambda x, y: abs(x) <= 1.3 and shoulder + .4 <= y <= shoulder + 1.2, lambda x, y: SK_S)                                       # neck
        sw = pose['armswing']
        for side in (-1, 1):
            f = sw * side * -1; sx = side * 5.4; sy = shoulder - 1.0
            w = (sx + side * .3, waist - .6 + (f * 1.0 if view == 'S' else -f * 1.0) + pose['hand_up'] * .8); e = ((sx + w[0]) / 2 + side * .2, (sy + w[1]) / 2)
            tube(g, (sx, sy), w, 1.5, 1.3, (SH_L, SH, SH_S)); hand(g, (w[0], w[1] - 1.4), side > 0)
    head(g, (cxh, cyh), view, turn=pose['turn'], blink=pose['blink'])
    return g.image()

ANIMS = [('idle', 4, 560, True), ('walk', 6, 110, True)]
VIEWS = ['S', 'N', 'E']

def build():
    os.makedirs(OUT, exist_ok=True); cols = 6; rows = len(VIEWS) * len(ANIMS)
    sheet = Image.new('RGBA', (cols * CW, rows * CH), (0, 0, 0, 0)); meta = []; r = 0
    for v in VIEWS:
        for name, n, ms, loop in ANIMS:
            for k in range(n): sheet.paste(draw(v, pose_for(v, name, k, n)), (k * CW, r * CH))
            meta.append(dict(name=f'{name}_{v}', view=v, row=r, frames=n, ms=ms, loop=loop)); r += 1
    sheet.save(os.path.join(OUT, 'guard.png'))
    json.dump(dict(file='guard.png', cell=[CW, CH], anchor=[GX, GY], mirror_left_from='E', note='ground point (the feet) at the anchor; W is the mirror of E', rows=meta), open(os.path.join(OUT, 'guard.json'), 'w'), indent=1)
    return sheet, meta

if __name__ == '__main__':
    sheet, meta = build(); print('wrote', os.path.join(OUT, 'guard.png'), sheet.size)
