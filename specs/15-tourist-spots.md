# 15 — Tourist spots (walk-only bonus scenes)

Bonus content: the must-see tourist places of each city, built as small high-fidelity areas explored on foot (no
driving). Owner role: **spots**. Inputs: research dossiers (spec 20), `OnFootController` (spec 14), `PhotoMode`
(spec 16), landmarks.js. Framework, API and how to add a spot: `game/src/spots/README.md`. Open work:
`handoffs/fidelity/BACKLOG.md`.

## Requirements

R15.1 Top 10 spots per city chosen by evidence (tourism rankings, Wikipedia / Wikivoyage "see" lists, visitor numbers) in research.
Candidates:
- **Seattle + Bellevue**: Pike Place Market (Gum Wall, original Starbucks, fish throwing, the neon sign), Space Needle +
  Seattle Center, Chihuly Garden and Glass, MoPOP, Fremont Troll, Kerry Park, Waterfront + Great Wheel, Pioneer Square +
  Smith Tower, Ballard Locks, Gas Works Park; Bellevue: Lincoln Square + Bellevue Square (UiPath's office), Downtown Park,
  Botanical Garden, Meydenbauer Bay Park.
- **Bucharest**: Palace of the Parliament, Old Town (Lipscani, Hanul lui Manuc, Stavropoleos), Romanian Athenaeum +
  Piața Revoluției, Cărturești Carusel, Arcul de Triumf, Herăstrău + Village Museum, Calea Victoriei + CEC Palace,
  Cișmigiu Gardens, People's Salvation Cathedral, Spring Palace.

R15.2 Each spot: a walk-only scene (~150–400 m across) at 1:1, built at high fidelity from research (dimensions,
materials, colours, signage, props, vegetation), with the real neighbouring façades as backdrop, ambient crowd and sound,
and time of day + weather + season from spec 18. Source context keeps its source ids, all rings / holes and literal
heights; anything estimated is named as an estimate.

R15.3 Interactions: 3–6 info plaques per spot (short facts, sources), a postcard photo challenge (spec 16), and
spot-specific activities.

R15.4 Access: the menu lists the ordered `MENU_ORDER` set in `game/src/spot-availability.js` — at most three visits per
Bucharest / Seattle / Bellevue and six to eight in total. Currently seven: Old Town, Cișmigiu, Arcul de Triumf, Pike
Place, Space Needle (combined with Chihuly), Meydenbauer, Downtown Park. Every other spot stays loadable by id (dev page,
`?spots=all`). Retired visits and activities (`RETIRED_ACTIVITIES`) keep earned history but do not count toward current
completion; achievement ids stay stable for saves (an achievement may accept an old activity key, e.g. the Glasshouse's
`chihuly:` key). Menu touch targets are at least 44 px. The historical `READY` review set is not a menu gate.

R15.5 Each spot loads in < 3 s, has ≤ 1 M unique scene triangles and runs at 60 fps at Auto. Submitted triangles
(including shadow passes) are recorded separately from unique geometry; a warm cache or software-GL timing does not
prove the cold hardware target.

R15.6 **Living crowds with chat bubbles**: tourists, locals, vendors, guides, buskers and staff react with chat bubbles
when the player walks up, bumps into them, takes their photo or idles nearby, plus ambient chatter. Lines come from
cultural research per city and spot (Romanian with an English line below in Bucharest; English plus tourist languages in
Seattle), fit the local time, weather and season, and avoid stereotypes and slurs. Bubbles use the driving reaction
system (spec 13).

R15.7 **Copyrighted public art and buildings**: artworks (Fremont Troll, Chihuly glass, Rachel the pig, sculptures) are
modelled in 3D from researched descriptions and dimensions, never with photo textures, and the artist is credited on a
plaque. The same holds for buildings in Romania (no freedom of panorama): photos are reference only. Deep water and
dangerous structures stay unwalkable (Gas Works towers are fenced). Pike Place is car-free. Space Needle, Chihuly and
MoPOP share one `seattle-center` scene; the `space-needle` entry owns its visit and activities, and MoPOP stays as mapped
context with no activity, challenge, plaque or spawn.

R15.8 **Short optional tours**: choose an available activity first, then a nearby fact and the spot's postcard view —
at most three stops and 300 m of validated walking path. Free exploration stays available. A narration timer never
completes an activity; a photo stop needs the real postcard capture. Skip (J or the button) and End are always available
and a skipped tour grants no tour achievement. Tour advancement pauses during maps, photos, drone flight and rides.
Inaccessible destinations are rejected, never substituted. Switching entrance in a shared scene refreshes the title,
objectives and photo metadata and cancels the previous tour without teleporting the guide.

R15.9 **Activities**: an activity completes only through its real play and its visible animations; cancelling, leaving
or an idle timer awards nothing and keeps the tour stop unfinished. Opening an activity does not end the tour; its
completion advances the current stop once. Hosts cancel activities before pause, photo, drone and map takeovers. While an
activity is open at phone widths or short landscape heights, the title card compacts to the current step with 44 px
Skip / End, the activity panel sits below it and scrolls within the remaining viewport, notifications never cover
Skip / End, and map / drone / pause / movement launchers are hidden; everything is restored on close. Keyboard alone can
complete every activity.

R15.10 **Spot map**: named or custom waypoints by pointer, touch or keyboard list; a HUD shows direction and distance and
a blue validated walking route (guide routes are gold); unreachable points are marked without a route line. Clear removes
the pin; a shared-scene teleport clears it. Visit boundaries constrain the walker, the guide and route planning.

R15.11 **Visit content**:
- **Cișmigiu — table at La Șahiști.** A real game of table (Romanian backgammon) on the board itself against Doru, a
  fictional park regular; the player sits on the east seat. The camera leans in to show the whole board as large as the
  screen allows, clear of a slim activity bar with large dice faces (desktop, phone portrait, short landscape); it drops
  above the dice while they roll and looks up at Doru when he speaks. The player throws (button, E / Space or a tap on
  the dice), then taps or drags a ringed checker to a marked landing spot (a spot reached with both dice plays them in
  turn); Take back undoes within the turn; the dice are handed over explicitly once nothing more can be played and pass
  by themselves when no move is possible. Doru moves his checkers one at a time. Rules follow Romanian practice
  (`game/research/table-cismigiu.md`): no cube, the opening winner throws both dice again, both dice compulsory and the
  higher when only one can be played, linie 1 / marț 2 / marț tehnic 3, score kept to three lines across games. Doru and
  an onlooker talk in Romanian with an English line below (dice called the Romanian way, luck rated against all 36
  throws, reactions to hits, gates, a closed board, bare checkers, the race, a marț, slow play, the result); the player
  can talk back and ask for advice, shown on the board. Standing up mid-turn returns the turn to its roll and keeps the
  game for the next visit. Only a won game completes the activity; the tour step completes when the player then gets
  up.
- **Cișmigiu — boat and bike.** Rowing needs repeated strokes that visibly move both oars, from the mapped Debarcader
  (dry-bank approach) around a course inside the lake clear of the bridges; the full return course completes it. The
  bike station by the arrival alley is an estimate (none is mapped); a bike stays where the rider got off and E beside it
  gets back on.
- **Old Town.** Freddo dance and shot complete only after real play; entering the doorway alone does not. Day
  activities (`scenes/old-town-daylife.js`, `game/research/old-town-daylife.md`) stand in front of real OSM places found
  open, with their hours; a closed place says when it opens and a closed-down place gets no activity. Props are
  held in the hand; nothing is added to buildings or streets except the busker's guitar case. Terrace furniture needs
  OSM `outdoor_seating=yes`; a name alone gives a sign only. The visit boundary is enforced after walker movement and
  crowd push-out; the source streets beyond stay as scenery.
- **Arcul de Triumf.** `arcul-race`: beat both visible opponents over the complete legal walking course (mapped
  pedestrian ways plus short public-apron connectors that add no mapped paving); stopping, losing or cancelling never
  awards it. `arcul-baguette`: three consecutive timed catches; a miss resets the streak.
- **Seattle Center.** One builder, `spots/space-needle.js`, serves the visit, every backdrop and the driving-world
  proportions (OSM parts of way 12903132, Street View, licensed reference photos). Both public levels are walkable and
  fitted out — 500 ft The Loupe (glass floor turning at its real rate, The Loupe Lounge) and 520 ft (Atmos Cafe, Atmos
  Wine Bar, open-air deck) — joined by a stair; the elevator runs from the base pavilion to 520 ft and back from either
  level. Night: baked floodlighting, rooms lit by their fittings, halo and beacon from dusk. Eating and drinking at the
  three counters are step-by-step held-item activities with a running bill; menu prices are game-authored and say so,
  only the $35–39 ticket is the mapped `charge`. The Glasshouse, Loupe and Monorail photo exercises need manual looking,
  a steady frame and an explicit shutter.
- **Other scenes.** View activities need an aimed capture (Athenaeum and Spring Palace: three aimed shutters from the
  public approach; Kerry Park city lights: a dusk / night capture). Walking courses (Palace pacing, the Botanical Garden
  bridge, the Downtown Park loop) need continuous walking on the existing paths; their waypoints add no physical
  markers. No activity implies an indoor visit that is not modelled.

R15.12 **Technical contracts**:
- Ground: `Ground.settle` adds its residual beneath the authored modifiers; `Ground.corridor` joins segment profiles
  continuously while keeping source centrelines and grades. Once terrain is emitted, walking and aircraft support use the
  emitted triangles; `heightAt` keeps the analytic field. Drone altitude uses `flightHeightAt()`.
- Walls and floors: planner and fallback wall queries interpolate a segment's height bands at the closest point, so
  elevated rails do not block lower floors; floor probes honour `noFloor` and ancestor visibility.
- `placeLandmark` translates the landmark's rotated colliders (polygons, holes, height bands), never full-height boxes
  for every volume.
- Tree LOD with an eye height uses the 3D distance to the emitted crown; all authored and source trees and colliders are
  kept.
- Source mountains keep all mesh bytes, compress about the current camera and set a finite far bound only while visible.
- Returning to the menu disposes the visit and calls `Renderer3D.releaseScene()`, releasing scene, player, vegetation and
  backdrop references.

## Acceptance

- Each menu visit is playable on foot, passes visual QA with no medium+ defects and is recognisable beside reference
  photos.
- Plaques have sources; the photo challenge works on desktop and mobile.
- Every menu activity completes through normal input on desktop, touch and keyboard, awards nothing when cancelled, and
  fits 390×844 and 844×390 alongside the tour controls.
- Arc: each interpretation plaque (the whole tilted .62 × .42 m plate) clears every course leg, source road and solid;
  the mapped flagpole (node 11056553808, 27–31 m) stands once on the roof.
- R15.5 is met in a cold load on hardware, and the overview evidence for each spot is current.
