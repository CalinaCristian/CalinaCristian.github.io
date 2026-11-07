# Drone rules for the game's places (Seattle / Bellevue / Bucharest)

Research 2026-11-07 (round 5). Only restrictions confirmed in a source fetched today are stated as fact. Anything that could not be confirmed is marked **unconfirmed**. This is a game-design reference, not legal advice.

## Seattle (spots: Pike Place, Space Needle, waterfront, Pioneer Square, Fremont Troll, Ballard Locks, Gas Works, Kerry Park, MoPOP, Chihuly)
- **City parks: drones are banned.** "City law prohibits drones and other remote-controlled aircraft in parks (SMC 18.12.265)". Source: Seattle Parks and Recreation, Rules & Regulations, https://www.seattle.gov/parks/about-us/rules-and-regulations (fetched 2026-11-07).
  - This covers **Gas Works Park and Kerry Park**, which are both Seattle Parks sites (seattle.gov park pages).
  - It also covers the other spots whose ground is city park land (for example Victor Steinbrueck Park beside Pike Place). Each spot's land status was not checked one by one.
- **Federal rules apply everywhere** (FAA, Recreational Flyers, https://www.faa.gov/uas/recreational_flyers, fetched 2026-11-07):
  - Register the drone if it weighs 250 g or more.
  - Pass the free TRUST test and carry proof when flying.
  - Keep the drone within visual line of sight.
  - Give way to all other aircraft.
  - In controlled airspace (Class B, C, D, surface E), fly only at FAA-authorised altitudes, through LAANC or a FAA authorisation.
- **Seattle-Tacoma International Airport (SeaTac district).**
  - The airport sits in controlled airspace, so the FAA LAANC/authorisation rule applies.
  - The exact Class B ceilings for each grid cell are **unconfirmed** here (FAA UAS Facility Maps not fetched).
- **Not checked:** temporary flight restrictions (TFRs) over stadium events, and Space Needle / Seattle Center private-property rules.

## Bellevue (spots: Downtown Park, Botanical Garden, Meydenbauer Bay, Lincoln Square)
- The FAA rules above apply.
- Bellevue's own park rules (Bellevue City Code ch. 3.43) returned HTTP 403, and the city's park-rules page was not found. A Bellevue city-park drone ban is therefore **unconfirmed**. In the game, treat Bellevue parks like Seattle's: no take-off in parks.
- The Botanical Garden is a city park, and Lincoln Square / Bellevue Square are private property (owner's rules, not checked).

## Bucharest (spots and districts)
- **EU rules** (Regulation (EU) 2019/947 via EASA, "Open category", https://www.easa.europa.eu/en/domains/drones-air-mobility/operating-drone/open-category-low-risk-civil-drones, fetched 2026-11-07):
  - The open category has three subcategories: **A1** (may fly over uninvolved people but never over assemblies of people), **A2** (close to people), **A3** (far from people).
  - Operator registration is required, except for drones under 250 g without a camera.
  - Each state publishes **geographical zones** where flights are restricted.
- **Romanian geographical zones:**
  - The Romanian authority / ROMATSA drone pages (caa.ro, aacr.ro, flightplan.romatsa.ro) did not respond or returned empty pages on 2026-11-07, so the actual zones are **unconfirmed**.
  - Henri Coandă (Otopeni, LROP) and Băneasa (LRBS) airports have controlled airspace, which matters for the otopeni district and northern Bucharest.
  - Restrictions around state buildings such as the Palace of the Parliament are commonly reported but **unconfirmed** here.
- **Crowds:** the EU A1 rule already bans flying over assemblies of people. That covers the Old Town on busy evenings, the Simfonia Apei fountain shows, Christmas markets and 1 December parades.

## Suggested game rule (design, derived from the above)
| Place | Drone / camera-drone mode |
|---|---|
| Seattle city parks (Gas Works, Kerry Park, and any spot whose ground is city park land) | Not allowed. Show "Drones are prohibited in Seattle parks (SMC 18.12.265)" |
| SeaTac terminal area / near runways | Not allowed (controlled airspace next to the airport) |
| Other Seattle / Bellevue spots | Allowed only in visual line of sight, at FAA-authorised altitudes, not over crowds; Bellevue parks treated as no take-off (unconfirmed) |
| Bucharest crowds (Old Town evenings, fountain shows, markets, parades) | Not over the crowd (EU A1) |
| Otopeni airport area | Not allowed (controlled airspace) |
| Other Bucharest spots | Allowed with the "registered operator" flavour text; Palace of the Parliament marked as restricted (unconfirmed) |
