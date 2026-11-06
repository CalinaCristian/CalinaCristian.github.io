import * as THREE from '../vendor/three.module.min.js';

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
//  - Bucharest is modelled at 1:1. Seattle's world is scaled 0.5 on x/z only, so every Seattle
//    model is authored in real metres and the Builder squashes x/z by SEA_SCALE (heights stay real).
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
    ase: [[-1.5,18.5,-47.5,17.5,-50.5,42,32.5,42,35.5,41,37,38,37.5,32.5,39,28,46,13.5,50.5,7,42,-1.5,38,3.5,34,-2.5,39.5,-32.5,35.5,-33,36.5,-37,8.5,-42],[14.5,0.5,20,1,23,-1,25,-14.5,17,-16],[8,10.5,16.5,4.5,9,3.5],[22.5,6.5,32.5,21,35.5,13,28,2.5],[3.5,26,4.5,18,14.5,31.5,7,31,7,27.5,6,26]],
    ambasador: [[23,-8,24.5,3,-24,17.5,-24.5,1.5,-20,0.5,-22,-10,-24,-9.5,-24,-17.5,-17.5,-16.5,-17,-13,-8.5,-14.5,-8,-16,5,-14.5,6,-10.5,8.5,-9.5,15.5,-11.5,15.5,-13.5,22,-13]],
    aro: [[6,22,4.5,29,-13.5,25.5,-12,17,-3,19,-6.5,6.5,-5,6,-6.5,-1,-9,0,-9.5,-3,-7.5,-3.5,-9,-10.5,-11,-10,-11.5,-12.5,-9.5,-13.5,-13,-29,0.5,-29,13.5,23,7,24]],
    spaceneedle: [[2,18.5,9,16.5,15,12,18,5.5,19,-2,17,-9,12,-14.5,6,-18,-1.5,-18.5,-9.5,-16.5,-15,-11,-17,-7.5,-19,0,-17,7.5,-12.5,14,-5.5,18]],
    columbia: [[-19,-17.5,-9,-19,-3.5,-22,1,-27,5.5,-34.5,8,-37,36.5,-37,36.5,36.5,-36.5,36.5,-36.5,-17.5],[2.5,26,24,13.5,21.5,9,15,0.5,6.5,-6,2,-9,-3,-11,-13.5,-14,-25,-14,-25,12,-16.5,12,-9.5,13.5,-3.5,17.5],[20.5,12.5,12.5,2.5,2.5,-5,-9.5,-9,-17.5,-10.5,-17,-7,-22.5,9,-14.5,9.5,-7,12,-1,16.5,4,22.5],[2,-9,6.5,-6,15,0.5,18.5,4.5,24,13.5,9,22.5,11,26,29.5,15,25.5,7.5,23.5,0.5,24,-6.5,28.5,-16.5,7,-29,2,-19.5,0,-14.5,-1,-10],[21,7.5,19.5,0,20,-4,20.5,-8,23.5,-15,7,-24.5,3.5,-17,1.5,-9,11,-3,18.5,4.5,21.5,9],[21,-21,23,-24,5.5,-34.5,1,-27,-3.5,-22,-9,-19,-19,-17.5,-19,-14,-8,-12.5,-1,-10,2,-19.5,7,-29]],
    smith: [[18,20,4.5,20,4,18,-1.5,18,-1.5,20,-18,20,-18,1.5,-16,1.5,-16,-4.5,-18,-4.5,-18,-19,-1.5,-20,18,-8.5]],
    tmobile: [[119,-101,78.5,101.5,-94,101,-94,99,-104.5,100.5,-114,95.5,-119,82.5,-117,75.5,-113,70,-116.5,70,-116,-88,-98.5,-88,-98.5,-43.5,-101,-42.5,-94,-39.5,-77,-81,-72,-83.5,-73.5,-85.5,-65,-92.5,-60.5,-87.5,-53,-94,-62,-94,-62,-100.5]],
    spheres: [[-19.5,3.5,-18,-5,-15.5,-9,-10.5,-14,-10.5,-21,-9.5,-25,-7,-28,-4,-31,-0.5,-32.5,3,-33.5,7,-33,11,-32,14,-29.5,17,-27,18.5,-23,19.5,-19.5,19,-15.5,16,-9,19,-2,19.5,2,19.5,6.5,17,13,19.5,18,19.5,21.5,19,25,17,28,14.5,30.5,11.5,32.5,8,33.5,4,33,1,32,-2,30,-4.5,27,-6,21.5,-12,18.5,-17.5,12]],
    seatac: [[-393,-237,-381.5,-221,-386.5,-217.5,-377.5,-205.5,-387.5,-198.5,-380,-188.5,-385,-185,-368,-161.5,-373,-157.5,-360,-139.5,-337.5,-151.5,-371,-223.5,-352.5,-237,-294.5,-127,-310,-118.5,-334.5,-146.5,-349,-136,-299.5,-70,-314.5,-104,-298.5,-115.5,-280,-89.5,-256.5,-106.5,-177.5,3,-152.5,18,-132,21.5,-96,10.5,40,-87,43.5,-82,67.5,-96.5,101.5,-105,112.5,-100,119.5,-90.5,255.5,-191.5,247.5,-202.5,291.5,-234,300,-222.5,319,-230,398,-216.5,401.5,-236,412,-234.5,411.5,-230,447.5,-224.5,445,-210.5,472.5,-206,466.5,-170.5,448,-174,447.5,-169,401.5,-176.5,402,-181.5,367.5,-187,366.5,-192,314.5,-203,167,-96.5,178,-80.5,-36.5,73,-27,81.5,-22,77.5,-11.5,92.5,-19.5,104,-4,126,-17.5,136,-7.5,150,-14.5,155,-9,163,-15,167.5,-2.5,185,6,186.5,7.5,178,75,189,74.5,193.5,92,198.5,134,202.5,141,214.5,139,226,128,237,73.5,226.5,75,219.5,64,221,64.5,217.5,58.5,216.5,57.5,220.5,26.5,215,27,211.5,12.5,212.5,10.5,208.5,9.5,213.5,-14,210,-17.5,199.5,-20,201.5,-67,136,-64,133.5,-69,132.5,-74,119.5,-109.5,146,-113,140,-140,151.5,-160,152.5,-188.5,144,-211,124,-214.5,126.5,-227,109.5,-287.5,153,-285,157,-297,165,-299,162,-302.5,168.5,-327,163.5,-326.5,160,-332,163,-349.5,156.5,-350.5,160.5,-357,159.5,-356.5,155,-361.5,154.5,-362.5,162,-394,156.5,-392.5,149.5,-398,152,-409,147,-413,170.5,-472.5,160.5,-470,148,-466.5,148.5,-463,108,-459.5,106,-439,109.5,-438,106,-432,110.5,-424,108.5,-424.5,112,-391.5,117,-393.5,129.5,-389,126.5,-310.5,142,-301,135.5,-309.5,125.5,-304.5,121.5,-317,104,-307,74.5,-288.5,82,-248.5,53.5,-253.5,47,-262,52.5,-275,34.5,-262,25,-356.5,-107.5,-362.5,-111,-361,-114,-364,-118.5,-367,-116,-435.5,-206.5]],
    seatower: [[-3.5,10.5,-6.5,8,-8,4,-7.5,-1.5,-5,-6.5,-1.5,-9.5,3,-10.5,6.5,-8.5,8,-5,8,2,7,6,5,9.5]],
    lincoln: [[-181,38.5,-161,41.5,-161,43.5,-144,45.5,-144,44,-128,44,-125.5,31.5,-128,0,-177.5,0,-177,22.5,-175.5,22.5,-175.5,27,-181,27],[140,-24,140,19.5,142,19.5,141.5,34.5,177.5,34.5,177,-13,175.5,-13,174,-27.5],[-32,14,-32,-43.5,-13,-43,-13,-26.5,-10.5,-9.5,-10.5,0.5,-12.5,13,-14,17],[23,-35,23,-33.5,12.5,-33.5,13,-8.5,53,-1.5,53,34,64,34,64,44,98,44,98,38.5,107.5,39,107.5,44,167.5,44,167.5,38,181.5,38,181.5,14,177,14,176.5,-9.5,182,-9.5,182.5,-29.5,156,-30,156,-45.5,51,-45.5,51,-34.5],[-181,38.5,-182,38.5,-182.5,22,-180.5,22,-180.5,10,-177.5,10,-177.5,0,-179.5,0,-179.5,-43.5,-141.5,-43,-141.5,-47,-134.5,-47,-134.5,-43.5,-63.5,-44,-64,45.5,-120,45.5,-120,44.5,-128.5,47,-129.5,45,-134.5,46,-153.5,46.5,-172,44,-179.5,41]],
    bellevuetowers: [[-37.5,-27.5,-28.5,-33,-17,-37.5,0,-37,-10,-15,-37.5,-15],[14,3,-6.5,20.5,-2,31.5,-3,33,18,33.5,34,29.5,44.5,24,42.5,22.5,41,10.5,42,10.5,43,8.5,13.5,0.5,13,3],[-47.5,-28.5,-33,-34.5,-19.5,-38,-1.5,-37.5,0,-37,-1,-35,1.5,-34,40,-34,47.5,-26,47.5,3,42,3,39.5,7.5,43,8.5,42,10.5,41,10.5,44.5,20.5,42.5,22.5,44.5,24,28,31,28,36.5,6.5,35.5,6.5,38,-44,38,-44,30,-43,30,-43,26.5,-44.5,26,-45.5,14.5,-42.5,14,-42.5,9.5,-44,9.5,-44,0,-37,-2.5,-37.5,-10.5,-47.5,-12]],
    bellevuesq: [[-181.5,-11,-183,103.5,-181,112,-168,119.5,-131.5,120,-131.5,124.5,-119.5,127,-116.5,122,-67,122,-62.5,118,-62.5,110.5,-53.5,110.5,-35,111,-35.5,123,-28,123.5,-28,126,45.5,124.5,46,86,49.5,86,50,68.5,46,68.5,46.5,61.5,119,63,119,80,182,80.5,183,-19.5,120,-20,120,-15.5,117.5,-15.5,118,-24.5,81,-25,81,-20.5,39,-21,39,-43.5,46.5,-43,47,-59.5,51.5,-59,53,-125.5,23.5,-126,23,-109.5,1.5,-109.5,-5.5,-109.5,-5.5,-126.5,-49.5,-127,-50.5,-58.5,-35,-57.5,-35.5,-35,-71.5,-35.5,-72,-30,-120,-30.5,-120.5,-10]],
    mtbaker: [[359,-21,358.5,3.5,252,24.5,252,71.5,-359,67,-359,-38,152,-35,152.5,-71,252.5,-71.5]],
};

