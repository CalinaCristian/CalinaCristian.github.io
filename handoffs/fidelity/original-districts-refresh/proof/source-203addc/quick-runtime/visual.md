# Visual QA — 2026-11-08 18:09 UTC

Run: `--visual --root=/workspace/reality-pass/original-districts-refresh/final-source --city=bucharest --district=floreasca,romana,grozavesti --quality=high --pr=.5 --from=2 --to=2 --sweep=0 --no-looks --no-aerial --zevery=0 --viewports=none --no-offices --traffic-every=1 --timeout=900 --out=/workspace/reality-pass/original-districts-refresh/after/quick-runtime` · 5259 min · quality high, day, clear, far game, traffic shots every 1 m, forward every 40 m, looks/aerial every 200/200 m, z-fight test every – sample(s).

Capture coverage: **COMPLETE** — 4/4 required route samples captured; 0 missing; 0 capture/runtime errors.

Human review: [review.md](review.md).

## Findings by detector

| detector | high | medium | low | total |
|---|---|---|---|---|
| `pad-overlap` | 0 | 0 | 17 | 17 |
| `ribbon-zfight` | 0 | 0 | 12 | 12 |
| `canvas-text-overflow` | 0 | 0 | 9 | 9 |
| `building-over-road` | 2 | 3 | 0 | 5 |
| `surface-above-road` | 1 | 3 | 0 | 4 |
| `ribbon-stacked` | 1 | 0 | 0 | 1 |
| `marking-buried` | 0 | 1 | 0 | 1 |

## bucharest (chapters)

- world `bucharest-floreasca` district floreasca: 384 edges, 523 ribbons, loaded in 33.5 s
- world `bucharest-grozavesti` district grozavesti: 801 edges, 1714 ribbons, loaded in 24.2 s
- world `bucharest-romana` district romana: 1006 edges, 1320 ribbons, loaded in 27.3 s
- time: load 85 s, geometry 1 s, survey 174 s, focus 34 s

| route | length | samples | flagged | wall |
|---|---|---|---|---|
| `rosetti` 2009 High school | 1669 m | 1 | 0 | 49 s |
| `upb` 2013 Politehnica | 1573 m | 1 | 0 | 39 s |
| `arnia` 2019 Arnia | 2205 m | 1 | 0 | 52 s |
| `uipath-buc` 2020 UiPath | 1458 m | 1 | 0 | 33 s |

### Contact sheets

- **bucharest-floreasca · 2009 High school · forward view every 40 m · day**: [1](sheets/bucharest-floreasca-rosetti-forward-001.jpg)
- **bucharest-floreasca · 2009 High school · with traffic + pedestrians every 1 m · day**: [1](sheets/bucharest-floreasca-rosetti-traffic-001.jpg)
- **bucharest-floreasca · geometry findings (40 m top-down, north up)**: [1](sheets/bucharest-floreasca-geometry-001.jpg)
- **bucharest-grozavesti · 2013 Politehnica · forward view every 40 m · day**: [1](sheets/bucharest-grozavesti-upb-forward-001.jpg)
- **bucharest-grozavesti · 2013 Politehnica · with traffic + pedestrians every 1 m · day**: [1](sheets/bucharest-grozavesti-upb-traffic-001.jpg)
- **bucharest-grozavesti · geometry findings (40 m top-down, north up)**: [1](sheets/bucharest-grozavesti-geometry-001.jpg)
- **bucharest-romana · 2019 Arnia · forward view every 40 m · day**: [1](sheets/bucharest-romana-arnia-forward-001.jpg)
- **bucharest-romana · 2019 Arnia · with traffic + pedestrians every 1 m · day**: [1](sheets/bucharest-romana-arnia-traffic-001.jpg)
- **bucharest-romana · 2020 UiPath · forward view every 40 m · day**: [1](sheets/bucharest-romana-uipath-buc-forward-001.jpg)
- **bucharest-romana · 2020 UiPath · with traffic + pedestrians every 1 m · day**: [1](sheets/bucharest-romana-uipath-buc-traffic-001.jpg)
- **bucharest-romana · geometry findings (40 m top-down, north up)**: [1](sheets/bucharest-romana-geometry-001.jpg)

