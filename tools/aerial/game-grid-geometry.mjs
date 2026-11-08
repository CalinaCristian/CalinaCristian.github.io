// Use the district builder's exact solid-footprint distance for square capture cells.
import { footprintMargin } from '../osm/geom.mjs';

export function projectDistrictGeometry(cfg, data, project) {
  if (data.district?.geometry) return data.district.geometry;
  const pieces = (cfg.bands || []).map(b => ({ r: b.r, chapter: b.chapter, pts: b.line.map(ll => project(...ll)) }));
  const circles = (cfg.circles || []).map(c => ({ ...c, x: project(c.lat, c.lon)[0], z: project(c.lat, c.lon)[1] }));
  if (cfg.route?.length) throw new Error('Route districts require generated district.geometry; do not approximate their routed boundary');
  const bb = cfg.bbox;
  const sourcePolys = cfg.poly ? [cfg.poly] : pieces.length ? [] : [[[bb[0],bb[1]],[bb[0],bb[3]],[bb[2],bb[3]],[bb[2],bb[1]]]];
  return { pieces, circles, polys: sourcePolys.map(p => p.map(ll => project(...ll))) };
}

export function geometryBounds(geometry) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const expand = (x,z,r=0) => { bounds[0]=Math.min(bounds[0],x-r);bounds[1]=Math.min(bounds[1],z-r);bounds[2]=Math.max(bounds[2],x+r);bounds[3]=Math.max(bounds[3],z+r); };
  for (const p of geometry.pieces || []) for (const q of p.pts) expand(...q,p.r);
  for (const c of geometry.circles || []) expand(c.x,c.z,c.r);
  for (const p of geometry.polys || []) for (const q of p) expand(...q);
  if (!bounds.every(Number.isFinite)) throw new Error('District has no finite analytic geometry');
  return bounds;
}

export function rectangleMargin(bounds, geometry) {
  const [x0,z0,x1,z1] = bounds;
  return footprintMargin([[x0,z0],[x1,z0],[x1,z1],[x0,z1]],geometry);
}
