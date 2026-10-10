# Blind Eye — project overview (hand-off note for a new session)

Read this first; then `README.md` (file map and rebuild commands) and `docs/game-design-document.md` (Persian, the full design). The owner writes to Claude in **Persian**; reply to them in Persian. Code, comments and commit messages are English.

## What the game is
**Blind Eye** (Persian name «چشم‌بسته») is a pixel-art stealth puzzle for web and phones. You never move the prisoner by force: you **move the darkness**. Cameras, guards, dogs, doors, mirrors, searchlights, power panels and glass walls decide which floor tiles are lit/smelled; the prisoner may only stand on dark tiles and walks for free to the exit. **Only actions are counted**; every level has a **par** (fewest actions) proved by an exact solver, and stars come only from action count (3 = par, 2 = par + max(2, 30 %), 1 = any finish). An action that would expose the prisoner is refused and costs a heart instead (3 hearts per level, can be switched off in settings). Undo is unlimited.

## Content (176 levels, 18 blocks, star-gated)
Block 1 "Cells" = 6 camera-only levels (easy → very hard; it used to be 15, cut on player feedback). Then ten-level blocks that introduce one item each, each followed by a mixing block: guard (level 7), door (37), mirror (57), "all combined" (77), dog (97), rotating searchlight (117), power panel (137), glass wall (157). Level ids are stable only within a **progress version** (`PROGRESS_V = 2`); the renumbering from 185 to 176 levels is migrated in the browser (`OLD_TO_NEW`) and on the server (`v` field).

## Code map
- `src/prison.js` — rules, **exact solver** over (configuration digits, dark region), level generator, analysis (`phasesDP` = how many separate walks a level needs). Runs in Node and the browser. Level ASCII: `# . S E`, `^>v<` cameras, `0-3` searchlights, `a-d` guards, `e-h` dogs, `X/x` doors, `/ \` mirrors, `p-r` panels, `G` glass; rails/links live in `meta`.
- `play/index.html` — the whole game: menu, settings, accounts UI, canvas renderer (oblique pixel art, beams as polygons, narrow see-through ray after each mirror), sound/music synthesised in the browser, English default + Persian. `play/levels.js` — shipped levels (generated, re-solved). `play/prisonbreak.html` and `play/artifact.html` are **generated** by `tools/build-single.js`; never edit them by hand.
- `tools/` — `level-specs.js` (difficulty ramp), `gen-levels.js`, `regen-low.js`, `build-levels.js`, `play-test.js` (real clicks on all 176 levels), `e2e-account.js` (real Worker handlers + fake D1), `package-portal.js`, `portal-test.js`, `media/` (cover and preview-video makers).

## Two builds from one code base
- **Web** (`node tools/build-single.js`): accounts, progress sync, leaderboard, anonymous statistics, level reports, optional rewarded ads for hints/revives (ads are still a stub).
- **Portal / CrazyGames** (`OWNER_NAME="…" node tools/package-portal.js`): no accounts, no network, no ads, hints free, owner's personal name only, no links. Details and form texts: `docs/crazygames-submission.md`. Build-time tokens (`@TARGET@`, `@OWNER@`, …) are replaced in `build-single.js`; the packager fails on forbidden strings.

## Where it lives / how releases go
- Game repo: `eqbalhozhabr/PrisonBreak`, branch `claude/hopeful-franklin-jtrcft` (push only there).
- Site repo: `eqbalhozhabr/luckylion-website`; the game is served at `https://luckylion.games/blind-eye/` from `public/blind-eye/index.html` = `play/prisonbreak.html` **plus** `<meta name="robots" content="noindex, nofollow">` after the viewport meta. The backend is a Cloudflare Worker + D1 (`worker/routes/blindeye.js`): passwordless magic-link sign-in (shared with the owner's other game, each game with its own e-mail title), progress sync (versioned), leaderboard, anonymous stats and reports, a private stats page. Release recipe: commit/push game → site branch from `origin/main` → copy page with the noindex meta → PR → wait for the green "Workers Builds" check (~2.5 min) → squash-merge → curl the live page → republish the Artifact (`play/artifact.html`, https://claude.ai/artifact/2ahz7VTvmJpnRPzRxg5LPo). The owner has allowed merging and pushing where needed.
- Stats/report mechanism written up for reuse in another game: `docs/stats-and-reports-note.md`.

## Testing
`node tools/play-test.js file://…/play/prisonbreak.html all` (needs Playwright; `PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright`, Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`), `SITE_DIR=<site clone> node tools/e2e-account.js`, `node tools/portal-test.js`. All were green at the last release. Not tested: real phones, sound, real CrazyGames QA.

## Open items
1. The owner's **personal name** for the portal build (zip currently uses the `[Owner name]` placeholder).
2. Real-phone test and CrazyGames QA run; confirm tag names against their list.
3. Rewarded ads are a stub; real ad integration for the web build is undecided.
4. Hearts/hints/ads rules differ between builds (see the GDD, section 2).
5. Pre-existing anonymous stats for levels ≥ 16 use the old numbering.

## Working conventions
Persian replies; do exactly what was asked; verify with the real-click test, not only the solver; solver and generator are sensitive, so after any rule change re-run `build-levels.js` and the full play-test. Do not open PRs on the game repo unless asked; do not commit zips/videos (`releases/` is git-ignored).
