// ============================================================================
//  Seattle Center — the International Fountain (OSM way 35352476, amenity=fountain, fountain=jet_water, height=37).
//  Sources, all literal:
//   - the bowl's rim is the OSM ring itself (34 nodes, 56.5 m across), stored here because the spot extract and the
//     source context carry no fountain polygon; the benches around it are the mapped bench nodes;
//   - the bowl's floor and slopes are the USGS 3DEP 1 m DEM (EPQS, 33 points on two diameters, 2026-11-13): floor
//     32.90–32.99 m NAVD88 within 17 m of the centre, rising to the surrounding ground at the ring (35.1–37.0 m);
//   - the dome: OSM way 394955907 (roof:shape=dome, height 3, 9.5 m across); stainless steel since the 1995 rebuild (WET Design;
//     Wikipedia gives 8.2 m x 3.0 m, OSM's footprint wins); 4 "super shooters" on the dome up to 120 ft (37 m, = OSM height), a ring of 56 "micro shooters" set in the granite
//     floor and a ring of floodlights between them and the dome (Wikipedia, "International Fountain").
//  Estimates (no source): the micro-shooter ring's radius (13 m), the floodlight ring (7.5 m), the show's rhythm and
//  the jets' widths, the granite's colour. The fountain is walkable, as it is in reality (people go down to the dome).
//  The scene's native ground is extended west to take the whole bowl (the spot extract's terrain stops at x = −190).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, clamp, inPoly, polyBox, distSeg } from '../kit.js';
import { bench } from '../osm.js';

// OSM way 35352476 (v. live 2026-11-12), closed ring
export const FOUNTAIN_RING_LL = [[47.6224996, -122.3516482], [47.6225492, -122.3516544], [47.622597, -122.3516749], [47.6226413, -122.3517089], [47.6226802, -122.351755], [47.6227123, -122.3518115], [47.6227363, -122.3518761], [47.6227514, -122.3519465], [47.6227527, -122.3519635], [47.622757, -122.35202], [47.6227527, -122.3520936], [47.6227389, -122.3521646], [47.622716, -122.3522302], [47.622685, -122.3522879], [47.6226469, -122.3523355], [47.6226033, -122.3523712], [47.6225558, -122.3523936], [47.6225064, -122.3524018], [47.6224567, -122.3523956], [47.6224089, -122.3523751], [47.6223647, -122.3523411], [47.6223258, -122.352295], [47.6222937, -122.3522385], [47.6222696, -122.3521738], [47.6222545, -122.3521034], [47.622249, -122.35203], [47.6222532, -122.3519564], [47.622267, -122.3518854], [47.6222899, -122.3518198], [47.622321, -122.3517621], [47.622359, -122.3517145], [47.6224026, -122.3516788], [47.6224501, -122.3516564]];
// amenity=bench nodes on the fountain's terraces (OSM, 2026-11-12)
export const FOUNTAIN_BENCHES_LL = [[47.6227324, -122.3523251], [47.622673, -122.3524021], [47.6226111, -122.3524497], [47.6225187, -122.3524836], [47.6224392, -122.3524745], [47.622382, -122.3524445], [47.6222946, -122.3523656], [47.6222541, -122.3523075], [47.6227777, -122.351804], [47.622666, -122.351626], [47.6227355, -122.351698], [47.6226041, -122.3515932], [47.6227851, -122.3522222], [47.6228142, -122.3520756], [47.6228133, -122.3519168]];
export const FOUNTAIN = { floorNAVD: 32.92, floorR: 17, domeD: 8.2, domeH: 3.0, superJets: 4, superMaxH: 37, microJets: 56, microR: 13, lightR: 7.5 };

/** the native terrain box of the scene, grown to hold the bowl and its terraces (call after ctx.terrainOpts is set and
 *  after prepareSourceContext: the source context's ground keeps its seam on the same box) */
export function extendNativeGround(ctx, box) {
    const st = ctx.extras.sourceContext, cur = ctx.terrainOpts.inner || st?.nativeInner;
    const inner = { x0: Math.min(cur.x0, box.x0), z0: Math.min(cur.z0, box.z0), x1: Math.max(cur.x1, box.x1), z1: Math.max(cur.z1, box.z1) };
    ctx.terrainOpts.inner = inner; if (st) st.nativeInner = inner;
    return inner;
}

