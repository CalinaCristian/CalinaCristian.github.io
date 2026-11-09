# Source vehicle clearance

This separate change consumes literal prepared road-way `maxheight`,
`maxheight:physical`, `maxwidth` and supported motor-mode variants. It filters GPS
expansions and NPC future continuations and rejects illegal station-repair
candidates. A final constructor audit exposes untouched illegal assignments as
`initialAdmission.invalidSourceClearance` and makes `passed` false. It preserves
those actors, their original poses, IDs, source assignments and fleet/pool counts.
It does not relocate an oversized vehicle to a different source road.

The root-owned Main integration is `nav.sourceVehicle = player` immediately after
constructing Player, before initial placement. No Main change is included here.
The existing `nav.player` is also supported. Walking routes ignore vehicle limits.

## API

`sourceVehicleDimensions(actor)` returns `known`, actual upright `height`,
`width`, `length`, local `bounds`, `geometryHeight` and measured parts. It uses the
actual primary model vertices and additional native model hierarchy, including
the detached instanced taxi sign template. Player uses the cockpit hierarchy
under its physical rig; the support datum at zero is included beneath a cockpit
that has no rendered wheels. World translation, yaw and ramp pitch do not alter
the upright source-sign dimensions. Model-local transforms and scale remain.
The helper never updates live matrices or actor poses and has no declared-height
fallback. Unsupported parent scale/manual matrices or deformation remain unknown.

`roadClearancePolicy(data)` indexes `roadSourceGeometry[road].tags`; its report
retains unresolved source IDs, keys and raw values. The source-way identity must
match the native edge. It does not infer node-mounted signs or sign completeness.

`assessRoadClearance(policy, edge, dimensions, {mode})` returns `eligible`, `known`,
literal checks and unknowns. `sourceRoadClearance(data, edge, actor, options)` is
the model-aware convenience wrapper. A finite limit with unknown actual model
dimensions yields `eligible:null`, which consumers reject. A known numeric failure
yields `false`. `none` is explicitly unbounded. `default`, unsupported selectors
and conditional text retain legacy access with `known:false`, without inventing
a numeric permission. `maxheight:signed=no` never removes a separate finite limit.
Motor-mode precedence is explicit; physical limits are checked independently.
Rail vehicle restrictions remain a separate source contract.

## Validation

- `node game/dev/source-road-clearance.test.mjs`: **48 controls pass**, including
  real model geometry, units, mode/physical precedence, unknowns, actual GPS and
  NPC routing, invalid future suffix replacement, a legal physical pair repair,
  source-rejected repair candidates and an untouched lone oversized actor.
- `node handoffs/fidelity/source-clearance/literal-catalogue-check.mjs`:
  **79 literal source ways / all 8 districts**, preserving source tags. Fixture
  bytes were checked against committed Pipera proof `4e52d15f`; the exact hash and
  commit are in `fixture-provenance.json`. No geometry was regenerated.
- Nine existing suites pass: motor-turn reader/routing, lane-drop chain,
  vehicle lanes, solid sensing, signals, shared lanes, normal guard tolerance and
  vehicle separation. Five edited production modules pass ES-module syntax checks.

Measured examples, in metres:

| Actual model | Geometry-derived height | Declared model height |
| --- | ---: | ---: |
| Hatch | 1.585 | 1.46 |
| Taxi, including emitted sign | 1.835 | 1.52 |
| STB bus | 3.445 | 3.1 |
| Trolleybus, including poles | 5.695 | 3.0 |
| KCM bus | 3.585 | 3.2 |

The actual player cockpit reaches 2.1400001 m above its support datum; its
1.85 m mesh-only span would incorrectly waive a 2.05 m / 6 ft 10 in restriction.
Actual mirrors are included in width, independently of the narrower collision OBB.

This is a **CPU/source eligibility result**. There is no new native constructor,
all-profile first-publication, passage, complete-body source incidence, roof
collision, drive, visual, budget or all8 acceptance claim. Constructor audit covers
the active fleet at its actual call; later profile/hot additions require their
own publication audit. Long bodies straddling other source ways still require
the independent native body/source/static audit. Existing oversized original
assignments may now make admission fail and must remain visible until corrected
through legal source placement. No roof height, source geometry, turn rule, RNG,
collision tolerance, traffic fleet or actor-hiding change is included.
