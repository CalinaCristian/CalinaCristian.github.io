// ============================================================================
//  Visual QA — cockpit / HUD layout checks for the current viewport.
//    cockpit-screen-offscreen   part of the in-car nav screen is outside the camera frustum (cut by the view edge)
//    cockpit-screen-occluded    another cockpit mesh is in front of part of the nav screen
//    cockpit-screen-small       the nav screen is too small on screen to read
//    cockpit-cluster-offscreen / -occluded   same for the instrument cluster
//    hud-offscreen              a HUD element extends past the viewport
//    hud-overlap                two HUD blocks overlap
//    hud-covers-cockpit         a HUD block covers the nav screen / instrument cluster
//    hud-text-clipped           a HUD text element is cut (overflow hidden / ellipsis)
// ============================================================================

const DOM_BLOCKS = [
    ['top-left', '#hud .top-left'], ['top-right', '#hud .top-right'], ['street', '#hud .street-wrap'], ['bottom-right', '#hud .bottom-right'],
    ['minimap', '#hud .bottom-left'], ['ticker', '#ticker'], ['prompt', '#prompt'], ['hint', '#hint'], ['toasts', '#toasts'],
    ['touch-left', '#touch .pad.left'], ['touch-right', '#touch .pad.right'],
];
const visible = (el) => {
    if (!el) return false;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    }
    const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1;
};
const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const rr = (r) => [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
/** union rect of an element's visible content (children may stick out of their box) */
function contentRect(el) {
    const r = el.getBoundingClientRect(); let L = r.left, T = r.top, R = r.right, B = r.bottom;
    for (const c of el.querySelectorAll('*')) {
        if (!visible(c)) continue; const q = c.getBoundingClientRect();
        L = Math.min(L, q.left); T = Math.min(T, q.top); R = Math.max(R, q.right); B = Math.max(B, q.bottom);
    }
    return { left: L, top: T, right: R, bottom: B, width: R - L, height: B - T };
}

/** sample a plane mesh (PlaneGeometry in its local XY) → world points grid */
function planePoints(THREE, mesh, nx = 9, ny = 6) {
    const g = mesh.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox, pts = [];
    mesh.updateMatrixWorld(true);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const u = (i + 0.5) / nx, v = (j + 0.5) / ny;
        pts.push(new THREE.Vector3(bb.min.x + (bb.max.x - bb.min.x) * u, bb.min.y + (bb.max.y - bb.min.y) * v, 0).applyMatrix4(mesh.matrixWorld));
    }
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => new THREE.Vector3(bb.min.x + (bb.max.x - bb.min.x) * u, bb.min.y + (bb.max.y - bb.min.y) * v, 0).applyMatrix4(mesh.matrixWorld));
    return { pts, corners };
}

/** human description of an (often unnamed, batched) cockpit mesh: name / colour / where the ray hit it in cockpit space */
function describe(THREE, o, ck, pt) {
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const col = m?.color ? '#' + m.color.getHexString() : '';
    let p = '';
    if (pt) try { const l = ck.worldToLocal(pt.clone()); p = ` first hit at cockpit-local (${l.x.toFixed(2)}, ${l.y.toFixed(2)}, ${l.z.toFixed(2)})`; } catch { /* ignore */ }
    const nm = o.name || (o.parent && o.parent !== ck && o.parent.name ? o.parent.name + '/' : '') + (o.geometry?.type || 'mesh');
    return `${nm}${col ? ' ' + col : ''}${p}`;
}
function partCheck(THREE, g, mesh, label, out) {
    const cam = g.camera; cam.updateMatrixWorld(true);
    const W = innerWidth, H = innerHeight;
    const { pts, corners } = planePoints(THREE, mesh);
    const scr = corners.map(p => { const v = p.clone().project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z]; });
    const xs = scr.map(s => s[0]), ys = scr.map(s => s[1]);
    const rect = { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
    let outside = 0, occl = 0; const occluders = new Map(), firstPt = new Map();
    const camPos = new THREE.Vector3(); cam.getWorldPosition(camPos);
    const rc = new THREE.Raycaster();
    const skip = new Set(); mesh.traverse(o => skip.add(o));
    const targets = []; g.player.rig.traverse(o => { if (o.isMesh && o.visible && !skip.has(o) && o !== g.player.mirror) targets.push(o); });
    for (const p of pts) {
        const v = p.clone().project(cam);
        if (v.x < -1 || v.x > 1 || v.y < -1 || v.y > 1 || v.z > 1) { outside++; continue; }
        const dir = p.clone().sub(camPos); const dist = dir.length(); dir.normalize();
        rc.set(camPos, dir); rc.near = 0.01; rc.far = dist - 0.004;
        const hit = rc.intersectObjects(targets, false).find(h => { let vis = true; for (let o = h.object; o; o = o.parent) if (!o.visible) vis = false; return vis; });
        if (hit) { occl++; const n = describe(THREE, hit.object, g.player.cockpit, null); if (!firstPt.has(n)) firstPt.set(n, describe(THREE, hit.object, g.player.cockpit, hit.point)); occluders.set(n, (occluders.get(n) || 0) + 1); }
    }
    const n = pts.length;
    const res = { label, rect: rr(rect), outside: outside / n, occluded: occl / n, occluders: [...occluders.entries()].sort((a, b) => b[1] - a[1]).map(([k, c]) => `${firstPt.get(k)} (${Math.round(c / n * 100)} %)`), hPx: Math.round(rect.bottom - rect.top) };
    if (res.outside > 0.02) out.push(['cockpit-' + label + '-offscreen', res.outside > 0.12 ? 'high' : 'medium', `${Math.round(res.outside * 100)} % of the ${label === 'screen' ? 'nav screen' : 'instrument cluster'} is outside the view at ${W}×${H} (its on-screen box ${res.rect.join(', ')})`, { rect: res.rect, outside: +res.outside.toFixed(2) }]);
    if (res.occluded > (label === 'cluster' ? 0.35 : 0.04)) out.push(['cockpit-' + label + '-occluded', res.occluded > 0.15 ? 'high' : 'medium', `${Math.round(res.occluded * 100)} % of the ${label === 'screen' ? 'nav screen' : 'instrument cluster'} is hidden behind cockpit meshes at ${W}×${H}: ${res.occluders.join(', ')}`, { rect: res.rect, occluders: res.occluders }]);
    if (label === 'screen' && res.hPx < H * 0.1) out.push(['cockpit-screen-small', 'low', `the nav screen is only ${res.hPx} px tall at ${W}×${H} (hard to read)`, { rect: res.rect }]);
    return { rect, res };
}

