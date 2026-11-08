# Visual QA — 2026-11-08 18:51 UTC

Run: `--visual --city=bucharest --district=grozavesti --viewports=none --quality=high --traffic-every=200 --jobs=1 --root=/workspace/integration-qa-evidence/groz-seams/candidate6-source --out=/workspace/integration-qa-evidence/groz-seams/full-visual-after6` · 4360 min · quality high, day, clear, far game, traffic shots every 200 m, forward every 40 m, looks/aerial every 200/200 m, z-fight test every 3 sample(s).

Capture coverage: **INCOMPLETE** — 48/48 required route samples captured; 0 missing; 1 capture/runtime errors.

This run is incomplete and cannot establish a passing visual review or frame-budget result. Detector severities below remain the raw findings; a tool timeout is not itself a game defect.

- Capture/runtime error (bucharest): sweep-splaiul-independen-ei: required route could not be sampled

Human review: [review.md](review.md).

## Findings by detector

| detector | high | medium | low | total |
|---|---|---|---|---|
| `pad-overlap` | 0 | 0 | 68 | 68 |
| `ribbon-zfight` | 0 | 2 | 57 | 59 |
| `building-over-road` | 3 | 3 | 0 | 6 |
| `ribbon-stacked` | 3 | 1 | 0 | 4 |
| `lifted-nonbridge` | 3 | 1 | 0 | 4 |
| `surface-above-road` | 0 | 3 | 0 | 3 |
| `canvas-text-overflow` | 0 | 1 | 1 | 2 |
| `route-missing` | 1 | 0 | 0 | 1 |
| `ribbon-gap` | 0 | 1 | 0 | 1 |
| `marking-floating` | 0 | 1 | 0 | 1 |

## bucharest (chapters)

- world `bucharest-grozavesti` district grozavesti: 801 edges, 1714 ribbons, loaded in 10.3 s
- time: load 10 s, geometry 0 s, survey 236 s, focus 7 s, offices 4 s
- page errors (1): `sweep-splaiul-independen-ei: required route could not be sampled`

| route | length | samples | flagged | wall |
|---|---|---|---|---|
| `upb` 2013 Politehnica | 1573 m | 40 | 0 | 202 s |
| `sweep-oseaua-groz-ve-ti` main street: Șoseaua Grozăvești | 344 m | 8 | 0 | 34 s |

### Contact sheets

- **bucharest-grozavesti · 2013 Politehnica · forward view every 40 m · day**: [1](sheets/bucharest-grozavesti-upb-forward-001.jpg) [2](sheets/bucharest-grozavesti-upb-forward-002.jpg) [3](sheets/bucharest-grozavesti-upb-forward-003.jpg) [4](sheets/bucharest-grozavesti-upb-forward-004.jpg) [5](sheets/bucharest-grozavesti-upb-forward-005.jpg) [6](sheets/bucharest-grozavesti-upb-forward-006.jpg) [7](sheets/bucharest-grozavesti-upb-forward-007.jpg)
- **bucharest-grozavesti · 2013 Politehnica · left / right / back every 200 m**: [1](sheets/bucharest-grozavesti-upb-looks-001.jpg) [2](sheets/bucharest-grozavesti-upb-looks-002.jpg) [3](sheets/bucharest-grozavesti-upb-looks-003.jpg) [4](sheets/bucharest-grozavesti-upb-looks-004.jpg)
- **bucharest-grozavesti · 2013 Politehnica · top-down 120 m tiles every 200 m (car at centre, driving up; circles = geometry findings)**: [1](sheets/bucharest-grozavesti-upb-aerial-001.jpg) [2](sheets/bucharest-grozavesti-upb-aerial-002.jpg)
- **bucharest-grozavesti · 2013 Politehnica · with traffic + pedestrians every 200 m · day**: [1](sheets/bucharest-grozavesti-upb-traffic-001.jpg) [2](sheets/bucharest-grozavesti-upb-traffic-002.jpg)
- **bucharest-grozavesti · main street: Șoseaua Grozăvești · forward view every 40 m · day**: [1](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-forward-001.jpg) [2](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-forward-002.jpg)
- **bucharest-grozavesti · main street: Șoseaua Grozăvești · left / right / back every 200 m**: [1](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-looks-001.jpg)
- **bucharest-grozavesti · main street: Șoseaua Grozăvești · top-down 120 m tiles every 200 m (car at centre, driving up; circles = geometry findings)**: [1](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-aerial-001.jpg)
- **bucharest-grozavesti · main street: Șoseaua Grozăvești · with traffic + pedestrians every 200 m · day**: [1](sheets/bucharest-grozavesti-sweep-oseaua-groz-ve-ti-traffic-001.jpg)
- **bucharest-grozavesti · geometry findings (40 m top-down, north up)**: [1](sheets/bucharest-grozavesti-geometry-001.jpg) [2](sheets/bucharest-grozavesti-geometry-002.jpg) [3](sheets/bucharest-grozavesti-geometry-003.jpg) [4](sheets/bucharest-grozavesti-geometry-004.jpg)
- **bucharest · office lobbies (entrance view + lobby sign close-up)**: [1](sheets/offices-bucharest-001.jpg) [2](sheets/offices-bucharest-002.jpg) [3](sheets/offices-bucharest-003.jpg)

## Perf (quality high; draw calls / triangles from r3d.stats; ⚠ > 400 calls or > 1.5 M tris)

