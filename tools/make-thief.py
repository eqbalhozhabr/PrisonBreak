#!/usr/bin/env python3
"""The prisoner sprite, built from a small skeleton so that every frame is the same person: legs by two-bone IK, arms, torso, head, hair.
Pixel art only (no anti-aliasing), no outline, light from the upper left, flat tones: cream and dark stripes, orange hair, a yellow belt, orange shoes.
Views: S (toward us), N (away from us), E (profile facing right; W is its mirror).
Animations: idle (4 frames, a wary crouch with a glance), sneak (6 frames, a low careful walk).  usage: python3 tools/make-thief.py [outdir]"""
import json, math, os, sys
from PIL import Image

CW, CH, GX, GY = 24, 36, 12, 33                        # one cell, and where the ground point (the feet) is inside it
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'art', 'thief')

def hx(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
HAIR, HAIR_L, HAIR_S = hx('#d9692a'), hx('#f08f48'), hx('#b3452f')
SKIN, SKIN_L, SKIN_S = hx('#d99872'), hx('#efc890'), hx('#a8664f')
CREAM, CREAM_L, CREAM_S = hx('#e8e8ee'), hx('#fbfbff'), hx('#a4a4b6')
DARK, DARK_L, DARK_S = hx('#1d1e2a'), hx('#383a4c'), hx('#11111a')
BELT, BELT_S = hx('#eab45e'), hx('#b0803a')
SHOE, SHOE_L, SHOE_S = hx('#da8a52'), hx('#f4b878'), hx('#a65e3a')
EYE = hx('#16131f')

class Grid:
    def __init__(self): self.p = [[None] * CW for _ in range(CH)]
    def put(self, x, y, c):                               # figure coordinates: x right, y up from the ground point
        i, j = int(math.floor(GX + x)), int(math.floor(GY - y))
        if 0 <= i < CW and 0 <= j < CH: self.p[j][i] = c
    def paint(self, inside, color, box=(-12, 0, 12, 36)):
        x0, y0, x1, y1 = box
        for j in range(CH):
            for i in range(CW):
                x, y = i + .5 - GX, GY - (j + .5)
                if x0 <= x <= x1 and y0 - 3 <= y <= y1 and inside(x, y):
                    c = color(x, y)
                    if c is not None: self.p[j][i] = c
    def image(self):
        im = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); px = im.load()
        for j in range(CH):
            for i in range(CW):
                if self.p[j][i]: px[i, j] = self.p[j][i] + (255,)
        return im

def seg(px, py, a, b):                                  # distance from a point to a segment, and where along it (0..1)
    dx, dy = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dy * dy or 1e-9
    t = max(0, min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L2)); qx, qy = a[0] + dx * t, a[1] + dy * t
    return math.hypot(px - qx, py - qy), t, (qx, qy)

def limb(g, a, b, ra, rb, stripes, phase=0.0, shade=0):
    """a capsule from a to b; stripes run across the limb: even bands cream, odd bands dark; the upper-left edge is lit, the lower-right edge in shadow"""
    L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
    def inside(x, y): d, t, _ = seg(x, y, a, b); return d <= ra + (rb - ra) * t
    def color(x, y):
        d, t, (qx, qy) = seg(x, y, a, b); r = ra + (rb - ra) * t; n = ((x - qx) * -.8 + (y - qy) * .6) / max(r, .5)      # + means towards the light
        band = int(math.floor((y + phase) / stripes)) % 2          # stripes stay horizontal, like the reference
        lit, sh = False, n < -.55 or shade == 1
        if band == 0: return CREAM_L if lit else CREAM_S if sh else CREAM
        return DARK_L if lit else DARK_S if sh else DARK
    g.paint(inside, color)

