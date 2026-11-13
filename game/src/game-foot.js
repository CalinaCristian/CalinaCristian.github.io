// Game methods: on foot — leaving and re-entering the car, the car finder / call the car, parking
// tickets, clamps and towing, the walking update and talking to pedestrians. Installed on Game.prototype by
// main.js (mixin).
import { canTravel, isMotorway, roadName, fmtDist, stepText, stepArrow, roadSideWidth, roadWidthAt } from './nav.js';
import { clamp, angleDiff } from './util.js';
import { OnFootController } from './onfoot.js';
import { $, makeVehicle, money, PRICES } from './game-common.js';

export class FootMethods {
    // ---------------------------------------------------------------- talking to people on foot (after round 6)
    /** data/dialogue.json: city lines {p, ctx, text, orig?, lang?, when?, wx?, season?} + culture tips, loaded once */
    talkData() {
        if (!this._talkP) this._talkP = fetch(new URL('../data/dialogue.json', import.meta.url).href).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => (this._talkD = d));
        const key = this.city?.id === 'bucharest' ? 'bucharest' : 'seattle';
        return this._talkD?.[key] || null;
    }
    /** a stable persona for a city pedestrian (no personas in the traffic crowd) */
    pedPersona(p) {
        if (p.persona) return p.persona;
        const h = ((p.i ?? 0) * 2654435761 >>> 0) % 100, buc = this.city?.id === 'bucharest';
        p.persona = buc ? (h < 38 ? 'local' : h < 62 ? 'local_young' : h < 80 ? 'local_elder' : 'tech') : (h < 50 ? 'local' : h < 78 ? 'tech' : h < 92 ? 'tourist_us' : 'kid');
        p.talkWho = { local: 'the local', local_young: 'the local', local_elder: 'the older local', tech: 'the office worker', tourist_us: 'the visitor', kid: 'the kid' }[p.persona] || 'them';
        return p.persona;
    }
    talkFits(l) {
        const h = this.trafficHours(), m = this.nowDate().getMonth(), d = this.nowDate().getDate(), k = this.wxKind || '';
        if (l.when === 'morning' && !(h >= 5 && h < 11)) return false;
        if (l.when === 'evening' && !(h >= 18 || h < 4)) return false;
        if (l.when === 'day' && !(h >= 9 && h < 19)) return false;
        if (l.wx === 'rain' && !/rain|drizzle|storm|shower/.test(k)) return false;
        if (l.wx === 'snow' && !/snow/.test(k)) return false;
        if (l.wx === 'hot' && !(m >= 5 && m <= 7)) return false;
        if (l.wx === 'cold' && !(m === 11 || m <= 1)) return false;
        if (l.season === 'xmas' && !(m === 11 || (m === 10 && d >= 25))) return false;
        if (l.season === 'march' && !(m === 2 && d <= 9)) return false;
        if (l.season === 'winter' && !(m === 11 || m <= 1)) return false;
        if (l.season === 'spring' && !(m >= 2 && m <= 4)) return false;
        if (l.season === 'summer' && !(m >= 5 && m <= 8)) return false;
        return true;
    }
    /** a line in this persona's voice (then its family, then anyone's), for the first context with one; no recent repeats */
    talkLine(persona, ctxs) {
        const D = this.talkData(); if (!D) return null;
        const fam = (k) => (k || '').replace(/_.*$/, ''), recent = this._talkRecent || (this._talkRecent = []), fresh = (l) => !recent.includes(l);
        for (const c of ctxs) {
            const all = D.lines.filter((l) => l.ctx === c && !l.spot && this.talkFits(l)); // (spot-tagged lines belong to that tourist spot)
            for (const pool of [all.filter((l) => l.p === persona), all.filter((l) => fam(l.p) === fam(persona)), all.filter((l) => !l.p)]) {
                const f = pool.filter(fresh), pick = (f.length ? f : pool)[Math.floor(Math.random() * (f.length ? f.length : pool.length))];
                if (pick) { recent.push(pick); if (recent.length > 10) recent.shift(); return pick; }
            }
        }
        return null;
    }
    /** the pedestrian the walker is facing, within 2.4 m */
    talkTarget(F) {
        const peds = this.traffic?.peds; if (!peds) return null;
        let best = null, bd = 2.4;
        for (const p of peds.near(F.x, F.z, 2.6)) { if (p.state === 'down' || p.hidden || p.agent || p.react) continue; const dx = p.x - F.x, dz = p.z - F.z, d = Math.hypot(dx, dz); if (d < bd && d > 0.2 && (dx * F.fx + dz * F.fz) / d > 0.35) { bd = d; best = p; } }
        if (best) this.pedPersona(best);
        return best;
    }
    /** E on a passer-by: they stop, face you and answer — greeting, then street talk, a local custom as a tip, small talk */
    talkToPed(p, F) {
        const persona = this.pedPersona(p); p.talkN = (p.talkN || 0) + 1; p.talkT = 6; p.talkTo = F; p.talkWave = p.talkN === 1 ? 1.4 : 0;
        const order = p.talkN === 1 ? ['greeting', 'street', 'idle'] : p.talkN === 2 ? ['street', 'idle'] : ['idle', 'street'];
        const l = this.talkLine(persona, order),dialogueEvent=this.traffic.dialogueEvent('greeting',F,{target:p,targetRole:'pedestrian'});
        if (l) this.traffic.say(p, { t: l.orig || l.text, en: l.orig ? l.text : '' }, '', 3,{situational:true,event:dialogueEvent,role:'pedestrian'});
        else this.traffic.speakSituational(dialogueEvent,p,'pedestrian');
        const tips = this.talkData()?.culture || [];
        if (p.talkN >= 2 && tips.length && /^(local|tech)/.test(persona) && Math.random() < 0.6) {
            const tp = tips[((p.i ?? 0) * 7 + p.talkN * 3) % tips.length]; let n = String(tp.note || ''); const cut = n.lastIndexOf('. ', 230);
            if (n.length > 230) n = cut > 80 ? n.slice(0, cut + 1) : n.slice(0, 230) + '…';
            this.hud.toast('💬 Local tip — ' + tp.topic, n);
        }
        this.stats.talks = (this.stats.talks || 0) + 1;
        window.cvTelemetry?.track?.('ped_talk', { city: this.city?.id });
    }
    /** passers-by chat now and then while you walk (one bubble every 7–14 s, someone 4–22 m away) */
    streetChatter(F, dt) {
        this._chatT = (this._chatT ?? 6) - dt; if (this._chatT > 0) return; this._chatT = 7 + Math.random() * 7;
        const peds = (this.traffic?.peds?.near(F.x, F.z, 22) || []).filter((p) => p.state !== 'down' && !p.hidden && !p.agent && !p.react && !(p.talkT > 0) && Math.hypot(p.x - F.x, p.z - F.z) > 4);
        if (!peds.length) return; const p = peds[Math.floor(Math.random() * peds.length)];
        const l = this.talkLine(this.pedPersona(p), Math.random() < 0.6 ? ['street', 'idle'] : ['idle', 'street']),dialogueEvent=this.traffic.dialogueEvent('ambient',p,{sourceRole:'pedestrian'});
        if (l) this.traffic.say(p, { t: l.orig || l.text, en: l.orig ? l.text : '' }, '', 1,{situational:true,event:dialogueEvent,role:'pedestrian'});
        else this.traffic.speakSituational(dialogueEvent,p,'pedestrian');
    }
    /** HUD chip "🚗 120 m ↗" while on foot away from the car */
    updateCarFinder() {
        let el = document.getElementById('car-finder');
        const F = this.foot, P = this.player, on = this.state === 'foot' && F?.active && this.carBody?.parent;
        const d = on ? Math.hypot(P.x - F.x, P.z - F.z) : 0;
        if (!on || d < 4) { if (el) el.classList.remove('show'); return; }
        if (!el) { el = document.createElement('button'); el.id = 'car-finder'; el.title = 'Back to your car (V) — T: call it to the kerb, map: walking route'; el.addEventListener('click', (e) => { e.preventDefault(); el.blur(); this.backToCar(); }); $('#hud')?.appendChild(el); }
        const rel = angleDiff(F.heading, Math.atan2(-(P.x - F.x), -(P.z - F.z)));
        const arrow = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'][((Math.round(-rel / (Math.PI / 4)) % 8) + 8) % 8];
        const t = `🚗 ${fmtDist(d, this.city.units)} ${arrow} · Back to car${this.touch ? '' : ' (V)'}`; if (el.textContent !== t) el.textContent = t;
        el.classList.add('show');
    }
    /** on foot → straight back behind the wheel (round 6 note 9): the car pulls up at the kerb next to you when there is a
     *  street close by, otherwise you are back in it where you left it */
    backToCar() {
        if (this.state !== 'foot' || !this.foot?.active) return false;
        const F = this.foot, pose = this.lanePose(F.x, F.z, F.heading, (F.y ?? 0) + 0.24);
        if (pose && Math.hypot(pose.x - F.x, pose.z - F.z) <= 60) this.callCar();
        this.enterCar(); this.hud.toast('🚗 Back in your car', '');
        return true;
    }
    /** walking route back to the car's driver door */
    routeToCar() {
        if (!this.foot?.active) return;
        const door = this.carDoor(), F = this.foot;
        this.setNavDest({ x: door.x, z: door.z, label: 'Your car' }, true);
        this.hud.toast('🚗 Route to your car', `${fmtDist(Math.hypot(door.x - F.x, door.z - F.z), this.city.units)} · the blue line on the map`);
    }
    /** call the car: it drives itself to the nearest lane spot next to the player (on foot, > 25 m away) */
    callCar() {
        const F = this.foot, P = this.player; if (!F?.active || !this.carBody) return false;
        const pose = this.lanePose(F.x, F.z, F.heading, (F.y ?? 0) + 0.24); if (!pose) { this.hud.toast('🚗 No road here', 'Walk to a street first.', 'warn'); return false; }
        if (Math.hypot(pose.x - F.x, pose.z - F.z) > 60) { this.hud.toast('🚗 Too far from a road', 'Walk closer to a street.', 'warn'); return false; }
        P.place(pose.x, pose.z, pose.heading, pose.edge); P.speed = 0;
        this.traffic.clearForPlayer?.(P, { r: 8, ahead: 15, behind: 8 });
        this.carBody.position.set(P.x, P.surfY ?? 0.24, P.z); this.carBody.rotation.set(0, P.heading, 0);
        this.carBox = { ...this.carBox, x: P.x, z: P.z, fx: P.fx, fz: P.fz };
        this.hud.toast('🚗 Your car is here', 'It pulled up at the kerb next to you.');
        if (this.navManual && this.nav.dest?.label === 'Your car') { this.navManual = false; this.autoRoute(true); }
        return true;
    }



    // ---------------------------------------------------------------------------------- on foot (spec 14)
    /** Enter (touch: 🚶): get out on the driver's side; the car stays (hazards on) and is an obstacle for traffic */
    exitCar() {
        this.talkData(); // (preload the passers-by's lines)
        const P = this.player;
        if (this.state !== 'drive' || this.refuel) return false;
        if (Math.abs(P.speed) > 1.5) { this.hud.toast('🚶 Stop first', 'Get out when the car is (almost) stopped.', 'warn'); return false; }
        this.photo?.close?.();
        P.speed = 0; P.steer = 0;
        // the parked car: drawn by the shared fleet InstancedMeshes (the classic per-car meshes of the new models render as a grey veil over the view on foot)
        if (!this.carBody) { this.carBody = makeVehicle('hatch', '#1e3a8a', { instanced: true, city: this.city.id }); this.carBody.userData.parked = true; }
        this.carBody.position.set(P.x, P.surfY ?? 0.24, P.z); this.carBody.rotation.set(0, P.heading, 0);
        this.scene.add(this.carBody); this.setDriveRigShown(false);
        const len = this.carBody.userData.length || 4.2, wid = this.carBody.userData.width || 1.8;
        this.carBox = { x: P.x, z: P.z, fx: P.fx, fz: P.fz, length: len, width: wid };
        if (!this.foot) this.foot = new OnFootController({ scene: this.scene, camera: this.camera, input: this.input, audio: this.audio });
        Object.assign(this.foot, { scene: this.scene, colliders: this.world.buildings, world: this.world, traffic: this.traffic, obstacles: () => (this.carBox ? [this.carBox] : []) });
        // driver's door: left side (left-hand drive), a bit ahead of the centre
        const lx = P.fz, lz = -P.fx;
        this.foot.enter(P.x + lx * (wid / 2 + 0.55) + P.fx * 0.4, P.z + lz * (wid / 2 + 0.55) + P.fz * 0.4, P.heading, (P.surfY ?? 0.24) - 0.24);
        this.traffic.walker = this.foot;
        this.state = 'foot'; document.body.classList.add('on-foot');
        this.nav.walking = true; if (this.nav.dest) this.nav.reroute({ x: this.foot.x, z: this.foot.z, heading: this.foot.heading }); // walking routes: no one-way rules
        if (!document.getElementById('onfoot-css')) { const st = document.createElement('style'); st.id = 'onfoot-css'; st.textContent = 'body.on-foot .pad button.office-only{display:inline-block}body.on-foot .pad button.drive-only{display:none}'; document.head.appendChild(st); }
        this.audio.stopEngine?.(); this.audio.blip(300, 0.06, 0.08);
        this.hud.setLimit(null, this.city.units === 'mph', false); this.hud.setSpeed(0);
        if (!this.flags.footToast) { this.flags.footToast = true; this.hud.toast('🚶 On foot', this.touch ? 'Drag the left side to walk and the right side to look. Tap Run to run, ⤒ to jump, Use to interact, and 🚶 at the driver’s door to get in.' : 'WASD walk · Shift run · Space jump · mouse look · Enter at the driver\'s door to get back in · E enters offices.', 'intro'); }
        this.input.flush();
        return true;
    }
    /** the HUD minimap centred on any position (walker, drone — round 6 note 43) */
    drawMiniAt(x, z, heading, scale = 0.3) {
        if (!this.opts.minimap || !this.minimap) return;
        const fx = -Math.sin(heading), fz = -Math.cos(heading);
        this.minimap.draw({ cx: x, cz: z, scale, heading, player: { x, z, heading, fx, fz }, pois: this.world.pois, objective: this.objective });
        this.drawRouteOverlay(this.minimap.ctx, $('#minimap'), { cx: x, cz: z, scale, heading });
    }
    /** (round 6 note 37) hide / show the driven car's own meshes without hiding its headlight spot lights: a change in the
     *  number of visible lights makes three.js recompile every material — a 3–5 s freeze on every "get out" at night */
    setDriveRigShown(on) {
        const rig = this.player?.rig; if (!rig) return;
        this.player.driveRigShown = !!on;
        rig.visible = true;
        rig.traverse((o) => {
            if (o.isLight) { if (!on) { o.userData._int ??= o.intensity; o.intensity = 0; } else if (o.userData._int != null) { o.intensity = o.userData._int; o.userData._int = null; } return; }
            if (o.isMesh || o.isLine || o.isPoints || o.isSprite) { if (!on) { if (o.userData._vis == null) o.userData._vis = o.visible; o.visible = false; } else if (o.userData._vis != null) { o.visible = o.userData._vis; o.userData._vis = null; } }
        });
        if (this.player.mirror) this.player.mirror.visible = !!on && this.player.mirrorEnabled && !this.player.lookBack;
    }
    /** how close the car must stop to an office door: 11 m, or more when the door stands back from a wide road (a car in
     *  the inner lane next to a kerb-side door on a 4-lane carriageway is ~13 m away) — kerb offset + 5 m, capped at 16 m */
    doorReach(poi) {
        if (poi._reach != null && poi._reachWorld === this.world) return poi._reach;
        const dx = poi.doorX ?? poi.x, dz = poi.doorZ ?? poi.z, ne = this.nav?.index?.nearest(dx, dz, 40);
        poi._reachWorld = this.world;
        return (poi._reach = ne ? clamp(ne.d + 5, 11, 16) : 11);
    }
    /** illegal parking reactions (traffic.js, note 8): tickets / clamp / tow become fines; the tow moves the car */
    onParkingEvent(ev = {}) {
        const RO = this.city?.id === 'bucharest';
        if (ev.type === 'illegal' && !this.flags.parkHint) { this.flags.parkHint = true; this.hud.toast('🅿️ Not a parking spot', RO ? 'Somebody will notice. Poliția Locală is never far.' : 'Parking Enforcement patrols here.', 'warn'); }
        else if (ev.type === 'officer' && ev.arrived === false) this.hud.toast(RO ? '🚓 Poliția Locală is coming' : '🚓 Parking Enforcement is coming', 'Move the car or pay for it.', 'warn');
        if (ev.type === 'clamp') { // the fine is paid to have the clamp removed (pause menu / phone: "Pay fine")
            const cur = ev.fine?.currency || PRICES[this.city.id].cur, amount = ev.fine?.amount || 0;
            this.clamp = { cur, amount, label: ev.fine?.label || '', paid: false, x: this.player?.x, z: this.player?.z };
            this.hud.toast('🔒 Wheel clamp', `The car cannot move until you pay ${amount ? money(cur, amount) : 'the fine'} · Esc → “Pay fine”.`, 'warn');
        } else if (ev.fine && (ev.type === 'ticket' || ev.type === 'tow')) {
            const cur = ev.fine.currency || PRICES[this.city.id].cur, amt = ev.fine.amount || 0;
            this.stats.fines[cur] = (this.stats.fines[cur] || 0) + amt; this.stats.fineCount++; this.stats.cleanDist = 0;
            const t = { ticket: RO ? '🧾 Amendă de parcare' : '🧾 Parking ticket', tow: '🚛 Towed' }[ev.type];
            this.hud.toast(t, [ev.fine.label || '', amt ? money(cur, amt) : 'Fine'].filter(Boolean).join(' · '), 'warn');
        }
        if (ev.type === 'tow') { if (this.clamp) this.clamp = null; this.towCar(); } // (a towed car's clamp goes with it: the tow fee covers it)
        this.lastParkingEvent = ev.type;
    }
    /** pay the wheel-clamp fine: the fine is booked, the clamp comes off */
    payClamp() {
        const c = this.clamp; if (!c || c.paid) return false;
        c.paid = true; this.clamp = null;
        this.stats.fines[c.cur] = (this.stats.fines[c.cur] || 0) + c.amount; this.stats.fineCount++; this.stats.cleanDist = 0;
        this.hud.toast('🔓 Fine paid · clamp removed', [c.label || '', c.amount ? money(c.cur, c.amount) : ''].filter(Boolean).join(' · '), 'warn');
        this.audio.blip?.(660, 0.08, 0.08);
        return true;
    }
    /** nearest legal kerbside spot (a side street's kerb, a service road / parking aisle) ≥ 20 m from x0, z0, judged by
     *  traffic.assessParking — where the tow truck leaves the car */
    legalKerbSpot(x0, z0, rMax = 320) {
        const T = this.traffic, idx = this.nav?.index; if (!T?.assessParking || !idx) return null;
        const US = this.city?.id !== 'bucharest', cands = [];
        for (const e of idx.near(x0, z0, rMax, [])) {
            if (e.tunnel || e.main === false || e.tramOnly || e.tram || isMotorway(e) || e.len < 20) continue;
            if (!(/^(residential|unclassified|living_street|service)$/.test(e.type) || (US && /^(tertiary|secondary)$/.test(e.type)))) continue;
            if (Math.abs(e.ya ?? 0) > 0.5 || Math.abs(e.yb ?? 0) > 0.5) continue; // (street level, no decks)
            for (const t of [0.5, 0.3, 0.7]) {
                const cx = e.a.x + (e.b.x - e.a.x) * t, cz = e.a.z + (e.b.z - e.a.z) * t, d = Math.hypot(cx - x0, cz - z0);
                if (d >= 20 && d <= rMax) cands.push({ e, cx, cz, d });
            }
        }
        cands.sort((a, b) => a.d - b.d);
        for (const c of cands.slice(0, 60)) {
            const e = c.e, dir = canTravel(e, 1) || !canTravel(e, -1) ? 1 : -1, fx = e.dirx * dir, fz = e.dirz * dir;
            const side = (-fz * e.nx + fx * e.nz) >= 0 ? 1 : -1, off = Math.max(0, roadSideWidth(e, side) - 1.25) * side; // the right-hand kerb of the travel direction
            const x = c.cx + e.nx * off, z = c.cz + e.nz * off, heading = Math.atan2(-fx, -fz);
            const chk = T.assessParking({ x, z, heading, surfY: 0.24 + (e.ya ?? 0), y: 0.24 + (e.ya ?? 0) });
            if (chk && !chk.illegal && chk.inLane) return { x, z, heading, edge: e, d: c.d };
        }
        return null;
    }
    /** the tow truck takes the parked car to the nearest legal kerbside spot (car marker + "Walk back to the car" show where) */
    towCar() {
        const P = this.player; if (!P) return;
        const pose = this.legalKerbSpot(P.x, P.z) || this.lanePose(P.x + P.fx * 60, P.z + P.fz * 60, P.heading, P.surfY ?? null); if (!pose) return;
        try { this.traffic?.clearAround?.(pose.x, pose.z, 7); } catch { /* ignore */ }
        P.place(pose.x, pose.z, pose.heading, pose.edge); P.speed = 0; this.lastTow = { x: pose.x, z: pose.z, kerb: pose.d != null, d: pose.d ?? null };
        if (this.carBody?.parent) { this.carBody.position.set(P.x, P.surfY ?? 0.24, P.z); this.carBody.rotation.set(0, P.heading, 0); this.carBox = { ...this.carBox, x: P.x, z: P.z, fx: P.fx, fz: P.fz }; }
        this.hud.toast('🚛 Your car was moved', 'Follow the car marker on the map to get it back.', 'warn');
    }
    /** driver's door position of the parked car */
    carDoor() { const P = this.player, w = this.carBox?.width || 1.8; return { x: P.x + P.fz * (w / 2 + 0.4) + P.fx * 0.4, z: P.z - P.fx * (w / 2 + 0.4) + P.fz * 0.4 }; }
    enterCar() {
        this.endFoot();
        if (this.clamp && !this.clamp.paid) this.hud.toast('🔒 Wheel clamp', `Pay ${this.clamp.amount ? money(this.clamp.cur, this.clamp.amount) : 'the fine'} to drive off: Esc → “Pay fine”.`, 'warn');
        this.state = 'drive'; this.input.flush(); this.frameClock.getDelta();
        this.audio.blip(420, 0.06, 0.08);
    }
    /** leave on-foot mode (silently): the car becomes the camera again */
    endFoot() {
        this.basketball?.cancel('leave-foot');
        if (this.foot?.active) this.foot.exit();
        if (this.carBody?.parent) this.carBody.parent.remove(this.carBody);
        this.carBox = null; if (this.player) this.setDriveRigShown(true);
        if (this.traffic) this.traffic.walker = null;
        document.body.classList.remove('on-foot'); document.getElementById('car-finder')?.classList.remove('show');
        if (this.nav?.walking) { this.nav.walking = false; if (this.nav.dest && this.player) this.nav.reroute(this.player); }
        if (this.player && this.camera.parent !== this.player.camHolder && this.state !== 'office') { this.player.camHolder.add(this.camera); this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0); }
        if (this.officeFromFoot) this.officeFromFoot = false;
    }
    updateFoot(dt) {
        const { traffic, hud, input, city, world } = this, F = this.foot, P = this.player;
        if (input.take('KeyK')) { this.buildConditions(); this.toggleConditions(undefined, { any: true }); } // (K: time, weather & season — everyone)
        if (this.condOpen) { if (input.take('Escape')) this.toggleConditions(false); input.lookAllowed = false; input.flush(); this.updateClock(0); this.drawFrame(); return; }
        if (input.take('KeyM')) this.toggleMap(!this.mapOpen);
        if (this.mapOpen && input.take('Escape')) this.toggleMap(false);
        if (this.mapOpen || hud.panelOpen) { input.lookAllowed = false; input.releaseLock(); input.flush(); this.drawFrame(); return; }
        if (input.take('Escape')) { this.togglePause(true); this.drawFrame(); return; }
        input.lookAllowed = true;
        if (input.take('KeyN')) { this.opts.minimap = !this.opts.minimap; this.saveOpt('minimap', this.opts.minimap); this.applyOpts(); }
        if (this.holdToTravel(input, dt)) { this.fastTravelToObjective(); return; }
        this.frame++;
        this.updateClock(dt);
        if (this.frame % 30 === 0) this.pollWeather();
        traffic.setHour(this.trafficHours());
        traffic.update(dt);
        F.update(dt);
        this.basketball?.updateFoot(dt);
        if (F.bumped && F.t - F.bumped < 0.1 && !this._bumpToast) { this._bumpToast = true; hud.toast('😬 Watch out', 'Cars don\'t stop for jaywalkers here.', 'warn'); setTimeout(() => { this._bumpToast = false; }, 6000); }
        // hazard lights on the parked car
        if (this.carBody) this.carBody.userData.setLights?.(((this.clock.date?.getTime?.() ?? performance.now()) / 400 | 0) % 2 === 0);
        // R: back to the nearest sidewalk
        if (input.take('KeyR')) this.resetPosition();
        this.updateActionMarkers(F.x, F.z);
        hud.update(dt, this.camera, city.id);
        traffic.situationalHudFrame();
        this.stats.time += dt;
        // find the car: T calls it; the HUD chip and map offer a route back.
        this.nav.walking = true;
        if (input.take('KeyV')) { this.backToCar(); return; }
        // (T is the drone's "Go here" while it flies: a T queued during / right after a drone flight never calls the car)
        const droneOn = !!(this.explore?.drone?.active || document.body.classList.contains('drone-mode'));
        if (droneOn || this._droneT > performance.now()) input.take('KeyT'); else if (input.take('KeyT')) this.callCar();
        if (droneOn) this._droneT = performance.now() + 500;
        this.updateCarFinder();
        if (this.navManual && this.nav.dest?.label === 'Your car' && Math.hypot(this.carDoor().x - F.x, this.carDoor().z - F.z) < 4) { this.navManual = false; this.autoRoute(true); }
        // street + navigation from the walker's position
        const pos = { x: F.x, z: F.z, heading: F.heading, surfY: F.y + 0.24, speed: F.vel };
        const ne = this.nav.index.nearest(F.x, F.z, 200);
        const onRoad = ne && ne.d < roadWidthAt(ne.edge, F.x, F.z) + (ne.edge.sidewalk ?? 2) + 6;
        let district = '', bd = Infinity;
        for (const d of this.minimap.districts || []) { const dd = Math.hypot(d.x - F.x, d.z - F.z); if (dd < bd) { bd = dd; district = d.name; } }
        hud.setStreet(onRoad ? roadName(ne.edge) : (world.isPark?.(F.x, F.z) ? 'Park' : 'On foot'), district);
        hud.setSpeed(F.vel); hud.setLimit(null, city.units === 'mph', false);
        const nv = this.navInfo = this.nav.update(pos, dt);
        if (this.explore?.destination?.remote) {
            hud.setObjective(`📍 ${this.explore.destination.label}`); hud.setNavLine('Hold F to travel · destination in another area');
        } else if (this.objective || this.nav.dest) {
            const label = this.navManual ? `🧭 ${this.nav.dest.label}` : this.objectiveLabel;
            if (nv) { hud.setObjective(`${label} · ${fmtDist(nv.remaining, city.units)} 🚶`); hud.setNavLine(`<b>${stepArrow(nv.next)}</b>${stepText(nv.next, nv.distToNext, city.units)}`); }
            else hud.setObjective(label);
        } else { hud.setObjective(this.objectiveLabel); hud.setNavLine(''); }
        if (this.ch?.waypoint && !this.chapterDone && this.objective?.waypoint && Math.hypot(this.objective.x - F.x, this.objective.z - F.z) < 30) this.completeChapter();
        if (this.frame % 15 === 0) this.checkPassing(F);
        // prompts: get in > office door
        let prompt = null;
        const door = this.carDoor();
        if (Math.hypot(door.x - F.x, door.z - F.z) < 3) { prompt = '<kbd>Enter</kbd> Get in'; if (input.take('Enter') || input.take('NumpadEnter') || input.take('KeyE')) { this.enterCar(); hud.prompt(null); return; } }
        if (!prompt) for (const { stop, poi } of this.stopPois) {
            const d = Math.hypot((poi.doorX ?? poi.x) - F.x, (poi.doorZ ?? poi.z) - F.z);
            if (d < 7) { prompt = `<kbd>E</kbd> Walk into <b>${stop.company}</b> ${this.visited.has(stop.id) ? '✓' : ''}`; if (input.take('KeyE')) { hud.prompt(null); this.enterOffice(stop); return; } }
        }
        // E — talk to a passer-by (after round 6): the nearest pedestrian in front within reach stops and answers
        if (!prompt) { const ped = this.talkTarget(F); if (ped) { prompt = `<kbd>E</kbd> Talk to ${ped.talkWho || 'them'}`; if (input.take('KeyE')) this.talkToPed(ped, F); } }
        this.streetChatter(F, dt);
        if (!prompt && Math.hypot(P.x - F.x, P.z - F.z) > 25) prompt = null;
        input.take('Enter'); input.take('KeyE');
        hud.prompt(prompt);
        const lookTxt = input.lookMode === 'lock' ? (input.locked ? 'mouse look (Esc frees)' : 'click to look') : input.lookMode === 'hold' ? 'right-drag look' : 'A/D turn';
        hud.setHint(this.touch ? '' : `On foot · WASD walk · Shift run · Space jump · ${lookTxt} · Enter at the car: get in · V back to car · T call car · E office · R sidewalk · M map · K time, weather & season · G drone`);
        if (this.opts.minimap && this.frame % 2 === 0) this.drawMiniAt(F.x, F.z, F.heading, 0.3);
        this.drawFrame();
    }
}
