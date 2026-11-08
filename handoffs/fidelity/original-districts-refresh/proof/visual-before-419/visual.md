# Visual QA — 2026-11-08 21:17 UTC

Run: `--city=bucharest --district=floreasca,romana,grozavesti --quality=high --pr=.5 --traffic-every=200 --jobs=1 --timeout=900 --out=/workspace/reality-pass/original-districts-refresh/final-419/visual` · 61 min · quality high, day, clear, far game, traffic shots every 200 m, forward every 40 m, looks/aerial every 200/200 m, z-fight test every 3 sample(s).

Capture coverage: **COMPLETE** — 260/260 required route samples captured; 0 missing; 0 capture/runtime errors.

Human review: [review.md](review.md).

## Findings by detector

| detector | high | medium | low | total |
|---|---|---|---|---|
| `pad-overlap` | 0 | 0 | 188 | 188 |
| `ribbon-zfight` | 0 | 2 | 130 | 132 |
| `building-over-road` | 29 | 33 | 0 | 62 |
| `surface-above-road` | 7 | 4 | 0 | 11 |
| `canvas-text-overflow` | 0 | 0 | 9 | 9 |
| `ribbon-stacked` | 3 | 2 | 0 | 5 |
| `lifted-nonbridge` | 3 | 1 | 0 | 4 |
| `hud-overlap` | 1 | 2 | 0 | 3 |
| `road-hole` | 1 | 0 | 2 | 3 |
| `road-sky-hole` | 1 | 2 | 0 | 3 |
| `cockpit-screen-offscreen` | 1 | 1 | 0 | 2 |
| `hud-offscreen` | 1 | 0 | 0 | 1 |
| `hud-covers-cockpit` | 0 | 1 | 0 | 1 |
| `ribbon-gap` | 0 | 1 | 0 | 1 |
| `marking-floating` | 0 | 1 | 0 | 1 |
| `zfight` | 0 | 1 | 0 | 1 |

## bucharest (chapters)

- world `bucharest-floreasca` district floreasca: 384 edges, 523 ribbons, loaded in 11.4 s
- world `bucharest-grozavesti` district grozavesti: 801 edges, 1714 ribbons, loaded in 18.1 s
- world `bucharest-romana` district romana: 1006 edges, 1320 ribbons, loaded in 25.7 s
- Source sweep **Strada Mihail Ivanovici Glinka**: 12/12 legal directed source edges covered by verified routes in 2 actual source-node components (complete). Original farthest pair: forward unreachable, reverse reachable. All original-pair diagnostics, access exclusions and uncovered source IDs remain in visual.json.
- Source sweep **Bulevardul Mircea Eliade**: 14/14 legal directed source edges covered by verified routes in 1 actual source-node components (complete). Original farthest pair: forward reachable, reverse reachable. All original-pair diagnostics, access exclusions and uncovered source IDs remain in visual.json.
- Source sweep **Șoseaua Grozăvești**: 27/27 legal directed source edges covered by verified routes in 2 actual source-node components (complete). Original farthest pair: forward reachable, reverse unreachable. All original-pair diagnostics, access exclusions and uncovered source IDs remain in visual.json.
- Source sweep **Splaiul Independenței**: 26/26 legal directed source edges covered by verified routes in 2 actual source-node components (complete). Original farthest pair: forward unreachable, reverse unreachable. All original-pair diagnostics, access exclusions and uncovered source IDs remain in visual.json.
- Source sweep **Bulevardul Iancu de Hunedoara**: 43/43 legal directed source edges covered by verified routes in 2 actual source-node components (complete). Original farthest pair: forward reachable, reverse unreachable. All original-pair diagnostics, access exclusions and uncovered source IDs remain in visual.json.
- Source sweep **Strada Căderea Bastiliei**: 21/21 legal directed source edges covered by verified routes in 2 actual source-node components (complete). Original farthest pair: forward reachable, reverse unreachable. All original-pair diagnostics, access exclusions and uncovered source IDs remain in visual.json.
- time: load 55 s, geometry 4 s, survey 3370 s, focus 62 s, offices 7 s, cockpit 129 s

| route | length | samples | flagged | wall |
|---|---|---|---|---|
| `rosetti` 2009 High school | 1669 m | 42 | 0 | 730 s |
| `sweep-strada-mihail-ivanovici-glinka` main street: Strada Mihail Ivanovici Glinka · legal run 1/2 | 127 m | 3 | 0 | 20 s |
| `sweep-strada-mihail-ivanovici-glinka-run-2` main street: Strada Mihail Ivanovici Glinka · legal run 2/2 | 127 m | 3 | 0 | 36 s |
| `sweep-bulevardul-mircea-eliade` main street: Bulevardul Mircea Eliade · legal run 1/2 | 130 m | 3 | 0 | 21 s |
| `sweep-bulevardul-mircea-eliade-run-2` main street: Bulevardul Mircea Eliade · legal run 2/2 | 132 m | 3 | 0 | 32 s |
| `upb` 2013 Politehnica | 1573 m | 40 | 1 | 750 s |
| `sweep-oseaua-groz-ve-ti` main street: Șoseaua Grozăvești · legal run 1/2 | 344 m | 8 | 0 | 153 s |
| `sweep-oseaua-groz-ve-ti-run-2` main street: Șoseaua Grozăvești · legal run 2/2 | 303 m | 7 | 0 | 157 s |
| `sweep-splaiul-independen-ei` main street: Splaiul Independenței · legal run 1/2 | 260 m | 6 | 0 | 74 s |
| `sweep-splaiul-independen-ei-run-2` main street: Splaiul Independenței · legal run 2/2 | 260 m | 6 | 0 | 81 s |
| `arnia` 2019 Arnia | 2206 m | 55 | 1 | 451 s |
| `uipath-buc` 2020 UiPath | 1458 m | 37 | 1 | 321 s |
| `sweep-bulevardul-iancu-de-hunedoara` main street: Bulevardul Iancu de Hunedoara · legal run 1/3 | 624 m | 15 | 0 | 106 s |
| `sweep-bulevardul-iancu-de-hunedoara-run-2` main street: Bulevardul Iancu de Hunedoara · legal run 2/3 | 618 m | 15 | 1 | 212 s |
| `sweep-bulevardul-iancu-de-hunedoara-run-3` main street: Bulevardul Iancu de Hunedoara · legal run 3/3 | 149 m | 3 | 0 | 43 s |
| `sweep-strada-c-derea-bastiliei` main street: Strada Căderea Bastiliei · legal run 1/2 | 447 m | 11 | 0 | 154 s |
| `sweep-strada-c-derea-bastiliei-run-2` main street: Strada Căderea Bastiliei · legal run 2/2 | 154 m | 3 | 0 | 31 s |

### Contact sheets