def torso(g, waist, neck, w_waist, w_sh, stripe_phase=0.0, belt=True, shade=0):
    ax, ay = neck[0] - waist[0], neck[1] - waist[1]; L = math.hypot(ax, ay); ux, uy = ax / L, ay / L; nx, ny = uy, -ux       # along the spine, and across it
    def frame(x, y): rx, ry = x - waist[0], y - waist[1]; return (rx * ux + ry * uy) / L, rx * nx + ry * ny
    def inside(x, y): t, s = frame(x, y); return -.02 <= t <= 1.0 and abs(s) <= w_waist + (w_sh - w_waist) * t
    def color(x, y):
        t, s = frame(x, y); hw = w_waist + (w_sh - w_waist) * t; n = s / max(hw, .5)       # s > 0 is the right side of the spine
        if belt and t * L < 1.2: return BELT_S if (n > .3 or shade) else BELT
        band = int(math.floor((t * L + stripe_phase) / 2)) % 2; lit, sh = n < -.45 and shade == 0, n > .4 or shade == 1
        if band == 0: return CREAM_L if lit else CREAM_S if sh else CREAM
        return DARK_L if lit else DARK_S if sh else DARK
    g.paint(inside, color)

def ik(hip, foot, l1, l2, bend):                        # two-bone leg: where the knee goes (bend = +1 knee forward/right, -1 backward)
    dx, dy = foot[0] - hip[0], foot[1] - hip[1]; d = min(math.hypot(dx, dy), l1 + l2 - .01); d = max(d, abs(l1 - l2) + .01)
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d); h = math.sqrt(max(l1 * l1 - a * a, 0)); ux, uy = dx / (math.hypot(dx, dy) or 1), dy / (math.hypot(dx, dy) or 1)
    return (hip[0] + ux * a - uy * h * bend, hip[1] + uy * a + ux * h * bend)

def shoe(g, foot, facing=0, view='E', lifted=0):
    fx, fy = foot
    if view == 'E':
        def inside(x, y): return fx - 1.2 <= x <= fx + 2.2 and fy - .5 <= y <= fy + 1.6
        g.paint(inside, lambda x, y: SHOE_L if (y > fy + .9 and x < fx + .8) else SHOE_S if y < fy + .1 else SHOE)
    else:
        def inside(x, y): return abs(x - fx) <= 1.7 and fy - .5 <= y <= fy + 1.8
        g.paint(inside, lambda x, y: SHOE_L if x < fx - .6 else SHOE_S if (x > fx + .7 or y < fy + .1) else SHOE)

def head(g, c, view, turn=0.0, tilt=0.0, sway=0.0, blink=False):
    cx, cy = c
    if view == 'N':                                     # from behind: all hair, a nape
        def inside(x, y): return ((x - cx) / 4.5) ** 2 + ((y - cy - .6) / 4.8) ** 2 <= 1
        def color(x, y): n = -(x - cx) / 4.5; return HAIR_L if (n > .5 and y > cy) else HAIR_S if (n < -.5 or y < cy - 2.2) else HAIR
        g.paint(inside, color); g.paint(lambda x, y: abs(x - cx - sway) <= 1.3 and cy - 5.1 <= y <= cy - 3.8, lambda x, y: SKIN_S)
        g.paint(lambda x, y: abs(x - cx - 3.4 - sway * 1.4) <= 1.0 and cy - 4.8 <= y <= cy - 1.4 and ((x - cx - 3.4) ** 2 + 0) < 1.2, lambda x, y: HAIR_S)
        return
    if view == 'S':
        g.paint(lambda x, y: ((x - cx) / 4.4) ** 2 + ((y - cy - .5) / 4.7) ** 2 <= 1, lambda x, y: HAIR_S if (x > cx + 2.4 or y < cy - 2.6) else HAIR_L if (x < cx - 2.2 and y > cy) else HAIR)              # hair, a bob
        fx = cx + turn * 1.1 + .3
        g.paint(lambda x, y: ((x - fx) / 2.9) ** 2 + ((y - cy + 1.0) / 3.3) ** 2 <= 1 and not (y > cy + 1.1 and x < fx + 1.2), lambda x, y: SKIN_L if (x < fx - 1.2 and y > cy - 2.0) else SKIN_S if (x > fx + 1.4 or y < cy - 3.2) else SKIN)
        if not blink: g.put(fx - .8, cy - .6, EYE); g.put(fx + 1.2, cy - .6, EYE)
        g.paint(lambda x, y: abs(x - cx + 4.2) <= 1.1 and cy - 4.8 <= y <= cy - .5, lambda x, y: HAIR if x < cx - 4 else HAIR_L)   # a lock down the left
        g.paint(lambda x, y: abs(x - cx - 3.9) <= .9 and cy - 3.8 <= y <= cy - .2, lambda x, y: HAIR_S)
        return
    # E: profile facing right; hair behind and above, the face in front
    g.paint(lambda x, y: ((x - cx + .8 + sway) / 4.3) ** 2 + ((y - cy - .5) / 4.6) ** 2 <= 1, lambda x, y: HAIR_S if (y < cy - 2.4 or x < cx - 3.2) else HAIR_L if (x < cx - 1 and y > cy + 1.5) else HAIR)
    fx = cx + 1.0 + turn * .8
    g.paint(lambda x, y: ((x - fx) / 2.6) ** 2 + ((y - cy + .9) / 3.1) ** 2 <= 1 and not (y > cy + 1.0 and x < fx + .4), lambda x, y: SKIN_L if (x < fx - .6 and y > cy - 1.5) else SKIN_S if (y < cy - 3.0) else SKIN)
    g.put(fx + 1.0, cy - 1.0, SKIN_S); g.put(fx + 2.2, cy - 1.6, SKIN)                           # a nose
    if not blink: g.put(fx + .6, cy - .5, EYE)
    g.paint(lambda x, y: cx - 4.8 + sway <= x <= cx - 3.0 + sway and cy - 4.6 <= y <= cy + .5, lambda x, y: HAIR if y > cy - 2.5 else HAIR_S)   # the bob's back

