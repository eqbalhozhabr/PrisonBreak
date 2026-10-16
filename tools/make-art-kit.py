#!/usr/bin/env python3
"""Builds art-kit/: the sprite sheets Blind Eye needs, as a manifest (assets.json), per-sheet templates and the README tables.
usage: python3 tools/make-art-kit.py            (needs Pillow)
The README text itself lives in art-kit/README.md (hand-written); this script rewrites the generated parts: assets.json, templates/, geometry.png, palette files, and the table between the <!--SHEETS--> markers."""
import json, os, re
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'art-kit')
TILE_W, TILE_H, WALL_H = 48, 37, 16            # floor face 48x37 (0.78 of the width), wall front 48x16 (0.34); a wall block is 48x53

# ---------------------------------------------------------------------------------------------------------------- the sheets
# row = (name, frames, ms per frame or None when the game picks the frame by distance / state, loop, priority 1..3, note)
def R(name, frames, ms=None, loop=True, pri=1, note=''):
    return dict(name=name, frames=frames, ms=ms, loop=loop, priority=pri, note=note)

PERSON_NOTE = 'one walk cycle = 2 steps = 2 tiles; contact poses (feet apart) on frames 0 and 2'
SHEETS = [
    dict(name='thief', title='Prisoner (the player)', cell=(32, 48), anchor=(16, 47), kind='mover', mirror_left=True, rows=[
        R('idle_down', 2, 600, pri=1, note='breathing / blink, front view'),
        R('idle_up', 2, 600, pri=1, note='back view'),
        R('idle_right', 2, 600, pri=1, note='side view facing right (the game mirrors it for left)'),
        R('walk_down', 4, None, pri=1, note=PERSON_NOTE),
        R('walk_up', 4, None, pri=1, note=PERSON_NOTE),
        R('walk_right', 4, None, pri=1, note=PERSON_NOTE),
        R('caught', 2, 300, pri=2, note='front, hands up; frame 0 -> 1 -> repeat'),
        R('escape_up', 4, 110, loop=False, pri=3, note='runs into the exit (walks away from us, shrinks into the door)'),
    ]),
    dict(name='guard_a', title='Guard, type A (slim, cap)', cell=(32, 48), anchor=(16, 47), kind='mover', mirror_left=True, rows=[
        R('idle_down', 2, 600), R('idle_up', 2, 600), R('idle_right', 2, 600),
        R('walk_down', 4, None, note=PERSON_NOTE), R('walk_up', 4, None, note=PERSON_NOTE), R('walk_right', 4, None, note=PERSON_NOTE),
        R('alert_down', 2, 200, pri=3, note='surprised pose when he sees the prisoner (the game adds the "!" itself)'),
        R('alert_up', 2, 200, pri=3), R('alert_right', 2, 200, pri=3),
    ]),
    dict(name='guard_b', title='Guard, type B (another build, optional second guard in a level)', cell=(32, 48), anchor=(16, 47), kind='mover', mirror_left=True, optional=True, rows=[
        R('idle_down', 2, 600, pri=3), R('idle_up', 2, 600, pri=3), R('idle_right', 2, 600, pri=3),
        R('walk_down', 4, None, pri=3, note=PERSON_NOTE), R('walk_up', 4, None, pri=3, note=PERSON_NOTE), R('walk_right', 4, None, pri=3, note=PERSON_NOTE),
    ]),
    dict(name='dog', title='Guard dog (side view; left = mirrored right)', cell=(48, 32), anchor=(24, 31), kind='mover', mirror_left=True, rows=[
        R('idle_right', 2, 500, note='standing, tail / ear twitch'),
        R('walk_right', 4, None, note='one cycle = 2 tiles'),
        R('run_right', 4, None, note='the alarm run: stretched gallop, one cycle = 3 tiles'),
        R('sniff_right', 2, 300, pri=2, note='nose down'),
        R('bark_right', 2, 150, pri=3, note='head up, mouth open'),
        R('idle_down', 2, 500, pri=2, note='front view (the dog also moves up and down rails)'),
        R('idle_up', 2, 500, pri=2, note='back view'),
        R('walk_down', 4, None, pri=2), R('walk_up', 4, None, pri=2),
    ]),
    dict(name='camera', title='Wall camera (sits on the top face of a wall block)', cell=(40, 32), anchor=(20, 31), kind='wall_thing', mirror_left=True, rows=[
        R('idle_up', 2, 500, note='back view (it looks away from us); frame 1 = the LED on'),
        R('idle_right', 2, 500, note='side view facing right; the lens is on the right'),
        R('idle_down', 2, 500, note='front view; the lens faces us'),
        R('turn_up_to_right', 3, 90, loop=False, pri=2, note='quarter turn clockwise. The other turns are derived: right->down needs its own row below; down->left and left->up are mirrored/reversed'),
        R('turn_right_to_down', 3, 90, loop=False, pri=2),
        R('alarm_up', 2, 150, pri=3, note='LED lit, body shaking by 1 px'), R('alarm_right', 2, 150, pri=3), R('alarm_down', 2, 150, pri=3),
    ]),
    dict(name='lamp', title='Searchlight on a wall block', cell=(40, 32), anchor=(20, 31), kind='wall_thing', mirror_left=True, rows=[
        R('idle_up', 2, 500, note='back view'), R('idle_right', 2, 500, note='side, lens on the right'), R('idle_down', 2, 500, note='front, big lens facing us'),
        R('turn_up_to_right', 3, 90, loop=False, pri=2), R('turn_right_to_down', 3, 90, loop=False, pri=2),
    ]),
    dict(name='panel', title='Power panel (fixed on a wall block; its wires are drawn by the game)', cell=(40, 32), anchor=(20, 31), kind='wall_thing', mirror_left=False, rows=[
        R('type1_idle', 2, 600, note='lamp symbol: circle (the game links a circle wire to it)'),
        R('type2_idle', 2, 600, note='lamp symbol: triangle'),
        R('type3_idle', 2, 600, note='lamp symbol: square. Use different SHAPES, not only colours: the game can be played without colour'),
        R('pulse', 3, 80, loop=False, pri=2, note='when it is pressed: lights flash'),
    ]),
    dict(name='wall', title='Wall blocks: top face 48x37 on top of front face 48x16 (one cell 48x53)', cell=(48, 53), anchor=(0, 0), kind='block', mirror_left=False, rows=[
        R('concrete', 3, None, note='3 variations (the game picks one per cell, like a hash)'),
        R('brick', 3, None, note='3 variations'),
        R('special', 3, None, pri=3, note='optional: cracked, with bars, pillar'),
    ]),
    dict(name='floor', title='Floor tiles 48x37 (top view with a little tilt)', cell=(48, 37), anchor=(0, 0), kind='tile', mirror_left=False, rows=[
        R('base', 4, None, note='4 plain variations, almost the same tone so the floor stays calm'),
        R('extra', 4, None, pri=3, note='warning stripes, drain, cracked, puddle'),
    ]),
    dict(name='door', title='Door (a block 48x53 when closed; when open only the posts stand on the floor tile)', cell=(48, 53), anchor=(0, 0), kind='block', mirror_left=False, rows=[
        R('states', 6, 80, loop=False, note='frame 0 = closed, frames 1-4 = opening, frame 5 = open (posts and lever box on the lower 37 px, upper 16 px empty). The game plays it backwards for closing. The lever box is in the middle of the tile: that is where a tap lands.'),
    ]),
    dict(name='mirror', title='Mirror block 48x53', cell=(48, 53), anchor=(0, 0), kind='block', mirror_left=False, rows=[
        R('states', 5, 70, loop=False, note='frame 0 = "/" , frame 1 = "\\" , frames 2-4 = turning from "/" to "\\" (played backwards for the other way)'),
    ]),
    dict(name='glass', title='Glass block 48x53 (see-through)', cell=(48, 53), anchor=(0, 0), kind='block', mirror_left=False, rows=[
        R('variants', 2, None, note='keep it light: the cameras see through it'),
        R('cracked', 1, None, pri=3),
    ]),
    dict(name='exit', title='Exit door on a floor tile 48x37', cell=(48, 37), anchor=(0, 0), kind='tile', mirror_left=False, rows=[
        R('idle', 2, 500, note='sign light blinking'),
        R('reached', 3, 100, loop=False, pri=3, note='opens when the prisoner arrives'),
    ]),
    dict(name='fx', title='Effects', cell=(32, 32), anchor=(16, 31), kind='fx', mirror_left=False, rows=[
        R('dust', 4, 80, loop=False, pri=2, note='puff at the feet when walking starts'),
        R('alarm_mark', 2, 150, pri=2, note='the "!" over a head (the game now draws it with a font)'),
        R('star_burst', 6, 70, loop=False, pri=3, note='win: 3 stars pop'),
    ]),
    dict(name='ui_icons', title='Interface (phase 2)', cell=(24, 24), anchor=(12, 23), kind='ui', mirror_left=False, rows=[
        R('heart', 3, 90, loop=False, pri=2, note='frame 0 full (black), frame 1 empty (outline), frame 2 breaking'),
        R('star', 2, None, pri=2, note='frame 0 full, frame 1 empty'),
        R('misc', 6, None, pri=3, note='lock, hint lamp, undo, restart, home, play (the game already has pixel icons made from text; replace when ready)'),
    ]),
    dict(name='frame9', title='Screen frame, 9-slice (phase 2)', cell=(48, 48), anchor=(0, 0), kind='ui', mirror_left=False, rows=[
        R('stage_frame', 1, None, pri=3, note='the bezel around the board; the corners are 12x12, the edges stretch'),
        R('button_frame', 1, None, pri=3, note='a button; corners 6x6'),
    ]),
]

