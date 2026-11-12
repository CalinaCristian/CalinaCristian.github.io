# Old Town by day, and more to do at night

Checked 2026-11-11 (web: official sites, Google Maps listings, In Your Pocket, Zile și Nopți, Wikipedia). Code:
`game/src/spots/scenes/old-town-daylife.js`. Night club: `old-town-nightlife.js` (Freddo).

Before this, the visit had one thing to do by day (the Carusel stair): Freddo is a club night, and the shaorma and
Shoteria activities stand outside the visit area. Every activity below stands at a real OSM place inside the visit area
(`OLD_TOWN_FOCUS`), on the street in front of it. No interior, kiosk, sign or terrace is added.

## What the game has

| Activity (key) | Place | Open in game | What you do |
| --- | --- | --- | --- |
| `lipscani-coffee` | Gregory's, Strada Lipscani 27 (OSM n6324709232) | 08:00–16:00 | blow on it, sip, finish: a cup on its saucer in your hand |
| `jacks-papanasi` | Jack's Pub, Strada Lipscani 45 (OSM n1416626264) | 10:00–02:00 | three forkfuls of two papanași (sour cream, sour-cherry jam) |
| `lipscani-busker` | the busker on Lipscani the scene already had | 10:00–24:00 | toss a coin into the open guitar case |
| `lipscani-photo-walk` | from Smârdan to Lipscani | always | frame Freddo's glazed front, the Carusel arch, the string lights over Lipscani |
| `mojo-karaoke` | Mojo Music Club, Strada Lipscani 69 (OSM n1731040985, `karaoke=yes`) | 21:00–03:00 | hold your voice on an eight-bar tune; 60 % in tune passes, else sing again |

Each has a Landmarks achievement (`lm-lipscani-coffee`, `lm-jacks-papanasi`, `lm-lipscani-busker`,
`lm-lipscani-photo-walk`, `lm-mojo-karaoke`). A closed place says so and gives its opening hour.

## Sources and what is estimated

- **Gregory's, Lipscani 27**: open (reviews a month old). Hours Mon–Fri 07:30–16:00, Sat–Sun 07:30–18:00 (Google Maps
  listing only: medium confidence). The game uses the weekday hours, rounded to 08:00–16:00, every day. A Greek chain:
  freddo espresso / cappuccino, pies; people sit outside watching the street.
  https://www.romania-insider.com/press-release-gregorys-expands-bucharests-old-city-and-baneasa-shopping-city
  The cup in the game is a plain espresso, not a product of theirs.
- **Jack's Pub, Lipscani 45**: open. Sun–Thu 10:00–02:00, Fri–Sat 10:00–05:00 (https://jackspub.ro and Google Maps:
  high). Terrace eating and people-watching by day; reviews mention ribs and papanași; loud and club-like after about
  22:00. The game uses 10:00–02:00 every day. The plate is a generic pair of papanași.
- **Mojo Music Club, Lipscani 69**: open. Venue Mon–Thu 15:00–03:00, Fri 15:00–05:00, Sat 14:00–05:00, Sun 14:00–03:00
  (Google Maps: fairly high). Karaoke every night from 21:00 (In Your Pocket, bucharest.ro: undated, medium); end time
  not found: the game stops at 03:00. Karaoke is upstairs, above the ground-floor pub; entry free except ticketed
  events, 18+ from 22:00 (https://mojomusic.ro/regulament). Whether singers must sign up: not verified.
  https://www.inyourpocket.com/romania/bucharest/venues/mojo
  The room is not modelled: you sing at the door, with a microphone in your hand. The tune ("Lipscani refrain", 2026)
  is an original eight-bar melody written for the game, CC0-1.0: no lyrics, no known song.
- **Buskers on Lipscani**: documented but thinly, no source for how often. June 2024: Coldplay filmed a Lipscani
  street singer (https://www.antena3.ro/timp-liber/muzica/coldplay-a-ajuns-romania-11-iunie-2024-trupa-rock-impresionata-barbat-canta-bucuresti-712337.html);
  2005: a "free zone" weekend for about 20 street musicians on Șelari, Lipscani, Blănari and Zarafi
  (https://adevarul.ro/stil-de-viata/cultura/ploua-cu-bani-pe-lipscani-zona-libera-a-1339908.html). The game's busker,
  the guitar case and the hours 10:00–24:00 are estimates.
- **Photo walk**: Freddo's front and the Carusel front are the scene's own modelled fronts of real buildings; the
  string lights are the scene's festoons. What tourists do by day, per In Your Pocket, Rough Guides and the Accor
  guide: browse Cărturești Carusel, visit Stavropoleos, see Curtea Veche and Manuc's Inn, wander the lanes and
  passages, sit at terraces.

## Looked at and left out

- **Closed for good** (Google Maps "Permanently closed", 2026-11-11), though still in OSM: Coffee & Travel
  (Lipscani 52), Ted's Coffee Co. (Lipscani 79), CLATeatARIE (Lipscani 20), Uau Gelato (Gabroveni 1-3). Their shop signs
  in the scene come from the OSM data and could be dropped in a data refresh.
- **Bubble Waffles, Smârdan 37**: no listing or web trace found; existence not verified.
- **Obraznic, Smârdan 12**: open (Sun–Thu 09:00–21:00, Fri–Sat 09:00–24:00, https://obraznic.com); adult-novelty
  waffles: left out of a CV game.
- **St. Patrick Irish Pub, Smârdan 23-25**: open daily 11:00–02:00 (https://stpatrick.ro): Guinness, whiskeys, sports
  on screens, live music Wed–Sun. A candidate for a later activity (a pint, a match on the screens).
- **Muzeul Micul Paris, Lipscani 41**: private museum of a bourgeois Bucharest home, 11:00–19:00 Wed–Sun (Tuesday
  disputed, Monday closed; https://ghidulmuzeelor.cimec.ro/idEN.asp?k=2121). Needs an interior: not done.
- **ARCUB Hanul Gabroveni, Lipscani 84-90**: exhibitions and shows, Tue–Sun 10:00–20:00 (Google Maps: medium). Needs
  an interior and real programme: not done.
- **Hanul cu Tei passage** (1833; galleries, an antique shop): the scene's two gateways are not built at present (the
  `hanul-cu-tei` group is empty: no facing walls are found at the gate points), so it is not a photo target.
- **Hanul Șerban Vodă ruins under glass** (Lipscani, in front of the National Bank; inn of 1683–85, demolished 1882/83,
  uncovered in the 2007 digs): just west of the visit area and not modelled.
