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

// Palatul Parlamentului — 270 m N-S x 240 m E-W, 86 m high, 12 storeys above ground (+8 below),
// stepped tiers, central square crown, colonnaded north (Bd. Unirii) front, cream stone.
// Footprint: OSM relation 2230391 (outer way 14325732 incl. corner wings, courtyards 167231786/178309073).
function bParliament(b) {
    b.wall = C.cream;
    const [outer, cyN, cyS] = P.parliament.map(pts);
    const holes = [cyN, cyS];
    b.prism(offset(outer, 2.5), 0, 2.2, C.stoneDk);                       // terrace plinth
    b.prism(outer, 2.2, 21, C.cream, { holes, topCol: C.stone });
    b.bands(outer, 2.2, 21, 4.6, C.winWarm, { holes, frac: 0.5 });
    const tiers = [[-83, -101, 85, 109, 21, 45, 4.8], [-74, -93, 76, 101, 45, 55, 5], [-63, -82, 65, 90, 55, 63, 4]];
    for (const [x0, z0, x1, z1, y0, y1, fh] of tiers) {
        const r = rect(x0, z0, x1, z1);
        b.prism(r, y0, y1, C.cream, { holes, topCol: C.stone });
        b.bands(r, y0, y1, fh, C.winWarm, { holes, frac: 0.5 });
        b.box(0.5 * (x0 + x1), y1 - 0.2, 0.5 * (z0 + z1) - (z1 - z0) / 2 - 0.4, x1 - x0, 1.2, 1.6, C.stone); // cornice (front)
    }
    // central block between the courtyards + crown
    const cen = rect(-30, -22, 32, 23);
    b.prism(cen, 63, 74, C.cream, { topCol: C.stone }); b.bands(cen, 63, 74, 3.8, C.winWarm, { frac: 0.5 });
    const crown = rect(-21, -15, 23, 16);
    b.prism(offset(crown, -3), 74, 80.5, C.cream2);
    for (const [ax, az, bx, bz, n] of [[-21, -15, 23, -15, 10], [-21, 16, 23, 16, 10], [-21, -15, -21, 16, 7], [23, -15, 23, 16, 7]]) b.colonnade(ax, az, bx, bz, 74, 6.5, n, 0.7, C.white);
    b.prism(offset(crown, 1), 80.5, 82, C.stone);
    b.hip(1, 82, 0.5, 40, 28, 4, '#9a9488');
    // north portico (main entrance on Piata Constitutiei) + balcony colonnade
    b.box(0, 2.2, -106, 92, 1.2, 12, C.stone);
    b.colonnade(-42, -110, 42, -110, 3.4, 16, 16, 1.15, C.white, { capital: C.stone });
    b.box(0, 19.4, -105, 92, 2.4, 11, C.cream2);
    b.colonnade(-32, -94.5, 32, -94.5, 45, 8.5, 12, 0.7, C.white);
    b.colonnade(-24, -83.5, 24, -83.5, 55, 6.5, 10, 0.55, C.white);
    // corner pavilions get low hipped roofs
    for (const [x, z] of [[-99, 122], [100, 123], [100, -124], [-100, -121]]) b.hip(x, 21, z, 28, 28, 4, C.roof);
    b.colPoly([outer], 22);
}

// Catedrala Mântuirii Neamului (People's Salvation Cathedral) — 126.1 m x 67.7 m, 127 m to lantern
// top / 135 m to the cross, outer dome Ø 29.4 m, 6 towers + west bell tower (steeple +75.5 m,
// secondary towers +62 m), stone facade, gilded domes. OSM way 232332568 (height 52 = nave).
function bCathedral(b) {
    b.wall = C.cream;
    const [outer] = P.cathedral.map(pts);
    b.prism(outer, 0, 34, C.cream, { topCol: C.stone });
    b.bands(outer, 0, 34, 12, '#756a5a', { frac: 0.42, start: 5, pitch: 5, pierW: 0.55 });
    b.roof(outer, 34, 4, '#a18c58', 2.5);
    const cross = (x, y, z, h) => { b.box(x, y, z, 0.5, h, 0.5, C.gold); b.box(x, y + h * 0.62, z, 0.5, 0.45, h * 0.5, C.gold); };
    // main crossing: square base, tall drum, gilded dome, lantern, cross
    const mx = 13;
    b.box(mx, 34, 0, 34, 16, 34, C.cream);
    b.cyl(mx, 50, 0, 15, 15.5, 42, C.cream, 24);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; b.box(mx + Math.cos(a) * 15.1, 70, Math.sin(a) * 15.1, 0.4, 15, 3.4, '#6a604f', { ry: -a }); } // drum windows
    b.cyl(mx, 91.5, 0, 15.8, 15.8, 1.2, C.stone, 24);
    b.dome(mx, 92, 0, 15.2, 25, C.gold, 24, { mat: 'g' });
    b.cyl(mx, 116, 0, 3.2, 3.6, 6, C.gold, 10, { mat: 'g' });
    b.dome(mx, 122, 0, 3.3, 4, C.gold, 10, { mat: 'g' });
    cross(mx, 125.5, 0, 9.5);
    // four towers around the crossing (~62 m)
    for (const [x, z] of [[mx - 22, -21], [mx + 22, -21], [mx - 22, 21], [mx + 22, 21]]) {
        b.box(x, 34, z, 9, 16, 9, C.cream);
        b.cyl(x, 50, z, 4.2, 4.4, 6, C.cream, 12);
        b.dome(x, 56, z, 4.4, 5.5, C.gold, 12, { mat: 'g' });
        cross(x, 61, z, 3.5);
    }
    // west front: bell tower (75.5 m) flanked by two smaller towers
    b.box(-49, 0, 0, 20, 54, 22, C.cream); b.bands(rect(-59, -11, -39, 11), 10, 54, 11, '#6a5f50', { frac: 0.35 });
    b.cyl(-49, 54, 0, 7, 7.4, 10, C.cream, 16);
    b.dome(-49, 64, 0, 7.2, 10, C.gold, 16, { mat: 'g' });
    cross(-49, 73.5, 0, 6.5);
    for (const z of [-24, 24]) { b.box(-42, 0, z, 9, 42, 9, C.cream); b.cyl(-42, 42, z, 3.6, 3.8, 4, C.cream, 10); b.dome(-42, 46, z, 3.8, 4.5, C.gold, 10, { mat: 'g' }); cross(-42, 50, z, 3); }
    // west portal arcade
    b.colonnade(-61.5, -9, -61.5, 9, 0, 12, 6, 0.8, C.white);
    b.colPoly([outer], 20);
}