## Perf (quality high; draw calls / triangles from r3d.stats; ⚠ > 400 calls or > 1.5 M tris)

| route | start (world) | worst calls (world) | worst tris (world) | start (+traffic) | worst calls (+traffic) | worst tris (+traffic) |
|---|---|---|---|---|---|---|
| `bucharest-floreasca` rosetti | 303 / 1.17 M | 303 / 1.17 M (#0 2 m Calea Floreasca) | 303 / 1.17 M (#0 2 m Calea Floreasca) | 348 / 1.26 M | 348 / 1.26 M (#0 2 m Calea Floreasca) | 348 / 1.26 M (#0 2 m Calea Floreasca) |
| `bucharest-grozavesti` upb | 287 / 1.17 M | 287 / 1.17 M (#1 2 m Șoseaua Orhideelor) | 287 / 1.17 M (#1 2 m Șoseaua Orhideelor) | 321 / 1.26 M | 321 / 1.26 M (#1 2 m Șoseaua Orhideelor) | 321 / 1.26 M (#1 2 m Șoseaua Orhideelor) |
| `bucharest-romana` arnia | 204 / 0.92 M | 204 / 0.92 M (#2 2 m Bulevardul General Gheorghe Magheru) | 204 / 0.92 M (#2 2 m Bulevardul General Gheorghe Magheru) | 240 / 0.97 M | 240 / 0.97 M (#2 2 m Bulevardul General Gheorghe Magheru) | 240 / 0.97 M (#2 2 m Bulevardul General Gheorghe Magheru) |
| `bucharest-romana` uipath-buc | 296 / 1.30 M | 296 / 1.30 M (#3 2 m Șoseaua Pavel Dimitrievici Kiseleff) | 296 / 1.30 M (#3 2 m Șoseaua Pavel Dimitrievici Kiseleff) | 329 / 1.36 M | 329 / 1.36 M (#3 2 m Șoseaua Pavel Dimitrievici Kiseleff) | 329 / 1.36 M (#3 2 m Șoseaua Pavel Dimitrievici Kiseleff) |

## Hotspots (medium+ findings per 60 m cell)

| # | world | where | score | findings | seen in |
|---|---|---|---|---|---|
| 1 | bucharest-grozavesti | Șoseaua Orhideelor (432.5, -745.2; 44.447906, 26.064642) | 5 | ribbon-stacked×1, surface-above-road×1, marking-buried×1 | upb #1 (2 m, forward sheet 1) |
| 2 | bucharest-grozavesti | Șoseaua Orhideelor (410.6, -759.1; 44.448031, 26.064366) | 4 | surface-above-road×2 | upb #1 (2 m, forward sheet 1) |
| 3 | bucharest-floreasca | Strada Cronicarilor (-267, 965.9; 44.455708, 26.100439) | 3 | building-over-road×1 | rosetti #0 (2 m, forward sheet 1) |
| 4 | bucharest-floreasca | Strada Albac (-304, 980.7; 44.455575, 26.099974) | 3 | building-over-road×1 | rosetti #0 (2 m, forward sheet 1) |
| 5 | bucharest-floreasca | Calea Floreasca (-194.5, 974.3; 44.455633, 26.101352) | 1 | building-over-road×1 | rosetti #0 (2 m, forward sheet 1) |
| 6 | bucharest-floreasca | Calea Floreasca (-199.9, 1029.8; 44.455133, 26.101284) | 1 | building-over-road×1 | rosetti #0 (2 m, forward sheet 1) |
| 7 | bucharest-grozavesti | Șoseaua Orhideelor (459.3, -782.2; 44.448238, 26.064979) | 1 | surface-above-road×1 | upb #1 (2 m, forward sheet 1) |
| 8 | bucharest-romana | Bulevardul General Gheorghe Magheru (662.3, 827.3; 44.440856, 26.099534) | 1 | building-over-road×1 | — |

## Findings

### `pad-overlap` (17)

- #34 **low** (service) [edge 920] runs 23.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-617.5, -901.8; 44.456414, 26.083429) [near uipath-buc #3 (2 m, forward sheet 1)] 
- #37 **low** (service) [edge 932] runs 23.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-597.7, -850.5; 44.455953, 26.083678) ×2 [near uipath-buc #3 (2 m, forward sheet 1)] 
- #38 **low** (service) [edge 942] runs 23.1 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-607.4, -904.3; 44.456437, 26.083557) [near uipath-buc #3 (2 m, forward sheet 1)] 
- #32 **low** Strada Monetăriei [edge 210] runs 15.1 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Monetăriei** (-559.2, -757.8; 44.455119, 26.084163) 
- #24 **low** Șoseaua Orhideelor [edge 781] runs 11.7 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (412.6, -726.4; 44.447737, 26.064391) 
- #6 **low** (service) [edge 409] runs 10.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Calea Floreasca** (-239.6, 1050.1; 44.454951, 26.100784) [near rosetti #0 (2 m, forward sheet 1)] 
- #18 **low** Șoseaua Orhideelor [edge 647] runs 8.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (371.1, -749.9; 44.447948, 26.06387) ×2 
- #33 **low** (service) [edge 289] runs 7.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **(service)** (-532.1, -723.8; 44.454813, 26.084505) 
- #7 **low** (service) [edge 410] runs 5.2 m² into its own junction pad (4 mm apart → z-fight at range) @ **Calea Floreasca** (-226.3, 1048.2; 44.454968, 26.100951) [near rosetti #0 (2 m, forward sheet 1)] 
- #17 **low** Șoseaua Orhideelor [edge 638] runs 4.4 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (403.4, -717.4; 44.447656, 26.064275) ×2 
- #2 **low** Strada Albac [edge 2] runs 3.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Albac** (-305.9, 987; 44.455519, 26.09995) ×2 [near rosetti #0 (2 m, forward sheet 1)] 
- #3 **low** Strada Popasului [edge 9] runs 3.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Strada Popasului** (-302.9, 988; 44.455509, 26.099987) [near rosetti #0 (2 m, forward sheet 1)] 
- #5 **low** (service) [edge 399] runs 3.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Calea Floreasca** (-184.9, 946.1; 44.455887, 26.101472) [near rosetti #0 (2 m, forward sheet 1)] 
- #8 **low** (service) [edge 415] runs 3.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Calea Floreasca** (-188.2, 945.5; 44.455892, 26.101432) [near rosetti #0 (2 m, forward sheet 1)] 
- #16 **low** Exit → Giulești [edge 1009, bridge] runs 2.8 m² into its own junction pad (4 mm apart → z-fight at range) @ **Șoseaua Orhideelor** (452.4, -781.8; 44.448235, 26.064893) [near upb #1 (2 m, forward sheet 1)] 
- #31 **low** Strada Benjamin Franklin [edge 1034] runs 2.2 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bulevardul General Gheorghe Magheru** (628.4, 731.7; 44.441716, 26.099107) [near arnia #2 (2 m, forward sheet 1)] 
- #23 **low** Bretea [edge 721] runs 1.6 m² into its own junction pad (4 mm apart → z-fight at range) @ **Bretea** (444.4, -747.1; 44.447922, 26.064792) [near upb #1 (2 m, forward sheet 1)] 

### `ribbon-zfight` (12)

- #20 **low** Bretea [edge 715] and Calea Plevnei [edge 767] overlap over 19.1 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (435.7, -711.6; 44.447604, 26.064682) 
- #15 **low** Exit → Giulești [edge 1009, bridge] and Pasajul Basarab [edge 1141, bridge] overlap over 12.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (450.7, -780.9; 44.448227, 26.064871) ×5 [near upb #1 (2 m, forward sheet 1)] 
- #1 **low** Strada Albac [edge 2] and Strada Popasului [edge 9] overlap over 6.6 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Strada Albac** (-305.3, 989.1; 44.4555, 26.099958) [near rosetti #0 (2 m, forward sheet 1)] 
- #39 **low** (service) [edge 952] and junction pad (node 712, Șoseaua Pavel Dimitrievici Kiseleff × (service)) overlap over 6 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **(service)** (-587, -855.5; 44.455998, 26.083814) [near uipath-buc #3 (2 m, forward sheet 1)] 
- #4 **low** (service) [edge 399] and (service) [edge 415] overlap over 4.4 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Calea Floreasca** (-186.5, 944; 44.455906, 26.101453) [near rosetti #0 (2 m, forward sheet 1)] 
- #22 **low** Bretea [edge 720] and Șoseaua Orhideelor [edge 783] overlap over 3.8 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (437.4, -740.5; 44.447863, 26.064703) 
- #21 **low** Bretea [edge 716] and Calea Plevnei [edge 767] overlap over 2.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Bretea** (432.9, -714.8; 44.447632, 26.064647) ×2 
- #36 **low** (service) [edge 931] and junction pad (node 712, Șoseaua Pavel Dimitrievici Kiseleff × (service)) overlap over 2.1 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **(service)** (-600.1, -851.7; 44.455964, 26.083649) [near uipath-buc #3 (2 m, forward sheet 1)] 
- #35 **low** (service) [edge 921] and junction pad (node 710, Șoseaua Pavel Dimitrievici Kiseleff × (service)) overlap over 1.9 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **(service)** (-618.4, -899.2; 44.456391, 26.083419) [near uipath-buc #3 (2 m, forward sheet 1)] 
- #25 **low** Exit → Giulești [edge 1351, bridge] and Pasajul Basarab [edge 1507, bridge] overlap over 1.3 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (430.9, -770.9; 44.448137, 26.064621) ×5 [near upb #1 (2 m, forward sheet 1)] 
- #14 **low** Bretea [edge 1007, bridge] and Pasajul Basarab [edge 1504, bridge] overlap over 0.8 m² at the same height (Δy 0.04 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (440.6, -750.6; 44.447955, 26.064743) ×3 [near upb #1 (2 m, forward sheet 1)] 
- #19 **low** Șoseaua Orhideelor [edge 647] and Calea Giulești [edge 652] overlap over 0.5 m² at the same height (Δy 0 m) → same asphalt colour (invisible unless markings cross) @ **Șoseaua Orhideelor** (376, -749; 44.44794, 26.063931) ×2 

### `canvas-text-overflow` (9)

- #41 **low** "Facultatea de Antreprenoriat, Ingineria și Managementul Afacerilor" squeezed to 55 % width by maxWidth 244 (natural 443 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:475) 
- #42 **low** "Sediul Central "Mihail Sadoveanu" - Biblioteca Metropolitană București" squeezed to 52 % width by maxWidth 244 (natural 473 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:475) 
- #43 **low** "Muzeul Național de Istorie Naturală "Grigore Antipa"" squeezed to 70 % width by maxWidth 244 (natural 348 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:475) 
- #44 **low** "Observatorul Astronomic Municipal "Amiral Vasile Urseanu" Bucuresti" squeezed to 52 % width by maxWidth 244 (natural 470 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:475) 
- #45 **low** "Spitalul Clinic de Urgență pentru Copii „Grigore Alexandrescu”" squeezed to 58 % width by maxWidth 244 (natural 420 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:475) 
- #46 **low** "Școala Națională de Studii Politice și Administrative" squeezed to 71 % width by maxWidth 244 (natural 345 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:475) 
- #47 **low** "Serviciul public comunitar pentru eliberarea și evidența pașapoartelor simple" squeezed to 48 % width by maxWidth 244 (natural 514 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:475) 
- #48 **low** "Școala Internațională Italiană „Aldo Moro” din București" squeezed to 65 % width by maxWidth 244 (natural 373 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:475) 
- #49 **low** "Biserica Voievodală "Izvorul Tămăduirii" Mavrogheni" squeezed to 70 % width by maxWidth 244 (natural 351 px) (font bold 14px "Helvetica Neue", Arial, sans-serif, 2048×2048 canvas, drawn by game/src/world.js:475) 

### `building-over-road` (5)

- #11 **high** building footprint (h 8.8 m) covers 14 m² of Strada Cronicarilor [edge 168] @ **Strada Cronicarilor** (-267, 965.9; 44.455708, 26.100439) [near rosetti #0 (2 m, forward sheet 1)] [crop](issues/bucharest-floreasca-geo-building-over-road--267_966.jpg)
- #12 **high** building footprint (h 11.6 m) covers 7.6 m² of Strada Albac [edge 3] @ **Strada Albac** (-304, 980.7; 44.455575, 26.099974) ×2 [near rosetti #0 (2 m, forward sheet 1)] [crop](issues/bucharest-floreasca-geo-building-over-road--304_981.jpg)
- #40 **medium** building footprint (h 26.6 m) covers 5.4 m² of Bulevardul General Gheorghe Magheru [edge 125] @ **Bulevardul General Gheorghe Magheru** (662.3, 827.3; 44.440856, 26.099534) [crop](issues/bucharest-romana-geo-building-over-road-662_827.jpg)
- #9 **medium** building footprint (h 14 m) covers 2.5 m² of (service) [edge 396] @ **Calea Floreasca** (-194.5, 974.3; 44.455633, 26.101352) ×2 [near rosetti #0 (2 m, forward sheet 1)] [crop](issues/bucharest-floreasca-geo-building-over-road--194_974.jpg)
- #10 **medium** building footprint (h 14 m) covers 1.4 m² of (service) [edge 393] @ **Calea Floreasca** (-199.9, 1029.8; 44.455133, 26.101284) [near rosetti #0 (2 m, forward sheet 1)] [crop](issues/bucharest-floreasca-geo-building-over-road--200_1030.jpg)

### `surface-above-road` (4)

- #27 **high** a sidewalk / light surface (y=9.89) lies 1.28 m above Exit → Giulești [edge 1012, bridge] (y=8.61) → a strip / slab across the carriageway @ **Șoseaua Orhideelor** (410.6, -759.1; 44.448031, 26.064366) [crop](issues/bucharest-grozavesti-geo-surface-above-road-411_-759.jpg)
- #26 **medium** a sidewalk / light surface (y=8.15) lies 0.04 m above Pasajul Basarab [edge 1139, bridge] (y=8.11) → a strip / slab across the carriageway @ **Șoseaua Orhideelor** (429.4, -743.8; 44.447893, 26.064603) [crop](issues/bucharest-grozavesti-geo-surface-above-road-429_-744.jpg)
- #28 **medium** a sidewalk / light surface (y=9.2) lies 0.04 m above junction pad (node 778, Exit → Giulești × Pasajul Basarab) (y=9.16) → a strip / slab across the carriageway @ **Șoseaua Orhideelor** (459.3, -782.2; 44.448238, 26.064979) [near upb #1 (2 m, forward sheet 1)] [crop](issues/bucharest-grozavesti-geo-surface-above-road-459_-782.jpg)
- #29 **medium** a sidewalk / light surface (y=7.4) lies 0.09 m above junction pad (node 775, Pasajul Basarab × Bretea) (y=7.31) → a strip / slab across the carriageway @ **Șoseaua Orhideelor** (446.8, -758.5; 44.448025, 26.064822) ×2 [near upb #1 (2 m, forward sheet 1)] [crop](issues/bucharest-grozavesti-geo-surface-above-road-447_-758.jpg)

### `ribbon-stacked` (1)

- #13 **high** Bretea [edge 1007, bridge] and Pasajul Basarab [edge 1140, bridge] overlap over 19.6 m² with only 0.26 m between them (spec R11.4: share one surface or ≥ 5 m clearance) → a visible stacked / stepped road surface @ **Șoseaua Orhideelor** (432.5, -745.2; 44.447906, 26.064642) ×3 [crop](issues/bucharest-grozavesti-geo-ribbon-stacked-433_-745.jpg)

### `marking-buried` (1)

- #30 **medium** road marking at y=7.26 is level with Bretea [edge 1007, bridge] (surface y=7.25) → hidden / flickering markings @ **Șoseaua Orhideelor** (440.5, -750; 44.447949, 26.064743) ×7 [near upb #1 (2 m, forward sheet 1)] [crop](issues/bucharest-grozavesti-geo-marking-buried-441_-750.jpg)
