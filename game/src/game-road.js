// Game methods: life on the road — fuel stations and refuelling, tow truck, speed enforcement and fines,
// road events, closures (roadworks, protests) and the U-turn. Installed on Game.prototype by main.js (mixin).
import { ROADWORKS } from './data.js';
import { roadWidthAt } from './nav.js';
import { clamp } from './util.js';
import { makeCrowd, dressFor, seasonOf } from './crowd.js';
import { fineFor, GAL, money, PRICES, TANK_L } from './game-common.js';

export class RoadMethods {
    setupStations(city, world) {
        const P = PRICES[city.id];
        const real = world.pois.filter(p => p.kind === 'fuel');
        this.stations = real.map(p => {
            const brand = p.brand || p.label || p.name || 'Fuel station';
            return { x: p.doorX ?? p.x, z: p.doorZ ?? p.z, brand, price: P.brands[brand] ?? P.def, poi: p };
        });
        // (2026-11-08, owner: "if gas stations do not match real data, remove them") only stations mapped in OSM: the
        // invented fallback forecourts stood on lots where real buildings are; a district without one burns no fuel
        for (const s of this.stations) { s.icon = '⛽'; s.color = '#0f766e'; }
    }

    // ---------------------------------------------------------------------------------- fuel
    /** (h-stations, 2026-11-13) the map offers a station only when a route reaches it from where the player is. A
     *  district map can hold a station in a pocket of one-way carriageways fed only from outside the map: Pipera's three
     *  on Șos. Pipera westbound (entered from the map ends on Șos. Pipera and Barbu Văcărescu), Otopeni's Rompetrol on
     *  Str. Nicolae Grigorescu (entered from DN1 northbound at the south map end). Real OSM ways, no join invented. */
    stationOffered(s, from = null) {
        const P = from || (this.state === 'foot' && this.foot?.active ? this.foot : this.player);
        if (!this.nav || !P) return true;
        const key = `${this.district}|${this.nav.walking ? 'w' : 'd'}|${Math.round(P.x / 25)}|${Math.round(P.z / 25)}|${Math.round(s.x)}|${Math.round(s.z)}`;
        const memo = this._stationRoute || (this._stationRoute = new Map());
        if (!memo.has(key)) {
            if (memo.size > 200) memo.clear();
            let r = null; try { r = this.nav.compute(P.x, P.z, s.x, s.z, P.heading ?? null, P.surfY ?? P.y ?? null); } catch { r = null; }
            memo.set(key, !!r);
        }
        return memo.get(key);
    }
    nearestStation(x, z) { let best = null, bd = Infinity; for (const s of this.stations) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } } return best ? { st: best, d: bd } : null; }
    updateFuelStops(dt, v) {
        if (!this.stations?.length) return null;
        const { player, input, hud, city } = this;
        const P = PRICES[city.id];
        if (this.refuel) {
            const r = this.refuel; r.t += dt;
            const k = clamp(r.t / r.dur, 0, 1);
            this.fuel = r.from + (r.to - r.from) * k;
            if (k >= 1) {
                const liters = r.to - r.from; const cost = liters * r.st.price / (P.unit === 'gal' ? GAL : 1);
                this.stats.fuelL += liters; this.stats.fuelCost[P.cur] += cost;
                const qty = P.unit === 'gal' ? `${(liters / GAL).toFixed(1)} gal` : `${liters.toFixed(1)} L`;
                hud.toast(`⛽ ${r.st.brand} · full tank`, `${qty} · ${money(P.cur, cost)}`);
                if (hud.achievement('full-tank')) this.audio.chime();
                this.refuel = null; this.flags.emptyToast = false;
            }
            return `⛽ Refuelling at <b>${r.st.brand}</b>… ${Math.round(k * 100)}%`;
        }
        const ns = this.nearestStation(player.x, player.z);
        if (ns && ns.d < 12 && v < 2 && this.fuel < TANK_L - 0.5) {
            const price = P.unit === 'gal' ? `$${ns.st.price.toFixed(2)}/gal` : `${ns.st.price.toFixed(2)} RON/L`;
            if (input.take('KeyE')) {
                const liters = TANK_L - this.fuel;
                this.refuel = { t: 0, dur: clamp(2 + liters / 25, 2, 3), from: this.fuel, to: TANK_L, st: ns.st };
                this.audio.pump(this.refuel.dur);
            }
            return `<kbd>E</kbd> Refuel at <b>${ns.st.brand}</b> · ${price}`;
        }
        if (this.fuel <= 0 && v < 2.5) {
            if (input.take('KeyT') || input.take('KeyE')) this.towTruck();
            return `<kbd>T</kbd> Out of fuel — call a tow truck → nearest station`;
        }
        return null;
    }
    towTruck() {
        const ns = this.nearestStation(this.player.x, this.player.z); if (!ns) return;
        const p = this.roadPose(ns.st.x, ns.st.z);
        // stop a few metres before the pumps so the refuel prompt is in reach
        this.player.place(p.x - Math.sin(p.heading) * -4, p.z - Math.cos(p.heading) * -4, p.heading, p.edge || null);
        this.fuel = 10;
        const cur = PRICES[this.city.id].cur; const fee = cur === 'RON' ? 350 : 195;
        this.stats.tow[cur] += fee;
        this.hud.addRage(30);
        this.hud.toast('🚛 Tow truck', `Dropped at ${ns.st.brand} with 10 L. Tow fee: ${money(cur, fee)}.`, 'warn');
        if (this.hud.achievement('ran-dry')) this.audio.chime();
        this.flags.emptyToast = false;
        this.nav.reroute(this.player);
    }

    // ---------------------------------------------------------------------------------- enforcement
    giveFine(title, body, overKmh, kind) {
        const cur = PRICES[this.city.id].cur;
        const amount = kind === 'pedestrian' ? (cur === 'RON' ? 2900 : 1000) : kind === 'red' ? (cur === 'RON' ? 1160 : 139) : fineFor(this.city.id, overKmh);
        this.stats.fines[cur] += amount; this.stats.fineCount++; this.stats.cleanDist = 0;
        this.hud.toast(title, `${body} ${cur === 'RON' ? `Amendă ${money(cur, amount)}` : `${money(cur, amount)} ticket`}`, 'warn');
        return amount;
    }
    updateEnforcement(dt, over, overKmh) {
        const p = this.player;
        for (const c of this.cameras || []) {
            c.cd = Math.max(0, c.cd - dt);
            const d = Math.hypot(c.x - p.x, c.z - p.z);
            if (c.lastD >= 16 && d < 16 && over && c.cd <= 0) {
                c.cd = 15; this.hud.flash(); this.audio.shutter();
                this.giveFine('📸 Speed camera', `${Math.round(Math.abs(p.speed) * (this.city.units === 'mph' ? 2.237 : 3.6))} ${this.city.units === 'mph' ? 'mph' : 'km/h'} in a ${this.limitInfo?.value} zone.`, overKmh, 'speed');
                this.hud.achievement('camera');
            }
            c.lastD = d;
        }
        this.policeCd = Math.max(0, (this.policeCd || 0) - dt);
        if (over && overKmh > 15 && this.policeCd <= 0) {
            const cop = this.traffic.policeNear(p.x, p.z, 45);
            if (cop && Math.random() < dt * 0.6) {
                this.policeCd = 30; this.audio.siren(1.4);
                this.giveFine(this.city.id === 'bucharest' ? '🚓 Poliția Rutieră' : '🚓 Pulled over (WSP)', this.city.id === 'bucharest' ? 'Actele la control, vă rog.' : 'License and registration, please.', overKmh, 'speed');
                this.hud.addRage(10);
                this.hud.achievement('police');
            }
        }
    }

    checkRoadEvents(ne, dt) {
        const { player, hud, traffic } = this;
        if (!ne || ne.d > roadWidthAt(ne.edge, player.x, player.z) + 1) { this.prevEdgeInfo = null; return; }
        const e = ne.edge;
        const towardB = (player.fx * e.dirx + player.fz * e.dirz) > 0;
        const endNode = towardB ? e.b : e.a;
        const distEnd = towardB ? e.len * (1 - ne.t) : e.len * ne.t;
        const key = e.id + ':' + endNode.id;
        const line = (endNode.radius ?? 6) + 1.6;
        if (this.prevEdgeInfo && this.prevEdgeInfo.key === key && this.prevEdgeInfo.distEnd > line && distEnd <= line && Math.abs(player.speed) > 2.5 && endNode.hasLight) {
            const st = traffic.lightState(endNode, e);
            if (st === 'red') {
                hud.toast('🚦 Red light!', this.city.id === 'bucharest' ? 'Very local of you.' : 'That\'s a ticket in Washington.', 'warn'); hud.achievement('red-light'); hud.addRage(8); traffic.playerHonk(player.x, player.z, player.fx, player.fz);
                const cop = traffic.policeNear(player.x, player.z, 70);
                if (cop || endNode.redLightCamera) this.giveFine(cop ? (this.city.id === 'bucharest' ? '🚓 Poliția Rutieră' : '🚓 Pulled over (WSP)') : '📸 Red-light camera', 'Ran a red light.', 0, 'red');
            }
        }
        this.prevEdgeInfo = { key, distEnd };
        // special places
        const name = e.name || '';
        if ((endNode.id === 'victoriei' || /Victoriei/.test(name) && endNode.edges.length >= 4) && distEnd < 25) hud.achievement('victoriei');
        if (e.toll && !this.flags['toll:' + (e.name || e.id)]) { this.flags['toll:' + (e.name || e.id)] = true; hud.toast('💳 Good To Go!', 'SR-520 toll charged: $4.50', 'warn'); hud.achievement('toll'); this.stats.tolls = (this.stats.tolls || 0) + 4.5; }
        if (e.bridge && /Murrow|I-90|I 90/.test(name + (e.ref || '')) && /Lake|Murrow|Floating/.test(name) && !this.flags.bridge) { this.flags.bridge = true; hud.achievement('bridge'); hud.toast('🌉 Lake Washington', 'Floating on I-90. Mount Rainier to your right on a clear day.'); }
        if (name.includes('Kiseleff') && !this.flags.kiseleff) { this.flags.kiseleff = true; hud.toast('🌳 Șoseaua Kiseleff', 'Bucharest\'s grand tree-lined boulevard. Arcul de Triumf ahead.'); }
        if ((e.type === 'dn' || /DN1\b|București-Ploiești/.test(name + (e.ref || ''))) && !this.flags.dn1) { this.flags.dn1 = true; hud.toast('🛣️ DN1', 'The only road to the airport. Everyone in Bucharest is on it right now.'); }
    }

    // ---------------------------------------------------------------------------------- district edges (R10.9)
    /** closures where roads leave the district (world.closures) + a roadworks crew at the Bucharest ones */
    setupClosures(city, world) {
        this.closures = (world.closures || []).map(c => ({ ...c, toastT: -1e9 }));
        this.closureStopT = 0; this._outside = null;
        if (this.player) this.player.softZones = this.closures;
        this.workers = [];
        this.crew?.dispose?.(); this.crew = null;
        if (city.id !== 'bucharest' || !this.closures.length) return;
        // one instanced crowd for the whole roadworks crew (2 draw calls instead of 7 meshes per worker; crowd.js)
        const list = this.closures.filter(c => c.edge && c.worker !== false);
        const crew = this.crew = makeCrowd({ max: list.length, city: city.id, season: seasonOf(this.nowDate()), castShadow: true });
        list.forEach((c, i) => {
            const e = c.edge;
            const ix = Math.sin(c.heading), iz = Math.cos(c.heading), px = -iz, pz = ix; // into the map / across the road
            const side = Math.max(e.wR ?? 3, e.wL ?? 3) + 1.6;
            let x = c.x + ix * 3 + px * side, z = c.z + iz * 3 + pz * side, y = (c.node?.y ?? 0) + 0.2;
            if (c.worker && Number.isFinite(c.worker.x)) { x = c.worker.x; z = c.worker.z; y = Number.isFinite(c.worker.y) ? c.worker.y : y; } // world-visual: behind the barrier, clear of the sign plates (note 6)
            crew.dress(i, dressFor(city.id, crew.season, null, Math.random, 'worker'));
            crew.set(i, { x, y, z, yaw: Math.atan2(-ix, -iz), amp: 0, phase: i }); // facing into the map (the traffic coming from inside)
            this.workers.push({ x, z, levelBand: c, nextT: 0 });
        });
        this.scene.add(crew.object);
    }
    closureText(c) {
        if (this.freeRoam) { const nm = c.leadsTo ? (this.city.districts?.[c.leadsTo]?.name || c.leadsTo) : null; return ['🚧 Road closed', nm ? `${nm} is another district: jump there from the world map (M).` : 'Edge of the district. Turn around (U).']; }
        const name = c.leadsTo ? (this.city.districts?.[c.leadsTo]?.name || c.leadsTo) : null;
        const idx = c.leadsTo && this.chapters ? this.chapters.findIndex(ch => ch.city === this.city.id && ch.district === c.leadsTo) : -1;
        if (idx < 0) return ['🚧 Road closed', 'Outside the story. Turn around (U).'];
        const ch = this.chapters[idx];
        if (this.progress.reached.has(ch.id) && ch.district !== this.district) return [`🚧 ${name}`, 'Open it from the chapter map (M → Chapters).'];
        if (ch.district === this.district) return ['🚧 Road closed', 'Outside the story. Turn around (U).'];
        return ['🚧 Road closed', `${name} opens in Chapter ${idx + 1} (${ch.year}).`];
    }
    /** approach toast, soft stop → "Turn around" prompt (U / tap), roadworks chatter; returns a prompt or null */
    updateClosures(dt) {
        if (!this.closures?.length) return null;
        const P = this.player, now = performance.now(); let prompt = null;
        for (const c of this.closures) {
            if (!P.atLevel(c)) continue;
            const dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz);
            if (d < 40 && d > 0.5 && (dx * P.fx + dz * P.fz) / d > 0.6 && now - c.toastT > 30000 && now - (this._closureToastT || 0) > 8000) { c.toastT = now; this._closureToastT = now; const [t, b] = this.closureText(c); this.hud.toast(t, b, 'warn'); }
        }
        if (P.closureHit && now - (P.closureAt || 0) < 500) this.closureStopT += dt; else this.closureStopT = Math.max(0, this.closureStopT - dt * 0.5);
        if (this.closureStopT > 2 && Math.abs(P.speed) < 2) {
            prompt = '<kbd>U</kbd> Turn around <button class="btn small" data-act="uturn" style="pointer-events:auto">↩︎ Turn around</button>';
            if (this.input.take('KeyU')) { this.uTurn(); prompt = null; }
        }
        for (const w of this.workers || []) {
            if (w.levelBand && !P.atLevel(w.levelBand)) continue;
            if (now < w.nextT) continue;
            const d = Math.hypot(w.x - P.x, w.z - P.z);
            if (d < 35) { const L = ROADWORKS[this.city.id] || ROADWORKS.bucharest; const l = L[Math.floor(Math.random() * L.length)]; this.hud.say(w, l.text, l.en); w.nextT = now + 9000 + Math.random() * 7000; }
        }
        return prompt;
    }
    /** auto U-turn at a closure: the right-most lane of the same road, the other way */
    uTurn() {
        const P = this.player;
        const pose = this.lanePose(P.x - P.fx * 3, P.z - P.fz * 3, P.heading + Math.PI, P.surfY ?? null);
        if (!pose) return false;
        P.place(pose.x, pose.z, pose.heading, pose.edge); P.speed = 0; P.steer = 0; P.contactAge = 9; P.closureHit = null;
        this.closureStopT = 0; this.traffic.clearForPlayer?.(P, { r: 10, ahead: 25, behind: 6 }) ?? this.traffic.clearAround(pose.x, pose.z, 10); this.nav.reroute(P);
        this.audio.blip(640, 0.06, 0.07);
        return true;
    }
}