// Arcul de Triumf — 27 m high, 25 m x 11.5 m base (OSM way 217851530: 25 x 9.3 m), single central
// arch (~9.5 m wide), paired engaged columns, attic with inscriptions, granite/Deva stone.
function bArcul(b) {
    const W = 25, D = 9.6, S = '#d8d2c4';
    b.box(0, 0, 0, W + 1.6, 1.2, D + 1.6, '#b8b1a3');
    b.archWall(W, 19, D, [{ x: 0, w: 9.6, h: 15.5 }], S, M(0, 1.2, 0));
    // transverse passage through the piers (small arches on the short faces)
    b.archWall(D + 0.2, 8, 3.2, [{ x: 0, w: 3.4, h: 6.5 }], S, M(-W / 2 + 2.6, 1.2, 0, Math.PI / 2));
    b.archWall(D + 0.2, 8, 3.2, [{ x: 0, w: 3.4, h: 6.5 }], S, M(W / 2 - 2.6, 1.2, 0, Math.PI / 2));
    for (const z of [-D / 2 - 0.55, D / 2 + 0.55]) {
        b.colonnade(-10.6, z, -7.2, z, 2.2, 14.2, 2, 0.55, '#e4dfd3', { capital: S });
        b.colonnade(7.2, z, 10.6, z, 2.2, 14.2, 2, 0.55, '#e4dfd3', { capital: S });
        b.box(0, 3.5, z, 3.2, 0.3, 0.25, '#9a9384');                       // keystone shadow line
        b.box(-8.9, 8.5, z * 1.02, 2.2, 3.2, 0.3, '#b9b2a2'); b.box(8.9, 8.5, z * 1.02, 2.2, 3.2, 0.3, '#b9b2a2'); // reliefs
    }
    b.box(0, 20.2, 0, W + 1.4, 1.6, D + 1.2, '#e6e1d6');                  // entablature
    b.box(0, 21.8, 0, W - 1, 5.2, D - 0.6, S);                            // attic
    for (const z of [-(D - 0.6) / 2 - 0.05, (D - 0.6) / 2 + 0.05]) b.box(0, 23.2, z, 14, 1.6, 0.2, '#7d7566'); // inscription band
    b.box(0, 27, 0, W - 0.4, 0.6, D, '#e6e1d6');
    b.col(0, 0, W / 2 + 0.8, D / 2 + 0.8);
}

// Casa Presei Libere (ex-Casa Scînteii, 1952-57, Horia Maicu) — 91.6 m roof + 12.4 m antenna = 104 m,
// Stalinist "wedding cake" tower; central body 14 floors, lateral bodies 11 floors, ~23,000 m² footprint.
// OSM relation 15922160 (outer 1177639752, three courtyards).
function bCasaPresei(b) {
    b.wall = '#d9c9a6';
    const [outer, c1, c2, c3] = P.casapresei.map(pts);
    const S = '#d9c9a6', W = '#6b6050';
    b.prism(outer, 0, 26, S, { holes: [c1, c2, c3], topCol: '#cbbb98' });
    b.bands(outer, 0, 26, 3.7, W, { holes: [c1, c2, c3], frac: 0.48 });
    b.box(0, 26, -71.6 + 1, 230, 1, 2, '#c5b48f'); b.box(0, 26, 71.6 - 1, 230, 1, 2, '#c5b48f');
    // central body (14 floors) — its small light courts are filled in
    const cen = [[0, -57], [92, -57], [92, 57], [0, 57]];
    b.prism(cen, 26, 48, S, { topCol: '#cbbb98' });
    b.bands(cen, 26, 48, 3.7, W, { frac: 0.48 });
    // stepped tower on the front (+x)
    const tiers = [[50, -22, 92, 22, 48, 62], [56, -16.5, 88, 16.5, 62, 73], [62, -11.5, 84, 11.5, 73, 82], [67, -7, 80, 7, 82, 88.5]];
    for (const [x0, z0, x1, z1, y0, y1] of tiers) {
        const r = rect(x0, z0, x1, z1); b.prism(r, y0, y1, S, { topCol: '#c6b591' }); b.bands(r, y0, y1, 3.7, W, { frac: 0.45 });
        for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) b.hip(x, y1, z, 3, 3, 3.2, '#c6b591');
    }
    b.box(91.5, 8, 0, 2, 40, 18, '#cdbd99');                                 // central risalit
    b.cone(73.5, 88.5, 0, 4.6, 3.1, '#c6b591', 8);
    b.cyl(73.5, 91.6, 0, 0.5, 1.1, 12.4, '#9aa0a5', 6);                   // TV antenna
    // corner pinnacles of the lateral bodies
    for (const [x, z] of [[-128, -72], [-128, 72], [128, -138], [128, 138], [24, -138], [22, 138]]) b.hip(x, 26, z, 6, 6, 5, '#c6b591');
    b.colPoly([outer], 24);
}

