# Noir lab (style study, not shipped)

`node tools/build-noir-lab.js` -> `play/noir-lab.html`. Levels 8, 9 and 10 in two views, with noir lighting, drawn on a low-resolution canvas and scaled up without smoothing:
- **Oblique 3/4**: the view the game has today.
- **True isometric**: a 2:1 diamond grid. Readability tricks (toggle "Readability tricks"): walls are low, the two walls nearest the viewer are cut away, beams are drawn through walls as dashed outlines, a figure hidden behind a wall shows as an outline, faint tile seams, and the view rotates in quarter turns.

The solver's route plays back with "Play solution" (the prisoner walks, the guard slides, the beam changes). A guard's shadow (the part of a beam he swallows) is drawn on the floor.
It is a renderer test only: the lab has no taps or game rules of its own, it replays `Prison.solve`.