export function internationalFountain(ctx) {
    const g = ctx.ground, ring = FOUNTAIN_RING_LL.map(([la, lo]) => { const p = ctx.ll(la, lo); return [p.x, p.z]; });
    let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length;
    const bb = polyBox(ring), rimR = ((bb.x1 - bb.x0) + (bb.z1 - bb.z0)) / 4;
    extendNativeGround(ctx, { x0: Math.floor((bb.x0 - 48) / 8) * 8, z0: Math.floor((bb.z0 - 24) / 8) * 8, x1: bb.x1, z1: bb.z1 });
    const floorY = FOUNTAIN.floorNAVD - ctx.data.origin.elev, F = FOUNTAIN;
    // ---- the bowl: ground modifier from the DEM profile (flat floor, then a slope that meets the ground at the OSM ring)
    const rimAt = new Map(); // rim height per 2° of azimuth, from the ground as it was before this modifier
    const rimH = (a) => { const k = ((Math.round(a / (Math.PI / 90)) % 180) + 180) % 180; if (!rimAt.has(k)) { const b = k * Math.PI / 90; let r = rimR; for (let i = 0; i < ring.length; i++) { const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length]; const hit = rayHit(cx, cz, Math.cos(b), Math.sin(b), ax, az, bx, bz); if (hit != null) { r = hit; break; } } rimAt.set(k, { r, y: null }); } return rimAt.get(k); };
    g.mod((x, z, h) => {
        if (x < bb.x0 - 0.5 || x > bb.x1 + 0.5 || z < bb.z0 - 0.5 || z > bb.z1 + 0.5) return h;
        const dx = x - cx, dz = z - cz, r = Math.hypot(dx, dz), R = rimH(Math.atan2(dz, dx));
        if (r >= R.r) return h;
        if (R.y == null) R.y = h; // first query at this azimuth inside the ring: close enough to the rim's ground for a 2° sector
        const t = clamp((r - F.floorR) / (R.r - F.floorR), 0, 1), s = t * t * (3 - 2 * t) * 0.35 + t * 0.65;
        return floorY + (Math.max(R.y, floorY) - floorY) * s;
    });
    // pre-sample the rim heights from the ground at the ring itself (deterministic, before any other query)
    for (let k = 0; k < 180; k++) { const b = k * Math.PI / 90, R = rimH(b); R.y = null; const x = cx + Math.cos(b) * (R.r + 0.6), z = cz + Math.sin(b) * (R.r + 0.6); R.y = g.heightAt(x, z); }
    // paint: granite floor and slopes (light grey), the darker wet floor round the dome
    const P = ctx.painter;
    // round 3: an asphalt apron round the rim, not lawn (panorama Efow4N6Ma8F4LGpK2x3jWQ looking 140° / 320°: asphalt from the
    // path ring to the kerb all round, the lawn beyond it; OSM maps only landuse=recreation_ground w394955954 there). Its
    // width (6 m) is an estimate from that panorama.
    P.line([...ring, ring[0]], 12, '#5d5f61', 'asphalt');
    P.poly(ring, '#c4c2bc', 'slab'); P.circle(cx, cz, F.floorR + 1, '#b9b8b3', 'slab'); P.circle(cx, cz, F.domeD / 2 + 2.5, '#a7a7a3', 'slab');
    ctx.exclude.push(ring); // no generated tree in the bowl (the mapped trees stand on the lawn round it)
    // ---- the dome: a stainless steel spherical cap on the floor
    // the dome: OSM way 394955907 (building, roof:shape=dome, height 3, 9.5 m across; Wikipedia: 27 ft = 8.2 m, OSM wins).
    // The native volume of that way (an apartment-style block) is skipped by the scene; the cap is drawn here on its footprint.
    const domeB = ctx.data.buildings.find((x) => x.id === 'w394955907');
    let dcx = cx, dcz = cz; const dome = { r: F.domeD / 2, h: F.domeH, sourceId: domeB ? 'w394955907' : null };
    if (domeB) { const P = domeB.poly; dcx = P.reduce((s, p) => s + p[0], 0) / P.length; dcz = P.reduce((s, p) => s + p[1], 0) / P.length; dome.r = P.reduce((s, p) => s + Math.hypot(p[0] - dcx, p[1] - dcz), 0) / P.length; dome.h = domeB.h || F.domeH; }
    const a = dome.r, h = dome.h, Rs = (a * a + h * h) / (2 * h), theta = Math.asin(a / Rs), b = new GeoBatch();
    const cap = new THREE.SphereGeometry(Rs, 40, 12, 0, Math.PI * 2, 0, theta); cap.translate(0, h - Rs, 0);
    b.add(cap, 'domeSteel', M(dcx, floorY, dcz), '#ffffff'); cap.dispose();
    b.add(new THREE.CylinderGeometry(a + 0.25, a + 0.4, 0.18, 40, 1, true), 'stone', M(dcx, floorY + 0.06, dcz), '#8f8e8a'); // drain ring at its foot
    for (let i = 0; i < F.microJets; i++) { const t = i / F.microJets * Math.PI * 2; b.cyl(dcx + Math.cos(t) * F.microR, floorY - 0.02, dcz + Math.sin(t) * F.microR, 0.12, 0.05, '#6d7377', 'steel', 6); }
    for (let i = 0; i < 24; i++) { const t = (i + 0.5) / 24 * Math.PI * 2; b.cyl(dcx + Math.cos(t) * F.lightR, floorY - 0.02, dcz + Math.sin(t) * F.lightR, 0.22, 0.04, '#e8e4d6', 'paint', 8); }
    // the rim: a low kerb on the OSM ring, red-brown on its face (Street View, panorama Efow4N6Ma8F4LGpK2x3jWQ looking 351°)
    { const K = 0.35, out = (p, d) => { const dx = p[0] - cx, dz = p[1] - cz, L = Math.hypot(dx, dz) || 1; return [p[0] + dx / L * d, p[1] + dz / L * d]; };
      for (let i = 0; i < ring.length; i++) { const A = ring[i], B = ring[(i + 1) % ring.length], ya = g.heightAt(...out(A, 0.6)), yb = g.heightAt(...out(B, 0.6));
          const [ao, bo, ai, bi] = [out(A, 0.25), out(B, 0.25), out(A, -0.25), out(B, -0.25)];
          b.quad([ao[0], ya - 0.15, ao[1]], [bo[0], yb - 0.15, bo[1]], [bo[0], yb + K, bo[1]], [ao[0], ya + K, ao[1]], '#7e5a4a', 'stone'); // outer face
          b.quad([ao[0], ya + K, ao[1]], [bo[0], yb + K, bo[1]], [bi[0], yb + K, bi[1]], [ai[0], ya + K, ai[1]], '#b7b0a6', 'stone');         // cap
          b.quad([ai[0], ya + K, ai[1]], [bi[0], yb + K, bi[1]], [bi[0], yb - 0.6, bi[1]], [ai[0], ya - 0.6, ai[1]], '#a9a49b', 'stone'); } } // inner face
    const steel = new THREE.MeshStandardMaterial({ color: '#d2d6da', metalness: 0.55, roughness: 0.28, vertexColors: true, envMapIntensity: 1.4 }); steel.name = 'international-fountain-dome';
    const mesh = b.build('international-fountain', { matOverrides: { domeSteel: steel } }); ctx.add(mesh);
    ctx.circle(dcx, dcz, a, floorY + h); // the dome is solid (you walk round it)
    // ---- jets: 4 super shooters on the dome, 56 micro shooters arching inward from the floor ring; a slow show cycle
    const jm = new THREE.MeshStandardMaterial({ color: '#eef6fa', roughness: 0.3, transparent: true, opacity: 0.62, depthWrite: false, emissive: new THREE.Color('#dff3ff'), emissiveIntensity: 0.12 });
    jm.userData.nightEmissive = 0.9; jm.name = 'international-fountain-jets';
    const col = new THREE.CylinderGeometry(0.12, 0.32, 1, 8, 1, true); col.translate(0, 0.5, 0);
    const sup = new THREE.InstancedMesh(col, jm, F.superJets); sup.name = 'international-fountain-super'; sup.castShadow = false; sup.frustumCulled = false;
    // a micro shooter's arc at full size (4.5 m reach, 3 m high), scaled down uniformly as the ring pulses
    const arcG = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-2.25, 6, 0), new THREE.Vector3(-4.5, 0, 0)), 10, 0.035, 4, false);
    const am = jm.clone(); am.opacity = 0.42; am.userData.nightEmissive = 0.9; am.name = 'international-fountain-arcs';
    const mic = new THREE.InstancedMesh(arcG, am, F.microJets); mic.name = 'international-fountain-micro'; mic.castShadow = false; mic.frustumCulled = false;
    ctx.add(sup); ctx.add(mic);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let t = 0;
    const pose = () => {
        // a 150 s cycle (estimate): a 90 s show — the super shooters rise to their full 37 m in its middle, the micro ring
        // pulses — then a minute with the jets off (the panoramas at the bowl show it still)
        const cyc = t % 150, show = cyc < 90 ? Math.min(1, cyc / 3, (90 - cyc) / 3) : 0, k = Math.min(1, cyc / 90), sH = show * (6 + (F.superMaxH - 6) * Math.max(0, Math.sin(k * Math.PI)) ** 2);
        for (let i = 0; i < F.superJets; i++) { const ang = i / F.superJets * Math.PI * 2 + Math.PI / 4, rr = a * 0.45, hh = sH * (0.9 + 0.1 * Math.sin(t * 2.1 + i));
            const yTop = floorY + h - (rr * rr) / (2 * Rs); v.set(dcx + Math.cos(ang) * rr, yTop, dcz + Math.sin(ang) * rr); q.identity(); sc.set(1 + hh / 40, Math.max(1e-4, hh), 1 + hh / 40); m4.compose(v, q, sc); sup.setMatrixAt(i, m4); }
        sup.instanceMatrix.needsUpdate = true;
        const on = 0.5 + 0.5 * Math.sin(t * 0.9);
        for (let i = 0; i < F.microJets; i++) { const ang = i / F.microJets * Math.PI * 2, s = show * (0.35 + 0.75 * on * (0.8 + 0.2 * Math.sin(i * 1.7 + t * 3))) + 1e-4;
            v.set(dcx + Math.cos(ang) * F.microR, floorY, dcz + Math.sin(ang) * F.microR); q.setFromAxisAngle(up, -ang); sc.set(s, s, s); m4.compose(v, q, sc); mic.setMatrixAt(i, m4); }
        mic.instanceMatrix.needsUpdate = true;
    };
    pose(); ctx.onUpdate((dt) => { t += dt; pose(); });
    // night: the floodlight ring
    for (let i = 0; i < 6; i++) { const ang = (i + 0.5) / 6 * Math.PI * 2; ctx.lampPoints.push({ x: dcx + Math.cos(ang) * F.lightR, z: dcz + Math.sin(ang) * F.lightR, y: floorY, h: 2, noPost: true }); }
    // ---- the mapped benches (facing the fountain)
    { const bb2 = new GeoBatch(); for (const [la, lo] of FOUNTAIN_BENCHES_LL) { const p = ctx.ll(la, lo), y = g.heightAt(p.x, p.z), ang = Math.atan2(cx - p.x, cz - p.z); bench(bb2, p.x, y, p.z, ang); ctx.collider({ x: p.x, z: p.z, r: 1, angle: ang, hw: 0.9, hd: 0.3, prop: true, h: 0.45 }); }
      ctx.add(bb2.build('international-fountain-benches')); }
    ctx.extras.internationalFountain = { sourceId: 'w35352476', centre: [cx, cz], rimR, floorY, dome: { ...dome, centre: [dcx, dcz] }, benches: FOUNTAIN_BENCHES_LL.length,
        provenance: 'Rim: OSM ring; floor/slopes: USGS 3DEP 1 m DEM; dome and jets: Wikipedia (1995 rebuild); jet ring radii and the show rhythm are estimates.' };
    return { cx, cz, rimR, floorY, ring };
}

function rayHit(ox, oz, dx, dz, ax, az, bx, bz) {
    const ex = bx - ax, ez = bz - az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) return null;
    const t = ((ax - ox) * ez - (az - oz) * ex) / den, u = ((ax - ox) * dz - (az - oz) * dx) / den;
    return t > 0 && u >= 0 && u <= 1 ? t : null;
}
void inPoly; void distSeg;
