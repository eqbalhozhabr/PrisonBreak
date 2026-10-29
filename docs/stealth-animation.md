# Stealth rules: motion and animation (Commandos-style feel)

Status: the lab (`play/stealth-lab.html`, built by `tools/build-stealth-lab.js`) plays the three Stealth layers with a first motion pass. The rules stay discrete
and turn-based (the exact solver in `src/stealth.js` is the single source of truth); the picture glides between two configurations.

## What moves in the lab (cosmetic, driven by `startAnim` in `tools/stealth-lab.html`)
| Event | Motion | Time |
|---|---|---|
| Camera / searchlight turns | gliding rotation of the head, a dashed beam line sweeps, the old zone fades out while the new one fades in | 560 ms |
| Guard steps or flips | turns first (30 %), then walks with a leg cycle; zones cross-fade | 560 ms |
| Lure | stone arcs to the tile (450 ms), a noise ring spreads, guards in earshot show "?" (until 70 %), turn their heads (first 38 %), then walk one tile | 1150 ms |
| Prisoner enters a far (hatched) tile | squashes down, then crawls flat with paddling arms and legs, dust puffs behind | 150 ms per tile |
| Action refused (he would be seen) | red flash on his tile, "!" over whoever would see him | 1100 ms |
| Idle | cameras sway about 3 degrees, guards sway their facing, everyone breathes | continuous |

## What Commandos does that this is not (yet)
Commandos is real time: guards patrol on their own, notice with a delay (the far part of the cone fills up before the alarm), investigate, return to the route.
Our puzzle is turn-based on purpose. Two ways to get closer without breaking the puzzles:
1. Motion language only (done in the lab): everything above.
2. A "timed" layer (not built): after each action the guards play a short patrol step with a visible suspicion bar that fills while the prisoner is in a far tile.
   It would need new rules (suspicion state) and a new solver; treat it as a separate game mode, not an upgrade of these levels.

## Sprite animations that real Commandos-like motion needs (to be drawn, same pen style, see `docs/art-spec-console.html`)
- Prisoner: crawl (6 frames) and prone idle (2) in n/e/s; get down (4 frames, played backwards to get up) in n/e/s; throw a stone (4) in n/e/s.
- Guard: look around (6, idle variant), notice / startle (3), aim (4), each in n/e/s.
- Dog: sniff (4), alert (3), in the side view.
- Effects: "?" and "!" bubbles (3 frames each), noise ring (6 frames, on the floor), thrown stone (1), dust puff (4).
- Sound: stone landing, crawl, guard "huh?", camera servo (exists).