// ---------------------------------------------------------------------------
//  Shared materials (one set for all landmarks -> few programs / draw calls)
// ---------------------------------------------------------------------------
let MATS = null;
function materials() {
    if (MATS) return MATS;
    MATS = {
        m: new THREE.MeshLambertMaterial({ vertexColors: true }),                                   // masonry / matte
        g: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.35 }), // glass / metal
        w: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false }), // water
        f: new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }),                       // far backdrops (mountains)
    };
    MATS.w.name = 'landmark-water'; MATS.f.name = 'landmark-backdrop';
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
    constructor(hs = 1) { this.hs = hs; this.wall = null; this.bk = {}; this.cols = []; this.stack = [new THREE.Matrix4()]; }
    _b(mat) { return this.bk[mat] || (this.bk[mat] = { p: [], n: [], c: [] }); }
    get frame() { return this.stack[this.stack.length - 1]; }
    push(m) { this.stack.push(this.frame.clone().multiply(m)); return this; }
    pop() { this.stack.pop(); return this; }

    /** raw triangle; hint = approximate outward normal (unscaled) used to fix winding */
    tri(a, b, c, col, mat = 'm', hint = null) {
        const s = this.hs;
        const A = [a[0] * s, a[1], a[2] * s], Bv = [b[0] * s, b[1], b[2] * s], C = [c[0] * s, c[1], c[2] * s];
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

    // ---- THREE geometry based primitives (respect the frame stack) ----
    geo(g, col, m, mat = 'm') {
        let gg = g.index ? g.toNonIndexed() : g.clone();
        const S = new THREE.Matrix4().makeScale(this.hs, 1, this.hs).multiply(this.frame);
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
    col(x, z, hw, hd, angle = 0) { this.cols.push({ x, z, hw, hd, angle }); }
    colSeg(x0, z0, x1, z1, hw) { const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); this.cols.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: L / 2, hd: hw, angle: -Math.atan2(dz, dx) }); }
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
    finish() {
        const group = new THREE.Group(), MT = materials();
        let tris = 0;
        for (const [k, b] of Object.entries(this.bk)) {
            if (!b.p.length) continue;
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
            g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
            g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
            g.computeBoundingSphere(); g.computeBoundingBox();
            const mesh = new THREE.Mesh(g, MT[k]);
            mesh.castShadow = k !== 'w' && k !== 'f'; mesh.receiveShadow = k !== 'f';
            group.add(mesh);
            tris += b.p.length / 9;
        }
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
        '&': '01100 10010 10100 01000 10101 10010 01101', "'": '00100 00100 01000 00000 00000 00000 00000', ' ': '00000 00000 00000 00000 00000 00000 00000',
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
    const k = len / 38, W = lv.body || '#f4f5f6', T = lv.tail || '#1d3f8f', GR = '#7d8389', DK = '#2a2f36';
    b.push(M(x, 0, z, heading, k, k, k));
    const y = 3.3;
    b.cylX(0, y, 0, 1.98, 27, W, 12);                                  // fuselage
    b.geo(new THREE.SphereGeometry(1.98, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), W, M(13.5, y, 0, 0, 2.2, 1, 1, 0, -Math.PI / 2)); // nose
    b.geo(new THREE.ConeGeometry(1.98, 9, 12, 1, true), W, M(-18, y + 0.5, 0, 0, 1, 1, 0.9, 0, Math.PI / 2)); // tail cone
    b.box(12.4, y + 0.55, 0, 1.4, 0.55, 3.2, DK);                        // cockpit windows
    if (lv.stripe) b.box(0, y + 0.35, 0, 26, 0.5, 4.02, lv.stripe);       // cheat-line
    if (lv.belly) b.box(0, y - 1.05, 0, 26, 1.6, 3.7, lv.belly);
    for (const s of [-1, 1]) {
        b.box(-1.5, y - 1.2, s * 8.6, 5.2, 0.35, 15, W, { ry: s * 0.42 });          // wing (swept)
        b.box(-6.8, y - 0.9, s * 15.6, 1.2, 1.6, 0.3, T, { ry: s * 0.4 });           // winglet
        b.cylX(1.5, y - 2.1, s * 5.6, 0.95, 4, GR, 10);                              // engine
        b.box(-19.5, y + 0.9, s * 3.6, 3.2, 0.25, 6.4, W, { ry: s * 0.45 });          // stabiliser
        b.box(-0.8, 0, s * 2.6, 0.5, 1.6, 0.5, DK);                                  // main gear
    }
    b.box(10.5, 0, 0, 0.4, 1.6, 0.4, DK);                                            // nose gear
    b.box(-17.5, y + 1.4, 0, 6.2, 6.4, 0.35, T, { rz: -0.32 });                      // fin
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
// Footprint OSM rel 2230391 (outer 14325732, courtyards 167231786/178309073); tier ring from OSM part 283976783
// (58 m, x -82..82 / z -94..106, mirrored — the extract maps only half of it). Massing / facade read from the
// Commons photos "Bucarest - Palau del Parlament.png" (north front) and "Bucharest - Palace of the Parliament (2024)":
// 4-storey arcaded base with corner pavilions, 4-storey arched tier ring, 12-storey central block (≈72 x 104 m)
// with flat roof + flag, north portico (4 pairs of giant columns, balcony), terraced lawns, forecourt wall (OSM 178305226).
// Src: https://en.wikipedia.org/wiki/Palace_of_the_Parliament ; https://www.skyscrapercenter.com/building/wd/10216 ; OSM rel 2230391
function bParliament(b) {
    const W = '#f1eadb', TR = '#e8dfcb', WIN = '#56606a', DK = '#3d454d';
    b.wall = W;
    const [outer, cyN, cyS] = P.parliament.map(pts);
    const Y0 = 1.6;   // courtyards cyN / cyS sit inside the tier ring + central block, so they stay roofed over
    void cyN; void cyS;
    // terrace: stepped platform with balustrade around the building
    b.prism(offset(outer, 7), 0, Y0, '#cfc6b3', { topCol: '#d8d0bf' });
    b.ring(offset(outer, 6.6), Y0, Y0 + 1, TR);                                  // terrace balustrade
    // base (ground arcade + 2 arched storeys + mezzanine + attic) ~ 27 m
    const top0 = storeys(b, outer, Y0, [[7.5, 0.5, 0.72, true], [6.2, 0.45, 0.62, true], [5.2, 0.42, 0.55, false], [4.2, 0.34, 0.45, false]],
        { wall: W, win: WIN, bay: 6.9, courses: [0, 2], trim: TR, pilasters: true, pilasterEvery: 2, pilasterW: 0.9, corniceOut: 1.2, parapet: 1.3 });
    // corner pavilions of the base rise one storey more, with round-headed attic windows
    const pav = [[-115, -137.5, -86, -106], [86, -137.5, 115, -106], [-115, 106, -84, 137.5], [86, 108, 115, 137.5]];
    for (const [x0, z0, x1, z1] of pav) {
        const r = rect(x0, z0, x1, z1);
        storeys(b, r, top0 - 0.8, [[5.5, 0.42, 0.6, true]], { wall: W, win: WIN, bay: 5.8, trim: TR, corniceOut: 0.8, parapet: 1.1, minL: 6 });
    }
    // tier ring (x ±82, z -94..106) around the courtyards — 4 storeys of arched windows
    const ring = rect(-82, -94, 82, 106);
    const top1 = storeys(b, ring, top0 - 1, [[4.8, 0.44, 0.62, true], [4.3, 0.42, 0.55, false], [4.6, 0.42, 0.62, true]],
        { wall: W, win: WIN, bay: 5.6, courses: true, trim: TR, corniceOut: 1, parapet: 1.2 });
    // four towers on the tier ring (front ones are the tall square pavilions seen from Piața Constituției)
    for (const [cx, cz] of [[-70, -82], [70, -82], [-70, 94], [70, 94]]) {
        const r = rect(cx - 12, cz - 12, cx + 12, cz + 12);
        storeys(b, r, top1 - 1, [[4.4, 0.44, 0.6, false], [4.4, 0.44, 0.6, false], [5, 0.44, 0.65, true]], { wall: W, win: WIN, bay: 6, trim: TR, corniceOut: 0.8, parapet: 1.2, minL: 6 });
    }
    // central 12-storey block (72 x 104 m) — flat roof at 84 m, top storeys arched
    const cen = rect(-36, -52, 36, 52);
    const cs = [[4.2, 0.44, 0.55, false], [4.2, 0.44, 0.55, false], [4.4, 0.46, 0.66, true], [4.1, 0.44, 0.55, false], [4.1, 0.44, 0.55, false], [4.1, 0.44, 0.55, false], [4.4, 0.46, 0.66, true], [4.1, 0.4, 0.5, false], [4.6, 0.46, 0.66, true]];
    const ct = storeys(b, cen, top1 - 1, cs, { wall: W, win: WIN, bay: 6.4, holes: [rect(-20, -38, 20, 38)], courses: true, trim: TR, pilasters: true, pilasterEvery: 2, pilasterW: 1.1, corniceOut: 1.3, parapet: 1.4, roofCol: '#cfc7b6' });
    for (const [x0, z0, x1, z1] of [[-36, -52, -26, -42], [26, -52, 36, -42], [-36, 42, -26, 52], [26, 42, 36, 52]]) b.prism(offset(rect(x0, z0, x1, z1), 0.6), top1 - 1, ct - 1, TR, { top: false });  // corner piers
    b.box(0, ct, 0, 10, 2.2, 8, TR);                                              // roof house
    b.cyl(0, ct + 2.2, 0, 0.12, 0.18, 12, '#d8d8d8', 6);
    flag(b, 0, ct + 14, 0, 3.2);
    // north portico (Piața Constituției): 4 pairs of giant columns on a podium, entablature + balustraded balcony
    const zn = -102;
    b.box(0, Y0, zn - 6, 48, 1.2, 12, TR);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const x = s * (5 + i * 6.2); b.colonnade(x - 1, zn - 10.5, x + 1, zn - 10.5, Y0 + 1.2, 13.5, 2, 0.75, '#f3eee4', { capital: TR, seg: 6 }); }
    b.box(0, Y0 + 14.7, zn - 6, 50, 2, 12.5, TR);                                    // entablature
    b.fence([[-24, zn - 12], [24, zn - 12]], 1.2, 3.2, TR, { post: 0.45 });         // balcony balustrade (on top)
    b.box(0, Y0 + 16.7, zn - 12, 48, 0.2, 0.25, TR);
    b.archWall(48, 14, 0.6, [-18, -6, 6, 18].map(x => ({ x, w: 5.5, h: 11 })), '#e6ddca', M(0, Y0 + 1.2, zn - 0.6));   // arcade behind the columns
    // arcaded loggias on the front wings and the Izvor (west) / Libertății (east) fronts
    for (const s of [-1, 1]) b.archWall(36, 8.2, 0.8, [-14, -7, 0, 7, 14].map(x => ({ x, w: 4.4, h: 7.2 })), '#efe8d8', M(s * 44, Y0, zn - 0.45));
    for (const s of [-1, 1]) {
        const xw = s < 0 ? -112.5 : 86.5;
        b.box(xw + s * 4, Y0, -1, 8, 1, 34, TR);
        b.colonnade(xw + s * 7, -14, xw + s * 7, 12, Y0 + 1, 11, 6, 0.65, '#f3eee4', { capital: TR, seg: 6 });
        b.box(xw + s * 4.5, Y0 + 12, -1, 8, 1.6, 34, TR);
    }
    // stepped lawn terraces on the north slope + forecourt retaining wall with stone pillars and iron railing
    for (const s of [-1, 1]) for (const [k, h] of [[0, 0.5], [9, 1.1]]) b.prism(rect(s > 0 ? 27 : -82, -134 + k, s > 0 ? 82 : -27, -105), 0, h, '#7f9d5e', { topCol: '#86a663' });
    const fl = [[-80.1, -266.3], [-78.7, -179.8], [-81.1, -179.6], [-83.9, -177.1], [-82.8, -161.3], [-78, -156.5], [-34.9, -157.4], [88.3, -159.8], [95.9, -164.8], [96.2, -171.9], [89.8, -182], [88.7, -267.5]];
    b.fence(fl, 1.9, 18, '#d9cfbb', { post: 1, base: 0.9, baseCol: '#d6ccb8', bars: 2.4, postCol: '#e1d8c6' });
    for (let i = 0; i + 1 < fl.length; i++) if (Math.hypot(fl[i + 1][0] - fl[i][0], fl[i + 1][1] - fl[i][1]) > 20) b.colSeg(fl[i][0], fl[i][1], fl[i + 1][0], fl[i + 1][1], 0.6);
    b.colPoly([outer], 22);
}

