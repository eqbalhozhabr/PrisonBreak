# Blind Eye on CrazyGames (Basic Launch, no SDK)

Everything here follows the playbook the owner supplied. One code base, one build-time target; the web build is unchanged.

## Build
```
OWNER_NAME="Your Personal Name" node tools/package-portal.js      # builds dist-crazygames/index.html and the zip in releases/crazygames/
node tools/portal-test.js                                         # fit, behaviour and "zero outside requests" at the platform's iframe sizes
```
Without `OWNER_NAME` the packager refuses (use `--allow-placeholder` only for a trial: the game then shows `[Owner name]`). The packager also fails if the bundle contains the website domain, another game's name, an unreplaced `@TOKEN@`, any http(s) address, or lacks the owner name.

Zip: one file, `index.html` at the root (everything inlined, relative paths only, ~110 KB zipped; limit 50 MB / 1500 files).

## What differs in the portal build (`PORTAL`)
| Web build | Portal build |
|---|---|
| e-mail sign-in, progress sync, leaderboard | removed (progress stays in localStorage) |
| anonymous statistics, level reports | removed; nothing is sent anywhere |
| rewarded ads (hints, 3 catches, revive) | no ads: hints are free, a lost round just restarts |
| footer with the studio and website | `© <year> <owner name>` only, no links |
| tester/debug hooks | none |

Also in both builds (portal requirements that are harmless on the web): `user-select:none`, safe-area padding, frame-delta animation, iOS audio revive on `touchend`, wheel/context-menu guards, keyboard play (arrows, Space/Enter = go to exit, Backspace = undo), landscape and short-screen layouts, no rotate overlay, no custom fullscreen button.

## Form texts (English)
**Name:** Blind Eye

**Engine:** HTML5 · **Progress save:** No · **Mobile:** yes · **Multiplayer:** no · **SDK mutes audio:** no

**Description** (no HTML, no company/website, no links):
> Don't move the prisoner. Move the darkness.
>
> Turn security cameras, walk guards and guard dogs along their routes, open and close doors, flip mirrors, wait for the searchlights and rewire power panels so that no line of sight touches the prisoner's way to the exit. Walking is free; only your actions count, and every level has a proven best score to chase for three stars.
>
> 176 hand-checked pixel-art puzzles that start easy and end very hard. Undo is unlimited, a hint is always one tap away, and there is no timer.

**Controls:**
- Desktop: click or tap a dark tile to walk there; click a camera, door, mirror or panel to use it; click a guard or dog, then a tile on its path. Keyboard: arrow keys walk, Space or Enter goes to the exit, Backspace undoes.
- Mobile: tap everything.

**Category:** Puzzle (fallback: Casual) · **Tags** (max 5, choose from their list; closest to): Puzzle, Pixel, Stealth, Escape, Logic
**Orientation:** the game adapts to both; pick the "both"/auto option if the form has one, otherwise landscape (portrait is equally supported)
**Devices:** desktop + mobile · **Age:** PEGI 3 to 7 (nothing violent; a prisoner is caught by an alarm, nothing is shown happening to him) — never a kids rating
**Store links, download counts, marketing URL:** leave empty

## QA-tool answers
- No external ads: **Yes**. Does not offer external login options: **Yes**. Terms/Privacy mention in game: **N/A** (nothing personal is collected). Detected SDK functions: none.
- Tick "I confirm that these results are correct" only after playing in the QA environment and scanning the QR code with a real phone. **Not done yet** (the build was only tested in desktop Chromium at the listed iframe sizes, plus a 390x844 and 844x390 phone viewport; sound and real touch were not tested).

## Media (generated, not committed: videos are large)
- Covers: `node tools/media/make-covers.js <outdir>` → 1920x1080, 800x1200, 800x800. Only the title as text, kept out of the top-left label zone, exact 4x pixel scale.
- Videos: `node tools/media/record-preview.js <outdir> <covers-dir>` → `preview-landscape-1920x1080.mp4` and `preview-portrait-1080x1620.mp4`, ~19 s, no audio, ~1 MB each, cover as the first 0.5 s. Needs `ffmpeg`. Plays short levels (cameras, guard, door, mirror, and as many of the dog and searchlight ones as fit) with real clicks on a deterministic clock.

## Open points
- The owner's personal name (rebuild with `OWNER_NAME`).
- Real phone test (iOS audio, touch), real CrazyGames QA run.
- Tag names must match their admin-managed list.
