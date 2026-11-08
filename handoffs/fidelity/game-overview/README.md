# Game technical overview

Owned files: `game/overview/index.html`, `style.css`, `overview.js`, `generate.mjs`, `inventory.json`, and this handoff. Comparison viewer/data files are a local integration overlay from `fidelity/comparison-index`; they are deliberately excluded from this commit.

The new canonical page is `/game/overview/`. It contains ten searchable sections, expandable implementation detail, the data/architecture flow, actual controls/settings, source-vs-simulation-vs-target labels, district/landmark/tourist matrices, known gaps, and SHA-pinned sources. It embeds the comparison viewer via its public module API. No links to the removed `/comparisons/romana/` route remain in owned files.

Source review: `a1d1f22271b6e9e03dbe28ff29aeab78c00799ca`. Inventory: 8 districts, 10 chapters, 61 landmark entries / 60 builders, 24 tourist entries / 19 scenes, 12 historical READY entries, 112 achievement catalogue entries at the reviewed source; the page reads this count from inventory so a restored Easter egg can update it without stale removal copy. All 93 hashed source files exactly match the pinned commit. READY is clearly a historical menu gate, not a current parity endorsement. Per-landmark actions use the actual catalogue anchor coordinates to select the nearest survey tile, with an explicit no-dedicated-pair caveat. Other six districts expose unavailable comparison status.

## Integration

1. Integrate this commit and the comparison-index commit. Viewer source is `game/overview/comparison-viewer.js`, CSS `comparison-viewer.css`, data `comparison-data/**`.
2. The overview expects `mountComparisonViewer(element,{baseURL})` returning `setState({location,scope,lat,lon,label})`. This is coordinated and implemented by comparison-index.
3. Re-run `node game/overview/generate.mjs` after game release integration to update the pinned source/inventory from the release HEAD. The generator reads current checkout source; pass `--source=<sha>` only when current game/docs files match that commit. Root owns final README/spec/releases and deletion of old comparison routes.
4. The overview contains no runtime AI or game dependencies and no telemetry script. Existing game/CV links stay local. Official aerial imagery is loaded live by the comparison viewer; no reference imagery is committed.

## Verification

Evidence directory: `/workspace/reality-pass/game-overview`.

- Actual system Chromium via the required global preload; all browsers `--mute-audio`.
- Desktop 1440×1000 and mobile 390×844: no horizontal page overflow, no page errors, no local HTTP failures, ten sections and 8/61/24 inventory rows.
- Accent-insensitive search, no-results/clear, auto-open matching detail panels, direct landmark anchors, embedded district/nearest-landmark actions, and unsupported district handling passed.
- All 60 inline source references match the 93-file hashed source inventory; all 64 unique local destinations return HTTP 200.
- Actual game DOM inventory confirms 5 title controls, 9 pause Settings controls, six time presets, seven live-panel weather choices and five season choices; zero game page errors. `ui-inventory.json` records labels, ranges and values. The current code uses **M for spot map / G for drone**, despite the older README controls table.
- Direct managed-browser Esri requests hit its missing proxy-CA trust (`qa-direct-browser.json` records this); failure UI remains explicit. Final image QA uses Python urllib with normal verified TLS to the official Esri endpoint, then supplies those verified responses to Playwright. No certificate verification bypass and no repository imagery. `qa-results.json` has zero page/console/local-network errors for that pass.
- Syntax and diff whitespace checks pass. No game code changed; game physics/harness integration remains root's responsibility.

Screenshots were visually inspected. `prototype-*` show the early design; `final-*-top`, `final-*-controls`, `final-*-comparisons`, `final-*-comparison-pair` show the integrated guide. The final overview integration pass includes both Romană and Floreasca: Floreasca opens all 90 captures with 20 playable-core views. Desktop/mobile screenshot pairs were inspected. Mobile selection descendants fit inside the actual 312px comparison column; page width remains 390px.

The latest user instruction adds a 15-minute bounded client-memory cache for official aerial responses, owned by comparison-index. Overview credit/explanation text reflects that behavior and distinguishes it from committed/hosted imagery. A runtime-generated achievement count avoids stale statements about permanent hidden-feature removal. The generator now rejects provenance if any hashed source file differs from the named source commit.
