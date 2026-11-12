# Bucharest - top-10 tourist spots (research dossier)

Role: research-buc-spots. Machine-readable scene specs: [`bucharest-spots.json`](bucharest-spots.json) (`spots[]`, `ranking`, `dialogue_general`). Reference images: [`refs/buc-spots/`](refs/buc-spots/LICENSES.md). Generated 2026-11-06T22:12Z.

## 1. Ranking (evidence)

Score = number of independent signals: (1) Wikivoyage Bucharest "See/Landmarks/Museums/Parks" listings; (2) Visit Bucharest study of foreign-tourist searches 2024 (750k page views; attractions, museums, restaurants, tours); (3) Visit Bucharest Today study 2022 (52,000 searches, May-July; attractions/museums/parks ranked); (4) Trip.com "Best things to do in Bucharest" 2025 list (Tripadvisor itself blocked from this environment; WebSearch snippets give TA ranks only partially); (5) older Tripadvisor Travellers' Choice mentions via Romania Insider 2015; (6) annual visitor numbers where published; (7) owner's candidate list in spec 15. Each top-10 spot must be a compact (150-400 m) walkable scene, so neighbouring must-sees are merged (e.g. Old Town core) and spots far outside the city (Therme, Bran) are excluded.

| # | spot | evidence | sources |
|---|---|---|---|
| 1 | Palace of the Parliament & Piața Constituției | Wikivoyage: first "Landmark" listed; VB 2024: #4 most-searched attraction; VB 2022: #3; Trip.com 2025: #1 best thing to do; Tripadvisor Travellers' Choice 2015 mention (Parliament's Palace); 150,000-260,000 visitors/yr (2023: ~152,000; 2018: >260,000; 80% foreign); Christmas Market (VB 2024 #1 search) is held in Piața Constituției in front of it | [wv](https://en.wikivoyage.org/wiki/Bucharest#See), [vb24](https://visitbucharest.today/study-what-information-did-foreign-tourists-search-for-online-about-bucharest-in-2024/), [vb22](https://economedia.ro/centrul-vechi-vila-lui-nicolae-ceausescu-parcul-herastrau-si-caru-cu-bere-cele-mai-atractive-puncte-de-interes-pentru-turistii-care-viziteaza-bucurestiul-castelul-bran-preferat-pentru-e.html), [trip](https://www.trip.com/toplist/tripbest/bucharest-best-things-to-do-10070001229090), [ta15](https://romania-insider.com/top-10-destinations-in-romania-in-2015), [pal_vis](https://adevarul.ro/stiri-interne/societate/motivul-pentru-care-o-turista-a-cazut-in-genunchi-2463901.html), [pal_zf](https://www.zf.ro/zf-english/palace-of-parliament-visited-by-400-tourists-daily-two-times-fewer-than-budapest-parliament-7365456) |
| 2 | Old Town: Lipscani, Cărturești Carusel, Hanul lui Manuc & Curtea Veche | VB 2022: #1 most-searched attraction; VB 2024: #3 (Old Town) + Salvador Dali exhibition at Hanul Gabroveni and Hanu' lui Manuc among top restaurants; Wikivoyage: "Old City" landmark; Cărturești Carusel listed under Buy; Lipscani "nowadays is the most attractive area for tourists of all Bucharest" (en wiki); Cărturești Carusel: expected ~1,000 visitors/day at opening, ~25k reviews 4.8 (travel guide claim) | [vb22](https://economedia.ro/centrul-vechi-vila-lui-nicolae-ceausescu-parcul-herastrau-si-caru-cu-bere-cele-mai-atractive-puncte-de-interes-pentru-turistii-care-viziteaza-bucurestiul-castelul-bran-preferat-pentru-e.html), [vb24](https://visitbucharest.today/study-what-information-did-foreign-tourists-search-for-online-about-bucharest-in-2024/), [wv](https://en.wikivoyage.org/wiki/Bucharest#See), [lips](https://en.wikipedia.org/wiki/Lipscani) |
| 3 | Stavropoleos, Caru' cu Bere & CEC Palace (south Calea Victoriei) | Wikivoyage: Stavropoleos listed under churches ("a little jewel"); National History Museum; Caru' cu Bere: #1 most-searched restaurant VB 2022 & 2024; ~2,500 guests/day, 36% foreign (2014); VB 2024 most popular guided tour starts on Calea Victoriei | [wv](https://en.wikivoyage.org/wiki/Bucharest#See), [vb24](https://visitbucharest.today/study-what-information-did-foreign-tourists-search-for-online-about-bucharest-in-2024/), [vb22](https://economedia.ro/centrul-vechi-vila-lui-nicolae-ceausescu-parcul-herastrau-si-caru-cu-bere-cele-mai-atractive-puncte-de-interes-pentru-turistii-care-viziteaza-bucurestiul-castelul-bran-preferat-pentru-e.html), [caru](https://ro.wikipedia.org/wiki/Caru%27_cu_Bere) |
| 4 | Romanian Athenaeum & Piața Revoluției | VB 2022: #4 most-searched attraction (Athenaeum); Trip.com 2025: top 3; Tripadvisor 2015 mention; Wikivoyage: Revolution Square + Athenaeum + National Art Museum (#4 searched museum 2022, #5 2024); VB 2024 #1 guided tour: "Calea Victoriei - Piața Revoluției" | [vb22](https://economedia.ro/centrul-vechi-vila-lui-nicolae-ceausescu-parcul-herastrau-si-caru-cu-bere-cele-mai-atractive-puncte-de-interes-pentru-turistii-care-viziteaza-bucurestiul-castelul-bran-preferat-pentru-e.html), [trip](https://www.trip.com/toplist/tripbest/bucharest-best-things-to-do-10070001229090), [ta15](https://romania-insider.com/top-10-destinations-in-romania-in-2015), [wv](https://en.wikivoyage.org/wiki/Bucharest#See), [vb24](https://visitbucharest.today/study-what-information-did-foreign-tourists-search-for-online-about-bucharest-in-2024/) |
| 5 | Arcul de Triumf | Trip.com 2025 top-5; Wikivoyage landmark; Owner candidate list | [trip](https://www.trip.com/toplist/tripbest/bucharest-best-things-to-do-10070001229090), [wv](https://en.wikivoyage.org/wiki/Bucharest#See) |
| 6 | Dimitrie Gusti National Village Museum | ~800,000 visitors in 2017 (68% foreign) - the most-visited museum in Bucharest by that figure; 303,296 in 2010; VB 2024: #2 most-searched museum; VB 2022: #5; Tripadvisor 2015 Travellers' Choice mention | [vil_ro](https://ro.wikipedia.org/wiki/Muzeul_Na%C8%9Bional_al_Satului_%E2%80%9EDimitrie_Gusti%E2%80%9D), [vb24](https://visitbucharest.today/study-what-information-did-foreign-tourists-search-for-online-about-bucharest-in-2024/), [vb22](https://economedia.ro/centrul-vechi-vila-lui-nicolae-ceausescu-parcul-herastrau-si-caru-cu-bere-cele-mai-atractive-puncte-de-interes-pentru-turistii-care-viziteaza-bucurestiul-castelul-bran-preferat-pentru-e.html), [ta15](https://romania-insider.com/top-10-destinations-in-romania-in-2015) |
| 7 | King Michael I (Herăstrău) Park: Alley of Personalities, Japanese Garden & south lakeshore | VB 2022: #1 most-searched park; Trip.com 2025: #2 ("King Michael I" Park); Wikivoyage: listed under Parks | [vb22](https://economedia.ro/centrul-vechi-vila-lui-nicolae-ceausescu-parcul-herastrau-si-caru-cu-bere-cele-mai-atractive-puncte-de-interes-pentru-turistii-care-viziteaza-bucurestiul-castelul-bran-preferat-pentru-e.html), [trip](https://www.trip.com/toplist/tripbest/bucharest-best-things-to-do-10070001229090), [wv](https://en.wikivoyage.org/wiki/Bucharest#See) |
| 8 | Spring Palace (Ceaușescu Mansion) | VB 2022 and 2024: #1 most-searched museum (Ceaușescu House / Vila lui Ceaușescu); "Attractions of Communism" is the #2 guided tour (VB 2024) | [vb22](https://economedia.ro/centrul-vechi-vila-lui-nicolae-ceausescu-parcul-herastrau-si-caru-cu-bere-cele-mai-atractive-puncte-de-interes-pentru-turistii-care-viziteaza-bucurestiul-castelul-bran-preferat-pentru-e.html), [vb24](https://visitbucharest.today/study-what-information-did-foreign-tourists-search-for-online-about-bucharest-in-2024/) |
| 9 | Cișmigiu Gardens | Wikivoyage: first park listed ("oldest in the city"); VB 2022: #3 most-searched park; Owner candidate list | [wv](https://en.wikivoyage.org/wiki/Bucharest#See), [vb22](https://economedia.ro/centrul-vechi-vila-lui-nicolae-ceausescu-parcul-herastrau-si-caru-cu-bere-cele-mai-atractive-puncte-de-interes-pentru-turistii-care-viziteaza-bucurestiul-castelul-bran-preferat-pentru-e.html) |
| 10 | People's Salvation Cathedral (National Cathedral) | VB 2022: #5 most-searched attraction (Catedrala Mântuirii Neamului); Tallest/largest Orthodox church in the world; permanently opened 26 Oct 2025 (mosaic consecration) - rising visitor interest; Replaces spec candidate "Patriarchal Cathedral hill" which has no ranking signal | [vb22](https://economedia.ro/centrul-vechi-vila-lui-nicolae-ceausescu-parcul-herastrau-si-caru-cu-bere-cele-mai-atractive-puncte-de-interes-pentru-turistii-care-viziteaza-bucurestiul-castelul-bran-preferat-pentru-e.html), [cath](https://en.wikipedia.org/wiki/People%27s_Salvation_Cathedral) |

**Considered, not selected:**

- **Unirii Fountain Show (Piața Unirii, "Simfonia Apei")** - VB #2 search in 2022 and 2024, but it lies in the Unirii driving district (spec 10) - recommend the world/district team model the fountains + evening show there; the Palace spot includes the first Bd. Unirii fountains.
- **Therme București** - VB 2024 #5 search; indoor water park 10 km north of the city in Balotești, outside the city and not a walkable outdoor landmark.
- **Christmas Market** - VB 2024 #1 search; seasonal event held in Piața Constituției - included as a December variant of the Palace spot.
- **Grigore Antipa Natural History Museum** - VB 2022 #3 museum, 2024 #4; an indoor museum (Kiseleff 1), weaker as a walkable outdoor scene.
- **Botanical Garden "Dimitrie Brândză"** - Trip.com 2025 top-5, VB 2022 #2 park; candidate #11 / swap-in if the owner prefers nature over the cathedral.
- **Patriarchal Cathedral & Dealul Mitropoliei** - Spec candidate; no ranking signal in the sources found; adjacent to Unirii district.
- **National Museum of the Romanian Peasant** - Tripadvisor 2015 mention, VB 2022 #6 museum; indoor.
- **Berăria H (Herăstrău)** - Top-searched restaurant 2024; a beer hall, not a landmark.

**Caveats:** Tripadvisor, Lonely Planet, Trip.com and bucharest.ro could not be fetched directly from this environment (403/DNS); Trip.com and Tripadvisor positions come from search-engine snippets. Visit Bucharest studies measure online searches on one guide site, not footfall. Visitor numbers are only published for a few sites (Palace, Village Museum).

Source key: wv = https://en.wikivoyage.org/wiki/Bucharest#See; vb24 = https://visitbucharest.today/study-what-information-did-foreign-tourists-search-for-online-about-bucharest-in-2024/; vb22 = https://economedia.ro/centrul-vechi-vila-lui-nicolae-ceausescu-parcul-herastrau-si-caru-cu-bere-cele-mai-atractive-puncte-de-interes-pentru-turistii-care-viziteaza-bucurestiul-castelul-bran-preferat-pentru-e.html; trip = https://www.trip.com/toplist/tripbest/bucharest-best-things-to-do-10070001229090; ta15 = https://romania-insider.com/top-10-destinations-in-romania-in-2015; pal_vis = https://adevarul.ro/stiri-interne/societate/motivul-pentru-care-o-turista-a-cazut-in-genunchi-2463901.html; pal_zf = https://www.zf.ro/zf-english/palace-of-parliament-visited-by-400-tourists-daily-two-times-fewer-than-budapest-parliament-7365456; vil_ro = https://ro.wikipedia.org/wiki/Muzeul_Na%C8%9Bional_al_Satului_%E2%80%9EDimitrie_Gusti%E2%80%9D; caru = https://ro.wikipedia.org/wiki/Caru%27_cu_Bere; lips = https://en.wikipedia.org/wiki/Lipscani; cath = https://en.wikipedia.org/wiki/People%27s_Salvation_Cathedral

## 2. Spots

### 1. Palace of the Parliament & Piața Constituției (`palace-parliament`)

*Palatul Parlamentului și Piața Constituției* - The heaviest building on Earth seen from the vast square at the head of Bulevardul Unirii.

- **Footprint:** 437 x 411 m around 44.42735, 26.09050. ~440 m E-W x 410 m N-S. West edge cuts through the palace east wing so the whole 270 m main façade (east) stands inside the scene; the square, the head of Bulevardul Unirii with its first fountains, and the two curved 9-storey Ceaușescu-era blocks on Bd. Libertății frame it. Player is fenced out of the palace grounds except the public sidewalk; the visitor entrance (tours) is on the north side, Str. Izvor 2-4 / Bd. Națiunile Unite.
- **Palatul Parlamentului (east/main façade)** - OSM relation/2230391 - dims {"length_m": 270, "width_m": 240, "height_m": 84, "height_note": "84 m (en wiki) / 86 m above ground (ro wiki); 9 levels above ground + 9 underground (ro wiki), 92 m deep; OSM height=29 is the eave of the outer wings only", "footprint_m2": 66000, "floor_area_m2": 365000} - colours: colour_hex #D8CFBE, colour_shadow_hex #A79C86
- **Piața Constituției** - OSM way/219710325 - dims {"length_m": 236, "width_m": 103, "note": "OSM polygon (N-S long axis); used as paid surface parking (OSM amenity=parking, fee=yes) most of the year, cleared for events"}
- **Ceasul "București 1459"** - OSM node/6049432585
- **Bulevardul Unirii fountains (head of the axis)** - OSM node/10936684801..811, node/10936684660..668
- **Curved 9-storey government blocks on Bd. Libertății** - OSM way/41474365, way/207162869 - dims {"levels": 9, "length_m": 268} - colours: colour_hex #E3DCCB
- **Ground:** square: granite setts ~10x10 cm laid in rows/fan arcs (#8E8A84); Bd. Libertății ring + Bd. Unirii: asphalt (#4A4A4C); sidewalks: grey concrete pavers 40x40 / interlocking pavers (#A9A7A1); palace grounds: sloped lawns, gravel/asphalt service roads, retaining walls and terraces (OSM retaining_wall, hedges) (#6E8B4E)
- **Vegetation:** Palace slope gardens: 355 OSM-mapped trees in the footprint, mostly Quercus robur (62), Tilia tomentosa (48), Thuja orientalis (43, clipped conical rows), Tilia platyphyllos (37), Sambucus nigra, Populus tremula/alba, Acer negundo; clipped box/privet hedges (30 OSM hedge ways). Square itself is treeless (open setts).
- **Furniture:** tall boulevard lamp posts (double-arm, ~10-12 m, dark grey) along Bd. Libertății/Unirii; white backless benches (OSM colour=white) on the park side; lift gates/barriers at palace service entrances, guard booths, steel fence (dark green/black palisade) around the palace grounds; drinking fountain (bubbler) at the square east edge; I'Velo bike rental (Izvor side, outside); flagpoles; in December: wooden market cabins, 30 m tree, carousel
- **Lighting:** Night: palace façade floodlit warm white/amber from ground projectors; boulevard sodium/LED lamps; square lit by mast lights; December adds string lights over the market.
- **Backdrop:** North/south: curved 9-storey ministry blocks (cream). East: Bulevardul Unirii axis lined with 8-10 storey 1980s blocks (Bl. 1, Bl. 8A) with fountains in the median running to Piața Unirii. West: palace mass fills the view; People's Salvation Cathedral (gilded dome, 127 m) rises behind the south-west corner.
- **Crowd:** Sparse on weekdays (the square is huge): small tour groups photographing the façade, joggers, parked-car drivers, guards. Dense on 1 December (parade) and in December evenings (Christmas market, families, Bulgarian day-trippers). ~150,000-260,000 tour visitors per year inside the palace (2023: ~152,000). (personas: tour_guide, tourist_uk, tourist_de, tourist_us, tourist_bg, local_parent, guard, vendor(December market))
- **Sounds:** wind across the open square; traffic hum on the Bd. Libertății ring (honks); fountain jets splashing; flag ropes clanking on poles; tour guide voices in English; December: carols, mulled-wine stalls chatter, carousel organ
- **Plaques:**
  - 270 m x 240 m, 84 m tall and 92 m deep underground: one of the largest administrative buildings in the world. ([source](https://en.wikipedia.org/wiki/Palace_of_the_Parliament))
  - Built 1984-1997 by chief architect Anca Petrescu, who won the contest at 28, with a team of about 700 architects. ([source](https://en.wikipedia.org/wiki/Palace_of_the_Parliament))
  - It weighs about 4.1 million tonnes, the heaviest building in the world, and sinks about 6 mm every year. ([source](https://en.wikipedia.org/wiki/Palace_of_the_Parliament))
  - About 7 km² of old Bucharest were demolished and some 40,000 people relocated to make room for it. ([source](https://en.wikipedia.org/wiki/Palace_of_the_Parliament))
  - Made almost entirely of Romanian materials: 1,000,000 m³ of marble, 3,500 t of crystal, 480 chandeliers. ([source](https://en.wikipedia.org/wiki/Palace_of_the_Parliament))
  - In 1990 Rupert Murdoch offered US$1 billion for the building. The offer was refused. ([source](https://en.wikipedia.org/wiki/Palace_of_the_Parliament))
- **Interaction - Pace the Palace:** Walk/run the full 270 m east façade between two marker plaques; a timer and pedometer compare your time with how long it takes to walk the Pentagon's side and show "this is only one side". In December the square turns into the Christmas Market: buy a cup of vin fiert (mulled wine, shown as hot cocoa for kids) and ride the carousel.
- **Postcard:** at [44.42738, 26.09265], heading 268 deg, pitch 6, FOV 70. From the east edge of Piața Constituției by the "București 1459" clock, ~330 m from the façade, camera on the Unirii axis so the central pavilion is centred; at dusk the floodlights turn on. Postcard alt: from the Bd. Unirii median fountains (outside footprint).
- **Season/time:** Summer: harsh midday sun from the south, heat shimmer over the setts; floodlights at ~21:00. December: Christmas Market cabins fill the square (29 Nov-28 Dec 2025 edition), 30 m tree on axis, snow possible. 1 December (National Day): military parade, tribunes, crowd barriers. Night: façade lit, square nearly empty.
- **Copyright:** Romania has no freedom of panorama and the architect's heirs have claimed a 2% royalty for commercial use of images of the building; non-commercial use is described as unrestricted (en wiki). Keep the game non-commercial and do not ship photos of the palace as textures.
- **OSM coverage:** 17 buildings, 8 building parts, 109 paths, 46 areas, 355 trees (333 with species), 0 lamps, 33 furniture, 2 artworks/memorials, 14 named businesses.
- **Refs:** 10 images (0 texture candidates); **dialogue:** 7 personas, 132 lines.
- **What a local would notice if wrong:**
  - The square is huge and mostly empty setts/parked cars - do not fill it with trees or a lawn.
  - Three tall flagpoles on the palace forecourt facing the boulevard: the Romanian tricolour between two blue flags (EU, NATO).
  - Palace is cream/ivory stone, not grey concrete; dozens of identical arched windows per tier.
  - The palace front garden has a big embroidered-looking flower parterre and conical clipped thujas.
  - The curved 9-storey blocks wrap the square with an arcaded top storey.
  - The Unirii fountains start right where the square ends; the boulevard is perfectly axial with the palace centre.
  - Guards/gendarmes at gates; visitor entrance is on the north (Izvor) side, not the main front.

### 2. Old Town: Lipscani, Cărturești Carusel, Hanul lui Manuc & Curtea Veche (`old-town-lipscani`)

*Centrul Vechi: Lipscani, Cărturești Carusel, Hanul lui Manuc, Curtea Veche* - The pedestrian medieval core: guild-named lanes, the white "carousel" bookshop, the 1808 caravanserai and Vlad the Impaler's princely court.

- **Footprint:** 318 x 378 m around 44.43090, 26.10150. ~320 m E-W x 380 m N-S between Str. Smârdan (W), Bd. I. C. Brătianu (E), Str. Lipscani/Gabroveni (N) and Str. Franceză / Piața Unirii edge (S). All pedestrian streets (maxspeed 20, vehicles only for deliveries before 10:00).
- **Cărturești Carusel (Lipscani 55)** - OSM way/658009149 (building polygon containing shop node/3355049764; 27.4 x 13.4 m, ~354 m², long axis ~N-S, narrow front on Lipscani) - dims {"floors": 6, "footprint_m": [27.4, 13.4], "note": "six levels incl. top-floor bistro; atrium with white undulating balconies and spiral/curving stair"} - colours: colour_hex #E6DCC8, frames_hex #2B2B2B
- **Hanul lui Manuc (Manuc's Inn), Str. Franceză 62-64** - OSM relation/19803024 - dims {"length_m": 70.6, "width_m": 61.8, "levels": 2, "note": "closed quadrangle around a large courtyard; OSM building:colour=white, material=brick, roof brown"} - colours: colour_hex #F1EEE6
- **Curtea Veche - Palatul Voievodal (Old Princely Court ruins)** - OSM way/658220894 - dims {"length_m": 67.8, "width_m": 42.3, "note": "excavated brick vaults and walls, partly roofed museum"} - colours: colour_hex #A65A3A
- **Biserica Curtea Veche (Buna Vestire), Str. Franceză 33** - OSM way/150803286 - colours: colour_brick_hex #9E4B33, colour_band_hex #EDE6D6, roof_hex #5C5F60
- **Strada Lipscani** - OSM Str. Lipscani pedestrian ways
- **Ground:** pedestrian streets (Lipscani, Franceză, Șelari, Smârdan, Gabroveni): small grey granite cobbles/setts (~10 cm) laid in loose rows across the whole street width, no kerbs (shared surface), occasional larger slab bands and cast-iron manhole covers (OSM: sett / paving_stones / paved) (#9A9DA2); Piața Sf. Anton (by Curtea Veche): granite setts (OSM) (#8A8580); Manuc courtyard: stone pavers/cobbles (#9A9286)
- **Vegetation:** Dense historic core with few trees: 134 OSM trees in the wider footprint (mostly around Curtea Veche, Manuc courtyard and the Brătianu edge); small grass beds at the ruins; vines and potted plants on terraces.
- **Furniture:** terrace pergolas with green/cream canvas awnings over wooden chairs and cushioned rattan sofas, potted bamboo screens, string lights (photo Lipscani looking east); black cast-iron historic-style street lamps ~4.5 m with lantern heads, some double-headed; wall-bracket lanterns; A-frame chalkboard/printed boards (e.g. "CIGARETTES WINES TOBACCO LIQUORS CIGARS"), Coca-Cola branded menu stands, ATM signs; wrought-iron balconies, AC units and overhead cables on façades; bollards at street entrances; benches (28 OSM) around Curtea Veche; waste bins; souvenir stalls, magnets/Dracula mugs; street-art/murals on some blank walls
- **Lighting:** Night is peak time: warm lantern lamps, illuminated bar signs, string lights across lanes, Carusel atrium glowing white through the arched windows.
- **Backdrop:** East: the tall grey office block with the NTT DATA rooftop sign visible at the end of Lipscani (on Bd. I. C. Brătianu); south-east: Piața Unirii; north: Hanul Gabroveni (Salvador Dali Universe exhibition 2024), National Bank palace; west: Stavropoleos spot.
- **Crowd:** Busiest place in the city: daytime tour groups and couples; evenings/weekends packed with young locals and stag/hen groups; terrace waiters inviting passers-by. Old Town was the most-searched attraction by foreigners (Visit Bucharest 2022) and top-3 in 2024. (personas: waiter, tour_guide, local_young, tourist_uk, tourist_it, tourist_us, busker, vendor)
- **Sounds:** terrace chatter and clinking glasses; bar music spilling out (pop/house), occasional lăutari violin/accordion; footsteps on stone; waiters calling; church bell of Curtea Veche; pigeons
- **Plaques:**
  - Lipscani is named after Leipzig (Lipsca): traders here sold goods brought from the West. ([source](https://en.wikipedia.org/wiki/Lipscani))
  - Neighbouring streets keep the old guild names: Blănari (furriers), Șelari (saddlers). ([source](https://en.wikipedia.org/wiki/Lipscani))
  - Manuc's Inn was built in 1808 by the Armenian merchant Manuc Bei; talks for the 1812 Treaty of Bucharest were held here. ([source](https://en.wikipedia.org/wiki/Manuc%27s_Inn))
  - Curtea Veche: Vlad III (Dracula) dated a document from his "fortress of Bucharest" on 20 September 1459. ([source](https://en.wikipedia.org/wiki/Curtea_Veche))
  - The Curtea Veche church (1559) is the oldest church in Bucharest kept in its original form. ([source](https://en.wikipedia.org/wiki/Curtea_Veche))
  - Cărturești Carusel: an 1860 bank building, restored and reopened as a 6-floor bookshop in 2015. "Cărturești" is the chain's name, not "light". ([source](https://ro.wikipedia.org/wiki/C%C4%83rture%C8%99ti_Carusel))
- **Interaction - Carousel climb & Dracula hunt:** Enter Cărturești Carusel and climb the white balconies to the top-floor bistro to unlock the atrium postcard; outside, find Vlad the Impaler's bust at Curtea Veche while vendors try to sell you "Dracula" magnets (say "Nu, mersi").
- **Postcard:** at [44.4319, 26.10155], heading 180 deg, pitch 20, FOV 75. Inside Carusel from the 2nd-floor balcony at the entrance side looking into the atrium and up at the stacked white balconies. Exterior alt: Str. Franceză at [44.43010,26.10180] heading 80 deg looking at Manuc's Inn gate at dusk.
- **Season/time:** Summer nights: terraces full until 02:00 (Manuc Fri-Sa 10-02, OSM). Winter: terrace heaters, mulled wine, Christmas lights strung across lanes. 1 March: mărțișor stalls. Mornings: delivery vans, cleaning trucks, almost empty.
- **Copyright:** Carusel interior (2015 redesign) is a recent copyrighted work and Romania has no freedom of panorama: use interior photos as modelling reference only.
- **OSM coverage:** 203 buildings, 251 building parts, 81 paths, 96 areas, 134 trees (115 with species), 0 lamps, 35 furniture, 3 artworks/memorials, 233 named businesses.
- **Refs:** 13 images (7 texture candidates); **dialogue:** 7 personas, 130 lines.
- **What a local would notice if wrong:**
  - Streets are shared-surface grey cobbles with no kerbs.
  - Every ground floor is a bar/restaurant with a terrace pergola; waiters invite you in.
  - Black cast-iron lantern lamps, not modern LED poles.
  - Manuc's Inn street front is whitewashed with a deep dark wooden eave and "HANUL MANUC" letters over the arch.
  - Carusel's interior is pure white, multi-level, curving; the street façade is an ordinary 19th-c. palace.
  - Vlad Țepeș bust at Curtea Veche ruins; souvenir stalls selling Dracula magnets.
  - Overhead cables and AC units on façades; uneven building heights (2-5 storeys).

### 3. Stavropoleos, Caru' cu Bere & CEC Palace (south Calea Victoriei) (`stavropoleos-cec`)

*Stavropoleos, Caru' cu Bere și Palatul CEC* - A tiny 1724 Brâncovenesc jewel-church between a Gothic-Revival beer hall, a Beaux-Arts bank and the national history museum.

- **Footprint:** 357 x 278 m around 44.43175, 26.09720. ~360 m E-W x 280 m N-S: Calea Victoriei from the Dâmbovița/Splaiul (S) to Str. Lipscani (N); Str. Stavropoleos and Str. Poștei pedestrian lanes to the east.
- **Biserica Mănăstirii Stavropoleos (1724)** - OSM way/78444014 - dims {"length_m": 17.9, "width_m": 13.8, "height_m_est": 18, "note": "OSM footprint; small single-nave church with a polygonal altar apse and a single tower/dome over the nave"}
- **Caru' cu Bere (Str. Stavropoleos 5)** - OSM node/916075216 - colours: colour_hex #C9B79A
- **Palatul CEC (Calea Victoriei 13)** - OSM way/973712798 - dims {"length_m": 60.5, "width_m": 45.2, "height_m_est": 40, "note": "central glass-and-metal dome + four Renaissance corner domes"} - colours: colour_hex #E2D9C6, dome_hex #4D5C5A
- **Muzeul Național de Istorie a României (former Post Palace), Calea Victoriei 12** - OSM node/12601324233 - colours: colour_hex #D7CDB8
- **Ground:** Str. Stavropoleos & church forecourt: small grey granite setts laid in overlapping fan/arc (segmental) pattern, framed by bands of large light granite slabs (photo: Biserica Stavropoleos B-II-m-A-19464) (#A9A9A6); Calea Victoriei: asphalt, 2 lanes + bike lane, wide sidewalks of grey pavers (#4B4B4D); church courtyard: stone slabs and cobbles, grass strips (#9C9384)
- **Vegetation:** 108 OSM trees in footprint: notably 61 Prunus persica (ornamental) and Fagus, Tilia platyphyllos, Abies alba, Aesculus hippocastanum; courtyard of Stavropoleos has flowers, roses and climbing vines.
- **Furniture:** historic lanterns (cast iron); bollards; benches; waste baskets (10 OSM); flagpoles on CEC and the museum (10 OSM flagpoles); bike racks; a stone cross (OSM man_made=cross)
- **Lighting:** CEC and history museum floodlit warm; Caru' cu Bere glowing interior and lanterns; church courtyard dim.
- **Backdrop:** Calea Victoriei continues north towards Palatul Telefoanelor and Cercul Militar (eclectic 4-6 storey façades); Dâmbovița embankment and Splaiul Independenței traffic to the south; Old Town lanes (Lipscani spot) to the east; National Bank of Romania palace on Str. Lipscani to the north-east.
- **Crowd:** Queue outside Caru' cu Bere at lunch/dinner, tourists photographing Stavropoleos portico, worshippers (lighting candles in the candle house), museum visitors posing with Trajan. (personas: waiter, tour_guide, local_elder, tourist_de, tourist_fr, tourist_us, guard)
- **Sounds:** Byzantine chant from the church (choir founded 1994) on service times; courtyard quiet with birds; restaurant bustle and folk music from Caru' cu Bere; Calea Victoriei traffic
- **Plaques:**
  - Stavropoleos church was built in 1724 by the Greek monk Ioanikie Stratonikeas; the name means "City of the Cross". ([source](https://en.wikipedia.org/wiki/Stavropoleos_Monastery))
  - Its choir sings neo-Byzantine chant, rare in Romania today, and the library holds Romania's largest Byzantine music collection. ([source](https://en.wikipedia.org/wiki/Stavropoleos_Monastery))
  - Caru' cu Bere began as a brewery in 1879; the neo-Gothic beer hall opened in 1899. ([source](https://en.wikipedia.org/wiki/Caru%27_cu_Bere))
  - The CEC Palace foundation stone was laid on 8 June 1897 in the presence of King Carol I; architect Paul Gottereau. ([source](https://ro.wikipedia.org/wiki/Palatul_CEC))
  - The History Museum, in the former Post Palace, holds a full plaster cast of Trajan's Column and the Romanian Crown Jewels. ([source](https://en.wikipedia.org/wiki/National_Museum_of_Romanian_History))
- **Interaction - Trajan's pose:** Strike the same pose as the bronze naked Trajan with the Dacian wolf on the museum steps for a photo challenge; then light a candle in the Stavropoleos candle house (quiet zone: running is slowed to walking in the courtyard).
- **Postcard:** at [44.43192, 26.09862], heading 120 deg, pitch 10, FOV 65. From Str. Stavropoleos at the north-west corner of the church looking south-east at the west porch with its carved stone columns and painted upper walls (OSM: long axis E-W, altar to the east); alt: CEC Palace from the Calea Victoriei crossing at [44.43160,26.09690] heading 320.
- **Season/time:** Easter night: candle processions in the courtyard. Summer: queue at Caru' cu Bere, outdoor tables. Winter: snow on the church eaves, warm light from the beer hall.
- **OSM coverage:** 66 buildings, 418 building parts, 64 paths, 44 areas, 108 trees (106 with species), 1 lamps, 30 furniture, 14 artworks/memorials, 46 named businesses.
- **Refs:** 13 images (7 texture candidates); **dialogue:** 6 personas, 104 lines.
- **What a local would notice if wrong:**
  - Stavropoleos is tiny (18 x 14 m) and hemmed in by taller buildings.
  - Red clay-tile roofs with deep eaves; painted saint medallions in a frieze; carved stone columns.
  - Low stone wall with black iron grilles and urn finials around the church.
  - Setts laid in fan arcs with light slab bands.
  - Caru' cu Bere has a neo-Gothic façade and usually a queue.
  - CEC Palace glass dome + four corner domes; History Museum Doric portico with the naked Trajan statue on its steps.

### 4. Romanian Athenaeum & Piața Revoluției (`athenaeum-revolution`)

*Ateneul Român și Piața Revoluției* - The domed 1888 concert hall in its garden, and the square where the 1989 Revolution toppled Ceaușescu.

- **Footprint:** 397 x 467 m around 44.43990, 26.09700. ~400 m E-W x 470 m N-S along Calea Victoriei from Biserica Kretzulescu (S) to Str. Episcopiei/George Enescu (N); includes Grădina Ateneului, the Royal Palace (National Museum of Art) façade, Central University Library, the former Central Committee building (Ministry of Internal Affairs) with its balcony, and the Memorial of Rebirth.
- **Ateneul Român** - OSM way/16291602 - dims {"height_m": 41, "peristyle_width_m": 48, "hall_diameter_m": 28.5, "hall_height_m": 16, "seats": 794, "osm_obb_m": [67.3, 50.3]} - colours: colour_hex #E3DFD6, columns_hex #ECE9E2, dome_hex #4F5457
- **Grădina Ateneului** - OSM way/23556716
- **Royal Palace / Muzeul Național de Artă al României (Calea Victoriei 49-53)** - OSM way/232472401 - dims {"length_m": 250, "levels": 4, "height_m": 12} - colours: colour_hex #E9E1CD
- **Biblioteca Centrală Universitară "Carol I"** - OSM relation/19896250 - dims {"levels": 3} - colours: colour_hex #E4DAC3
- **Memorialul Renașterii** - OSM node/1393030628 - dims {"height_m": 25, "plaza_m2": 600} - colours: colour_hex #E8E6E1, crown_hex #3C3A36
- **Former Central Committee of the PCR (now Ministry of Internal Affairs)** - colours: colour_hex #D9D0BC
- **Biserica Kretzulescu (1722)** - colours: colour_hex #9B4130, trim_hex #EFE8DA
- **Ground:** Calea Victoriei: asphalt 2-3 lanes, wide granite-paver sidewalks (#4C4C4E); Piața Revoluției plaza: granite slabs (grey/pinkish) around the memorial and statue (#A39C94); Grădina Ateneului: beige gravel paths, lawns (#C9B998)
- **Vegetation:** Athenaeum garden: lawns, low hedges, flower beds, mature linden/chestnut trees; trees along Str. Benjamin Franklin; 42 OSM trees without species tags.
- **Furniture:** benches (12 OSM; 8 backless benches facing each other around the memorial plaza); fountains: a row of 7 jet fountains on the south side of the square; street lamps (6 OSM); I'Velo bike rental (Calea Victoriei 88); bus stop "Piața Revoluției"; gendarme booth at the memorial (guarded 24/7)
- **Lighting:** Athenaeum floodlit warm white with dome uplighting; the museum façade lit; memorial lit from below.
- **Backdrop:** Athénée Palace (Hilton) hotel next to the Athenaeum (west/north), Radisson Blu on Calea Victoriei 63-81, Calea Victoriei eclectic façades; tall Telephone Palace far south.
- **Crowd:** Concert-goers in evening wear before 19:00 concerts (George Enescu Festival every odd year in September), guided "Calea Victoriei - Piața Revoluției" tours (most popular Visit Bucharest tour 2024), students at the library, protesters occasionally. (personas: tour_guide, local_elder, local_young, tourist_fr, tourist_de, tourist_us, guard, busker)
- **Sounds:** Calea Victoriei traffic and trolleybus hum; rehearsal music faintly from the Athenaeum; pigeons; fountain jets; tour guide commentary
- **Plaques:**
  - The Athenaeum was partly funded by public subscription: "Dați un leu pentru Ateneu!" (Give one leu for the Athenaeum!). ([source](https://en.wikipedia.org/wiki/Romanian_Athenaeum))
  - Inside, a 75 x 3 m fresco by Costin Petrescu circles the concert hall, telling Romanian history from Trajan to 1918. ([source](https://en.wikipedia.org/wiki/Romanian_Athenaeum))
  - On 29 December 1919 the Athenaeum hosted the vote ratifying the union of Bessarabia, Transylvania and Bukovina with Romania. ([source](https://en.wikipedia.org/wiki/Romanian_Athenaeum))
  - On 21 December 1989 Ceaușescu's speech from the Central Committee balcony here turned into the revolt that ended his regime. ([source](https://en.wikipedia.org/wiki/Revolution_Square,_Bucharest))
  - The Memorial of Rebirth (2005) is a 25 m marble pillar; locals nicknamed it "the impaled potato". ([source](https://en.wikipedia.org/wiki/Memorial_of_Rebirth))
  - The Carol I statue recreates Ivan Meštrović's 1930 equestrian statue destroyed by the communists in 1948; unveiled in 2010. ([source](https://en.wikipedia.org/wiki/Revolution_Square,_Bucharest))
- **Interaction - Give one leu for the Ateneu:** Drop a virtual 1-leu coin in the donation box by the steps (homage to the 1880s fundraising slogan) to open the doors and peek at the fresco and the concert hall; on the square, stand on the spot below the CC balcony and hear an archival-style crowd ambience.
- **Postcard:** at [44.44098, 26.09752], heading 320 deg, pitch 12, FOV 60. From the south-east corner of Grădina Ateneului near the Eminescu statue looking north-west at the portico and dome (OSM: Athenaeum centroid 44.441321,26.097215).
- **Season/time:** September of odd years: George Enescu Festival crowds and banners. 21-22 December: commemorations, candles at the memorial. Spring: blossoming trees in the garden. Night: illuminated dome is a classic postcard.
- **Copyright:** Memorial of Rebirth (2005) is copyrighted (no FoP in Romania): model from reference, do not ship photos as textures.
- **OSM coverage:** 65 buildings, 428 building parts, 163 paths, 46 areas, 42 trees (0 with species), 6 lamps, 55 furniture, 9 artworks/memorials, 56 named businesses.
- **Refs:** 11 images (6 texture candidates); **dialogue:** 6 personas, 108 lines.
- **What a local would notice if wrong:**
  - The frieze reads "ATHENEUL ROMAN" (with H).
  - Dark grey dome over a white drum with circular lyre medallions.
  - Six fluted Ionic columns, gold mosaic medallions behind them.
  - Cars park in front; steel bollards line the kerb.
  - The Memorial of Rebirth is a white pillar piercing a dark "crown" with red paint at its base.
  - Equestrian Carol I in front of the University Library; the CC balcony on the opposite side.

### 5. Arcul de Triumf (`arcul-de-triumf`)

*Arcul de Triumf* - Bucharest's 27 m triumphal arch for the First World War and the 1918 union, in a busy roundabout on Kiseleff.

- **Footprint:** 294 x 311 m around 44.46719, 26.07812. ~300 m x 300 m centred on the roundabout of Piața Arcul de Triumf (Șos. Kiseleff / Bd. Prezan / Bd. Averescu / Bd. Al. Constantinescu). Walkable: the central island around the arch (reached via signalised crossings), sidewalks and the entrance of King Michael I Park to the north-east. Traffic circulates as ambient (walk-only scene).
- **Arcul de Triumf** - OSM way/217851530 - dims {"height_m": 27, "base_m": [25, 11.5], "opening_h_m": 11, "opening_w_m": 9.5, "osm_obb_m": [24.9, 9.3], "long_axis_bearing_deg": 69.7, "passage_axis_bearing_deg": 160, "note": "single vaulted opening; passage aligned with Șos. Kiseleff (NNW-SSE); internal stairs in the piers lead to a roof terrace"} - colours: colour_hex #D9D6CE, relief_hex #E6E3DC
- **Roundabout central island**
- **Ground:** roundabout carriageway: asphalt, 3-4 circulating lanes, no lane markings in the ring except edge lines (#4A4A4C); island: light granite slabs around the arch, grass beds (#B5B0A6); Kiseleff sidewalks: grey pavers + red/asphalt cycle lanes (OSM cycleway) (#A6A49E)
- **Vegetation:** Island lawns; mature broadleaf trees (linden, plane, chestnut) lining Șos. Kiseleff and the park edge; only 5 trees mapped in OSM (broadleaved).
- **Furniture:** bollards with chains around the island; traffic signals (14 OSM) at crossings; STB bus stops "Arcul de Triumf" with shelters; drinking fountains (2 OSM, seasonal); I'Velo bike docks; pole clock "Herăstrău" near the park entrance; flagpole
- **Lighting:** Arch floodlit at night (warm white), roundabout high-mast street lights; 1 December: tricolour lighting.
- **Backdrop:** Șos. Kiseleff boulevard with villas and embassies, Stadionul Arcul de Triumf (rugby stadium, 2021) to the west, King Michael I Park trees to the north-east, 1930s villas.
- **Crowd:** Light: photographers on the island, joggers and cyclists on Kiseleff, park visitors; massive on 1 December when the National Day military parade passes under the arch. (personas: local_elder, local_young, tourist_de, tourist_it, guard, kid)
- **Sounds:** constant roundabout traffic (rush hour honking); wind; bus brakes at stops; on 1 Dec: military band and jets flypast
- **Plaques:**
  - The arch is 27 m high on a 25 x 11.5 m base; the opening is 11 m high and 9.5 m wide. ([source](https://ro.wikipedia.org/wiki/Arcul_de_Triumf_din_Bucure%C8%99ti))
  - First built in 1922 for the coronation of Ferdinand and Maria with plaster reliefs; rebuilt in granite in 1935-1936. ([source](https://ro.wikipedia.org/wiki/Arcul_de_Triumf_din_Bucure%C8%99ti))
  - Designed by Petre Antonescu; sculptors included Ion Jalea, Constantin Baraschi, Mac Constantinescu and Dimitrie Paciurea. ([source](https://ro.wikipedia.org/wiki/Arcul_de_Triumf_din_Bucure%C8%99ti))
  - The communists removed the King's and Queen's effigies; bronze medallions of Ferdinand and Maria were put back after 1989. ([source](https://ro.wikipedia.org/wiki/Arcul_de_Triumf_din_Bucure%C8%99ti))
  - Earlier temporary arches stood in Bucharest in 1848, 1859, 1878, 1906 and 1918. ([source](https://ro.wikipedia.org/wiki/Arcul_de_Triumf_din_Bucure%C8%99ti))
- **Interaction - Read the arch:** Walk around the four faces: each inscription you stand in front of is read aloud/shown translated; collecting all four plus the 12 battle names in the vault unlocks the terrace (open Apr-Oct Tu-Fr 10-18, Sa-Su 11-19; Nov-Mar Tu-Su 9-17 per OSM) for a view down Kiseleff. On 1 December the parade passes through.
- **Postcard:** at [44.46645, 26.07845], heading 340 deg, pitch 8, FOV 60. From the south side of the roundabout on the Kiseleff axis, ~90 m south of the arch, looking NNW through the opening at the south face with Ferdinand & Maria medallions.
- **Season/time:** 1 December: parade, tribunes, flags. Autumn: golden linden/plane leaves on Kiseleff. Night: floodlit arch with light trails of cars (long-exposure photo opportunity).
- **OSM coverage:** 21 buildings, 61 building parts, 76 paths, 18 areas, 5 trees (0 with species), 0 lamps, 75 furniture, 1 artworks/memorials, 5 named businesses.
- **Refs:** 7 images (0 texture candidates); **dialogue:** 6 personas, 106 lines.
- **What a local would notice if wrong:**
  - It stands in the middle of a busy roundabout; you reach it via signalised crossings.
  - Light granite with long carved inscriptions on all four attic faces.
  - Bronze medallions of Ferdinand and Maria on the south face.
  - Kiseleff is lined with tall mature trees and double white centre lines.
  - Terrace on top is open to visitors (seasonal hours).

### 6. Dimitrie Gusti National Village Museum (`village-museum`)

*Muzeul Național al Satului „Dimitrie Gusti”* - A whole Romanian village of real wooden houses, churches and mills moved to the shore of Lake Herăstrău in 1936.

- **Footprint:** 357 x 423 m around 44.47190, 26.07720. ~360 m E-W x 420 m N-S: the southern half of the museum from the main entrance on Șos. Kiseleff 28-30 (Bd. Regele Mihai I) towards the lake, covering the Oltenia/Muntenia/Transylvania/Maramureș sectors around the entrance. Fenced museum (ticketed). The museum overall is 778 x 264 m (OSM way/29701978, 10 ha).
- **Main entrance & ticket office (Kiseleff 28-30)**
- **Wooden church from Dragomirești, Maramureș (1718-1722)** - OSM way/277782593 (building=church, material=wood, 15.8 x 6.6 m, long axis ~87 deg E-W; graveyard crosses OSM nodes 13004324741.. just south) - identified as Dragomirești by being the only wooden church in this sector; verify against refs - colours: wood_hex #4E3A2A, shingle_sunlit_hex #A89A7E, shingle_hex #7A6A52, shingle_shadow_hex #3E3428, weathered_hex #7D7468, plinth_stone_hex #9A9284
- **Gospodăria din Ieud, Maramureș** - OSM way/277782449
- **Peasant households (selection in footprint, OSM-named)**
- **Palatul Elisabeta (backdrop, inaccessible)** - OSM way/102780052
- **Ground:** alleys: compacted earth/gravel paths and some asphalt/stone footways (OSM footway), grass everywhere (#A08E70); lawns: uneven meadow grass with wildflowers (#6F8A48)
- **Vegetation:** Old parkland: oaks, lindens, walnuts, fruit trees (plums, apples) in households, willows towards the lake, lilac and hollyhocks by houses; few trees mapped in OSM (1) - model as dense deciduous canopy along alleys with sunny clearings around houses.
- **Furniture:** wooden benches; wayside crosses (OSM: 8 man_made=cross); wells with sweep; wattle fences and plank fences; information panels (bilingual RO/EN) for each household; fire hydrants (4 OSM, red); 14 OSM artworks (busts of EU founders lie just outside to the east)
- **Lighting:** Daytime venue (OSM opening_hours Mo 09-17, Tu-Su 09-19); minimal path lamps. Model dusk at closing.
- **Backdrop:** Lake Herăstrău glimpses to the north/east, Bd. Regele Mihai I (Kiseleff) traffic beyond the fence to the west, Ministry of Culture building at the entrance.
- **Crowd:** Families, school groups, foreign tourists (68% foreign in 2017), artisans at weekend fairs (pottery, carved spoons, painted eggs at Easter), costumed folk dancers at festivals. (personas: local_parent, kid, tourist_de, tourist_us, tourist_it, tour_guide, vendor(craftsman), guard(museum attendant))
- **Sounds:** birdsong, crows; wind in trees; creaking wooden gates; well chain; distant traffic on Kiseleff; toaca (wooden semantron) beating at the church on feast days; folk music at fairs
- **Plaques:**
  - Opened on 10 May 1936 by sociologist Dimitrie Gusti in the presence of King Carol II; the 4th open-air museum in Europe. ([source](https://en.wikipedia.org/wiki/Dimitrie_Gusti_National_Village_Museum))
  - Over 100,000 m² with 123 authentic peasant households, 363 monuments and over 50,000 objects from all regions of Romania. ([source](https://en.wikipedia.org/wiki/Dimitrie_Gusti_National_Village_Museum))
  - The first buildings were dismantled in their villages and brought to Bucharest in 56 railway wagons. ([source](https://ro.wikipedia.org/wiki/Muzeul_Na%C8%9Bional_al_Satului_%E2%80%9EDimitrie_Gusti%E2%80%9D))
  - The wooden church from Dragomirești (Maramureș), built 1718-1722, is the museum's centrepiece and logo. ([source](https://en.wikipedia.org/wiki/Dimitrie_Gusti_National_Village_Museum))
  - A fire on 20 February 2002 destroyed 19 structures, including houses from Voitinel, Straja and Fundu Moldovei. ([source](https://ro.wikipedia.org/wiki/Muzeul_Na%C8%9Bional_al_Satului_%E2%80%9EDimitrie_Gusti%E2%80%9D))
  - In 2017 the museum had about 800,000 visitors, 68% of them foreigners. ([source](https://ro.wikipedia.org/wiki/Muzeul_Na%C8%9Bional_al_Satului_%E2%80%9EDimitrie_Gusti%E2%80%9D))
- **Interaction - Draw water from the well:** Use a well sweep (cumpănă) to lift a bucket, then walk the alley to the Dragomirești church and strike the toaca (wooden semantron) rhythm on feast days; collect a stamp from 5 regional households (Maramureș, Transylvania, Oltenia, Muntenia, Moldova) for the "village passport".
- **Postcard:** at [44.47118, 26.07858], heading 45 deg, pitch 18, FOV 55. From the lawn ~40 m south-west of the wooden church (OSM way/277782593 at 44.47145,26.07900) looking NE up at the west tower spire with the graveyard crosses in the foreground.
- **Season/time:** Spring (Easter): painted-egg fairs. Summer: festivals, folk dances, long evenings. Autumn: Târgul Meșterilor Populari craft fairs, falling leaves on shingle roofs. Winter: snow on steep roofs - most photogenic; Christmas carol (colinde) events.
- **OSM coverage:** 67 buildings, 0 building parts, 73 paths, 12 areas, 1 trees (0 with species), 0 lamps, 20 furniture, 23 artworks/memorials, 3 named businesses.
- **Refs:** 11 images (9 texture candidates); **dialogue:** 6 personas, 94 lines.
- **What a local would notice if wrong:**
  - Houses stand in small fenced yards on grass, not on paved streets.
  - The Dragomirești church has a needle spire and shingle-everything; a tall spruce next to it.
  - Roofs are steep: shingle (north) or reed/straw (south); walls whitewashed in Oltenia/Muntenia.
  - Wells with sweep poles, wayside crosses, wattle fences.
  - Dirt/gravel alleys under big old trees; the lake glimpsed beyond.

### 7. King Michael I (Herăstrău) Park: Alley of Personalities, Japanese Garden & south lakeshore (`herastrau-park`)

*Parcul Regele Mihai I (Herăstrău)* - Bucharest's biggest park: an alley of 30 stone busts of world writers and composers, a Japanese garden and the tip of Lake Herăstrău.

- **Footprint:** 397 x 411 m around 44.47030, 26.08250. ~400 m E-W x 410 m N-S in the south-west of the park between Piața Charles de Gaulle entrance (SE) and the Arc/Village Museum edge (W), up to the southern tip of the lake (N, shore at ~44.4713,26.0803). Park total 187 ha incl. 74 ha lake.
- **Alley of busts (Aleea Personalităților / Aleea Michael Jackson area)**
- **Statues**
- **Michael Jackson memorial plaque** - OSM node/2382565617
- **Grădina Japoneză** - OSM way/28342074 - dims {"area_m2": 10749}
- **Lake Herăstrău south tip**
- **Ground:** alleys: asphalt (OSM surface=asphalt), some paving_stones (#5A5A5C); lawns: mown grass (#6C8C45); japanese garden: gravel + stepping stones (#BDB5A6)
- **Vegetation:** Mature parkland: lindens, horse chestnuts, oaks, plane trees, poplars and willows on the shore; ornamental cherries and Japanese maples in the Japanese Garden; rose beds. Few trees mapped in OSM here - use dense deciduous canopy over alleys.
- **Furniture:** green/wooden slatted benches with cast-iron legs; tall park lamps (single lantern); small yellow waste bins on posts and black metal bins along the alleys (photo: Aleea artiștilor, winter); white signboards for exhibition pavilions ("PAVILION EXPOZIȚIONAL B") on black posts; drinking water taps (2 OSM); toilets (4 OSM); playgrounds (3 OSM) incl. minigolf and pony rides; bike rental (I'Velo, Charles de Gaulle entrance); summer library kiosk (Biblioteca de vară)
- **Lighting:** Park lamps along alleys; lake reflects the city; Japanese garden dark at night.
- **Backdrop:** Lake with tree-lined far shore and high-rise towers of Floreasca/Barbu Văcărescu beyond; Charles de Gaulle square with the General's bronze statue (SE).
- **Crowd:** Joggers, cyclists, rollerbladers, families with strollers, retirees on benches, couples, picnickers, dog walkers; weekends very busy; Park was the most-searched park by foreign tourists (Visit Bucharest 2022). (personas: local_parent, kid, local_elder, local_young, tourist_it, tourist_uk, vendor(ice cream / corn), busker)
- **Sounds:** birdsong, ducks quacking; bike bells and rollerblade wheels; kids playing; boat motor of the lake tour; distant Kiseleff traffic
- **Plaques:**
  - The park covers about 187 ha, of which 74 ha is Lake Herăstrău. ([source](https://en.wikipedia.org/wiki/King_Michael_I_Park))
  - The marshes were drained in 1930-1935 and the park opened in 1936 as the National Park. ([source](https://en.wikipedia.org/wiki/King_Michael_I_Park))
  - It was named Carol II Park, then I. V. Stalin Park (with a Stalin statue), Herăstrău in 1956 and King Michael I Park in 2017. ([source](https://en.wikipedia.org/wiki/King_Michael_I_Park))
  - "Herăstrău" comes from "ferăstrău" (saw): water-powered sawmills once stood on the Colentina river. ([source](https://en.wikipedia.org/wiki/King_Michael_I_Park))
  - Mammoth bones and Neanderthal-era flint tools were found in the Herăstrău sand quarry. ([source](https://en.wikipedia.org/wiki/King_Michael_I_Park))
- **Interaction - Sakura & busts quiz:** Find 5 busts named by a riddle ("the man who wrote Hamlet", "the composer who went deaf"...), then stand on the Japanese-garden bridge for the cherry-blossom photo (petals fall in April). Feed the ducks at the lake tip (they gather around you).
- **Postcard:** at [44.47025, 26.083], heading 0 deg, pitch 5, FOV 65. From the busts alley looking north towards the Sleeping Nymph and the lake; alt: Japanese garden bridge (inside way/28342074) in April.
- **Season/time:** Winter: snow-laden alleys under bare trees, busts capped with snow (photo Aleea artiștilor). April: sakura bloom in the Japanese garden. Summer: boats, ice cream, crowded lawns, outdoor events. Autumn: golden canopy, leaf-blowers. Winter: frozen lake edges, bare trees.
- **OSM coverage:** 19 buildings, 0 building parts, 78 paths, 16 areas, 0 trees (0 with species), 0 lamps, 12 furniture, 20 artworks/memorials, 2 named businesses.
- **Refs:** 7 images (1 texture candidates); **dialogue:** 6 personas, 115 lines.
- **What a local would notice if wrong:**
  - Dozens of stone busts on plinths along asphalt alleys.
  - Joggers, cyclists and rollerbladers dominate; benches full of retirees.
  - The Japanese garden has a red-ish arched bridge, stone lanterns, cherries.
  - Lake shore with railings, ducks, pedal boats and tour boats.

### 8. Spring Palace (Ceaușescu Mansion) (`spring-palace`)

*Palatul Primăverii* - The private home of Nicolae and Elena Ceaușescu for 24 years: gold-plated taps, a mosaic swimming pool and peacocks in the garden.

- **Footprint:** 278 x 278 m around 44.46886, 26.09219. ~280 x 280 m in the villa district of Primăverii: Bd. Primăverii 50 with the mansion, its walled garden (original plot 14,830 m²) and the quiet embassy-lined boulevards around it (Lithuanian and South Korean embassies, UN House). Interior is ticketed (guided tours).
- **Palatul Primăverii (Bd. Primăverii 50)** - OSM way/549676146 (likely main building, 53.5 x 42.3 m, by size; annex way/549676153 32 x 30.7 m probably the pool wing; museum grounds way/38236017) - verify against refs - dims {"levels": 2, "rooms": 174, "rooms_visited": 50, "plot_m2": 14830} - colours: colour_hex #DAD5C8, trim_hex #ECE8DE, frames_hex #8A4E2A, roof_hex #A0503A
- **Garden**
- **Bulevardul Primăverii**
- **Ground:** Bd. Primăverii: asphalt with planted median (#4B4B4D); sidewalks: grey pavers (#A7A49D); garden paths: stone slabs/gravel (#B9B2A3)
- **Vegetation:** Mature lindens, plane trees, pines and spruces in villa gardens; clipped hedges and fences with ivy along the boulevard; rose beds in the palace garden.
- **Furniture:** high fences and guard booths at embassies; entrance gate with ticket booth; benches in garden; old-style lamps
- **Lighting:** Residential street lamps; palace interior chandeliers glow in winter dusk.
- **Backdrop:** Low 2-4 storey 1930s-1960s villas, 7-storey residential blocks on Str. Cehov to the west.
- **Crowd:** Small guided groups (Romanian or English tours), communism-tour buses; quiet neighbourhood with diplomats, drivers, dog-walkers. Ceaușescu House was the most-searched museum by foreign tourists in 2022 and 2024 (Visit Bucharest). (personas: tour_guide, tourist_uk, tourist_de, tourist_us, local_elder, guard)
- **Sounds:** quiet: birds, peacock calls from the garden, footsteps on gravel, occasional car; guide commentary
- **Plaques:**
  - The Ceaușescus lived here for 24 years; the house has 174 rooms, about 50 of which can be visited. ([source](https://www.antena3.ro/actualitate/casa-lui-ceausescu-palatul-primaverii-nicolae-ceausescu-593158.html))
  - Built in 1964-1965; it opened to the public for the first time in March 2016. ([source](https://www.romania-insider.com/primaverii-palace-romanian-dictators-residence-communist-bucharest))
  - Highlights: a bathroom with gold-plated fittings and an indoor pool decorated with a huge 1960s mosaic. ([source](https://atlasobscura.com/places/house-of-ceausescu-romania))
  - Peacocks still walk the garden, descendants of the birds the Ceaușescus kept. ([source](https://www.antena3.ro/actualitate/casa-lui-ceausescu-palatul-primaverii-nicolae-ceausescu-593158.html))
- **Interaction - Peacock portrait:** Photograph a peacock with its tail fanned (they display at random; wait quietly nearby) and find the golden tap in the bathroom (interior vignette).
- **Postcard:** at [44.4687, 26.09195], heading 320 deg, pitch 8, FOV 60. From the garden lawn looking at the garden façade with the pool wing (verify building orientation against refs).
- **Season/time:** Spring/summer: peacocks display, roses. Winter: snow on the flat roofs; chandeliers visible inside.
- **OSM coverage:** 50 buildings, 0 building parts, 30 paths, 1 areas, 0 trees (0 with species), 0 lamps, 4 furniture, 0 artworks/memorials, 2 named businesses.
- **Refs:** 7 images (0 texture candidates); **dialogue:** 5 personas, 86 lines.
- **What a local would notice if wrong:**
  - A quiet villa street with high fences and embassies, not a grand square.
  - Granite plinth wall + black ornate wrought-iron fence along the boulevard.
  - Cream stucco villa with arched ground-floor windows and a balustraded terrace.
  - Peacocks in the garden.

### Fidelity review 2026-11-12: Arcul de Triumf, Herăstrău / Village Museum, Spring Palace (spots 5-8)

Live OSM (API 0.6 map call, bbox 44.4625,26.0715 - 44.4770,26.0980, 2026-11-12) against the three scene data files, and
Street View / photospheres as a look reference only (no imagery kept). Coverage inside the spot extents + 150 m:

| Scene | businesses | bridges / tunnels / covered | water | sports | tourist features |
| --- | --- | --- | --- | --- | --- |
| `arcul-de-triumf` | 18 mapped, 18 in the data | 2 / 2 (arch roof `w1191615181`, passage `w1191738378`) | 0 | 9 / 9 | 10 / 10 |
| `buc-herastrau` | 32 / 32 | 12 / 12 (4 footbridges + 2 stair bridges, 2 covered walks) | 6 / 6 fountains + lake `r1130828` | 45 of 46 | 71 of 73 |
| `spring-palace` | 16 of 17 | 1 / 1 | 1 / 1 | 2 of 3 | 3 / 3 |

Not in the data (needs a data rebuild, the builder drops these classes): playground nodes `n2791579390` (44.47012, 26.08067)
and `n6401707601` (44.47133, 26.09117); viewpoints `n2791530781` (44.47263, 26.08081) and `n2791530802` (44.47358, 26.07944)
on Insula Trandafirilor; the Kuwait embassy grounds `w781162166` (44.46929, 26.09302, next to the Spring Palace; the data only
has the older node `n5470974719` 350 m west). Two fence ways (`w29701978_b`, `w229442741_b`, `w1057184934_b`) are builder
artefacts of mapped `barrier=fence` areas, not stale objects.

What the review established (Street View panoramas at 44.46641,26.07847 and 44.46790,26.07779 on Kiseleff, 44.46881,26.09142
on Bd. Primăverii; photospheres inside the Village Museum, positions unreliable):

- **No shopfronts in these three scenes.** The shared building pass gave every `building=yes` taller than 7 m a ground-floor
  shop (coloured fascia, display windows). Around the arch, in the park and on Bd. Primăverii these are villas, embassies,
  museum and park buildings behind walls and trees. The three scenes now build with `urban: false`; the mapped, named
  businesses / embassies / museums get a plain name board on the façade facing the nearest mapped way
  (`scenes/buc-green.js` `businessSigns`; board colours are procedural, the names are the OSM names).
- **Canopy.** Both sides of Kiseleff at the arch, the whole of Herăstrău park and the villa gardens are closed mature
  woodland; OSM maps the park polygons but almost no trees. The scenes fill the mapped `leisure=park|garden`,
  `landuse=forest`, `natural=wood` polygons (and, at a lower density, the garden land between mapped buildings) with an
  estimated scatter that stays clear of every mapped way, building, pitch, stadium, playground, fountain, statue and the
  lake. Counts and positions are estimates, not surveyed trees. One even tree budget per scene replaces the loader's
  nearest-first cap, which left a hard-edged wood round the extents and bare lawns beyond.
- **Arcul de Triumf approaches.** The splitter islands and the strips between the carriageways of the four approaches are
  open (signals, paving, low grass). Generated street trees there hid the arch from the classic Kiseleff views; they are
  removed (trees between two mapped one-way carriageways, on mapped `area_highway=traffic_island`, or ringed by carriageway).
  The five mapped trees on the east side stay. Street lamps are dark double-arm columns in reality; the game keeps the
  single cobra head (colour corrected only).
- **Herăstrău.** The Charles de Gaulle bronze (`n530686317`, 44.46697, 26.08570, Mircea Corneliu Spătaru) was cut off by a
  scene limit and is now present at the south-east entrance. Mapped `artwork_type=statue` objects are standing figures or,
  for the three animal bronzes (Curcan, Căprioară, Gâscanul), small animal forms, no longer generic busts; bust / statue
  material follows the OSM `material` tag and each faces the nearest mapped path. The sculptures themselves are not
  reproduced (no freedom of panorama): size class and material only. Casa Presei Libere (`r15922160`) stands at its real
  position 1.3 km north-west as a view-only landmark; in the default summer haze it is faint from the south shore.
- **Village Museum windmills.** Not mapped in OSM and without a position in this dossier: the three windmills that were
  placed at random are removed. Open item: map / source the Dobrogea windmills, then model them at their positions.
- **Spring Palace.** From the boulevard the residence is screened by the trees right behind its wall; the grounds polygon
  `w38236017` (4 nodes) is much smaller than the real 14,830 m² plot, so the belt is thin. Bd. Primăverii has a planted
  grass median (kept). The random far "city filler" blocks are removed: north and east of the extract are Lake Floreasca
  and the park.

Still different from reality (not fixed in this pass): the UN House (white modernist block with rounded balconies) and the
villas are generic façades; property walls / gate posts along Kiseleff and Bd. Primăverii are not modelled outside the
palace; the Japanese garden's pond and bridge sit at the polygon centroid (OSM maps no water there); the lake shore has
no paved promenade edge; the museum's own houses are generic regional types on the real footprints; the arch's inscription
texts in the scene (`INSCRIPTIONS`) and on the landmark model were not checked against a primary source.

### 9. Cișmigiu Gardens (`cismigiu`)

*Grădina Cișmigiu* - Bucharest's oldest public garden (1847-1854): rowing boats on a winding lake, chess players and the Writers' Rotunda.

- **Footprint:** 437 x 411 m around 44.43723, 26.09061. ~440 m x 410 m covering the central lake (410 x 140 m, 19,500 m²), the Rotonda Scriitorilor, the chess tables ("La Șahiști"), the French Heroes monument and the main entrances on Bd. Regina Elisabeta (N) and Bd. Schitu Măgureanu (W). Park total ~16 ha, English landscape style.
- **Lacul Cișmigiu** - OSM way/16292044 - dims {"length_m": 410, "width_m": 140, "area_m2": 19500, "depth_m_est": 1.5}
- **Rotonda Scriitorilor (1943)** - OSM node/473428600
- **"La Șahiști" chess corner** - OSM node/473428599 + 3 concrete chess tables node/10877390595..97
- **Monumentul Eroilor Francezi** - OSM node/473428601
- **Izvorul Sissi Stefanidi** - OSM node/2315300547
- **Lakeside restaurant pavilion (historic "Monte Carlo")**
- **Ground:** alleys: asphalt and beige gravel, some stone pavers (#6A6A6A); lawns: grass, flower beds (#6E8F47)
- **Vegetation:** Dense mature trees: weeping willows over the lake, plane trees, horse chestnuts, lindens, oaks, ginkgo, poplars; flower beds; 88 OSM area polygons (lawns/beds); hedges.
- **Furniture:** long rows of wooden slatted benches with backs (39 OSM; many in pairs along the lake); metal waste baskets; concrete chess tables; park lamps; info boards (5 OSM); 4-faced pole clock "Cișmigiu" at the Regina Elisabeta entrance (node/10864971740); toilets, drinking tap; kiosks (popcorn, ice cream)
- **Lighting:** Park lamps reflected in the lake; winter rink lights and music.
- **Backdrop:** Bd. Regina Elisabeta façades (Hotel Cișmigiu, 7 storeys, #D1D1C9 per OSM), Bucharest City Hall nearby, Colegiul Gheorghe Lazăr (SE), interwar blocks on Schitu Măgureanu.
- **Crowd:** Students from nearby lyceums and the university, retirees on benches, chess players, couples rowing, families feeding ducks; winter skaters. (personas: local_elder, local_young, local_parent, kid, tourist_fr, tourist_it, vendor(popcorn/corn), busker)
- **Sounds:** oars splashing, ducks and swans; pigeons; chess clocks and banter; children; muffled boulevard traffic; winter: rink music and skate blades
- **Plaques:**
  - Cișmigiu is the oldest public garden in Bucharest, laid out from 1847 by Wilhelm Mayer, former director of the Imperial Gardens in Vienna; opened in 1854. ([source](https://ro.wikipedia.org/wiki/Parcul_Ci%C8%99migiu))
  - The name comes from "cișmegiu", the official who looked after the city's public fountains (Turkish çeşme = fountain). ([source](https://ro.wikipedia.org/wiki/Parcul_Ci%C8%99migiu))
  - In the winter of 1883 the frozen lake hosted ice-skating competitions; skating is still a winter tradition here. ([source](https://ro.wikipedia.org/wiki/Parcul_Ci%C8%99migiu))
  - The Writers' Rotunda (1943) gathers the busts of 12 great Romanian writers, from Eminescu to Creangă. ([source](https://ro.wikipedia.org/wiki/Parcul_Ci%C8%99migiu))
  - Swans and pelicans were brought to the lake after the park was enlarged in the 1880s. ([source](https://ro.wikipedia.org/wiki/Parcul_Ci%C8%99migiu))
- **Interaction - Row or skate:** Summer: rent a rowing boat at the Debarcader and row around the island; winter: skate on the rink. Any season: watch a game at "La Șahiști" - the old men comment on your moves if you try one.
- **Postcard:** at [44.4372, 26.0908], heading 320 deg, pitch 5, FOV 70. From the lake bridge/shore near the centre looking NW along the lake with rowing boats and willows; alt: Rotonda Scriitorilor.
- **Season/time:** Summer: boats, shade, ice cream. Autumn: famous golden foliage reflected in the lake. Winter: ice rink (OSM seasonal=winter), snow on willows. Spring: tulips and blossoming chestnuts.
- **OSM coverage:** 47 buildings, 0 building parts, 203 paths, 93 areas, 3 trees (0 with species), 1 lamps, 52 furniture, 22 artworks/memorials, 10 named businesses.
- **Refs:** 10 images (1 texture candidates); **dialogue:** 6 personas, 108 lines.
- **What a local would notice if wrong:**
  - Winding lake with rowing boats (summer) and an ice rink (winter).
  - Weeping willows over the water; dense old trees.
  - Old men playing chess at concrete tables ("La Șahiști").
  - Circular Writers' Rotunda with 12 white marble busts.
  - Wooden benches with backs everywhere along the alleys.

### 10. People's Salvation Cathedral (National Cathedral) (`peoples-salvation-cathedral`)

*Catedrala Mântuirii Neamului (Catedrala Națională)* - The tallest and largest Orthodox church in the world (127 m), with a gilded dome rising behind the Palace of the Parliament.

- **Footprint:** 397 x 423 m around 44.42591, 26.08240. ~400 m x 420 m on Dealul Arsenalului: the cathedral (121 x 71 m footprint), its 11,600 m² piazza, the underground-chapel entrances and Calea 13 Septembrie with its 9-11 storey 1980s blocks to the south as backdrop; the Palace of the Parliament south façade bounds the north-east view.
- **Catedrala Națională** - OSM way/232332568 - dims {"length_m": 120.7, "width_m": 70.9, "height_m": 127, "height_to_cross_m": 133, "dome_exterior_m": 120.3, "bell_tower_m": 86, "nave_interior_height_m": 44, "osm_long_axis_bearing_deg": 95} - colours: colour_hex #E9E6DE, dome_hex #C7A55E, dome_shadow_hex #8A6F38
- **Piazza (esplanade)** - OSM relation/16698908 (highway=pedestrian area 13,270 m² around the church) - dims {"area_m2": 11600, "capacity": 23000}
- **Paraclisul Catedralei (temporary wooden chapel/annex)** - OSM way/224624283
- **Ground:** piazza: granite slabs (#C8C2B6); Calea 13 Septembrie: asphalt 2+2 lanes (#4B4B4D); green slopes: lawn with linden/chestnut rows (#6F8C49)
- **Vegetation:** 174 OSM trees: rows of Tilia cordata (81) and Aesculus hippocastanum (78) along Calea 13 Septembrie and the slopes; Fraxinus americana, Quercus robur, Rhus typhina.
- **Furniture:** candle-lighting stands (lumânărar) in a separate pavilion; benches; tall lamps; barriers and fences (construction finishing works); bus stop "Palatul Parlamentului" (route 136) on Calea 13 Septembrie
- **Lighting:** Dome and towers floodlit golden at night, visible across the city.
- **Backdrop:** North: Palace of the Parliament south façade (Calea 13 Septembrie entrance); south: 9-11 storey 1980s apartment blocks (Bl. 53-91) with ground-floor shops (Mega Image, Help Net pharmacy).
- **Crowd:** Pilgrims and worshippers, especially on Sundays, feast days (Ascension = Heroes' Day, St Andrew 30 Nov) and since the 2025 consecration; tourists coming from the Palace; priests and nuns; candle and icon stalls. (personas: local_elder, local_parent, tour_guide, tourist_bg, tourist_us, guard(church staff))
- **Sounds:** bells (deep 25 t bell) at service times; Byzantine chant from loudspeakers on feast days; wind on the hilltop; traffic on Calea 13 Septembrie
- **Plaques:**
  - At 127 m (133 m to the top of the cross) it is the tallest and largest Orthodox church building in the world. ([source](https://en.wikipedia.org/wiki/People%27s_Salvation_Cathedral))
  - It holds the world's largest collection of church mosaics, about 25,000 m², made with Venetian Murano glass. ([source](https://en.wikipedia.org/wiki/People%27s_Salvation_Cathedral))
  - The main bell weighs 25.19 t, was cast in Innsbruck in 2016 and can be heard 15-20 km away. ([source](https://en.wikipedia.org/wiki/People%27s_Salvation_Cathedral))
  - The altar was consecrated on 25 November 2018; the mosaics on 26 October 2025, when the cathedral opened permanently. ([source](https://en.wikipedia.org/wiki/People%27s_Salvation_Cathedral))
  - The 11,600 m² piazza can hold over 23,000 people; the whole 11-hectare complex 125,000. ([source](https://en.wikipedia.org/wiki/People%27s_Salvation_Cathedral))
- **Interaction - Light a candle & ring time:** Light a candle at the candle pavilion (for the living on one side, the departed on the other - a real Orthodox custom), then stand on the piazza at noon to hear the great bell. Quiet zone: no running on the piazza steps during services.
- **Postcard:** at [44.42555, 26.08102], heading 70 deg, pitch 16, FOV 70. From the south-west corner of the piazza (OSM pedestrian area relation/16698908, 13,270 m² wrapping the church) looking ENE at the west front: bell tower (86 m) over the main portal with the Ascension stained-glass window, gilded central dome behind. Calea 13 Septembrie runs ~130 m south; Parcul Catedralei (under construction) lies north towards the Palace.
- **Season/time:** 30 November (St Andrew) and Ascension: huge pilgrim crowds. Easter night: candle-lit Resurrection service on the piazza. Night: gilded dome glowing. Summer: heat on the open stone piazza.
- **Copyright:** Recent copyrighted architecture (no freedom of panorama in Romania): reference only.
- **OSM coverage:** 23 buildings, 27 building parts, 81 paths, 48 areas, 174 trees (172 with species), 0 lamps, 3 furniture, 0 artworks/memorials, 5 named businesses.
- **Refs:** 6 images (0 texture candidates); **dialogue:** 6 personas, 100 lines.
- **What a local would notice if wrong:**
  - White stone with many gilded ribbed domes (not one) - central dome is huge and gold.
  - Bell tower at the west front over the main portal.
  - Wide open stone piazza; 9-11 storey 1980s blocks along Calea 13 Septembrie behind.
  - The Palace of the Parliament is right next to it (north).

## 3. Dialogue & culture

Persona library (`dialogue_general.persona_library`): local_elder, local_young, local_parent, tourist_uk, tourist_us, tourist_de, tourist_it, tourist_fr, tourist_bg, waiter, vendor, tour_guide, busker, guard, kid. Each spot persona = base lines (greeting/bumped/photographed/idle) + spot lines; general driving-district pedestrian set in `dialogue_general.pedestrian_general` (honked_at, near_miss, sidewalk_parking, idle, small_talk).

- **Greetings & register:** "Bună ziua" (good day) is the safe greeting with strangers; "Salut"/"Hey" among young people. Use "dumneavoastră" (formal you) with older people; elderly men may still say "Sărut mâna" (I kiss your hand) to women as an old-fashioned courtesy. Thank you = "Mulțumesc" or the very common French loan "Mersi". ([source](https://en.wikivoyage.org/wiki/Romanian_phrasebook))
- **Time-of-day greetings:** Bună dimineața (morning), Bună ziua (day), Bună seara (evening); Noapte bună only when parting at night. Pick by the scene clock. ([source](https://en.wikivoyage.org/wiki/Romania#Respect))
- **Language mix:** Romanian is a Romance language; young educated people usually speak good English, older educated people often French/Italian/Spanish. Italians/Spanish tourists often half-understand Romanian signs. So bubbles: Romanian for locals with English translation; tourists speak their own language. ([source](https://en.wikivoyage.org/wiki/Bucharest#Talk))
- **Tourist origins:** Foreign visitors to Bucharest searching online in 2024 came mostly from UK, US, Germany, Bulgaria, Italy, Greece, Israel, Netherlands and France; British searched for Therme, Americans for "Wednesday" filming locations and Romanian food, Bulgarians for Christmas markets/concerts. Use these origins for tourist personas. ([source](https://visitbucharest.today/study-what-information-did-foreign-tourists-search-for-online-about-bucharest-in-2024/))
- **Pedestrians & traffic humour:** Never assume a car will stop at a crosswalk; drivers can be inconsiderate. Locals joke and grumble about traffic, honking, sidewalk parking and buses; keep it good-humoured, never aggressive. ([source](https://en.wikivoyage.org/wiki/Bucharest#Stay_safe))
- **Food small talk:** Typical words: mici/mititei (grilled minced-meat rolls), ciorbă de burtă (tripe soup), sarmale (cabbage rolls), papanași (doughnuts with sour cream and jam), covrigi (pretzels sold from street windows). Caru' cu Bere, Berăria H and Hanu' lui Manuc were the most-searched restaurants by foreign tourists in 2024. ([source](https://visitbucharest.today/study-what-information-did-foreign-tourists-search-for-online-about-bucharest-in-2024/))
- **Churches & monasteries:** Orthodox churches (Stavropoleos, Patriarchal/National Cathedral): people cross themselves when passing, speak quietly, women often cover their heads, shoulders/knees covered; avoid flash and ask before photographing services. Nuns/priests are greeted with "Bună ziua" or "Doamne-ajută" (God help); do not script jokes about clergy. (general Orthodox etiquette (no single source fetched from this environment - verify with church staff signage))
- **Hospitality & insisting:** Romanians are hospitable and insist when offering something ("no" is often treated as politeness and the offer repeated) - vendors/elders can repeat an offer once before accepting a refusal. Respect for the elderly is valued; older men may kiss a lady's hand; handshakes are standard. ([source](https://en.wikivoyage.org/wiki/Romania#Respect))
- **Dracula & Ceaușescu sensitivities:** Vlad the Impaler is seen by many Romanians as a national hero; some are offended when he is equated with Count Dracula - so locals in bubbles push back ("Vlad Țepeș was one of ours, not a vampire!"). Opinions on Ceaușescu vary; some older people speak of him positively - an elder persona may be nostalgic, others critical; never caricature either. ([source](https://en.wikivoyage.org/wiki/Romania#Respect))
- **Language pride:** Avoid lines implying Romanian is Slavic or that Romania was part of the USSR; never confuse Romanians with Roma people. ([source](https://en.wikivoyage.org/wiki/Romania#Respect))
- **Taxis & touts:** Unsolicited offers of help/taxis near tourist areas can be scams; locals recommend Bolt/Uber. A vendor/tout persona may push magnets or taxis politely; the player can just walk away. ([source](https://en.wikivoyage.org/wiki/Bucharest#Stay_safe))
- **Politics & sensitive history:** Communism and Ceaușescu are top tourist interests ("Communism and communist buildings remain at the top of searches"). Locals talk about it with dark irony (e.g. calling the Memorial of Rebirth "the impaled potato"), but lines must stay factual and avoid mocking victims of 1989 (around 1,500 died). ([source](https://en.wikipedia.org/wiki/Memorial_of_Rebirth))
- **No stereotypes:** Do not use ethnic jokes (in particular about Roma people) or Dracula/vampire clichés aimed at locals; Dracula appears only as souvenir-vendor patter and as a historical fact (Vlad III built the Old Princely Court). ([source](https://en.wikipedia.org/wiki/Curtea_Veche))
- **Seasonal phrases:** 1 March: mărțișor (red-and-white string trinkets) sold everywhere and given to women; December: "Crăciun fericit!" and the Christmas market in Piața Constituției; winter: "Ce ger!" (what frost); summer heatwaves: "caniculă" (summers often exceed 30 °C). ([source](https://en.wikivoyage.org/wiki/Bucharest#Stay_healthy))

## 4. Gaps / to verify

- Tripadvisor, Lonely Planet, Trip.com and bucharest.ro were not reachable from this environment (403 / DNS); their positions come from search snippets. Re-check the Tripadvisor "Things to do" order if access is granted.
- No Commons images of the Memorial of Rebirth (deleted for no-FoP) - model from the dimensions/description.
- Spring Palace: main building identified as OSM way/549676146 by size only; architect attribution conflicts (Grimberg-Solari vs Lăzărescu).
- Village Museum: Dragomirești church identified as OSM way/277782593 (only wooden church in the sector); spire height (>35 m) from a single press source.
- Herăstrău: few OSM trees; Michael Jackson plaque fact (1992 concert) not plaque-sourced yet.
- Cișmigiu: the lakeside restaurant name/status ("Monte Carlo") to verify.
- Colours are measured from photos under varying light; *_hex values are judged albedos - validate in the render pass.
- Exact paving patterns (fan setts at Stavropoleos, cobbles in Lipscani) are photo-derived, not surveyed.
- KartaView/Mapillary street imagery not used (Mapillary needs a token).

## 5. Fidelity review 2026-11-12 (Parliament, Old Town, Cișmigiu, Athenaeum scenes)

Method: OSM decides where things are (scene extracts of 2026-11-07; live Overpass re-read for the Parliament and Old Town
boxes, single objects through the OSM API); Google Street View panoramas were looked at next to game renders from the same
position and bearing, as a visual reference only (nothing stored, traced or measured from them). What a panorama showed and
OSM does not map is listed here as an estimate.

### Palace of the Parliament / Piața Constituției
- **Hill.** From Bd. Libertății (official panorama, May 2025, about 44.42744, 26.09073) the lawns climb behind a tall first
  retaining wall and the palace base stands above the fence line. The scene DEM is smeared by the building; the raw EU-DEM
  v1.1 transect on the axis reads about +8 m at 40 m and +15 m at 60–80 m behind the fence. Scene levels (estimates):
  platform +16 m over the square (was +6.2 m), lawns 5.5→8 m, 10.5→12.5 m, 15→16 m between the three mapped retaining walls
  (OSM ways 1444650056 / 1444650060 / 1444650053).
- **Perimeter wall on Bd. Libertății**: a solid pale stone wall about 2.2 m high on a base course, square stone piers with
  caps about every 8 m, a short wrought-iron grille between the piers (it was a 0.6 m plinth with a 1.9 m see-through
  palisade). Sizes estimated. The wall on the other three sides was not reviewed.
- **Flags**: three masts stand right in front of the portico, about as tall as its columns (they were 26 m masts on the lawn
  by the fence).
- **Piața Constituției** is a car park most of the year (panorama of July 2019 on the square): matches.
- **Bd. Unirii head**: both promenades have mapped tree rows (OSM natural=tree with heights; 107 trees north, 145 south
  between x 150 and 330 m of the scene) and brick alleys between shoulder-high clipped hedges (panoramas May 2025 on both
  alleys). The scene removed the whole north row (its "open axis" strip was centred 20 m north of the boulevard's real
  axis). Hedges are not mapped: their offset (2.4 m from the alley centre line) and height (1.25 m) are estimates.
- **Fountains**: the two mapped basins (ways 1177217420 / 1177217423) sit in the median between the two carriageways: match.
- **Mapped tree heights**: the OSM tree survey gives each tree a height (5–36 m). Crowns are now sized by it; generated
  street trees are dropped within 16 m of a mapped tree. On Calea 13 Septembrie the limes and chestnuts are 5–12 m, so the
  cathedral is seen from the street as in the May 2025 panoramas (it was hidden behind a wall of full-size crowns).
- Not reviewed against a panorama: the cathedral precinct from inside (no official panorama on the piazza), Izvor park
  edge, the palace's north / south / west sides, the Senate gardens (Uranus memorial, relation 19749443).

### Old Town (walk: Lipscani 28–71 and upper Smârdan)
- Live OSM in the walk polygon: 84 named businesses, 16 tourist items, 2 passages (Hanul cu Tei way 658009190, Pasajul
  Gabroveni way 304275386), 5 disused venues (not shown, correct). The scene data matches it; node 1731040985 is still
  "Mojo Music Club" on the OSM API (one Overpass mirror returned an older "Mao Pub").
- 37 of the 90 named venues had no sign (clubs, hotels, hostels, banks, museums, galleries, theatres, and names dropped
  where another sign held the wall). They now get one (second row where the wall is taken). The five strip clubs / massage
  parlours are left unnamed on purpose; shops inside the Hanul cu Tei passage have no street front and stay unsigned.
- Panoramas of May 2025 on Lipscani and Smârdan: continuous terraces with awnings, cobbles, lanterns, festoons: the
  character matches; individual awning colours and terrace sizes remain estimates.

### Cișmigiu
- **Rotonda Scriitorilor**: OSM maps the twelve busts one by one (nodes 10877381995–10877382004, 10877399405,
  10877399406) on a ring of about 21 m radius: Bălcescu, Coșbuc, Odobescu, Vlahuță, Alecsandri, Hasdeu, Eminescu,
  Maiorescu, Caragiale, Iosif, Creangă, Zamfirescu. The scene had a 10.5 m ring and Delavrancea instead of Hasdeu.
- Other mapped monuments now shown at their nodes: busts of Gheorghe Panu, Theodor Șerbănescu, Traian Demetrescu, Maica
  Smara, Iosif Sava; statues Nimfa and Avântul Țării; Monumentul Sturdza (stele), Monumentul Eroilor Americani; Izvorul
  Sissi Stefanidi. Shapes are stylised.
- The only official panoramas inside the garden date from August 2012 (too old to judge kiosks, benches or planting).
  Live Overpass did not answer for this box on the review day: the inventory is the 2026-11-07 extract.

### Athenaeum / Piața Revoluției
- **Royal Palace (MNAR)**: beige limestone, rusticated ground floor with arched windows, two upper storeys between paired
  pilasters, attic balustrade, lawn and trees in the court (panoramas September 2024). The landmark model used in the scene
  is a mass model in the mapped colour name, almost windowless, and read as an olive block; the scene now draws the palace
  front on the mapped outline (way 232472401), 17.5 m high after the mapped parts (15.7–18 m).
- **Athenaeum garden** (way 23556716): closed by a white stone balustrade on a low wall, tall old trees with many
  conifers (panoramas August 2023). Eminescu (node 1911337561) is a standing bronze figure on a low base.
- **Central University Library**: dark slate mansard and corner domes behind the cornice.
- **Kretzulescu church** (way 1476760553): red brick with two towers; it was drawn as a plastered house.
- Mapped statues added: Corneliu Coposu, Avram Iancu, Alexander Dubček (busts), the three sculptures in the palace court
  (nodes 11068954269–71), the Iuliu Maniu memorial (way 1454535798).
- Name signs for 80 mapped venues and the named hotels / theatres on their own buildings.
- Live Overpass did not answer for this box on the review day: the inventory is the 2026-11-07 extract.
