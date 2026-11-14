// Spot scene checks for index.js (split out by spec 22; index.js re-exports floorProbe and auditSpot): the rendered-floor
// probe loadSpot hands to the walker and crowd, and auditSpot, run by game/dev/spots.html (harness:spots).
import * as THREE from '../../vendor/three.module.min.js';
import { collide } from './walker.js';
import { DEG } from './kit.js';

// ============================================================================
//  Rendered floors (note 27): big, near-horizontal triangles of the static scene meshes (steps, plinths, terraces,
//  decks) in an x/z grid. lift(x, z, y) raises a person whose body cuts such a floor (top within (y, y + 1.4]) onto it,
//  repeatedly (a flight of steps); furniture / roofs / vehicles are not floors.
// ============================================================================
export function floorProbe(scene, { minArea = 0.25, cell = 4 } = {}) {
    scene.updateMatrixWorld(true);
    const grid = new Map(), key = (i, j) => i * 100003 + j, v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], list = [];
    const skip = /^(terrain|ground|sky|water|people|crowd|tree|lamp|bench|table|chair|terrace|stall|car|parked|furniture|sign|plaque|roof|canopy|awning|umbrella|bubble)/i;
    scene.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
        // A vehicle's children are often unnamed. Test the ancestry as well:
        // a car created at the origin once lifted the Pioneer guide onto its
        // roof, leaving a floating person when traffic took its first frame.
        for (let a = o; a && a !== scene; a = a.parent) if (!a.visible || a.userData.noFloor || skip.test(a.name || '') || /roof|canopy|awning|bench|table|chair|shelf|car/i.test(a.name || '')) return;
        const pos = o.geometry?.attributes?.position, idx = o.geometry?.index; if (!pos) return;
        const n = idx ? idx.count / 3 : pos.count / 3, mw = o.matrixWorld;
        for (let t = 0; t < n; t++) {
            for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, idx ? idx.getX(t * 3 + k) : t * 3 + k).applyMatrix4(mw);
            const ux = v[1].x - v[0].x, uy = v[1].y - v[0].y, uz = v[1].z - v[0].z, wx = v[2].x - v[0].x, wy = v[2].y - v[0].y, wz = v[2].z - v[0].z;
            const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, A2 = Math.hypot(nx, ny, nz);
            if (A2 < minArea * 2 || ny * ny < 0.85 * 0.85 * A2 * A2) continue; // small or not horizontal
            const T = [v[0].x, v[0].z, v[1].x, v[1].z, v[2].x, v[2].z, (v[0].y + v[1].y + v[2].y) / 3];
            if (Math.max(T[0], T[2], T[4]) - Math.min(T[0], T[2], T[4]) > 60 || Math.max(T[1], T[3], T[5]) - Math.min(T[1], T[3], T[5]) > 60) continue; // ground plates / water: not steps (and no grid blow-up)
            list.push(T);
            for (let i = Math.floor(Math.min(T[0], T[2], T[4]) / cell); i <= Math.floor(Math.max(T[0], T[2], T[4]) / cell); i++) for (let j = Math.floor(Math.min(T[1], T[3], T[5]) / cell); j <= Math.floor(Math.max(T[1], T[3], T[5]) / cell); j++) { const k = key(i, j); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(T); }
        }
    });
    const inT = (x, z, T) => { const s = (ax, az, bx, bz) => (x - bx) * (az - bz) - (ax - bx) * (z - bz); const d1 = s(T[0], T[1], T[2], T[3]), d2 = s(T[2], T[3], T[4], T[5]), d3 = s(T[4], T[5], T[0], T[1]); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
    /** the highest rendered floor whose top is within (y + lo, y + hi] at (x, z), or null */
    const above = (x, z, y, lo = 0.08, hi = 1.4) => { let best = null; for (const T of grid.get(key(Math.floor(x / cell), Math.floor(z / cell))) || []) { const ty = T[6]; if (ty > y + lo && ty <= y + hi && (best === null || ty > best) && inT(x, z, T)) best = ty; } return best; };
    return { tris: list.length, above, lift: (x, z, y) => { for (let k = 0; k < 12; k++) { const t = above(x, z, y); if (t === null) return y; y = t; } return y; } };
}

