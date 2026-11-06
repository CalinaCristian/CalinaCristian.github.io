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
R15.4 Access: "Bonus: Tourist spots" menu + unlocked by finishing a chapter in the same city (or always available — owner to decide; default: always available from the menu).
R15.5 Each spot loads in < 3 s; ≤ 1 M triangles; 60 fps at auto.

## Acceptance
- [ ] 20 spots playable on foot, each passes visual QA review with no medium+ defects and is recognisable from reference photos side by side (screenshots in the log).
- [ ] Plaques have sources; photo challenge works on desktop + mobile.

## Requests
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