// Catedrala Mântuirii Neamului (Vanel Exim / A. Ion, 2010-25) — 126.1 m x 67.7 m cross plan, 127 m to the
// lantern, cross top ≈ 130-135 m; masonry levels (ro.wikipedia "Catedrala Mântuirii Neamului", building log):
// nave +45 m, four secondary towers +62 m, west bell tower +75.5 m, Pantocrator tower +106 m (then dome + cross).
// Neo-Brâncovenesc: light stone walls with a band of "ocnițe" (blind arched niches), tall arched windows,
// gilded roofs and onion domes, open west porch (pridvor). Footprint OSM way 232332568.
// Src: https://ro.wikipedia.org/wiki/Catedrala_Mântuirii_Neamului ; OSM way 232332568
function bCathedral(b) {
    const S = '#f4f0e7', TR = '#e3dccb', NI = '#c9bfa8', WIN = '#4a535d', GOLD = '#d2a645', GOLDR = '#b88d3a';
    b.wall = S;
    const [outer] = P.cathedral.map(pts), onionLater = [];
    b.prism(offset(outer, 2.5), 0, 1.4, '#cfc6b4', { topCol: '#d9d1c1' });                      // stylobate
    b.prism(outer, 1.4, 36, S, { topCol: TR });
    b.windows(outer, 1.4, 9, 7.6, '#6d6a62', { bay: 4.4, wf: 0.5, hf: 0.7, start: 1.2, arch: true, minL: 7 });     // ground-floor arcade
    b.windows(outer, 9, 31, 7.3, WIN, { bay: 4.6, wf: 0.36, hf: 0.42, start: 1.6, arch: true, minL: 9 });           // rows of small arched windows
    b.cornice(outer, 9, 0.6, 0.5, GOLDR); b.cornice(outer, 35.4, 1, 0.9, TR);
    // round corner turrets with gilded domes at the ends of the arms
    for (const [x, z] of [[-58.5, -13.5], [-58.5, 13.5], [6.5, -31], [21.5, -31], [6.5, 31], [21.5, 31], [-31, -24], [-31, 24]]) {
        b.cyl(x, 1.4, z, 3.4, 3.6, 40.6, S, 10);
        b.cyl(x, 42, z, 3.9, 3.9, 0.8, TR, 8); onionLater.push([x, 42.8, z, 3.6, 5.6, 8]);
    }
    b.roof(outer, 36, 5, GOLDR, 3, { topCol: GOLDR });
    const cross = (x, y, z, h) => { b.box(x, y, z, 0.6, h, 0.6, GOLD, { mat: 'g' }); b.box(x, y + h * 0.62, z, 0.6, 0.55, h * 0.52, GOLD, { mat: 'g' }); };
    const onion = (x, y, z, r, h, seg) => {                                                   // bulbous gilded dome
        const pr = [[0.001, 0], [1, 0], [1.08, 0.24], [0.92, 0.56], [0.46, 0.85], [0.08, 1]].map(([a, c]) => new THREE.Vector2(a * r, c * h));
        b.geo(new THREE.LatheGeometry(pr, seg), GOLD, M(x, y, z), 'g');
    };
    const drum = (x, z, y0, y1, r, seg, winH) => {                                            // polygonal drum, arched windows + colonnettes
        const ring = ellipse(x, z, r, r, seg, Math.PI / seg);
        b.prism(ring, y0, y1, S, { top: false });
        b.windows(ring, y0, y1 - 1, y1 - y0 - 1, WIN, { bay: 2 * r * Math.sin(Math.PI / seg), wf: 0.42, hf: winH, start: (y1 - y0) * 0.16, arch: true, minL: 0.5 });
        b.cornice(ring, y1 - 1.2, 1.2, 0.6, TR); b.cornice(ring, y0, 0.8, 0.5, TR);
    };
    // Pantocrator tower over the crossing: square base, 16-sided drum to +106 m, onion dome, lantern, cross
    const mx = 13.5;
    b.prism(rect(mx - 17, -17, mx + 17, 17), 36, 52, S, { topCol: GOLDR }); b.windows(rect(mx - 17, -17, mx + 17, 17), 36, 52, 16, NI, { bay: 2.6, wf: 0.6, hf: 0.6, start: 4, arch: true });
    b.cornice(rect(mx - 17, -17, mx + 17, 17), 51, 1, 0.8, TR);
    b.cyl(mx, 52, 0, 15.5, 16.5, 4, GOLDR, 16);
    drum(mx, 0, 56, 100, 14.2, 16, 0.55);
    b.cyl(mx, 100, 0, 14.6, 14.8, 6, S, 16);
    onion(mx, 106, 0, 13.6, 18, 20);
    b.cyl(mx, 123, 0, 1.8, 2.1, 4, GOLD, 8, { mat: 'g' }); onion(mx, 127, 0, 2.1, 3, 8);
    cross(mx, 129.5, 0, 6);
    // four secondary towers at the corners of the crossing (+62 m)
    for (const [x, z] of [[mx - 21.5, -21], [mx + 21.5, -21], [mx - 21.5, 21], [mx + 21.5, 21]]) {
        b.prism(rect(x - 5, z - 5, x + 5, z + 5), 36, 42, S, { topCol: GOLDR });
        drum(x, z, 42, 58, 4.4, 8, 0.6);
        onion(x, 58, z, 4.6, 6.5, 12);
        cross(x, 64.2, z, 3.2);
    }
    // west bell tower (+75.5 m) over the narthex, flanked by two smaller towers
    const bx = -48;
    b.prism(rect(bx - 10, -10, bx + 10, 10), 36, 56, S, { topCol: GOLDR });
    b.windows(rect(bx - 10, -10, bx + 10, 10), 36, 56, 20, WIN, { bay: 5, wf: 0.4, hf: 0.6, start: 4, arch: true });
    b.cornice(rect(bx - 10, -10, bx + 10, 10), 55, 1, 0.8, TR);
    drum(bx, 0, 56, 75.5, 7.6, 12, 0.6);
    onion(bx, 75.5, 0, 7.8, 10.5, 14);
    cross(bx, 85.5, 0, 4.5);
    for (const [x, y, z, r, h, sg] of onionLater) { onion(x, y, z, r, h, sg); cross(x, y + h - 0.3, z, 2.4); }
    // west gable: semicircular pediment with a rose window above the porch
    b.geo(new THREE.CylinderGeometry(9, 9, 1.2, 16, 1, false, 0, Math.PI), S, M(-60.6, 36, 0, 0, 1, 1, 1, Math.PI / 2, Math.PI / 2));
    b.cyl(-61.4, 28, 0, 3, 3, 0.4, '#6b7480', 14, { rz: Math.PI / 2 }); b.geo(new THREE.TorusGeometry(3.2, 0.35, 4, 14), TR, M(-61.5, 28, 0, Math.PI / 2));
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
    const W = 25, D = 9.6, S = '#e3d6bd', S2 = '#d8c9ad', TR = '#ece2cf', RL = '#c4b293', TX = '#7d6d55';
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
    // portico (+x): steps, Ionic hexastyle, entablature, pediment
    for (let i = 0; i < 4; i++) b.box(29 - i * 0.6, i * 0.5, 0, 12 - i * 1.2, 0.5, 30 - i * 0.4, '#ddd3bf');
    b.box(14, 2, 0, 10, 13.2, 28, S);
    b.windows(rect(9, -14, 19, 14), 2, 14, 11, '#6b5d45', { bay: 5, wf: 0.5, hf: 0.65, edges: [1], minL: 3 });
    b.colonnade(26.2, -12, 26.2, 12, 2, 12, 6, 0.75, '#f8f4ea', { capital: '#e9dfca', seg: 10 });
    b.box(21, 14, 0, 12, 1.9, 29, TR);
    b.text('ATENEUL ROMAN', 27.06, 14.35, 0, Math.PI / 2, 0.9, '#8b7a5a');
    b.pediment(21, 15.9, 0, 29, 5.4, 12, S, Math.PI / 2);
    b.box(21, 15.9, 0, 12.3, 0.4, 29.6, TR);
    b.col(-4, 0, 30, 24);
}

