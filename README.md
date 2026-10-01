# Blind Eye

A grid puzzle: you don't move the prisoner, you move the *darkness*. Turn cameras, walk guards and dogs along their rails, open and close doors, flip mirrors, wait for the searchlights, so that no line of sight touches the prisoner's path to the exit. Walking is free; only actions count (par = fewest actions, proved by an exact solver). 145 levels in 14 blocks, star-gated, with music and sound made in the browser.

Design document: [`docs/game-design-document.md`](docs/game-design-document.md)

## Play
Easiest: download `play/prisonbreak.html` and double-click it (one self-contained file, works offline).
Or from the repo with a local server:
```
python3 -m http.server 8123      # from the repo root
# open http://localhost:8123/play/
```

## Code
| Path | Role |
|---|---|
| `src/prison.js` | rules, exact solver, level generator (works in Node and the browser) |
| `play/index.html` | the game (menu, settings, canvas renderer, sound) |
| `play/levels.js` | the 145 shipped levels (generated, each re-solved exactly) |
| `tools/level-specs.js` | the difficulty ramp: what level n is made of |
| `tools/gen-levels.js` | generates levels for a range: `node tools/gen-levels.js 1 30 out.jsonl` |
| `tools/build-levels.js` | merges generated files, re-solves every level, writes `play/levels.js` |
| `tools/build-single.js` | inlines everything into `play/prisonbreak.html` |
| `tools/play-test.js` | plays levels in a real browser with real clicks and checks par |

## Rebuild
```
node tools/gen-levels.js 1 145 levels.jsonl          # slow for the late blocks; split the range over several processes
node tools/build-levels.js play/levels.js levels.jsonl
node tools/build-single.js
PLAYWRIGHT_MODULE=<path to playwright> node tools/play-test.js http://localhost:8123/play/index.html all
```
