// ============================================================================
//  WORLD COLLISION — the static collider tests shared by the player, traffic, crowd, drone and on-foot code
//  (split out of world.js, spec 22). Colliders are the records buildWorld puts in world.buildings: building outlines
//  (with holes / passages / height bands), props, wall segments, road decks with triangulated tops.
// ============================================================================
import { distPointSeg, pointInPolygon, clamp } from './util.js';

// ---------------------------------------------------------------------------
//  Collision: real footprints (polygon) + oriented boxes (landmarks)
// ---------------------------------------------------------------------------
/** Point check for developer road-overlap audits, including a two-metre vehicle body above its road. */
export function buildingBlocksRoad(c, x, z, roadY, bodyHeight = 2) {
    if (c.roadDeck) return false;
    if (c.roofHeightAt && roadY > (c.roofHeightAt(x, z) ?? c.h)) return false;
    if (c.passageSolids) return c.passageSolids.some(band => band.y0 <= roadY + bodyHeight && band.y1 >= roadY && band.polys.some(p => pointInPolygon(x, z, p)));
    if (!c.poly || !pointInPolygon(x, z, c.poly) || (c.holes || []).some(h => pointInPolygon(x, z, h))) return false;
    if ((c.minH ?? 0) > roadY + bodyHeight || (c.h !== undefined && roadY > c.h + 0.5)) return false;
    if ((c.y0 !== undefined && roadY + bodyHeight < c.y0) || (c.y1 !== undefined && roadY > c.y1)) return false;
    return true;
}

/** Conservative horizontal bounds for the exact native collision primitives. */
export function collisionBounds(b) {
    if(b.wall&&[b.ax,b.az,b.bx,b.bz].every(Number.isFinite))return[Math.min(b.ax,b.bx),Math.min(b.az,b.bz),Math.max(b.ax,b.bx),Math.max(b.az,b.bz)];
    if(b.poly?.length){let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;for(const[x,z]of b.poly){x0=Math.min(x0,x);z0=Math.min(z0,z);x1=Math.max(x1,x);z1=Math.max(z1,z);}return[x0,z0,x1,z1];}
    if(!(b.prop&&b.hw===b.r)&&Number.isFinite(b.hw)&&Number.isFinite(b.hd)&&Number.isFinite(b.angle)){const c=Math.abs(Math.cos(b.angle)),s=Math.abs(Math.sin(b.angle)),x=c*b.hw+s*b.hd,z=s*b.hw+c*b.hd;return[b.x-x,b.z-z,b.x+x,b.z+z];}
    return[b.x-b.r,b.z-b.r,b.x+b.r,b.z+b.r];
}

function collisionHeightClear(b,x,z,radius,y,bodyHeight) {
    if (b.roofHeightAt) {
        const top = b.roofHeightAt(x, z, radius);
        // The same triangulated roof drives collision; the full total-height box is only broad phase.
        // (owner, 2026-11-13, SeaTac (-981, -16): "invisible wall", the Airport Expressway fork) a bridge junction slab is
        // the structure under a junction the car drives across: its top follows the drawn pad skin, which runs up to 0.37 m
        // above the road height the car follows there, so its edge stopped the car like a wall. A car within 0.5 m of the
        // slab top is on the junction, not under it.
        if (top === null || (y ?? 0.24) > top || (b.roadDeck && (y ?? .24) >= b.roofHeightAt(x, z, 0) - (b.bridgeJunction ? 0.5 : 1e-4))) return false;
    }
    if (b.minHeightAt) { const bottom = b.minHeightAt(x, z, radius); if (bottom === null || (y ?? .24) + bodyHeight < bottom) return false; }
    return true;
}

