// ============================================================================
//  Street furniture that the hash-locked `osm.js` `buildFurniture` draws wrong or not at all (r2-bel-spots-7).
//  osm.js is hashed into the Seattle source-context cache, so the fix lives here: the backdrop hands buildFurniture
//  the data without picnic tables and this module draws them (both seat boards, A-frame legs), and it puts a pole at
//  every mapped `man_made=flagpole` node that the scene has not dressed itself.
//  `tourism=information` boards stay undrawn on purpose (note 36: the data carries no text, scenes add real plaques).
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { GeoBatch, rng, inPoly, distPolyline } from './kit.js';

/** the data with the furniture classes this module draws removed (for osm.js buildFurniture) */
export const withoutExtraFurniture = (data) => ({ ...data, furniture: { ...data.furniture, picnic_table: [] } });

/** picnic tables at OSM `leisure=picnic_table` nodes: top, two seat boards, two A-frame leg pairs */
export function buildPicnicTables(data, ground, { exclude = [], onRoad = null, seed = 11 } = {}) {
    const b = new GeoBatch(), r = rng(seed), colliders = [];
    for (const [x, z] of data.furniture?.picnic_table || []) {
        if (exclude.some((p) => inPoly(x, z, p)) || (onRoad && !globalThis.__spotsLegacy && onRoad(x, z, 0.4))) continue;
        let best = null; for (const w of data.ways || []) { const d = distPolyline(x, z, w.pts); if (!best || d.d < best.d) best = d; }
        const a = best && best.d < 15 ? Math.atan2(best.cx - x, best.cz - z) : r() * 6.28, y = ground.heightAt(x, z);
        const S = Math.sin(a), C = Math.cos(a), P = (lx, lz) => [x + C * lx + S * lz, z - S * lx + C * lz];
        b.box(x, y + 0.72, z, 1.8, 0.06, 0.8, '#7a5a3c', 'wood', a); // top (long side along local x)
        for (const s of [-0.58, 0.58]) { const [px, pz] = P(0, s); b.box(px, y + 0.42, pz, 1.8, 0.05, 0.3, '#6d5034', 'wood', a); } // the two seats
        for (const lx of [-0.7, 0.7]) {
            const [cx, cz] = P(lx, 0); b.box(cx, y + 0.36, cz, 0.07, 0.06, 1.46, '#5d4632', 'wood', a); // seat bearer
            for (const s of [-1, 1]) { const [px, pz] = P(lx, s * 0.24); b.boxC(px, y + 0.36, pz, 0.08, 0.76, 0.08, '#5d4632', 'wood', a, s * 0.32); } // A-frame legs
        }
        colliders.push({ x, z, r: 1, angle: a, hw: 0.9, hd: 0.75, prop: true, h: 0.78 });
    }
    return { group: b.parts.size ? b.build('picnic-tables') : null, colliders };
}

/**
 * bare flagpoles at mapped `man_made=flagpole` nodes (the extracts keep positions only: no flag tags, so no flag is
 * invented, as for the untagged poles in ot-fronts.js). Skips a node with a scene-drawn flag (`flag:*`, `us-flag`)
 * within 2.5 m. Pole height 8 m is an estimate.
 */
export function buildFlagpoles(data, ground, scene, { exclude = [], h = 8 } = {}) {
    const pts = (data.furniture?.flagpole || []).filter(([x, z]) => !exclude.some((p) => inPoly(x, z, p)));
    if (!pts.length) return { group: null, colliders: [] };
    const dressed = [], v = new THREE.Vector3();
    scene.updateMatrixWorld(true);
    scene.traverse((o) => { if (/^(flag:|us-flag)/.test(o.name || '')) { o.getWorldPosition(v); dressed.push([v.x, v.z]); } });
    const b = new GeoBatch(), colliders = [];
    for (const [x, z] of pts) {
        if (dressed.some(([dx, dz]) => Math.hypot(dx - x, dz - z) < 2.5)) continue;
        const y = ground.heightAt(x, z);
        b.cyl(x, y, z, 0.16, 0.25, '#9a9890', 'concrete', 12); // footing
        b.cyl(x, y + 0.25, z, 0.07, h - 0.25, '#d9dcdf', 'steel', 10);
        b.sphere(x, y + h + 0.08, z, 0.1, 0.1, 0.1, '#d8b44a', 'metal', 8, 6);
        colliders.push({ x, z, r: 0.2, hw: 0.2, prop: true, h });
    }
    return { group: b.parts.size ? b.build('flagpoles') : null, colliders };
}