export function uiChecks(THREE, g) {
    const out = [];
    const W = innerWidth, H = innerHeight;
    const ck = g.player?.cockpit;
    const parts = {};
    if (ck?.userData?.screen) parts.screen = partCheck(THREE, g, ck.userData.screen, 'screen', out);
    // instrument cluster: the other cockpit plane with a canvas texture
    let cluster = null; ck?.traverse(o => { if (!cluster && o.isMesh && o !== ck.userData.screen && o.geometry?.type === 'PlaneGeometry' && o.material?.map?.image instanceof HTMLCanvasElement && o.parent !== ck.userData.screen) cluster = o; });
    if (cluster) parts.cluster = partCheck(THREE, g, cluster, 'cluster', out);
    // DOM blocks
    const blocks = [];
    for (const [name, sel] of DOM_BLOCKS) {
        const el = document.querySelector(sel); if (!visible(el)) continue;
        const r = contentRect(el); if (r.width < 2 || r.height < 2) continue;
        blocks.push({ name, r, el });
        const past = Math.max(-r.left, -r.top, r.right - W, r.bottom - H);
        if (past > 2) out.push(['hud-offscreen', past > 20 ? 'high' : 'medium', `HUD ${name} extends ${Math.round(past)} px past the ${W}×${H} viewport (box ${rr(r).join(', ')})`, { el: name, rect: rr(r) }]);
    }
    for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i], b = blocks[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ia = inter(a.r, b.r), small = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
        if (ia > 0.04 * small && ia > 60) out.push(['hud-overlap', ia > 0.25 * small ? 'high' : 'medium', `HUD ${a.name} and ${b.name} overlap (${Math.round(ia / small * 100)} % of the smaller) at ${W}×${H}`, { a: a.name, b: b.name, ra: rr(a.r), rb: rr(b.r) }]);
    }
    for (const [label, p] of Object.entries(parts)) {
        const pr = { left: Math.max(0, p.rect.left), top: Math.max(0, p.rect.top), right: Math.min(W, p.rect.right), bottom: Math.min(H, p.rect.bottom) };
        const pa = Math.max(1, (pr.right - pr.left) * (pr.bottom - pr.top));
        for (const b of blocks) {
            const ia = inter(pr, b.r);
            if (ia / pa > 0.06) out.push(['hud-covers-cockpit', ia / pa > 0.2 ? 'high' : 'medium', `HUD ${b.name} covers ${Math.round(ia / pa * 100)} % of the ${label === 'screen' ? 'in-car nav screen' : 'instrument cluster'} at ${W}×${H}`, { el: b.name, part: label, rect: rr(b.r), partRect: rr(pr) }]);
        }
    }
    // clipped HUD text
    for (const el of document.querySelectorAll('#hud *')) {
        if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
        if (!visible(el)) continue;
        const cs = getComputedStyle(el);
        if ((el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(cs.overflowX + cs.overflow)) || (el.scrollHeight > el.clientHeight + 2 && /hidden|clip/.test(cs.overflowY + cs.overflow)))
            out.push(['hud-text-clipped', 'medium', `HUD text "${el.textContent.trim().slice(0, 60)}" (${el.id ? '#' + el.id : el.className || el.tagName}) is cut: needs ${el.scrollWidth}×${el.scrollHeight} px, has ${el.clientWidth}×${el.clientHeight} at ${W}×${H}`, { el: el.id || el.className }]);
        const fs = parseFloat(cs.fontSize); if (fs < 9 && el.textContent.trim().length > 2) out.push(['hud-text-tiny', 'low', `HUD text "${el.textContent.trim().slice(0, 40)}" is ${fs}px at ${W}×${H}`, { el: el.id || el.className }]);
    }
    return { issues: out, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.res])), blocks: blocks.map(b => ({ name: b.name, rect: rr(b.r) })) };
}
