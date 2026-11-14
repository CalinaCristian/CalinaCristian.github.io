// Game methods: the drive — spawn on the road, car screen, objective markers, cameras, rain on the
// windscreen, objective / auto-route, the per-frame driving update, car screen and map overlays, honks,
// collisions, lane poses, unstick and reset to the road. Installed on Game.prototype by main.js (mixin).
import * as THREE from '../vendor/three.module.min.js';
import { STOPS, AIRPORTS } from './data.js';
import { collideBuildings } from './world.js';
import { laneOffset } from './traffic.js';
import { CarScreen, canTravel, edgeSpeed, isMotorway, roadName, fmtDist, stepText, stepArrow, lanesDir, roadSideWidth, roadWidthAt } from './nav.js';
import { clamp, angleDiff } from './util.js';
import { chapterWaypointReached } from './chapter-waypoint.js';
import { $, DEV, FUEL_ACC, FUEL_AERO, FUEL_GAME_MULT, FUEL_IDLE, FUEL_ROLL, GAL, money, PRICES, TANK_L } from './game-common.js';

export class DriveMethods {
    /** put a point on the nearest drivable lane, returns {x,z,heading,edge,dir} */
    roadPose(x, z, preferDir = 1) {
        const ne = this.nav.index.nearest(x, z, 3000); if (!ne) return { x, z, heading: 0 };
        const e = ne.edge;
        let dir = canTravel(e, preferDir) ? preferDir : -preferDir;
        if (!canTravel(e, dir)) dir = 1;
        const lat = laneOffset(e, 0, dir) * dir;
        return { x: ne.cx + e.nx * lat, z: ne.cz + e.nz * lat, heading: Math.atan2(-e.dirx * dir, -e.dirz * dir), edge: e, dir };
    }
    placeSpawn(city, world) {
        if (world.spawn && world.spawn.x !== undefined) {
            const p = world.spawn.heading !== undefined ? world.spawn : this.roadPose(world.spawn.x, world.spawn.z);
            this.player.place(p.x, p.z, p.heading, p.edge || null); return;
        }
        const sp = city.spawn;
        const e = sp && world.graph.edges.find(ed => ed.a.id === sp.edge[0] && ed.b.id === sp.edge[1]);
        if (e) {
            const lat = laneOffset(e, 0, sp.dir) * sp.dir;
            this.player.place(e.a.x + e.dirx * e.len * sp.t + e.nx * lat, e.a.z + e.dirz * e.len * sp.t + e.nz * lat, Math.atan2(-e.dirx * sp.dir, -e.dirz * sp.dir), e);
            return;
        }
        const ap = world.pois.find(p => p.id === AIRPORTS[city.id].poi);
        const ref = city.id === 'seattle' && ap ? { x: ap.doorX ?? ap.x, z: ap.doorZ ?? ap.z } : { x: 0, z: 0 };
        const p = this.roadPose(ref.x, ref.z); this.player.place(p.x, p.z, p.heading, p.edge || null);
    }

