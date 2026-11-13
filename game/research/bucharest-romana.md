# Bucharest — Romană & Victoriei (`romana`): research dossier

The reference for why the Romană & Victoriei district looks the way it does. Facts are keyed by OSM id (w = way, n = node,
r = relation); bracketed keys point to **Sources** at the end. Git history keeps the round-by-round review notes this page
replaced.

## 1. Overview and sources

- **Machine-readable twin**: `bucharest-romana.json` (generated 2026-11-06 from the OSM API 0.6 snapshot of that day):
  coverage metrics, per-segment street data (`streets[].segments`, research under `streets[].research`), all buildings with
  style-rule estimates (`buildings[]`, reviewed values under `buildings[].research`), junctions and signal nodes, crossings,
  transit lines / stops / metro entrances / liveries, colour palette, Bucharest-wide streetscape rules (`city_rules`), "things a
  local would notice" (`top_local_details`), pedestrian dialogue and the sources table. Businesses:
  `businesses-bucharest-romana.json` (section 7); speed limits: `speedlimits.json`. Reference photos: `refs/romana/`
  (licences in `LICENSES.md`).
- **Extraction area**: bbox `[44.4395, 26.0825, 44.457, 26.1]` (world bbox of `cities.js` BUC_DISTRICTS): west edge just past
  Piața Victoriei (Antipa, Kiseleff start), north edge Bd. Iancu de Hunedoara + one block, east edge Calea Dorobanților / Str.
  Mihai Eminescu, south edge Str. Biserica Amzei / Piața Amzei. Playable area = the 130 m bands and circles of `cities.js`.
- **Method** (fidelity passes 2026-11-12/13): live OSM (API 0.6 `map` for 44.4385,26.0803 – 44.4584,26.1031 on 2026-11-12:
  48,672 nodes, 6,390 ways, 287 relations; Overpass 2026-11-13) decides position and kind; official street-level panoramas
  were looked at for appearance only (ids from coverage metadata; nothing stored, traced or measured). Game views:
  `game/dev/reality/viewpoints.json` (`rom-*`). Not reviewed: interiors, side streets beyond the listed poses, night views.

## 2. Chapters and CV stops

Starts and roads are authoritative in `cities.js` CHAPTERS.

- **arnia** (2019): start Bd. Magheru northbound (44.4418, 26.0988) → around Piața Romană (ASE dome) → full length of Lascăr
  Catargiu → Europe House on the south-east-bound kerb. Research route 2.09 km.
