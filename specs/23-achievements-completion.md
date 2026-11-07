# 23 — Achievements and completion %

Owner role: **progression** (`game/src/achievements.js`, new). Hooks in gameplay files go through the gameplay role (see 01-architecture), except the small, clearly delimited hook lines this spec lists.

## Why
Give players a reason to explore everything the game offers (story, free roam, tourist spots, photo mode, on foot) and show how much of it they have seen.

## Requirements
R23.1 **Catalogue** of ~40–60 achievements in categories, each with id, icon, title, description, category, optional `hidden` (shown as "???" until unlocked) and optional counter target (e.g. 7/10):
- **Story**: each chapter completed, Bucharest done, the flight, story complete.
- **Explorer**: every district opened in free roam, each tourist spot visited, all spots of a city, all plaques of a spot, all postcards.
- **Driver**: a long drive without fines, crossing a real rush-hour hotspot (Piața Victoriei, Piața Unirii, Bd. Dimitrie Pompeiu, I-405) at peak, a night drive, rain / snow / fog drives, refuelling, a chapter with zero crashes, following a nav route to the end, fast travel.
- **Local colour** (witty, from the research files: traffic culture, honking, roadworks, Seattle politeness, weather): honks, red light, rage max, roadworks closures, etc.
- **Photographer**: first photo, a night photo, each landmark postcard, photo in the rain.
- **On foot**: walk 1 km, enter an office on foot, jump, cross at a zebra.
- **Secrets** (hidden): small easter eggs grounded in real places (researched facts only).
- Existing achievements in `data.js` are kept when still reachable; ones that no longer fit the district maps (I-90 floating bridge, SR-520 toll) are re-worded to something reachable (e.g. the bridge is crossed in the montage into Bellevue) or replaced.
R23.2 **Persistence** in `localStorage` (versioned key, unlock timestamps, counters), merged with chapter progress (`chapters.js`) and spot progress (`spots/index.js` `spotProgress()`); survives reloads; a "Reset progress" action (with confirmation) in the settings / pause menu.
R23.3 **Completion %**: one number with a weighted breakdown, e.g. story chapters 40 %, CV office content read 10 %, tourist spots visited 15 %, postcards 10 %, achievements 25 % (weights in one table in code). Shown in the main menu (progress ring + %), the pause menu and the chapter map; per-category breakdown on tap/click.
R23.4 **Achievements panel**: grid of cards (icon, title, description, locked/unlocked, unlock date, counter progress bars, hidden as "???"), filter by category, reachable from the main menu, pause menu and map panel; works on phones (portrait and landscape, touch scrolling, large targets).
R23.5 **Unlock feedback**: toast + chime (existing style), never more than one toast at a time (queue); 25 / 50 / 75 / 100 % milestones get a slightly bigger moment; 100 % gets a reward (e.g. a gold paint option for the car and a thank-you card with the contact links from the CV).
R23.6 **Telemetry**: `achievement {id}` (exists) and `completion_milestone {pct: 25|50|75|100}` (coarse).
R23.7 **Tests**: harness scenario that unlocks a sample via test hooks, checks completion math, persistence across reload and the panel at 390×844 / 1280×720 with 0 page errors.

## Acceptance
- [ ] Every achievement is reachable in the current game (no orphan ids; a table in the progress log maps id → trigger).
- [ ] Completion % reaches exactly 100 when everything is done (harness check with all unlocked).
- [ ] Panel and menu ring look right on phone and desktop (screenshots).

## Requests