// Grand Hotel Bucharest (ex-InterContinental, 1971) — 87 m, 22-24 floors, Piața Universității.
// White concrete tower with continuous balconies; OSM way 1111645542 (height 87).
function bGrandHotel(b) {
    b.wall = '#ecebe6';
    const [p] = P.grandhotel.map(pts);
    b.prism(p, 0, 11, '#cfcac0'); b.bands(p, 0, 11, 5.5, C.glassDk, { frac: 0.55, mat: 'g' });
    const t = offset(p, -4.5);
    b.prism(t, 11, 81, '#ecebe6');
    b.bands(t, 11, 81, 3.15, '#3b4652', { frac: 0.5, off: 0.12 });
    b.bands(t, 11, 81, 3.15, '#f6f5f1', { frac: 0.12, off: 0.9, start: 2.9, wall: false });  // balcony slabs
    const top = offset(t, -5);
    b.prism(top, 81, 86, '#d6d3cb'); b.bands(top, 81, 86, 5, '#3b4652', { frac: 0.5 });
    b.cyl(0, 86, 4, 0.3, 0.5, 9, '#b0b4b8', 6);
    b.colPoly([p], 12);
}

// Palatul Universității (University of Bucharest, 1857-69, Alexandru Orăscu) — neoclassical,
// ~4 storeys, ~200 m along Bd. Regina Elisabeta; OSM building parts (levels 4).
function bUniv(b) {
    b.wall = C.cream;
    const ps = P.univ.map(pts);
    for (const p of ps) {
        b.prism(p, 0, 19, C.cream, { topCol: C.stone });
        b.bands(p, 0, 19, 4.8, C.winWarm, { frac: 0.45 });
        b.roof(p, 19, 3.5, C.slate, 1.5);
    }
    const zf = zAt(ps, 0)?.[0] ?? -20;                                     // south (front) facade
    b.box(0, 0, zf - 4, 30, 1, 8, C.stone);
    b.colonnade(-12, zf - 6.5, 12, zf - 6.5, 1, 14, 6, 0.75, C.white, { capital: C.stone });
    b.box(0, 15, zf - 4.5, 30, 1.6, 9, C.cream2); b.pediment(0, 16.6, zf - 4.5, 30, 4.5, 9, C.cream2);
    // the four statues (Michael the Brave, Heliade Rădulescu, Lazăr, Spiru Haret) on plinths in front
    for (const x of [-60, -45, 45, 60]) { b.box(x, 0, zf - 12, 3, 3, 3, '#c9c2b3'); b.box(x, 3, zf - 12, 1.2, 3.2, 1.2, C.bronze); }
    b.colPoly(ps, 20);
}

// Teatrul Național București (1967-73, rebuilt facade 2010-15) — ~24 m (OSM way 41542957),
// arcaded light facade, fly tower over the main hall.
function bTNB(b) {
    const [p] = P.tnb.map(pts);
    b.prism(p, 0, 22, '#e6dcc7', { topCol: C.stone });
    b.bands(p, 0, 22, 5.2, '#4b4f55', { frac: 0.5, mat: 'g' });
    b.roof(p, 22, 2.5, '#9b968c', 2);
    b.box(45, 24.5, 22, 42, 12, 34, '#cfc6b5');                             // fly tower over the hall
    const zf = zAt([p], -45)?.[1] ?? 0;                                    // west front (+z)
    b.colonnade(-86, zf + 2.5, -6, zf + 2.5, 0, 10, 14, 0.8, C.white);
    b.box(-46, 10, zf + 2, 84, 1.5, 6, C.stone);
    b.colPoly([p], 24);
}

// Ateneul Român (1886-88, Albert Galleron) — 41 m to the dome (OSM way 16291602), circular concert
// hall Ø ~41 m under a ribbed dome, Ionic hexastyle portico facing Calea Victoriei / Piața Enescu.
function bAteneu(b) {
    b.wall = '#efe6d2';
    const S = '#efe6d2', D = '#6f7d72';
    b.box(-22, 0, 0, 22, 13, 36, S);                                       // rear block
    b.bands(rect(-33, -18, -11, 18), 0, 13, 4.5, '#6a645a', { frac: 0.4 });
    b.cyl(-4, 0, 0, 20.5, 21, 19, S, 32);                                  // rotunda
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; b.box(-4 + Math.cos(a) * 20.9, 6, Math.sin(a) * 20.9, 0.4, 7, 2.6, '#6a645a', { ry: -a }); } // arched windows
    b.cyl(-4, 19, 0, 21.6, 21.6, 1.4, '#e3d8c2', 32);                       // cornice
    b.cyl(-4, 20.4, 0, 17, 18, 4.2, S, 32);                                  // drum
    b.dome(-4, 24.6, 0, 17, 15, D, 32);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; b.box(-4 + Math.cos(a) * 14.2, 28, Math.sin(a) * 14.2, 1, 6, 1, '#d8c27a', { ry: -a }); } // gilded ribs
    b.cyl(-4, 39.4, 0, 1.6, 2, 2.2, '#d8c27a', 10); b.sphere(-4, 42.2, 0, 0.8, '#d8c27a');
    // portico (+x)
    b.box(18, 0, 0, 16, 2, 34, '#d8cdb6');                                 // steps
    b.box(14, 2, 0, 9, 14, 30, S);
    b.colonnade(26, -12.5, 26, 12.5, 2, 13.2, 6, 0.85, '#f6f1e6', { capital: '#e3d8c2' });
    b.box(19.5, 15.2, 0, 15, 1.8, 31, '#e3d8c2');
    b.pediment(19.5, 17, 0, 31, 5.2, 15, S, Math.PI / 2);
    b.col(-4, 0, 30, 24);
}

