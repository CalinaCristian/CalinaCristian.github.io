import fs from 'node:fs';
import { roadMiter } from '../src/road-joins.js';
const fixture = JSON.parse(fs.readFileSync(new URL('../../handoffs/fidelity/unirii-true-down-surface/native-roof-fixture.json', import.meta.url)));
const nodes = new Map(), edges = fixture.edges.map(source => {
    const e = { ...source };
    for (const end of ['a', 'b']) {
        const n = e[end]; if (!nodes.has(n.id)) nodes.set(n.id, { ...n, edges: [] });
        e[end] = nodes.get(n.id);
    }
    return e;
});
for (const e of edges) { e.a.edges.push(e); e.b.edges.push(e); }
const nativeWidth = (e, s) => (s > 0 ? e.wR : e.wL) + (e.roadWidthSource?.source === 'OSM width' || e.roadWidthSource?.review ? 0 : .15) + (s > 0 ? e.sidewalkRightM : e.sidewalkLeftM);
// Literal native endpoint construction, including original pads/retraction.
function corner(e, n, side, w, otherWidth) {
    const out = e.a === n ? 1 : -1, r = n.pad && n.edges.length >= 2 ? Math.min(n.radius, e.len * .45) : 0;
    const px = n.x + e.dirx * out * r + e.nx * side * w, pz = n.z + e.dirz * out * r + e.nz * side * w;
    if (n.pad || n.edges.length !== 2) return [px, pz];
    const f = n.edges[0] === e ? n.edges[1] : n.edges[0], same = (e.b === n && f.a === n) || (e.a === n && f.b === n), sf = same ? side : -side;
    const wf = otherWidth(f, sf), q = [n.x + f.nx * sf * wf, n.z + f.nz * sf * wf];
    const join = roadMiter(e, f, n, [px, pz], q, Math.max(w, wf));
    return join.feasible ? join.point : [(px + q[0]) / 2, (pz + q[1]) / 2];
}
function nativePoint(e) {
    return (t, offset, y) => {
        const side = offset >= 0 ? 1 : -1, extra = Math.abs(offset) - nativeWidth(e, side), width = (f, s) => nativeWidth(f, s) + extra;
        const a = corner(e, e.a, side, Math.abs(offset), width), b = corner(e, e.b, side, Math.abs(offset), width);
        return [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t];
    };
}

export { fixture, edges, nativeWidth, nativePoint };