// Palatul Regal (Royal Palace, now MNAR, 1937 rebuild) — 4 levels (~20 m), long neoclassical
// front on Calea Victoriei with central columned body; OSM way 232472401.
// Src: https://en.wikipedia.org/wiki/Royal_Palace,_Bucharest ; OSM way 232472401
function bRegal(b) {
    b.wall = '#e9e1cd';
    const [p] = P.regal.map(pts);
    b.prism(p, 0, 19, '#e9e1cd', { topCol: C.stone });
    b.bands(p, 0, 19, 4.4, C.winWarm, { frac: 0.45 });
    b.roof(p, 19, 3, '#86847f', 1.8);
    const zf = zAt([p], 20)?.[1] ?? 40;                                     // +z = west, Calea Victoriei
    b.colonnade(-6, zf + 1.5, 44, zf + 1.5, 5, 13, 10, 0.75, C.white, { capital: C.stone });
    b.box(19, 0, zf + 1, 54, 5, 4, C.stone);
    b.box(19, 18, zf + 0.5, 54, 1.4, 4.5, C.cream2);
    b.dome(19, 22, zf - 18, 9, 5, '#8a8f8c', 16);
    b.colPoly([p], 22);
}

// Palatul Victoria (Government, Duiliu Marcu, 1937-52) — OSM way 23554419 + parts 1516914665 (20 m),
// 1516952164 (23 m), 1516952165 (30 m core, green-copper roof #8fbc8f). Stripped-classical travertine block:
// regular grid of tall windows, high ground floor, full-width giant order of square pillars + entrance
// portico to Piața Victoriei (+z),
// attic storey set back, flag mast.
// Src: https://en.wikipedia.org/wiki/Victoria_Palace ; OSM way 23554419 + parts 1516914665/1516952164/1516952165
function bVictoria(b) {
    const S = '#e9e1cd', TR = '#ddd4bf', WIN = '#4c5157';
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
    b.colPoly([p], 20);
}

// Palatul CEC (Paul Gottereau, 1897-1900) — eclectic, ≈ 58 x 60 m (OSM way 973712798); glass-and-iron dome
// over the banking hall (top ≈ 40 m), monumental arched porch with paired columns and a ribbed dome on the
// Calea Victoriei corner (+x), four corner cupolas; white stone with rusticated ground floor.
// Src: https://en.wikipedia.org/wiki/CEC_Palace ; OSM way 973712798
function bCEC(b) {
    const S = '#ece5d5', TR = '#e1d8c4', MT = '#6f7b80', WIN = '#4f4a43';
    b.wall = S;
    const [p] = P.cec.map(pts);
    storeys(b, p, 0, [[6.5, 0.45, 0.68, true], [5.4, 0.4, 0.62, true], [4.6, 0.38, 0.55, false]], { wall: S, win: WIN, trim: TR, bay: 4.4, courses: [0, 1], pilasters: true, pilasterEvery: 1, pilasterW: 0.8, corniceOut: 0.9, parapet: 1, minL: 5 });
    // central glass dome on a drum
    b.cyl(0, 17.6, 0, 11, 11.5, 4.5, S, 20); b.windows(ellipse(0, 0, 11.3, 11.3, 10), 17.6, 22, 4.4, WIN, { bay: 7, wf: 0.35, hf: 0.6, arch: true, minL: 3 });
    b.geo(new THREE.LatheGeometry([[11, 0], [10.4, 4], [8.4, 8.2], [5.2, 11.4], [1.6, 12.8], [0.01, 13]].map(([a, c]) => new THREE.Vector2(a, c)), 20), '#9db3ba', M(0, 22.1, 0), 'g');
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; b.tube([[Math.cos(a) * 11.1, 22.1, Math.sin(a) * 11.1], [Math.cos(a) * 8.6, 30.2, Math.sin(a) * 8.6], [Math.cos(a) * 1.7, 34.9, Math.sin(a) * 1.7]], 0.22, MT, { seg: 3, radial: 3 }); }
    b.cyl(0, 35, 0, 1.6, 1.8, 2.6, MT, 8); b.cone(0, 37.6, 0, 1.6, 2.6, MT, 8);
    // entrance pavilion (+x): big arch with paired columns, dome on a drum
    const xf = xAt([p], 0)?.[1] ?? 22;
    b.box(xf - 4, 0, 0, 9, 21, 18, S);
    b.archWall(18.2, 17.5, 1.6, [{ x: 0, w: 8, h: 13.5 }], TR, M(xf + 0.6, 0, 0, Math.PI / 2));
    for (const z of [-6.8, -5.3, 5.3, 6.8]) b.cyl(xf + 1.9, 1.2, z, 0.5, 0.55, 12, '#f4efe4', 8);
    b.box(xf + 1.9, 0, 0, 1.6, 1.2, 16, '#cfc6b3'); b.box(xf + 1.4, 13.2, 0, 2.4, 1.4, 18.4, TR);
    b.text('CEC', xf + 1.65, 15.1, 0, Math.PI / 2, 1.5, '#7a6b52');
    b.cyl(xf - 4, 21, 0, 5.4, 5.6, 3.5, S, 16); b.dome(xf - 4, 24.5, 0, 5.4, 7, MT, 16);
    b.cyl(xf - 4, 31.3, 0, 0.9, 1, 1.6, S, 8); b.cone(xf - 4, 32.9, 0, 0.9, 3, MT, 8);
    const bb = bbox([p]);
    for (const [x, z] of [[bb.x0 + 3, bb.z0 + 3], [bb.x1 - 3, bb.z0 + 3], [bb.x0 + 3, bb.z1 - 3], [bb.x1 - 3, bb.z1 - 3]]) { b.cyl(x, 18.6, z, 3, 3.2, 3, S, 12); b.dome(x, 21.6, z, 3, 4.2, MT, 12); b.cone(x, 25.6, z, 0.5, 2.2, MT, 6); }
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
    b.colPoly([p], 20);
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
// Src: https://en.wikipedia.org/wiki/Piața_Unirii ; OSM natural=water / amenity=fountain ways
function bFountains(b) {
    for (const [x, z, L] of FOUNTAINS) {
        const plaza = Math.abs(x) < 100, oval = !plaza && L >= 12;
        const rx = plaza ? L * 0.8 : (oval ? 13 : 6.5), rz = plaza ? L * 0.55 : (oval ? 5.5 : 6.5);
        const ang = plaza ? Math.atan2(z, x) + Math.PI / 2 : Math.atan2(4, 60);
        const rot = (q) => q.map(([a, c]) => [x + a * Math.cos(ang) - c * Math.sin(ang), z + a * Math.sin(ang) + c * Math.cos(ang)]);
        const ns = plaza ? 12 : 8, outer = rot(ellipse(0, 0, rx, rz, ns)), inner = rot(ellipse(0, 0, rx - 0.7, rz - 0.7, ns));
        b.ring(outer, 0, 0.6, '#cfc8ba'); b.ring(inner, 0.35, 0.6, '#cfc8ba', { inward: true }); b.lip(inner, outer, 0.6, '#d8d2c6', 1);   // kerb
        b.cap(inner, 0.35, C.water, [], 1, 'w');
        const jets = oval ? [-7, 0, 7] : plaza ? [-rx * 0.4, rx * 0.4] : [0];
        for (const j of jets) {
            const jx = x + j * Math.cos(ang), jz = z + j * Math.sin(ang), h = oval && j === 0 ? 9 : 5.5;
            b.cone(jx, 0.35, jz, 0.9, h, C.spray, 5, { mat: 'w' });
            if (h > 6) b.dome(jx, 0.35, jz, 2.2, 1.1, C.spray, 6, { mat: 'w' });
        }
    }
}

