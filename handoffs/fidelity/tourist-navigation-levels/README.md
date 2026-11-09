# Floor-aware waypoint correction

These controls retain the actual Old Town outside-centre witness, distinguish two walkable floors around an atrium void, reject cross-floor arrival, and exercise actual Carusel gallery geometry plus all80 modeled risers. The existing native DOM/Input/SpotSession fixture passes23 checks at desktop and portrait/landscape phone sizes. It uses explicit synthetic stops and no complete rendered scene.

Commands: `node --test game/dev/harness/tourist-navigation-levels.test.mjs game/dev/harness/tourist-wall-levels.test.mjs`; `node handoffs/fidelity/old-town-nightlife-20261109/carusel-geometry-check.mjs`; `node tools/tourist-crowd-path-check.mjs`; `node tools/tourist-flow-state-check.mjs /tmp/tourist-floor-route-dom`.

This planar route correction deliberately refuses routes between storeys. It is not a connected multi-storey stair solver, physical public approach, native gallery-route image or hardware performance acceptance. Full source-scene capture remains required.