PALETTE = [  # name, hex, use
    ('ink', '141614', 'everything that moves (outline and body): prisoner, guards, dog, camera, searchlight'),
    ('pale', 'acb298', 'skin, eyes, lens glints, stripes on the prisoner shirt (the only light on a mover)'),
    ('red', 'd03038', 'LEDs, dog collar. The danger colour. The game draws beams and lit tiles in this red with transparency'),
    ('paper', '979d86', 'the main background and the floor (151,157,134, sampled from your reference screens)'),
    ('g3', '86917c', 'static layer: light'),
    ('g2', '76806e', 'static layer: mid (wall top)'),
    ('g1', '5c645a', 'static layer: dark (wall front, lines)'),
]


def cols(s):
    return max(r['frames'] for r in s['rows'])


def sheet_size(s):
    return cols(s) * s['cell'][0], len(s['rows']) * s['cell'][1]


def make_templates():
    os.makedirs(os.path.join(ROOT, 'templates'), exist_ok=True)
    for s in SHEETS:
        cw, ch = s['cell']
        W, H = sheet_size(s)
        # blank: exact final size, transparent
        Image.new('RGBA', (W, H), (0, 0, 0, 0)).save(os.path.join(ROOT, 'templates', s['name'] + '.blank.png'))
        # guide: labels around, cells outlined, anchor and block faces marked
        LM, TM = 150, 18
        im = Image.new('RGBA', (W + LM + 4, H + TM + 4), (236, 236, 228, 255))
        d = ImageDraw.Draw(im)
        for ri, r in enumerate(s['rows']):
            y0 = TM + ri * ch
            d.text((4, y0 + 2), r['name'], fill=(30, 30, 30, 255))
            d.text((4, y0 + 12), f"{r['frames']}f" + (f" {r['ms']}ms" if r['ms'] else ' by distance') + f" P{r['priority']}", fill=(110, 110, 110, 255))
            for ci in range(cols(s)):
                x0 = LM + ci * cw
                used = ci < r['frames']
                d.rectangle([x0, y0, x0 + cw - 1, y0 + ch - 1], fill=(255, 255, 255, 255) if used else (205, 205, 198, 255), outline=(120, 170, 200, 255))
                if not used:
                    continue
                if s['kind'] in ('block',):
                    d.rectangle([x0 + 1, y0 + 1, x0 + cw - 2, y0 + TILE_H - 1], fill=(240, 246, 236, 255))              # top face
                    d.rectangle([x0 + 1, y0 + TILE_H, x0 + cw - 2, y0 + ch - 2], fill=(214, 224, 208, 255))            # front face
                if s['kind'] == 'tile':
                    d.rectangle([x0 + 1, y0 + 1, x0 + cw - 2, y0 + ch - 2], fill=(240, 246, 236, 255))
                ax, ay = s['anchor']
                if s['kind'] in ('mover', 'wall_thing', 'fx', 'ui'):
                    d.line([x0 + ax, y0, x0 + ax, y0 + ch - 1], fill=(220, 150, 150, 255))                              # centre line
                    d.line([x0, y0 + ay, x0 + cw - 1, y0 + ay], fill=(210, 60, 60, 255))                                # ground line = anchor
                    d.ellipse([x0 + ax - 2, y0 + ay - 2, x0 + ax + 2, y0 + ay + 2], outline=(210, 60, 60, 255))
        d.text((LM, 1), f"{s['name']}.png {W}x{H}", fill=(30, 30, 30, 255))
        d.text((4, 1), f"cell {cw}x{ch}", fill=(30, 30, 30, 255))
        im.save(os.path.join(ROOT, 'templates', s['name'] + '.guide.png'))