# ------------------------------------------------------------------------------------------------------ poses
H0 = 13.2                                               # hip height in the crouch (the standing height would be 14.5): a thief keeps low
def sneak_pose(view, phi, idle=False, k=0):
    """returns the joints for a view at phase phi (0..1 of the walk) or, when idle, for idle frame k (0..3)"""
    S, LIFT = 5.2, 2.2
    if idle:
        breath = [0.0, .55, .55, 0.0][k]; lookx = [0, 0, -1.0, .8][k]; hipy = H0 + .5 - [0, 0, .25, 0][k]
        pose = dict(hipy=hipy, lean=2.0, breath=breath, turn=lookx, headdy=0.0, sway=[0, .3, 0, -.3][k], foot=[(-1.2, 0), (1.6, 0)] if view == 'E' else [(-2.4, 0), (2.4, 0)], blink=(k == 1), armswing=0.0, phi=0)
        return pose
    def foot(ph):                                       # one foot along the cycle: ground, pushed back, then lifted and swung forward
        ph %= 1.0
        if ph < .55: return (S / 2 - S * ph / .55, 0.0, False)
        u = (ph - .55) / .45; return (-S / 2 + S * u, LIFT * math.sin(math.pi * u), True)
    a, b = foot(phi), foot(phi + .5)
    hipy = H0 - .8 * (.5 + .5 * math.cos(4 * math.pi * phi))
    return dict(hipy=hipy, lean=3.2, breath=0.0, turn=.0, headdy=-.6, sway=-.9 * math.sin(2 * math.pi * phi - .6), foot=[(a[0], a[1]), (b[0], b[1])], armswing=math.sin(2 * math.pi * phi + math.pi), phi=phi, blink=False)

