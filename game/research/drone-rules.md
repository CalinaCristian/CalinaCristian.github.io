# Drone rules for the game's places (Seattle / Bellevue / Bucharest)

Game-design reference, not legal advice (research 2026-11-07). Only restrictions confirmed in a source fetched that day are stated as fact; the rest is marked **unconfirmed**. The game does not apply these place rules yet (`game/src/drone.js` has none).

## Seattle
- **City parks: drones banned** — "City law prohibits drones and other remote-controlled aircraft in parks (SMC 18.12.265)" (Seattle Parks, https://www.seattle.gov/parks/about-us/rules-and-regulations). Covers Gas Works Park and Kerry Park, and other spots on city park land (e.g. Victor Steinbrueck Park by Pike Place); land status was not checked spot by spot.
- **FAA rules everywhere** (https://www.faa.gov/uas/recreational_flyers): register drones of 250 g or more; pass the TRUST test and carry proof; visual line of sight; give way to all aircraft; in controlled airspace (Class B, C, D, surface E) only at authorised altitudes (LAANC or FAA authorisation).
- **SeaTac airport**: controlled airspace; the Class B ceilings per grid cell are **unconfirmed** (FAA UAS Facility Maps not fetched).
- Not checked: stadium TFRs, Space Needle / Seattle Center private-property rules.

## Bellevue
- FAA rules apply. Bellevue City Code ch. 3.43 returned 403 and no park-rules page was found, so a city-park ban is **unconfirmed**; the game should treat Bellevue parks like Seattle's (no take-off). The Botanical Garden is a city park; Lincoln Square / Bellevue Square are private property (rules not checked).

## Bucharest
- **EU rules** (Regulation (EU) 2019/947, EASA open category, https://www.easa.europa.eu/en/domains/drones-air-mobility/operating-drone/open-category-low-risk-civil-drones): subcategories A1 (over uninvolved people, never over assemblies), A2 (close to people), A3 (far from people); operator registration except under 250 g without a camera; each state publishes geographical zones.
- **Romanian zones unconfirmed**: caa.ro, aacr.ro and flightplan.romatsa.ro did not respond. Henri Coandă (LROP, otopeni district) and Băneasa (LRBS) have controlled airspace; restrictions around the Palace of the Parliament are commonly reported but **unconfirmed**.
- **Crowds**: A1 already bans flying over assemblies: Old Town evenings, Simfonia Apei shows, Christmas markets, 1 December parades.

## Suggested game rule
| Place | Drone mode |
|---|---|
| Seattle city parks (Gas Works, Kerry Park, any spot on city park land) | Not allowed: "Drones are prohibited in Seattle parks (SMC 18.12.265)" |
| SeaTac terminal / near runways, Otopeni airport area | Not allowed (controlled airspace) |
| Other Seattle / Bellevue spots | Line of sight, authorised altitudes, not over crowds; Bellevue parks no take-off (unconfirmed) |
| Bucharest crowds (Old Town evenings, fountain shows, markets, parades) | Not over the crowd (EU A1) |
| Other Bucharest spots | Allowed with "registered operator" flavour text; Palace of the Parliament restricted (unconfirmed) |
