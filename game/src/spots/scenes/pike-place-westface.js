// ============================================================================
//  Pike Place Market — the market's west walls over Western Ave (round 3, r2-sea-spots-b-3 / r3-sea-spots-3).
//  Official panorama iFZRr4o9WP2yFdlbuLUkeQ (Western Ave, 47.60878,-122.34155, viewed 2026-11-13, nothing stored)
//  looking 60°: white-painted walls with rows of wide red-framed industrial windows (multi-pane steel sash), several
//  storeys down the bluff; looking 300°: the same white wall and windows north to the SkyBridge. They were drawn with the
//  generic apartment tile. The tile keeps the apartment tile's bay / floor so the existing wall UVs line up; window
//  proportions, pane counts and the red are judged from that panorama.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { rng, canvas, canvasTexture, GeoBatch } from '../kit.js';
import { facadeStyle } from '../osm.js';
import { signBoard } from '../props.js';

let MAT = null;
export function marketWestMaterial() {
    if (MAT) return MAT;
    const T = 256, C = T / 4, c = canvas(T, T), g = c.getContext('2d'), e = canvas(T, T), ge = e.getContext('2d'), r = rng(1907);
    g.fillStyle = '#f2efe6'; g.fillRect(0, 0, T, T); ge.fillStyle = '#000'; ge.fillRect(0, 0, T, T);
    for (let fy = 0; fy < 4; fy++) {
        const y0 = (3 - fy) * C; g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(0, y0 + C - 3, T, 3); // floor line
        for (let fx = 0; fx < 4; fx++) {
            const x0 = fx * C, wx = x0 + C * 0.07, ww = C * 0.86, wy = y0 + C * 0.2, wh = C * 0.62;
            g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(wx - 1, wy - 1, ww + 3, wh + 3);
            g.fillStyle = '#2a3036'; g.fillRect(wx, wy, ww, wh);
            g.fillStyle = 'rgba(190,205,215,0.18)'; g.fillRect(wx + 2, wy + 2, ww * 0.4, wh * 0.45);
            g.fillStyle = '#a8382d'; g.lineWidth = 1; // red steel sash: frame + 5 × 3 panes
            g.fillRect(wx, wy, ww, 2.5); g.fillRect(wx, wy + wh - 2.5, ww, 2.5); g.fillRect(wx, wy, 2.5, wh); g.fillRect(wx + ww - 2.5, wy, 2.5, wh);
            for (let k = 1; k < 5; k++) g.fillRect(wx + ww * k / 5 - 0.75, wy, 1.5, wh);
            for (let k = 1; k < 3; k++) g.fillRect(wx, wy + wh * k / 3 - 0.75, ww, 1.5);
            g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(wx - 2, wy + wh + 1, ww + 4, 2); // sill
            if (r() < 0.4) { ge.fillStyle = `rgb(255,${200 + r() * 35},${135 + r() * 40})`; ge.fillRect(wx + 3, wy + 3, ww - 6, wh - 6); }
        }
    }
    const S = facadeStyle('apartment');
    const m = new THREE.MeshStandardMaterial({ map: canvasTexture(c, { repeat: true }), emissiveMap: canvasTexture(e, { repeat: true }), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
    m.name = 'pike-market-west'; m.userData.shared = true; m.userData.nightWindows = true; m.userData.style = S;
    MAT = m; return m;
}
/** the wall colour that goes with the tile (vertex colour: near white, the tile carries the cream) */
export const MARKET_WEST_TINT = '#ffffff';

// ---------------------------------------------------------------------------- (r3-sea-spots-b-5) Western Ave dressing
// The dossier's panorama notes (seattle-spots.md "Pike Place Market") list, on the market's west face over Western Ave, a
// street-level colonnade and "Pike Place Market" lettering, and on the avenue's west side a low pink-stucco building with
// a parking sign and a cream three-storey block, without saying which mapped volumes those are. Assignments (estimates):
// the low pink building is the Market Heritage Center (w231359028, the small block next to the garage north of the
// SkyBridge), the cream three-storey block the Fix Building (w231359020, south of the garage); the garage (w184870422)
// keeps its parking front. Market Place North (tan with ribbon windows) is not a name in OSM: the two "Market Place"
// buildings of the mapped complex north of the market (landuse "Market Place" w403552339) take that look — Market Place
// One (w231355701) and Two (w231355696). Colours, storey heights and the window band are estimates.
export const WEST_SIDE_LOOKS = {
    w231359028: { c: '#d8a598', lv: 1, h: 4.6, style: 'concrete' }, // Market Heritage Center: low pink stucco (PARKING sign: westSideSigns)
    w231359020: { c: '#e6dcc4', lv: 3, h: 11.1, style: 'concrete' }, // Fix Building: cream, three storeys
    w231355696: { c: '#c8b08a', style: 'concrete' },                 // Market Place Two: tan, ribbon windows
    w231355701: { c: '#c8b08a', style: 'concrete' },                 // Market Place One
};
/** before ctx.osmBackdrop(): colours / storeys of the west-side blocks; returns the style hook for their ids */
export function prepareWestSide(ctx) {
    for (const b of ctx.data.buildings) { const L = WEST_SIDE_LOOKS[b.id]; if (!L) continue; b.c = L.c; if (L.h) { b.h = L.h; b.lv = L.lv; } }
    return (b) => WEST_SIDE_LOOKS[b.id]?.style;
}

const COLONNADE_HOSTS = ['w1271653801', 'w1271653800', 'w231357660']; // the Main Arcade / Leland Hotel volumes over Western Ave
/**
 * after the halls: a colonnade at Western Ave level along the market's west walls (square white piers 1.6 m out from the
 * wall every ≈ 4.5 m, a beam and soffit at 4.4 m) and PIKE PLACE MARKET in red letters on the white wall above it.
 * W = profile(SURVEY.western). Pier size, spacing, depth, height and the letters' size / place are estimates.
 */
export function westFaceDressing(ctx, W) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch(), white = '#efebe1', faces = [], placed = []; let piers = 0;
    for (const id of COLONNADE_HOSTS) { const bd = d.buildings.find((q) => q.id === id); if (!bd) continue; const P = bd.poly, n = P.length;
        const A = P.reduce((s, p, i) => s + p[0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * p[1], 0) > 0 ? 1 : -1;
        for (let i = 0; i < n; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % n], L = Math.hypot(bx - ax, bz - az); if (L < 6) continue;
            const nx = A * (bz - az) / L, nz = -A * (bx - ax) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2, r = W.at(mx, mz);
            if (r.d > 16 || ((r.cx - mx) * nx + (r.cz - mz) * nz) / (r.d || 1) < 0.7) continue; // edges facing the avenue
            faces.push({ ax, az, bx, bz, L, nx, nz, mx, mz });
            const dx = (bx - ax) / L, dz = (bz - az) / L, cnt = Math.max(1, Math.round((L - 1.5) / 4.5)), off = 1.6, H = 4.4, yaw = Math.atan2(dx, dz);
            const yA = W.at(ax, az).y, yB = W.at(bx, bz).y;
            for (let k = 0; k <= cnt; k++) { const t = 0.75 + (L - 1.5) * k / cnt, x = ax + dx * t + nx * off, z = az + dz * t + nz * off, y = g.heightAt(x, z), top = yA + (yB - yA) * t / L + H;
                if (!placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.5)) { b.box(x, y - 0.3, z, 0.7, top - y + 0.3, 0.7, white, 'concrete', yaw); ctx.circle(x, z, 0.4, top - y); placed.push([x, z]); piers++; }
                // beam over the piers and the soffit back to the wall, one bay at a time (they step down with the avenue)
                if (k < cnt) { const t1 = 0.75 + (L - 1.5) * (k + 1) / cnt, tm = (t + t1) / 2, ym = yA + (yB - yA) * tm / L + H, bl = t1 - t, cx = ax + dx * tm, cz = az + dz * tm, sd = off - 0.425, sc = 0.05 + sd / 2;
                    b.box(cx + nx * off, ym, cz + nz * off, 0.75, 0.7, bl, white, 'concrete', yaw); // (box depth runs along the wall: yaw turns local z onto it)
                    b.box(cx + nx * sc, ym + 0.05, cz + nz * sc, sd, 0.16, bl - 0.02, '#d2cdc2', 'concrete', yaw); } } } }
    if (!faces.length) return null;
    ctx.add(b.build('pike-west-colonnade'));
    // the lettering on the longest face, centred, above the colonnade
    const f = faces.reduce((a, c) => (c.L > a.L ? c : a)), y = W.at(f.mx, f.mz).y + 7.2, w = Math.min(18, f.L * 0.6);
    const sg = signBoard('PIKE PLACE MARKET', w, 1.5, { bg: '#f2efe6', fg: '#b3261e', font: (s) => `800 ${s}px Georgia, "Times New Roman", serif`, frame: '#f2efe6', depth: 0.06 });
    sg.position.set(f.mx + f.nx * 0.06, y, f.mz + f.nz * 0.06); sg.rotation.y = Math.atan2(f.nx, f.nz); ctx.add(sg);
    return { faces: faces.length, piers, lettering: [+f.mx.toFixed(1), +f.mz.toFixed(1), +y.toFixed(1)] };
}

