// Camera-held activities: actions advance only after their visible animation finishes.
// Venue locations are supplied by source-backed scene interactions; no street furniture is added.
import * as THREE from '../../vendor/three.module.min.js';
import { canvas, canvasTexture, disposeTree } from './kit.js';
import { bucActivity } from './buc.js';

const CSS = `.sp-venue{position:absolute;left:20px;bottom:24px;width:min(400px,calc(100vw - 24px));box-sizing:border-box;padding:14px 16px;background:rgba(19,24,27,.97);border:1px solid #d6b76b;border-radius:14px;color:#fff;pointer-events:auto;box-shadow:0 8px 30px #0007;font:14px/1.4 system-ui}.sp-venue h2{font-size:17px;margin:0 0 2px}.sp-venue small{display:block;color:#d6d3c9}.sp-venue p{margin:9px 0}.sp-venue progress{width:100%;height:8px;accent-color:#fbbf24}.sp-venue nav{display:flex;gap:8px;margin-top:10px}.sp-venue button{min-height:44px;padding:9px 14px;border:0;border-radius:8px;background:#fbbf24;color:#201a0c;font:700 14px system-ui;cursor:pointer}.sp-venue button:disabled{background:#494c4c;color:#ddd;cursor:default}.sp-venue button[data-cancel]{background:#3d454b;color:#fff}.sp-venue button:focus-visible{outline:3px solid #fff;outline-offset:3px}@media(max-width:600px),(max-height:500px){.sp-venue{left:12px;top:106px;bottom:auto;padding:10px 12px}.sp-venue p{margin:5px 0}.sp-venue nav{margin-top:6px}}`;
const smooth = (v) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };

function props() {
    const root = new THREE.Group(); root.name = 'venue-held-props'; root.visible = false;
    const materials = new Map();
    const mat = (colour, extra = {}) => { const key = colour + JSON.stringify(extra); if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color: colour, roughness: .72, ...extra })); return materials.get(key); };
    const mesh = (parent, geo, material, x, y, z) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.frustumCulled = false; parent.add(m); return m; };
    const cyl = (p, a, b, h, colour, x, y, z, n = 12) => mesh(p, new THREE.CylinderGeometry(a, b, h, n), mat(colour), x, y, z);
    const hand = (parent) => {
        const g = new THREE.Group(); parent.add(g);
        const arm = cyl(g, .048, .065, .28, '#a87555', 0, -.18, .09); arm.rotation.x = -.6;
        mesh(g, new THREE.SphereGeometry(.066, 10, 6), mat('#c38d68'), 0, -.025, 0).scale.set(.78, 1.2, .65);
        for (let i = 0; i < 4; i++) { const f = cyl(g, .012, .014, .074, '#c38d68', -.033 + i * .021, .012, -.04, 6); f.rotation.x = .55; }
        return g;
    };
    const food = new THREE.Group(); food.name = 'shaorma-and-hand'; root.add(food); hand(food);
    cyl(food, .072, .042, .21, '#e8e4d9', 0, .065, 0); // paper sleeve
    const tortilla = canvas(128, 128), ink = tortilla.getContext('2d');
    ink.fillStyle = '#dbb376'; ink.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 35; i++) { ink.fillStyle = i % 3 ? '#b47c43' : '#956139'; ink.beginPath(); ink.ellipse((i * 47 + 11) % 128, (i * 71 + 19) % 128, 2 + i % 4, 1 + i % 3, i, 0, Math.PI * 2); ink.fill(); }
    const toasted = new THREE.MeshStandardMaterial({ map: canvasTexture(tortilla), roughness: .88 });
    const bites = [];
    for (let i = 0; i < 3; i++) {
        const chunk = new THREE.Group(); chunk.position.y = .19 + i * .068; food.add(chunk); bites.push(chunk);
        mesh(chunk, new THREE.CylinderGeometry(.075, .07, .067, 12), toasted, 0, 0, 0);
        // Open top: flat toasted meat, lettuce, tomato and sauce pieces, all procedural.
        for (let j = 0; j < 8; j++) { const a = j * 2.4, r = j ? .037 : 0; const f = mesh(chunk, new THREE.BoxGeometry(.027, .014, .025), mat(['#75462b', '#82a447', '#d66543', '#f0dbb0'][j % 4]), Math.cos(a) * r, .036, Math.sin(a) * r); f.rotation.y = a; }
    }
    const shot = new THREE.Group(); shot.name = 'shot-and-hand'; root.add(shot); hand(shot);
    const glass = mesh(shot, new THREE.CylinderGeometry(.054, .035, .115, 16, 1, true), mat('#c7e6ed', { transparent: true, opacity: .35, roughness: .12, side: THREE.DoubleSide, depthWrite: false }), 0, .078, 0);
    cyl(shot, .036, .036, .012, '#b4d0d7', 0, .025, 0);
    const rim = mesh(shot, new THREE.TorusGeometry(.054, .004, 4, 16), mat('#e0f3f5', { roughness: .15 }), 0, .136, 0); rim.rotation.x = Math.PI / 2;
    const liquid = cyl(shot, .043, .032, .075, '#dba448', 0, .07, 0, 16);
    const bottle = new THREE.Group(); bottle.name = 'pouring-bottle-and-hand'; root.add(bottle); hand(bottle);
    cyl(bottle, .06, .06, .23, '#304d47', 0, .09, 0);
    cyl(bottle, .023, .056, .045, '#304d47', 0, .228, 0);
    cyl(bottle, .021, .021, .08, '#78988b', 0, .285, 0);
    cyl(bottle, .061, .061, .07, '#e9dfbd', 0, .08, 0);
    const stream = cyl(root, .008, .008, .17, '#e8bd64', -.18, -.08, -.65, 6); stream.visible = false;
    return { root, food, bites, shot, glass, liquid, bottle, stream };
}