// Palatul Regal (Royal Palace, now MNAR, 1937 rebuild) — 4 levels (~20 m), long neoclassical
// front on Calea Victoriei with central columned body; OSM way 232472401.
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

// Palatul Victoria (Government, 1937-52, Duiliu Marcu) — rationalist-neoclassical, ~22 m, 4 floors,
// facing Piața Victoriei (+z = west); OSM way 23554419.
function bVictoria(b) {
    b.wall = '#e2dccd';
    const [p] = P.victoria.map(pts);
    b.prism(p, 0, 21, '#e2dccd', { topCol: C.stone });
    b.bands(p, 0, 21, 4.6, '#4f5257', { frac: 0.48 });
    b.prism(offset(p, -0.8), 21, 23.5, '#d8d1c0');
    b.colonnade(-7, 34.2, 5, 34.2, 3.5, 17, 4, 0.75, '#f1ede4', { square: true });
    b.box(-1, 20.5, 33.5, 16, 2, 2, '#d8d1c0');
    b.box(-1, 23.5, 27, 6, 3, 2, '#d8d1c0'); b.cyl(-1, 26.5, 27, 0.15, 0.15, 7, '#ddd', 6); b.box(-1, 31, 27.6, 0.05, 1.6, 2.6, '#1b4ea3'); // flag
    b.colPoly([p], 20);
}

// Palatul CEC (1897-1900, Paul Gottereau) — eclectic, glass-and-metal central dome, domed entrance
// pavilion on Calea Victoriei (+x) and four corner cupolas; OSM way 973712798.
function bCEC(b) {
    b.wall = '#e5dccb';
    const [p] = P.cec.map(pts), S = '#e5dccb', MT = '#7c868a';
    b.prism(p, 0, 18, S, { topCol: C.stone }); b.bands(p, 0, 18, 5.6, '#544e45', { frac: 0.45 });
    b.cyl(0, 18, 0, 11, 11.5, 5, S, 20);
    b.dome(0, 23, 0, 11, 13, '#9fb2b7', 20, { mat: 'g' });
    b.cyl(0, 35.6, 0, 1.6, 1.8, 2.6, MT, 8); b.cone(0, 38.2, 0, 1.6, 2.4, MT, 8);
    const xf = xAt([p], 0)?.[1] ?? 22;                                      // entrance front
    b.box(xf - 4, 0, 0, 8, 22, 16, S);
    b.archWall(16.2, 14, 1.2, [{ x: 0, w: 7, h: 12 }], '#d9cfbd', M(xf + 0.2, 0, 0, Math.PI / 2));
    b.cyl(xf - 4, 22, 0, 5, 5.2, 2.5, S, 16); b.dome(xf - 4, 24.5, 0, 5, 6.5, MT, 16);
    b.cone(xf - 4, 31, 0, 0.8, 3, MT, 6);
    const bb = bbox([p]);
    for (const [x, z] of [[bb.x0 + 3, bb.z0 + 3], [bb.x1 - 3, bb.z0 + 3], [bb.x0 + 3, bb.z1 - 3], [bb.x1 - 3, bb.z1 - 3]]) { b.cyl(x, 18, z, 3, 3.2, 3, S, 12); b.dome(x, 21, z, 3, 4, MT, 12); }
    b.colPoly([p], 15);
}

// Muzeul Național de Istorie a României (Palatul Poștelor, 1894-1900, Alexandru Săvulescu) —
// neoclassical, ~22 m, monumental Doric colonnade on Calea Victoriei (-x); OSM rel 19919941.
function bMNIR(b) {
    b.wall = '#e4dccb';
    const [p, hole] = P.mnir.map(pts), S = '#e4dccb';
    b.prism(p, 0, 21, S, { holes: [hole], topCol: C.stone }); b.bands(p, 0, 21, 5, C.winWarm, { frac: 0.45, holes: [hole] });
    b.roof(p, 21, 3.5, '#a6a196', 2, { holes: [hole] });
    const xf = xAt([p], 0)?.[0] ?? -52;
    b.box(xf - 4, 0, 0, 9, 3, 60, C.stoneDk);
    b.colonnade(xf - 6.5, -27, xf - 6.5, 27, 3, 14, 14, 0.95, C.white, { capital: C.stone });
    b.box(xf - 4.5, 17, 0, 9, 2.4, 60, '#ded4c0');
    b.box(xf + 4, 0, -36, 8, 26, 14, S); b.box(xf + 4, 0, 36, 8, 26, 14, S);   // end pavilions
    b.colPoly([p], 20);
}

// JW Marriott Bucharest Grand Hotel (ex-Casa Republicii, 1980s) — 9 levels, 40 m (OSM way 26314111),
// cream stone "Casa Poporului"-style building next to the Parliament.
function bMarriott(b) {
    b.wall = C.cream;
    const [p] = P.marriott.map(pts);
    b.prism(p, 0, 32, C.cream, { topCol: C.stone }); b.bands(p, 0, 32, 3.6, C.winWarm, { frac: 0.5 });
    const t = offset(p, -5); b.prism(t, 32, 40, C.cream2); b.bands(t, 32, 40, 3.6, C.winWarm, { frac: 0.5 });
    b.colPoly([p], 20);
}

