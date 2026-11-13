// Coloured fascia bands and corner fronts that a street-level review saw on a building drawn in one colour (a building
// record carries one wall colour). Geometry stands a few centimetres proud of the mapped outline (OSM) at the reviewed
// building's own height; colours and the facts come from the panoramas named in each record (viewed only, nothing kept).
// Band depth and front widths are estimates. Data © OpenStreetMap contributors (ODbL).
export const FACADE_BANDS = [
    // (backlog r3-landmarks-2) Brico Dépôt / Altex, Calea Giulești 1-3: panoramas 44.447216, 26.061955 h 0 and 44.448422,
    // 26.062576 h 270 show a red fascia band round the top of the light-grey panel box and a red Altex front at the
    // south-east corner, where OSM maps the Altex POI (44.448203, 26.062284)
    { district: 'grozavesti', id: 'w247015071', name: 'Brico Dépôt / Altex',
        fascia: { colour: '#c41e24', belowTopM: 0.4, heightM: 1.5 },
        corner: { colour: '#d0202a', at: [44.448203, 26.062284], widthM: 16, fromM: 4.2 } }, // (from the top of the drawn shopfront glazing)
];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
/** env: { district, building(id) -> { ring, h } | null, project(lat, lon) -> { x, z }, cellOf, rgb } */
export function emitFacadeBands(env) {
    const out = [];
    for (const r of FACADE_BANDS) {
        if (r.district !== env.district) continue;
        const b = env.building(r.id); if (!b?.ring?.length) { out.push({ id: r.id, missing: true }); continue; }
        const R = b.ring, n = R.length, h = b.h; let sa = 0;
        for (let k = 0; k < n; k++) { const [ax, az] = R[k], [bx, bz] = R[(k + 1) % n]; sa += ax * bz - bx * az; }
        const ccw = sa > 0, cx = R.reduce((s, p) => s + p[0], 0) / n, cz = R.reduce((s, p) => s + p[1], 0) / n;
        const mb = env.cellOf(cx, cz).solid, rec = { id: r.id, fasciaM: 0, cornerM: 0 };
        const nrm = (a, c) => { const d = sub(c, a), L = Math.hypot(d[0], d[1]) || 1; let nx = d[1] / L, nz = -d[0] / L; if (!ccw) { nx = -nx; nz = -nz; } return [nx, nz, L]; };
        const panel = (a, c, y0, y1, off, col) => { const [nx, nz] = nrm(a, c); mb.face4([a[0] + nx * off, y0, a[1] + nz * off], [c[0] + nx * off, y0, c[1] + nz * off], [c[0] + nx * off, y1, c[1] + nz * off], [a[0] + nx * off, y1, a[1] + nz * off], col, [nx, 0, nz]); };
        if (r.fascia) {
            const col = env.rgb(r.fascia.colour), y1 = h - r.fascia.belowTopM, y0 = y1 - r.fascia.heightM;
            for (let k = 0; k < n; k++) { const a = R[k], c = R[(k + 1) % n], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.3) continue; panel(a, c, y0, y1, 0.08, col); rec.fasciaM += L; }
        }
        if (r.corner) {
            const p = env.project(r.corner.at[0], r.corner.at[1]), col = env.rgb(r.corner.colour), W = r.corner.widthM;
            // the building corner nearest the POI: a ring vertex whose two walls are both at least 8 m long (not a jog)
            const len = (i, j) => Math.hypot(R[j][0] - R[i][0], R[j][1] - R[i][1]);
            let kc = 0, bd = Infinity; for (let k = 0; k < n; k++) { if (len(k, (k + 1) % n) < 8 || len((k - 1 + n) % n, k) < 8) continue; const d = Math.hypot(R[k][0] - p.x, R[k][1] - p.z); if (d < bd) { bd = d; kc = k; } }
            const v = R[kc];
            for (const nb of [R[(kc + 1) % n], R[(kc - 1 + n) % n]]) { // the corner's two walls, W metres from the corner each
                const L = Math.hypot(nb[0] - v[0], nb[1] - v[1]); if (L < 0.3) continue; const t = Math.min(1, W / L), e = [v[0] + (nb[0] - v[0]) * t, v[1] + (nb[1] - v[1]) * t];
                const fwd = nb === R[(kc + 1) % n]; panel(fwd ? v : e, fwd ? e : v, r.corner.fromM ?? 0.2, h - 0.05, 0.12, col); rec.cornerM += L * t;
            }
            rec.cornerFromPoiM = +bd.toFixed(1);
        }
        rec.fasciaM = Math.round(rec.fasciaM); rec.cornerM = Math.round(rec.cornerM); out.push(rec);
    }
    return out;
}