    /** dashboard navigation screen: uses the cockpit's screen mesh if provided, else a fallback plane */
    setupScreen() {
        const cockpit = this.player.cockpit;
        let screen = cockpit.userData.screen;
        if (!screen) {
            screen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ toneMapped: false }));
            screen.position.set(0.25, 1.0, -1.15); screen.rotation.set(-0.3, -0.3, 0, 'YXZ');
            cockpit.add(screen); cockpit.userData.screen = screen;
        }
        this.carScreen = new CarScreen(512, 320);
        const tex = this.screenTex = new THREE.CanvasTexture(this.carScreen.canvas);
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
        if (!(screen.material instanceof THREE.MeshBasicMaterial)) screen.material = new THREE.MeshBasicMaterial({ toneMapped: false });
        screen.material.map = tex; screen.material.color?.set('#ffffff'); screen.material.needsUpdate = true;
    }

    // ---------------------------------------------------------------------------------- stations & cameras
    /** (round 6 note 4) where to act: a glowing ring on the ground at every stop's door and every fuel station's
     *  forecourt entry, and a pin above it. A stop's pin floats over the rooftop from afar and comes down to the door
     *  as you get close (it used to stay 8 m above the roof, out of view right when you needed it). */
    buildActionMarkers() {
        const ringMesh = (color, r) => {
            const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.55, r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
            m.rotation.x = -Math.PI / 2; m.renderOrder = 3; m.userData.noAudit = true; return m;
        };
        const ground = (x, z) => { try { return this.world.roadHeight?.(x, z, { y: 0.24 }) ?? 0.24; } catch { return 0.24; } };
        this.actionMarks = [];
        for (const sp of this.stopPois || []) {
            const p = sp.poi; if (!p?.marker || p.passing) continue;
            const dx = p.doorX ?? p.x, dz = p.doorZ ?? p.z, gy = ground(dx, dz);
            const ring = ringMesh(p.color || '#f97316', 3.2); ring.position.set(dx, gy + 0.06, dz); this.props.add(ring);
            p.marker.userData.top = { x: p.marker.position.x, z: p.marker.position.z, y: (p.h ?? 20) + 8 };
            this.actionMarks.push({ kind: 'stop', poi: p, ring, door: { x: dx, z: dz, y: gy } });
        }
        if (this.airport?.marker) {
            const p = this.airport; p.marker.userData.top = { x: p.marker.position.x, z: p.marker.position.z, y: (p.h ?? 20) + 8 };
            this.actionMarks.push({ kind: 'stop', poi: p, ring: null, door: { x: p.doorX ?? p.x, z: p.doorZ ?? p.z, y: ground(p.doorX ?? p.x, p.doorZ ?? p.z) } });
        }
        for (const st of this.stations || []) {
            const gy = ground(st.x, st.z), g = new THREE.Group();
            const ring = ringMesh('#22c55e', 4.2); ring.position.set(st.x, gy + 0.06, st.z);
            const pin = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 12), new THREE.MeshBasicMaterial({ color: '#22c55e' })); pin.rotation.x = Math.PI; pin.position.y = 5.2;
            const halo = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.14, 8, 24), new THREE.MeshBasicMaterial({ color: '#ffffff' })); halo.rotation.x = Math.PI / 2; halo.position.y = 6.5;
            g.add(pin, halo); g.position.set(st.x, gy, st.z); g.userData.noAudit = true;
            this.props.add(ring, g);
            this.actionMarks.push({ kind: 'fuel', st, ring, pin: g });
        }
    }
    updateActionMarkers(px, pz) {
        const t = performance.now() / 1000, pulse = 0.55 + 0.35 * Math.sin(t * 3);
        for (const m of this.actionMarks || []) {
            if (m.kind === 'stop') {
                const p = m.poi, mk = p.marker, top = mk?.userData.top; if (!mk || !top) continue;
                const d = Math.hypot(px - m.door.x, pz - m.door.z);
                const k = clamp((d - 25) / 140, 0, 1), e = k * k * (3 - 2 * k); // 0 at ≤ 25 m (over the door), 1 at ≥ 165 m (over the roof)
                // close up it hangs 2 m out from the door (toward the street: away from the building's centre) at 4.6 m —
                // clear of the stop's own sign / canopy lettering above the entrance
                const ox = m.door.x - top.x, oz = m.door.z - top.z, ol = Math.hypot(ox, oz) || 1, nx0 = m.door.x + ox / ol * 2, nz0 = m.door.z + oz / ol * 2;
                mk.position.set(nx0 + (top.x - nx0) * e, m.door.y + 4.6 + (top.y - m.door.y - 4.6) * e + Math.sin(t * 2 + p.x) * 0.5, nz0 + (top.z - nz0) * e);
                mk.scale.setScalar(0.65 + 1.0 * e); mk.rotation.y = t; mk.visible = !p.visited && d > 10; // (within 10 m the ring + prompt mark the spot; the pin would hide the entrance sign) // (bigger over the roof: readable from a block away)
                if (m.ring) { m.ring.visible = !p.visited && d < 300; m.ring.material.opacity = pulse; }
            } else {
                const d = Math.hypot(px - m.st.x, pz - m.st.z), on = d < 350;
                m.ring.visible = on; m.pin.visible = on; m.ring.material.opacity = pulse;
                m.pin.children[0].position.y = 5.2 + Math.sin(t * 2 + m.st.x) * 0.3; m.pin.rotation.y = t;
            }
        }
    }
    setupCameras(city, world) {
        const real = world.pois.filter(p => p.kind === 'camera' || p.kind === 'speed_camera');
        this.cameras = real.map(p => ({ x: p.x ?? p.doorX, z: p.z ?? p.doorZ, cd: 0, lastD: 1e9 }));
        // OSM highway=speed_camera normally lives on the road graph, not in
        // the amenity POI list. Keep those real enforcement locations.
        for (const n of Object.values(world.graph.nodes || {})) if (n.speedCamera && !this.cameras.some(c => Math.hypot(c.x - n.x, c.z - n.z) < 5)) {
            this.cameras.push({ x: n.x, z: n.z, cd: 0, lastD: 1e9 });
        }
    }

    makeRain() {
        // rain streaks as short vertical line segments around the player
        const n = 900; const pos = new Float32Array(n * 6);
        for (let i = 0; i < n; i++) {
            const x = (Math.random() - 0.5) * 50, y = Math.random() * 25, z = (Math.random() - 0.5) * 50;
            pos.set([x, y, z, x, y + 0.6, z], i * 6);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const m = new THREE.LineBasicMaterial({ color: '#c9d3dd', transparent: true, opacity: 0.28, depthWrite: false });
        this.rain = new THREE.LineSegments(g, m); this.rain.frustumCulled = false; this.scene.add(this.rain);
    }
    updateRain(dt) {
        const p = this.rain.geometry.attributes.position; const fall = dt * 22;
        for (let i = 0; i < p.count; i += 2) {
            let y = p.getY(i) - fall; if (y < 0) y += 25;
            p.setY(i, y); p.setY(i + 1, y + 0.6);
        }
        p.needsUpdate = true;
        this.rain.position.set(this.player.x + this.player.fx * 12, 0, this.player.z + this.player.fz * 12);
    }

    // ---------------------------------------------------------------------------------- objective / navigation
    get nextStop() { return this.stops.find(s => !this.visited.has(s.id)); }
    updateObjective() {
        if (this.ch) return this.updateChapterObjective();
        if (this.freeRoam) return this.updateRoamObjective();
        const done = STOPS.filter(s => this.visited.has(s.id)).length;
        if (this.chapters) this.setChapterProgress(); // one progress label everywhere: chapters n/10 (+ completion %)
        else this.hud.setProgress(done, STOPS.length);
        const n = this.nextStop;
        if (n) { this.objective = n.poiRef; this.objectiveLabel = `${n.icon} ${n.short} <small>(${n.year})</small>`; this.objectivePlain = n.short; this.hud.setYear(n.year); this.year = n.year; }
        else if (this.city.id === 'bucharest') { this.objective = this.airport; this.objectiveLabel = '✈️ Otopeni Airport — fly to Seattle <small>(2022)</small>'; this.objectivePlain = 'Otopeni Airport'; this.hud.setYear(2022); this.year = 2022; if (this.hud.achievement('all-buc')) this.audio.chime(); }
        else { this.objective = null; this.objectiveLabel = '🏁 Story complete — 🌍 World map (pause menu)'; this.objectivePlain = ''; this.hud.setYear('2026'); this.year = 2026; }
        this.autoRoute(true);
    }
    autoRoute(force = false) {
        if (this.navManual || this.explore?.destination?.remote) return;
        const o = this.objective;
        if (!o) { this.explore?.onNavDestination?.(null, false); this.nav.clear(); return; }
        const x = o.doorX ?? o.x, z = o.doorZ ?? o.z;
        if (!force && this.nav.dest && this.nav.dest.x === x && this.nav.dest.z === z) return;
        this.setNavDest({ x, z, label: this.objectivePlain }, false);
    }
    setNavDest(dest, manual) {
        this.explore?.onNavDestination?.(dest, manual);
        this.navManual = manual;
        const P = this.state === 'foot' && this.foot?.active ? this.foot : this.player;
        this.nav.walking = this.state === 'foot';
        this.nav.setDestination(dest, P);
        if (manual && !this.nav.route) this.hud.toast('📍 Destination marked', 'No route is available from here.', 'warn');
    }
    fastTravelStatus() {
        const d = this.explore?.destination || (this.navManual && this.nav?.dest) || (!this.chapterDone && this.objective);
        const reason = !d ? 'Mark a destination on the map first' : this.refuel ? 'Finish refuelling first' : this.clamp && !this.clamp.paid ? 'Pay the wheel-clamp fine first' : this._transit || this._spotBusy || this.explore?.drone?.active ? 'Finish the current action first' : '';
        return { disabled: !!reason, note: reason || d.label || this.objectivePlain || 'Travel to the marked destination' };
    }
    /** Same position-only recovery as R: no fuel, progress or story changes. */
    resetPosition() {
        if (this.explore?.drone?.active || this.refuel) return false;
        if (this.state === 'drive') {
            if (Math.abs(this.player.speed) >= 6) { this.hud.toast('🛟 Slow down first', 'Reset to the road works below ~20 km/h.', 'warn'); return false; }
            return this.resetToRoad();
        }
        if (this.state !== 'foot' || !this.foot) return false;
        const F = this.foot, ne = this.nav.index.nearest(F.x, F.z, 200); if (!ne) return false;
        const e = ne.edge, sd = (F.x - ne.cx) * e.nx + (F.z - ne.cz) * e.nz >= 0 ? 1 : -1, off = roadSideWidth(e, sd) + 1.5;
        this.basketball?.cancel('reset');
        F.teleport(ne.cx + e.nx * sd * off, ne.cz + e.nz * sd * off);
        this.hud.toast('🛟 Back on the sidewalk', 'Position reset.'); return true;
    }

    updateDrive(dt) {
        const { player, traffic, world, hud, input, city } = this;
        if (input.take('KeyK')) { this.buildConditions(); this.toggleConditions(undefined, { any: true }); } // (K: time, weather & season — everyone)
        if (this.condOpen) { if (input.take('Escape')) this.toggleConditions(false); input.lookAllowed = false; input.flush(); this.updateClock(0); this.drawFrame(); return; }
        if (input.take('KeyM')) this.toggleMap(!this.mapOpen);
        if (this.mapOpen && input.take('Escape')) this.toggleMap(false);
        if (this.mapOpen || hud.panelOpen) { input.lookAllowed = false; input.releaseLock(); input.flush(); this.drawFrame(); return; }
        if (input.take('Escape')) { this.togglePause(true); this.drawFrame(); return; } // (the first Esc only frees the mouse)
        input.lookAllowed = true;
        if (DEV && input.take('KeyB')) this.setDebugOverlay(!this.debug.overlay);
        if (input.take('KeyN')) { this.opts.minimap = !this.opts.minimap; this.saveOpt('minimap', this.opts.minimap); this.applyOpts(); }
        this.frame++;
        this.updateClock(dt);
        if (this.frame % 30 === 0) this.pollWeather();
        if (input.take('KeyL')) {
            this.headlights = !this.headlightsOn;
            hud.toast(this.headlights ? '💡 Headlights on' : '💡 Headlights off', '');
            this.audio.blip(this.headlights ? 900 : 600, 0.05, 0.06);
        }
        player.lookBack = input.keys.has('KeyC');
        { const lk = input.takeLook(); player.applyLook(lk.dx, lk.dy, input.lookHeld, dt); }
        const empty = this.stations?.length > 0 && this.fuel <= 0;
        const prevSpeed = player.speed;
        if (this.clamp && !this.clamp.paid) { // wheel clamp (RO, note 8): the car does not move until the fine is paid
            player.update(dt, { throttle: 0, brake: true, steer: 0 }, { maxSpeed: 38 }); player.speed = 0;
            if ((input.throttle > 0.2 || input.keys.has('KeyW') || input.keys.has('ArrowUp')) && !(this._clampToastT > performance.now())) { this._clampToastT = performance.now() + 4000; hud.toast('🔒 Wheel clamp', `Pay the fine to drive off: Esc → “Pay fine”${this.clamp.amount ? ` (${money(this.clamp.cur, this.clamp.amount)})` : ''}.`, 'warn'); }
        } else if (this.refuel) player.update(dt, { throttle: 0, brake: true, steer: 0 }, { maxSpeed: 38 });
        else player.update(dt, input, { maxSpeed: empty ? 2 : 38, grip: this.wxGrip });
        traffic.setHour(this.trafficHours());
        traffic.update(dt);
        this.updateUnstick(dt);
        this.debug.lastCollider = player.debug.lastCollider; this.debug.hits = player.debug.hits;
        if (this.debug.overlay && this.frame % 6 === 0) this.updateDebugOverlay();
        if (input.take('KeyR')) this.resetPosition();
        if (this.holdToTravel(input, dt)) { this.fastTravelToObjective(); if (this.state !== 'drive') return; }
        if (input.take('Enter') || input.take('NumpadEnter')) { if (this.exitCar()) return; }
        hud.update(dt, this.camera, city.id);
        traffic.situationalHudFrame();
        this.audio.engine(empty ? player.speed * 0.3 : player.speed, empty ? 0 : input.throttle, dt);
        this.stats.time += dt;
        // (sun follow / shadows / rain are handled inside Renderer3D.frame())
        // horn
        if (input.take('KeyH')) this.playerHonk();
        this.updateActionMarkers(player.x, player.z); // stop pins come down to the door as you get close; station markers
        // street / district
        const ne = this.nav.index.nearest(player.x, player.z, 200);
        const onRoad = ne && ne.d < roadWidthAt(ne.edge, player.x, player.z) + (ne.edge.sidewalk ?? 2) + 6;
        let district = '', bd = Infinity;
        for (const d of this.minimap.districts || []) { const dd = Math.hypot(d.x - player.x, d.z - player.z); if (dd < bd) { bd = dd; district = d.name; } }
        const streetName = onRoad ? roadName(ne.edge) : (world.isPark?.(player.x, player.z) ? 'Park' : 'Off road');
        hud.setStreet(streetName, district);
        hud.setSpeed(player.speed);
        this.checkRoadEvents(ne, dt);
        // ---- odometer & fuel ----
        const v = Math.abs(player.speed);
        const acc = (Math.abs(player.speed) - Math.abs(prevSpeed)) / Math.max(dt, 1e-3);
        const burn = this.refuel || !this.stations?.length ? 0 : // (no mapped gas station in this district: nowhere to refuel, so no burn)
            (FUEL_IDLE + FUEL_ROLL * v + FUEL_AERO * v * v * v + FUEL_ACC * Math.max(0, acc) * v) * dt;
        if (!empty) { this.fuel = Math.max(0, this.fuel - burn * FUEL_GAME_MULT); this.stats.fuelReal += burn; }
        this.stats.dist += v * dt; this.stats.cleanDist += v * dt;
        if (this.stats.cleanDist > 5000 && hud.achievement('law-abiding')) this.audio.chime();
        if (empty && !this.flags.emptyToast) { this.flags.emptyToast = true; hud.toast('⛽ Out of fuel!', 'Limping at walking pace. Press T to call a tow truck.', 'warn'); this.audio.blip(220, 0.4, 0.15); }
        if (this.fuel / TANK_L < 0.15 && this.fuel > 0 && !this.flags.lowFuel && this.stations?.length) { this.flags.lowFuel = true; hud.toast('⛽ Low fuel', 'Under 15% — find a gas station (M → Gas stations).', 'warn'); this.audio.blip(660, 0.2, 0.12); }
        if (this.fuel / TANK_L > 0.2) this.flags.lowFuel = false;
        // ---- speed limit / enforcement ----
        const us = city.units === 'mph';
        let limitDisp = null, over = false, overKmh = 0;
        if (ne && ne.d < roadWidthAt(ne.edge, player.x, player.z) + 2.5) {
            const lim = edgeSpeed(ne.edge);
            limitDisp = us ? Math.max(5, Math.round(lim * 2.237 / 5) * 5) : Math.max(10, Math.round(lim * 3.6 / 10) * 10);
            const limKmh = us ? limitDisp * 1.609 : limitDisp;
            overKmh = v * 3.6 - limKmh;
            over = overKmh > 10;
        }
        hud.setLimit(limitDisp, us, over);
        this.limitInfo = limitDisp != null ? { value: limitDisp, us } : null;
        this.over = over;
        this.updateEnforcement(dt, over, overKmh);
        // ---- navigation ----
        const waypointNavigation = { destination: this.nav.dest, manual: this.navManual };
        const nv = this.navInfo = waypointNavigation.info = this.nav.update(player, dt);
        if (nv && nv.arrived && this.navManual) { hud.toast('🏁 You have arrived', this.nav.dest?.label || ''); this.navManual = false; this.nav.clear(); this.autoRoute(true); }
        if (nv && nv.rerouted) this.audio.blip(520, 0.06, 0.06);
        // objective text
        if (this.explore?.destination?.remote) {
            hud.setObjective(`📍 ${this.explore.destination.label}`); hud.setNavLine('Hold F to travel · destination in another area');
        } else if (this.objective || this.nav.dest) {
            const label = this.navManual ? `🧭 ${this.nav.dest.label}` : this.objectiveLabel;
            if (nv) {
                hud.setObjective(`${label} · ${fmtDist(nv.remaining, city.units)}`);
                hud.setNavLine(`<b>${stepArrow(nv.next)}</b>${stepText(nv.next, nv.distToNext, city.units)}`);
            } else if (this.objective) {
                const o = this.objective; const dx = (o.doorX ?? o.x) - player.x, dz = (o.doorZ ?? o.z) - player.z; const dist = Math.hypot(dx, dz);
                const bearing = Math.atan2(-dx, -dz); const rel = angleDiff(player.heading, bearing);
                const arrows = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
                const arrow = arrows[((Math.round(-rel / (Math.PI / 4)) % 8) + 8) % 8];
                hud.setObjective(`${label} · ${fmtDist(dist, city.units)} ${arrow}`);
                hud.setNavLine('');
                if (this.frame % 180 === 0) this.autoRoute(true);
            }
        } else { hud.setObjective(this.objectiveLabel); hud.setNavLine(''); }
        // ---- "you are passing …" captions (e.g. Plaza Center, UiPath Bellevue 2022–2025, on the way to Lincoln Square) ----
        if (this.frame % 15 === 0) this.checkPassing(player);
        // ---- chapter waypoint (e.g. drive out of SeaTac to the I-5 junction) ----
        if (chapterWaypointReached(this, player, waypointNavigation)) this.completeChapter();
        // ---- interactions (office > airport > refuel > tow) ----
        let prompt = null;
        for (const { stop, poi } of this.stopPois) {
            const d = Math.hypot((poi.doorX ?? poi.x) - player.x, (poi.doorZ ?? poi.z) - player.z);
            if (d < this.doorReach(poi) && v < 5) {
                prompt = `<kbd>E</kbd> Enter <b>${stop.company}</b> ${this.visited.has(stop.id) ? '✓' : ''}`;
                if (input.take('KeyE')) this.enterOffice(stop);
            }
        }
        if (this.airport) {
            const p = this.airport; const d = Math.hypot((p.doorX ?? p.x) - player.x, (p.doorZ ?? p.z) - player.z);
            if (this.ch) {
                // chapters: boarding completes the Otopeni chapter (card → flight → SeaTac)
                if (!prompt && d < 90 && v < 6 && this.ch.stop === 'otopeni' && !this.chapterDone) {
                    prompt = '<kbd>E</kbd> Board the flight to Seattle ✈️';
                    if (input.take('KeyE')) this.completeChapter();
                }
            }
        }
        if (!prompt) prompt = this.updateClosures(dt);
        if (!prompt) prompt = this.updateFuelStops(dt, v);
        if (!prompt && this.stuckT > 2) prompt = '<kbd>R</kbd> Stuck? Reset to the road <small>(nearest lane, facing the traffic flow)</small>';
        hud.prompt(prompt);
        const st = this.r3d.stats;
        const perf = st ? ` · ${st.quality}${st.fps ? ` · ${st.fps} fps` : ''}` : '';
        const lookTxt = input.lookMode === 'lock' ? (input.locked ? 'mouse look (Esc frees)' : 'click to look') : input.lookMode === 'hold' ? 'right-drag look' : '';
        hud.setHint(this.touch ? perf.trim() : `W/S drive · A/D steer · Space brake · H horn · C look back${lookTxt ? ' · ' + lookTxt : ''} · M map & nav · K time, weather & season · hold F fast travel · R reset · N mini-map · L lights · E enter/refuel · Enter get out${DEV ? ' · B colliders' : ''}` + perf);
        // ---- HUD fuel / trip ----
        const frac = this.fuel / TANK_L;
        const fuelText = us ? `${Math.round(frac * 100)}% · ${(this.fuel / GAL).toFixed(1)} gal` : `${Math.round(frac * 100)}% · ${this.fuel.toFixed(1)} L`;
        hud.setFuel(frac, fuelText);
        if (this.frame % 15 === 0) hud.setTrip(this.tripText());
        player.cockpit.userData.updateGauges?.(player.speed, clamp(0.12 + v / 45 + Math.max(0, input.throttle) * 0.15, 0, 1), frac, us);
        // ---- screens ----
        if (this.opts.minimap && this.frame % 2 === 0) {
            this.minimap.draw({ cx: player.x, cz: player.z, scale: 0.16, heading: player.heading, player, pois: world.pois, objective: this.objective });
            this.drawRouteOverlay(this.minimap.ctx, $('#minimap'), { cx: player.x, cz: player.z, scale: 0.16, heading: player.heading });
        }
        if (this.frame % 2 === 1) this.drawCarScreen(streetName, fuelText);
        const mirrorEnabled = this.quality !== 'low' && !/low/.test(this.r3d.stats?.quality || '');
        if (mirrorEnabled && !player.mirrorEnabled) player.mirrorWarm = Math.max(player.mirrorWarm || 0, 3);
        player.mirrorEnabled = mirrorEnabled;
        // mirror pass: every 2nd frame at high+, every 3rd at medium (it re-renders the scene; render's perf table)
        const mq = this.r3d.stats?.quality || this.quality, mEvery = /medium/.test(mq) ? 3 : 2;
        const warm = player.mirrorWarm > 0; if (warm) player.mirrorWarm--;
        this.drawFrame({ mirror: warm || this.frame % mEvery === 1 });
    }

    /** Keep the cached request in step with the renderer after scene replacement as well as clock changes. */
    syncHeadlights(force = false) {
        const want = this.headlights === 'auto' ? (this._fogLights ? true : null) : !!this.headlights;
        if (force || this._hlSent !== want) { this._hlSent = want; this.r3d.setHeadlights(want); }
    }

    tripText() {
        const s = this.stats, us = this.city.units === 'mph';
        const l100 = s.dist > 200 ? s.fuelReal / (s.dist / 100000) : null;
        const cur = PRICES[this.city.id].cur;
        const dist = us ? `${(s.dist / 1609.34).toFixed(1)} mi` : `${(s.dist / 1000).toFixed(1)} km`;
        const eco = l100 == null ? '—' : us ? `${Math.round(235.21 / l100)} mpg` : `${l100.toFixed(1)} L/100km`;
        const fines = s.fines[cur] ? `\nFines ${money(cur, s.fines[cur])}` : '';
        const wx = this.weatherText();
        // short lines: the bottom-right block is ≤ 220 px wide (R17.5: one long nowrap line ran into the hint)
        return `${this.phaseIcon} ${this.clockText()}${wx ? ' · ' + wx : ''}\nTrip ${dist} · Ø ${eco}${fines}`;
    }

    drawCarScreen(street, fuelText) {
        if (!this.carScreen) return;
        const us = this.city.units === 'mph', p = this.player;
        this.carScreen.draw({
            player: p, index: this.nav.index, route: this.nav.route, segIdx: this.nav.segIdx, nav: this.navInfo, dest: this.nav.dest,
            street, limit: this.limitInfo, over: this.over, fuel: this.fuel / TANK_L, fuelText, year: this.year, units: this.city.units,
            speedText: us ? `${Math.round(Math.abs(p.speed) * 2.237)} mph` : `${Math.round(Math.abs(p.speed) * 3.6)} km/h`,
            pois: this.stations, clock: this.clockText(), phaseIcon: this.phaseIcon, weather: this.weatherText(),
        });
        this.screenTex.needsUpdate = true;
    }

    /** draws the route + waypoint on a MiniMap canvas using the same transform it was drawn with */
    drawRouteOverlay(ctx, canvas, { cx, cz, scale, heading = null }) {
        this.drawOutside(ctx, canvas, { cx, cz, scale, heading });
        this.drawCarMarker(ctx, canvas, { cx, cz, scale, heading });
        const r = this.nav?.route, d = this.nav?.dest; if (!r && !d) return;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        if (heading !== null) ctx.rotate(heading);
        ctx.scale(scale, scale); ctx.translate(-cx, -cz);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (r) {
            ctx.beginPath();
            const s0 = this.nav.segIdx || 0;
            { const me = this.foot?.active ? this.foot : this.player; ctx.moveTo(me.x, me.z); }
            for (let i = s0 + 1; i < r.points.length; i++) ctx.lineTo(r.points[i][0], r.points[i][1]);
            ctx.strokeStyle = 'rgba(29,78,216,0.85)'; ctx.lineWidth = Math.max(4 / scale, 5); ctx.stroke();
            ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = Math.max(2 / scale, 2.5); ctx.stroke();
        }
        if (d) {
            ctx.translate(d.x, d.z); if (heading !== null) ctx.rotate(-heading); ctx.scale(1 / scale, 1 / scale);
            ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, -16, 9, Math.PI, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.restore();
    }

    /** world-data's categorized reachable places (game/data/places.json) for the current district → this.places
     *  [{cat, name, icon, color, x, z}] (positions re-projected from lat/lon with the city projection) */
    async loadPlaces(city, district) {
        this.places = [];
        if (!district) return;
        try {
            this._placesJson = this._placesJson || fetch(new URL('../data/places.json', import.meta.url)).then(r => r.ok ? r.json() : null).catch(() => null);
            const all = await this._placesJson; const d = all?.districts?.[`${city.id}-${district}`]; if (!d || this.district !== district) return;
            const legend = Object.fromEntries((all.legend || []).map(l => [l.cat, l]));
            const out = [];
            for (const [cat, list] of Object.entries(d.places || {})) for (const p of list || []) {
                const q = Number.isFinite(p.x) ? { x: p.x, z: p.z } : Number.isFinite(p.lat) && city.proj ? city.proj(p.lat, p.lon) : null; if (!q || !Number.isFinite(q.x)) continue;
                // nx/nz = the nav point on a street reachable from the chapter start (world-data); walk = metres on foot from there
                out.push({ cat, id: p.id || null, name: p.name || p.brand || p.id || cat, icon: legend[cat]?.icon || '•', color: legend[cat]?.color || '#64748b', label: legend[cat]?.label || cat, x: q.x, z: q.z,
                    nx: Number.isFinite(p.nx) ? p.nx : null, nz: Number.isFinite(p.nz) ? p.nz : null, walk: p.walk || 0, mode: p.mode || null, kind: p.kind || p.sub || null });
            }
            this.places = out; // (minimap.js loads and draws the same places itself: one renderer)
        } catch (e) { console.warn('[places]', e); }
    }
    /** on foot (note 7): the parked car on the minimap / big map (+ the walker on the big map, which centres on the car) */
    drawCarMarker(ctx, canvas, { cx, cz, scale, heading = null }) {
        if (!this.foot?.active || !this.carBody?.parent) return;
        const P = this.player, F = this.foot;
        ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2); if (heading !== null) ctx.rotate(heading); ctx.scale(scale, scale); ctx.translate(-cx, -cz);
        const pin = (x, z, fill, glyph, r = 11) => { ctx.save(); ctx.translate(x, z); if (heading !== null) ctx.rotate(-heading); ctx.scale(1 / scale, 1 / scale); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.font = `${r + 1}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, 0, 1); ctx.restore(); };
        pin(P.x, P.z, '#2563eb', '🚗', 12);
        if (canvas.id === 'bigmap') pin(F.x, F.z, '#16a34a', '🚶', 9);
        ctx.restore();
    }

    playerHonk() {
        const p = this.player;
        this.audio.horn(0, 0, 1.0, 0.45);
        this.honks++;
        const dialogueEvent=this.traffic.dialogueEvent('player-honk',p);
        const reacted = this.traffic.playerHonk(p.x, p.z, p.fx, p.fz,dialogueEvent);
        this.traffic.emitDialogueEvent(dialogueEvent);
        const rage = this.hud.addRage(this.city.id === 'bucharest' ? 6 + reacted * 2 : 3);
        if (this.honks === 1) this.hud.achievement('first-honk');
        if (this.honks === 10) this.hud.achievement('honk-10');
        if (rage >= 100 && this.hud.achievement('rage-max')) this.audio.chime();
    }
    vehicleHonk(v) {
        const p = this.player; const dx = v.x - p.x, dz = v.z - p.z; const d = Math.hypot(dx, dz);
        if (d > 120) return;
        { const now = performance.now(); if (now - (this._honkAt || 0) < 160) return; this._honkAt = now; } // (a jam's honk storm: ≤ 6 horns a second)
        const pan = clamp((dx * -p.fz + dz * p.fx) / (d || 1), -1, 1) * -1;
        this.audio.horn(pan, d, 1 + Math.sin(v.x * 13 + v.z * 7) * .06, 0.3 + Math.random() * 0.4);
        if (d < 40) this.hud.addRage(2);
        const dialogueEvent=this.traffic.dialogueEvent('npc-honk',v,{sourceRole:'driver'});
        this.traffic.emitDialogueEvent(dialogueEvent,{participant:v});return dialogueEvent;
    }
    onCollide(strength, what, v) {
        const dialogueEvent=this.traffic?.dialogueEvent('collision',this.player,{target:what==='vehicle'||what==='pedestrian'?v:null,targetRole:what==='pedestrian'?'pedestrian':'driver',facts:{contact:true,collisionType:what==='vehicle'?'vehicle':what==='pedestrian'?'pedestrian':'static'}});
        if (what === 'pedestrian') {
            this.audio.crash(0.35);
            this.stats.peds++;
            this.hud.addRage(35);
            this.giveFine('🚶 Pieton!', this.city.id === 'bucharest' ? 'Contact cu un pieton. Oprește și verifică dacă e nevoie de ajutor.' : 'Pedestrian contact. Stop and check whether help is needed.', 0, 'pedestrian');
            this.hud.achievement('pedestrian');
            this.traffic.playerHonk(this.player.x, this.player.z, this.player.fx, this.player.fz);
            this.traffic.emitDialogueEvent(dialogueEvent);return;
        }
        this.audio.crash(clamp(strength / 10, 0.2, 1));
        if (what === 'vehicle' && v) { this.traffic.bump(v,dialogueEvent); this.hud.addRage(12); }
        else if (what === 'edge') { /* deck edge / trench wall: the crash sound is enough */ }
        else if (strength > 8) this.hud.toast('💥 Ouch', this.city.id === 'bucharest' ? 'Oprește și verifică oamenii și împrejurimile înainte să continui.' : 'Stop and check people and surroundings before continuing.', 'warn');
        this.traffic.emitDialogueEvent(dialogueEvent,{participant:what==='vehicle'?v:null});
    }


    /** one caption toast per place passed: stops' `passing` list (data.js) + world POIs flagged `passing` */
    checkPassing(P) {
        if (!this._passList || this._passWorld !== this.world) {
            this._passWorld = this.world; const list = this._passList = [];
            for (const st of this.stops || []) for (const ps of st.passing || []) {
                const poi = this.world.pois.find(p => p.id === ps.poi);
                const q = poi ? { x: poi.doorX ?? poi.x, z: poi.doorZ ?? poi.z } : (ps.lat != null ? this.city.proj(ps.lat, ps.lon) : null);
                if (q) list.push({ key: ps.poi || ps.title, x: q.x, z: q.z, title: ps.title, caption: ps.caption, r: ps.r || 90 });
            }
            for (const p of this.world.pois || []) if (p.passing && p.caption && !list.some(l => l.key === p.id)) list.push({ key: p.id, x: p.doorX ?? p.x, z: p.doorZ ?? p.z, title: `🏢 ${p.label || p.id}`, caption: p.caption, r: 90 });
        }
        const seen = this.flags.passed || (this.flags.passed = new Set());
        for (const l of this._passList) if (!seen.has(l.key) && Math.hypot(l.x - P.x, l.z - P.z) < l.r) { seen.add(l.key); this.hud.toast(l.title, l.caption, 'intro'); }
    }
    /** hatched area outside the district (minimap / big map), from world.district.inside() sampled once per world */
    drawOutside(ctx, canvas, { cx, cz, scale, heading = null }) {
        if (this.bigmap?.drawsOutside) return; // (minimap.js dims the outside itself since note 81: one renderer)
        const W = this.world, inside = W?.district?.inside, b = W?.bounds; if (!inside || !b) return;
        if (!this._outside || this._outside.world !== W) {
            const cell = 10, pad = 300, x0 = b.minX - pad, z0 = b.minZ - pad, w = Math.ceil((b.maxX - b.minX + 2 * pad) / cell), h = Math.ceil((b.maxZ - b.minZ + 2 * pad) / cell);
            const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
            const img = g.createImageData(w, h);
            for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
                if (inside(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell)) continue;
                const k = (j * w + i) * 4, hatch = ((i + j) % 6) < 2;
                img.data[k] = hatch ? 148 : 15; img.data[k + 1] = hatch ? 163 : 23; img.data[k + 2] = hatch ? 184 : 42; img.data[k + 3] = hatch ? 150 : 110;
            }
            g.putImageData(img, 0, 0);
            this._outside = { world: W, cv, x0, z0, w: w * cell, h: h * cell };
        }
        const o = this._outside;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        if (heading !== null) ctx.rotate(heading);
        ctx.scale(scale, scale); ctx.translate(-cx, -cz);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(o.cv, o.x0, o.z0, o.w, o.h);
        ctx.restore();
    }

    // ---------------------------------------------------------------------------------- unstick / reset
    /** stuck = barely moving while touching something for 2 s → prompt for R */
    updateUnstick(dt) {
        const P = this.player;
        if (Math.abs(P.speed) < 1 && P.touching) this.stuckT = (this.stuckT || 0) + dt;
        else this.stuckT = Math.max(0, (this.stuckT || 0) - dt * 0.5);
    }
    /** right-most lane pose on the nearest drivable edge to (x,z), facing the legal direction (closest to `heading`) */
    lanePose(x, z, heading, y = null, filter = null) {
        const cands = this.nav.index.near(x, z, 120, []);
        const scored = [];
        for (const e of cands) {
            if (filter && !filter(e)) continue;
            if (e.len < 6 || e.tramOnly || !(canTravel(e, 1) || canTravel(e, -1))) continue;
            if (e.type === 'service' || e.virtual) continue; // never reset onto service roads (narrow, private, dead ends)
            const ax = e.a.x, az = e.a.z, dx = e.b.x - ax, dz = e.b.z - az, L2 = dx * dx + dz * dz || 1;
            const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
            const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
            // on the car's level (a deck above / a street below is not "the nearest road")
            const ey = 0.24 + (e.ya ?? 0) + ((e.yb ?? 0) - (e.ya ?? 0)) * t;
            const lvl = y == null ? 0 : Math.abs(ey - y) < 2 ? 0 : 80;
            const score = d + lvl + (e.main === false ? 200 : 0) + (e.tunnel || e.bridge ? 25 : 0) + (e.len < 15 ? 12 : 0) + (isMotorway(e) ? 6 : 0);
            scored.push({ e, t, score });
        }
        scored.sort((a, b) => a.score - b.score);
        if (!scored.length) { const ne = this.nav.index.nearest(x, z, 3000, (e) => e.type !== 'service') || this.nav.index.nearest(x, z, 3000); if (!ne) return null; scored.push({ e: ne.edge, t: ne.t }); }
        const hx = -Math.sin(heading), hz = -Math.cos(heading);
        const poseOf = ({ e, t }, shift = 0) => {
            let dir = (e.dirx * hx + e.dirz * hz) >= 0 ? 1 : -1;
            if (!canTravel(e, dir)) dir = -dir;
            const lane = Math.max(0, lanesDir(e, dir) - 1);
            // keep out of the junction boxes when the edge is long enough
            const ra = (e.a.radius ?? 6) + 3, rb = (e.b.radius ?? 6) + 3;
            let s = t * e.len + shift; if (e.len > ra + rb) s = clamp(s, ra, e.len - rb); else s = clamp(s, 0, e.len);
            let lat = this.traffic.laneOffset(e, lane, dir);
            // never outside the carriageway (a narrow service road / lane: centre the car on it)
            const right = roadSideWidth(e, dir), left = roadSideWidth(e, -dir), margin = Math.min(1.1, (right + left) / 2);
            lat = clamp(lat, -left + margin, right - margin);
            if (e.type === 'service' && !e.sharedLane && lanesDir(e, 1) + lanesDir(e, -1) <= 2) lat = Math.min(lat, dir * (e.laneCenterShiftM || 0) + (e.oneway ? 0 : 0.6));
            return { x: e.a.x + e.dirx * s + e.nx * dir * lat, z: e.a.z + e.dirz * s + e.nz * dir * lat, heading: Math.atan2(-e.dirx * dir, -e.dirz * dir), edge: e, dir };
        };
        // (R reset in the chapter drives: "no route after reset") with a GPS destination, the pose must be one the route
        // can start from: an edge outside the main one-way component, too low for the car or cut off by turn bans was
        // the nearest road but left the player with no route. A pose that routes wins over a nearer one that does not.
        const dest = this.nav?.dest, routes = (p) => !dest || !!this.nav.compute(p.x, p.z, dest.x, dest.z, p.heading, y);
        let fallback = null, tries = 0;
        for (const c of scored.slice(0, 8)) for (const sh of [0, 8, -8, 16, -16]) {
            const p = poseOf(c, sh); if (!this.spotFree(p)) continue;
            if (!fallback) fallback = p;
            if (tries++ < 12 && routes(p)) return p;
        }
        return fallback || poseOf(scored[0]);
    }
    /** a car pose is free of buildings / props / walls at its level (the car body = 3 circles of 1 m) and, with
     *  `vehR`, of non-parked-away vehicles within that radius on the same level */
    spotFree(p, vehR = 0) {
        const w = this.world;
        const e = p.edge, sx = e ? ((p.x - e.a.x) * e.dirx + (p.z - e.a.z) * e.dirz) / (e.len || 1) : 0;
        const py = 0.24 + (e ? (e.ya ?? 0) + ((e.yb ?? 0) - (e.ya ?? 0)) * clamp(sx, 0, 1) : 0);
        const fx = -Math.sin(p.heading), fz = -Math.cos(p.heading);
        if (w?.buildings) for (const o of [1.3, 0, -1.3]) if (collideBuildings(w.buildings, p.x + fx * o, p.z + fz * o, 1.05, py)) return false;
        if (vehR > 0) for (const v of this.traffic.near(p.x, p.z, vehR)) if (v.parked && Math.abs((v.y ?? 0.24) - py) < 2) return false;
        return true;
    }
    /** R: put the car back on the road (nearest edge, right lane, legal direction) and clear NPCs around it */
    resetToRoad({ silent = false } = {}) {
        const P = this.player;
        const pose = this.lanePose(P.x, P.z, P.heading, P.surfY ?? null); if (!pose) return false;
        P.place(pose.x, pose.z, pose.heading, pose.edge); P.contactAge = 9; P.steer = 0;
        this.stuckT = 0; this.prevEdgeInfo = null;
        const n = this.traffic.clearForPlayer?.(P) ?? this.traffic.clearAround(pose.x, pose.z, 12);
        this.nav.reroute(P);
        if (!silent) { this.hud.toast('🛟 Back on the road', `${roadName(pose.edge)}${n ? ` · ${n} car${n > 1 ? 's' : ''} moved along` : ''}`); this.audio.blip(700, 0.08, 0.08); }
        return pose;
    }
}
