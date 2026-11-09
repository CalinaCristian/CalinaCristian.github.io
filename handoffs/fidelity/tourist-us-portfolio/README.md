# US tourist portfolio: six featured experiences

Review of `a786ba6bb18c031432f0464c06e6a2fa93ad5dfe`, 2026-11-08. Scope: **all 14 US entries in 12 scenes** (Seattle 10 + Bellevue 4). The whole game has 24 entries in 19 scenes. No source, geometry, registry, or real location was changed.

Feature these six, in this order: **Pike Place, Kerry Park, Fremont Troll, Seattle Center, Meydenbauer Bay, Waterfront/Great Wheel**. Seattle Center is one menu experience containing the Needle, Chihuly and MoPOP. This is a portfolio/design recommendation, **not approval to expose unfinished scenes**.

## All 14 decisions

Footprints below are dossier extents, not proposed mandatory walking routes. Distances are observed spawn → action-centre straight lines; real walking routes can be longer. On-foot walking is 1.7 m/s (`game/src/onfoot.js:12`). A <20 s approach needs a real traversable route under roughly 34 m; the proposed arrival targets below have not been play-tested.

| Priority / entry | Decision | Dossier extent | What the current scene actually offers; approach | Current menu gate |
|---|---|---|---|---|
| 1 Pike Place | **Promote after fixes** | 398 × 376 m | Best replayable input: timed E salmon catch; aimed gum placement; Rachel coin. Fish 49 m away, gum 56 m. | Hidden |
| 2 Kerry Park | **Keep** | 225 × 144 m | Immediate skyline; sculpture framing 9 m away. Blue-hour action checks dusk and gives a toast; it does not advance time. Keep for the view. | Listed |
| 3 Fremont Troll | **Promote after fixes** | 150 × 243 m | Distinct compact sculpture; E relocates onto hand/Beetle, rather than a climbing skill system. First climb 45 m away. | Hidden |
| 4 Space Needle | **Promote; anchor Seattle Center** | 233 × 243 m | 41 s elevator with E ×4 hurry; walkable Loupe/deck, free look, glass-floor view. Lift 46 m away. | Hidden |
| 4 Chihuly | **Merge into Seattle Center** | 173 × 177 m | Glasshouse view; E tilts the camera and awards activity. Sculpture 32 m from its own spawn. No implemented colour puzzle or glassblowing demo. | Hidden |
| 4 MoPOP | **Merge into Seattle Center** | 218 × 276 m | Exterior + moving train; photo checks train proximity. E is a presence check/toast, not music play. Monorail action 109 m from its spawn. | Hidden |
| 5 Meydenbauer Bay | **Keep; improve activity** | 278 × 409 m | Crescent pier/lake view. Stones 27 m away give random count + sound/toast. Kayak 86 m away is a fixed 156.6 s route with free look, not player paddling. | Listed |
| 6 Waterfront / Great Wheel | **Promote after fixes** | 293 × 398 m | Gondola/free look/early E exit; full ride is 270 s. Booth 85 m away. Strong view potential, passive ride. | Hidden |
| 7 Gas Works | **Optional scenic alternate** | 397 × 299 m | Distinct industrial/lake view; kite 66 m away. E toggles animated wind-following kite; no steering/tension game. | Listed |
| 8 Ballard Locks | **Optional; finish visitor activity first** | 285 × 376 m | Water/boats cycle automatically; E shortcuts fill/drain at control 65 m away. No salmon-count game. Visitors do not operate real locks. | Hidden |
| 9 Botanical Garden | **Optional bridge vignette** | 390 × 409 m | Real end-to-end bridge crossing + visual sway; **302 m approach** from current spawn. Plant “game” reads labels, not photo identification. | Hidden |
| 10 Downtown Park | **Optional waterfall stop** | 420 × 321 m | Waterfall view, coin toast. Loop start 33 m away; required ring is ~673 m in code (~6.6 min walking), despite “half-mile” name. | Listed |
| 11 Pioneer Square | **Drop from featured; retain optional place** | 308 × 332 m | Underground starts 14 m away but is 20 s automatic camera travel; pole is a 22.4 s sequence of seven fact toasts. No Smith Tower elevator visit implemented. | Hidden |
| 12 Lincoln Square | **Drop from tourist featured; use career finale** | 353 × 442 m | Badge 53 m away teleports to an explicitly illustrative UiPath floor. Good CV context; weak tourist play. No skybridge collection game implemented. | Listed |

## Why the best US content looks hidden

`game/src/spots/index.js:21–48` keeps every entry in `SPOTS_ALL`; `:79–91` filters the ordinary menu/map through `READY`. Only **Kerry, Gas Works, Lincoln, Downtown Park and Meydenbauer** are listed: 5/14 US entries. The other nine load by ID and reviewers can use `?spots=all` (`:91–93`). Do not flip `READY` to bypass review.

The gate is historical evidence, not today's quality certificate. `specs/15-tourist-spots.md:254` names Kerry/Gas as ready candidates while leaving the other Seattle scenes unfinished. `specs/STATUS.md:52` calls Botanical partial. Today's zero audit count for Botanical does not establish photographic fidelity or a good arrival route.

