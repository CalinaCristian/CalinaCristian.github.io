# Activities at landmarks and tourist spots

What visitors really do at each place, with hours as checked and sources. Machine-readable twin: `activities.json` (one entry per place, with the in-game interaction first proposed). The game's own list is the Landmarks category in `game/src/data.js` (`lm-*` ids, keyed `<spot>:<activity>`); an id in brackets below is in the game, "no achievement" means the activity is only researched. Retired activities (`RETIRED_ACTIVITIES` in `game/src/spot-availability.js`) are not listed.

Research pass 2026-11-07 (Old Town day / night activities 2026-11-11). Where official hours could not be fetched, the entry says so instead of guessing. Not reachable on 2026-11-07: cic.cdep.ro (Parliament tours), fge.org.ro (Athenaeum), palatulprimaverii.ro, alpab.ro (Cișmigiu / Herăstrău boats), catedralaneamului.ro, carturesti.ro (403), the USACE Ballard Locks page (403).

## Seattle

### Space Needle (`space-needle`)
- **Elevator ride** (`lm-needle-up`): observation level about 520 ft up in 41 s. The first of three new double-deck all-glass elevators went in in 2025; the others follow in 2027 and 2028. Hours on 2026-11-07: Sa 9:30–20:30, Su 9:30–19:30, Mo–Th 11:00–19:00, Fr 10:30–19:30 (seasonal); general admission $35–55.
- **The Loupe** (`lm-needle-loupe`): the lower level, reopened August 2018, has the world's first revolving glass floor, one turn per 45 min; the Oculus Stairs join the two levels and show the elevators through the glass oculus. Loupe Lounge (cocktails) September–May.
- **Open-air deck, Skyriser benches** (no achievement): glass benches tilting out toward downtown, Elliott Bay, Rainier, the Olympics, Cascades and Baker (2018 Century Project).
- Sources: en.wikipedia.org/wiki/Space_Needle, spaceneedle.com.

### Chihuly Garden and Glass (`chihuly`)
- **Galleries, Glasshouse and Garden** (`lm-chihuly-glasshouse`): eight galleries, the Glasshouse (≈ 100 ft suspended sculpture in reds, yellows, oranges) and the Garden; 1–2 h; glassblowing demos and audio tour included; photos encouraged (flash allowed), no touching, selfie sticks or tripods. Hours on 2026-11-07: Sa 10–18, Su 10–17, Mo–F 11–17. Sources: chihulygardenandglass.com/visit, Wikipedia.

### Museum of Pop Culture (`mopop`)
- **Museum and the monorail** (`lm-mopop-monorail`): music, sci-fi and games galleries; the Seattle Center Monorail runs through the Gehry building. Open daily, 10:00–17:00 on 2026-11-07. Sources: mopop.org/visit, Wikipedia.

### Pike Place Market and the Gum Wall (`pike-place`)
- **Fish throwing** (`lm-pike-fish`): the fishmonger calls the order, the crew shouts it back and the fish is thrown over the counter to the wrapper (not into the crowd); up to 10,000 watchers a day in summer. Pike St × Pike Place, market hours. Sources: Wikipedia Pike_Place_Fish_Market, pikeplacefish.com.
- **Catch with the crew** (`lm-pike-fish-crew`, 2026-11-15): two mongers at the front of the ice take turns throwing to the player in the catcher's place behind the counter; catch 3 of 5 (button at the end of the flight, facing the thrower). The toss goes from the front display over the counter to the monger behind it, who wraps the fish; it marks a sale; started by the former owner Johnny Yokoyama; up to 200 tosses a day before 2020; visitors are sometimes invited to try a catch. Open daily 7 am – 5 pm (the in-game hour gates the show and the challenge). Stall at OSM n2397497121 (86 Pike St). Sources: pikeplacemarket.org FAQ "Wondering when they throw the fish?", nationalgeographic.com "Meet the famous fish throwers of Seattle's Pike Place Market", tastingtable.com "Do they still throw real fish at Pike Place Market?", portseattle.org "Flying fish lure visitors and revenue".
- **Gum Wall** (`lm-gum-wall`): Post Alley under the Market by the Market Theater box office; 54 × 8 ft in 2024, ≈ 180 pieces per brick; steam-cleaned Nov 2015, Sep 2018, Nov 2024. Source: Wikipedia Gum_Wall.
- **Rachel the pig** (`lm-pike-rachel`): 550 lb bronze piggy bank, Georgia Gerber 1986; donations fund the Market's social services. Source: Wikipedia.