// Unirea Shopping Center (1976-89, refurbished) — 6 levels (OSM way 23492027), Piața Unirii (front -x).
function bUnirea(b) {
    const [p] = P.unirea.map(pts);
    b.prism(p, 0, 26, '#d8d3c8', { topCol: '#b7b3aa' });
    b.bands(p, 0, 26, 4.3, C.glass, { frac: 0.55, mat: 'g' });
    const xf = xAt([p], 0)?.[0] ?? -100;
    b.box(xf - 0.6, 20, 0, 0.8, 4.5, 36, '#c8102e');                       // "UNIREA" sign panel
    b.box(xf - 1.1, 21, 0, 0.3, 2.5, 30, '#ffffff');
    b.box(xf + 30, 26, 0, 30, 4, 30, '#c9c4b9');
    b.colPoly([p], 24);
}

// Fântânile din Piața Unirii & Bd. Unirii — basins from OSM natural=water ways (round Ø ~14 m and
// oval ~28 m basins alternating along the boulevard median, central plaza fountains).
const FOUNTAINS = [[-770, -48, 14], [-722, -44, 14], [-686, -42, 7], [-650, -39, 14], [-614, -37, 7], [-578, -35, 14], [-543, -32, 7], [-507, -30, 14], [-471, -28, 7], [-435, -25, 14], [-398, -23, 7], [-361, -21, 14], [-326, -19, 7], [-289, -16, 14], [-253, -14, 7], [-216, -11, 14], [-181, -9, 7], [-95, 20, 22], [-92, -27, 23], [-91, -3, 14], [-75, 24, 9], [-71, -31, 9], [-59, -1, 7], [-59, 30, 19], [-54, -32, 19], [-33, 50, 33], [-26, -51, 31], [-8, 59, 15], [0, -58, 14], [19, 54, 33], [26, -47, 32], [47, 36, 18], [51, -25, 19], [51, 6, 7], [64, 33, 8], [67, -22, 9], [82, 8, 14], [83, 32, 21], [84, -15, 20], [155, 12, 7], [199, 15, 14], [244, 18, 7], [292, 21, 14], [338, 24, 7], [383, 27, 14], [429, 30, 7], [474, 32, 14], [522, 35, 7], [569, 38, 14]];
function bFountains(b) {
    for (const [x, z, L] of FOUNTAINS) {
        const plaza = Math.abs(x) < 100, oval = !plaza && L >= 12;
        const rx = plaza ? L * 0.8 : (oval ? 13 : 6.5), rz = plaza ? L * 0.55 : (oval ? 5.5 : 6.5);
        const ang = plaza ? Math.atan2(z, x) + Math.PI / 2 : Math.atan2(4, 60);
        const rot = (q) => q.map(([a, c]) => [x + a * Math.cos(ang) - c * Math.sin(ang), z + a * Math.sin(ang) + c * Math.cos(ang)]);
        const outer = rot(ellipse(0, 0, rx, rz, 12)), inner = rot(ellipse(0, 0, rx - 0.7, rz - 0.7, 12));
        b.prism(outer, 0, 0.6, '#cfc8ba', { holes: [inner] });
        b.prism(inner, 0, 0.35, C.water, { mat: 'w' });
        const jets = oval ? [-7, 0, 7] : plaza ? [-rx * 0.4, rx * 0.4] : [0];
        for (const j of jets) {
            const jx = x + j * Math.cos(ang), jz = z + j * Math.sin(ang), h = oval && j === 0 ? 9 : 5.5;
            b.cone(jx, 0.35, jz, 0.9, h, C.spray, 5, { mat: 'w' });
            if (h > 6) b.dome(jx, 0.35, jz, 2.2, 1.1, C.spray, 6, { mat: 'w' });
        }
    }
}

// Sky Tower (Floreasca City Center, 2012) — 137 m, 37 floors, elliptical glass tower (OSM way 219622660).
function bSkyTower(b) {
    const [p] = P.skytower.map(pts);
    b.prism(p, 0, 120, '#6b8fa9', { mat: 'g', topCol: '#9fb3c2' });
    b.bands(p, 0, 120, 3.6, '#c4d0d8', { frac: 0.14, off: 0.12 });
    const t1 = offset(p, -3.5), t2 = offset(p, -8);
    b.prism(t1, 120, 127, '#6b8fa9', { mat: 'g' }); b.prism(t2, 127, 131.5, '#8aa3b5', { mat: 'g' });
    b.cyl(0, 131.5, 0, 0.5, 0.9, 5.5, '#c9ccce', 6);
    b.colPoly([p], 15);
}

// Promenada Mall (2013) — 3 levels, 18 m (OSM way 240694437), white/glass with a planted roof.
function bPromenada(b) {
    const [p] = P.promenada.map(pts);
    b.prism(p, 0, 18, '#e9ebec', { topCol: '#7da35b' });
    b.bands(p, 0, 18, 6, '#5d7f97', { frac: 0.5, mat: 'g' });
    b.prism(offset(p, -12), 18, 20, '#8db267'); b.prism(offset(p, -30), 20, 22, '#7da35b');
    b.colPoly([p], 25);
}

// Băneasa Shopping City (2008) — 3 levels, 22 m (OSM way 241256765).
function bBaneasaSC(b) {
    const [p] = P.baneasasc.map(pts);
    b.prism(p, 0, 22, '#dad6ce', { topCol: '#b9b5ad' });
    b.bands(p, 0, 22, 7, '#56758c', { frac: 0.4, mat: 'g', start: 4 });
    b.box(0, 22, 0, 30, 3, 120, '#cfd6db', { mat: 'g' });                    // skylight ridge
    b.colPoly([p], 25);
}

