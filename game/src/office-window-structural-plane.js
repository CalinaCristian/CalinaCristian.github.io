import * as THREE from '../vendor/three.module.min.js';

// Only callers with an independently reviewed unchanged builder band may use
// this certificate. It does not discover an arbitrary nearby surface or infer
// a source room/floor from a mesh. All exterior geometry remains untouched.
export function structuralOwnerPlanes(owner, { floor, band, width, height, sourceCenter, sourceOutward }) {
  if (
    !band ||
    ![
      floor,
      band.baseM,
      band.topM,
      width,
      height,
      sourceCenter?.x,
      sourceCenter?.y,
      sourceCenter?.z,
      sourceOutward?.x,
      sourceOutward?.z
    ].every(Number.isFinite) ||
    band.topM <= band.baseM ||
    width <= 0 ||
    height <= 0
  )
    return { known: false, reason: 'Reviewed finite structural band and source frame required' };
  const lo = floor + band.baseM,
    hi = floor + band.topM,
    EPS = 1e-5,
    triangles = [],
    segments = new Map(),
    points = new Map();
  owner.updateWorldMatrix(true, true);
  const key = (p) => p.x + ',' + p.z;
  owner.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position) return;
    const p = o.geometry.attributes.position,
      I = o.geometry.index,
      n = I ? I.count : p.count;
    for (let i = 0; i < n; i += 3) {
      const v = [0, 1, 2].map((k) =>
        new THREE.Vector3().fromBufferAttribute(p, I ? I.getX(i + k) : i + k).applyMatrix4(o.matrixWorld)
      );
      // Actual full-height main-prism triangles, not frames, glazing or furniture.
      if (
        !v.every((p) => Math.abs(p.y - lo) < EPS || Math.abs(p.y - hi) < EPS) ||
        Math.max(...v.map((p) => p.y)) - Math.min(...v.map((p) => p.y)) < hi - lo - EPS
      )
        continue;
      const normal = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();
      if (Math.abs(normal.y) > 1e-8) continue;
      const base = v.filter((p) => Math.abs(p.y - lo) < EPS);
      if (base.length === 2) {
        const keys = base.map(key).sort(),
          k = keys.join('|');
        segments.set(k, keys);
        for (const p of base) points.set(key(p), [p.x, p.z]);
      }
      triangles.push({ v, normal, mesh: o.name, material: o.material?.name, triangleIndex: i / 3 });
    }
  });
  const adjacency = new Map();
  for (const [a, b] of segments.values()) {
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a).push(b);
    adjacency.get(b).push(a);
  }
  if (!adjacency.size || [...adjacency.values()].some((a) => a.length !== 2))
    return { known: false, reason: 'Known structural main-prism contour is incomplete/ambiguous' };
  const first = adjacency.keys().next().value,
    ring = [],
    visited = new Set();
  let current = first,
    previous = null;
  do {
    if (visited.has(current)) return { known: false, reason: 'Structural contour has a non-simple join' };
    visited.add(current);
    ring.push(points.get(current));
    const next = adjacency.get(current).find((p) => p !== previous);
    previous = current;
    current = next;
  } while (current !== first);
  if (visited.size !== adjacency.size)
    return { known: false, reason: 'Multiple structural contours require explicit ownership review' };
  const groups = [];
  for (const t of triangles) {
    // Keep emitted outward winding; never turn the opposite wall into this face.
    if (t.normal.dot(sourceOutward) <= 0) continue;
    let group = groups.find(
      (g) =>
        g.normal.distanceTo(t.normal) < 1e-8 && Math.abs(g.normal.dot(t.v[0].clone().sub(g.origin))) < EPS
    );
    if (!group) {
      group = { normal: t.normal, origin: t.v[0], triangles: [] };
      groups.push(group);
    }
    group.triangles.push(t);
  }
  const planes = [];
  for (const g of groups) {
    const center = sourceCenter
        .clone()
        .addScaledVector(g.normal, -g.normal.dot(sourceCenter.clone().sub(g.origin))),
      right = new THREE.Vector3(-g.normal.z, 0, g.normal.x),
      u = g.triangles.flatMap((t) => t.v.map((p) => p.clone().sub(center).dot(right)));
    if (
      Math.min(...u) > -width / 2 + EPS ||
      Math.max(...u) < width / 2 - EPS ||
      sourceCenter.y - height / 2 < lo - EPS ||
      sourceCenter.y + height / 2 > hi + EPS
    )
      continue;
    // All triangles in the chosen actual plane are retained for a full coverage
    // certificate in the caller; no averaged/slanted approximate plane is used.
    planes.push({
      center,
      right,
      outward: g.normal.clone(),
      bodyRing: ring,
      basis: band.basis,
      sourcePlaneDeltaM: center.clone().sub(sourceCenter).dot(sourceOutward),
      triangles: g.triangles.map((t) => ({
        mesh: t.mesh,
        material: t.material,
        triangleIndex: t.triangleIndex,
        worldVertices: t.v.map((v) => v.toArray())
      }))
    });
  }
  return { known: true, planes };
}
