# Actual office sign captures

The visual harness previously pointed every close-up at a fixed back-wall pose. Rosetti's sign is on a scaled side wall, behind that camera. The QA helper now frames the actual authored sign plane, keeps all corners inside the viewport and restores the complete camera transform/lens after capture. Room bounds and actual scene-ray intersections keep portrait views inside the room and in front of partitions; geometry and materials remain unchanged. An incomplete close-up becomes a medium capture finding.

Eight independent projection/transform/room/partition regression cases pass. Actual native `Office` scenes from immutable runtime **4378317** pass **16/16 office/viewport cases**, with **144/144 independent near-edge rays** reaching the sign first, full camera restoration and zero page/console errors. Viewports are 1280×720 and 390×844. Every resulting image was inspected: text and sign edges remain visible. The initial native run's Arnia portrait partition obstruction is retained losslessly; the corrected captures clear it. Rosetti's former forward-wall camera is a negative control in both viewports.

The exact final raw report is in `proof/report.json.gz`; `proof/image-manifest.json` hashes all final images and the tested source. Committed pictures show Rosetti's before/after and both final Arnia views; all originals remain at `/workspace/integration-qa-evidence/office-final-4378317-full-sign/`. The first launch failed before creating a browser because the default Playwright executable was absent; that raw infrastructure failure remains at `/workspace/integration-qa-evidence/office-final-4378317/report.json`. The standalone runner now uses the installed Chromium fallback.

```sh
node --test game/dev/harness/integration-office-sign-frame.test.mjs
node game/dev/harness/integration-office-sign-check.cjs SOURCE_ROOT OUTPUT_DIRECTORY
```

This is authored office-render/sign capture proof. Native walking/dialogue, whole-game phone modal behavior, district render budgets and final release acceptance are separate checks. Root owns README/spec consolidation and release.