// Romexpo Central Pavilion (1962) — 34 m high steel-lattice dome (OSM way 23554160, Ø ~125 m outline).
function bRomexpo(b) {
    const [p] = P.romexpo.map(pts);
    b.prism(p, 0, 8, '#dcd8ce'); b.bands(p, 0, 8, 8, '#4f6b80', { frac: 0.5, mat: 'g', start: 2 });
    const a = 59, H = 25, R = (a * a + H * H) / (2 * H), th = Math.asin(a / R);
    b.geo(new THREE.SphereGeometry(R, 36, 7, 0, Math.PI * 2, 0, th), '#c3c7c8', M(0, 8 + H - R, 0), 'g');
    b.cyl(0, 8 + H - 0.5, 0, 7, 8, 1.8, '#a7acad', 16);
    b.col(0, 0, 45, 45);
}

// Monumentul Eroilor Aerului (1935, Lidia Kotzebue & Iosif Fekete) — ~20 m granite obelisk-pylon
// topped by bronze winged aviators, Piața Aviatorilor (OSM node 559876471).
function bAviatorilor(b) {
    b.box(0, 0, 0, 11, 1.2, 11, '#a39d92'); b.box(0, 1.2, 0, 7.5, 2.4, 7.5, '#b9b3a7');
    b.cyl(0, 3.6, 0, 1.2, 2.1, 14, '#c8c2b6', 4, { ry: Math.PI / 4 });
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; b.box(Math.cos(a) * 3, 3.6, Math.sin(a) * 3, 1, 2.6, 1, C.bronze); }
    b.box(0, 17.6, 0, 0.9, 3.2, 0.9, C.bronze);
    for (const s of [-1, 1]) b.box(0, 19.6, s * 2.1, 0.3, 0.6, 4.2, C.bronze, { rx: s * 0.45 });
    b.col(0, 0, 5.5, 5.5);
}

// Gara de Nord (1868-72, rebuilt) — main station building & concourse, OSM rel 18184857 parts.
function bGara(b) {
    b.wall = '#e6d9bd';
    const ps = P.gara.map(pts), H = [16, 11, 13, 20, 4, 14];
    ps.forEach((p, i) => {
        if (i === 4) return;
        b.prism(p, 0, H[i], i === 1 ? '#d6cbb5' : '#e6d9bd', { topCol: '#a9a39a' });
        b.bands(p, 0, H[i], 5, '#5b5348', { frac: 0.45 });
    });
    b.roof(ps[0], 16, 3, '#8a8580', 1.5); b.roof(ps[3], 20, 3, '#8a8580', 1.5);
    b.colPoly(ps, 20);
}

// Opera Națională București (1953, Octav Doicescu) — classicising, ~22 m with fly tower, columned
// portico towards Bd. Kogălniceanu (+z); OSM way 23556393.
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

// Rectoratul Universității Politehnica (Splaiul Independenței 313, 1970s) — 5-storey square block
// with a slender rectorate tower (height not documented in OSM; ~60 m estimated).
function bPolitehnica(b) {
    b.wall = '#d3cec3';
    const [p] = P.politehnica.map(pts);
    b.prism(p, 0, 19, '#d3cec3', { topCol: '#b9b4aa' }); b.bands(p, 0, 19, 3.8, '#47505a', { frac: 0.5 });
    const t = rect(-8, -8, 8, 8);
    b.prism(t, 19, 56, '#e7e5df'); b.bands(t, 19, 56, 3.6, '#47505a', { frac: 0.45 });
    b.prism(rect(-9, -9, 9, 9), 56, 60, '#3d4a57', { mat: 'g' });
    b.cyl(0, 60, 0, 0.3, 0.6, 7, '#b7bbbe', 6);
    b.colPoly([p], 16);
}

// Hermes Business Campus (Pipera, 2009) — three glass office buildings, 6-10 floors (OSM ways
// 533147567, 231123137, 458259608).
function bHermes(b) {
    const ps = P.hermes.map(pts);
    const H = [36, 26, 32];
    for (let i = 0; i < 3; i++) {
        const holes = i === 2 ? [ps[3]] : [];
        b.prism(ps[i], 0, H[i], '#3f6585', { mat: 'g', holes, topCol: '#9aa4ab' });
        b.bands(ps[i], 0, H[i], 3.6, '#e8ecef', { frac: 0.16, holes, off: 0.12 });
    }
    b.colPoly(ps.slice(0, 3), 20);
}

// Aeroportul Băneasa "Aurel Vlaicu" — 1952 terminal (Art-Deco / socialist classicism): three wings
// around a central rotunda with control tower; OSM way 28246549.
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

// Aeroportul Henri Coandă (OTP) — Plecări / Sosiri terminals + Terminalul Vioara pier with gates
// (OSM ways 771096082/771096081/771096083), tower near the observation tower (OSM way 794617342),
// three parked narrow-bodies (TAROM, Wizz Air, Blue Air colours).
function bOTP(b) {
    const [dep, arr, pier] = P.otp.map(pts);
    b.prism(dep, 0, 19, '#dfe3e6', { topCol: '#c6cbcf' }); b.bands(dep, 0, 19, 6, '#577b94', { frac: 0.6, mat: 'g', start: 1 });
    b.prism(offset(dep, 3), 19, 20.2, '#eef0f1');
    b.prism(arr, 0, 14, '#dfe3e6', { topCol: '#c6cbcf' }); b.bands(arr, 0, 14, 6, '#577b94', { frac: 0.6, mat: 'g', start: 1 });
    b.prism(pier, 0, 11, '#6f91a8', { mat: 'g', topCol: '#e3e6e8' });
    b.prism(offset(pier, -1.5), 11, 12.5, '#e9ecee');
    atcTower(b, 56.5, 166.6, 44);
    const bb = bbox([pier]), px = bb.x1 + 30;
    airliner(b, px, -150, Math.PI, { tail: '#1d3f8f', stripe: '#1d3f8f' });        // TAROM
    airliner(b, px, -45, Math.PI, { tail: '#c6007e', belly: '#2b0f5c' });           // Wizz Air
    airliner(b, bb.x0 - 26, -120, 0, { tail: '#0b4ea2', stripe: '#0b4ea2' });       // Blue Air
    b.colPoly([dep], 25); b.colPoly([arr], 25); b.colPoly([pier], 12);
}

