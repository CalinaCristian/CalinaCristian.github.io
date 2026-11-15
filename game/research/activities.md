# Activities at landmarks and tourist spots

What visitors really do at each place behind an in-game activity, with hours as checked and sources. The game's list is
the Landmarks category in `game/src/data.js` (`lm-*` ids, keyed `<spot>:<activity>`); retired activities
(`RETIRED_ACTIVITIES` in `game/src/spot-availability.js`) are not listed. Machine-readable twin with the fuller research
(including activities with no achievement): `activities.json`. Hours are those published on 2026-11-07 unless dated;
where official hours could not be fetched the entry says so. Old Town venues and Freddo:
[bucharest-spots.md](bucharest-spots.md), "Things to do by day and night"; the Cișmigiu table game: "Table (Romanian
backgammon)" there.

## Seattle

### Space Needle (`space-needle`)
- **Elevator ride** (`lm-needle-up`): observation level about 520 ft up in 41 s; the first of three new double-deck glass
  elevators went in in 2025. Sa 9:30–20:30, Su 9:30–19:30, Mo–Th 11:00–19:00, Fr 10:30–19:30 (seasonal); $35–55.
  Sources: en.wikipedia.org/wiki/Space_Needle, spaceneedle.com.

### Museum of Pop Culture (`mopop`)
- **Museum and the monorail** (`lm-mopop-monorail`): the Seattle Center Monorail runs through the Gehry building; daily
  10:00–17:00. Sources: mopop.org/visit, Wikipedia.

### Pike Place Market and the Gum Wall (`pike-place`)
- **Fish throwing** (`lm-pike-fish`): the fishmonger calls the order, the crew shouts it back and the fish is thrown over
  the counter to the wrapper (not into the crowd); Pike St × Pike Place, market hours. Sources: Wikipedia
  Pike_Place_Fish_Market, pikeplacefish.com.
- **Catch with the crew** (`lm-pike-fish-crew`): the toss goes from the front display over the counter to the monger who
  wraps it, marking a sale; started by the former owner Johnny Yokoyama; visitors are sometimes invited to try a catch.
  Open daily 7 am – 5 pm. Stall OSM n2397497121 (86 Pike St). Sources: pikeplacemarket.org FAQ "Wondering when they throw
  the fish?", nationalgeographic.com "Meet the famous fish throwers of Seattle's Pike Place Market", tastingtable.com "Do
  they still throw real fish at Pike Place Market?", portseattle.org "Flying fish lure visitors and revenue".
- **Gum Wall** (`lm-gum-wall`): Post Alley under the Market by the Market Theater box office; 54 × 8 ft in 2024;
  steam-cleaned Nov 2015, Sep 2018, Nov 2024. Source: Wikipedia Gum_Wall.
- **Rachel the pig** (`lm-pike-rachel`): 550 lb bronze piggy bank, Georgia Gerber 1986; donations fund the Market's social
  services. Source: Wikipedia.

### Seattle Great Wheel, Pier 57 (`waterfront`)
- **Ride** (`lm-great-wheel`): 175 ft, 42 gondolas (8 people), ≈ 12 min, three turns, 40 ft out over Elliott Bay;
  11:00–21:00 daily (varies). Sources: Wikipedia, seattlegreatwheel.com (+ /faq/).

### Pioneer Square (`pioneer-square`)
- **Ping pong in Occidental Square** (`lm-pioneer-ping-pong`): "bocce courts and ping pong tables" and park concierges who
  hand out games; table OSM n14005376908; daily 6:00–22:00. Source: seattle.gov/parks/allparks/occidental-square.

### Fremont Troll (`fremont-troll`)
- **Climb on the Troll** (`lm-troll-climb`): climbing the 18 ft concrete troll (1990) for photos is the classic visit.
  Source: Wikipedia.

### Ballard Locks (`ballard-locks`)
- **Watch a lockage** (`lm-locks-lockage`): small lock 30 × 150 ft, large 80 × 825 ft; busiest U.S. lock by boats. Large
  lock drained ≈ two weeks in November, small lock in March. Source: Wikipedia Hiram_M._Chittenden_Locks (the USACE page
  returned 403).

### Gas Works Park (`gas-works`)
- **Kite on Kite Hill** (`lm-gasworks-kite`): artificial hill with a sundial at the top; daily 6:00–22:00. Tower climbing is
  dangerous and entering the lake is prohibited (contaminated sediment). Sources: seattle.gov/parks/allparks/gas-works-park,
  Wikipedia.

### Kerry Park (`kerry-park`)
- **Shoot hoops on the lower park court** (`lm-kerry-hoops`): Kerry Park and Bayview-Kinnear ("Lower Kerry Park") list a
  play area and basketball courts; OSM maps the half court below the terrace (w730946886); daily 6:00–22:00. Sources:
  seattle.gov/parks (Kerry Park, Bayview-Kinnear).

## Bellevue

### Lincoln Square (`bel-lincoln-square`)
- **Bowling at Lucky Strike** (`lm-bel-bowling`): Lucky Strike Lanes & Power Play, Lincoln Square North 2nd floor (OSM
  n4188521492): 16 lanes, billiards, arcade; Sun–Thu 11 am – midnight, Fri–Sat to 2 am, 21+ after 8 pm (game
  11:00–24:00). Sources: luckystrikeent.com, bellevuecollection.com.

