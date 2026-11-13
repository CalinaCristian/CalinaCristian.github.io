// ============================================================================
//  WORLD MAP-END CLOSURES — the closure sets on every road cut at the district edge
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import * as THREE from '../vendor/three.module.min.js';
import { clamp } from './util.js';
import { bakeProp, mergeProps, rgb } from './geobuild.js';
import { carProps, props } from './world-shared.js';

export function buildMapEndClosures(ctx) {
    const {
        ASPHALT, US, addPropColl, addSignQuad, boundarySupport, builderEpoch, buildingAt, cellOf,
        cells, city, closures, data, distId, dmask, isWater, mapEnds,
        propColl, signs, yAlong,
    } = ctx;
    if (mapEnds.length) {
        const P = props();
        const coneG = P._cone || (P._cone = mergeProps([bakeProp(new THREE.ConeGeometry(0.18, 0.7, 8), { y: 0.35, color: '#ff6a13' }), bakeProp(new THREE.CylinderGeometry(0.115, 0.13, 0.12, 8), { y: 0.42, color: '#f4f4f4' }), bakeProp(new THREE.BoxGeometry(0.42, 0.04, 0.42), { y: 0.02, color: '#222222' })]));
        const drumG = P._drum || (P._drum = mergeProps([0, 1, 2, 3].map(i => bakeProp(new THREE.CylinderGeometry(0.29, 0.3, 0.24, 10), { y: 0.12 + i * 0.24, color: i % 2 ? '#f4f4f4' : '#ff6a13' })).concat([bakeProp(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 10), { y: 0.03, color: '#222222' })])));
        const jerseyG = P._jersey || (P._jersey = mergeProps([bakeProp(new THREE.BoxGeometry(0.6, 0.35, 2.0), { y: 0.17, color: '#c9c6bd' }), bakeProp(new THREE.BoxGeometry(0.3, 0.5, 2.0), { y: 0.6, color: '#d3d0c8' })]));
        const red = rgb('#c62828'), whiteB = rgb('#f2f2f2'), orange = rgb('#ff6a13'), postCol = rgb('#6b6b6b'), yellowM = rgb('#f2b705'), dark = rgb('#222428');
        const others = Object.entries(city.districts || {}).filter(([id]) => id !== distId).map(([id, d]) => { const q = city.proj(d.center.lat, d.center.lon); return { id, x: q.x, z: q.z }; });
        const post = (c, x, z, y, h) => c.solid.box(x, y, z, 0.08, h, 0.08, 0, postCol);
        const sign = (c, x, z, y, ang, text, bg, fg, accent, w = 1.6) => { const sg = signs.get(text, bg, fg, accent, true); if (!sg) return; post(c, x, z, y, 1.4 + 0.25); addSignQuad(c, x, z, ang, 1, w, w / sg.aspect * 1.0, y + 1.4 + w / sg.aspect / 2, sg, 0.05); };
        // (spec 10 load budget) every builder of every cell, in this order, made again only when a builder was added
        let cbList = null, cbIndex = null, cbEpoch = -1;
        const closureBuilders = () => { if (cbEpoch !== builderEpoch.n) { cbList = [...cells.values()].flatMap(c => [...Object.values(c), ...(c.signs || [])]).filter(mb => mb && typeof mb.ic === 'number' && typeof mb.v === 'function'); cbIndex = new Map(cbList.map((mb, k) => [mb, k])); cbEpoch = builderEpoch.n; } return cbList; };
        mapEnds.forEach((m, k) => {
            const { ix, iz, px, pz, y, kind, edge: e } = m, c = cellOf(m.x, m.z), ang = Math.atan2(px, pz), face = Math.atan2(ix, iz); // signs face the driver coming toward the edge
            // each builder's index count now, by its place in the list as it is now (as wholePrimitive below; a Map of every
            // builder per map end cost more than the closure): one made since starts from 0
            const startList = closureBuilders(), startIndex = cbIndex, startIc = new Int32Array(startList.length), sourceScene = true;
            for (let k = 0; k < startList.length; k++) startIc[k] = startList[k].ic;
            const clipOptions = { ownerEdges: m.ownerEdges, floorY: y };
            const discrete = (mb, emit, x, z, radius, collidable = true) => {
                const vi = mb.vc, ii = mb.ic; emit();
                let lower = Infinity, upper = -Infinity;
                for (let i = ii; i < mb.ic; i++) { const yy = mb.p[mb.i[i] * 3 + 1]; lower = Math.min(lower, yy); upper = Math.max(upper, yy); }
                const clear = boundarySupport.clearMeshRange(mb, ii, clipOptions) &&
                    boundarySupport.clearCircle(x, z, radius, { ownerEdges: m.ownerEdges, y0: lower - .3, y1: upper });
                if (!clear) { mb.vc = vi; mb.ic = ii; boundarySupport.report.rejectedDiscreteProps++; return false; }
                if (collidable) {
                    if (!sourceScene) addPropColl(x, z, radius, 'closure');
                    else propColl.push({ x, z, r: radius, hw: radius, hd: radius, angle: 0, poly: null, prop: true, kind: 'closure',
                        y: lower, top: upper, h: upper - lower, y0: lower - .3, y1: upper, normalizedSourceBoundary: true });
                }
                return true;
            };
            // A readable sign and its post are one discrete object. Clipping
            // its glyph quad into pieces can leave misleading partial words.
            const wholePrimitive = emit => {
                // (each builder's counts before, by its place in the list as it was then; one made since counts from 0)
                const list0 = closureBuilders(), index0 = cbIndex, vcs = new Int32Array(list0.length), ics = new Int32Array(list0.length);
                for (let k = 0; k < list0.length; k++) { vcs[k] = list0[k].vc; ics[k] = list0[k].ic; }
                const before = mb => { const k = index0.get(mb); return k === undefined ? null : k; };
                emit();
                const touched = closureBuilders().filter(mb => { const k = before(mb); return mb.ic > (k === null ? 0 : ics[k] || 0); });
                if (touched.every(mb => { const k = before(mb); return boundarySupport.clearMeshRange(mb, k === null ? 0 : ics[k] || 0, clipOptions); })) return true;
                for (const mb of touched) { const k = before(mb); mb.vc = k === null ? 0 : vcs[k] || 0; mb.ic = k === null ? 0 : ics[k] || 0; }
                boundarySupport.report.rejectedDiscreteProps++; return false;
            };
            const closureSign = (...args) => wholePrimitive(() => sign(...args));
            // (R24) an end inside a lidded tunnel (a garage aisle cut by the district edge) keeps its stop wall and turn-around
            // prompt; it ends at the tunnel's concrete end wall, without street roadworks, signs or a crew
            if (e.lidded) { closures.push({ x: m.x, z: m.z, y, top: y + m.barrierHeight, heading: m.heading, edge: e, node: m.node, kind, leadsTo: null,
                l0: m.l0, l1: m.l1, half: m.half, bundleId: m.bundleId, bundlePrimary: m.bundlePrimary, worker: false, underground: true }); return; }
            // Immutable spans are shared by the physical wall and every visible
            // barrier; source scenery supplies the real continuation beyond it.
            const half = (m.l1 - m.l0) / 2, lc = (m.l0 + m.l1) / 2;
            const at = (d, l) => [m.x + ix * d + px * (lc + l), m.z + iz * d + pz * (lc + l)];
            // the road visibly continues past the closure (note 6): a dug-up roadworks strip, then plain asphalt with kerbs and a
            // dashed centre line running out of the district (≈ 400 m, until it would re-enter the map) into the backdrop city
            if (!sourceScene && m.bundlePrimary) { const asp = rgb(ASPHALT), kerbC = rgb('#a7a39b'), dug = rgb('#6b5a48'), dash = rgb('#d9d9d4'), wS = Math.max(1.5, m.edge.sidewalk || 2);
              const strip = (d0, d1, l0, l1, col, yy) => { const [ax, az] = at(-d0, l0), [bx, bz] = at(-d1, l0), [cx2, cz2] = at(-d1, l1), [dx, dz] = at(-d0, l1); cellOf((ax + cx2) / 2, (az + cz2) / 2).solid.face4([ax, yy, az], [bx, yy, bz], [cx2, yy, cz2], [dx, yy, dz], col, [0, 1, 0]); };
              let dEnd = 0;
              const dMax = (data.scenery || []).length ? 30 : 400; // (district scenery streets carry the real road on beyond the dug strip)
              let outS = false; for (let d = 2; d < dMax; d += 10) { const [qx, qz] = at(-(d + 10), 0), ins = dmask && dmask.at(qx, qz); if (!ins) outS = true; if ((ins && (outS || d > 60)) || buildingAt(qx, qz) || isWater(qx, qz)) break; dEnd = d + 10; } // (the coarse mask still reads 'inside' just past the edge)
              for (let d = 0.6; d < dEnd; d += 20) {
                  const d1 = Math.min(dEnd, d + 20);
                  strip(d, d1, -half, half, asp, y - 0.02 + (k % 8) * 0.002); // (two strips crossing outside the map: no z-fight)
                  strip(d, d1, -half - wS, -half, kerbC, y + 0.1); strip(d, d1, half, half + wS, kerbC, y + 0.1);
                  if (d < 25) { /* the work site behind the barrier: workSite() below */ }
                  else if (kind !== 'small') for (let q = d; q < d1 - 3; q += 9) strip(q, q + 3, -0.08, 0.08, dash, y - 0.01);
              }
              // (2026-11-08, owner: "work zones look bad" — a flat brown strip and four cones) the work site: a trench cut in the
              // asphalt (dark edges, soil at the bottom), the spoil heaped along it, a pallet of kerbstones, all inside an orange
              // safety mesh on steel rods with a cone at each corner
              if (dEnd > 30) {
                  const exc = !US && kind !== 'highway' && (e.id * 7 + k) % 3 === 0; // (the excavator closures: it digs the trench)
                  const L0 = -half * 0.85, L1 = half * 0.45, D0 = 2.6, D1 = Math.min(20, dEnd - 1), tw = clamp((L1 - L0) * 0.3, 0.6, 1.3), T0 = L0 + Math.min(0.5, half * 0.25), T1 = T0 + tw;
                  const V = (d, l, yy) => { const [x, z] = at(-d, l); return [x, yy, z]; }, cs = cellOf(m.x - ix * 10, m.z - iz * 10);
                  const nUp = (a, b2, c2) => { const e1 = [b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]], e2 = [c2[0] - a[0], c2[1] - a[1], c2[2] - a[2]], n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; return n[1] < 0 ? [-n[0], -n[1], -n[2]] : n; };
                  const q4 = (lay, a, b2, c2, d2, col) => { const n = nUp(a, b2, c2); lay.face4(a, b2, c2, d2, col, n); lay.face4(a, d2, c2, b2, col, [-n[0], -n[1], -n[2]]); };
                  strip(D0 + 0.4, D1 - 0.4, T0 - 0.12, T1 + 0.12, rgb('#3a3936'), y - 0.004);                          // saw-cut asphalt edge
                  strip(D0 + 0.5, D1 - 0.5, T0, T1, rgb('#4b3d31'), y - 0.002);                                        // soil in the trench
                  // spoil heap: a ridge with a ragged crest along the trench, on the side away from the kerb
                  const S0 = T1 + 0.15, S1 = Math.min(L1 - 0.15, S0 + 1.5), sk = Math.min(1, (S1 - S0) / 1.3), soil = rgb('#6e5a45'), soilD = rgb('#5d4a38');
                  const SA = D0 + 2.6, SB = exc ? D1 - 5.5 : D1 - 1;
                  if (S1 - S0 > 0.45 && SB - SA > 3) { const nR = Math.max(3, Math.round((SB - SA) / 2.5)); for (let r = 0; r < nR; r++) {
                      const da = SA + (SB - SA) * r / nR, db = SA + (SB - SA) * (r + 1) / nR, ha = sk * (0.35 + 0.25 * Math.abs(Math.sin(r * 2.1 + k))), hb = sk * (0.35 + 0.25 * Math.abs(Math.sin((r + 1) * 2.1 + k))), mid = (S0 + S1) / 2;
                      const ea = r === 0 ? 0.05 : ha, eb = r === nR - 1 ? 0.05 : hb;
                      q4(cs.solid, V(da, S0, y), V(db, S0, y), V(db, mid, y + eb), V(da, mid, y + ea), soil);
                      q4(cs.solid, V(da, mid, y + ea), V(db, mid, y + eb), V(db, S1, y), V(da, S1, y), soilD); } }
                  // a pallet of kerbstones and a stack of concrete pipes near the barrier end
                  { const [x, z] = at(-(D0 + 1.2), (S0 + S1) / 2); cs.solid.box(x, y, z, 1.0, 0.14, 1.2, ang, rgb('#9a7b55'));
                    for (let r = 0; r < 3; r++) for (let j = -1; j <= 1; j++) { const sx = x + px * j * 0.3, sz = z + pz * j * 0.3; // kerbstones, 3 × 3, with gaps
                        cs.solid.box(sx, y + 0.14 + r * 0.27, sz, 1.0, 0.25, 0.26, ang, rgb((r + j) % 2 ? '#a9a69e' : '#bdbab2')); }
                    addPropColl(x, z, 0.75, 'closure'); }
                  // orange safety mesh on rods round the site: a top and a bottom band, a diamond weave between
                  const ORG = rgb('#ff6d1a'), ROD = rgb('#34363a'), H = 1.0;
                  const ring = [[D0, L0], [D1, L0], [D1, L1], [D0, L1]];
                  for (let q = 0; q < 4; q++) { const [da, la] = ring[q], [db, lb] = ring[(q + 1) % 4], len = Math.hypot(db - da, lb - la), n = Math.max(1, Math.round(len / 2));
                      for (let j = 0; j < n; j++) { const f0 = j / n, f1 = (j + 1) / n, dA = da + (db - da) * f0, lA = la + (lb - la) * f0, dB = da + (db - da) * f1, lB = la + (lb - la) * f1;
                          for (const yb of [0.12, H - 0.06]) q4(cs.detail, V(dA, lA, y + yb), V(dB, lB, y + yb), V(dB, lB, y + yb + 0.07), V(dA, lA, y + yb + 0.07), ORG);
                          const nw = 5; for (let w = 0; w < nw; w++) { const g0 = w / nw, g1 = (w + 1) / nw, pd = (g) => dA + (dB - dA) * g, pl = (g) => lA + (lB - lA) * g, yl = y + 0.15, yh = y + H - 0.02;
                              const st = (g, yy, h2, y2) => { const a2 = V(pd(g), pl(g), yy), b3 = V(pd(h2), pl(h2), y2), sx = 0.02; q4(cs.detail, a2, b3, [b3[0], b3[1] + sx * 1.5, b3[2]], [a2[0], a2[1] + sx * 1.5, a2[2]], ORG); };
                              st(g0, yl, g1, yh); st(g0, yh, g1, yl); }
                          const [rx, , rz] = V(dA, lA, 0); cs.detail.box(rx, y, rz, 0.035, H + 0.1, 0.035, 0, ROD); }
                      const [mx2, , mz2] = V((da + db) / 2, (la + lb) / 2, 0); addPropColl(mx2, mz2, 0.3, 'closure'); }
                  if (exc) { // a mini excavator at the far end of the trench, facing the barrier, its bucket down in the trench
                      const ex0 = D1 - 2.6, el = (L0 + L1) / 2 + 0.15, YEL = rgb('#f2b705'), DK = rgb('#26282b'), GL = rgb('#2c3a44');
                      const E3 = (f, l, yy) => V(ex0 - f, el + l, y + yy); // f: forward (toward the barrier), l: lateral
                      const B = (f, l, yy, wl, h, df, col) => { const [x, , z] = E3(f, l, 0); cs.solid.box(x, y + yy, z, df, h, wl, ang + Math.PI / 2, col); };
                      const beam = (A, Bp, w, col) => { const dx = Bp[0] - A[0], dy = Bp[1] - A[1], dz = Bp[2] - A[2], L = Math.hypot(dx, dy, dz);
                          let sx = -dz, sz = dx; const sl = Math.hypot(sx, sz) || 1; sx = sx / sl * w / 2; sz = sz / sl * w / 2; // side (horizontal) and up vectors
                          const ux2 = -(dy * dx) / L, uy2 = (dx * dx + dz * dz) / L, uz2 = -(dy * dz) / L, ul = Math.hypot(ux2, uy2, uz2) || 1, U = [ux2 / ul * w / 2, uy2 / ul * w / 2, uz2 / ul * w / 2];
                          const c4 = (p, a, b2) => [p[0] + a * sx + b2 * U[0], p[1] + b2 * U[1], p[2] + a * sz + b2 * U[2]];
                          for (const [a1, b1, a2, b2] of [[1, 1, -1, 1], [-1, -1, 1, -1], [1, -1, 1, 1], [-1, 1, -1, -1]]) q4(cs.solid, c4(A, a1, b1), c4(Bp, a1, b1), c4(Bp, a2, b2), c4(A, a2, b2), col); };
                      for (const sl of [-0.7, 0.7]) B(0, sl, 0, 0.42, 0.45, 2.4, DK);                       // tracks
                      B(0, 0, 0.3, 1.0, 0.3, 1.6, rgb('#3a3c40'));                                           // undercarriage
                      B(-0.15, 0, 0.6, 1.8, 0.75, 1.9, YEL);                                                 // upper house
                      B(-1.05, 0, 0.6, 1.7, 0.55, 0.3, DK);                                                  // counterweight
                      B(0.1, 0.45, 1.35, 0.85, 1.05, 0.95, GL); B(0.1, 0.45, 2.4, 0.95, 0.07, 1.05, YEL);    // cab (glass) + roof
                      const lt = (T0 + T1) / 2 - el, A0 = E3(0.85, lt, 1.1), A1 = E3(2.2, lt, 2.3), A2 = E3(3.2, lt, 0.55);
                      beam(A0, A1, 0.3, YEL); beam(A1, A2, 0.22, YEL); beam(A2, E3(3.05, lt, 0.05), 0.5, DK); // boom, arm, bucket
                      const [cx3, , cz3] = E3(0, 0, 0); addPropColl(cx3, cz3, 1.3, 'closure');
                  }
                  for (const [dd, ll] of ring) { const [x, , z] = V(dd + (dd === D0 ? -0.5 : 0.5), ll + (ll === L0 ? -0.45 : 0.45), 0); c.solid.geo(coneG, x, y, z, 0, 1, 1, 1, [255, 255, 255]); addPropColl(x, z, 0.22, 'closure'); }
              }
            }
            // the closing barrier line (RO red-white boards / US type III barricade: orange-white rails)
            const segs = Math.max(2, Math.round(half * 2 / 1.2)), cA = US ? orange : red;
            for (let j = 0; j < segs; j++) {
                const f = (j + 0.5) / segs - 0.5, [x, z] = at(0, f * half * 2);
                for (let r = 0; r < (US ? 3 : 2); r++) c.solid.box(x, y + 0.45 + r * 0.38, z, half * 2 / segs, 0.22, 0.08, ang + Math.PI / 2, (j + r) % 2 ? whiteB : cA);
            }
            for (let j = 0; j <= segs; j += Math.max(1, Math.floor(segs / 3))) { const [x, z] = at(0, (j / segs - 0.5) * half * 2); post(c, x, z, y, US ? 1.35 : 1.2);
                c.solid.box(x, y, z, 0.7, 0.07, 0.16, ang, dark); c.solid.box(x, y, z, 0.16, 0.12, 0.3, ang, dark); } // (a foot under every post)
            for (const sg of [-0.5, 0.5]) { const [x, z] = at(0, sg * half * 2); c.solid.box(x, y + (US ? 1.35 : 1.2), z, 0.16, 0.16, 0.12, ang, yellowM); } // warning lamps at the ends
            // cones / drums tapering across the lanes in front of it
            const nT = kind === 'small' ? 4 : 7;
            if (m.bundlePrimary) for (let j = 0; j < nT; j++) { const f = j / (nT - 1), [x, z] = at(3 + f * (kind === 'small' ? 5 : 14), (f - 0.5) * half * 1.6);
                discrete(c.solid, () => c.solid.geo(US && kind !== 'small' ? drumG : coneG, x, y, z, 0, 1, 1, 1, [255, 255, 255]), x, z, US ? .35 : .22); }
            if (kind !== 'small' && m.bundlePrimary) { // one arrow board per local street bundle
                for (let j = -1; j <= 1; j++) { const [x, z] = at(1.0, j * 2.05 - half * 0.35);
                    discrete(c.solid, () => c.solid.geo(jerseyG, x, y, z, ang, 1, 1, 1, [255, 255, 255]), x, z, 1.05, false); }
                wholePrimitive(() => {
                    const [bx, bz] = at(-0.6, half * 0.5); c.solid.box(bx, y, bz, 0.1, 1.2, 0.1, 0, postCol); c.solid.box(bx, y + 1.25, bz, 2.2, 1.1, 0.12, ang + Math.PI / 2, dark);
                    const ab = signs.get(US ? '<<<<' : '◄◄◄', '#141414', '#ffb300', null, true); if (ab) addSignQuad(c, bx, bz, face, 1, 2.0, 0.9, y + 1.8, ab, 0.08);
                });
            }
            // signs on the kerb
            const [sx, sz] = at(5, half + 0.7), [tx, tz] = at(9, -(half + 0.7)); // (on the kerb, just off the asphalt)
            if (US) {
                closureSign(c, sx, sz, y, face, 'ROAD CLOSED', '#ffffff', '#111111', null, 1.8);
                closureSign(c, tx, tz, y, face, kind === 'highway' ? 'RAMP CLOSED' : k % 2 ? 'LOCAL TRAFFIC ONLY' : 'DETOUR →', kind === 'highway' ? '#ff6a13' : k % 2 ? '#ffffff' : '#ff6a13', '#111111', null, 1.7);
                if (kind === 'highway') { const [hx, hz] = at(12, half + 0.7); closureSign(c, hx, hz, y, face, 'CLOSED FOR BRIDGE MAINTENANCE', '#ff6a13', '#111111', null, 2.6); }
            } else {
                closureSign(c, sx, sz, y, face, 'DRUM ÎNCHIS', '#ffffff', '#c62828', '#c62828', 1.6);
                closureSign(c, tx, tz, y, face, k % 2 ? 'DEVIERE →' : 'LUCRĂRI', '#f5c400', '#111111', null, 1.5);
            }
            // one character prop per closure (deterministic): excavator / police car (RO), flagger (US)
            const pick = (e.id * 7 + k) % 3;
            if (!US && kind !== 'highway' && pick === 0) { /* the excavator digs in the work site (above) */
            } else if (!US && kind !== 'small' && pick === 1 && m.bundlePrimary) { // one paired rendered/colliding car
                const [qx, qz] = at(6, half * 0.45);
                // (owner, 2026-11-11, Grozavesti (1030, -869): "car stuck") the car stands 6 m from the barrier: on a graded
                // road (a ramp foot) it takes the road height where it stands, not the barrier's, and sits level on a slope of
                // at most 3 % (steeper: no car, it would hang over the asphalt or sink into it)
                const dy = yAlong(e, qx, qz) - yAlong(e, m.x, m.z), slope = Math.abs(dy) / 6;
                if (slope <= 0.03) discrete(c.solid, () => { c.solid.geo(carProps('sedan', '#e8e8e8'), qx, y + dy - .12, qz, ang, 1, 1, 1, [255, 255, 255]);
                    c.solid.box(qx, y + dy + 1.5, qz, .9, .12, .25, ang, rgb('#1e5bff')); }, qx, qz, 1.9);
            } else if (US && pick !== 2 && m.bundlePrimary) { // flagger with a STOP paddle
                const [fx, fz] = at(7, half - 1.2), vest = rgb('#d7ff1f');
                if (boundarySupport.clearCircle(fx, fz, .85, { ownerEdges: m.ownerEdges, y0: y - .3, y1: y + 2.1 })) {
                c.solid.box(fx, y, fz, 0.35, 0.85, 0.25, ang, rgb('#2b3442')); c.solid.box(fx, y + 0.85, fz, 0.45, 0.65, 0.3, ang, vest); c.solid.box(fx, y + 1.5, fz, 0.22, 0.25, 0.22, ang, rgb('#b98a6a'));
                c.solid.box(fx, y + 1.78, fz, 0.32, 0.12, 0.32, ang, rgb('#f2f2f2')); post(c, fx + px * 0.35, fz + pz * 0.35, y + 0.6, 1.0);
                const st = signs.get('STOP', '#c62828', '#ffffff', null, true); if (st) addSignQuad(c, fx + px * 0.35, fz + pz * 0.35, face, 1, 0.5, 0.5, y + 1.85, st, 0.05);
                propColl.push({ x: fx, z: fz, r: .35, hw: .35, hd: .35, angle: 0, poly: null, prop: true, kind: 'closure', y, h: 2.1, top: y + 2.1, y0: y - .3, y1: y + 2.1, normalizedSourceBoundary: true });
                }
            }
            // which district this road heads toward (a later chapter's district → "opens in Chapter n")
            let leadsTo = null, best = Math.cos(45 * Math.PI / 180);
            for (const o of others) { const dx = o.x - m.x, dz = o.z - m.z, L = Math.hypot(dx, dz) || 1, cs = (-ix * dx - iz * dz) / L; if (cs > best) { best = cs; leadsTo = o.id; } }
            // roadworks crew spot (gameplay places the instanced worker there): behind the barrier on the closed asphalt, off the
            // driver's sight line to the kerb signs (the sign plate no longer sits in front of the worker's head — note 6)
            const [wx, wz] = at(-1.4, half * 0.7); // (between the barrier and the work-site mesh)
            const worker = m.bundlePrimary && boundarySupport.clearCircle(wx, wz, .6, { ownerEdges: m.ownerEdges, y0: y - .3, y1: y + 2 }) ? { x: wx, z: wz, y, yaw: Math.atan2(ix, iz) } : false;
            closures.push({ x: m.x, z: m.z, y, top: y + m.barrierHeight, heading: m.heading, edge: e, node: m.node, kind, leadsTo,
                l0: m.l0, l1: m.l1, half: m.half, bundleId: m.bundleId, bundlePrimary: m.bundlePrimary, worker });
            const now = closureBuilders(), startOf = (mb, k) => (now === startList ? startIc[k] : (k = startIndex.get(mb)) === undefined ? 0 : startIc[k]);
            for (let k = 0; k < now.length; k++) { const mb = now[k], s0 = startOf(mb, k); if (mb.ic > s0) boundarySupport.applyMesh(mb, s0, clipOptions); }
        });
    }
}