- **bucharest-floreasca · 2009 High school · forward view every 40 m · day**: [1](sheets/bucharest-floreasca-rosetti-forward-001.jpg) [2](sheets/bucharest-floreasca-rosetti-forward-002.jpg) [3](sheets/bucharest-floreasca-rosetti-forward-003.jpg) [4](sheets/bucharest-floreasca-rosetti-forward-004.jpg) [5](sheets/bucharest-floreasca-rosetti-forward-005.jpg) [6](sheets/bucharest-floreasca-rosetti-forward-006.jpg) [7](sheets/bucharest-floreasca-rosetti-forward-007.jpg)
- **bucharest-floreasca · 2009 High school · left / right / back every 200 m**: [1](sheets/bucharest-floreasca-rosetti-looks-001.jpg) [2](sheets/bucharest-floreasca-rosetti-looks-002.jpg) [3](sheets/bucharest-floreasca-rosetti-looks-003.jpg) [4](sheets/bucharest-floreasca-rosetti-looks-004.jpg) [5](sheets/bucharest-floreasca-rosetti-looks-005.jpg)
- **bucharest-floreasca · 2009 High school · top-down 120 m tiles every 200 m (car at centre, driving up; circles = geometry findings)**: [1](sheets/bucharest-floreasca-rosetti-aerial-001.jpg) [2](sheets/bucharest-floreasca-rosetti-aerial-002.jpg)
- **bucharest-floreasca · 2009 High school · with traffic + pedestrians every 200 m · day**: [1](sheets/bucharest-floreasca-rosetti-traffic-001.jpg) [2](sheets/bucharest-floreasca-rosetti-traffic-002.jpg)
- **bucharest-floreasca · main street: Strada Mihail Ivanovici Glinka · legal run 1/2 · forward view every 40 m · day**: [1](sheets/bucharest-floreasca-sweep-strada-mihail-ivanovici-glinka-forward-001.jpg)
- **bucharest-floreasca · main street: Strada Mihail Ivanovici Glinka · legal run 2/2 · forward view every 40 m · day**: [1](sheets/bucharest-floreasca-sweep-strada-mihail-ivanovici-glinka-run-2-forward-001.jpg)
- **bucharest-floreasca · main street: Bulevardul Mircea Eliade · legal run 1/2 · forward view every 40 m · day**: [1](sheets/bucharest-floreasca-sweep-bulevardul-mircea-eliade-forward-001.jpg)
- **bucharest-floreasca · main street: Bulevardul Mircea Eliade · legal run 2/2 · forward view every 40 m · day**: [1](sheets/bucharest-floreasca-sweep-bulevardul-mircea-eliade-run-2-forward-001.jpg)
- **bucharest-floreasca · geometry findings (40 m top-down, north up)**: [1](sheets/bucharest-floreasca-geometry-001.jpg) [2](sheets/bucharest-floreasca-geometry-002.jpg)
- **bucharest · office lobbies (entrance view + lobby sign close-up)**: [1](sheets/offices-bucharest-001.jpg) [2](sheets/offices-bucharest-002.jpg) [3](sheets/offices-bucharest-003.jpg)
- **bucharest-floreasca · cockpit + HUD**: [1](sheets/cockpit-bucharest-floreasca-bucharest-1280x720-001.jpg)
- **bucharest-floreasca · cockpit + HUD**: [1](sheets/cockpit-bucharest-floreasca-bucharest-1920x1080-001.jpg)
- **bucharest-floreasca · cockpit + HUD**: [1](sheets/cockpit-bucharest-floreasca-bucharest-2560x1080-001.jpg)
- **bucharest-floreasca · cockpit + HUD**: [1](sheets/cockpit-bucharest-floreasca-bucharest-844x390-001.jpg)
- **bucharest-floreasca · cockpit + HUD**: [1](sheets/cockpit-bucharest-floreasca-bucharest-844x390-touch-001.jpg)
- **bucharest-floreasca · cockpit + HUD**: [1](sheets/cockpit-bucharest-floreasca-bucharest-390x844-001.jpg)
- **bucharest-floreasca · cockpit + HUD**: [1](sheets/cockpit-bucharest-floreasca-bucharest-390x844-touch-001.jpg)
- **bucharest-grozavesti · 2013 Politehnica · forward view every 40 m · day**: [1](sheets/bucharest-grozavesti-upb-forward-001.jpg) [2](sheets/bucharest-grozavesti-upb-forward-002.jpg) [3](sheets/bucharest-grozavesti-upb-forward-003.jpg) [4](sheets/bucharest-grozavesti-upb-forward-004.jpg) [5](sheets/bucharest-grozavesti-upb-forward-005.jpg) [6](sheets/bucharest-grozavesti-upb-forward-006.jpg) [7](sheets/bucharest-grozavesti-upb-forward-007.jpg)
- **bucharest-grozavesti · 2013 Politehnica · left / right / back every 200 m**: [1](sheets/bucharest-grozavesti-upb-looks-001.jpg) [2](sheets/bucharest-grozavesti-upb-looks-002.jpg) [3](sheets/bucharest-grozavesti-upb-looks-003.jpg) [4](sheets/bucharest-grozavesti-upb-looks-004.jpg)
- **bucharest-grozavesti · 2013 Politehnica · top-down 120 m tiles every 200 m (car at centre, driving up; circles = geometry findings)**: [1](sheets/bucharest-grozavesti-upb-aerial-001.jpg) [2](sheets/bucharest-grozavesti-upb-aerial-002.jpg)
- **bucharest-grozavesti · 2013 Politehnica · with traffic + pedestrians every 200 m · day**: [1](sheets/bucharest-grozavesti-upb-traffic-001.jpg) [2](sheets/bucharest-grozavesti-upb-traffic-002.jpg)
- **bucharest-grozavesti · main street: Șoseaua Grozăvești · legal run 1/2 · forward view every 40 m · day**: [1](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-forward-001.jpg) [2](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-forward-002.jpg)
- **bucharest-grozavesti · main street: Șoseaua Grozăvești · legal run 1/2 · left / right / back every 200 m**: [1](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-looks-001.jpg)
- **bucharest-grozavesti · main street: Șoseaua Grozăvești · legal run 1/2 · top-down 120 m tiles every 200 m (car at centre, driving up; circles = geometry findings)**: [1](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-aerial-001.jpg)
- **bucharest-grozavesti · main street: Șoseaua Grozăvești · legal run 1/2 · with traffic + pedestrians every 200 m · day**: [1](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-traffic-001.jpg)
- **bucharest-grozavesti · main street: Șoseaua Grozăvești · legal run 2/2 · forward view every 40 m · day**: [1](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-run-2-forward-001.jpg) [2](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-run-2-forward-002.jpg)
- **bucharest-grozavesti · main street: Șoseaua Grozăvești · legal run 2/2 · left / right / back every 200 m**: [1](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-run-2-looks-001.jpg)
- **bucharest-grozavesti · main street: Șoseaua Grozăvești · legal run 2/2 · top-down 120 m tiles every 200 m (car at centre, driving up; circles = geometry findings)**: [1](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-run-2-aerial-001.jpg)
- **bucharest-grozavesti · main street: Șoseaua Grozăvești · legal run 2/2 · with traffic + pedestrians every 200 m · day**: [1](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-run-2-traffic-001.jpg)
- **bucharest-grozavesti · main street: Splaiul Independenței · legal run 1/2 · forward view every 40 m · day**: [1](sheets/bucharest-grozavesti-sweep-splaiul-independen-ei-forward-001.jpg)
- **bucharest-grozavesti · main street: Splaiul Independenței · legal run 1/2 · left / right / back every 200 m**: [1](sheets/bucharest-grozavesti-sweep-splaiul-independen-ei-looks-001.jpg)
- **bucharest-grozavesti · main street: Splaiul Independenței · legal run 1/2 · top-down 120 m tiles every 200 m (car at centre, driving up; circles = geometry findings)**: [1](sheets/bucharest-grozavesti-sweep-splaiul-independen-ei-aerial-001.jpg)
- **bucharest-grozavesti · main street: Splaiul Independenței · legal run 1/2 · with traffic + pedestrians every 200 m · day**: [1](sheets/bucharest-grozavesti-sweep-splaiul-independen-ei-traffic-001.jpg)
- **bucharest-grozavesti · main street: Splaiul Independenței · legal run 2/2 · forward view every 40 m · day**: [1](sheets/bucharest-grozavesti-sweep-splaiul-independen-ei-run-2-forward-001.jpg)
- **bucharest-grozavesti · main street: Splaiul Independenței · legal run 2/2 · left / right / back every 200 m**: [1](sheets/bucharest-grozavesti-sweep-splaiul-independen-ei-run-2-looks-001.jpg)
- **bucharest-grozavesti · main street: Splaiul Independenței · legal run 2/2 · top-down 120 m tiles every 200 m (car at centre, driving up; circles = geometry findings)**: [1](sheets/bucharest-grozavesti-sweep-splaiul-independen-ei-run-2-aerial-001.jpg)
- **bucharest-grozavesti · main street: Splaiul Independenței · legal run 2/2 · with traffic + pedestrians every 200 m · day**: [1](sheets/bucharest-grozavesti-sweep-splaiul-independen-ei-run-2-traffic-001.jpg)
- **bucharest-grozavesti · geometry findings (40 m top-down, north up)**: [1](sheets/bucharest-grozavesti-geometry-001.jpg) [2](sheets/bucharest-grozavesti-geometry-002.jpg) [3](sheets/bucharest-grozavesti-geometry-003.jpg) [4](sheets/bucharest-grozavesti-geometry-004.jpg)
- **bucharest-romana · 2019 Arnia · forward view every 40 m · day**: [1](sheets/bucharest-romana-arnia-forward-001.jpg) [2](sheets/bucharest-romana-arnia-forward-002.jpg) [3](sheets/bucharest-romana-arnia-forward-003.jpg) [4](sheets/bucharest-romana-arnia-forward-004.jpg) [5](sheets/bucharest-romana-arnia-forward-005.jpg) [6](sheets/bucharest-romana-arnia-forward-006.jpg) [7](sheets/bucharest-romana-arnia-forward-007.jpg) [8](sheets/bucharest-romana-arnia-forward-008.jpg) [9](sheets/bucharest-romana-arnia-forward-009.jpg) [10](sheets/bucharest-romana-arnia-forward-010.jpg)
- **bucharest-romana · 2019 Arnia · left / right / back every 200 m**: [1](sheets/bucharest-romana-arnia-looks-001.jpg) [2](sheets/bucharest-romana-arnia-looks-002.jpg) [3](sheets/bucharest-romana-arnia-looks-003.jpg) [4](sheets/bucharest-romana-arnia-looks-004.jpg) [5](sheets/bucharest-romana-arnia-looks-005.jpg) [6](sheets/bucharest-romana-arnia-looks-006.jpg)
- **bucharest-romana · 2019 Arnia · top-down 120 m tiles every 200 m (car at centre, driving up; circles = geometry findings)**: [1](sheets/bucharest-romana-arnia-aerial-001.jpg) [2](sheets/bucharest-romana-arnia-aerial-002.jpg)
- **bucharest-romana · 2019 Arnia · with traffic + pedestrians every 200 m · day**: [1](sheets/bucharest-romana-arnia-traffic-001.jpg) [2](sheets/bucharest-romana-arnia-traffic-002.jpg)
- **bucharest-romana · 2020 UiPath · forward view every 40 m · day**: [1](sheets/bucharest-romana-uipath-buc-forward-001.jpg) [2](sheets/bucharest-romana-uipath-buc-forward-002.jpg) [3](sheets/bucharest-romana-uipath-buc-forward-003.jpg) [4](sheets/bucharest-romana-uipath-buc-forward-004.jpg) [5](sheets/bucharest-romana-uipath-buc-forward-005.jpg) [6](sheets/bucharest-romana-uipath-buc-forward-006.jpg) [7](sheets/bucharest-romana-uipath-buc-forward-007.jpg)
- **bucharest-romana · 2020 UiPath · left / right / back every 200 m**: [1](sheets/bucharest-romana-uipath-buc-looks-001.jpg) [2](sheets/bucharest-romana-uipath-buc-looks-002.jpg) [3](sheets/bucharest-romana-uipath-buc-looks-003.jpg) [4](sheets/bucharest-romana-uipath-buc-looks-004.jpg)
- **bucharest-romana · 2020 UiPath · top-down 120 m tiles every 200 m (car at centre, driving up; circles = geometry findings)**: [1](sheets/bucharest-romana-uipath-buc-aerial-001.jpg) [2](sheets/bucharest-romana-uipath-buc-aerial-002.jpg)
- **bucharest-romana · 2020 UiPath · with traffic + pedestrians every 200 m · day**: [1](sheets/bucharest-romana-uipath-buc-traffic-001.jpg) [2](sheets/bucharest-romana-uipath-buc-traffic-002.jpg)
- **bucharest-romana · main street: Bulevardul Iancu de Hunedoara · legal run 1/3 · forward view every 40 m · day**: [1](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-forward-001.jpg) [2](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-forward-002.jpg) [3](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-forward-003.jpg)
- **bucharest-romana · main street: Bulevardul Iancu de Hunedoara · legal run 1/3 · left / right / back every 200 m**: [1](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-looks-001.jpg) [2](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-looks-002.jpg)
- **bucharest-romana · main street: Bulevardul Iancu de Hunedoara · legal run 1/3 · top-down 120 m tiles every 200 m (car at centre, driving up; circles = geometry findings)**: [1](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-aerial-001.jpg)
- **bucharest-romana · main street: Bulevardul Iancu de Hunedoara · legal run 1/3 · with traffic + pedestrians every 200 m · day**: [1](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-traffic-001.jpg)
- **bucharest-romana · main street: Bulevardul Iancu de Hunedoara · legal run 2/3 · forward view every 40 m · day**: [1](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-run-2-forward-001.jpg) [2](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-run-2-forward-002.jpg) [3](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-run-2-forward-003.jpg)
- **bucharest-romana · main street: Bulevardul Iancu de Hunedoara · legal run 2/3 · left / right / back every 200 m**: [1](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-run-2-looks-001.jpg) [2](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-run-2-looks-002.jpg)
- **bucharest-romana · main street: Bulevardul Iancu de Hunedoara · legal run 2/3 · top-down 120 m tiles every 200 m (car at centre, driving up; circles = geometry findings)**: [1](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-run-2-aerial-001.jpg)
- **bucharest-romana · main street: Bulevardul Iancu de Hunedoara · legal run 2/3 · with traffic + pedestrians every 200 m · day**: [1](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-run-2-traffic-001.jpg)
- **bucharest-romana · main street: Bulevardul Iancu de Hunedoara · legal run 3/3 · forward view every 40 m · day**: [1](sheets/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-run-3-forward-001.jpg)
- **bucharest-romana · main street: Strada Căderea Bastiliei · legal run 1/2 · forward view every 40 m · day**: [1](sheets/bucharest-romana-sweep-strada-c-derea-bastiliei-forward-001.jpg) [2](sheets/bucharest-romana-sweep-strada-c-derea-bastiliei-forward-002.jpg)
- **bucharest-romana · main street: Strada Căderea Bastiliei · legal run 1/2 · left / right / back every 200 m**: [1](sheets/bucharest-romana-sweep-strada-c-derea-bastiliei-looks-001.jpg)
- **bucharest-romana · main street: Strada Căderea Bastiliei · legal run 1/2 · top-down 120 m tiles every 200 m (car at centre, driving up; circles = geometry findings)**: [1](sheets/bucharest-romana-sweep-strada-c-derea-bastiliei-aerial-001.jpg)
- **bucharest-romana · main street: Strada Căderea Bastiliei · legal run 1/2 · with traffic + pedestrians every 200 m · day**: [1](sheets/bucharest-romana-sweep-strada-c-derea-bastiliei-traffic-001.jpg)
- **bucharest-romana · main street: Strada Căderea Bastiliei · legal run 2/2 · forward view every 40 m · day**: [1](sheets/bucharest-romana-sweep-strada-c-derea-bastiliei-run-2-forward-001.jpg)
- **bucharest-romana · geometry findings (40 m top-down, north up)**: [1](sheets/bucharest-romana-geometry-001.jpg) [2](sheets/bucharest-romana-geometry-002.jpg) [3](sheets/bucharest-romana-geometry-003.jpg) [4](sheets/bucharest-romana-geometry-004.jpg) [5](sheets/bucharest-romana-geometry-005.jpg) [6](sheets/bucharest-romana-geometry-006.jpg) [7](sheets/bucharest-romana-geometry-007.jpg)

### Cockpit / HUD screenshots

- [1280x720](cockpit/bucharest-1280x720.png) — nav screen 0 % off-view, 0 % occluded (—), 151 px tall
- [1920x1080](cockpit/bucharest-1920x1080.png) — nav screen 0 % off-view, 0 % occluded (—), 227 px tall
- [2560x1080](cockpit/bucharest-2560x1080.png) — nav screen 0 % off-view, 0 % occluded (—), 227 px tall
- [844x390](cockpit/bucharest-844x390.png) — nav screen 0 % off-view, 0 % occluded (—), 82 px tall
- [844x390-touch](cockpit/bucharest-844x390-touch.png) — nav screen 0 % off-view, 0 % occluded (—), 83 px tall
- [390x844](cockpit/bucharest-390x844.png) — nav screen 13 % off-view, 0 % occluded (—), 125 px tall
- [390x844-touch](cockpit/bucharest-390x844-touch.png) — nav screen 9 % off-view, 0 % occluded (—), 117 px tall

## Perf (quality high; draw calls / triangles from r3d.stats; ⚠ > 400 calls or > 1.5 M tris)

