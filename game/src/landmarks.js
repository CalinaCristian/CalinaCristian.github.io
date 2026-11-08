import * as THREE from '../vendor/three.module.min.js';
import { makeWaterMaterial } from './water.js';
import { US_FOOTPRINTS as U, US_SOURCE_TAGS as UT } from './landmark-us-source.js';
import { emitUSLandmarkTerrain } from './landmark-us-terrain.js';
import { sourceProfile, sourceSlope } from './landmark-us-geometry.js';

// ============================================================================
//  Drive My CV — procedural models of the real landmarks of Bucharest and
//  Seattle / Bellevue.
//
//  Usage (world side):
//      import { LANDMARKS, buildLandmark } from './landmarks.js';
//      for (const lm of LANDMARKS.filter(l => l.city === city.id)) {
//          const q = proj(lm.lat, lm.lon);                 // anchor in world metres
//          const r = buildLandmark(lm, { THREE, rng });     // { mesh, clear, collision, triangles }
//          r.mesh.position.set(q.x, groundY, q.z);          // rotation is already applied
//          scene.add(r.mesh);
//          for (const c of r.collision) boxes.push({ ...c, x: q.x + c.x, z: q.z + c.z, r: Math.hypot(c.hw, c.hd) });
//      }
//
//  Conventions
//  - Model local frame: origin at the anchor (lat/lon), +y up, +x east, +z south (before rotation).
//  - `rotation` is a yaw in radians applied as mesh.rotation.y = rotation (three.js convention:
//    a model vector (x, z) ends up at (x cos r + z sin r, -x sin r + z cos r)). buildLandmark()
//    already assigns it, so the world only needs to set the position (re-assigning is harmless).
//  - Collision boxes {x, z, hw, hd, angle} are returned relative to the anchor in WORLD axes
//    (rotation and city scale already applied), `angle` uses the same convention as
//    world.js collideBuildings(). Add the anchor's world position to x/z.
//  - Every model is authored in real metres. Bucharest is built at 1:1. Seattle: in the legacy corridor world (scaled
//    0.5 on x/z) the Builder squashes x/z by SEA_SCALE; chapter districts are real 1:1 (spec 10), so pass
//    ctx.realScale = true to get Seattle at 1:1 (result.authoredScale says which; LANDMARKS[].radiusM = radius in real
//    metres). Legacy behaviour is the default until the spec 22 cleanup removes the corridor world.
//  - District-era landmarks (2026-11, `P2` footprints) use rotation 0 and footprints projected at the anchor from the
//    raw OSM tiles; `cvStop` / `passing` name the CV POI hosted by the model; `districtOnly` models (road-aligned
//    structures) are skipped in the legacy world.
//  - Anchors / orientations / footprints come from OpenStreetMap (ways listed per landmark,
//    footprints simplified with Douglas-Peucker and stored in P below, in model-frame metres).
//  - Geometry is merged into one BufferGeometry per material (vertex colours), so every
//    landmark costs 1-4 draw calls.
//  - Facade detail comes from cheap Builder helpers (windows = 1 quad per window, cornice, pilasters,
//    text = 5x7 block letters, fence) and storeys() for classical blocks; each builder cites its sources
//    ("Src:" line + numbers in its comment). Dev viewer: game/dev/landmarks.html?id=<id>&view=street|top.
// ============================================================================

export const SEA_SCALE = 0.5;
const P = {
    parliament: [[-87,69,-86.5,92,-101,108,-113.5,108.5,-112.5,136,-84.5,135.5,-84.5,126,-69.5,110,-14,109,-14,116.5,20,115.5,20,109,69,108.5,86,123,85.5,137.5,115,137.5,115,109.5,104.5,109.5,87,92,85,-91,102,-110,113.5,-110,113.5,-137.5,86.5,-137,86,-122.5,65,-102.5,2,-101.5,-66.5,-101.5,-86,-121.5,-86,-134.5,-114.5,-135,-115,-106,-102.5,-106,-83,-85,-82.5,-33,-112,-32.5,-110.5,30.5,-87,30.5],[-27,-54.5,-27,-30,-18,-29,-15,-23.5,13.5,-23.5,16.5,-29,24,-30.5,24.5,-62.5,21.5,-62.5,19.5,-51.5,13,-41.5,0,-37,-7,-38,-18.5,-46,-24.5,-61,-27,-61],[-36.5,72.5,-36.5,40.5,-28.5,40.5,-28.5,29.5,-21.5,29.5,-15.5,24.5,13.5,24,17.5,28,25,29,25.5,39,33,39,33.5,72.5,25.5,72.5,25.5,65.5,16,65.5,16,52.5,14,49,9.5,48,-13,48.5,-17.5,50.5,-19,66,-27,66,-27,72],[-60.5,83,39,82.5,38,-72,-19.5,-71.5,-19.5,-66,-29,-66,-29,-24.5,-62,-24.5,-62.5,-87.5,-37,-87.5,-37,-93.5,56,-94.5,56,-88,82,-88,82,-64.5,60.5,-64.5,61.5,81,82,80.5,82.5,104.5,-60.5,105.5],[39.5,60,66,60,66,41.5,60.5,41.5,60,-25.5,66,-25.5,66,-46.5,38.5,-46.5]],
    cathedral: [[-60.5,-16,-60.5,15.5,-51,15.5,-51,26,-48,29,-36.5,29,-33.5,26,-33.5,22.5,-12.5,22.5,-12.5,27,-11,29,4.5,29,8.5,34,16,35,21,32.5,24,29,39.5,29,41.5,26,41.5,18,48,17,52.5,14.5,58,8.5,60,4,60,-5,58,-9.5,55,-14,50.5,-17.5,41.5,-19.5,41.5,-26.5,38.5,-29.5,23.5,-29.5,17.5,-34.5,10.5,-34.5,4,-29.5,-9.5,-29.5,-12.5,-27,-12.5,-21.5,-34,-21.5,-34,-26.5,-36.5,-29.5,-49,-29.5,-51,-27,-51,-16]],
    arcul: [[12.5,4.5,12.5,-4.5,-12.5,-4.5,-12.5,4.5]],
    casapresei: [[-130,48,-128,48,-127,-49.5,-129,-49.5,-129,-71,-127,-71,-127,-74,-105.5,-74,-105.5,-71.5,16,-71.5,15,-139.5,34.5,-139.5,34.5,-120.5,32,-120.5,32.5,-71.5,114,-72,112.5,-138.5,130,-138.5,130.5,-121,127.5,-121,128,-56.5,75,-56,75,-45.5,91.5,-45.5,91.5,-31.5,84,-31.5,84,-27,87,-27,86.5,25.5,83.5,25.5,83.5,30.5,90,30.5,90,45,76,45,76,56,128.5,56,129,139.5,112,139.5,113.5,72.5,30.5,72,32,139.5,13.5,139.5,15.5,71,-106.5,70.5,-106.5,73.5,-127.5,73.5,-127.5,70.5,-130.5,70.5],[-58,30.5,-106.5,30.5,-106,-34.5,-1.5,-34.5,-2,31],[60,45,64,45,63.5,56,34,55.5,34,46.5,18.5,46.5,19,8,23,8,23,10.5,65,10.5,67,30.5,60,30.5],[23,-7,19,-7,19,-45.5,34,-45.5,34,-55.5,63.5,-56,63.5,-45.5,60.5,-45.5,60.5,-32,67,-32,65.5,-9.5,23,-9.5]],
    grandhotel: [[2.5,31.5,11,31,20,27.5,26.5,14.5,22.5,7.5,23,-2.5,19.5,-1.5,19,-3,22,-6,11.5,-17,13.5,-22,10.5,-31,-7.5,-31.5,-10.5,-22,-10,-16.5,-21,-7.5,-18,-4.5,-19,-3,-22,-3.5,-22,6,-26.5,13.5,-23,19.5,-21,27,-11.5,30.5,-1.5,31.5,0,28.5,2,28.5]],
    univ: [[42.5,32,43,16.5,24.5,16,24.5,11.5,21,11,21,8.5,0,8,0,15.5,-9,15.5,-9,19.5,-23.5,19.5,-23.5,15.5,-28.5,15,-29,8,-49,8,-49,10.5,-57.5,10,-57,29,-30.5,29.5,-30.5,32,-2,32,-2,30],[93.5,-15.5,100.5,-8.5,89,30.5,42.5,31,43.5,14,49.5,14.5,49.5,11.5,73,12,75,10.5,77,3,75,0,54,-1.5,55.5,-19],[-22,-26.5,-24.5,-2,-21,-2,-21.5,0.5,-2,2,-0.5,-10,32,-7,33.5,-6,33,1.5,44,2.5,44.5,-5,54,-5,55,-16.5,47.5,-17,48,-20,32.5,-21.5,32,-18.5,-0.5,-21.5,0,-24.5],[100,-9.5,93.5,-15.5,55.5,-19,55,-16.5,47.5,-17,48,-20,32.5,-21.5,32,-18.5,-0.5,-21.5,0,-24.5,-22,-26.5,-22.5,-23.5,-50.5,-26,-50.5,-29,-68,-30.5,-70.5,0.5,-51,2.5,-50.5,-4.5,-21,-2,-21.5,0.5,-2,2,-0.5,-10,32,-7,33.5,-6,33,1.5,44,2.5,44.5,-5,47,-5.5,54.5,-5,54,-1.5,75,0,77,3,75,10.5,73,12,49.5,11.5,49.5,14.5,43.5,14,43,16.5,24.5,16,24.5,11.5,21,11,21,8.5,0,8,0,15.5,-9,15.5,-9,19.5,-23.5,19.5,-23.5,15.5,-28.5,15,-29,8,-49,8,-49,10.5,-79,9.5,-82.5,7,-82,-6,-77,-9,-75,-12,-74,-31,-82.5,-31,-86,-32,-88,-31,-97,-9.5,-100,-6.5,-99.5,23.5,-95,28.5,-71,29,-71,30.5,-57,30.5,-57,29,-30.5,29.5,-30.5,32,-2,32,-2,30,25,30.5,25,32,87.5,31.5,90.5,28.5],[-22.5,-23.5,-24.5,-2,-50.5,-4.5,-51,2.5,-70.5,0.5,-68,-30.5,-50.5,-29,-50.5,-26],[-57.5,10,-57,30.5,-95,28.5,-99,25.5,-100,-6.5,-97,-9.5,-87,-31.5,-74,-31,-75,-12,-77,-9,-82,-6,-82.5,7,-79,9.5]],
    tnb: [[5,-0.5,5.5,27,8,39,12,51.5,43,55,73,53.5,78,40.5,82.5,17,78.5,-44.5,60,-45,60,-54,33.5,-55,33,-46.5,-49.5,-49.5,-49.5,-54,-70.5,-54.5,-70.5,-50.5,-80.5,-51,-82.5,-4]],
    ateneu: [[24.5,25,24.5,12.5,33,13,33.5,-13.5,24.5,-13.5,24.5,-24.5,-23,-25,-33.5,25]],
    regal: [[-122,28,-119.5,-9,-121.5,-11.5,-121,-20.5,-117,-22.5,-117.5,-26.5,-105.5,-29.5,-103,-27.5,-57,-38.5,-55.5,-40.5,-48,-43,-43,-42.5,-41.5,-41,-36.5,-25,-40,-22,-35,-8.5,-36,-8,-34,-0.5,-29.5,0.5,-26.5,5.5,-13,6.5,-12.5,1,-1.5,2,-1.5,4,26.5,6.5,26.5,4,37.5,5,37,11,50.5,12,53.5,8.5,59,8.5,65,-7,66,-6.5,69,-12.5,66.5,-14,66.5,-16.5,73.5,-31,75,-31.5,86,-26,85.5,-24.5,125,-7,119.5,6.5,122.5,8,120.5,12,117.5,10.5,111,21.5,98.5,16.5,97.5,15,99,12,90.5,7.5,94.5,0,83.5,-6,80.5,0.5,82.5,1.5,77.5,11.5,75,10,72,16,74.5,17.5,70.5,25.5,69,25,66,31.5,62.5,30,62,35,56,35,56,41.5,-18.5,33.5,-18,26.5,-27,26.5,-27,27.5,-70,24.5,-70,23.5,-95.5,21.5,-96,26,-102.5,25.5,-102.5,29.5,-100.5,31.5,-102.5,41.5,-104.5,41.5,-104.5,43,-122.5,41.5,-122.5,40,-125,38,-124.5,29]],
    victoria: [[-46.5,21.5,-7.5,21,-7.5,23,-9,23,-9,33,6.5,33.5,6.5,23.5,4,23.5,4,21,46.5,21,46.5,17,48,17,48,3.5,46.5,3.5,46,-33.5,26,-33,26,-26,6.5,-26,6.5,-29,-6.5,-29,-6.5,-26,-28,-26,-28,-32.5,-46.5,-32.5,-46,4.5,-48,4.5,-48,18,-46.5,18]],
    cec: [[-21,30,-20.5,8,-22,8,-21.5,2,-22.5,2,-21.5,-7.5,-20.5,-7.5,-21.5,-30,18,-30,17.5,-8,22,-8,22.5,-6,22.5,7,22,8.5,17.5,9,18,29.5]],
    mnir: [[-51,29,-51.5,41.5,-34,42,-34,43.5,13.5,55.5,17,56.5,17,55,46,61.5,49.5,60,51.5,45,50.5,37.5,49,37,49,12.5,50,12.5,51,-15.5,49.5,-15.5,50,-39,50.5,-45,51.5,-45,52,-53,50.5,-53,49.5,-61,45.5,-61.5,23,-57.5,23,-59,18.5,-58,19,-56.5,-4,-53,-4,-54.5,-8.5,-54,-8.5,-52.5,-31.5,-49,-30.5,-44.5,-32.5,-44,-32.5,-47,-51.5,-47,-51.5,-28,-48.5,-27.5,-49,23,-52,23],[-8.5,13,-8.5,4.5,-13.5,4.5,-14,23,-1,26,0,22,23.5,27.5,22.5,32,34.5,34,34.5,13,31.5,13,31.5,-15.5,34.5,-15.5,33.5,-22.5,35,-36.5,26.5,-35.5,27.5,-31.5,0.5,-27,-3.5,-26.5,-4,-31,-13.5,-29.5,-13.5,-14.5,-8.5,-14.5,-8.5,-22.5,27,-22.5,27,13]],
    marriott: [[-33,67.5,38.5,67.5,41,66,41.5,48,40,45.5,36,45,32,12.5,32.5,-10.5,36.5,-43.5,41,-43.5,42.5,-45.5,42.5,-63,41.5,-65,31.5,-65.5,31,-67,-32.5,-67.5,-32,-45,-40,-44,-42,-35,-39.5,-30,-29,-29.5,-29,-24.5,-38,-24.5,-38,-13,-38,23.5,-29,23.5,-29,28.5,-40,29,-42.5,33.5,-42.5,38.5,-39.5,43,-33,43.5]],
    unirea: [[2,-31.5,8,-34.5,2.5,-47,-3,-44,-19.5,-53.5,-93,-16,-92,-14,-101,-13,-108,-3,-81,47.5,-74,52,-65.5,53.5,63,52.5,77,49,90,38.5,97.5,27.5,101,16,108,-36.5,78,-40,72,7.5,61,7.5,61,4.5,-23.5,4.5,-23.5,-5.5,-63.5,-5.5,-63,23.5,-68.5,24,-68.5,39.5,-74,29.5,-71.5,27.5,-72,13.5,-74.5,9,-68,5.5,-75,-7,-18.5,-36,-12.5,-32.5,-11.5,-35,-6,-31.5]],
    skytower: [[-22.5,3,-22.5,-3,-21,-7.5,-18,-11.5,-11,-16.5,-7,-17.5,-2.5,-18,9,-17,15.5,-13.5,19,-9.5,21,-6,22.5,-0.5,21.5,3.5,17,11.5,9.5,16.5,3,18,-7.5,18,-15.5,14.5,-21,8.5]],
    promenada: [[-80,49.5,-85.5,46.5,-86,44,-84.5,-44,-82.5,-48.5,-80,-50,80.5,-49.5,83.5,-48.5,85.5,-46,85,44,82,49.5]],
    baneasasc: [[-45.5,-108.5,-67,-137,-18,-184.5,34.5,-133,32.5,-7,89,-6.5,87,108,43.5,107.5,43.5,95,31.5,95,31,111,25,116.5,32,123,31.5,134.5,19.5,145.5,22,148.5,13.5,156,-0.5,141.5,-44,184.5,-87,140.5,-47,102.5,-69,65,-79,30.5,-89,30.5,-89,-38.5,-77.5,-38,-67,-73]],
    romexpo: [[-44.5,-44,-35.5,-51.5,-25,-57,-14,-61,-2,-62.5,9.5,-62,21,-59,31.5,-54,41,-47.5,49.5,-39,55.5,-29,60,-18.5,62.5,-7,62.5,4.5,60.5,16,56.5,26.5,50,37.5,43.5,45,34,52.5,25,57.5,16,60.5,6,62.5,-6,62.5,-16.5,60.5,-27.5,56.5,-36,51.5,-44.5,44.5,-52,35.5,-57,26.5,-60.5,16.5,-62.5,5.5,-62.5,-5,-60.5,-16,-57,-26,-51.5,-35.5]],
    gara: [[103.5,54.5,105,71,103,71,103,76,-48,77,-48.5,53.5,18.5,53,18.5,55],[33,-64,81,-64.5,81,-62,90,-63,90,-60.5,104.5,-61,105,-30.5,86.5,-30.5,87,20.5,96,20.5,96,14.5,106,16.5,106.5,54.5,71,55,69.5,-42.5,36.5,-42.5,38,55,18.5,55,18.5,53,-48.5,53.5,-48.5,36,16,35.5,16,26.5,19,26.5,19,15.5,15.5,15.5,16.5,0,15.5,0,15.5,-5,24.5,-5,24,-32.5,19.5,-32.5,18,-63,29.5,-62,29.5,-64],[38,55,36.5,-42.5,69.5,-42.5,71,55],[-48.5,26.5,-48.5,60,-66.5,61,-71,60,-71,58.5,-87,58,-85.5,65,-96,67.5,-102.5,41.5,-104.5,40,-106.5,33,-102.5,27],[49.5,23,55,23,55,11.5,49.5,11.5,49.5,-36,58,-36,58.5,43.5,50,43.5,50,38,53,38,53,30,50,30],[78.5,-64.5,33,-64,32.5,-76.5,78.5,-77]],
    opera: [[-62.5,-56.5,-62.5,1,-25,1,-25,58,24,58,24,1,62.5,1,62.5,-58,44.5,-58,44.5,-24.5,30,-24.5,30,-31.5,-28,-32,-28,-24.5,-45.5,-24.5,-45.5,-56.5]],
    politehnica: [[-23,-24,24,-23.5,23.5,24,-24,23]],
    hermes: [[5.5,57,6.5,-10.5,64.5,-10,64,57.5],[5,-20.5,5,-57.5,43.5,-57.5,43.5,-21],[-4,57.5,-64.5,57.5,-64,-47,-4.5,-48.5],[-28.5,-23,-46.5,-23.5,-47.5,33.5,-29,34]],
    baneasaterm: [[-23,-20,-24.5,-17.5,-62.5,-42.5,-55.5,-55,-51.5,-53,-50,-55.5,-14,-35,-15,-32.5,-8,-29,1.5,-31.5,10,-29.5,14,-27,21,-30,16.5,-37,52,-54.5,53.5,-53,57,-54.5,62.5,-44,59.5,-43,62,-38,26.5,-17,25,-19,23,-18,26.5,-12.5,32.5,-16,33.5,-13.5,29.5,-10,22.5,-1,16.5,15.5,13.5,15.5,14,9,7.5,8.5,7.5,10.5,12,10.5,9.5,50,7,50.5,6.5,55.5,-6.5,55,-7.5,3,-15,-5,-17,-11.5,-16.5,-16.5]],
    otp: [[-181.5,196,-203,196,-203,120.5,-196.5,111,-29.5,110.5,-29.5,118,-32.5,118.5,-32.5,122,-27.5,122,-27.5,128,-8.5,128,-9.5,188.5,-11.5,190,-9.5,192.5,-11.5,195],[114.5,194.5,114.5,129,203,129,203,194],[-2,117.5,36,117.5,36,108,32.5,108,32.5,61,45,61,46.5,65.5,48,57.5,32.5,58.5,32.5,21.5,44.5,21.5,46,26,47.5,18,32.5,19,32.5,-13,35,-17,45,-17,45.5,-12.5,48,-13.5,48,-20,35.5,-19,38.5,-34,38,-57.5,48.5,-57.5,49,-52.5,51.5,-51.5,53,-61,38,-60.5,35.5,-95.5,49,-95.5,49.5,-90,53,-90.5,53,-99,35.5,-98.5,46.5,-118.5,49,-143.5,59,-143.5,60,-137.5,63.5,-139,63.5,-147,49,-146,47,-163,41.5,-172,53.5,-182.5,47.5,-188.5,45,-188.5,47.5,-182,39.5,-174,31,-179,18,-180.5,18,-196.5,10,-196,8.5,-194,14.5,-192,15,-180.5,-2,-176,-10.5,-183.5,-7.5,-188.5,-11,-190,-16.5,-184,-4,-174,-9,-166.5,-12,-147,-22.5,-147,-23,-152.5,-27,-151.5,-27,-143.5,-12,-144,-9,-115.5,-0.5,-98,-17.5,-99,-17,-90,-13.5,-90,-13,-95.5,0,-95,-2,-60,-17.5,-61,-17.5,-53,-15.5,-51,-13,-57.5,-2,-57.5,-1,-19.5,-9.5,-19.5,-9.5,-21.5,-12.5,-21.5,-12.5,-14.5,-10,-13.5,-9.5,-17,-0.5,-17.5,2,-13,1.5,108,-2,108]],
    ase: [[-18.37,-0.54,-20.11,-46.76,-44.45,-48.3,-40.32,31.74,-40.09,34.61,-39.62,36.11,-38.88,37.63,-37.5,38.59,-36.19,39.4,-34.07,40.02,-32.12,39.99,-30.61,39.25,-25.91,40.74,-22.94,41.86,-19.36,43.15,-15.02,45.02,-11.23,46.82,-7.85,48.63,-4.55,50.89,-1.03,47.03,3.58,42.33,-1.71,38.35,4.08,34.24,34.44,37.88,34.7,36.01,34.77,34.12,38.67,34.62,42.3,6.45,7.57,2.44],[0.46,14.35,0.04,19.98,2.27,23.06,15.77,24.24,16.66,16.01],[-9.82,8.57,-3.5,17.01,-3.15,9.35],[-5.36,22.96,-19.02,33.91,-11.0,36.2,-1.1,28.26],[-25.56,4.87,-17.76,5.39,-30.45,16.21,-30.68,8.66,-27.19,8.69,-25.69,7.43]],
    ambasador: [[23,-8,24.5,3,-24,17.5,-24.5,1.5,-20,0.5,-22,-10,-24,-9.5,-24,-17.5,-17.5,-16.5,-17,-13,-8.5,-14.5,-8,-16,5,-14.5,6,-10.5,8.5,-9.5,15.5,-11.5,15.5,-13.5,22,-13]],
    aro: [[6,22,4.5,29,-13.5,25.5,-12,17,-3,19,-6.5,6.5,-5,6,-6.5,-1,-9,0,-9.5,-3,-7.5,-3.5,-9,-10.5,-11,-10,-11.5,-12.5,-9.5,-13.5,-13,-29,0.5,-29,13.5,23,7,24]],
    spaceneedle: [[2,18.5,9,16.5,15,12,18,5.5,19,-2,17,-9,12,-14.5,6,-18,-1.5,-18.5,-9.5,-16.5,-15,-11,-17,-7.5,-19,0,-17,7.5,-12.5,14,-5.5,18]],
    columbia: [[-19,-17.5,-9,-19,-3.5,-22,1,-27,5.5,-34.5,8,-37,36.5,-37,36.5,36.5,-36.5,36.5,-36.5,-17.5],[2.5,26,24,13.5,21.5,9,15,0.5,6.5,-6,2,-9,-3,-11,-13.5,-14,-25,-14,-25,12,-16.5,12,-9.5,13.5,-3.5,17.5],[20.5,12.5,12.5,2.5,2.5,-5,-9.5,-9,-17.5,-10.5,-17,-7,-22.5,9,-14.5,9.5,-7,12,-1,16.5,4,22.5],[2,-9,6.5,-6,15,0.5,18.5,4.5,24,13.5,9,22.5,11,26,29.5,15,25.5,7.5,23.5,0.5,24,-6.5,28.5,-16.5,7,-29,2,-19.5,0,-14.5,-1,-10],[21,7.5,19.5,0,20,-4,20.5,-8,23.5,-15,7,-24.5,3.5,-17,1.5,-9,11,-3,18.5,4.5,21.5,9],[21,-21,23,-24,5.5,-34.5,1,-27,-3.5,-22,-9,-19,-19,-17.5,-19,-14,-8,-12.5,-1,-10,2,-19.5,7,-29]],
    smith: [[18,20,4.5,20,4,18,-1.5,18,-1.5,20,-18,20,-18,1.5,-16,1.5,-16,-4.5,-18,-4.5,-18,-19,-1.5,-20,18,-8.5]],
    tmobile: [[119,-101,78.5,101.5,-94,101,-94,99,-104.5,100.5,-114,95.5,-119,82.5,-117,75.5,-113,70,-116.5,70,-116,-88,-98.5,-88,-98.5,-43.5,-101,-42.5,-94,-39.5,-77,-81,-72,-83.5,-73.5,-85.5,-65,-92.5,-60.5,-87.5,-53,-94,-62,-94,-62,-100.5]],
    spheres: [[-19.5,3.5,-18,-5,-15.5,-9,-10.5,-14,-10.5,-21,-9.5,-25,-7,-28,-4,-31,-0.5,-32.5,3,-33.5,7,-33,11,-32,14,-29.5,17,-27,18.5,-23,19.5,-19.5,19,-15.5,16,-9,19,-2,19.5,2,19.5,6.5,17,13,19.5,18,19.5,21.5,19,25,17,28,14.5,30.5,11.5,32.5,8,33.5,4,33,1,32,-2,30,-4.5,27,-6,21.5,-12,18.5,-17.5,12]],
    seatac: [[-393,-237,-381.5,-221,-386.5,-217.5,-377.5,-205.5,-387.5,-198.5,-380,-188.5,-385,-185,-368,-161.5,-373,-157.5,-360,-139.5,-337.5,-151.5,-371,-223.5,-352.5,-237,-294.5,-127,-310,-118.5,-334.5,-146.5,-349,-136,-299.5,-70,-314.5,-104,-298.5,-115.5,-280,-89.5,-256.5,-106.5,-177.5,3,-152.5,18,-132,21.5,-96,10.5,40,-87,43.5,-82,67.5,-96.5,101.5,-105,112.5,-100,119.5,-90.5,255.5,-191.5,247.5,-202.5,291.5,-234,300,-222.5,319,-230,398,-216.5,401.5,-236,412,-234.5,411.5,-230,447.5,-224.5,445,-210.5,472.5,-206,466.5,-170.5,448,-174,447.5,-169,401.5,-176.5,402,-181.5,367.5,-187,366.5,-192,314.5,-203,167,-96.5,178,-80.5,-36.5,73,-27,81.5,-22,77.5,-11.5,92.5,-19.5,104,-4,126,-17.5,136,-7.5,150,-14.5,155,-9,163,-15,167.5,-2.5,185,6,186.5,7.5,178,75,189,74.5,193.5,92,198.5,134,202.5,141,214.5,139,226,128,237,73.5,226.5,75,219.5,64,221,64.5,217.5,58.5,216.5,57.5,220.5,26.5,215,27,211.5,12.5,212.5,10.5,208.5,9.5,213.5,-14,210,-17.5,199.5,-20,201.5,-67,136,-64,133.5,-69,132.5,-74,119.5,-109.5,146,-113,140,-140,151.5,-160,152.5,-188.5,144,-211,124,-214.5,126.5,-227,109.5,-287.5,153,-285,157,-297,165,-299,162,-302.5,168.5,-327,163.5,-326.5,160,-332,163,-349.5,156.5,-350.5,160.5,-357,159.5,-356.5,155,-361.5,154.5,-362.5,162,-394,156.5,-392.5,149.5,-398,152,-409,147,-413,170.5,-472.5,160.5,-470,148,-466.5,148.5,-463,108,-459.5,106,-439,109.5,-438,106,-432,110.5,-424,108.5,-424.5,112,-391.5,117,-393.5,129.5,-389,126.5,-310.5,142,-301,135.5,-309.5,125.5,-304.5,121.5,-317,104,-307,74.5,-288.5,82,-248.5,53.5,-253.5,47,-262,52.5,-275,34.5,-262,25,-356.5,-107.5,-362.5,-111,-361,-114,-364,-118.5,-367,-116,-435.5,-206.5]],
    seatower: [[-3.5,10.5,-6.5,8,-8,4,-7.5,-1.5,-5,-6.5,-1.5,-9.5,3,-10.5,6.5,-8.5,8,-5,8,2,7,6,5,9.5]],
    bellevuetowers: [[-37.5,-27.5,-28.5,-33,-17,-37.5,0,-37,-10,-15,-37.5,-15],[14,3,-6.5,20.5,-2,31.5,-3,33,18,33.5,34,29.5,44.5,24,42.5,22.5,41,10.5,42,10.5,43,8.5,13.5,0.5,13,3],[-47.5,-28.5,-33,-34.5,-19.5,-38,-1.5,-37.5,0,-37,-1,-35,1.5,-34,40,-34,47.5,-26,47.5,3,42,3,39.5,7.5,43,8.5,42,10.5,41,10.5,44.5,20.5,42.5,22.5,44.5,24,28,31,28,36.5,6.5,35.5,6.5,38,-44,38,-44,30,-43,30,-43,26.5,-44.5,26,-45.5,14.5,-42.5,14,-42.5,9.5,-44,9.5,-44,0,-37,-2.5,-37.5,-10.5,-47.5,-12]],
    bellevuesq: [[-181.5,-11,-183,103.5,-181,112,-168,119.5,-131.5,120,-131.5,124.5,-119.5,127,-116.5,122,-67,122,-62.5,118,-62.5,110.5,-53.5,110.5,-35,111,-35.5,123,-28,123.5,-28,126,45.5,124.5,46,86,49.5,86,50,68.5,46,68.5,46.5,61.5,119,63,119,80,182,80.5,183,-19.5,120,-20,120,-15.5,117.5,-15.5,118,-24.5,81,-25,81,-20.5,39,-21,39,-43.5,46.5,-43,47,-59.5,51.5,-59,53,-125.5,23.5,-126,23,-109.5,1.5,-109.5,-5.5,-109.5,-5.5,-126.5,-49.5,-127,-50.5,-58.5,-35,-57.5,-35.5,-35,-71.5,-35.5,-72,-30,-120,-30.5,-120.5,-10]],
    mtbaker: [[359,-21,358.5,3.5,252,24.5,252,71.5,-359,67,-359,-38,152,-35,152.5,-71,252.5,-71.5]],
};

// ---------------------------------------------------------------------------
//  Shared materials (one set for all landmarks -> few programs / draw calls)
// ---------------------------------------------------------------------------
let MATS = null;
/** (2026-11-08, owner: "account for weather?") the matte landmark material: the renderer gives its up-facing surfaces (roofs,
 *  stands, courts, the stadium pitch) the same snow / wet look as the streets */
export function landmarkSurfaceMaterials() { const M = materials(); return [M.m, M.fl, M.nb].filter(Boolean); }
function materials() {
    if (MATS) return MATS;
    MATS = {
        m: new THREE.MeshLambertMaterial({ vertexColors: true }),                                   // masonry / matte
        g: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.35 }), // glass / metal
        w: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false }), // water
        f: new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }),                       // far backdrops (mountains)
        e: new THREE.MeshBasicMaterial({ vertexColors: true }),                                     // self-lit: lobby glow, lit signage
    };
    MATS.m.name = 'landmark-masonry'; MATS.w.name = 'landmark-water'; MATS.f.name = 'landmark-backdrop'; MATS.e.name = 'landmark-glow';
    // (after round 6) glass at night: lit office floors behind the panes (≈ 30 % of panes, warm / cool, mullions, some blinds),
    // averaged to an even glow where panes get sub-pixel — glass towers (Hermes, Sky Tower, Bellevue) were dark stripes
    { const g = MATS.g; g.emissive = new THREE.Color('#ffe2b8'); g.emissiveIntensity = 0; g.userData.nightEmissive = 0.85; g.userData.nightGlow = 0.85; g.userData.dayGlow = 0;
      g.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW; varying vec3 vGN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz; vGN = normalize(mat3(modelMatrix) * objectNormal);');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW; varying vec3 vGN;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {   float wall = 1.0 - smoothstep(0.3, 0.6, abs(vGN.y));
            vec2 tg = normalize(vec2(-vGN.z, vGN.x) + 1e-5);
            vec2 c = vec2(dot(vGW.xz, tg) / 1.6, (vGW.y - 0.3) / 3.6); vec2 id = floor(c), f = fract(c);
            float run = floor(id.x / 4.0), hf = fract(sin(dot(vec2(run, id.y), vec2(12.9898, 78.233)) + floor(vGW.x * 0.01) * 3.1) * 43758.5453);
            float pid = fract(sin(dot(id, vec2(39.3, 11.7))) * 24634.63);
            float pane = smoothstep(0.03, 0.08, f.x) * (1.0 - smoothstep(0.92, 0.97, f.x)) * smoothstep(0.1, 0.18, f.y) * (1.0 - smoothstep(0.86, 0.94, f.y));
            float lit = step(hf, 0.3) * pane * (pid < 0.2 ? 0.2 : 1.0) * (0.6 + 0.4 * smoothstep(0.3, 0.85, f.y));
            float fw = length(fwidth(c)); lit = mix(lit, 0.3 * 0.7, smoothstep(0.3, 0.8, fw));
            vec3 tint = mix(vec3(0.75, 0.82, 0.95), vec3(1.0, 0.85, 0.65), step(0.5, fract(hf * 7.3)));
            float glassy = 1.0;
            #ifdef USE_COLOR
                glassy = step(vColor.r, vColor.b + 0.12) * step(max(vColor.r, max(vColor.g, vColor.b)), 0.75); // glass tints only — not gold domes / crosses, not white trims
            #endif
            totalEmissiveRadiance *= wall * lit * tint * glassy * step(2.5, vGW.y); }`);
      };
      g.customProgramCacheKey = () => 'landmark-glass-night2'; }
    // floodlit masonry (LANDMARKS[].floodlit): the 'm' geometry of floodlit monuments uses this material instead. Warm
    // emissive scaled per vertex by the vertex colour (stone glows, dark windows stay dark) and dimmed on up-facing
    // surfaces (floodlights hit the walls, not the roofs), fading with height and varying by facade direction. emissiveIntensity is 0 by day; render.js eases it to
    // userData.nightEmissive at night (contract 01-architecture "Night-lit materials").
    const fl = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#ffd7a3'), emissiveIntensity: 0 });
    // nightGlow/dayGlow mirror nightEmissive for the spots' setNightWindows() (spots/index.js), so both drivers agree
    fl.name = 'landmark-floodlit'; fl.userData.nightEmissive = 1.1; fl.userData.nightGlow = 1.1; fl.userData.dayGlow = 0; fl.userData.floodlit = true;
    fl.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFlood;')
            .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 fN = normalize(mat3(modelMatrix) * objectNormal); vFlood = (1.0 - 0.8 * max(fN.y, 0.0)) * (0.72 + 0.28 * abs(fN.x)) * mix(1.0, 0.55, clamp(position.y / 70.0, 0.0, 1.0));');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFlood;')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor.rgb * vColor.rgb * 1.25;\n#endif\ntotalEmissiveRadiance *= vFlood;');
    };
    fl.customProgramCacheKey = () => 'landmark-floodlit';
    MATS.fl = fl;
    // night-lit accent (e.g. the blue-lit rim of the UPB Rectorat dome): vertex-coloured Lambert + emissive eased by render.js
    const nb = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#3f7fff'), emissiveIntensity: 0 });
    nb.name = 'landmark-nightlight'; nb.userData.nightEmissive = 2.2; nb.userData.nightGlow = 2.2; nb.userData.dayGlow = 0;
    MATS.nb = nb;
    return MATS;
}

const _col = new THREE.Color();
const _colCache = new Map();
function rgb(c) {
    let v = _colCache.get(c);
    if (!v) { _col.set(c); v = [_col.r, _col.g, _col.b]; _colCache.set(c, v); }
    return v;
}

/** flat [x,z,x,z,...] -> [[x,z],...] */
function pts(flat) { const o = []; for (let i = 0; i < flat.length; i += 2) o.push([flat[i], flat[i + 1]]); return o; }
function rect(x0, z0, x1, z1) { return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; }
function ellipse(cx, cz, rx, rz, n = 24, a0 = 0) { const o = []; for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; o.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]); } return o; }
function roundRect(cx, cz, w, d, r, n = 4) {
    const o = [], hx = w / 2 - r, hz = d / 2 - r;
    const cs = [[hx, hz, 0], [-hx, hz, 1], [-hx, -hz, 2], [hx, -hz, 3]];
    for (const [x, z, q] of cs) for (let i = 0; i <= n; i++) { const a = (q + i / n) * Math.PI / 2; o.push([cx + x + Math.cos(a) * r, cz + z + Math.sin(a) * r]); }
    return o;
}
function signedArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length]; a += x1 * z2 - x2 * z1; } return a / 2; }
function centroid(p) { let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } return [x / p.length, z / p.length]; }
function bbox(list) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const p of list) for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { x0, z0, x1, z1 }; }
/** offset polygon outward by d (negative = inset), miter-limited */
function offset(p, d) {
    const s = signedArea(p) > 0 ? 1 : -1, n = p.length, o = [];
    for (let i = 0; i < n; i++) {
        const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
        let e1x = b[0] - a[0], e1z = b[1] - a[1], e2x = c[0] - b[0], e2z = c[1] - b[1];
        const l1 = Math.hypot(e1x, e1z) || 1, l2 = Math.hypot(e2x, e2z) || 1;
        const n1x = s * e1z / l1, n1z = -s * e1x / l1, n2x = s * e2z / l2, n2z = -s * e2x / l2;
        let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz);
        if (ml < 1e-6) { mx = n1x; mz = n1z; } else { mx /= ml; mz /= ml; }
        const k = d / Math.max(0.35, mx * n1x + mz * n1z);
        o.push([b[0] + mx * k, b[1] + mz * k]);
    }
    return o;
}
/** z extent of polygon(s) along the vertical line x (returns [minZ, maxZ] or null) */
function zAt(list, x) {
    let lo = Infinity, hi = -Infinity;
    for (const p of list) for (let i = 0; i < p.length; i++) {
        const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length];
        if ((x1 - x) * (x2 - x) <= 0 && x1 !== x2) { const z = z1 + (z2 - z1) * (x - x1) / (x2 - x1); lo = Math.min(lo, z); hi = Math.max(hi, z); }
    }
    return lo < hi ? [lo, hi] : null;
}
function xAt(list, z) { return zAt(list.map(p => p.map(([a, b]) => [b, a])), z); }

/** deterministic pseudo random */
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

// ---------------------------------------------------------------------------
//  Builder: accumulates flat-shaded, vertex-coloured triangles per material.
//  All inputs in model metres (real size); x/z are multiplied by `hs`.
// ---------------------------------------------------------------------------
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
function M(x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    _e.set(rx, ry, rz, 'YXZ');
    return new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
}

class Builder {
    constructor(hs = 1) { this.hs = hs; this.wall = null; this.bk = {}; this.cols = []; this.extras = []; this.fences = []; this.covers = []; this.grounds = []; this.coverPolys = []; this.stack = [new THREE.Matrix4()]; this.ox = 0; this.oz = 0; }
    /** translate everything that follows by (dx, dz) model metres (lets a builder keep its source coordinates when its anchor moves) */
    shift(dx, dz) { this.ox = dx; this.oz = dz; return this; }
    _b(mat) { return this.bk[mat] || (this.bk[mat] = { p: [], n: [], c: [] }); }
    get frame() { return this.stack[this.stack.length - 1]; }
    push(m) { this.stack.push(this.frame.clone().multiply(m)); return this; }
    pop() { this.stack.pop(); return this; }

    /** raw triangle; hint = approximate outward normal (unscaled) used to fix winding */
    tri(a, b, c, col, mat = 'm', hint = null) {
        const s = this.hs, ox = this.ox, oz = this.oz;
        const A = [(a[0] + ox) * s, a[1], (a[2] + oz) * s], Bv = [(b[0] + ox) * s, b[1], (b[2] + oz) * s], C = [(c[0] + ox) * s, c[1], (c[2] + oz) * s];
        const ux = Bv[0] - A[0], uy = Bv[1] - A[1], uz = Bv[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        let P2 = Bv, P3 = C;
        if (hint && nx * hint[0] / s + ny * hint[1] + nz * hint[2] / s < 0) { P2 = C; P3 = Bv; nx = -nx; ny = -ny; nz = -nz; }
        const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return;
        nx /= l; ny /= l; nz /= l;
        const k = this._b(mat), r = rgb(col);
        k.p.push(A[0], A[1], A[2], P2[0], P2[1], P2[2], P3[0], P3[1], P3[2]);
        k.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
        k.c.push(r[0], r[1], r[2], r[0], r[1], r[2], r[0], r[1], r[2]);
    }
    quad(a, b, c, d, col, mat, hint) { this.tri(a, b, c, col, mat, hint); this.tri(a, c, d, col, mat, hint); }

    /** vertical walls around polygon p (inward=true for courtyard holes) */
    ring(p, y0, y1, col, o = {}) {
        const s = (signedArea(p) > 0 ? 1 : -1) * (o.inward ? -1 : 1);
        for (let i = 0; i < p.length; i++) {
            const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length];
            const hint = [s * (bz - az), 0, -s * (bx - ax)];
            this.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], col, o.mat || 'm', hint);
        }
    }
    /** horizontal cap (with holes) at height y; up = +1 / -1 */
    cap(p, y, col, holes = [], up = 1, mat = 'm') {
        const c = p.map(([x, z]) => new THREE.Vector2(x, z));
        const h = holes.map(q => q.map(([x, z]) => new THREE.Vector2(x, z)));
        const all = c.concat(...h);
        let faces;
        try { faces = THREE.ShapeUtils.triangulateShape(c, h); } catch (e) { faces = []; }
        for (const [i, j, k] of faces) this.tri([all[i].x, y, all[i].y], [all[j].x, y, all[j].y], [all[k].x, y, all[k].y], col, mat, [0, up, 0]);
    }
    /** extruded polygon */
    prism(p, y0, y1, col, o = {}) {
        const holes = o.holes || [], mat = o.mat || 'm';
        this.ring(p, y0, y1, col, { mat });
        for (const h of holes) this.ring(h, y0, y1, o.holeCol || col, { mat, inward: true });
        if (o.top !== false) this.cap(p, y1, o.topCol || col, holes, 1, mat);
        if (o.bottom) this.cap(p, y0, col, holes, -1, mat);
    }
    /** horizontal window / spandrel bands, slightly proud of the facade */
    bands(p, y0, y1, fh, col, o = {}) {
        const frac = o.frac ?? 0.42, off = o.off ?? 0.18, mat = o.mat || 'm';
        const op = offset(p, off), hs = (o.holes || []).map(h => offset(h, -off));
        let ya = Infinity, yb = -Infinity;
        for (let y = y0 + (o.start ?? fh * 0.32); y + fh * frac <= y1 - 0.3; y += fh) {
            this.ring(op, y, y + fh * frac, col, { mat });
            for (const h of hs) this.ring(h, y, y + fh * frac, col, { mat, inward: true });
            ya = Math.min(ya, y); yb = Math.max(yb, y + fh * frac);
        }
        // piers in the wall colour split the bands into individual windows
        const wall = o.wall ?? (mat === 'm' ? this.wall : null);
        if (wall && ya < yb) {
            this.piers(offset(p, off + 0.06), ya - 0.05, yb + 0.05, o.pitch || 3.6, wall, false, o.pierW);
            for (const h of (o.holes || [])) this.piers(offset(h, -off - 0.06), ya - 0.05, yb + 0.05, o.pitch || 3.6, wall, true, o.pierW);
        }
    }
    /** single outward-facing pier quads along each edge */
    piers(p, y0, y1, pitch, col, inward = false, pw = 0.42) {
        const s = (signedArea(p) > 0 ? 1 : -1) * (inward ? -1 : 1);
        for (let i = 0; i < p.length; i++) {
            const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length], L = Math.hypot(bx - ax, bz - az);
            if (L < pitch * 0.8) continue;
            const k = Math.max(1, Math.round(L / pitch)), dx = (bx - ax) / L, dz = (bz - az) / L, hw = Math.min(L / k * pw / 2, 1.2);
            const hint = [s * dz, 0, -s * dx];
            for (let j = 0; j <= k; j++) {
                const t = j / k * L, cx = ax + dx * t, cz = az + dz * t;
                const t0 = Math.max(0, t - hw), t1 = Math.min(L, t + hw);
                this.quad([ax + dx * t0, y0, az + dz * t0], [ax + dx * t1, y0, az + dz * t1], [ax + dx * t1, y1, az + dz * t1], [ax + dx * t0, y1, az + dz * t0], col, 'm', hint);
            }
        }
    }
    /** mansard-ish roof: inset prism */
    roof(p, y, h, col, inset = 2, o = {}) { const q = offset(p, -inset); this.prism(q, y, y + h, col, { holes: (o.holes || []).map(x => offset(x, inset)), topCol: o.topCol }); }

    /** Pitched surface over the complete source outline, with open courts and shared subdivision edges.
     * Eaves/rise are explicit authoring estimates where OSM has no roof:height; no centroid fan or inset-box roof. */
    sourceRoof(p, y, h, col, inset = 2, { holes = [], mansard = false } = {}) {
        const contour = p.map(q => new THREE.Vector2(...q)), rings = holes.map(r => r.map(q => new THREE.Vector2(...q)));
        const all = contour.concat(...rings), points = all.map(q => [q.x, q.y]);
        let faces = THREE.ShapeUtils.triangulateShape(contour, rings);
        for (let pass = 0; pass < 10; pass++) {
            const mids = new Map(), next = [];
            for (const f of faces) for (let i = 0; i < 3; i++) {
                const a = f[i], c = f[(i + 1) % 3], key = a < c ? `${a},${c}` : `${c},${a}`;
                if (mids.has(key) || Math.hypot(points[a][0] - points[c][0], points[a][1] - points[c][1]) <= 4) continue;
                mids.set(key, points.length); points.push([(points[a][0] + points[c][0]) / 2, (points[a][1] + points[c][1]) / 2]);
            }
            if (!mids.size) break;
            for (const f of faces) {
                const mid = f.map((a, i) => { const c = f[(i + 1) % 3]; return mids.get(a < c ? `${a},${c}` : `${c},${a}`); });
                const n = mid.filter(i => i !== undefined).length;
                if (!n) { next.push(f); continue; }
                if (n === 3) { next.push([f[0], mid[0], mid[2]], [mid[0], f[1], mid[1]], [mid[2], mid[1], f[2]], mid); continue; }
                const k = n === 1 ? mid.findIndex(i => i !== undefined) : mid.findIndex(i => i === undefined), a = f[k], c = f[(k + 1) % 3], d = f[(k + 2) % 3];
                if (n === 1) next.push([a, mid[k], d], [mid[k], c, d]);
                else { const u = mid[(k + 1) % 3], v = mid[(k + 2) % 3]; next.push([d, v, u], [a, c, v], [c, u, v]); }
            }
            faces = next;
        }
        const vertex = ([x, z]) => {
            let distance = Infinity;
            for (const ring of [p, ...holes]) for (let i = 0; i < ring.length; i++) {
                const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1];
                const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
                distance = Math.min(distance, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
            }
            const t = Math.min(1, distance / inset), rise = mansard ? (t < 0.45 ? t / 0.45 * 0.8 : 0.8 + (t - 0.45) / 0.55 * 0.2) : t;
            return [x, y + h * rise, z];
        };
        for (const f of faces) this.tri(...f.map(i => vertex(points[i])), col, 'm', [0, 1, 0]);
    }

    // ---- THREE geometry based primitives (respect the frame stack) ----
    geo(g, col, m, mat = 'm') {
        let gg = g.index ? g.toNonIndexed() : g.clone();
        const S = new THREE.Matrix4().makeScale(this.hs, 1, this.hs).multiply(new THREE.Matrix4().makeTranslation(this.ox, 0, this.oz)).multiply(this.frame);
        if (m) S.multiply(m);
        gg.applyMatrix4(S);
        if (!gg.attributes.normal) gg.computeVertexNormals();
        const P = gg.attributes.position.array, N = gg.attributes.normal.array, k = this._b(mat), r = rgb(col);
        for (let i = 0; i < P.length; i++) { k.p.push(P[i]); k.n.push(N[i]); }
        for (let i = 0; i < P.length / 3; i++) k.c.push(r[0], r[1], r[2]);
        gg.dispose();
    }
    box(x, y, z, w, h, d, col, o = {}) { this.geo(G.box, col, M(x, y + h / 2, z, o.ry || 0, w, h, d, o.rx || 0, o.rz || 0), o.mat); }
    cyl(x, y, z, rt, rb, h, col, seg = 12, o = {}) { this.geo(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), col, M(x, y + h / 2, z, o.ry || 0, 1, 1, 1, o.rx || 0, o.rz || 0), o.mat); }
    cone(x, y, z, r, h, col, seg = 12, o = {}) { this.geo(new THREE.ConeGeometry(r, h, seg, 1, true), col, M(x, y + h / 2, z, o.ry || 0), o.mat); }
    dome(x, y, z, r, h, col, seg = 16, o = {}) { this.geo(new THREE.SphereGeometry(1, seg, Math.max(3, Math.ceil(seg / 4)), 0, Math.PI * 2, 0, Math.PI / 2), col, M(x, y, z, 0, r, h, r), o.mat); }
    sphere(x, y, z, r, col, o = {}) { this.geo(new THREE.IcosahedronGeometry(r, o.detail ?? 1), col, M(x, y, z), o.mat); }
    /** cylinder lying along x */
    cylX(x, y, z, r, len, col, seg = 10, o = {}) { this.geo(new THREE.CylinderGeometry(o.r2 ?? r, r, len, seg), col, M(x, y, z, 0, 1, 1, 1, 0, -Math.PI / 2), o.mat); }
    /** square pyramid / hipped roof centred at x,z (base at y), rotated ry */
    hip(x, y, z, w, d, h, col, o = {}) {
        const ry = o.ry || 0, c = Math.cos(ry), s = Math.sin(ry), mat = o.mat || 'm';
        const T = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
        const r = o.ridge ?? Math.max(0, (w - d) / 2);  // half ridge length along local x
        const hw = w / 2, hd = d / 2;
        const A = T(-hw, 0, -hd), B = T(hw, 0, -hd), C = T(hw, 0, hd), D = T(-hw, 0, hd), R1 = T(-r, h, 0), R2 = T(r, h, 0);
        const up = (lx, lz) => [lx * c + lz * s, 0.5, -lx * s + lz * c];
        this.quad(A, B, R2, R1, col, mat, up(0, -1)); this.quad(C, D, R1, R2, col, mat, up(0, 1));
        this.tri(B, C, R2, col, mat, up(1, 0)); this.tri(D, A, R1, col, mat, up(-1, 0));
    }
    /** gable / triangular pediment prism: triangle in local x-y, extruded along local z */
    pediment(x, y, z, w, h, depth, col, ry = 0, mat = 'm') {
        const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2);
        this.geo(g, col, M(x, y, z, ry), mat);
    }
    /** wall slab in local x-y with arched openings cut from the bottom; extruded along local z */
    archWall(W, H, depth, arches, col, m, mat = 'm') {
        const s = new THREE.Shape(); s.moveTo(-W / 2, 0);
        for (const a of [...arches].sort((p, q) => p.x - q.x)) {
            const r = a.w / 2, spring = a.h - r;
            s.lineTo(a.x - r, 0); s.lineTo(a.x - r, spring); s.absarc(a.x, spring, r, Math.PI, 0, true); s.lineTo(a.x + r, 0);
        }
        s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.lineTo(-W / 2, 0);
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 }); g.translate(0, 0, -depth / 2);
        this.geo(g, col, m, mat);
    }
    /** row of columns between two points */
    colonnade(x0, z0, x1, z1, y, h, n, r, col, o = {}) {
        for (let i = 0; i < n; i++) {
            const t = n === 1 ? 0.5 : i / (n - 1), x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
            if (o.square) this.box(x, y, z, r * 2, h, r * 2, col, { ry: o.ry || 0 });
            else this.cyl(x, y, z, r * 0.88, r, h, col, o.seg || 8);
            if (o.capital) this.box(x, y + h - 0.6, z, r * 2.6, 0.6, r * 2.6, o.capital, { ry: o.ry || 0 });
        }
    }
    /** rectangular beam (w wide, h tall) between two 3D points — truss members, arch ribs, hangers (12 tris) */
    strut(a, c, w, h, col, mat = 'm') {
        const d = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]), L = d.length(); if (L < 1e-4) return;
        d.divideScalar(L);
        const up = Math.abs(d.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const zA = new THREE.Vector3().crossVectors(d, up).normalize(), yA = new THREE.Vector3().crossVectors(zA, d).normalize();
        const m = new THREE.Matrix4().makeBasis(d, yA, zA).scale(_s.set(L, h, w)).setPosition((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2);
        this.geo(G.box, col, m, mat);
    }
    /** tube along points [[x,y,z],...] */
    tube(points, r, col, o = {}) {
        const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])));
        this.geo(new THREE.TubeGeometry(curve, o.seg || 16, r, o.radial || 6, !!o.closed), col, null, o.mat);
    }

    // ---- facade detail helpers (all cheap: 2 tris per window / 6 per pilaster) ----
    /**
     * Window grid on every edge of polygon p (holes: o.inward). One quad per window, floors of height fh from
     * y0 (+o.start) to y1, bays of ~o.bay metres. o.wf / o.hf = window width / height as a fraction of the bay
     * / floor; o.minL skips short edges; o.skip(edge, bay, floor, nBays) -> true hides a window; o.arch adds a
     * round-head triangle; o.edges limits to a list of edge indices.
     */
    windows(p, y0, y1, fh, col, o = {}) {
        const s = (signedArea(p) > 0 ? 1 : -1) * (o.inward ? -1 : 1), mat = o.mat || 'm', off = o.off ?? 0.07;
        const bay = o.bay ?? 3.6, wf = o.wf ?? 0.5, hf = o.hf ?? 0.55, start = o.start ?? fh * 0.25, nF = Math.max(0, Math.floor((y1 - y0 - start - fh * hf) / fh + 1 + 1e-6));
        let n = 0;
        for (let i = 0; i < p.length; i++) {
            if (o.edges && !o.edges.includes(i)) continue;
            const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length], L = Math.hypot(bx - ax, bz - az);
            if (L < (o.minL ?? bay * 0.9)) continue;
            const k = Math.max(1, Math.round(L / bay)), dx = (bx - ax) / L, dz = (bz - az) / L, nx = s * dz, nz = -s * dx, hw = L / k * wf / 2;
            const hint = [nx, 0, nz];
            for (let j = 0; j < k; j++) {
                const t = (j + 0.5) / k * L, cx = ax + dx * t + nx * off, cz = az + dz * t + nz * off;
                const x0 = cx - dx * hw, z0 = cz - dz * hw, x1 = cx + dx * hw, z1 = cz + dz * hw;
                for (let f = 0; f < nF; f++) {
                    if (o.skip && o.skip(i, j, f, k)) continue;
                    const ya = y0 + start + f * fh, yb = ya + fh * hf;
                    this.quad([x0, ya, z0], [x1, ya, z1], [x1, yb, z1], [x0, yb, z0], col, mat, hint); n++;
                    if (o.arch) {  // round head approximated by a trapezoid cap
                        const ys = yb + hw * 0.72, k2 = 0.38;
                        this.quad([x0, yb, z0], [x1, yb, z1], [x1 - dx * hw * k2, ys, z1 - dz * hw * k2], [x0 + dx * hw * k2, ys, z0 + dz * hw * k2], col, mat, hint);
                    }
                }
            }
        }
        return n;
    }
    /** projecting cornice / string course: offset ring with top and bottom caps */
    cornice(p, y, h, out, col, o = {}) {
        const q = offset(p, out), holes = (o.holes || []).map(x => offset(x, -out));
        this.ring(q, y, y + h, col); for (const hq of holes) this.ring(hq, y, y + h, col, { inward: true });
        if (o.solid) { this.cap(q, y + h, o.topCol || col, holes, 1); this.cap(q, y, col, holes, -1); return; }
        // thin lips only (cheap): top ring between the wall and the cornice edge
        this.lip(p, q, y + h, o.topCol || col, 1); this.lip(p, q, y, col, -1);
        for (let k = 0; k < holes.length; k++) { this.lip(o.holes[k], holes[k], y + h, o.topCol || col, 1); this.lip(o.holes[k], holes[k], y, col, -1); }
    }
    /** horizontal strip between two parallel rings (same vertex count) */
    lip(a, b, y, col, up = 1) { for (let i = 0; i < a.length; i++) { const j = (i + 1) % a.length; this.quad([a[i][0], y, a[i][1]], [a[j][0], y, a[j][1]], [b[j][0], y, b[j][1]], [b[i][0], y, b[i][1]], col, 'm', [0, up, 0]); } }
    /** pilasters (3-faced, 6 tris) at bay boundaries along each edge; o.every = keep every n-th, o.ends = corners only */
    pilasters(p, y0, y1, pitch, w, d, col, o = {}) {
        const s = (signedArea(p) > 0 ? 1 : -1) * (o.inward ? -1 : 1);
        for (let i = 0; i < p.length; i++) {
            if (o.edges && !o.edges.includes(i)) continue;
            const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length], L = Math.hypot(bx - ax, bz - az);
            if (L < pitch * 0.9) continue;
            const k = Math.max(1, Math.round(L / pitch)), dx = (bx - ax) / L, dz = (bz - az) / L, nx = s * dz, nz = -s * dx, ev = o.every || 1;
            for (let j = o.ends ? 0 : (o.inner ? 1 : 0); j <= (o.inner ? k - 1 : k); j += (o.ends ? k : ev)) {
                const t = Math.min(L - w / 2, Math.max(w / 2, j / k * L)), cx = ax + dx * t, cz = az + dz * t;
                const A = [cx - dx * w / 2, cz - dz * w / 2], B = [cx + dx * w / 2, cz + dz * w / 2], A2 = [A[0] + nx * d, A[1] + nz * d], B2 = [B[0] + nx * d, B[1] + nz * d];
                this.quad([A2[0], y0, A2[1]], [B2[0], y0, B2[1]], [B2[0], y1, B2[1]], [A2[0], y1, A2[1]], col, 'm', [nx, 0, nz]);
                this.quad([A[0], y0, A[1]], [A2[0], y0, A2[1]], [A2[0], y1, A2[1]], [A[0], y1, A[1]], col, 'm', [-dx, 0, -dz]);
                this.quad([B2[0], y0, B2[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [B2[0], y1, B2[1]], col, 'm', [dx, 0, dz]);
            }
        }
    }
    /**
     * Block letters (5x7 pixel font, horizontal runs merged) on a vertical plane: text centred at (x, y..y+h, z),
     * reading along local +x rotated by ry, facing local +z rotated by ry (i.e. a reader standing at +z).
     */
    text(str, x, y, z, ry, h, col, o = {}) {
        const px = h / 7, adv = 6 * px, chars = [...str.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')];
        const W = chars.length * adv - px, c = Math.cos(ry), sn = Math.sin(ry), d = o.d ?? 0.08, mat = o.mat || 'm';
        // o.flat: lay the text on a horizontal plane at height y (letters' up = local -z, readable from above / +z side)
        const T = o.flat ? (lx, ly) => [x + lx * c - ly * sn, y + d, z - lx * sn - ly * c] : (lx, ly) => [x + lx * c + d * sn, y + ly, z - lx * sn + d * c];
        const hint = o.flat ? [0, 1, 0] : [sn, 0, c];
        chars.forEach((ch, ci) => {
            const g = FONT[ch]; if (!g) return;
            for (let r = 0; r < 7; r++) {
                const row = g[r]; let k = 0;
                while (k < 5) {
                    if (row[k] !== '1') { k++; continue; }
                    let e = k; while (e < 5 && row[e] === '1') e++;
                    const lx0 = -W / 2 + ci * adv + k * px, lx1 = -W / 2 + ci * adv + e * px, ly1 = h - r * px - (o.flat ? h / 2 : 0), ly0 = ly1 - px;
                    this.quad(T(lx0, ly0), T(lx1, ly0), T(lx1, ly1), T(lx0, ly1), col, mat, hint);
                    k = e;
                }
            }
        });
        return W;
    }
    /** fence / railing along a polyline: posts every `pitch` m plus top and bottom rails */
    fence(line, h, pitch, col, o = {}) {
        for (let i = 0; i + 1 < line.length; i++) {
            const [ax, az] = line[i], [bx, bz] = line[i + 1], L = Math.hypot(bx - ax, bz - az), ang = -Math.atan2(bz - az, bx - ax);
            const n = Math.max(1, Math.round(L / pitch));
            for (let j = 0; j <= n; j++) { const t = j / n; this.box(ax + (bx - ax) * t, 0, az + (bz - az) * t, o.post || 0.5, j % (o.big || 1e9) === 0 ? h * 1.15 : h, o.post || 0.5, o.postCol || col); }
            this.box((ax + bx) / 2, h - 0.25, (az + bz) / 2, L, 0.12, 0.12, col, { ry: ang });
            if (o.base) this.box((ax + bx) / 2, 0, (az + bz) / 2, L, o.base, 0.45, o.baseCol || col, { ry: ang });
            if (o.bars) { const nb = Math.round(L / o.bars); for (let j = 1; j < nb; j++) { if (j % Math.round(pitch / o.bars) === 0) continue; const t = j / nb; this.quad([ax + (bx - ax) * t - 0.03, 0.4, az + (bz - az) * t], [ax + (bx - ax) * t + 0.03, 0.4, az + (bz - az) * t], [ax + (bx - ax) * t + 0.03, h - 0.2, az + (bz - az) * t], [ax + (bx - ax) * t - 0.03, h - 0.2, az + (bz - az) * t], col, 'm', [Math.sin(ang), 0, Math.cos(ang)]); } }
        }
    }

    // ---- collision (model frame, unscaled metres) ----
    col(x, z, hw, hd, angle = 0, bands = {}) { this.cols.push({ x: x + this.ox, z: z + this.oz, hw, hd, angle, ...bands }); }
    colSeg(x0, z0, x1, z1, hw) { const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); this.col((x0 + x1) / 2, (z0 + z1) / 2, L / 2, hw, -Math.atan2(dz, dx)); }
    /** Exact model-space solid, including open mapped courtyards; bounds only accelerate queries. */
    colPolygon(p, { holes = [], y0 = 0, y1 = 20 } = {}) {
        const shift = q => q.map(([x, z]) => [x + this.ox, z + this.oz]);
        const poly = shift(p), bb = bbox([poly]);
        this.cols.push({ x: (bb.x0 + bb.x1) / 2, z: (bb.z0 + bb.z1) / 2, hw: (bb.x1 - bb.x0) / 2, hd: (bb.z1 - bb.z0) / 2,
            angle: 0, h: y1, y0, y1, poly, holes: holes.map(shift) });
    }
    /** cover polygon(s) with axis-aligned strips (fills courtyards, good enough for a car) */
    colPoly(list, strip = 24) {
        const bb = bbox(list), n = Math.max(1, Math.round((bb.x1 - bb.x0) / strip)), w = (bb.x1 - bb.x0) / n;
        for (let i = 0; i < n; i++) {
            const xa = bb.x0 + i * w, xb = xa + w, iv = [];
            for (const x of [xa + 0.3, xa + w / 2, xb - 0.3]) {
                const zs = [];
                for (const p of list) for (let k = 0; k < p.length; k++) {
                    const [x1, z1] = p[k], [x2, z2] = p[(k + 1) % p.length];
                    if ((x1 - x) * (x2 - x) < 0) zs.push(z1 + (z2 - z1) * (x - x1) / (x2 - x1));
                }
                zs.sort((a, c) => a - c);
                for (let k = 0; k + 1 < zs.length; k += 2) iv.push([zs[k], zs[k + 1]]);
            }
            iv.sort((a, c) => a[0] - c[0]);
            const merged = [];
            for (const v of iv) { const m = merged[merged.length - 1]; if (m && v[0] <= m[1] + 1) m[1] = Math.max(m[1], v[1]); else merged.push([...v]); }
            for (const [lo, hi] of merged) if (hi - lo > 0.5) this.col((xa + xb) / 2, (lo + hi) / 2, w / 2, (hi - lo) / 2);
        }
    }
    /** point on the polygon perimeter at fraction t, with outward normal */
    perim(p, t) {
        const s = signedArea(p) > 0 ? 1 : -1; let L = 0; const seg = [];
        for (let i = 0; i < p.length; i++) { const a = p[i], c = p[(i + 1) % p.length], l = Math.hypot(c[0] - a[0], c[1] - a[1]); seg.push([a, c, l]); L += l; }
        let d = ((t % 1) + 1) % 1 * L;
        for (const [a, c, l] of seg) { if (d <= l) { const k = d / l, dx = (c[0] - a[0]) / l, dz = (c[1] - a[1]) / l; return { x: a[0] + dx * d, z: a[1] + dz * d, nx: s * dz, nz: -s * dx }; } d -= l; }
        return { x: p[0][0], z: p[0][1], nx: 1, nz: 0 };
    }
    /** merge everything into meshes */
    finish(o = {}) {
        const group = new THREE.Group(), MT = materials();
        let tris = 0;
        for (const [k0, b] of Object.entries(this.bk)) {
            if (!b.p.length) continue;
            const k = k0 === 'm' && o.floodlit ? 'fl' : k0;
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
            g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
            g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
            g.computeBoundingSphere(); g.computeBoundingBox();
            const mesh = new THREE.Mesh(g, k === 'fw' ? fountainMaterials().water : MT[k]);
            if (k === 'fw') { mesh.onBeforeRender = (r) => fountainTick(r); mesh.renderOrder = 1; FOUNTAIN_WATER.add(mesh); }
            mesh.castShadow = k !== 'w' && k !== 'f' && k !== 'e' && k !== 'fw'; mesh.receiveShadow = k !== 'f' && k !== 'e' && k !== 'fw';
            group.add(mesh);
            tris += b.p.length / 9;
        }
        for (const m of this.extras) { group.add(m); tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }   // custom meshes (fountain jets)
        return { group, tris };
    }
}
const G = { box: new THREE.BoxGeometry(1, 1, 1) };

// 5x7 pixel font for signage / inscriptions (Builder.text). Diacritics are folded to the base letter.
const FONT = (() => {
    const src = {
        A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110', C: '01110 10001 10000 10000 10000 10001 01110',
        D: '11100 10010 10001 10001 10001 10010 11100', E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
        G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001', I: '01110 00100 00100 00100 00100 00100 01110',
        J: '00111 00010 00010 00010 00010 10010 01100', K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
        M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001', O: '01110 10001 10001 10001 10001 10001 01110',
        P: '11110 10001 10001 11110 10000 10000 10000', Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
        S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 10001 01110',
        V: '10001 10001 10001 10001 10001 01010 00100', W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
        Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
        0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110', 2: '01110 10001 00001 00010 00100 01000 11111',
        3: '11111 00010 00100 00010 00001 10001 01110', 4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
        6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000', 8: '01110 10001 10001 01110 10001 10001 01110',
        9: '01110 10001 10001 01111 00001 00010 01100', '.': '00000 00000 00000 00000 00000 01100 01100', '-': '00000 00000 00000 01110 00000 00000 00000',
        '&': '01100 10010 10100 01000 10101 10010 01101', '/': '00001 00010 00010 00100 01000 01000 10000', "'": '00100 00100 01000 00000 00000 00000 00000', ' ': '00000 00000 00000 00000 00000 00000 00000',
    };
    const f = {}; for (const [k, v] of Object.entries(src)) f[k] = v.split(' '); return f;
})();


// ---------------------------------------------------------------------------
//  Reusable pieces
// ---------------------------------------------------------------------------
/** park an airliner nose-in at fraction t of a terminal outline */
function parkAt(b, poly, t, lv, gap = 24, len = 38) { const q = b.perim(poly, t); airliner(b, q.x + q.nx * gap, q.z + q.nz * gap, Math.atan2(q.nz, -q.nx), lv, len); }
/** narrow-body airliner (A320 / 737 size, ~38 m), nose along local +x. livery = {tail, belly, stripe} */
function airliner(b, x, z, heading, lv = {}, len = 38) {
    // (after round 6, owner: "planes should look more realistic") A320 / 737-class: lathe-turned fuselage (round nose,
    // upswept tapering tail cone), swept trapezoid wings with dihedral, tailplanes and a raked fin as real planforms,
    // engines on pylons with dark intakes, cabin window line, doors, gear
    const k = len / 38, W = lv.body || '#f4f5f6', T = lv.tail || '#1d3f8f', GR = '#b9bec4', DK = '#2a2f36';
    b.push(M(x, 0, z, heading, k, k, k));
    const y = 3.3, R = 1.98;
    { // fuselage: profile (radius, x) from tail to nose
        const prof = [[0.02, -19.5], [0.45, -18.8], [1.05, -16.5], [1.6, -13.5], [1.94, -10], [R, -8], [R, 10.5], [1.9, 12.4], [1.6, 14.2], [1.1, 15.6], [0.5, 16.6], [0.02, 17.0]];
        const g = new THREE.LatheGeometry(prof.map(([r, xx]) => new THREE.Vector2(r, xx)), 18); g.rotateZ(-Math.PI / 2);
        // upswept tail: lift the tail section so the belly line rises toward the tail
        const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const xx = P.getX(i); if (xx < -8) P.setY(i, P.getY(i) + (-8 - xx) * 0.09); } g.computeVertexNormals();
        b.geo(g, W, M(0, y, 0));
    }
    const slab = (pts, t, col, mat) => { // planform (x, z) extruded t thick, lying flat (top at local y = 0)
        const sh = new THREE.Shape(pts.map(([px, pz]) => new THREE.Vector2(px, pz))); const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }); g.rotateX(Math.PI / 2); return g; };
    if (lv.belly) b.geo(new THREE.CylinderGeometry(R + 0.012, R + 0.012, 18.5, 18, 1, true, Math.PI * 0.62, Math.PI * 0.76), lv.belly, M(1, y, 0, 0, 1, 1, 1, 0, -Math.PI / 2));
    if (lv.stripe) b.box(0, y + 0.05, 0, 18.4, 0.32, 2 * R + 0.03, lv.stripe);                       // cheat-line
    b.box(0.5, y + 0.62, 0, 21, 0.2, 2 * R * 0.985, DK, { mat: 'g' });                                  // cabin window line
    b.box(13.6, y + 0.78, 0, 1.6, 0.5, 2 * R * 0.86, DK, { mat: 'g' });                                 // cockpit windows
    for (const dx of [11.2, -14.6]) b.box(dx, y - 0.2, 0, 0.9, 1.9, 2 * R * 0.99, '#d9dcdf');             // doors
    for (const s of [-1, 1]) {
        // wing: root chord 6.2 m at the fuselage, tip 1.6 m at 17 m, 25° sweep, dihedral
        const wing = slab([[2.8, 0], [-3.4, 0], [-9.6, s * 16.6], [-8.0, s * 16.6]], 0.42, W);
        wing.rotateX(-s * 0.09); b.geo(wing, W, M(0, y - 1.25, s * 1.6));                                  // (tips up: dihedral)
        b.box(-9.3, y - 1.25 + 16.6 * 0.09, s * 18.15, 1.4, 1.5, 0.12, T, { rz: -0.35 });               // winglet at the tip
        // engine under the wing on a pylon
        b.cylX(1.4, y - 2.15, s * 5.7, 0.98, 3.8, GR, 14, { r2: 0.9 });
        b.cylX(3.32, y - 2.15, s * 5.7, 0.86, 0.08, DK, 14);                                               // intake
        b.cylX(-1.0, y - 2.15, s * 5.7, 0.55, 1.2, '#6c7178', 10, { r2: 0.8 });                             // exhaust
        b.box(0.6, y - 1.6, s * 5.7, 2.6, 0.7, 0.3, GR);                                                    // pylon
        // tailplane
        b.geo(slab([[-15.2, 0], [-18.6, 0], [-20.6, s * 6.4], [-19.2, s * 6.4]], 0.25, W), W, M(0, y + 0.95, s * 0.9));
        b.box(-0.9, 0, s * 2.7, 0.35, 2.2, 0.35, DK); b.cylX(-0.9, 0.55, s * 2.7, 0.55, 0.6, '#1c1f23', 10);    // main gear + wheel
    }
    { // fin: raked trapezoid
        const sh = new THREE.Shape([[-13.4, 0], [-19.8, 0], [-21.4, 6.6], [-18.6, 6.6]].map(([px, py]) => new THREE.Vector2(px, py)));
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }); g.translate(0, 0, -0.15); b.geo(g, T, M(0, y + 1.65, 0));
    }
    b.box(11.4, 0, 0, 0.3, 2.1, 0.3, DK); b.cylX(11.4, 0.45, 0, 0.42, 0.45, '#1c1f23', 10);                    // nose gear
    b.pop();
}
/** simple ATC tower */
function atcTower(b, x, z, h, o = {}) {
    const c = o.col || '#e6e4de';
    b.cyl(x, 0, z, o.r || 2.6, (o.r || 2.6) * 1.35, h - 7, c, 10);
    b.cyl(x, h - 7, z, 5.6, 3.2, 1.5, c, 10);
    b.cyl(x, h - 5.5, z, 6.2, 5.2, 4, '#3b5468', 10, { mat: 'g' });
    b.cyl(x, h - 1.5, z, 6.6, 6.6, 0.8, c, 10);
    b.cyl(x, h - 0.7, z, 0.25, 0.25, 6, '#d33', 6);
}

// ---------------------------------------------------------------------------
//  Palette
// ---------------------------------------------------------------------------
const C = {
    cream: '#e8dec6', cream2: '#ded2b6', stone: '#d9d0bc', stoneDk: '#c4b9a2', white: '#f0eee8', conc: '#cfccc4',
    win: '#4a4d52', winWarm: '#5d564a', glass: '#55768f', glassDk: '#2c3a46', roof: '#7f7c78', slate: '#5f6469',
    gold: '#c9a13b', copper: '#6f9483', bronze: '#6e5a3c', red: '#b5352c', green: '#5f8f4a', water: '#7fb3d0',
    spray: '#eef6fb', tarmac: '#6d6f71', black: '#1f2326',
};

// ===========================================================================
//  BUCHAREST (1:1)
// ===========================================================================

/** Romanian tricolour (vertical blue-yellow-red) hanging from a mast top at (x, y, z), flag length L */
function flag(b, x, y, z, L) { const h = L * 0.66, w = L / 3; ['#002b7f', '#fcd116', '#ce1126'].forEach((c, i) => b.box(x + w * (i + 0.5), y - h, z, w, h, 0.05, c)); }

/**
 * Classical block: walls of polygon p from y0 with a list of storeys [height, winWidthFrac, winHeightFrac, arched?],
 * window grid per storey (outer edges only, holes get plain walls), optional string course every storey, a
 * cornice on top and an optional balustrade/attic parapet. Returns the top height.
 */
function storeys(b, p, y0, spec, o = {}) {
    const wall = o.wall || C.cream, win = o.win || C.winWarm, bay = o.bay || 4.2, holes = o.holes || [];
    let y = y0;
    const H = spec.reduce((a, s) => a + s[0], 0);
    b.prism(p, y0, y0 + H, wall, { holes, topCol: o.roofCol || '#cbc5b8' });
    spec.forEach(([h, wf, hf, arch], i) => {
        if (wf > 0) b.windows(p, y, y + h, h, win, { bay, wf, hf, start: h * (1 - hf) * (o.sillFrac ?? 0.45), arch, minL: o.minL ?? bay * 1.5, skip: o.skip ? (e, j, f, k) => o.skip(e, j, i, k) : null, mat: o.winMat });
        y += h;
        if (o.courses && i < spec.length - 1 && (o.courses === true || o.courses.includes(i))) b.cornice(p, y - 0.25, 0.35, 0.22, o.trim || wall);
    });
    if (o.pilasters) b.pilasters(p, y0 + (o.pilasterFrom ?? 0), y, bay * (o.pilasterEvery || 1), o.pilasterW || 0.9, 0.35, o.trim || wall, { inner: false });
    if (o.cornice !== false) b.cornice(p, y, o.corniceH || 1.1, o.corniceOut || 0.9, o.trim || wall, { holes });
    if (o.parapet) { const q = offset(p, -0.3); b.ring(q, y + 1.1, y + 1.1 + o.parapet, o.trim || wall); y += o.parapet; }
    return y + (o.corniceH || 1.1);
}

// Palatul Parlamentului (Anca Petrescu, 1984-97) — 240 m E-W x 270 m N-S, 84 m high (en.wikipedia
// "Palace of the Parliament" infobox; skyscrapercenter.com/building/wd/10216), 12 storeys above ground.
// Footprint OSM rel 2230391 (29 m outer 14325732 + courtyards 167231786/178309073). Massing from the OSM
// building:parts: 58 m tier ring w283976783 (x -63..82 / z -94..106 around the inner courtyard block) and the
// 86 m central block w232360843 (28 x 107 m, x 38..66) set ≈ 20 m behind the tier's EAST face, so the tall block
// stands over the main front. Main front = EAST, on the Bd. Unirii axis (Piața Constituției): portico of paired
// giant columns with the balcony, arcaded wings, steps (OSM w178305826, x 86..102 on the axis), terraced lawns.
// Commons refs "Bucharest - Palace of the Parliament (2024)", "Palace of the Parliament in Bucharest (51878975552)"
// (view from the balcony down Bd. Unirii) and "Bucarest - Palazzo del Parlamento di notte 01" (floodlit at night).
// Src: https://en.wikipedia.org/wiki/Palace_of_the_Parliament ; https://www.skyscrapercenter.com/building/wd/10216 ; OSM rel 2230391
function bParliament(b) {
    const W = '#f1eadb', TR = '#e8dfcb', WIN = '#56606a', COL = '#f3eee4';
    b.wall = W;
    const [outer, cyN, cyS] = P.parliament.map(pts);
    const Y0 = 1.6;
    // terrace: stepped platform with balustrade around the building
    b.prism(offset(outer, 7), 0, Y0, '#cfc6b3', { topCol: '#d8d0bf' });
    b.ring(offset(outer, 6.6), Y0, Y0 + 1, TR);                                  // terrace balustrade
    // base (ground arcade + 2 arched storeys + mezzanine + attic) to ≈ 29 m; the two OSM courtyards stay open
    const top0 = storeys(b, outer, Y0, [[7.5, 0.5, 0.72, true], [6.2, 0.45, 0.62, true], [5.2, 0.42, 0.55, false], [4.2, 0.34, 0.45, false]],
        { wall: W, win: WIN, bay: 6.9, holes: [cyN, cyS], courses: [0, 2], trim: TR, pilasters: true, pilasterEvery: 2, pilasterW: 0.9, corniceOut: 1.2, parapet: 1.3 });
    // corner pavilions of the base rise one storey more, with round-headed attic windows
    const pav = [[-115, -137.5, -86, -106], [86, -137.5, 115, -106], [-115, 106, -84, 137.5], [86, 108, 115, 137.5]];
    for (const [x0, z0, x1, z1] of pav) storeys(b, rect(x0, z0, x1, z1), top0 - 0.8, [[5.5, 0.42, 0.6, true]], { wall: W, win: WIN, bay: 5.8, trim: TR, corniceOut: 0.8, parapet: 1.1, minL: 6 });
    // 58 m tier ring (OSM w283976783) around the lower inner block: arched storeys between paired pilasters
    const tier = rect(-63, -94.5, 82, 106), tierHole = rect(-37, -66.5, 38, 83);
    const ts = [[4.6, 0.44, 0.62, true], [4.2, 0.42, 0.55, false], [4.2, 0.42, 0.55, false], [4.6, 0.44, 0.62, true], [4.2, 0.42, 0.55, false], [4.2, 0.42, 0.55, false], [4.4, 0.44, 0.62, true]];
    const top1 = storeys(b, tier, top0 - 1, ts, { wall: W, win: WIN, bay: 5.6, holes: [tierHole], courses: [0, 3], trim: TR, pilasters: true, pilasterEvery: 2, pilasterW: 0.8, corniceOut: 1, parapet: 1.2 });
    // 86 m central block (OSM w232360843) over the east front: 6 storeys above the tier, arched top storey, flag
    const cen = rect(38, -46.7, 66, 60.4);
    const cs = [[4.2, 0.44, 0.55, false], [4.4, 0.46, 0.66, true], [4.1, 0.44, 0.55, false], [4.1, 0.44, 0.55, false], [4.4, 0.46, 0.66, true], [4.4, 0.46, 0.66, true]];
    const ct = storeys(b, cen, top1 - 1.6, cs, { wall: W, win: WIN, bay: 6.4, courses: true, trim: TR, pilasters: true, pilasterEvery: 2, pilasterW: 1.1, corniceOut: 1.3, parapet: 1.4, roofCol: '#cfc7b6' });
    for (const [x0, z0, x1, z1] of [[38, -46.7, 44, -40.7], [60, -46.7, 66, -40.7], [38, 54.4, 44, 60.4], [60, 54.4, 66, 60.4]]) b.prism(offset(rect(x0, z0, x1, z1), 0.6), top1 - 1.6, ct - 1, TR, { top: false });  // corner piers
    b.box(52, ct, 7, 8, 2.2, 10, TR);                                              // roof house
    b.cyl(52, ct + 2.2, 7, 0.12, 0.18, 12, '#d8d8d8', 6);
    flag(b, 52, ct + 14, 7, 3.2);
    // EAST portico (main entrance, Bd. Unirii axis): local frame x along the front (= world z), local -z = outward (= world +x)
    b.push(M(86, 0, 0, -Math.PI / 2));
    b.box(0, Y0, -6, 48, 1.2, 12, TR);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const x = s * (5 + i * 6.2); b.colonnade(x - 1, -10.5, x + 1, -10.5, Y0 + 1.2, 13.5, 2, 0.75, COL, { capital: TR, seg: 8 }); b.box(x, Y0 + 1.2, -10.5, 4.2, 0.8, 2.2, TR); }
    b.box(0, Y0 + 14.7, -6, 50, 2, 12.5, TR);                                      // entablature
    b.box(0, Y0 + 16.7, -6.2, 51, 0.5, 13, '#ece4d2');
    b.fence([[-24, -12], [24, -12]], 1.2, 3.2, TR, { post: 0.45 });                // the balcony balustrade (on the portico roof)
    b.archWall(48, 14, 0.6, [-18, -6, 6, 18].map(x => ({ x, w: 5.5, h: 11 })), '#e6ddca', M(0, Y0 + 1.2, -0.6));   // arcade behind the columns
    for (const x of [-18, -6, 6, 18]) b.box(x, Y0 + 1.2, -0.2, 4.6, 8.5, 0.2, '#4f5760');   // glazed doors in the arcade
    for (const s of [-1, 1]) b.archWall(36, 8.2, 0.8, [-14, -7, 0, 7, 14].map(x => ({ x, w: 4.4, h: 7.2 })), '#efe8d8', M(s * 44, Y0, -0.45));   // arcaded loggias on the front wings
    for (let i = 0; i < 6; i++) b.box(0, i * 0.27, -12.5 - i * 0.6, 30 - i * 0.6, 0.27, 0.6 + (5 - i) * 0.6 * 0 + 0.6, '#ddd5c3');   // steps down to the forecourt (OSM w178305826)
    b.pop();
    // Izvor (west) front: giant colonnade; north (Bd. Națiunile Unite) front: smaller columned entrance
    b.box(-116.5, Y0, -1, 8, 1, 34, TR);
    b.colonnade(-119.5, -14, -119.5, 12, Y0 + 1, 11, 6, 0.65, COL, { capital: TR, seg: 8 });
    b.box(-117, Y0 + 12, -1, 8, 1.6, 34, TR);
    b.push(M(0, 0, -101.5, 0));
    b.box(0, Y0, -4, 30, 1, 8, TR); b.colonnade(-12, -7, 12, -7, Y0 + 1, 11, 6, 0.65, COL, { capital: TR, seg: 8 }); b.box(0, Y0 + 12, -4, 31, 1.6, 8.5, TR);
    b.pop();
    // terraced front gardens on the east (OSM retaining walls + hedges): stepped lawns either side of the axis, flower parterre
    for (const s of [-1, 1]) for (const [x0, h] of [[100, 0.9], [124, 0.55], [140, 0.25]]) b.prism(rect(x0, s > 0 ? 10 : -92, 158, s > 0 ? 92 : -10), 0, h, '#7f9d5e', { topCol: '#86a663' });
    for (const s of [-1, 1]) b.prism(ellipse(130, s * 50, 14, 22, 16), 0.58, 0.7, '#a85a5a', { topCol: s > 0 ? '#c9a23c' : '#9b5ba0' });
    // north forecourt retaining wall with stone pillars and iron railing (OSM w178305226)
    const fl = [[-80.1, -266.3], [-78.7, -179.8], [-81.1, -179.6], [-83.9, -177.1], [-82.8, -161.3], [-78, -156.5], [-34.9, -157.4], [88.3, -159.8], [95.9, -164.8], [96.2, -171.9], [89.8, -182], [88.7, -267.5]];
    b.fence(fl, 1.9, 18, '#d9cfbb', { post: 1, base: 0.9, baseCol: '#d6ccb8', bars: 2.4, postCol: '#e1d8c6' });
    for (let i = 0; i + 1 < fl.length; i++) if (Math.hypot(fl[i + 1][0] - fl[i][0], fl[i + 1][1] - fl[i][1]) > 20) b.colSeg(fl[i][0], fl[i][1], fl[i + 1][0], fl[i + 1][1], 0.6);
    b.colPoly([outer], 22); b.col(93, 0, 7, 25);
}

// Catedrala Mântuirii Neamului (Vanel Exim / A. Ion, 2010-25) — 126.1 m x 67.7 m cross plan. Heights from the 2013
// section drawing (ro.wikipedia "Catedrala Mântuirii Neamului"): walls 41.4 m, Pantocrator drum 71.8-97.8 m, dome to
// 121 m, lantern 127 m, cross 133 m; four secondary towers ≈ 62 m, west bell tower ≈ 75.5 m (+ dome, cross).
// Neo-Brâncovenesc: white stone walls with a band of blind arched niches, tall arched windows; drums are WHITE STONE
// with tall arched windows between paired colonnettes under an arcaded cornice; gilded ribbed hemispherical domes
// with lanterns (Commons "Catedrala Națională a României iunie 2023"), open west porch (pridvor). OSM way 232332568.
// Src: https://ro.wikipedia.org/wiki/Catedrala_Mântuirii_Neamului ; OSM way 232332568
function bCathedral(b) {
    const S = '#f4f0e7', TR = '#e3dccb', NI = '#d6cdb9', WIN = '#3e434a', GOLD = '#d2a645', GOLDR = '#b88d3a', CL = '#fbf8f1';
    b.wall = S;
    const [outer] = P.cathedral.map(pts), domesLater = [];
    const HW = 41.4;
    b.prism(offset(outer, 2.5), 0, 1.4, '#cfc6b4', { topCol: '#d9d1c1' });                      // stylobate
    b.prism(outer, 1.4, HW, S, { topCol: TR });
    b.windows(outer, 1.4, 9, 7.6, '#6d6a62', { bay: 4.4, wf: 0.5, hf: 0.7, start: 1.2, arch: true, minL: 7 });     // ground-floor arcade
    b.windows(outer, 9, 33, 8, WIN, { bay: 4.6, wf: 0.36, hf: 0.5, start: 1.6, arch: true, minL: 9 });              // tall arched windows
    b.windows(outer, 33.2, 39.6, 6.4, NI, { bay: 2.3, wf: 0.6, hf: 0.62, start: 1, arch: true, minL: 9 });          // band of blind niches (ocnițe)
    b.cornice(outer, 9, 0.6, 0.5, GOLDR); b.cornice(outer, 32.6, 0.6, 0.4, TR); b.cornice(outer, HW - 0.6, 1, 0.9, TR);
    // round corner turrets with gilded domes at the ends of the arms
    for (const [x, z] of [[-58.5, -13.5], [-58.5, 13.5], [6.5, -31], [21.5, -31], [6.5, 31], [21.5, 31], [-31, -24], [-31, 24]]) {
        b.cyl(x, 1.4, z, 3.4, 3.6, HW + 4.6, S, 10);
        b.cyl(x, HW + 6, z, 3.9, 3.9, 0.8, TR, 8); domesLater.push([x, HW + 6.8, z, 3.5, 4.2, 10, 0]);
    }
    b.roof(outer, HW, 4, GOLDR, 3, { topCol: GOLDR });
    const cross = (x, y, z, h) => { b.box(x, y, z, h * 0.09, h, h * 0.09, GOLD, { mat: 'g' }); b.box(x, y + h * 0.62, z, h * 0.09, h * 0.09, h * 0.52, GOLD, { mat: 'g' }); };
    // gilded ribbed hemispherical dome (slightly raised), ribs, collar; lantern when `lan` > 0
    const domeG = (x, y, z, r, h, seg, lan) => {
        const pr = [[r * 1.04, 0], [r, h * 0.06], [r * 0.97, h * 0.28], [r * 0.87, h * 0.52], [r * 0.68, h * 0.74], [r * 0.4, h * 0.92], [0.001, h]].map(([a, c]) => new THREE.Vector2(a, c));
        b.geo(new THREE.LatheGeometry(pr, seg), GOLD, M(x, y, z), 'g');
        for (let i = 0; i < seg; i += 2) { const a = i / seg * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a); b.tube(pr.slice(1, 6).map(v => [x + c * (v.x + r * 0.03), y + v.y, z + s2 * (v.x + r * 0.03)]), Math.max(0.12, r * 0.022), GOLDR, { seg: 5, radial: 3, mat: 'g' }); }
        b.cyl(x, y, z, r * 1.08, r * 1.1, Math.max(0.4, r * 0.06), GOLDR, seg, { mat: 'g' });
        if (lan > 0) { const lr = Math.max(0.6, r * 0.16); b.cyl(x, y + h * 0.95, z, lr, lr, lan * 0.7, S, 8); b.dome(x, y + h * 0.95 + lan * 0.7, z, lr * 1.1, lan * 0.3, GOLD, 8, { mat: 'g' }); return y + h * 0.95 + lan; }
        return y + h;
    };
    // drum: white stone polygon, tall arched windows (recessed dark) between paired colonnettes, arcaded cornice
    const drum = (x, z, y0, y1, r, seg, winH) => {
        const ring = ellipse(x, z, r, r, seg, Math.PI / seg), side = 2 * r * Math.sin(Math.PI / seg);
        b.prism(ring, y0, y1, S, { top: false });
        b.cornice(ring, y0, 0.9, 0.5, TR);
        b.windows(ring, y0 + 1, y1 - 1.6, y1 - y0 - 2.6, WIN, { bay: side, wf: 0.34, hf: winH, start: (y1 - y0) * 0.12, arch: true, minL: 0.5, off: 0.05 });
        const ch = (y1 - y0) * 0.86, cr = Math.max(0.16, side * 0.045);
        for (let i = 0; i < seg; i++) {
            const a = i / seg * Math.PI * 2 + Math.PI / seg, px = x + Math.cos(a) * (r + cr), pz = z + Math.sin(a) * (r + cr), tx = -Math.sin(a), tz = Math.cos(a);
            for (const d of [-1, 1]) b.cyl(px + tx * d * cr * 1.6, y0 + 0.9, pz + tz * d * cr * 1.6, cr, cr, ch - 0.9, CL, 6);
        }
        b.cornice(ring, y0 + ch, 0.5, 0.35, TR); b.cornice(ring, y1 - 1.2, 1.2, 0.7, TR);
    };
    // Pantocrator tower over the crossing: square base, 16-sided lower drum, drum 71.8-97.8 m, dome to 121, lantern 127, cross 133
    const mx = 13.5, base = rect(mx - 17, -17, mx + 17, 17);
    b.prism(base, HW, 56, S, { topCol: GOLDR }); b.windows(base, HW, 56, 14.6, NI, { bay: 2.6, wf: 0.6, hf: 0.6, start: 4, arch: true });
    b.cornice(base, 55, 1, 0.8, TR);
    const low = ellipse(mx, 0, 15.6, 15.6, 16, Math.PI / 16);
    b.prism(low, 56, 71.8, S, { topCol: GOLDR }); b.windows(low, 57, 71, 14, WIN, { bay: 6, wf: 0.3, hf: 0.42, start: 4, arch: true, minL: 0.5 }); b.cornice(low, 70.8, 1, 0.8, TR);
    drum(mx, 0, 71.8, 97.8, 14.2, 16, 0.6);
    const ly = domeG(mx, 97.8, 0, 14.6, 23.2, 24, 7.2);
    cross(mx, ly, 0, 6);
    // four secondary towers at the corners of the crossing (≈ 62 m)
    for (const [x, z] of [[mx - 21.5, -21], [mx + 21.5, -21], [mx - 21.5, 21], [mx + 21.5, 21]]) {
        const q = rect(x - 5.2, z - 5.2, x + 5.2, z + 5.2);
        b.prism(q, HW, 46, S, { topCol: GOLDR }); b.windows(q, HW, 46, 4.6, WIN, { bay: 3.4, wf: 0.36, hf: 0.6, start: 1, arch: true }); b.cornice(q, 45.4, 0.6, 0.6, TR);
        drum(x, z, 46, 56.5, 4.6, 8, 0.6);
        const y2 = domeG(x, 56.5, z, 4.9, 5.6, 12, 1.6);
        cross(x, y2, z, 3.2);
    }
    // west bell tower (≈ 75.5 m) over the narthex
    const bx = -48, bq = rect(bx - 10, -10, bx + 10, 10);
    b.prism(bq, HW, 58, S, { topCol: GOLDR });
    b.windows(bq, HW, 58, 16.6, WIN, { bay: 5, wf: 0.4, hf: 0.6, start: 4, arch: true });
    b.cornice(bq, 57, 1, 0.8, TR);
    drum(bx, 0, 58, 72, 7.6, 12, 0.6);
    const by = domeG(bx, 72, 0, 8, 8.5, 16, 2.6);
    cross(bx, by, 0, 4.5);
    for (const [x, y, z, r, h, sg, lan] of domesLater) { const y2 = domeG(x, y, z, r, h, sg, lan); cross(x, y2 - 0.2, z, 2.4); }
    // west gable: semicircular pediment with a rose window above the porch
    b.geo(new THREE.CylinderGeometry(9, 9, 1.2, 16, 1, false, 0, Math.PI), S, M(-60.6, HW, 0, 0, 1, 1, 1, Math.PI / 2, Math.PI / 2));
    b.cyl(-61.4, 31, 0, 3, 3, 0.4, '#6b7480', 14, { rz: Math.PI / 2 }); b.geo(new THREE.TorusGeometry(3.2, 0.35, 4, 14), TR, M(-61.5, 31, 0, Math.PI / 2));
    // open west porch (pridvor): arcade of stone columns under a gilded roof
    const px = -60.5;
    b.box(px - 6, 0, 0, 13, 1.4, 34, '#cfc6b4');
    b.colonnade(px - 11.5, -15, px - 11.5, 15, 1.4, 11, 7, 0.7, '#f4f0e6', { capital: TR, seg: 8 });
    b.archWall(32, 5, 0.8, [-11.25, -3.75, 3.75, 11.25].map(x => ({ x, w: 5.4, h: 3.6 })), S, M(px - 11.5, 10, 0, Math.PI / 2));
    b.box(px - 6, 15, 0, 13.5, 1, 34.5, TR);
    b.hip(px - 6, 16, 0, 34.5, 13.5, 3.5, GOLDR, { ry: Math.PI / 2 });
    b.colPoly([outer], 20); b.col(px - 6, 0, 6.5, 17);
}

// Arcul de Triumf (Petre Antonescu, 1936 stone version) — 27 m high, single opening (ro.wikipedia "Arcul de
// Triumf din București"); base 25 x 9.3 m (OSM way 217851530). Proportions measured on Commons photos
// "Arco de Triunfo, Bucarest, 2016-05-30, DD 24" / "Arcul de Triumf (24396923048)": opening ≈ 8.8 m wide x 15.7 m,
// recessed frame 14.4 m, inscription band 18.4-20.8 m, cornice 23.2-24.6 m (overhang to ≈ 27 m), attic to 27 m.
// No columns: plain Rușchița-marble piers with corner strips, Jalea/Baraschi medallions, winged-Victory reliefs
// flanking the inscription, royal crown/arms; north (+z) and south (-z) inscriptions abridged to their bold lines.
// Src: https://ro.wikipedia.org/wiki/Arcul_de_Triumf_din_București ; OSM way 217851530
function bArcul(b) {
    const W = 25, D = 9.6, S = '#ebe3d2', S2 = '#e0d5bf', TR = '#f2ecdf', RL = '#cdbfa3', TX = '#857660';   // pale Rușchița marble
    b.box(0, 0, 0, W + 1.4, 1.3, D + 1.4, '#bfb3a0');                                     // granite plinth
    b.archWall(W, 17.1, D, [{ x: 0, w: 8.8, h: 15.7 }], S, M(0, 1.3, 0));                     // piers + vault
    b.archWall(D + 0.1, 4.4, 2.2, [{ x: 0, w: 1.8, h: 3.2 }], S, M(-W / 2 + 1.1, 1.3, 0, Math.PI / 2));   // small side doors
    b.archWall(D + 0.1, 4.4, 2.2, [{ x: 0, w: 1.8, h: 3.2 }], S, M(W / 2 - 1.1, 1.3, 0, Math.PI / 2));
    for (const s of [-1, 1]) {
        const z = s * (D / 2), zo = s * 0.12;
        b.archWall(14.4, 17.1 - 1.3, 0.25, [{ x: 0, w: 9.6, h: 16.1 }], S2, M(0, 1.3, z - zo));       // recessed arch frame (shadow rim)
        for (const x of [-W / 2 + 0.5, -7.6, 7.6, W / 2 - 0.5]) b.box(x, 1.3, z + zo, 1, 17.1, 0.24, TR); // vertical strips
        for (const x of [-9.9, 9.9]) {
            b.cyl(x, 12.4, z + s * 0.25, 1.25, 1.25, 0.35, '#efe7d7', 16, { rx: Math.PI / 2 });     // medallion (Bărbăția / Credința)
            b.cyl(x, 12.4, z + s * 0.45, 0.9, 0.9, 0.2, RL, 12, { rx: Math.PI / 2 });
            b.box(x, 14.4, z + s * 0.2, 1.1, 1, 0.3, RL);                                            // crown above
            b.box(x, 4.4, z + s * 0.12, 2.6, 1.1, 0.2, RL);                                          // lower panel
        }
        b.box(0, 15.8, z + s * 0.18, 1.4, 1.6, 0.4, TR);                                            // keystone
        b.geo(new THREE.TorusGeometry(4.75, 0.28, 4, 18, Math.PI), TR, M(0, 1.3 + 15.7 - 4.4, z + s * 0.12));        // archivolt moulding
        for (const x of [-4.75, 4.75]) b.box(x, 1.3, z + s * 0.12, 0.56, 11.9, 0.3, TR);                          // jamb mouldings
        // entablature: inscription band with winged Victories either side
        b.box(0, 18.4, 0, W, 2.4, D, S);
        b.box(0, 18.45, z + s * 0.1, 15.2, 2.3, 0.2, '#e3d6bd');
        for (const x of [-10.2, 10.2]) { b.box(x, 18.5, z + s * 0.15, 3.8, 2.2, 0.3, RL); b.box(x - 0.6, 18.9, z + s * 0.35, 1.2, 1.5, 0.3, '#b5a283'); b.box(x + 0.7, 19.6, z + s * 0.35, 1.8, 0.5, 0.3, '#b5a283', { rz: -0.4 }); }
    }
    // inscriptions (bold lines of the 1936 texts)
    const n = D / 2 + 0.18;
    b.text('FERDINAND I', 0, 19.95, n, 0, 0.62, TX); b.text('DOMN SI REGE AL ROMANILOR', 0, 18.85, n, 0, 0.62, TX);
    b.text('SE INDEPLINI DREPTATEA', 0, 19.95, -n, Math.PI, 0.62, TX); b.text('SI PENTRU POPORUL ROMAN', 0, 18.85, -n, Math.PI, 0.62, TX);
    b.text('GLORIE CELOR CE', W / 2 + 0.1, 19.2, 0, Math.PI / 2, 0.5, TX); b.text('GLORIE CELOR CE', -W / 2 - 0.1, 19.2, 0, -Math.PI / 2, 0.5, TX);
    // royal arms in the passage + coffered vault ribs
    for (const s of [-1, 1]) b.box(s * 4.3, 8, 0, 0.3, 2.6, 2.2, RL);
    // cornice, attic with acroteria, flag
    b.box(0, 20.8, 0, W + 0.6, 0.6, D + 0.6, TR);
    b.box(0, 22.6, 0, W + 1.2, 0.6, D + 1.2, TR);
    b.box(0, 23.2, 0, W + 2.2, 1.4, D + 2.2, '#e9dfcb');
    b.box(0, 21.4, 0, W - 0.2, 1.2, D - 0.2, S2);
    b.box(0, 24.6, 0, W - 1.2, 2.4, D - 1.2, S);
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) b.box(-9.4 + i * 3.76, 27, s * (D / 2 - 0.8), 0.9, 0.8, 0.9, TR);
    b.cyl(-6, 27, 0, 0.07, 0.1, 7, '#dddddd', 5);
    flag(b, -6, 33.8, 0, 1.8);
    // bollards + chain ring around the monument
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; b.box(Math.cos(a) * 19, 0, Math.sin(a) * 13, 0.35, 0.9, 0.35, '#e2dccf'); }
    b.col(-W / 2 + 4.1, 0, 4.1, D / 2 + 0.7); b.col(W / 2 - 4.1, 0, 4.1, D / 2 + 0.7);
}

// Casa Presei Libere (ex-Casa Scînteii, Horia Maicu, 1952-57) — 91.6 m + 12.4 m antenna = 104 m (ro.wikipedia
// "Casa Presei Libere"). Massing from the OSM building:parts of rel 15922160: wings A1-A4 4 levels / 24 m,
// B/C wings 5-6 levels / 24 m with corner turrets 25-30 m, central body D 13 levels / 50 m (x 60..92, z ±45),
// tower 67..85 x ±17 from 50 to 70 m, then stepped crown to 91.6 m. Front (+x) faces Piața Presei Libere
// (fountain OSM 1173487799). Stalinist "wedding cake": ochre stone, vertical pilaster strips, pinnacles.
// Src: https://ro.wikipedia.org/wiki/Casa_Presei_Libere ; OSM rel 15922160 (+ building:parts)
function bCasaPresei(b) {
    const S = '#e3d7bd', TR = '#ece2cb', W = '#5b5448', R = '#cdbf9f';
    b.wall = S;
    const [outer, c1, c2, c3] = P.casapresei.map(pts);
    const st = (n, h = 4.2, wf = 0.38) => Array.from({ length: n }, () => [h, wf, 0.62, false]);
    storeys(b, outer, 0, [[5.2, 0.5, 0.62, true], ...st(3, 4.3, 0.52), [4.3, 0.52, 0.5, false]], { wall: S, win: W, trim: TR, bay: 7, holes: [c1, c2, c3], pilasters: false, pilasterW: 0.7, corniceOut: 0.8, parapet: 1.2, minL: 12, roofCol: '#bfb197' });
    // corner pavilions of the front wings with little Stalinist turrets (OSM parts 25 m + 30 m)
    for (const [x, z] of [[24, -130], [121, -130], [24, 130], [121, 130], [-118, -62], [-118, 62]]) {
        b.prism(rect(x - 9, z - 9, x + 9, z + 9), 23, 26.5, TR, { topCol: R });
        b.prism(rect(x - 5, z - 5, x + 5, z + 5), 26.5, 31, S, { topCol: R }); b.windows(rect(x - 5, z - 5, x + 5, z + 5), 26.5, 31, 4.5, W, { bay: 2.5, wf: 0.4, hf: 0.6, arch: true, minL: 3 });
        b.hip(x, 31, z, 10, 10, 4, R); b.cyl(x, 35, z, 0.15, 0.5, 4, TR, 6);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cone(x + sx * 8, 26.5, z + sz * 8, 0.8, 3.5, TR, 6);
    }
    // central body D (13 levels, 50 m) with a tall arched entrance risalit on the front
    const D = rect(56, -45, 92, 45);
    storeys(b, D, 0, [[6, 0.5, 0.65, true], ...st(10, 3.8), [4.6, 0.42, 0.6, true]], { wall: S, win: W, trim: TR, bay: 4, pilasters: true, pilasterEvery: 2, pilasterW: 0.8, corniceOut: 1, parapet: 1.4, roofCol: R });
    b.box(93.2, 0, 0, 2.4, 44, 22, TR); b.windows(rect(92, -11, 94.4, 11), 6, 43, 3.8, W, { bay: 2.8, wf: 0.36, hf: 0.62, edges: [1], minL: 3 });
    b.archWall(16, 12, 1.2, [{ x: 0, w: 8, h: 10.5 }], TR, M(94.8, 0, 0, Math.PI / 2));
    // corner risalits of D rise ≈ 2 storeys higher, each with a small lantern (Commons "House of Free Press.jpg")
    for (const zc of [-40, 40]) {
        const r = rect(56, zc - 5.5, 92.5, zc + 5.5);
        b.prism(r, 49, 57, S, { topCol: R }); b.windows(r, 49, 57, 4, W, { bay: 3.6, wf: 0.4, hf: 0.55, minL: 4 }); b.cornice(r, 56.5, 0.7, 0.6, TR);
        b.prism(rect(84, zc - 3.5, 91, zc + 3.5), 57.2, 62, TR, { topCol: R }); b.hip(87.5, 62, zc, 7, 7, 2.5, R); b.cyl(87.5, 64.5, zc, 0.12, 0.12, 3, '#bbb', 4);
    }
    // tower: 18 m block on D (OSM part 1177639748, 50 -> 70 m) with corner pinnacles, a lantern stage and the
    // tapering spire (≈ 78 -> 92 m) carrying the TV antenna to 104 m
    const t1 = rect(67, -17, 85, 17);
    b.prism(t1, 51.5, 70, S, { topCol: R }); b.windows(t1, 51.5, 69, 3.6, W, { bay: 2.8, wf: 0.4, hf: 0.6, minL: 4 });
    b.pilasters(t1, 51.5, 70, 5.6, 0.6, 0.3, TR, {}); b.cornice(t1, 69.4, 0.8, 0.6, TR);
    for (const [x, z] of [[67, -17], [85, -17], [85, 17], [67, 17]]) { b.box(x, 70, z, 1.6, 3, 1.6, TR); b.cone(x, 73, z, 0.9, 3.4, TR, 6); }
    const t2 = rect(72.5, -4.5, 79.5, 4.5);
    b.prism(t2, 70, 79, S, { topCol: R }); b.windows(t2, 70, 78, 4, W, { bay: 2.3, wf: 0.45, hf: 0.65, arch: true, minL: 3 }); b.cornice(t2, 78.5, 0.6, 0.5, TR);
    for (const [x, z] of [[72.5, -4.5], [79.5, -4.5], [79.5, 4.5], [72.5, 4.5]]) b.cone(x, 79, z, 0.6, 2.6, TR, 6);
    b.cyl(76, 79, 0, 2.6, 3.4, 4, TR, 8);
    b.cyl(76, 83, 0, 0.7, 2.6, 9.5, '#cdbd9a', 8);                                         // spire
    b.cyl(76, 92.5, 0, 0.25, 0.55, 11.5, '#9aa0a5', 6);                                    // TV antenna to 104 m
    for (const y of [94, 97, 100]) b.box(76, y, 0, 2.2, 0.15, 0.15, '#9aa0a5');
    // fountain + forecourt in front
    b.prism(ellipse(116, 1, 7.5, 12.5, 16), 0, 0.6, '#cfc6b3'); b.prism(ellipse(116, 1, 6.8, 11.8, 16), 0, 0.45, C.water, { mat: 'w' });
    b.colPoly([outer], 24);
}

// Grand Hotel Bucharest (ex-InterContinental, 1971, D. Hariton / G. Nădrag / I. Moscu / R. Ionescu) — 24 levels,
// 87-90 m (OSM way 1111645542 height 87, tower part 23781503 height 90). Tower plan from that part (simplified):
// concave curved faces lined with a continuous balcony per floor (white parapets, room fins every ≈ 4 m),
// 4-level podium (OSM parts 1019802601/602, 15 m commercial part 937332760) with a glazed ground floor.
const GH_TOWER = [-22.2, 6.0, -21.9, -3.7, -18.9, -3.0, -18.2, -4.7, -21.1, -7.3, -13.6, -12.9, -9.1, -8.7, -0.9, -5.8, 6.5, -6.6, 9.8, -8.0, 14.9, -12.3, 21.9, -5.9, 19.1, -2.9, 19.7, -1.6, 22.8, -2.5, 22.7, 7.3, 19.7, 8.5, 14.6, 12.5, 10.8, 18.8, 9.8, 25.4, 11.0, 31.1, 2.7, 31.3, 2.1, 28.5, -0.2, 28.5, -1.6, 31.3, -11.4, 30.7, -9.9, 22.1, -11.6, 15.6, -15.9, 9.8];
// Src: https://en.wikipedia.org/wiki/InterContinental_Bucharest ; OSM ways 1111645542 / 23781503
function bGrandHotel(b) {
    const WH = '#f1f0eb', GL = '#33414d', CON = '#d9d6ce';
    b.wall = WH;
    const [p] = P.grandhotel.map(pts), t = pts(GH_TOWER);
    // podium: glazed shop/lobby floor + 3 levels of ribbon windows
    b.prism(p, 0, 16, CON, { topCol: '#bdb8ae' });
    b.prism(offset(p, 0.1), 0.3, 5.2, GL, { mat: 'g', top: false });
    b.windows(p, 5.2, 15.5, 3.4, '#46525c', { bay: 3.2, wf: 0.8, hf: 0.55, minL: 3 });
    b.cornice(p, 15.4, 0.8, 0.5, WH);
    b.prism(rect(-11, -31, 13, -20), 0, 10, CON, { topCol: '#9fb5c0' });                    // north entrance pavilion (roof 5-10 m)
    // tower: dark glazing set back behind a balcony slab + parapet per floor, room fins
    const TOP = 84, fh = 3.05;
    b.prism(t, 16, TOP, GL, { mat: 'g', topCol: CON });
    const bo = offset(t, 1.5);
    for (let y = 16 + fh; y < TOP - 1; y += fh) {
        b.ring(bo, y - 0.2, y + 0.95, WH);                                                     // balcony parapet
        b.lip(t, bo, y - 0.2, '#cfccc4', -1); b.lip(t, bo, y + 0.95, WH, 1);
    }
    b.pilasters(t, 16, TOP, 4.1, 0.28, 1.5, WH, { inner: true });                              // fins between rooms
    b.pilasters(t, 16, TOP, 30, 0.9, 1.6, WH, { ends: true });                                 // corner piers
    // crown: plant floor + sign
    const cr = offset(t, -2);
    b.prism(cr, TOP, TOP + 4.5, WH, { topCol: CON }); b.windows(cr, TOP, TOP + 4.5, 4.5, GL, { bay: 2.5, wf: 0.7, hf: 0.5, minL: 3 });
    b.prism(rect(-8, 2, 8, 16), TOP + 4.5, TOP + 6.5, CON);
    b.text('GRAND HOTEL', 0, TOP + 1.2, 29.6, 0, 2.2, '#c9a64a');
    b.text('GRAND HOTEL', 0, TOP + 1.2, -4.2, Math.PI, 2.2, '#c9a64a');
    b.colPoly([p], 12);
}

// Palatul Universității (Alexandru Orăscu, 1857-69, enlarged 1912-26) — 200 x 64 m block (OSM way 129316956:
// 4 levels, colour #CABC91, roof "quadruple_saltbox" = grey zinc mansards). Commons "Bucharest (8273345546).jpg":
// 4 storeys of tall windows, zinc mansards with dormers, higher pavilion roofs with arched gables, rounded
// corner with a small dome on Piața Universității (-x/-z). Statues square in front of the south (-z) front,
// positions from OSM nodes 2466907140-43: Mihai Viteazul (equestrian, Carrier-Belleuse 1874), Heliade Rădulescu,
// Gheorghe Lazăr, Spiru Haret.
// Src: https://en.wikipedia.org/wiki/University_of_Bucharest ; OSM way 129316956, statue nodes 2466907140-43
function bUniv(b) {
    const S = '#d9cba3', TR = '#e6dbbd', WIN = '#4f4b43', Z = '#8e9aa2', ZD = '#76838c';
    b.wall = S;
    const ps = P.univ.map(pts), outer = ps[3];
    storeys(b, outer, 0, [[5.6, 0.44, 0.68, true], [4.8, 0.4, 0.62, false], [4.5, 0.4, 0.6, false], [3.8, 0.36, 0.5, false]],
        { wall: S, win: WIN, trim: TR, bay: 5, courses: [0], pilasters: true, pilasterEvery: 3, pilasterW: 0.7, corniceOut: 1, minL: 8, roofCol: ZD });
    // zinc mansard + dormers
    b.roof(outer, 19.8, 5.2, Z, 2.6, { topCol: ZD });
    const din = offset(outer, -1.3);
    b.windows(din, 19.8, 24, 4.2, '#e8e1cc', { bay: 6.5, wf: 0.25, hf: 0.55, start: 0.6, minL: 12, off: 0.5 });
    // pavilions: higher mansard domes with arched gables (ends, centre of the front, rear corners)
    const pav = [[-100, -40, -78, -10], [78, -40, 100, -2], [-14, -40, 14, -12], [-100, 10, -78, 40], [78, 10, 100, 40]];
    for (const [x0, z0_, x1, z1_] of pav) {
        const zr = zAt([outer], (x0 + x1) / 2), z0 = Math.max(z0_, zr[0]), z1 = Math.min(z1_, zr[1]);
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
        b.hip(cx, 19.8, cz, w - 1, d - 1, 9, Z, { ridge: Math.max(0, (w - d) / 2 - 2) });
        b.archWall(Math.min(9, w - 6), 4.2, 0.6, [{ x: 0, w: 2.6, h: 2.8 }], TR, M(cx, 20.4, z0 + 0.2));
        b.dome(cx, 24.4, z0 + 0.2, 4.4, 1.6, TR, 8);
    }
    // rounded corner on Piața Universității with a small dome + lantern
    b.cyl(-97, 0, -29, 5.5, 5.5, 19.8, S, 12); b.cyl(-97, 19.8, -29, 5.9, 5.9, 1, TR, 12);
    b.dome(-97, 20.8, -29, 5.2, 6, Z, 12); b.cyl(-97, 26.6, -29, 0.9, 1.1, 2.2, TR, 8); b.cone(-97, 28.8, -29, 1, 2, ZD, 8);
    // central portico on the south front: 6 columns over the ground floor, balcony, arched gable
    const zf = zAt([outer], 0)[0];
    b.box(0, 0, zf - 3, 30, 1, 6, '#c9bfa8');
    b.colonnade(-12, zf - 4.5, 12, zf - 4.5, 1, 9.4, 6, 0.75, '#efe8d6', { capital: TR, seg: 8 });
    b.box(0, 10.4, zf - 3, 30, 1.2, 6.5, TR);
    b.fence([[-14.5, zf - 6], [14.5, zf - 6]], 1.1, 2.4, TR, { post: 0.4 });
    b.colonnade(-10, zf - 1, 10, zf - 1, 11.6, 8, 6, 0.55, '#efe8d6', { seg: 6 });
    b.text('UNIVERSITATEA DIN BUCURESTI', 0, 20.15, zf - 1.15, Math.PI, 0.75, '#6f6450');
    // the statues square: plinths + bronze figures (OSM nodes, model frame)
    const BR = '#4f4a3c', PL = '#bdb5a6';
    b.box(-4.2, 0, -61.5, 5.5, 1, 8.5, PL); b.box(-4.2, 1, -61.5, 3.6, 4.2, 6.2, '#c9c1b2');
    b.box(-4.2, 5.2, -61.5, 1.3, 2.2, 4.4, BR); b.box(-4.2, 6.6, -63.6, 0.9, 1.4, 1, BR, { rx: -0.5 });   // horse
    for (const [dz] of [[-1.4], [1.4]]) for (const dx of [-0.4, 0.4]) b.box(-4.2 + dx, 5.2 - 2, -61.5 + dz, 0.25, 2, 0.25, BR);
    b.box(-4.2, 7.4, -61.2, 0.8, 1.8, 0.8, BR); b.box(-4.2, 9.2, -61.2, 0.5, 0.5, 0.5, BR); b.box(-4.2, 8.4, -62.4, 0.15, 0.15, 2.8, BR, { rx: -0.6 }); // rider + raised axe
    for (const [x, z] of [[-38.8, -65], [29.9, -58.3], [61.7, -56.6]]) {
        b.box(x, 0, z, 3.4, 1, 3.4, PL); b.box(x, 1, z, 2.2, 3.4, 2.2, '#c9c1b2');
        b.cyl(x, 4.4, z, 0.45, 0.6, 2.2, BR, 6); b.sphere(x, 6.85, z, 0.32, BR, { detail: 0 });
    }
    b.colPoly([outer], 20);
    b.col(-4.2, -61.5, 2.8, 4.3); for (const [x, z] of [[-38.8, -65], [29.9, -58.3], [61.7, -56.6]]) b.col(x, z, 1.7, 1.7);
}

// Teatrul Național București (Horia Maicu / Romeo Belea / Nicolae Cucu 1967-73; 2010-15 refurbishment that
// removed Cezar Lăzărescu's 1983 facades and restored Belea's reinforced-concrete "pălărie" (terracotta-red
// flared roof edge, white stage-tower cubes above — Commons "Bucharest - New National Theater (19237949514)") — ro.wikipedia
// "Teatrul Național Ion Luca Caragiale din București"). Footprint + 24 m from OSM way 41542957; glazed body
// under the flared white "hat" roof, fly tower of the Sala Mare above; Ioan Bolborea's bronze group
// "Căruța cu paiațe" (7 m, 2010) and the Caragiale statue (3.5 m) in front from OSM ways 1435346473/74.
// Src: https://ro.wikipedia.org/wiki/Teatrul_Național_„Ion_Luca_Caragiale”_din_București ; OSM way 41542957
function bTNB(b) {
    const [p] = P.tnb.map(pts), WH = '#f2f1ec', HAT = '#9c3b2c', GL = '#2f3d48', BR = '#5a4a36';
    // glazed body with mullions
    b.prism(p, 0, 16.5, GL, { mat: 'g', topCol: '#bfbab0' });
    b.pilasters(p, 0, 16.5, 3, 0.18, 0.25, '#c9ccc9', {});
    for (const y of [5.5, 11]) b.cornice(p, y, 0.35, 0.3, '#c9ccc9');
    b.prism(offset(p, 0.4), 0, 0.6, '#bdb6a8');
    // the "hat": sloped white soffit flaring out, fascia, flat top
    const a = offset(p, 0.3), c = offset(p, 5.5);
    const sgn = signedArea(p) > 0 ? 1 : -1;
    for (let i = 0; i < p.length; i++) {
        const j = (i + 1) % p.length;
        b.quad([a[i][0], 16.5, a[i][1]], [a[j][0], 16.5, a[j][1]], [c[j][0], 20.5, c[j][1]], [c[i][0], 20.5, c[i][1]], HAT, 'm', [sgn * (a[j][1] - a[i][1]), -1, -sgn * (a[j][0] - a[i][0])]);
    }
    b.prism(c, 20.5, 23.8, HAT, { topCol: '#8a3427' });
    b.cornice(c, 23.8, 0.5, 0.15, '#b04a38');
    // fly tower + secondary stage volume
    b.prism(rect(22, -20, 66, 30), 23.8, 34, '#e8e6e0', { topCol: '#cfccc4' });
    b.windows(rect(22, -20, 66, 30), 24, 33, 9, '#a8b0b5', { bay: 2.2, wf: 0.18, hf: 0.9, start: 0.3, minL: 10 });
    b.prism(rect(-62, -30, -20, 20), 23.8, 29, '#e8e6e0', { topCol: '#cfccc4' });
    // sign on the front (+z)
    b.text('TEATRUL NATIONAL', 45, 21.2, 60.7, 0, 1.7, '#f2efe6');
    // forecourt: "Căruța cu paiațe" bronze group (cart, figures) + Caragiale statue
    b.box(39.4, 0, 98.6, 13, 0.6, 14, '#c8c1b4');
    b.box(39.4, 0.6, 98.6, 5, 2.4, 9, BR); for (const s of [-1, 1]) b.cyl(39.4 + s * 2.8, 1.6, 98.6 + 2.5, 1.6, 1.6, 0.4, BR, 10, { rz: Math.PI / 2 });
    for (let i = 0; i < 6; i++) { const x = 37 + (i % 3) * 2.3, z = 95 + Math.floor(i / 3) * 6; b.cyl(x, 3, z, 0.35, 0.5, 2.6 + hash(i) * 1.4, BR, 6); b.sphere(x, 6 + hash(i) * 1.4, z, 0.35, BR, { detail: 0 }); }
    b.box(24.8, 0, 86.4, 3, 0.5, 3, '#c8c1b4'); b.cyl(24.8, 0.5, 86.4, 0.4, 0.55, 2.6, BR, 6); b.sphere(24.8, 3.4, 86.4, 0.33, BR, { detail: 0 });
    b.colPoly([p], 24); b.col(39.4, 98.6, 6.5, 7);
}

// Ateneul Român (Albert Galleron, 1886-88) — 41 m to the top of the dome (OSM way 16291602), concert-hall
// rotunda under a ribbed dome; Ionic hexastyle portico with pediment (Commons "Ateneo Rumano, Bucarest,
// 2016-05-29, DD 73"): drum ring of oculi (round windows) between paired pilasters, dark grey-green dome with
// dormers and gilded ribs, lantern; lower two-storey wings left and right of the portico.
// Src: https://en.wikipedia.org/wiki/Romanian_Athenaeum ; OSM way 16291602
function bAteneu(b) {
    const S = '#f1ead9', TR = '#e5dbc6', D = '#5d6964', GOLD = '#d4b46a', WIN = '#56524a';
    b.wall = S;
    const cx = -4;
    // rear block + side wings
    const rear = rect(-33, -19, -12, 19); b.prism(rear, 0, 14, S, { topCol: '#cfc6b3' });
    b.windows(rear, 0, 13, 6.2, WIN, { bay: 4, wf: 0.4, hf: 0.6, arch: true, minL: 6 }); b.cornice(rear, 13.4, 0.8, 0.6, TR);
    for (const s of [-1, 1]) {
        const w = rect(4, s > 0 ? 13 : -24.5, 24.5, s > 0 ? 24.5 : -13);
        b.prism(w, 0, 13, S, { topCol: '#cfc6b3' }); b.windows(w, 0, 12.5, 6, WIN, { bay: 3.6, wf: 0.42, hf: 0.6, arch: true, minL: 5 });
        b.cornice(w, 12.4, 0.8, 0.6, TR); b.colonnade(24.8, s * 14.5, 24.8, s * 23.5, 1.5, 10.5, 3, 0.45, '#f6f1e6', { seg: 6 });
    }
    // rotunda: lower wall with arched windows, cornice, drum with oculi + paired pilasters
    b.cyl(cx, 0, 0, 20.5, 21, 19, S, 28);
    b.windows(ellipse(cx, 0, 21.2, 21.2, 14, Math.PI / 14), 1, 18, 8.5, WIN, { bay: 9.4, wf: 0.3, hf: 0.66, arch: true, minL: 4 });
    b.cyl(cx, 19, 0, 21.8, 21.8, 1.4, TR, 28);
    const drum = ellipse(cx, 0, 18, 18, 24, Math.PI / 24);
    b.prism(drum, 20.4, 26.5, S, { top: false });
    for (let i = 0; i < 12; i++) {
        const a = (i + 0.5) / 12 * Math.PI * 2;
        b.geo(new THREE.TorusGeometry(1.15, 0.28, 4, 10), TR, M(cx + Math.cos(a) * 18.15, 23.4, Math.sin(a) * 18.15, -a + Math.PI / 2));
        b.cyl(cx + Math.cos(a) * 18.05, 23.4, Math.sin(a) * 18.05, 1.05, 1.05, 0.2, '#4b5560', 10, { rx: Math.PI / 2, ry: -a + Math.PI / 2 });
        const a2 = i / 12 * Math.PI * 2;
        for (const d of [-0.035, 0.035]) b.box(cx + Math.cos(a2 + d) * 18.25, 20.4, Math.sin(a2 + d) * 18.25, 0.5, 6.1, 0.5, TR);
    }
    b.cyl(cx, 26.5, 0, 19, 19, 1.2, TR, 24);
    // ribbed dome with dormers, lantern
    const pr = [[18.2, 0], [17.5, 3.5], [15.6, 7], [12.4, 10], [8.2, 12.3], [3.6, 13.4], [0.01, 13.6]].map(([a, c]) => new THREE.Vector2(a, c));
    b.geo(new THREE.LatheGeometry(pr, 24), D, M(cx, 27.7, 0));
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        b.tube([[cx + Math.cos(a) * 18.3, 27.8, Math.sin(a) * 18.3], [cx + Math.cos(a) * 15.8, 34.6, Math.sin(a) * 15.8], [cx + Math.cos(a) * 8.4, 40, Math.sin(a) * 8.4], [cx + Math.cos(a) * 2.6, 41.2, Math.sin(a) * 2.6]], 0.3, GOLD, { seg: 4, radial: 3 });
        const a3 = a + Math.PI / 12; b.box(cx + Math.cos(a3) * 16.5, 29.5, Math.sin(a3) * 16.5, 1.4, 2.2, 1.6, '#e8e1d0', { ry: -a3 });
    }
    b.cyl(cx, 41, 0, 2.2, 2.6, 2.6, '#e8e1d0', 10); b.dome(cx, 43.6, 0, 2.3, 1.8, D, 10); b.cyl(cx, 45.2, 0, 0.12, 0.25, 2.2, GOLD, 6);
    // portico (+x): steps, Ionic hexastyle (+ return columns), entablature with the ATHENEUL ROMAN frieze, pediment
    for (let i = 0; i < 4; i++) b.box(29 - i * 0.6, i * 0.5, 0, 12 - i * 1.2, 0.5, 30 - i * 0.4, '#ddd3bf');
    b.box(14, 2, 0, 10, 13.2, 28, S);
    // portico back wall: rusticated joints, two carved wooden doors with fanlights, five gold mosaic roundels
    for (let k = 0; k < 6; k++) b.box(19.06, 2.2 + k * 1.15, 0, 0.08, 0.06, 26, '#dacfb8');
    for (const z of [-4.8, 0, 4.8]) { b.box(19.1, 2, z, 0.3, 7.2, 3, TR); b.box(19.2, 2, z, 0.25, 5.4, 2.3, '#5a4128'); b.box(19.22, 7.4, z, 0.2, 1.5, 2.3, '#8a7a55', { mat: 'g' }); }
    for (let i = 0; i < 5; i++) { const z = -9.6 + i * 4.8; b.cyl(19.15, 9.6, z, 1.15, 1.15, 0.2, TR, 14, { rz: Math.PI / 2 }); b.cyl(19.3, 9.6, z, 0.95, 0.95, 0.12, '#c9a24e', 14, { rz: Math.PI / 2, mat: 'g' }); }
    const ionic = (x, z) => {                                                   // Attic base, fluted-looking 12-sided shaft, Ionic capital
        b.box(x, 2, z, 1.9, 0.35, 1.9, TR); b.cyl(x, 2.35, z, 0.92, 0.98, 0.45, TR, 12);
        b.cyl(x, 2.8, z, 0.66, 0.76, 10.2, '#f6f1e6', 12);
        b.cyl(x, 13, z, 0.82, 0.7, 0.35, TR, 12);
        for (const s2 of [-1, 1]) b.cyl(x, 13.05, z + s2 * 0.82, 0.36, 0.36, 1.7, '#efe8d8', 8, { rz: Math.PI / 2 });
        b.box(x, 13.4, z, 1.75, 0.22, 2.05, TR);
    };
    for (let i = 0; i < 6; i++) ionic(26.2, -12 + i * 4.8);
    for (const z of [-12, 12]) ionic(21.6, z);
    // entablature: three-fascia architrave, frieze with the inscription, dentilled cornice
    b.box(21, 13.62, 0, 12, 0.36, 28.6, TR); b.box(21.05, 13.98, 0, 12.1, 0.36, 28.7, TR); b.box(21.1, 14.34, 0, 12.2, 0.36, 28.8, TR);
    b.box(21, 14.7, 0, 12, 1.2, 28.6, S);
    b.text('ATHENEUL ROMAN', 27.02, 14.72, 0, Math.PI / 2, 0.74, '#a3926f');
    for (let i = 0; i < 46; i++) b.box(27.2, 15.9, -14.35 + i * 0.638, 0.3, 0.28, 0.3, TR);
    b.box(21.2, 16.18, 0, 12.6, 0.45, 29.6, TR);
    b.pediment(21, 16.63, 0, 29, 5.3, 12, S, Math.PI / 2);
    // raking cornices + acroteria (gilded lyres at the apex and corners)
    const ang = Math.atan2(5.3, 14.5), Lr = Math.hypot(5.3, 14.5);
    for (const s2 of [-1, 1]) b.box(21.3, 16.63 + 2.65 - 0.2, s2 * 7.25, 12.7, 0.55, Lr + 0.8, TR, { rx: s2 * ang });
    for (const [z, y] of [[0, 22.1], [-14.6, 16.9], [14.6, 16.9]]) { b.box(26.5, y, z, 1, 0.5, 1, TR); b.box(26.5, y + 0.5, z, 0.25, 1.4, 0.9, '#b9974c', { mat: 'g' }); }
    b.col(-4, 0, 30, 24);
}

// Palatul Regal (Royal Palace, now MNAR; N. Nenciulescu 1927-37 rebuild) — OSM way 232472401 (250 x 86 m, flat roof).
// The main front faces EAST-NORTH-EAST onto Calea Victoriei / Piața Revoluției: a cour d'honneur (model -z side, x ≈ -36..59,
// ≈ 40 m deep) framed by the north and south wings. Limestone ashlar (#E1D6BC), rusticated ground floor with arched
// windows, giant fluted Corinthian columns in pairs on pedestals spanning the two upper storeys, dentilled cornice,
// balustraded attic; iron-and-glass marquee over the main door (Commons "49-53, Calea Victoriei, Bucharest (Romania)",
// "The porch of the Royal Palace of Bucharest"). Model frame: +x = SSE along the street, -z = ENE (towards the square).
// Src: https://en.wikipedia.org/wiki/Royal_Palace,_Bucharest ; OSM way 232472401
function bRegal(b) {
    const S = '#e1d6bc', TR = '#d8ccb0', WIN = '#4f565a', COL = '#ebe2cd';
    b.wall = S;
    const [p] = P.regal.map(pts);
    const top = storeys(b, p, 0, [[6.2, 0.42, 0.62, true], [5.6, 0.36, 0.62, false], [4.6, 0.34, 0.5, false]],
        { wall: S, win: WIN, trim: TR, bay: 4.6, courses: [0], pilasters: true, pilasterFrom: 6.2, pilasterEvery: 2, pilasterW: 1, corniceOut: 1.1, corniceH: 1.3, parapet: 1.2, roofCol: '#b9b2a4', minL: 6 });
    for (let k = 0; k < 5; k++) b.cornice(p, 0.6 + k * 1.15, 0.08, 0.06, '#cfc3a6');           // rusticated joints of the ground floor
    b.ring(offset(p, 0.25), top - 0.1, top + 1.0, '#ddd2b8');                                  // balustraded attic (solid read)
    b.piers(offset(p, 0.3), top - 0.1, top + 1.0, 2.2, TR);
    // cour d'honneur: paired giant columns on pedestals along the central body and the inner faces of the wings
    const fz = (x) => (zAt([p], x)?.[0] ?? 2);
    for (const x of [-22, -12, -1, 10, 21, 32, 43]) for (const d of [-1.05, 1.05]) {
        const z = fz(x + d) - 1.25;
        b.box(x + d, 6.2, z, 1.7, 1.1, 1.7, TR); b.cyl(x + d, 7.3, z, 0.62, 0.7, 9.4, COL, 12);
        b.cyl(x + d, 16.7, z, 0.85, 0.66, 1.1, TR, 8); b.box(x + d, 17.6, z, 1.9, 0.25, 1.9, TR);
    }
    for (const [x0, x1] of [[-24, 0], [-2, 23], [19, 45]]) { const z = Math.min(fz(x0), fz(x1)) - 1.4; b.box((x0 + x1) / 2, 17.85, z, x1 - x0 + 2, 1.3, 2.4, TR); }
    // main door + iron-and-glass marquee
    const zd = fz(10); b.box(10, 0, zd - 0.15, 3.4, 5, 0.3, '#5b4a35'); b.box(10, 4.6, zd - 3, 9, 0.35, 6, '#2c3134', { mat: 'g' }); b.box(10, 4.95, zd - 3, 8.4, 0.12, 5.6, '#9db0b8', { mat: 'g' });
    for (const s2 of [-1, 1]) b.box(10 + s2 * 4.3, 0, zd - 5.6, 0.2, 4.6, 0.2, '#2c3134');
    // court paving + the iron railing with stone pillars closing the court on Calea Victoriei
    b.prism(rect(-36, -40, 59, fz(10) - 0.5), 0, 0.06, '#c9c4b8');
    b.fence([[-55, -42], [-8, -44], [28, -44], [75, -36]], 2.4, 7, '#22272a', { post: 0.7, postCol: '#d6ccb4', base: 0.6, baseCol: '#d6ccb4', bars: 0.35 });
    b.cyl(-6, 0, -2 + fz(-6), 0.1, 0.14, 12, '#dddddd', 6); flag(b, -6, 11.8, -2 + fz(-6), 2.6);
    b.colPoly([p], 22);
}

// Palatul Victoria (Government, Duiliu Marcu, 1937-52) — OSM way 23554419 + parts 1516914665 (20 m),
// 1516952164 (23 m), 1516952165 (30 m core, green-copper roof #8fbc8f). Stripped-classical travertine block:
// regular grid of tall windows, high ground floor, full-width giant order of square pillars + entrance
// portico to Piața Victoriei (+z, faces the square to the W/SW), travertine #D9CDB4, two flagpoles,
// attic storey set back, flag mast.
// Src: https://en.wikipedia.org/wiki/Victoria_Palace ; OSM way 23554419 + parts 1516914665/1516952164/1516952165
function bVictoria(b) {
    const S = '#d9cdb4', TR = '#cec1a5', WIN = '#4c5157';   // travertine #D9CDB4 (research bucharest-romana.json landmarks[victoria])
    b.wall = S;
    const [p] = P.victoria.map(pts);
    storeys(b, p, 0, [[6, 0.42, 0.7, false], [4.2, 0.4, 0.62, false], [4.2, 0.4, 0.62, false], [4.2, 0.4, 0.58, false]], { wall: S, win: WIN, trim: TR, bay: 3.9, courses: [0], corniceOut: 0.6, minL: 5 });
    const core = rect(-43, -33, 43, 15);
    storeys(b, offset(core, -1), 19.6, [[3.4, 0.36, 0.55, false]], { wall: S, win: WIN, trim: TR, bay: 3.9, corniceOut: 0.4, minL: 5 });
    b.hip(0, 23.6, -9, 84, 46, 6.4, '#87b28c');                                                  // green-copper roof
    // full-width giant order on Piața Victoriei (Commons "Bucharest Victoria Palace-2.jpg"): square pillars
    // from the plinth storey to the attic cornice, projecting entrance bay in the middle
    b.colonnade(-44, 22.6, 44, 22.6, 6, 13.6, 20, 0.6, '#f1ede4', { square: true });
    b.box(0, 19.6, 22.4, 92, 0.9, 1.6, TR);
    b.box(-1.2, 0, 34.5, 24, 1, 6, '#cfc6b3');
    b.colonnade(-10, 36.4, 7.6, 36.4, 1, 15.5, 6, 0.7, '#f1ede4', { square: true });
    b.box(-1.2, 16.5, 35.5, 22, 2.2, 3.2, TR);
    b.cyl(-1.2, 30, -9, 0.12, 0.16, 9, '#dddddd', 6); flag(b, -1.2, 38.8, -9, 3);
    // the two flagpoles in front of the portico (Romania + EU) — research: "19-bay arcade/colonnade; two flagpoles"
    for (const [x, eu] of [[-16, false], [13.6, true]]) {
        b.cyl(x, 0, 41, 0.1, 0.16, 15, '#e3e3e3', 6); b.box(x, 0, 41, 0.9, 0.5, 0.9, '#bdb4a0');
        if (eu) b.box(x + 1.5, 12.6, 41, 3, 2, 0.05, '#003399'); else flag(b, x, 14.6, 41, 3);
    }
    b.colPoly([p], 20);
}

// Palatul CEC (Paul Gottereau, 1897-1900) — eclectic, ≈ 58 x 60 m (OSM way 973712798); glass-and-iron dome over the
// banking hall (top ≈ 40 m), the Calea Victoriei corner (+x) entrance pavilion = a monumental semicircular arch
// whose archivolt crowns the pavilion, flanked by paired composite columns, a glazed recess behind it (door, balcony,
// clock in the tympanum); four corner pavilions with pediments under square-plan (cloister) zinc domes with lanterns.
// Warm limestone/stucco (research #E2D9C6), zinc-grey domes #8d9799 (Commons "Bucharest CEC building 02").
// Src: https://en.wikipedia.org/wiki/CEC_Palace ; OSM way 973712798
function bCEC(b) {
    const S = '#e2d6bb', TR = '#d6c8a8', MT = '#8d9799', WIN = '#4a4943', COL = '#ece4d0';
    b.wall = S;
    const [p] = P.cec.map(pts);
    storeys(b, p, 0, [[6.5, 0.45, 0.68, true], [5.4, 0.4, 0.62, true], [4.6, 0.38, 0.55, false]], { wall: S, win: WIN, trim: TR, bay: 4.4, courses: [0, 1], pilasters: true, pilasterEvery: 1, pilasterW: 0.8, corniceOut: 0.9, parapet: 1, minL: 5 });
    for (let k = 0; k < 4; k++) b.cornice(p, 0.8 + k * 1.4, 0.1, 0.07, '#cbbd9d');           // rusticated ground floor
    // central glass-and-iron dome on a drum with a balustrade
    b.cyl(0, 17.6, 0, 11, 11.5, 4.5, S, 20); b.windows(ellipse(0, 0, 11.3, 11.3, 10), 17.6, 22, 4.4, WIN, { bay: 7, wf: 0.35, hf: 0.6, arch: true, minL: 3 });
    b.cyl(0, 22, 0, 11.7, 11.7, 0.5, TR, 20); b.cyl(0, 22.5, 0, 11.5, 11.5, 0.9, '#d9cdb0', 20, { open: true });
    b.geo(new THREE.LatheGeometry([[11, 0], [10.4, 4], [8.4, 8.2], [5.2, 11.4], [1.6, 12.8], [0.01, 13]].map(([a, c]) => new THREE.Vector2(a, c)), 20), '#a9bcc2', M(0, 22.1, 0), 'g');
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; b.tube([[Math.cos(a) * 11.15, 22.1, Math.sin(a) * 11.15], [Math.cos(a) * 10.5, 26.1, Math.sin(a) * 10.5], [Math.cos(a) * 8.5, 30.3, Math.sin(a) * 8.5], [Math.cos(a) * 1.7, 34.9, Math.sin(a) * 1.7]], 0.16, '#5d6668', { seg: 4, radial: 3, mat: 'g' }); }
    for (const [r, y] of [[10.75, 25.6], [8.9, 29.8]]) b.geo(new THREE.TorusGeometry(r, 0.14, 3, 20), '#5d6668', M(0, y, 0, 0, 1, 1, 1, Math.PI / 2), 'g');
    b.cyl(0, 35, 0, 1.6, 1.8, 2.6, MT, 8); b.dome(0, 37.6, 0, 1.7, 1.4, MT, 8); b.cone(0, 38.9, 0, 0.4, 1.6, MT, 6);
    // entrance pavilion (+x): crowning archivolt, deep arch with a glazed recess, paired columns, small dome behind
    const xf = xAt([p], 0)?.[1] ?? 22;
    b.box(xf - 5.7, 0, 0, 7, 16, 18, S);
    for (const sg of [-1, 1]) b.box(xf - 1.2, 0, sg * 7, 2.1, 16, 4, S);
    b.box(xf - 1.2, 15.2, 0, 2.1, 0.8, 10.2, S);
    b.archWall(18.2, 16, 1.6, [{ x: 0, w: 10, h: 15.4 }], TR, M(xf + 0.6, 0, 0, Math.PI / 2));
    { const sh = new THREE.Shape(); sh.absarc(0, 0, 9.1, 0, Math.PI, false); sh.lineTo(9.1, 0); const g = new THREE.ExtrudeGeometry(sh, { depth: 2.2, bevelEnabled: false, curveSegments: 16 }); g.translate(0, 0, -1.1); b.geo(g, S, M(xf + 0.3, 10.6, 0, Math.PI / 2)); }   // archivolt / crowning half-disc
    b.geo(new THREE.TorusGeometry(9.2, 0.45, 4, 20, Math.PI), TR, M(xf + 0.9, 10.6, 0, Math.PI / 2));
    b.geo(new THREE.TorusGeometry(5.2, 0.35, 4, 16, Math.PI), TR, M(xf + 1.4, 10.4, 0, Math.PI / 2));
    // recess: door, two storeys of windows, balcony, clock and relief in the tympanum
    const xr = xf - 2.2;
    b.box(xr, 0, 0, 0.3, 5.8, 3.6, '#4a3a2a'); b.box(xr + 0.2, 0, 0, 0.3, 6.4, 4.4, TR);
    for (const z of [-2.8, 2.8]) b.box(xr + 0.05, 7.4, z, 0.25, 3.2, 1.8, WIN);
    b.box(xr + 0.6, 6.6, 0, 1.2, 0.3, 9, TR); b.fence([[xr + 1.15, -4.4], [xr + 1.15, 4.4]], 1, 1.1, '#2e3335', { post: 0.08 });
    b.cyl(xr + 0.2, 12.4, 0, 1.1, 1.1, 0.3, '#f1ece0', 16, { rz: Math.PI / 2 }); b.cyl(xr + 0.3, 12.4, 0, 0.95, 0.95, 0.12, '#e9e3d4', 16, { rz: Math.PI / 2 });
    b.box(xr + 0.35, 12.3, 0, 0.1, 0.8, 0.1, '#222'); b.box(xr + 0.35, 12.35, 0.2, 0.1, 0.1, 0.5, '#222');
    for (const z of [-2.6, 2.6]) b.box(xr + 0.3, 11.4, z, 0.5, 2.2, 1.6, '#d9ccb0');
    for (const z of [-6.8, -5.3, 5.3, 6.8]) { b.box(xf + 1.9, 1.2, z, 1.3, 1, 1.3, TR); b.cyl(xf + 1.9, 2.2, z, 0.48, 0.55, 10.4, COL, 10); b.box(xf + 1.9, 12.6, z, 1.25, 0.9, 1.25, '#cfc0a0'); }
    b.box(xf + 1.9, 0, 0, 1.6, 1.2, 16, '#cfc6b3'); b.box(xf + 1.6, 13.5, 0, 2.6, 1.4, 18.4, TR);
    for (let i = 0; i < 5; i++) b.box(xf + 3 - i * 0.4, i * 0.24, 0, 1.6, 0.24, 9, '#d3cab8');            // entrance steps
    b.cyl(xf - 6, 16, 0, 4.6, 4.8, 5, S, 16); b.dome(xf - 6, 21, 0, 4.6, 5.4, MT, 16, { mat: 'g' });
    b.cyl(xf - 6, 26.3, 0, 0.8, 0.9, 1.4, S, 8); b.cone(xf - 6, 27.7, 0, 0.8, 2.6, MT, 8);
    // corner pavilions: attic with pediments, square-plan zinc cloister domes, lanterns + finials
    const bb = bbox([p]);
    for (const [x, z] of [[bb.x0 + 4.5, bb.z0 + 4.5], [bb.x1 - 4.5, bb.z0 + 4.5], [bb.x0 + 4.5, bb.z1 - 4.5], [bb.x1 - 4.5, bb.z1 - 4.5]]) {
        b.box(x, 16.4, z, 7.6, 4.4, 7.6, S); b.box(x, 20.8, z, 8.2, 0.45, 8.2, TR);
        for (const r2 of [0, Math.PI / 2]) for (const sg of [-1, 1]) { const ox = r2 ? 0 : sg * 3.85, oz = r2 ? sg * 3.85 : 0; b.pediment(x + ox, 18.6, z + oz, 4.6, 1.5, 0.5, TR, r2 ? 0 : Math.PI / 2); }
        b.geo(new THREE.LatheGeometry([[5.2, 0], [5, 1.4], [4.2, 2.9], [2.7, 4.3], [0.9, 5], [0.01, 5.1]].map(([a, c]) => new THREE.Vector2(a, c)), 4), MT, M(x, 21.25, z, Math.PI / 4), 'g');
        b.cyl(x, 26, z, 0.8, 1, 1.6, '#d9cdb0', 8); b.dome(x, 27.6, z, 0.9, 0.9, MT, 8, { mat: 'g' }); b.cone(x, 28.4, z, 0.22, 1.8, MT, 6);
    }
    b.colPoly([p], 15);
}

// Muzeul Național de Istorie a României (Palatul Poștelor, Alexandru Săvulescu, 1894-1900) — ≈ 22 m,
// neoclassical; portico of 14 Doric columns ("loggia") between end pavilions on Calea Victoriei (-x),
// mansard roof; OSM rel 19919941 (+ courtyard). Trajan's Column replica stands in the inner courtyard.
// Src: https://en.wikipedia.org/wiki/National_Museum_of_Romanian_History ; OSM rel 19919941
function bMNIR(b) {
    const S = '#e8e0cf', TR = '#ddd3bf', WIN = '#4f4a43';
    b.wall = S;
    const [p, hole] = P.mnir.map(pts);
    storeys(b, p, 0, [[6.5, 0.44, 0.66, true], [5.6, 0.4, 0.62, false], [5, 0.38, 0.55, false]], { wall: S, win: WIN, trim: TR, bay: 4.4, holes: [hole], courses: [0], pilasters: true, pilasterEvery: 2, corniceOut: 0.9, parapet: 1.1, minL: 6 });
    b.roof(p, 19.2, 4, '#8f9599', 2.2, { holes: [hole], topCol: '#7f868a' });
    const xf = xAt([p], 0)?.[0] ?? -52;
    b.box(xf - 5, 0, 0, 10, 3, 62, '#cfc6b3');
    for (let i = 0; i < 4; i++) b.box(xf - 10.5 + i * 0.6, i * 0.75, 0, 1.2, 0.75, 44, '#d8cfbd');
    b.colonnade(xf - 8.2, -26, xf - 8.2, 26, 3, 13.2, 14, 1, '#f3eee3', { capital: TR, seg: 10 });
    b.box(xf - 5, 16.2, 0, 10.6, 2.6, 62, TR); b.box(xf - 5, 18.8, 0, 9.6, 1.5, 60, S);
    b.text('MUZEUL NATIONAL DE ISTORIE A ROMANIEI', xf - 10.32, 16.75, 0, -Math.PI / 2, 0.85, '#7a6b52');
    for (const z of [-36, 36]) { b.box(xf + 3, 0, z, 10, 24.5, 14, S); b.windows(rect(xf - 2, z - 7, xf + 8, z + 7), 0, 23, 6.5, WIN, { bay: 4.6, wf: 0.4, hf: 0.6, arch: true, minL: 4 }); b.hip(xf + 3, 24.5, z, 10, 14, 4, '#8f9599'); }
    // Trajan's Column replica (cast, 1967) in the courtyard
    const [hx, hz] = centroid(hole); b.cyl(hx, 0, hz, 2, 2, 3, '#d9d1c1', 8); b.cyl(hx, 3, hz, 1.6, 1.8, 24, '#d6cdb9', 10); b.box(hx, 27, hz, 2.4, 1.2, 2.4, '#d9d1c1');
    b.colPolygon(p, { holes: [hole], y1: 19.2 });
}

// JW Marriott Bucharest Grand Hotel (ex-Casa Republicii annex, 1980s, opened 2000) — 9 levels / 40 m
// (OSM way 26314111) with 13-16 m inner wings (parts 1190458135-38). Same cream stone language as the
// Parliament: arcaded ground floor, regular grid, arched top storey, set-back attic, porte-cochère + sign.
// Src: https://en.wikipedia.org/wiki/JW_Marriott_Bucharest_Grand_Hotel ; OSM way 26314111
function bMarriott(b) {
    const S = '#ece4d1', TR = '#e2d8c2', WIN = '#56606a';
    b.wall = S;
    const [p] = P.marriott.map(pts);
    storeys(b, p, 0, [[5.6, 0.5, 0.7, true], [3.6, 0.4, 0.55, false], [3.6, 0.4, 0.55, false], [3.6, 0.4, 0.55, false], [3.6, 0.4, 0.55, false], [3.6, 0.4, 0.55, false], [3.6, 0.4, 0.55, false], [4, 0.44, 0.64, true]],
        { wall: S, win: WIN, trim: TR, bay: 4.4, courses: [0, 6], pilasters: true, pilasterEvery: 2, corniceOut: 0.9, parapet: 1, minL: 6 });
    const t = offset(p, -5); b.prism(t, 32.5, 39, S, { topCol: '#cbc5b8' }); b.windows(t, 32.5, 39, 3.6, WIN, { bay: 4.4, wf: 0.4, hf: 0.55, minL: 8 });
    const xf = xAt([p], 0)?.[1] ?? 40;
    b.box(xf + 6, 6, 0, 12, 1, 22, TR); b.colonnade(xf + 11, -9, xf + 11, 9, 0, 6, 4, 0.5, '#f3eee4', { seg: 6 });
    b.text('JW MARRIOTT', xf + 12.05, 6.15, 0, Math.PI / 2, 0.7, '#2c2c2c');
    b.colPoly([p], 20);
}

// Unirea Shopping Center (1976, enlarged 1989, refurbished 2000s) — 4 floors + roof levels, 6 levels in OSM
// (way 23492027), 43,760 m² (en.wikipedia). Long curved glass front on Piața Unirii (-x side) with the red
// "UNIREA" lettering, beige stone end walls; multi-storey car park block behind (OSM 184169515, not modelled).
// Src: https://en.wikipedia.org/wiki/Unirea_Shopping_Center (43,760 m², 4 floors) ; OSM way 23492027
function bUnirea(b) {
    const [p] = P.unirea.map(pts);
    b.prism(p, 0, 24, '#d6d1c6', { topCol: '#b3afa6' });
    b.windows(p, 0, 24, 4.6, '#3f5d74', { bay: 3, wf: 0.9, hf: 0.78, start: 0.5, mat: 'g', minL: 4 });
    b.cornice(p, 4.8, 0.6, 0.8, '#ece9e2'); b.cornice(p, 23.4, 1.2, 0.8, '#ece9e2');
    b.prism(offset(p, -12), 24, 28.5, '#c9c4b9', { topCol: '#aaa69e' });
    const zf = zAt([p], 0)?.[1] ?? 52;                                                    // west front on Piața Unirii = +z
    b.box(0, 13.6, zf + 1.3, 48, 8, 1, '#ffffff');
    b.text('UNIREA', 0, 14.6, zf + 1.85, 0, 6, '#c8102e');
    b.text('SHOPPING CENTER', 0, 10.4, zf + 1.3, 0, 2.2, '#c8102e');
    b.colPoly([p], 24);
}

// Fântânile din Piața Unirii & Bd. Unirii — basins from OSM natural=water ways (round Ø ~14 m and
// oval ~28 m basins alternating along the boulevard median, central plaza fountains).
const FOUNTAINS = [[-770, -48, 14], [-722, -44, 14], [-686, -42, 7], [-650, -39, 14], [-614, -37, 7], [-578, -35, 14], [-543, -32, 7], [-507, -30, 14], [-471, -28, 7], [-435, -25, 14], [-398, -23, 7], [-361, -21, 14], [-326, -19, 7], [-289, -16, 14], [-253, -14, 7], [-216, -11, 14], [-181, -9, 7], [-95, 20, 22], [-92, -27, 23], [-91, -3, 14], [-75, 24, 9], [-71, -31, 9], [-59, -1, 7], [-59, 30, 19], [-54, -32, 19], [-33, 50, 33], [-26, -51, 31], [-8, 59, 15], [0, -58, 14], [19, 54, 33], [26, -47, 32], [47, 36, 18], [51, -25, 19], [51, 6, 7], [64, 33, 8], [67, -22, 9], [82, 8, 14], [83, 32, 21], [84, -15, 20], [155, 12, 7], [199, 15, 14], [244, 18, 7], [292, 21, 14], [338, 24, 7], [383, 27, 14], [429, 30, 7], [474, 32, 14], [522, 35, 7], [569, 38, 14]];
// Research (bucharest-unirii): 44 fountains along ~1.4 km (built late 1980s, reopened 2018 with light/music shows),
// grey granite / concrete rims, turquoise-tiled basin bottoms, jets 2-15 m; the round central plaza basin is
// "Fântâna lui Bucur". OSM maps 49 basins (some fountains have two basins).
// Src: https://en.wikipedia.org/wiki/Piața_Unirii ; OSM natural=water / amenity=fountain ways ; game/research/bucharest-unirii.json (fountains_44)
// ---------------------------------------------------------------------------
//  Fountain water: translucent animated jets / spray crowns / foam rings and the basin water surface. Two shared
//  materials (one draw call each for the whole fountain field), animated in the shader by a time uniform; the CPU only
//  sets 3 uniforms once per frame (onBeforeRender of the meshes). Schedule (research bucharest-unirii.md "Fountains"):
//  running May-Oct 10:00-23:00 Bucharest time, basins drained Nov-Apr; "Simfonia Apei" show Fri-Sun 21:00-21:45
//  May-Sep with colour-cycling underwater LEDs; otherwise static white/blue underwater lights after sunset.
//  Night light: material.userData.nightEmissive (render.js eases emissiveIntensity at dusk). State source, in order:
//  FOUNTAIN_STATE.mode ('on'|'off'|'show'|null; URL ?fountains=on|off|show), FOUNTAIN_STATE.date, window.game.r3d /
//  window.spotDev.r3d .simDate, else now; render's season 'winter' (?season=winter) forces them off.
// ---------------------------------------------------------------------------
export const FOUNTAIN_STATE = { mode: null, date: null };
try { const q = new URLSearchParams(globalThis.location?.search || '').get('fountains'); if (['on', 'off', 'show'].includes(q)) FOUNTAIN_STATE.mode = q; } catch { /* no location */ }
const FU = { uTime: { value: 0 }, uOn: { value: 1 }, uShow: { value: 0 } };
let _fuFrame = -1, _fuCheck = -1e9;
const _bucFmt = (() => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', month: 'numeric', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }); } catch { return null; } })();
export function fountainSchedule(date) {   // → { on, show } for a Date (Bucharest local time)
    let mo = date.getMonth() + 1, wd = date.getDay(), h = date.getHours() + date.getMinutes() / 60;
    if (_bucFmt) { const pp = Object.fromEntries(_bucFmt.formatToParts(date).map(x => [x.type, x.value])); mo = +pp.month; h = +pp.hour + +pp.minute / 60; wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(pp.weekday); }
    const season = mo >= 5 && mo <= 10, on = season && h >= 10 && h < 23;
    const show = on && mo <= 9 && (wd === 5 || wd === 6 || wd === 0) && h >= 21 && h < 21.75;
    return { on, show };
}
function fountainTick(renderer) {
    const f = renderer?.info?.render?.frame ?? -2; if (f === _fuFrame) return; _fuFrame = f;
    const now = performance.now(); FU.uTime.value = (now / 1000) % 3600;
    if (now - _fuCheck < 1000) return; _fuCheck = now;
    const st = FOUNTAIN_STATE, r3d = globalThis.game?.r3d || globalThis.spotDev?.r3d;
    let on, show;
    if (st.mode) { on = st.mode !== 'off'; show = st.mode === 'show'; }
    else {
        ({ on, show } = fountainSchedule(st.date || r3d?.simDate || new Date()));
        if ((r3d?.weather?.season || r3d?._season?.season) === 'winter') on = show = false;
    }
    FU.uOn.value = on ? 1 : 0; FU.uShow.value = show ? 1 : 0;
    // basins (round 6 note 5): hold still, reflective water out of the jet season and are drained only in winter
    // (or ?fountains=off); running jets stir the surface; underwater lights only while the fountains run
    const mo = (st.date || r3d?.simDate || new Date()).getMonth() + 1;
    const drained = st.mode ? st.mode === 'off' : ((r3d?.weather?.season || r3d?._season?.season) === 'winter' || mo === 12 || mo <= 2);
    const W = FMATS?.water; if (W) {
        for (const m of FOUNTAIN_WATER) m.visible = !drained;
        const U = W.userData.waterU; U.uWRipple.value = on ? 2.4 : 0.5; U.uWWave.value = on ? 0.9 : 0.25;
        if (show) W.emissive.setHSL((FU.uTime.value * 0.12) % 1, 0.75, 0.45); else W.emissive.set(on ? '#2f86b0' : '#000000');
    }
}
const FOUNTAIN_WATER = new Set();
let FMATS = null;
function fountainMaterials() {
    if (FMATS) return FMATS;
    const head = 'uniform float uTime; uniform float uOn; uniform float uShow;\n';
    // jets: kind 0 = column, 1 = falling spray crown, 2 = foam ring (aJ = kind, seed, height)
    const jet = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, emissive: new THREE.Color('#bfe6ff'), emissiveIntensity: 0 });
    jet.name = 'landmark-fountain-jets'; jet.userData.nightEmissive = 1.4;
    jet.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, FU);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + head + 'attribute vec3 aJ; varying vec3 vJ; varying vec2 vU;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
vJ = aJ; vU = uv;
if (aJ.x < 1.5) transformed.y *= 1.0 + 0.05 * sin(uTime * 2.3 + aJ.y * 17.0) * uv.y;
if (uOn < 0.5) transformed *= 0.0;`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + head + 'varying vec3 vJ; varying vec2 vU;')
            .replace('#include <color_fragment>', `#include <color_fragment>
float k = vJ.x, sd = vJ.y, a = 0.0;
if (k < 0.5) {            // rising column: streaks moving up, thinning to the top
  float st = 0.5 + 0.5 * sin(vU.y * vJ.z * 2.2 - uTime * 9.0 + sd * 30.0 + sin(vU.x * 37.7 + sd) * 1.5);
  a = (0.32 + 0.4 * st) * smoothstep(1.0, 0.7, vU.y) * smoothstep(0.0, 0.06, vU.y);
} else if (k < 1.5) {     // spray crown: droplet curtains falling outward
  float fall = fract(vU.y * 2.5 - uTime * 1.3 + sd);
  float drops = smoothstep(0.35, 0.9, fract(vU.x * 48.0 + sd * 7.0 + fall * 0.6)) * 0.6 + 0.4;
  a = 0.5 * drops * (0.55 + 0.45 * fall) * smoothstep(1.0, 0.65, vU.y);
} else {                  // foam ring where the water falls back
  vec2 q = vU - 0.5; float d = length(q) * 2.0, an = atan(q.y, q.x);
  float fo = sin(an * 7.0 + d * 19.0 - uTime * 2.3 + sd * 9.0) * sin(an * 13.0 - d * 11.0 + uTime * 1.7) + 0.6 * sin(an * 3.0 + uTime * 0.9 + sd * 4.0);
  a = 0.8 * smoothstep(1.0, 0.45, d) * (0.45 + 0.35 * fo) + 0.35 * smoothstep(0.3, 0.0, d);
}
diffuseColor.a *= a * uOn;`)
            .replace('#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * 0.45 * (1.0 - min(length(emissive) * 0.7, 1.0));   // light scattered in the spray (daylight)\n#include <opaque_fragment>')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
vec3 hue = 0.55 + 0.45 * cos(6.2832 * (uTime * 0.12 + sd * 0.35 + vec3(0.0, 0.33, 0.67)));
totalEmissiveRadiance *= mix(vec3(0.75, 0.9, 1.0), hue * 1.3, uShow) * a * uOn;`);
    };
    jet.customProgramCacheKey = () => 'landmark-fountain-jets';
    // basin water surface: the shared reflective water (sky / façades in the Fresnel reflection, ripple normals),
    // shallow turquoise-tiled basins; drained (hidden) in winter, stirred while the jets run (fountainTick)
    const water = makeWaterMaterial({ deep: '#2a5c64', shallow: '#4c8f96', transparent: true, opacity: 0.9, ripple: 0.5, wave: 0.25, foam: 0, roughness: 0.05 });
    water.name = 'landmark-fountain-water'; water.emissive = new THREE.Color('#000000'); water.userData.nightEmissive = 0.35;
    FMATS = { jet, water };
    return FMATS;
}

// OSM basin outlines (natural=water) round Piata Unirii and along Bd. Unirii, local metres (x east, z south) from the
// landmark anchor 44.4268, 26.1025, generated from the OSM tiles (after round 6: the guessed ovals spilled into the lanes)
const FOUNTAIN_RINGS = [
    [-780.4,-50.6,-782.1,-50.6,-783.2,-49.9,-783.5,-48.5,-782.8,-47.4,-781.6,-46.9,-780.3,-45.7,-778.0,-45.8,-776.6,-46.4,-774.8,-46.2,-772.1,-45.3,-769.3,-44.9,-766.3,-45.3,-764.4,-45.7,-762.6,-45.1,-758.8,-44.4,-757.7,-45.2,-756.3,-45.8,-755.7,-47.2,-756.1,-48.3,-757.1,-49.0,-758.7,-49.8,-761.7,-49.7,-763.3,-49.2,-765.1,-49.4,-767.5,-50.5,-769.9,-50.8,-773.2,-50.3,-775.6,-50.2,-777.0,-50.9,-780.0,-51.5], // w1177217423
    [-732.6,-47.3,-734.2,-47.3,-735.3,-46.7,-735.6,-45.2,-735.0,-44.1,-733.8,-43.6,-732.4,-42.4,-730.1,-42.5,-728.7,-43.2,-726.9,-42.9,-724.2,-42.0,-721.4,-41.6,-718.5,-42.1,-716.5,-42.4,-714.7,-41.8,-711.0,-41.1,-709.9,-41.9,-708.4,-42.5,-707.9,-43.9,-708.2,-45.0,-709.2,-45.7,-710.8,-46.5,-713.9,-46.4,-715.4,-45.9,-717.2,-46.2,-719.6,-47.2,-722.1,-47.5,-725.4,-47.0,-727.7,-46.9,-729.2,-47.6,-732.1,-48.2], // w1177217420
    [-689.5,-44.2,-689.9,-44.3,-690.6,-44.4,-691.3,-44.2,-691.9,-43.8,-692.3,-43.3,-692.6,-42.6,-692.6,-41.9,-692.3,-41.3,-691.9,-40.7,-691.4,-40.3,-690.4,-40.0,-690.3,-39.3,-688.9,-39.2,-688.1,-39.7,-687.3,-39.1,-686.6,-38.9,-685.9,-39.0,-685.2,-39.2,-684.3,-40.0,-683.5,-39.2,-682.6,-39.2,-682.4,-39.7,-681.5,-39.7,-680.8,-40.0,-680.2,-40.5,-679.9,-41.1,-679.8,-41.8,-679.9,-42.4,-680.2,-43.1,-680.7,-43.6,-681.4,-43.9,-682.4,-44.0,-682.5,-44.6,-683.4,-44.5,-684.3,-43.8,-685.1,-44.6,-685.7,-44.9,-686.5,-45.0,-687.1,-44.8,-688.0,-44.2,-688.9,-44.8,-689.4,-44.8], // w1177026766
    [-660.5,-42.2,-662.2,-42.2,-663.3,-41.6,-663.6,-40.2,-662.9,-39.0,-661.7,-38.6,-660.4,-37.3,-658.1,-37.4,-656.7,-38.1,-654.9,-37.8,-652.2,-36.9,-649.4,-36.5,-646.4,-37.0,-644.5,-37.3,-642.7,-36.7,-638.9,-36.0,-637.8,-36.8,-636.4,-37.4,-635.8,-38.7,-636.0,-39.5,-636.6,-40.4,-638.2,-40.6,-641.4,-41.8,-642.6,-40.9,-644.3,-40.9,-646.4,-41.6,-648.9,-42.5,-651.8,-42.4,-654.5,-41.7,-656.3,-42.1,-657.6,-43.0], // w1177217417
    [-616.9,-39.3,-617.3,-39.4,-618.0,-39.4,-618.7,-39.3,-619.3,-38.9,-619.7,-38.3,-620.0,-37.7,-620.0,-37.0,-619.8,-36.3,-619.3,-35.7,-618.8,-35.3,-617.8,-35.1,-617.7,-34.3,-616.4,-34.2,-615.5,-34.7,-614.7,-34.1,-614.0,-33.9,-613.3,-34.0,-612.6,-34.3,-611.7,-35.0,-610.9,-34.3,-610.0,-34.2,-609.9,-34.7,-608.9,-34.8,-608.2,-35.0,-607.7,-35.5,-607.3,-36.1,-607.2,-36.9,-607.3,-37.5,-607.6,-38.1,-608.1,-38.6,-608.8,-38.9,-609.8,-39.0,-609.9,-39.6,-610.8,-39.5,-611.7,-38.8,-612.5,-39.6,-613.2,-39.9,-613.9,-40.0,-614.6,-39.8,-615.4,-39.3,-616.3,-39.8,-616.8,-39.9], // w1177026763
    [-588.5,-37.7,-590.2,-37.6,-591.3,-37.0,-591.6,-35.7,-590.9,-34.5,-589.7,-34.0,-588.4,-32.8,-586.1,-32.9,-584.7,-33.5,-582.9,-33.3,-580.2,-32.4,-577.4,-32.0,-574.4,-32.4,-572.5,-32.8,-570.7,-32.2,-566.9,-31.5,-565.8,-32.2,-564.4,-32.9,-563.8,-34.1,-564.2,-35.4,-565.2,-36.0,-566.8,-36.9,-569.8,-36.8,-571.4,-36.3,-573.2,-36.5,-575.6,-37.6,-578.0,-37.9,-581.3,-37.4,-583.7,-37.3,-585.1,-37.9,-588.1,-38.6], // w1177042949
    [-546.0,-34.7,-546.4,-34.8,-547.1,-34.9,-547.8,-34.7,-548.4,-34.3,-548.8,-33.8,-549.1,-33.1,-549.1,-32.4,-548.9,-31.7,-548.4,-31.2,-547.9,-30.8,-546.9,-30.5,-546.8,-29.8,-545.5,-29.7,-544.6,-30.2,-543.8,-29.6,-543.1,-29.4,-542.4,-29.4,-541.7,-29.7,-540.8,-30.4,-540.0,-29.7,-539.1,-29.6,-539.0,-30.1,-538.0,-30.2,-537.3,-30.5,-536.8,-31.0,-536.4,-31.6,-536.3,-32.3,-536.4,-32.9,-536.7,-33.6,-537.2,-34.1,-537.9,-34.4,-538.9,-34.5,-539.0,-35.0,-539.9,-35.0,-540.8,-34.3,-541.6,-35.0,-542.3,-35.4,-543.0,-35.4,-543.7,-35.3,-544.5,-34.7,-545.4,-35.3,-545.9,-35.3], // w1177026760
    [-517.4,-32.9,-519.1,-32.9,-520.2,-32.3,-520.5,-30.9,-519.8,-29.7,-518.6,-29.3,-517.3,-28.0,-515.0,-28.1,-513.6,-28.8,-511.8,-28.5,-509.1,-27.7,-506.3,-27.3,-503.3,-27.7,-501.4,-28.0,-499.6,-27.4,-495.8,-26.7,-494.7,-27.5,-493.3,-28.1,-492.7,-29.4,-492.9,-30.2,-493.5,-31.1,-495.1,-31.3,-498.3,-32.5,-499.5,-31.7,-501.2,-31.6,-503.3,-32.4,-505.8,-33.2,-508.7,-33.1,-511.4,-32.5,-513.2,-32.8,-514.5,-33.7], // w1177042946
    [-474.3,-30.4,-474.8,-30.5,-475.5,-30.5,-476.1,-30.4,-476.8,-30.0,-477.2,-29.4,-477.4,-28.8,-477.4,-28.1,-477.2,-27.4,-476.8,-26.8,-476.2,-26.4,-475.3,-26.1,-475.1,-25.4,-473.8,-25.3,-473.0,-25.8,-472.1,-25.2,-471.4,-25.0,-470.7,-25.1,-470.0,-25.3,-469.2,-26.1,-468.3,-25.4,-467.5,-25.3,-467.3,-25.8,-466.3,-25.9,-465.6,-26.1,-465.1,-26.6,-464.7,-27.3,-464.7,-28.0,-464.7,-28.6,-465.1,-29.2,-465.6,-29.7,-466.3,-30.0,-467.2,-30.1,-467.4,-30.7,-468.2,-30.6,-469.1,-29.9,-469.9,-30.7,-470.6,-31.0,-471.3,-31.1,-472.0,-30.9,-472.9,-30.4,-473.7,-30.9,-474.2,-30.9], // w1177023237
    [-445.1,-28.2,-446.8,-28.2,-447.9,-27.6,-448.2,-26.1,-447.5,-25.0,-446.3,-24.5,-445.0,-23.3,-442.7,-23.4,-441.3,-24.1,-439.5,-23.8,-436.8,-22.9,-434.0,-22.5,-431.0,-23.0,-429.1,-23.3,-427.3,-22.7,-423.5,-22.0,-422.4,-22.8,-421.0,-23.4,-420.4,-24.7,-420.6,-25.5,-421.2,-26.4,-422.8,-26.6,-426.0,-27.8,-427.2,-26.9,-428.9,-26.9,-431.0,-27.6,-433.5,-28.5,-436.4,-28.4,-439.1,-27.7,-440.9,-28.1,-442.2,-29.0], // w1177042943
    [-401.4,-25.5,-401.8,-25.6,-402.5,-25.7,-403.2,-25.5,-403.8,-25.1,-404.2,-24.6,-404.4,-23.9,-404.5,-23.2,-404.2,-22.5,-403.8,-22.0,-403.3,-21.6,-402.3,-21.3,-402.2,-20.6,-400.8,-20.5,-400.0,-21.0,-399.1,-20.4,-398.5,-20.2,-397.7,-20.2,-397.1,-20.5,-396.2,-21.2,-395.4,-20.5,-394.5,-20.4,-394.3,-20.9,-393.4,-21.0,-392.7,-21.3,-392.1,-21.8,-391.8,-22.4,-391.7,-23.1,-391.8,-23.7,-392.1,-24.4,-392.6,-24.9,-393.3,-25.2,-394.3,-25.3,-394.4,-25.8,-395.3,-25.8,-396.2,-25.1,-397.0,-25.8,-397.6,-26.2,-398.4,-26.2,-399.0,-26.0,-399.9,-25.5,-400.8,-26.1,-401.3,-26.1], // w1177023234
    [-371.9,-23.5,-373.6,-23.5,-374.7,-22.9,-375.0,-21.5,-374.3,-20.4,-373.1,-19.9,-371.8,-18.7,-369.5,-18.7,-368.0,-19.4,-366.2,-19.2,-363.6,-18.3,-360.8,-17.9,-357.8,-18.3,-355.9,-18.7,-354.1,-18.1,-350.3,-17.3,-349.2,-18.1,-347.8,-18.8,-347.2,-20.0,-347.4,-20.9,-348.0,-21.7,-349.6,-21.9,-352.8,-23.1,-353.9,-22.3,-355.7,-22.2,-357.8,-23.0,-360.3,-23.8,-363.2,-23.7,-365.9,-23.1,-367.7,-23.4,-369.0,-24.3], // w1177038230
    [-328.7,-20.7,-329.1,-20.8,-329.8,-20.9,-330.5,-20.7,-331.1,-20.3,-331.5,-19.8,-331.8,-19.1,-331.8,-18.4,-331.6,-17.8,-331.2,-17.2,-330.6,-16.8,-329.6,-16.5,-329.5,-15.8,-328.2,-15.7,-327.3,-16.2,-326.5,-15.6,-325.8,-15.4,-325.1,-15.4,-324.4,-15.7,-323.6,-16.5,-322.7,-15.7,-321.8,-15.6,-321.7,-16.2,-320.7,-16.2,-320.0,-16.5,-319.5,-17.0,-319.1,-17.6,-319.0,-18.4,-319.1,-18.9,-319.4,-19.6,-320.0,-20.1,-320.6,-20.4,-321.6,-20.5,-321.7,-21.0,-322.6,-21.0,-323.5,-20.3,-324.3,-21.1,-325.0,-21.4,-325.7,-21.4,-326.4,-21.3,-327.3,-20.7,-328.1,-21.3,-328.6,-21.3], // w1177023231
    [-299.2,-19.1,-300.8,-19.0,-301.9,-18.4,-302.2,-17.0,-301.6,-15.9,-300.4,-15.4,-299.0,-14.2,-296.7,-14.3,-295.3,-14.9,-293.5,-14.7,-290.8,-13.8,-288.0,-13.4,-285.1,-13.8,-283.1,-14.2,-281.3,-13.6,-277.6,-12.9,-276.5,-13.6,-275.0,-14.3,-274.5,-15.6,-274.6,-16.4,-275.3,-17.3,-276.8,-17.5,-280.1,-18.6,-281.2,-17.8,-283.0,-17.7,-285.1,-18.5,-287.5,-19.3,-290.5,-19.2,-293.1,-18.6,-294.9,-19.0,-296.3,-19.8], // w1177038227
    [-256.3,-16.4,-256.7,-16.5,-257.4,-16.6,-258.1,-16.4,-258.7,-16.0,-259.1,-15.5,-259.3,-14.8,-259.4,-14.1,-259.1,-13.4,-258.7,-12.9,-258.2,-12.5,-257.2,-12.2,-257.0,-11.5,-255.7,-11.4,-254.9,-11.8,-254.0,-11.3,-253.4,-11.1,-252.6,-11.1,-251.9,-11.4,-251.1,-12.1,-250.3,-11.4,-249.4,-11.3,-249.2,-11.8,-248.3,-11.9,-247.6,-12.2,-247.0,-12.7,-246.7,-13.3,-246.6,-14.0,-246.6,-14.6,-247.0,-15.3,-247.5,-15.8,-248.2,-16.1,-249.2,-16.2,-249.3,-16.7,-250.2,-16.7,-251.1,-16.0,-251.9,-16.7,-252.5,-17.1,-253.3,-17.1,-253.9,-16.9,-254.8,-16.4,-255.7,-17.0,-256.2,-17.0], // w1177023228
    [-227.0,-14.1,-228.6,-14.1,-229.7,-13.5,-230.0,-12.0,-229.4,-10.9,-228.2,-10.4,-226.8,-9.2,-224.5,-9.3,-223.1,-10.0,-221.3,-9.7,-218.6,-8.8,-215.8,-8.4,-212.8,-8.9,-210.9,-9.2,-209.1,-8.6,-205.4,-7.9,-204.2,-8.7,-202.8,-9.3,-202.3,-10.6,-202.4,-11.4,-203.1,-12.3,-204.6,-12.5,-207.8,-13.7,-209.0,-12.8,-210.8,-12.8,-212.8,-13.5,-215.3,-14.3,-218.3,-14.2,-220.9,-13.6,-222.7,-14.0,-224.0,-14.9], // w1177038224
    [-183.7,-11.5,-184.1,-11.6,-184.9,-11.6,-185.5,-11.5,-186.1,-11.1,-186.6,-10.5,-186.8,-9.9,-186.8,-9.2,-186.6,-8.5,-186.2,-7.9,-185.6,-7.5,-184.6,-7.2,-184.5,-6.5,-183.2,-6.4,-182.4,-6.9,-181.5,-6.3,-180.8,-6.1,-180.1,-6.2,-179.4,-6.4,-178.6,-7.2,-177.7,-6.5,-176.8,-6.4,-176.7,-6.9,-175.7,-7.0,-175.0,-7.2,-174.5,-7.7,-174.1,-8.4,-174.0,-9.1,-174.1,-9.7,-174.5,-10.3,-175.0,-10.8,-175.6,-11.1,-176.6,-11.2,-176.7,-11.8,-177.6,-11.7,-178.5,-11.0,-179.3,-11.8,-180.0,-12.1,-180.7,-12.2,-181.4,-12.0,-182.3,-11.5,-183.1,-12.0,-183.6,-12.0], // w1177023225
    [-100.5,-35.7,-101.0,-35.4,-101.5,-34.8,-101.6,-34.4,-102.0,-30.7,-102.1,-26.7,-102.2,-25.0,-101.8,-23.6,-101.1,-22.8,-100.3,-22.2,-99.5,-21.8,-98.6,-21.7,-75.8,-20.1,-75.3,-20.8,-74.8,-21.4,-74.2,-21.7,-73.5,-22.0,-72.6,-22.1,-71.6,-36.6,-98.9,-35.7,-99.7,-35.7], // w1176581103
    [-98.3,-6.6,-101.2,-5.9,-102.8,-5.8,-103.9,-5.2,-104.2,-3.8,-103.6,-2.7,-102.4,-2.2,-101.0,-1.0,-98.7,-1.0,-97.3,-1.7,-95.5,-1.5,-92.8,-0.6,-90.0,-0.2,-87.1,-0.6,-85.1,-1.0,-83.3,-0.4,-79.6,0.3,-78.4,-0.4,-77.0,-1.1,-76.5,-2.3,-76.6,-3.2,-77.3,-4.0,-78.6,-4.3,-81.9,-5.3,-83.2,-4.5,-85.8,-4.7,-88.2,-5.8,-90.7,-6.1,-94.0,-5.6,-96.3,-5.5,-97.8,-6.1], // w1177667553
    [-78.8,15.5,-101.7,13.7,-102.3,13.7,-103.0,13.9,-103.5,14.2,-104.2,14.7,-104.7,15.3,-104.9,15.9,-105.1,16.4,-105.7,22.9,-106.0,26.6,-106.0,27.1,-105.6,27.8,-105.2,28.1,-104.3,28.3,-103.5,28.4,-76.7,32.8,-76.3,25.4,-75.9,18.4,-76.5,18.0,-77.4,17.4,-78.2,16.6], // w1128204284
    [-71.2,16.8,-71.0,16.3,-58.0,17.3,-55.3,18.0,-53.2,18.6,-50.6,19.9,-48.6,21.2,-47.2,22.7,-45.9,24.4,-44.9,26.2,-43.9,28.0,-42.4,29.8,-40.5,31.8,-41.3,32.5,-41.1,32.7,-46.8,37.8,-48.2,36.2,-53.1,40.6,-51.7,42.2,-57.7,47.4,-57.8,47.2,-58.4,47.7,-61.1,44.0,-63.0,41.3,-64.0,39.8,-64.5,38.9,-66.0,36.9,-67.4,35.4,-68.3,34.8,-69.3,34.2,-70.9,33.5,-72.2,33.4,-73.5,33.2,-74.6,33.0,-73.8,18.6,-72.2,17.8,-71.6,17.3], // w1128204285
    [-69.5,-36.5,-70.5,-22.3,-69.7,-21.9,-69.0,-21.4,-68.1,-20.4,-67.8,-19.6,-53.8,-18.7,-51.5,-19.0,-49.2,-19.7,-47.1,-20.6,-44.8,-22.2,-43.2,-23.7,-40.8,-26.3,-36.1,-31.4,-36.6,-31.9,-36.2,-32.3,-41.3,-38.1,-42.8,-36.8,-47.1,-41.7,-45.7,-43.0,-50.9,-48.9,-51.3,-48.5,-51.8,-48.9,-57.1,-42.4,-60.8,-37.8,-61.5,-37.1,-62.4,-36.6,-63.1,-36.5,-64.3,-36.5], // w1176591248
    [-62.3,-3.3,-62.7,-3.4,-63.4,-3.4,-64.1,-3.3,-64.7,-2.9,-65.1,-2.3,-65.3,-1.7,-65.4,-1.0,-65.1,-0.3,-64.7,0.3,-64.2,0.7,-63.2,0.9,-63.0,1.7,-61.7,1.8,-60.9,1.3,-60.0,1.8,-59.3,2.0,-58.6,2.0,-57.9,1.7,-57.1,1.0,-56.3,1.7,-55.4,1.8,-55.2,1.3,-54.3,1.2,-53.6,1.0,-53.0,0.5,-52.7,-0.2,-52.6,-0.9,-52.6,-1.5,-53.0,-2.1,-53.5,-2.6,-54.2,-2.9,-55.2,-3.1,-55.3,-3.6,-56.2,-3.5,-57.1,-2.9,-57.9,-3.6,-58.5,-3.9,-59.3,-4.0,-59.9,-3.8,-60.8,-3.3,-61.7,-3.8,-62.2,-3.9], // w1176969066
    [-48.7,-51.7,-48.4,-51.3,-48.6,-51.1,-43.3,-45.1,-41.8,-46.4,-37.5,-41.6,-38.9,-40.3,-33.9,-34.7,-33.5,-35.0,-32.9,-34.3,-30.0,-36.5,-25.7,-39.1,-23.0,-40.5,-20.7,-41.6,-18.1,-42.5,-16.3,-43.1,-12.6,-43.9,-8.7,-44.4,-4.8,-44.6,-2.9,-44.6,-1.5,-44.6,0.0,-67.6,-0.7,-67.6,-4.7,-67.6,-9.7,-67.4,-14.3,-66.7,-17.0,-66.2,-19.2,-65.8,-23.2,-64.8,-25.8,-64.1,-30.0,-62.6,-33.2,-61.2,-37.4,-59.1,-41.2,-56.9,-44.7,-54.6,-47.3,-52.8], // w1128204292
    [-38.8,35.0,-44.7,40.2,-43.3,41.8,-48.1,46.2,-49.5,44.7,-55.5,49.9,-55.3,50.1,-56.0,50.8,-52.8,53.8,-49.6,56.4,-45.9,59.3,-41.7,62.2,-38.0,64.5,-32.4,67.2,-27.9,69.0,-22.5,70.7,-17.1,72.1,-9.7,73.4,-8.1,49.2,-9.0,49.1,-11.2,49.0,-12.8,48.9,-14.8,48.5,-17.6,47.7,-20.2,46.9,-22.9,45.7,-26.2,44.1,-28.9,42.5,-30.6,41.3,-32.4,40.0,-35.6,37.2,-38.0,34.8,-38.5,35.2], // w1128204286
    [-5.9,50.2,-5.8,49.3,-1.7,49.4,3.2,49.0,7.3,48.2,12.0,46.7,16.0,45.0,19.2,43.4,23.6,40.9,25.3,39.6,26.0,38.9,26.8,39.9,27.2,39.6,31.8,45.4,30.3,46.7,34.6,51.8,36.2,50.4,40.8,56.3,40.5,56.6,40.9,57.1,38.4,59.2,35.3,61.6,31.9,63.6,28.9,65.1,24.1,67.3,19.2,69.1,15.2,70.5,11.4,71.6,4.6,73.2,-2.4,73.5,-7.4,73.7], // w1128204287
    [2.2,-67.5,8.1,-66.5,12.7,-65.7,17.6,-64.4,21.5,-63.0,25.9,-61.0,30.6,-58.5,35.2,-55.8,39.4,-52.9,42.7,-50.0,45.6,-47.6,48.2,-45.4,47.5,-44.8,47.8,-44.5,41.9,-39.4,40.7,-40.8,35.7,-36.5,37.0,-35.0,31.2,-29.9,31.0,-30.2,30.5,-29.8,28.4,-32.0,26.0,-34.2,22.6,-36.8,19.4,-38.8,14.8,-41.0,11.0,-42.4,7.5,-43.6,4.2,-44.2,0.6,-44.5], // w1128204293
    [48.1,3.9,47.7,3.8,47.0,3.8,46.3,3.9,45.7,4.3,45.2,4.9,45.0,5.5,45.0,6.2,45.2,6.9,45.6,7.5,46.2,7.9,47.2,8.1,47.3,8.9,48.6,9.0,49.5,8.5,50.3,9.1,51.0,9.3,51.7,9.2,52.4,8.9,53.2,8.2,54.1,8.9,55.0,9.0,55.1,8.5,56.1,8.4,56.8,8.2,57.3,7.7,57.7,7.0,57.8,6.3,57.7,5.7,57.4,5.1,56.8,4.6,56.2,4.3,55.2,4.2,55.1,3.6,54.2,3.7,53.3,4.4,52.5,3.6,51.8,3.3,51.1,3.2,50.4,3.4,49.5,3.9,48.7,3.4,48.2,3.3], // w1176969064
    [50.0,-42.5,44.1,-37.0,45.4,-35.5,40.5,-31.2,39.2,-32.6,33.3,-27.4,33.5,-27.2,33.0,-26.7,34.8,-24.0,36.6,-21.3,38.2,-19.0,40.0,-16.6,41.7,-15.1,43.1,-14.2,44.8,-13.2,47.5,-12.4,51.1,-11.7,53.7,-11.5,62.8,-10.8,62.9,-11.3,63.1,-11.9,63.9,-12.6,64.8,-13.2,65.7,-13.5,66.4,-28.1,62.5,-28.3,60.9,-28.5,59.9,-28.9,59.1,-29.4,58.3,-30.4,57.6,-31.6,56.0,-34.2,53.9,-37.3,52.1,-39.9,50.4,-42.5,50.2,-42.2], // w1176632036
    [60.3,24.6,52.3,24.1,48.0,23.8,43.9,24.0,42.2,24.5,39.9,25.4,37.8,26.9,35.7,28.7,33.7,30.8,31.8,33.2,28.8,36.3,29.7,37.2,29.5,37.4,34.3,43.2,35.8,41.9,40.0,47.0,38.6,48.2,43.3,54.3,43.5,54.2,43.7,54.5,49.3,48.8,52.1,45.2,53.6,44.0,55.4,42.7,57.0,41.9,58.3,41.6,60.2,41.5,62.0,41.5,62.9,27.6,61.9,26.9,61.1,26.2,60.7,25.4], // w1128204288
    [64.2,41.6,95.6,41.2,96.2,40.9,96.6,40.4,96.8,39.9,96.8,34.8,96.8,29.5,96.6,28.7,96.1,28.0,95.3,27.4,94.2,26.8,92.8,26.5,68.5,25.1,68.2,25.8,67.6,26.5,67.0,27.1,66.1,27.6,65.3,27.7], // w1128204289
    [68.6,-27.8,67.9,-13.3,68.6,-13.0,69.5,-12.2,70.0,-11.4,70.3,-10.5,91.4,-9.2,92.7,-9.6,93.6,-10.0,94.4,-10.6,94.9,-11.4,95.1,-12.1,95.1,-12.9,94.9,-15.9,94.6,-22.0,94.4,-22.6,93.6,-23.0], // w1176632037
    [71.6,5.7,70.0,5.7,68.9,6.3,68.6,7.8,69.2,8.9,70.4,9.4,71.8,10.6,74.1,10.5,75.5,9.8,77.3,10.1,80.0,11.0,82.8,11.4,85.7,10.9,87.7,10.6,89.5,11.2,93.2,11.9,94.3,11.1,95.8,10.5,96.3,9.2,96.2,8.4,95.5,7.5,94.0,7.3,90.7,6.1,89.6,7.0,87.8,7.0,85.7,6.3,83.3,5.5,80.3,5.6,77.7,6.2,75.9,5.8,74.6,4.9], // w1176969065
    [151.9,9.8,151.5,9.7,150.7,9.7,150.1,9.8,149.5,10.2,149.0,10.8,148.8,11.4,148.8,12.1,149.0,12.8,149.4,13.4,150.0,13.7,151.0,14.0,151.1,14.8,152.4,14.9,153.2,14.4,154.1,14.9,154.8,15.1,155.5,15.1,156.2,14.8,157.0,14.1,157.9,14.8,158.8,14.9,158.9,14.4,159.9,14.3,160.6,14.0,161.1,13.6,161.5,12.9,161.5,12.2,161.5,11.6,161.1,11.0,160.6,10.4,160.0,10.1,159.0,10.0,158.9,9.5,158.0,9.6,157.1,10.3,156.3,9.5,155.6,9.2,154.9,9.1,154.2,9.3,153.3,9.8,152.5,9.3,152.0,9.2], // w1177026767
    [188.9,12.4,187.2,12.4,186.2,13.0,185.9,14.5,186.5,15.6,187.7,16.1,189.0,17.3,191.4,17.2,192.8,16.5,194.6,16.8,197.2,17.7,200.1,18.1,203.0,17.6,204.9,17.3,206.7,17.9,210.5,18.6,211.6,17.8,213.0,17.2,213.6,15.9,213.4,15.1,212.8,14.2,211.3,14.0,208.0,12.8,206.9,13.7,205.1,13.7,203.0,13.0,200.6,12.2,197.6,12.3,195.0,12.9,193.1,12.5,191.8,11.6], // w1177038207
    [241.1,15.7,240.7,15.6,239.9,15.6,239.3,15.7,238.7,16.1,238.2,16.7,238.0,17.3,238.0,18.0,238.2,18.7,238.6,19.3,239.2,19.6,240.1,19.9,240.3,20.7,241.6,20.8,242.4,20.3,243.3,20.8,244.0,21.0,244.7,21.0,245.4,20.7,246.2,20.0,247.1,20.7,248.0,20.8,248.1,20.3,249.1,20.2,249.8,19.9,250.3,19.5,250.7,18.8,250.7,18.1,250.7,17.5,250.3,16.9,249.8,16.3,249.2,16.0,248.2,15.9,248.1,15.4,247.2,15.5,246.3,16.2,245.5,15.4,244.8,15.1,244.1,15.0,243.4,15.2,242.5,15.7,241.7,15.2,241.2,15.1], // w1177026770
    [281.7,19.0,280.1,19.0,279.0,19.6,278.7,21.0,279.4,22.2,280.6,22.6,281.9,23.9,284.2,23.8,285.6,23.1,287.4,23.4,290.1,24.2,292.9,24.6,295.9,24.2,297.8,23.9,299.6,24.5,303.4,25.2,304.5,24.4,305.9,23.8,306.4,22.5,306.3,21.7,305.6,20.8,304.1,20.6,300.9,19.4,299.7,20.2,297.9,20.3,295.9,19.5,293.4,18.7,290.4,18.8,287.8,19.4,286.0,19.1,284.7,18.2], // w1177038210
    [334.8,21.8,334.4,21.7,333.7,21.7,333.0,21.8,332.4,22.2,332.0,22.8,331.7,23.4,331.7,24.1,331.9,24.8,332.4,25.4,332.9,25.8,333.9,26.0,334.0,26.8,335.3,26.9,336.2,26.4,337.0,27.0,337.7,27.2,338.4,27.1,339.1,26.8,340.0,26.1,340.8,26.8,341.7,26.9,341.9,26.4,342.8,26.3,343.5,26.1,344.0,25.6,344.4,24.9,344.5,24.2,344.4,23.6,344.1,23.0,343.6,22.5,342.9,22.2,341.9,22.1,341.8,21.5,340.9,21.6,340.0,22.3,339.2,21.5,338.5,21.2,337.8,21.1,337.1,21.3,336.3,21.8,335.4,21.3,334.9,21.2], // w1177038202
    [372.8,24.6,371.1,24.6,370.0,25.2,369.7,26.7,370.4,27.8,371.6,28.3,372.9,29.5,375.2,29.4,376.6,28.7,378.4,29.0,381.1,29.9,383.9,30.3,386.9,29.8,388.8,29.5,390.6,30.1,394.4,30.8,395.5,30.0,396.9,29.4,397.5,28.1,397.3,27.3,396.6,26.4,395.1,26.2,391.9,25.0,390.7,25.9,388.9,25.9,386.9,25.2,384.4,24.3,381.5,24.4,378.8,25.1,377.0,24.7,375.7,23.8], // w1177038213
    [425.5,27.7,425.1,27.6,424.4,27.5,423.7,27.7,423.1,28.1,422.7,28.6,422.4,29.3,422.4,30.0,422.6,30.7,423.1,31.2,423.6,31.6,424.6,31.9,424.7,32.6,426.0,32.7,426.9,32.2,427.7,32.8,428.4,33.0,429.1,33.0,429.8,32.7,430.7,32.0,431.5,32.7,432.4,32.8,432.5,32.3,433.5,32.2,434.2,31.9,434.7,31.4,435.1,30.8,435.2,30.1,435.1,29.5,434.8,28.8,434.3,28.3,433.6,28.0,432.6,27.9,432.5,27.4,431.6,27.4,430.7,28.1,429.9,27.4,429.2,27.0,428.5,27.0,427.8,27.2,426.9,27.7,426.1,27.1,425.6,27.1], // w1177026776
    [463.8,29.9,462.1,29.9,461.1,30.5,460.8,32.0,461.4,33.1,462.6,33.6,464.0,34.8,466.3,34.7,467.7,34.0,469.5,34.3,472.2,35.2,475.0,35.6,477.9,35.1,479.9,34.8,481.7,35.4,485.4,36.1,486.5,35.3,488.0,34.7,488.5,33.4,488.4,32.6,487.7,31.7,486.2,31.5,482.9,30.3,481.8,31.2,480.0,31.2,477.9,30.5,475.5,29.7,472.5,29.8,469.9,30.4,468.1,30.0,466.7,29.1], // w1177038216
    [518.3,33.2,517.9,33.2,517.2,33.1,516.6,33.3,515.9,33.7,515.5,34.2,515.3,34.9,515.3,35.6,515.5,36.2,515.9,36.8,516.5,37.2,517.4,37.5,517.6,38.2,518.9,38.3,519.7,37.8,520.6,38.4,521.3,38.6,522.0,38.5,522.7,38.3,523.5,37.5,524.4,38.2,525.2,38.3,525.4,37.8,526.4,37.7,527.1,37.5,527.6,37.0,528.0,36.3,528.0,35.6,528.0,35.1,527.6,34.4,527.1,33.9,526.4,33.6,525.5,33.5,525.3,32.9,524.5,33.0,523.6,33.7,522.8,32.9,522.1,32.6,521.4,32.5,520.7,32.7,519.8,33.2,519.0,32.7,518.5,32.7], // w1177026773
    [558.8,36.1,557.1,36.1,556.1,36.7,555.8,38.1,556.4,39.3,557.6,39.7,558.9,41.0,561.3,40.9,562.7,40.2,564.5,40.5,567.1,41.4,570.0,41.8,572.9,41.3,574.8,41.0,576.6,41.6,580.4,42.3,581.5,41.5,582.9,40.9,583.5,39.6,583.3,38.8,582.7,37.9,581.2,37.7,577.9,36.5,576.8,37.3,575.0,37.4,572.9,36.6,570.5,35.8,567.5,35.9,564.9,36.5,563.0,36.2,561.7,35.3], // w1177038219
];
function bFountains(b) {
    const P = [], N = [], U = [], CO = [], J = [], I = [];
    const spray = rgb('#eef6fb');
    const add = (g, x, y, z, kind, seed, h) => {               // append a THREE geometry (local) to the jet buffers
        const base = P.length / 3, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
        for (let i = 0; i < pos.count; i++) { P.push(pos.getX(i) + x, pos.getY(i) + y, pos.getZ(i) + z); N.push(nor.getX(i), nor.getY(i), nor.getZ(i)); U.push(uv.getX(i), uv.getY(i)); CO.push(spray[0], spray[1], spray[2]); J.push(kind, seed, h); }
        const idx = g.index ? g.index.array : [...Array(pos.count).keys()];
        for (const k of idx) I.push(base + k);
        g.dispose();
    };
    let n = 0;
    const sa = (q) => { let A = 0; for (let i = 0; i < q.length; i++) { const [x1, z1] = q[i], [x2, z2] = q[(i + 1) % q.length]; A += x1 * z2 - x2 * z1; } return A; };
    const wind = Math.sign(sa(ellipse(0, 0, 2, 1, 8)));
    for (const flat of FOUNTAIN_RINGS) {
        const ring = []; for (let i = 0; i < flat.length; i += 2) ring.push([flat[i], flat[i + 1]]);
        if (Math.sign(sa(ring)) !== wind) ring.reverse();
        // principal axis + size of the real basin (OSM outline)
        let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length;
        let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of ring) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
        const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(ang), uz = Math.sin(ang);
        let lmin = 1e9, lmax = -1e9, wmax = 0; for (const [x, z] of ring) { const l = (x - cx) * ux + (z - cz) * uz, w = Math.abs(-(x - cx) * uz + (z - cz) * ux); lmin = Math.min(lmin, l); lmax = Math.max(lmax, l); wmax = Math.max(wmax, w); }
        const L = lmax - lmin, Wd = wmax * 2, plaza = Math.abs(cx) < 100 && Wd > 12;
        const outer = offset(ring, 0.35), inner = offset(ring, -0.35);
        b.ring(outer, 0, 0.6, '#a5a29b'); b.ring(inner, 0.35, 0.6, '#a5a29b', { inward: true }); b.lip(inner, outer, 0.6, '#b4b1a9', 1);   // granite kerb on the real outline
        b.ring(inner, 0.12, 0.35, '#8fb9bf', { inward: true });
        b.cap(inner, 0.12, '#6f8f93', [], 1);
        b.cap(inner, 0.35, '#4fb0c0', [], 1, 'fw');
        const jets = plaza ? [-L * 0.2, L * 0.2] : L > 22 ? [-L * 0.27, 0, L * 0.27] : [0];
        for (const j of jets) {
            const jx = cx + j * ux, jz = cz + j * uz, h = plaza ? (L > 40 ? 14 : 8) : L > 22 && j === 0 ? 9 : L > 22 ? 4 : 2.5;
            const seed = hash(++n), r0 = 0.08 + h * 0.01, r1 = 0.18 + h * 0.025, R = Math.min(0.6 + h * 0.16, Wd * 0.42, 3.2);
            add(new THREE.CylinderGeometry(r1, r0, h, 8, 1, true).translate(0, h / 2, 0), jx, 0.35, jz, 0, seed, h);
            const sk = [[0.05, h + 0.35], [R * 0.35, h * 0.98], [R * 0.7, h * 0.82], [R * 0.92, h * 0.55], [R, 0.05]].map(([a2, c]) => new THREE.Vector2(a2, c));
            add(new THREE.LatheGeometry(sk, 10), jx, 0.35, jz, 1, seed, h);
            add(new THREE.RingGeometry(0.05, R * 1.12, 16, 2).rotateX(-Math.PI / 2), jx, 0.37, jz, 2, seed, h);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(CO, 3));
    g.setAttribute('aJ', new THREE.Float32BufferAttribute(J, 3)); g.setIndex(I);
    g.computeBoundingSphere(); g.computeBoundingBox();
    const mesh = new THREE.Mesh(g, fountainMaterials().jet); mesh.name = 'fountain-jets'; mesh.renderOrder = 2;
    mesh.onBeforeRender = (r) => fountainTick(r);
    b.extras.push(mesh);
}

// Sky Tower (Floreasca City Center, 2012) — 137 m, 37 floors, tallest building in Romania (OSM way 219622660:
// height 137, levels 37, colour #3960DA). Lens/ellipse plan, blue glass with white floor-slab lines, the glass
// skin runs past the roof as a crown cut on a slant (≈ 125 -> 137 m), 3-level lobby podium.
// Src: https://en.wikipedia.org/wiki/Sky_Tower_(Bucharest) (137 m, 37 floors) ; OSM way 219622660 ; game/research/bucharest-floreasca.json landmarks[skytower]
function bSkyTower(b) {
    const [p] = P.skytower.map(pts), GL = '#4a7fa6', LN = '#c8d4e2';   // blue-green glass (research bucharest-floreasca: skytower)
    b.prism(offset(p, 3), 0, 9, '#2f3d4a', { mat: 'g', topCol: '#9aa6b0' });
    b.prism(p, 9, 125, GL, { mat: 'g', topCol: '#9fb3c2' });
    for (let y = 9 + 6.8; y < 124; y += 6.8) b.cornice(p, y, 0.3, 0.08, LN);          // every 2nd slab (budget)
    b.pilasters(p, 9, 125, 7, 0.25, 0.15, LN, {});
    // slanted crown: skin height varies linearly along x from 129 (west) to 137 (east)
    const bb = bbox([p]), top = (x) => 129 + 8 * (x - bb.x0) / (bb.x1 - bb.x0), s = signedArea(p) > 0 ? 1 : -1;
    for (let i = 0; i < p.length; i++) {
        const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length];
        b.quad([ax, 125, az], [bx, 125, bz], [bx, top(bx), bz], [ax, top(ax), az], '#6c8fc6', 'g', [s * (bz - az), 0, -s * (bx - ax)]);
        b.quad([bx, 125, bz], [ax, 125, az], [ax, top(ax), az], [bx, top(bx), bz], '#8ea9cf', 'g', [-s * (bz - az), 0, s * (bx - ax)]);   // inner face
    }
    b.cyl(5, 125, 0, 3, 3, 6, '#cfd5da', 8);
    b.colPoly([p], 15);
}

// Promenada Mall (2013, Floreasca) — 3 levels / 18 m (OSM way 240694437), glass + white fins, large planted
// roof terrace with pavilions, red "PROMENADA" lettering on the Calea Floreasca front.
// Src: https://en.wikipedia.org/wiki/Promenada_Mall ; OSM way 240694437
function bPromenada(b) {
    const [p] = P.promenada.map(pts);
    b.prism(p, 0, 18, '#eef0f0', { topCol: '#7da35b' });
    b.windows(p, 0.4, 17, 5.6, '#4f7088', { bay: 3.2, wf: 0.8, hf: 0.8, start: 0.4, mat: 'g', minL: 6 });
    b.cornice(p, 17.4, 0.9, 1.2, '#f6f7f7');
    b.prism(offset(p, -14), 18, 19.2, '#8db267'); b.prism(offset(p, -32), 19.2, 20.4, '#7da35b');
    for (const x of [-40, 0, 40]) b.prism(rect(x - 6, -6, x + 6, 6), 20.4, 24, '#e3e6e8', { topCol: '#c5ccd1' });
    const zf = zAt([p], 0)?.[1] ?? 50;
    b.text('PROMENADA', 0, 12.6, zf + 0.4, 0, 3.4, '#d8232a');
    b.colPoly([p], 25);
}

// Băneasa Shopping City (2008) — 3 levels / 22 m (OSM way 241256765); white-grey box with glass entrance
// pavilions, long skylight spine, "BĂNEASA SHOPPING CITY" signage on the DN1 front.
// Src: https://en.wikipedia.org/wiki/Băneasa_Shopping_City ; OSM way 241256765
function bBaneasaSC(b) {
    const [p] = P.baneasasc.map(pts);
    b.prism(p, 0, 20, '#dedad3', { topCol: '#bdb9b1' });
    b.windows(p, 0, 20, 6.6, '#56758c', { bay: 6, wf: 0.75, hf: 0.42, start: 0.5, mat: 'g', minL: 14, skip: (e, j, f) => f > 0 && j % 3 !== 1 });
    b.cornice(p, 19.4, 1.2, 0.6, '#ecebe7');
    b.box(0, 20, 0, 26, 3.2, 160, '#cfd6db', { mat: 'g' }); b.box(0, 23.2, 0, 10, 1.2, 160, '#dfe4e7', { mat: 'g' });
    const xf = xAt([p], 0)?.[1] ?? 60;
    b.box(xf + 2, 0, 0, 4, 22, 34, '#3e5f78', { mat: 'g' });
    b.text('BANEASA SHOPPING CITY', xf + 4.1, 15.5, 0, Math.PI / 2, 1.8, '#ffffff');
    b.colPoly([p], 25);
}

// Romexpo — Pavilionul Central (1962, Ascanio Damian et al.) — steel-lattice dome on a circular glazed ring,
// ≈ 93 m span / 34 m high (OSM way 23554160 outline Ø ≈ 125 m incl. the ring gallery). Ribs + lantern.
// Src: https://en.wikipedia.org/wiki/Romexpo ; OSM way 23554160
function bRomexpo(b) {
    const [p] = P.romexpo.map(pts);
    b.prism(p, 0, 9, '#dcd8ce', { topCol: '#c9c6bd' });
    b.windows(p, 0, 9, 9, '#4f6b80', { bay: 4, wf: 0.85, hf: 0.7, start: 1, mat: 'g', minL: 3 });
    b.cornice(p, 8.6, 0.8, 0.9, '#eceae4');
    const a = 50, H = 25, R = (a * a + H * H) / (2 * H), th = Math.asin(a / R);
    b.cyl(0, 9, 0, a + 0.5, a + 1, 1.2, '#e7e5df', 32);
    b.geo(new THREE.SphereGeometry(R, 36, 7, 0, Math.PI * 2, 0, th), '#b8c0c4', M(0, 10.2 + H - R, 0), 'g');
    for (let i = 0; i < 24; i++) {
        const ang = i / 24 * Math.PI * 2, pts3 = [];
        for (let k = 0; k <= 5; k++) { const t = th * (1 - k / 5), r = R * Math.sin(t) + 0.25; pts3.push([Math.cos(ang) * r, 10.2 + H - R + R * Math.cos(t) + 0.2, Math.sin(ang) * r]); }
        b.tube(pts3, 0.35, '#e8eaea', { seg: 6, radial: 3 });
    }
    b.cyl(0, 10.2 + H - 0.6, 0, 6, 7, 2.2, '#9aa3a6', 16, { mat: 'g' });
    b.text('ROMEXPO', 0, 3.4, 63.2, 0, 2.6, '#ffffff');
    b.col(0, 0, 45, 45);
}

// Monumentul Eroilor Aerului (1935, Lidia Kotzebue & Iosif Fekete) — ~20 m granite obelisk-pylon
// topped by bronze winged aviators, Piața Aviatorilor (OSM node 559876471).
// Src: https://ro.wikipedia.org/wiki/Monumentul_Eroilor_Aerului ; OSM node 559876471
function bAviatorilor(b) {
    b.box(0, 0, 0, 11, 1.2, 11, '#a39d92'); b.box(0, 1.2, 0, 7.5, 2.4, 7.5, '#b9b3a7');
    b.cyl(0, 3.6, 0, 1.2, 2.1, 14, '#c8c2b6', 4, { ry: Math.PI / 4 });
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; b.box(Math.cos(a) * 3, 3.6, Math.sin(a) * 3, 1, 2.6, 1, C.bronze); }
    b.box(0, 17.6, 0, 0.9, 3.2, 0.9, C.bronze);
    for (const s of [-1, 1]) b.box(0, 19.6, s * 2.1, 0.3, 0.6, 4.2, C.bronze, { rx: s * 0.45 });
    b.col(0, 0, 5.5, 5.5);
}

// Gara de Nord (1868-72, rebuilt 1930s-40s and 1990s) — OSM rel 18184857 parts: west head building 5 levels /
// 20 m (way 620595693), central hall 10 m (620595692) with skylight (620563443), north block 18 m over 14 m
// (620563447 / 8543), transverse concourse along the platform heads with a 10 m roof (570330518). Classical
// stucco fronts with tall arched windows, clock + "GARA DE NORD" on the head building, platform canopies
// over peroanele 1-13 (OSM railway=platform, shortened to 160 m).
// Src: https://en.wikipedia.org/wiki/București_Nord_railway_station ; OSM rel 18184857 parts
function bGara(b) {
    const S = '#e8dcc2', TR = '#ddd0b3', WIN = '#4f4a41';
    b.wall = S;
    const ps = P.gara.map(pts);
    // central hall + concourse
    b.prism(ps[1], 0, 11, S, { topCol: '#a9a39a' }); b.windows(ps[1], 0, 10.5, 10.5, WIN, { bay: 5.5, wf: 0.45, hf: 0.7, arch: true, minL: 8 });
    b.cornice(ps[1], 10.6, 0.7, 0.6, TR);
    b.prism(ps[2], 11, 13.5, '#9fb6c3', { mat: 'g' });                                          // skylight ridge
    b.prism(ps[0], 0, 10, S, { topCol: '#8d8a84' }); b.windows(ps[0], 0, 9.5, 9.5, WIN, { bay: 5, wf: 0.6, hf: 0.75, arch: true, minL: 6 });
    b.roof(ps[0], 10, 2.8, '#7d7a75', 1);
    // west head building: 4 storeys + attic, clock and sign
    storeys(b, ps[3], 0, [[6.2, 0.46, 0.7, true], [4.4, 0.42, 0.6, false], [4.2, 0.42, 0.58, false], [3.8, 0.4, 0.55, false]], { wall: S, win: WIN, trim: TR, bay: 4.2, courses: [0], pilasters: true, pilasterEvery: 2, corniceOut: 0.8, parapet: 1, minL: 5 });
    b.roof(ps[3], 19.6, 3, '#86827c', 1.6);
    // north block (18 m over the 14 m wing)
    storeys(b, ps[5], 0, [[5.5, 0.45, 0.66, true], [4.2, 0.42, 0.58, false], [4.2, 0.42, 0.58, false]], { wall: S, win: WIN, trim: TR, bay: 4.2, corniceOut: 0.7, minL: 5 });
    const nb = rect(29, -64, 81, -42); storeys(b, nb, 10, [[4, 0.42, 0.58, false], [4, 0.42, 0.58, false]], { wall: S, win: WIN, trim: TR, bay: 4.2, corniceOut: 0.7, minL: 5 });
    // main front on Piața Gării de Nord (north end, -z): arcaded porch, clock, lettering
    b.archWall(44, 9, 1.2, [-16, -8, 0, 8, 16].map(x => ({ x, w: 5.6, h: 7.4 })), TR, M(55, 0, -78.2));
    b.box(55, 9, -78.2, 44.6, 1, 1.6, S);
    b.cyl(55, 19.5, -78.7, 1.6, 1.6, 0.3, '#f4f1ea', 16, { rx: Math.PI / 2 }); b.cyl(55, 19.5, -78.9, 1.9, 1.9, 0.2, '#3a3a3a', 16, { rx: Math.PI / 2 });
    b.text('GARA DE NORD', 55, 15.2, -78.95, Math.PI, 1.8, '#2d3a4a');
    // platform canopies (thin roofs on posts) over the platforms north of the concourse
    for (const x of [10, 25, 40, 54.5, 68.5, 84, 96.5]) {
        b.box(x, 4.6, 165, 7.5, 0.3, 176, '#8a9196');
        for (let z = 85; z <= 245; z += 16) b.box(x, 0, z, 0.3, 4.6, 0.3, '#5d6468');
    }
    b.colPoly([ps[0], ps[1], ps[3], ps[5]], 20);
}

// Opera Națională București (1953, Octav Doicescu) — classicising, ~22 m with fly tower, columned
// portico towards Bd. Kogălniceanu (+z); OSM way 23556393.
// Src: https://en.wikipedia.org/wiki/Romanian_National_Opera,_Bucharest ; OSM way 23556393
function bOpera(b) {
    b.wall = '#e0cfb2';
    const [p] = P.opera.map(pts), S = '#e0cfb2';
    b.prism(p, 0, 21, S, { topCol: '#cdbd9f' }); b.bands(p, 0, 21, 5.2, '#5a4f43', { frac: 0.45 });
    b.box(0, 21, -38, 46, 13, 26, '#d4c3a6');
    const zf = zAt([p], 0)?.[1] ?? 58;
    b.box(0, 0, zf + 3, 34, 2, 10, C.stoneDk);
    b.colonnade(-14, zf + 5.5, 14, zf + 5.5, 2, 14, 6, 0.9, '#f2ece0', { capital: S });
    b.box(0, 16, zf + 3.5, 34, 2, 9, S); b.pediment(0, 18, zf + 3.5, 34, 5, 9, S);
    b.colPoly([p], 22);
}

// Hermes Business Campus (Pipera, 2009) — OSM: Clădirea A 9 levels (way 533147567), B+C with a courtyard
// (458259608) and the smaller building 231123137 (levels unmapped: 7 assumed). Blue-green curtain walls with
// white spandrel lines and aluminium fins, recessed glazed ground floors, rooftop plant boxes, "HERMES" sign.
// Src: https://www.openstreetmap.org/way/533147567 (Clădirea A, 9 levels)
function bHermes(b) {
    // (round 5) landlord/agency photos (esop.ro listing; viewed only, not kept): 9-10 storeys, alternating horizontal bands of
    // grey metal panels and green-tinted glass ribbons, some full-height green glass bays, double-height recessed glazed
    // ground floor on columns, rooftop plant screens.
    const ps = P.hermes.map(pts), H = [35, 27.5, 31.5];
    for (let i = 0; i < 3; i++) {
        const holes = i === 2 ? [ps[3]] : [];
        b.prism(offset(ps[i], -1), 0, 7, '#3f5d5a', { mat: 'g', top: false });                // recessed double-height glazed GF
        b.pilasters(ps[i], 0, 7, 8, 0.6, 0.6, '#9a9fa1', {});
        b.prism(ps[i], 7, H[i], '#8b9094', { holes, topCol: '#9aa4ab' });                       // grey metal panel bands…
        b.bands(ps[i], 7, H[i], 3.6, '#4d8a85', { frac: 0.55, off: 0.06, mat: 'g', start: 1.2, wall: null, holes });   // …and green glass ribbons
        b.pilasters(ps[i], 7, H[i], 9, 1.6, 0.08, '#3f7a74', { every: 3 });                     // full-height green glass bays
        b.cornice(ps[i], H[i], 1.1, 0.25, '#c9cdcf');
        b.prism(offset(ps[i], -6), H[i], H[i] + 3, '#b5bcc1');
    }
    b.text('HERMES', 35, 31, 57.9, 0, 2.4, '#ffffff');
    // Luxoft (2017 CV stop): lobby door on the Pompeiu (south) face of building A, campus name on the canopy, tenant plate
    entrance(b, nearestFacade(ps[0], 2, 89), { w: 3.6, h: 3.4, canopy: 2.6, canopyCol: '#e8ecef', canopyText: 'HERMES BUSINESS CAMPUS', canopyTextH: 0.16, canopyTextCol: '#2b4a63', plate: { w: 0.66, h: 0.36, y: 1.35, bg: '#ffffff', lines: [['LUXOFT', 0.12, '#2a3a8c'], ['A DXC COMPANY', 0.04, '#5b6b7a']] } });
    b.colPoly(ps.slice(0, 3), 20);
}

// Aeroportul Băneasa "Aurel Vlaicu" — 1952 terminal (Art-Deco / socialist classicism): three wings
// around a central rotunda with control tower; OSM way 28246549.
// Src: https://en.wikipedia.org/wiki/Aurel_Vlaicu_International_Airport ; OSM way 28246549
function bBaneasaTerm(b) {
    b.wall = '#ece2cc';
    const [p] = P.baneasaterm.map(pts), S = '#ece2cc';
    b.prism(p, 0, 9.5, S, { topCol: '#c9bfa9' }); b.bands(p, 0, 9.5, 4.6, '#4f5257', { frac: 0.45 });
    const [cx, cz] = centroid(p);
    b.cyl(cx, 0, cz, 15, 15, 15, S, 28); b.bands(ellipse(cx, cz, 15, 15, 28), 0, 15, 5, '#4f5257', { frac: 0.5 });
    b.cyl(cx, 15, cz, 15.6, 15.6, 1, '#d8cdb5', 28);
    b.cyl(cx, 16, cz, 6, 6.5, 9, S, 16);
    b.cyl(cx, 25, cz, 5.2, 4.6, 3.2, '#3c5668', 12, { mat: 'g' });
    b.cone(cx, 28.2, cz, 5.6, 2.4, '#8b8a86', 12); b.cyl(cx, 30.6, cz, 0.2, 0.2, 4, '#c33', 6);
    b.colPoly([p], 18);
}

// Aeroportul Henri Coandă (OTP) — ro.wikipedia "Aeroportul Internațional Henri Coandă": 1970 terminal (now
// Sosiri / arrivals, OSM way 771096081 year_of_construction 1970), Phase I departures + finger (1994-98),
// finger "Vioara" extended 2011 (OSM 771096083, 20 m part 1321861231), new Plecări hall opened 6 Nov 2012
// (OSM 771096082). Control cab: OSM way 794617342 aeroway=tower, 20-25 m (no official height published;
// a 1969 "Tehnica" article describes a 7-level tower on the terminal). Note the world squashes this model 0.35 N-S.
// Src: https://ro.wikipedia.org/wiki/Aeroportul_Internațional_Henri_Coandă ; OSM ways 771096081/82/83, 794617342
function bOTP(b) {
    const [dep, arr, pier] = P.otp.map(pts), GL = '#4f7690', WH = '#eef0f1', CON = '#d9d6cf';
    // 2012 departures hall: tall glass box under a thin overhanging roof, landside canopy + signage (+z front)
    b.prism(dep, 0, 19, GL, { mat: 'g', topCol: '#c6cbcf' });
    b.pilasters(dep, 0, 19, 6, 0.3, 0.4, '#d0d6da', {});
    for (const y of [6.5, 12.8]) b.cornice(dep, y, 0.4, 0.3, '#d0d6da');
    b.prism(offset(dep, 4), 19, 21, WH, { topCol: '#dfe2e4', bottom: true });
    b.box(-106, 13.4, 200.5, 190, 0.6, 9, WH);                                              // cantilevered canopy over the upper-level kerb
    b.text('HENRI COANDA', -106, 14.5, 196.6, 0, 2.6, '#ffffff', { mat: 'g' });
    b.text('PLECARI  DEPARTURES', -106, 10.2, 196.6, 0, 1.6, '#ffd84a', { mat: 'g' });
    // 1970 "T1" (Sosiri): two concrete levels, deep horizontal fascia, glazed ground floor
    b.prism(arr, 0, 14, CON, { topCol: '#c6cbcf' });
    b.prism(offset(arr, 0.05), 0.4, 5, '#3f5b6e', { mat: 'g', top: false });
    b.prism(offset(arr, 0.05), 7, 11, '#5d7e93', { mat: 'g', top: false });
    b.cornice(arr, 11.6, 2.4, 0.9, '#e7e5df'); b.cornice(arr, 5.2, 0.9, 1.6, '#e7e5df');
    b.text('SOSIRI  ARRIVALS', 158.5, 12.2, 195.6, 0, 1.6, '#2f3e4b');
    // link between departures and arrivals with the apron control cab on top (OSM 794617342: 20-25 m)
    b.prism(rect(-9, 150, 115, 175), 0, 12, '#c9ced2', { topCol: '#b8bdc1' }); b.windows(rect(-9, 150, 115, 175), 0, 12, 6, GL, { bay: 6, wf: 0.8, hf: 0.6, mat: 'g', minL: 10 });
    b.cyl(63, 12, 162, 3.2, 3.6, 8, CON, 10);
    b.cyl(63, 20, 162, 7.4, 6.2, 4.4, '#33505f', 10, { mat: 'g' }); b.cyl(63, 24.4, 162, 7.8, 7.8, 0.8, WH, 10);
    b.cyl(63, 25.2, 162, 0.2, 0.2, 5, '#d33', 6);
    // "Vioara" pier: curved glazed finger with a white roof shell + jet bridges
    b.prism(pier, 0, 13, '#6f91a8', { mat: 'g', topCol: '#e3e6e8' });
    b.pilasters(pier, 0, 13, 8, 0.25, 0.3, '#d6dde2', {});
    b.prism(offset(pier, 1.2), 13, 14.6, WH, { topCol: '#f2f3f4', bottom: true });
    b.prism(rect(-2, -180, 34, -14), 14.6, 20, '#e6e9ea', { topCol: '#d2d6d8' });         // 20 m spine (OSM 1321861231)
    const bb = bbox([pier]), px = bb.x1 + 30;
    for (const z of [-170, -150, -110, -90, -45, -25]) { b.box(bb.x1 + 9, 4, z, 18, 3, 3, '#c9ced2'); b.box(bb.x1 + 18.5, 0, z, 1, 4, 1, '#7a8187'); }
    airliner(b, px, -150, Math.PI, { tail: '#1d3f8f', stripe: '#1d3f8f' });        // TAROM
    airliner(b, px, -45, Math.PI, { tail: '#c6007e', belly: '#2b0f5c' });           // Wizz Air
    airliner(b, bb.x0 - 26, -120, 0, { tail: '#0b4ea2', stripe: '#0b4ea2' });       // Blue Air
    b.colPoly([dep], 25); b.colPoly([arr], 25); b.colPoly([pier], 12);
}

// ASE — Ion N. Angelescu: source rings r2274298 (2026-11-08), including its mapped rounded corner and four courts.
// Official facade/roof photographs: ase.ro/app/uploads/2023/02/ase-1.jpg and 2023/09/Cladire-ASE-panorama-600x500.jpg.
// Sources, estimates and remaining gaps: game/research/ase-landmark.json. No OSM height/level/roof tags exist here.
function bASE(b) {
    const [outer, ...holes] = P.ase.map(pts), S = '#d2cec2', TR = '#e5e1d5', GL = '#2b343b', MET = '#aab7bf';
    const bb = bbox([outer]), all = [outer, ...holes], s = signedArea(outer) > 0 ? 1 : -1;
    b.wall = S;
    b.prism(outer, 0, 22, S, { holes, top: false });
    // Keep the entire mapped complex and its courts. A zero suppression radius avoids erasing neighbouring campus buildings.
    // Absolute model-space rings (not collider-centred); buildLandmark/world transform these together with their bounds.
    b.cols.push({ x: (bb.x0 + bb.x1) / 2, z: (bb.z0 + bb.z1) / 2, hw: (bb.x1 - bb.x0) / 2, hd: (bb.z1 - bb.z0) / 2, angle: 0, h: 22, poly: outer, holes });
    const distance = (x, z) => {
        let d = Infinity;
        for (const p of all) for (let i = 0; i < p.length; i++) {
            const a = p[i], c = p[(i + 1) % p.length], dx = c[0] - a[0], dz = c[1] - a[1];
            const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
            d = Math.min(d, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
        }
        return d;
    };
    // Grey sheet-metal roof around the courts, red pitched roof on the long north-west wing (Esri aerial inspection).
    // Refined source triangulation gives slopes without an unsafe inset across the narrow court-side wings.
    const contour = outer.map(p => new THREE.Vector2(...p)), hs = holes.map(h => h.map(p => new THREE.Vector2(...p))), points = contour.concat(...hs);
    const roofPoint = p => [p[0], 22.03 + Math.min(3.1, distance(...p) * 0.62), p[1]];
    let roofPoints = points.map(p => [p.x, p.y]), roofFaces = THREE.ShapeUtils.triangulateShape(contour, hs);
    // Split shared edges together so neighbouring roof facets cannot acquire cracks or mismatched heights.
    for (let pass = 0; pass < 9; pass++) {
        const mids = new Map(), next = [];
        for (const f of roofFaces) for (let i = 0; i < 3; i++) {
            const a = f[i], c = f[(i + 1) % 3], key = a < c ? `${a},${c}` : `${c},${a}`;
            if (mids.has(key) || Math.hypot(roofPoints[a][0] - roofPoints[c][0], roofPoints[a][1] - roofPoints[c][1]) <= 4) continue;
            mids.set(key, roofPoints.length); roofPoints.push([(roofPoints[a][0] + roofPoints[c][0]) / 2, (roofPoints[a][1] + roofPoints[c][1]) / 2]);
        }
        if (!mids.size) break;
        for (const f of roofFaces) {
            const mid = f.map((a, i) => { const c = f[(i + 1) % 3]; return mids.get(a < c ? `${a},${c}` : `${c},${a}`); });
            const n = mid.filter(i => i !== undefined).length;
            if (!n) { next.push(f); continue; }
            if (n === 3) { next.push([f[0], mid[0], mid[2]], [mid[0], f[1], mid[1]], [mid[2], mid[1], f[2]], mid); continue; }
            const k = n === 1 ? mid.findIndex(i => i !== undefined) : mid.findIndex(i => i === undefined), a = f[k], c = f[(k + 1) % 3], d = f[(k + 2) % 3];
            if (n === 1) next.push([a, mid[k], d], [mid[k], c, d]);
            else { const u = mid[(k + 1) % 3], v = mid[(k + 2) % 3]; next.push([d, v, u], [a, c, v], [c, u, v]); }
        }
        roofFaces = next;
    }
    roofFaces = roofFaces.map(f => {
        const [a, c, d] = f.map(i => roofPoints[i]);
        return (c[1] - a[1]) * (d[0] - a[0]) - (c[0] - a[0]) * (d[1] - a[1]) < 0 ? [f[0], f[2], f[1]] : f;
    });
    const redFaces = [], silverFaces = [], seam = new Map();
    const clipRoof = (f, north) => {
        const q = [];
        for (let i = 0; i < f.length; i++) {
            const a = f[i], c = f[(i + 1) % f.length], u = roofPoints[a], v = roofPoints[c], inside = north ? u[1] <= -0.54 : u[1] >= -0.54, other = north ? v[1] <= -0.54 : v[1] >= -0.54;
            if (inside) q.push(a);
            if (inside !== other) {
                const key = a < c ? `${a},${c}` : `${c},${a}`;
                if (!seam.has(key)) { const t = (-0.54 - u[1]) / (v[1] - u[1]); seam.set(key, roofPoints.length); roofPoints.push([u[0] + (v[0] - u[0]) * t, -0.54]); }
                q.push(seam.get(key));
            }
        }
        const faces = north ? redFaces : silverFaces;
        for (let i = 1; i + 1 < q.length; i++) faces.push(q[0], q[i], q[i + 1]);
    };
    for (const f of roofFaces) { clipRoof(f, true); clipRoof(f, false); }
    const roofGeometry = new THREE.BufferGeometry();
    roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roofPoints.flatMap(roofPoint), 3));
    roofGeometry.setIndex([...redFaces, ...silverFaces]); roofGeometry.computeVertexNormals();
    // Shared vertex normals avoid a false corrugated appearance on the conservative continuous roof approximation.
    for (const [faces, col] of [[silverFaces, MET], [redFaces, '#a85649']]) { const g = roofGeometry.clone(); g.setIndex(faces); b.geo(g, col); g.dispose(); }
    roofGeometry.dispose();
    for (const [y, h, out] of [[0.1, 0.5, 0.13], [4.4, 0.35, 0.26], [16.5, 0.35, 0.4], [18.1, 0.65, 0.68], [21.8, 0.25, 0.3]]) b.cornice(outer, y, h, out, TR, { holes });
    // Plain rear/courtyard elevations remain a simplified treatment: no invented shops or interior programme.
    b.windows(outer, 0.6, 17, 5.4, GL, { bay: 3.9, wf: 0.39, hf: 0.6, start: 0.3, mat: 'g', edges: [0, 1, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28] });
    b.windows([outer[2], [-42.04, -1], outer[0], outer[1]], 0.7, 21.5, 5.3, GL, { bay: 3.8, wf: 0.42, hf: 0.62, start: 0.2, mat: 'g', edges: [0] });
    for (const h of holes) {
        b.windows(h, 0.6, 21.5, 5.3, GL, { bay: 3.7, wf: 0.42, hf: 0.58, start: 0.4, mat: 'g', inward: true });
        b.cornice(h, 16.8, 0.25, -0.2, TR);
    }
    // Street elevations: rusticated base, giant engaged columns across the two upper levels, entablature, attic windows.
    const window = (x, z, dx, dz, nx, nz, y, w, h, arch = false) => {
        const T = (u, v, off) => [x + dx * u + nx * off, y + v, z + dz * u + nz * off];
        const pane = (ww, hh, off, col, mat) => {
            const r = ww / 2, spring = arch ? hh - r : hh;
            b.quad(T(-r, 0, off), T(r, 0, off), T(r, spring, off), T(-r, spring, off), col, mat, [nx, 0, nz]);
            if (arch) for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 8, c = (i + 1) * Math.PI / 8;
                b.tri(T(0, spring, off), T(Math.cos(a) * r, spring + Math.sin(a) * r, off), T(Math.cos(c) * r, spring + Math.sin(c) * r, off), col, mat, [nx, 0, nz]);
            }
        };
        pane(w + 0.3, h + 0.15, 0.09, '#68564a', 'm'); pane(w, h, 0.12, GL, 'g');
        b.quad(T(-0.035, 0, 0.14), T(0.035, 0, 0.14), T(0.035, h, 0.14), T(-0.035, h, 0.14), '#655344', 'm', [nx, 0, nz]);
        for (const yy of [h * 0.3, h * 0.76]) b.quad(T(-w / 2, yy, 0.14), T(w / 2, yy, 0.14), T(w / 2, yy + 0.06, 0.14), T(-w / 2, yy + 0.06, 0.14), '#655344', 'm', [nx, 0, nz]);
        b.strut(T(-w / 2 - 0.25, -0.16, 0.12), T(w / 2 + 0.25, -0.16, 0.12), 0.26, 0.18, TR);
    };
    const facade = (line, bays, columns = true) => {
        const ls = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1])), length = ls.reduce((a, c) => a + c, 0);
        const at = t => {
            let d = Math.min(length - 0.001, Math.max(0.001, t * length)), i = 0;
            while (i + 1 < ls.length && d > ls[i]) d -= ls[i++];
            const a = line[i], c = line[i + 1], dx = (c[0] - a[0]) / ls[i], dz = (c[1] - a[1]) / ls[i];
            return { x: a[0] + dx * d, z: a[1] + dz * d, dx, dz, nx: s * dz, nz: -s * dx };
        };
        for (let j = 0; j < bays; j++) {
            const q = at((j + 0.5) / bays), w = Math.min(1.85, length / bays * 0.48);
            window(q.x, q.z, q.dx, q.dz, q.nx, q.nz, 0.85, w, 3.1);
            window(q.x, q.z, q.dx, q.dz, q.nx, q.nz, 5.35, w, 4.8, true);
            window(q.x, q.z, q.dx, q.dz, q.nx, q.nz, 11.6, w, 3.6);
            window(q.x, q.z, q.dx, q.dz, q.nx, q.nz, 19.1, w * 0.82, 2.25);
            const ry = -Math.atan2(q.dz, q.dx);
            b.box(q.x + q.nx * 0.16, 15.3, q.z + q.nz * 0.16, w + 0.65, 0.23, 0.35, TR, { ry });
            b.box(q.x + q.nx * 0.16, 21.4, q.z + q.nz * 0.16, w + 0.55, 0.2, 0.34, TR, { ry });
            for (let k = 0; k < 4; k++) {
                const t = (k / 3 - 0.5) * w, x = q.x + q.dx * t + q.nx * 0.28, z = q.z + q.dz * t + q.nz * 0.28;
                b.box(x, 4.72, z, 0.09, 0.54, 0.09, TR);
            }
        }
        if (columns) for (let j = 0; j <= bays; j++) {
            const q = at(j / bays), x = q.x + q.nx * 0.24, z = q.z + q.nz * 0.24;
            b.cyl(x, 4.9, z, 0.54, 0.64, 11.2, TR, 10);
            b.cyl(x, 4.62, z, 0.77, 0.77, 0.28, TR, 10); b.cyl(x, 16.1, z, 0.77, 0.62, 0.4, TR, 10);
        }
    };
    facade([[-42.04, -1], outer[3]], 8);
    facade(outer.slice(3, 12), 4);
    facade(outer.slice(11, 19), 7);
    // The mapped corner arc, not the footprint's extreme vertex, fixes the pavilion/dome position and diameter.
    // Least-squares fit of outer vertices 3..10: centre (-33.2975,32.9768), radius 7.085 m, max radial residual 0.186 m.
    const cx = -33.3, cz = 32.98, profile = [[6.85, 22.05], [6.96, 22.7], [6.8, 25], [6.35, 27.7], [5.3, 30.1], [3.6, 31.8], [1.35, 32.5]];
    b.cyl(cx, 21.8, cz, 7.12, 7.12, 0.4, TR, 32);
    for (let k = 0; k + 1 < profile.length; k++) for (let i = 0; i < 32; i++) {
        const [r0, y0] = profile[k], [r1, y1] = profile[k + 1], a = i / 32 * Math.PI * 2, c = (i + 1) / 32 * Math.PI * 2;
        b.quad([cx + Math.sin(a) * r0, y0, cz + Math.cos(a) * r0], [cx + Math.sin(c) * r0, y0, cz + Math.cos(c) * r0], [cx + Math.sin(c) * r1, y1, cz + Math.cos(c) * r1], [cx + Math.sin(a) * r1, y1, cz + Math.cos(a) * r1], MET, 'm', [Math.sin((a + c) / 2), 0.4, Math.cos((a + c) / 2)]);
    }
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2, ridge = profile.map(([r, y]) => [cx + Math.sin(a) * (r + 0.06), y, cz + Math.cos(a) * (r + 0.06)]);
        for (let k = 0; k + 1 < ridge.length; k++) b.strut(ridge[k], ridge[k + 1], 0.12, 0.12, '#d6dfe3');
        if (i % 2 === 0) {
            const x = cx + Math.sin(a) * 6.62, z = cz + Math.cos(a) * 6.62;
            b.geo(new THREE.CylinderGeometry(0.58, 0.58, 0.16, 12), '#d3dce0', M(x, 26.8, z, a, 1, 1, 1, Math.PI / 2));
            b.geo(new THREE.CylinderGeometry(0.39, 0.39, 0.19, 12), GL, M(x + Math.sin(a) * 0.03, 26.8, z + Math.cos(a) * 0.03, a, 1, 1, 1, Math.PI / 2), 'g');
        }
    }
    // Open lantern, small cap and finial; profile/vertical dimensions are estimates from the official photographs.
    b.cyl(cx, 32.5, cz, 1.22, 1.4, 0.45, TR, 12);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; b.cyl(cx + Math.sin(a), 32.95, cz + Math.cos(a), 0.11, 0.14, 2.5, TR, 6); }
    b.cyl(cx, 35.45, cz, 1.38, 1.2, 0.3, TR, 12); b.dome(cx, 35.75, cz, 1.18, 0.9, MET, 16); b.cyl(cx, 36.65, cz, 0.12, 0.15, 1.6, '#929d9f', 6);
    // Legible, photo-verified signs on the south face; street facade text is not repeated on the courtyard walls.
    const a = outer[11], c = outer[18], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz), nx = s * dz / L, nz = -s * dx / L, ry = Math.atan2(nx, nz);
    b.text('ACADEMIA DE STUDII ECONOMICE', (a[0] + c[0]) / 2 + nx * 0.5, 17.05, (a[1] + c[1]) / 2 + nz * 0.5, ry, 0.76, '#59564d');
    b.text('WWW.ASE.RO', (a[0] + c[0]) / 2 - nx * 2, 24.15, (a[1] + c[1]) / 2 - nz * 2, ry, 1.75, '#c32230');
    // OSM covered footways, preserving every mapped bend. OSM supplies layer 1, not a measured deck elevation/width.
    // Width 2.8 m, underside 5.2 m and 2.7 m enclosure are explicit provisional dimensions, not aerial measurements.
    const bridges = [
        [[34.7, 36.01], [55.95, 39.1], [57.65, 39.49], [58.86, 40.16], [59.7, 40.89], [60.96, 42.52]],
        [[7.57, 2.44], [8.34, -3.17]],
    ];
    for (const line of bridges) for (let i = 0; i + 1 < line.length; i++) {
        const a = line[i], c = line[i + 1], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz), ry = -Math.atan2(dz, dx), x = (a[0] + c[0]) / 2, z = (a[1] + c[1]) / 2;
        b.box(x, 5.2, z, len + 0.08, 0.3, 2.8, '#737b7e', { ry });
        b.box(x, 7.85, z, len + 0.08, 0.2, 2.95, '#aeb7b7', { ry });
        const nx = -dz / len, nz = dx / len;
        for (const side of [-1, 1]) {
            const off = side * 1.36;
            b.box(x + nx * off, 5.5, z + nz * off, len, 2.35, 0.08, '#4a6167', { ry, mat: 'g' });
            const n = Math.max(1, Math.ceil(len / 2.2));
            for (let j = 0; j <= n; j++) b.box(a[0] + dx * j / n + nx * off, 5.5, a[1] + dz * j / n + nz * off, 0.08, 2.35, 0.08, '#ccd2cf');
        }
        b.col(x, z, len / 2, 1.4, ry, { y0: 5.2, y1: 8.05, h: 8.05 });
    }
}

// Hotel Ambasador (1937-39, Arghir Culina) — interwar modernist stepped hotel on Bd. Magheru (~13 floors).
// Src: https://en.wikipedia.org/wiki/Hotel_Ambasador_(Bucharest)
function bAmbasador(b) {
    // (after round 6, owner: "looks weird") interwar modernist slab stepping back in tiers over Magheru: cream render,
    // regular punched windows (glazed: lit rooms at night), a cornice line at every setback, the red vertical AMBASADOR
    // sign on the front corner and the name on the roof. The upper tiers are insets of the real footprint (the old
    // bounding-box tiers hung over the notch in the plan).
    b.wall = '#e9e3d4';
    const [p] = P.ambasador.map(pts), S = '#e9e3d4', T = '#d8d1c0', GL = '#38424c', bb = bbox([p]), cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2;
    // Clip every tier to the supported footprint below it, including the concave notch.
    const clipped = (poly, x0, z0, x1, z1) => {
        for (const [axis, edge, sign] of [[0, x0, 1], [0, x1, -1], [1, z0, 1], [1, z1, -1]]) {
            const out = []; for (let i = 0; i < poly.length; i++) {
                const a = poly[i], c = poly[(i + 1) % poly.length], ia = (a[axis] - edge) * sign >= 0, ic = (c[axis] - edge) * sign >= 0;
                if (ia) out.push(a);
                if (ia !== ic) { const t = (edge - a[axis]) / (c[axis] - a[axis]); out.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]); }
            } poly = out;
        } return poly;
    };
    const t1 = clipped(p, -18, -11, 20, 15), t2 = clipped(t1, cx - 13, cz - 9, cx + 13, cz + 7), t3 = clipped(t2, cx - 8, cz - 6, cx + 8, cz + 4);
    const tiers = [[p, 0, 25], [t1, 25, 34], [t2, 34, 40.5], [t3, 40.5, 46]];
    for (const [q, y0, y1] of tiers) {
        b.prism(q, y0, y1, S, { topCol: '#bdb6a8' });
        b.windows(q, y0 + (y0 ? 0.4 : 4.2), y1 - 0.3, 3.1, GL, { bay: 2.9, wf: 0.46, hf: 0.52, start: 0.6, minL: 3, mat: 'g', off: 0.06 });
        b.cornice(q, y1, 0.55, 0.45, T);
    }
    b.prism(offset(p, 0.05), 0, 4.2, '#cfc6b3', { top: false });                                       // ground floor: shopfront base
    b.windows(p, 0.4, 3.8, 3.8, '#2c3238', { bay: 4.2, wf: 0.78, hf: 0.82, start: 0.1, minL: 4, mat: 'g', off: 0.08 });
    b.box(cx, 46, cz - 1, 6, 3, 6, S); b.cyl(cx, 49, cz - 1, 0.2, 0.2, 5, '#bbb', 6);
    b.box(cx + 12, 8, bb.z0 - 0.9, 2.2, 22, 0.8, '#b52b2b');                                          // vertical "AMBASADOR" sign
    b.text('AMBASADOR', cx, 46.6, cz + 4.05, 0, 1.3, '#d22b2b');                                        // faces Magheru (local +z)
    b.colPoly([p], 15);
}

// Blocul ARO / Patria (1931, Horia Creangă) — modernist, 10 levels (OSM way 163622261), ribbon
// windows, corner tower with the PATRIA cinema sign on Bd. Magheru.
// Src: https://ro.wikipedia.org/wiki/Blocul_ARO ; OSM way 163622261
function bARO(b) {
    b.wall = '#eeeae1';
    const [p] = P.aro.map(pts), S = '#eeeae1', bb = bbox([p]);
    b.prism(p, 0, 33, S); b.bands(p, 0, 33, 3.3, '#3e4a55', { frac: 0.52 });
    const end = p.filter(q => q[1] < bb.z0 + 16), [tx, tz] = centroid(end.length ? end : p);
    const t = rect(tx - 7, Math.max(bb.z0 + 1, tz - 7), tx + 7, Math.max(bb.z0 + 1, tz - 7) + 14);
    b.prism(t, 33, 41, S); b.bands(t, 33, 41, 3.3, '#3e4a55', { frac: 0.52 });
    const xs = xAt([p], (bb.z0 + bb.z1) / 2) || [bb.x0, bb.x1];
    b.box(xs[0] - 0.7, 4, (bb.z0 + bb.z1) / 2, 1, 3.5, 18, '#c62828');      // PATRIA marquee
    b.box(xs[0] - 1.1, 9, (bb.z0 + bb.z1) / 2 - 7, 1.2, 20, 2.2, '#c62828'); // vertical sign
    b.colPoly([p], 15);
}

// ===========================================================================
//  SEATTLE / BELLEVUE — authored in real metres; the Builder squashes x/z by SEA_SCALE (0.5)
//  so footprints match the half-scale world while heights stay real.
// ===========================================================================

// Space Needle (1962) — 184 m (605 ft), three pairs of curved legs pinched at the waist, top house
// Ø ~42 m: restaurant level 152 m, observation 156 m, roof/halo ~158-161 m, spire to 184 m.
// OSM way 12903132 + building:parts 394254329..37 (heights above).
// Src: https://en.wikipedia.org/wiki/Space_Needle (605 ft / 184 m; observation 520 ft; top house Ø 138 ft) ; OSM way 12903132
function bSpaceNeedle(b) {
    // OSM parts 394254329–337, 484–488 and 394956342–344; official 605 ft beacon.
    // A continuous 1:1 top-house profile replaces the shallow stacked discs.
    const W = '#f3f3ef', GL = '#71899a';
    for (let k = 0; k < 3; k++) {
        const a = k / 3 * Math.PI * 2 + Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
        for (const side of [-1, 1]) {
            const line = [];
            for (let i = 0; i <= 20; i++) { const y = i / 20 * 144, r = y < 113 ? 5.2 + 12.6 * Math.pow(1-y/113,1.55) : 5.2 + Math.pow((y-113)/31,1.35)*7.6, gap = (y < 113 ? 0.95+2.3*Math.pow(1-y/113,1.3) : 0.95+(y-113)/31*1.9)*side; line.push([ca*r-sa*gap,y,sa*r+ca*gap]); }
            b.tube(line,0.78,W,{seg:24,radial:6});
            b.col(ca*17.8-sa*3.25*side,sa*17.8+ca*3.25*side,1,1,0,{y0:0,y1:8});
        }
        b.box(ca*17.8,0,sa*17.8,7,0.8,7,'#cfcfca');
        for (const y of [30.48,60.96,92]) b.strut([ca*10,y,sa*10],[ca*4,y,sa*4],0.5,0.5,W);
    }
    b.cyl(0,0,0,4,4,141,'#d9d9d4',16);
    const base=U.w394254333; b.prism(base,0,6.096,GL,{mat:'g'}); b.cornice(base,6.096,0.35,0.2,W);
    b.colPolygon(base,{y1:6.45});
    b.cyl(0,29.9,0,11.6,11.6,0.58,W,24); b.cyl(0,30.48,0,11.4,11.4,6.096,GL,24,{mat:'g'}); b.cyl(0,36.576,0,11.6,11.6,0.35,W,24);
    b.cyl(0,60.96,0,6.4,6.4,3.048,W,24);
    const profile=[[3.9,138.2],[6.5,141.2],[11.5,145.6],[16.8,149.2],[20.4,149.962],[21.15,152.4],[20.3,152.4],[20.3,156.058],[21.2,156.058],[21.2,157.7],[21.9,158.115],[17,158.115],[17,161.163],[22.45,162.8],[22.45,163.5],[19.2,165.6],[13,168.1],[7.2,169.8],[3.3,170.307]];
    for(let i=0;i<profile.length-1;i++){const [r0,y0]=profile[i],[r1,y1]=profile[i+1];if(y1===y0){b.cap(ellipse(0,0,Math.max(r0,r1),Math.max(r0,r1),32),y0,W);continue;} b.cyl(0,y0,0,r1,r0,y1-y0,(i===6||i===11)?GL:W,32,{mat:(i===6||i===11)?'g':'m',open:true});}
    for(let i=0;i<36;i++){const a=i/36*Math.PI*2,c=Math.cos(a),sn=Math.sin(a);b.strut([c*20.4,152.4,sn*20.4],[c*20.4,156.058,sn*20.4],0.1,0.1,W);}
    b.cone(0,170.307,0,3.2,10.82,W,16); b.cyl(0,181.1274,0,0.16,0.16,2.8726,'#cfcfcf',6);
}

// Columbia Center (Chester Lindsey, 1985) — 937 ft / 286 m, 76 floors (en.wikipedia "Columbia Center"),
// black granite base and dark glass in three stepped, concave-sided towers. Footprints & heights straight from
// OSM rel 4648083 (parts 160 / 223 / 226 / 280 / 286 m); vertical mullion fins + floor lines every 4 floors,
// Sky View Observatory level (73) as a lighter band.
// Src: https://en.wikipedia.org/wiki/Columbia_Center ; OSM rel 4648083
function bColumbia(b) {
    const ps = ['w107124288','w418132525','w418132517','w418132520','w418132515','w331293871'].map(id=>U[id]), H = [16, 280, 286, 223, 226, 160];
    ps.forEach((p, i) => {
        b.prism(p, 0, H[i], i ? '#262b31' : '#2c2a2a', { mat: 'g', topCol: '#3a4047' });
        if (!i) return;
        b.bands(p, 20, H[i] - 2, 14.8, '#3e464e', { frac: 0.12, off: 0.15, mat: 'g', wall: false });
        b.pilasters(p, 16, H[i] - 0.5, 4.5, 0.25, 0.25, '#3a4148', {});
        b.cornice(p, H[i] - 1.5, 1.5, 0.3, '#4a525a');
    });
    b.cornice(ps[2], 270, 3, 0.2, '#6f7a84');                                                  // observatory glazing
    b.colPolygon(ps[0], { y1: 16 }); for (let i=1;i<ps.length;i++) b.colPolygon(ps[i], { y1: H[i] });
}
// Smith Tower (1914, Gaggin & Gaggin) — 484 ft / 148 m to the tip, 38 floors (en.wikipedia "Smith Tower").
// White glazed terra-cotta 21-storey base (OSM way 52781661, height 75) with a window grid in paired bays,
// tower shaft to the Chinese Room (35th floor) with an arcaded balcony, pyramidal cap with dormers and the
// glass globe (lit blue/white at night).
function bSmith(b) {
    // Exact source part: shaft eaves 141 - 27 = 114 m; roof to 141 m,
    // small copper lantern and separate pyramidal tip to 148 m. No invented dormers.
    const p=U.w52781661,t=U.w418140386,W='#d2cfd2',TR='#e2dbc9',WIN='#4f555c'; b.wall=W;
    b.prism(p,0,75,W,{topCol:'#7a7869'}); b.windows(p,0,75,3.55,WIN,{bay:2.3,wf:0.5,hf:0.6,start:4.5,minL:3});
    b.pilasters(p,0,75,6.9,0.5,0.25,TR,{}); b.cornice(p,4,0.8,0.5,TR); b.cornice(p,74,1.2,0.8,TR);
    b.prism(t,75,114,W); b.windows(t,75,114,3.5,WIN,{bay:2.25,wf:0.5,hf:0.6,start:0.8,minL:3});
    b.pilasters(t,75,114,4.5,0.5,0.25,TR,{ends:true}); b.cornice(t,112.8,1.2,0.6,TR);
    const box=bbox([t]); b.hip((box.x0+box.x1)/2,114,(box.z0+box.z1)/2,box.x1-box.x0,box.z1-box.z0,27,'#9c907a');
    const lantern=U.w418140384,lb=bbox([lantern]),cx=(lb.x0+lb.x1)/2,cz=(lb.z0+lb.z1)/2;
    b.prism(lantern,138.7,141.1,'#637660',{mat:'g'});
    const tip=U.w418140385,tb=bbox([tip]); b.prism(tip,141.1,142,W);b.hip((tb.x0+tb.x1)/2,142,(tb.z0+tb.z1)/2,tb.x1-tb.x0,tb.z1-tb.z0,6,W);
    b.colPolygon(p,{y1:75}); b.colPolygon(t,{y0:75,y1:141});
}

// Lumen Field (2002, Ellerbe Becket / LMN; structure MKA) — 68,740 seats. MKA project page: roof carried by
// dual steel tied arches spanning 720 ft (219.5 m) on four towers with friction-pendulum dampers; roof covers
// ≈ 70% of seats, open north end. Field from OSM pitch way 163840038 (52.6 x 112.7 m, centre -2, +4.5).
// Commons "Aerial CenturyLink Field November 2011": navy roof membranes with white lettering, white arches,
// red-brick base. Roof lettering per lumenfield.com signage release: "LUMEN" 305 ft (93 m) and "FIELD" 131 ft (40 m) long.
// Bowl extents fitted inside the surrounding OSM streets (Occidental Ave S on the west).
// Src: https://www.mka.com/projects/lumen-field/ ; https://en.wikipedia.org/wiki/Lumen_Field ; OSM pitch 163840038
function bLumen(b) {
    const CON = '#c9c6bf', BRK = '#8a4c3c', SEAT = '#2f5a78', FX = -2, FZ = 4.5, SPAN = 219.5;
    b.prism(U.w163840038,0,0.25,'#3f8a3a');
    b.box(FX, 0.25, FZ, 1, 0.05, 110, '#e8e8e8');
    const t1o = roundRect(FX, FZ, 136, 196, 30), t1i = roundRect(FX, FZ, 76, 128, 8);
    b.prism(t1o, 0, 11, BRK, { holes: [t1i], topCol: SEAT });
    const t2o = roundRect(FX, FZ + 4, 178, 232, 40), t2i = roundRect(FX, FZ, 134, 194, 28);
    b.prism(t2o, 0, 11, BRK, { holes: [t2i], top: false });
    b.prism(t2o, 11, 22, CON, { holes: [t2i], topCol: SEAT });
    b.bands(t2o, 0, 22, 5.5, '#3a3f45', { frac: 0.32, wall: false });                     // open concourse levels
    b.pilasters(t2o, 0, 22, 9, 1.2, 0.5, '#cfcdc7', {});
    for (const s of [-1, 1]) {                                              // upper sideline decks
        const o = rect(FX + s * 68, FZ - 100, FX + s * 104, FZ + 100);
        b.prism(o, 22, 38, CON, { topCol: SEAT });
        b.bands(o, 22, 38, 5.3, '#3a3f45', { frac: 0.3, wall: false });
        // roof canopy, tied arch (span 219.5 m) on two towers, hangers
        const roof=U[s<0?'w458208106':'w458208107'],roofY=sourceSlope(roof,0,26,10,true);
        sourceProfile(b,roof,roofY,'#203352');
        // OSM's complete round canopy contours and 36 m tagged roof top.
        for(let i=0;i<roof.length;i++){const a=roof[i],c=roof[(i+1)%roof.length];b.quad([a[0],roofY(...a)-.7,a[1]],[c[0],roofY(...c)-.7,c[1]],[c[0],roofY(...c),c[1]],[a[0],roofY(...a),a[1]],'#d1d3d3','m');}                    // navy roof membrane
        const arch = []; for (let i = 0; i <= 12; i++) { const t = i / 12, zz = FZ - SPAN / 2 + t * SPAN; arch.push([FX + s * 106, 44 + 22 * Math.sin(Math.PI * t), zz]); }
        b.tube(arch, 1.5, '#f0f0ee', { seg: 24, radial: 6 });
        b.box(FX + s * 106, 44.6, FZ, 2, 1.6, SPAN, '#e6e6e3');                // tie
        for (let i = 1; i < 12; i++) { const t = i / 12, zz = FZ - SPAN / 2 + t * SPAN; b.tube([[FX + s * 106, 44 + 22 * Math.sin(Math.PI * t), zz], [FX + s * 72, roofY(FX+s*72,zz), zz]], 0.35, '#e6e6e3', { seg: 2, radial: 4 }); }
        for (const e of [-1, 1]) { b.box(FX + s * 106, 0, FZ + e * SPAN / 2, 5, 44, 5, CON); b.box(FX + s * 106, 44, FZ + e * SPAN / 2, 6.5, 2.4, 6.5, '#9aa0a5'); }
    }
    // roof lettering (white on the canopies, readable from the air)
    b.text('LUMEN', FX-82,36.15,FZ,Math.PI/2,12,'#ffffff',{flat:true,d:.1});
    b.text('FIELD',FX-98,36.15,FZ,Math.PI/2,4.2,'#94bdd6',{flat:true,d:.1});
    b.text('LUMEN',FX+78,36.15,FZ,-Math.PI/2,12,'#ffffff',{flat:true,d:.1});
    b.text('FIELD',FX+94,36.15,FZ,-Math.PI/2,4.2,'#94bdd6',{flat:true,d:.1});
    // south end: video board above the end-zone deck; north end open "Hawks Nest" bleachers
    b.prism(rect(FX - 60, FZ + 100, FX + 60, FZ + 118), 22, 32, CON, { topCol: SEAT });
    b.box(FX, 34, FZ + 108, 64, 16, 3, '#1e2227'); b.box(FX, 35, FZ + 106.4, 58, 13, 0.2, '#2d5d88');
    b.prism(rect(FX - 50, FZ - 114, FX + 50, FZ - 98), 0, 14, CON, { topCol: SEAT });
    const northBoard=U.w458208112; b.prism(northBoard,42,60,'#263843');b.colPolygon(northBoard,{y0:42,y1:60});
    b.colPolygon(t1o, { holes: [t1i], y1: 11 }); b.colPolygon(t2o, { holes: [t2i], y1: 22 });
    for (const side of [-1,1]) b.colPolygon(rect(FX+side*68,FZ-100,FX+side*104,FZ+100), { y0: 22, y1: 46 });
}

// T-Mobile Park (1999, NBBJ) — retractable three-panel roof that parks over the east side. All massing from
// the OSM building:parts of the ballpark: grandstand ring 38 m (way 1451834523), lower-bowl stands 20 m with
// skillion rakes (1451834513-20), north upper deck 15-32 m (1451834512), parked roof 46-66 m with a round top
// (1451834522) on runway trusses at 46 m (1451834510/11); infield from OSM 158755976. Brick base + green steel.
const TMB_RING = [-43.5, -83.5, -53, -94, -60.5, -87.5, -65, -92.5, -73.5, -85.5, -72, -83.5, -77, -81, -94, -39.5, -101, -10.5, -105, 24, -104, 42, -101, 53, -92.5, 66.5, -83.5, 75.5, -70, 85.5, -60, 90.5, -45.5, 95, 14, 95.5, 50, 86, 71.5, 78.5, 85.5, 67, 101, -12.5, 86.5, -14.5, 76.5, 37.5, 71, 54.5, 56, 69, 13.5, 80, -36, 81, -64, 73, -74.5, 63.5, -83.5, 51, -87, 40.5, -87.5, 30.5, -83, -5, -78, -28.5, -61, -68.5];
const TMB_FIELD = [86.5, -14.5, 76.5, 37.5, 71, 54.5, 56, 69, 13.5, 80, -36, 81, -64, 73, -74.5, 63.5, -83.5, 51, -87, 40.5, -87.5, 30.5, -83, -5, -78, -28.5, -61, -68.5, -43.5, -83.5, 52, -83.5, 63, -39, 74, -13.5];
const TMB_DIRT = [-30.5, 28.5, -32.5, 31.5, -36.5, 32.5, -40.5, 30, -41, 27, -40, 24, -36, 22, -34, -10.5, -27.5, -13, -20, -13.5, -9.5, -11, -3, -7.5, 4, 1, 7.5, 11, 6.5, 22, 2, 32];
// Src: https://en.wikipedia.org/wiki/T-Mobile_Park ; OSM rel 18550612 + parts 1451834508-23
function bTMobile(b) {
    const ring = U.w1451834523, field = pts(TMB_FIELD), dirt = pts(TMB_DIRT), BR = '#86463a', ST = '#3f6863', SEAT = '#1c4a63';
    b.prism(field, 0, 0.2, '#3f8a3a', { topCol: '#3f8a3a' });
    b.prism(dirt, 0.2, 0.3, '#b48a5a');
    b.prism(rect(-20, 4, -12, 12), 0.3, 0.35, '#5a9a4a');                              // infield grass square
    // grandstand: brick base with arched openings, green steel above, seating on top
    b.prism(ring, 0, 22, BR, { topCol: SEAT });
    b.windows(ring, 0, 9, 9, '#3a2a25', { bay: 7, wf: 0.55, hf: 0.7, start: 0.5, arch: true, minL: 10, edges: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] });
    b.prism(ring, 22, 38, ST, { topCol: SEAT });
    b.bands(ring, 9, 38, 6.5, '#2f3a3d', { frac: 0.35, wall: false });
    b.cornice(ring, 9, 0.8, 0.4, '#d8d3c8');
    // Every mapped lower deck uses its own footprint, tagged 20 m height,
    // skillion direction and rise (15–17 m). The previous two low blocks reached only 9 m.
    for(const id of ['w1451834508','w1451834509',...Array.from({length:8},(_,i)=>'w'+(1451834513+i))]){
        const q=U[id],t=UT[id],top=+t.height,rise=+t['roof:height'],base=top-rise;
        b.prism(q,0,base,'#c3bfb6',{top:false});
        sourceProfile(b,q,sourceSlope(q,+t['roof:direction'],base,rise),SEAT,'m',1);
        b.colPolygon(q,{y1:top});
    }
    const upper=U.w1451834512;b.prism(upper,15,20,ST,{top:false});sourceProfile(b,upper,sourceSlope(upper,180,20,12),SEAT,'m',1);b.colPolygon(upper,{y0:15,y1:32});
    b.box(6,32,-97,40,12,2,'#1e2227');
    // Actual runway contours at 46 m. The entire three-panel roof's curved
    // footprint follows the mapped 46–66 m round roof, including its tapered east edge.
    for(const id of ['w1451834510','w1451834511']){const q=U[id];b.prism(q,42,46,'#7f8f92');const bb=bbox([q]);for(const x of [bb.x0+2,(bb.x0+bb.x1)/2,bb.x1-2])b.box(x,0,(bb.z0+bb.z1)/2,3.5,42,3.5,'#7f8f92');}
    const roof=U.w1451834522,roofY=sourceSlope(roof,7,46,20,true);sourceProfile(b,roof,roofY,'#c8cdca');
    for(let i=0;i<roof.length;i++){const a=roof[i],c=roof[(i+1)%roof.length];b.strut([a[0],roofY(...a),a[1]],[c[0],roofY(...c),c[1]],.8,.8,'#7f8f92');}
    // Longitudinal panel seams use the same curve as the membrane.
    for(const x of [92,122,152])for(let j=0;j<16;j++){const z=-96+j*12.5,nz=z+12.5;b.strut([x,roofY(x,z)+.3,z],[x,roofY(x,nz)+.3,nz],.3,.3,'#778386');}
    b.text('T-MOBILE PARK', -78, 13, 93.6, 0.32, 2.4, '#e20074');
    b.colPolygon(ring, { y1: 38 }); b.col(116, -98, 56, 3); b.col(116, 103, 56, 3);
}

// Seattle Great Wheel (2012) — 53 m tall, 42 gondolas, end of Pier 57 (OSM ticket booth way
// 429553385). Built at true size in its own plane (not squashed) so it stays a circle.
// Src: https://en.wikipedia.org/wiki/Seattle_Great_Wheel (53 m, 42 gondolas)
function bGreatWheel(b) {
    const hs = b.hs; b.hs = 1;                                             // keep the wheel round (true size)
    const R = 23.5, Y = 26.5; // complete envelope ≈ 53 m, as surveyed OSM n1809238334
    for (const z of [-1.8, 1.8]) b.geo(new THREE.TorusGeometry(R, 0.55, 6, 56), '#f2f2f2', M(0, Y, z));
    for (let i = 0; i < 42; i++) { const a = i / 42 * Math.PI * 2; b.box(Math.cos(a) * R / 2, Y - 0.15, 0, R, 0.3, 0.3, '#e6e6e6', { rz: a }); }
    b.geo(new THREE.CylinderGeometry(1.6, 1.6, 4.4, 12), '#cfcfcf', M(0, Y, 0, 0, 1, 1, 1, Math.PI / 2, 0));
    for (let i = 0; i < 42; i++) { const a = i / 42 * Math.PI * 2; b.box(Math.cos(a) * (R + 1.6), Y + Math.sin(a) * (R + 1.6) - 1.5, 0, 2.4, 2.8, 2.6, i % 6 ? '#e9edf0' : '#c0392b'); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([[sx * 13, 0, sz * 7], [0, Y, sz * 2.2]], 0.7, '#e2e2e2', { seg: 2, radial: 6 });
    b.box(0, 0, 0, 34, 1, 18, '#8a8173');
    b.hs = hs;
    b.col(0, 0, 17 / hs, 9 / hs);                                          // collision in true metres too
}

// Amazon Spheres (2018) — three glass spheres (pentagonal hexecontahedra), 24-29 m tall,
// largest Ø ~40 m (OSM way 868099742).
// Src: https://en.wikipedia.org/wiki/The_Spheres ; OSM way 868099742
function bSpheres(b) {
    // Individual OSM dome parts, not three intersecting complete balls. Heights
    // 19 / 15.5 / 27.5 m and spring lines = height - roof:height.
    const hs=b.hs;b.hs=1; const k=hs, GL='#9fb5ae', FRAME='#d5deda';
    const parts=['w398816077','w491817110','w491817111'].map(id=>{const p=U[id],bb=bbox([p]),x=(bb.x0+bb.x1)/2,z=(bb.z0+bb.z1)/2,h=+UT[id].height,rh=+UT[id]['roof:height'];return{id,p,x,z,h,y0:h-rh,rx:(bb.x1-bb.x0)/2,rz:(bb.z1-bb.z0)/2,rh};});
    for (const q of parts) {
        // Full tagged footprint and an ellipsoidal dome; frame triangles follow
        // that surface. Panel arrangement is a bounded approximation of the
        // pentagonal hexecontahedron, never claimed as a surveyed panel layout.
        b.prism(q.p.map(([x,z])=>[x*k,z*k]),0,q.y0*k,GL,{mat:'g'});
        const N=24,J=8,at=(i,j)=>{const ph=j/J*Math.PI/2,a=(i+j%2*.5)/N*Math.PI*2;return[(q.x+Math.cos(a)*q.rx*Math.cos(ph))*k,(q.y0+q.rh*Math.sin(ph))*k,(q.z+Math.sin(a)*q.rz*Math.cos(ph))*k];};
        for(let j=0;j<J;j++)for(let i=0;i<N;i++){const a=at(i,j),c=at(i+1,j),d=at(i+1,j+1),e=at(i,j+1);b.quad(a,c,d,e,GL,'g',[a[0]-q.x*k,10,a[2]-q.z*k]);if(j<J-1){b.strut(a,d,0.075*k,0.075*k,FRAME);b.strut(a,e,0.075*k,0.075*k,FRAME);}b.strut(a,c,0.075*k,0.075*k,FRAME);}
    }
    b.hs=hs;b.colPolygon(U.w868099742,{y1:5.3});
}

// Mount Baker Ridge Tunnel (I-90) — east portals at Lake Washington: two 1940 Art-Deco bores and
// the 1989 bore (Ø 19.2 m, the world's largest soft-earth tunnel then). Facade only: the road
// passes through the openings (keep them clear of collision). OSM way 481496634 (tunnel lid).
// Src: https://en.wikipedia.org/wiki/Mount_Baker_Tunnel (1989 bore Ø 63 ft / 19.2 m) ; OSM way 481496634
function bMtBaker(b) {
    const CON = '#cfcabe';
    b.archWall(78, 23, 3, [{ x: -24, w: 11, h: 10.5 }, { x: -9, w: 11, h: 10.5 }, { x: 16, w: 19.5, h: 19 }], CON, M(0, 0, 0, Math.PI / 2));
    for (const z of [-39, -27.5, -1.5, 16.5, 39]) b.box(0.5, 0, z, 4, 25.5, 3, '#dcd7cb');
    b.box(0, 23, 0, 4.5, 1.2, 80, '#e2ddd2');
    // wooded ridge rising behind (west) over the bores
    b.geo((() => { const s = new THREE.Shape([new THREE.Vector2(0, 23), new THREE.Vector2(0, 24.5), new THREE.Vector2(-60, 40), new THREE.Vector2(-90, 42), new THREE.Vector2(-90, 23)]); const g = new THREE.ExtrudeGeometry(s, { depth: 90, bevelEnabled: false }); g.translate(0, 0, -45); return g; })(), '#4d6b3c', M(-1.5, 0, 0));
    for (const s of [-1, 1]) b.box(10, 0, s * 47, 24, 12, 2, CON, { ry: s * 0.25 });   // wing walls
    for (const [z0, z1] of [[-40, -25.8], [-6.2, 3.5], [14.5, 18.5], [29.5, 40]]) b.col(0, (z0 + z1) / 2, 2, (z1 - z0) / 2);   // piers between the bores (openings: world z +18.5..29.5, +3.5..14.5, -25.8..-6.2)
    // 1940 bores: carved band "SEATTLE · PORTAL TO THE PACIFIC" over the openings + low-relief Northwest-native panels
    // (research landmarks[mt-baker-tunnel-east-portal], concrete #bdb9ae; refs/bellevue/Seattle_-_Portal_to_the_Pacific_01.jpg)
    b.box(2.8, 11.4, 16.5, 0.4, 1.9, 27, '#c5c1b6');
    b.text('SEATTLE  PORTAL TO THE PACIFIC', 3.0, 11.85, 16.5, Math.PI / 2, 0.95, '#8f8b80');
    b.box(1.75, 2, 34.5, 0.5, 9, 5, '#b3afa3'); b.box(2.05, 4, 34.5, 0.3, 2.2, 2.6, '#a7a397'); b.box(2.05, 7.5, 33.8, 0.3, 1.2, 3.4, '#a7a397');
}

// Seattle-Tacoma International Airport — main terminal & concourses A-D (OSM way 23772634, 2 levels), the
// South Satellite (OSM 23772637, 2 levels) and the International Arrivals Facility (opened 2022, OSM 734002404)
// with its aerial walkway (OSM 869951038: 25.9 -> 33.5 m, i.e. 85 ft over the taxiway, ≈ 240 m / 780 ft long)
// linking the IAF to the South Satellite. Control tower (71 m, OSM 1199936807) is modelled separately.
const SEA_IAF = [398, -216.5, 319.5, -230, 319, -227.5, 300, -222.5, 291.5, -234, 247.5, -202.5, 251.5, -197, 148, -123, 152, -117.5, 124, -96.5, 122, -99.5, 116.5, -96, 114, -98.5, 119.5, -102.5, 104.5, -121.5, 248, -262, 263, -274.5, 282.5, -282.5, 310.5, -284.5, 400, -269, 397, -253, 404.5, -252, 405.5, -259, 415.5, -257.5, 412, -234.5, 401.5, -236];
const SEA_SSAT = [349, 113, 349, 110, 333, 111.5, 331.5, 87, 347.5, 85.5, 345, 57.5, 397.5, 54, 408.5, 209, 356.5, 213];
// Src: https://en.wikipedia.org/wiki/Seattle–Tacoma_International_Airport ; OSM 23772634 / 23772637 / 734002404 / 869951038
function bSeaTac(b) {
    const p=U.w23772634,iaf=U.w734002404,ss=U.w23772637, GL = '#5b7d92', WH = '#e9ebec';
    // main terminal + concourses: glass bands under a white roof edge
    b.prism(p, 0, 17, '#d7dadb', { topCol: '#c4c8ca' });
    b.windows(p, 0, 17, 8.5, GL, { bay: 12, wf: 0.92, hf: 0.55, start: 2.5, mat: 'g', minL: 14 });
    b.cornice(p, 16.4, 1.2, 1.2, WH);
    b.prism(offset(p, -6), 17, 19.5, WH);
    b.text('SEATTLE-TACOMA INTERNATIONAL AIRPORT', -120, 11, zAt([p], -120)[0] - 1.25, Math.PI, 3.2, '#1f3550');
    // South Satellite (1973, rebuilt)
    b.prism(ss, 0, 14, '#d7dadb', { topCol: '#c4c8ca' }); b.windows(ss, 0, 14, 7, GL, { bay: 6, wf: 0.85, hf: 0.55, start: 2, mat: 'g', minL: 10 });
    b.cornice(ss, 13.6, 1, 1, WH);
    // International Arrivals Facility: tall glazed hall with a deep white roof plate
    b.prism(iaf, 0, 34, '#7f9db1', { mat: 'g', topCol: '#d9dcde' });
    b.pilasters(iaf, 0, 34, 9, 0.4, 0.5, '#f0f2f3', {});
    for (const y of [9, 18, 26]) b.cornice(iaf, y, 0.5, 0.35, '#f0f2f3');
    b.prism(offset(iaf, 3), 34, 36.5, WH, { topCol: '#e3e6e8', bottom: true });
    // aerial walkway: glazed tube on a white truss, piers clear of the taxiway
    const wx = 386, z0 = -186, z1 = 55, L = z1 - z0, zc = (z0 + z1) / 2;
    b.box(wx, 25.9, zc, 15, 1.4, L, '#f2f3f4');
    b.box(wx, 27.3, zc, 14, 5.3, L, '#8fb0c4', { mat: 'g' });
    b.box(wx, 32.6, zc, 15.6, 0.9, L + 1, '#f2f3f4');
    for (let k = 0; k <= 16; k++) { const z = z0 + k / 16 * L; b.box(wx, 22.4, z, 15.2, 3.5, 0.35, '#e6e8ea'); b.box(wx, 22.4 + 1.6, z + L / 32, 15.2, 0.35, L / 16 * 1.1, '#e6e8ea', { rx: k % 2 ? 0.3 : -0.3 }); }
    b.box(wx, 22, zc, 15.4, 0.5, L, '#e6e8ea');
    for (const z of [-150, 22]) for (const e of [-1, 1]) for (const sx of [-5, 5]) b.box(wx + sx, 0, z + e * 5.5, 2, 23.5, 2, '#eef0f1', { rx: e * 0.45 });   // V-struts (Commons "IAF Pedestrian Walkway.jpg")
    b.text('WELCOME TO SEATTLE', wx - 7.65, 28.6, zc, -Math.PI / 2, 2.2, '#ffffff');
    for (const [t, lv] of SEATAC_PLANES) parkAt(b, p, t, lv, 28, 40);
    airliner(b, 300, 160, -Math.PI / 2, { tail: '#01426a', stripe: '#00a3ad' }, 40);
    b.colPolygon(p, { y1: 19.5 }); b.colPolygon(iaf, { y1: 36.5 }); b.colPolygon(ss, { y1: 14.6 });
    for (const z of [-150, 22]) b.col(wx, z, 7, 1.6);
}

const SEATAC_PLANES = [
    [0.12, { tail: '#01426a', stripe: '#00a3ad' }],   // Alaska
    [0.40, { tail: '#c01933', stripe: '#003366' }],   // Delta
    [0.68, { tail: '#0033a0', belly: '#9aa3ad' }],    // United
];

// SeaTac Air Traffic Control Tower (2004) — cab floor 71 m (233 ft), 82 m (269 ft) overall, OSM way 1199936807.
// Src: https://en.wikipedia.org/wiki/Seattle–Tacoma_International_Airport (tower 233 ft) ; game/research/seattle-seatac.json landmarks[sea-control-tower] ; OSM way 1199936807
function bSeaTower(b) {
    const p=U.w1199936806; b.prism(p,0,9,'#cfcdc6');b.bands(p,0,9,4.5,'#4c5964',{frac:0.5});
    // Tagged 71 m is the complete tower height, not an invented 71 m cab floor.
    atcTower(b,0,0,65.7,{r:3.6,col:'#dedcd5'});
    b.colPolygon(p,{y1:9});b.col(0,0,3.6,3.6,0,{y0:0,y1:71});
}

// Bellevue Towers (2008) — twin residential towers on a 5-level podium: North 137 m / 43 levels, South 131 m / 42 levels
// (OSM w370237986 / w370239409); blue-green glazing #7a96a8 with white slab edges,
// glass parapet crowns, rooftop garden on the podium between them.
// Src: https://www.skyscrapercenter.com/complex/2787 ; game/research/seattle-bellevue.json landmarks[bellevue-towers]
function bBellevueTowers(b) {
    const [n,s,pod] = ['w370237986','w370239409','w118119171'].map(id=>U[id]);
    b.prism(pod, 0, 18, '#d1ccc2', { topCol: '#7f9e6b' }); b.bands(pod, 0, 18, 3.6, '#4f6573', { frac: 0.5 });
    for (const [p, h] of [[n, 137], [s, 131]]) {          // OSM: North 137 m/43 levels; South 131 m/42 levels, including crowns
        b.prism(p, 18, h - 7, '#7a96a8', { mat: 'g', topCol: '#c7d0d6' });
        b.bands(p, 18, h - 7, 3.1, '#d9e0e4', { frac: 0.12, off: 0.1 });
        b.prism(offset(p, -2.5), h - 7, h - 2, '#cfd6da');
        b.ring(p, h - 7, h, '#9db7c6', { mat: 'g' });                                           // glass parapet crown
        b.pilasters(p, 18, h - 7, 8, 0.35, 0.35, '#dfe6ea', {});
    }
    b.colPolygon(pod, { y1: 18 });
}

// Bellevue Square (1946, rebuilt as an enclosed mall 1981) — 3-level regional mall (OSM way 29234887),
// skylit malls, main glazed entrance + lettering on Bellevue Way NE (east, model -z).
// Src: https://en.wikipedia.org/wiki/Bellevue_Square ; OSM way 29234887
function bBellevueSq(b) {
    const p = U.w29234887;
    // round 6 note 29: one shopfront band at street level and blank cream cladding above (the old full-height glass
    // stripes read as striped boxes), the skylit spines kept on the roof inside the footprint, the lettering on the
    // entrance pavilion's face (it floated above the canopy, cut off)
    b.prism(p, 0, 15, '#e3dccf', { topCol: '#cbc4b7' }); b.bands(p, 0, 5, 5, '#3f5666', { frac: 0.78, mat: 'g', start: 0.4 });
    b.bands(p, 13.2, 15, 1.8, '#d2cabb', { frac: 0.5, start: 0.3 });             // cornice line
    b.box(15, 15, 0, 230, 1.6, 10, '#cbd6dc', { mat: 'g' });                  // skylit mall spines (low glazed ridges)
    b.box(-20, 15, 0, 10, 1.6, 190, '#cbd6dc', { mat: 'g' });
    // main entrance on Bellevue Way NE (model -z = east): glazed pavilion, canopy and the name on its face
    const ze = zAt([p], 0)?.[0] ?? -126;
    b.box(0, 0, ze - 4, 30, 13, 8, '#6f8ea2', { mat: 'g' }); b.box(0, 13, ze - 4.5, 34, 1.4, 10, '#efe9df');
    b.box(0, 9.6, ze - 8.25, 24, 2.6, 0.3, '#efe9df');                            // sign fascia
    b.text('BELLEVUE SQUARE', 0, 10.15, ze - 8.45, Math.PI, 1.5, '#2e3b46');
    b.colPolygon(p, { y1: 15 });
}

// Mount Rainier — 4,392 m stratovolcano, summit 46.8529 N 121.7604 W (~90 km SE of downtown).
// Real-size cone (base Ø ~32 km, squashed 0.5 on x/z like the rest of the city); `backdrop: true`
// means the world may move it closer and pass ctx.backdropScale = distance / realDistance.
// Src: https://en.wikipedia.org/wiki/Mount_Rainier (4,392 m, 46.8529 N 121.7604 W)
function bRainier(b) {
    emitUSLandmarkTerrain(b,'rainier',46.8529,-121.7604);
}

// Olympic Mountains — silhouette ridge west of Puget Sound (The Brothers 2,092 m, Mt Constance
// 2,371 m, Mt Olympus 2,432 m further west). ~80 km long backdrop band, same backdrop rules.
// Src: https://en.wikipedia.org/wiki/Olympic_Mountains (Olympus 2,432 m, Constance 2,371 m, The Brothers 2,092 m)
function bOlympics(b) {
    emitUSLandmarkTerrain(b,'olympics',47.70,-123.15);
}

// ===========================================================================
//  DISTRICT-ERA LANDMARKS (spec 12 R12.6 / R12.6b, 2026-11) — authored in real metres, rotation 0
//  (+x east, +z south), footprints = OSM ways projected at the anchor (equirectangular, Douglas-Peucker
//  0.4 m), anchor = centre of the footprints' bounding box. Facade colours / heights from the research
//  dossiers game/research/<city>-<district>.json (`landmarks[]`, `buildings[]`), checked against the
//  reference photos in game/research/refs/ (reference only — no photo textures).
// ===========================================================================
const P2 = {
    lincoln: [   // anchor 47.6164962, -122.2008984
        [-39.5,-86.5,-42,-66,-44,-66,-45.5,-49,-44.5,-49,-44,-33,-31.5,-30.5,0.5,-34,-0.5,-83.5,-23,-82.5,-23,-81,-27.5,-81,-28,-86.5], // w604028609 Lincoln Square North (126 m)
        [-12,63,45,62.5,45,81,28.5,81.5,28.5,82,18.5,84,1.5,84.5,-11,82.5,-15,81], // w604028611 One Lincoln Tower (137 m)
        [-44,82,-44,53,-18.5,52.5,-18.5,53.5,27.5,52.5,27.5,48,37.5,47.5,37,45,45.5,45,46,52,44,52,44,62.5,45,62.5,45,81,42.5,81.5,42.5,85.5,-9,86,-9,88,-15,87.5,-28,87], // w328017119 Westin Bellevue (2 levels)
        [-39.5,-86.5,-39.5,-87.5,-23,-88,-23,-86,-10.5,-86,-10.5,-83,-0.5,-83.5,-0.5,-85,43,-86,43,-47.5,47,-48,47,-41,43.5,-41,44.5,13.5,45,13.5,45.5,30.5,-44.5,31.5,-45,-24.5,-44.5,-24.5,-47,-33.5,-44.5,-34.5,-46,-39.5,-47,-49,-46.5,-58.5,-46,-68.5,-45,-77.5,-41.5,-85,-40.5,-86.5], // w161929514 Lincoln Square podium (3 levels)
        [-18.5,31,-18.5,53.5,27.5,52.5,27.5,48,37.5,47.5,37,45,45.5,45,45.5,30.5], // w1474737770 connector (levels 2-3)
        [28,-136.5,12.5,-113,-0.5,-85,5.5,-85.5,19,-113,28,-127], // w1364249504 NE 8th St skybridge (building=bridge)
    ],
    lincolnsouth: [   // anchor 47.6147631, -122.2008325
        [24,43,-19.5,43.5,-19.5,45.5,-35,45.5,-34,81,13.5,80.5,13.5,78.5,28,77], // w1326151866 400 Lincoln Square (137 m, min_level 4)
        [29,-70,29,-63.5,31,-63.5,31.5,-28.5,29.5,-28.5,30,0,29,0,29,2,27.5,2,27,4,25.5,4,25.5,6,7,6.5,6.5,-7,-2,-7,-2.5,-17,0,-17,0,-31.5,-2.5,-31.5,-2,-44,-3.5,-44.5,-4,-51,-3,-51,-2.5,-58.5,-1,-69], // w604028603 Two Lincoln Tower (137 m, min_level 4)
        [32.5,-75,31.5,-75,31,-85.5,6,-84.5,-0.5,-44,-35.5,-43.5,-35.5,-32.5,-45.5,-32.5,-45,1.5,-39.5,1.5,-39.5,11.5,-45,11.5,-43.5,71.5,-38,71.5,-37.5,85.5,-13.5,85,-13.5,80.5,10,80,10,85,30,85,30,59,45.5,58.5,44,-3,44,-47,33,-47], // w1326151868 Lincoln Square South podium (3 levels)
    ],
    plazacenter: [[17.5,28,15.5,28,15.5,30,-16,29.5,-15.5,27.5,-17.5,27.5,-17.5,-28,-15.5,-28,-15.5,-30,16,-29.5,15.5,-28,17.5,-28]], // w33725899 (anchor 47.6178822, -122.1940388)
    sonic: [   // anchor 47.6148782, -122.1968365
        [23,-24.5,23,-7,26.5,-7,26.5,19,-23,19.5,-23.5,-8.5,-26.5,-8.5,-26.5,-24.5], // w1214424283 main part, 42 levels
        [-20,19.5,-20,24.5,23,24,23,19], // w1556489725 north slab, 32 levels
        [25,42.5,26.5,42.5,26.5,-7,23,-7,23,-24.5,13.5,-24.5,-26.5,-24.5,-26,42,-24.5,42,-24.5,46,25,45.5], // w1214423752 Amazon.com Sonic (3-level base)
    ],
    bellevue600: [[-20.5,-23,28.5,-22.5,28,-10,22.5,-10,22.5,7.5,26.5,8,26,23.5,-28.5,22.5,-28.5,7.5,-21.5,7.5,-21,-10.5,-26,-10.5,-26.5,-23]], // w1453402305 (anchor 47.6160667, -122.1942494)
    seagarage: [   // anchor 47.4432823, -122.2992416 — OSM rel 15763840 outer w23660961 + 8 inner rings (DP 1.0 m)
        [-147.5,-13,-154,-21.5,-158,-35,-157,-44.5,-151,-57.5,-24.5,-183,104.5,-182.5,124.5,-162,126,-151,120,-143.5,113,-142,106.5,-143.5,95.5,-154,68,-127,76.5,-119,80,-112.5,78.5,-102.5,73.5,-98,67,-96,60,-98,49.5,-108.5,40.5,-100,48.5,-92,52,-85.5,52,-78.5,48.5,-72.5,43,-69.5,35.5,-69.5,32.5,-71,22.5,-81,14,-73,13.5,-68,28.5,-68,34,-64.5,37.5,-58.5,36.5,-48,29,-42,13.5,-41.5,13,-31.5,24.5,-31.5,31.5,-29.5,35.5,-25.5,38,-17.5,36.5,-11.5,32,-6.5,25,-5,13,-5.5,13,-0.5,21.5,8,30,-0.5,36,-3.5,42.5,-3.5,48,-0.5,51,4,52,13,48.5,19,40,27,48.5,36.5,57.5,27,63.5,24.5,70,24.5,75,27.5,79,34,79,41,75.5,46.5,67,55,94,82.5,103,74,109,70.5,116.5,71,121,74,124.5,80,124.5,87.5,121.5,93,113,101,158,146,157.5,183,46,183,12.5,147],
        [29.5,-13,31.5,-17,30.5,-22,27,-25,20.5,-24,17.5,-18,19,-14,25,-11],
        [43,15,46,9.5,44.5,5.5,41,3,36.5,3,32,8,33,12.5,36.5,16],
        [70.5,43,73.5,37,72,33,68.5,30.5,64,31,60,34,60.5,41,64,44],
        [116,89,118.5,84.5,118,80,114,77,107.5,78,105,83.5,106,87.5,112,90.5],
        [29,-50,31.5,-54,31,-58.5,27,-61.5,20.5,-60.5,18,-55,19,-51,25,-48],
        [44,-76.5,46.5,-80.5,45.5,-85.5,42,-88.5,35.5,-87.5,32.5,-82,34,-78,39.5,-75],
        [71.5,-103.5,74,-107,73,-113.5,69.5,-116,64.5,-116,60,-110.5,61,-105.5,64.5,-102.5],
        [117.5,-149.5,120,-154,119.5,-158.5,115.5,-161.5,109,-161,106,-155,107.5,-151,113,-148],
    ],
    sealink: [[12,-74,-7,-73,-5,-31.5,-19,-14.5,-11,-7.5,-3.5,0.5,0,74,19,73]], // w54139654 (anchor 47.4452089, -122.2969786)
    thelandmark: [[19.5,-19,-19,-19.5,-19.5,19.5,2,19.5,2,2,19,2.5]], // w546500235 The Landmark Corp B (UiPath, Vasile Alecsandri 4), anchor 44.450012, 26.0946079
    europehouse: [[-34.5,-23.5,-31,-21,-36.5,-13,-7,8,-10,13,14.5,29,24.5,31,32,31,36.5,29.5,29,24,35.5,15,-29.5,-31]], // w246115249 (anchor 44.4511557, 26.087697)
    // CV-stop buildings (round 5), OSM API geometry 2026-11-07, model frame = bbox centre (+x east, +z south)
    gts: [[7,-9.5,4,-10,4,-11.5,1.5,-11.5,1.5,-13.5,-2.5,-15,-6.82,12.81,-5.81,14.11,3.5,15]],   // street-west corner canted at 45° (photos)                       // w245117704 Calea Călărașilor 101 (LMI B-II-m-B-18379), bbox centre 44.433441, 26.1176015
    rosetti: [[-16.5,-29,26.5,-18.5,14.5,29,-26.5,19,-23.5,7.5,5,14.5,11,-10,-19,-17.5]],            // w28240279 Liceul C.A. Rosetti, Garibaldi 11 (3 levels), bbox centre 44.4671565, 26.106133
    rosettiHall: [[-22.5,-81.5,23,-71.2,15.9,-40,-29.6,-50.3]],                                      // w545176891 the school's sports hall (OSM building=yes, no tags), same frame
    rosettiGym: [[-44.8,-31.9,-50.7,-5.5,-37.3,-2.5,-31.4,-28.9]],                                   // w544207404 the school gym (OSM building=yes, no tags), same frame
    bob: [[-72.5,-3.5,-46,56,72.5,3.5,46,-56,-11,-30.5,-12,-30]],                                    // w55450549 BOB Tower, Pompeiu 6A, bbox centre 44.479608, 26.1147802
    rectorat: [[-16.5,-29,28.5,-17.5,22,8.5,17,29,-28.5,17,-23.5,-4,-19,-20.5]],                     // w28240552 Rectorat UPB (5 levels), bbox centre 44.438429, 26.0515105
    halatraian: [[-10,-20,-14,17,10,20,12,1.5,14,-17]], // w35147215 (anchor 44.4333566, 26.120567)
    globalworth: [[-33,-25,-12,25,24,10.5,20,1.5,33,-4,28,-16.5]], // w547396774 (anchor 44.4792401, 26.1024141)
};

/** quad on the outside of segment a->b (outward normal n = [nx, nz]) from y0 to y1, pushed out by off */
function facadeQuad(b, a, c, y0, y1, col, mat, n, off = 0.1) {
    const ox = n[0] * off, oz = n[1] * off;
    b.quad([a[0] + ox, y0, a[1] + oz], [c[0] + ox, y0, c[1] + oz], [c[0] + ox, y1, c[1] + oz], [a[0] + ox, y1, a[1] + oz], col, mat, [n[0], 0, n[1]]);
}
/** outward normal of edge i of polygon p */
function edgeN(p, i) { const s = signedArea(p) > 0 ? 1 : -1, a = p[i], c = p[(i + 1) % p.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1; return [s * (c[1] - a[1]) / L, -s * (c[0] - a[0]) / L]; }
/** index of the polygon edge whose outward normal is closest to direction d (e.g. [-1, 0] = west face) and that is at least minL long */
function faceEdge(p, d, minL = 6) { let best = 0, bd = -2; for (let i = 0; i < p.length; i++) { const a = p[i], c = p[(i + 1) % p.length]; if (Math.hypot(c[0] - a[0], c[1] - a[1]) < minL) continue; const n = edgeN(p, i), k = n[0] * d[0] + n[1] * d[1]; if (k > bd) { bd = k; best = i; } } return best; }

/**
 * Modern curtain-wall tower: spandrel-coloured prism with one glass ribbon per floor (2 tris per edge per floor),
 * optional vertical mullion fins and a parapet/crown screen. o = { glass, spandrel, mullion, pitch, fh, frac, crown, crownH, top }
 */
function curtainTower(b, p, y0, y1, o = {}) {
    const fh = o.fh || 3.9;
    b.prism(p, y0, y1, o.spandrel || '#c8ced3', { topCol: o.top || '#9ca3a8' });
    b.bands(p, y0, y1 - 0.4, fh, o.glass || '#7f97ad', { frac: o.frac ?? 0.62, off: 0.07, mat: o.glassMat || 'g', start: o.start ?? fh * 0.25, wall: null });
    if (o.mullion) b.pilasters(p, y0, y1, o.pitch || 4.5, o.mw || 0.22, o.md || 0.22, o.mullion, {});
    if (o.crown) {
        const h = o.crownH || 6;
        b.ring(offset(p, 0.05), y1, y1 + h, o.crown, { mat: o.crownMat || 'm' });
        b.ring(offset(p, -0.25), y1, y1 + h, o.crown, { mat: o.crownMat || 'm', inward: true });
        if (o.louvres) for (let y = y1 + 0.8; y < y1 + h - 0.4; y += o.louvres) b.ring(offset(p, 0.18), y, y + 0.22, o.louvreCol || '#7c7f81');
    }
}

// ---------------------------------------------------------------------------
// Lincoln Square (The Bellevue Collection, Kemper Development) — north block, R12.6b hero + final CV stop.
// UiPath Bellevue: Lincoln Square North office tower, 700 Bellevue Way NE, Suite 2000 (two floors, 44,735 sq ft,
// since Sept 2025 — uipath.com/about-us/offices, GeekWire 2025). Tower 126 m / 28 floors (2005); staff entrance =
// OSM entrance node 7945526075 (47.61723, -122.20148) on the Bellevue Way frontage just south of NE 8th, facing west.
// One Lincoln Tower (Westin Bellevue + condos) 137 m / 42 floors with white "WESTIN" on the west face of the crown.
// 3-level retail podium (10455 NE 8th St: Cinemark Reserve, Din Tai Fung, Earls, Paddy Coyne's…), brick-toned masonry
// #b57f52 above storefront glazing. Skybridges (OSM): over Bellevue Way to Bellevue Square (w43872832, 2007, ~32 m),
// diagonally over NE 8th to Bellevue Place / Hyatt (w43872826 + bridge building w1364249504, ~56 m), over NE 6th to
// Lincoln Square South (w516915099, ~22 m). Colours: LSN glass #7f97ad, spandrel #c8ced3, mullion #9aa1a6, crown
// #5f6163; One Lincoln glass #6f786f, frame #4f5550, balcony glass #8b9590, crown #76807a (photo-sampled, research).
// No exterior UiPath sign exists in open sources -> generic tenant signage only ("700", "LINCOLN SQUARE NORTH").
// Src: game/research/seattle-bellevue.json landmarks[lincoln-square] ; en.wikipedia.org/wiki/List_of_tallest_buildings_in_Bellevue,_Washington ;
//      OSM w604028609 / w604028611 / w328017119 / w161929514 / w1474737770 / w1364249504 ; refs/bellevue/Lincoln_Square_Office_Tower_and_One_Lincoln_Tower.jpg
function bLincolnN(b) {
    // P2.lincoln coordinates are relative to 47.6164962, -122.2008984; this entry's anchor (A.lincoln) sits 10 m W / 40 m N of it
    // so that the suppression radius covers the tower, the podium and the uipath-bel door point but not the Paccar building.
    b.shift(10, 40);
    const [lsn,pod,br8]=['w604028609','w161929514','w1364249504'].map(id=>U[id]);
    const BRICK = '#b57f52', STONE = '#d8cbb2', SHOP = '#33414b', DK = '#2b3034', GLOW = '#f2dcae';
    // --- retail podium (3 levels, ~16 m): storefronts at grade, brick-toned masonry + stone bands above
    b.wall = BRICK;
    b.prism(pod, 0, 16, BRICK, { topCol: '#8e8a84' });
    b.prism(offset(pod, 0.15), 0, 5.2, SHOP, { mat: 'g', top: false });                    // storefront glazing
    b.cornice(pod, 5.2, 0.7, 0.45, STONE); b.cornice(pod, 15.2, 0.9, 0.5, STONE);
    b.bands(pod, 6.4, 15, 4.3, '#3c4850', { frac: 0.5, pitch: 6, wall: BRICK });           // L2/L3 windows split by brick piers
    for (let i = 0; i < pod.length; i++) {                                                  // sidewalk canopies on the street faces
        const a = pod[i], c = pod[(i + 1) % pod.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 12) continue;
        const n = edgeN(pod, i); if (n[1] > 0.7) continue;                                  // not on the inner (south) court side
        const mx = (a[0] + c[0]) / 2 + n[0] * 1.4, mz = (a[1] + c[1]) / 2 + n[1] * 1.4;
        b.box(mx, 4.3, mz, L * 0.8, 0.35, 2.8, '#4a4f53', { ry: -Math.atan2(c[1] - a[1], c[0] - a[0]) });
    }
    b.text('LINCOLN SQUARE', -31, 10.2, -87.85, Math.PI, 1.4, '#f3efe6');                       // NE 8th St face (north)
    // --- Lincoln Square North tower (UiPath): 126 m = lobby + 27 office floors (3.95 m) + recessed top + louvred crown
    curtainTower(b, lsn, 0, 112, { glass: '#7f97ad', spandrel: '#c8ced3', mullion: '#9aa1a6', pitch: 3.1, fh: 3.95, start: 9, frac: 0.6 });
    const lt = offset(lsn, -1.2);
    curtainTower(b, lt, 112, 120, { glass: '#5f7385', spandrel: '#8f979d', fh: 3.95, start: 0.6, frac: 0.66 });
    b.ring(offset(lsn, -0.4), 120, 126, '#5f6163'); b.cap(offset(lsn, -0.4), 126, '#6b6e70');
    for (let y = 120.6; y < 125.6; y += 0.9) b.ring(offset(lsn, -0.25), y, y + 0.25, '#7d8083');   // louvres
    // --- the UiPath / tower lobby on Bellevue Way (west, at the entrance node): double-height glazing with a warm glow,
    //     following the podium edge (-41.5,-85) -> (-45,-77.5) -> (-46,-68.5)
    const LP = [[-41.5, -85], [-45, -77.5], [-46, -68.5]];
    for (let i = 0; i + 1 < LP.length; i++) {
        const a = LP[i], c = LP[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = [-(c[1] - a[1]) / L, (c[0] - a[0]) / L];
        if (n[0] > 0) { n[0] = -n[0]; n[1] = -n[1]; }                                       // outward = west
        facadeQuad(b, a, c, 0.2, 8.4, GLOW, 'e', n, 0.52);
        const k = Math.max(2, Math.round(L / 2.1));
        for (let j = 0; j <= k; j++) { const t = j / k; b.box(a[0] + (c[0] - a[0]) * t + n[0] * 0.66, 0, a[1] + (c[1] - a[1]) * t + n[1] * 0.66, 0.2, 8.6, 0.25, DK); }   // mullions
        for (const [y, w, h, col] of [[4.3, 0.22, 0.22, DK], [8.7, 0.45, 0.5, '#9aa1a6']]) b.strut([a[0] + n[0] * 0.66, y, a[1] + n[1] * 0.66], [c[0] + n[0] * 0.66, y, c[1] + n[1] * 0.66], w, h, col);
    }
    const ex = -43.27, ez = -81.2, en = [-0.906, -0.423], ery = Math.atan2(en[0], en[1]);  // OSM entrance node 7945526075 (on the first segment)
    const EW = (lx, lz) => [ex + lx * en[1] + lz * en[0], ez - lx * en[0] + lz * en[1]];  // entrance frame: +x along the facade, +z outward
    b.push(M(ex, 0, ez, ery));
    b.box(0, 8.9, 2.6, 9, 0.45, 5.4, '#e4e6e7');                                             // entrance canopy
    b.box(0, 8.6, 5.25, 9.4, 0.75, 0.3, '#4d5357');                                          // canopy fascia
    b.cyl(0, 0, 0.75, 1.5, 1.5, 3, '#9aa7ae', 10, { mat: 'g' }); b.cyl(0, 3, 0.75, 1.6, 1.6, 0.3, '#3a3f42', 10);   // revolving door
    for (const s of [-1, 1]) b.box(s * 3.2, 0, 0.55, 2.2, 2.9, 0.12, '#adbcc4', { mat: 'g' });          // side doors
    b.box(-5.8, 0, 3.6, 1.2, 1.5, 0.5, '#c9c2b3');                                          // address plinth
    b.pop();
    { const q = EW(0, 5.42); b.text('LINCOLN SQUARE NORTH', q[0], 8.68, q[1], ery, 0.5, '#f4f4f2', { d: 0.02 }); }
    { const q = EW(-5.8, 3.86); b.text('700', q[0], 0.55, q[1], ery, 0.6, '#2e3338', { d: 0.02 }); }
    // --- skybridges (enclosed glass boxes on light-grey steel)
    skybridge(b, [-45.4, -28.1], [-76.1, -20.8], 6.2);                                                // over Bellevue Way to Bellevue Square
    // The landing remains the real Bellevue Square source footprint; do not invent
    // a detached retail block to meet this bridge.
    b.prism(br8, 6.6, 11, '#8fb0c2', { mat: 'g', bottom: true, topCol: '#d9dcdd' });         // diagonal NE 8th St bridge (w1364249504)
    b.cornice(br8, 6.6, 0.5, 0.25, '#d9dcdd'); b.cornice(br8, 10.8, 0.5, 0.3, '#d9dcdd');
    b.colPolygon(pod, { y1: 16 });                                                                   // (skybridge spans have no collision)
}
/** glazed skybridge box on a light steel frame between two plan points at floor height y */
function skybridge(b, a, c, y, w = 5, h = 4.2) {
    b.strut([a[0], y + h / 2, a[1]], [c[0], y + h / 2, c[1]], w, h, '#8fb0c2', 'g');
    b.strut([a[0], y - 0.35, a[1]], [c[0], y - 0.35, c[1]], w + 0.5, 0.7, '#d9dcdd');
    b.strut([a[0], y + h + 0.25, a[1]], [c[0], y + h + 0.25, c[1]], w + 0.6, 0.5, '#d9dcdd');
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(2, Math.round(L / 4));
    for (let k = 0; k <= n; k++) { const t = k / n, x = a[0] + (c[0] - a[0]) * t, z = a[1] + (c[1] - a[1]) * t; for (const s of [-1, 1]) { const ux = -(c[1] - a[1]) / L * s * (w / 2 + 0.05), uz = (c[0] - a[0]) / L * s * (w / 2 + 0.05); b.strut([x + ux, y, z + uz], [x + ux, y + h, z + uz], 0.18, 0.18, '#e6e8e9'); } }
}

// One Lincoln Tower + Westin Bellevue (Lincoln Square, 2005) — 137 m / 42 floors: Westin hotel floors 4-~10, condos above;
// green-grey glass #6f786f, dark frame #4f5550, stacked glass balconies #8b9590 on the condo floors, crown #76807a with white
// "WESTIN" letters on its west face (photo refs/bellevue/Lincoln_Square_Office_Tower_and_One_Lincoln_Tower.jpg); 2-level Westin
// entrance podium (600 Bellevue Way NE), level 2-3 connector to the retail podium, skybridge over NE 6th to Lincoln Square South.
// Src: game/research/seattle-bellevue.json landmarks[lincoln-square].complex ; OSM w604028611 / w328017119 / w1474737770 / w516915099
function bOneLincoln(b) {
    b.shift(-0.89, -59.21);                                                                 // P2.lincoln coordinates -> this anchor
    const [one,westin,conn]=['w604028611','w328017119','w1474737770'].map(id=>U[id]);
    // --- Westin podium (2 levels) + One Lincoln Tower (137 m: hotel floors 4-~10, condos above)
    b.prism(westin, 0, 10.5, '#c9bfae', { topCol: '#7f9c6c' });
    b.prism(offset(westin, 0.12), 0, 4.8, '#37444d', { mat: 'g', top: false });
    b.cornice(westin, 4.8, 0.6, 0.4, '#e2dccf'); b.bands(westin, 5.6, 10.2, 4.4, '#3f4b52', { frac: 0.55, wall: null });
    b.prism(conn, 7, 15.5, '#bfb6a6', { bottom: true, topCol: '#8e8a84' }); b.bands(conn, 7, 15.5, 4.2, '#3f4b52', { frac: 0.5, wall: null });
    b.text('THE WESTIN', -44.7, 6.2, 70, -Math.PI / 2, 1.1, '#f6f3ec');
    curtainTower(b, one, 10.5, 131, { glass: '#7a847c', glassMat: 'm', spandrel: '#adb1a9', mullion: '#4f5550', pitch: 4.2, fh: 3.05, frac: 0.7, start: 0.6 });
    for (let y = 40; y < 129; y += 3.05) {                                                   // stacked glass balconies (south + east faces of the condo floors)
        b.box(37, y, 81.9, 14, 0.18, 1.8, '#c9ccc8'); b.box(37, y + 0.18, 82.75, 14, 1.0, 0.06, '#8b9590', { mat: 'g' });
        b.box(46.1, y, 72, 1.8, 0.18, 16, '#c9ccc8'); b.box(47, y + 0.18, 72, 0.06, 1.0, 16, '#8b9590', { mat: 'g' });
    }
    b.ring(offset(one, 0.06), 131, 137, '#76807a'); b.ring(offset(one, -0.3), 131, 137, '#76807a', { inward: true }); b.cap(offset(one, -0.3), 133, '#6b706c');
    b.text('WESTIN', -13.6, 132.2, 72, Math.atan2(-0.986, -0.164), 2.6, '#ffffff');                          // white letters, west face of the crown
    skybridge(b, [14.8, 85.9], [11.7, 108], 6.2, 5, 4.6);                                 // over NE 6th to Lincoln Square South
    b.colPolygon(westin, { y1: 10.5 }); b.colPolygon(one, { y0: 10.5, y1: 137 }); b.colPolygon(conn, { y0: 7, y1: 15.5 });
}

// Lincoln Square South (2017, Kemper) — 400 Lincoln Square office tower 137 m / 31 fl. (blue-grey glass #6e8a9e,
// fine silver mullions #b9c0c4, stepped crown) and Two Lincoln Tower (W Bellevue hotel + residences, 137 m / 42 fl.,
// glass #6b7c86 with balcony bands, W hotel sign at the base on NE 6th St) on the 3-level podium at 500 Bellevue Way NE.
// Src: game/research/seattle-bellevue.json (complex[]) ; OSM w1326151866 / w604028603 / w1326151868 ; skyscrapercenter.com/building/400-lincoln-square/22497
function bLincolnS(b) {
    const [t400,two,pod]=['w1326151866','w604028603','w1326151868'].map(id=>U[id]);
    b.wall = '#b9ac98';
    b.prism(pod, 0, 15.5, '#b9ac98', { topCol: '#8a8781' });
    b.prism(offset(pod, 0.15), 0, 5, '#33414b', { mat: 'g', top: false });
    b.cornice(pod, 5, 0.6, 0.4, '#ddd5c6'); b.cornice(pod, 14.8, 0.8, 0.45, '#ddd5c6');
    b.bands(pod, 6.2, 14.6, 4.2, '#3c4850', { frac: 0.5, pitch: 6, wall: '#b9ac98' });
    // 400 Lincoln Square: 31 office floors from level 4, stepped glass crown
    curtainTower(b, t400, 15.5, 128, { glass: '#6e8a9e', spandrel: '#7f96a6', mullion: '#b9c0c4', pitch: 1.6, mw: 0.12, md: 0.18, fh: 3.75, frac: 0.78, start: 0.4 });
    const c1 = offset(t400, -2.5); b.prism(c1, 128, 133, '#6e8a9e', { mat: 'g', topCol: '#9fa8ad' }); b.pilasters(c1, 128, 133, 1.6, 0.12, 0.18, '#b9c0c4', {});
    const c2 = offset(t400, -6); b.ring(c2, 133, 137, '#879fb0', { mat: 'g' }); b.cap(c2, 134, '#8e9498');
    // Two Lincoln Tower: glass with continuous balcony slab edges
    curtainTower(b, two, 15.5, 131, { glass: '#6b7c86', spandrel: '#e2e4e2', fh: 3.0, frac: 0.78, start: 0.3 });
    b.ring(offset(two, 0.05), 131, 137, '#7c8b94', { mat: 'g' }); b.cap(offset(two, -0.3), 133, '#8e9498');
    b.box(18, 6, -85.8, 9, 3, 0.4, '#141414'); b.text('W BELLEVUE', 18, 6.8, -86.05, Math.PI, 1.2, '#f2f2f2');   // W hotel at the base on NE 6th St
    b.colPolygon(pod, { y1: 16 });
}

// Plaza Center (10900 NE 8th St, 1982) — UiPath's Bellevue office from 2018 to Sept 2025 (Suite 400), a passing landmark
// with a story caption. 68 m / 16 floors, rectangle ≈ 35 x 60 m with notched corners (OSM w33725899), long axis N-S,
// set back behind a plaza on the north side of NE 8th. Facade (CC0 photo 2026-10-26): full-height ivory precast piers
// #ddd6bf alternating with continuous dark glass strips #2f3338 (~1 m pier / ~1.6 m glass), ivory parapet, recessed black
// glazed ground floor #1a1b1d with "10900" over the doors and a U.S. Bank branch, small dark "PLAZA CENTER" letters near
// the top of the NE 8th face, and a tall black pylon with huge vertical white numerals "10900" at the west driveway.
// Src: game/research/seattle-bellevue.json landmarks[plaza-center] ; OSM w33725899 ; refs/bellevue/Plaza_Center_Bellevue_WA.jpg
function bPlazaCenter(b) {
    const p = U.w33725899, IV = '#ddd6bf', GL = '#2f3338', BK = '#1a1b1d';
    b.prism(p, 5.6, 66, GL, { mat: 'g', topCol: '#8f8a7e' });
    b.prism(offset(p, -1.2), 0, 5.6, BK, { mat: 'g', top: false });                          // recessed black ground floor
    b.ring(p, 5.2, 5.6, IV); b.cap(p, 5.2, '#3a3b3d', [offset(p, -1.2)], -1);                 // soffit
    b.pilasters(p, 5.6, 66, 2.6, 1.0, 0.32, IV, {});                                          // full-height ivory piers
    b.ring(offset(p, 0.33), 66, 68.2, '#d8d1bb'); b.lip(p, offset(p, 0.33), 68.2, '#cfc8b2', 1); // plain parapet band
    b.ring(p, 66, 68.2, '#d8d1bb');
    for (const [x, z] of [[-17.5, -30], [17.5, -30], [-17.5, 30], [17.5, 30]]) b.box(x * 0.94, 0, z * 0.95, 1.2, 5.6, 1.2, IV);   // corner piers at grade
    // NE 8th St (south) frontage: entrance under "10900", U.S. Bank branch, PLAZA CENTER near the top (east end)
    const zf = 30.4;
    b.box(-4, 0, zf - 1.1, 7, 3.2, 0.2, '#56636c', { mat: 'g' });
    b.text('10900', -4, 3.7, zf - 0.9, 0, 0.7, '#f4f4f4');
    b.box(6.5, 3.4, zf - 1.0, 4.6, 1.1, 0.12, '#ffffff'); b.text('U.S. BANK', 6.5, 3.55, zf - 0.92, 0, 0.7, '#c8102e');
    b.box(-4, 3.6, zf + 1.2, 8, 0.3, 3.2, '#2a2b2d');                                         // entrance canopy
    b.text('PLAZA CENTER', 11.5, 62.4, zf + 0.25, 0, 0.8, '#3a3a38');
    // "10900" pylon at the west driveway: tall black slab, vertical white numerals facing NE 8th and west
    const px = -25, pz = 26;
    b.box(px, 0, pz, 2.4, 12, 1.6, '#151617');
    [...'10900'].forEach((ch, i) => { const y = 10.1 - i * 2.05; b.text(ch, px, y, pz + 0.8, 0, 1.75, '#f2f2f2'); b.text(ch, px - 1.2, y, pz, -Math.PI / 2, 1.75, '#f2f2f2'); });
    for (const [x, z] of [[-10, 38], [3, 38], [16, 38]]) b.box(x, 0, z, 3, 0.7, 3, '#8c867a');   // plaza planters (the world plants the street trees)
    b.colPolygon(p, { y1: 68.2 }); b.col(px, pz, 1.2, 0.8);
}

// Amazon Sonic (555 108th Ave NE, ex-"555 Tower", 2023) — 183 m / 42 floors, joint tallest in Bellevue; OSM main part
// w1214424283 (42 levels), north slab w1556489725 (32 levels ≈ 125 m), base w1214423752 (3 levels). The research only
// notes "the tallest dark-glass block" seen from the Murrow bridge: dark blue-grey glass, fine mullions (estimated).
// Src: en.wikipedia.org/wiki/List_of_tallest_buildings_in_Bellevue,_Washington (600 ft, 42 fl.) ; OSM w1214424283/w1556489725/w1214423752
function bSonic(b) {
    const [main,slab,base]=['w1214424283','w1556489725','w1214423752'].map(id=>U[id]);
    b.prism(base, 0, 13, '#3d4852', { mat: 'g', topCol: '#7c8a6c' }); b.cornice(base, 12.4, 0.6, 0.3, '#c9ced2');
    curtainTower(b, main, 13, 177, { glass: '#3b4c5c', spandrel: '#44525e', mullion: '#9aa4ad', pitch: 3, mw: 0.14, fh: 4.1, frac: 0.82, start: 0.3 });
    b.ring(offset(main, 0.05), 177, 183, '#4c5d6d', { mat: 'g' }); b.cap(offset(main, -0.3), 178.5, '#6f777d');
    curtainTower(b, slab, 13, 124.8, { glass: '#3b4c5c', spandrel: '#44525e', mullion: '#9aa4ad', pitch: 3, mw: 0.14, fh: 3.9, frac: 0.82, start: 0.3 });
    b.colPolygon(base, { y1: 13 });
}

// Bellevue 600 (2025) — 183 m / 43 floors residential tower, joint tallest in Bellevue (OSM w1453402305). No facade
// research: light blue-grey glass with white slab edges (estimated, low confidence).
// Src: en.wikipedia.org/wiki/List_of_tallest_buildings_in_Bellevue,_Washington ; OSM w1453402305
function bBellevue600(b) {
    // Complete mapped podium and the 183 m / 43-level tower. Storey heights of
    // low podium parts are explicit 4.2 m estimates where OSM gives only levels.
    const p=U.w1453402305;
    for(const id of ['w1474780170','w1474780171','w1474780172','w1474780173']){const q=U[id],h=+UT[id]['building:levels']*4.2;b.prism(q,0,h,'#c4c8c7',{topCol:'#858e86'});b.bands(q,0,h,4.2,'#536b7b',{frac:.72,mat:'g'});b.colPolygon(q,{y1:h});}
    curtainTower(b,p,0,178,{glass:'#7b93a3',spandrel:'#b5c1c7',mullion:'#c9d0d4',pitch:3.5,fh:4.05,frac:0.82,start:6});
    b.ring(offset(p,0.05),178,183,'#8aa1af',{mat:'g'});b.cap(offset(p,-0.3),179.5,'#8e9498');b.colPolygon(p,{y1:183});
}

// Lacey V. Murrow Memorial Bridge (1940 / rebuilt 1993) — the "high-rise" through-arch spans at both ends of the
// floating bridge that the I-90 eastbound lanes drive through: cream-white concrete arch ribs on each side that lean in
// and are tied at the crown by flattened elliptical ring braces, ~8 dark steel hangers per side. Colour #c9c0ae.
// The bridge deck itself is the world's road; this is only the arch structure, anchored on the carriageway centreline
// (world edge "I-90 — Lacey V. Murrow Memorial Bridge", 4 lanes, 14.8 m) and rotated to the road heading.
// Src: game/research/seattle-bellevue.json landmarks[murrow-high-rise-arches] ; en.wikipedia.org/wiki/Lacey_V._Murrow_Memorial_Bridge ;
//      refs/bellevue/I-90_headed_east_from_Seattle_-_west_high-rise.jpg, ..._east_high-rise.jpg, Interstate_90_bridge_over_Lake_Washington_-_east_highrise_from_the_west.jpg
function bMurrow(b) {
    const CR = '#d6cdb9', HG = '#3b3f43', L = 64, H = 13.5;                                  // research #c9c0ae (sunlit photo #b8a68b) — lifted for the flat shading
    const zb = 11.4, zt = 9.4;                                                              // rib lateral offset at deck / at crown (lean in)
    for (const s of [-1, 1]) {
        const prof = [[-L / 2, 0, zb], [-L / 2 + 7, 9.5, zb - 1.3], [-L / 2 + 12.5, H, zt], [L / 2 - 12.5, H, zt], [L / 2 - 7, 9.5, zb - 1.3], [L / 2, 0, zb]];
        for (let i = 0; i + 1 < prof.length; i++) { const a = prof[i], c = prof[i + 1]; b.strut([a[0], a[1], s * a[2]], [c[0], c[1], s * c[2]], 1.5, 1.9, CR); }
        b.box(-L / 2, -1.5, s * zb, 4, 2.3, 3.2, '#b9b2a2'); b.box(L / 2, -1.5, s * zb, 4, 2.3, 3.2, '#b9b2a2');   // rib seats on the pontoon
        for (let k = 0; k < 8; k++) { const x = -L / 2 + 12.5 + (k + 0.5) * (L - 25) / 8; b.strut([x, 0.6, s * (zt + 0.4)], [x, H - 0.8, s * zt], 0.35, 0.35, HG); }
        for (const x of [-L / 2 + 9.5, L / 2 - 9.5]) b.strut([x, 0.6, s * (zb - 0.6)], [x, 10.6, s * (zb - 1.6)], 0.35, 0.35, HG);
    }
    // three flattened elliptical crown rings tie the ribs together across the road (oval hole in each)
    const ringGeo = (() => {
        const sh = new THREE.Shape(), hole = new THREE.Path(), W = zt + 1, D = 3.4, w2 = W - 2.4, d2 = 1.6;
        sh.absellipse(0, 0, W, D, 0, Math.PI * 2, false, 0); hole.absellipse(0, 0, w2, d2, 0, Math.PI * 2, true, 0); sh.holes.push(hole);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 1.3, bevelEnabled: false, curveSegments: 14 }); g.rotateX(Math.PI / 2); return g;
    })();
    for (const x of [-L / 2 + 13.5, 0, L / 2 - 13.5]) b.geo(ringGeo, CR, M(x, H + 0.9, 0, Math.PI / 2));
    for (const s of [-1, 1]) for (const x of [-L / 2, L / 2]) b.col(x, s * zb, 2.2, 1.6);
}

// Sea-Tac Airport parking garage (Port of Seattle, OSM rel 15763840: 7 levels, multi-storey, covered) — 12,100 spaces,
// "North America's largest parking structure under one roof". Precast decks with light-grey spandrel bands #a9a8a2 and
// open sides; eight round light wells / helices (OSM inner rings). Level 4 connects to the terminal by the six enclosed
// Skybridges 1-6 over Arrivals / Departures Drive (OSM w37017724-29, level 4, ~33-40 m) and to the Link station.
// Floor-to-floor ~3.05 m -> level 4 floor at 9.2 m (clears the world's elevated Departures Drive, deck <= 3.8 m).
// Src: game/research/seattle-seatac.json landmarks[sea-garage] ; en.wikipedia.org/wiki/Seattle–Tacoma_International_Airport ;
//      OSM rel 15763840, w37017724-w37017729 ; Commons "SeaTacAerial.jpg" (Bernstea, CC BY-SA 4.0, reference only)
function bSeaGarage(b) {
    const source=U.r15763840, outer=source.find(q=>q.role==='outer').poly, holes=source.filter(q=>q.role==='inner').map(q=>q.poly), G1 = '#a9a8a2', IN = '#4a4c4f', FH = 3.05;
    b.prism(outer, 0, 7 * FH, IN, { holes, topCol: '#8d8c88', holeCol: '#77787a' });
    for (let k = 0; k <= 7; k++) { const y = k * FH; b.ring(offset(outer, 0.12), Math.max(0, y - 0.95), y + 0.05, G1); }   // spandrel at each deck edge
    b.ring(offset(outer, 0.12), 7 * FH + 0.05, 7 * FH + 1.1, '#b5b4ae');                       // roof parapet
    for (const h of holes) b.ring(offset(h, -0.1), 0, 7 * FH + 1.1, '#9d9c97', { inward: true });
    b.pilasters(outer, 0, 7 * FH, 9.5, 0.7, 0.3, '#b2b1ab', {});                              // precast columns
    for (const [x, z] of [[-40, -120], [30, -150], [-100, -60], [80, 130], [10, 90]]) b.box(x, 7 * FH, z, 9, 3.2, 7, '#9fa09c');   // stair / lift towers
    // Skybridges 1-6 (level 4) from the garage face to the terminal
    const SKY = [[-88.0, -166.6, -64.8, -143.0], [-111.2, -97.1, -134.1, -120.8], [-153.8, -53.2, -184.2, -68.0], [-184.1, -6.6, -154.0, -21.6], [-112.6, 22.0, -136.0, 46.4], [-54.6, 137.5, -29.5, 106.5]];
    const y = 3 * FH;
    for (const [x0, z0, x1, z1] of SKY) {
        b.strut([x0, y + 2.1, z0], [x1, y + 2.1, z1], 6.5, 3.6, '#7f9fb3', 'g');
        b.strut([x0, y - 0.45, z0], [x1, y - 0.45, z1], 7, 0.9, '#e1e3e4');
        b.strut([x0, y + 4.25, z0], [x1, y + 4.25, z1], 7.3, 0.7, '#e1e3e4');
    }
    b.colPolygon(outer, { holes, y1: 7 * FH + 1.1 });
}

// SeaTac/Airport Link light-rail station (Sound Transit 1 Line, opened 2009-12-19) — island platform elevated 60 ft
// (18 m) under a white steel-truss roof with a flight theme (David Hewitt); concourse below; west pedestrian bridge to
// garage level 4 (then the 1,200 ft covered walkway to the terminal) and an east bridge over the Airport Expressway to
// International Blvd (OSM w54139652). Footprint OSM w54139654, platform w226892390. Piers on the centreline (clear of
// the expressway ramps that run under the station). The west bridge is not in the OSM extract: approximate, from the
// photo "SeaTac Airport station from airport parking garage" (SounderBruce, CC BY-SA 4.0, reference only).
// Src: game/research/seattle-seatac.json landmarks[seatac-airport-station] ; en.wikipedia.org/wiki/SeaTac/Airport_station ; OSM w54139654 / w226892390 / w54139652
function bSeaLink(b) {
    const CON = '#cdcac3', WH = '#f1f2f2', GL = '#6f8796';
    const z0 = -74, z1 = 74, W = 19, yP = 18; // Sound Transit / research: platform elevated 60 ft
    b.push(M(6, 0, 0, Math.atan2(7, 148)));                                                   // guideway axis (platform w226892390 runs 2.7° off north)
    for (let z = z0 + 6; z <= z1 - 6; z += 18.5) { b.box(0, 0, z, 2.2, yP - 1.2, 3.2, CON); b.box(0, yP - 1.6, z, 14, 1.4, 3.4, CON); }
    b.box(0, yP - 1.2, 0, W, 1.2, z1 - z0, CON);                                              // platform / guideway deck
    b.box(0, yP, 0, 8, 1.0, z1 - z0 - 4, '#bdb9b1');                                          // island platform
    for (const s of [-1, 1]) b.box(s * 8.6, yP, 0, 0.3, 1.1, z1 - z0, '#9aa0a4');          // parapets
    b.box(-5, 8.6, -6, 15, 4.8, 44, GL, { mat: 'g' }); b.box(-5, 8.2, -6, 15.6, 0.5, 44.6, CON); b.box(-5, 13.4, -6, 15.6, 0.4, 44.6, CON);   // concourse
    // flight-theme roof: translucent canopy on a row of white V-trusses
    b.box(0, yP + 7.8, 0, W + 4, 0.35, z1 - z0 - 10, '#dfe7eb', { mat: 'g' });
    for (let z = z0 + 6; z <= z1 - 6; z += 9.25) {
        for (const s of [-1, 1]) { b.strut([s * 1.2, yP + 1, z], [s * 11.5, yP + 9.2, z], 0.35, 0.35, WH); b.strut([s * 11.5, yP + 9.2, z], [0, yP + 11.5, z], 0.3, 0.3, WH); }
        b.strut([0, yP + 1, z], [0, yP + 11.5, z], 0.3, 0.3, WH);
    }
    for (const x of [-11.5, 0, 11.5]) b.strut([x, yP + 9.2 + (x === 0 ? 2.3 : 0), z0 + 6], [x, yP + 9.2 + (x === 0 ? 2.3 : 0), z1 - 6], 0.3, 0.3, WH);   // chords
    b.box(0, yP + 2.6, z1 - 4.1, 13, 1.9, 0.3, '#1d4f91');
    b.pop();
    { const r = Math.atan2(7, 148); b.text('SEATAC/AIRPORT', 6 + 70.05 * Math.sin(r), yP + 3, 70.05 * Math.cos(r), r, 1.1, '#ffffff'); }
    // bridges at concourse level (9 m): east over the Airport Expressway (OSM w54139652), west to the garage (approx.)
    const br = (a, c) => { b.strut([a[0], 10.6, a[1]], [c[0], 10.6, c[1]], 5.5, 3.6, '#8aa5b5', 'g'); b.strut([a[0], 8.5, a[1]], [c[0], 8.5, c[1]], 6, 0.7, CON); b.strut([a[0], 12.7, a[1]], [c[0], 12.7, c[1]], 6.4, 0.5, WH); };
    br([13, -55], [73.4, -58.3]);
    br([-3.5, -10], [-46, 8]);
    for (let z = z0 + 6; z <= z1 - 6; z += 18.5) b.col(6 + z * 7 / 148, z, 1.4, 1.8, Math.atan2(7, 148));
}

// ---- CV-stop helpers: a real entrance (door, surround, optional canopy) on the facade point nearest (px, pz), and a
// small tenant plate beside it (lines of 5x7 text) — door signs / plaques, never billboards (owner note 39).
function nearestFacade(p, px, pz) {
    let best = null;
    for (let i = 0; i < p.length; i++) {
        const a = p[i], c = p[(i + 1) % p.length], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz); if (L < 2) continue;
        const t = Math.max(1.5, Math.min(L - 1.5, ((px - a[0]) * dx + (pz - a[1]) * dz) / L)), x = a[0] + dx / L * t, z = a[1] + dz / L * t, d = Math.hypot(px - x, pz - z);
        if (!best || d < best.d) { const n = edgeN(p, i); best = { d, x, z, nx: n[0], nz: n[1], ux: dx / L, uz: dz / L }; }
    }
    return best;
}
function entrance(b, f, o = {}) {
    const { x, z, nx, nz } = f, ux = -nz, uz = nx, ry = Math.atan2(nx, nz), w = o.w ?? 2.4, h = o.h ?? 2.9, y = o.y ?? 0;
    const at = (u, n) => [x + ux * u + nx * n, z + uz * u + nz * n];
    { const [cx, cz] = at(0, 0.1); b.box(cx, y, cz, w + 0.5, h + 0.35, 0.22, o.frame || '#3c3f42', { ry }); }
    { const [cx, cz] = at(0, 0.2); b.box(cx, y, cz, w, h, 0.08, o.door || '#7e959e', { ry, mat: o.doorMat || 'g' }); }
    if (o.canopy) { const [cx, cz] = at(0, o.canopy / 2); b.box(cx, y + h + 0.35, cz, w + 1.6, 0.25, o.canopy, o.canopyCol || '#3c3f42', { ry }); if (o.canopyText) { const [tx, tz] = at(0, o.canopy + 0.02); b.text(o.canopyText, tx, y + h + 0.37, tz, ry, o.canopyTextH || 0.2, o.canopyTextCol || '#f2f2f2', { d: 0.01 }); } }
    if (o.plate) {
        const pw = o.plate.w ?? 0.8, ph = o.plate.h ?? 0.55, side = o.plate.side ?? 1, u = side * (w / 2 + (o.plate.gap ?? 0.55) + pw / 2), yb = y + (o.plate.y ?? 1.35);
        const [cx, cz] = at(u, 0.04); b.box(cx, yb, cz, pw, ph, 0.05, o.plate.bg || '#1f3350', { ry });
        // (2026-11-08, owner: "still overlaps and is ugly") every line fits the plate (5×7 glyphs: width = n·6·h/7 − h/7), the
        // block is centred vertically, an optional thin border inset
        const pad = 0.06, fit = o.plate.lines.map(([t, th, tc]) => { const n = [...t].length; return [t, Math.min(th, (pw - 2 * pad) * 7 / Math.max(1, 6 * n - 1)), tc]; });
        let tot = fit.reduce((a2, [, th]) => a2 + th * 1.45, 0) - fit[fit.length - 1][1] * 0.45; const k = Math.min(1, (ph - 2 * pad) / tot);
        if (k < 1) { for (const f2 of fit) f2[1] *= k; tot *= k; }
        let yy = yb + ph / 2 + tot / 2;
        for (const [t, th, tc] of fit) { yy -= th; const [tx, tz] = at(u, 0.07); b.text(t, tx, yy, tz, ry, th, tc || '#f4f4f4', { d: 0.005 }); yy -= th * 0.45; }
        if (o.plate.border) { const bc = o.plate.border, [bx, bz] = at(u, 0.068), t2 = 0.012, i2 = 0.03;
            for (const [du, dy, ww, hh] of [[0, i2, pw - 2 * i2, t2], [0, ph - i2 - t2, pw - 2 * i2, t2], [-(pw / 2 - i2), i2, t2, ph - 2 * i2], [pw / 2 - i2, i2, t2, ph - 2 * i2]])
                b.box(bx + ux * side * 0 + ux * du, yb + dy, bz + uz * du, ww, hh, 0.006, bc, { ry }); }
    }
    return { x, z, nx, nz, ry };
}

// Calea Călărașilor 101 (GTS Global Intelligence, 2015 CV stop) — OSM w245117704: listed (LMI B-II-m-B-18379) single-storey
// eclectic (Beaux-Arts) town house, ≈ 10 m street frontage x 30 m deep, N side of the street. From game/research/cv-buildings.md
// and the Commons photos "101 Calea Călărașilor, Bucharest (01)/(03)" (2023, CC BY-SA 4.0): warm off-white render #E6DCCD
// with rustication grooves, grey rendered plinth; three tall round-arched windows on the street front with stucco garland
// arches, scroll keystones and baluster panels; modillion cornice with a garland frieze; weathered grey zinc mansard with an
// arched dormer and oculi; the entrance is NOT on the street: a black wrought-iron gate on the WEST side opens onto a paved
// courtyard drive, the white panelled double door (glazed, transom) is on the long west façade up three steps, with an iron
// lantern and small company plates on the jamb (no billboard, owner note 39). Anchor = 8 m in front of the footprint centre.
// Src: game/research/cv-buildings.md (GTS) ; OSM w245117704 ; LMI B-II-m-B-18379
function bGTS(b) {
    b.shift(0, -8);
    const [p] = P2.gts.map(pts), R = '#e8dfd0', TR = '#f0e9dc', ST = '#d8ccb6', PL = '#a9a39a', ZN = '#b3b7b2', ZD = '#9a9f9b', WF = '#f4f2ec', GL = '#4a5058', IR = '#16181a';
    b.wall = R;
    b.prism(p, 0, 5.6, R, { top: false });
    b.prism(offset(p, 0.06), 0, 0.85, PL, { top: false });                                   // grey plinth
    for (let k = 0; k < 5; k++) b.cornice(p, 1.25 + k * 0.62, 0.04, 0.03, '#d6ccbc');          // rustication grooves
    b.cornice(p, 4.55, 0.2, 0.1, ST); b.cornice(p, 4.75, 0.42, 0.16, TR);                    // architrave + garland frieze band
    b.cornice(p, 5.17, 0.43, 0.5, TR); b.piers(offset(p, 0.3), 5.0, 5.18, 0.75, ST, false, 0.35);   // modillion cornice
    // weathered zinc mansard: steep, slightly bowed lower slope, shallow upper slope, flat top
    const rings = [[offset(p, 0.35), 5.6], [offset(p, 0.05), 6.6], [offset(p, -0.3), 7.5], [offset(p, -0.75), 8.2], [offset(p, -2.3), 8.8]];
    for (let r = 0; r + 1 < rings.length; r++) { const [lo, y0] = rings[r], [hi, y1] = rings[r + 1], col = r === 3 ? ZD : ZN;
        for (let i = 0; i < lo.length; i++) { const j = (i + 1) % lo.length; b.quad([lo[i][0], y0, lo[i][1]], [lo[j][0], y0, lo[j][1]], [hi[j][0], y1, hi[j][1]], [hi[i][0], y1, hi[i][1]], col, 'm', [lo[i][0] - hi[i][0], 0.4 + r * 0.5, lo[i][1] - hi[i][1]]); } }
    b.cap(rings[4][0], 8.8, '#8f9490'); b.lip(p, rings[0][0], 5.6, ZN, 1);
    b.ring(offset(p, 0.4), 5.55, 5.75, '#6c7072');                                         // gutter
    // ---- frames
    const fa = [-7, 14], fc = [3.5, 15], fl = Math.hypot(fc[0] - fa[0], fc[1] - fa[1]), ux = (fc[0] - fa[0]) / fl, uz = (fc[1] - fa[1]) / fl, sn = [-uz, ux];   // street front, outward = south
    const wa = [-7, 14], wb = [-2.5, -15], wl = Math.hypot(wb[0] - wa[0], wb[1] - wa[1]), wx = (wb[0] - wa[0]) / wl, wz = (wb[1] - wa[1]) / wl, wn = [wz, -wx];   // west facade, outward = west
    // ornate arched window: white frame with fanlight bars, stucco garland arch with festoon drops, scroll cartouche keystone, sill + baluster panel
    const win = (x, z, nx, nz, w = 1.25, h = 2.55, rich = true) => {
        const ry = Math.atan2(nx, nz);
        b.push(M(x + nx * 0.12, 0, z + nz * 0.12, ry));
        b.archWall(w + 0.34, h + w / 2 + 0.22, 0.1, [{ x: 0, w, h: h + w / 2 }], WF, M(0, 1.4, 0));
        b.box(0, 1.4, -0.07, w, h + w / 2, 0.04, GL, { mat: 'g' });
        b.box(0, 1.4, 0.0, 0.06, h + w / 2 - 0.05, 0.05, WF); b.box(0, 1.4 + h * 0.66, 0.0, w, 0.06, 0.05, WF); b.box(0, 1.4 + h, 0.0, w, 0.05, 0.05, WF);
        for (const d of [-1, 1]) b.box(d * w * 0.25, 1.4 + h, 0.0, 0.04, w * 0.42, 0.05, WF, { rz: d * 0.6 });   // fanlight bars
        if (rich) {
            b.geo(new THREE.TorusGeometry(w / 2 + 0.3, 0.11, 4, 12, Math.PI), ST, M(0, 1.4 + h, 0.08));       // garland arch
            for (const d of [-1, 1]) for (let k = 0; k < 3; k++) b.box(d * (w / 2 + 0.3), 1.4 + h - 0.25 - k * 0.32, 0.08, 0.16, 0.26, 0.14, ST);   // festoon drops
            const ky = 1.4 + h + w / 2 + 0.15; b.box(0, ky, 0.1, 0.42, 0.75, 0.16, ST); b.cyl(0, ky + 0.75, 0.12, 0.17, 0.17, 0.16, ST, 8, { rx: Math.PI / 2 });   // scroll cartouche
            b.box(0, 1.25, 0.08, w + 0.44, 0.12, 0.24, ST);                                                       // sill
            b.box(0, 0.75, 0.04, w + 0.3, 0.5, 0.08, ST); for (let k = -3; k <= 3; k++) b.cyl(k * (w + 0.1) / 7, 0.78, 0.1, 0.045, 0.06, 0.42, TR, 5);   // baluster panel
        }
        b.pop();
    };
    for (const t of [3.4, 6.0, 8.6]) win(fa[0] + ux * t, fa[1] + uz * t, sn[0], sn[1]);
    for (const t of [3.6, 15.5, 18.5, 22.5, 25.5]) win(wa[0] + wx * t, wa[1] + wz * t, wn[0], wn[1], 1.05, 2.3, t > 5 && t < 20);
    // canted corner (footprint cut at 45°): narrow arched window + cartouche on the chamfer, hipped corner pavilion roof
    { const ca = [-6.82, 12.81], cb = [-5.81, 14.11], mx = (ca[0] + cb[0]) / 2, mz = (ca[1] + cb[1]) / 2, dx = cb[0] - ca[0], dz = cb[1] - ca[1], dl = Math.hypot(dx, dz), cn = [-dz / dl, dx / dl], ry = Math.atan2(cn[0], cn[1]);
        win(mx, mz, cn[0], cn[1], 0.55, 2.5, false);
        b.box(mx + cn[0] * 0.12, 4.55, mz + cn[1] * 0.12, 0.42, 0.65, 0.16, ST, { ry });
        // pavilion roof: straight slopes to a short point, slight bell at the eaves (4-sided, aligned with the chamfer)
        const px = mx - cn[0] * 2.1, pz = mz - cn[1] * 2.1;
        b.geo(new THREE.LatheGeometry([[2.5, 0], [2.38, 0.3], [2.15, 1.9], [1.2, 2.9], [0.4, 3.35], [0.01, 3.4]].map(([a, c]) => new THREE.Vector2(a, c)), 4), ZN, M(px, 5.6, pz, ry + Math.PI / 4), 'm');
        b.cone(px, 8.95, pz, 0.09, 0.6, '#6c7072', 5);
    }
    // rusticated quoins at the street-east corner
    for (let k = 0; k < 7; k++) { const x = fc[0] - ux * 0.35 + sn[0] * 0.05, z = fc[1] - uz * 0.35 + sn[1] * 0.05; b.box(x, 0.9 + k * 0.52, z, k % 2 ? 0.55 : 0.8, 0.46, 0.12, TR, { ry: Math.atan2(sn[0], sn[1]) }); }
    { const ry = Math.atan2(sn[0], sn[1]), x = fa[0] + ux * 1.6 + sn[0] * 0.08, z = fa[1] + uz * 1.6 + sn[1] * 0.08; b.box(x, 3.0, z, 0.36, 0.24, 0.03, '#1d4f91', { ry }); b.text('101', x + sn[0] * 0.02, 3.05, z + sn[1] * 0.02, ry, 0.12, '#ffffff', { d: 0.005 }); }
    // oculi in the mansard (street: above the window piers; west: three) — on the steep lower slope
    const ocul = (x, z, nx, nz) => b.geo(new THREE.TorusGeometry(0.34, 0.11, 5, 12), '#7f8582', M(x + nx * 0.18, 7.0, z + nz * 0.18, Math.atan2(nx, nz), 1, 1, 1, -0.25));
    for (const t of [4.7, 7.3]) ocul(fa[0] + ux * t, fa[1] + uz * t, sn[0], sn[1]);
    for (const t of [11, 17, 23]) ocul(wa[0] + wx * t, wa[1] + wz * t, wn[0], wn[1]);
    // arched dormer on the west slope near the corner (front flush with the wall line)
    { const t = 5.6, x = wa[0] + wx * t + wn[0] * 0.05, z = wa[1] + wz * t + wn[1] * 0.05, ry = Math.atan2(wn[0], wn[1]);
        b.push(M(x, 0, z, ry)); b.box(0, 5.6, -0.6, 1.35, 1.7, 1.3, TR); b.box(0, 5.85, 0.06, 0.62, 1.2, 0.04, '#3f4246', { mat: 'g' });
        b.geo(new THREE.CylinderGeometry(0.68, 0.68, 1.3, 10, 1, false, -Math.PI / 2, Math.PI), TR, M(0, 7.3, -0.6, 0, 1, 1, 1, Math.PI / 2, 0)); b.pop(); }
    // entrance on the long west facade: projecting bay, white panelled double door + transom, three steps, lantern, thujas, jamb plates
    { const t = 9.6, x = wa[0] + wx * t, z = wa[1] + wz * t, ry = Math.atan2(wn[0], wn[1]);
        b.box(x + wn[0] * 0.25, 0.85, z + wn[1] * 0.25, 2.1, 3.9, 0.35, TR, { ry });
        entrance(b, { x: x + wn[0] * 0.42, z: z + wn[1] * 0.42, nx: wn[0], nz: wn[1] }, { y: 0.9, w: 1.4, h: 2.55, frame: WF, door: '#eeeae2', doorMat: 'm',
            plate: { w: 0.32, h: 0.4, y: 0.9, side: 1, bg: '#c9a85a', lines: [['GTS', 0.09, '#1f2a3a'], ['GLOBAL', 0.035, '#1f2a3a'], ['INTELLIGENCE', 0.035, '#1f2a3a']] } });
        b.box(x + wn[0] * 0.45, 3.45, z + wn[1] * 0.45, 1.4, 0.5, 0.05, '#8fa0a8', { ry, mat: 'g' });
        for (const d of [-0.36, 0.36]) { b.box(x + wn[0] * 0.66 + wx * d, 2.2, z + wn[1] * 0.66 + wz * d, 0.5, 1.15, 0.03, '#7f939b', { ry, mat: 'g' }); b.box(x + wn[0] * 0.66 + wx * d, 1.15, z + wn[1] * 0.66 + wz * d, 0.42, 0.42, 0.03, '#dcd7cd', { ry, rz: Math.PI / 4 }); }   // glazed upper panels + diamond lower panels
        for (let k = 0; k < 3; k++) b.box(x + wn[0] * (0.9 + k * 0.35), 0, z + wn[1] * (0.9 + k * 0.35), 2.2, 0.9 - k * 0.3, 0.36, '#c8c2b6', { ry });
        b.box(x + wn[0] * 0.55 - wx * 1.4, 3.6, z + wn[1] * 0.55 - wz * 1.4, 0.22, 0.34, 0.22, IR);
        const px = x + wn[0] * 2.2 + wx * 1.6, pz = z + wn[1] * 2.2 + wz * 1.6; b.cyl(px, 0, pz, 0.04, 0.05, 1.6, '#b98d78', 6); b.box(px, 1.6, pz, 0.22, 0.3, 0.22, '#b98d78');
        for (const d of [-1.9, 1.9]) b.cone(x + wn[0] * 0.9 + wx * d, 0, z + wn[1] * 0.9 + wz * d, 0.45, 3.2, '#9da544', 6); }
    // black wrought-iron gate on the west side at the street line: fence panel, pedestrian gate, arched double gate, stone pier
    { const ry = Math.atan2(sn[0], sn[1]), o = [fa[0] - ux * 0.95, fa[1] - uz * 0.95];   // start just west of the corner bay
        const P = (t) => [o[0] - ux * t, o[1] - uz * t];
        const span = (t0, t1, h0, arch, finials = true) => {
            const n = Math.round((t1 - t0) / 0.13);
            for (let k = 0; k <= n; k++) { const t = t0 + (t1 - t0) * k / n, h = h0 + arch * Math.sin(Math.PI * k / n), [x, z] = P(t);
                b.box(x, 0.12, z, 0.03, h - 0.12, 0.03, IR, { ry }); if (finials && k % 2 === 0) b.cone(x, h, z, 0.05, 0.16, IR, 4); }
            for (const y of [0.15, 0.75, h0 - 0.1]) { const [x, z] = P((t0 + t1) / 2); b.box(x, y, z, t1 - t0, 0.05, 0.04, IR, { ry }); }
            if (arch > 0) for (let k = 0; k < 8; k++) { const ta = t0 + (t1 - t0) * (k + 0.5) / 8, h = h0 + arch * Math.sin(Math.PI * (k + 0.5) / 8) - 0.05, [x, z] = P(ta), sl = arch * Math.PI / (t1 - t0) * Math.cos(Math.PI * (k + 0.5) / 8); b.box(x, h, z, (t1 - t0) / 8 + 0.02, 0.05, 0.05, IR, { ry, rz: -Math.atan(sl) }); }
            for (const k of [0.33, 0.67]) { const [x, z] = P(t0 + (t1 - t0) * k); b.geo(new THREE.TorusGeometry(0.18, 0.02, 3, 10), IR, M(x, 1.15, z, ry)); }   // scrolls
        };
        const post = (t, h = 2.5) => { const [x, z] = P(t); b.box(x, 0, z, 0.12, h, 0.12, IR); b.sphere(x, h + 0.08, z, 0.09, IR, { detail: 0 }); };
        b.box(...(([x, z]) => [x, 0, z])(P(0.6)), 1.3, 0.45, 0.3, '#cfc8bb', { ry }); span(0, 1.2, 1.9, 0, true);              // fence panel on a low plinth
        post(1.25); span(1.3, 2.4, 2.0, 0.35); post(2.45, 2.7); span(2.5, 6.1, 2.1, 0.75); post(6.15, 2.7);
        const [qx, qz] = P(6.6); b.box(qx, 0, qz, 0.6, 2.7, 0.6, '#d2cbbd'); b.box(qx, 2.7, qz, 0.75, 0.15, 0.75, '#c4bcad');   // stone gate pier
    }
    b.colPoly([p], 6);
}

// Liceul Teoretic "C.A. Rosetti" (Str. Gen. Giuseppe Garibaldi 11, 2009 CV stop) — OSM w28240279: 3-level school
// block, U-shaped (wings to the west, base along Garibaldi). Research (bucharest-floreasca.md rosetti): 1950s-60s
// rendered masonry, cream #E8DDB8, white window frames, regular grid of tall windows, flat roof; gate on the W side
// of one-way (northbound) Garibaldi. Entrance with a canopy and the blue Romanian school name plate + flag.
// Src: game/research/bucharest-floreasca.md (rosetti, w28240279 row) ; OSM w28240279
function bRosetti(b) {
    // (round 5) public photo of the school (bucharest.ro listing; viewed only, not kept): 3 storeys, beige textured render,
    // wide white PVC windows, low red standing-seam hipped roof with eaves, small entrance porch with a flat canopy.
    // (2026-11-08, owner: "use Street View and model it perfectly", compared side by side on Garibaldi / Bizet / Verdi)
    // the facade reads as horizontal bands: wide white windows in rows, muted salmon spandrels between the rows and under
    // the ground-floor windows, cream piers and frieze; a steel fire-escape stair on the Garibaldi face.
    const [p] = P2.rosetti.map(pts), W = '#e9e0c6', SA = '#f0cfbd', FR = '#f6f6f2', GL = '#4c5660', RF = '#b8333a', ST = '#b4babb';
    b.wall = W;
    b.prism(p, 0, 11.3, W, { top: false });
    b.prism(offset(p, 0.06), 0, 0.55, '#a7a49b', { top: false });                             // plinth
    for (const [y0, y1] of [[0.55, 1.2], [3.15, 4.8], [6.75, 8.4]]) b.prism(offset(p, 0.04), y0, y1, SA, { top: false });   // salmon spandrels
    b.windows(p, 1.2, 11.3, 3.6, FR, { bay: 3.2, wf: 0.8, hf: 0.54, start: 0, minL: 4, off: 0.08 });            // white frames
    b.windows(p, 1.2, 11.3, 3.6, GL, { bay: 3.2, wf: 0.74, hf: 0.48, start: 0.1, minL: 4, off: 0.11, mat: 'g' }); // glazing
    b.windows(p, 1.2, 11.3, 3.6, FR, { bay: 1.07, wf: 0.07, hf: 0.48, start: 0.1, minL: 4, off: 0.13 });         // mullions (3 lights per window)
    // low red standing-seam hipped roof with eaves (over the U plan)
    const lo = offset(p, 0.6), hi = offset(p, -4.6), y0 = 11.3, y1 = 13.4;
    for (let i = 0; i < lo.length; i++) { const j = (i + 1) % lo.length; b.quad([lo[i][0], y0, lo[i][1]], [lo[j][0], y0, lo[j][1]], [hi[j][0], y1, hi[j][1]], [hi[i][0], y1, hi[i][1]], RF, 'm', [lo[i][0] - hi[i][0], 1.5, lo[i][1] - hi[i][1]]); }
    b.cap(hi, y1, '#a52d33'); b.lip(p, lo, y0, '#d9d4c8', -1);
    const f = nearestFacade(p, 40, 7.4);                                                    // on the Garibaldi (east) face, level with the address node
    { const x = f.x + f.nx * 1.6, z = f.z + f.nz * 1.6, ry = Math.atan2(f.nx, f.nz); b.box(x, 0, z, 4.2, 3.4, 3.2, W, { ry }); b.box(x + f.nx * 0.2, 3.4, z + f.nz * 0.2, 4.8, 0.25, 3.8, '#e9e6de', { ry }); }   // entrance porch
    entrance(b, { x: f.x + f.nx * 3.2, z: f.z + f.nz * 3.2, nx: f.nx, nz: f.nz }, { w: 1.8, h: 2.5, frame: '#ece9e2', door: '#7a8a92', plate: { w: 0.9, h: 0.5, y: 1.25, gap: 0.25, bg: '#1d4f91', border: '#e8eef6', lines: [['LICEUL TEORETIC', 0.06, '#ffffff'], ['C.A. ROSETTI', 0.09, '#ffffff']] } }); // (owner: "sign goes outside": inside the porch face)
    { // the national flag on a pole slanting out from the facade above the porch canopy (owner: "flag goes in building": from
      // the porch front the pole ran up through the canopy's edge); bracket on the wall at 5.2 m, top 1.2 m out at 6.6 m
        const tx = -f.nz, tz = f.nx, B = [f.x + f.nx * 0.1 + tx * 1.55, 5.2, f.z + f.nz * 0.1 + tz * 1.55], T = [B[0] + f.nx * 1.2, 6.6, B[2] + f.nz * 1.2];
        b.box(B[0] - f.nx * 0.04, 5.0, B[2] - f.nz * 0.04, 0.14, 0.32, 0.12, '#b9bcbe'); b.strut(B, T, 0.025, 0.02, '#d9dcde');
        // (owner's sketch) the flag hangs from the top of the pole and runs away from it at right angles: its hoist along the
        // pole's top 0.62 m, blue at the pole, then yellow, then red
        const dl = Math.hypot(T[0] - B[0], T[1] - B[1], T[2] - B[2]), D = [(T[0] - B[0]) / dl, (T[1] - B[1]) / dl, (T[2] - B[2]) / dl];
        const hD = Math.hypot(D[0], D[2]), F = [D[0] / hD * D[1], -hD, D[2] / hD * D[1]];                       // ⟂ to the pole, outward and down
        const H = 0.62, Lf = 0.95, at = (u, v) => [T[0] - D[0] * (0.04 + u) + F[0] * v, T[1] - D[1] * (0.04 + u) + F[1] * v, T[2] - D[2] * (0.04 + u) + F[2] * v];
        ['#002b7f', '#fcd116', '#ce1126'].forEach((col, i) => { const v0 = i * Lf / 3, v1 = v0 + Lf / 3, a = at(0, v0), c2 = at(0, v1), d2 = at(H, v1), e2 = at(H, v0);
            b.quad(a, c2, d2, e2, col, 'm', [-tz, 0, tx]); b.quad(e2, d2, c2, a, col, 'm', [tz, 0, -tx]); }); }
    // steel fire-escape stair on the Garibaldi face, north of the entrance: landings at each floor, flights between, cage rails
    { const e = nearestFacade(p, 30, -6), ry = Math.atan2(e.nx, e.nz), tx = -e.nz, tz = e.nx, o = 1.25;
        const at = (u, v) => [e.x + e.nx * v + tx * u, e.z + e.nz * v + tz * u];
        for (const t of [0.04, 0.96]) { for (const u of [-1.3, 1.3]) { const [x, z] = at(u, o + (t - 0.5) * 2.3); b.box(x, 0, z, 0.07, 11.1, 0.07, ST, { ry }); } }
        for (let k = 1; k <= 3; k++) { const y = k * 3.6 - 0.1, [x, z] = at(0, o); b.box(x, y, z, 2.7, 0.08, 2.3, ST, { ry }); const [rx, rz] = at(0, o + 1.12); b.box(rx, y + 1.0, rz, 2.7, 0.05, 0.05, ST, { ry }); }
        for (let k = 0; k < 3; k++) { const ya = k * 3.6, yb = ya + 3.5, u0 = k % 2 ? 1.2 : -1.2, [x, z] = at(0, o - 0.45), sl = Math.atan2(yb - ya, 2.4);
            b.box(x, (ya + yb) / 2 - 0.05, z, 2.4 / Math.cos(sl), 0.08, 0.9, ST, { ry, rz: (u0 > 0 ? 1 : -1) * sl });
            const [hx, hz] = at(0, o - 0.02); b.box(hx, (ya + yb) / 2 + 0.95, hz, 2.4 / Math.cos(sl), 0.05, 0.05, ST, { ry, rz: (u0 > 0 ? 1 : -1) * sl }); } }   // flights + handrails
    b.colPoly([p], 8);
    // the school's sports hall (OSM w545176891, building=yes without tags; the world hides that footprint): one tall
    // volume measured on the aerial imagery (south facade seen obliquely: ≈ 12.5 m, scaled on the school's 11.3 m wall;
    // dark flat roof #52615c; yellow cladding over a grey band), a salmon single-storey entrance block on the yard side.
    { const [h] = P2.rosettiHall.map(pts), HY = '#e2c64a', HG = '#c9cbc6', HL = '#8e9494';
        b.prism(h, 0, 12.3, HG, { top: false });
        b.prism(offset(h, 0.05), 7.4, 12.1, HY, { top: false });                                 // yellow cladding
        for (let y = 4.4; y < 7.2; y += 0.32) b.prism(offset(h, 0.06), y, y + 0.12, HL, { top: false });   // louvre slats
        b.prism(offset(h, 0.12), 12.1, 12.5, '#a9adab', { top: false }); b.cap(h, 12.45, '#52615c');   // flashing + dark flat roof
        for (let i = 0; i < h.length; i++) { const [ax, az] = h[i], [bx, bz] = h[(i + 1) % h.length], L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 1.2);   // cladding seams
            const ux = (bx - ax) / L, uz = (bz - az) / L, nx = uz, nz = -ux, ry = Math.atan2(ux, uz);
            for (let k = 1; k < n; k++) { const x = ax + ux * L * k / n + nx * 0.1, z = az + uz * L * k / n + nz * 0.1; b.box(x, 7.4, z, 0.04, 4.7, 0.04, '#cdb23d', { ry }); } }
        const g = nearestFacade(h, 40, -60), ry = Math.atan2(g.nx, g.nz), tx = -g.nz, tz = g.nx;   // east face (the yard on Garibaldi)
        { const x = g.x + g.nx * 2.4, z = g.z + g.nz * 2.4; b.box(x, 0, z, 13, 4.2, 4.8, SA, { ry }); b.box(x, 4.2, z, 13.4, 0.3, 5.1, '#d9d4c8', { ry });
            b.box(x + g.nx * 2.42, 0.6, z + g.nz * 2.42, 12.2, 2.0, 0.04, '#4f5a60', { ry, mat: 'g' }); }   // salmon entrance block with its glazing
        entrance(b, { x: g.x + g.nx * 4.85 + tx * 3.5, z: g.z + g.nz * 4.85 + tz * 3.5, nx: g.nx, nz: g.nz }, { w: 1.8, h: 2.4, frame: '#e9e6de', door: '#5f6b72' });
        b.colPoly([h], 12); }
    // the school gym west of the north wing (OSM w544207404, untagged; the world drew a 4-storey block): one hall measured
    // on the aerial — a long dark low-pitched roof, short shadow ≈ 6.5 m; plastered walls, a band of high windows, a door
    // toward the yard (2026-11-08, owner: "isn't the left building the gym?")
    { const [g] = P2.rosettiGym.map(pts), GW = '#e4dccb', y1 = 6.2;
        b.prism(g, 0, y1, GW, { top: false }); b.prism(offset(g, 0.05), 0, 0.5, '#a7a49b', { top: false });
        b.windows(g, 3.9, y1, 2.0, '#f2f2ee', { bay: 3.0, wf: 0.8, hf: 0.62, start: 0, minL: 6, off: 0.06 });          // high window band (frames)
        b.windows(g, 3.9, y1, 2.0, '#4c5660', { bay: 3.0, wf: 0.74, hf: 0.52, start: 0.1, minL: 6, off: 0.09, mat: 'g' });
        const lo = offset(g, 0.45), [c0, c1] = [g[0], g[1]], long01 = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) > Math.hypot(g[2][0] - c1[0], g[2][1] - c1[1]);
        const [p0, p1, p2, p3] = long01 ? lo : [lo[1], lo[2], lo[3], lo[0]], yr = y1 + 1.4;        // low gable roof along the long side
        const r0 = [(p0[0] + p3[0]) / 2, (p0[1] + p3[1]) / 2], r1 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], RC = '#45423b';
        b.quad([p0[0], y1, p0[1]], [p1[0], y1, p1[1]], [r1[0], yr, r1[1]], [r0[0], yr, r0[1]], RC, 'm', [p0[0] - r0[0], 2, p0[1] - r0[1]]);
        b.quad([p2[0], y1, p2[1]], [p3[0], y1, p3[1]], [r0[0], yr, r0[1]], [r1[0], yr, r1[1]], RC, 'm', [p2[0] - r1[0], 2, p2[1] - r1[1]]);
        const gp = long01 ? [g[1], g[2], g[3], g[0]] : g;                                         // gable ends: plastered triangles
        for (const [a, c2] of [[gp[0], gp[1]], [gp[2], gp[3]]]) { const m2 = [(a[0] + c2[0]) / 2, (a[1] + c2[1]) / 2]; b.quad([a[0], y1, a[1]], [c2[0], y1, c2[1]], [m2[0], yr - 0.05, m2[1]], [m2[0], yr - 0.05, m2[1]], GW, 'm', [m2[0] - (g[0][0] + g[2][0]) / 2, 0, m2[1] - (g[0][1] + g[2][1]) / 2]); }
        const d = nearestFacade(g, -20, -15); entrance(b, { x: d.x + d.nx * 0.12, z: d.z + d.nz * 0.12, nx: d.nx, nz: d.nz }, { w: 1.8, h: 2.4, frame: '#e9e6de', door: '#6b7a82' });
        b.colPoly([g], 6.5); }
    b.covers.push([-41, -17]);                                                               // the gym's OSM footprint
    b.covers.push([-3.3, -60.7]);                                                            // the hall's OSM footprint
    // school grounds (OSM w253216276): drawn by the world (it knows the streets), always kept on the grounds' side of a street
    // (OSM draws the east edge on the Garibaldi centre line; 2026-11-08, owner: "the fence is on the street"). Compared with
    // Street View: welded-mesh panels on Garibaldi and Verdi, black bars on a painted plinth along Bizet; the gate on Garibaldi
    // in front of the entrance. The invented asphalt court is gone (the hall stands there).
    const G = pts([-32.1, 33.3, -29.3, 20.5, -61.1, 12.4, -56.6, -5.2, -78.1, -10.1, -71.1, -37, -45.8, -31.2, -34.3, -74.7, -28.7, -94.3, -8.8, -89.6, -1.2, -121.5, 53.8, -156.9, 67.7, -154.4, 60.2, -119.4, 24.1, 46]);
    const gx = f.x + f.nx * 12, gz = f.z + f.nz * 12, M = [50.5, -75]; // the gate: where the entrance axis meets the fence; M: Garibaldi, level with the hall
    b.fences.push({ line: [G[9], G[10], G[11], G[12], G[13], M], inside: G, style: 'mesh', h: 3.6 });                 // tall: round the sports ground
    b.fences.push({ line: [M, G[14]], inside: G, gates: [{ x: gx, z: gz, w: 5 }], style: 'mesh' });                     // the school front
    b.fences.push({ line: [G[14], G[0]], inside: G, style: 'bars', plinth: 'arches' });                                // Bizet
    b.fences.push({ line: G.slice(0, 10), inside: G, style: 'mesh' });                                                 // the neighbours
    // the sports ground between the hall and Verdi (not mapped in OSM; measured on the aerial mosaic, 2026-11-08): a blue
    // tartan surround, an artificial-turf mini-football pitch (≈ 22 × 39 m) with a red court at its north end, and a second
    // red court to the west of it
    { const lineQ = (a, c, w, y, col) => { const dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2;
            b.quad([a[0] + nx, y, a[1] + nz], [c[0] + nx, y, c[1] + nz], [c[0] - nx, y, c[1] - nz], [a[0] - nx, y, a[1] - nz], col, 'm', [0, 1, 0]); };
        const outline = (q, y, col, w = 0.1) => { for (let i = 0; i < q.length; i++) lineQ(q[i], q[(i + 1) % q.length], w, y, col); };
        const mid = (a, c, t = 0.5) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
        const turf = pts([28.8, -127.7, 50.9, -122.6, 43.3, -84.8, 21.2, -89.9]), north = pts([30.8, -143.6, 55.3, -137.2, 50.9, -122.6, 28.8, -127.7]);
        const west = pts([0.8, -119, 19.8, -115.6, 19.4, -91, 0.4, -94.6]);
        const track = offset([north[0], north[1], turf[2], turf[3]], 3.2);
        b.cap(track, 0.06, '#3f6fb0'); b.cap(turf, 0.09, '#3f8a3a'); b.cap(north, 0.09, '#c4553d'); b.cap(west, 0.07, '#c4553d');
        const tin = offset(turf, -0.9); outline(tin, 0.12, '#f2f2ee');
        const h0 = mid(tin[0], tin[3]), h1 = mid(tin[1], tin[2]); lineQ(h0, h1, 0.1, 0.12, '#f2f2ee');                    // halfway line
        { const cx = (h0[0] + h1[0]) / 2, cz = (h0[1] + h1[1]) / 2; for (let k = 0; k < 20; k++) { const a0 = k / 20 * Math.PI * 2, a1 = (k + 1) / 20 * Math.PI * 2; lineQ([cx + 3 * Math.cos(a0), cz + 3 * Math.sin(a0)], [cx + 3 * Math.cos(a1), cz + 3 * Math.sin(a1)], 0.1, 0.12, '#f2f2ee'); } }
        for (const [e0, e1, s0, s1] of [[tin[0], tin[1], tin[3], tin[2]], [tin[3], tin[2], tin[0], tin[1]]]) {             // penalty areas (6 m deep, 12 m wide)
            const L = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]), a = mid(e0, e1, 0.5 - 6 / L), c = mid(e0, e1, 0.5 + 6 / L), d0 = mid(e0, s0, 6 / Math.hypot(s0[0] - e0[0], s0[1] - e0[1])), dz = [d0[0] - e0[0], d0[1] - e0[1]];
            const a2 = [a[0] + dz[0], a[1] + dz[1]], c2 = [c[0] + dz[0], c[1] + dz[1]]; lineQ(a, a2, 0.1, 0.12, '#f2f2ee'); lineQ(a2, c2, 0.1, 0.12, '#f2f2ee'); lineQ(c2, c, 0.1, 0.12, '#f2f2ee');
            const gm = mid(e0, e1), ux = (e1[0] - e0[0]) / L, uz = (e1[1] - e0[1]) / L, ry = Math.atan2(ux, uz);           // a small goal on the goal line
            for (const sg of [-1, 1]) b.box(gm[0] + ux * sg * 1.5, 0.09, gm[1] + uz * sg * 1.5, 0.08, 2.0, 0.08, '#f4f4f4');
            b.box(gm[0], 2.05, gm[1], 0.08, 0.08, 3.08, '#f4f4f4', { ry }); }
        for (const q of [north, west]) { const qi = offset(q, -1.2); outline(qi, 0.11, '#f2f2ee'); lineQ(mid(qi[0], qi[3]), mid(qi[1], qi[2]), 0.1, 0.11, '#f2f2ee'); }
        // basketball hoops at the ends of the red courts (2026-11-08, owner: "the hoops are gone from Rosetti"): a pole 1.2 m
        // behind the end line, an arm, the white backboard with its target square, an orange rim and a net; none at an end
        // that runs into the football pitch
        const inQ = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
        for (const q of [north, west]) {
            const L01 = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), L12 = Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]);
            const ends = L01 > L12 ? [mid(q[1], q[2]), mid(q[3], q[0])] : [mid(q[0], q[1]), mid(q[2], q[3])];
            const cx = (ends[0][0] + ends[1][0]) / 2, cz = (ends[0][1] + ends[1][1]) / 2;
            for (const E of ends) {
                const dx = cx - E[0], dz = cz - E[1], dl = Math.hypot(dx, dz), ux = dx / dl, uz = dz / dl, ry = Math.atan2(ux, uz);
                if (inQ(E[0] - ux * 1.2, E[1] - uz * 1.2, turf) || inQ(E[0] + ux * 1.5, E[1] + uz * 1.5, turf)) continue;
                const P = (t) => [E[0] + ux * t, E[1] + uz * t], [px, pz] = P(0), [ax, az] = P(1.2), [bx, bz] = P(2.4), [rx, rz] = P(2.65), [tx, tz] = P(2.43);
                b.cyl(px, 0.09, pz, 0.07, 0.085, 3.35, '#3a3d42', 8);
                b.box(ax, 3.2, az, 0.1, 0.1, 2.4, '#3a3d42', { ry });                                       // arm
                b.box(bx, 2.6, bz, 1.8, 1.05, 0.05, '#f2f2f0', { ry });                                     // backboard
                for (const [w2, h2, y2, o2] of [[0.59, 0.04, 2.9, 0], [0.59, 0.04, 3.31, 0], [0.04, 0.45, 2.9, -0.275], [0.04, 0.45, 2.9, 0.275]])
                    b.box(tx - uz * o2, y2, tz + ux * o2, w2, h2, 0.02, '#c2410c', { ry });                 // target square
                b.box(bx + ux * 0.1, 3.0, bz + uz * 0.1, 0.06, 0.06, 0.2, '#e8590c', { ry });               // rim bracket
                b.cyl(rx, 3.03, rz, 0.23, 0.23, 0.03, '#e8590c', 14, { open: true });                        // rim
                b.cyl(rx, 2.62, rz, 0.22, 0.14, 0.41, '#ededea', 8, { open: true });                         // net
            }
        }
        b.grounds.push(track, west); }
}

// BOB / "BOB Tower" (Globalworth, Bd. Dimitrie Pompeiu 6A, 2008; DB Global Technology 2017 CV stop) — OSM w55450549;
// research (bucharest-pipera.md db): GF + 6 floors (≈ 28 m), blue-green curtain wall #6F8C99 with grey spandrels,
// flat roof; on the south side of Pompeiu opposite Hermes; OSM entrance nodes on the north face (≈ -11.5, -30).
// Signage: building name on the entrance canopy + a small tenant plate (no rooftop logo found in research).
// Src: game/research/bucharest-pipera.md (db, w55450549 row; Globalworth BOB particulars) ; OSM w55450549
function bBOB(b) {
    // (round 5) landlord photos (globalworth.com / bob.globalworth.com; viewed only, not kept): GF + 6 glass block with
    // DARK horizontal spandrel bands, acute "prow" corners clad in white aluminium, a white projecting slab over a dark
    // granite ground floor with tall glazed entrances, thin projecting roof edge; lobby with a "DB Global Technology" desk.
    const q = P2.bob.map(pts)[0], p = q.slice(0, 4), GL = '#6f9aa3', SP = '#2c3336', WH = '#e8eaea';
    b.prism(p, 0, 4.8, '#5a4d47', { top: false });                                            // dark granite ground floor
    b.windows(p, 0, 4.8, 4.8, '#3d4c52', { bay: 7.2, wf: 0.55, hf: 0.82, start: 0.1, minL: 6, mat: 'g', off: 0.06 });
    b.cornice(p, 4.8, 0.45, 2.4, WH, { solid: true });                                        // white projecting slab
    curtainTower(b, p, 5.25, 27.6, { glass: GL, spandrel: SP, mullion: '#3c4447', pitch: 1.6, mw: 0.08, md: 0.12, fh: 3.75, frac: 0.7, start: 0.55 });
    b.cornice(p, 27.6, 0.5, 1.2, WH, { solid: true });                                        // thin projecting roof edge
    for (const k of [0, 2]) { const [x, z] = p[k]; b.cyl(x, 5.25, z, 1.6, 1.6, 22.4, WH, 6); }   // white-clad acute prows
    { const t = offset(p, -12); b.prism(t, 28.1, 30.6, '#a3a7a8'); }                        // plant enclosure
    const f = nearestFacade(p, -11.5, -30.2);
    entrance(b, f, { w: 4.8, h: 3.9, canopyText: null, plate: { w: 0.7, h: 0.5, y: 1.3, bg: '#ffffff', lines: [['DB', 0.14, '#0018a8'], ['GLOBAL', 0.05, '#0018a8'], ['TECHNOLOGY', 0.05, '#0018a8']] } });
    { const x = f.x + f.nx * 2.45 - f.nz * 4.2, z = f.z + f.nz * 2.45 + f.nx * 4.2, ry = Math.atan2(f.nx, f.nz); b.text('BOB', x, 4.95, z, ry, 0.5, '#2c3336', { d: 0.02 }); }   // building name on the slab edge
    b.colPoly([p], 18);
}

// Rectoratul Universității Politehnica București (1970s) — OSM w28240552 (5 levels) + dome part. From the Commons refs
// (game/research/refs/grozavesti: "RO B Politehnica university rectorate", "Politehnica University of Bucharest 0x"):
// brick recessed lower floor, three red-panel storeys behind pale concrete fins and sills, a projecting slab, a recessed
// glazed top storey, a wide projecting roof slab and the big dark saucer dome (aula) on a
// glazed drum with the flag; blue-lit dome rim at night (research). Entrance on the north forecourt: canopy, flags,
// "RECTORAT" plate. Src: game/research/bucharest-grozavesti.md (upb, w28240552 row) ; OSM w28240552
function bPolitehnica(b) {
    // Independent facade source: Mister rf's January 2024 Commons photos, including the oblique _04 view.
    // The main storeys have red infill, pale sills and vertical concrete fins; the recessed upper storey is glazing.
    // Heights and bay dimensions remain authoring estimates (OSM supplies five levels, no metre height).
    const [p] = P2.rectorat.map(pts), CON = '#b3afa6', FIN = '#dedbd0', BR = '#9b624b', RED = '#b52c35', GL = '#536b78', SL = '#dedbd0';
    const ground = offset(p, -1.2);
    b.prism(ground, 0, 3.8, BR, { top: false });
    b.windows(ground, 0, 3.8, 3.8, GL, { bay: 2.5, wf: 0.44, hf: 0.7, start: 0.65, mat: 'g' });
    b.prism(p, 3.8, 14.6, RED, { top: false });
    b.windows(p, 3.8, 14.6, 3.6, GL, { bay: 1.7, wf: 0.71, hf: 0.72, start: 0.66, mat: 'g', off: 0.08 });
    for (const y of [3.8, 7.4, 11.0, 14.25]) b.bands(p, y, y + 0.5, 0.5, FIN, { start: 0, frac: 0.36, off: 0.18 });
    b.pilasters(p, 0, 14.6, 1.7, 0.42, 1.0, FIN, {});                                       // dense vertical fins
    b.cornice(p, 14.6, 0.8, 1.6, SL, { solid: true });                                     // projecting slab
    const up = offset(p, -2.2);
    b.prism(up, 15.4, 19.8, RED, { topCol: CON }); b.bands(up, 15.4, 19.8, 4.4, GL, { frac: 0.68, start: 0.7, mat: 'g', wall: FIN, pitch: 0.65, pierW: 0.13 });
    b.cornice(p, 19.8, 0.7, 2.2, SL, { solid: true });                                     // wide roof slab
    const [cx, cz] = centroid(p);
    b.cyl(cx, 20.5, cz, 13.5, 13.5, 1.6, '#566470', 24, { mat: 'g' });                      // glazed drum
    b.geo(new THREE.LatheGeometry([[0.01, 5.6], [6, 5.2], [12, 3.9], [16.6, 2.2], [19.6, 0.6], [19.2, 0], [13.5, -0.2]].map(([a, c]) => new THREE.Vector2(a, c)), 32), '#80878a', M(cx, 22.1, cz), 'g');   // saucer dome
    b.geo(new THREE.TorusGeometry(19.45, 0.22, 4, 48), '#4f7fc7', M(cx, 22.65, cz, 0, 1, 1, 1, Math.PI / 2), 'nb');   // dome rim (blue-lit at night)
    b.cyl(cx, 27.7, cz, 3.2, 3.4, 1.2, '#6a7072', 12); b.cyl(cx, 28.9, cz, 0.06, 0.08, 6, '#d8d8d8', 5); flag(b, cx, 34.6, cz, 2.4);
    const f = nearestFacade(p, 0, -40);                                                    // north forecourt
    entrance(b, f, { w: 6, h: 3.4, canopy: 3, canopyCol: SL, plate: { w: 1.2, h: 0.5, y: 1.4, bg: '#e9e6df', lines: [['UNIVERSITATEA POLITEHNICA', 0.045, '#1b3f73'], ['RECTORAT', 0.13, '#1b3f73']] } });
    for (const [k, col] of [[-1, 'ro'], [0, 'eu'], [1, 'upb']]) {
        const x = f.x + f.nx * 9 - f.nz * k * 3, z = f.z + f.nz * 9 + f.nx * k * 3; b.cyl(x, 0, z, 0.07, 0.1, 9, '#e3e3e3', 6);
        if (col === 'ro') flag(b, x, 8.8, z, 2.2); else b.box(x + 1.1, 7.3, z, 2.2, 1.45, 0.05, col === 'eu' ? '#003399' : '#1b3f73');
    }
    b.colPoly([p], 14);
}


// The Landmark (Str. Vasile Alecsandri 4 / Căderea Bastiliei, 2016-17) — UiPath's Bucharest HQ (2020 CV stop) in
// "Corp B" (OSM w546500235, 7 levels, the address node Vasile Alecsandri 4 lies inside it); the sister block "Corp C"
// (w583612401, 7 levels) is left to the generic OSM buildings. Class-A offices: light stone / fibre-cement panels #D8D3C8 with regular vertical window bands, dark grey
// aluminium frames #3C3F42, glass #6F8A94, glazed ground floor with cafés (Ted's Coffee, Friddi), recessed top floor.
// Vasile Alecsandri is one-way southbound; the UiPath door is on its east side (west face of Corp B, ≈ 44.4499, 26.0944).
// Height: 7 levels ≈ 26 m (research table). No published exterior tenant signage -> street number only.
// Src: game/research/bucharest-romana.json/.md (uipath-buc, w546500235 row) ; OSM w546500235 / w583612401
function bTheLandmark(b) {
    // (round 5) news photo of the campus (economica.net; viewed only, not kept): Corp B = four storeys of light-stone grid
    // with deep window reveals, topped by a cantilevered three-storey glass box with dark horizontal bands and a rooftop
    // metal mesh screen; glazed ground floor; landscaped courtyard with a pool between the blocks.
    const ps = P2.thelandmark.map(pts), ST = '#ddd6c8', FR = '#3c3f42', GL = '#6f8a94';
    for (const p of ps) {
        b.prism(p, 0, 15.6, ST, { top: false });
        b.prism(offset(p, 0.1), 0, 4.2, '#7d949c', { mat: 'g', top: false });                // glazed ground floor
        b.pilasters(offset(p, 0.1), 0, 4.2, 3.2, 0.16, 0.12, FR, {});
        b.windows(p, 4.2, 15.6, 3.8, '#55636b', { bay: 2.6, wf: 0.62, hf: 0.78, start: 0.4, mat: 'g', minL: 3, off: -0.25 });   // deep reveals
        b.pilasters(p, 4.2, 15.6, 2.6, 0.5, 0.35, ST, {});
        const top = offset(p, 0.7);                                                            // cantilevered glass box
        curtainTower(b, top, 15.6, 26.6, { glass: GL, spandrel: '#2f3438', mullion: '#8d9599', pitch: 1.5, mw: 0.08, md: 0.1, fh: 3.65, frac: 0.78, start: 0.3 });
        b.cap(top, 15.6, '#cfc8ba', [], -1);
        const sc = offset(p, -1.5); b.ring(sc, 26.6, 29.4, '#6c7175'); b.ring(offset(sc, -0.1), 26.6, 29.4, '#6c7175', { inward: true });   // rooftop mesh screen
    }
    // UiPath door on Vasile Alecsandri (west face of Corp B at the address point 44.4499, 26.0944): canopy + street number
    const dz = 12.4;
    b.box(-21.2, 4.4, dz, 3.4, 0.3, 6, FR); b.box(-19.6, 0, dz, 0.2, 3, 2.4, '#8fa3ad', { mat: 'g' });
    b.text('4', -19.82, 3.3, dz + 2.3, -Math.PI / 2, 0.8, '#f2f2f2');
    entrance(b, { x: -19.5, z: dz, nx: -1, nz: 0 }, { w: 2.2, h: 3, plate: { w: 0.6, h: 0.42, y: 1.3, side: 1, bg: '#ffffff', lines: [['UIPATH', 0.12, '#fa4616'], ['THE LANDMARK', 0.045, '#3c3f42']] } });
    b.colPoly(ps, 10);
}

// Europe House (Bd. Lascăr Catargiu 47-53, 2001-02, CA Immo) — Arnia Software's office (2019 CV stop): one of
// Bucharest's first glass office buildings: blue-green reflective curtain wall #5E7F8C with grey aluminium mullions
// #9EA3A6 over a stone / grey-panelled base #B9B4AA, flat roof with plant room; ground + 10 floors (C&W listing; OSM
// says 14 levels incl. plant floors) ≈ 45 m. Footprint OSM w246115249 (slab along Lascăr Catargiu).
// Src: game/research/bucharest-romana.md (arnia — Europe House: europe_house_caimmo / _cw / _zf) ; OSM w246115249
function bEuropeHouse(b) {
    // (round 5) news photos (officerentinfo.ro / bursa.ro; viewed only, not kept): long slab in DARK blue-grey reflective glass
    // with fine horizontal lines, a taller charcoal wedge-shaped volume at one end with the lit "Orange" rooftop sign (Orange
    // Romania offices are in the building), a light-grey panelled end box with small square windows and "EUROPE HOUSE"
    // lettering, shops on the ground floor. Which end carries the wedge is not certain from the photos (NW end assumed).
    const [p] = P2.europehouse.map(pts), GL = '#3a4c5c', FR = '#6d7880', BASE = '#8d8c88';
    b.prism(p, 0, 5.5, BASE, { top: false }); b.bands(p, 0.4, 5, 4.6, '#3f4f58', { frac: 0.8, wall: BASE, pitch: 4.8, start: 0.4 });
    curtainTower(b, p, 5.5, 44, { glass: GL, spandrel: '#2f3b46', mullion: FR, pitch: 1.6, mw: 0.08, md: 0.12, fh: 3.4, frac: 0.82, start: 0.3 });
    b.cornice(p, 5.4, 0.5, 0.35, FR);
    // charcoal wedge at the NW end (along the slab axis), rising to ≈ 56 m with a sloped top
    const ax = [36.5 - -34.5, 29.5 - -23.5], L = Math.hypot(...ax), ux = ax[0] / L, uz = ax[1] / L, nx = -uz, nz = ux;
    const c0 = [-31 + ux * 6, -26 + uz * 6], ry = Math.atan2(ux, uz);
    b.box(c0[0], 0, c0[1], 12, 46, 11, '#26292c', { ry: ry + Math.PI / 2 });
    b.geo((() => { const sh = new THREE.Shape([new THREE.Vector2(-6, 0), new THREE.Vector2(6, 0), new THREE.Vector2(-6, 10)]); const g = new THREE.ExtrudeGeometry(sh, { depth: 11, bevelEnabled: false }); g.translate(0, 0, -5.5); return g; })(), '#26292c', M(c0[0], 46, c0[1], ry - Math.PI / 2));
    // lit "Orange" sign on the wedge (real tenant signage)
    for (const sg of [-1, 1]) { const x = c0[0] + nx * sg * 5.6 - ux * 3.5, z = c0[1] + nz * sg * 5.6 - uz * 3.5, r2 = Math.atan2(nx * sg, nz * sg); b.box(x, 50.5, z, 4.2, 1.6, 0.1, '#ff7900', { ry: r2, mat: 'e' }); b.text('ORANGE', x + nx * sg * 0.06, 50.85, z + nz * sg * 0.06, r2, 0.8, '#ffffff', { mat: 'e', d: 0.01 }); }
    // light-grey panelled end box (SE end) with small square windows
    const c1 = [33 - ux * 4, 29 - uz * 4];
    b.box(c1[0], 5.5, c1[1], 9, 38.5, 9, '#c9cbca', { ry: ry + Math.PI / 2 });
    { const t = offset(p, -3.5); b.prism(t, 44, 46, '#8e9396'); }
    { const [qx, qz] = centroid(p); b.box(qx, 46, qz, 10, 2.5, 6, '#9a9c9c'); }
    // Arnia (2019 CV stop): main door on Lascăr Catargiu nearest the address point, building name on the canopy, tenant plate
    entrance(b, nearestFacade(p, 20, 2.7), { w: 3.2, h: 3.4, canopy: 2.4, canopyCol: '#9ea3a6', canopyText: 'EUROPE HOUSE', canopyTextH: 0.18, canopyTextCol: '#20343d', plate: { w: 0.6, h: 0.36, y: 1.35, bg: '#ffffff', lines: [['ARNIA', 0.12, '#e2232a'], ['SOFTWARE', 0.05, '#3c3f42']] } });
    b.colPoly([p], 10);
}

// Hala Traian (Calea Călărașilor 133 × Str. Traian, 1896, arch. Giulio Magni; LMI B-II-m-A-18393) — one of the last
// two 19th-century market halls of Bucharest, now a Mega Image supermarket (red fascia on the historic hall). Two
// storeys, cream render with red-and-cream banded piers, a tall central gable to Calea Călărașilor (north) with a big
// arched iron-and-glass window and a pediment lettered "HALA TRAIAN", corner pavilions with finials, metal roof with a
// glazed monitor. Footprint OSM w35147215.
// Src: game/research/bucharest-unirii.json/.md (hala_traian, hala_traian_mega) ; OSM w35147215 ; refs/unirii/Bucharest_-_Hala_Traian_01.jpg,
//      Entrance_of_Hala_Traian_from_the_Calea_C_l_ra_i_in_Bucharest_Romania_.jpg (reference only)
function bHalaTraian(b) {
    const [p] = P2.halatraian.map(pts), CR = '#ece3cf', RD = '#b8483a', WIN = '#40464b', H = 11.5;
    b.wall = CR;
    b.prism(p, 0, H, CR, { topCol: '#8d9295' });
    b.windows(p, 5.4, H - 0.8, 4.6, WIN, { bay: 3.4, wf: 0.4, hf: 0.62, start: 0.9, minL: 5 });       // first-floor windows
    b.prism(offset(p, 0.08), 0, 4.6, '#3a4248', { mat: 'g', top: false });                             // shopfronts
    b.cornice(p, 4.7, 0.5, 0.35, CR); b.cornice(p, H - 0.4, 0.8, 0.55, CR);
    // banded piers: red/cream stripes every 0.75 m on piers at ~5 m pitch
    for (let i = 0; i < p.length; i++) {
        const a = p[i], c = p[(i + 1) % p.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = edgeN(p, i), k = Math.max(1, Math.round(L / 5));
        for (let j = 0; j <= k; j++) {
            const t = j / k, x = a[0] + (c[0] - a[0]) * t + n[0] * 0.25, z = a[1] + (c[1] - a[1]) * t + n[1] * 0.25, ry = -Math.atan2(c[1] - a[1], c[0] - a[0]);
            const dx = (c[0] - a[0]) / L * 0.55, dz = (c[1] - a[1]) / L * 0.55, A2 = [x - dx, z - dz], B2 = [x + dx, z + dz];
            b.box(x, 0, z, 1.1, H - 0.5, 0.5, CR, { ry });
            for (let y = 0.75; y < H - 0.5; y += 1.5) facadeQuad(b, A2, B2, y, y + 0.75, RD, 'm', n, 0.26);
        }
    }
    // pitched metal roof with a glazed monitor along the hall (ridge N-S)
    const [cx, cz] = centroid(p);
    b.hip(cx, H + 0.4, cz, 34, 22, 4.2, '#878d91', { ry: Math.PI / 2 + 0.07 });
    b.box(cx, H + 3.4, cz, 4, 1.6, 26, '#9fb3bd', { mat: 'g', ry: 0.07 });
    // north gable on Calea Călărașilor: tall central pavilion, arched window, pediment + lettering, corner finials
    const gA = p[0], gB = p[4], gx = (gA[0] + gB[0]) / 2, gz = (gA[1] + gB[1]) / 2 - 0.6, gry = -Math.atan2(gB[1] - gA[1], gB[0] - gA[0]);
    b.push(M(gx, 0, gz, gry));
    b.box(0, 0, 0, 10, 15.5, 1.6, CR);
    for (let y = 0, s = 0; y < 15; y += 0.75, s++) for (const sx of [-4.4, 4.4]) b.box(sx, y, -0.95, 1.3, 0.75, 0.4, s % 2 ? RD : CR);
    b.archWall(6.4, 10.5, 0.3, [{ x: 0, w: 5.2, h: 10 }], CR, M(0, 1.2, -0.9));
    b.box(0, 1.2, -0.75, 5.2, 7.4, 0.12, '#5a6d78', { mat: 'g' });
    b.pediment(0, 15.5, -0.2, 11, 3.2, 1.8, CR, Math.PI);
    for (const sx of [-5.2, 5.2]) { b.box(sx, 15.5, 0, 1.4, 1.6, 1.4, CR); b.cone(sx, 17.1, 0, 0.75, 1.2, '#7f8589', 4); }
    b.pop();
    b.text('HALA TRAIAN', gx - 0.85 * Math.sin(gry), 13.2, gz - 0.85 * Math.cos(gry), gry + Math.PI, 0.7, '#6d6457');
    // Mega Image fascia on the Str. Traian side (east)
    const ei = faceEdge(p, [1, 0]), ea = p[ei], ec = p[(ei + 1) % p.length], en = edgeN(p, ei), ery = Math.atan2(en[0], en[1]);
    const mx = (ea[0] + ec[0]) / 2 + en[0] * 0.6, mz = (ea[1] + ec[1]) / 2 + en[1] * 0.6;
    b.box(mx, 3.6, mz, Math.hypot(ec[0] - ea[0], ec[1] - ea[1]) * 0.7, 1.2, 0.5, '#e2231a', { ry: -Math.atan2(ec[1] - ea[1], ec[0] - ea[0]) });
    b.text('MEGA IMAGE', mx + en[0] * 0.27, 3.85, mz + en[1] * 0.27, ery, 0.75, '#ffffff');
    b.colPoly([p], 10);
}

// Globalworth Tower (Bd. Barbu Văcărescu, 2016) — 120 m, 26-27 floors (OSM w547396774: height 120, 27 levels), the
// skyline marker of the Pipera / Floreasca office cluster next to Sky Tower. Glass curtain wall with vertical mullions
// (facade colours estimated, low confidence — no photo in refs).
// Src: game/research/bucharest-pipera.json landmarks[globalworth_tower] (wp_globalworth_tower: 118-120 m, 26 floors) ; OSM w547396774
function bGlobalworth(b) {
    const [p] = P2.globalworth.map(pts);
    b.prism(offset(p, 0.3), 0, 8, '#2f3a43', { mat: 'g', top: false });
    curtainTower(b, p, 8, 114, { glass: '#5d7f99', spandrel: '#6c8aa0', mullion: '#c7cfd5', pitch: 3.2, mw: 0.16, md: 0.3, fh: 4.08, frac: 0.8, start: 0.3 });
    b.ring(offset(p, 0.05), 114, 120, '#6f8fa6', { mat: 'g' }); b.cap(offset(p, -0.3), 115.5, '#8e9498');
    b.colPoly([p], 12);
}

// ===========================================================================
//  Registry
// ===========================================================================
// [lat, lon, rotation]: anchor = centre of the OSM footprint's minimum-area rectangle,
// rotation = orientation of that rectangle (model +x axis), from the ways cited above.
// Stadionul Dinamo (1951, Șos. Ștefan cel Mare) — the Dinamo București bowl: athletics track round the pitch, terraced
// concrete stands on an embankment, the covered main stand (Tribuna I) on the west side, the long open east stand with
// red-and-white seats, the north curve (Peluza „Cătălin Hildan”), a low open south-west end, four floodlight masts.
// Geometry: OSM way 28212482 (outer outline of the stands), pitch way 427813551 (≈ 103 × 63 m, long axis 8.7° east of
// south), the rest from aerial imagery measurements (track: 400 m, 8 lanes, red tartan; stand depth 25–37 m; seat
// colours by sector; shadows of the NW / SE masts). Heights estimated (≈ 15,000 seats; main stand ≈ 14 m + roof).
// Src: https://en.wikipedia.org/wiki/Stadionul_Dinamo ; OSM ways 28212482, 427813551, 860001496 (Peluza Cătălin Hildan)
const DIN_OUT = [-81.2,14.2,-82.3,1.4,-82.6,-15.3,-81.7,-30.5,-79.5,-47.1,-75.8,-60.2,-68.4,-74.8,-64.2,-80.7,-59.6,-86.1,-53.1,-92.3,-46.7,-97.1,-39.2,-101.7,-32.8,-104.7,-23.9,-107.8,-14.2,-109.9,-6.7,-110.6,2,-110.6,13,-109.2,10.5,-99.7,17.1,-98,23.4,-95.7,31.4,-91.7,32.7,-91.1,41.5,-84.9,49.5,-77.4,56.1,-69,61.2,-60.2,64.7,-51.8,72.7,-31.1,77.7,-13.5,81.3,10.7,81.6,26.5,81,36.3,79.8,46.7,78,56.5,76.2,66.1,72.8,76.1,68.7,84.3,62.7,93,55.7,100.6,36,114.9,37.2,123.3,23.1,126.3,12.8,127.3,3.2,126.9,-5.6,125.5,-12.3,123.6,-20.9,120.2,-27.6,116.7,-39.3,108.5,-51.9,96.2,-60.2,84.4,-66.6,70.7,-72,56.1,-76.6,39.8,-78.8,29.5];
const DIN_PITCH = [28.5,-48,-33.3,-38.7,-17.7,63.6,44,54.3];
function bDinamo(b) {
    const out = pts(DIN_OUT), pitchC = pts(DIN_PITCH);
    const cx = pitchC.reduce((s, p) => s + p[0], 0) / 4, cz = pitchC.reduce((s, p) => s + p[1], 0) / 4;
    // stadium frame: u along the pitch's long axis (toward the south end), v across (toward the east)
    const [p0, p1] = [pitchC[1], pitchC[2]], al = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const ux = (p1[0] - p0[0]) / al, uz = (p1[1] - p0[1]) / al, vx = uz, vz = -ux; // u ≈ south, v ≈ east (x east, z south)
    // Shared with the drone football activity: use this model's exact pitch frame.
    b.footballPitch = { center: [cx, 0.16, cz], axis: [ux, uz], halfLength: 52.06, halfWidth: 32.5, goalHalfWidth: 3.66, goalHeight: 2.34 };
    const W = (u, v) => [cx + ux * u + vx * v, cz + uz * u + vz * v];
    const RED = '#c8102e', WHITE = '#eeeeea', GREY = '#bdbbb5', CON = '#a9a69f', CON2 = '#8f8c85', TRACK = '#b5543f', APRON = '#3f7a68', GRASS = '#3f8a3a', GRASS2 = '#4a9a43';
    // capsule (400 m track) sampled by arc length: half-straight A, radius r; returns [{u, v, nu, nv}]
    const A = 42.195;
    const capsule = (r, step = 3) => {
        const o = [], L = 2 * A * 2 + 2 * Math.PI * r, n = Math.max(24, Math.round(L / step));
        for (let i = 0; i < n; i++) {
            let s = i / n * L; // start: east straight, north end → south end
            if (s < 2 * A) { o.push({ u: -A + s, v: r, nu: 0, nv: 1 }); continue; } s -= 2 * A;
            if (s < Math.PI * r) { const t = s / r; o.push({ u: A + Math.sin(t) * r, v: Math.cos(t) * r, nu: Math.sin(t), nv: Math.cos(t) }); continue; } s -= Math.PI * r;
            if (s < 2 * A) { o.push({ u: A - s, v: -r, nu: 0, nv: -1 }); continue; } s -= 2 * A;
            const t = s / r; o.push({ u: -A - Math.sin(t) * r, v: -Math.cos(t) * r, nu: -Math.sin(t), nv: -Math.cos(t) });
        }
        return o;
    };
    const poly = (cap) => cap.map(q => W(q.u, q.v));
    const RI = 36.5, RO = 36.5 + 8 * 1.22, RA = RO + 3.2; // track inner / outer edge, outer apron
    // ---- ground: apron (green-teal), red track with white lane lines, infield, pitch with mowing stripes and markings
    // (each layer is a ring round the next one — no stacked coplanar faces, which flicker from the air)
    const PL = 52, PW = 32.5, PM = 2;                                                     // half pitch (≈ 104 × 65 m) + grass margin
    const pitchRect = [W(-PL - PM, -PW - PM), W(PL + PM, -PW - PM), W(PL + PM, PW + PM), W(-PL - PM, PW + PM)];
    b.prism(poly(capsule(RA + 2.5)), 0, 0.08, '#7d8a7f', { holes: [poly(capsule(RA))] });  // service ring / concourse floor
    b.prism(poly(capsule(RA)), 0, 0.12, APRON, { holes: [poly(capsule(RO))] });
    b.prism(poly(capsule(RO)), 0, 0.16, TRACK, { holes: [poly(capsule(RI))] });
    for (let k = 0; k <= 8; k++) { const r = RI + k * 1.22; b.prism(poly(capsule(r + 0.05, 4)), 0.16, 0.2, '#f4f1ec', { holes: [poly(capsule(r - 0.05, 4))], top: true }); }
    b.prism(poly(capsule(RI)), 0, 0.15, TRACK, { holes: [pitchRect] });                     // the D zones (jumps, throws)
    for (let i = 0; i < 18; i++) { const u0 = -PL - PM + i * (2 * PL + 2 * PM) / 18, u1 = u0 + (2 * PL + 2 * PM) / 18; b.prism([W(u0, -PW - PM), W(u1, -PW - PM), W(u1, PW + PM), W(u0, PW + PM)], 0, 0.16, i % 2 ? GRASS : GRASS2); }
    // Paint is a flat cap, not a 5 cm kerb through the football's lower half.
    const line = (u0, v0, u1, v1, w = 0.12) => { const L = Math.hypot(u1 - u0, v1 - v0), nu = -(v1 - v0) / L * w / 2, nv = (u1 - u0) / L * w / 2; b.cap([W(u0 + nu, v0 + nv), W(u1 + nu, v1 + nv), W(u1 - nu, v1 - nv), W(u0 - nu, v0 - nv)], 0.162, '#f7f7f2'); };
    line(-PL, -PW, PL, -PW); line(-PL, PW, PL, PW); line(-PL, -PW, -PL, PW); line(PL, -PW, PL, PW); line(0, -PW, 0, PW);
    for (const s of [-1, 1]) { const g = s * PL; line(g, -20.16, g - s * 16.5, -20.16); line(g - s * 16.5, -20.16, g - s * 16.5, 20.16); line(g - s * 16.5, 20.16, g, 20.16);
        line(g, -9.16, g - s * 5.5, -9.16); line(g - s * 5.5, -9.16, g - s * 5.5, 9.16); line(g - s * 5.5, 9.16, g, 9.16);
        // goals: posts + crossbar (white), net frame
        for (const v of [-3.66, 3.66]) { const [x, z] = W(g + s * 0.06, v); b.cyl(x, 0.16, z, 0.06, 0.06, 2.44, '#ffffff', 6); }
        // crossbar and net run across the pitch (along v; owner screenshot: they ran along it), the net as a see-through mesh
        const ryV = Math.atan2(vx, vz);
        const [gx, gz] = W(g + s * 0.06, 0); b.box(gx, 2.5, gz, 0.12, 0.12, 7.4, '#ffffff', { ry: ryV });
        for (let v = -3.6; v <= 3.61; v += 0.3) { const [mx, mz] = W(g + s * 1.6, v); b.box(mx, 0.16, mz, 0.025, 2.2, 0.025, '#e4e4e4'); } // back net
        for (let y = 0.4; y < 2.4; y += 0.3) { const [mx, mz] = W(g + s * 1.6, 0); b.box(mx, y, mz, 0.025, 0.025, 7.3, '#e4e4e4', { ry: ryV }); }
        for (const v of [-3.66, 3.66]) for (let t = 0.3; t < 1.6; t += 0.3) { const [mx, mz] = W(g + s * (0.06 + t), v); b.box(mx, 0.16, mz, 0.025, 2.2 + (2.44 - 2.2) * (1 - t / 1.6), 0.025, '#e4e4e4'); } // side nets
        for (const v of [-3.66, 3.66]) { const [ax0, az0] = W(g + s * 0.06, v), [ax1, az1] = W(g + s * 1.6, v); b.strut([ax0, 2.44, az0], [ax1, 2.36, az1], 0.04, 0.04, '#e4e4e4'); } }
    { const n = 40; for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; line(Math.cos(a0) * 9.15, Math.sin(a0) * 9.15, Math.cos(a1) * 9.15, Math.sin(a1) * 9.15); } }
    // ---- the bowl: terraces from the apron's outer edge up to the OSM outline, profile by sector
    const inner = capsule(RA + 2.5, 3.2);
    // The open bowl is also a playable ground. World clips only artificial
    // district-edge walls against this ring; physical stands stay collidable.
    b.footballPitch.playArea = poly(inner);
    const standBox = (corners, bands) => {
        const [a, c] = corners, dx = c[0] - a[0], dz = c[1] - a[1], angle = -Math.atan2(dz, dx), co = Math.cos(angle), si = Math.sin(angle);
        const q = corners.map(([x, z]) => [x * co - z * si, x * si + z * co]);
        const x0 = Math.min(...q.map(p => p[0])), x1 = Math.max(...q.map(p => p[0])), z0 = Math.min(...q.map(p => p[1])), z1 = Math.max(...q.map(p => p[1]));
        const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
        b.col(x * co + z * si, -x * si + z * co, (x1 - x0) / 2, (z1 - z0) / 2, angle, bands);
    };
    const rayHit = (px, pz, dx, dz) => { let best = Infinity; for (let i = 0; i < out.length; i++) { const [ax, az] = out[i], [bx, bz] = out[(i + 1) % out.length], ex = bx - ax, ez = bz - az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const t = ((ax - px) * ez - (az - pz) * ex) / den, s2 = ((ax - px) * dz - (az - pz) * dx) / den; if (t > 0 && s2 >= 0 && s2 <= 1 && t < best) best = t; } return best; };
    const sector = (q) => {
        if (q.u < -A - 4) return 'N';                                    // north curve: Peluza Cătălin Hildan
        if (q.u > A + 4) return q.v > 8 ? 'SE' : q.v < -8 ? 'SW' : 'S';
        return q.v > 0 ? 'E' : 'W';
    };
    const H = { N: 10.5, E: 12, W: 14, SE: 8.5, S: 4.5, SW: 2.6 };
    const seatCol = (sec, k, t, T) => {
        if (sec === 'SW' || sec === 'S') return null;                    // grassed embankment
        const blk = Math.floor(k / 5);
        if (sec === 'E') return t === T - 1 ? GREY : blk % 3 === 1 ? WHITE : RED;
        if (sec === 'SE') return blk % 2 ? WHITE : RED;
        if (sec === 'N') return blk % 4 === 0 ? GREY : WHITE;
        return blk % 2 ? RED : '#a01a2b';                                // main stand: red
    };
    const T = 9, prof = [];
    for (let k = 0; k < inner.length; k++) {
        const q = inner[k], [ix, iz] = W(q.u, q.v); const dx = ux * q.nu + vx * q.nv, dz = uz * q.nu + vz * q.nv;
        let d = rayHit(ix, iz, dx, dz); if (!isFinite(d) || d > 45) d = 20; d = Math.max(4, d - 0.4);
        const sec = sector(q); prof.push({ ix, iz, dx, dz, d, sec, h: H[sec] });
    }
    // (2026-11-08, owner: "stadium a bit broken") the sector heights jumped at every joint (steps and back wall broke into
    // ledges): ramp them over ≈ ±19 m with a moving average round the bowl
    { const h0s = prof.map(p => p.h), m = prof.length, Wn = 6; for (let k = 0; k < m; k++) { let sum = 0; for (let j = -Wn; j <= Wn; j++) sum += h0s[(k + j + m) % m]; prof[k].h = sum / (2 * Wn + 1); } }
    const n = prof.length, P = (pr, t, y) => [pr.ix + pr.dx * pr.d * t, y, pr.iz + pr.dz * pr.d * t];
    for (let k = 0; k < n; k++) {
        const a = prof[k], c = prof[(k + 1) % n], h0 = 1.1, ha = a.h, hc = c.h;
        standBox([P(a, 0, 0), P(c, 0, 0), P(c, 1, 0), P(a, 1, 0)].map(p => [p[0], p[2]]), { h: Math.max(ha, hc) + 1.1 });
        const grass = !seatCol(a.sec, k, 0, T);
        if (grass) { // grass embankment with a low wall at the track
            b.quad(P(a, 0, h0 * 0.6), P(c, 0, h0 * 0.6), P(c, 1, hc), P(a, 1, ha), '#5f8a4a', 'm', [0, 1, 0]);
            b.quad(P(a, 0, 0), P(c, 0, 0), P(c, 0, h0 * 0.6), P(a, 0, h0 * 0.6), CON, 'm', [-a.dx, 0, -a.dz]);
        } else for (let t = 0; t < T; t++) {
            const y0a = h0 + (ha - h0) * t / T, y1a = h0 + (ha - h0) * (t + 1) / T, y0c = h0 + (hc - h0) * t / T, y1c = h0 + (hc - h0) * (t + 1) / T;
            b.quad(P(a, t / T, y0a), P(c, t / T, y0c), P(c, t / T, y1c), P(a, t / T, y1a), CON2, 'm', [-a.dx, 0, -a.dz]);           // riser
            b.quad(P(a, t / T, y1a), P(c, t / T, y1c), P(c, (t + 1) / T, y1c), P(a, (t + 1) / T, y1a), seatCol(a.sec, k, t, T), 'm', [0, 1, 0]); // seat row
        }
        if (!grass) b.quad(P(a, 0, 0), P(c, 0, 0), P(c, 0, h0), P(a, 0, h0), '#e8e6e0', 'm', [-a.dx, 0, -a.dz]); // perimeter wall at the track
        // back wall down to the street (concrete with a darker plinth), parapet on top
        b.quad(P(a, 1, 0), P(c, 1, 0), P(c, 1, hc + 1.1), P(a, 1, ha + 1.1), CON, 'm', [a.dx, 0, a.dz]);
        b.quad(P(a, 1, ha), P(c, 1, hc), P(c, 1, hc + 1.1), P(a, 1, ha + 1.1), CON2, 'm', [-a.dx, 0, -a.dz]);
        b.quad(P(a, 1, ha + 1.1), P(c, 1, hc + 1.1), [P(c, 1, 0)[0] + c.dx * 0.3, hc + 1.1, P(c, 1, 0)[2] + c.dz * 0.3], [P(a, 1, 0)[0] + a.dx * 0.3, ha + 1.1, P(a, 1, 0)[2] + a.dz * 0.3], '#cfccc4', 'm', [0, 1, 0]);
        if (k % 4 === 0 && !grass) { const [ox, , oz] = P(a, 1, 0); b.box(ox + a.dx * 0.4, 0, oz + a.dz * 0.4, 1.2, ha + 0.4, 1.2, '#9d9a92', { ry: Math.atan2(a.dx, a.dz) }); } // buttresses
        // vomitories (dark openings) every ~25 m on the main sectors
        if (!grass && k % 8 === 3) { const t0 = 0.45; const pa = P(a, t0, h0 + (ha - h0) * t0), pc = P(c, t0, h0 + (hc - h0) * t0); b.quad([pa[0], pa[1] + 0.02, pa[2]], [pc[0], pc[1] + 0.02, pc[2]], [pc[0] + c.dx * 2.5, pc[1] + 0.02, pc[2] + c.dz * 2.5], [pa[0] + a.dx * 2.5, pa[1] + 0.02, pa[2] + a.dz * 2.5], '#2a2a2a', 'm', [0, 1, 0]); }
    }
    // ---- main stand roof (west, Tribuna I): a cantilevered slab over the central ~110 m, on columns at the back
    const west = prof.filter(p => p.sec === 'W');
    if (west.length > 4) {
        const mid = west.slice(Math.floor(west.length * 0.12), Math.ceil(west.length * 0.88));
        for (let i = 0; i < mid.length - 1; i++) {
            const a = mid[i], c = mid[i + 1], yb = a.h + 6.2, yf = a.h + 4.6;
            const back = (p) => [p.ix + p.dx * (p.d + 0.6), 0, p.iz + p.dz * (p.d + 0.6)], front = (p) => [p.ix + p.dx * p.d * 0.22, 0, p.iz + p.dz * p.d * 0.22];
            const ba = back(a), bc = back(c), fa = front(a), fc = front(c);
            standBox([fa, fc, bc, ba].map(p => [p[0], p[2]]), { y0: yf - 0.5, y1: yb });
            b.quad([ba[0], yb, ba[2]], [bc[0], yb, bc[2]], [fc[0], yf, fc[2]], [fa[0], yf, fa[2]], '#d9dcdf', 'm', [0, 1, 0]);
            b.quad([ba[0], yb - 0.5, ba[2]], [fa[0], yf - 0.5, fa[2]], [fc[0], yf - 0.5, fc[2]], [bc[0], yb - 0.5, bc[2]], '#8c9196', 'm', [0, -1, 0]);
            b.quad([fa[0], yf - 0.5, fa[2]], [fa[0], yf, fa[2]], [fc[0], yf, fc[2]], [fc[0], yf - 0.5, fc[2]], RED, 'm', [-a.dx, 0, -a.dz]); // red fascia
            if (i % 3 === 0) { b.box(ba[0], a.h, ba[2], 0.6, yb - a.h, 0.6, '#7d8288'); b.strut([ba[0], yb - 0.4, ba[2]], [fa[0] * 0.5 + ba[0] * 0.5, yb - 0.4 - 0.8, fa[2] * 0.5 + ba[2] * 0.5], 0.25, 0.25, '#7d8288'); }
        }
        // VIP box / press row under the roof (glass band)
        const vb = mid.map(p => [p.ix + p.dx * p.d * 0.92, p.iz + p.dz * p.d * 0.92]);
        for (let i = 0; i < vb.length - 1; i++) b.quad([vb[i][0], mid[i].h - 0.2, vb[i][1]], [vb[i + 1][0], mid[i + 1].h - 0.2, vb[i + 1][1]], [vb[i + 1][0], mid[i + 1].h + 2.4, vb[i + 1][1]], [vb[i][0], mid[i].h + 2.4, vb[i][1]], '#3c4b57', 'g', [-mid[i].dx, 0, -mid[i].dz]);
    }
    // ---- scoreboard on the north curve, facing the pitch
    { const q = prof.reduce((m, p) => (p.sec === 'N' && Math.abs(-(p.ix - cx) * vx - (p.iz - cz) * vz) < Math.abs(-(m.ix - cx) * vx - (m.iz - cz) * vz) ? p : m), prof.find(p => p.sec === 'N') || prof[0]);
      const [sx, sz] = [q.ix + q.dx * q.d * 0.9, q.iz + q.dz * q.d * 0.9], ry = Math.atan2(q.dx, q.dz);
      // (2026-11-08, owner screenshot) on legs above the stand: the real building behind the north curve hid the lower half
      const yb = q.h + 5.5;
      b.box(sx, yb, sz, 16, 7, 1.2, '#1e2227', { ry }); b.box(sx - q.dx * 0.62, yb + 0.8, sz - q.dz * 0.62, 14.4, 5.4, 0.05, '#20303a', { ry, mat: 'e' });
      b.text('DINAMO', sx - q.dx * 0.7, yb + 2.4, sz - q.dz * 0.7, ry + Math.PI, 2.2, '#e0302e', { mat: 'e' });
      for (const s of [-1, 1]) { b.box(sx + Math.cos(ry) * s * 6, 0, sz - Math.sin(ry) * s * 6, 0.8, yb + 0.2, 0.8, '#6f747a'); b.box(sx + Math.cos(ry) * s * 6, yb - 2.5, sz - Math.sin(ry) * s * 6, 0.4, 0.3, 3.0, '#6f747a', { ry }); } }
    // ---- four floodlight masts outside the corners (lattice-tapered shafts, a tilted lamp frame facing the centre)
    for (const [su, sv] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const ang = Math.atan2(sv * 0.62, su), qd = { nu: Math.cos(ang), nv: Math.sin(ang) };
        const dx = ux * qd.nu + vx * qd.nv, dz = uz * qd.nu + vz * qd.nv;
        const bx0 = cx + ux * su * (A + 4) + vx * sv * (RA + 2), bz0 = cz + uz * su * (A + 4) + vz * sv * (RA + 2);
        const d = rayHit(bx0, bz0, dx, dz); const mx = bx0 + dx * ((isFinite(d) ? d : 25) + 3), mz = bz0 + dz * ((isFinite(d) ? d : 25) + 3);
        const Hm = 44, ry = Math.atan2(dx, dz);
        b.geo(new THREE.CylinderGeometry(0.55, 1.4, Hm, 4, 1), '#9aa1a8', M(mx, Hm / 2, mz, ry + Math.PI / 4));
        for (let y = 4; y < Hm - 2; y += 4) b.box(mx, y, mz, 2.2 - y / Hm * 1.2, 0.12, 0.12, '#7e858c', { ry });
        const hx = mx - dx * 1.2, hz = mz - dz * 1.2;
        b.box(hx, Hm, hz, 9, 5.5, 0.5, '#5d636a', { ry, rx: 0 });
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) b.box(hx - dx * 0.3 + Math.cos(ry) * (i - 1.5) * 2.1, Hm + 0.5 + j * 1.7, hz - dz * 0.3 - Math.sin(ry) * (i - 1.5) * 2.1, 1.6, 1.2, 0.2, '#fff6dd', { ry, mat: 'e' });
        b.col(mx, mz, 1.4, 1.4, 0, { h: Hm + 6 });
    }
    b.grounds.push(out); b.coverPolys.push(offset(out, -3)); // no trees in the bowl; OSM buildings inside the outline are the model's own
}

const A = {
    parliament: [44.4275038, 26.0874035, -0.0698], cathedral: [44.4259297, 26.0822981, -0.0873], arcul: [44.4671902, 26.078127, -2.7925],
    casapresei: [44.4815236, 26.0709515, -1.2217], grandhotel: [44.4372925, 26.1022881, -2.7751], univ: [44.4355639, 26.1007589, -2.7925],
    tnb: [44.4370273, 26.1036159, -1.1868], ateneu: [44.441344, 26.0973695, -2.5307], regal: [44.4394699, 26.0960493, -1.0996],
    victoria: [44.4528232, 26.0874287, -1.501], cec: [44.4320212, 26.0964749, -0.2094], mnir: [44.4313746, 26.097758, -0.2094],
    marriott: [44.4257465, 26.0766337, -0.6981], unirea: [44.4280154, 26.1048886, -1.501], skytower: [44.4779551, 26.1047395, -1.3265],
    promenada: [44.4781916, 26.1034126, -1.1868], baneasasc: [44.507022, 26.0897843, -0.1745], romexpo: [44.4762793, 26.065137, -0.5411],
    gara: [44.4466161, 26.0748974, -2.3213], opera: [44.4360568, 26.0795203, -0.0873], politehnica: [44.438429, 26.0515105, 0],
    hermes: [44.4810862, 26.1140757, -1.1519], baneasaterm: [44.4962356, 26.0814666, -2.7751], otp: [44.5708154, 26.0795884, -1.4661],
    ase: [44.447807, 26.0971572, 0], ambasador: [44.441963, 26.099535, -1.501], aro: [44.4424337, 26.0992711, -3.0543],
    fountains: [44.4268, 26.1025, 0], aviatorilor: [44.4597696, 26.0860782, 0],
    spaceneedle: [47.6205063, -122.3493043, -0.1571], columbia: [47.6045425, -122.3307183, -1.0123], smith: [47.6019654, -122.331729, -2.6005],
    tmobile: [47.5913642, -122.3324281, 0], spheres: [47.6156773, -122.3394897, -0.7505], seatac: [47.4423743, -122.3012208, -1.4137],
    seatower: [47.4557242, -122.3013712, -0.2618], bellevuetowers: [47.6143271, -122.1981129, 0],
    bellevuesq: [47.615653, -122.2035769, -1.5359],
    lumen: [47.5952, -122.3316, 0], greatwheel: [47.60615, -122.34262, -1.01],
    mtbaker: [47.5903651, -122.2930, 0],               // east portal (east end of OSM way 481496634)
    rainier: [46.8529, -121.7604, 0], olympics: [47.70, -123.15, 0],
    // district-era landmarks (P2 footprints): anchor = bbox centre of the OSM footprints, rotation 0 (+x east)
    lincoln: [47.6168559, -122.2010316, 0], onelincoln: [47.6159634, -122.2008866, 0], lincolnsouth: [47.6147631, -122.2008325, 0], plazacenter: [47.6178822, -122.1940388, 0],
    sonic: [47.6148782, -122.1968365, 0], bellevue600: [47.6160667, -122.1942494, 0],
    // Murrow high-rise arches: anchor ON the I-90 EB carriageway centreline (world edge 'I-90 — Lacey V. Murrow Memorial Bridge'),
    // rotation = road heading (model +x along the road): west high-rise dir (0.9995, 0.0326), east (0.9991, 0.0433)
    murroww: [47.5899055, -122.2849997, -0.0326], murrowe: [47.5892615, -122.2560025, -0.0433],
    seagarage: [47.4432823, -122.2992416, 0], sealink: [47.4452089, -122.2969786, 0],
    gts: [44.433369, 26.1176015, 0], rosetti: [44.4671565, 26.106133, 0], dinamo: [44.4551306, 26.1023192, 0], bob: [44.479608, 26.1147802, 0], thelandmark: [44.450012, 26.0946079, 0], europehouse: [44.4511557, 26.087697, 0], halatraian: [44.4333566, 26.120567, 0], globalworth: [44.4792401, 26.1024141, 0],
};

function L(id, city, name, osmNames, radius, fn, extra = {}) {
    const [lat, lon, rotation] = A[id];
    // footprintRadius: legacy contract (Seattle halved, see SEA_SCALE); radiusM: the same radius in real metres (1:1 districts)
    const lm = { id, city, name, lat, lon, rotation, osmNames, footprintRadius: city === 'seattle' ? radius * SEA_SCALE : radius, radiusM: radius, ...extra };
    Object.defineProperty(lm, '_fn', { value: fn, enumerable: false });
    lm.build = (ctx) => buildLandmark(lm, ctx);
    return lm;
}

/**
 * All landmarks. sourceIds enumerates the complete authored replacement scope for
 * source-preserving districts. Radius/name fields are legacy compatibility metadata;
 * they never authorize deletion of a neighboring source building in that policy.
 */
export const LANDMARKS = [
    // ---- Bucharest ----
    L('parliament', 'bucharest', 'Palatul Parlamentului', ['Palatul Parlamentului', 'Casa Poporului'], 175, bParliament, { floodlit: true }),
    L('cathedral', 'bucharest', 'Catedrala Mântuirii Neamului', ['Catedrala Națională', 'Catedrala Mântuirii Neamului', 'Catedrala Mântuirii Neamului Românesc'], 70, bCathedral, { floodlit: true }),
    L('arcul', 'bucharest', 'Arcul de Triumf', ['Arcul de Triumf'], 18, bArcul, { floodlit: true }),
    L('casapresei', 'bucharest', 'Casa Presei Libere', ['Casa Presei Libere', 'Casa Scînteii'], 160, bCasaPresei),
    L('grandhotel', 'bucharest', 'Grand Hotel Bucharest (ex-InterContinental)', ['Grand Hotel Bucharest', 'InterContinental', 'Hotel InterContinental'], 40, bGrandHotel),
    L('univ', 'bucharest', 'Palatul Universității', ['Universitatea din București', 'Palatul Universității'], 110, bUniv, { floodlit: true }),
    L('tnb', 'bucharest', 'Teatrul Național București', ['Teatrul Național', 'Teatrul Național București', 'Teatrul Național „Ion Luca Caragiale”'], 95, bTNB),
    L('ateneu', 'bucharest', 'Ateneul Român', ['Ateneul Român'], 38, bAteneu, { floodlit: true }),
    L('regal', 'bucharest', 'Palatul Regal (MNAR)', ['Palatul Regal', 'Muzeul Național de Artă al României'], 130, bRegal, { floodlit: true }),
    L('victoria', 'bucharest', 'Palatul Victoria', ['Palatul Victoria'], 58, bVictoria, { floodlit: true }),
    L('cec', 'bucharest', 'Palatul CEC', ['Palatul Casei de Economii şi Consemnaţiuni', 'Palatul CEC'], 36, bCEC, { floodlit: true }),
    L('mnir', 'bucharest', 'Muzeul Național de Istorie a României', ['Palatul Poștelor', 'Muzeul Național de Istorie a României'], 70, bMNIR, { floodlit: true }),
    L('marriott', 'bucharest', 'JW Marriott Grand Hotel', ['JW Marriott', 'JW Marriott Bucharest Grand Hotel'], 75, bMarriott),
    L('unirea', 'bucharest', 'Unirea Shopping Center', ['Unirea Shopping Center'], 115, bUnirea),
    L('fountains', 'bucharest', 'Fântânile din Piața Unirii', [], 0, bFountains),
    L('skytower', 'bucharest', 'Sky Tower', ['Sky Tower'], 28, bSkyTower),
    L('promenada', 'bucharest', 'Promenada Mall', ['Promenada Mall'], 95, bPromenada),
    L('baneasasc', 'bucharest', 'Băneasa Shopping City', ['Băneasa Shopping City'], 190, bBaneasaSC),
    L('romexpo', 'bucharest', 'Romexpo', ['Romexpo'], 65, bRomexpo),
    L('aviatorilor', 'bucharest', 'Monumentul Eroilor Aerului', ['Monumentul Eroilor Aerului'], 8, bAviatorilor),
    L('gara', 'bucharest', 'Gara de Nord', ['Gara de Nord'], 120, bGara),
    L('opera', 'bucharest', 'Opera Națională București', ['Opera Națională'], 70, bOpera),
    L('politehnica', 'bucharest', 'Rectoratul Politehnicii', ['Rectorat Universitatea Politehnica din București'], 30, bPolitehnica, { cvStop: 'upb', ownSign: true, floodlit: true }),
    L('hermes', 'bucharest', 'Hermes Business Campus', ['Hermes', 'Clădirea B+C', 'Hermes Business Campus'], 80, bHermes, { cvStop: 'luxoft', ownSign: true }),
    L('baneasaterm', 'bucharest', 'Aeroportul Băneasa (terminal 1952)', ['Aeroportul Internațional Aurel Vlaicu'], 75, bBaneasaTerm),
    L('otp', 'bucharest', 'Aeroportul Henri Coandă', ['Aeroportul Otopeni Henri Coandă - Plecări', 'Aeroportul Otopeni Henri Coandă - Sosiri', 'Terminalul Vioara'], 230, bOTP),
    L('ase', 'bucharest', 'ASE — Palatul Ion N. Angelescu', ['Clădirea Ion N. Angelescu', 'Academia de Studii Economice'], 0, bASE, { ownSign: true }),
    L('ambasador', 'bucharest', 'Hotel Ambasador', ['Hotel Ambasador'], 30, bAmbasador, { floodlit: true }),
    L('aro', 'bucharest', 'Blocul ARO / Patria', ['Bl. ARO/Patria', 'Hanul Elias - Patria'], 32, bARO),
    L('thelandmark', 'bucharest', 'The Landmark (UiPath HQ)', ['The Landmark Corp B'], 25, bTheLandmark, { cvStop: 'uipath-buc', ownSign: true }),
    L('europehouse', 'bucharest', 'Europe House', ['Europe House'], 24, bEuropeHouse, { cvStop: 'arnia', ownSign: true }),
    L('gts', 'bucharest', 'Calea Călărașilor 101 (GTS Global Intelligence)', [], 9.5, bGTS, { cvStop: 'gts', ownSign: true, floodlit: true }),
    L('dinamo', 'bucharest', 'Stadionul Dinamo', ['Stadionul Dinamo', 'Peluza Catalin Hildan', 'Peluza Cătălin Hildan'], 95, bDinamo, { floodlit: true }),
    L('rosetti', 'bucharest', 'Liceul Teoretic C.A. Rosetti', ['Liceul Teoretic C.A. Rosetti', 'Liceul Teoretic „C.A. Rosetti”', 'Liceul C.A. Rosetti'], 26, bRosetti, { cvStop: 'rosetti', ownSign: true, floodlit: true }),
    L('bob', 'bucharest', 'BOB Tower (DB Global Technology)', ['BOB Tower'], 40, bBOB, { cvStop: 'db', ownSign: true }),
    L('halatraian', 'bucharest', 'Hala Traian', ['Hala Traian'], 12, bHalaTraian),
    L('globalworth', 'bucharest', 'Globalworth Tower', ['Globalworth Tower'], 12, bGlobalworth),
    // ---- Seattle / Bellevue (radius given in real metres, halved by L()) ----
    L('spaceneedle', 'seattle', 'Space Needle', ['Space Needle'], 30, bSpaceNeedle, { sourceIds: ['w12903132','w394254329','w394254330','w394254331','w394254332','w394254333','w394254334','w394254335','w394254336','w394254337','w394254484','w394254485','w394254486','w394254487','w394254488','w394956342','w394956343','w394956344'] }),
    L('columbia', 'seattle', 'Columbia Center', ['Columbia Center'], 50, bColumbia, { sourceIds: ['r4648083','w107124288','w331293871','w418132520','w418132515','w418132517','w418132525'] }),
    L('smith', 'seattle', 'Smith Tower', ['Smith Tower'], 28, bSmith, { sourceIds: ['w52781661','w418140384','w418140385','w418140386'] }),
    L('lumen', 'seattle', 'Lumen Field', ['Lumen Field'], 140, bLumen, { sourceIds: ['w458208102','w458208103','w458208104','w458208105','w458208106','w458208107','w458208112'] }),
    L('tmobile', 'seattle', 'T-Mobile Park', ['T-Mobile Park'], 135, bTMobile, { sourceIds: ['w1451834508','w1451834509','w1451834510','w1451834511','w1451834512','w1451834513','w1451834514','w1451834515','w1451834516','w1451834517','w1451834518','w1451834519','w1451834520','w1451834521','w1451834522','w1451834523'] }),
    L('greatwheel', 'seattle', 'Seattle Great Wheel', ['Seattle Great Wheel Tickets'], 30, bGreatWheel, { sourceIds: [] }),
    L('spheres', 'seattle', 'Amazon Spheres', ['Amazon.com The Spheres'], 36, bSpheres, { sourceIds: ['w868099742','w398816077','w491817110','w491817111'] }),
    L('mtbaker', 'seattle', 'Mount Baker Tunnel (east portal)', [], 0, bMtBaker, { sourceIds: [] }),
    L('seatac', 'seattle', 'Seattle-Tacoma International Airport', ['Sea-Tac Airport Main Terminal'], 480, bSeaTac, { sourceIds: ['w23772634','w23772637','w734002404','w869951038'] }),
    L('seatower', 'seattle', 'SeaTac Control Tower', ['SeaTac Control Tower'], 30, bSeaTower, { sourceIds: ['w53199557','w1199936806','w1199936807'] }),   // r 30: also the 71 m parent outline w53199557 (centroid ~15-21 m off)
    L('lincoln', 'seattle', 'Lincoln Square North (UiPath Bellevue)', ['Lincoln Square', 'Lincoln Square North', 'Cinemark Lincoln Square'], 72, bLincolnN, {  cvStop: 'uipath-bel', hero: true, sourceIds: ['w604028609','w161929514','w1364249504'] }),
    L('onelincoln', 'seattle', 'One Lincoln Tower / Westin Bellevue', ['One Lincoln Tower', 'Westin Bellevue', 'Westin'], 40, bOneLincoln, { sourceIds: ['w604028611','w328017119','w1474737770'] }),
    L('lincolnsouth', 'seattle', 'Lincoln Square South', ['Lincoln Square South', 'Lincoln Square South Tower', '400 Lincoln Square', 'Two Lincoln Tower', 'W Bellevue'], 50, bLincolnS, { sourceIds: ['w1326151866','w604028603','w1326151868'] }),
    L('plazacenter', 'seattle', 'Plaza Center (UiPath Bellevue 2018–2025)', ['Plaza Center'], 32, bPlazaCenter, {  passing: 'plaza-center', sourceIds: ['w33725899'] }),
    L('sonic', 'seattle', 'Amazon Sonic', ['Amazon.com Sonic', 'Amazon Sonic', '555 Tower'], 30, bSonic, { sourceIds: ['w1214423752','w1214424283','w1556489725'] }),
    L('bellevue600', 'seattle', 'Bellevue 600', ['Bellevue 600'], 12, bBellevue600, { sourceIds: ['w1453402304','w1453402305','w1474780170','w1474780171','w1474780172','w1474780173'] }),
    L('murroww', 'seattle', 'Murrow Bridge — west high-rise arches', [], 0, bMurrow, {  districtOnly: true, sourceIds: [] }),
    L('murrowe', 'seattle', 'Murrow Bridge — east high-rise arches', [], 0, bMurrow, {  districtOnly: true, sourceIds: [] }),
    L('seagarage', 'seattle', 'Sea-Tac parking garage + skybridges', ['Sea-Tac Parking Garage', 'Seattle-Tacoma International Airport Parking Garage'], 80, bSeaGarage, { sourceIds: ['r15763840','w37017724','w37017725','w37017726','w37017727','w37017728','w37017729'] }),
    L('sealink', 'seattle', 'SeaTac/Airport Link station', ['SeaTac/Airport'], 30, bSeaLink, { sourceIds: ['w54139654'] }),
    L('bellevuetowers', 'seattle', 'Bellevue Towers', ['Bellevue Towers', 'North Tower', 'South Tower'], 55, bBellevueTowers, { sourceIds: ['w118119171','w370237986','w370239409'] }),
    L('bellevuesq', 'seattle', 'Bellevue Square', ['Bellevue Square Mall'], 190, bBellevueSq, { sourceIds: ['w29234887'] }),
    L('rainier', 'seattle', 'Mount Rainier', [], 0, bRainier, {  backdrop: true, realDistanceKm: 87, sourceIds: [] }),
    L('olympics', 'seattle', 'Olympic Mountains', [], 0, bOlympics, {  backdrop: true, realDistanceKm: 60, sourceIds: [] }),
];

/**
 * Build one landmark.
 * @param lm  entry of LANDMARKS
 * @param ctx { THREE?, rng?, helpers?, backdropScale?, realScale? } — nothing is required; the module is self-contained.
 *            realScale: true builds Seattle models at 1:1 (district mode, spec 10). Without it (legacy corridor world)
 *            Seattle models stay squashed by SEA_SCALE on x/z — kept until the spec 22 cleanup.
 * @returns null for a `districtOnly` landmark in the legacy world (ctx.scale !== 1), else
 *          { mesh: THREE.Group (rotation applied, position at origin), clear: footprintRadius (legacy units) / clearM (real m),
 *            collision: [{x, z, hw, hd, angle}] relative to the anchor in world axes, triangles,
 *            authoredScale: x/z scale the model was built at (1, or SEA_SCALE for legacy Seattle) }
 */
export function buildLandmark(lm, ctx = {}) {
    // road-aligned structures (Murrow arches) are anchored on the 1:1 district road graph: skip them in the legacy corridor world
    if (lm.districtOnly && ctx.scale !== undefined && ctx.scale !== 1) return null;
    const hs = lm.city === 'seattle' && !ctx.realScale ? SEA_SCALE : 1;
    const b = new Builder(hs);
    lm._fn(b, ctx);
    const { group, tris } = b.finish({ floodlit: !!lm.floodlit && ctx.floodlit !== false && !(lm.city === 'seattle' && !ctx.realScale) });
    group.name = 'landmark:' + lm.id;
    group.userData.landmark = lm.id;
    if (b.footballPitch) group.userData.footballPitch = b.footballPitch;
    group.rotation.y = lm.rotation;
    let k = 1;
    if (lm.backdrop) { k = ctx.backdropScale ?? 1; group.scale.setScalar(k); }
    const c = Math.cos(lm.rotation), s = Math.sin(lm.rotation);
    const rot = ([x0, z0]) => { const x = x0 * hs, z = z0 * hs; return [x * c + z * s, -x * s + z * c]; };
    const collision = lm.backdrop ? [] : b.cols.map(q => {
        const x = q.x * hs, z = q.z * hs;
        return { ...q, x: x * c + z * s, z: -x * s + z * c, hw: q.hw * hs, hd: q.hd * hs, angle: lm.rotation + q.angle,
            ...(q.poly ? { poly: q.poly.map(rot), holes: (q.holes || []).map(h => h.map(rot)) } : {}) };
    });
    // fences the world draws (it knows the streets): {ring|line in world axes relative to the anchor, closed, gates, style}
    //  `inside`: the grounds polygon (the fence is kept on its side of a street); `covers`: points of OSM buildings the model
    //  replaces (the world hides the footprint under each point, e.g. the school's sports hall)
    const fences = lm.backdrop ? [] : b.fences.map(f => ({ ...f, ring: (f.ring || f.line).map(rot), inside: f.inside ? f.inside.map(rot) : null,
        gates: (f.gates || []).map(g => ({ ...g, x: g.x * hs * c + g.z * hs * s, z: -g.x * hs * s + g.z * hs * c })) }));
    const covers = lm.backdrop ? [] : b.covers.map(rot), grounds = lm.backdrop ? [] : b.grounds.map(g => g.map(rot)); // grounds: surfaces kept clear of trees
    const coverPolys = lm.backdrop ? [] : b.coverPolys.map(g => g.map(rot)); // polygons: every OSM building centred inside is the model's own
    return { mesh: group, clear: hs === 1 ? lm.radiusM : lm.footprintRadius, clearM: lm.radiusM, collision, triangles: tris, authoredScale: hs, fences, covers, grounds, coverPolys };
}
