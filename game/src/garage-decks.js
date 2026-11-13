// Ways on the upper decks of a multi-storey car park (h-seatac-garage, 2026-11-13).
//
// OSM maps the aisles of the Port of Seattle garage at Sea-Tac (rel 15763840: building=parking, parking=multi-storey,
// building:levels=7) as highway=service ways tagged layer=2 (parking aisles w344201644-55, w430427477, w430442190,
// w722071151-60, w1444470941 and the deck ramp w521034679) and layer=1 tunnel=building_passage level=3 drives
// (w906096010, w1202709961, w1493252870-73, w1562262127, w1562297012, w909581584). None of them is a bridge, so the
// profile pass kept them at street level: they were drawn and routable on the ground, straight through the garage's
// posts and helices and the terminal model (harness scenario a: object-in-road x12 around (-1176, 700)).
// The layer says they are above the ground, not which of the seven decks they are on, and the garage model's deck
// datums are estimates (landmarks.js bSeaGarage): a way on layer >= 1 lying wholly inside a multi-storey car park's
// footprint is taken as one of its internal decks, covered by the car-park model, and is neither drawn nor routable.
// The ground-level ramps that enter the garage (layer 0 / tunnels) stay as mapped.
import { pointInPolygon } from './util.js';

const isCarPark = (t) => !!t && (t.parking === 'multi-storey' || t.building === 'parking');
const isBridge = (t) => !!t.bridge && t.bridge !== 'no';

// -> Map(road index -> car-park source id) for the district's road table
export function garageDeckRoads(data) {
    const out = new Map(), rs = data.roadSourceGeometry, fps = data.buildingFootprints, ids = data.buildingIds || [];
    if (!rs || !fps) return out;
    const parks = [];
    for (const [i, ring] of Object.entries(fps)) {
        const id = ids[i]; if (!ring || ring.length < 3 || !isCarPark(data.buildingSourceTags?.[id])) continue;
        const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
        parks.push({ id, ring, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) });
    }
    if (!parks.length) return out;
    for (const [ri, r] of Object.entries(rs)) {
        const t = r?.tags, p = r?.projected;
        if (!t || !p || p.length < 2 || !(Number(t.layer) >= 1) || isBridge(t)) continue;
        const pts = [];
        for (let k = 0; k + 1 < p.length; k++) pts.push(p[k], [(p[k][0] + p[k + 1][0]) / 2, (p[k][1] + p[k + 1][1]) / 2]);
        pts.push(p[p.length - 1]);
        const park = parks.find(c => pts.every(([x, z]) => x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && pointInPolygon(x, z, c.ring)));
        if (park) out.set(+ri, park.id);
    }
    return out;
}