def make_geometry():
    sc = 4
    PW = 48 * sc + 60                                     # one panel
    W, H = PW * 3 + 40, 520
    im = Image.new('RGB', (W, H), (236, 236, 228))
    d = ImageDraw.Draw(im)
    def box(x, y, w, h, fill, label, ink=(20, 20, 20)):
        d.rectangle([x, y, x + w * sc - 1, y + h * sc - 1], fill=fill, outline=(40, 40, 40))
        d.text((x + 4, y + 3), label, fill=ink)
    def red(x0, y0, w, h, label, ax, ay, tx, ty):
        d.rectangle([x0, y0, x0 + w * sc - 1, y0 + h * sc - 1], outline=(200, 60, 60))
        d.text((tx, ty), label, fill=(160, 40, 40))
        cx, cy = x0 + ax * sc, y0 + ay * sc
        d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], outline=(200, 60, 60)); d.line([cx - 9, cy, cx + 9, cy], fill=(200, 60, 60))
    d.text((16, 10), 'Geometry (1 art pixel drawn as 4x4 here). Floor tile 48x37. Wall block 48x53 = top face 48x37 + front face 48x16.', fill=(0, 0, 0))
    # panel A: a floor tile and a mover standing on it
    ax0, ay0 = 30, 240
    box(ax0, ay0, 48, 37, (151, 157, 134), 'floor tile 48x37')
    foot_y = ay0 + int(37 * .86 * sc)
    red(ax0 + 8 * sc, foot_y - 48 * sc, 32, 48, 'mover cell 32x48', 16, 47, ax0 + 8 * sc + 4, foot_y - 48 * sc + 4)
    d.text((ax0, ay0 + 37 * sc + 8), 'A mover: the cell\'s bottom centre = the feet,', fill=(160, 40, 40))
    d.text((ax0, ay0 + 37 * sc + 22), 'standing 86% of the way down the tile.', fill=(160, 40, 40))
    d.text((ax0, ay0 + 37 * sc + 36), 'Feet never move between frames.', fill=(160, 40, 40))
    # panel B: a wall block with a camera on its top face
    bx0, by0 = PW + 50, 100
    box(bx0, by0, 48, 37, (118, 128, 110), 'wall top 48x37', (240, 240, 240))
    box(bx0, by0 + 37 * sc, 48, 16, (92, 100, 90), 'wall front 48x16', (240, 240, 240))
    cfoot = by0 + int(37 * .72 * sc)
    red(bx0 + 4 * sc, cfoot - 32 * sc, 40, 32, 'camera / lamp / panel cell 40x32', 20, 31, bx0 + 4 * sc + 4, cfoot - 32 * sc + 4)
    d.text((bx0, by0 + 53 * sc + 8), 'A wall thing sits on the top face,', fill=(160, 40, 40))
    d.text((bx0, by0 + 53 * sc + 22), 'bottom centre of its cell 72% down it.', fill=(160, 40, 40))
    # panel C: notes
    cx0 = PW * 2 + 60
    notes = ['Order of drawing', '1. all floor tiles', '2. row by row from the top: the wall blocks of', '   the row, then dogs / guards / prisoner whose', '   feet are in that row', '3. a wall block is drawn 16 px higher than', '   its row, so its front face covers the lower', '   16 px of the cell above', '', 'The game adds by itself (do NOT paint):', ' - the drop shadow (from your sprite alpha)', ' - selection glow, hint ring, "!" mark', ' - beams and lit tiles (red, translucent)', '', 'Scaling: nearest neighbour, about x2.8 on a', 'desktop, about x1.2 on a phone', '', 'Only alpha 0 or 255: no half-transparent pixels']
    for i, t in enumerate(notes):
        d.text((cx0, 40 + i * 15), t, fill=(0, 0, 0) if i == 0 else (30, 30, 30))
    im.save(os.path.join(ROOT, 'geometry.png'))


