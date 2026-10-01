# PrisonBreak — Blind Spots (prototype)

A grid puzzle: you don't move the thief, you move the *darkness*. Turn cameras and slide guards so their lines of sight leave a safe path to the exit. Walking is free; only actions on cameras/guards count (par = fewest actions, proven by an exact solver).

Design and honest status: [`docs/game-design-plan.md`](docs/game-design-plan.md)

## Play
```
python3 -m http.server 8123      # from the repo root
# open http://localhost:8123/play/
```
## Checks
```
node tools/build-levels.js play/levels.js small.jsonl cands.jsonl   # re-solves every level exactly
PLAYWRIGHT_MODULE=<path to playwright> node tools/play-test.js       # plays every level in Chromium through the UI
```
