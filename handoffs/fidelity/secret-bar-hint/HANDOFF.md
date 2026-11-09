# Secret sports room and Dinamo TV hint

Owner's latest request explicitly retains the fictional sports-bar Easter egg (feedback 79/84) and adds a second TV showing a drone scoring at Dinamo. This supersedes the earlier retirement of this feature; it does not authorize replacement of any real street venue.

The original WCP panel, six project previews and hidden project achievement are restored. The additional TV plays an **8-second, 480×270, silent VP9 loop, 146,249 bytes**. It is captured from this game's actual Dinamo model, football mesh, real `Drone._fly` held-key input, and real goal detection. The visible drone uses the existing drone model normally hidden by first-person flight. No direct impulse, goal award, generative image or external football footage is used. Drone contact first occurs on frame 25; a whole-ball physical goal crossing occurs on frame 114 (`u=52.2121643164`, radius 0.115, goal plane 52.06). The TV's playback helper has no physics/progression imports or activity emissions. A native browser check shows its texture advancing through real media-frame callbacks to the scored-goal frame at 6.17 seconds.

Access is a hidden E interaction **inside the existing enterable Carusel ground floor**, around `(167.736, -67.142)`, reached through its normal doorway. No exterior signs or building geometry/collision are changed. An enclosed, scene-owned interior uses remote scene coordinates; E returns to the exact prior pose. The map continues to show the real entrance position while indoors. A mapped Hanul cu Tei passage was considered but its existing source outline collider fills the passage, so it was not opened or altered to fit the Easter egg. All new interactions have `hidden:true`; normal map objectives and guided tours exclude them. The regular Carusel climb/photo and Manuc/Stavropoleos content remain intact.

`w1456757039`, frontage part `w658012732`, and Starbucks `n10775260925` at Lipscani 71 remain as sourced. There is no GOLAZO board or NPC claim about a real sports venue. The separate room has Romanian supporters, flags/scarves, a generic match TV, the WCP kiosk, and the Dinamo TV. Watching the TV unlocks nothing. Only browsing the WCP panel unlocks `wcp-bar`; physically scoring in the actual stadium remains the sole Dinamo secret trigger.

Native muted `playsinline` video decoding updates one `VideoTexture`; it adds no world render or mirror pass. Off-room, map/project/photo/pause/menu/hidden-document states pause playback. Removing the room pauses/unloads the media, disposes its texture, clears its interval/visibility listener/render callback, explicitly cancels the video-frame callback left registered by vendored Three r170, and frees all preview textures. Shared-scene entrance changes also hide the room and restore the map update callback.

## Verification

- Focused browser script: `game/dev/harness/secret-bar-check.cjs`. Static server defaults to port 8131 (`PORT` and `OUT` configurable). It uses real E action dispatch for entry, kiosk and exit; validates a walk path from the Old Town spawn; checks source building/POI retention, hidden objectives, video decode + actual loop wrap, pause, no goal award, project panel carousel/link, legacy persistence, exit pose, and disposal.
- Native TV browser script: `game/dev/harness/secret-bar-tv-check.cjs` uses the real browser RAF/media callback cycle, visually captures the scored-goal frame, verifies texture versions advance and leaving the spot cancels the pending video-frame callback. Zero page errors.
- Scene budget: **794,224 triangles** total; representative room frame **260,858 triangles / 41 calls**, within the 1M scene and 1.5M/400 frame budgets.
- Catalogue regression: **27/27**, zero page errors, including restored legacy progress credit and exact 100% math/reset. Current dynamic catalogue: **113 ids, 112 active** before the first bike ride (113 once the bike activity becomes live).
- Tourist tour regression: **58/58**, no runtime map/tour errors. Old Town keeps its normal **106.53 m** itinerary: Carusel climb, bookshop fact, postcard.
- Football physics: **13/13**. Syntax checks and `git diff --check` pass.
- Final browser results and visually reviewed source frontage, room, project panel and TV screenshots are in `/workspace/reality-pass/secret-bar-hint/` (outside git). No software-renderer FPS promise is made.

Reproduction uses `NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs` for the installed Chromium, always with `--mute-audio`. The recorder is `game/dev/harness/record-dinamo-hint.cjs`; its header gives the exact WebM encoding command.

Root owns global README/spec/status updates. This worker changes only the scene hook/helpers/assets, the exact `wcp-bar` catalogue/ACTIVITIES rows, focused tests, and this handoff. No deployment or master change.