// Bounding box of a collision outline, kept per outline array. A point farther than `radius` outside it is neither inside
// the outline nor within `radius` of any of its edges: the full test below would return null. (SeaTac: the terminal's
// passage solids were copied and walked edge by edge for every walker near it, 70 % of that district's simulation step.)
const outlineBoxes = new WeakMap();
function outsideOutline(poly, x, z, radius) {
    let box = outlineBoxes.get(poly);
    if (!box) { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const p of poly) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; } outlineBoxes.set(poly, box = [x0, z0, x1, z1]); }
    return x < box[0] - radius || x > box[2] + radius || z < box[1] - radius || z > box[3] + radius;
}
// A large outline (an airport terminal has 400 vertices, a garage 160 plus holes, each on several levels) was walked edge
// by edge for every body near it. Its edges are kept in 2 m rows by z: the crossing count for "inside" needs only the
// edges of the point's own row, and an edge within `radius` lies in the rows the point's reach touches. Same edges, same
// arithmetic, same order as the full walk; a point inside the outline still takes the full walk for its nearest edge.
const OUTLINE_ROW_M = 2, OUTLINE_INDEX_MIN_VERTICES = 40, outlineRowIndexes = new WeakMap();
function outlineRowIndex(poly, holes) {
    let ix = outlineRowIndexes.get(poly);
    if (ix && ix.holes === holes) return ix;
    const boundaries = holes?.length ? [poly, ...holes] : [poly]; let z0 = Infinity, z1 = -Infinity;
    for (const boundary of boundaries) for (const p of boundary) { if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
    const rows = Array.from({ length: Math.max(1, Math.floor((z1 - z0) / OUTLINE_ROW_M) + 1) }, () => []); let seq = 0;
    for (let bi = 0; bi < boundaries.length; bi++) { const boundary = boundaries[bi]; for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
        const e = { seq: seq++, bi, xi: boundary[i][0], zi: boundary[i][1], xj: boundary[j][0], zj: boundary[j][1] };
        for (let r = Math.floor((Math.min(e.zi, e.zj) - z0) / OUTLINE_ROW_M), last = Math.floor((Math.max(e.zi, e.zj) - z0) / OUTLINE_ROW_M); r <= last; r++) rows[r].push(e);
    } }
    outlineRowIndexes.set(poly, ix = { holes, z0, rows, parity: new Uint8Array(boundaries.length), finite: Number.isFinite(z0) && Number.isFinite(z1) });
    return ix;
}
/** null: the point is neither inside the outline nor within `radius` of an edge. Otherwise { inside } and, when not
 *  inside, the nearest edge (bd, bnx, bnz) exactly as the full walk finds it. */