// Sky Tower (Floreasca City Center, 2012) — 137 m, 37 floors, tallest building in Romania (OSM way 219622660:
// height 137, levels 37, colour #3960DA). Lens/ellipse plan, blue glass with white floor-slab lines, the glass
// skin runs past the roof as a crown cut on a slant (≈ 125 -> 137 m), 3-level lobby podium.
// Src: https://en.wikipedia.org/wiki/Sky_Tower_(Bucharest) (137 m, 37 floors) ; OSM way 219622660
function bSkyTower(b) {
    const [p] = P.skytower.map(pts), GL = '#4d74b5', LN = '#c8d4e2';
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

// Rectoratul Universității Politehnica (Splaiul Independenței 313, 1970s) — OSM way 28240552: 5 levels,
// square ≈ 48 x 48 m; roof part 1217715300: dome, building:levels 7 (≈ 42 m Ø). No tower is mapped and no
// published height was found, so the height follows OSM: 5 storeys (≈ 20 m) + shallow dome to ≈ 28 m.
// Concrete frame with continuous ribbon windows and vertical fins; aula under the copper-grey dome.
// Src: OSM way 28240552 (building:levels 5) + roof part 1217715300 (dome, levels 7)
function bPolitehnica(b) {
    const [p] = P.politehnica.map(pts), CON = '#d7d3ca', GL = '#3d4b57';
    b.prism(p, 0, 20, CON, { topCol: '#b9b4aa' });
    b.prism(offset(p, -0.6), 0, 4.6, GL, { mat: 'g', top: false });                          // recessed glazed ground floor
    for (let y = 4.6; y < 19; y += 3.85) b.prism(offset(p, 0.05), y + 1.1, y + 3.2, GL, { mat: 'g', top: false });   // ribbon windows
    b.pilasters(p, 4.6, 20, 3.2, 0.35, 0.45, '#e6e3dc', {});
    b.cornice(p, 19.4, 1, 0.8, '#e6e3dc');
    b.cyl(1, 20.4, 1, 20.5, 21, 1.6, CON, 24);
    b.dome(1, 22, 1, 20.2, 6.2, '#7f8b8c', 24);
    b.cyl(1, 28, 1, 2.2, 2.2, 1.6, '#c9ccc8', 10);
    b.colPoly([p], 16);
}

// Hermes Business Campus (Pipera, 2009) — OSM: Clădirea A 9 levels (way 533147567), B+C with a courtyard
// (458259608) and the smaller building 231123137 (levels unmapped: 7 assumed). Blue-green curtain walls with
// white spandrel lines and aluminium fins, recessed glazed ground floors, rooftop plant boxes, "HERMES" sign.
// Src: https://www.openstreetmap.org/way/533147567 (Clădirea A, 9 levels)
function bHermes(b) {
    const ps = P.hermes.map(pts), H = [35, 27.5, 31.5];
    for (let i = 0; i < 3; i++) {
        const holes = i === 2 ? [ps[3]] : [];
        b.prism(ps[i], 0, H[i], '#466e8c', { mat: 'g', holes, topCol: '#9aa4ab' });
        for (let y = 4.4; y < H[i] - 0.5; y += 3.6) b.cornice(ps[i], y, 0.7, 0.08, '#e8ecef');
        b.pilasters(ps[i], 0, H[i], 4.5, 0.25, 0.35, '#c9d0d5', {});
        b.cornice(ps[i], H[i], 1.1, 0.25, '#e8ecef');
        b.prism(offset(ps[i], -6), H[i], H[i] + 3, '#b5bcc1');
    }
    b.text('HERMES', 35, 31, 57.9, 0, 2.4, '#ffffff');
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

// ASE — Clădirea Ion N. Angelescu (Palatul ASE, 1916-26), Piața Romană: neoclassical with domed
// corner (OSM relation 2274298).
// Src: https://en.wikipedia.org/wiki/Bucharest_Academy_of_Economic_Studies ; OSM rel 2274298
function bASE(b) {
    b.wall = '#e5dbc4';
    const ps = P.ase.map(pts), [outer, ...holes] = ps, S = '#e5dbc4';
    b.prism(outer, 0, 22, S, { holes, topCol: C.stone }); b.bands(outer, 0, 22, 5, C.winWarm, { holes, frac: 0.45 });
    b.roof(outer, 22, 3, '#7e7a74', 1.5, { holes });
    const v = outer.reduce((m, q) => q[0] + q[1] > m[0] + m[1] ? q : m, outer[0]), cx = v[0] - 9, cz = v[1] - 9;
    b.cyl(cx, 22, cz, 7.5, 8, 6, S, 16);
    b.colonnade(cx - 8.5, cz + 2, cx + 2, cz + 8.5, 22, 5.5, 5, 0.4, C.white);
    b.dome(cx, 28, cz, 7.6, 8, '#5e6a6d', 16); b.cyl(cx, 35.8, cz, 1.2, 1.4, 2.4, '#5e6a6d', 8);
    b.colPoly([outer], 20);
}

// Hotel Ambasador (1937-39, Arghir Culina) — interwar modernist stepped hotel on Bd. Magheru (~13 floors).
// Src: https://en.wikipedia.org/wiki/Hotel_Ambasador_(Bucharest)
function bAmbasador(b) {
    b.wall = '#e9e3d4';
    const [p] = P.ambasador.map(pts), S = '#e9e3d4', bb = bbox([p]), cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2;
    b.prism(p, 0, 25, S); b.bands(p, 0, 25, 3.3, '#4a4f55', { frac: 0.5 });
    const t1 = rect(bb.x0 + 6, bb.z0 + 4, bb.x1 - 6, bb.z1 - 8), t2 = rect(cx - 9, cz - 7, cx + 9, cz + 5);
    b.prism(t1, 25, 38, S); b.bands(t1, 25, 38, 3.3, '#4a4f55', { frac: 0.5 });
    b.prism(t2, 38, 46, S); b.bands(t2, 38, 46, 3.3, '#4a4f55', { frac: 0.5 });
    b.box(cx, 46, cz - 1, 6, 3, 6, S); b.cyl(cx, 49, cz - 1, 0.2, 0.2, 5, '#bbb', 6);
    b.box(cx + 12, 8, bb.z0 - 0.8, 2.2, 22, 0.8, '#b52b2b');                  // vertical "AMBASADOR" sign
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
    const W = '#f3f3ef', prof = [[18, 0], [12.5, 28], [8, 70], [6.2, 108], [7.2, 132], [10.5, 147]];
    for (let k = 0; k < 3; k++) {
        const a0 = k / 3 * Math.PI * 2 + 0.3;
        for (const s of [-1, 1]) {
            const pt = prof.map(([r, y], i) => { const spread = (i === 0 ? 0.2 : i < 3 ? 0.13 : 0.1) * s; const a = a0 + spread * (r > 9 ? 1 : 0.8); return [Math.cos(a) * r, y, Math.sin(a) * r]; });
            b.tube(pt, 1.5, W, { seg: 18, radial: 6 });
        }
        b.box(Math.cos(a0) * 18, 0, Math.sin(a0) * 18, 6, 1.2, 6, '#cfcfca');
        // horizontal ties at the skyline level
        b.tube([[Math.cos(a0) * 12.4, 30, Math.sin(a0) * 12.4], [0, 30, 0]], 0.35, W, { seg: 2, radial: 4 });
    }
    b.cyl(0, 0, 0, 3.4, 3.4, 147, '#d9d9d4', 10);                          // elevator core
    b.cyl(0, 29.8, 0, 9, 9, 1.4, W, 16);                                   // 100-ft skyline level
    // top house
    b.cyl(0, 141, 0, 21, 6.5, 9, W, 24);                                   // underside
    b.cyl(0, 150, 0, 21.4, 21, 2.4, '#71899a', 24, { mat: 'g' });          // restaurant glazing
    b.cyl(0, 152.4, 0, 21.8, 21.8, 0.6, W, 24);
    b.cyl(0, 153, 0, 20.4, 20.4, 3, '#71899a', 24, { mat: 'g' });          // observation deck
    b.cyl(0, 156, 0, 23.5, 21.5, 1.2, W, 24);                               // halo ring
    b.cyl(0, 157.2, 0, 17, 22.5, 2.4, '#e9e7e1', 24);
    b.cone(0, 159.6, 0, 17, 5, '#e6a43c', 24);                              // "galaxy gold" roof
    b.cyl(0, 164, 0, 3.6, 4, 3.5, W, 10);
    b.cyl(0, 167.5, 0, 0.45, 0.9, 16.5, '#cfcfcf', 6);
    b.col(0, 0, 14, 14);
}

// Columbia Center (Chester Lindsey, 1985) — 937 ft / 286 m, 76 floors (en.wikipedia "Columbia Center"),
// black granite base and dark glass in three stepped, concave-sided towers. Footprints & heights straight from
// OSM rel 4648083 (parts 160 / 223 / 226 / 280 / 286 m); vertical mullion fins + floor lines every 4 floors,
// Sky View Observatory level (73) as a lighter band.
// Src: https://en.wikipedia.org/wiki/Columbia_Center ; OSM rel 4648083
function bColumbia(b) {
    const ps = P.columbia.map(pts), H = [16, 280, 286, 223, 226, 160];
    ps.forEach((p, i) => {
        b.prism(p, 0, H[i], i ? '#262b31' : '#2c2a2a', { mat: 'g', topCol: '#3a4047' });
        if (!i) return;
        b.bands(p, 20, H[i] - 2, 14.8, '#3e464e', { frac: 0.12, off: 0.15, mat: 'g', wall: false });
        b.pilasters(p, 16, H[i] - 0.5, 4.5, 0.25, 0.25, '#3a4148', {});
        b.cornice(p, H[i] - 1.5, 1.5, 0.3, '#4a525a');
    });
    b.cornice(ps[2], 270, 3, 0.2, '#6f7a84');                                                  // observatory glazing
    b.colPoly([ps[0]], 25);
}
// Smith Tower (1914, Gaggin & Gaggin) — 484 ft / 148 m to the tip, 38 floors (en.wikipedia "Smith Tower").
// White glazed terra-cotta 21-storey base (OSM way 52781661, height 75) with a window grid in paired bays,
// tower shaft to the Chinese Room (35th floor) with an arcaded balcony, pyramidal cap with dormers and the
// glass globe (lit blue/white at night).
function bSmith(b) {
    const W = '#efeadd', TR = '#e2dbc9', WIN = '#4f555c';
    b.wall = W;
    const [p] = P.smith.map(pts);
    b.prism(p, 0, 75, W, { topCol: '#d8d2c4' });
    b.windows(p, 0, 75, 3.55, WIN, { bay: 2.3, wf: 0.5, hf: 0.6, start: 4.5, minL: 3 });
    b.pilasters(p, 0, 75, 6.9, 0.5, 0.25, TR, {}); b.cornice(p, 4, 0.8, 0.5, TR); b.cornice(p, 74, 1.2, 0.8, TR);
    const t = rect(-9, -9, 9, 9);
    b.prism(t, 75, 124, W); b.windows(t, 75, 122, 3.5, WIN, { bay: 2.25, wf: 0.5, hf: 0.6, start: 0.8, minL: 3 });
    b.pilasters(t, 75, 124, 4.5, 0.5, 0.25, TR, { ends: true });
    b.cornice(t, 117.5, 0.6, 1.2, TR); b.box(0, 124, 0, 19.4, 3.5, 19.4, TR);               // balcony + Chinese Room cornice
    b.box(0, 127.5, 0, 20, 1.2, 20, '#e4dece');
    b.hip(0, 128.7, 0, 19, 19, 17.5, '#ece6d8');
    for (const [x, z, ry] of [[0, 6.2, 0], [0, -6.2, Math.PI], [6.2, 0, Math.PI / 2], [-6.2, 0, -Math.PI / 2]]) b.box(x, 131, z, 3, 2.6, 1.2, '#dcd5c3', { ry });   // dormers
    b.sphere(0, 146.8, 0, 1.2, '#cfe2ea', { mat: 'g' });
    b.colPoly([p], 15);
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
    b.prism(rect(FX - 30, FZ - 60, FX + 30, FZ + 60), 0, 0.25, '#3f8a3a');
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
        b.box(FX + s * 82, 44, FZ, 54, 1.4, 222, '#203352', { rz: s * 0.06 });                    // navy roof membrane
        const arch = []; for (let i = 0; i <= 12; i++) { const t = i / 12, zz = FZ - SPAN / 2 + t * SPAN; arch.push([FX + s * 106, 44 + 22 * Math.sin(Math.PI * t), zz]); }
        b.tube(arch, 1.5, '#f0f0ee', { seg: 24, radial: 6 });
        b.box(FX + s * 106, 44.6, FZ, 2, 1.6, SPAN, '#e6e6e3');                // tie
        for (let i = 1; i < 12; i++) { const t = i / 12, zz = FZ - SPAN / 2 + t * SPAN; b.tube([[FX + s * 106, 44 + 22 * Math.sin(Math.PI * t), zz], [FX + s * 72, 45.5, zz]], 0.35, '#e6e6e3', { seg: 2, radial: 4 }); }
        for (const e of [-1, 1]) { b.box(FX + s * 106, 0, FZ + e * SPAN / 2, 5, 44, 5, CON); b.box(FX + s * 106, 44, FZ + e * SPAN / 2, 6.5, 2.4, 6.5, '#9aa0a5'); }
    }
    // roof lettering (white on the canopies, readable from the air)
    b.text('LUMEN', FX - 82, 46.7, FZ, Math.PI / 2, 22.4, '#ffffff', { flat: true, d: 0.1 });
    b.text('FIELD', FX + 82, 46.7, FZ, -Math.PI / 2, 9.6, '#ffffff', { flat: true, d: 0.1 });
    // south end: video board above the end-zone deck; north end open "Hawks Nest" bleachers
    b.prism(rect(FX - 60, FZ + 100, FX + 60, FZ + 118), 22, 32, CON, { topCol: SEAT });
    b.box(FX, 34, FZ + 108, 64, 16, 3, '#1e2227'); b.box(FX, 35, FZ + 106.4, 58, 13, 0.2, '#2d5d88');
    b.prism(rect(FX - 50, FZ - 114, FX + 50, FZ - 98), 0, 14, CON, { topCol: SEAT });
    b.col(FX, FZ, 106, 120);
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
    const ring = pts(TMB_RING), field = pts(TMB_FIELD), dirt = pts(TMB_DIRT), BR = '#86463a', ST = '#3f6863', SEAT = '#1c4a63';
    b.prism(field, 0, 0.2, '#3f8a3a', { topCol: '#3f8a3a' });
    b.prism(dirt, 0.2, 0.3, '#b48a5a');
    b.prism(rect(-20, 4, -12, 12), 0.3, 0.35, '#5a9a4a');                              // infield grass square
    // grandstand: brick base with arched openings, green steel above, seating on top
    b.prism(ring, 0, 22, BR, { topCol: SEAT });
    b.windows(ring, 0, 9, 9, '#3a2a25', { bay: 7, wf: 0.55, hf: 0.7, start: 0.5, arch: true, minL: 10, edges: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] });
    b.prism(ring, 22, 38, ST, { topCol: SEAT });
    b.bands(ring, 9, 38, 6.5, '#2f3a3d', { frac: 0.35, wall: false });
    b.cornice(ring, 9, 0.8, 0.4, '#d8d3c8');
    // lower-bowl rakes (OSM skillion parts, simplified to stepped blocks)
    for (const pz of [[-33, -48, -62.5, -65.5, -78, -28.5, -46, -18], [-46, -18, -48, -5, -51.5, -5.5, -56, 21.5, -86, 17, -78, -28.5], [-56, 21.5, -51, 23, -51, 32, -48.5, 38, -77, 60, -83.5, 51, -87, 40.5, -86, 17], [-35, 44.5, -36, 81, -64, 73, -77, 60, -48.5, 38, -41, 43.5], [-5, 48.5, -5, 45, 7.5, 45.5, 13.5, 80, -36, 81, -35, 48.5], [39.5, 37.5, 64, 61, 56, 69, 13.5, 80, 7.5, 45.5], [63.5, 41, 74, -13.5, 86, -11.5, 74, 45.5]]) {
        const q = pts(pz); b.prism(q, 0, 4, '#c3bfb6', { topCol: SEAT }); b.prism(offset(q, -4), 4, 9, '#c3bfb6', { topCol: SEAT });
    }
    // north upper deck (15-32 m) + scoreboard
    b.prism(rect(-39, -101, 52, -83.5), 15, 32, ST, { topCol: SEAT }); b.box(6, 32, -97, 40, 12, 2, '#1e2227');
    // roof runways (46 m) on columns + the three parked panels (round top to 66 m) over the east side
    for (const z of [-98, 103]) { b.box(116, 42, z, 112, 4.5, 5, '#7f8f92'); for (const x of [62, 100, 136, 170]) b.box(x, 0, z, 3.5, 42, 3.5, '#7f8f92'); }
    [[78, 66], [106, 64], [134, 62]].forEach(([x, top], i) => {
        const r = 160, yc = top - r, n = 8, half = Math.asin(104 / r);
        for (let k = 0; k < n; k++) {
            const f0 = -half + k / n * 2 * half, f1 = f0 + 2 * half / n, fm = (f0 + f1) / 2, seg = 2 * r * Math.sin(half / n) + 0.5;
            b.box(x, yc + r * Math.cos(fm) - 0.75, 2 + r * Math.sin(fm), 30, 1.5, seg, i % 2 ? '#d6d8d5' : '#c8cdca', { rx: fm });
        }
        b.box(x, 42, 2, 30, 4, 4, '#7f8f92');
    });
    b.text('T-MOBILE PARK', -78, 13, 93.6, 0.32, 2.4, '#e20074');
    b.colPoly([ring], 24); b.col(116, -98, 56, 3); b.col(116, 103, 56, 3);
}