/** after ctx.osmBackdrop(): the PARKING sign on the Market Heritage Center's avenue face */
export function westSideSigns(ctx, W) {
    const bd = ctx.data.buildings.find((q) => q.id === 'w231359028'); if (!bd) return null;
    const P = bd.poly, n = P.length, A = P.reduce((s, p, i) => s + p[0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * p[1], 0) > 0 ? 1 : -1; let best = null;
    for (let i = 0; i < n; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % n], L = Math.hypot(bx - ax, bz - az); if (L < 3) continue; const nx = A * (bz - az) / L, nz = -A * (bx - ax) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2, r = W.at(mx, mz);
        const s = ((r.cx - mx) * nx + (r.cz - mz) * nz) / (r.d || 1) - r.d / 100; if (!best || s > best.s) best = { s, mx, mz, nx, nz, L }; }
    if (!best) return null;
    const sg = signBoard('PARKING', Math.min(4.5, best.L * 0.6), 0.9, { bg: '#1f3f73', fg: '#ffffff', font: (s) => `800 ${s}px Arial, sans-serif`, depth: 0.08 });
    sg.position.set(best.mx + best.nx * 0.08, ctx.ground.heightAt(best.mx + best.nx, best.mz + best.nz) + 3.4, best.mz + best.nz * 0.08); sg.rotation.y = Math.atan2(best.nx, best.nz); ctx.add(sg);
    return { at: [+best.mx.toFixed(1), +best.mz.toFixed(1)] };
}
