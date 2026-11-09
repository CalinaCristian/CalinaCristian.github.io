// Reproduce source-derived distances without a browser; no source/data writes.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = process.argv[2] || process.cwd();
const read = (scene) => JSON.parse(fs.readFileSync(path.join(repo, 'game/data/spots', scene + '.json')));
const { inPoly, polyArea, polyBox, distPolyline, offsetPolyline, polylineLength } = await import(pathToFileURL(path.join(repo, 'game/src/spots/kit.js')));
const d = read('cismigiu'), lake = d.areas.find((a) => a.id === 'w16292044').poly;
const bridges = d.ways.filter((w) => w.bridge && w.bridge !== 'no' && ['footway', 'path', 'pedestrian'].includes(w.k) && w.pts.some(([x, z]) => inPoly(x, z, lake) || distPolyline(x, z, [...lake, lake[0]]).d < 8));
const q = distPolyline(-150, -100, [...lake, lake[0]]);
const loop = offsetPolyline([...lake, lake[0]], polyArea(lake) > 0 ? -9 : 9).filter(([x, z]) => inPoly(x, z, lake) && !bridges.some((w) => distPolyline(x, z, w.pts).d < 4));
const ciLength = polylineLength([[q.cx, q.cz], ...loop, [q.cx, q.cz]]);
const h = read('buc-herastrau'), hl = h.areas.find((a) => a.id === 'r1130828'), bb = polyBox(hl.poly), holes = hl.holes || [];
const inL = (x, z) => x >= bb.x0 && x <= bb.x1 && z >= bb.z0 && z <= bb.z1 && inPoly(x, z, hl.poly) && !holes.some((p) => inPoly(x, z, p));
let st; for (let k = 0; k < 40 && !st; k++) { const x = 30 + (k % 2 ? 1 : -1) * k * 2, z = -32 - k * 1.5; if (inL(x, z)) st = [x, z]; }
const out = [st]; for (let k = 1; k < 60; k++) { const x = st[0] + Math.sin(k * 0.09) * 26, z = st[1] - k * 6; if (!inL(x, z) || !inL(x + 8, z) || !inL(x - 8, z)) break; out.push([x, z]); }
const hLength = polylineLength([...out, ...out.slice(0, -1).reverse()]);
const nymph = h.pois.find((p) => p.id === 'n1342884103'), authoredDock = { x: nymph.x + 0.5, z: nymph.z + 33 };
const rentalSources = h.pois.filter((p) => p.amenity === 'bicycle_rental').map((p) => ({ id: p.id, name: p.name, x: p.x, z: p.z, distanceFromAuthoredDock: Math.hypot(p.x - authoredDock.x, p.z - authoredDock.z) }));
const old = read('buc-old-town'), kiosk = { x: 265.1438878937039, z: -55.87426049783071 };
console.log(JSON.stringify({
  cismigiu: { loopPoints: loop.length, metres: ciLength, seconds: ciLength / 1.5, rideExists: loop.length > 4 },
  herastrau: { ridePoints: out.length * 2 - 1, metres: hLength, seconds: hLength / 2.2, authoredDock, rentalSources },
  wcp: { kiosk, buildings: old.buildings.filter((b) => inPoly(kiosk.x, kiosk.z, b.poly)), sourcePoi: old.pois.find((p) => p.id === 'n10775260925') },
}, null, 2));