All 14 have dossier descriptions, OSM extracts, terrain and individual licence ledgers. **No actual reference image files are present in these 14 checkout folders.** The JSON has reference links for the first eight Seattle entries; Ballard/Gas and all four Bellevue entries have empty `refs` arrays and “vetted candidates not yet fetched” ledgers (historical HTTP 429). Reference links/descriptions are preserved; this review did not perform a fresh reference-photo comparison.

## Existing input versus autoplay

| Scene evidence | Implemented behaviour / missing promise |
|---|---|
| `scenes/pike-place.js:119–131`, `:214–248`, `:432` | Gum raycasts within 3.5 m and cycles colour automatically; catch requires E near arrival; coin is sound/toast. Five gums do not check a heart shape. |
| `scenes/fremont-troll.js:491–496` | Two E relocation actions; nose toast gated by height. No implemented hand→wrist→nose→head route. |
| `scenes/kerry-park.js:82`, `:101–102` | Framing preset; blue-hour condition/toast. Rainier visibility is weather-dependent view content. |
| `scenes/seattle-center.js:60–95`, `:298–301`, `:345–350` | 41 s cab, controllable walking at top; Chihuly camera preset; monorail moves at 12 m/s with 6/12 s terminal pauses, despite “~10 minutes” toast. |
| `scenes/waterfront.js:61–78` | 270 s autoplay ride; early exit after >60 s also awards the activity. Label says “≈4 min.” No in-ride challenge beyond looking/photo. |
| `scenes/bel-meydenbauer.js:300–321` | Pier is player walking; kayak follows 328.803 m polyline at 2.1 m/s with walking disabled, no steering/paddle input or early-exit action. Rentals gated May 15–Sept 30; `season=summer` alone does not change the calendar date. Stones are random toast/sound. |
| `scenes/gas-works.js:170–177` | One toggle, then kite position follows time, player position and wind automatically. |
| `scenes/ballard-locks.js:113–126` | Auto-fill begins after ~20 s from scene start, then 25 s fill/hold/drain phases; E begins fill/drain, reward fires at start. Gate/valve operation is named but not player-sequenced. Prefer authentic visitor watching/photo timing; any operator mode must be explicitly a simulation. |
| `scenes/bel-botanical-garden.js:44`, `:116–123` | Bridge endpoints award traversal; visual plank sway, fixed walkable collision. Five read-label presses award plants. |
| `scenes/bel-downtown-park.js:24`, `:182–200` | Signed angular travel around R+8=107.15 m; loop length ~673 m. Coin only sound/toast. |
| `scenes/pioneer-square.js:174–199` | 7×3.2 s pole sequence and 20 s disabled-walking Underground camera trip. Source-position cleanup belongs to the locations audit branch. |
| `scenes/bel-lincoln-square.js:109–112` | Badge + illustrative floor teleport and return elevator; no actual private interior fidelity claim. |

Paths in this table are relative to `game/src/spots/`. Dossier per-entry source/footprint anchors: `game/research/seattle-spots.md:65,102,128,157,187,212,240,267,299,328,352,385,412,437`; source URLs and licences remain in the JSON and `game/research/refs/sea-spots/<id>/LICENSES.md`.

## Today's bounded runtime check

`observed.json` records all 12 scenes / 14 members, spawn/action coordinates, distances, condition availability, triangles, timings and audit counts. System Chromium 156.0.8078.79, muted, SwiftShader, low quality, clear/day/summer visuals, explicit July date, manual frames. **All loaded with zero non-audit page errors.** This was not a complete play-through or fidelity pass; audit counts can include false positives.

| Scene | Scene triangles | Local load ms | Audit counts |
|---|---:|---:|---|
| Pike Place | 484,037 | 3,926 | zfight 30; signTilted 1 |
| Seattle Center (3 entries) | **1,113,342** | 3,968 | badGeometry 2; zfight 42; phantom 1; pedBelow 3 |
| Fremont Troll | 340,521 | 4,810 | badGeometry 1; zfight 72 |
| Kerry Park | 674,065 | 2,109 | badGeometry 2; zfight 9 |
| Waterfront | 344,335 | 3,949 | badGeometry 1; zfight 24; pedBelow 6; pedSunk 6 |
| Pioneer Square | 391,859 | 4,624 | zfight 12 |
| Ballard Locks | 457,099 | 2,071 | badGeometry 5 |
| Gas Works | 661,882 | 1,666 | zfight 8 |
| Lincoln Square | 283,852 | 708 | zfight 33 |
| Downtown Park | 624,537 | 2,121 | zfight 31; phantom 1 |
| Botanical Garden | 637,986 | 2,843 | none |
| Meydenbauer Bay | 593,736 | 2,364 | zfight 28 |

Seattle Center currently exceeds the ≤1M tourist scene budget. Five scenes exceeded the <3 s local load target in this run. Software-renderer timings are observations, not target laptop/phone measurements or FPS promises. Retain ≤1M / <3 s goals and review on target hardware before release.

Eight attached JPGs were inspected: Pike, Needle, Troll, Kerry, Gas, Waterfront, Meydenbauer, Botanical. They are default 72° dev-camera views at postcard coordinates, **not reference A/B approvals**. Visible issues include small skyline framing at Kerry, sparse Waterfront forecourt, and coarse garden surroundings; recognize the place without calling it finished. See [scene-briefs.md](scene-briefs.md) for six isolated implementation proposals.
