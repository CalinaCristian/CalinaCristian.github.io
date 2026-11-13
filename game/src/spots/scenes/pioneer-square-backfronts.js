// ============================================================================
//  Pioneer Square — the fronts behind the walk area, Smith Tower's storefront base and Merchant's Cafe's sign board
//  (r3-sea-spots-b-1). No panorama of these was recorded (the 2026-11-13 sessions could not open Street View), so they
//  are drawn from OSM (live API 0.6, 2026-11-13) and the district's recorded character (seattle-spots.md "Pioneer Square":
//  red-brown brick fronts, dark storefront bases, light window frames, brick cornices):
//  - FRONTS_OSM: the mapped fronts on 2nd Ave, Yesler Way east of Occidental and S Washington St east, in the same
//    facade system as FRONTS (pioneer-square-fronts.js). From OSM: storeys (building:levels), building:colour (#85552e,
//    neo-romanesque brick, start_date 1890 on the S Washington St pair), building:architecture neo-romanesque (round
//    arches), start dates (1890–1928). Wall colours where OSM has none, arch patterns, bases and cornices are estimates.
//  - Smith Tower (w52781661, 506 2nd Avenue): a two-storey granite base with storefront glazing on its street faces, a
//    cornice band over it and the entrance canopy on the 2nd Ave face (its address street). Heights, bay widths, the
//    granite and bronze colours are estimates.
//  - Merchant's Cafe and Saloon (w52782171, 109 Yesler Way, amenity=pub): its own name board over the storefront on the
//    Yesler Way face, gold letters on the storefront's dark green (FRONTS: shop #24402f). Size and lettering are estimates.
// ============================================================================
import { GeoBatch, inPoly } from '../kit.js';
import { signBoard } from '../props.js';

const T = '#e7e2d6', OSM_SRC = 'OSM tags (no panorama)';
export const FRONTS_OSM = {
    w226321135: { name: '(S Washington St, 1890)', mat: 'brick', osmColour: true, base: '#3a3634', shop: '#2c4636', arch: ['gf'], cornice: '#6a4636', frame: T, src: OSM_SRC },
    w439990240: { name: '(S Washington St, 1890)', mat: 'brick', osmColour: true, base: '#3a3634', shop: '#3b2f2a', arch: ['gf'], cornice: '#6a4636', frame: T, src: OSM_SRC },
    w439990242: { name: '(S Washington St, 1890)', mat: 'brick', wall: '#8c4535', base: '#3a3634', shop: '#3b2f2a', cornice: '#6e3a2c', frame: T, src: OSM_SRC },
    w439990247: { name: '(S Washington St, 1895, one storey)', mat: 'brick', wall: '#94503c', base: '#94503c', shop: '#2d3b47', cornice: '#6e3a2c', frame: T, src: OSM_SRC },
    w226321143: { name: "McCoy's Firehouse BBQ", mat: 'brick', wall: '#8e4434', base: '#8e4434', shop: '#5a1f1a', arch: ['gf'], cornice: '#6e3a2c', frame: T, src: OSM_SRC },
    w226321144: { name: '(Yesler Way, 1893)', mat: 'brick', wall: '#a2523e', base: '#3a3634', shop: '#3a3634', arch: ['top'], pair: true, cornice: '#7a4434', frame: T, src: OSM_SRC },
    w226321732: { name: 'Collins Building', mat: 'brick', wall: '#8b4232', base: '#9a917f', baseFl: 1, shop: '#1f3a2c', arch: ['top'], pair: true, cornice: '#6e3a2c', frame: T, src: OSM_SRC },
    w910445794: { name: 'Florence Building', mat: 'brick', wall: '#9a5a44', base: '#3a3634', shop: '#2a2c2e', cornice: '#7a4434', frame: T, src: OSM_SRC },
    w226323029: { name: 'Monterey Lofts', mat: 'brick', wall: '#7d4c3d', base: '#3a3634', shop: '#2f3b36', cornice: '#6b5a4a', frame: T, src: OSM_SRC },
    w226323030: { name: 'Chin Gee Hee Building', mat: 'brick', wall: '#8c4535', base: '#9a917f', baseFl: 1, shop: '#7a2a22', arch: ['top'], cornice: '#6e3a2c', frame: T, src: OSM_SRC },
    w439990263: { name: 'Apex Building', mat: 'brick', wall: '#a8806a', base: '#8f8a80', baseFl: 1, shop: '#2a2c2e', cornice: '#9a8a76', frame: '#3c3f40', src: OSM_SRC },
    w226323020: { name: 'Frye Apartments', mat: 'brick', wall: '#9a5040', base: '#8f8a80', baseFl: 1, shop: '#2a2c2e', pair: true, cornice: '#7a4434', frame: T, src: OSM_SRC },
};

