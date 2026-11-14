// Playgrounds mapped in OpenStreetMap as nodes (leisure=playground without an outline), which the district build drops
// (unirii-small). A playground node says only that there is a public playground at that point: what is drawn is a generic
// class set, a safety-surface patch with a swing frame and a slide, NOT the real equipment (none is mapped). Live OSM tags,
// checked 2026-11-13; every size is an estimate (PLAYGROUND_MODEL). Nothing is placed on a carriageway, inside a building or
// in water; such records are reported, never moved. Data © OpenStreetMap contributors (ODbL).
const PLAYGROUND_SOURCES = {
    unirii: [
        { id: 'n7958996084', lat: 44.424677, lon: 26.1032383, tags: 'leisure=playground, access=yes' },
        { id: 'n5766022623', lat: 44.4343301, lon: 26.1163682, tags: 'leisure=playground, access=yes' },
    ],
};

const PLAYGROUND_MODEL = { patchW: 9, patchD: 7, swingH: 2.4, slideH: 1.6, estimates: 'all dimensions and the equipment itself (class set)' };

/** env: { district, project(lat, lon) -> {x, z}, cellOf, rgb, blocked(x, z, r) -> reason | null, faceAngle(x, z), baseY(x, z), addCollider(x, z, r, h, rec) } */
export function emitPlaygrounds(env) {
    const out = { basis: 'OSM leisure=playground node; generic class set, estimated sizes', placed: [], skipped: [] };
    for (const s of PLAYGROUND_SOURCES[env.district] || []) {
        const { x, z } = env.project(s.lat, s.lon), rec = { id: s.id, x: +x.toFixed(1), z: +z.toFixed(1) };
        const why = env.blocked(x, z, 4); if (why) { out.skipped.push({ ...rec, reason: why }); continue; }
        build(env, x, z, env.faceAngle(x, z)); out.placed.push(rec);
    }
    return out;
}

function build(env, x, z, a) {
    const M = PLAYGROUND_MODEL, c = env.cellOf(x, z).solid, y = env.baseY(x, z), ca = Math.cos(a), sa = Math.sin(a);
    const at = (lx, lz) => [x + lx * ca + lz * sa, z - lx * sa + lz * ca]; // local x across, z along (box rot a turns local z to (sin a, cos a))
    const box = (lx, lz, y0, w, h, d, col) => { const [px, pz] = at(lx, lz); c.box(px, y + y0, pz, w, h, d, a, env.rgb(col)); };
    box(0, 0, 0, M.patchW, 0.04, M.patchD, '#b5523b'); // safety surface (rubber)
    // swing frame: two A-legs, a top beam, two seats
    for (const lx of [-3.6, -0.4]) for (const s of [-0.45, 0.45]) box(lx, s, 0, 0.1, M.swingH, 0.1, '#3f6fa8');
    box(-2.0, 0, M.swingH - 0.1, 3.4, 0.12, 0.12, '#3f6fa8');
    for (const lx of [-2.8, -1.2]) { box(lx, 0, 0.45, 0.45, 0.05, 0.2, '#222222'); for (const s of [-0.2, 0.2]) box(lx + s, 0, 0.5, 0.02, M.swingH - 0.62, 0.02, '#888888'); }
    // slide: deck on four posts, a ladder side and a sloped run built from steps of thin boxes
    for (const [lx, lz] of [[1.6, -0.5], [2.6, -0.5], [1.6, 0.5], [2.6, 0.5]]) box(lx, lz, 0, 0.1, M.slideH + 0.9, 0.1, '#d9a21b');
    box(2.1, 0, M.slideH, 1.1, 0.08, 1.1, '#d9a21b');
    for (let i = 1; i <= 5; i++) box(2.66, 0, (M.slideH / 5) * i - 0.04, 0.06, 0.04, 0.9, '#555555'); // ladder rungs between the two back posts
    for (let i = 0; i < 8; i++) box(2.1, 0.6 + i * 0.32, M.slideH * (1 - (i + 1) / 8), 0.6, 0.06, 0.34, '#2e8b57');
    env.addCollider(at(-2, 0)[0], at(-2, 0)[1], 2.0, M.swingH, { id: 'playground' }); env.addCollider(at(2.1, 1)[0], at(2.1, 1)[1], 1.6, M.slideH, { id: 'playground' });
}
