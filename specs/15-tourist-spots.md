# 15 — Tourist spots (walk-only bonus scenes)

Owner role: **spots** (new agent, after research). Inputs: research dossiers (spec 20), `OnFootController` (spec 14), `PhotoMode` (spec 16), landmarks.js.

Bonus content: only the most important, must-see tourist places in each city (top 10), e.g. the Fremont Troll and the Gum Wall in Seattle, built as small high-fidelity areas you explore on foot (no driving).

## Requirements
R15.1 Top 10 per city chosen by evidence (tourism rankings, Wikipedia/Wikivoyage "see" lists, visitor numbers) in research. Initial candidates (research confirms/replaces):
- **Seattle area = Seattle + Bellevue**: Seattle top 10 — Pike Place Market (+ Gum Wall, original Starbucks, fish throwing, the neon sign), Space Needle + Seattle Center, Chihuly Garden and Glass, MoPOP, Fremont Troll, Kerry Park viewpoint, Waterfront + Great Wheel, Pioneer Square + Smith Tower, Ballard Locks, Gas Works Park; **plus Bellevue's top spots** (research picks 3–5): Lincoln Square + Bellevue Square + the skybridges (UiPath's office is in Lincoln Square), Bellevue Downtown Park (waterfall, canal ring), Bellevue Botanical Garden, Meydenbauer Bay Park, Bellevue Arts Museum, The Bravern, Old Main Street.
- **Bucharest**: Palace of the Parliament, Old Town (Lipscani, Hanul lui Manuc, Stavropoleos), Romanian Athenaeum + Piața Revoluției (Memorial of Rebirth), Cărturești Carusel, Arcul de Triumf, Herăstrău/King Michael I Park + Village Museum, Calea Victoriei + CEC Palace, Cișmigiu Gardens, Patriarchal Cathedral hill, Therme or National Museum of Art (research decides).
R15.2 Each spot: a small walk-only scene (~150–400 m across) at 1:1, hand-built at HIGH fidelity from research (dimensions, materials, colours, signage, props, vegetation), with real neighbouring façades as backdrop, ambient crowd, ambient sound, time of day + weather + season from spec 18.
R15.3 Interactions: 3–6 info plaques per spot (short facts, sources), a "postcard" photo challenge (spec 16), spot-specific fun (throw a coin, stick gum on the Gum Wall, catch a fish at Pike Place, climb onto the Troll's hand, honk-free zone).
R15.4 Access: "Bonus: Tourist spots" menu + unlocked by finishing a chapter in the same city (or always available — owner to decide; default: always available from the menu).
R15.5 Each spot loads in < 3 s; ≤ 1 M triangles; 60 fps at auto.

## Acceptance
- [ ] 20 spots playable on foot, each passes visual QA review with no medium+ defects and is recognisable from reference photos side by side (screenshots in the log).
- [ ] Plaques have sources; photo challenge works on desktop + mobile.

## Requests
## Progress log