export function createVenueActivities(ctx) {
    const owner = new THREE.Group(); owner.name = 'old-town-venue-activities'; ctx.add(owner);
    const p = props(); owner.add(p.root);
    let run = null, disposed = false, lastCancel = null;
    const foodSteps = ['Take the first bite', 'One more bite', 'Finish the shaorma'];
    const shotSteps = ['Pour the shot', 'Raise it: Noroc!', 'Drink the shot'];
    const steps = () => run.kind === 'shaorma' ? foodSteps : shotSteps;
    const duration = () => run.kind === 'shaorma' ? 1.8 : [2.2, 1.6, 2.2][run.step];
    function restore() {
        if (!run) return;
        const { s, ctlActive, ui } = run;
        s.ctl.active = ctlActive; s.input?.take?.('KeyE'); s.input?.keys?.delete?.('KeyE');
        s.input?.takeLook?.(); s.input?.take?.('Space');
        ui.remove(); p.root.visible = false; owner.add(p.root);
        if (ui.contains(document.activeElement)) document.activeElement.blur?.();
        run = null;
    }
    function cancel(reason = 'cancel') { if (!run) return; lastCancel = reason; restore(); }
    function blocked(s) {
        const g = window.game;
        return document.hidden || s.ui.panelOpen || s.host.photo?.active || s.host.explore?.drone?.active ||
            g?.pauseOpen || g?.hud?.panelOpen || (g?.spot === s && g.state !== 'spot');
    }
    function act() {
        if (!run || run.animating || run.intro > 0 || blocked(run.s)) return;
        run.animating = true; run.t = 0; run.button.disabled = true;
        run.status.textContent = run.kind === 'shaorma' ? 'Lift, bite… savour.' : ['A steady pour…', 'Noroc! Cheers!', 'Lift, tilt… and lower.'][run.step];
    }
    function render() {
        if (!run) return;
        const r = run, u = r.animating ? Math.min(1, r.t / duration()) : 0;
        const lift = smooth(u / .35) * (1 - smooth((u - .68) / .32));
        p.food.visible = r.kind === 'shaorma'; p.shot.visible = p.bottle.visible = r.kind === 'shot'; p.stream.visible = false;
        const foodSide = r.s.camera.aspect < .75 ? .04 : .15;
        p.food.position.set(foodSide - Math.min(.12, foodSide) * lift, -.4 + .25 * lift, -.72 + .22 * lift);
        p.food.rotation.set(.25 + .35 * lift, -.15, -.12 + .15 * lift);
        p.bites.forEach((b, i) => { b.visible = i < 3 - r.step - (r.animating && u >= .5 ? 1 : 0); });
        p.shot.position.set(-.15, -.27, -.63); p.shot.rotation.set(0, 0, 0);
        p.bottle.position.set(.2, -.22, -.66); p.bottle.rotation.set(0, 0, 0);
        let fill = r.step > 0 ? 1 : 0;
        if (r.kind === 'shot' && r.animating) {
            if (r.step === 0) {
                const tilt = smooth(u / .25) * (1 - smooth((u - .78) / .22));
                p.bottle.position.set(.2 + .01 * tilt, -.22 + .24 * tilt, -.63);
                p.bottle.rotation.z = 1.75 * tilt;
                fill = smooth((u - .25) / .48);
                p.stream.visible = u > .25 && u < .73;
                const a = new THREE.Vector3(0, .325, 0).applyEuler(p.bottle.rotation).add(p.bottle.position), b = new THREE.Vector3(-.15, -.134, -.63);
                p.stream.position.copy(a).add(b).multiplyScalar(.5); p.stream.scale.y = a.distanceTo(b) / .17;
                p.stream.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.sub(b).normalize());
            } else if (r.step === 1) {
                p.shot.position.y += lift * .32; p.shot.position.x += Math.sin(u * Math.PI) * .06;
                p.shot.rotation.z = -.13 * lift;
            } else {
                p.shot.position.set(-.15 + .12 * lift, -.27 + .28 * lift, -.63 + .34 * lift);
                p.shot.rotation.x = 1.6 * lift; fill = 1 - smooth((u - .35) / .27);
            }
        }
        p.liquid.visible = fill > .01; p.liquid.scale.y = Math.max(.001, fill); p.liquid.position.y = .033 + .0375 * fill;
        // Lower the unused pouring hand once the glass is full.
        if (r.kind === 'shot' && r.step > 0) p.bottle.visible = false;
        const intro = smooth(1 - r.intro / .4); p.root.position.y = -.3 * (1 - intro);
        r.progress.value = r.step + (r.animating ? u : 0);
    }
    function update(dt, s) {
        if (!run) return;
        if (blocked(s) || s !== run.s || s.spot.id !== run.spot || Math.hypot(s.position.x - run.x, s.position.z - run.z) > 3) { cancel('mode-or-distance'); return; }
        s.input?.takeLook?.(); s.input?.take?.('Space'); // discard look/jump queued while the activity owns the walker
        if (s.input?.take?.('Escape')) { cancel('escape'); return; }
        if (s.input?.take?.('KeyE')) act();
        run.intro = Math.max(0, run.intro - dt);
        if (run.animating) {
            run.t += Math.max(0, Math.min(.1, dt));
            if (run.t >= duration()) {
                run.step++; run.animating = false;
                if (run.step === 3) {
                    const { kind } = run; restore();
                    bucActivity(s, 'old-town-lipscani', kind === 'shaorma' ? 'dristor-shaorma' : 'shoteria-shot', kind === 'shaorma' ? '🥙 Poftă bună!' : '🥂 Noroc!', kind === 'shaorma' ? 'Shaorma finished at Dristor Kebap, Strada Franceză 17.' : 'Poured, raised and finished a shot at Shoteria, Strada Șelari 17.');
                    return;
                }
                run.status.textContent = `${run.step}/3 · ${run.kind === 'shaorma' ? 'A little less shaorma, a little more Old Town.' : run.step === 1 ? 'Glass filled. Time for a toast.' : 'A toast to the Old Town.'}`;
                run.button.textContent = steps()[run.step] + ' (E)';
            }
        }
        if (run) { run.button.disabled = run.animating || run.intro > 0; render(); }
    }
    const key = (e) => {
        // Native button activation keeps Space/Enter out of the walker's action queue.
        if (run?.ui.contains(e.target) && ['Space', 'Enter'].includes(e.code)) { e.stopImmediatePropagation(); return; }
        if (!run || !['KeyE', 'Escape'].includes(e.code)) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.type === 'keyup') return;
        if (e.code === 'Escape') cancel('escape'); else if (!e.repeat) act();
    };
    const visibility = () => { if (document.hidden) cancel('hidden'); };
    window.addEventListener('keydown', key, true); window.addEventListener('keyup', key, true);
    document.addEventListener('visibilitychange', visibility);
    ctx.onUpdate(update);
    const api = {
        get active() { return !!run; }, get disposed() { return disposed; }, get lastCancel() { return lastCancel; },
        debug: () => run ? { kind: run.kind, step: run.step, animating: run.animating, t: run.t, fill: p.liquid.scale.y, bites: p.bites.filter(b => b.visible).length, hand: p.food.position.toArray() } : null,
        cancel,
        start(s, kind, venue) {
            if (disposed || run || s.ctl.active === false || blocked(s) || s.spot.id !== 'old-town-lipscani') return false;
            if (!document.getElementById('sp-venue-css')) { const st = document.createElement('style'); st.id = 'sp-venue-css'; st.textContent = CSS; document.head.append(st); }
            const ui = document.createElement('section'); ui.className = 'sp-venue'; ui.setAttribute('aria-label', `${venue.name} activity`);
            ui.innerHTML = '<h2></h2><small></small><p aria-live="polite"></p><progress max="3" value="0" aria-label="Activity progress"></progress><nav><button data-act></button><button data-cancel>Leave</button></nav>';
            ui.querySelector('h2').textContent = kind === 'shaorma' ? '🥙 Dristor Kebap' : '🥂 Shoteria';
            ui.querySelector('small').textContent = venue.address;
            const button = ui.querySelector('[data-act]'), status = ui.querySelector('p'), progress = ui.querySelector('progress');
            run = { s, kind, spot: s.spot.id, x: s.position.x, z: s.position.z, step: 0, t: 0, intro: .4, animating: false, ctlActive: s.ctl.active, ui, button, status, progress };
            s.endTour?.(); s.ctl.active = false; s.input.releaseLock?.(); s.input.take?.('KeyE'); s.ui.prompt(null);
            s.ui.el.append(ui); button.textContent = steps()[0] + ' (E)'; status.textContent = kind === 'shaorma' ? 'Three bites. Take your time.' : 'Pour, raise, then drink. Three small actions.';
            button.onclick = act; ui.querySelector('[data-cancel]').onclick = () => cancel('leave');
            p.root.visible = true; s.camera.add(p.root); render(); return true;
        },
        dispose() {
            if (disposed) return; cancel('exit'); disposed = true;
            window.removeEventListener('keydown', key, true); window.removeEventListener('keyup', key, true); document.removeEventListener('visibilitychange', visibility);
            // Scene disposal owns parked geometry; explicit disposal also works while a view is camera-attached.
            disposeTree(p.root); p.root.removeFromParent();
        },
    };
    owner.addEventListener('removed', api.dispose);
    ctx.extras.venueActivities = api;
    return api;
}
