# Work ownership — corrected by owner, 10 November 2026

Claude was given **A and B only**. Codex owns **C–N and integration**. The earlier assumption that Claude had all unfinished implementation was incorrect. External Claude progress is unknown; assignment does not mean acceptance.

| Pack | Owner | Scope | Current state |
| --- | --- | --- | --- |
| A | Claude | Basarab structure; reports12–17 | Unaccepted; awaiting Claude implementation/evidence |
| B | Claude | Traffic, pedestrians and CPU; reports6–9,18,37–39,67 | Unaccepted; awaiting Claude implementation/evidence |
| C | Codex | Bucharest roads/paint; reports3,26,32–34,44–48,53–54 | Active: report54fixed and verified live; Romană47/48reproduced, source-control paint28639c75 under review; not accepted |
| D | Codex | SeaTac roads, ramps and connections; reports57–65 | Open |
| E | Codex | Bellevue roads/closures; reports68–71, plus waterfall | Open; waterfall candidate unaccepted |
| F | Codex | Buildings, facades, roofs; reports4–5,10,19,22,25,27,35–36,40–42,49–51,55–56 | Active: report49window-row fix3cc387ba passes native comparison/foot-a, paired visual/publication pending; floating51/55 source causes traced |
| G | Codex | Bucharest landmarks, trees, fountains and dressing; reports2,20–21,23,28–31 | Open |
| H | Codex | Interiors; reports24,52 and all eight enterable locations | Open |
| I | Codex | Night lighting in drone mode; report66 | Open; staged view-selection candidate does not yet close airport lighting |
| J | Codex | Old Town, Cișmigiu, Arcul de Triumf visits | Open |
| K | Codex | Pike Place and Seattle Center visits | Open |
| L | Codex | Meydenbauer and Downtown Park visits | Open |
| M | Codex | Real 3D-table backgammon experience | Open |
| N | Codex | Story/mobile/conditions/headlights/lifecycle/sports/drone/cache/overview and remaining integration | Open; softer horns delivered separately |

Current accepted master:9d681f454817179848868b9661a1eae49fe137d5. Ground, SkyTower, softer horns and report54road guards are verified live. The reported batch is4/71closed and67open. Preserve the accepted fixes during integration and curate only tested changes; the large staging branch must not be merged wholesale.

Pack C baseline: original immutable `tools/fidelity/inspect-portrait.cjs`, source54a45f6c, private output `/workspace/integration-qa-evidence/pack-c-roads-20261110/baseline`, FIFO `/tmp/pack-c-native.in`. Exact reported camera positions; static native rendering does not establish a driving journey or hardware performance. No application code has been changed for this investigation yet.