| route | start (world) | worst calls (world) | worst tris (world) | start (+traffic) | worst calls (+traffic) | worst tris (+traffic) |
|---|---|---|---|---|---|---|
| `bucharest-floreasca` rosetti | 305 / 1.16 M | 305 / 1.16 M (#0 2 m Calea Floreasca) | 254 / 1.23 M (#30 1202 m Strada Piotr Ilici Ceaikovski) | 350 / 1.25 M | 350 / 1.25 M (#0 2 m Calea Floreasca) | 323 / 1.29 M (#10 402 m Calea Floreasca) |
| `bucharest-floreasca` sweep-strada-mihail-ivanovici-glinka | 207 / 1.00 M | 207 / 1.00 M (#42 42 m Strada Mihail Ivanovici Glinka) | 207 / 1.00 M (#42 42 m Strada Mihail Ivanovici Glinka) | — | — | — |
| `bucharest-floreasca` sweep-strada-mihail-ivanovici-glinka-run-2 | 249 / 1.12 M | 249 / 1.12 M (#45 42 m Strada Mihail Ivanovici Glinka) | 249 / 1.12 M (#45 42 m Strada Mihail Ivanovici Glinka) | — | — | — |
| `bucharest-floreasca` sweep-bulevardul-mircea-eliade | 211 / 0.96 M | 211 / 0.96 M (#48 42 m Bulevardul Mircea Eliade) | 211 / 0.96 M (#48 42 m Bulevardul Mircea Eliade) | — | — | — |
| `bucharest-floreasca` sweep-bulevardul-mircea-eliade-run-2 | 261 / 1.10 M | 262 / 1.16 M (#52 82 m Bulevardul Mircea Eliade) | 262 / 1.16 M (#52 82 m Bulevardul Mircea Eliade) | — | — | — |
| `bucharest-grozavesti` upb | 292 / 1.19 M | 292 / 1.19 M (#54 2 m Șoseaua Orhideelor) | 292 / 1.19 M (#54 2 m Șoseaua Orhideelor) | 326 / 1.28 M | 332 / 1.20 M (#59 202 m Calea Giulești) | 326 / 1.28 M (#54 2 m Șoseaua Orhideelor) |
| `bucharest-grozavesti` sweep-oseaua-groz-ve-ti | 238 / 1.06 M | 238 / 1.06 M (#94 42 m Șoseaua Grozăvești) | 232 / 1.07 M (#95 82 m Șoseaua Grozăvești) | 257 / 1.16 M | 257 / 1.16 M (#98 202 m Șoseaua Grozăvești) | 257 / 1.16 M (#98 202 m Șoseaua Grozăvești) |
| `bucharest-grozavesti` sweep-oseaua-groz-ve-ti-run-2 | 277 / 1.14 M | 280 / 1.16 M (#106 202 m Șoseaua Grozăvești) | 280 / 1.16 M (#106 202 m Șoseaua Grozăvești) | 318 / 1.25 M | 318 / 1.25 M (#106 202 m Șoseaua Grozăvești) | 318 / 1.25 M (#106 202 m Șoseaua Grozăvești) |
| `bucharest-grozavesti` sweep-splaiul-independen-ei | 245 / 1.18 M | 245 / 1.18 M (#109 42 m Splaiul Independenței) | 245 / 1.18 M (#109 42 m Splaiul Independenței) | 245 / 1.11 M | 245 / 1.11 M (#113 202 m Splaiul Independenței) | 245 / 1.11 M (#113 202 m Splaiul Independenței) |
| `bucharest-grozavesti` sweep-splaiul-independen-ei-run-2 | 249 / 1.01 M | 255 / 1.10 M (#117 122 m Splaiul Independenței) | 255 / 1.10 M (#117 122 m Splaiul Independenței) | 262 / 1.12 M | 262 / 1.12 M (#119 202 m Splaiul Independenței) | 262 / 1.12 M (#119 202 m Splaiul Independenței) |
| `bucharest-romana` arnia | 204 / 0.92 M | 319 / 1.34 M (#173 2082 m Piața Victoriei) | 265 / 1.37 M (#157 1442 m Bulevardul Lascăr Catargiu) | 240 / 0.97 M | 355 / 1.40 M (#131 402 m Bulevardul General Gheorghe Magheru) | 354 / 1.41 M (#126 202 m Bulevardul General Gheorghe Magheru) |
| `bucharest-romana` uipath-buc | 297 / 1.30 M | 315 / 1.29 M (#188 482 m Piața Victoriei) | 277 / 1.45 M (#198 882 m Strada Clopotarii Vechi) | 328 / 1.35 M | 350 / 1.42 M (#186 402 m Piața Victoriei) | 341 / 1.47 M (#181 202 m Șoseaua Pavel Dimitrievici Kiseleff) |
| `bucharest-romana` sweep-bulevardul-iancu-de-hunedoara | 263 / 1.18 M | 270 / 1.19 M (#214 82 m Bulevardul Iancu de Hunedoara) | 258 / 1.27 M (#220 322 m Bulevardul Iancu de Hunedoara) | 297 / 1.33 M | 297 / 1.33 M (#217 202 m Bulevardul Iancu de Hunedoara) | 261 / 1.36 M (#222 402 m Bulevardul Iancu de Hunedoara) |
| `bucharest-romana` sweep-bulevardul-iancu-de-hunedoara-run-2 | 246 / 1.27 M | 293 / 1.32 M (#241 562 m Piața Victoriei) | 289 / 1.33 M (#240 522 m Piața Victoriei) | 277 / 1.21 M | 277 / 1.21 M (#232 202 m Bulevardul Iancu de Hunedoara) | 277 / 1.21 M (#232 202 m Bulevardul Iancu de Hunedoara) |
| `bucharest-romana` sweep-bulevardul-iancu-de-hunedoara-run-3 | 246 / 1.27 M | 246 / 1.27 M (#243 42 m Bulevardul Iancu de Hunedoara) | 246 / 1.27 M (#243 42 m Bulevardul Iancu de Hunedoara) | — | — | — |
| `bucharest-romana` sweep-strada-c-derea-bastiliei | 267 / 1.21 M | 267 / 1.21 M (#246 42 m Strada Căderea Bastiliei) | 267 / 1.21 M (#246 42 m Strada Căderea Bastiliei) | 266 / 1.14 M | 266 / 1.14 M (#250 202 m Strada Căderea Bastiliei) | 266 / 1.14 M (#250 202 m Strada Căderea Bastiliei) |
| `bucharest-romana` sweep-strada-c-derea-bastiliei-run-2 | 282 / 1.29 M | 282 / 1.29 M (#257 42 m Strada Căderea Bastiliei) | 282 / 1.29 M (#257 42 m Strada Căderea Bastiliei) | — | — | — |

## Hotspots (medium+ findings per 60 m cell)

| # | world | where | score | findings | seen in |
|---|---|---|---|---|---|
| 1 | bucharest-romana | Pasajul Victoria (-221.9, -447.9; 44.45233, 26.088408) | 15 | surface-above-road×5 | sweep-bulevardul-iancu-de-hunedoara-run-2 #234 (282 m, forward sheet 2) |
| 2 | bucharest-grozavesti | Șoseaua Orhideelor (169.4, -369.9; 44.444528, 26.061331) | 13 | ribbon-stacked×3, lifted-nonbridge×2 | upb #72 (722 m, forward sheet 4) |
| 3 | bucharest-romana | (service) (740, 793.1; 44.441164, 26.100512) | 8 | building-over-road×4 | arnia #125 (162 m, forward sheet 1) |
| 4 | bucharest-grozavesti | (service) (80.9, 188.3; 44.439506, 26.060218) | 6 | lifted-nonbridge×2 | sweep-oseaua-groz-ve-ti #101 (322 m, forward sheet 2) |
| 5 | bucharest-romana | Strada Grigore Alexandrescu (81.6, -379.7; 44.451716, 26.092227) | 6 | building-over-road×2 | uipath-buc #204 (1122 m, forward sheet 5) |
| 6 | bucharest-floreasca | Strada Căpitan Gheorghe Bulugea (-158.7, 321; 44.461511, 26.101802) | 4 | building-over-road×2 | rosetti #17 (682 m, forward sheet 3) |
| 7 | bucharest-romana | (service) (-286.9, -293.2; 44.450939, 26.08759) | 4 | building-over-road×2 | arnia #164 (1722 m, forward sheet 8) |
| 8 | bucharest-romana | (service) (19.3, -359.5; 44.451535, 26.091443) | 4 | building-over-road×2 | uipath-buc #202 (1042 m, forward sheet 5) |
| 9 | bucharest-romana | (service) (-124.6, -348.7; 44.451438, 26.089632) | 4 | building-over-road×2 | uipath-buc #199 (922 m, forward sheet 4) |
| 10 | bucharest-romana | Strada Căderea Bastiliei (320.2, -410.4; 44.451993, 26.095229) | 4 | building-over-road×2 | sweep-strada-c-derea-bastiliei #254 (362 m, forward sheet 2) |
| 11 | bucharest-romana | (service) (542.2, 195.4; 44.446541, 26.098023) | 4 | building-over-road×2 | arnia #141 (802 m, forward sheet 4) |
| 12 | bucharest-romana | (service) (270.6, -219.2; 44.450272, 26.094605) | 4 | building-over-road×2 | uipath-buc #211 (1402 m, forward sheet 6) |
| 13 | bucharest-floreasca | (service) (-271.3, 439.3; 44.460447, 26.100385) | 3 | building-over-road×1 | rosetti #13 (522 m, forward sheet 3) |
| 14 | bucharest-floreasca | Strada Giacomo Puccini (-89.5, -55; 44.464895, 26.102673) | 3 | building-over-road×1 | rosetti #26 (1042 m, forward sheet 5) |
| 15 | bucharest-floreasca | Strada Giacomo Puccini (-100.6, 23.4; 44.464189, 26.102534) | 3 | building-over-road×1 | rosetti #24 (962 m, forward sheet 5) |
| 16 | bucharest-floreasca | Strada Giacomo Puccini (-103.6, 43.3; 44.464011, 26.102495) | 3 | building-over-road×1 | sweep-strada-mihail-ivanovici-glinka #43 (82 m, forward sheet 1) |
| 17 | bucharest-floreasca | (service) (-163.7, 168.5; 44.462884, 26.10174) | 3 | building-over-road×1 | rosetti #20 (802 m, forward sheet 4) |
| 18 | bucharest-floreasca | Strada Cronicarilor (-267, 965.9; 44.455708, 26.100439) | 3 | building-over-road×1 | rosetti #0 (2 m, forward sheet 1) |
| 19 | bucharest-floreasca | Strada Cornescu (-308.4, 691.5; 44.458178, 26.099918) | 3 | building-over-road×1 | rosetti #7 (282 m, forward sheet 2) |
| 20 | bucharest-floreasca | Strada Albac (-304, 980.7; 44.455575, 26.099974) | 3 | building-over-road×1 | rosetti #0 (2 m, forward sheet 1) |
| 21 | bucharest-grozavesti | (service) (52.6, -155.6; 44.4426, 26.059862) | 3 | ribbon-zfight×2, ribbon-gap×1 | sweep-oseaua-groz-ve-ti #94 (42 m, forward sheet 1) |
| 22 | bucharest-grozavesti | (service) (-58.9, 17; 44.441047, 26.058459) | 3 | building-over-road×1 | upb #83 (1162 m, forward sheet 5) |
| 23 | bucharest-grozavesti | (service) (-177.3, 314.9; 44.438366, 26.05697) | 3 | building-over-road×1 | upb #90 (1442 m, forward sheet 7) |
| 24 | bucharest-grozavesti | (service) (107.2, -584.3; 44.446458, 26.060549) | 3 | building-over-road×1 | upb #66 (482 m, forward sheet 3) |
| 25 | bucharest-romana | Piața Victoriei (-365.3, -424.8; 44.452123, 26.086603) | 3 | road-hole×1 | arnia #168 (1882 m, forward sheet 8) |
| 26 | bucharest-romana | Bulevardul Iancu de Hunedoara (-364.6, -461.3; 44.452451, 26.086613) | 3 | surface-above-road×1 | sweep-bulevardul-iancu-de-hunedoara-run-2 #238 (442 m, forward sheet 2) |
| 27 | bucharest-romana | Pasajul Victoria (-180.8, -454.9; 44.452394, 26.088924) | 3 | surface-above-road×1 | sweep-bulevardul-iancu-de-hunedoara-run-2 #233 (242 m, forward sheet 1) |
| 28 | bucharest-romana | Strada George Enescu (501.9, 530.2; 44.443529, 26.097516) | 3 | building-over-road×1 | arnia #134 (522 m, forward sheet 3) |
| 29 | bucharest-romana | Strada George Enescu (592.6, 437.3; 44.444365, 26.098657) | 3 | building-over-road×1 | arnia #135 (562 m, forward sheet 3) |
| 30 | bucharest-romana | Strada Amiral Vasile Urseanu (125.4, -6.7; 44.44836, 26.092778) | 3 | building-over-road×1 | arnia #152 (1242 m, forward sheet 6) |
| 31 | bucharest-romana | (service) (-161.9, -344.5; 44.4514, 26.089163) | 3 | building-over-road×1 | arnia #163 (1682 m, forward sheet 8) |
| 32 | bucharest-romana | Strada General Gheorghe Manu (-49.9, -76.2; 44.448986, 26.090572) | 3 | building-over-road×1 | — |
| 33 | bucharest-romana | Strada Căderea Bastiliei (390, -189; 44.450001, 26.096108) | 3 | building-over-road×1 | sweep-strada-c-derea-bastiliei #248 (122 m, forward sheet 1) |
| 34 | bucharest-romana | Strada Visarion (295, 84.3; 44.447542, 26.094912) | 3 | building-over-road×1 | arnia #147 (1042 m, forward sheet 5) |
| 35 | bucharest-romana | Bulevardul General Gheorghe Magheru (532, 402.7; 44.444676, 26.097895) | 3 | road-sky-hole×1 | arnia #137 (642 m, forward sheet 3) |
| 36 | bucharest-grozavesti | Calea Plevnei (427.2, -700; 44.447499, 26.064575) | 2 | ribbon-stacked×1, surface-above-road×1 | upb #57 (122 m, forward sheet 1) |
| 37 | bucharest-romana | (service) (-81.6, -390.7; 44.451816, 26.090173) | 2 | building-over-road×2 | uipath-buc #198 (882 m, forward sheet 4) |
| 38 | bucharest-romana | Strada Căderea Bastiliei (339.6, -235.8; 44.450422, 26.095474) | 2 | building-over-road×2 | sweep-strada-c-derea-bastiliei #250 (202 m, forward sheet 1) |
| 39 | bucharest-floreasca | Strada Mihail Ivanovici Glinka (-112.7, 96.9; 44.463528, 26.102381) | 1 | surface-above-road×1 | sweep-strada-mihail-ivanovici-glinka-run-2 #45 (42 m, forward sheet 1) |
| 40 | bucharest-floreasca | Strada Giacomo Puccini (-81.4, -112.7; 44.465414, 26.102776) | 1 | building-over-road×1 | rosetti #30 (1202 m, forward sheet 6) |

## Findings

### `pad-overlap` (188)

- #171 **low** Calea Giulești [edge 572] runs 45.3 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (282.1, -758.7; 44.448027, 26.062749) [near upb #59 (202 m, forward sheet 1)] 
- #310 **low** Bulevardul Lascăr Catargiu [edge 557] runs 43.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bulevardul Lascăr Catargiu** (-373.1, -399; 44.451891, 26.086505) [near uipath-buc #189 (522 m, forward sheet 3)] 
- #282 **low** Piața Victoriei [edge 350] runs 43.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Piața Victoriei** (-436.9, -461.4; 44.452452, 26.085703) [near arnia #170 (1962 m, forward sheet 9)] 
- #278 **low** Piața Victoriei [edge 335] runs 40.7 m² into its own junction pad (4 mm apart → z-fight at range) @ **Piața Victoriei** (-445.1, -461.4; 44.452452, 26.0856) [near uipath-buc #186 (402 m, forward sheet 2)] 
- #270 **low** (service) [edge 1041] runs 34.2 m² into its own junction pad (4 mm apart → z-fight at range) @ **Piața Victoriei** (-380.4, -464.9; 44.452483, 26.086414) [near sweep-bulevardul-iancu-de-hunedoara-run-2 #238 (442 m, forward sheet 2)] 
- #283 **low** Piața Victoriei [edge 353] runs 31.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **Piața Victoriei** (-444.9, -464.2; 44.452477, 26.085601) [near uipath-buc #186 (402 m, forward sheet 2)] 
- #243 **low** Piața Victoriei [edge 165] runs 31 m² into its own junction pad (4 mm apart → z-fight at range) @ **Piața Victoriei** (-385, -439.9; 44.452258, 26.086356) ×3 [near sweep-bulevardul-iancu-de-hunedoara-run-2 #238 (442 m, forward sheet 2)] 
- #232 **low** Strada C. A. Rosetti [edge 94] runs 30.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada C. A. Rosetti** (694.7, 841.6; 44.440727, 26.099942) [near arnia #125 (162 m, forward sheet 1)] 
- #269 **low** Bulevardul Aviatorilor [edge 327] runs 28.3 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bulevardul Aviatorilor** (-407.5, -578.6; 44.453507, 26.086072) ×3 [near uipath-buc #184 (322 m, forward sheet 2)] 
- #281 **low** Piața Victoriei [edge 344] runs 27.1 m² into its own junction pad (4 mm apart → z-fight at range) @ **Piața Victoriei** (-391, -446.9; 44.452321, 26.086279) [near arnia #169 (1922 m, forward sheet 9)] 
- #346 **low** Piața Romană [edge 839] runs 26.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Piața Romană** (409.9, 141.4; 44.447028, 26.096358) ×5 [near arnia #144 (922 m, forward sheet 4)] 
- #183 **low** Calea Plevnei [edge 628] runs 26.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Calea Plevnei** (367.8, -680.5; 44.447324, 26.063828) ×2 [near upb #58 (162 m, forward sheet 1)] 
- #299 **low** (service) [edge 466] runs 25.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-462.2, -392.6; 44.451833, 26.085384) ×3 [near arnia #171 (2002 m, forward sheet 9)] 
- #286 **low** Piața Victoriei [edge 403] runs 24.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Piața Victoriei** (-514.9, -403.9; 44.451935, 26.084721) 
- #348 **low** Piața Romană [edge 850] runs 24.2 m² into its own junction pad (4 mm apart → z-fight at range) @ **Piața Romană** (422, 172.6; 44.446747, 26.096511) [near arnia #143 (882 m, forward sheet 4)] 
- #252 **low** Bretea [edge 203] runs 24.1 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (-472.2, -463.4; 44.452469, 26.085258) [near uipath-buc #186 (402 m, forward sheet 2)] 
- #355 **low** (service) [edge 920] runs 23.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-617.5, -901.8; 44.456414, 26.083429) [near uipath-buc #176 (2 m, forward sheet 1)] 
- #358 **low** (service) [edge 932] runs 23.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-597.7, -850.5; 44.455953, 26.083678) ×2 [near uipath-buc #176 (2 m, forward sheet 1)] 
- #359 **low** (service) [edge 942] runs 23.1 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-607.4, -904.3; 44.456437, 26.083557) [near uipath-buc #176 (2 m, forward sheet 1)] 
- #249 **low** Bretea [edge 193] runs 23 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (-462.7, -512.8; 44.452915, 26.085377) [near uipath-buc #185 (362 m, forward sheet 2)] 
- #156 **low** Șoseaua Orhideelor [edge 490] runs 22.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (306.7, -714.4; 44.447629, 26.063059) ×2 [near upb #59 (202 m, forward sheet 1)] 
- #42 **low** Bretea [edge 365] runs 21.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (-148.1, -139.7; 44.465657, 26.101936) [near rosetti #28 (1122 m, forward sheet 5)] 
- #188 **low** Calea Giulești [edge 706] runs 21.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Calea Giulești** (359.5, -682.5; 44.447341, 26.063723) [near upb #58 (162 m, forward sheet 1)] 
- #223 **low** Strada Pictor Arthur Verona [edge 31] runs 21.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Pictor Arthur Verona** (615.9, 618.2; 44.442737, 26.09895) [near arnia #131 (402 m, forward sheet 2)] 
- #39 **low** Strada Piotr Ilici Ceaikovski [edge 345] runs 21.7 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Piotr Ilici Ceaikovski** (-134.3, -168.6; 44.465917, 26.10211) [near rosetti #29 (1162 m, forward sheet 5)] 
- #181 **low** Șoseaua Orhideelor [edge 607] runs 21.3 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (314.7, -722.3; 44.447699, 26.063159) ×3 [near upb #59 (202 m, forward sheet 1)] 
- #94 **low** Șoseaua Orhideelor [edge 123] runs 21.2 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (136.1, -241.4; 44.443372, 26.060912) [near sweep-splaiul-independen-ei-run-2 #116 (82 m, forward sheet 1)] 
- #237 **low** Calea Victoriei [edge 142] runs 20.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Calea Victoriei** (-395.5, -389.9; 44.451809, 26.086224) ×4 [near arnia #172 (2042 m, forward sheet 9)] 
- #276 **low** Piața Victoriei [edge 334] runs 19.2 m² into its own junction pad (4 mm apart → z-fight at range) @ **Piața Victoriei** (-331.7, -402.1; 44.451918, 26.087026) ×2 [near arnia #167 (1842 m, forward sheet 8)] 
- #253 **low** Strada Monetăriei [edge 210] runs 19.1 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Monetăriei** (-559.3, -757.8; 44.455119, 26.084162) [near uipath-buc #178 (82 m, forward sheet 1)] 
- #245 **low** Bretea [edge 177] runs 18.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (-391.6, -483.3; 44.452648, 26.086272) [near sweep-bulevardul-iancu-de-hunedoara-run-2 #239 (482 m, forward sheet 2)] 
- #231 **low** Strada C. A. Rosetti [edge 93] runs 17.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada C. A. Rosetti** (670.4, 847.1; 44.440677, 26.099637) ×2 [near arnia #125 (162 m, forward sheet 1)] 
- #163 **low** Șoseaua Orhideelor [edge 526] runs 17 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (311.7, -710.1; 44.44759, 26.063121) [near upb #59 (202 m, forward sheet 1)] 
- #352 **low** Bulevardul Dacia [edge 895] runs 16.7 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bulevardul Dacia** (464.8, 187.6; 44.446611, 26.097048) [near arnia #142 (842 m, forward sheet 4)] 
- #77 **low** Splaiul Independenței [edge 40] runs 16.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Splaiul Independenței** (124.3, -179.2; 44.442813, 26.060764) ×2 [near sweep-splaiul-independen-ei #112 (162 m, forward sheet 1)] 
- #331 **low** Piața Romană [edge 714] runs 16 m² into its own junction pad (4 mm apart → z-fight at range) @ **Piața Romană** (425, 129.3; 44.447136, 26.096547) ×8 [near arnia #144 (922 m, forward sheet 4)] 
- #38 **low** Calea Floreasca [edge 342] runs 15.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **Calea Floreasca** (-140.2, -175; 44.465975, 26.102035) ×3 [near rosetti #29 (1162 m, forward sheet 5)] 
- #342 **low** Bulevardul Dacia [edge 819] runs 15.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bulevardul Dacia** (470.4, 145.2; 44.446993, 26.097119) ×4 [near arnia #143 (882 m, forward sheet 4)] 
- #35 **low** (service) [edge 331] runs 15.5 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-268.9, -190; 44.46611, 26.100415) [near sweep-bulevardul-mircea-eliade #50 (122 m, forward sheet 1)] 
- #45 **low** Bulevardul Mircea Eliade [edge 383] runs 15.5 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bulevardul Mircea Eliade** (-270, -185.8; 44.466072, 26.100401) [near sweep-bulevardul-mircea-eliade #50 (122 m, forward sheet 1)] 
- #21 **low** Strada Mihail Ivanovici Glinka [edge 158] runs 15.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Mihail Ivanovici Glinka** (-167.1, 86.3; 44.463623, 26.101696) ×2 [near sweep-strada-mihail-ivanovici-glinka #44 (122 m, forward sheet 1)] 
- #333 **low** Piața Romană [edge 719] runs 15 m² into its own junction pad (4 mm apart → z-fight at range) @ **Piața Romană** (457.9, 129.1; 44.447138, 26.096962) ×2 [near arnia #143 (882 m, forward sheet 4)] 
- #290 **low** Strada Grigore Alexandrescu [edge 415] runs 14.7 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Grigore Alexandrescu** (-193.6, -285.6; 44.45087, 26.088763) [near arnia #162 (1642 m, forward sheet 7)] 
- #33 **low** (service) [edge 310] runs 13.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-257.9, -181; 44.466029, 26.100554) [near sweep-bulevardul-mircea-eliade #50 (122 m, forward sheet 1)] 
- #40 **low** Bretea [edge 361] runs 13.7 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (-162.7, -166.1; 44.465895, 26.101752) ×3 [near sweep-bulevardul-mircea-eliade-run-2 #53 (122 m, forward sheet 1)] 
- #307 **low** (service) [edge 528] runs 12.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-429.4, -410.1; 44.45199, 26.085796) [near sweep-bulevardul-iancu-de-hunedoara-run-2 #241 (562 m, forward sheet 3)] 
- #10 **low** Strada Béla Bartók [edge 71] runs 12.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Béla Bartók** (-184.8, 225.4; 44.462372, 26.101473) [near rosetti #19 (762 m, forward sheet 4)] 
- #254 **low** Strada Amiral Vasile Urseanu [edge 218] runs 12.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Amiral Vasile Urseanu** (164.2, -29.9; 44.448569, 26.093267) [near arnia #151 (1202 m, forward sheet 6)] 
- #324 **low** Strada Biserica Amzei [edge 697] runs 12.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Biserica Amzei** (471.8, 273.4; 44.44584, 26.097137) [near arnia #140 (762 m, forward sheet 4)] 
- #120 **low** Strada Economu Cezărescu [edge 298] runs 12.2 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Economu Cezărescu** (48.5, -39.6; 44.441557, 26.05981) [near upb #80 (1042 m, forward sheet 5)] 
- #32 **low** Strada Serghei Vasilievici Rahmaninov [edge 290] runs 12 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Serghei Vasilievici Rahmaninov** (-10.2, -155.2; 44.465796, 26.103672) [near rosetti #32 (1282 m, forward sheet 6)] 
- #328 **low** Piața Romană [edge 705] runs 12 m² into its own junction pad (4 mm apart → z-fight at range) @ **Piața Romană** (439.9, 171.9; 44.446753, 26.096735) ×5 [near arnia #143 (882 m, forward sheet 4)] 
- #197 **low** Șoseaua Orhideelor [edge 781] runs 11.7 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (412.6, -726.4; 44.447737, 26.064391) [near upb #57 (122 m, forward sheet 1)] 
- #190 **low** Bretea [edge 714] runs 11.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (439.5, -706; 44.447552, 26.06473) [near upb #56 (82 m, forward sheet 1)] 
- #336 **low** Piața Romană [edge 735] runs 11.5 m² into its own junction pad (4 mm apart → z-fight at range) @ **Piața Romană** (442.2, 188.4; 44.446605, 26.096765) [near arnia #142 (842 m, forward sheet 4)] 
- #354 **low** Bulevardul Dacia [edge 906] runs 10.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bulevardul Dacia** (466.8, 164.6; 44.446819, 26.097075) [near arnia #143 (882 m, forward sheet 4)] 
- #5 **low** (service) [edge 409] runs 10.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Calea Floreasca** (-239.6, 1050.1; 44.454951, 26.100784) [near rosetti #0 (2 m, forward sheet 1)] 
- #99 **low** Șoseaua Grozăvești [edge 170] runs 10.7 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Grozăvești** (89.9, -181; 44.442829, 26.060331) [near sweep-splaiul-independen-ei #111 (122 m, forward sheet 1)] 
- #113 **low** Strada Alfabetului [edge 249] runs 10.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Alfabetului** (-104.4, 159.4; 44.439765, 26.057886) ×2 [near upb #86 (1282 m, forward sheet 6)] 
- #292 **low** Bretea [edge 420] runs 10.2 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (-301.3, -386.6; 44.451779, 26.087409) [near arnia #166 (1802 m, forward sheet 8)] 
- … 128 more in visual.json

### `ribbon-zfight` (132)

- #114 **medium** consecutive ribbons of (service) / (service) overlap at node 319: their corners are 0.3 m apart (mitre fallback) → doubled asphalt + crossing markings @ **(service)** (52.6, -155.6; 44.4426, 26.059862) ×5 [near sweep-oseaua-groz-ve-ti #94 (42 m, forward sheet 1)] [crop](issues/bucharest-grozavesti-geo-ribbon-zfight-53_-156.jpg)
- #201 **medium** consecutive ribbons of (service) / (service) overlap at node 323: their corners are 0.4 m apart (mitre fallback) → doubled asphalt + crossing markings @ **(service)** (64.5, -154.1; 44.442586, 26.060012) [near sweep-oseaua-groz-ve-ti #94 (42 m, forward sheet 1)] [crop](issues/bucharest-grozavesti-geo-ribbon-zfight-65_-154.jpg)
- #71 **low** Șoseaua Grozăvești [edge 13] and Bulevardul Doina Cornea [edge 136] overlap over 115.7 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Doina Cornea** (73, -99.9; 44.442099, 26.060118) ×7 [near sweep-oseaua-groz-ve-ti #95 (82 m, forward sheet 1)] 
- #297 **low** Pasajul Victoria [edge 460] and Bulevardul Iancu de Hunedoara [edge 680] overlap over 101.9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Pasajul Victoria** (-47.2, -454.1; 44.452387, 26.090606) [near sweep-bulevardul-iancu-de-hunedoara #219 (282 m, forward sheet 2)] 
- #234 **low** Bulevardul Iancu de Hunedoara [edge 138] and Bulevardul Iancu de Hunedoara [edge 258] overlap over 93.8 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Iancu de Hunedoara** (-54.4, -472; 44.452547, 26.090516) [near sweep-bulevardul-iancu-de-hunedoara-run-2 #230 (122 m, forward sheet 1)] 
- #161 **low** Șoseaua Orhideelor [edge 497] and Șoseaua Orhideelor [edge 520] overlap over 81.6 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (158.3, -648.2; 44.447033, 26.061192) [near upb #63 (362 m, forward sheet 2)] 
- #134 **low** Șoseaua Orhideelor [edge 363] and Șoseaua Orhideelor [edge 956] overlap over 51.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (151, -304.3; 44.443938, 26.0611) [near upb #73 (762 m, forward sheet 4)] 
- #274 **low** Piața Victoriei [edge 333] and Bulevardul Lascăr Catargiu [edge 558] overlap over 44.6 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Piața Victoriei** (-358.8, -398.9; 44.451889, 26.086685) ×2 [near uipath-buc #189 (522 m, forward sheet 3)] 
- #273 **low** Piața Victoriei [edge 333] and Bulevardul Lascăr Catargiu [edge 557] overlap over 39.6 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Piața Victoriei** (-367.5, -399.6; 44.451895, 26.086575) [near uipath-buc #189 (522 m, forward sheet 3)] 
- #108 **low** Splaiul Independenței [edge 208] and (service) [edge 362] overlap over 37.2 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **(service)** (184.1, -227.4; 44.443246, 26.061516) [near sweep-splaiul-independen-ei-run-2 #115 (42 m, forward sheet 1)] 
- #145 **low** Bulevardul Regiei [edge 467] and Bulevardul Regiei [edge 506] overlap over 35 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Regiei** (55, -615.2; 44.446736, 26.059892) ×2 [near upb #66 (482 m, forward sheet 3)] 
- #7 **low** Strada Aviator Stefan Protopopescu [edge 65] and junction pad (node 105, Strada Aviator Stefan Protopopescu × Calea Floreasca) overlap over 30.8 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Strada Aviator Stefan Protopopescu** (-183.9, 133.2; 44.463201, 26.101485) [near rosetti #21 (842 m, forward sheet 4)] 
- #78 **low** Bulevardul Doina Cornea [edge 803, bridge] and Pasajul Basarab [edge 914, bridge] overlap over 30.8 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Grozăvești** (84.6, -115.4; 44.442238, 26.060264) ×2 [near upb #78 (962 m, forward sheet 5)] 
- #179 **low** Șoseaua Orhideelor [edge 601] and Calea Giulești [edge 618] overlap over 30.8 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Calea Giulești** (353.9, -749.8; 44.447947, 26.063653) ×3 [near upb #58 (162 m, forward sheet 1)] 
- #13 **low** Strada George Călinescu [edge 100] and junction pad (node 148, Strada George Călinescu × Calea Floreasca) overlap over 24.2 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Strada George Călinescu** (-199.4, 260.1; 44.46206, 26.101291) [near rosetti #18 (722 m, forward sheet 4)] 
- #250 **low** Bretea [edge 194] and junction pad (node 226, Bretea × Piața Victoriei) overlap over 23.8 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (-464.5, -509.9; 44.452888, 26.085355) ×4 [near uipath-buc #185 (362 m, forward sheet 2)] 
- #98 **low** Șoseaua Orhideelor [edge 150] and Bretea [edge 174] overlap over 22.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (107.5, -271.3; 44.443641, 26.060552) ×2 [near upb #74 (802 m, forward sheet 4)] 
- #327 **low** Piața Romană [edge 704] and junction pad (node 754, Piața Romană × Bulevardul Dacia) overlap over 22.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Piața Romană** (440.3, 169.8; 44.446772, 26.096741) ×7 [near arnia #143 (882 m, forward sheet 4)] 
- #123 **low** Pasajul Basarab [edge 915, bridge] and Pasajul Basarab [edge 1045, bridge] overlap over 22.1 m² at the same height (Δy 0.02 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (358.7, -727.6; 44.447747, 26.063713) ×5 [near upb #58 (162 m, forward sheet 1)] 
- #107 **low** Bulevardul Doina Cornea [edge 207] and Bulevardul Doina Cornea [edge 1264, bridge] overlap over 21.1 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Doina Cornea** (-56.7, 91.7; 44.440375, 26.058487) [near upb #84 (1202 m, forward sheet 6)] 
- #160 **low** Șoseaua Orhideelor [edge 496] and Șoseaua Orhideelor [edge 520] overlap over 20.2 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (224.8, -669.6; 44.447226, 26.062029) [near upb #62 (322 m, forward sheet 2)] 
- #142 **low** Bulevardul Regiei [edge 465] and junction pad (node 621, Șoseaua Orhideelor × Bulevardul Regiei) overlap over 19.9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (84.1, -624.9; 44.446823, 26.060258) ×7 [near upb #65 (442 m, forward sheet 2)] 
- #34 **low** (service) [edge 311] and junction pad (node 337, (service) × Bulevardul Mircea Eliade) overlap over 19.8 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **(service)** (-258.4, -178.4; 44.466005, 26.100547) [near sweep-bulevardul-mircea-eliade #50 (122 m, forward sheet 1)] 
- #101 **low** Pasajul Basarab [edge 852, bridge] and Pasajul Basarab [edge 1418, bridge] overlap over 19.2 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Calea Giulești** (359, -694.4; 44.447449, 26.063717) ×4 [near upb #58 (162 m, forward sheet 1)] 
- #191 **low** Bretea [edge 715] and Calea Plevnei [edge 767] overlap over 19.1 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (435.7, -711.6; 44.447604, 26.064682) [near upb #56 (82 m, forward sheet 1)] 
- #84 **low** Șoseaua Orhideelor [edge 813] and Șoseaua Orhideelor [edge 215] overlap over 18.9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (120, -356.5; 44.444408, 26.06071) ×2 [near upb #72 (722 m, forward sheet 4)] 
- #345 **low** Piața Romană [edge 829] and Bulevardul Dacia [edge 906] overlap over 18.9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Dacia** (468.3, 164.8; 44.446817, 26.097093) ×8 [near arnia #143 (882 m, forward sheet 4)] 
- #146 **low** Bulevardul Regiei [edge 468] and Bulevardul Regiei [edge 505] overlap over 18.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Regiei** (38.1, -609.5; 44.446684, 26.05968) ×2 [near upb #66 (482 m, forward sheet 3)] 
- #271 **low** (service) [edge 1042] and junction pad (node 384, (service) × Piața Victoriei) overlap over 17.6 m² at the same height (Δy 0.03 m) → same asphalt colour (invisible unless markings cross) @ **Piața Victoriei** (-375.7, -465.7; 44.452491, 26.086472) [near sweep-bulevardul-iancu-de-hunedoara-run-2 #238 (442 m, forward sheet 2)] 
- #102 **low** Pasajul Basarab [edge 853, bridge] and Pasajul Basarab [edge 1419, bridge] overlap over 17.1 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (363.7, -698.7; 44.447487, 26.063776) ×4 [near upb #58 (162 m, forward sheet 1)] 
- #246 **low** Bretea [edge 178] and Piața Victoriei [edge 332] overlap over 15.5 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (-395, -491.6; 44.452723, 26.08623) ×4 [near sweep-bulevardul-iancu-de-hunedoara-run-2 #239 (482 m, forward sheet 2)] 
- #268 **low** Bulevardul Aviatorilor [edge 326] and junction pad (node 371, Bulevardul Aviatorilor × Strada Duiliu Zamfirescu × Piața Victoriei) overlap over 15.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Aviatorilor** (-404.9, -581; 44.453528, 26.086105) ×7 [near uipath-buc #184 (322 m, forward sheet 2)] 
- #279 **low** Piața Victoriei [edge 336] and Piața Victoriei [edge 353] overlap over 14.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Piața Victoriei** (-449, -462.3; 44.45246, 26.08555) ×2 [near uipath-buc #186 (402 m, forward sheet 2)] 
- #28 **low** Strada General Giuseppe Garibaldi [edge 240] and junction pad (node 333, Strada Piotr Ilici Ceaikovski × Strada General Giuseppe Garibaldi) overlap over 14.1 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Strada General Giuseppe Garibaldi** (176.9, -114.6; 44.465431, 26.106027) [near rosetti #37 (1482 m, forward sheet 7)] 
- #169 **low** Bretea [edge 559] and Calea Giulești [edge 574] overlap over 14 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (288.7, -739.6; 44.447855, 26.062832) [near upb #59 (202 m, forward sheet 1)] 
- #361 **low** junction pad (node 521, (service) × Piața Victoriei) and junction pad (node 600, (service) × Piața Victoriei) overlap over 12.9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **(service)** (-459.3, -404.2; 44.451937, 26.08542) [near arnia #171 (2002 m, forward sheet 9)] 
- #175 **low** Exit → Giulești [edge 1009, bridge] and Pasajul Basarab [edge 1141, bridge] overlap over 12.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (450.7, -780.9; 44.448227, 26.064871) ×5 [near upb #55 (42 m, forward sheet 1)] 
- #308 **low** (service) [edge 550] and junction pad (node 620, (service) × Strada Mexic) overlap over 12.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **(service)** (-87.6, -509.8; 44.452888, 26.090097) [near sweep-bulevardul-iancu-de-hunedoara-run-2 #231 (162 m, forward sheet 1)] 
- #332 **low** Piața Romană [edge 719] and Piața Romană [edge 841] overlap over 12 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Piața Romană** (454.7, 131.1; 44.44712, 26.096922) ×10 [near arnia #143 (882 m, forward sheet 4)] 
- #22 **low** Strada Bălănescu Rosetti [edge 166] and junction pad (node 211, Strada Bălănescu Rosetti × Calea Floreasca) overlap over 11.9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Strada Bălănescu Rosetti** (-236.5, 522.5; 44.459698, 26.100824) [near rosetti #11 (442 m, forward sheet 2)] 
- #236 **low** Calea Victoriei [edge 142] and Piața Victoriei [edge 354] overlap over 11.9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Calea Victoriei** (-393.9, -389.6; 44.451806, 26.086244) ×8 [near arnia #172 (2042 m, forward sheet 9)] 
- #285 **low** Piața Victoriei [edge 361] and Șoseaua Pavel Dimitrievici Kiseleff [edge 676] overlap over 11.8 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Piața Victoriei** (-459.4, -536.2; 44.453125, 26.085419) ×4 [near uipath-buc #184 (322 m, forward sheet 2)] 
- #189 **low** Bretea [edge 714] and Calea Plevnei [edge 767] overlap over 11.7 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (437.7, -708.1; 44.447572, 26.064707) [near upb #56 (82 m, forward sheet 1)] 
- #73 **low** Șoseaua Grozăvești [edge 17] and Bulevardul Doina Cornea [edge 80] overlap over 11.2 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Grozăvești** (71.1, -26.3; 44.441437, 26.060095) ×2 [near sweep-oseaua-groz-ve-ti #97 (162 m, forward sheet 1)] 
- #30 **low** Strada Puțul lui Zamfir [edge 245] and junction pad (node 268, Calea Floreasca × Strada Puțul lui Zamfir) overlap over 11 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Strada Puțul lui Zamfir** (-214.6, 367.4; 44.461094, 26.101099) [near rosetti #15 (602 m, forward sheet 3)] 
- #82 **low** Bulevardul Doina Cornea [edge 81] and Șoseaua Grozăvești [edge 145] overlap over 10.7 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Doina Cornea** (95.3, -44.6; 44.441601, 26.060399) ×4 [near sweep-oseaua-groz-ve-ti-run-2 #105 (162 m, forward sheet 1)] 
- #221 **low** Strada Jules Michelet [edge 16] and junction pad (node 18, Strada Jules Michelet × Bulevardul General Gheorghe Magheru) overlap over 10.1 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Strada Jules Michelet** (570.5, 485.2; 44.443934, 26.098378) ×4 [near arnia #134 (522 m, forward sheet 3)] 
- #261 **low** Bulevardul Iancu de Hunedoara [edge 258] and Bulevardul Iancu de Hunedoara [edge 601] overlap over 10 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Iancu de Hunedoara** (-77.7, -469.1; 44.452521, 26.090222) ×10 [near sweep-bulevardul-iancu-de-hunedoara-run-2 #230 (122 m, forward sheet 1)] 
- #280 **low** Piața Victoriei [edge 344] and Piața Victoriei [edge 660] overlap over 9.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Piața Victoriei** (-388.5, -453.4; 44.45238, 26.086312) ×2 [near arnia #169 (1922 m, forward sheet 9)] 
- #313 **low** Strada Grigore Alexandrescu [edge 566] and junction pad (node 516, Bulevardul Lascăr Catargiu × Strada Grigore Alexandrescu) overlap over 9.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Strada Grigore Alexandrescu** (-159.4, -287.3; 44.450885, 26.089194) [near arnia #162 (1642 m, forward sheet 7)] 
- #318 **low** Strada General Gheorghe Manu [edge 584] and Bretea [edge 592] overlap over 9.2 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (20.6, -109.8; 44.449288, 26.091459) ×4 [near arnia #156 (1402 m, forward sheet 6)] 
- #275 **low** Piața Victoriei [edge 333] and junction pad (node 395, Piața Victoriei × Bulevardul Iancu de Hunedoara × Bulevardul Lascăr Catargiu) overlap over 9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Piața Victoriei** (-335.1, -403.6; 44.451932, 26.086983) ×3 [near arnia #167 (1842 m, forward sheet 8)] 
- #289 **low** Strada Grigore Alexandrescu [edge 415] and Bulevardul Lascăr Catargiu [edge 605] overlap over 9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Strada Grigore Alexandrescu** (-196.3, -287.3; 44.450885, 26.08873) [near arnia #163 (1682 m, forward sheet 8)] 
- #239 **low** Piața Victoriei [edge 155] and Piața Victoriei [edge 349] overlap over 8.5 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Piața Victoriei** (-432.5, -455.8; 44.452402, 26.085758) ×2 [near arnia #170 (1962 m, forward sheet 9)] 
- #264 **low** Bulevardul Iancu de Hunedoara [edge 269] and Piața Victoriei [edge 419] overlap over 8.1 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Iancu de Hunedoara** (-360, -437.4; 44.452236, 26.08667) [near arnia #168 (1882 m, forward sheet 8)] 
- #347 **low** Piața Romană [edge 840] and junction pad (node 747, Piața Romană × Bulevardul Dacia) overlap over 8 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Piața Romană** (410.3, 143.8; 44.447006, 26.096362) ×23 [near arnia #144 (922 m, forward sheet 4)] 
- #287 **low** Piața Victoriei [edge 404] and junction pad (node 293, Șoseaua Nicolae Titulescu × Piața Victoriei × Strada Buzești) overlap over 7.9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Piața Victoriei** (-512.3, -406.7; 44.451959, 26.084753) 
- #17 **low** Strada Tudor Vianu [edge 122] and junction pad (node 46, Calea Floreasca × Strada Tudor Vianu) overlap over 7.6 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Strada Tudor Vianu** (-261.2, 703.4; 44.458071, 26.100512) [near rosetti #7 (282 m, forward sheet 2)] 
- #109 **low** Splaiul Independenței [edge 208] and (service) [edge 399] overlap over 7.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **(service)** (214.2, -220; 44.44318, 26.061895) ×2 [near sweep-splaiul-independen-ei-run-2 #115 (42 m, forward sheet 1)] 
- #168 **low** Bretea [edge 558] and Calea Giulești [edge 572] overlap over 7.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (284, -754.5; 44.447989, 26.062773) ×3 [near upb #59 (202 m, forward sheet 1)] 
- … 72 more in visual.json

### `building-over-road` (62)

- #207 **high** building footprint (h 14.5 m) covers 40.3 m² of (service) [edge 304] @ **(service)** (-58.9, 17; 44.441047, 26.058459) [near upb #83 (1162 m, forward sheet 5)] [crop](issues/bucharest-grozavesti-geo-building-over-road--59_17.jpg)
- #47 **high** building footprint (h 7.4 m) covers 33.1 m² of (service) [edge 234] @ **(service)** (-271.3, 439.3; 44.460447, 26.100385) [near rosetti #13 (522 m, forward sheet 3)] [crop](issues/bucharest-floreasca-geo-building-over-road--271_439.jpg)
- #400 **high** building footprint (h 12.9 m) covers 27.7 m² of Strada Căderea Bastiliei [edge 754] @ **Strada Căderea Bastiliei** (320.2, -410.4; 44.451993, 26.095229) [near sweep-strada-c-derea-bastiliei #254 (362 m, forward sheet 2)] [crop](issues/bucharest-romana-geo-building-over-road-320_-410.jpg)
- #393 **high** building footprint (h 12.4 m) covers 27.4 m² of (service) [edge 1053] @ **(service)** (46.3, -368.6; 44.451617, 26.091782) ×2 [near uipath-buc #203 (1082 m, forward sheet 5)] [crop](issues/bucharest-romana-geo-building-over-road-46_-369.jpg)
- #211 **high** building footprint (h 6.4 m) covers 24.5 m² of (service) [edge 311] @ **(service)** (-177.3, 314.9; 44.438366, 26.05697) [near upb #90 (1442 m, forward sheet 7)] [crop](issues/bucharest-grozavesti-geo-building-over-road--177_315.jpg)
- #48 **high** building footprint (h 11.6 m) covers 20.5 m² of Strada Giacomo Puccini [edge 102] @ **Strada Giacomo Puccini** (-89.5, -55; 44.464895, 26.102673) [near rosetti #26 (1042 m, forward sheet 5)] [crop](issues/bucharest-floreasca-geo-building-over-road--89_-55.jpg)
- #402 **high** building footprint (h 5.5 m) covers 19.4 m² of Strada Căderea Bastiliei [edge 748] @ **Strada Căderea Bastiliei** (390, -189; 44.450001, 26.096108) [near sweep-strada-c-derea-bastiliei #248 (122 m, forward sheet 1)] [crop](issues/bucharest-romana-geo-building-over-road-390_-189.jpg)
- #403 **high** building footprint (h 14 m) covers 19.4 m² of Strada Visarion [edge 689] @ **Strada Visarion** (295, 84.3; 44.447542, 26.094912) [near arnia #147 (1042 m, forward sheet 5)] [crop](issues/bucharest-romana-geo-building-over-road-295_84.jpg)
- #376 **high** building footprint (h 25.6 m) covers 18.4 m² of Strada George Enescu [edge 82] @ **Strada George Enescu** (501.9, 530.2; 44.443529, 26.097516) [near arnia #134 (522 m, forward sheet 3)] [crop](issues/bucharest-romana-geo-building-over-road-502_530.jpg)
- #51 **high** building footprint (h 12.5 m) covers 15.8 m² of Strada Giacomo Puccini [edge 102] @ **Strada Giacomo Puccini** (-103.6, 43.3; 44.464011, 26.102495) [near sweep-strada-mihail-ivanovici-glinka #43 (82 m, forward sheet 1)] [crop](issues/bucharest-floreasca-geo-building-over-road--104_43.jpg)
- #50 **high** building footprint (h 12.1 m) covers 15.5 m² of Strada Giacomo Puccini [edge 102] @ **Strada Giacomo Puccini** (-100.6, 23.4; 44.464189, 26.102534) [near rosetti #24 (962 m, forward sheet 5)] [crop](issues/bucharest-floreasca-geo-building-over-road--101_23.jpg)
- #375 **high** building footprint (h 16 m) covers 15.1 m² of (service) [edge 120] @ **(service)** (729.8, 795.1; 44.441146, 26.100383) ×2 [near arnia #126 (202 m, forward sheet 1)] [crop](issues/bucharest-romana-geo-building-over-road-730_795.jpg)
- #53 **high** building footprint (h 8.8 m) covers 14 m² of Strada Cronicarilor [edge 168] @ **Strada Cronicarilor** (-267, 965.9; 44.455708, 26.100439) [near rosetti #0 (2 m, forward sheet 1)] [crop](issues/bucharest-floreasca-geo-building-over-road--267_966.jpg)
- #409 **high** building footprint (h 12.8 m) covers 13.3 m² of (service) [edge 903] @ **(service)** (270.6, -219.2; 44.450272, 26.094605) [near uipath-buc #211 (1402 m, forward sheet 6)] [crop](issues/bucharest-romana-geo-building-over-road-271_-219.jpg)
- #379 **high** building footprint (h 27.7 m) covers 11.9 m² of Strada Amiral Vasile Urseanu [edge 220] @ **Strada Amiral Vasile Urseanu** (125.4, -6.7; 44.44836, 26.092778) [near arnia #152 (1242 m, forward sheet 6)] [crop](issues/bucharest-romana-geo-building-over-road-125_-7.jpg)
- #389 **high** building footprint (h 5.2 m) covers 11.5 m² of (service) [edge 1071] @ **Strada Grigore Alexandrescu** (81.6, -379.7; 44.451716, 26.092227) ×3 [near uipath-buc #204 (1122 m, forward sheet 5)] [crop](issues/bucharest-romana-geo-building-over-road-82_-380.jpg)
- #52 **high** building footprint (h 11.6 m) covers 10.8 m² of (service) [edge 212] @ **(service)** (-163.7, 168.5; 44.462884, 26.10174) [near rosetti #20 (802 m, forward sheet 4)] [crop](issues/bucharest-floreasca-geo-building-over-road--164_169.jpg)
- #394 **high** building footprint (h 12.8 m) covers 10.8 m² of Strada General Gheorghe Manu [edge 216] @ **Strada General Gheorghe Manu** (-49.9, -76.2; 44.448986, 26.090572) [crop](issues/bucharest-romana-geo-building-over-road--50_-76.jpg)
- #383 **high** building footprint (h 35.2 m) covers 9.7 m² of (service) [edge 286] @ **(service)** (-282.5, -287.3; 44.450885, 26.087645) [near arnia #164 (1722 m, forward sheet 8)] [crop](issues/bucharest-romana-geo-building-over-road--282_-287.jpg)
- #404 **high** building footprint (h 28.4 m) covers 9 m² of (service) [edge 811] @ **(service)** (542.2, 195.4; 44.446541, 26.098023) [near arnia #141 (802 m, forward sheet 4)] [crop](issues/bucharest-romana-geo-building-over-road-542_195.jpg)
- #384 **high** building footprint (h 7.3 m) covers 8.6 m² of (service) [edge 1052] @ **(service)** (19.3, -359.5; 44.451535, 26.091443) [near uipath-buc #202 (1042 m, forward sheet 5)] [crop](issues/bucharest-romana-geo-building-over-road-19_-359.jpg)
- #390 **high** building footprint (h 7.9 m) covers 7.2 m² of Intrarea Geneva [edge 364] @ **Intrarea Geneva** (-132.3, -389.3; 44.451803, 26.089535) [near sweep-bulevardul-iancu-de-hunedoara #217 (202 m, forward sheet 1)] [crop](issues/bucharest-romana-geo-building-over-road--132_-389.jpg)
- #373 **high** building footprint (h 16 m) covers 6.5 m² of (service) [edge 119] @ **(service)** (740.9, 786.9; 44.441219, 26.100523) [near arnia #126 (202 m, forward sheet 1)] [crop](issues/bucharest-romana-geo-building-over-road-741_787.jpg)
- #378 **high** building footprint (h 12.8 m) covers 6.5 m² of Strada George Enescu [edge 116] @ **Strada George Enescu** (592.6, 437.3; 44.444365, 26.098657) ×3 [near arnia #135 (562 m, forward sheet 3)] [crop](issues/bucharest-romana-geo-building-over-road-593_437.jpg)
- #55 **high** building footprint (h 7.7 m) covers 6.1 m² of Strada Cornescu [edge 143] @ **Strada Cornescu** (-308.4, 691.5; 44.458178, 26.099918) [near rosetti #7 (282 m, forward sheet 2)] [crop](issues/bucharest-floreasca-geo-building-over-road--308_692.jpg)
- #54 **high** building footprint (h 11.6 m) covers 6.1 m² of Strada Căpitan Gheorghe Bulugea [edge 76] @ **Strada Căpitan Gheorghe Bulugea** (-182.5, 317.9; 44.461539, 26.101503) ×3 [near rosetti #17 (682 m, forward sheet 3)] [crop](issues/bucharest-floreasca-geo-building-over-road--182_318.jpg)
- #56 **high** building footprint (h 11.6 m) covers 7.6 m² of Strada Albac [edge 3] @ **Strada Albac** (-304, 980.7; 44.455575, 26.099974) ×2 [near rosetti #0 (2 m, forward sheet 1)] [crop](issues/bucharest-floreasca-geo-building-over-road--304_981.jpg)
- #212 **high** building footprint (h 3 m) covers 50.4 m² of (service) [edge 529] @ **(service)** (107.2, -584.3; 44.446458, 26.060549) ×4 [near upb #66 (482 m, forward sheet 3)] [crop](issues/bucharest-grozavesti-geo-building-over-road-107_-584.jpg)
- #386 **high** building footprint (h 3 m) covers 21.2 m² of (service) [edge 494] @ **(service)** (-161.9, -344.5; 44.4514, 26.089163) ×2 [near arnia #163 (1682 m, forward sheet 8)] [crop](issues/bucharest-romana-geo-building-over-road--162_-344.jpg)
- #380 **medium** building footprint (h 14.5 m) covers 5.8 m² of (service) [edge 510] @ **(service)** (-81.6, -390.7; 44.451816, 26.090173) [near uipath-buc #198 (882 m, forward sheet 4)] [crop](issues/bucharest-romana-geo-building-over-road--82_-391.jpg)
- #371 **medium** building footprint (h 26.6 m) covers 5.4 m² of Bulevardul General Gheorghe Magheru [edge 125] @ **Bulevardul General Gheorghe Magheru** (662.3, 827.3; 44.440856, 26.099534) [near arnia #124 (122 m, forward sheet 1)] [crop](issues/bucharest-romana-geo-building-over-road-662_827.jpg)
- #413 **medium** building footprint (h 14.4 m) covers 5.4 m² of Strada Căderea Bastiliei [edge 751] @ **Strada Căderea Bastiliei** (353.8, -302; 44.451018, 26.095652) [near sweep-strada-c-derea-bastiliei #251 (242 m, forward sheet 1)] [crop](issues/bucharest-romana-geo-building-over-road-354_-302.jpg)
- #408 **medium** building footprint (h 25.6 m) covers 5 m² of Strada Visarion [edge 689] @ **Strada Visarion** (291.6, 91.1; 44.44748, 26.09487) [near arnia #147 (1042 m, forward sheet 5)] [crop](issues/bucharest-romana-geo-building-over-road-292_91.jpg)
- #411 **medium** building footprint (h 9.3 m) covers 5 m² of Intrarea Anasonului [edge 1112] @ **Strada Căderea Bastiliei** (362.8, -239.8; 44.450457, 26.095765) ×3 [near sweep-strada-c-derea-bastiliei #250 (202 m, forward sheet 1)] [crop](issues/bucharest-romana-geo-building-over-road-363_-240.jpg)
- #415 **medium** building footprint (h 7.2 m) covers 5 m² of Intrarea Căderea Bastiliei [edge 807] @ **Intrarea Căderea Bastiliei** (319.3, -334; 44.451305, 26.095218) [near sweep-strada-c-derea-bastiliei #252 (282 m, forward sheet 2)] [crop](issues/bucharest-romana-geo-building-over-road-319_-334.jpg)
- #372 **medium** building footprint (h 25.6 m) covers 4.3 m² of (service) [edge 119] @ **(service)** (740, 793.1; 44.441164, 26.100512) ×2 [near arnia #125 (162 m, forward sheet 1)] [crop](issues/bucharest-romana-geo-building-over-road-740_793.jpg)
- #209 **medium** building footprint (h 23.2 m) covers 4 m² of (service) [edge 820] @ **Strada Economu Cezărescu** (-115.1, 27.9; 44.440949, 26.057752) [crop](issues/bucharest-grozavesti-geo-building-over-road--115_28.jpg)
- #395 **medium** building footprint (h 8.5 m) covers 4 m² of Intrarea Geneva [edge 364] @ **Intrarea Geneva** (-136.3, -413.1; 44.452017, 26.089485) [near sweep-bulevardul-iancu-de-hunedoara #217 (202 m, forward sheet 1)] [crop](issues/bucharest-romana-geo-building-over-road--136_-413.jpg)
- #406 **medium** building footprint (h 28.8 m) covers 4 m² of (service) [edge 809] @ **(service)** (523, 173.5; 44.446739, 26.097781) [near arnia #142 (842 m, forward sheet 4)] [crop](issues/bucharest-romana-geo-building-over-road-523_174.jpg)
- #407 **medium** building footprint (h 15.7 m) covers 4 m² of Strada Nicolae Iorga [edge 443] @ **Strada Nicolae Iorga** (189.3, 81.3; 44.447569, 26.093582) ×2 [crop](issues/bucharest-romana-geo-building-over-road-189_81.jpg)
- #414 **medium** building footprint (h 9.8 m) covers 4 m² of Intrarea Moneasa [edge 729] @ **Intrarea Moneasa** (399.6, -63.4; 44.448871, 26.096228) [near sweep-strada-c-derea-bastiliei #246 (42 m, forward sheet 1)] [crop](issues/bucharest-romana-geo-building-over-road-400_-63.jpg)
- #381 **medium** building footprint (h 31.5 m) covers 3.2 m² of Strada Povernei [edge 578] @ **Strada Povernei** (137.8, -115.6; 44.449341, 26.092934) [near arnia #153 (1282 m, forward sheet 6)] [crop](issues/bucharest-romana-geo-building-over-road-138_-116.jpg)
- #388 **medium** building footprint (h 19.2 m) covers 3.2 m² of (service) [edge 1071] @ **Strada Grigore Alexandrescu** (151.2, -391.2; 44.45182, 26.093103) [near uipath-buc #205 (1162 m, forward sheet 5)] [crop](issues/bucharest-romana-geo-building-over-road-151_-391.jpg)
- #396 **medium** building footprint (h 15.6 m) covers 3.2 m² of (service) [edge 1090] @ **Strada Vasile Alecsandri** (223.3, -202.9; 44.450126, 26.09401) ×2 [near uipath-buc #212 (1442 m, forward sheet 7)] [crop](issues/bucharest-romana-geo-building-over-road-223_-203.jpg)
- #391 **medium** building footprint (h 12.4 m) covers 2.9 m² of (service) [edge 1067] @ **Strada Clopotarii Vechi** (-43.8, -398.8; 44.451889, 26.090649) [near uipath-buc #198 (882 m, forward sheet 4)] 
- #392 **medium** building footprint (h 12.4 m) covers 2.9 m² of (service) [edge 1051] @ **(service)** (-22.7, -359.6; 44.451536, 26.090914) [near uipath-buc #201 (1002 m, forward sheet 5)] 
- #398 **medium** building footprint (h 25.6 m) covers 2.9 m² of Strada Constantin Daniel [edge 766] @ **Strada Constantin Daniel** (207.2, -48.1; 44.448733, 26.093807) [near arnia #151 (1202 m, forward sheet 6)] 
- #399 **medium** building footprint (h 6.4 m) covers 2.9 m² of Strada Căderea Bastiliei [edge 743] @ **Strada Căderea Bastiliei** (416, -18.3; 44.448465, 26.096435) [near sweep-strada-c-derea-bastiliei-run-2 #259 (122 m, forward sheet 1)] 
- #385 **medium** building footprint (h 11.6 m) covers 2.2 m² of Strada Mexic [edge 686] @ **Strada Mexic** (-95.5, -551.9; 44.453266, 26.089998) 
- #377 **medium** building footprint (h 25.6 m) covers 1.8 m² of Strada George Enescu [edge 81] @ **Strada George Enescu** (521.6, 504.3; 44.443762, 26.097764) ×2 [near arnia #134 (522 m, forward sheet 3)] 
- #401 **medium** building footprint (h 11.6 m) covers 1.4 m² of Strada Căderea Bastiliei [edge 754] @ **Strada Căderea Bastiliei** (308, -443.7; 44.452293, 26.095075) [near sweep-strada-c-derea-bastiliei #255 (402 m, forward sheet 2)] 
- #410 **medium** building footprint (h 9.3 m) covers 1.4 m² of Intrarea Anasonului [edge 1110] @ **Strada Căderea Bastiliei** (339.6, -235.8; 44.450422, 26.095474) ×2 [near sweep-strada-c-derea-bastiliei #250 (202 m, forward sheet 1)] 
- #208 **medium** building footprint (h 11.6 m) covers 1.1 m² of (service) [edge 98] @ **(service)** (-175.1, 142.3; 44.43992, 26.056997) [near upb #87 (1322 m, forward sheet 6)] [crop](issues/bucharest-grozavesti-geo-building-over-road--175_142.jpg)
- #387 **medium** building footprint (h 3 m) covers 1.1 m² of (service) [edge 495] @ **(service)** (-124.6, -348.7; 44.451438, 26.089632) [near uipath-buc #199 (922 m, forward sheet 4)] 
- #412 **medium** building footprint (h 12.8 m) covers 1.1 m² of Intrarea Anasonului [edge 1108] @ **(service)** (317.5, -235.8; 44.450422, 26.095196) [near sweep-strada-c-derea-bastiliei #250 (202 m, forward sheet 1)] 
- #49 **medium** building footprint (h 11.6 m) covers 0.7 m² of Strada Căpitan Gheorghe Bulugea [edge 76] @ **Strada Căpitan Gheorghe Bulugea** (-158.7, 321; 44.461511, 26.101802) [near rosetti #17 (682 m, forward sheet 3)] [crop](issues/bucharest-floreasca-geo-building-over-road--159_321.jpg)
- #57 **medium** building footprint (h 9.3 m) covers 0.7 m² of Strada Giacomo Puccini [edge 102] @ **Strada Giacomo Puccini** (-81.4, -112.7; 44.465414, 26.102776) [near rosetti #30 (1202 m, forward sheet 6)] [crop](issues/bucharest-floreasca-geo-building-over-road--81_-113.jpg)
- #210 **medium** building footprint (h 9.6 m) covers 0.7 m² of (service) [edge 820] @ **Bulevardul Doina Cornea** (-100.3, 63.4; 44.440629, 26.057938) [near upb #84 (1202 m, forward sheet 6)] [crop](issues/bucharest-grozavesti-geo-building-over-road--100_63.jpg)
- #374 **medium** building footprint (h 16 m) covers 0.7 m² of (service) [edge 124] @ **(service)** (730.5, 779.5; 44.441286, 26.100393) [near arnia #126 (202 m, forward sheet 1)] 
- #382 **medium** building footprint (h 35.2 m) covers 0.7 m² of (service) [edge 285] @ **(service)** (-286.9, -293.2; 44.450939, 26.08759) [near arnia #164 (1722 m, forward sheet 8)] 
- … 2 more in visual.json

### `surface-above-road` (11)

- #364 **high** a sidewalk / light surface (y=0.06) lies 0.27 m above (service) [edge 1043] (y=-0.21) → a strip / slab across the carriageway @ **Bulevardul Iancu de Hunedoara** (-364.6, -461.3; 44.452451, 26.086613) [near sweep-bulevardul-iancu-de-hunedoara-run-2 #238 (442 m, forward sheet 2)] [crop](issues/bucharest-romana-geo-surface-above-road--365_-461.jpg)
- #365 **high** a sidewalk / light surface (y=0.37) lies 1.2 m above Pasajul Victoria [edge 256] (y=-0.83) → a strip / slab across the carriageway @ **Pasajul Victoria** (-221.9, -447.9; 44.45233, 26.088408) ×20 [near sweep-bulevardul-iancu-de-hunedoara-run-2 #234 (282 m, forward sheet 2)] [crop](issues/bucharest-romana-geo-surface-above-road--222_-448.jpg)
- #366 **high** a sidewalk / light surface (y=0.37) lies 2.47 m above Pasajul Victoria [edge 257] (y=-2.1) → a strip / slab across the carriageway @ **Pasajul Victoria** (-241.1, -445.3; 44.452307, 26.088166) ×5 [near sweep-bulevardul-iancu-de-hunedoara-run-2 #235 (322 m, forward sheet 2)] [crop](issues/bucharest-romana-geo-surface-above-road--241_-445.jpg)
- #367 **high** a sidewalk / light surface (y=0.14) lies 2.44 m above Pasajul Victoria [edge 455] (y=-2.3) → a strip / slab across the carriageway @ **Pasajul Victoria** (-241.2, -425.3; 44.452127, 26.088164) ×5 [near uipath-buc #192 (642 m, forward sheet 3)] [crop](issues/bucharest-romana-geo-surface-above-road--241_-425.jpg)
- #368 **high** a sidewalk / light surface (y=0.37) lies 2.09 m above Pasajul Victoria [edge 455] (y=-1.72) → a strip / slab across the carriageway @ **Pasajul Victoria** (-233.8, -424.3; 44.452118, 26.088258) ×18 [near uipath-buc #192 (642 m, forward sheet 3)] [crop](issues/bucharest-romana-geo-surface-above-road--234_-424.jpg)
- #369 **high** a sidewalk / light surface (y=0.37) lies 1.28 m above Pasajul Victoria [edge 456] (y=-0.91) → a strip / slab across the carriageway @ **Pasajul Victoria** (-210.8, -428.4; 44.452155, 26.088547) ×8 [near sweep-bulevardul-iancu-de-hunedoara #215 (122 m, forward sheet 1)] [crop](issues/bucharest-romana-geo-surface-above-road--211_-428.jpg)
- #370 **high** a sidewalk / light surface (y=0.15) lies 0.29 m above Pasajul Victoria [edge 256] (y=-0.14) → a strip / slab across the carriageway @ **Pasajul Victoria** (-180.8, -454.9; 44.452394, 26.088924) ×3 [near sweep-bulevardul-iancu-de-hunedoara-run-2 #233 (242 m, forward sheet 1)] [crop](issues/bucharest-romana-geo-surface-above-road--181_-455.jpg)
- #46 **medium** a kerb strip (y=0.37) lies 0.13 m above Strada Mihail Ivanovici Glinka [edge 159] (y=0.24) → a strip / slab across the carriageway @ **Strada Mihail Ivanovici Glinka** (-112.7, 96.9; 44.463528, 26.102381) [near sweep-strada-mihail-ivanovici-glinka-run-2 #45 (42 m, forward sheet 1)] [crop](issues/bucharest-floreasca-geo-surface-above-road--113_97.jpg)
- #203 **medium** a sidewalk / light surface (y=4.38) lies 0.17 m above Bretea [edge 1070, bridge] (y=4.21) → a strip / slab across the carriageway @ **Calea Plevnei** (427.9, -699.6; 44.447495, 26.064584) [near upb #57 (122 m, forward sheet 1)] [crop](issues/bucharest-grozavesti-geo-surface-above-road-428_-700.jpg)
- #204 **medium** a kerb strip (y=0.37) lies 0.13 m above junction pad (node 4, Splaiul Independenței × Podul Grozăvești × Șoseaua Orhideelor) (y=0.24) → a strip / slab across the carriageway @ **Splaiul Independenței** (95.6, -241.4; 44.443372, 26.060402) [near upb #75 (842 m, forward sheet 4)] [crop](issues/bucharest-grozavesti-geo-surface-above-road-96_-241.jpg)
- #206 **medium** a kerb strip (y=0.37) lies 0.13 m above junction pad (node 72, Bulevardul Doina Cornea × (service)) (y=0.24) → a strip / slab across the carriageway @ **Bulevardul Doina Cornea** (-91.5, 127.1; 44.440056, 26.058048) [near upb #86 (1282 m, forward sheet 6)] [crop](issues/bucharest-grozavesti-geo-surface-above-road--91_127.jpg)

### `canvas-text-overflow` (9)

- #419 **low** "Facultatea de Antreprenoriat, Ingineria și Managementul Afacerilor" squeezed to 55 % width by maxWidth 244 (natural 443 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:478) 
- #420 **low** "Sediul Central "Mihail Sadoveanu" - Biblioteca Metropolitană București" squeezed to 52 % width by maxWidth 244 (natural 473 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:478) 
- #421 **low** "Muzeul Național de Istorie Naturală "Grigore Antipa"" squeezed to 70 % width by maxWidth 244 (natural 348 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:478) 
- #422 **low** "Observatorul Astronomic Municipal "Amiral Vasile Urseanu" Bucuresti" squeezed to 52 % width by maxWidth 244 (natural 470 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:478) 
- #423 **low** "Spitalul Clinic de Urgență pentru Copii „Grigore Alexandrescu”" squeezed to 58 % width by maxWidth 244 (natural 420 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:478) 
- #424 **low** "Școala Națională de Studii Politice și Administrative" squeezed to 71 % width by maxWidth 244 (natural 345 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:478) 
- #425 **low** "Serviciul public comunitar pentru eliberarea și evidența pașapoartelor simple" squeezed to 48 % width by maxWidth 244 (natural 514 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:478) 
- #426 **low** "Școala Internațională Italiană „Aldo Moro” din București" squeezed to 65 % width by maxWidth 244 (natural 373 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:478) 
- #427 **low** "Biserica Voievodală "Izvorul Tămăduirii" Mavrogheni" squeezed to 70 % width by maxWidth 244 (natural 351 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:478) 

### `ribbon-stacked` (5)

- #129 **high** (primary) [edge 950] and Șoseaua Orhideelor [edge 366] overlap over 69.5 m² with only 2.34 m between them (spec R11.4: share one surface or ≥ 5 m clearance) → a visible stacked / stepped road surface @ **Șoseaua Orhideelor** (169.4, -369.9; 44.444528, 26.061331) [near upb #72 (722 m, forward sheet 4)] [crop](issues/bucharest-grozavesti-geo-ribbon-stacked-169_-370.jpg)
- #136 **high** Șoseaua Orhideelor [edge 365] and (primary) [edge 953] overlap over 20.3 m² with only 0.38 m between them (spec R11.4: share one surface or ≥ 5 m clearance) → a visible stacked / stepped road surface @ **Șoseaua Orhideelor** (161.8, -341.5; 44.444273, 26.061236) [near upb #72 (722 m, forward sheet 4)] [crop](issues/bucharest-grozavesti-geo-ribbon-stacked-162_-341.jpg)
- #137 **high** Șoseaua Orhideelor [edge 366] and (primary) [edge 953] overlap over 5.1 m² with only 0.87 m between them (spec R11.4: share one surface or ≥ 5 m clearance) → a visible stacked / stepped road surface @ **Șoseaua Orhideelor** (163.5, -347.6; 44.444328, 26.061257) [near upb #72 (722 m, forward sheet 4)] [crop](issues/bucharest-grozavesti-geo-ribbon-stacked-164_-348.jpg)
- #172 **medium** Bretea [edge 999, bridge] and Bretea [edge 1070, bridge] overlap over 3.3 m² with only 0.3 m between them (spec R11.4: share one surface or ≥ 5 m clearance) → a visible stacked / stepped road surface @ **Calea Plevnei** (427.2, -700; 44.447499, 26.064575) ×2 [near upb #57 (122 m, forward sheet 1)] [crop](issues/bucharest-grozavesti-geo-ribbon-stacked-427_-700.jpg)
- #272 **medium** (service) [edge 1048] and junction pad (node 392, (service)) overlap over 2.1 m² with only 0.29 m between them (spec R11.4: share one surface or ≥ 5 m clearance) → a visible stacked / stepped road surface @ **(service)** (-328.9, -471.1; 44.452539, 26.087061) ×2 [near sweep-bulevardul-iancu-de-hunedoara-run-2 #237 (402 m, forward sheet 2)] [crop](issues/bucharest-romana-geo-ribbon-stacked--329_-471.jpg)

### `lifted-nonbridge` (4)

- #213 **high** Pasajul Basarab (not a bridge or ramp) is lifted 3.9 m @ **(service)** (80.9, 188.3; 44.439506, 26.060218) [near sweep-oseaua-groz-ve-ti #101 (322 m, forward sheet 2)] [crop](issues/bucharest-grozavesti-geo-lifted-nonbridge-81_188.jpg)
- #214 **high** Pasajul Basarab (not a bridge or ramp) is lifted 5.3 m @ **Șoseaua Grozăvești** (78.2, 165.1; 44.439714, 26.060184) ×2 [near sweep-oseaua-groz-ve-ti #101 (322 m, forward sheet 2)] [crop](issues/bucharest-grozavesti-geo-lifted-nonbridge-78_165.jpg)
- #215 **high** primary (not a bridge or ramp) is lifted 5.8 m @ **Șoseaua Orhideelor** (170.7, -386.8; 44.44468, 26.061348) [near upb #71 (682 m, forward sheet 3)] [crop](issues/bucharest-grozavesti-geo-lifted-nonbridge-171_-387.jpg)
- #216 **medium** primary (not a bridge or ramp) is lifted 1 m @ **Șoseaua Orhideelor** (159.6, -343.5; 44.444291, 26.061209) [near upb #72 (722 m, forward sheet 4)] [crop](issues/bucharest-grozavesti-geo-lifted-nonbridge-160_-343.jpg)

### `hud-overlap` (3)

- #61 **high** HUD street and bottom-right overlap (38 % of the smaller) at 390×844 [390x844] 
- #60 **medium** HUD top-left and hint overlap (14 % of the smaller) at 390×844 [390x844] 
- #62 **medium** HUD street and hint overlap (14 % of the smaller) at 390×844 [390x844] 

### `road-hole` (3)

- #362 **high** the driven lane is not covered by any carriageway or junction pad here (hole in the road: ground / sky shows through) @ **Piața Victoriei** (-365.3, -424.8; 44.452123, 26.086603) [near arnia #168 (1882 m, forward sheet 8)] [crop](issues/bucharest-romana-geo-road-hole--365_-425.jpg)
- #202 **low** the surveyed lane runs past the district's map end here (route planned through the end-of-map barrier) @ **Splaiul Independenței** (229, -209.3; 44.443083, 26.062081) [near sweep-splaiul-independen-ei-run-2 #115 (42 m, forward sheet 1)] 
- #363 **low** the surveyed lane runs past the district's map end here (route planned through the end-of-map barrier) @ **Bulevardul Iancu de Hunedoara** (59.7, -484.1; 44.452656, 26.091952) ×2 [near sweep-bulevardul-iancu-de-hunedoara #222 (402 m, forward sheet 2)] 

### `road-sky-hole` (3)

- #416 **high** 14 % of the lane ahead is sky-coloured — a hole in the road surface @ **Bulevardul General Gheorghe Magheru** (532, 402.7; 44.444676, 26.097895) [arnia #136] [crop](issues/bucharest-romana-arnia-136-road-sky-hole.jpg) [frame](frames/bucharest-romana-arnia-0136.jpg)
- #417 **medium** 4 % of the lane ahead is sky-coloured — a hole in the road surface @ **Piața Victoriei** (-409.4, -417.9; 44.45206, 26.086048) [uipath-buc #187] [crop](issues/bucharest-romana-uipath-buc-187-road-sky-hole.jpg) [frame](frames/bucharest-romana-uipath-buc-0187.jpg)
- #418 **medium** 3 % of the lane ahead is sky-coloured — a hole in the road surface @ **Bulevardul Iancu de Hunedoara** (-319.8, -441.7; 44.452274, 26.087176) [sweep-bulevardul-iancu-de-hunedoara-run-2 #236] [crop](issues/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-run-2-236-road-sky-hole.jpg) [frame](frames/bucharest-romana-sweep-bulevardul-iancu-de-hunedoara-run-2-0236.jpg)

### `cockpit-screen-offscreen` (2)

- #58 **high** 13 % of the nav screen is outside the view at 390×844 (its on-screen box 228, 555, 424, 680) [390x844] 
- #64 **medium** 9 % of the nav screen is outside the view at 390×844 (its on-screen box 226, 547, 410, 664) [390x844-touch] 

### `hud-offscreen` (1)

- #59 **high** HUD hint extends 116 px past the 390×844 viewport (box 186, -116, 204, 830) [390x844] 

### `hud-covers-cockpit` (1)

- #63 **medium** HUD hint covers 9 % of the instrument cluster at 390×844 [390x844] 

### `ribbon-gap` (1)

- #200 **medium** gap of 0.4 m between consecutive ribbons of (service) and (service) at node 322 (grass / sidewalk shows through the road) @ **(service)** (63.6, -153.4; 44.44258, 26.060001) [near sweep-oseaua-groz-ve-ti #94 (42 m, forward sheet 1)] [crop](issues/bucharest-grozavesti-geo-ribbon-gap-64_-153.jpg)

### `marking-floating` (1)

- #205 **medium** road marking floats 0.14 m above the road surface under it (Șoseaua Grozăvești [edge 142]) @ **Șoseaua Grozăvești** (123.2, -172.7; 44.442754, 26.06075) ×2 [near sweep-splaiul-independen-ei #112 (162 m, forward sheet 1)] [crop](issues/bucharest-grozavesti-geo-marking-floating-123_-173.jpg)

### `zfight` (1)

- #217 **medium** flicker: 4 screen blocks change between two renders 1 mm apart (coplanar surfaces fighting) @ **Șoseaua Grozăvești** (73.1, -98.5; 44.442086, 26.06012) [upb #78] [crop](issues/bucharest-grozavesti-upb-78-zfight.jpg) [frame](frames/bucharest-grozavesti-upb-0078.jpg)
