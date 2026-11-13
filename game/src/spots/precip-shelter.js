// ============================================================================
//  Interior volumes of a tourist scene: rooms with a roof, in which no rain or snow may fall.
//  (2026-11-12, owner: "snow particles fall indoors in the Carusel bookshop, the Old Town sports room and the Chihuly
//  Glasshouse".) The renderer's precipitation is a particle box wrapped round the camera; it has no idea of roofs. A scene
//  declares each roofed, enterable volume here and the particles inside it are discarded in the vertex shader
//  (weather.js `setShelters`): nothing falls in the room whether you stand inside or look in through the doorway, and the
//  snow outside is still seen through the door and the windows.
//
//      declareInterior(ctx, { poly, y0, y1 })           the oriented bounding box of a footprint ring [[x, z], …]
//      declareInterior(ctx, { box: { x0, z0, x1, z1 }, y0, y1 })
//
//  `pad` (default 0) grows the box in plan. `when` (optional) → false while the room is not in use (hidden rooms).
//  At most MAX_SHELTERS (8) volumes are active at once; the nearest to the camera win.
// ============================================================================
import { obb } from './kit.js';
import { MAX_SHELTERS } from '../weather.js';
import { Vector3 } from '../../vendor/three.module.min.js';
const SHELTER_V = new Vector3();

/** (2026-11-12 render review) is the point inside a declared, active interior? (the crowd closes umbrellas there) */
export function insideInterior(list, x, y, z) {
    if (!list?.length) return false;
    for (const s of list) {
        if (s.when && !s.when()) continue;
        const qx = x - s.cx, qz = z - s.cz;
        if (Math.abs(qx * s.ux + qz * s.uz) < s.hx && Math.abs(qz * s.ux - qx * s.uz) < s.hz && y > s.y0 && y < s.y1) return true;
    }
    return false;
}

export function declareInterior(ctx, { poly = null, box = null, y0, y1, pad = 0, when = null, name = '' } = {}) {
    let s;
    if (poly) { const o = obb(poly); s = { cx: o.cx, cz: o.cz, hx: o.len / 2 + pad, hz: o.wid / 2 + pad, ux: o.ux, uz: o.uz }; }
    else if (box) s = { cx: (box.x0 + box.x1) / 2, cz: (box.z0 + box.z1) / 2, hx: Math.abs(box.x1 - box.x0) / 2 + pad, hz: Math.abs(box.z1 - box.z0) / 2 + pad, ux: 1, uz: 0 };
    else return null;
    Object.assign(s, { y0, y1, when, name });
    const first = !ctx.extras.interiors; (ctx.extras.interiors ||= []).push(s);
    if (first) {
        const list = ctx.extras.interiors, active = [];
        let hooked = null;
        ctx.onUpdate((dt, session) => {
            const r3d = session.r3d;
            // (r3, 2026-11-13: "fog is not suppressed indoors") the weather's aerial-perspective fog is one extinction
            // coefficient for the whole view: in fog (220 m visibility) the far wall of the Carusel atrium, 25 m away, was
            // 36 % grey. While the camera stands in a declared interior the frame is drawn with the clear-air haze only
            // (the renderer's own baseline), set just before the draw because the renderer re-applies the weather density
            // every frame. Looking out through a door, the street is then clear of the weather fog too (one coefficient
            // per frame cannot fog only the part of the ray outside); outside, nothing changes.
            const scene = session.spot?.scene;
            if (r3d && scene && hooked !== scene) {
                hooked = scene; const prev = scene.onBeforeRender, cam = session.camera;
                scene.onBeforeRender = function (...a) {
                    prev?.apply(this, a);
                    const f = this.fog; if (!f?.isFogExp2) return;
                    const c = a[2]?.isCamera ? a[2] : cam; if (!c) return;
                    const p = c.getWorldPosition(SHELTER_V);
                    if (insideInterior(list, p.x, p.y, p.z)) f.density = Math.min(f.density, r3d._fogBase ?? 3.912 / 15000);
                };
            }
            if (!r3d || (!r3d.snow && !r3d.rain)) return;
            active.length = 0; for (const v of list) if (!v.when || v.when()) active.push(v);
            if (active.length > MAX_SHELTERS) { const c = session.camera.position; active.sort((a, b) => Math.hypot(a.cx - c.x, a.cz - c.z) - Math.hypot(b.cx - c.x, b.cz - c.z)); }
            r3d.snow?.setShelters?.(active); r3d.rain?.setShelters?.(active);
        });
    }
    return s;
}