| route | start (world) | worst calls (world) | worst tris (world) | start (+traffic) | worst calls (+traffic) | worst tris (+traffic) |
|---|---|---|---|---|---|---|
| `bucharest-grozavesti` upb | 287 / 1.17 M | 287 / 1.17 M (#0 2 m Șoseaua Orhideelor) | 287 / 1.17 M (#0 2 m Șoseaua Orhideelor) | 321 / 1.26 M | 330 / 1.20 M (#5 202 m Calea Giulești) | 321 / 1.26 M (#0 2 m Șoseaua Orhideelor) |
| `bucharest-grozavesti` sweep-oseaua-groz-ve-ti | 237 / 1.06 M | 237 / 1.06 M (#40 42 m Șoseaua Grozăvești) | 231 / 1.07 M (#41 82 m Șoseaua Grozăvești) | 256 / 1.16 M | 256 / 1.16 M (#44 202 m Șoseaua Grozăvești) | 256 / 1.16 M (#44 202 m Șoseaua Grozăvești) |

## Hotspots (medium+ findings per 60 m cell)

| # | world | where | score | findings | seen in |
|---|---|---|---|---|---|
| 1 | bucharest-grozavesti | Șoseaua Orhideelor (169.4, -369.9; 44.444528, 26.061331) | 13 | ribbon-stacked×3, lifted-nonbridge×2 | upb #18 (722 m, forward sheet 4) |
| 2 | bucharest-grozavesti | (service) (80.9, 188.3; 44.439506, 26.060218) | 6 | lifted-nonbridge×2 | sweep-oseaua-groz-ve-ti #47 (322 m, forward sheet 2) |
| 3 | bucharest-grozavesti | Splaiul Independenței (-22.1, -277; 44.443692, 26.058922) | 3 | route-missing×1 | — |
| 4 | bucharest-grozavesti | (service) (52.6, -155.6; 44.4426, 26.059862) | 3 | ribbon-zfight×2, ribbon-gap×1 | sweep-oseaua-groz-ve-ti #40 (42 m, forward sheet 1) |
| 5 | bucharest-grozavesti | (service) (-58.9, 17; 44.441047, 26.058459) | 3 | building-over-road×1 | upb #29 (1162 m, forward sheet 5) |
| 6 | bucharest-grozavesti | (service) (-177.3, 314.9; 44.438366, 26.05697) | 3 | building-over-road×1 | upb #36 (1442 m, forward sheet 7) |
| 7 | bucharest-grozavesti | (service) (107.2, -584.3; 44.446458, 26.060549) | 3 | building-over-road×1 | upb #12 (482 m, forward sheet 3) |
| 8 | bucharest-grozavesti | Calea Plevnei (427.2, -700; 44.447499, 26.064575) | 2 | ribbon-stacked×1, surface-above-road×1 | upb #3 (122 m, forward sheet 1) |
| 9 | bucharest-grozavesti | Splaiul Independenței (95.6, -241.4; 44.443372, 26.060402) | 1 | surface-above-road×1 | upb #21 (842 m, forward sheet 4) |
| 10 | bucharest-grozavesti | Șoseaua Grozăvești (123.2, -172.7; 44.442754, 26.06075) | 1 | marking-floating×1 | upb #22 (882 m, forward sheet 4) |
| 11 | bucharest-grozavesti | Bulevardul Doina Cornea (-91.5, 127.1; 44.440056, 26.058048) | 1 | surface-above-road×1 | upb #32 (1282 m, forward sheet 6) |
| 12 | bucharest-grozavesti | (service) (-175.1, 142.3; 44.43992, 26.056997) | 1 | building-over-road×1 | upb #33 (1322 m, forward sheet 6) |
| 13 | bucharest-grozavesti | Strada Economu Cezărescu (-115.1, 27.9; 44.440949, 26.057752) | 1 | building-over-road×1 | — |
| 14 | bucharest-grozavesti | Bulevardul Doina Cornea (-100.3, 63.4; 44.440629, 26.057938) | 1 | building-over-road×1 | upb #30 (1202 m, forward sheet 6) |

## Findings

### `pad-overlap` (68)

- #103 **low** Calea Giulești [edge 572] runs 45.3 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (282.1, -758.7; 44.448027, 26.062749) [near upb #5 (202 m, forward sheet 1)] 
- #115 **low** Calea Plevnei [edge 628] runs 26.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Calea Plevnei** (367.8, -680.5; 44.447324, 26.063828) ×2 [near upb #4 (162 m, forward sheet 1)] 
- #88 **low** Șoseaua Orhideelor [edge 490] runs 22.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (306.7, -714.4; 44.447629, 26.063059) ×2 [near upb #5 (202 m, forward sheet 1)] 
- #120 **low** Calea Giulești [edge 706] runs 21.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Calea Giulești** (359.5, -682.5; 44.447341, 26.063723) [near upb #4 (162 m, forward sheet 1)] 
- #113 **low** Șoseaua Orhideelor [edge 607] runs 21.3 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (314.7, -722.3; 44.447699, 26.063159) ×3 [near upb #5 (202 m, forward sheet 1)] 
- #30 **low** Șoseaua Orhideelor [edge 123] runs 21.2 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (136.1, -241.4; 44.443372, 26.060912) [near upb #21 (842 m, forward sheet 4)] 
- #95 **low** Șoseaua Orhideelor [edge 526] runs 17 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (311.7, -710.1; 44.44759, 26.063121) [near upb #5 (202 m, forward sheet 1)] 
- #13 **low** Splaiul Independenței [edge 40] runs 16.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Splaiul Independenței** (124.3, -179.2; 44.442813, 26.060764) ×2 [near upb #22 (882 m, forward sheet 4)] 
- #54 **low** Strada Economu Cezărescu [edge 298] runs 12.2 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Economu Cezărescu** (48.5, -39.6; 44.441557, 26.05981) [near upb #26 (1042 m, forward sheet 5)] 
- #129 **low** Șoseaua Orhideelor [edge 781] runs 11.7 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (412.6, -726.4; 44.447737, 26.064391) [near upb #3 (122 m, forward sheet 1)] 
- #122 **low** Bretea [edge 714] runs 11.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (439.5, -706; 44.447552, 26.06473) [near upb #2 (82 m, forward sheet 1)] 
- #35 **low** Șoseaua Grozăvești [edge 170] runs 10.7 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Grozăvești** (89.9, -181; 44.442829, 26.060331) [near upb #22 (882 m, forward sheet 4)] 
- #48 **low** Strada Alfabetului [edge 249] runs 10.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Alfabetului** (-104.4, 159.4; 44.439765, 26.057886) ×2 [near upb #32 (1282 m, forward sheet 6)] 
- #130 **low** (service) [edge 792] runs 9.3 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (231.8, -723.2; 44.447707, 26.062116) [near upb #7 (282 m, forward sheet 2)] 
- #41 **low** Bretea [edge 200] runs 9.1 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (66.3, 9.8; 44.441112, 26.060034) [near sweep-oseaua-groz-ve-ti #44 (202 m, forward sheet 1)] 
- #128 **low** (service) [edge 740] runs 8.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (249.2, -728.7; 44.447757, 26.062335) [near upb #6 (242 m, forward sheet 2)] 
- #118 **low** Șoseaua Orhideelor [edge 647] runs 8.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (371.1, -749.9; 44.447948, 26.06387) ×2 [near upb #3 (122 m, forward sheet 1)] 
- #23 **low** Bulevardul Doina Cornea [edge 83] runs 7.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bulevardul Doina Cornea** (49.9, -37; 44.441533, 26.059828) [near upb #26 (1042 m, forward sheet 5)] 
- #86 **low** Șoseaua Orhideelor [edge 958] runs 7.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (141.6, -451; 44.445258, 26.060981) [near upb #16 (642 m, forward sheet 3)] 
- #45 **low** (service) [edge 231] runs 6.7 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-296.8, 350.7; 44.438044, 26.055466) [near upb #39 (1562 m, forward sheet 7)] 
- #112 **low** Șoseaua Orhideelor [edge 601] runs 6.5 m² into its own junction pad (4 mm apart → z-fight at range) @ **Calea Giulești** (358, -747; 44.447922, 26.063704) ×3 [near upb #4 (162 m, forward sheet 1)] 
- #39 **low** Pasajul Basarab [edge 853, bridge] runs 6.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (364, -701.1; 44.447508, 26.06378) ×3 [near upb #4 (162 m, forward sheet 1)] 
- #40 **low** Bretea [edge 195] runs 6.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (50.9, 1.5; 44.441187, 26.05984) [near sweep-oseaua-groz-ve-ti #44 (202 m, forward sheet 1)] 
- #60 **low** (service) [edge 319] runs 5.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (113.6, -311.7; 44.444005, 26.060629) [near upb #19 (762 m, forward sheet 4)] 
- #6 **low** Strada Sergent Constantin Ghercu [edge 11] runs 5.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Sergent Constantin Ghercu** (95.6, -475.1; 44.445475, 26.060403) ×2 [near upb #15 (602 m, forward sheet 3)] 
- #10 **low** Șoseaua Grozăvești [edge 17] runs 5.5 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Grozăvești** (68.9, -24.4; 44.441419, 26.060067) ×4 [near sweep-oseaua-groz-ve-ti #43 (162 m, forward sheet 1)] 
- #52 **low** (service) [edge 277] runs 5.5 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (58, -285.6; 44.44377, 26.059929) ×2 [near upb #20 (802 m, forward sheet 4)] 
- #126 **low** (service) [edge 722] runs 5.1 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (201.9, -669; 44.44722, 26.06174) [near upb #8 (322 m, forward sheet 2)] 
- #25 **low** Podul Grozăvești [edge 89] runs 5 m² into its own junction pad (4 mm apart → z-fight at range) @ **Podul Grozăvești** (132, -232.7; 44.443294, 26.060861) [near upb #21 (842 m, forward sheet 4)] 
- #29 **low** Intrarea Tipografiei [edge 114] runs 5 m² into its own junction pad (4 mm apart → z-fight at range) @ **Intrarea Tipografiei** (30.7, -46.5; 44.441618, 26.059586) ×2 [near upb #26 (1042 m, forward sheet 5)] 
- #76 **low** Bulevardul Regiei [edge 465] runs 5 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bulevardul Regiei** (86.6, -628.4; 44.446855, 26.06029) ×4 [near upb #11 (442 m, forward sheet 2)] 
- #82 **low** Șoseaua Orhideelor [edge 471] runs 5 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (89, -625.6; 44.446829, 26.06032) ×5 [near upb #11 (442 m, forward sheet 2)] 
- #56 **low** (service) [edge 909] runs 4.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (112.8, -367; 44.444502, 26.060619) [near upb #18 (722 m, forward sheet 4)] 
- #47 **low** Strada Alfabetului [edge 248] runs 4.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Alfabetului** (-100.9, 164.7; 44.439718, 26.057931) [near upb #32 (1282 m, forward sheet 6)] 
- #117 **low** Șoseaua Orhideelor [edge 638] runs 4.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (403.4, -717.4; 44.447656, 26.064275) ×2 [near upb #3 (122 m, forward sheet 1)] 
- #62 **low** (service) [edge 332] runs 4.2 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (108.8, -392.9; 44.444736, 26.060569) [near upb #17 (682 m, forward sheet 3)] 
- #27 **low** (service) [edge 100] runs 4.1 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-140.1, 177.7; 44.439601, 26.057437) [near upb #33 (1322 m, forward sheet 6)] 
- #31 **low** Șoseaua Grozăvești [edge 146] runs 4.1 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Grozăvești** (99, -54.5; 44.441691, 26.060446) ×2 [near sweep-oseaua-groz-ve-ti #42 (122 m, forward sheet 1)] 
- #61 **low** (service) [edge 324] runs 4.1 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (103, -428.2; 44.445053, 26.060495) [near upb #16 (642 m, forward sheet 3)] 
- #79 **low** Bulevardul Regiei [edge 468] runs 4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bulevardul Regiei** (36.2, -609.6; 44.446686, 26.059656) ×2 [near upb #12 (482 m, forward sheet 3)] 
- #55 **low** (service) [edge 908] runs 3.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (60, -358.4; 44.444425, 26.059955) [near upb #18 (722 m, forward sheet 4)] 
- #4 **low** Splaiul Independenței [edge 1] runs 2.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **Splaiul Independenței** (81.2, -249.1; 44.443441, 26.060221) ×2 [near upb #21 (842 m, forward sheet 4)] 
- #97 **low** (service) [edge 554] runs 2.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (76.3, -541.7; 44.446074, 26.06016) [near upb #13 (522 m, forward sheet 3)] 
- #98 **low** (service) [edge 971] runs 2.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (149.9, -516.9; 44.445851, 26.061086) ×2 [near upb #14 (562 m, forward sheet 3)] 
- #99 **low** (service) [edge 979] runs 2.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (147.8, -498.2; 44.445683, 26.061059) ×2 [near upb #15 (602 m, forward sheet 3)] 
- #108 **low** Exit → Giulești [edge 1009, bridge] runs 2.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (452.4, -781.8; 44.448235, 26.064893) [near upb #1 (42 m, forward sheet 1)] 
- #21 **low** Șoseaua Orhideelor [edge 813] runs 2.7 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (120.7, -340.4; 44.444263, 26.060718) ×2 [near upb #18 (722 m, forward sheet 4)] 
- #80 **low** Bretea [edge 469] runs 2.7 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (48.2, -607.1; 44.446663, 26.059806) [near upb #12 (482 m, forward sheet 3)] 
- #5 **low** Splaiul Independenței [edge 3] runs 2.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Splaiul Independenței** (28.4, -263.4; 44.44357, 26.059557) ×4 
- #81 **low** Bretea [edge 470] runs 2.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (77.5, -590.8; 44.446516, 26.060175) [near upb #12 (482 m, forward sheet 3)] 
- #33 **low** Șoseaua Orhideelor [edge 148] runs 2.5 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (117.2, -313.2; 44.444018, 26.060674) ×2 [near upb #19 (762 m, forward sheet 4)] 
- #15 **low** Bulevardul Doina Cornea [edge 803, bridge] runs 2.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Grozăvești** (85.1, -117.6; 44.442258, 26.060271) ×2 [near upb #24 (962 m, forward sheet 5)] 
- #28 **low** (service) [edge 102] runs 2.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-252.4, 331.1; 44.438221, 26.056024) [near upb #38 (1522 m, forward sheet 7)] 
- #46 **low** (service) [edge 244] runs 2.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-215.5, 290.8; 44.438584, 26.056488) [near upb #37 (1482 m, forward sheet 7)] 
- #69 **low** Șoseaua Orhideelor [edge 363] runs 2.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (150.4, -299.3; 44.443893, 26.061093) ×2 [near upb #19 (762 m, forward sheet 4)] 
- #16 **low** Podul Grozăvești [edge 76] runs 2.3 m² into its own junction pad (4 mm apart → z-fight at range) @ **Podul Grozăvești** (104.1, -239.3; 44.443353, 26.06051) ×3 [near upb #21 (842 m, forward sheet 4)] 
- #53 **low** (service) [edge 872] runs 1.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (99.3, -324; 44.444115, 26.060449) ×2 [near upb #19 (762 m, forward sheet 4)] 
- #66 **low** (service) [edge 362] runs 1.9 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (178.3, -227.1; 44.443244, 26.061443) [near upb #21 (842 m, forward sheet 4)] 
- #8 **low** Șoseaua Grozăvești [edge 13] runs 1.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Grozăvești** (75.7, -111.7; 44.442205, 26.060152) ×2 [near sweep-oseaua-groz-ve-ti #41 (82 m, forward sheet 1)] 
- #36 **low** Bretea [edge 174] runs 1.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (108.3, -274.2; 44.443667, 26.060563) [near upb #20 (802 m, forward sheet 4)] 
- … 8 more in visual.json

### `ribbon-zfight` (59)

- #49 **medium** consecutive ribbons of (service) / (service) overlap at node 319: their corners are 0.3 m apart (mitre fallback) → doubled asphalt + crossing markings @ **(service)** (52.6, -155.6; 44.4426, 26.059862) ×5 [near sweep-oseaua-groz-ve-ti #40 (42 m, forward sheet 1)] [crop](issues/bucharest-grozavesti-geo-ribbon-zfight-53_-156.jpg)
- #133 **medium** consecutive ribbons of (service) / (service) overlap at node 323: their corners are 0.4 m apart (mitre fallback) → doubled asphalt + crossing markings @ **(service)** (64.5, -154.1; 44.442586, 26.060012) [near sweep-oseaua-groz-ve-ti #40 (42 m, forward sheet 1)] [crop](issues/bucharest-grozavesti-geo-ribbon-zfight-65_-154.jpg)
- #7 **low** Șoseaua Grozăvești [edge 13] and Bulevardul Doina Cornea [edge 136] overlap over 115.7 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Doina Cornea** (73, -99.9; 44.442099, 26.060118) ×7 [near sweep-oseaua-groz-ve-ti #41 (82 m, forward sheet 1)] 
- #93 **low** Șoseaua Orhideelor [edge 497] and Șoseaua Orhideelor [edge 520] overlap over 81.6 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (158.3, -648.2; 44.447033, 26.061192) [near upb #9 (362 m, forward sheet 2)] 
- #68 **low** Șoseaua Orhideelor [edge 363] and Șoseaua Orhideelor [edge 956] overlap over 51.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (151, -304.3; 44.443938, 26.0611) [near upb #19 (762 m, forward sheet 4)] 
- #44 **low** Splaiul Independenței [edge 208] and (service) [edge 362] overlap over 37.2 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **(service)** (184.1, -227.4; 44.443246, 26.061516) [near upb #21 (842 m, forward sheet 4)] 
- #77 **low** Bulevardul Regiei [edge 467] and Bulevardul Regiei [edge 506] overlap over 35 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Regiei** (55, -615.2; 44.446736, 26.059892) ×2 [near upb #12 (482 m, forward sheet 3)] 
- #14 **low** Bulevardul Doina Cornea [edge 803, bridge] and Pasajul Basarab [edge 914, bridge] overlap over 30.8 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Grozăvești** (84.6, -115.4; 44.442238, 26.060264) ×2 [near upb #24 (962 m, forward sheet 5)] 
- #111 **low** Șoseaua Orhideelor [edge 601] and Calea Giulești [edge 618] overlap over 30.8 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Calea Giulești** (353.9, -749.8; 44.447947, 26.063653) ×3 [near upb #4 (162 m, forward sheet 1)] 
- #34 **low** Șoseaua Orhideelor [edge 150] and Bretea [edge 174] overlap over 22.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (107.5, -271.3; 44.443641, 26.060552) ×2 [near upb #20 (802 m, forward sheet 4)] 
- #57 **low** Pasajul Basarab [edge 915, bridge] and Pasajul Basarab [edge 1045, bridge] overlap over 22.1 m² at the same height (Δy 0.02 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (358.7, -727.6; 44.447747, 26.063713) ×5 [near upb #4 (162 m, forward sheet 1)] 
- #43 **low** Bulevardul Doina Cornea [edge 207] and Bulevardul Doina Cornea [edge 1264, bridge] overlap over 21.1 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Doina Cornea** (-56.7, 91.7; 44.440375, 26.058487) [near upb #30 (1202 m, forward sheet 6)] 
- #92 **low** Șoseaua Orhideelor [edge 496] and Șoseaua Orhideelor [edge 520] overlap over 20.2 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (224.8, -669.6; 44.447226, 26.062029) [near upb #8 (322 m, forward sheet 2)] 
- #74 **low** Bulevardul Regiei [edge 465] and junction pad (node 621, Șoseaua Orhideelor × Bulevardul Regiei) overlap over 19.9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (84.1, -624.9; 44.446823, 26.060258) ×7 [near upb #11 (442 m, forward sheet 2)] 
- #37 **low** Pasajul Basarab [edge 852, bridge] and Pasajul Basarab [edge 1418, bridge] overlap over 19.2 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Calea Giulești** (359, -694.4; 44.447449, 26.063717) ×4 [near upb #4 (162 m, forward sheet 1)] 
- #123 **low** Bretea [edge 715] and Calea Plevnei [edge 767] overlap over 19.1 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (435.7, -711.6; 44.447604, 26.064682) [near upb #2 (82 m, forward sheet 1)] 
- #20 **low** Șoseaua Orhideelor [edge 813] and Șoseaua Orhideelor [edge 215] overlap over 18.9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (120, -356.5; 44.444408, 26.06071) ×2 [near upb #18 (722 m, forward sheet 4)] 
- #78 **low** Bulevardul Regiei [edge 468] and Bulevardul Regiei [edge 505] overlap over 18.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Regiei** (38.1, -609.5; 44.446684, 26.05968) ×2 [near upb #12 (482 m, forward sheet 3)] 
- #38 **low** Pasajul Basarab [edge 853, bridge] and Pasajul Basarab [edge 1419, bridge] overlap over 17.1 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (363.7, -698.7; 44.447487, 26.063776) ×4 [near upb #4 (162 m, forward sheet 1)] 
- #101 **low** Bretea [edge 559] and Calea Giulești [edge 574] overlap over 14 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (288.7, -739.6; 44.447855, 26.062832) [near upb #5 (202 m, forward sheet 1)] 
- #107 **low** Exit → Giulești [edge 1009, bridge] and Pasajul Basarab [edge 1141, bridge] overlap over 12.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (450.7, -780.9; 44.448227, 26.064871) ×5 [near upb #1 (42 m, forward sheet 1)] 
- #121 **low** Bretea [edge 714] and Calea Plevnei [edge 767] overlap over 11.7 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (437.7, -708.1; 44.447572, 26.064707) [near upb #2 (82 m, forward sheet 1)] 
- #9 **low** Șoseaua Grozăvești [edge 17] and Bulevardul Doina Cornea [edge 80] overlap over 11.2 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Grozăvești** (71.1, -26.3; 44.441437, 26.060095) ×2 [near sweep-oseaua-groz-ve-ti #43 (162 m, forward sheet 1)] 
- #18 **low** Bulevardul Doina Cornea [edge 81] and Șoseaua Grozăvești [edge 145] overlap over 10.7 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Doina Cornea** (95.3, -44.6; 44.441601, 26.060399) ×4 [near sweep-oseaua-groz-ve-ti #43 (162 m, forward sheet 1)] 
- #100 **low** Bretea [edge 558] and Calea Giulești [edge 572] overlap over 7.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (284, -754.5; 44.447989, 26.062773) ×3 [near upb #5 (202 m, forward sheet 1)] 
- #19 **low** Șoseaua Orhideelor [edge 810] and Șoseaua Orhideelor [edge 959] overlap over 7 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (140.3, -449; 44.44524, 26.060965) ×3 [near upb #16 (642 m, forward sheet 3)] 
- #32 **low** Șoseaua Orhideelor [edge 148] and (service) [edge 319] overlap over 6.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **(service)** (114.7, -314.3; 44.444028, 26.060643) [near upb #19 (762 m, forward sheet 4)] 
- #84 **low** Șoseaua Orhideelor [edge 479] and Șoseaua Orhideelor [edge 514] overlap over 6.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (86.9, -574.4; 44.446369, 26.060293) [near upb #12 (482 m, forward sheet 3)] 
- #85 **low** Șoseaua Orhideelor [edge 479] and Șoseaua Orhideelor [edge 515] overlap over 6.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (89.4, -557.6; 44.446217, 26.060324) ×3 [near upb #13 (522 m, forward sheet 3)] 
- #114 **low** Pasajul Basarab [edge 1086, bridge] and Pasajul Basarab [edge 1239, bridge] overlap over 6.2 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Calea Giulești** (350.7, -685.8; 44.447371, 26.063613) ×3 [near upb #5 (202 m, forward sheet 1)] 
- #89 **low** Șoseaua Orhideelor [edge 491] and Bretea [edge 567] overlap over 5.9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (284.8, -704.2; 44.447537, 26.062784) ×5 [near upb #6 (242 m, forward sheet 2)] 
- #94 **low** Șoseaua Orhideelor [edge 520] and junction pad (node 662, Șoseaua Orhideelor × (service)) overlap over 5.7 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (204.4, -663; 44.447166, 26.061771) [near upb #8 (322 m, forward sheet 2)] 
- #22 **low** Bulevardul Doina Cornea [edge 83] and Strada Economu Cezărescu [edge 298] overlap over 5.5 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Strada Economu Cezărescu** (47.7, -38.1; 44.441543, 26.0598) [near upb #26 (1042 m, forward sheet 5)] 
- #3 **low** Splaiul Independenței [edge 0] and Bretea [edge 179] overlap over 5.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (86, -250.6; 44.443455, 26.060282) ×4 [near upb #21 (842 m, forward sheet 4)] 
- #102 **low** Bretea [edge 559] and Calea Giulești [edge 575] overlap over 5.1 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (289.5, -737.4; 44.447835, 26.062842) ×5 [near upb #5 (202 m, forward sheet 1)] 
- #24 **low** Bulevardul Doina Cornea [edge 84] and Strada Economu Cezărescu [edge 298] overlap over 3.9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Strada Economu Cezărescu** (47.1, -36.9; 44.441532, 26.059793) ×3 [near upb #26 (1042 m, forward sheet 5)] 
- #50 **low** (service) [edge 264] and (service) [edge 289] overlap over 3.9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **(service)** (29.1, -266.3; 44.443597, 26.059566) ×13 
- #17 **low** Bulevardul Doina Cornea [edge 77] and Bretea [edge 195] overlap over 3.8 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (52.3, 0.2; 44.441198, 26.059858) ×2 [near sweep-oseaua-groz-ve-ti #44 (202 m, forward sheet 1)] 
- #109 **low** Exit → Giulești [edge 1025, bridge] and Calea Giulești [edge 627] overlap over 3.6 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Calea Giulești** (287.1, -798.2; 44.448383, 26.062812) ×2 
- #51 **low** (service) [edge 270] and (service) [edge 284] overlap over 3.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **(service)** (38.4, -282.8; 44.443745, 26.059683) ×2 [near upb #20 (802 m, forward sheet 4)] 
- #42 **low** Bulevardul Doina Cornea [edge 206] and Bulevardul Doina Cornea [edge 1262, bridge] overlap over 2.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Doina Cornea** (-45.3, 76.1; 44.440516, 26.05863) ×4 [near upb #30 (1202 m, forward sheet 6)] 
- #124 **low** Bretea [edge 716] and Calea Plevnei [edge 767] overlap over 2.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (432.9, -714.8; 44.447632, 26.064647) ×2 [near upb #2 (82 m, forward sheet 1)] 
- #110 **low** Exit → Giulești [edge 1025, bridge] and Calea Giulești [edge 626] overlap over 2.2 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Calea Giulești** (289.1, -794.8; 44.448352, 26.062837) 
- #87 **low** Șoseaua Orhideelor [edge 490] and Șoseaua Orhideelor [edge 525] overlap over 2 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (306.5, -710.7; 44.447595, 26.063056) ×4 [near upb #5 (202 m, forward sheet 1)] 
- #105 **low** Bretea [edge 1006, bridge] and Pasajul Basarab [edge 1139, bridge] overlap over 2 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (432.5, -745.2; 44.447906, 26.064642) ×4 [near upb #2 (82 m, forward sheet 1)] 
- #90 **low** Șoseaua Orhideelor [edge 492] and Șoseaua Orhideelor [edge 524] overlap over 1.5 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (267.5, -686.5; 44.447377, 26.062566) ×2 [near upb #6 (242 m, forward sheet 2)] 
- #91 **low** Șoseaua Orhideelor [edge 493] and Șoseaua Orhideelor [edge 523] overlap over 1.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (261, -683.1; 44.447347, 26.062483) ×5 [near upb #7 (282 m, forward sheet 2)] 
- #131 **low** Exit → Giulești [edge 1351, bridge] and Pasajul Basarab [edge 1507, bridge] overlap over 1.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (430.9, -770.9; 44.448137, 26.064621) ×5 [near upb #2 (82 m, forward sheet 1)] 
- #83 **low** Șoseaua Orhideelor [edge 479] and Șoseaua Orhideelor [edge 513] overlap over 1.1 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (83.7, -596.4; 44.446567, 26.060254) ×4 [near upb #12 (482 m, forward sheet 3)] 
- #73 **low** (service) [edge 453] and junction pad (node 537, (service)) overlap over 1 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **(service)** (173.2, -331.7; 44.444185, 26.061379) [near upb #19 (762 m, forward sheet 4)] 
- #106 **low** Bretea [edge 1007, bridge] and Pasajul Basarab [edge 1504, bridge] overlap over 0.8 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (440.6, -750.6; 44.447955, 26.064743) ×3 [near upb #2 (82 m, forward sheet 1)] 
- #2 **low** Splaiul Independenței [edge 0] and Bretea [edge 178] overlap over 0.7 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (87.9, -250.6; 44.443455, 26.060306) [near upb #21 (842 m, forward sheet 4)] 
- #11 **low** Șoseaua Grozăvești [edge 19] and Bulevardul Doina Cornea [edge 79] overlap over 0.7 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bulevardul Doina Cornea** (63.8, -10.4; 44.441294, 26.060002) ×4 [near sweep-oseaua-groz-ve-ti #43 (162 m, forward sheet 1)] 
- #67 **low** Șoseaua Orhideelor [edge 363] and Șoseaua Orhideelor [edge 954] overlap over 0.7 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (156.7, -324.1; 44.444116, 26.061172) ×4 [near upb #19 (762 m, forward sheet 4)] 
- #116 **low** Calea Plevnei [edge 629] and Șoseaua Orhideelor [edge 637] overlap over 0.7 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Calea Plevnei** (373.4, -682.7; 44.447344, 26.063898) ×3 [near upb #4 (162 m, forward sheet 1)] 
- #65 **low** (service) [edge 351] and junction pad (node 503, (service)) overlap over 0.6 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **(service)** (154.2, -257.7; 44.443519, 26.06114) [near upb #20 (802 m, forward sheet 4)] 
- #75 **low** Bulevardul Regiei [edge 465] and Bulevardul Regiei [edge 518] overlap over 0.6 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (87.7, -625.6; 44.44683, 26.060304) ×10 [near upb #11 (442 m, forward sheet 2)] 
- #119 **low** Șoseaua Orhideelor [edge 647] and Calea Giulești [edge 652] overlap over 0.5 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (376, -749; 44.44794, 26.063931) ×2 [near upb #3 (122 m, forward sheet 1)] 
- #59 **low** Pasajul Basarab [edge 917, bridge] and Pasajul Basarab [edge 1047, bridge] overlap over 0.3 m² at the same height (Δy 0.01 m) → same asphalt colour (invisible unless markings cross) @ **Calea Giulești** (331.7, -713; 44.447616, 26.063374) ×5 [near upb #5 (202 m, forward sheet 1)] 

### `building-over-road` (6)

- #138 **high** building footprint (h 14.5 m) covers 40.3 m² of (service) [edge 304] @ **(service)** (-58.9, 17; 44.441047, 26.058459) [near upb #29 (1162 m, forward sheet 5)] [crop](issues/bucharest-grozavesti-geo-building-over-road--59_17.jpg)
- #142 **high** building footprint (h 6.4 m) covers 24.5 m² of (service) [edge 311] @ **(service)** (-177.3, 314.9; 44.438366, 26.05697) [near upb #36 (1442 m, forward sheet 7)] [crop](issues/bucharest-grozavesti-geo-building-over-road--177_315.jpg)
- #143 **high** building footprint (h 3 m) covers 50.4 m² of (service) [edge 529] @ **(service)** (107.2, -584.3; 44.446458, 26.060549) ×4 [near upb #12 (482 m, forward sheet 3)] [crop](issues/bucharest-grozavesti-geo-building-over-road-107_-584.jpg)
- #140 **medium** building footprint (h 23.2 m) covers 4 m² of (service) [edge 820] @ **Strada Economu Cezărescu** (-115.1, 27.9; 44.440949, 26.057752) [crop](issues/bucharest-grozavesti-geo-building-over-road--115_28.jpg)
- #139 **medium** building footprint (h 11.6 m) covers 1.1 m² of (service) [edge 98] @ **(service)** (-175.1, 142.3; 44.43992, 26.056997) [near upb #33 (1322 m, forward sheet 6)] [crop](issues/bucharest-grozavesti-geo-building-over-road--175_142.jpg)
- #141 **medium** building footprint (h 9.6 m) covers 0.7 m² of (service) [edge 820] @ **Bulevardul Doina Cornea** (-100.3, 63.4; 44.440629, 26.057938) [near upb #30 (1202 m, forward sheet 6)] [crop](issues/bucharest-grozavesti-geo-building-over-road--100_63.jpg)

### `ribbon-stacked` (4)

- #63 **high** (primary) [edge 950] and Șoseaua Orhideelor [edge 366] overlap over 69.5 m² with only 2.34 m between them (spec R11.4: share one surface or ≥ 5 m clearance) → a visible stacked / stepped road surface @ **Șoseaua Orhideelor** (169.4, -369.9; 44.444528, 26.061331) [near upb #18 (722 m, forward sheet 4)] [crop](issues/bucharest-grozavesti-geo-ribbon-stacked-169_-370.jpg)
- #70 **high** Șoseaua Orhideelor [edge 365] and (primary) [edge 953] overlap over 20.3 m² with only 0.38 m between them (spec R11.4: share one surface or ≥ 5 m clearance) → a visible stacked / stepped road surface @ **Șoseaua Orhideelor** (161.8, -341.5; 44.444273, 26.061236) [near upb #18 (722 m, forward sheet 4)] [crop](issues/bucharest-grozavesti-geo-ribbon-stacked-162_-341.jpg)
- #71 **high** Șoseaua Orhideelor [edge 366] and (primary) [edge 953] overlap over 5.1 m² with only 0.87 m between them (spec R11.4: share one surface or ≥ 5 m clearance) → a visible stacked / stepped road surface @ **Șoseaua Orhideelor** (163.5, -347.6; 44.444328, 26.061257) [near upb #18 (722 m, forward sheet 4)] [crop](issues/bucharest-grozavesti-geo-ribbon-stacked-164_-348.jpg)
- #104 **medium** Bretea [edge 999, bridge] and Bretea [edge 1070, bridge] overlap over 3.3 m² with only 0.3 m between them (spec R11.4: share one surface or ≥ 5 m clearance) → a visible stacked / stepped road surface @ **Calea Plevnei** (427.2, -700; 44.447499, 26.064575) ×2 [near upb #3 (122 m, forward sheet 1)] [crop](issues/bucharest-grozavesti-geo-ribbon-stacked-427_-700.jpg)

### `lifted-nonbridge` (4)

- #144 **high** Pasajul Basarab (not a bridge or ramp) is lifted 3.9 m @ **(service)** (80.9, 188.3; 44.439506, 26.060218) [near sweep-oseaua-groz-ve-ti #47 (322 m, forward sheet 2)] [crop](issues/bucharest-grozavesti-geo-lifted-nonbridge-81_188.jpg)
- #145 **high** Pasajul Basarab (not a bridge or ramp) is lifted 5.3 m @ **Șoseaua Grozăvești** (78.2, 165.1; 44.439714, 26.060184) ×2 [near sweep-oseaua-groz-ve-ti #47 (322 m, forward sheet 2)] [crop](issues/bucharest-grozavesti-geo-lifted-nonbridge-78_165.jpg)
- #146 **high** primary (not a bridge or ramp) is lifted 5.8 m @ **Șoseaua Orhideelor** (170.7, -386.8; 44.44468, 26.061348) [near upb #17 (682 m, forward sheet 3)] [crop](issues/bucharest-grozavesti-geo-lifted-nonbridge-171_-387.jpg)
- #147 **medium** primary (not a bridge or ramp) is lifted 1 m @ **Șoseaua Orhideelor** (159.6, -343.5; 44.444291, 26.061209) [near upb #18 (722 m, forward sheet 4)] [crop](issues/bucharest-grozavesti-geo-lifted-nonbridge-160_-343.jpg)

### `surface-above-road` (3)

- #134 **medium** a sidewalk / light surface (y=4.38) lies 0.17 m above Bretea [edge 1070, bridge] (y=4.21) → a strip / slab across the carriageway @ **Calea Plevnei** (427.9, -699.6; 44.447495, 26.064584) [near upb #3 (122 m, forward sheet 1)] [crop](issues/bucharest-grozavesti-geo-surface-above-road-428_-700.jpg)
- #135 **medium** a kerb strip (y=0.37) lies 0.13 m above junction pad (node 4, Splaiul Independenței × Podul Grozăvești × Șoseaua Orhideelor) (y=0.24) → a strip / slab across the carriageway @ **Splaiul Independenței** (95.6, -241.4; 44.443372, 26.060402) [near upb #21 (842 m, forward sheet 4)] [crop](issues/bucharest-grozavesti-geo-surface-above-road-96_-241.jpg)
- #137 **medium** a kerb strip (y=0.37) lies 0.13 m above junction pad (node 72, Bulevardul Doina Cornea × (service)) (y=0.24) → a strip / slab across the carriageway @ **Bulevardul Doina Cornea** (-91.5, 127.1; 44.440056, 26.058048) [near upb #32 (1282 m, forward sheet 6)] [crop](issues/bucharest-grozavesti-geo-surface-above-road--91_127.jpg)

### `canvas-text-overflow` (2)

- #149 **medium** "⛽" runs 15 px past the top edge of the 512×320 canvas (font 11px sans-serif, 512×320 canvas, drawn by game/src/nav.js:473) 
- #148 **low** "Facultatea de Antreprenoriat, Ingineria și Managementul Afacerilor" squeezed to 55 % width by maxWidth 244 (natural 443 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:475) 

### `route-missing` (1)

- #1 **high** no route for sweep-splaiul-independen-ei (main street: Splaiul Independenței) @ **Splaiul Independenței** (-22.1, -277; 44.443692, 26.058922) 

### `ribbon-gap` (1)

- #132 **medium** gap of 0.4 m between consecutive ribbons of (service) and (service) at node 322 (grass / sidewalk shows through the road) @ **(service)** (63.6, -153.4; 44.44258, 26.060001) [near sweep-oseaua-groz-ve-ti #40 (42 m, forward sheet 1)] [crop](issues/bucharest-grozavesti-geo-ribbon-gap-64_-153.jpg)

### `marking-floating` (1)

- #136 **medium** road marking floats 0.14 m above the road surface under it (Șoseaua Grozăvești [edge 142]) @ **Șoseaua Grozăvești** (123.2, -172.7; 44.442754, 26.06075) ×2 [near upb #22 (882 m, forward sheet 4)] [crop](issues/bucharest-grozavesti-geo-marking-floating-123_-173.jpg)
