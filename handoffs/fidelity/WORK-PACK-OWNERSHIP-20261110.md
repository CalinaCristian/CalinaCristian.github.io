# Work ownership — corrected by owner, 10 November 2026

Claude was given **A and B only**. Codex owns **C–N and integration**. The earlier assumption that Claude had all unfinished implementation was incorrect. Claude’s latest observed branch is f7634699, including selective Basarab architecture integration576adda5 from handoff81464a88. Placed-view controls exist; original-camera, Ultra and continuous driving acceptance remain open.

| Pack | Owner | Scope | Current state |
| --- | --- | --- | --- |
| A | Claude | Basarab structure; reports12–17 | Candidate on Claude’s branch; final acceptance open |
| B | Claude | Traffic, pedestrians and CPU; reports6–9,18,37–39,67 | Candidate on Claude’s branch; final acceptance open |
| C | Codex | Bucharest roads/paint; reports3,26,32–34,44–48,53–54 | Reports53/54 verified live. Romană47/48 reproduced; source-control paint28639c75 remains unaccepted. Other listed reports open |
| D | Codex | SeaTac roads, ramps and connections; reports57–65 | All nine original-camera views reviewed on760ab635; visible defects remain, source research in progress |
| E | Codex | Bellevue roads/closures; reports68–71, plus waterfall | Four original-camera views reviewed on760ab635; visible defects remain, source research in progress; waterfall unaccepted |
| F | Codex | Buildings, facades, roofs; reports4–5,10,19,22,25,27,35–36,40–42,49–51,55–56 | Reports4/5/27/36/41/42/49/56 verified live. Floating51/55 source causes traced; other listed reports open |
| G | Codex | Bucharest landmarks, trees, fountains and dressing; reports2,20–21,23,28–31 | Reports20/29 verified live; report20 at95763baa, report29 at28e54da0; native, foot/a,155-view comparison and affected overview checks complete. Firstf48trial rejected. Other listed reports open |
| H | Codex | Interiors; reports24,52 and all eight enterable locations | Report24 GTS host desk overlap verified live; Luxoft and broader interior work remain open |
| I | Codex | Night lighting in drone mode; report66 | Open; staged view-selection candidate does not yet close airport lighting |
| J | Codex | Old Town, Cișmigiu, Arcul de Triumf visits | Open |
| K | Codex | Pike Place and Seattle Center visits | Open |
| L | Codex | Meydenbauer and Downtown Park visits | Open |
| M | Codex | Real 3D-table backgammon experience | Open |
| N | Codex | Story/mobile/conditions/headlights/lifecycle/sports/drone/cache/overview and remaining integration | Open; softer horns delivered separately |

Current accepted runtime master: **95763baad84acc6a16ef0d61446c79718c9de0b5**. Release **game-dc1b7ab415b7eb7a**, Pages build95763baa built,290live-file checks pass. Reports **1,4,5,11,20,24,27,29,36,41,42,43,49,53,54,56** verified live: **16/71closed,55open**. Claude A/B unchanged. US57–65/68–71 current native review complete; defects remain open.

Pack C baseline: original immutable `tools/fidelity/inspect-portrait.cjs`, source54a45f6c, private output `/workspace/integration-qa-evidence/pack-c-roads-20261110/baseline`, FIFO `/tmp/pack-c-native.in`. Exact reported camera positions; static native rendering does not establish a driving journey or hardware performance. No application code has been changed for this investigation yet.

