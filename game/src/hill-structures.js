// The mapped retaining walls and stair flights of a hill the flat district cannot lift (backlog unirii-small).
// Data © OpenStreetMap contributors (ODbL); levels: EU-DEM v1.1 (Copernicus) via OpenTopoData, sampled 2026-11-13.
//
// Dealul Mitropoliei (natural=peak n9680128587) carries the Patriarchal Cathedral w232296927, the Patriarchal Palace, the
// bell tower w381822404, the driveways of Strada Patriarhiei (one of them in a short tunnel, w1458826486) and the houses
// of Aleea Dealul Mitropoliei on its slopes. EU-DEM puts the plateau at 79–81.5 m and the streets at its foot at 71–75 m
// (Antim Ivireanu 71.2, Bd. Unirii by the square 72.5, the south foot 73–76); the dossier's "about 15 m" is the hill's
// usual quoted height. A raised landform would have to lift the cathedral, the palace, the bell tower, both driveways and
// the aleea with its houses, and every park tree and path on the slopes; the hilltop also lies outside the playable edge.
// So the hill itself is not drawn. What OSM maps of its built relief is: the switchback stair on the south-east flank
// (steps w1053336775 / w1053336776 / w1053336783 between the retaining walls w1053336778–w1053336782) and the flight
// w677291288 (incline=up) below the bell tower. The district's ground stands for the plateau here (the cathedral and the
// palace sit on it), so they are drawn as seen from the top of the hill, at their mapped positions: each retaining wall
// shows its parapet (0.9 m above the upper side, a stone coping) and each stair is a paved strip with its treads marked,
// at the plateau's level; the drop to the street below cannot be drawn on flat ground. Built as rising blocks they read
// as walls and stairs to nowhere (render 2026-11-13). Parapet height, flight width and materials are estimates. The steps
// w1219309567 by the Faculty of Theology are left out: no incline tag, and the plateau is equally far from both ends.
export const HILL_STRUCTURES = {
    unirii: {
        id: 'dealul-mitropoliei', wallH: 0.9, flightW: 2.0,
        walls: {
            w1053336778: [[44.4243554, 26.0983511], [44.4243503, 26.0983907], [44.4243281, 26.0984061], [44.4243447, 26.0984556], [44.4242822, 26.0984984], [44.4243189, 26.0986034], [44.4242338, 26.0986606]],
            w1053336779: [[44.424258, 26.0987354], [44.4243447, 26.0986817], [44.4243831, 26.0987821], [44.4244473, 26.0987389], [44.4244606, 26.0987762], [44.4244957, 26.0987552], [44.4245157, 26.0987996], [44.4245499, 26.0987739]],
            w1053336780: [[44.4243447, 26.0984556], [44.4243789, 26.0985544], [44.424415, 26.0985294]],
            w1053336781: [[44.4244439, 26.0986066], [44.4244081, 26.0986315], [44.4244473, 26.0987389]],
            w1053336782: [[44.4243281, 26.0985194], [44.4243998, 26.0987178]],
        },
        steps: {
            w1053336775: [[44.4242019, 26.0987317], [44.4242306, 26.0987117], [44.4243488, 26.098632], [44.4243052, 26.098505], [44.4243377, 26.0984826], [44.4243821, 26.0986058], [44.4244319, 26.0985716]],
            w1053336776: [[44.4243488, 26.098632], [44.4243902, 26.0987515], [44.4244258, 26.0987277], [44.4244006, 26.0986573], [44.4243821, 26.0986058]],
            w1053336783: [[44.424201, 26.0986207], [44.4242306, 26.0987117], [44.4242583, 26.0988005]],
            w677291288: [[44.4244792, 26.0990432], [44.4246382, 26.0988917]],
        },
    },
};
export const HILL_STRUCTURE_MODEL = { wallT: 0.4, capT: 0.08, capOver: 0.05, tread: 0.32, stripH: 0.05, nosing: 0.04, stone: '#a39a8a', cap: '#bdb5a6', step: '#b1aa9c', nose: '#8d877b' };

/** env: { district, proj(lat, lon) -> {x, z}, cellOf, rgb, blocked(x, z, r) -> reason | null, addCollider(x, z, hw, hd, angle, h, kind, id) } */
export function emitHillStructures(env) {
    const H = HILL_STRUCTURES[env.district]; if (!H) return null;
    const M = HILL_STRUCTURE_MODEL, rec = { id: H.id, wallsM: 0, flights: 0, treads: 0, skipped: [] };
    const stone = env.rgb(M.stone), capC = env.rgb(M.cap), stepC = env.rgb(M.step), noseC = env.rgb(M.nose);
    for (const [id, line] of Object.entries(H.walls)) {
        const pts = line.map(([la, lo]) => env.proj(la, lo));
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 0.2) continue;
            const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, rot = Math.atan2(b.x - a.x, b.z - a.z);
            const why = env.blocked(mx, mz, M.wallT); if (why) { rec.skipped.push({ id, why }); continue; }
            const c = env.cellOf(mx, mz).solid;
            c.box(mx, -0.05, mz, M.wallT, H.wallH - M.capT + 0.05, L + M.wallT * 0.5, rot, stone); // (+ half a thickness: the corners close)
            c.box(mx, H.wallH - M.capT, mz, M.wallT + M.capOver * 2, M.capT, L + M.wallT * 0.5 + 0.02, rot, capC);
            env.addCollider(mx, mz, M.wallT / 2, L / 2, rot, H.wallH, 'retaining-wall', id);
            rec.wallsM += L;
        }
    }
    for (const [id, line] of Object.entries(H.steps)) {
        const pts = line.map(([la, lo]) => env.proj(la, lo)); let drawn = false;
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 0.1) continue;
            const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L, rot = Math.atan2(ux, uz), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
            const why = env.blocked(mx, mz, H.flightW / 2); if (why) { rec.skipped.push({ id, why }); continue; }
            const c = env.cellOf(mx, mz).solid;
            c.box(mx, 0, mz, H.flightW, M.stripH, L, rot, stepC); // the paved flight at the plateau's level
            for (let t = M.tread; t < L - 0.05; t += M.tread) { c.box(a.x + ux * t, M.stripH, a.z + uz * t, H.flightW - 0.1, 0.012, M.nosing, rot, noseC); rec.treads++; } // tread nosings
            drawn = true;
        }
        if (drawn) rec.flights++;
    }
    rec.wallsM = Math.round(rec.wallsM);
    return rec;
}