// ============================================================================
//  Spot audit (owner notes 23/26/27/29/36; run by dev/spots.html → harness:spots). Static checks on the built scene:
//   zfight        coplanar, same-facing triangles of the scene's static meshes that overlap in their plane (> 0.05 m²)
//   phantom       colliders with no rendered geometry inside their footprint at body height (invisible walls)
//   pedCollider   standing / walking people inside a collider; pedBelow: below the walkable surface (steps, plinths)
//   badGeometry   NaN positions / normals, zero-length normals, degenerate triangles (area < 1e-8 m²)
//   lampOnRoad    lamp posts inside a carriageway; carOverlap: traffic cars intersecting each other
//   emptySign     plaques / signs without text
// Each finding keeps a few samples { x, z, … } for a close-up.
// ============================================================================
export function auditSpot(spot, { maxSamples = 6 } = {}) {
    const t0 = performance.now(), out = {}, add = (k, s) => { const o = out[k] || (out[k] = { n: 0, samples: [] }); o.n++; if (o.samples.length < maxSamples && s) o.samples.push(s); };
    const scene = spot.scene; scene.updateMatrixWorld(true);
    const skipMesh = (o) => !o.visible || /^(terrain|ground|sky|water|bubble|sign|label|plaque)/i.test(o.name || '') || o.material?.transparent && (o.material.opacity ?? 1) < 0.6 || o.material?.alphaTest > 0 || o.material?.depthWrite === false;
    const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    // ---- triangle soup (static meshes) + boxes of instanced meshes for the phantom test
    const tris = [], boxes = [], geoSeen = new Set(), v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], m4 = new THREE.Matrix4(), bb = new THREE.Box3();
    scene.traverse((o) => {
        if (!o.isMesh || !visible(o) || o.userData.noAudit) return;
        // (a packed dynamic-index mesh, frame-budget.js, is audited on its whole source geometry, as the multi-draw is)
        const g = o.userData.auditGeometry || o.geometry, pos = g?.attributes?.position; if (!pos) return;
        if (!geoSeen.has(g)) { geoSeen.add(g); // geometry sanity once per geometry
            const nrm = g.attributes.normal, idx = g.index;
            for (let i = 0; i < pos.count; i++) if (!Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))) { add('badGeometry', { mesh: o.name, kind: 'NaN position' }); break; }
            if (nrm) for (let i = 0; i < nrm.count; i++) { const a = nrm.getX(i), b = nrm.getY(i), c = nrm.getZ(i); if (!Number.isFinite(a + b + c)) { add('badGeometry', { mesh: o.name, kind: 'NaN normal' }); break; } if (a * a + b * b + c * c < 1e-8) { add('badGeometry', { mesh: o.name, kind: 'zero normal' }); break; } }
            const n = idx ? idx.count / 3 : pos.count / 3; let deg = 0;
            for (let t = 0; t < n; t++) { const [a, b, c] = idx ? [idx.getX(t * 3), idx.getX(t * 3 + 1), idx.getX(t * 3 + 2)] : [t * 3, t * 3 + 1, t * 3 + 2]; v[0].fromBufferAttribute(pos, a); v[1].fromBufferAttribute(pos, b); v[2].fromBufferAttribute(pos, c); if (v[1].sub(v[0]).cross(v[2].sub(v[0])).lengthSq() < 4e-16) deg++; }
            if (deg) add('badGeometry', { mesh: o.name, kind: 'degenerate', count: deg });
        }
        if (o.isInstancedMesh) { if (!g.boundingBox) g.computeBoundingBox(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); bb.copy(g.boundingBox).applyMatrix4(m4); boxes.push([bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z]); } return; }
        if (o.isSkinnedMesh || o.morphTargetInfluences) return;
        const idx = g.index, n = idx ? idx.count / 3 : pos.count / 3, mw = o.matrixWorld, zf = !skipMesh(o) && !/^(people|crowd|trees?|treeCrowns|lamps?)/i.test(o.name || '');
        for (let t = 0; t < n; t++) {
            for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, idx ? idx.getX(t * 3 + k) : t * 3 + k).applyMatrix4(mw);
            const ax = v[0].x, ay = v[0].y, az = v[0].z, bx = v[1].x, by = v[1].y, bz = v[1].z, cx = v[2].x, cy = v[2].y, cz = v[2].z;
            boxes.push([Math.min(ax, bx, cx), Math.min(ay, by, cy), Math.min(az, bz, cz), Math.max(ax, bx, cx), Math.max(ay, by, cy), Math.max(az, bz, cz)]);
            if (!zf) continue;
            const ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az;
            let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const A2 = Math.hypot(nx, ny, nz); if (A2 < 0.6) continue; // < 0.3 m²
            nx /= A2; ny /= A2; nz /= A2;
            tris.push({ o: o.id, name: o.name, n: [nx, ny, nz], d: nx * ax + ny * ay + nz * az, p: [ax, ay, az, bx, by, bz, cx, cy, cz] });
        }
    });
    // ---- z-fight: bucket by quantised plane, overlap test in the plane (vertex / centroid strictly inside the other)
    const buckets = new Map(), qk = (t, dd) => `${Math.round(t.n[0] * 40)},${Math.round(t.n[1] * 40)},${Math.round(t.n[2] * 40)},${Math.round(t.d / 0.02) + dd}`;
    for (const t of tris) { const k = qk(t, 0); let b = buckets.get(k); if (!b) buckets.set(k, b = []); b.push(t); }
    const proj = (t) => { const [nx, ny, nz] = t.n, ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz), P = t.p; return ax >= ay && ax >= az ? [[P[1], P[2]], [P[4], P[5]], [P[7], P[8]]] : ay >= az ? [[P[0], P[2]], [P[3], P[5]], [P[6], P[8]]] : [[P[0], P[1]], [P[3], P[4]], [P[6], P[7]]]; };
    const inTri = (p, T) => { const s = (a, b, c) => (a[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (a[1] - c[1]); const d1 = s(p, T[0], T[1]), d2 = s(p, T[1], T[2]), d3 = s(p, T[2], T[0]), e = 1e-3; return (d1 > e && d2 > e && d3 > e) || (d1 < -e && d2 < -e && d3 < -e); };
    const zseen = new Set(); let zpairs = 0;
    for (const [k, b] of buckets) {
        const parts = k.split(','), near = [b]; for (const dd of [1]) { const b2 = buckets.get(`${parts[0]},${parts[1]},${parts[2]},${+parts[3] + dd}`); if (b2) near.push(b2); }
        const all = near.flat(); if (all.length < 2 || all.length > 4000) continue;
        const pr = all.map(proj);
        for (let i = 0; i < b.length; i++) for (let j = i + 1; j < all.length; j++) {
            const A = pr[i], B = pr[j], ta = all[i], tb = all[j]; if (Math.abs(ta.d - tb.d) > 0.02) continue;
            { const q = tb.p, off = ta.n[0] * (q[0] + q[3] + q[6]) / 3 + ta.n[1] * (q[1] + q[4] + q[7]) / 3 + ta.n[2] * (q[2] + q[5] + q[8]) / 3 - ta.d; if (Math.abs(off) > 0.02) continue; } // nearly parallel planes far from the origin share d without touching (patch from lane buc-spots)
            const ca = [(A[0][0] + A[1][0] + A[2][0]) / 3, (A[0][1] + A[1][1] + A[2][1]) / 3], cb = [(B[0][0] + B[1][0] + B[2][0]) / 3, (B[0][1] + B[1][1] + B[2][1]) / 3];
            if (!(inTri(ca, B) || inTri(cb, A))) continue;
            zpairs++; const key = `${Math.round(ta.p[0] / 4)},${Math.round(ta.p[2] / 4)}`; if (zseen.has(key)) continue; zseen.add(key);
            add('zfight', { x: +ta.p[0].toFixed(1), y: +ta.p[1].toFixed(1), z: +ta.p[2].toFixed(1), a: ta.name, b: tb.name });
        }
    }
    if (out.zfight) out.zfight.pairs = zpairs;
    // ---- phantom colliders: nothing rendered inside the footprint between the ground and +2.2 m
    const cell = 4, grid = new Map(), gk = (i, j) => i * 100003 + j;
    boxes.forEach((B, n) => { if (B[3] - B[0] > 120 || B[5] - B[2] > 120) return; for (let i = Math.floor(B[0] / cell); i <= Math.floor(B[3] / cell); i++) for (let j = Math.floor(B[2] / cell); j <= Math.floor(B[5] / cell); j++) { const k = gk(i, j); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(n); } });
    const anyIn = (x0, z0, x1, z1, y0, y1, test) => { for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) for (const n of grid.get(gk(i, j)) || []) { const B = boxes[n]; if (B[0] <= x1 && B[3] >= x0 && B[2] <= z1 && B[5] >= z0 && B[1] <= y1 && B[4] >= y0 && (!test || test(B))) return true; } return false; };
    const G = spot.ground;
    // a poly collider held inside another poly collider over its whole height band cannot be touched: not an invisible wall
    // (the elevated Avenue Bellevue building:part volumes inside the w1215907937 outline, r3-bel-spots-7)
    const pip = (x, z, P) => { let a = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) a = !a; } return a; };
    const enclosedBy = (c, pts) => spot.colliders.some((o) => o !== c && o.poly && !o.intended && !o.invisible && (o.y0 ?? -1e9) <= (c.y0 ?? -1e9) + 0.01 && (o.y1 ?? 1e9) >= (c.y1 ?? 1e9) - 0.01 && pts.every(([x, z]) => pip(x, z, o.poly)));
    for (const c of spot.colliders) {
        if (c.intended || c.invisible) continue;
        // a raised poly (an elevated building:part, min_height above head height) renders walls and roof only: its shell is
        // checked on the edges, not at interior points where nothing is drawn (r3-bel-spots-7, Avenue Bellevue parts)
        const raisedPoly = c.poly && c.y0 !== undefined && c.y0 > G.groundAt(c.x, c.z, G.heightAt(c.x, c.z) + 1) + 2.2;
        const pts = c.wall ? [0.15, 0.5, 0.85].map((u) => [c.ax + (c.bx - c.ax) * u, c.az + (c.bz - c.az) * u])
            : raisedPoly ? c.poly.slice(0, 8).map(([x, z], i) => { const [x2, z2] = c.poly[(i + 1) % c.poly.length]; return [(x + x2) / 2, (z + z2) / 2]; })
            : c.poly ? [[c.x, c.z], ...c.poly.slice(0, 6)].map(([x, z]) => [x + (c.x - x) * 0.15, z + (c.z - z) * 0.15]) : [[c.x, c.z]];
        let miss = 0, blocks = false;
        for (const [x, z] of pts) { const gy = c.y ?? G.groundAt(x, z, G.heightAt(x, z) + 1), r = c.wall ? 0.6 : c.poly ? 1.5 : Math.max(0.3, Math.min(c.r, 3)); const y0 = c.wall ? Math.min(c.y0a ?? -1e9, c.y0b ?? -1e9) : c.y0, y1 = c.wall ? Math.max(c.y1a ?? 1e9, c.y1b ?? 1e9) : c.y1; if (y1 !== undefined && y1 < gy) continue; blocks = true;
            const b0 = y0 !== undefined && y0 > gy + 1.2 ? y0 : gy + 0.05, b1 = Math.min(y1 ?? 1e9, b0 + 2.2); if (!anyIn(x - r, z - r, x + r, z + r, b0 - 0.1, b1)) miss++; } // a raised collider (upper-floor railing, overhang) is checked at its own height
        if (blocks && miss === pts.length && c.poly && enclosedBy(c, pts)) continue;
        if (blocks && miss === pts.length) add('phantom', { x: +c.x.toFixed(1), z: +c.z.toFixed(1), kind: c.wall ? 'wall' : c.poly ? 'poly' : c.prop ? 'prop' : 'box', r: +(c.r || 0).toFixed(1) });
    }
    // ---- people
    const fp = spot.ctx?.extras?.floorProbe || floorProbe(scene);
    for (const p of spot.crowd?.peds || []) {
        if (p.act === 'sit' || p.hidden) continue;
        { const t = fp.above(p.x, p.z, p.y, 0.15, 1.2); if (t !== null) add('pedSunk', { x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2), floor: +t.toFixed(2), act: p.act }); }
        if (spot.colliders.length && collide(spot.colliders, p.x, p.z, 0.2, p.y + 0.3, true)) add('pedCollider', { x: +p.x.toFixed(1), z: +p.z.toFixed(1), act: p.act });
        const gy = G.groundAt(p.x, p.z, p.y + 1.2); if (Number.isFinite(gy) && gy < p.y + 30 && p.y < gy - 0.15) add('pedBelow', { x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2), floor: +gy.toFixed(2) });
    }
    // ---- lamps / cars on carriageways
    const onRoad = spot.ctx?.onRoad;
    if (onRoad) for (const l of spot.lamps || []) if (!l.noPost && l.h > 4 && onRoad(l.x, l.z, 0.1)) add('lampOnRoad', { x: +l.x.toFixed(1), z: +l.z.toFixed(1) });
    const cars = spot.ctx?.extras?.obstacles?.() || [];
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) { const a = cars[i], b = cars[j], dx = b.x - a.x, dz = b.z - a.z, along = Math.abs(dx * a.fx + dz * a.fz), lat = Math.abs(dx * a.fz - dz * a.fx); if (along < (a.length + b.length) / 2 - 0.3 && lat < (a.width + b.width) / 2 - 0.2) add('carOverlap', { x: +a.x.toFixed(1), z: +a.z.toFixed(1) }); }
    // ---- signs (notes 51/52): tilted boards, boards overlapping each other
    const signs = []; const up = new THREE.Vector3(), q = new THREE.Quaternion();
    scene.traverse((o) => { if (!o.isMesh || !/^sign:/.test(o.name) || !visible(o)) return; o.getWorldQuaternion(q); up.set(0, 1, 0).applyQuaternion(q); const b = new THREE.Box3().setFromObject(o);
        if (up.y < 0.995 && !o.userData.tiltOk) add('signTilted', { x: +b.getCenter(up).x.toFixed(1), z: +up.z.toFixed(1), name: o.name.slice(5, 40), deg: Math.round(Math.acos(Math.min(1, new THREE.Vector3(0, 1, 0).applyQuaternion(q).y)) / DEG) });
        signs.push({ b, name: o.name }); });
    for (let i = 0; i < signs.length; i++) for (let j = i + 1; j < signs.length; j++) { const A = signs[i].b, B = signs[j].b; if (!A.intersectsBox(B)) continue; const I = A.clone().intersect(B), s1 = I.getSize(new THREE.Vector3()); if (s1.y > 0.08 && Math.max(s1.x, s1.z) > 0.15) add('signOverlap', { x: +I.min.x.toFixed(1), y: +I.min.y.toFixed(1), z: +I.min.z.toFixed(1), a: signs[i].name.slice(5, 30), b: signs[j].name.slice(5, 30) }); }
    // ---- empty signs / plaques
    for (const p of spot.plaques || []) if (!String(p.title || '').trim() || !String(p.text || '').trim()) add('emptySign', { x: p.x, z: p.z, title: p.title || '' });
    const counts = Object.fromEntries(Object.entries(out).map(([k, o]) => [k, o.n]));
    return { spot: spot.id, ms: Math.round(performance.now() - t0), tris: tris.length, colliders: spot.colliders.length, counts, findings: out };
}
