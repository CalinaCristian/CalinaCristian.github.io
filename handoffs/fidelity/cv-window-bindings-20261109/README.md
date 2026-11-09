# CPU live-window preparation · 9 November 2026

Scope: eight-room geographic binding audit plus independent off-axis math and one externally owned bounded render target. No Main/render/world/office/window-aperture edits, no browser, source clones, panorama or secondary simulation. Root approved the API and owns integration/fallback choice.

- `game/research/cv-window-bindings.{json,md}`: exact retained source `79e1e4fd`: 14 input blobs, 8 room IDs, 15 source parts, 163 outer and four courtyard source-edge candidates, plus separate historical Plaza Center evidence. All current room floors/bearings/elevations/source apertures and fallback selections are null.
- UiPath Bucharest current Building A conflicts with retained Corp B. Suite 2000 is not established floor 20. JPC explicitly fourth-floor evidence belongs only to historical Plaza Center. UPB seven-level tag is a dome roof part with min_level 6, not seven usable floors. Europe House count discrepancy stays unresolved. No source/data migration was made.
- Public source response metadata and factual tags are retained; private photo/plan/provider pixels are not. Fresh OSM primary-tag XML and the older private page bodies stay in the research scratchpad. Exact official URL/hash/time metadata is durable in the JSON.

## Integration API

```js
import {configureOffAxisWindow} from './office-window-math.js';
import {createOfficeWindowTarget} from './office-window-target.js';
const portal = createOfficeWindowTarget({renderer, maxPixels:262144, maxDimension:1024});
portal.resize(actualAperturePixelWidth, actualAperturePixelHeight, pixelRatio);
configureOffAxisWindow(dedicatedUnparentedPerspectiveCamera, {
  eye: mappedActualEyeWorld,
  lowerLeft: actualSourceFacadeLowerLeftWorld,
  lowerRight: actualSourceFacadeLowerRightWorld,
  upperLeft: actualSourceFacadeUpperLeftWorld,
  far: existingSourceWorldFar,
  clipOutsideFacadeM: .02,
});
portal.capture(dedicatedUnparentedPerspectiveCamera, camera => renderTheOneExistingWorld(camera));
// attach portal.texture through root adapter; target texture has officeExternal=true
// root detaches the map and disposes this owner once when leaving the office
portal.dispose();
```

Corners are ordered as seen from the interior eye; cross(right,up) points toward that eye. They must be an actual orthogonal source-facade rectangle in the same world coordinate frame as the eye. Camera must be dedicated/unparented. Do not call `camera.updateProjectionMatrix()` after configuration: that would erase the off-axis projection. Eye must remain on the interior side. Far must exceed the outside facade clipping plane. Input validation runs before camera mutation. The near offset is restricted to 0..0.1 source metres; actual outer facade selection remains root's responsibility, including any protrusions/thickness. Math hides/removes no geometry.

Capture is synchronous/nonrecursive. Root must not schedule async work through it; the callback renders the current existing world exactly once and may not create/tick another simulation. The helper restores target/cube/mip/viewport/scissor/test/autoClear/XR in `finally` on errors. One target object, no multisampling/mips; target resizing releases the old allocation through Three.setSize. Final disposal is idempotent. It owns neither renderer nor previous target/world/camera/material; root owns attachment and its material. The external-texture marker matches the actual Office resource-snapshot exclusion.

## Controls and limits

Run without a browser:

```sh
node handoffs/fidelity/cv-window-bindings-20261109/window-controls.mjs
python handoffs/fidelity/cv-window-bindings-20261109/ledger-controls.py
```

The ledger builder reads exact retained Git objects in memory. It uses already retained public response metadata if private scratch files are absent; it does not refetch providers or make a source snapshot. `build-ledger.py` is a research reconstruction tool, never a game build/runtime requirement.

Actual Three matrix/target and source/blob controls are CPU evidence. Renderer state is an explicit fixture; it does not prove GPU correctness or actual room/viewpoint correspondence. Pending: root integration, ordinary-eye actual district view/parallax, current clock/weather/traffic parity, source-wall clipping, rendered color/quality/performance, repeated-office renderer.info/WeakRef disposal and actual user-supplied room/floor/bearing facts. No live/final acceptance claim.