function outlineContact(ix, x, z, radius) {
    const rows = ix.rows, row = Math.floor((z - ix.z0) / OUTLINE_ROW_M), parity = ix.parity; parity.fill(0);
    if (row >= 0 && row < rows.length) for (const e of rows[row]) if (((e.zi > z) !== (e.zj > z)) && (x < (e.xj - e.xi) * (z - e.zi) / (e.zj - e.zi) + e.xi)) parity[e.bi] ^= 1;
    let inside = parity[0] === 1; if (inside) for (let k = 1; k < parity.length; k++) if (parity[k]) { inside = false; break; }
    if (inside) return { inside: true };
    const r0 = Math.max(0, Math.floor((z - radius - ix.z0) / OUTLINE_ROW_M)), r1 = Math.min(rows.length - 1, Math.floor((z + radius - ix.z0) / OUTLINE_ROW_M));
    let bd = Infinity, bnx = 0, bnz = 0, bseq = Infinity;
    for (let r = r0; r <= r1; r++) for (const e of rows[r]) {
        if ((e.xi < x - radius && e.xj < x - radius) || (e.xi > x + radius && e.xj > x + radius)) continue; // cannot be within radius
        const q = distPointSeg(x, z, e.xj, e.zj, e.xi, e.zi);
        // the full walk keeps the first of equal distances: here the lowest edge number
        if (q.d < bd || (q.d === bd && e.seq < bseq)) { bd = q.d; bseq = e.seq; if (q.d > 1e-5) { bnx = (x - q.cx) / q.d; bnz = (z - q.cz) / q.d; } else { bnx = 0; bnz = 0; } }
    }
    return bd < radius ? { inside: false, bd, bnx, bnz } : null;
}
export function collideOne(b, x, z, radius, y, bodyHeight = 2) {
    if (!b.wall) {
        const height = y ?? 0.24;
        if ((b.y0 !== undefined && (b.roofHeightAt ? height + bodyHeight < b.y0 : height < b.y0)) || (b.y1 !== undefined && height > b.y1)) return null;
    }
    if (b.wall) { // wall segment, active only for bodies within its height band
        const r = distPointSeg(x, z, b.ax, b.az, b.bx, b.bz);
        if (r.d >= radius) return null;
        const yq = y ?? 0.24;
        const y0 = b.y0a + (b.y0b - b.y0a) * r.t, y1 = b.y1a + (b.y1b - b.y1a) * r.t;
        if (yq < y0 - 0.3 || yq > y1) return null;
        let nx, nz;
        if (r.d > 1e-4) { nx = (x - r.cx) / r.d; nz = (z - r.cz) / r.d; } else { nx = b.nx; nz = b.nz; }
        if(!collisionHeightClear(b,x,z,radius,y,bodyHeight))return null;
        return { nx, nz, pen: radius - r.d };
    }
    if(b.passageSolids){
        const height=y??.24;let best=null;
        for(const band of b.passageSolids){
            if(height+bodyHeight<band.y0||height>band.y1)continue;
            for(const poly of band.polys){if(outsideOutline(poly,x,z,radius))continue;const hit=collideOne({...b,passageSolids:null,poly,holes:[],minH:band.y0,y0:undefined,y1:band.y1},x,z,radius,y,bodyHeight);if(hit&&(!best||hit.pen>best.pen))best=hit;}
        }
        return best&&collisionHeightClear(b,x,z,radius,y,bodyHeight)?best:null;
    }
    if (b.minH > (y ?? 0.24) + bodyHeight) return null; // mapped passage: body fits below the source underside
    if (b.yMax !== undefined && (y ?? 0.24) > b.yMax) return null; // e.g. bridge piers: only for traffic below the deck
    if (b.prop && b.hw === b.r) { // small circle (tree trunk, post…)
        const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz);
        if (d >= b.r + radius) return null;
        if(!collisionHeightClear(b,x,z,radius,y,bodyHeight))return null;
        return d > 1e-4 ? { nx: dx / d, nz: dz / d, pen: b.r + radius - d } : { nx: 1, nz: 0, pen: b.r + radius };
    }
    if (b.poly) {
        const poly = b.poly;
        if (outsideOutline(poly, x, z, radius)) return null; // (holes lie inside the outline)
        if (poly.length + (b.holes ? b.holes.reduce((n, h) => n + h.length, 0) : 0) >= OUTLINE_INDEX_MIN_VERTICES) {
            const ix = outlineRowIndex(poly, b.holes);
            if (ix.finite) {
                const near = outlineContact(ix, x, z, radius);
                if (!near) return null;
                if (!near.inside) { if (!collisionHeightClear(b, x, z, radius, y, bodyHeight)) return null; return { nx: near.bnx, nz: near.bnz, pen: radius - near.bd }; }
            }
        }
        const holes = b.holes || [];
        const inside = pointInPolygon(x, z, poly) && !holes.some(h => pointInPolygon(x, z, h));
        let bd = Infinity, bnx = 0, bnz = 0;
        for (const boundary of [poly, ...holes]) for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
            const r = distPointSeg(x, z, boundary[j][0], boundary[j][1], boundary[i][0], boundary[i][1]);
            if (r.d < bd) { bd = r.d; if (r.d > 1e-5) { bnx = (x - r.cx) / r.d; bnz = (z - r.cz) / r.d; } else { bnx = 0; bnz = 0; } }
        }
        if((inside||bd<radius)&&!collisionHeightClear(b,x,z,radius,y,bodyHeight))return null;
        if (inside) return { nx: -bnx, nz: -bnz, pen: radius + bd };
        if (bd < radius) return { nx: bnx, nz: bnz, pen: radius - bd };
        return null;
    }
    const dx = x - b.x, dz = z - b.z;
    const c = Math.cos(b.angle), s = Math.sin(b.angle);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const cx = clamp(lx, -b.hw, b.hw), cz = clamp(lz, -b.hd, b.hd);
    const ddx = lx - cx, ddz = lz - cz;
    const d = Math.hypot(ddx, ddz);
    if (d >= radius) return null;
    let nx, nz;
    if (d > 1e-4) { nx = ddx / d; nz = ddz / d; }
    else { const ox = b.hw - Math.abs(lx), oz = b.hd - Math.abs(lz); if (ox < oz) { nx = Math.sign(lx) || 1; nz = 0; } else { nx = 0; nz = Math.sign(lz) || 1; } }
    if(!collisionHeightClear(b,x,z,radius,y,bodyHeight))return null;
    const pen = d > 1e-4 ? radius - d : radius + Math.min(b.hw - Math.abs(lx), b.hd - Math.abs(lz));
    return { nx: nx * c + nz * s, nz: -nx * s + nz * c, pen };
}

/**
 * Returns a push vector {px, pz, hit} or null. `buildings` may carry a spatial `.query(x, z, r, cb)`.
 * `y` (optional) = height of the body's base (e.g. player.y): walls (bridge railings, embankments, trench walls,
 * guard rails) and bridge piers only collide with bodies at their level. Without `y` the body is assumed on the
 * ground (0.24): railings of elevated decks are then ignored (so cars under a bridge are never blocked).
 */
export function collideBuildings(buildings, x, z, radius, y, bodyHeight = 2) {
    let px = 0, pz = 0, hit = null;
    const test = (b) => {
        const dx = x - b.x, dz = z - b.z;
        if (dx * dx + dz * dz > (b.r + radius) * (b.r + radius)) return;
        const r = collideOne(b, x, z, radius, y, bodyHeight);
        if (r && r.pen > 0) { px += r.nx * r.pen; pz += r.nz * r.pen; hit = b; }
    };
    if (buildings.query) buildings.query(x, z, radius + 2, test); else for (const b of buildings) test(b);
    return hit ? { px, pz, hit } : null;
}