- **uipath-buc** (2020): start Șos. Kiseleff southbound (44.4560, 26.0842; Antipa on the right) → Piața Victoriei → east on
  Bd. Iancu de Hunedoara behind Palatul Victoria → right into one-way Str. Clopotarii Vechi → left on one-way Str. Grigore
  Alexandrescu (children's hospital) → right into one-way Str. Vasile Alecsandri south to The Landmark. Research route 1.46 km.

### arnia — Arnia Software — Europe House

- Bd. Lascăr Catargiu 47-53 (OSM: 51-53), Sector 1. Building w246115249; office node n9913919522 (`office=research` "arnia
  software", 44.4512929, 26.0875373). Door 44.45118, 26.08795, SW side of the boulevard on the SE-bound carriageway; main
  entrance faces the boulevard; Orange shop (n3357667293) on the ground floor at the corner.
- Europe House: completed 2001–2002 (CA Immo: delivered 2001), one of Bucharest's first glass office buildings; OSM 14 levels /
  56 m; listings give 2 basements + ground + 10 floors (C&W Echinox) or "11 levels" (CA Immo); GLA ≈ 16,400 m²; owner CA Immo;
  tenants Orange Romania (HQ offices + shop), Bristol Myers Squibb, Tremend, arnia software [europe_house_caimmo]
  [europe_house_cw] [europe_house_zf].
- Look: blue-green reflective curtain wall (#5E7F8C) with grey aluminium mullions (#9EA3A6), stone / grey-panelled base
  (#B9B4AA), flat roof with plant room and antennas. Panoramas 44.450804, 26.088191 h 315 and 44.4511, 26.0869 h 87: the glass
  is a lighter blue; the south-east end at Lascăr Catargiu is a rounded volume of grey bands between ribbon windows. The
  landmark `europehouse` has the lighter glass and a grey-banded end volume (still square; band pitch estimated).

### uipath-buc — UiPath HQ — The Landmark (w546500235)

- Str. Vasile Alecsandri 4 / Str. Constantin Daniel 11, "Building A", floors 5–6, Sector 1 [uipath_addr]. OSM w546500235 = "The
  Landmark Corp B" (7 levels); the address node n2533820195 lies inside it (OSM letter B differs from UiPath's "Building A").
  Sister block Corp C w583612401 (7 levels).
- Door 44.4499, 26.0944, east side of the one-way southbound street; Ted's Coffee (n13572917435) and Friddi gelato (n7175004386)
  on the ground floor.
- The Landmark: office campus completed 2016–2017, GLA ≈ 23,500–23,700 m², bounded by Str. Căderea Bastiliei, Vasile
  Alecsandri and Constantin Daniel; owner Vectr Holdings (bought from Revetas / Cerberus in 2024); other tenants TotalEnergies,
  Wolf Theiss, Premier Energy, Systematic, Geotab [landmark_vectr] [landmark_economedia] [landmark_spatii].
- Look: class-A office with light stone / fibre-cement panels (#D8D3C8), regular vertical window bands, dark grey frames
  (#3C3F42), glass #6F8A94, glazed ground floor with cafés, recessed top floor. Panorama 44.450288, 26.094312 h 143: stone grid
  with windows on every storey, glazed ground floor, set-back glass top storey (landmark `thelandmark`). A modern beige / grey
  block among old villas.

## 3. Streets and traffic

- **Bd. Lascăr Catargiu** (listed historic monument; old Strada Colței, named Ana Ipătescu under communism) [wp_lascar]:
  dual carriageway, 3 lanes each way (3.0–3.3 m) either side of a narrow raised central strip (≈ 1–2 m, kerbed, lamp /
  trolley poles; left-turn pockets cut into it at signalised junctions, e.g. a left pocket NW-bound before Piața Victoriei on
  w667696381, "through/through/through;right" before most side streets). 60 km/h; trolleybus 79 / 86 wires above the kerb
  lanes (+ buses 100, 361, 381); no tram, no bus lane; no parking on the carriageway (cars use side streets and the ADP lot
  w874893780). Asphalt resurfaced, dark #3F3F44. Sidewalks 4–6 m of grey concrete pavers with tree pits. Signalised at Piața
  Victoriei, Grigore Alexandrescu, Clopotarii Vechi, Puțul de Piatră, Gheorghe Manu, Henri Coandă and Piața Romană;
  right-in / right-out at Povernei, Viișoarei, Visarion, Constantin Daniel. Frontage alternates 2–3-storey eclectic /
  neo-Romanian villas behind iron fences and gardens with 6–9-storey interwar modernist blocks (1929–1940, flat roofs, rounded
  corners, cream / grey render, steel windows) built to the sidewalk; 12 listed houses (nos. 8, 12, 15, 21, 29, 39, 40, 50, 54,
  56, 58 + Petrașcu House); red seismic-risk dots on some blocks (no. 7: class I); embassies with guard booths (Iran, no. 39);
  police station Secția 1. Panoramas `rom-catargiu-mid-nw` / `-se`: grassed, tree-planted median, mature trees hiding two- to
  five-storey houses.
- **Bd. Magheru**: one-way pair at Romană (N-bound 4 lanes "through×3 + through;right", S-bound 3), 60 km/h, metro M2 beneath,
  6–8 m sidewalks; THE interwar modernist boulevard (white blocks of 8–12 storeys, rounded corners, horizontal balcony bands,
  ground-floor shops and cinemas further south); whole-facade mesh banners on several blocks [pressone_ads]. Small parks with
  trees and benches in front of some blocks (`rom-magheru-banks`).
- **Piața Victoriei**: large oval one-way gyratory (counter-clockwise, 3–6 lanes with heavy channelisation, e.g.
  "left/left/left;through/through/through/right"); six arms: Calea Victoriei (S), Lascăr Catargiu (SE), Iancu de Hunedoara
  (E, tram), Aviatorilor / Kiseleff (N), Ion Mihalache (NW), Nicolae Titulescu (W). Every arm signalised (n31402063, n31402056,
  n255721965, n1397123589, n257714748, n2404275892) with signalised pedestrian crossings; trams 1, 10, 46 cross E–W; metro
  Piața Victoriei (M1 / M2) beneath with entrances A (44.45161, 26.08712), B (44.45171, 26.08762), C (44.45371, 26.08624) and a
  lift (44.45174, 26.08672). The panorama at the centre (44.452163, 26.085980) shows asphalt in every direction (section 8).
  Frontage: NE Palatul Victoria; W Antipa and Muzeul Țăranului Român; SW / S 1992–94 towers (Bl. D4–D7, 11–15 storeys) and
  Victoria Center (w173938539, Calea Victoriei 145, 11 lv / 38.5 m); NW BRD Tower and Bucharest Tower Center; a car park
  opposite the Palace [wp_victoriei] [wp_victoria_palace].
- **Piața Romană**: signalised square where Magheru, Lascăr Catargiu and Bd. Dacia cross around a small central island (Capitoline
  Wolf statue 1997–2010, moved to Bd. I.C. Brătianu); metro M2 entrances on Magheru (44.44583, 26.09757; 44.44506, 26.09796);
  ASE to the NE, students crowd the crossings 08–10 and 12–14 [wp_romana] [wp_ase].
- **Str. Vasile Alecsandri**: ONE-WAY southbound single lane (≈ 229 m from Grigore Alexandrescu to Povernei / Constantin
  Daniel), cars half on the sidewalk on both sides, narrow cracked-asphalt sidewalks, mature trees; W side SNSPA (w23647615),
  Italian Vintage café (no. 3); E side The Landmark and villas incl. the Storck museum (no. 16).
- **Str. Grigore Alexandrescu**: one-way eastbound, 1 lane with parked cars, 30 km/h in the hospital stretch (children's
  hospital complex on the N side: Casa Ronald McDonald, burns clinic; villas and small offices S).
- **Str. Clopotarii Vechi**: narrow one-way (NW-bound from Lascăr Catargiu to Grigore Alexandrescu, S-bound beyond), parked cars
  on the sidewalk edge; Medicover clinic at 16-20.
- **Șos. Kiseleff**: grand tree-lined avenue into Piața Victoriei from the north, wide carriageways with broad lawn / tree verges
  under mature chestnuts, lindens and planes; 60 km/h.
- **Bd. Iancu de Hunedoara**: 2 lanes each way (3 near junctions) either side of the central tram reservation (lines 1, 10,
  46), short diagonal parking on the S side, 50 km/h (DJ200B); 9-storey 1960s–70s blocks (Bl. H4–H6 S, Bl. I1–I3, 2, 3 N), Bloc
  Volga (no. 37, 7 lv / 30 m), Capital Plaza Hotel (54).
- **Calea Victoriei** (north end): 1–2 lanes each way, 50 km/h; listed houses (Casa Vernescu 133, Casa Nenciu, Casa cu cariatide
  202, Palatul Cantacuzino 141 / George Enescu Museum); black ornamental cast-iron lanterns.
- **Bd. Dacia**: two-way 2+2 through Piața Romană, trolleybuses 79 / 86 / 97; ASE Mihai Eminescu building (41), Sheraton (5-7).
- **Calea Dorobanților** (scenery, not drivable): south of Iancu de Hunedoara one-way southbound (4 lanes) with a contraflow
  northbound bus / trolleybus lane (`busway=opposite_lane`).
- **Speed limits on the routes** (OSM maxspeed = game km/h): arnia: Magheru 60, Piața Romană 60, Lascăr Catargiu 60, Piața
  Victoriei 50; uipath-buc: Kiseleff 60, Piața Victoriei 50, Iancu de Hunedoara 50, Clopotarii Vechi 50 (RO:urban), Grigore
  Alexandrescu 30, Vasile Alecsandri 50 (RO:urban). Mapped sign n6251793021 (maxweight; maxspeed 40). Romanian rule: 50 km/h in
  localities unless signed, signed range 30–80, no automatic school-zone limit [speed_ro]. Schools within 150 m: Grădinița nr.
  116 (n2558783253), Liceul de Arte Plastice Nicolae Tonitza (w405529583), Școala Internațională Italiană „Aldo Moro”
  (w245083700), Grădinița nr. 50 (w1059582478), Școala Generală nr. 11 (w23611106).
- **Congestion hotspots** (feed `congestion`; city ≈ 62.5 % congestion, ~171 h lost in 2025, 10 km take > 32 min on average and
  > 45 min at the evening peak, worst slot Wednesday 17–18 [tomtom_2025] [tomtom_2025b] [euronews_10km]): Piața Victoriei
  (44.4526, 26.0858, r 220 m, 7:30–10 and 16–19:30, level 0.9; worst Lascăr Catargiu NW-bound and Kiseleff S-bound)
  [hotnews_axis] [tomtom_peak]; Piața Romană (44.4468, 26.097, r 160 m, same hours, 0.85) [tvr_romana]; Lascăr Catargiu
  (44.4492, 26.0915, r 450 m, 8–10 and 17–19, 0.6); Calea Dorobanților south (44.4505, 26.0985, r 200 m, 8–10 and 17–19, 0.6).
- **Signals in the game**: equal-slot simulation phases, not measured plans (Magheru's slot at the five-phase Piața Romană is one
  fifth of the cycle). A car that has just left a controller's box is not held by the same controller's next head within 40 m
  (`traffic.js` `SAME_CONTROLLER_M`), which stopped Piața Romană and Magheru locking up.

## 4. Structures

- **Pasajul Victoria** (1987–89 road underpass beneath Piața Victoriei, W–E). OSM (2026-11-12): two one-way road tunnels
  (w669751868 / w241374325 westbound; w669751870 / w669751871 / w241374324 eastbound) with the two tram tracks between them
  (w241374326, w920117619), busway w1358411333, tram stop nodes n8544117694 / n8544117695 on level −1; all `tunnel=yes` over the
  same extent, portal to portal. The west ramps (w241374320 up, w27008418 down) reach Șos. Nicolae Titulescu ≈ 190 m west of the
  west portal. Reality: one hall with an outer wall on each carriageway and, on the tram side, a row of large rectangular piers
  with fences between them; tram tracks and the underground tram stop in the middle; sodium lighting. Game: the shared hall
  with steel fences between the piers along the platform's road edge, benches and a stop pole only where the hall holds a mapped
  tram stop (the four "Piața Victoriei" tram_stop nodes), dark lamp housings with orange lenses every 9 m under the soffit
  (`hall-furniture.js`: 139 posts, 20 benches, 103 lamps).
- **Pasajul Victoria approaches**: east ramp trench on Bd. Iancu de Hunedoara (44.452073, 26.088653 h 91): square light stone
  piers with dark cast-iron balustrade panels; every open approach draws that class (`trench-parapets.js`). The west descent
  (44.452076, 26.082576) is already walled ≈ 115 m before the portal, with a fenced tram reservation to the north: the eastbound
  ramp w27008418 descends at half the model grade (`grade-review.js`); the westbound exit ramp w241374320 keeps the model grade
  (9 %, ≈ 67 m).
- **Pasajul render check** (two renders with a 2 mm camera shift): at the underpass points (-506.8, -413.3), (-386.8, -413.7),
  (-267.8, -424.7) and (-701.6, -417.2) the changing pixels are moving vehicles and road-texture shimmer; no coplanar pair
  except the road markings (3 cm, by design). A 6.8 m² overlap of a building outline with a service edge at (-642.1, -470.5)
  is a source-data overlap, kept as mapped.
- **Driveway under Palatul Victoria** (w1516934660, `tunnel=yes`, `layer=-1`): runs under a building part with `min_height=7`:
  a street-level passage, not a dug tunnel.
- **ASE covered footbridges** w783025570 / w783025571 / w942676266 (`bridge=covered`, layer 1): concrete deck with a cream
  solid parapet band and a glazed pitched canopy on light steel frames, about one storey up (44.447532, 26.097783 h 160);
  drawn as `covered-glass` (`pedestrian-bridges.js`). w783025571 / w942676266 run on to their walls; w783025570's east end lies
  in the ASE footprint the `ase` landmark replaces, and the model does not fill that corner, so that corridor ends open.
- **Building passages** on service ways w672096997, w1458318537, w1575956753, w229193339: agree with OSM.

## 5. Landmarks and monuments

| Landmark | OSM | What it is, as drawn |
|---|---|---|
| `victoria` Palatul Victoria (Government) | w23554419 (parts 20 / 23 / 30 m) | 1937–1952, Duiliu Marcu, stripped classicism: 3 storeys + 2 recessed top floors (≈ 25 m), travertine #D9CDB4 (originally Carrara marble), arcaded ground floor, 19-bay colonnade of slim piers on the SW front to the square, RO + EU flags; police barriers and gendarmerie vans common (protest site 2017–2018) [wp_victoria_palace] |
| `ase` ASE main building | w942675763 | Piața Romană 6, 1916–1926, neoclassical with central dome and portico; "www.ase.ro" lettering; dome visible from Lascăr Catargiu and Magheru (pose 44.4472, 26.096476 h 39) [wp_ase] |
| `antipa` Grigore Antipa museum | w23610985 | 1903–1906, Grigore Cerkez; no OSM height / levels: two tall storeys, raised pedimented central pavilion, engaged-column porch on the Kiseleff front, rendered masonry #E3D6B8 with stone columns, roof hidden behind a parapet [wp_victoriei] |
| `catargiu` Statue of Lascăr Catargiu | w800350070 | bronze standing figure on a stone pedestal (Antonin Mercié 1907, reinstalled 2011) on the small square at Viișoarei / Povernei (≈ 44.4491, 26.0921): figure in a long coat with a smaller figure against the pedestal (pose 44.449226, 26.092807 h 146) [wp_lascar] |
| `veronafountain` Fântâna Arteziană Arthur Verona | w1183885625 | low round stone basin on paving |
| `aro` Blocul ARO / Patria | w163622261 | 1931, Horia Creangă: grey-beige ribbon-window slab of about eight storeys (OSM 10 levels), a taller slim tower at the NORTH end, shops under a canopy; no PATRIA marquee on the boulevard front (pose 44.442644, 26.098615 h 110) |
| `ambasador` Hotel Ambasador | w442813528 (no height / levels) | pale stone front, dark windows over muted red-brown aprons between pale piers, two raised wings (pose 44.441899, 26.098971 h 75 / 81) |
| `europehouse`, `thelandmark` | w246115249, w546500235 | section 2 |
| `urseanudome` Observatorul Urseanu | tower part w1220336122 | see below |
| `nobildac` Nobil Dac | w1170480716 | marble cloaked standing figure on a square plinth |
| `enescu` George Enescu | w1171605516 | seated bronze on two granite steps |
| `regal` Royal Palace | w232472401 + 263 parts | section 9 for the colour; paired giant columns on pedestals on the court front, dentilled cornice, attic balustrade (`bRegal`) |
| `tnb` National Theatre | `height=24` | model body 24 m, fly towers to 34 m; red hat roof, glazed front (pose 44.4365, 26.1054 h 75) |
| `ateneu` | | not compared (no pose with a clear view) |

- **Observatorul Astronomic „Amiral Vasile Urseanu”** (w79139872 `building=civic`, `man_made=observatory`; Bd. Lascăr Catargiu
  21; pano 44.448503, 26.093125 h 275): cream three-storey villa with rounded corner bays and iron balconies (review row: 13 m,
  3 storeys, cream eclectic). The round east tower is OSM w1220336122 (`building:part=yes`, no height, r 3.3 m): the landmark
  draws its mapped outline as a 13.5 m cream tower with windows and two dark balcony bands, under a grey hemispherical dome
  (r 2.6 m, rise 2.4 m); the dome is documented by the OSM tags and Wikipedia, its form and size are estimates.
- **Monuments** (`monument-sources.js` / `monuments.js`): 18 generic class objects in the district (Alexandru Lahovary on the
  Piața Lahovari island, a figure on a plinth: matches the panorama at 44.44553, 26.09976; Mihai Eminescu; Carol I; busts).
  Carol I n1883108499 is an `equestrian` class (horse and rider on a tall plinth, OSM height 13 m; tags: wikipedia en:Equestrian
  statue of Carol I, artist Florin Codre, 2010). Monumentul Infanteriei Române n987467409: bronze work by Ioan Bolborea,
  unveiled 27 April 2000 on the site of the interwar infantry monument (a column per ro.wikipedia "Parcul Kiseleff" citing
  Formula AS); hidden by trees from Șos. Kiseleff, drawn as the generic bronze `stele`. Memorialul Renașterii n1393030628 has a
  subject form (white marble spire through a dark crown, ≈ 25 m after ro.wikipedia; OSM no height), but its node lies inside a
  mapped building outline, so it is skipped (reported, never moved). Statue n3495777662 (`tourism=artwork`, 44.44385,
  26.100948): pale stone standing figure on a plinth in a small fenced garden (MEOXvDv_jIyjjHmsQMop0g h 95): generic stone
  `statue`. Bariera Mogoșoaiei marker n13849319703: not visible on the panoramas. White Creature n3236859765 (Calea Griviței
  37) is wall art on a building front: not drawn. Mavrogheni church and the Khayyam statue are not visible from the panoramas.

## 6. Buildings and shopfronts

Reviewed looks are rows in `game/src/building-review.js` (`bucharest-romana`) and `building-review-look.js`, mirrored in
`buildings[].research` of the JSON twin; OSM heights, levels and roof shapes are never changed by a row.

| OSM | Seen at street level | Row |
| --- | --- | --- |
| Hotel Lido w162494340 (Magheru) | cream-white interwar hotel, bronze entrance canopy | cream (was default blue) |
| Muzeul Țăranului Român r2552618 | red brick behind large trees, two tall storeys under a steep red tile roof | red brick, no shop floor, 6 m roof rise inside the 19.6 m total |
| Colecția Severeanu w231445058 (Str. Henri Coandă 26) | yellow one-storey eclectic house, white window surrounds | yellow eclectic |
| Sheraton w29819032 (ex-Hotel Dorobanți, 18 lv / 70 m, 1976) | grey stone-clad podium, Pizza Hut and Alpha Bank at the ground floor, cylindrical glazed corner; SHERATON wordmark on the roof crown | signed "Sheraton" with its tenant signs (cylinder not modelled) |
| Hotel Minerva w171045151 (Str. Gen. Gheorghe Manu, pano 0IR_4oFjbwg7c8euMfNEkw) | plastered grey-beige, white window surrounds, stained-glass ground-floor windows | grey-beige (OSM `building=retail`, 8 levels and height kept) |
| Casa Gheorghe Petrașcu w171045146 (Piața Romană 1; 1907, Ion Mincu) | neo-Romanian: arcaded loggia, carved stone columns, hipped red-brown tile roof #8C3B2A with deep eaves; east front beige ornamented stone with barred windows (Yv9RTMCoVSMxEoPO0dOE7g h 245) | own name board; beige stone front; the Viggo shop front (n5602930826, `shop=clothes`, check_date 2026-06-15, 4.4 m inside the SW face) only on the SW face (`shopFaceAt`) |
| Casa Filipescu-Cesianu w131269864 (Calea Victoriei 151; pano 44.450278, 26.087635 h 262) | cream two-storey eclectic palace under a dark slate mansard with oval dormers | mansard `roofShape` + oval dormers (`reviewed-dormers.js`; OSM `roof:shape=quadruple_saltbox` is not drawable and stays in the profile) |
| Observatorul Urseanu w79139872 | section 5 | 13 m, 3 storeys |
| Storck museum w546500256 / w546500238 | section 9 | red-brick gabled house / cream one-storey house |
| Churches (`building-review-look.js`) | Boteanu-Ienii w179319626 warm ochre plaster, arcaded porch (SjOI2XLkhdK5Ic0qM-OaLQ h 71); Crețulescu w1476760553 exposed red brick over a stone plinth (q4sm16NZ5g9nzAl59Pleug h 140); Amzei w76915020 cream stone banded with red brick, one warm tone (8to4VNCB5GgzGL5IUsc2oA h 162) | recoloured; Biserica Albă w78467985 and Icoanei w76920898 are white and match the class |

- **Places of worship** (Sinagoga Eșua Tova, Boteanu, Visarion): drawn with plain walls and tall arched openings (`worship.js`),
  no longer house windows. The real ones: a two-storey synagogue front with a tracery window, a church with a round banded
  porch tower, an ochre neo-Romanian church with an arcaded porch. Towers / domes only where OSM tags them.
- **Victoria Center** w173938539 carries its own name board; its corner unit is a Starbucks (dark fascia, white STARBUCKS COFFEE
  letters; GKPZybRO6HC9NrDEiel-DA h 240).
- **POI links to footprints**: Hotel Michelangelo n2942500701 → w437256698 (4.8 m from the node; a cream eclectic house with
  flags at its gate, pano tj5o-VAsm5bhIxSueHjLCQ); Colecția Vasile Pârvan n2634652176 → w678558174 (2.3 m).
- **Seen and matching in massing** (generic facades, signs from POIs): Magheru blocks (`rom-magheru-scala`, `-mcd`,
  `rom-balcescu-bcr`), Scala Boutique Hotel w163622247 (cream three-storey house, green awnings), the large corner block with
  roof advertising at Piața Romană, the curved nine-storey stone block on Calea Victoriei by the square (BCR n1563503947 blue
  fascia, Intesa n2502640586, Mega Image n2613331337), on Iancu de Hunedoara the blue curtain-wall office with CEC Bank
  n3757940564 and, further east, a long eight-storey block (N) and a curved glass office (S), the white streamlined block with
  Libra Bank and the UniCredit front with a terrace and spherical bollards on Magheru (drawn as posts), Muzeul Național
  Geologic w23611090 (three storeys under a red tile roof behind trees).
- **Rooftop signs** (photos Apr 2023, refs/romana): Piața Romană 9 (curved 8-storey interwar block, corner Magheru / Dacia):
  long red Coca-Cola rooftop sign following the curve (red #E41E2B, white bubbles and script) plus a vertical bottle panel
  [ref_romana9]; Lascăr Catargiu 2–4: "NetBet" rooftop sign (white / blue letters on a dark frame), LED screen, vertical banners
  [ref_lascar4]; Magheru 14: whole-facade mesh ad and an empty steel rooftop billboard frame, "Dragă Sector 1" banners
  [ref_magheru14]. Rooftop brands at Piața Victoriei are not photo-verified (brands rotate; >200 large ad installations in
  the centre [pressone_ads]); the curved block on Calea Victoriei has roof advertising the game does not draw.

Key buildings:

| OSM | Name | Storeys / height | Facade | Era |
|---|---|---|---|---|
| w546500235 | The Landmark — UiPath block (Corp B) | 7 / 26 (OSM live 29.4 m) | #D8D3C8 stone / fibre-cement panels, glass; flat with recessed top floor | 2016–2017 |
| w583612401 | The Landmark Corp C | 7 | #D8D3C8 | 2016–2017 |
| w246115249 | Europe House | OSM 14 lv / 56 m; listing GF + 10; model ≈ 45 m | #5E7F8C glass curtain wall + aluminium | 2001–2002 |
| w29819032 | Sheraton Bucharest | 18 / 70 | #C9C4BA | 1976 |
| w23554419 | Palatul Victoria | 3 + 2 / 25 | #D9CDB4 travertine | 1937–1952 |
| w171045146 | Casa Gheorghe Petrașcu | 2 | #E9E0CF, roof #8C3B2A | 1907 |
| w23610985 | Muzeul Grigore Antipa | 2 tall storeys | #E3D6B8 | 1903–1906 |
| w173938539 | Victoria Center | 11 / 38.5 | | |

## 7. Businesses

- **Research method** (2026-11-07): zone = within 60 m of a chapter route (routed on the OSM graph from the CHAPTERS start to the
  door, one-way and turn-restriction aware) plus recognisable businesses within 50 m of a main street in the district mask;
  standalone ATMs, parcel lockers, chargers and pure company offices left out. Confidence: high = official locator match or
  OSM `check_date` ≥ 2025-05; medium = edited / checked since 2023-11; low = older. Sign style is a category rule (fuel →
  pylon, RO pharmacy → projecting green cross, drive-thru fast food in its own building → pylon, else fascia).
- **Locator matches** [locators]: McDonald's Magheru 24 ("McDonald's Romană"), Dona Magheru (13 m), KFC Magheru 28-30 ("KFC
  Romană", 11 m), Carrefour Express Piața Victoriei 155 ("Express Calea Victoriei"), Carrefour Market Calea Dorobanților 31-33
  ("Market Dorobantilor-ASE"), Carrefour Express Calea Dorobanților 102-110 ("Express Proxi Dorobanti"), McDonald's Str. Doctor
  Iacob Felix 8 ("McDonald's Buzești", incl. the PlayPlace node).
- **Closed per OSM lifecycle tags** within 60 m of a route (drawn as a vacant "De închiriat" unit if modelled; not POIs):
  `disused:` kiosk n2546324265, shop n4549374247, coffee n6513758411 and n9001427429, newsagent n11261959885, florist
  n11261959886 and n11222737061, bureau_de_change n11618365273, pharmacy n2637716554, bank n3757940559, community_centre
  n3956663257 (Centrul Rus de Știință și Cultură), mobile_phone n5084229431, cinema n5859527796 (Cinema Studio), shop
  n7293870987.
- **Coverage** (live OSM 2026-11-12): 320 mapped businesses in the playable area (316 named); 292 were game POIs by name within
  45 m; no game POI lacked a live OSM object. Kinds the builder's `poiKind()` does not keep are not POIs: nightclub (Club XS
  n3118882252), `craft` (Miva Foto n2615818199), adult gaming (Win Boss n11618371471), fitness (Sky Fitness Romana
  n9947523117), galleries (OB'ART n2872402339, FormART n12318228499, Galeria SIMEZA n12318285854, Galeria Romană n6513765648),
  kindergartens, offices outside the kept list (Electrica w180563617 and other notary / lawyer / consulting nodes; arnia's own
  office node n9913919522), physiotherapist n2839154414. `add-pois.mjs` (2026-11-12, `--edge 100`) then appended 254 rows to
  the original 362.
- **Garanti BBVA**: OSM `brand=Garanti Bankası` (Turkish parent); Romanian branches are signed "Garanti BBVA".
- Stanleybet: a shop beside the synagogue in the panorama; OSM has Stanleybet only at n11361411581 (44.44393, 26.09433), so it
  is not shown there.
- Bd. Dacia 30 (Aug 2023): Alpha Bank and Pizza Hut ground-floor units of the Sheraton block. Str. George Enescu: Mega Image on
  the ground floor of a block.

## 8. Trees, green, water and sports

- **Lascăr Catargiu trees**: continuous rows on both sidewalks, crowns meeting over the sidewalk, few on the median. OSM maps
  49 trees within 25 m (44 *Platanus orientalis*, 1 *Salix babylonica*); the 2026-11-06 research described lindens and horse
  chestnuts. Kiseleff has a broad tree belt.
- **Statue of Lascăr Catargiu**: an aerial-measured crown ≈ 11 m south-east of the statue (≈ 44.449049, 26.093009; no OSM tree
  node within 20 m) stood on the paved island that the panorama at 44.448932, 26.093057 h 331 shows open; it is a reviewed
  physical exclusion (`tree-reviews.js`), the source record stays in the pack. The street trees along the island edges stay.
- **Piața Victoriei**: the green came from the aerial green raster (no OSM polygon); a reviewed paved ring (`ground-review.js`)
  keeps it out of the square.
- **Pedestrian streets**: top-down renders show no lawn on the mapped pedestrian bands; plazas outside the 3.5 m band (around
  44.4398, 26.0968) keep the aerial-measured green raster (lawn or paving not compared: backlog r3-look-14).
- **Antipa tree belt**: the museum facade is hidden by trees in reality; the game shows it over open lawn. Inferred trees are
  suppressed inside the aerial survey's coverage, so those crowns need measuring on the aerial mosaic (`tools/aerial`), never
  placing from a panorama.
- **Water and sports**: Kiseleff fountains n7894980887 / n4405655095 and pond w1092796819, Piscina Lido w810540711 (not seen from
  a street panorama), tartan pitch w916708228; fountain basins w1331108694 and w809629318 (`add-areas.mjs`: generic 0.45 m
  light-stone coping, full water; no panorama in reach).

## 9. Documented exceptions and corrections

- **Royal Palace colour**: parts tagged `building:colour=#eee8aa` read olive; the panorama at Piața Revoluției (44.43972,
  26.0971644 h 245, 2024) shows warm cream limestone, arched ground-floor windows, tall first-floor and lower second-floor
  windows, engaged columns. The model takes the walk scene's #e1d6bc and one window per wall panel on three storeys.
- **Storck collection** (n2634651933, Str. Vasile Alecsandri 16): the museum is the 1912–13 house by Alexandru Clavel,
  Anglo-Norman neo-Gothic (Muzeul Bucureștiului; cimec ghidul muzeelor); Wikipedia's coordinates (44.4509722, 26.0944917) lie
  12 m from w546500256 and 19 / 25 m from w546500238 / w546500250. w546500256 is drawn as a red-brick two-storey gabled house
  without a shop floor, w546500238 as the cream one-storey house (pano 44.450834, 26.094312 h 60). OSM still tags the museum
  node `tourism=artwork` in no outline: an OSM fix (`tourism=museum` on w546500256), not made here.
- **Statue tree exclusion** and **Piața Victoriei paved ring**: section 8 (exceptions to the aerial survey / raster, not to OSM).

## 10. Estimates and open questions

- **Statues** (Catargiu, Nobil Dac, Enescu): hand-modelled silhouettes, sizes estimated. **Observatory**: tower height, dome
  form, size and finish.
- **Royal Palace front**: column radius, pair spacing (one pair per two 4.2 m bays), cornice depth, dentil and baluster pitch;
  Carol I is massing only (plinth / group split of the 13 m OSM height).
- **Muzeul Țăranului Român**: total height 19.6 m (a re-estimate) and 6 m roof rise (behind the Kiseleff tree belt); the
  entrance tower has no OSM part or sourced height and is not drawn.
- **Monumentul Infanteriei**: form and height (no dimensions published, hidden by trees).
- **Pasajul Victoria**: platform and pier sizes, fence height 1.1 m, post / bench / lamp spacing and lamp colour
  (`HALL_FURNITURE_MODEL.estimates`); rim balustrade pier spacing and heights (the west ramp not compared at its own pose; cast
  ornament simplified to bars); the westbound exit ramp's real start (a longer ramp would pass at full depth under the at-grade
  crossing of the same way in the data).
- **ASE footbridges**: width 3.2 m, soffit 5.2 m, shallow-arch canopy rise 0.7 m; only w783025570 seen on a panorama.
- **Casa Filipescu-Cesianu dormers**: one per 3.6 m along each face, size and set-back. **Storck houses**: heights 9 m /
  4.5 m. **Europe House**: band pitch; storey count conflict (OSM 14 vs listing GF + 10).
- **Fountain basin copings** (0.45 m).
- **Open looks**: Europe House's rounded SE end (drawn square); the copper-glass ASE new wing, white eclectic house and yellow
  four-storey building beside ASE (generic beige block in the game); Sheraton's glazed corner cylinder; the ground floor of the
  curved block on Str. Buzești (a row of shopfronts behind a parking strip; the game shows signs on a wall with windows);
  eclectic houses at `rom-coanda-michelangelo`; porches and bell towers of churches (backlog r3-look-11); lamp / luminaire
  model per street; facade colours of unnamed buildings are style-rule estimates.

## 11. Sources

| key | URL |
|---|---|
| osm | https://www.openstreetmap.org (API 0.6 tiles 2026-11-06; live API / Overpass 2026-11-12/13) |
| europe_house_caimmo | https://caimmo.com/en/press-corner/news/news-detail/bristol-myers-squibb-romania-remains-another-5-years-in-europe-house-office-building |
| europe_house_cw | https://office.cwechinox.com/?p=20629 |
| europe_house_zf | https://m.zf.ro/amp/zf-english/the-first-glass-offices-of-bucharest-still-lure-tenants-owing-to-location-6744587 |
| landmark_vectr | https://romania-insider.com/vectr-realty-the-landmark-offices-deal-bucharest-2024 |
| landmark_economedia | https://economedia.ro/fratii-gupta-care-detin-si-london-partners-au-cumparat-cladirea-de-birouri-the-landmark-unde-are-sediu-uipath.html |
| landmark_spatii | https://www.spatii-de-birouri.ro/en/bucharest-the-landmark |
| uipath_addr | https://assets.opencorporates.com/companies/ro/34737997 |
| wp_lascar | https://en.wikipedia.org/wiki/Bulevardul_Lasc%C4%83r_Catargiu |
| wp_victoriei | https://en.wikipedia.org/wiki/Victory_Square,_Bucharest |
| wp_romana | https://en.wikipedia.org/wiki/Pia%C8%9Ba_Roman%C4%83 |
| wp_victoria_palace | https://en.wikipedia.org/wiki/Victoria_Palace |
| wp_ase | https://en.wikipedia.org/wiki/Bucharest_University_of_Economic_Studies |
| tomtom_2025 | https://www.romania-insider.com/tomtom-bucharest-residents-stuck-traffic-2025 |
| tomtom_2025b | https://universul.net/bucharest-residents-spent-over-a-week-stuck-in-traffic-in-2025/ |
| tomtom_peak | https://www.romania-insider.com/bucharest-has-the-biggest-traffic-jams-in-europe-study-shows-which-are-the-busiest-hours |
| euronews_10km | https://www.euronews.ro/articole/cosmarul-traficului-din-bucuresti-nu-s-a-schimbat-10-kilometri-in-peste-45-de-minute |
| hotnews_axis | https://hotnews.ro/bucurestiul-pe-locul-8-n-topul-celor-mai-aglomerate-de-trafic-orase-din-lume-23247 |
| tvr_romana | https://tvrinfo.ro/nu-mai-exista-ora-de-varf-ci-un-blocaj-continuu-in-trafic-in-prag-de-sarbatori-in-bucuresti/ |
| pressone_ads | https://pressone.ro/peste-200-de-spatii-de-reclame-din-centrul-bucurestiului-aduc-profituri-de-zeci-de-milioane-de-euro-autoritatile-nu-raspund-daca-sunt-amplasate-legal |
| ref_romana9 | https://commons.wikimedia.org/wiki/File:9_Pia%C8%9Ba_Roman%C4%83,_Bucharest_(05).jpg |
| ref_lascar4 | https://commons.wikimedia.org/wiki/File:4_Bulevardul_Lasc%C4%83r_Catargiu,_Bucharest_(03).jpg |
| ref_magheru14 | https://commons.wikimedia.org/wiki/File:14_Bulevardul_Gheorghe_Magheru,_Bucharest_(04).jpg |
| speed_ro | https://en.wikipedia.org/wiki/Speed_limits_in_Romania (fetched 2026-11-07; legislatie.just.ro did not respond) |
| locators | McDonald's https://mcdonalds.ro/restaurante, KFC https://kfc.ro/restaurante, Kaufland https://www.kaufland.ro/.klstorefinder.json, Carrefour https://carrefour.ro/corporate/magazine, Dona https://www.dona.ro/farmacii (all 2026-11-07). Not machine-readable then: Mega Image, Profi, Dr.Max, HelpNet, CEC, Raiffeisen, Lidl, Penny, Catena, BT, BCR, ING, Orange, Vodafone, Petrom, OMV, MOL, Rompetrol, Lukoil, OTP, Alpha Bank, Digi, Telekom: these rely on OSM edit / check dates |

The remaining keys cited inside `bucharest-romana.json` resolve in its `meta.sources`.
