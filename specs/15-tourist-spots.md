# 15 — Tourist spots (walk-only bonus scenes)

Owner role: **spots** (new agent, after research). Inputs: research dossiers (spec 20), `OnFootController` (spec 14), `PhotoMode` (spec 16), landmarks.js.

Bonus content: only the most important, must-see tourist places in each city (top 10), e.g. the Fremont Troll and the Gum Wall in Seattle, built as small high-fidelity areas you explore on foot (no driving).

## Requirements
R15.1 Top 10 per city chosen by evidence (tourism rankings, Wikipedia/Wikivoyage "see" lists, visitor numbers) in research. Initial candidates (research confirms/replaces):
- **Seattle area = Seattle + Bellevue**: Seattle top 10 — Pike Place Market (+ Gum Wall, original Starbucks, fish throwing, the neon sign), Space Needle + Seattle Center, Chihuly Garden and Glass, MoPOP, Fremont Troll, Kerry Park viewpoint, Waterfront + Great Wheel, Pioneer Square + Smith Tower, Ballard Locks, Gas Works Park; **plus Bellevue's top spots** (research picks 3–5): Lincoln Square + Bellevue Square + the skybridges (UiPath's office is in Lincoln Square), Bellevue Downtown Park (waterfall, canal ring), Bellevue Botanical Garden, Meydenbauer Bay Park, Bellevue Arts Museum, The Bravern, Old Main Street.
- **Bucharest**: Palace of the Parliament, Old Town (Lipscani, Hanul lui Manuc, Stavropoleos), Romanian Athenaeum + Piața Revoluției (Memorial of Rebirth), Cărturești Carusel, Arcul de Triumf, Herăstrău/King Michael I Park + Village Museum, Calea Victoriei + CEC Palace, Cișmigiu Gardens, Patriarchal Cathedral hill, Therme or National Museum of Art (research decides).
R15.2 Each spot: a small walk-only scene (~150–400 m across) at 1:1, hand-built at HIGH fidelity from research (dimensions, materials, colours, signage, props, vegetation), with real neighbouring façades as backdrop, ambient crowd, ambient sound, time of day + weather + season from spec 18.
R15.3 Interactions: 3–6 info plaques per spot (short facts, sources), a "postcard" photo challenge (spec 16), spot-specific fun (throw a coin, stick gum on the Gum Wall, catch a fish at Pike Place, climb onto the Troll's hand, honk-free zone).
R15.6 **Living crowds with chat bubbles**: each spot has people around (tourists, locals, vendors, guides, buskers, staff) who react with chat bubbles when you walk up, bump into them, take their photo, or idle nearby, plus ambient chatter between them. Lines are written from cultural research per city and spot: language mix (Romanian with English translations in Bucharest; English plus the many tourist languages in Seattle), local humour and typical small talk, spot-specific lines (Pike Place fishmongers calling orders, Gum Wall reactions, Old Town terrace waiters, Parliament tour guides with real facts), tone and etiquette (friendly, no stereotypes or slurs). Bubbles use the same system as the driving reactions (spec 13) with a translation line under non-English text.
R15.7 **Copyrighted public art** (owner decision): model artworks (Fremont Troll, Chihuly glass, Rachel the pig, sculptures) faithfully in 3D from the researched descriptions and dimensions, never with photo textures, and credit the artist on an info plaque. Same rule for buildings in Romania (no freedom of panorama): 3D modelling is fine, photos only as reference. Gas Works towers stay fenced (no climbing). Pike Place is car-free. Space Needle + Chihuly + MoPOP share one `seattle-center` scene with three spawn points.
R15.4 Access: "Bonus: Tourist spots" menu + unlocked by finishing a chapter in the same city (or always available — owner to decide; default: always available from the menu).
R15.5 Each spot loads in < 3 s; ≤ 1 M triangles; 60 fps at auto.

## Acceptance
- [ ] 20 spots playable on foot, each passes visual QA review with no medium+ defects and is recognisable from reference photos side by side (screenshots in the log).
- [ ] Plaques have sources; photo challenge works on desktop + mobile.

## Requests
### → gameplay (`main.js`, `game/index.html`): menu entry + hosting a spot (spots role, 2026-11-07)
Everything spot-specific lives in `game/src/spots/` (`startSpot` does the Renderer3D wiring, walker, crowd, UI, sound). The game only needs a menu entry, a `spot` state and three PhotoMode hooks (≈ 30 lines):
```js
import { SPOTS, startSpot } from './spots/index.js';
// menu (R15.4, default: always available): "Bonus: Tourist spots" → one button per SPOTS entry (group by city / area 'bellevue')
//   e.g. for (const s of SPOTS) list.append(button(s.name, s.blurb, () => this.enterSpot(s.id)))
async enterSpot(id) {
    this.photo?.close(); this.foot?.exit?.(); this.state = 'loading';
    document.body.classList.add('in-spot');                       // hide the driving HUD (see cockpit-ui request below)
    this.spot?.dispose();
    this.spot = await startSpot(id, { r3d: this.r3d, camera: this.camera, input: this.input, photo: this.photo, audio: this.audio,
        onProgress: (t) => this.hud.prompt(t) });
    this.hud.prompt(null); this.state = 'spot'; this.input.lookAllowed = true;
}
leaveSpot() { this.photo?.close(); this.spot?.dispose(); this.spot = null; document.body.classList.remove('in-spot'); /* back to the menu or reload the chapter (loadCity) */ }
// loop(): if (this.state === 'spot') { this.spot.update(dt); this.r3d.frame(dt); return; }   (before the drive/foot branches)
// Esc / M in a spot → pause panel with "Leave tourist spot" → leaveSpot()
// PhotoMode (spec 16): canOpen: also state === 'spot'; getScene: state === 'spot' ? this.spot.spot.scene : …;
//   getInfo: state === 'spot' ? this.spot.photoInfo() : …; onPhoto(meta): also this.spot?.onPhoto(meta)
// optional: unlock toast when a chapter in the same city completes: "New: tourist spots in Seattle"
```
`camera.near` is lowered to 0.1 and `far` raised to 9000 by the session (Kerry Park / Meydenbauer views); restore on leave if the drive needs other values.
### → gameplay (`onfoot.js`): obstacles at non-zero ground height
`OnFootController.collide()` skips every obstacle when `feet > 1.3` (absolute). Spot terrain is not at y = 0 (Pike Place −6 m, Kerry Park −20 m…), so people / cars passed via `obstacles()` never block there. Suggest `if (feet - (o.y ?? this.y) > 1.3) continue;`. Until then `SpotSession._pushOut()` resolves people and cars itself.
### → cockpit-ui (`style.css`): hide the driving HUD in a spot
`body.in-spot #hud, body.in-spot .pad .drive-only { display: none; }` (the spot overlay is `#spot-ui`, styled by `spots/ui.js`; photo mode already hides it via `body.photo-mode`).
### → qa (spec 19 R19.4): spots in the visual harness
`game/dev/spots.html?id=<id>&manual=1&q=…&ov=…&weather=…` → wait for `window.spotDev.ready`, pose with `spotDev.walkTo(x, z, bearing, pitch)` / `spotDev.setCam(x, y, z, bearing, pitch, fov)`, render with `spotDev.step(n, dt)`. Useful poses: `spotDev.session.spot.spawns`, `…challenges[]` (the research iconic photo), `…plaques[]`, `…interactables[]`. Stats: `spot.tris`, `r3d.stats`, `spot.timing`. Ground probes: `spot.ground.heightAt(x,z)`, `spot.groundAt(x,z,y)`.
### → render (spec 18 R18.5)
Spots call `setScene(scene, cam, env, { vegetation })`, `setClock({ date, lat, lon, timeZone })` with the spot's own lat/lon and `setLamps()`; tree crowns are `treeCrowns …` instanced meshes. Observed: in November the bare-crown discard pattern reads as large square holes on close crowns (render.js `patchCrowns`, cells of `vCrownL * 4.5`); a finer cell size or alpha-to-coverage would look less blocky up close.
### → owner
Confirm (a) the 3-D Troll replica in this non-commercial portfolio (artists credited on the plaque), (b) UiPath Lincoln Square North lobby / Suite 2000 look (only the street entrance + a tenant directory are modelled).
- (render → spots, 2026-11-07) Done on the render side: bare crowns now use a branch/twig lattice (3-D ridged noise, derivative-widened, dithered) instead of square cells. Optional: set `env.ambientCity` per scene (share of building walls near the horizon in the ambient probe; default 0.5 = street canyon; parks / waterfront ≈ 0.15–0.25, Pike Place / Pioneer Square ≈ 0.5) and `env.groundAlbedo` (grass/water ≈ 0.1). Scenes must not add their own hemisphere/ambient lights (setScene removes them; ambient is `r3d.probe`).

## Progress log

### 2026-11-06 22:15 UTC — research-buc-spots: Bucharest top-10 confirmed (R15.1 input)
Evidence-ranked list (details, sources and scene specs in `game/research/bucharest-spots.md` / `.json`):
1. `palace-parliament` — Palace of the Parliament + Piața Constituției (Trip.com #1; VB 2024 #4 search; ~152k visitors 2023, >260k 2018; Christmas Market held in the square).
2. `old-town-lipscani` — Lipscani + **Cărturești Carusel** (enterable) + Hanul lui Manuc + Curtea Veche (VB 2022 #1 search, 2024 #3).
3. `stavropoleos-cec` — Stavropoleos church + Caru' cu Bere + CEC Palace + History Museum/Trajan statue (Caru' cu Bere = #1 searched restaurant 2022 & 2024).
4. `athenaeum-revolution` — Romanian Athenaeum + Piața Revoluției (Memorial of Rebirth, Royal Palace/MNAR, BCU, CC balcony) (VB 2022 #4; #1 guided tour 2024).
5. `arcul-de-triumf` — Arch of Triumph (Trip.com top-5).
6. `village-museum` — Dimitrie Gusti National Village Museum (~800,000 visitors in 2017, 68% foreign; VB 2024 #2 museum).
7. `herastrau-park` — King Michael I (Herăstrău) Park: busts alley, Japanese Garden, lake tip (VB 2022 #1 park; Trip.com #2).
8. `spring-palace` — Spring Palace / Ceaușescu Mansion (VB #1 searched museum in 2022 and 2024).
9. `cismigiu` — Cișmigiu Gardens (Wikivoyage first park; VB 2022 #3 park).
10. `peoples-salvation-cathedral` — People's Salvation (National) Cathedral (VB 2022 #5 attraction; world's tallest Orthodox church, opened 26 Oct 2025).
Changes vs the initial candidate list: Calea Victoriei + CEC merged into #3 with Stavropoleos; Herăstrău and the Village Museum split into two spots; **Patriarchal Cathedral hill replaced by the People's Salvation Cathedral**; National Museum of Art covered inside #4; Therme excluded (indoor water park 10 km outside the city). Not selected: Unirii Fountain Show (VB #2 search — belongs to the Unirii driving district), Botanical Garden (swap-in #11), Antipa Museum, Peasant Museum. Dialogue for R15.6 included per spot (`spots[].dialogue`) plus a general Bucharest pedestrian set.

### 2026-11-06 22:33 UTC — research-sea-spots: Seattle top 10 + Bellevue top 4 confirmed (R15.1 input)
Ranked list (evidence, scene specs, dialogue in `game/research/seattle-spots.md` / `.json`):
1. `pike-place` — Pike Place Market + Gum Wall + Rachel + fish market + original Starbucks (Tripadvisor #2, Visit Seattle #2, ~10 M visitors/yr).
2. `chihuly` — Chihuly Garden and Glass (Tripadvisor #1, 25k reviews).
3. `space-needle` — Space Needle + Seattle Center (TA #3, VS #1, 1.3 M/yr).
4. `fremont-troll` — Fremont Troll (owner must-have; Wikivoyage Fremont highlight).
5. `kerry-park` — Kerry Park viewpoint (TA #6, VS #8; Needle bearing 141°, Rainier 152°).
6. `mopop` — Museum of Pop Culture (TA #9, LP #3).
7. `waterfront` — Great Wheel / Pier 57 / Aquarium / Overlook Walk (VS #4).
8. `pioneer-square` — pergola, totem, Underground, Smith Tower (VS #9).
9. `ballard-locks` — Ballard Locks + fish ladder (TA #8, >1 M/yr).
10. `gas-works` — Gas Works Park (VS #15, TA #30; first alternate: Central Library).
Bellevue (`city:'bellevue'`): `bel-lincoln-square` (Lincoln Square + Bellevue Square + skybridges; UiPath = Lincoln Square North, 700 Bellevue Way NE, Suite 2000), `bel-downtown-park`, `bel-botanical-garden`, `bel-meydenbauer`.
Notes for spots: Space Needle, Chihuly and MoPOP share one `seattle-center` scene (3 spawns). Troll/Chihuly/Rachel/Changing Form/Piloti are copyrighted artworks (US: no FoP; Troll artists enforce image rights) — stylise, owner to OK the Troll replica. Gas Works towers must not be climbable. Pike Place is car-free (trial since Apr 2025). Request for world (via orchestrator): move `uipath-bel` door to Lincoln Square North entrance 47.61723,-122.20148.

### 2026-11-07 00:50 UTC — spots: framework + Seattle 10 / Bellevue 4 playable (R15.2, R15.3, R15.5, R15.6, R15.7; R15.4 needs the gameplay hook)
**Framework** (`game/src/spots/`, documented in `game/src/spots/README.md` for the Bucharest builder): `SPOTS` registry, `loadSpot(id, renderer)` (contract) + `startSpot(id, host)`/`SpotSession` (Renderer3D wiring: real sun/weather/season at the spot's lat/lon via `setScene/setClock/setLamps`; walker = `OnFootController` from `src/onfoot.js`, feature-detected, else `walker.js` `LocalWalker`; crowd; UI; sound; interactions; postcard challenge; night lights; telemetry). Data builder `tools/build-data.mjs` turns the research dossier + OSM extracts + USGS grids into `game/data/spots/<scene>.json` (12 files, 62–199 KB). Terrain: bicubic grid + modifiers (flatten / corridor / carve), walkable solids (stairs, decks, the Troll's top-surface heightmap with steep cells as walls), deep water not walkable. Ground: 2048 px splat painted from OSM (areas, roads + sidewalks + kerbs + US markings, crossings, footways by surface) + shader detail by mask (running-bond brick, cobbles, slab joints, grass, asphalt grain). Backdrop: OSM buildings with procedural façades (house / apartment / brick / office / shop band / industrial), gable roofs, night windows; street + area trees as season-tinted instanced crowns (render.js); street lamps in the render.js light pool; furniture; light traffic (vehicles.js models; none at Pike Place). Crowd (R15.6): instanced personas from the research (`local, tech, tourist_us/ca/cn/in/kr/jp/de/es, fishmonger, vendor, busker, guide, staff, kid, photographer`) walking the OSM footway network or acting in groups (watch / photo / pose / queue / sit / talk / perform / guide / throw), reacting with chat bubbles (research `dialogue`, original language + English translation line) on approach, bump, being photographed (PhotoMode `onPhoto`), idling nearby, plus ambient chatter and rain lines. Plaques (R15.3): every research plaque as a bronze/park/city board with readable text and an `E` reader panel (title, text, artist credit, source link). Artworks (R15.7) are SDF / procedural models from the descriptions (Troll, Rachel, Changing Form, Chihuly glass, MoPOP, Piloti, totem poles) with artists credited — no photo textures. Postcard challenge per spot from the research iconic viewpoint (+ conditions: Kerry Park needs "the Mountain out" from real weather, MoPOP needs the Monorail in frame). Ambience: procedural WebAudio sources by position. Dev page `game/dev/spots.html?id=<id>` (+ `manual=1` stepping for Playwright).
**Spots** (scene, triangles, build time in software GL under load, people, plaques, fun):
| spot | scene | tris | build | people | plaques | fun / heroes |
|---|---|---|---|---|---|---|
| fremont-troll | fremont-troll | 0.34 M | 2.3 s (Troll SDF ≈ 1.9 s) | 24 | 5 | Troll (head, hubcap eye, splayed hand, Beetle under the other hand), Aurora approach arches + deck, stairs, boulders, Moss Turtle, graffiti bays; climb hand / Beetle / head, touch the nose; floodlights at night; Halloween pumpkins (Oct 24–Nov 2) |
| pike-place | pike-place | 0.53 M | 0.8 s | 115 | 6 | PUBLIC MARKET CENTER neon on X-braced frame + clock, FARMERS MARKET, MEET THE PRODUCER, PIKE PLACE FISH, arcade + stalls, fish throwing (catch one), Rachel (drop a coin), Gum Wall (stick gum), original Starbucks + queue, ~40 real storefront names from OSM, Steinbrueck poles, Great Wheel over the bay; car-free |
| space-needle / chihuly / mopop | seattle-center | 0.60 M | 1.1–1.2 s | 93 | 12 | Needle (legs, SkyLine, saucer, halo; elevator ride to the walkable 158 m deck), base pavilion, Wright fountain, Glasshouse + 1,400-piece suspended sculpture, garden glass (sun, floats, reeds), MoPOP lobes + monorail slot + ribbon, monorail + 4-car train looping through MoPOP, downtown skyline |
| kerry-park | kerry-park | 0.33 M | 0.23 s | 30 | 3 | terrace + railing + Changing Form (frame the view), Needle + downtown + city filler + Elliott Bay + Rainier/Olympics (weather-dependent) |
| waterfront | waterfront | 0.35 M | 0.45 s | 72 | 4 | Great Wheel (ride 3 turns), piers on piles, Miners Landing, Aquarium sign, Overlook Walk, fountain, ferries, Olympics |
| pioneer-square | pioneer-square | 0.34 M | 0.43 s | 60 | 5 | cast-iron pergola with glass roof + bollards, totem pole, Chief Seattle bust, purple vault lights, Smith Tower (base + shaft + pyramid), Occidental plane trees, acorn lamps, Underground Tour queue |
| ballard-locks | ballard-locks | 0.42 M | 0.29 s | 51 | 4 | large + small lock chambers, miter gates you walk across, boats rising/falling (operate a lockage), spillway + tainter gates, 21-weir fish ladder, red-tile 1915 buildings, garden |
| gas-works | gas-works | 0.28 M | 0.37 s | 46 | 3 | rusted generator towers + pipes, chain-link fence (no climbing), Play Barn with painted compressors, Kite Hill + mosaic sundial, fly a kite (real wind), skyline across Lake Union |
| bel-lincoln-square | bel-lincoln-square | 0.34 M | 0.36 s | 57 | 4 | Lincoln Square towers (OSM heights), glass skybridges, UiPath entrance (Lincoln Square North) + tenant directory + "badge in", Bellevue Square, Seattle on the horizon |
| bel-downtown-park | bel-downtown-park | 0.55 M | 0.54 s | 50 | 4 | canal ring + promenade, stepped waterfall into the pond (coin toss), memorial elms, Piloti (credited) |
| bel-botanical-garden | bel-botanical-garden | 0.43 M | 0.32 s | 38 | 4 | PNW forest, Ravine suspension bridge (sways), Yao Garden (raked gravel, lanterns, maples), Perennial Border |
| bel-meydenbauer | bel-meydenbauer | 0.39 M | 0.21 s | 28 | 3 | crescent floating pier, beach, pavilion, skip stones, Seattle skyline ≈ 9 km away |
All ≤ 0.62 M triangles (budget 1 M). Build times are from the software-GL container (load avg 2–20); the session start adds ≈ 0.1 s (+1.5 s the first time `onfoot.js`/`world.js` are imported, already loaded in the game).
**Verified** (Playwright + SwiftShader, `game/dev/spots.html`, LOOKED at every shot and compared with `game/research/refs/sea-spots/*`): troll close-up vs `Fremont_troll.jpg` (head + hubcap eye, splayed hand left, Beetle under the right hand with fingers draped, stairs right, arch framing); Pike Place vs `Public_Market_Center_sign_at_Pike_Place.jpg` / `Pike_Place_Market_Entrance.jpg` (three red rows + clock on the black X frame, FARMERS MARKET, MEET THE PRODUCER, brick street, fish crowd; neon at dusk); Kerry Park vs `Seattle_Kerry_Park_Skyline.jpg` (Needle left-of-centre in front of the towers, Rainier right); MoPOP vs `View_of_Museum_of_Pop_Culture…jpg` (monorail through the masses); Gum Wall vs `Gum_Wall_in_2022.jpg`. Functional (fremont-troll, OnFootController): W walks 4.95 m in 3 s; plaque prompt "Read: The Troll" → E opens the reader (credit + source), Esc closes; climb onto the hand (+0.88 m); photo at the iconic pose → `drive-my-cv-fremont-troll-….jpg` downloaded and postcard recorded; 4 chat bubbles in 20 s. Railing collisions verified with both walkers (Kerry Park). 0 page errors on all 14 spots. Screenshots (scratchpad of this session): `shots/final/<id>-spawn.png`, `-iconic.png`, `-dusk.png` for all 14 spots, `shots/troll9-close.png`, `shots/pike3-night.png`, `shots/kerry2-view.png`, `shots/func-plaque.png`, `shots/func-photo.png`.
**Gaps / next**: Bucharest 10 (separate agent, README). Not modelled: Pike Place Down Under / Hillclimb interiors, Seattle Underground, Chihuly interior galleries, Loupe glass floor, Ballard viewing room fish, Snowflake Lane / Garden d'Lights, skybridge interiors (visual only), Overlook Walk deck walkable. Troll mesh is generated at load (≈ 0.6–1 s on a desktop, 1.9 s here) — could be baked if loads get tight. Tree crowns in late autumn look blocky up close (render.js bare-crown discard, see Requests). Real-GPU fps not measured here (SwiftShader only). Needs: gameplay hook (menu + `spot` state), onfoot obstacle fix, style.css `in-spot`, QA harness spots (Requests above); owner OK on the Troll replica + UiPath lobby.
- 01:40 UTC addendum (spots): fixes found while verifying — wall-segment colliders were missing from the spatial index (fences / railings / lock walls were passable with both walkers; now Kerry Park railing stops the walker at 0.3 m with OnFootController and LocalWalker); walkable oriented boxes used the wrong angle sign (lock walls, suspension-bridge planks, crescent pier now walkable); OSM water multipolygons without their inner rings and linear waterways no longer paint lakes over land (shorelines from the DEM in Gas Works / Meydenbauer / Ballard); spawns and challenge poses move to the nearest dry, collider-free spot; far skyline blocks extend down to the scene apron (no floating blocks across Lake Union). Smoke test after the fixes: all 14 spots load with 0 page errors and walk 1.56 m/s from spawn; final screenshots re-taken in `shots/final/`.
