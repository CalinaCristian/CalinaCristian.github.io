// Pedestrian street centre lines from OpenStreetMap (© OpenStreetMap contributors, ODbL), extracted 2026-11-12 for the
// fidelity pass round 2 (Overpass API): highway=pedestrian, and named highway=footway (not sidewalk / crossing).
// Used only to accept a building face on a pedestrian street as a street front for a business fascia (world.js addUnitSign).
// Rows: [osmWayId, isPedestrianStreet, [[lat, lon], ...]] per district pack.
// One module per district pack under pedestrian-fronts/ (keys keep the extraction order).
import P0 from './pedestrian-fronts/bucharest-floreasca.js';
import P1 from './pedestrian-fronts/bucharest-grozavesti.js';
import P2 from './pedestrian-fronts/bucharest-otopeni.js';
import P3 from './pedestrian-fronts/bucharest-pipera.js';
import P4 from './pedestrian-fronts/bucharest-romana.js';
import P5 from './pedestrian-fronts/bucharest-unirii.js';
import P6 from './pedestrian-fronts/seattle-seatac.js';
import P7 from './pedestrian-fronts/seattle-bellevue.js';

export const PEDESTRIAN_FRONTS = {
  "bucharest-floreasca": P0,
  "bucharest-grozavesti": P1,
  "bucharest-otopeni": P2,
  "bucharest-pipera": P3,
  "bucharest-romana": P4,
  "bucharest-unirii": P5,
  "seattle-seatac": P6,
  "seattle-bellevue": P7,
};