const streetFaces = (ctx, bd) => { const P = bd.poly, n = P.length, others = ctx.data.buildings.filter((q) => q.id !== bd.id && q.k !== 'roof' && q.poly?.length > 2 && !q.part), out = [];
    for (let i = 0; i < n; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % n], L = Math.hypot(bx - ax, bz - az); if (L < 4) continue;
        let nx = (bz - az) / L, nz = -(bx - ax) / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (inPoly(mx + nx * 0.3, mz + nz * 0.3, P)) { nx = -nx; nz = -nz; }
        if (others.some((q) => inPoly(mx + nx * 1.2, mz + nz * 1.2, q.poly))) continue; out.push({ ax, az, bx, bz, L, nx, nz, mx, mz, dx: (bx - ax) / L, dz: (bz - az) / L, yaw: Math.atan2(nx, nz) }); }
    return out; };

/** Smith Tower's storefront base over the landmark model; y0 = its base level */
export function smithTowerBase(ctx, y0) {
    const bd = ctx.data.buildings.find((q) => q.id === 'w52781661'); if (!bd) return null;
    const b = new GeoBatch(), faces = streetFaces(ctx, bd), BASE = 7.6, GRANITE = '#8e8a84', BRONZE = '#5a4a32'; let bays = 0;
    const second = (() => { const w = ctx.data.ways.filter((q) => /^2nd Avenue$/.test(q.name || '')); let best = null; for (const f of faces) { let d = 1e9; for (const q of w) for (const p of q.pts) d = Math.min(d, Math.hypot(p[0] - f.mx, p[1] - f.mz)); if (!best || d < best.d) best = { f, d }; } return best?.f; })();
    for (const f of faces) {
        const o = 0.22, at = (t, k) => [f.ax + f.dx * t + f.nx * k, f.az + f.dz * t + f.nz * k];
        { const p = at(f.L / 2, o / 2); b.box(p[0], y0, p[1], f.L + 0.3, BASE, o, GRANITE, 'stone', f.yaw); }        // granite facing
        { const p = at(f.L / 2, o + 0.15); b.box(p[0], y0 + BASE, p[1], f.L + 0.6, 0.55, 0.3, '#d9d6cf', 'stone', f.yaw); } // cornice band (terracotta)
        const n = Math.max(1, Math.round(f.L / 4.2)), w = f.L / n;
        for (let k = 0; k < n; k++) { const t = (k + 0.5) * w, p = at(t, o + 0.03), q = at(t, o + 0.03);
            b.box(p[0], y0 + 0.5, p[1], w - 0.9, 3.4, 0.06, '#1f272d', 'darkglass', f.yaw);                              // storefront
            b.box(q[0], y0 + 4.6, q[1], w - 1.2, 2.2, 0.06, '#2a323a', 'darkglass', f.yaw); bays++; }                  // mezzanine window
        if (f === second) { const p = at(f.L / 2, o + 0.85); b.box(p[0], y0 + 4.1, p[1], 5.2, 0.35, 1.6, BRONZE, 'metal', f.yaw); // entrance canopy
            const sg = signBoard('SMITH TOWER', 3.4, 0.5, { bg: BRONZE, fg: '#e8d9a8', font: (s) => `700 ${s}px Georgia, serif`, frame: BRONZE, depth: 0.06 }); const s2 = at(f.L / 2, o + 1.66); sg.position.set(s2[0], y0 + 4.27, s2[1]); sg.rotation.y = f.yaw; ctx.add(sg); }
    }
    ctx.add(b.build('smith-tower-base'));
    return { faces: faces.length, bays, entranceFace: second ? [+second.mx.toFixed(1), +second.mz.toFixed(1)] : null };
}

/** Merchant's Cafe's own name board on its Yesler Way face */
export function merchantsCafeSign(ctx) {
    const bd = ctx.data.buildings.find((q) => q.id === 'w52782171'); if (!bd) return null;
    const yes = ctx.data.ways.filter((q) => /^Yesler Way$/.test(q.name || '')), faces = streetFaces(ctx, bd); let best = null;
    for (const f of faces) { let d = 1e9; for (const q of yes) for (const p of q.pts) d = Math.min(d, Math.hypot(p[0] - f.mx, p[1] - f.mz)); if (!best || d < best.d) best = { f, d }; }
    if (!best) return null; const f = best.f, y = Math.min(...bd.poly.map(([x, z]) => ctx.ground.heightAt(x, z)));
    const sg = signBoard("MERCHANT'S CAFE & SALOON", Math.min(7.5, f.L * 0.8), 0.85, { bg: '#24402f', fg: '#e3c46a', font: (s) => `700 ${s}px Georgia, "Times New Roman", serif`, frame: '#1a2e22', depth: 0.1 });
    sg.position.set(f.mx + f.nx * 0.12, y + 4.15, f.mz + f.nz * 0.12); sg.rotation.y = f.yaw; ctx.add(sg);
    return { at: [+f.mx.toFixed(1), +f.mz.toFixed(1)] };
}
