# Scene lab (style study, not shipped)

`node tools/build-scene-lab.js` -> `play/scene-lab.html`. A new look drawn entirely by code from two references: a brick-alley screenshot (teal shadows, warm pools of light, mossy brick, a green exit sign) and a 12x35 px prisoner sketch (7 colours, no outline, light from the left). Nothing comes from the game's earlier graphics; only the rules (`src/prison.js`) and the level data are used.

- Isometric 2:1 (48x24 diamond), levels 8-10, rotate with the buttons, solver playback with "Play solution".
- Characters are built from small shapes with flat three-tone shading (`person()`): a striped prisoner with orange hair, a guard in a cap; both have front and back views and a 4-frame walk cycle that follows the distance walked.
- Walls: brick (per-pixel, moss, wet streaks, caged lamps, pipes), stone tops. Floor: per-pixel concrete (seams, cracks, puddles, drains, litter) with baked warm pools under the lamps, a green pool at the exit, contact shadows at the walls. Pavement around the building with a drum, crates, bins, a dumpster and a lamp post.
- Beams are red light added to the floor; a guard's shadow in a beam is dark on the floor; hidden figures show as outlines (readability trick, toggle).
- Final pass: colour grade (teal shadows, warm lights, reds and greens kept) and a luminance dither.

## CCTV look (button "CCTV look", or `?cctv=1`)
The same scene shown as security footage: green phosphor, scanlines, grain and a slow bright bar; reds (danger) and the green exit sign keep their colour. In the picture: camera name and clock, REC, corner marks, a tracking box on the prisoner, actions done / deadline. `window.lab.cams()` returns where each camera is on the canvas, whether a guard stands in front of its lens and its cone, so a UI can show one live crop per camera ("lens blocked", "zone active", "no coverage").
