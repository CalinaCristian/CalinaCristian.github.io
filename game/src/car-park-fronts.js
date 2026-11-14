// Reviewed street fronts of car parks that OSM maps only as a building:part inside a larger building (r3-look-7). The
// district pack has no building record for such a part, so car-parks.js cannot restyle it and the host building's facade
// (e.g. store glazing) is drawn there. A row below names the part's street face (two vertices of the OSM part, live OSM) and
// what the street-level review saw; the module draws that face over the host wall: a panelled wall, a vehicle entrance and
// its barrier arm. Panel width, entrance size and barrier are estimates; the level count is not visible and not drawn.
const CAR_PARK_FRONT_MODEL = { offsetM: 0.12, panelM: 3.0, entranceW: 4.8, entranceH: 3.2, estimates: ['offsetM', 'panelM', 'entranceW', 'entranceH', 'barrier'] };

const CAR_PARK_FRONTS = {
    'bucharest-unirii': [
        // Parcare Cocor w658281398 (amenity=parking, parking=multi-storey, building:part=yes, inside the Cocor store): official
        // panorama ky8lvOleKFvuiFVszKDv7Q (44.430274, 26.104834, heading 240) shows its street face as a dark grey panelled
        // wall with a vehicle entrance and a barrier; face = the part's north-east edge
        { id: 'w658281398', name: 'Parcare Cocor', face: [[44.4301812, 26.1048784], [44.4304824, 26.1044621]], centre: [44.43024, 26.10458], wall: '#4a4d52', joint: '#5d6166', review: 'ky8lvOleKFvuiFVszKDv7Q h240' },
    ],
};

/** env: { key, project(lat, lon) -> {x, z}, cellOf, rgb, topAt(x, z) -> host building top or null, baseY(x, z) } */
export function emitCarParkFronts(env) {
    const out = { placed: [], skipped: [] }, M = CAR_PARK_FRONT_MODEL;
    for (const f of CAR_PARK_FRONTS[env.key] || []) {
        const a = env.project(...f.face[0]), b = env.project(...f.face[1]), c = env.project(...f.centre);
        const L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 3) { out.skipped.push({ id: f.id, reason: 'short-face' }); continue; }
        const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L; let nx = -uz, nz = ux;
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2; if ((mx - c.x) * nx + (mz - c.z) * nz < 0) { nx = -nx; nz = -nz; } // outward: away from the part
        const top = env.topAt(mx - nx * 1.5, mz - nz * 1.5); if (!(top > 3)) { out.skipped.push({ id: f.id, reason: 'no-host-wall' }); continue; }
        const y0 = env.baseY(mx, mz), s = env.cellOf(mx, mz).solid, n = [nx, 0, nz];
        const P = (t, o, y) => [a.x + ux * t + nx * o, y, a.z + uz * t + nz * o];
        const quad = (t0, t1, ya, yb, o, col) => s.face4(P(t0, o, ya), P(t1, o, ya), P(t1, o, yb), P(t0, o, yb), env.rgb(col), n);
        const e0 = (L - M.entranceW) / 2, e1 = e0 + M.entranceW, yTop = y0 + top - 0.2;
        quad(0, e0, y0, yTop, M.offsetM, f.wall); quad(e1, L, y0, yTop, M.offsetM, f.wall); quad(e0, e1, y0 + M.entranceH, yTop, M.offsetM, f.wall);
        quad(e0, e1, y0, y0 + M.entranceH, M.offsetM - 0.05, '#17191b'); // the entrance opening (dark)
        for (let t = M.panelM; t < L - 0.2; t += M.panelM) if (t < e0 - 0.1 || t > e1 + 0.1) quad(t - 0.04, t + 0.04, y0, yTop, M.offsetM + 0.01, f.joint);
        for (let y = y0 + 3.4; y < yTop - 0.3; y += 3.4) { quad(0, e0, y - 0.04, y + 0.04, M.offsetM + 0.01, f.joint); quad(e1, L, y - 0.04, y + 0.04, M.offsetM + 0.01, f.joint); }
        // barrier: a post and a red / white arm across the entrance, just outside the wall
        const bp = P(e0 + 0.3, M.offsetM + 0.6, y0); s.box(bp[0], y0, bp[2], 0.25, 1.0, 0.25, Math.atan2(ux, uz), env.rgb('#d9d9d9'));
        for (let k = 0; k < 4; k++) { const q = P(e0 + 0.5 + (k + 0.5) * (M.entranceW - 0.8) / 4, M.offsetM + 0.6, y0); s.box(q[0], y0 + 0.92, q[2], 0.08, 0.08, (M.entranceW - 0.8) / 4, Math.atan2(ux, uz), env.rgb(k % 2 ? '#ffffff' : '#c62828')); }
        out.placed.push({ id: f.id, faceM: +L.toFixed(1), topM: +top.toFixed(1) });
    }
    return out;
}