// Seattle Great Wheel (2012) — 53 m tall, 42 gondolas, end of Pier 57 (OSM ticket booth way
// 429553385). Built at true size in its own plane (not squashed) so it stays a circle.
// Src: https://en.wikipedia.org/wiki/Seattle_Great_Wheel (53 m, 42 gondolas)
function bGreatWheel(b) {
    const hs = b.hs; b.hs = 1;                                             // keep the wheel round (true size)
    const R = 25, Y = 28.5;
    for (const z of [-1.8, 1.8]) b.geo(new THREE.TorusGeometry(R, 0.55, 6, 56), '#f2f2f2', M(0, Y, z));
    for (let i = 0; i < 21; i++) { const a = i / 21 * Math.PI * 2; b.box(Math.cos(a) * R / 2, Y - 0.15, 0, R, 0.3, 0.3, '#e6e6e6', { rz: a }); }
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
    // A squashed sphere reads as an egg, so the spheres are kept round: built unsquashed at half
    // size (footprint matches the 0.5 world, heights become ~12-15 m instead of 24-29 m).
    const hs = b.hs; b.hs = 1; const k = hs, G = '#9fb5ae';
    for (const [x, z, r, h] of [[0.5, 0, 20, 29], [2.5, -19.5, 14.5, 24], [1.5, 22, 12.5, 21]]) b.sphere(x * k, (h - r) * k, z * k, r * k, G, { detail: 2, mat: 'g' });
    b.box(1 * k, 0, 0, 30 * k, 1.5, 60 * k, '#c9c6bf');
    b.hs = hs;
    b.col(1, 0, 18, 32);
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
}

// Seattle-Tacoma International Airport — main terminal & concourses A-D (OSM way 23772634, 2 levels), the
// South Satellite (OSM 23772637, 2 levels) and the International Arrivals Facility (opened 2022, OSM 734002404)
// with its aerial walkway (OSM 869951038: 25.9 -> 33.5 m, i.e. 85 ft over the taxiway, ≈ 240 m / 780 ft long)
// linking the IAF to the South Satellite. Control tower (71 m, OSM 1199936807) is modelled separately.
const SEA_IAF = [398, -216.5, 319.5, -230, 319, -227.5, 300, -222.5, 291.5, -234, 247.5, -202.5, 251.5, -197, 148, -123, 152, -117.5, 124, -96.5, 122, -99.5, 116.5, -96, 114, -98.5, 119.5, -102.5, 104.5, -121.5, 248, -262, 263, -274.5, 282.5, -282.5, 310.5, -284.5, 400, -269, 397, -253, 404.5, -252, 405.5, -259, 415.5, -257.5, 412, -234.5, 401.5, -236];
const SEA_SSAT = [349, 113, 349, 110, 333, 111.5, 331.5, 87, 347.5, 85.5, 345, 57.5, 397.5, 54, 408.5, 209, 356.5, 213];
// Src: https://en.wikipedia.org/wiki/Seattle–Tacoma_International_Airport ; OSM 23772634 / 23772637 / 734002404 / 869951038
function bSeaTac(b) {
    const [p] = P.seatac.map(pts), iaf = pts(SEA_IAF), ss = pts(SEA_SSAT), GL = '#5b7d92', WH = '#e9ebec';
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
    b.colPoly([p], 40); b.colPoly([iaf], 30); b.colPoly([ss], 30);
    for (const z of [-150, 22]) b.col(wx, z, 7, 1.6);
}