### Seattle Great Wheel, Pier 57 (`waterfront`)
- **Ride** (`lm-great-wheel`): 175 ft, 42 gondolas (8 people), ≈ 12 min, three turns, 40 ft out over Elliott Bay; 500,000+ LEDs, light shows usually Fri–Sun evenings. 11:00–21:00 daily on 2026-11-07 (varies). Sources: Wikipedia, seattlegreatwheel.com (+ /faq/).

### Pioneer Square (`pioneer-square`)
- **Bill Speidel's Underground Tour** (`lm-underground`): 75 min, from beneath Doc Maynard's Public House (614 1st Ave), through the sidewalks buried when the streets were raised after the 1889 fire, lit by amethyst vault-light prisms. Daily on the hour 10:00–18:00, half-hourly June–September; closed Thanksgiving and Christmas Day. Sources: undergroundtour.com, Wikipedia Seattle_Underground.
- **Read the totem pole** (`lm-totem-read`): the 1940 Tlingit replica of the Chief-of-All-Women pole (history and figures: seattle-spots.md, "The totem pole"), read top to bottom. Source: Wikipedia Pioneer_Square_totem_pole.
- **Ping pong in Occidental Square** (`lm-pioneer-ping-pong`, 2026-11-15): "bocce courts and ping pong tables" and park concierges who hand out games; table mapped as OSM n14005376908. Daily 6:00–22:00. In the game: first to five against a regular; A / D slide, mouse aims, E swings. Sources: seattle.gov/parks/allparks/occidental-square. Not built: bocce (plays like the Arc's pétanque), Waterfall Garden Park (8:00–15:45/17:45, pioneersquare.org), Zeitgeist Coffee, the Smith Tower Observatory bar (smithtower.com); the Underground Tour is a guided walk.

### Fremont Troll (`fremont-troll`)
- **Climb on the Troll** (`lm-troll-climb`): 18 ft concrete troll under the north end of the Aurora Bridge (Badanes, Martin, Walter, Whitehead; unveiled Halloween 1990) clutching a real VW Beetle with a California plate; climbing it for photos is the classic visit. Birthday party around Halloween. Source: Wikipedia.

### Ballard Locks (`ballard-locks`)
- **Watch a lockage** (`lm-locks-lockage`): small lock 30 × 150 ft, large 80 × 825 ft, between Salmon Bay and Puget Sound; busiest U.S. lock by boats, 1M+ visitors a year. Large lock drained ≈ two weeks in November, small lock in March.
- **Salmon in the fish ladder** (no achievement): ladder rebuilt 1976, 21 weirs, underwater viewing room; sockeye peak July to mid-August, Chinook and coho later. Grounds and the Carl S. English Jr. Botanical Garden all year.
- Source: Wikipedia Hiram_M._Chittenden_Locks.

### Gas Works Park (`gas-works`)
- **Kite on Kite Hill** (`lm-gasworks-kite`): artificial hill with a sculptured sundial at the top. Daily 6:00–22:00. Tower climbing is dangerous (three deaths since 2008) and entering the lake is prohibited (contaminated sediment). Sources: seattle.gov/parks/allparks/gas-works-park, Wikipedia.

### Kerry Park (`kerry-park`)
- **Sunset postcard view** (no achievement; the game has `lm-kerry-blue-hour`): Space Needle centred, Elliott Bay, Rainier on clear days; Doris Totten Chase's 15 ft steel "Changing Form" (1971) frames it. Daily 6:00–22:00. Sources: seattle.gov/parks/allparks/kerry-park, Wikipedia.
- **Shoot hoops on the lower park court** (`lm-kerry-hoops`, 2026-11-15): Kerry Park and Bayview-Kinnear ("Lower Kerry Park") list a play area and basketball courts; OSM maps the half court below the terrace (w730946886). In the game: "around the world" from five rings round the key, mouse aim, E shoots; one basket from each spot within 12 balls. Daily 6:00–22:00. Sources: seattle.gov/parks (Kerry Park, Bayview-Kinnear), Wikipedia Changing_Form. Not built: buskers (not documented at Kerry Park; the city busking spots are elsewhere) and climbing Changing Form (no climbing controls).

## Bellevue

### Lincoln Square and Bellevue Square (`bel-lincoln-square`)
- **Cross the skybridges** (no achievement): Bellevue Square linked to Lincoln Square by skybridge (2007), together the Bellevue Collection; UiPath's office is in Lincoln Square North (two floors, since 2025). Snowflake Lane parade November–December (dates not checked). Source: Wikipedia Bellevue_Square.
- **Bowling at Lucky Strike** (`lm-bel-bowling`, 2026-11-15): Lucky Strike Lanes & Power Play, Lincoln Square North 2nd floor (OSM n4188521492): 16 lanes, billiards, arcade; Sun–Thu 11 am – midnight, Fri–Sat to 2 am, 21+ after 8 pm. In the game: three frames on one lane (standard scoring, bonus balls), A / D line up, mouse aim, E on the power meter; 11:00–24:00. Sources: luckystrikeent.com, bellevuecollection.com. Not built: Cinemark Reserve (21+ dine-in), Mirra, Game Show Battle Rooms, the Snowflake Lane parade (7:00–7:30 pm, late Nov – Dec 24; bellevuewa.gov).

### Bellevue Downtown Park (`bel-downtown-park`)
- **Frisbee on the lawn** (`lm-bdp-frisbee`): The 10-acre lawn inside the canal ring is the park's open lawn for picnics (city page); the half-mile promenade and stepped canal ring it. Frisbee with someone from the crowd: aim with the mouse, throw with E on a power gauge; walk under their throw (WASD) and catch with E. 3 throws caught + 3 catches. Game hours 6:00–23:00. Sources: bellevuewa.gov.
- **Inspiration Playground swing** (`lm-bdp-swing`): Inspiration Playground (opened June 2017) is built for children of all abilities and their caregivers; open year-round, the spray park Memorial Day to Labor Day 10 am – 8 pm. Sit on the mapped swing and pump it (W on the forward swing, S on the back swing) up past 50°. Game hours 6:00–23:00. Sources: bellevuewa.gov.
- **Public skating at the ice rink** (`lm-bdp-skate`): The Bellevue Downtown Ice Rink (formerly the Magic Season Ice Arena) is a seasonal tent rink on the park's lower plaza by NE 1st St; last season ran Nov 21 – Jan 19; public-session times vary. Skate three anticlockwise laps (W strides, A/D turn, S stop; the boards bounce and a hard hit is a fall). Rink season or Winter picked; game hours 10:00–22:00 (estimate). Sources: bellevuedowntown.com.
- (Retired 2026-11-15: the half-mile loop walk `lm-bdp-loop` — a walk, not an activity.)

### Bellevue Botanical Garden (`bel-botanical-garden`)
- **Garden walk** (no achievement; the game has `lm-bbg-bridge` for the ravine suspension bridge): 53 acres; Perennial Border, Yao Garden, Fuchsia Garden, Native Discovery Garden, Urban Meadow, Rhododendron Glen; free; dawn to dusk every day; Garden d'Lights in December (dates not checked). Sources: bellevuebotanical.org, Wikipedia.
- **Garden d'Lights critter hunt** (`lm-bbg-dlights`, 2026-11-15): the holiday light show has a "plants and critters" scavenger hunt map; 2026: Nov 28 – Jan 3 (closed Dec 25), first entry 4:30 pm, last 9 pm, lights out 9:30 pm. In the game: eight light critters by the paths of eight mapped garden rooms, find six in 4 min (look at one, E); season (or Winter picked) and 16:30–21:30. Sources: bellevuebotanical.org (garden-dlights, hours, etiquette). Not built: a coffee carried across the ravine bridge (the Copper Kettle Coffee Bar, Shorts House, Sat–Sun 10–2, is ≈ 300 m from the bridge).

### Meydenbauer Bay Park (`bel-meydenbauer`)
- **Stand-up paddleboard** (`lm-meyd-sup`): Non-motorised launch on the crescent pier; Best Kayak Rentals rents kayaks, canoes and stand-up paddleboards from the boathouse in season (Thu–Fri 1–9 pm, Sat–Sun 10 am–9 pm per Visit Bellevue). Free-steered board (W strokes, A/D turn, S back-paddle; hard turns at speed tip you in) round three mapped buoys off the crescent and back to the dock. Game hours 10:00–21:00 every day, not winter. Sources: bellevuewa.gov, visitbellevuewa.com.
- **Swim to the float** (`lm-meyd-swim`): The swimming beach has a lifeguard in summer (late June – Labor Day, noon – 7 pm); a summer swim float sits inside the buoy line. Swim (W, A/D) inside the buoy line out to the float, climb on, swim back to the beach. Float season (late May – early Sep) or Summer picked; game hours 12:00–19:00. Sources: bellevuewa.gov.
- **Skip stones** (`lm-meyd-skip`): The sand-and-pebble beach on Meydenbauer Bay. Release three stones on a timing gauge from the beach outside the swimming area. Game hours 6:00–23:00. Sources: bellevuewa.gov.
- **Kayak round the marina** (`lm-meyd-kayak`): Seasonal kayak and canoe rentals at the boathouse (Best Kayak Rentals). Paddle-stroke loop round the marina moorage (existing). Sources: bellevuewa.gov, visitbellevuewa.com.
- (Retired 2026-11-15: the walk to the end of the crescent pier `lm-meyd-pier` — a walk, not an activity.)

## Bucharest

### Palace of the Parliament (`palace-parliament`)
- **Guided tour** (`lm-palace-balcony`): run by the Chamber of Deputies' visitor centre; the building also houses the National Museum of Contemporary Art (west wing, glass annex 2004). Hours, prices and the ID rule not verified (cic.cdep.ro down 2026-11-07). Source: Wikipedia.
- **Christmas Market on Piața Constituției** (no achievement): every December (2025: 29 Nov–28 Dec). Source: bucharest-spots.json `palace-parliament.seasonal_time_of_day`.

### Old Town (`old-town-lipscani`)
Hours, estimates and the places left out: bucharest-spots.md, "Things to do by day and night".
- **Cărturești Carusel** (`lm-carusel-top`): 1860s bank on Lipscani 55, a six-floor bookshop since 2015, white spiral balconies, top-floor bistro. Source: ro.wikipedia Cărturești_Carusel.
- **Terrace at Hanul lui Manuc** (no achievement): 1808 caravanserai where the 1812 Treaty of Bucharest was negotiated; restaurant around the galleried courtyard, terraces spring to autumn. Sources: Wikipedia (en, ro).
- **Coffee at Gregory's** (`lm-lipscani-coffee`): Lipscani 27; Mon–Fri 07:30–16:00, Sat–Sun 07:30–18:00 (Google Maps 2026-11-11), game 08:00–16:00. Source: romania-insider.com press release.
- **Papanași at Jack's Pub** (`lm-jacks-papanasi`): Lipscani 45; Sun–Thu 10:00–02:00, Fri–Sat 10:00–05:00 (jackspub.ro 2026-11-11), game 10:00–02:00.
- **A coin for the busker** (`lm-lipscani-busker`): street musicians on Lipscani (Coldplay filmed a singer there, June 2024; 2005 street-musician "free zone"). Hours not documented, game 10:00–24:00 (estimate). Sources: antena3.ro, adevarul.ro.
- **Photo walk** (`lm-lipscani-photo-walk`): what visitors do by day (In Your Pocket, Rough Guides).
- **Karaoke at Mojo Music Club** (`lm-mojo-karaoke`): Lipscani 69, karaoke upstairs from 21:00 nightly (In Your Pocket); venue to 03:00, 05:00 Fri–Sat (Google Maps 2026-11-11); game 21:00–03:00. Sources: inyourpocket.com, mojomusic.ro.

### Stavropoleos, Caru' cu Bere, CEC Palace (`stavropoleos-cec`)
- **Stavropoleos courtyard** (`lm-stavropoleos`): 1724 Brâncovenesc church of a convent of nuns; stone crosses and tombstones in the courtyard; neo-Byzantine chant; library of 8,000+ books. Open daily, service schedule on stavropoleos.ro. Sources: Wikipedia, stavropoleos.ro.
- **Caru' cu Bere** (no achievement): brewery since 1879, neo-Gothic beer hall 1899. Source: Wikipedia.

### Romanian Athenaeum (`athenaeum-revolution`)
- **Concert** (`lm-ateneu-concert`): 1888 hall of the George Enescu Philharmonic and the Enescu Festival (September, odd years); 600 stalls seats plus 52 loges; the 75 × 3 m Costin Petrescu fresco. Season roughly autumn to spring (fge.org.ro down 2026-11-07). Source: Wikipedia.
- **Evening concert, applause at the right moments** (`lm-ateneu-bravo`, 2026-11-15): tickets online and at the Athenaeum box office (2025/26: Tue–Fri 12:00–19:00, weekends on concert days); symphonic concerts at 19:00, usually Thu/Fri. In the game: a seat in the stalls, tuning, the conductor, a short original three-movement piece; E applauds — not between movements or before the baton comes down; keep it up through the bows for an encore. Doors 18:00–21:00 by the in-game hour. Sources: agerpres.ro (12 Sep 2025), zilesinopti.ro listings. Not built: candles at the Memorial of Rebirth (only a 2025 event with LED candles at 18:00 on 19–20 Dec, zilesinopti.ro/?p=791214).

### Village Museum (`village-museum`)
- **Farmsteads** (`lm-village-passport`): open-air museum (1936) in King Michael I Park: 123 households, 363 monuments, Dragomirești church (1722). Open all year (schedule on muzeul-satului.ro not readable); craft fairs, Easter and Christmas events. Sources: Wikipedia, muzeul-satului.ro.

### King Michael I (Herăstrău) Park (`herastrau-park`)
- **Boat or bike round the lake** (no achievement): 187 ha park, 74 ha lake; small boats allowed; a footbridge since 2017 closes the loop. I'Velo rental at Piața Charles de Gaulle (OSM node 2858053386: Mo–Fr 11:30–20:30, Sa–Su 9:30–20:30, check_date 2022) and a dock at the Arc. Sources: Wikipedia (en, ro).
- **Japanese Garden** (no achievement): cherry bloom in April. Source: bucharest-spots.json `herastrau-park`.

### Spring Palace (`spring-palace`)
- **Guided tour** (no achievement): the Ceaușescus' house (1964–65), open since March 2016; gold-fitted bathroom, indoor pool with 1960s mosaic, peacocks in the garden. Tours by booking, hours not confirmed. Sources: romania-insider.com, atlasobscura.com, antena3.ro.
- **Creep up on a peacock** (`lm-spring-peacock`, 2026-11-15): peacocks walk free in the garden (visitor accounts); the house is visited only on a guided tour (45 min), no photography inside, a 25-min film on a separate ticket, the mosaic pool drained. Tue–Sun 10:00–17:00, closed Mondays. In the game: walk up while the bird feeds, freeze when it looks up, stand still close by and it fans its tail; 10:00–17:00. Sources: casaceausescu.ro (detalii vizitare), bucharest.ro, traveltastefeel.com.

### Cișmigiu Gardens (`cismigiu`)
- **Rowing boat / rink** (`lm-cismigiu-boat`): oldest central public park (1847); rowing in summer, skating since 1883 (rink, OSM seasonal=winter); hours not confirmed. Sources: Wikipedia (en, ro).
- **Writers' Rotunda** (`lm-cismigiu-rotunda`): circular alley with busts of twelve Romanian writers. Source: Wikipedia.

### People's Salvation Cathedral (`peoples-salvation-cathedral`)
- **Nave and a candle** (`lm-cathedral-dome`): largest Orthodox church building (127 m), consecrated 2018; ≈ 25,000 m² of mosaics consecrated 26 October 2025, when it opened permanently; 25.19 t main bell heard 15–20 km away. Hours not confirmed. Source: Wikipedia.

### Piața Unirii fountains (landmark `fountains`)
- **Simfonia Apei** (no achievement): water, music and light, May–September, Fri–Sun from 21:00, ≈ 45 min (2025: 23 May–28 Sept); being decommissioned during the 2025–26 Planșeul Unirii works. Source: bucharest-unirii.json `fountains`.

### Hala Traian (landmark `halatraian`)
- **1896 iron market hall** (no achievement) at Calea Călărașilor × Traian, now a Mega Image, on the gts chapter route. Source: bucharest-unirii.json `landmarks.hala_traian`.
