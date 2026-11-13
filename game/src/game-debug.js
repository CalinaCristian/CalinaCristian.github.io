// Game methods: the dev debug overlay (B key / game.debug.setOverlay): colliders, lanes and road edges around
// the player. Installed on Game.prototype by main.js (mixin).
import * as THREE from '../vendor/three.module.min.js';
import { roadSideWidth } from './nav.js';

export class DebugMethods {

    // ---------------------------------------------------------------------------------- dev: collision overlay
    /** B (dev): draw every collision shape near the player (buildings, props, walls, vehicles, drivable surface) */
    setDebugOverlay(on) {
        this.debug.overlay = !!on;
        if (!this.debugLines) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 20000), 3));
            g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(6 * 20000), 3));
            const m = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.95, toneMapped: false });
            this.debugLines = new THREE.LineSegments(g, m); this.debugLines.frustumCulled = false; this.debugLines.renderOrder = 999;
        }
        if (this.debugLines.parent !== this.scene) this.scene?.add(this.debugLines);
        this.debugLines.visible = this.debug.overlay;
        if (on) this.updateDebugOverlay();
        else { const cv = document.getElementById('dbg-plan'); if (cv) cv.style.display = 'none'; }
        this.hud.toast(on ? '🧱 Collision overlay on' : '🧱 Collision overlay off', on ? 'red buildings · orange props · magenta walls · cyan vehicles · yellow you · green drivable surface' : '');
    }
    updateDebugOverlay(R = 45) {
        const P = this.player, w = this.world, L = this.debugLines; if (!L || !P || !w) return;
        if (L.parent !== this.scene) this.scene.add(L);
        // 1) collect shapes: { c: [r,g,b], pts: [[x,z],…], closed, y0, y1 }
        const shapes = [];
        const RED = [1, 0.15, 0.15], ORANGE = [1, 0.6, 0.1], MAG = [1, 0.2, 1], CYAN = [0.2, 0.9, 1], YEL = [1, 1, 0.2], GREEN = [0.3, 1, 0.4], GREY = [0.55, 0.55, 0.6], WHITE = [1, 1, 1];
        const hitRef = P.debug.lastCollider?.ref;
        const circle = (x, z, r, k = 14) => Array.from({ length: k }, (_, i) => [x + Math.cos(i / k * Math.PI * 2) * r, z + Math.sin(i / k * Math.PI * 2) * r]);
        const obb = (x, z, fx, fz, hl, hw) => { const rx = -fz, rz = fx; return [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]].map(([a, b]) => [x + fx * a + rx * b, z + fz * a + rz * b]); };
        const sy = P.surfY ?? 0.24;
        if (w.buildings) {
            const each = (b) => {
                if (Math.hypot(b.x - P.x, b.z - P.z) > R + (b.r || 0)) return;
                if (b.wall) { shapes.push({ c: b === hitRef ? WHITE : MAG, pts: [[b.ax, b.az], [b.bx, b.bz]], closed: false, y0: Math.max(b.y0a ?? 0, sy - 0.2), y1: Math.min(b.y1a ?? 1, sy + 1.5), kind: 'wall' }); return; }
                const lvl = P.atLevel(b), c = b === hitRef ? WHITE : !lvl ? GREY : b.prop ? ORANGE : RED;
                const y0 = (b.y ?? 0) + 0.3, y1 = y0 + Math.min(b.h ?? 3, 3);
                if (b.prop && b.hw === b.r) shapes.push({ c, pts: circle(b.x, b.z, b.r, 10), closed: true, y0, y1, kind: 'prop' });
                else if (b.poly) shapes.push({ c, pts: b.poly, closed: true, y0, y1, kind: 'building' });
                else { const a = b.angle || 0; shapes.push({ c, pts: obb(b.x, b.z, Math.sin(a), Math.cos(a), b.hd, b.hw), closed: true, y0, y1, kind: 'box' }); }
            };
            if (w.buildings.query) w.buildings.query(P.x, P.z, R, each); else for (const b of w.buildings) each(b);
        }
        const walls = P.wallsInBuildings?.() ? null : P.wallList?.();
        if (walls) for (const s of walls) if (Math.hypot(s.x - P.x, s.z - P.z) <= R + s.r) shapes.push({ c: P.atLevel(s) ? MAG : GREY, pts: [[s.ax, s.az], [s.bx, s.bz]], closed: false, y0: Math.max(s.y, sy - 0.2), y1: Math.min(s.top, sy + 1.5), kind: 'wall' });
        for (const v of this.traffic.near(P.x, P.z, R)) shapes.push({ c: CYAN, pts: obb(v.x, v.z, v.fx, v.fz, v.length / 2, v.width / 2), closed: true, y0: (v.y ?? 0.24), y1: (v.y ?? 0.24) + 1.3, kind: 'vehicle' });
        if (w.edgesInBox) w.edgesInBox(P.x - R, P.z - R, P.x + R, P.z + R, (e) => {
            if (e.ya === undefined) return;
            const ym = 0.24 + (e.ya + e.yb) / 2;
            if (Math.abs(ym - sy) > 3) return;
            for (const sd of [1, -1]) shapes.push({ c: GREEN, pts: [[e.a.x + e.nx * roadSideWidth(e, sd) * sd, e.a.z + e.nz * roadSideWidth(e, sd) * sd], [e.b.x + e.nx * roadSideWidth(e, sd) * sd, e.b.z + e.nz * roadSideWidth(e, sd) * sd]], closed: false, y0: ym + 0.05, y1: ym + 0.05, kind: 'ribbon' });
        });
        shapes.push({ c: YEL, pts: obb(P.x + P.fx * ((P.front ?? 2.2) - (P.rear ?? 2.2)) / 2, P.z + P.fz * ((P.front ?? 2.2) - (P.rear ?? 2.2)) / 2, P.fx, P.fz, P.length / 2, P.width / 2), closed: true, y0: sy, y1: sy + 1.2, kind: 'player' });
        for (const o of [1.3, 0, -1.3]) shapes.push({ c: YEL, pts: circle(P.x + P.fx * o, P.z + P.fz * o, 1.0, 12), closed: true, y0: sy + 0.1, y1: sy + 0.1, kind: 'player' });
        this.debug.shapes = shapes.length;
        // 2) 3D lines (through everything)
        const pos = L.geometry.attributes.position, col = L.geometry.attributes.color, max = pos.count;
        let n = 0;
        const seg = (x1, y1, z1, x2, y2, z2, c) => { if (n + 2 > max) return; pos.setXYZ(n, x1, y1, z1); col.setXYZ(n++, c[0], c[1], c[2]); pos.setXYZ(n, x2, y2, z2); col.setXYZ(n++, c[0], c[1], c[2]); };
        for (const sh of shapes) {
            const p = sh.pts, m = sh.closed ? p.length : p.length - 1;
            for (let i = 0; i < m; i++) {
                const a = p[i], b = p[(i + 1) % p.length];
                seg(a[0], sh.y0, a[1], b[0], sh.y0, b[1], sh.c);
                if (sh.y1 > sh.y0 + 0.01) { seg(a[0], sh.y1, a[1], b[0], sh.y1, b[1], sh.c); if (i % 3 === 0) seg(a[0], sh.y0, a[1], a[0], sh.y1, a[1], sh.c); }
            }
        }
        L.geometry.setDrawRange(0, n);
        pos.needsUpdate = true; col.needsUpdate = true;
        // 3) plan view (top-down, heading up) in a corner canvas — legible in screenshots
        let cv = document.getElementById('dbg-plan');
        if (!cv) { cv = document.createElement('canvas'); cv.id = 'dbg-plan'; cv.width = cv.height = 260; document.body.appendChild(cv); }
        cv.style.display = this.debug.overlay ? 'block' : 'none';
        const ctx = cv.getContext('2d'), S = 260 / (2 * R) * 1.4, Hh = P.heading;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 260, 260); ctx.fillStyle = 'rgba(8,10,16,0.82)'; ctx.fillRect(0, 0, 260, 260);
        ctx.translate(130, 150); ctx.scale(S, S); ctx.rotate(Hh); ctx.translate(-P.x, -P.z);
        ctx.lineWidth = 1.6 / S;
        const order = { ribbon: 0, building: 1, box: 1, prop: 2, wall: 3, vehicle: 4, player: 5 };
        for (const sh of shapes.slice().sort((a, b) => order[a.kind] - order[b.kind])) {
            ctx.beginPath(); sh.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); if (sh.closed) ctx.closePath();
            const css = `rgb(${sh.c.map(v => Math.round(v * 255)).join(',')})`;
            ctx.strokeStyle = css; ctx.lineWidth = (sh.kind === 'wall' ? 3 : 1.6) / S; ctx.stroke();
            if (sh.closed && sh.kind !== 'player') { ctx.globalAlpha = 0.18; ctx.fillStyle = css; ctx.fill(); ctx.globalAlpha = 1; }
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#e5e7eb'; ctx.font = '11px monospace';
        const lc = P.debug.lastCollider;
        ctx.fillText(`y ${sy.toFixed(2)}  hits ${P.debug.count}`, 6, 14);
        if (lc) ctx.fillText(`last: ${lc.type} ${lc.id ?? ''}`.slice(0, 40), 6, 28);
    }
}