const SEATAC_PLANES = [
    [0.12, { tail: '#01426a', stripe: '#00a3ad' }],   // Alaska
    [0.40, { tail: '#c01933', stripe: '#003366' }],   // Delta
    [0.68, { tail: '#0033a0', belly: '#9aa3ad' }],    // United
];

// SeaTac Air Traffic Control Tower (2004) — 71 m (233 ft), OSM way 1199936807.
// Src: https://en.wikipedia.org/wiki/Seattle–Tacoma_International_Airport (tower 233 ft) ; OSM way 1199936807
function bSeaTower(b) {
    b.box(0, 0, 0, 30, 9, 22, '#cfcdc6'); b.bands(rect(-15, -11, 15, 11), 0, 9, 4.5, '#4c5964', { frac: 0.5 });
    atcTower(b, 0, 0, 71, { r: 3.6, col: '#dedcd5' });
    b.col(0, 0, 15, 11);
}

// Lincoln Square (Bellevue) — Lincoln Square North 126 m, Lincoln Square South 137 m, One Lincoln
// Tower 137 m (OSM parts 604028609 / 1326151866 / 604028611) on 3-level podiums. Checked against
// skyscrapercenter.com: 400 Lincoln Square 139.4 m / 32 fl., One Lincoln Tower 137.2 m / 42 fl.; glass crowns.
// Src: https://www.skyscrapercenter.com/building/400-lincoln-square/22497 ; OSM parts 604028609/1326151866/604028611
function bLincoln(b) {
    const [n, s, one, podS, podN] = P.lincoln.map(pts);
    b.prism(podN, 0, 14, '#cbc3b5', { topCol: '#a9a399' }); b.bands(podN, 0, 14, 4.6, '#4e6470', { frac: 0.5, mat: 'g' });
    b.prism(podS, 0, 14, '#cbc3b5', { topCol: '#a9a399' }); b.bands(podS, 0, 14, 4.6, '#4e6470', { frac: 0.5, mat: 'g' });
    for (const [p, h, c, y0] of [[n, 126, '#5f8c94', 14], [s, 137, '#6890a0', 14], [one, 137, '#4f7c8c', 0]]) {   // One Lincoln Tower stands on its own
        b.prism(p, y0, h, c, { mat: 'g', topCol: '#c9d1d3' });
        b.bands(p, y0, h, 12, '#d8dcd7', { frac: 0.1, off: 0.12 });
        b.prism(offset(p, -3), h, h + 4, '#d0d5d6');
        b.pilasters(p, y0, h, 6, 0.3, 0.3, '#c5ced0', {});                                     // mullion fins
        b.ring(p, h, h + 6, '#7fa3b0', { mat: 'g' });                                           // glass screen crown
    }
    b.text('LINCOLN SQUARE', -150, 9, 46.6, 0, 2.2, '#2e3b46');
    b.colPoly([podN], 25); b.colPoly([podS], 25);
}

// Bellevue Towers (2008) — twin residential towers, 43 & 42 floors (137 m / 131 m) on a 5-level podium
// (skyscrapercenter.com complex 2787: 450 ft / 430 ft); glass parapet crowns, mullion fins.
// Src: https://www.skyscrapercenter.com/complex/2787
function bBellevueTowers(b) {
    const [n, s, pod] = P.bellevuetowers.map(pts);
    b.prism(pod, 0, 18, '#d1ccc2', { topCol: '#7f9e6b' }); b.bands(pod, 0, 18, 3.6, '#4f6573', { frac: 0.5 });
    for (const [p, h] of [[n, 137], [s, 131]]) {
        b.prism(p, 18, h, '#7398b0', { mat: 'g', topCol: '#c7d0d6' });
        b.bands(p, 18, h, 3.1, '#d9e0e4', { frac: 0.12, off: 0.1 });
        b.prism(offset(p, -2.5), h, h + 5, '#cfd6da');
        b.ring(p, h, h + 7, '#9db7c6', { mat: 'g' });                                           // glass parapet crown
        b.pilasters(p, 18, h, 8, 0.35, 0.35, '#dfe6ea', {});
    }
    b.colPoly([pod], 25);
}

// Bellevue Square (1946, rebuilt as an enclosed mall 1981) — 3-level regional mall (OSM way 29234887),
// skylit malls, main glazed entrance + lettering on Bellevue Way NE (east, model -z).
// Src: https://en.wikipedia.org/wiki/Bellevue_Square ; OSM way 29234887
function bBellevueSq(b) {
    const [p] = P.bellevuesq.map(pts);
    b.prism(p, 0, 15, '#e3dccf', { topCol: '#cbc4b7' }); b.bands(p, 0, 15, 5, '#5a7486', { frac: 0.35, mat: 'g', start: 2 });
    b.box(0, 15, 0, 300, 2.5, 14, '#cbd6dc', { mat: 'g' });                 // skylit mall spine
    b.box(-20, 15, 0, 14, 2.5, 200, '#cbd6dc', { mat: 'g' });
    // main entrance on Bellevue Way NE (model -z = east): glazed pavilion + lettering
    const ze = zAt([p], 0)?.[0] ?? -126;
    b.box(0, 0, ze - 4, 30, 13, 8, '#6f8ea2', { mat: 'g' }); b.box(0, 13, ze - 4.5, 34, 1.4, 10, '#efe9df');
    b.text('BELLEVUE SQUARE', 0, 15.6, ze - 0.2, Math.PI, 3, '#2e3b46');
    b.colPoly([p], 40);
}

// Mount Rainier — 4,392 m stratovolcano, summit 46.8529 N 121.7604 W (~90 km SE of downtown).
// Real-size cone (base Ø ~32 km, squashed 0.5 on x/z like the rest of the city); `backdrop: true`
// means the world may move it closer and pass ctx.backdropScale = distance / realDistance.
// Src: https://en.wikipedia.org/wiki/Mount_Rainier (4,392 m, 46.8529 N 121.7604 W)
function bRainier(b) {
    const NA = 56, NR = 16, Rb = 16500, H = 4392, rings = [];
    for (let j = 0; j <= NR; j++) {
        const t = j / NR, ring = [];
        for (let i = 0; i < NA; i++) {
            const a = i / NA * Math.PI * 2, n = hash(i * 7.3 + j * 13.1), n2 = hash(i * 3.1 + 1.7);
            const r = Rb * t * (1 + (n - 0.5) * 0.07 * Math.min(1, t * 3) + (n2 - 0.5) * 0.1 * Math.sin(a * 3));
            const prof = t < 0.035 ? 1 : Math.pow(1 - (t - 0.035) / 0.965, 1.6);
            const y = H * prof * (j === 0 ? 1 : 1 + (n - 0.5) * 0.08 * Math.sin(Math.PI * t));
            ring.push([Math.cos(a) * r, Math.max(0, y), Math.sin(a) * r]);
        }
        rings.push(ring);
    }
    const colour = (y, i, j) => { const n = hash(i * 1.9 + j * 5.7); return y > 2300 + n * 300 ? '#f3f6f9' : y > 1500 + n * 500 ? (n > 0.4 ? '#e3e9ef' : '#8e98a3') : y > 800 ? '#6d7b88' : '#55657a'; };
    for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) {
        const a = rings[j][i], bq = rings[j][(i + 1) % NA], c = rings[j + 1][(i + 1) % NA], d = rings[j + 1][i];
        const col = colour((a[1] + c[1]) / 2, i, j), hint = [a[0] + c[0], 3000, a[2] + c[2]];
        if (j === 0) b.tri(a, c, d, col, 'f', hint); else b.quad(a, bq, c, d, col, 'f', hint);
    }
}

// Olympic Mountains — silhouette ridge west of Puget Sound (The Brothers 2,092 m, Mt Constance
// 2,371 m, Mt Olympus 2,432 m further west). ~80 km long backdrop band, same backdrop rules.
// Src: https://en.wikipedia.org/wiki/Olympic_Mountains (Olympus 2,432 m, Constance 2,371 m, The Brothers 2,092 m)
function bOlympics(b) {
    const NX = 72, NZ = 6, L = 80000, Wd = 16000, grid = [];
    for (let i = 0; i <= NX; i++) {
        const x = -L / 2 + i / NX * L, row = [];
        const crest = 1250 + 600 * Math.sin(i * 0.37) * Math.sin(i * 0.11 + 1) + 420 * (hash(i * 3.7) - 0.3) + (i % 9 === 4 ? 450 : 0);
        for (let j = 0; j <= NZ; j++) { const t = j / NZ, prof = Math.pow(Math.sin(Math.PI * t), 1.6); row.push([x, Math.max(0, crest * prof * (0.85 + 0.3 * hash(i * 1.3 + j))), -Wd / 2 + t * Wd]); }
        grid.push(row);
    }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
        const a = grid[i][j], bq = grid[i + 1][j], c = grid[i + 1][j + 1], d = grid[i][j + 1], y = (a[1] + c[1]) / 2;
        b.quad(a, bq, c, d, y > 1500 ? '#eef2f6' : y > 1050 ? '#8b96a2' : '#5d6c7c', 'f', [0, 1, 0]);
    }
}