// ASE — Clădirea Ion N. Angelescu (Palatul ASE, 1916-26), Piața Romană: neoclassical with domed
// corner (OSM relation 2274298).
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

// Columbia Center (1985) — 286 m / 76 floors, black glass, three stepped concave-sided towers.
// Footprints & heights straight from OSM rel 4648083 (parts 160 / 223 / 226 / 280 / 286 m).
function bColumbia(b) {
    const ps = P.columbia.map(pts), H = [16, 280, 286, 223, 226, 160];
    ps.forEach((p, i) => {
        b.prism(p, 0, H[i], '#262b31', { mat: 'g', topCol: '#3a4047' });
        if (i) b.bands(p, 20, H[i], 14.8, '#3e464e', { frac: 0.12, off: 0.15, mat: 'g' });
    });
    b.colPoly([ps[0]], 25);
}

// Smith Tower (1914) — 148 m (484 ft), 38 floors; white terra-cotta 21-storey base (OSM way
// 52781661, height 75), slender tower shaft and pyramidal cap with a glass globe.
function bSmith(b) {
    b.wall = '#efeadd';
    const [p] = P.smith.map(pts), W = '#efeadd';
    b.prism(p, 0, 75, W, { topCol: '#d8d2c4' }); b.bands(p, 0, 75, 3.5, '#4f555c', { frac: 0.45 });
    const t = rect(-9, -9, 9, 9);
    b.prism(t, 75, 128, W); b.bands(t, 75, 128, 3.5, '#4f555c', { frac: 0.45 });
    b.box(0, 127.5, 0, 20, 1.2, 20, '#e4dece');
    b.hip(0, 128.7, 0, 19, 19, 17.5, '#ece6d8');
    b.sphere(0, 146.8, 0, 1.2, '#cfe2ea', { mat: 'g' });
    b.colPoly([p], 15);
}

// Lumen Field (2002) — 68,740 seats, open north end, two sideline roof canopies (≈70% of seats
// covered) carried by huge arched trusses. OSM rel 5838734 geometry missing in the extract —
// sized from the field (N-S axis) and the ~280 x 220 m site, anchor from Wikipedia (47.5952 N, 122.3316 W).
function bLumen(b) {
    const CON = '#bdbbb5', SEAT = '#2f5a78';
    b.prism(rect(-36, -60, 36, 60), 0, 0.25, '#3f8a3a');
    const t1o = roundRect(0, 0, 140, 200, 30), t1i = roundRect(0, 0, 80, 132, 8);
    b.prism(t1o, 0, 11, CON, { holes: [t1i], topCol: SEAT });
    const t2o = roundRect(0, 4, 178, 232, 40), t2i = roundRect(0, 0, 136, 196, 28);
    b.prism(t2o, 11, 22, CON, { holes: [t2i], topCol: SEAT });
    b.bands(t2o, 11, 22, 5.5, '#2b3036', { frac: 0.4 });
    for (const s of [-1, 1]) {                                              // upper sideline decks
        const o = rect(s * 70, -100, s * 106, 100);
        b.prism(o, 22, 36, CON, { topCol: SEAT });
        // canopy + arch truss
        b.box(s * 82, 44, 0, 52, 1.4, 220, '#e3e4e2', { rz: s * 0.12 });
        const arch = []; for (let i = 0; i <= 10; i++) { const t = i / 10, zz = -118 + t * 236; arch.push([s * 104, 40 + 30 * Math.sin(Math.PI * t), zz]); }
        b.tube(arch, 1.4, '#f0f0ee', { seg: 24, radial: 6 });
        for (let i = 1; i < 10; i++) { const t = i / 10, zz = -118 + t * 236; b.tube([[s * 104, 40 + 30 * Math.sin(Math.PI * t), zz], [s * 70, 45, zz]], 0.35, '#e6e6e3', { seg: 2, radial: 4 }); }
        b.box(s * 104, 0, -118, 4, 40, 4, CON); b.box(s * 104, 0, 118, 4, 40, 4, CON);
    }
    b.box(0, 22, 108, 60, 18, 3, '#1e2227');                                // south scoreboard
    b.col(0, 0, 106, 120);
}

// T-Mobile Park (1999) — retractable three-panel roof that parks over the east side, field with
// home plate at the SW (OSM rel 18550612 outer way 226281211, 238 x 203 m).
function bTMobile(b) {
    const [p] = P.tmobile.map(pts), CON = '#c3bfb6', SEAT = '#1c4a63';
    b.prism(offset(p, -60), 0, 0.25, '#3f8a3a');
    b.dome(-40, 0.05, 45, 30, 0.3, '#b48a5a', 16);                          // infield dirt
    b.prism(p, 0, 16, CON, { holes: [offset(p, -38)], topCol: SEAT });
    b.bands(p, 0, 16, 5, '#7a3b2e', { frac: 0.35 });                          // brick-red base
    b.prism(offset(p, -6), 16, 30, CON, { holes: [offset(p, -30)], topCol: SEAT });
    // roof runway girders along the north & south edges + stacked roof panels (open position, east)
    for (const z of [-108, 108]) { b.box(15, 50, z, 250, 5, 5, '#7f8f92'); for (const x of [-105, -30, 45, 120]) b.box(x, 0, z, 4, 50, 4, '#7f8f92'); }
    [[40, 66], [72, 63.5], [104, 61]].forEach(([x, top], i) => {
        const r = 140, yc = top - r, n = 8, half = 0.88;
        for (let k = 0; k < n; k++) {
            const f0 = -half + k / n * 2 * half, f1 = f0 + 2 * half / n, fm = (f0 + f1) / 2, seg = 2 * r * Math.sin(half / n) + 0.5;
            b.box(x, yc + r * Math.cos(fm) - 0.75, r * Math.sin(fm), 72, 1.5, seg, i % 2 ? '#d6d8d5' : '#cbcfcc', { rx: fm });
        }
    });
    b.colPoly([p], 30);
}

