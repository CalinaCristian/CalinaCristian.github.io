# Historical High Romană constructor facts

Exact observed source: `6cbf82b61de8267f662bf50239c37ccc1764635c` (runtime/world `8ccab8b8`). Comparison pin: root `718b996c54819feb632c0b62682923b38f7abe2d`. This is one historical pre-source-binding constructor observation, not a native current-root rail placement or movement gate.

The existing immutable minimal archive was reused after verifying all 208 copied files against their Git blob hashes and SHA256. All 105 actually served files match too, and the native Romană `world.data` canonical JSON equals the exact archived dataset. No clone, source substitution or production edit was needed. The browser closed at `2026-11-09T06:24:12.875Z`; PID 410619 is terminal (`Z`). Browser, console, HTTP and observer error arrays are empty.

Source comparison was completed before launch. World, Romană data, cities, vehicle models, utility/RNG, transit data, nav/access/shared-lane modules are byte-identical to the root comparison pin. Public `loadCity` High options (desktop maxVehicles 480 / maxPeds 560), the native entry/spawn/attach methods, historic `spawnAll`/`spawn` and fleet/transit choice methods are text-identical. The current constructor adds pure turn-lane lookup before RNG setup and source binding after `spawnAll`; later rail/path/history/admission logic differs. `proof/source-comparison-root718.json` pins every compared module/method and states these limits, and `relevant-source-diff-root718.patch` retains the actual differences. This scoped comparison does not relabel the historical run as current-root acceptance.

The normal public native `startFreeRoam → loadCity → attachWorldRender → enterRoam` lifecycle runs with High/clear/summer and a fixed `nowDate` of `2026-06-21T09:00:00Z` (12:00 local). The explicit clock takes precedence over the requested native noon offset. The update loop is stopped before construction; there are no traffic steps, pose repairs by the harness, population/RNG overrides or source-binding substitutions. Read-only wrappers preserve original receivers, arguments and return values. They record the exact immediate return from original `spawnAll`, before initial admission and Pedestrians construction, and the normal later publication stages. Native admission remains active and its changes remain visible.

| Actual stage | Active | Pool | Pedestrians | Tram actors |
| --- | ---: | ---: | ---: | --- |
| Immediately after original `spawnAll`, before admission/Pedestrians | 491 | 0 | Not constructed yet | 489 Imperio, 490 V3A |
| Before original `attachWorldRender`, after normal profile/player admission | 312 | 179 | 560 | Same two active; none pooled |
| After native public entry, before any drive update | 312 | 179 | 560 | Same two active; none pooled |

Both historic trams initially own motor source `w241374327`. Their exact pre-admission facts are:

| ID/kind | Direction | Station m | X m | Y m | Z m | Native heading radians |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 489 / `tram-imperio` | 1 | 4.982482427465293 | −120.64317768434289 | 0.24 | −444.66715127751803 | −1.4210133283633442 |
| 490 / `tram-v3a` | −1 | 31.792413754392296 | −120.17549684604938 | 0.24 | −447.667861447297 | 1.7176251186762523 |

The unchanged native admission moves 489 by 1.998211700154694 m (station becomes 2.9824824274652926); 490 is unchanged. Before-admission and later poses are preserved separately. The complete native actor records contain flag/variant detection (`v.tram || /tram/i.test(v.kind)`), dimensions/long flags, lanes, road/source/endpoint IDs, actual yaw/mesh rotation/quaternion/scale/matrix, route/history and actual emitted primary geometry bounds. Full active/pool/pedestrian ID arrays are retained in every applicable phase. The Imperio is 36 × 2.4 m and V3A 27 × 2.4 m. Their emitted geometry includes the pantograph: local Y `[0.008273792453110218, 5.789999961853027]`, flat-road world Y `[0.2482737924531102, 6.029999961853028]`, differing from declared height metadata 3.5/3.3 m.

The stable raw file is `/workspace/integration-qa-evidence/romana-constructor-6cb-native/constructor-facts.json`: 31,233,149 bytes, SHA256 `c25b01cc7acf5b1d7cba51b9d1aa234439f431fcb493e297c0683b67d65496cf`. `proof/constructor-facts.json.gz` decompresses to those exact bytes. It includes every NPC pose in all three snapshots, full native data, all 1,120 road profiles, 1,320 ribbon polygons/pad vertices, passive deck bands and native source/model stats. `proof/tram-actors.json` is a smaller exact extraction of all tram records plus all population IDs. Raw launch, source/served ledgers, report, source comparison and actual tools are pinned by `integrity.json`.

`proof/native-romana.png` was visually inspected: it shows the actual native cockpit/street scene and a yellow tram on the left. No camera/actor/material/geometry/visibility changes were made for the image. It is a first scene capture, not a source-track or movement acceptance claim.

US received the stable file immediately and independently analyzed nearest source choices in its separate commit `920fe6e5817bb8c54ce11297daa1bdd1d5ada0fa`. That lane owns the source-choice interpretation and guard. Tunnel/approach grade, current-root binding/static/native publication, movement, contacts, budgets and final all8/full15 remain unaccepted by this historical fact run. New crossing metadata/controller work belongs to RO; this proof adds no crossing or production edits.
