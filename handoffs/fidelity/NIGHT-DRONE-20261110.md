# Night drone road lighting: evidence and remaining work

The owner supplied an airport night screenshot without an inspection report for that frame. Its exact airport, pose and conditions are unconfirmed. Both SeaTac and Otopeni remain in the review scope; the supplied daytime reports are separate poses.

The first hypothesis was rejected. On exact live source `8abd2e91`, the renderer already follows the active drone proxy. Candidate `453077b3` made no improvement at the 26 m SeaTac fixture and was reverted in root `5a755df8`. The original before/after images and zero-error reports remain in `/workspace/integration-qa-evidence/night-viewer-20261110/{baseline,candidate}`. Do not publish that rejected candidate.

A second reproduction exposes a coverage gap. At SeaTac world eye `[-973.187,147,487.795]`, bearing 141.059°, pitch −20°, the viewed road is about 400 m from the camera's ground projection. The old 150 m selection excludes lamps near that viewed road. The original native image and source lamp coordinates are retained under `altitude-baseline-v2`. Earlier daylight pictures in that directory record an observer clock-setup error; only `seaTac-night-drone-147m-native-condition.png` is the corrected night control.

Root `0a4c0944`, isolated runtime `1816a467546c3b387a2c99e33f31eb861a6ef127`, selects existing lamp pools around the ground viewed by an elevated camera. It keeps the original 150 m policy at driver eye height relative to the road; transition is smooth from 12–45 m, with a finite 450 m look-ahead and 600 m range ceiling. Pool capacity stays 220; Ultra point-light slots stay 24. Lamp locations, source population and intensities are unchanged.

Native candidate review at both airports is in `altitude-candidate`. The SeaTac high view selects 45 lamps versus the old 19 and visibly retains pools on the viewed road. Repeated 1.6/45/147/260/45/1.6 m cycles retain 24 slots, the same instance buffer, 160 geometries and 32 textures before/after. Ground selection returns to the original origin, radius and 19 lamps. There are zero page errors. The Otopeni review still shows a dark apron; apron floodlight source coverage is separate and unresolved. These are setup-pose software-renderer captures, not an ordinary flight or hardware-FPS claim.

The isolated candidate passes mandatory foot/a with zero high/medium issues and one informational software-GL FPS low. Exact served hashes are retained in `logic-candidate/served-source.json`. Pure coverage controls cover the ground/elevated-driver policy, viewed-ground negative control and finite upward/horizon cases.

Status: candidate under review, not published; owner report remains open. Finish the original airport/apron context, ordinary night flight and mode/scene transitions, affected overview evidence and delivered-byte verification before closing it.