## Progress log
- 2026-11-07 06:30 UTC (progression) — R23.1–R23.7 implemented.
  - **Files**: `game/src/achievements.js` (new: `Progression`, `initAchievements(game)`, `WEIGHTS`, `ringSvg`), `ACHIEVEMENTS` block in `data.js` (63 entries: story 15, explorer 7, driver 12, local colour 12, photographer 7, on foot 5, secrets 5 hidden), `/* achievements */ … /* end achievements */` block at the end of `style.css`, hook lines: `hud.js` `achievement()` → `this.progression.unlock(id)`; `main.js` import + `initAchievements(window.game)` after `window.game = new Game()` (2 lines). Everything else observes `window.game` (4 Hz poll + call-through wrappers on `enterChapter, goToChapter, onCollide, closureText, playerHonk, onPhoto, buildNavList, spotPause`; per spot session `readPlaque` and `ui.toast`). Contract in 01-architecture (*Progression*).
  - **Stale ones**: `toll` (SR-520 not in any district) removed; `bridge` re-worded and now unlocked by the SeaTac → Bellevue montage (I-90 floating bridge); `flight` text re-worded (no invented flight facts); `red-light` / `first-honk` texts neutral for both cities.
  - **Persistence**: `localStorage['dmcv.progression.v1']` = `{v:1, unlocked{id: ts}, counters{walk, photos}, dist{rain,snow,fog}, sets{screens, roam, spots, plaques, rush}, milestones[], gold}`; chapters merged from `game.progress` (`dmcv:chapters`), postcards from `spotProgress()` (`dmcv.spots.v1`); progress made before this module unlocks silently on load (no toasts, no telemetry). Reset: panel footer "Reset progress…" → inline confirmation → clears the three keys and reloads.
  - **Completion** (one table `WEIGHTS`): story chapters 40 (n/10), CV screens read 10 (n/27), tourist spots visited 15 (n/24), postcards 10 (n/24), achievements 25 (n/63). Displayed % = floor, capped at 99 until every part is full → exactly 100 only when everything is done.
  - **UI**: ring + % + button in the main menu (above the controls; whole bar is the target on phones), at the top of the map panel's list (= chapter map / in-game pause) and in the spot pause panel. Panel `#achv-panel` (z 65, above menu / map / panels): big ring, collapsible weighted breakdown, category chips with n/m, cards (icon, title, desc, ✓ date, counter bars, hidden = "???"), 100 % reward area, reset. Full-screen on phones (≤ 600 px or landscape ≤ 500 px high), touch scroll (`overscroll-behavior: contain`), targets ≥ 40 px, Esc / ✕ / backdrop closes, keys never reach the game while open.
  - **Feedback**: own toast box `#achv-toasts` (top centre, visible in menu / office / spots where the HUD toasts are hidden), one at a time (3.8 s, milestones 5.2 s with a ring), chime de-duplicated with main.js' own chimes. 25/50/75/100 % milestones → bigger toast + `completion_milestone {pct}`. 100 % → gold paint (cockpit hood + parked car body, own material copy, toggle in the panel) and the thank-you card with the CV links (`PROFILE.links` + email), shown when the player is not driving (speed < 1) / in the menu.
  - **Verified** (`game/dev/harness/achievements-check.js`, standalone Playwright; Open-Meteo mocked): 21/21 checks — fresh 0 %; catalogue 63 unique ids / 7 categories; sample unlocks through real hooks (`hud.achievement('first-honk')`, `game.onPhoto({filter:'bw'})` → photo-first + photo-bw, `closureText` → roadworks); repeat returns false; max 1 toast visible; achievements share = 25 × 4/63 = 1.587 → 1 %; persistence across reload (ids + timestamps) with no telemetry re-send; secrets "???"; Esc closes; 390×844 and 844×390 panel fits width, scrolls (5640 / 2613 px content), min target 40 px; everything seeded → **exactly 100** (exact 100.000, all parts full) with milestones + gold set silently; all-but-one → 99 % (exact 99.60), the last unlock → `completion_milestone {pct:100}` once, thank-you card on top with 8 links; reset needs confirmation then 0 %; 0 page errors. Screenshots: /tmp/claude-0/-home-user-CalinaCristian-github-io/c23e7db4-0398-5255-9d52-f406a6fe27a7/scratchpad/progression/ (menu-1280, menu-390x844, panel-1280, panel-1280-secrets, panel-390x844(-scrolled), panel-844x390(-scrolled), toast-1280, milestone-100-1280, thanks-1280, thanks-390x844, panel-100-1280, reset-confirm-1280).
  - **id → trigger** (all reachable in the current game):