def make_palette():
    with open(os.path.join(ROOT, 'palette.hex'), 'w') as f:
        f.write('\n'.join(h for _, h, _ in PALETTE) + '\n')
    with open(os.path.join(ROOT, 'palette.gpl'), 'w') as f:
        f.write('GIMP Palette\nName: Blind Eye LCD\nColumns: 4\n#\n')
        for n, h, _ in PALETTE:
            f.write('%3d %3d %3d\t%s\n' % (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), n))
    sw = Image.new('RGB', (len(PALETTE) * 64, 80), (255, 255, 255))
    d = ImageDraw.Draw(sw)
    for i, (n, h, _) in enumerate(PALETTE):
        d.rectangle([i * 64, 0, i * 64 + 63, 59], fill='#' + h)
        d.text((i * 64 + 4, 64), n + ' #' + h, fill=(0, 0, 0))
    sw.save(os.path.join(ROOT, 'palette.png'))


def make_manifest():
    out = dict(
        version=1,
        notes='Sheets are PNG with transparent background, frames left to right, rows top to bottom in the order listed. cell = [w,h] px at 1x; anchor = [x,y] inside a cell (feet / base). The game scales with nearest neighbour, mirrors "right" for "left" when mirror_left is true, and draws shadows, glows and beams itself.',
        tile=dict(floor=[TILE_W, TILE_H], wall_front=[TILE_W, WALL_H], wall_block=[TILE_W, TILE_H + WALL_H]),
        sheets=[dict(file=s['name'] + '.png', name=s['name'], title=s['title'], cell=list(s['cell']), anchor=list(s['anchor']), kind=s['kind'], mirror_left=s['mirror_left'],
                     size=list(sheet_size(s)), optional=bool(s.get('optional')), rows=s['rows']) for s in SHEETS])
    with open(os.path.join(ROOT, 'assets.json'), 'w') as f:
        json.dump(out, f, indent=1)


