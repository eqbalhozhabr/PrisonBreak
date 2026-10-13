# Blind Eye on CrazyGames (Basic Launch, SDK for saves only)

Everything here follows the playbook the owner supplied (`CRAZYGAMES_PLAYBOOK.md`, summary of https://docs.crazygames.com/). One code base, one build-time target; the web build is unchanged.

## Build
```
OWNER_NAME="Eqbal Hojabrosadati" node tools/package-portal.js     # builds dist-crazygames/index.html and the zip in releases/crazygames/
node tools/portal-test.js                                         # layouts at the platform's iframe sizes, SDK behaviour, zero outside requests
```
Without `OWNER_NAME` the packager refuses (use `--allow-placeholder` only for a trial: the game then shows `[Owner name]`). The packager also fails if the bundle contains the website domain, another game's name, an unreplaced `@TOKEN@`, any http(s) address other than the platform's SDK script, or lacks the owner name, or if `CG_ADS` is switched on.

Zip: one file, `index.html` at the root (everything inlined, relative paths only, ~110 KB zipped; limit 50 MB / 1500 files).

## The CrazyGames SDK in this build
Progress on phones is not backed up reliably when the game only uses `localStorage` (the owner's experience with the other game), so the portal build loads the SDK (`https://sdk.crazygames.com/crazygames-sdk-v3.js`, the only outside address in the bundle) and uses:
- **`SDK.data`** for every save (settings, stars, last level, seen intro cards): guests and signed-in CrazyGames players, synced across devices. Writes are mirrored in `localStorage`; reads prefer `SDK.data`. **Select "Progress save: Yes" in the submission form** or the data module is disabled.
- **`gameplayStart` / `gameplayStop`**: started while a level is being played, stopped on every break (main menu, any panel, win, caught); not on focus loss. Polled every 250 ms in `cgSync()`.
- **`loadingStart` / `loadingStop`**, and **`game.settings.muteAudio`** (wins over the in-game sound and music toggles; `cgMuted()`).
- No sign-in prompt, no user module, no leaderboard, no banners.

How it starts (`tools/build-single.js`): the game script is stored as inert text (`<script type="text/plain" id="game-src">`) and a small loader starts it after `SDK.init()` has finished, failed, or taken 4 s, so the save data exists before the first line of the game reads it. Without a working SDK (blocked, offline, ad blocker) `window.__CG` is `null` and the game uses `localStorage` only.

**Ads are prepared but off.** `let CG_ADS = false` in `play/index.html`. With it `true` (Full Launch only) hints, the third-catch retry and the revive go through `SDK.ad.requestAd('rewarded')`: the screen is blocked until the SDK answers, sound is muted only from `adStarted`, an error never rewards, the game just carries on. The packager refuses to build with `CG_ADS` on, and no ad button or ad wording is visible in Basic Launch (hints are free, a lost round just restarts). Before switching it on read the playbook's ad rules (§4): no midgame ad in the first minutes, "continue without watching" with the same size and colour, and an alternative to watching.

## Layouts
- **Desktop landscape** (`body.desk`, both builds): a fine pointer (mouse) and a window at least 780 px wide with an aspect ratio of at least 1.25. Main menu: title, camera logo, total stars and escaped levels on the left; a button panel with the key list (arrows, Space, Backspace, click) on the right; Enter starts the game. Game: the board on the left, a side panel on the right with the level header, the star goals for this level (current tier highlighted), the tip, the key list and the controls (the star and key panels hide on windows shorter than 620 px). Levels panel in three columns, settings in two columns, item introductions with the animation next to the text, hover states on buttons, no tester switches.
- **Phone / touch** (everything else, including a phone on its side): the original layouts; no rotate-phone overlay, no orientation lock.
`tools/portal-test.js` checks every iframe size from the docs in desktop mode (mouse) and 390x844, 844x390 and 800x450 in phone mode (touch emulation): the right layout is chosen, menus, board, panels fit, the page never scrolls.

## Tutorial and menus (both builds)
- **Guided tutorial** (`GUIDED` in `play/index.html`, on by default): levels 1, 2, 3 and the first level of each new item (7 guard, 37 door, 57 mirror, 97 dog, 117 searchlight, 137 power panel, 157 glass). A pointing hand and a ring show the next tap, worked out by the exact solver from the position the player is in (so it stays right after a mistake or an undo): turn the camera, select the guard then tap the arrow, walk to the glowing tile when he must stand elsewhere first, then the exit. A one-line caption sits in the tip area, hearts are not lost while it leads, "Skip" and a Settings switch turn it off, a level is remembered as done once escaped. `tools/guide-test.js` plays all ten levels on desktop and phone with real clicks on the hand's position.
- **Cards and buttons:** icon-only pixel buttons (the word is the tooltip and `aria-label`) in one tidy row. Win card: stars, two stat chips (actions, best), the star-gate as a lock chip, then Home, Retry, Next. Caught card: Home, Retry, and (website only) the ad-revive. Pause card: a big Resume, then Restart, Levels, Settings, Home. The level-report flag (website only) sits in the card's corner.

## Language
English only in both builds: the language switch is hidden and `settings.lang` is forced to `en`. The Persian strings (`T.fa`) are still in `play/index.html` but nothing switches to them; delete them if they are never wanted again.

## What differs in the portal build (`PORTAL`)
| Web build | Portal build |
|---|---|
| e-mail sign-in, progress sync, leaderboard | removed; progress in `SDK.data` (+ `localStorage`) |
| anonymous statistics, level reports | removed; nothing is sent anywhere |
| rewarded ads (hints, 3 catches, revive) | no ads: hints are free, a lost round just restarts (SDK ad path exists, `CG_ADS` off) |
| footer with the studio and website | `© <year> <owner name>` only, no links |
| level-report buttons (pause, win, caught screens), tester/debug hooks, "unlock all levels" switch | none (nothing can be sent anywhere; `tools/portal-test.js` checks that no report button is visible) |
| same | same: desktop landscape layout on a mouse + wide window (the web build adds Ranking/Account to the menu panel) |

Also in both builds (portal requirements that are harmless on the web): `user-select:none`, safe-area padding, frame-delta animation, iOS audio revive on `touchend`, wheel/context-menu guards, keyboard play (arrows, Space/Enter = go to the exit, Backspace = undo), landscape and short-screen layouts, no custom fullscreen button.

## Form texts (English)
**Name:** Blind Eye

**Engine:** HTML5 · **Progress save: Yes** (SDK data module) · **Mobile:** yes · **Multiplayer:** no · **SDK mutes audio:** yes (`muteAudio` is respected)

**Description** (no HTML, no company/website, no links):
> Don't move the prisoner. Move the darkness.
>
> Turn security cameras, walk guards and guard dogs along their routes, open and close doors, flip mirrors, wait for the searchlights and rewire power panels so that no line of sight touches the prisoner's way to the exit. Walking is free; only your actions count, and every level has a proven best score to chase for three stars.
>
> 176 hand-checked pixel-art puzzles that start easy and end very hard. Undo is unlimited, a hint is always one tap away, and there is no timer.

**Controls:**
- Desktop: click a dark tile to walk there; click a camera, door, mirror or panel to use it; click a guard or dog, then a tile on its path. Keyboard: arrow keys walk, Space or Enter goes to the exit, Backspace undoes.
- Mobile: tap everything.

**Category:** Puzzle (fallback: Casual) · **Tags** (max 5, choose from their list; closest to): Puzzle, Pixel, Stealth, Escape, Logic
**Orientation:** the game adapts to both; pick the "both"/auto option if the form has one, otherwise landscape
**Devices:** desktop + mobile · **Age:** PEGI 3 to 7 (nothing violent; a prisoner is caught by an alarm, nothing is shown happening to him), never a kids rating
**Store links, download counts, marketing URL:** leave empty

## QA-tool answers
- No external ads: **Yes**. Does not offer external login options: **Yes**. Terms/Privacy mention in game: **N/A** (nothing personal is collected). Detected SDK functions: game (gameplay, loading, settings) and data.
- Tick "I confirm that these results are correct" only after playing in the QA environment and scanning the QR code with a real phone, and after checking that progress survives a reload and shows up on a second device. **Not done yet** (the build was tested in desktop Chromium at the listed iframe sizes, with touch emulation for phones, against a mock SDK that follows the documented API; the real SDK, sound and real touch were not tested).

## Media (generated, not committed: videos are large)
- Covers: `node tools/media/make-covers.js <outdir>` → 1920x1080, 800x1200, 800x800. Only the title as text, kept out of the top-left label zone, exact 4x pixel scale.
- Videos: `node tools/media/record-preview.js <outdir> <covers-dir>` → `preview-landscape-1920x1080.mp4` (recorded in the desktop layout) and `preview-portrait-1080x1620.mp4` (recorded in the phone layout), ~19 s, no sound, ~2 MB each, cover as the first 0.5 s. Needs `ffmpeg`. A bot plays real levels with real clicks on a deterministic clock and tours the game from the first camera level through guard, door, mirror, dog, searchlight, power panel and glass to a large late level (`TOUR` env: `id:frames,...`).

## Open points
- Real phone test (iOS audio, touch, SDK save and load), real CrazyGames QA run.
- Tag names must match their admin-managed list.
- Full Launch (only after an invitation): `CG_ADS`, the playbook's ad rules, landing the player directly in gameplay (at most one click), checking the game with an ad blocker.

## Website and portal are the same game
`node tools/parity-check.js` builds both and fails unless the styles and every screen are identical and the script differs only on lines that carry a build token. The deliberate differences: accounts, ranking, level reports, anonymous statistics and the stand-in rewarded ads exist only on the website (with the "AD" tag on Hint); the portal has free hints, the SDK for saves and gameplay events, the owner's name in the footer and no outside links.