def draw(view, pose, ph):
    g = Grid(); hipy = pose['hipy']; lean = pose['lean']; breath = pose['breath']
    torso_top = hipy + 8.2 + breath * .4 - (0 if view == 'E' else lean * .35); waist = (0, hipy + 1.0); neck = (lean if view == 'E' else 0.0, torso_top)
    head_c = (neck[0] + (1.4 if view == 'E' else 0.0), torso_top + 4.2 + pose['headdy'] - .2)
    if view == 'E':
        l1 = l2 = 7.0; hip = (0, hipy)
        legs = []
        for n, f in enumerate(pose['foot']):
            fp = (f[0], f[1] + 1.0); knee = ik(hip, fp, l1, l2, +1); legs.append((n, hip, knee, fp))
        for n, hp, kn, fp in sorted(legs, key=lambda t: -t[3][0] * 0 + (0 if t[0] == 1 else 1)):    # leg 1 is the far one (drawn first, in shadow)
            far = (n == 1)
            limb(g, hp, kn, 1.55, 1.35, 2, phase=0, shade=1 if far else 0); limb(g, kn, fp, 1.35, 1.2, 2, phase=(l1) % 2, shade=1 if far else 0); shoe(g, (fp[0], fp[1] - 1.0), 0, 'E')
        # far arm, torso, near arm
        sh = (neck[0] - .6, torso_top - .8); sw = pose['armswing'] * 12 * math.pi / 180
        def arm(shd, swing, bend, shade):
            up, fo = 4.8, 4.2; e = (shd[0] + math.sin(swing) * up, shd[1] - math.cos(swing) * up); wang = swing + bend; w = (e[0] + math.sin(wang) * fo, e[1] - math.cos(wang) * fo)
            limb(g, shd, e, 1.0, .9, 2, shade=shade); limb(g, e, w, .9, .8, 2, phase=1, shade=shade)
            g.paint(lambda x, y: abs(x - w[0]) <= .8 and abs(y - w[1]) <= .8, lambda x, y: SKIN_S if shade else SKIN)
        arm((sh[0] - .4, sh[1]), -sw + .1, .62, 1)
        torso(g, waist, neck, 2.2, 2.6, shade=0)
        arm(sh, sw + .1, .75 + (.1 if idle_flag(pose) else 0), 0)
    else:
        sgn = 1 if view == 'S' else -1                  # toward us: the leading foot is lower on screen; away: higher
        for n, f in enumerate(pose['foot']):
            side = -1 if n == 0 else 1; fx0 = (-2.0 if n == 0 else 2.0) if view != 'S' else (-2.0 if n == 0 else 2.0)
            fpy = f[1] - sgn * f[0] * .26 + 1.0; fp = (fx0 + (0 if f[1] < .3 else .2 * side), fpy); hp = (side * 1.7 + lean * .0, hipy); knee = ((hp[0] + fp[0]) / 2 + side * .3, (hp[1] + fp[1]) / 2 + .2)
            limb(g, hp, knee, 1.5, 1.3, 2, phase=0, shade=0); limb(g, knee, fp, 1.3, 1.2, 2, phase=hipy % 2, shade=0); shoe(g, (fp[0], fp[1] - 1.0), 0, view)
        torso(g, waist, neck, 2.7, 3.5)
        sw = pose['armswing']
        for side in (-1, 1):
            f = sw * side * -1; sx = neck[0] + side * 3.7; sy = torso_top - .6
            e = (sx + side * .5, sy - 5.0 + (f * .5 if view == 'S' else -f * .5)); w = (sx + side * .3, sy - 9.6 + (f * 1.0 if view == 'S' else -f * 1.0))
            limb(g, (sx, sy), e, 1.0, .9, 2, shade=1 if side > 0 else 0); limb(g, e, w, .9, .8, 2, phase=1, shade=1 if side > 0 else 0)
            g.paint(lambda x, y, w=w: abs(x - w[0]) <= .8 and abs(y - w[1]) <= .8, lambda x, y, side=side: SKIN_S if side > 0 else SKIN)
    head(g, head_c, view, turn=pose['turn'], sway=pose['sway'], blink=pose.get('blink', False))
    return g.image()

def idle_flag(p): return p.get('phi', 0) == 0 and p.get('armswing', 0) == 0

ANIMS = [('idle', 4, 520, True), ('sneak', 6, 100, True)]            # name, frames, ms per frame, loops
VIEWS = ['S', 'N', 'E']

def build():
    os.makedirs(OUT, exist_ok=True); cols = 6; rows = len(VIEWS) * len(ANIMS)
    sheet = Image.new('RGBA', (cols * CW, rows * CH), (0, 0, 0, 0)); meta = []
    r = 0
    for v in VIEWS:
        for name, n, ms, loop in ANIMS:
            for k in range(n):
                pose = sneak_pose(v, k / n, idle=(name == 'idle'), k=k); sheet.paste(draw(v, pose, k / n), (k * CW, r * CH))
            meta.append(dict(name=f'{name}_{v}', view=v, row=r, frames=n, ms=ms, loop=loop)); r += 1
    sheet.save(os.path.join(OUT, 'thief.png'))
    json.dump(dict(file='thief.png', cell=[CW, CH], anchor=[GX, GY], mirror_left_from='E', note='ground point (the feet) at the anchor; W is the mirror of E', rows=meta), open(os.path.join(OUT, 'thief.json'), 'w'), indent=1)
    return sheet, meta

if __name__ == '__main__':
    sheet, meta = build(); print('wrote', os.path.join(OUT, 'thief.png'), sheet.size)
