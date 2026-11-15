# Backlog · the one list of open work

Only what is still open. A finished item is removed once its fix is on `master` and re-checked live (owner reports: at
the report pose, from the F8 JSON the owner pastes); its record is the git history. Rules, push checks and what this
folder may hold: [`AGENTS.md`](../../AGENTS.md).

## Owner reports

2026-11-15 reports (F8 poses: eye x, y, z · bearing° · pitch°). Grozăvești overpass lines, windows in roof, missing fence, support
block, "looks odd", the SeaTac sign, Pasajul Unirii, Palatul Regal overlap, the NetBet legs and the Otopeni walkway are fixed and re-checked live (removed). Fixed on master a3fdd88b, still to re-check live:

| Pose | Report | Status / next step |
|---|---|---|
| Grozăvești (83, 8, 120) · 300 · -35 | "weird fences": railing cages on the median | Fixed (median fill joins); re-check live |
| Pipera (711, 24, 183) · 228 · -11 | "buildings within buildings?" | Real per OSM (Fabrica de Glucoză 6-8: towers w938553616–620 over blocks w938553607–610); apartment towers now draw as residential blocks, not glass (68 in Pipera, 67 in Bellevue); re-check live |
| Pipera (-1284, 9, 85) · 54 · -69 | lanes misplaced | Fixed (opposite one-ways overlapping narrowed to the midline); re-check live |
| Romană, UiPath building | "is this how uipath looks?" | Remodelled from the leasing photos (stone block, glass storey, set-back glass box with the logo); re-check live |
| Romană (-254, 1, -319) · 219 · 18 | door flicker | Fixed (entrance() offsets, 11 landmarks); re-check live |
| Tourist spots | activities / map lists / photo walks / signs / bikes / boats / hidden bar / busker / race / pétanque / Starbucks / see-through people / bike + map / minimap | Shipped, plus one real activity each for Kerry Park (hoops), Athenaeum (concert), Spring Palace (peacock), Botanical Garden (Garden d'Lights hunt), Lincoln Square (bowling), Pioneer Square (ping pong). Those six spots are not in the spot menu (MENU_ORDER), so their achievements count only with ?spots=all — open |
| Spot surroundings | broken buildings at Cișmigiu / Arcul, top storey cut, distant buildings moiré | Shipped (facade-finish.js); roofs stay flat unless OSM tags a shape — open |
| Bellevue | "LINCOLN SQUARE" sign, UiPath sign, lanes | Signs, driveway lane paint and real one-way widths shipped (buildings on carriageways 4 → 0; 10620 NE 8th St clipped to the sidewalk line as a documented exception). Open: lane lines jump up to ~3.5 m where a restored run meets a different lane count; bare junction interiors at 112th / NE 8th and the I-405 ramp terminal |
| SeaTac (-953, 2, 995) · 100 · 1 | airport drives broken | Shipped (SeaTac-only flags in cities.js): barriers out of lanes, one kerb per one-way chain (line jumps 82 → 37), ramp narrows once with a taper, lane-drop tapers on the decks, guards on raised fill (railing open ends 34 → 13), no railing inside the garage decks; re-check live. Open: Ramp w31928834 overlaps w31928843 by ~1 m; Airport Expressway 3-lane parts sit 1.85 m off their mapped line |
| Pike Place spot (-147, -3, -53) | broken below street level; fish throw | Shipped: market floors at street level, bluff railings; fish crew throw (catch 3 of 5, 7–17 h); re-check live |
| Space Needle (4, 155, -6) · 142 · 26 | "why do I see a roof here": stair under a closed slab | Shipped (stairwell opened in the Loupe ceiling); re-check live |
| Meydenbauer (19, 1, -11) · 126 · -21 | people sitting on nothing | Shipped (sitters on a real seat, a spawned bench with a collider, or a blanket); no sitter on the Fremont Troll; re-check live |
| Bellevue parks | creative, working activities | Shipped: Downtown Park frisbee, swing, winter rink; Meydenbauer paddleboard, swim to the float, stone skips (park hours); Botanical Garden still has only the bike and its bridge walk — open |

## Other open work

| Item | Evidence | Next step |
|---|---|---|
| Chapter drives at legal speed (`--scenario=drive:<id>`, 300 s): master arrives 35/60 (10 chapters × 6 variants, 2026-11-15); otopeni, seatac and upb always, gts, arnia and uipath-bel never | The `knots` notes in each drive result (what the car ahead of the stalled player waits for, link by link) put the lost time at the squares: 45–50 s reds at Piața Unirii, Victoriei, Romană / Magheru and NE 8th St (signals.js caps a square at a 60 s cycle), first-come box claims of cars still crawling through a big cluster, lane drops on NE 8th St, and zebra walkers inside Piața Unirii. Nine rounds of knot fixes did not beat master. Spot rules (rounds 1–8) only moved the jams. A general wait-for resolution (round 9, branch `worktree-agent-a83ca3adc955d6452`, not merged) cut NPC knot time 75 % and resets 37 % but arrived 32/60 | The owner decides: shorter square cycles / budget, or treat this as realistic traffic and gate only on deadlocks (no NPC still > 120 s). Measure any change with 6 variants × 10 chapters against master in one batch |
