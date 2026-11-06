import * as THREE from '../vendor/three.module.min.js';
import { makeCanvasTexture, clamp, damp, angleLerp } from './util.js';

/**
 * Walkable office interior. First person: W/S walk, A/D turn, E interacts with a station.
 * Stations are glowing screens showing one piece of the CV each.
 */
export class Office {
    constructor(renderer, camera, stop, hud, input, audio) {
        this.renderer = renderer; this.camera = camera; this.stop = stop; this.hud = hud; this.input = input; this.audio = audio;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#1a1d24');
        this.scene.fog = new THREE.Fog('#1a1d24', 30, 70);
        this.done = false;
        this.read = new Set();
        this.x = 0; this.z = 12; this.heading = 0; this.vel = 0;
        this.stations = [];
        this.build();
        this.camRig = new THREE.Group(); this.camRig.add(camera); this.scene.add(this.camRig);
        camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
        this.t = 0;
    }

    build() {
        const s = this.stop;
        const accent = new THREE.Color(s.color || '#f97316');
        const W = 28, D = 34, H = 4.2;
        this.bounds = { minX: -W / 2 + 0.8, maxX: W / 2 - 0.8, minZ: -D / 2 + 0.8, maxZ: D / 2 - 0.8 };
        const lam = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
        // floor (checker-ish via canvas)
        const floorTex = makeCanvasTexture(256, 256, (ctx) => {
            ctx.fillStyle = '#2c3038'; ctx.fillRect(0, 0, 256, 256);
            ctx.fillStyle = '#31353e'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) ctx.fillRect(i * 64, j * 64, 64, 64);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i <= 256; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke(); }
        });
        floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(W / 4, D / 4);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.5, metalness: 0.1 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);
        const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), lam('#3b3f48')); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; this.scene.add(ceil);
        // walls
        const wallMat = lam('#5a6170');
        const mk = (w, h, d, x, y, z, m = wallMat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.receiveShadow = true; b.castShadow = true; this.scene.add(b); return b; };
        mk(W, H, 0.3, 0, H / 2, -D / 2); mk(0.3, H, D, -W / 2, H / 2, 0); mk(0.3, H, D, W / 2, H / 2, 0);
        // front wall with door opening
        mk(W / 2 - 2, H, 0.3, -(W / 4 + 1), H / 2, D / 2); mk(W / 2 - 2, H, 0.3, (W / 4 + 1), H / 2, D / 2); mk(4, H - 2.6, 0.3, 0, H - (H - 2.6) / 2, D / 2);
        // windows on side walls (emissive panes = daylight)
        const paneMat = new THREE.MeshBasicMaterial({ color: s.city === 'seattle' ? '#aeb9c6' : '#f6c177' });
        for (let z = -12; z <= 12; z += 6) { const p = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), paneMat); p.position.set(-W / 2 + 0.2, 2.4, z); p.rotation.y = Math.PI / 2; this.scene.add(p); const p2 = p.clone(); p2.position.x = W / 2 - 0.2; p2.rotation.y = -Math.PI / 2; this.scene.add(p2); }
        // lobby sign on back wall
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: makeCanvasTexture(1024, 256, (ctx) => {
            ctx.fillStyle = '#0f1115'; ctx.fillRect(0, 0, 1024, 256); ctx.fillStyle = '#' + accent.getHexString(); ctx.fillRect(0, 236, 1024, 20);
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let f = 84; ctx.font = `bold ${f}px Helvetica, Arial`; while (ctx.measureText(s.company).width > 960 && f > 30) { f -= 4; ctx.font = `bold ${f}px Helvetica, Arial`; }
            ctx.fillText(s.company, 512, 95); ctx.font = '44px Helvetica, Arial'; ctx.fillStyle = '#cbd5e1'; ctx.fillText(`${s.role} · ${s.period}`, 512, 180);
        }) }));
        sign.position.set(0, 2.55, -D / 2 + 0.2); this.scene.add(sign);
        // accent stripe
        mk(W, 0.08, 0.1, 0, 1.1, -D / 2 + 0.2, new THREE.MeshBasicMaterial({ color: accent }));
        // reception desk
        mk(6, 1.1, 1.4, 0, 0.55, -D / 2 + 5, lam('#5b4636'));
        const plant = (x, z) => { mk(0.6, 0.6, 0.6, x, 0.3, z, lam('#8a5a3c')); const l = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), lam('#3f8f4a')); l.position.set(x, 1.2, z); this.scene.add(l); };
        plant(-W / 2 + 1.5, D / 2 - 1.5); plant(W / 2 - 1.5, D / 2 - 1.5); plant(-W / 2 + 1.5, -D / 2 + 1.5); plant(W / 2 - 1.5, -D / 2 + 1.5);
        // desks with monitors (decor)
        for (let r = 0; r < 3; r++) for (const x of [-9, 9]) {
            const z = -4 + r * 6;
            mk(5, 0.08, 1.6, x, 0.75, z, lam('#d8d2c8')); mk(0.2, 0.75, 0.2, x - 2.2, 0.37, z, lam('#777')); mk(0.2, 0.75, 0.2, x + 2.2, 0.37, z, lam('#777'));
            for (const dx of [-1.3, 1.3]) { mk(1.1, 0.65, 0.05, x + dx, 1.2, z - 0.4, new THREE.MeshBasicMaterial({ color: '#1e3a8a' })); mk(0.9, 0.9, 0.9, x + dx, 0.45, z + 1.3, lam('#2f3540')); }
        }
        // stations
        const n = s.stations.length;
        s.stations.forEach((st, i) => {
            const side = i % 2 === 0 ? -1 : 1;
            const z = -8 + Math.floor(i / 2) * 8 + (n <= 2 ? 4 : 0);
            const x = side * 3.6;
            const g = new THREE.Group();
            const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.5), lam('#20242c')); pedestal.position.y = 0.5; g.add(pedestal);
            const tex = makeCanvasTexture(512, 320, (ctx) => {
                ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, 512, 320);
                ctx.fillStyle = '#' + accent.getHexString(); ctx.fillRect(0, 0, 512, 12);
                ctx.fillStyle = '#fff'; ctx.font = 'bold 40px Helvetica, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                const words = st.title.split(' '); let line = '', lines = [];
                for (const w of words) { if (ctx.measureText(line + ' ' + w).width > 460) { lines.push(line); line = w; } else line = (line + ' ' + w).trim(); } lines.push(line);
                lines.forEach((l, k) => ctx.fillText(l, 256, 130 + (k - (lines.length - 1) / 2) * 48));
                ctx.font = '26px Helvetica, Arial'; ctx.fillStyle = '#93c5fd'; ctx.fillText('Press E to read', 256, 270);
            });
            const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshBasicMaterial({ map: tex }));
            screen.position.set(0, 1.9, 0.26); g.add(screen);
            const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.1), lam('#0f1115')); frame.position.set(0, 1.9, 0.2); g.add(frame);
            const glow = new THREE.PointLight(accent, 0.0, 6); glow.position.set(0, 2.2, 1); g.add(glow);
            g.position.set(x, 0, z); g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; // face the center aisle
            this.scene.add(g);
            this.stations.push({ data: st, x, z, mesh: g, glow, screen, index: i });
        });
        // exit mat
        const exit = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.5), new THREE.MeshBasicMaterial({ map: makeCanvasTexture(256, 128, (ctx) => { ctx.fillStyle = '#334155'; ctx.fillRect(0, 0, 256, 128); ctx.fillStyle = '#fff'; ctx.font = 'bold 40px Helvetica'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('EXIT ▸', 128, 64); }) }));
        exit.rotation.x = -Math.PI / 2; exit.position.set(0, 0.02, D / 2 - 1.6); this.scene.add(exit);
        this.exitZ = D / 2 - 1.6;
        // lights
        this.scene.add(new THREE.HemisphereLight('#e2e8f0', '#3a3d45', 1.8));
        const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(6, 10, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = -20; key.shadow.camera.right = 20; key.shadow.camera.top = 20; key.shadow.camera.bottom = -20; this.scene.add(key);
        for (let z = -12; z <= 12; z += 8) { const l = new THREE.PointLight('#fff2dd', 70, 22, 1.4); l.position.set(0, H - 0.3, z); this.scene.add(l); }
        this.x = 0; this.z = D / 2 - 3; this.heading = 0;
    }

    update(dt) {
        this.t += dt;
        const inp = this.input;
        if (!this.hud.panelOpen) {
            this.heading -= inp.steer * 1.9 * dt;
            const target = inp.throttle * 4.2;
            this.vel = damp(this.vel, target, 8, dt);
            this.x -= Math.sin(this.heading) * this.vel * dt; this.z -= Math.cos(this.heading) * this.vel * dt;
            this.x = clamp(this.x, this.bounds.minX, this.bounds.maxX); this.z = clamp(this.z, this.bounds.minZ, this.bounds.maxZ);
            // station collision
            for (const st of this.stations) { const dx = this.x - st.x, dz = this.z - st.z; const d = Math.hypot(dx, dz); if (d < 1.1) { this.x = st.x + dx / d * 1.1; this.z = st.z + dz / d * 1.1; } }
        }
        this.camRig.position.set(this.x, 1.65 + Math.sin(this.t * 7) * 0.02 * Math.abs(this.vel) / 4, this.z);
        this.camRig.rotation.y = this.heading;
        this.camera.fov = damp(this.camera.fov, 70, 5, dt); this.camera.updateProjectionMatrix();
        // nearest station
        let near = null, nd = 3.2;
        for (const st of this.stations) { const d = Math.hypot(this.x - st.x, this.z - st.z); st.glow.intensity = damp(st.glow.intensity, d < nd ? 2.5 : (this.read.has(st.index) ? 0.3 : 1.0), 6, dt); if (d < nd) { nd = d; near = st; } }
        const atExit = this.z > this.exitZ - 1.6 && Math.abs(this.x) < 2.5;
        if (this.hud.panelOpen) { this.hud.prompt(null); }
        else if (near) { this.hud.prompt(`<kbd>E</kbd> ${this.read.has(near.index) ? 'Re-read' : 'Read'}: <b>${near.data.title}</b>`); if (inp.take('KeyE')) this.open(near); }
        else if (atExit) { this.hud.prompt(`<kbd>E</kbd> Leave ${this.stop.short} ${this.read.size < this.stations.length ? `<small>(${this.stations.length - this.read.size} screens unread)</small>` : '✓'}`); if (inp.take('KeyE')) this.done = true; }
        else this.hud.prompt(null);
        if (inp.take('Escape') && !this.hud.panelOpen) this.done = true;
        this.hud.setHint(`${this.read.size}/${this.stations.length} screens read · W/S walk · A/D turn · E read · Esc leave`);
    }

    open(st) {
        this.read.add(st.index);
        this.audio.blip(990, 0.1, 0.1);
        const d = st.data;
        const body = d.chips ? `<div class="chips">${d.chips.map(c => `<span class="chip">${c}</span>`).join('')}</div>` : `<ul>${d.lines.map(l => `<li>${l}</li>`).join('')}</ul>`;
        this.hud.panel(`<div class="eyebrow" style="color:${this.stop.color}">${this.stop.icon || ''} ${this.stop.company}</div><h2>${d.title}</h2>${body}<div class="meta">${this.stop.role} · ${this.stop.period}</div>`);
    }

    render() { this.renderer.render(this.scene, this.camera); }
    dispose() { this.camRig.remove(this.camera); this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
}