### Bellevue Downtown Park (`bel-downtown-park`)
- **Frisbee on the lawn** (`lm-bdp-frisbee`): the 10-acre lawn inside the canal ring is the park's open lawn for picnics
  (game 6:00–23:00). Source: bellevuewa.gov.
- **Inspiration Playground swing** (`lm-bdp-swing`): opened June 2017 for children of all abilities; open year-round,
  spray park Memorial Day to Labor Day 10 am – 8 pm (game 6:00–23:00). Source: bellevuewa.gov.
- **Public skating** (`lm-bdp-skate`): the Bellevue Downtown Ice Rink (formerly Magic Season Ice Arena), a seasonal tent
  rink on the lower plaza by NE 1st St; last season Nov 21 – Jan 19, session times vary (game 10:00–22:00, estimate).
  Source: bellevuedowntown.com.

### Bellevue Botanical Garden (`bel-botanical-garden`)
- **Garden d'Lights critter hunt** (`lm-bbg-dlights`): the holiday light show's "plants and critters" scavenger-hunt map;
  2026: Nov 28 – Jan 3 (closed Dec 25), first entry 4:30 pm, last 9 pm, lights out 9:30 pm. Sources: bellevuebotanical.org
  (garden-dlights, hours, etiquette).

### Meydenbauer Bay Park (`bel-meydenbauer`)
- **Stand-up paddleboard** (`lm-meyd-sup`) and **kayak round the marina** (`lm-meyd-kayak`): non-motorised launch on the
  crescent pier; Best Kayak Rentals rents kayaks, canoes and paddleboards from the boathouse in season (Thu–Fri 1–9 pm,
  Sat–Sun 10 am – 9 pm per Visit Bellevue; game 10:00–21:00, not winter). Sources: bellevuewa.gov, visitbellevuewa.com.
- **Swim to the float** (`lm-meyd-swim`): lifeguarded swimming beach in summer (late June – Labor Day, noon – 7 pm) with a
  summer float inside the buoy line (game: float season or Summer, 12:00–19:00). Source: bellevuewa.gov.
- **Skip stones** (`lm-meyd-skip`): the sand-and-pebble beach, outside the swimming area (game 6:00–23:00). Source:
  bellevuewa.gov.

## Bucharest

### Old Town (`old-town-lipscani`)
- **Cărturești Carusel** (`lm-carusel-top`): 1860s bank on Lipscani 55, a six-floor bookshop since 2015, top-floor bistro.
  Source: ro.wikipedia Cărturești_Carusel.
- **Coffee at Gregory's** (`lm-lipscani-coffee`), **papanași at Jack's Pub** (`lm-jacks-papanasi`), **a coin for the
  busker** (`lm-lipscani-busker`), **karaoke at Mojo** (`lm-mojo-karaoke`): places, hours and sources in
  bucharest-spots.md, "Things to do by day and night".

### Stavropoleos (`stavropoleos-cec`)
- **Stavropoleos courtyard** (`lm-stavropoleos`): 1724 Brâncovenesc church of a convent of nuns; stone crosses and
  tombstones in the courtyard; open daily, services on stavropoleos.ro. Sources: Wikipedia, stavropoleos.ro.

### Romanian Athenaeum (`athenaeum-revolution`)
- **Evening concert, applause at the right moments** (`lm-ateneu-bravo`): 1888 hall of the George Enescu Philharmonic;
  tickets online and at the box office (2025/26: Tue–Fri 12:00–19:00, weekends on concert days); symphonic concerts at
  19:00, usually Thu/Fri (game: doors 18:00–21:00). Sources: agerpres.ro (12 Sep 2025), zilesinopti.ro listings,
  Wikipedia.

### Village Museum (`village-museum`)
- **Farmsteads** (`lm-village-passport`): open-air museum (1936) in King Michael I Park: 123 households, 363 monuments,
  Dragomirești church (1722); open all year (schedule on muzeul-satului.ro not readable). Sources: Wikipedia,
  muzeul-satului.ro.

### King Michael I (Herăstrău) Park (`herastrau-park`)
- **Boat round the lake** (`lm-herastrau-boat`) and **bike rental** (`lm-bike`): 74 ha lake, small boats allowed; I'Velo
  rental at Piața Charles de Gaulle (OSM n2858053386: Mo–Fr 11:30–20:30, Sa–Su 9:30–20:30, check_date 2022). Sources:
  Wikipedia (en, ro).

### Spring Palace (`spring-palace`)
- **Creep up on a peacock** (`lm-spring-peacock`): peacocks walk free in the garden (visitor accounts); the house is
  visited only on a 45-min guided tour, no photography inside. Tue–Sun 10:00–17:00, closed Mondays. Sources:
  casaceausescu.ro (detalii vizitare), bucharest.ro, traveltastefeel.com.

### Cișmigiu Gardens (`cismigiu`)
- **Rowing boat / rink** (`lm-cismigiu-boat`): oldest central public park (1847); rowing in summer, skating since 1883
  (rink, OSM seasonal=winter); hours not confirmed. Sources: Wikipedia (en, ro).

### People's Salvation Cathedral (`peoples-salvation-cathedral`)
- **Nave and a candle** (`lm-cathedral-dome`): consecrated 2018; mosaics consecrated 26 October 2025, when it opened
  permanently; hours not confirmed. Source: Wikipedia.

