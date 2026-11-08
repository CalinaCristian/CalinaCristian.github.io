// A small on-foot challenge at Rosetti's authored hoops. All simulation stays in
// the landmark's metre coordinates; only visual/input poses cross its transform.
import * as THREE from '../vendor/three.module.min.js';

export const BASKETBALL_RADIUS = 0.12, THROW_SPEED = 8.2, BASKETBALL_STEP = 1 / 240;
const LOB_ANGLE = 0.4; // a natural upward release lets the player keep the hoop in view
const R = BASKETBALL_RADIUS, STEP = BASKETBALL_STEP;
const copy = p => ({ x: p.x, y: p.y, z: p.z });
const lerp = (a, b, t) => a + (b - a) * t;
const inPolygon = (x, z, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
};

/** Fixed-step integrator shared by actual throws and the visible prediction. */
export class BasketballPhysics {
    constructor(court, onBasket = () => {}) {
        this.court = court; this.onBasket = onBasket; this.baskets = 0; this.reset();
    }
    reset() {
        const c = this.court.center;
        this.pos = { x: c[0], y: c[1] + R, z: c[2] }; this.vel = { x: 0, y: 0, z: 0 };
        this.eligible = false; this.entries = new Set(); this.accumulator = 0; this.age = 0;
    }
    launch(pos, direction, speed = THROW_SPEED, eligible = true) {
        this.pos = copy(pos); const l = Math.hypot(direction.x, direction.y, direction.z) || 1;
        this.vel = { x: direction.x / l * speed, y: direction.y / l * speed, z: direction.z / l * speed };
        this.eligible = eligible; this.entries.clear(); this.accumulator = 0; this.age = 0;
    }
    update(dt) {
        if (!(dt > 0) || !Number.isFinite(dt)) return;
        this.accumulator += Math.min(dt, 1);
        while (this.accumulator + 1e-10 >= STEP) { this.step(); this.accumulator -= STEP; }
    }
    step() {
        const before = copy(this.pos), p = this.pos, v = this.vel;
        v.y -= 9.81 * STEP;
        p.x += v.x * STEP; p.y += v.y * STEP; p.z += v.z * STEP; this.age += STEP;
        const floor = this.court.floors?.find(c => inPolygon(p.x, p.z, c.polygon))?.center[1] ?? this.court.center[1];
        if (p.y < floor + R) {
            p.y = floor + R; v.y = v.y < -0.7 ? -v.y * 0.65 : 0;
            const drag = Math.exp(-2.4 * STEP); v.x *= drag; v.z *= drag;
            this.entries.clear();
        }
        for (let i = 0; i < this.court.hoops.length; i++) {
            const h = this.court.hoops[i];
            this.board(before, h);
            if (this.rim(h)) this.entries.delete(i);
            this.score(before, h, i);
        }
        const drag = Math.exp(-0.06 * STEP); v.x *= drag; v.z *= drag;
    }
    board(before, h) {
        const p = this.pos, v = this.vel, [nx, nz] = h.normal, [bx, by, bz] = h.board;
        const dist = q => (q.x - bx) * nx + (q.z - bz) * nz;
        const a = dist(before), b = dist(p), side = a >= 0 ? 1 : -1, reach = R + h.thickness / 2;
        if (a * side < reach || b * side > reach || a === b) return;
        const t = (side * reach - a) / (b - a), x = lerp(before.x, p.x, t), z = lerp(before.z, p.z, t), y = lerp(before.y, p.y, t);
        if (Math.abs(-(x - bx) * nz + (z - bz) * nx) > h.width / 2 + R || Math.abs(y - by) > h.height / 2 + R) return;
        p.x += nx * (side * reach - b); p.z += nz * (side * reach - b);
        const vn = v.x * nx + v.z * nz;
        if (vn * side < 0) { v.x -= 1.72 * vn * nx; v.z -= 1.72 * vn * nz; }
    }
    rim(h) {
        const p = this.pos, v = this.vel, [x, y, z] = h.rim;
        const dx = p.x - x, dz = p.z - z, radial = Math.hypot(dx, dz);
        if (radial < 1e-9) return false;
        const qx = x + dx / radial * h.radius, qz = z + dz / radial * h.radius;
        const rx = p.x - qx, ry = p.y - y, rz = p.z - qz, d = Math.hypot(rx, ry, rz), reach = R + h.wire;
        if (d >= reach || d < 1e-9) return false;
        const nx = rx / d, ny = ry / d, nz = rz / d, vn = v.x * nx + v.y * ny + v.z * nz;
        p.x = qx + nx * reach; p.y = y + ny * reach; p.z = qz + nz * reach;
        if (vn < 0) { v.x -= 1.65 * vn * nx; v.y -= 1.65 * vn * ny; v.z -= 1.65 * vn * nz; }
        return true;
    }
    score(before, h, i) {
        const p = this.pos, top = h.rim[1] + R, bottom = h.rim[1] - R;
        // Only the sphere's slice at the rim plane occupies the opening. The
        // slice grows to the full radius as the centre crosses, then shrinks;
        // requiring a full-radius cylinder here rejected ordinary angled shots.
        const clear = t => {
            const dy = lerp(before.y, p.y, t) - h.rim[1], slice = Math.sqrt(Math.max(0, R * R - dy * dy));
            return Math.hypot(lerp(before.x, p.x, t) - h.rim[0], lerp(before.z, p.z, t) - h.rim[2]) + slice < h.radius - h.wire;
        };
        if (!this.eligible || p.y >= before.y) { this.entries.delete(i); return; }
        if (before.y >= top && p.y < top) {
            if (clear((top - before.y) / (p.y - before.y))) this.entries.add(i); else this.entries.delete(i);
        }
        if (this.entries.has(i) && p.y >= bottom && !clear(1)) this.entries.delete(i);
        if (this.entries.has(i) && before.y >= h.rim[1] && p.y < h.rim[1] && !clear((h.rim[1] - before.y) / (p.y - before.y))) this.entries.delete(i);
        if (this.entries.has(i) && before.y >= bottom && p.y < bottom && clear((bottom - before.y) / (p.y - before.y))) {
            this.eligible = false; this.entries.clear(); this.baskets++; this.onBasket(i);
        }
    }
    predict(pos, direction, seconds = 2.4) {
        const sim = new BasketballPhysics(this.court); sim.launch(pos, direction);
        const points = [copy(sim.pos)];
        for (let i = 0; i < seconds / STEP; i++) { sim.step(); if (i % 8 === 7) points.push(copy(sim.pos)); }
        return { points, baskets: sim.baskets };
    }
}

