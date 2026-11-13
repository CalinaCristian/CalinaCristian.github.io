# 23 — Achievements and completion %

Owner role: **progression** (`game/src/achievements.js`). Hooks in gameplay files go through the gameplay role (see 01-architecture), except the small, clearly delimited hook lines this spec lists.

## Why
Give players a reason to explore everything the game offers (story, free roam, tourist spots, photo mode, on foot) and show how much of it they have seen.

## Requirements
R23.0 **Completion scope** follows `spot-availability.js`: city visits, postcards, guided-tour targets and activity
achievements count only for the destinations currently in the menu, before and after the scene registry loads. Retired
activities and destinations stay stored in saves (earned history) but never count. A hidden development show-all option
may expand this scope.
R23.1 **Catalogue** of achievements in categories, each with id, icon, title, description, category, optional `hidden` (shown as "???" until unlocked) and optional counter target (e.g. 7/10):
- **Story**: each chapter completed, Bucharest done, the flight, story complete.
- **Explorer**: every district opened in free roam, each tourist spot visited, all spots of a city, all plaques of a spot, all postcards.
- **Driver**: a long drive without fines, crossing a real rush-hour hotspot (Piața Victoriei, Piața Unirii, Bd. Dimitrie Pompeiu, I-405) at peak, a night drive, rain / snow / fog drives, refuelling, a chapter with zero crashes, following a nav route to the end, fast travel.
- **Local colour** (witty, from the research files: traffic culture, honking, roadworks, Seattle politeness, weather): honks, red light, rage max, roadworks closures, etc.
- **Photographer**: first photo, a night photo, each landmark postcard, photo in the rain.
- **On foot**: walk 1 km, enter an office on foot, jump, cross at a zebra.
- **Secrets** (hidden): small easter eggs grounded in real places (researched facts only).
- Every active achievement must be reachable in the district maps.
R23.2 **Persistence** in `localStorage` (versioned key, unlock timestamps, counters) mirrored to IndexedDB by `save.js`, merged with chapter progress (`chapters.js`) and spot progress (`spots/index.js` `spotProgress()`); survives reloads; a "Reset progress" action (with confirmation) in the settings / pause menu.
R23.3 **Completion %**: one number with a weighted breakdown, e.g. story chapters 40 %, CV office content read 10 %, tourist spots visited 15 %, postcards 10 %, achievements 25 % (weights in one table in code). Shown in the main menu (progress ring + %), the pause menu and the chapter map; per-category breakdown on tap/click.
R23.4 **Achievements panel**: grid of cards (icon, title, description, locked/unlocked, unlock date, counter progress bars, hidden as "???"), filter by category, reachable from the main menu, pause menu and map panel; works on phones (portrait and landscape, touch scrolling, large targets).
R23.5 **Unlock feedback**: toast + chime (existing style), never more than one toast at a time (queue); 25 / 50 / 75 / 100 % milestones get a slightly bigger moment; 100 % gets a reward (e.g. a gold paint option for the car and a thank-you card with the contact links from the CV).
R23.6 **Telemetry**: `achievement {id}` (exists) and `completion_milestone {pct: 25|50|75|100}` (coarse).
R23.7 **Tests**: harness scenario that unlocks a sample via test hooks, checks completion math, persistence across reload and the panel at 390×844 / 1280×720 with 0 page errors.

R23.8 **Dinamo drone football secret**: a football starts on the centre spot at Stadionul Dinamo; physically nudge it with the drone and score in either rendered goal to unlock hidden `dinamo-drone-goal` ("Air striker"). The whole ball must cross from the pitch side between the posts and below the crossbar after a real drone touch; placement, high flyovers, side/back entry, and misses do not count. Keep the ball in the district triangle budget; reset a scored/out-of-play ball and dispose it on district changes.

## Acceptance
- Every achievement is reachable in the current game (no orphan ids; a test maps every id to its trigger).
- Completion % reaches exactly 100 when everything is done (harness check with all unlocked).
- Panel and menu ring look right on phone and desktop (screenshots).