// ===========================================================================
//  Registry
// ===========================================================================
// [lat, lon, rotation]: anchor = centre of the OSM footprint's minimum-area rectangle,
// rotation = orientation of that rectangle (model +x axis), from the ways cited above.
const A = {
    parliament: [44.4275038, 26.0874035, -0.0698], cathedral: [44.4259297, 26.0822981, -0.0873], arcul: [44.4671902, 26.078127, -2.7925],
    casapresei: [44.4815236, 26.0709515, -1.2217], grandhotel: [44.4372925, 26.1022881, -2.7751], univ: [44.4355639, 26.1007589, -2.7925],
    tnb: [44.4370273, 26.1036159, -1.1868], ateneu: [44.441344, 26.0973695, -2.5307], regal: [44.4394699, 26.0960493, -1.0996],
    victoria: [44.4528232, 26.0874287, -1.501], cec: [44.4320212, 26.0964749, -0.2094], mnir: [44.4313746, 26.097758, -0.2094],
    marriott: [44.4257465, 26.0766337, -0.6981], unirea: [44.4280154, 26.1048886, -1.501], skytower: [44.4779551, 26.1047395, -1.3265],
    promenada: [44.4781916, 26.1034126, -1.1868], baneasasc: [44.507022, 26.0897843, -0.1745], romexpo: [44.4762793, 26.065137, -0.5411],
    gara: [44.4466161, 26.0748974, -2.3213], opera: [44.4360568, 26.0795203, -0.0873], politehnica: [44.4384296, 26.0515099, -0.2443],
    hermes: [44.4810862, 26.1140757, -1.1519], baneasaterm: [44.4962356, 26.0814666, -2.7751], otp: [44.5708154, 26.0795884, -1.4661],
    ase: [44.447807, 26.0971572, -1.5184], ambasador: [44.441963, 26.099535, -1.501], aro: [44.4424337, 26.0992711, -3.0543],
    fountains: [44.4268, 26.1025, 0], aviatorilor: [44.4597696, 26.0860782, 0],
    spaceneedle: [47.6205063, -122.3493043, -0.1571], columbia: [47.6045425, -122.3307183, -1.0123], smith: [47.6019654, -122.331729, -2.6005],
    tmobile: [47.5913642, -122.3324281, 0], spheres: [47.6156773, -122.3394897, -0.7505], seatac: [47.4423743, -122.3012208, -1.4137],
    seatower: [47.4557242, -122.3013712, -0.2618], lincoln: [47.6156411, -122.2008675, -1.5533], bellevuetowers: [47.6143271, -122.1981129, 0],
    bellevuesq: [47.615653, -122.2035769, -1.5359],
    lumen: [47.5952, -122.3316, 0], greatwheel: [47.60615, -122.34262, -1.01],
    mtbaker: [47.5903651, -122.2930, 0],               // east portal (east end of OSM way 481496634)
    rainier: [46.8529, -121.7604, 0], olympics: [47.70, -123.15, Math.PI / 2],
};

function L(id, city, name, osmNames, radius, fn, extra = {}) {
    const [lat, lon, rotation] = A[id];
    const lm = { id, city, name, lat, lon, rotation, osmNames, footprintRadius: city === 'seattle' ? radius * SEA_SCALE : radius, ...extra };
    Object.defineProperty(lm, '_fn', { value: fn, enumerable: false });
    lm.build = (ctx) => buildLandmark(lm, ctx);
    return lm;
}

/**
 * All landmarks. footprintRadius is in WORLD metres (Seattle already halved): generic OSM buildings
 * whose centroid lies within it should be suppressed. osmNames lists the OSM `name` values of the
 * buildings these models replace (also suppress those by name).
 */
export const LANDMARKS = [
    // ---- Bucharest ----
    L('parliament', 'bucharest', 'Palatul Parlamentului', ['Palatul Parlamentului', 'Casa Poporului'], 175, bParliament),
    L('cathedral', 'bucharest', 'Catedrala Mântuirii Neamului', ['Catedrala Națională', 'Catedrala Mântuirii Neamului', 'Catedrala Mântuirii Neamului Românesc'], 70, bCathedral),
    L('arcul', 'bucharest', 'Arcul de Triumf', ['Arcul de Triumf'], 18, bArcul),
    L('casapresei', 'bucharest', 'Casa Presei Libere', ['Casa Presei Libere', 'Casa Scînteii'], 160, bCasaPresei),
    L('grandhotel', 'bucharest', 'Grand Hotel Bucharest (ex-InterContinental)', ['Grand Hotel Bucharest', 'InterContinental', 'Hotel InterContinental'], 40, bGrandHotel),
    L('univ', 'bucharest', 'Palatul Universității', ['Universitatea din București', 'Palatul Universității'], 110, bUniv),
    L('tnb', 'bucharest', 'Teatrul Național București', ['Teatrul Național', 'Teatrul Național București', 'Teatrul Național „Ion Luca Caragiale”'], 95, bTNB),
    L('ateneu', 'bucharest', 'Ateneul Român', ['Ateneul Român'], 38, bAteneu),
    L('regal', 'bucharest', 'Palatul Regal (MNAR)', ['Palatul Regal', 'Muzeul Național de Artă al României'], 130, bRegal),
    L('victoria', 'bucharest', 'Palatul Victoria', ['Palatul Victoria'], 58, bVictoria),
    L('cec', 'bucharest', 'Palatul CEC', ['Palatul Casei de Economii şi Consemnaţiuni', 'Palatul CEC'], 36, bCEC),
    L('mnir', 'bucharest', 'Muzeul Național de Istorie a României', ['Palatul Poștelor', 'Muzeul Național de Istorie a României'], 70, bMNIR),
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
    L('politehnica', 'bucharest', 'Rectoratul Politehnicii', ['Rectorat Universitatea Politehnica din București'], 30, bPolitehnica),
    L('hermes', 'bucharest', 'Hermes Business Campus', ['Hermes', 'Clădirea B+C', 'Hermes Business Campus'], 80, bHermes),
    L('baneasaterm', 'bucharest', 'Aeroportul Băneasa (terminal 1952)', ['Aeroportul Internațional Aurel Vlaicu'], 75, bBaneasaTerm),
    L('otp', 'bucharest', 'Aeroportul Henri Coandă', ['Aeroportul Otopeni Henri Coandă - Plecări', 'Aeroportul Otopeni Henri Coandă - Sosiri', 'Terminalul Vioara'], 230, bOTP),
    L('ase', 'bucharest', 'ASE — Palatul Ion N. Angelescu', ['Clădirea Ion N. Angelescu', 'Academia de Studii Economice'], 60, bASE),
    L('ambasador', 'bucharest', 'Hotel Ambasador', ['Hotel Ambasador'], 30, bAmbasador),
    L('aro', 'bucharest', 'Blocul ARO / Patria', ['Bl. ARO/Patria', 'Hanul Elias - Patria'], 32, bARO),
    // ---- Seattle / Bellevue (radius given in real metres, halved by L()) ----
    L('spaceneedle', 'seattle', 'Space Needle', ['Space Needle'], 30, bSpaceNeedle),
    L('columbia', 'seattle', 'Columbia Center', ['Columbia Center'], 50, bColumbia),
    L('smith', 'seattle', 'Smith Tower', ['Smith Tower'], 28, bSmith),
    L('lumen', 'seattle', 'Lumen Field', ['Lumen Field'], 140, bLumen),
    L('tmobile', 'seattle', 'T-Mobile Park', ['T-Mobile Park'], 135, bTMobile),
    L('greatwheel', 'seattle', 'Seattle Great Wheel', ['Seattle Great Wheel Tickets'], 30, bGreatWheel),
    L('spheres', 'seattle', 'Amazon Spheres', ['Amazon.com The Spheres'], 36, bSpheres),
    L('mtbaker', 'seattle', 'Mount Baker Tunnel (east portal)', [], 0, bMtBaker),
    L('seatac', 'seattle', 'Seattle-Tacoma International Airport', ['Sea-Tac Airport Main Terminal'], 480, bSeaTac),
    L('seatower', 'seattle', 'SeaTac Control Tower', ['SeaTac Control Tower'], 20, bSeaTower),
    L('lincoln', 'seattle', 'Lincoln Square', ['Lincoln Square', 'Lincoln Square North', 'Lincoln Square South', 'Lincoln Square South Tower', 'One Lincoln Tower'], 190, bLincoln),
    L('bellevuetowers', 'seattle', 'Bellevue Towers', ['Bellevue Towers', 'North Tower', 'South Tower'], 55, bBellevueTowers),
    L('bellevuesq', 'seattle', 'Bellevue Square', ['Bellevue Square Mall'], 190, bBellevueSq),
    L('rainier', 'seattle', 'Mount Rainier', [], 0, bRainier, { backdrop: true, realDistanceKm: 87 }),
    L('olympics', 'seattle', 'Olympic Mountains', [], 0, bOlympics, { backdrop: true, realDistanceKm: 60 }),
];

/**
 * Build one landmark.
 * @param lm  entry of LANDMARKS
 * @param ctx { THREE?, rng?, helpers?, backdropScale? } — nothing is required; the module is self-contained.
 * @returns { mesh: THREE.Group (rotation applied, position at origin), clear: footprintRadius,
 *            collision: [{x, z, hw, hd, angle}] relative to the anchor in world axes, triangles }
 */
export function buildLandmark(lm, ctx = {}) {
    const hs = lm.city === 'seattle' ? SEA_SCALE : 1;
    const b = new Builder(hs);
    lm._fn(b, ctx);
    const { group, tris } = b.finish();
    group.name = 'landmark:' + lm.id;
    group.userData.landmark = lm.id;
    group.rotation.y = lm.rotation;
    let k = 1;
    if (lm.backdrop) { k = ctx.backdropScale ?? 1; group.scale.setScalar(k); }
    const c = Math.cos(lm.rotation), s = Math.sin(lm.rotation);
    const collision = lm.backdrop ? [] : b.cols.map(q => {
        const x = q.x * hs, z = q.z * hs;
        return { x: x * c + z * s, z: -x * s + z * c, hw: q.hw * hs, hd: q.hd * hs, angle: lm.rotation + q.angle };
    });
    return { mesh: group, clear: lm.footprintRadius, collision, triangles: tris };
}