function makeBall() {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const c = canvas.getContext('2d'); c.fillStyle = '#df731e'; c.fillRect(0, 0, 256, 128); c.strokeStyle = '#3a251b'; c.lineWidth = 2;
    for (const x of [0, 64, 128, 192, 256]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 128); c.stroke(); }
    c.beginPath(); c.moveTo(0, 64); c.lineTo(256, 64); c.stroke();
    for (const sign of [-1, 1]) { c.beginPath(); for (let x = 0; x <= 256; x += 2) { const y = 64 + sign * 45 * Math.sin(x / 256 * Math.PI * 2); if (x) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 12, 8), new THREE.MeshLambertMaterial({ map: texture }));
    mesh.name = 'rosetti-basketball'; mesh.userData.noAudit = true; return mesh;
}

export function createRosettiBasketball(game) {
    const landmark = game.world?.landmarks?.find(l => l.id === 'rosetti');
    let source = null; landmark?.mesh?.traverse(o => { if (o.userData.basketballCourt) source = o; });
    if (!source || !game.world.district) return null;
    return new RosettiBasketball(game, source);
}

export class RosettiBasketball {
    constructor(game, source) {
        this.game = game; this.source = source; this.courts = source.userData.basketballCourt.courts;
        // One ball on the existing west red court; every existing hoop can score.
        this.court = { ...this.courts.at(-1), floors: this.courts, hoops: this.courts.flatMap(c => c.hoops) };
        const corners = this.courts.flatMap(c => c.polygon);
        this.bounds = { x0: Math.min(...corners.map(p => p[0])) - 15, x1: Math.max(...corners.map(p => p[0])) + 15,
            z0: Math.min(...corners.map(p => p[1])) - 15, z1: Math.max(...corners.map(p => p[1])) + 15 };
        this.physics = new BasketballPhysics(this.court, () => {
            game.hud?.achievement?.('rosetti-basket'); game.hud?.toast?.('🏀 Basket!', 'A little practice after school.', 'intro'); game.audio?.blip?.(880, 0.15, 0.08);
            this.feedback = 2;
        });
        this.mesh = makeBall(); game.scene.add(this.mesh);
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 74), 3));
        const dotCanvas = document.createElement('canvas'); dotCanvas.width = dotCanvas.height = 16;
        const dotContext = dotCanvas.getContext('2d'); dotContext.fillStyle = 'white'; dotContext.beginPath(); dotContext.arc(8, 8, 7, 0, Math.PI * 2); dotContext.fill();
        this.arc = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#21d9ff', size: 0.025, map: new THREE.CanvasTexture(dotCanvas), alphaTest: 0.5, depthWrite: false, fog: false, toneMapped: false }));
        this.arc.name = 'basketball-throw-preview'; this.arc.frustumCulled = false; this.arc.userData.noAudit = true; game.scene.add(this.arc); this.arc.visible = false;
        this.hands = new THREE.Group(); this.hands.name = 'basketball-hands';
        const handGeometry = new THREE.BoxGeometry(0.085, 0.055, 0.13), handMaterial = new THREE.MeshLambertMaterial({ color: '#bf967b' });
        for (const side of [-1, 1]) { const hand = new THREE.Mesh(handGeometry, handMaterial); hand.position.set(side * 0.1, -0.09, 0.015); hand.rotation.z = side * -0.45; this.hands.add(hand); }
        game.scene.add(this.hands); this.hands.visible = false;
        this.ui = document.createElement('div'); this.ui.id = 'basketball-controls'; this.ui.hidden = true;
        this.ui.innerHTML = '<span class="basketball-help"></span><div><button type="button" data-basketball="use">🏀 Pick up</button><button type="button" data-basketball="drop" hidden>Drop</button></div>';
        document.body.appendChild(this.ui);
        this.help = this.ui.querySelector('span'); this.use = this.ui.querySelector('[data-basketball="use"]'); this.dropButton = this.ui.querySelector('[data-basketball="drop"]');
        this.ui.addEventListener('pointerdown', e => e.stopPropagation());
        this.use.onclick = () => this.interact(); this.dropButton.onclick = () => this.drop();
        this.held = false; this.disposed = false; this.recoil = 0; this.syncMesh();
    }
    available() {
        const g = this.game;
        return !this.disposed && g.state === 'foot' && g.foot?.active && !g._pauseOpen && !g.mapOpen && !g.condOpen && !g.hud?.panelOpen && !g.photo?.active && !g.explore?.map?.isOpen && !g.explore?.drone?.active && !document.body.classList.contains('ui-modal') && !document.querySelector('#achv-panel.show, #save-gallery.show');
    }
    /** Called before the host's early returns, including drone/photo takeover. */
    syncActivity() {
        if (this.disposed) return;
        if (!this.available()) { this.cancel(); return; }
        const f = this.game.foot;
        if (this.lastFoot && Math.hypot(f.x - this.lastFoot.x, f.z - this.lastFoot.z) > 4) this.cancel();
        this.lastFoot = { x: f.x, z: f.z };
    }
    local(p) { return this.source.worldToLocal(new THREE.Vector3(p.x, p.y, p.z)); }
    near() {
        const f = this.game.foot; if (!f) return false;
        const p = this.local({ x: f.x, y: f.y + (f.jumpY || 0), z: f.z });
        return Math.hypot(p.x - this.physics.pos.x, p.z - this.physics.pos.z) < 1.8 && Math.abs(p.y - this.physics.pos.y) < 1.9;
    }
    pose() {
        const camera = this.game.camera; camera.updateWorldMatrix(true, false);
        const q = camera.getWorldQuaternion(new THREE.Quaternion()), eye = camera.getWorldPosition(new THREE.Vector3());
        const pos = this.local(new THREE.Vector3(0.23, -0.26, -0.55).applyQuaternion(q).add(eye));
        const gaze = new THREE.Vector3(0, 0, -1).applyQuaternion(q), horizontal = Math.hypot(gaze.x, gaze.z) || 1;
        const pitch = Math.min(1.5, Math.asin(Math.max(-1, Math.min(1, gaze.y))) + LOB_ANGLE);
        const worldDir = new THREE.Vector3(gaze.x / horizontal * Math.cos(pitch), Math.sin(pitch), gaze.z / horizontal * Math.cos(pitch));
        const inv = this.source.getWorldQuaternion(new THREE.Quaternion()).invert();
        const dir = worldDir.applyQuaternion(inv).normalize();
        return { pos, dir, q };
    }
    interact() {
        if (!this.available()) return false;
        if (this.held) {
            const { pos, dir } = this.pose(); this.physics.launch(pos, dir); this.held = false; this.recoil = 0.24;
            this.arc.visible = false; this.game.audio?.blip?.(220, 0.05, 0.04); this.syncMesh(); return true;
        }
        if (!this.near()) return false;
        this.held = true; this.physics.eligible = false; this.physics.entries.clear(); this.physics.vel = { x: 0, y: 0, z: 0 };
        this.game.input?.cancelTouch?.(); this.updateFoot(0); return true;
    }
    drop() {
        if (!this.available() || !this.held) return false;
        const { pos } = this.pose(); this.physics.launch(pos, { x: 0, y: 0, z: 0 }, 0, false);
        this.held = false; this.arc.visible = false; this.hands.visible = false; this.syncMesh(); return true;
    }
    cancel() {
        if (this.held) { this.held = false; this.physics.reset(); this.syncMesh(); }
        this.physics.eligible = false; this.physics.entries.clear(); this.arc.visible = false; this.hands.visible = false;
        this.ui.hidden = true; this.recoil = 0; this.lastFoot = null;
    }
    update(dt) {
        if (this.disposed || this.held) return;
        this.physics.update(dt); this.recoil = Math.max(0, this.recoil - dt); this.feedback = Math.max(0, (this.feedback || 0) - dt);
        const p = this.physics.pos, box = this.bounds;
        if (this.physics.age > 35 || p.y < -5 || p.x < box.x0 || p.x > box.x1 || p.z < box.z0 || p.z > box.z1) this.physics.reset();
        this.syncMesh();
    }
    updateFoot(dt) {
        if (!this.available()) return;
        const near = this.near(), input = this.game.input;
        if ((this.held || near) && input.take('KeyE')) this.interact();
        if (this.held && input.take('KeyB')) this.drop();
        this.ui.hidden = !this.held && !near && !this.recoil && !this.feedback;
        this.use.textContent = this.held ? '🏀 Throw' : '🏀 Pick up'; this.use.disabled = !this.held && !near; this.dropButton.hidden = !this.held;
        this.help.textContent = this.held ? (this.game.touch ? 'Drag the right side to aim · follow the dotted arc' : 'Mouse look to aim · E throw · B drop') : this.feedback ? 'Basket! 🏀' : near ? 'A basketball… try the hoops?' : 'Follow the ball for another try';
        if (this.held) {
            const { pos, dir, q } = this.pose(); this.physics.pos = copy(pos); this.syncMesh();
            this.hands.visible = true; this.hands.position.copy(this.mesh.position); this.hands.quaternion.copy(q);
            const preview = this.physics.predict(pos, dir), attr = this.arc.geometry.attributes.position;
            preview.points.forEach((p, i) => { const w = this.source.localToWorld(new THREE.Vector3(p.x, p.y, p.z)); attr.setXYZ(i, w.x, w.y, w.z); });
            attr.needsUpdate = true; this.arc.geometry.setDrawRange(0, preview.points.length);
            this.arc.material.color.set(preview.baskets ? '#12c83c' : '#21d9ff'); this.arc.visible = true;
        } else {
            this.arc.visible = false; this.hands.visible = this.recoil > 0;
            if (this.recoil > 0) { const { pos, q } = this.pose(); pos.y -= (0.24 - this.recoil) * 0.9; this.hands.position.copy(this.source.localToWorld(pos)); this.hands.quaternion.copy(q); }
        }
    }
    syncMesh() {
        const p = this.physics.pos; this.mesh.position.copy(this.source.localToWorld(new THREE.Vector3(p.x, p.y, p.z)));
        if (!this.held) { this.mesh.rotation.x += this.physics.vel.z * STEP / R; this.mesh.rotation.z -= this.physics.vel.x * STEP / R; }
    }
    dispose() {
        if (this.disposed) return;
        this.cancel(); this.disposed = true; this.ui.remove();
        const geometries = new Set(), materials = new Set();
        for (const root of [this.mesh, this.arc, this.hands]) { root.removeFromParent(); root.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); }); }
        for (const g of geometries) g.dispose(); for (const m of materials) { m.map?.dispose(); m.dispose(); }
    }
}