def table():
    pri = {1: 'P1', 2: 'P2', 3: 'P3'}
    lines = ['| Sheet (file) | Size px | Cell | Rows (frames) | Priority |', '|---|---|---|---|---|']
    for s in SHEETS:
        W, H = sheet_size(s)
        rows = '<br>'.join(f"`{r['name']}` ({r['frames']}f{', ' + str(r['ms']) + ' ms' if r['ms'] else ', by distance' if s['kind'] == 'mover' and 'walk' in r['name'] or 'run' in r['name'] else ''}){' – ' + r['note'] if r['note'] else ''}" for r in s['rows'])
        p = min(r['priority'] for r in s['rows'])
        lines.append(f"| **{s['name']}.png**<br>{s['title']} | {W}×{H} | {s['cell'][0]}×{s['cell'][1]} | {rows} | {pri[p]} |")
    return '\n'.join(lines)


def patch_readme():
    path = os.path.join(ROOT, 'README.md')
    if not os.path.exists(path):
        return
    txt = open(path, encoding='utf8').read()
    new = '<!--SHEETS-->\n' + table() + '\n<!--/SHEETS-->'
    txt = re.sub(r'<!--SHEETS-->.*?<!--/SHEETS-->', lambda m: new, txt, flags=re.S)
    open(path, 'w', encoding='utf8').write(txt)


if __name__ == '__main__':
    os.makedirs(ROOT, exist_ok=True)
    make_templates(); make_geometry(); make_palette(); make_manifest(); patch_readme()
    print('art-kit written:', ', '.join(sorted(os.listdir(ROOT))))