// Seattle Great Wheel (2012) — 53 m tall, 42 gondolas, end of Pier 57 (OSM ticket booth way
// 429553385). Built at true size in its own plane (not squashed) so it stays a circle.
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

// Seattle-Tacoma International Airport — main terminal & concourses (OSM way 23772634),
// control tower (71 m, OSM way 1199936807) modelled separately; three parked airliners.
function bSeaTac(b) {
    const [p] = P.seatac.map(pts);
    b.prism(p, 0, 17, '#d7dadb', { topCol: '#c4c8ca' });
    b.bands(p, 0, 17, 8, '#5b7d92', { frac: 0.5, mat: 'g', start: 3 });
    b.prism(offset(p, -6), 17, 19.5, '#e9ebec');
    for (const [t, lv] of SEATAC_PLANES) parkAt(b, p, t, lv, 28, 40);
    b.colPoly([p], 40);
}
const SEATAC_PLANES = [
    [0.12, { tail: '#01426a', stripe: '#00a3ad' }],   // Alaska
    [0.40, { tail: '#c01933', stripe: '#003366' }],   // Delta
    [0.68, { tail: '#0033a0', belly: '#9aa3ad' }],    // United
];

// SeaTac Air Traffic Control Tower (2004) — 71 m (233 ft), OSM way 1199936807.
function bSeaTower(b) {
    b.box(0, 0, 0, 30, 9, 22, '#cfcdc6'); b.bands(rect(-15, -11, 15, 11), 0, 9, 4.5, '#4c5964', { frac: 0.5 });
    atcTower(b, 0, 0, 71, { r: 3.6, col: '#dedcd5' });
    b.col(0, 0, 15, 11);
}

// Lincoln Square (Bellevue) — Lincoln Square North 126 m, Lincoln Square South 137 m, One Lincoln
// Tower 137 m (OSM parts 604028609 / 1326151866 / 604028611) on 3-level podiums.
function bLincoln(b) {
    const [n, s, one, podS, podN] = P.lincoln.map(pts);
    b.prism(podN, 0, 14, '#cbc3b5', { topCol: '#a9a399' }); b.bands(podN, 0, 14, 4.6, '#4e6470', { frac: 0.5, mat: 'g' });
    b.prism(podS, 0, 14, '#cbc3b5', { topCol: '#a9a399' }); b.bands(podS, 0, 14, 4.6, '#4e6470', { frac: 0.5, mat: 'g' });
    for (const [p, h, c] of [[n, 126, '#5f8c94'], [s, 137, '#6890a0'], [one, 137, '#4f7c8c']]) {
        b.prism(p, 14, h, c, { mat: 'g', topCol: '#c9d1d3' });
        b.bands(p, 14, h, 12, '#d8dcd7', { frac: 0.1, off: 0.12 });
        b.prism(offset(p, -3), h, h + 4, '#d0d5d6');
    }
    b.colPoly([podN], 25); b.colPoly([podS], 25);
}

// Bellevue Towers (2008) — twin residential towers, 43 & 42 floors (137 m / 131 m) on a 5-level podium.
function bBellevueTowers(b) {
    const [n, s, pod] = P.bellevuetowers.map(pts);
    b.prism(pod, 0, 18, '#d1ccc2', { topCol: '#7f9e6b' }); b.bands(pod, 0, 18, 3.6, '#4f6573', { frac: 0.5 });
    for (const [p, h] of [[n, 137], [s, 131]]) {
        b.prism(p, 18, h, '#7398b0', { mat: 'g', topCol: '#c7d0d6' });
        b.bands(p, 18, h, 3.1, '#d9e0e4', { frac: 0.12, off: 0.1 });
        b.prism(offset(p, -2.5), h, h + 5, '#cfd6da');
    }
    b.colPoly([pod], 25);
}

// Bellevue Square (1946 / 1980s) — 3-level regional mall (OSM way 29234887).
function bBellevueSq(b) {
    const [p] = P.bellevuesq.map(pts);
    b.prism(p, 0, 15, '#e3dccf', { topCol: '#cbc4b7' }); b.bands(p, 0, 15, 5, '#5a7486', { frac: 0.35, mat: 'g', start: 2 });
    b.box(0, 15, 0, 300, 2.5, 14, '#cbd6dc', { mat: 'g' });                 // skylit mall spine
    b.box(-20, 15, 0, 14, 2.5, 200, '#cbd6dc', { mat: 'g' });
    b.colPoly([p], 40);
}

// Mount Rainier — 4,392 m stratovolcano, summit 46.8529 N 121.7604 W (~90 km SE of downtown).
// Real-size cone (base Ø ~32 km, squashed 0.5 on x/z like the rest of the city); `backdrop: true`
// means the world may move it closer and pass ctx.backdropScale = distance / realDistance.
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
