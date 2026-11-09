# Retained-district office windows — staged candidate

Base: `027b681bf08e2b9000c5685fd5f5345f0792d31a`. No browser was started. No source data, buildings, rooms, physical actors, creation rules, RNG, quality presets or world geometry changed. This is CPU-reviewed integration, not native acceptance or a completed eight-room feature.

Main retains its existing World/scene/Traffic/clock/weather. Each active Office frame advances the normal clock and native Traffic once. The existing environment advances with a dedicated source-world camera, `cockpit:false,cull:false`; the off-axis projection is configured afterward using `visibilityFar`. The full unchanged right-wall aperture maps at unit scale with a right-handed basis (Office +X outward, +Z source-right, +Y up). The physical player/car never moves to the room; driving entries show the exterior parked car, and foot entries return to the saved physical foot pose. Source-world camera hooks govern vegetation and visible recovery. Street DOM bubbles are hidden while inside, preserving dialogue evolution.

One HalfFloat/LinearSRGB target receives the retained world with NoToneMapping; the room applies the normal presentation tone mapping once. The target is measured from the actual clipped projected aperture and bounded to1,000,000pixels,2048per dimension and GPU maximum. Unsupported HDR stays unavailable. Target/cube/mip, viewport/scissor, XR, clear settings, tone mapping/exposure/output colour state restore in `finally`. No composer/cockpit display pass or second world is introduced. The normal sun shadow is refreshed for each actual source capture. The existing `renderer.info.autoReset=false` setup permits complete portal/environment/shadow/room counts before one final reset; paused Office draws also reset after their submitted room work. FPS uses actual visible presentation intervals averaged over at least0.5s, with no Office Auto-quality decision.

The service owns only its dedicated camera, bounded target and neutral placeholder. Entry failure, leave, repeated visits and city disposal restore pane ownership, observer cameras, physical return state, camera lens and HUD state. The original painted panorama is replaced by the live target or an honestly unavailable neutral pane, never presented as source-correspondent live imagery.

## Source binding scope

Every selection uses current source IDs/rings/holes and actual same-owner landmark triangles, never cached ledger indices, a nearest unrelated wall, an arbitrary far clipping plane or a floor inferred from a suite number. The structural aperture projects onto a literal outer edge, and the entire rectangular eye-motion envelope must fit the polygon including holes. The independently recorded thin facade envelope comes only from the unchanged identified builder (room-specific known thin ground facade detail: Rosetti≤.15m, DB≤.08m, Arnia≤.26m); larger projections, uncovered/oblique uncertified surfaces and neighboring source volumes fail closed. This coverage certificate is deliberately conservative: missing opaque coverage is not itself proof that a real opening is invalid.

CPU unchanged-builder checks support:

- Arnia `w246115249`, candidate source edge4: emitted envelope offset0.2425968113m, complete retained triangle coverage, modeled baseY0.12.
- Rosetti `w28240279`, candidate edge2: offset0.1332685405m, complete coverage, modeled baseY0.12.
- DB BOB `w55450549`, candidate edge0: offset0.0600013288m, complete coverage, modeled baseY0.12.

Those edge numbers are CPU candidates with a controlled street-distance callback, not native source-selected window evidence. Runtime scores only actual public ground-street adjacency; native selection/eye pixels are unverified. The visible label says estimated ground-level live view and actual office floor unverified. The modeled0.12base is the retained landmark datum, not surveyed building/office elevation.

Remaining five are unfinished:

- UPB full pane crosses the recessed/finned ground facade; no arbitrary clip beyond fins.
- Hermes full pane crosses the recessed ground facade/floor transition. No block/floor invented.
- UiPath Bucharest official A versus retained B remains an identity HOLD.
- GTS has real emitted wall triangles; the current strict parallel-plane coverage test cannot certify their slightly oblique source/model alignment. Exact source faces and emitted vertices are retained in `actual-bindings.json`. This is not a claim of a real hole, courtyard or facade absence, and is not finished acceptance.
- Lincoln’s tested ground full apertures encounter same-owner podium/lobby projections or fail complete room fit. No podium/skybridge substituted for the actual office floor.

## Reproduction and open gates

Run from repository root:

```
node handoffs/fidelity/live-office-windows/controls.mjs
node handoffs/fidelity/live-office-windows/actual-bindings.mjs
node handoffs/fidelity/cv-window-bindings-20261109/window-controls.mjs
python3 handoffs/fidelity/cv-window-bindings-20261109/ledger-controls.py
```

The actual-builder replay reads current committed data directly from Git, creates no checkout or World, uses the real unchanged Office constructor and landmark builder and preserves all source geometry. It uses a controlled public street-distance callback to isolate facade certification; this is explicitly not a native road/eye-view gate. GTS diagnostic triangles retain exact projected source coordinates, material and triangle indices. `controls.mjs` executes real Three projection/targets and the exact Main office methods with bounded host controls; it checks holes/concavities, full coverage/slits/projections, HDR and renderer failures, actual projected pixels, ordinary clock/Traffic frequency, foot/drive rollback,20repeated disposals and both actual recovery-camera hooks.

Required later: immutable combined-root native desktop/phone visits, actual projected aperture/head-parallax pixels against street geometry, all three candidate source selections and five explicit holds, driver/foot/city/menu repeated lifecycle/GPU allocations, native weather/time/season and Traffic evolution/stable identities, complete warm/shadow/PMREM/Office budget attribution and mandatory foot/a regression. Existing overview photographs keep their original dated provenance; none is recertified by this CPU candidate.

GTS limiting-projection detail: candidate edge5 also encounters owner triangle5554 at depth2.4867534m, a .22×.30m freestanding gate/mailbox-shaped detail in the authored entrance furniture. This is exterior geometry that should remain visible, not a reason to move the clipping plane. The aggregate-owner projection gate conservatively refuses it; it does not establish a true incompatible structural aperture. A future reviewed GTS binding must distinguish its wall skin from exterior furniture without removing either. Edge5 prism10/11 and edge7 prism16/17 are slightly oblique opaque walls, while edge6 prism14/15 lies0.075–0.095m inward. These remain exact model/source correspondence issues.