| id | trigger |
|---|---|
| ch-<chapter> ×10 | `game.progress.done` has the chapter (chapters.js) |
| all-buc | done ⊇ rosetti, upb, gts, luxoft, db, arnia, uipath-buc |
| flight | main.js after the flight into seatac, or seatac done |
| bridge | `goToChapter` seatac → uipath-bel resolved (montage over I-90) |
| all | main.js `finale()`, or all 10 chapters done |
| reader-all | 27 distinct `office.stop.id:screen` read (poll `game.office.read`) |
| roam-first / roam-all | `game.freeRoam.district` while driving / on foot (1 / all 8) |
| spot-first / spots-buc / spots-sea | `state === 'spot'` + `spotId` (1 / 10 Bucharest / 14 Seattle+Bellevue) |
| plaques-25 / plaques-spot | wrapped `SpotSession.readPlaque` (25 distinct / every plaque of the loaded spot) |
| law-abiding, night-owl, full-tank, ran-dry, navigator, fast-travel, red-light, victoriei, camera, police, pedestrian, first-honk, honk-10, rage-max | existing main.js `hud.achievement()` calls |
| rush-hour | ≥ 150 m driven inside 0.9 r of a `traffic.hot` hotspot at ≥ 50 % of its level: Piața Victoriei, Piața Unirii, Bd. Dimitrie Pompeiu, any I-405 one (Bellevue: NE 8th × 112th / I-405 ramps 16–18:30); 4/4. Free roam "morning rush" or the conditions slider makes them reachable any time |
| rain-drive / snow-drive / fog-drive | 1 km driven with `game.wxKind` rain|storm / snow / fog (free-roam weather picker) |
| clean-chapter | `onCollide` count 0 between `enterChapter` and `chapterDone` |
| nav-arrive | `navManual` route ends (arrival clears it) within 45 m of its destination |
| jam-stuck | Bucharest, `traffic.jamAt(player) > 0.4`, speed < 1 m/s for 60 s |
| roadworks | `closureText()` (closure approach toast) while driving |
| seattle-honk | `playerHonk()` with `city.id === 'seattle'` |
| jaywalker | `foot.bumped` changes (a moving car shoved the walker) |
| photo-first / photo-night / photo-rain / photo-bw / photo-roll | wrapped `game.onPhoto(meta)`: any / `r3d.nightLights` / rain (wxKind or spot weather) / `meta.filter === 'bw'` / 24 photos |
| postcard-first / postcards-all | `spotProgress().postcards` (1 / 24) |
| foot-first / foot-km / foot-jump | state foot / 1000 m walked (foot + spots, jumps of > 6 m per tick ignored) / `jumpY > 0.12` |
| foot-office | `state === 'office'` with `game.officeFromFoot` |
| foot-zebra | walker on the carriageway within (node.radius + 5) m of a `zebra`/`crossing` graph node |
| troll-night | in `fremont-troll` with `r3d.nightLights` (menu time "Night" or real night) |
| mountain-out / peacock | postcard toast text in the spot (`/Mountain out/` Kerry Park clear weather, `/peacock/` Spring Palace 2nd challenge) |
| potato / vlad | plaque "Memorial of Rebirth" (Athenaeum & Revoluției) / "Curtea Veche, 1459" (Old Town) read |

  - **Requests filed**: spec 10 (gameplay: the main menu card is ~940 px tall and the overlay does not scroll — pre-existing), spec 15 (spots: optional `onPlaque` / `onPostcard` host callbacks; keep the matched strings meanwhile). Telemetry doc (orchestrator): add `completion_milestone {pct}` to the event list in telemetry-game.js' header / spec 21.
  - **In game** (`--game`, software GL, chapter 1 Floreasca + Kerry Park): map panel ring ✓ (`map-1280.png`), real `playerHonk()` → first-honk via main.js ✓, exitCar → foot-first + foot-jump ✓ but only 0.7 m walked in 10 s (frame-starved; distance check relaxed to > 0), Kerry Park visit + 3/3 plaques → spot-first + plaques-spot ✓, spot pause panel gets the ring block (DOM ✓; the screenshot caught the scene after the panel closed), 0 page errors. Not exercised end to end in a browser: rush-hour, weather drives, jam-stuck, zebra, clean-chapter, nav-arrive, secrets (logic only, triggers in the table above).
