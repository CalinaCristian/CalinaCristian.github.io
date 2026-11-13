// Traffic methods (split from traffic.js, spec 22): horns, speech bubbles and the illegal-parking flow (assessment,
// fines, officer and tow truck), with the local remark lines.
import * as THREE from '../vendor/three.module.min.js';
import * as VEH from './vehicles.js';
import { PHRASES } from './data.js';
import { clamp } from './util.js';
import { dressFor } from './crowd.js';
import { canTravel, lanesDir, roadLateral, roadSideWidth } from './nav.js';
import { laneOffset, pointInPoly, sidewalkWidthOf, tramBaseOffset, vvPen } from './traffic-shared.js';

// ============================================================================
//  ILLEGAL-PARKING LINES (note 8). Bucharest: Romanian with the English translation (research/bucharest-spots.json
//  dialogue_general: locals grumble about sidewalk parking, honking and buses — good-humoured, never aggressive; the
//  three sidewalk lines are quoted from pedestrian_general.sidewalk_parking). Seattle / Bellevue: polite,
//  passive-aggressive remarks, little honking (research/seattle-spots.json: "Nobody honks around here — we wave").
// ============================================================================
const RL = (t, en) => ({ t, en });
const PARK_RO = {
    remark: [RL('Ts-ts-ts… parcat ca un șmecher.', 'Tsk tsk… parked like a big shot.'), RL('Ce tupeu!', 'The nerve!'), RL('Avariile = parcare gratuită, nu?', 'Hazard lights = free parking, right?'),
        RL('Las’ că vine Poliția Locală.', 'Just wait, the local police are coming.'), RL('Unde parchezi, pe capota mea?', 'Where are you parking, on my bonnet?'), RL('„Doar cinci minute”, sigur…', '"Just five minutes", sure…')],
    reason: {
        zebra: [RL('Pe trecere, domnule? Serios?', 'On the zebra crossing, sir? Seriously?'), RL('Pe unde trec acum, prin portbagaj?', 'How do I cross now, through the boot?')],
        junction: [RL('În mijlocul intersecției… bravo!', 'In the middle of the junction… well done!')],
        tram: [RL('Acum stă tramvaiul din cauza lui.', 'Now the tram is stuck because of him.'), RL('Pe șine?! Vine tramvaiul!', 'On the tracks?! The tram is coming!')],
        busstop: [RL('În stație?! Unde oprește autobuzul?', 'In the bus stop?! Where is the bus supposed to stop?')],
        buslane: [RL('Pe banda de autobuz, normal.', 'In the bus lane, of course.')],
        lane: [RL('A lăsat-o pe bandă, cu avariile, și dus a fost.', 'Left it in the lane with the hazards on and off he went.')],
        driveway: [RL('A blocat poarta. Cum mai ies eu acum?', 'He blocked the gate. How do I get out now?')],
        sidewalk: [RL('Iar mașini parcate pe trotuar...', 'Cars parked on the sidewalk again...'), RL('Pe unde să trec cu căruciorul?', 'Where am I supposed to pass with the stroller?')],
    },
    photo: [RL('Stai să-i fac o poză.', 'Hang on, let me take a picture.'), RL('Poză pentru grupul cartierului de pe Facebook.', 'A photo for the neighbourhood Facebook group.')],
    call: [RL('Alo, Poliția Locală? Avem una parcată {where}.', 'Hello, local police? There\'s one parked {where}.'), RL('Sun la Poliția Locală, gata.', 'I\'m calling the local police, that\'s it.')],
    where: { zebra: RL('pe trecere', 'on the crossing'), junction: RL('în intersecție', 'in the junction'), tram: RL('pe șine', 'on the tram tracks'), busstop: RL('în stație', 'in the bus stop'), buslane: RL('pe banda de autobuz', 'in the bus lane'), lane: RL('pe bandă', 'in the traffic lane'), driveway: RL('în fața porții', 'in front of a gate'), sidewalk: RL('pe trotuar', 'on the sidewalk') },
    driver: [RL('Hai, mă, mută mașina!', 'Come on, move the car!'), RL('Cine a lăsat-o aici?!', 'Who left this here?!'), RL('Ăsta-i parcat, nu? Super.', 'He\'s parked, isn\'t he? Great.')],
    officer: [RL('Poliția Locală. Ce avem aici…', 'Local police. What do we have here…')],
    ticket: [RL('Proces-verbal. Amendă pe parbriz.', 'Official report. The fine is on the windscreen.')],
    clamp: [RL('Proces-verbal și sabot pe roată.', 'A fine and a clamp on the wheel.')],
    truck: [RL('Ridicare auto! Facem loc.', 'Tow-away! Clearing the way.')],
    tow: [RL('O ridicăm. O găsiți la depozit.', 'We\'re lifting it. You\'ll find it at the pound.')],
};
const PARK_US = {
    remark: [RL('Wow. Okay.'), RL('Must be nice.'), RL('I\'m sure they\'ll be right back…'), RL('Interesting parking choice.'), RL('Some people, huh.'), RL('Hazards on doesn\'t make it a parking spot.')],
    reason: {
        zebra: [RL('That\'s… a crosswalk.'), RL('Guess I\'ll just walk around it. Into traffic.')],
        junction: [RL('In the intersection. Bold.')],
        busstop: [RL('The bus has to stop somewhere, you know.')],
        buslane: [RL('Pretty sure that\'s a bus lane.')],
        hydrant: [RL('Hope there\'s no fire today.'), RL('That\'s a hydrant, friend.')],
        lane: [RL('Just… in the lane. Cool.')],
        driveway: [RL('Pretty sure that\'s someone\'s driveway.')],
        sidewalk: [RL('I\'ll just walk in the street, then.'), RL('Strollers and wheelchairs use this, but sure.')],
        tram: [RL('On the tracks? Really?')],
    },
    photo: [RL('Getting a picture of this.'), RL('Snapping this for the city.')],
    note: [RL('Leaving them a little note. 🙂'), RL('A polite note. Very polite.')],
    call: [RL('Hi, yes — reporting a car parked {where}.'), RL('I\'ll call parking enforcement.')],
    where: { zebra: RL('in a crosswalk'), junction: RL('in an intersection'), tram: RL('on the tracks'), busstop: RL('in a bus zone'), buslane: RL('in the bus lane'), lane: RL('in a travel lane'), driveway: RL('across a driveway'), sidewalk: RL('on the sidewalk'), hydrant: RL('at a fire hydrant') },
    driver: [RL('Seriously?'), RL('Are they just… gone?'), RL('Okay, going around.')],
    officer: [RL('Parking Enforcement. Let\'s take a look.')],
    ticket: [RL('Citation\'s on the windshield.')],
    clamp: [RL('Citation\'s on the windshield.')],
    truck: [RL('Tow truck. This one\'s blocking traffic.')],
    tow: [RL('Hooking it up — it\'ll be at the impound lot.')],
};

export const trafficParkingMethods = {

    honk(v, reason) {
        const dialogueEvent=this.onHonk(v, reason);
        const P = this.player;
        if (P && Math.hypot(P.x - v.x, P.z - v.z) < 70 && v.bubbleCd <= 0) {
            v.bubbleCd = 4;
            this.bubble(v, reason === 'stuck' ? 'stuck' : 'honkedAt',dialogueEvent);
        }
    },

    /** the player honked: nearby drivers react */
    playerHonk(px, pz, fx, fz,dialogueEvent=null) {
        let reacted = 0;
        for (const v of this.near(px, pz, 28)) {
            const dx = v.x - px, dz = v.z - pz;
            const d = Math.hypot(dx, dz);
            const ahead = (dx * fx + dz * fz) / (d || 1);
            if (ahead < -0.2 && d > 10) continue;
            if (v.parked && this.rng.chance(0.3)) { this.bubble(v, 'honkedAt',dialogueEvent); reacted++; continue; }
            v.annoyed = 6;
            if (v.bubbleCd <= 0 && this.rng.chance(this.chaos > 0.5 ? 0.6 : 0.3)) {
                v.bubbleCd = 3;
                this.bubble(v, 'honkedAt',dialogueEvent); reacted++;
                if (this.rng.chance(0.4 * this.chaos)) this._scheduleHornReply(v,300 + this.rng() * 800);
            }
            if (v.speed < 0.2 && !v.parked && this.rng.chance(0.25)) v.speed = 1.5;
        }
        this.peds.scare(px, pz, 20);
        // (round 6 note 49) the nearest pedestrians answer back — city-specific lines (data.js PHRASES.<city>.pedHonked)
        { const now = performance.now(); if (!(this._pedHonkT > now)) {
            const L = (PHRASES[this.city.id] || PHRASES.bucharest)?.pedHonked;
            const peds = (this.peds.near(px, pz, 18) || []).filter(p => p.state !== 'down').sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz));
            let said = 0;
            for (const p of peds) { if (said >= 2 || !L?.length) break; if (this.rng.chance(0.55)) continue;
                const it = L[Math.floor(this.rng() * L.length)], line = typeof it === 'string' ? { t: it } : it;
                if (this.say(p, line, 'mad', 1,{situational:true,event:dialogueEvent,role:'pedestrian',simulation:true})) { said++; reacted++; } }
            if (said) this._pedHonkT = now + 2500;
        } }
        return reacted;
    },

    /** player bumped vehicle v */
    bump(v,dialogueEvent=null) {
        if (v.bubbleCd <= 0) { v.bubbleCd = 4; this.bubble(v, 'bumped',dialogueEvent); }
        if (this.rng.chance(0.5 * this.chaos + 0.1)) this.honk(v, 'bumped');
    },

    _scheduleHornReply(v,delay) { const timer=setTimeout(()=>{this._replyTimers?.delete(timer);this.honk(v,'reply');},delay);(this._replyTimers||=new Set()).add(timer); },
    dialogueEvent(kind,source,options) { return this._situational?.event(kind,source,options)||null; },
    emitDialogueEvent(event,options) { return this._situational?.dispatch(event,options)||0; },
    speakSituational(event,actor,role,options) { return this._situational?.present(event,actor,role,options)||false; },
    situationalHudFrame() { this._situational?.hudFrame(); },

    // ------------------------------------------------------------------ illegal parking reactions (note 8)
    /**
     * The player's car left somewhere illegal while the player is on foot (traffic.walker active, car still): passers-by
     * notice it and react (tutting / remarks, photos, a call to the city, a note on the windscreen — RO / US lines),
     * blocked drivers queue, honk and go round it (routing avoids a single-lane street it blocks), and after a while
     * Poliția Locală (ticket, wheel clamp, the "ridicare auto" tow truck) or Parking Enforcement (ticket, tow truck) turn up.
     *   traffic.onParkingEvent(cb) → unsubscribe. Events { type, reason, reasons, severity ('obstruct' | 'mild'), city,
     *   district, x, z, t (s since parked), fine?: { amount, currency, label } }. Types: 'illegal' (detected when the car
     *   is left), 'noticed', 'photo', 'report' (called in), 'note' (US, windscreen note), 'officer' (on the way),
     *   'ticket', 'clamp' (RO), 'towtruck' (arrived), 'tow' (the car is to be taken away — gameplay decides what happens:
     *   impound / fine; nothing moves the car here), 'cleared' (the player drove off / the car moved).
     *   traffic.parking: live state { illegal, reasons, primary, severity, t, log } (null while driving).
     * Rules (approximate, per spec 13 Request to research): RO OUG 195/2002 — no stopping on crossings, in junctions,
     * in bus / tram stops, on tram tracks, in a traffic lane of a main road, in front of gates; sidewalk parking where not
     * marked is fined. US (WA RCW 46.61.570 / city codes) — no parking in a crosswalk or intersection, within 15 ft of a
     * hydrant, in a bus zone, on a sidewalk, blocking a driveway or a traffic lane.
     */
    onParkingEvent(cb) { const L = this._parkCbs || (this._parkCbs = []); L.push(cb); return () => { const i = L.indexOf(cb); if (i >= 0) L.splice(i, 1); }; },
    emitParking(type, extra = {}) {
        const st = this.park, c = st?.check || {};
        const ev = { type, city: this.city.id, district: this.world.district?.id || null, reason: c.primary || null, reasons: c.reasons || [], severity: c.severity || null, x: st?.x, z: st?.z, t: Math.round((st?.t || 0) * 10) / 10, ...extra };
        if (st) st.log.push(type + '@' + ev.t);
        this.stats.parkingEvents = (this.stats.parkingEvents || 0) + 1;
        for (const cb of (this._parkCbs || []).slice()) { try { cb(ev); } catch (e) { console.warn('[traffic] parking event handler', e); } }
        return ev;
    },
    /** a driver's chat bubble of a kind (honkedAt, bumped, stuck, green, redLight) from data.js PHRASES: Romanian lines
     *  are {t, en} and show the English gloss underneath (plain strings still work); falls back to opts.onBubble */
    bubble(v, kind,dialogueEvent=null) {
        const L = (PHRASES[this.city.id] || PHRASES.bucharest)?.[kind] || PHRASES.bucharest?.[kind];
        const canSay = !!(this.onSay || globalThis.game?.hud?.say);
        if (!L?.length || !canSay) { if(!this._situational)this.onBubble(v, kind); return; }
        const last = (this._lastLine || (this._lastLine = {}))[kind]; let k = Math.floor(Math.random() * L.length);
        if (L.length > 1 && k === last) k = (k + 1 + Math.floor(Math.random() * (L.length - 1))) % L.length; // (never the same line twice in a row)
        this._lastLine[kind] = k;
        const it = L[k], line = typeof it === 'string' ? { t: it } : it;
        this.say(v, line, kind === 'bumped' ? 'angry' : kind === 'honkedAt' ? 'mad' : '', kind === 'bumped' ? 2 : 1,{situational:true,event:dialogueEvent,role:'driver'});
    },
    /** a chat bubble over anything with {x, z}: opts.onSay(target, text, sub, cls) when gameplay wires it, else hud.say */
    say(target, line, cls = '', pri = 2,options=null) {
        if(this._situational&&!options?.actual&&!options?.legacyAdmission){
            const legacy=this._situational.legacyAdmission(target,line,cls,pri);
            const actual=options?.situational?this._situational.present(options.event,target,options.role):this.say(target,line,cls,pri,{actual:true});
            return options?.simulation?legacy:actual;
        }
        if (!line || !target) return false;
        const ref = this.walker?.active ? this.walker : this.player;
        if (ref && Math.hypot(target.x - ref.x, target.z - ref.z) > 75) return false;
        // (after round 6) someone on another level (under the bridge / on the deck above) isn't talking to us
        if (ref && Number.isFinite(ref.y) && Math.abs((Number.isFinite(target.y) ? target.y : 0) - ref.y) > 3.5) return false; // (pedestrians: street level)
        const text = line.t, sub = line.en && line.en !== line.t ? line.en : '';
        const tgt = this.placeBubble(target, pri, !!sub,options?.legacyAdmission); if (!tgt) return false;
        if(options?.legacyAdmission){const h=options.legacyAdmission.hud;h.bubbles.push({v:tgt,until:performance.now()+4200});if(h.bubbles.length>14)h.bubbles.shift();return true;}
        try { if (this.onSay) this.onSay(tgt, text, sub, cls); else if(globalThis.game?.hud?.say)globalThis.game.hud.say(tgt,text,sub,cls);else if(options?.actual)return false; } catch { if(options?.actual)return false; }
        this._situational?.markEmitted(tgt);
        this.stats.parkingBubbles = (this.stats.parkingBubbles || 0) + 1;
        (this._sayLog || (this._sayLog = [])).push(text); if (this._sayLog.length > 40) this._sayLog.shift();
        return true;
    },
    /**
     * Screen-space layout of the chat bubbles traffic shows: at most 3 at once; a new bubble that would cover another one
     * is nudged sideways (its anchor follows the speaker with a world offset along the camera's right axis — the HUD
     * re-projects the anchor every frame), and when no nudge is free the lower-priority bubble is dropped (driver
     * grumbles 1 < passers-by / bumps 2 < officer / tow 3). Returns the anchor to hand to hud.say, or null (dropped).
     */
    placeBubble(target, pri, two,layout=null) {
        const now = performance.now(), cam = globalThis.game?.camera, hud = layout?.hud||globalThis.game?.hud,state=layout||this;
        const act = (state._bub = (state._bub || []).filter(b => b.until > now && (!hud?.bubbles || hud.bubbles.some(h => h.v === b.anchor))));
        const W = globalThis.innerWidth || 1280, Hh = globalThis.innerHeight || 720;
        const V = state._bv || (state._bv = new THREE.Vector3());
        const scr = (x, z, y = 2.6) => { if (!cam) return null; V.set(x, y, z).project(cam); if (V.z > 1 || Math.abs(V.x) > 1.2 || Math.abs(V.y) > 1.2) return null; return [(V.x + 1) / 2 * W, (1 - V.y) / 2 * Hh]; };
        const drop = (b) => { b.until = 0; const h = hud?.bubbles?.find(q => q.v === b.anchor); if (h) h.until = 0; };
        // at most three: make room by dropping the lowest priority (never one that outranks the new bubble)
        if (act.length >= 3) { const lo = act.reduce((a, b) => (b.pri < a.pri ? b : a)); if (lo.pri > pri || (lo.pri === pri && pri < 3)) return null; drop(lo); }
        const live = act.filter(b => b.until > now);
        const p0 = scr(target.x, target.z, target.bubbleY ?? 2.6);
        let ox = 0, oz = 0;
        if (p0 && live.length) {
            // camera right axis on the ground, and how many pixels a metre along it is at the speaker
            const e = cam.matrixWorld.elements, rx = e[0], rz = e[2], rl = Math.hypot(rx, rz) || 1;
            const p1 = scr(target.x + rx / rl, target.z + rz / rl, target.bubbleY ?? 2.6), ppm = p1 ? Math.max(4, Math.abs(p1[0] - p0[0])) : 40;
            const hit = (px, py) => live.find(b => { const q = scr(b.anchor.x, b.anchor.z, b.anchor.bubbleY ?? 2.6); return q && Math.abs(q[0] - px) < 190 && Math.abs(q[1] - py) < (two ? 58 : 44); });
            let ok = !hit(p0[0], p0[1]);
            for (const k of [1, -1, 2, -2]) {
                if (ok) break;
                const m = (k * 200) / ppm, px = p0[0] + k * 200;
                if (px < 60 || px > W - 60 || hit(px, p0[1])) continue;
                ox = rx / rl * m; oz = rz / rl * m; ok = true;
            }
            if (!ok) { const h = hit(p0[0], p0[1]); if (h && h.pri < pri) drop(h); else return null; }
        }
        const anchor = ox || oz ? { get x() { return target.x + ox; }, get z() { return target.z + oz; }, get bubbleY() { return target.bubbleY; } } : target;
        state._bub.push({ anchor, pri, until: now + 4300 });
        return anchor;
    },
    /** where the car stands and why that is illegal → { illegal, reasons, primary, severity, edge, dir, lat, along } */
    assessParking(P) {
        const x = P.x, z = P.z, y = P.surfY ?? P.y ?? 0.24, US = !this.buc;
        const R = new Set(); let car = null, depth = -Infinity, walk = null;
        const near = this.index.near(x, z, 40, []), nodes = new Set();
        for (const e of near) {
            if (e.tunnel) continue;
            const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z, L2 = dx * dx + dz * dz || 1;
            const t0 = ((x - e.a.x) * dx + (z - e.a.z) * dz) / L2, t = clamp(t0, 0, 1);
            const ey = (e.a.y ?? 0) + ((e.b.y ?? 0) - (e.a.y ?? 0)) * t;
            if (Math.abs(ey + 0.24 - y) > 2) continue;
            nodes.add(e.a); nodes.add(e.b);
            const cx = e.a.x + dx * t, cz = e.a.z + dz * t, d = Math.hypot(x - cx, z - cz), lat = (x - cx) * e.nx + (z - cz) * e.nz, hw = roadSideWidth(e, lat);
            if ((t0 < 0 || t0 > 1) && Math.abs(t0 - t) * e.len > 0.8) continue; // past the edge end: the junction pad decides
            if (d < hw + 0.3) { if (hw - d > depth) { depth = hw - d; car = { e, t, d, lat, hw }; } }
            else { const sw = sidewalkWidthOf(this.world, e, lat >= 0 ? 1 : -1, 0); if (sw > 0.6 && d < hw + sw + 1.2 && !walk) walk = { e, t, d, lat, hw }; }
        }
        for (const n of nodes) {
            const d = Math.hypot(x - n.x, z - n.z), rad = n.radius ?? 6;
            if (this.isJunction(n) && n.edges.length >= 3 && d < rad + 0.3) R.add('junction');
            if ((n.zebra || n.crossing) && n.edges.length <= 2 && d < 14) for (const g of n.edges) { // (marked crossing: 0–3 m past the node, carriageway-wide)
                const sg = g.a === n ? 1 : -1, al = ((x - n.x) * g.dirx + (z - n.z) * g.dirz) * sg, la = Math.abs((x - n.x) * g.nx + (z - n.z) * g.nz);
                if (al > -2.5 && al < 5 && la < roadSideWidth(g, roadLateral(g, x, z)) + 0.3) R.add('zebra');
            }
            if ((n.hasLight || n.zebra) && n.edges.length >= 3 && car && (car.e.a === n || car.e.b === n)) {
                const ds = (car.e.a === n ? car.t : 1 - car.t) * car.e.len; if (ds > rad - 1 && ds < rad + 6) R.add('zebra'); // the crossing in front of the stop line
            }
            const all = n.allEdges || n.edges;
            if (d < 7 && (car || walk) && all.some(g => g.type === 'service') && all.some(g => g.type !== 'service')) R.add('driveway');
        }
        for (const e of near) if (e.tramOnly && Math.hypot(x - (e.a.x + e.b.x) / 2, z - (e.a.z + e.b.z) / 2) < e.len / 2 + 2) {
            const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z, L2 = dx * dx + dz * dz || 1, t = clamp(((x - e.a.x) * dx + (z - e.a.z) * dz) / L2, 0, 1);
            if (Math.abs(roadLateral(e, x, z) - (e.laneCenterShiftM || 0)) < tramBaseOffset(e) + 2.2) R.add('tram');
        }
        if (car) {
            const e = car.e, side = car.lat >= 0 ? 1 : -1, laneW = e.laneW ?? 3.3;
            if (e.tram && Math.abs(car.lat - (e.laneCenterShiftM || 0)) < tramBaseOffset(e) + 2.1) R.add('tram');
            if (e.busLane && Math.abs(car.lat) > car.hw - laneW - 0.3) R.add('buslane');
            const kerbOk = (/^(residential|unclassified|living_street)$/.test(e.type) || (US && /^(tertiary|secondary)$/.test(e.type))) && Math.abs(car.lat) > car.hw - 2.8;
            if (e.type !== 'service' && !kerbOk && !e.tramOnly) R.add('lane');
            for (const p of this.world.pois || []) {
                if (p.kind !== 'busstop') continue; const px = p.x ?? p.doorX, pz = p.z ?? p.doorZ;
                if (Math.abs(px - x) > 18 || Math.abs(pz - z) > 18 || Math.hypot(px - x, pz - z) > 16) continue;
                const ps = (px - e.a.x - (e.b.x - e.a.x) * car.t) * e.nx + (pz - e.a.z - (e.b.z - e.a.z) * car.t) * e.nz;
                if (Math.sign(ps) === side && Math.abs(car.lat) > car.hw - laneW - 0.5) R.add('busstop');
            }
        } else if (walk) {
            let lot = false;
            for (const a of this.world.areas || []) if (a.kind === 'parking' && x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1 && pointInPoly(x, z, a.outer)) { lot = true; break; }
            if (!lot) R.add('sidewalk');
            for (const p of this.world.pois || []) if (p.kind === 'busstop' && Math.hypot((p.x ?? p.doorX) - x, (p.z ?? p.doorZ) - z) < 8) R.add('busstop');
        }
        if (US) for (const h of this.hydrants()) if (Math.hypot(h.x - x, h.z - z) < 4.6) { R.add('hydrant'); break; } // 15 ft
        const order = ['tram', 'junction', 'zebra', 'busstop', 'buslane', 'hydrant', 'driveway', 'lane', 'sidewalk'];
        const reasons = order.filter(r => R.has(r)), primary = reasons[0] || null;
        const severity = !primary ? null : reasons.some(r => r !== 'sidewalk') ? 'obstruct' : 'mild';
        let dir = 1, along = 0;
        if (car) { const hx = -Math.sin(P.heading), hz = -Math.cos(P.heading); dir = car.e.dirx * hx + car.e.dirz * hz >= 0 ? 1 : -1; if (!canTravel(car.e, dir) && canTravel(car.e, -dir)) dir = -dir; along = (dir > 0 ? car.t : 1 - car.t) * car.e.len; }
        return { illegal: !!primary, reasons, primary, severity, edge: car?.e || walk?.e || null, inLane: !!car, dir, lat: car ? car.lat * dir : 0, along, blockEdge: car && (R.has('lane') || R.has('junction') || R.has('tram') || R.has('zebra')) ? car.e : null };
    },
    hydrants() {
        if (this._hyd) return this._hyd;
        const out = this._hyd = [], F = this.world.data?.furniture || [], K = this.world.data?.furnKinds || [];
        for (let i = 0; i + 2 < F.length; i += 3) if (K[F[i]] === 'fire_hydrant') out.push({ x: F[i + 1] / 10, z: F[i + 2] / 10 });
        return out;
    },
    fineFor(kind) {
        // Romania (OUG 195/2002 art. 108 classes; 1 penalty point = 10 % of the gross minimum wage = 216.25 lei since
        // 1 July 2026, HG 146/2026; press summaries, spec 13 log): sidewalk parking that still leaves room = class I
        // (2–3 points), stopping on a crossing / in a junction / on tram tracks / in a stop or a lane = class II (4–5 points);
        // the minimum of the class is shown. Bucharest tow + pound fees vary by sector (not confirmed): offence fine only.
        // US: Bellevue / SeaTac amounts not confirmed → amount null (gameplay shows "Fine" without a number).
        const st = this.park, obstruct = st?.check?.severity === 'obstruct', PT = 216.25;
        if (this.buc) {
            const pts = obstruct ? 4 : 2, amt = Math.round(pts * PT * 100) / 100, hi = Math.round((pts + 1) * PT * 100) / 100;
            const cls = obstruct ? 'clasa a II-a' : 'clasa I';
            if (kind === 'tow') return { amount: amt, currency: 'RON', label: `Amendă (${cls}) + ridicare auto (taxa de ridicare se plătește separat)`, range: [amt, hi] };
            if (kind === 'clamp') return { amount: amt, currency: 'RON', label: `Amendă (${cls}) + blocare roți`, range: [amt, hi] };
            return { amount: amt, currency: 'RON', label: `Amendă Poliția Locală (${cls}, ${pts}–${pts + 1} puncte)`, range: [amt, hi] };
        }
        return { amount: null, currency: 'USD', label: kind === 'tow' ? 'Tow + impound' : 'Parking citation' };
    },
    updateParking(dt) {
        const P = this.player, W = this.walker;
        const parked = !!(P && W && W.active && Math.abs(P.speed || 0) < 0.3);
        let st = this.park;
        if (st && (!parked || Math.hypot(P.x - st.x, P.z - st.z) > 1.5)) { const towed = !!st.S.tow; this.endParking(towed ? 'towed' : parked ? 'moved' : 'driven-off'); st = null; if (towed && parked) this._towedTo = { x: P.x, z: P.z }; }
        if (!parked) return;
        if (!st) {
            const check = this.assessParking(P);
            // where the tow truck left it (gameplay moves the car on 'tow'): the pound's spot, nobody reacts to it again
            const tw = this._towedTo; if (tw && Math.hypot(P.x - tw.x, P.z - tw.z) < 3) { check.illegal = false; check.towed = true; check.blockEdge = null; } else this._towedTo = null;
            st = this.park = { x: P.x, z: P.z, heading: P.heading, t: 0, check, S: {}, seen: new Set(), bubbleT: 1.5, driverT: 2, scanT: 0, log: [], officer: null, truck: null, props: [], blockEdge: check.blockEdge };
            this.parking = { illegal: check.illegal, reasons: check.reasons, primary: check.primary, severity: check.severity, t: 0, log: st.log };
            if (check.illegal) this.emitParking('illegal');
            return;
        }
        if (!st.check.illegal) return;
        st.t += dt; this.parking.t = st.t;
        const S = st.S, US = !this.buc, L = US ? PARK_US : PARK_RO, rsn = st.check.primary, rng = this.rng;
        const pick = (arr) => arr && arr.length ? arr[Math.floor(rng() * arr.length)] : null;
        st.bubbleT -= dt; st.driverT -= dt; st.scanT -= dt;
        // ---- passers-by
        if (st.scanT <= 0) {
            st.scanT = 0.25;
            for (const p of this.peds.near(st.x, st.z, 15)) {
                if (st.bubbleT > 0) break;
                if (st.seen.has(p) || p.agent || p.react || p.onRoad || p.state === 'down') continue;
                st.seen.add(p); if (st.t < 2.5 || rng() > 0.75) continue;
                const r = rng(), face = { x: st.x, z: st.z };
                let kind = r < (US ? 0.6 : 0.5) ? 'remark' : r < (US ? 0.78 : 0.8) ? 'photo' : US && !S.note && st.t > 8 ? 'note' : 'call';
                if (kind === 'call' && S.report && rng() < 0.6) kind = 'remark';
                let line = null;
                if (kind === 'remark') line = rng() < 0.55 ? pick(L.reason[rsn]) || pick(L.remark) : pick(L.remark);
                else if (kind === 'photo') line = pick(L.photo);
                else if (kind === 'note') line = pick(L.note);
                if (kind === 'call') { const c = pick(L.call), w = L.where[rsn] || L.where.lane; line = { t: c.t.replace('{where}', w.t), en: c.en ? c.en.replace('{where}', w.en || w.t) : undefined }; }
                p.react = { t: kind === 'remark' ? rng.range(2, 3.5) : rng.range(3.5, 5), x: face.x, z: face.z, pose: kind === 'photo' ? 'photo' : kind === 'call' ? 'phone' : kind === 'note' ? 'point' : 'talk', prop: kind === 'photo' || kind === 'call' ? 'phone' : null };
                if (this.say(p, line,'',2,{simulation:true})) st.bubbleT = rng.range(2.2, 3.6);
                this.emitParking(kind === 'remark' ? 'noticed' : kind === 'photo' ? 'photo' : kind === 'note' ? 'note' : 'report', { by: 'passer-by' });
                if (kind === 'note') { S.note = true; this.addCarProp('note'); }
                if (kind === 'call') S.report = true;
            }
        }
        if (!S.report && st.t > (US ? 30 : 22)) { S.report = true; this.emitParking('report', { by: 'someone' }); }
        if (US && !S.note && st.t > 20) { S.note = true; this.addCarProp('note'); this.emitParking('note', { by: 'someone' }); }
        // ---- blocked drivers: queue, honk (Bucharest: a lot), remarks, go round (tryBypass / routing)
        if (st.driverT <= 0) {
            st.driverT = 0.5;
            for (const v of this.near(st.x, st.z, 32)) {
                if (v.parked || v.service || v.leader !== P || v.speed > 0.5 || (v.blockT || 0) < 1.5) continue;
                if (rng() < (US ? 0.15 : 0.55)) this.onHonk(v, 'stuck');
                if (st.bubbleT <= 0 && rng() < 0.6 && this.say(v, pick(L.driver), '', 1,{simulation:true})) { st.bubbleT = rng.range(2, 3); st.driverT = 3; this.stats.parkingHonks = (this.stats.parkingHonks || 0) + 1; }
                break;
            }
        }
        // ---- the authorities
        const obstruct = st.check.severity === 'obstruct';
        if (!S.officer && st.t > (US ? 42 : obstruct ? 36 : 45)) { S.officer = true; this.callOfficer(st); }
        if (S.arrived != null && !S.ticket && st.t > S.arrived + 6) {
            S.ticket = true;
            const off = st.officer;
            if (!US && !obstruct) { this.addCarProp('clamp'); this.emitParking('clamp', { fine: this.fineFor('clamp') }); this.say(off, pick(L.clamp), '', 3); }
            else { this.addCarProp('ticket'); this.emitParking('ticket', { fine: this.fineFor('ticket') }); this.say(off, pick(L.ticket), '', 3); }
        }
        if (obstruct && !S.truck && st.t > (US ? 70 : 50)) { S.truck = true; this.callTowTruck(st); }
        if (S.truckAt != null && !S.tow && st.t > S.truckAt + (US ? 12 : 10)) { S.tow = true; this.emitParking('tow', { fine: this.fineFor('tow') }); this.say(st.truck || st.officer, pick(L.tow), '', 3); }
        if (st.truck) { const on = ((this.time * 3) | 0) % 2 === 0; if (st.beacon) st.beacon.visible = on; st.truck.mesh.userData.setLights?.(on); }
    },
    /** the officer: a passer-by in uniform walks up to the car, writes the ticket / fits the clamp */
    callOfficer(st) {
        const peds = this.peds, P = this.player, W = this.walker; if (!peds.list.length) return;
        // a walker 25–120 m away (else anyone not busy), reused as the officer
        let best = null, bd = Infinity;
        for (const p of peds.list) { if (p.agent || p.react || p.state === 'down' || p.onRoad) continue; const d = Math.hypot(p.x - st.x, p.z - st.z); const sc = d < 25 ? 1e6 + d : Math.abs(d - 60); if (sc < bd) { bd = sc; best = p; } }
        if (!best) return;
        const e = st.check.edge, fx = -Math.sin(st.heading), fz = -Math.cos(st.heading), lx = fz, lz = -fx, w = (P.width || 1.8) / 2;
        // stand by the driver's door on the kerb side when the car is at the kerb, else beside the driver's door
        let tx = st.x + lx * (w + 0.8), tz = st.z + lz * (w + 0.8);
        // walk in from ~22 m behind the car along its sidewalk (out of the carriageway when possible)
        let sx = st.x - fx * 22 + lx * (w + 3), sz = st.z - fz * 22 + lz * (w + 3);
        if (e) { const side = ((st.x - e.a.x) * e.nx + (st.z - e.a.z) * e.nz) >= 0 ? 1 : -1, o = roadSideWidth(e, side) + 1.6, t = clamp(((st.x - e.a.x) * e.dirx + (st.z - e.a.z) * e.dirz) - 22 * Math.sign(fx * e.dirx + fz * e.dirz || 1), 0, e.len); sx = e.a.x + e.dirx * t + e.nx * o * side; sz = e.a.z + e.dirz * t + e.nz * o * side; }
        if (W && Math.hypot(sx - W.x, sz - W.z) < 6) { sx = st.x + fx * 24; sz = st.z + fz * 24; }
        best.x = sx; best.z = sz; peds.kerbClamp(best); peds.obsClamp(best);
        best.outfit0 = true; const o = dressFor(this.city.id, undefined, null, this.rng);
        try { peds.crowd.dress(best.i, { ...o, top: this.buc ? '#1c2a4a' : '#16213a', bottom: '#151b29', flags: 4 }); } catch { /* old crowd */ }
        best.agent = { x: tx, z: tz, fx: st.x, fz: st.z, pose: 'phone', prop: 'phone', onArrive: () => { st.S.arrived = st.t; this.emitParking('officer', { arrived: true }); } };
        st.officer = best; this.emitParking('officer', { arrived: false });
        this.say(best, (this.buc ? PARK_RO : PARK_US).officer[0], '', 3);
    },
    /** the tow truck ("ridicare auto" / tow company): parks in the lane right in front of the car, beacon flashing */
    callTowTruck(st) {
        const P = this.player, c = st.check, e = c.edge; if (!e) return;
        const dir = canTravel(e, c.dir) ? c.dir : -c.dir, lanes = lanesDir(e, dir) || 1;
        let lane = 0, bd = Infinity; for (let l = 0; l < lanes; l++) { const d = Math.abs(laneOffset(e, l, dir) - c.lat * (dir === c.dir ? 1 : -1)); if (d < bd) { bd = d; lane = l; } }
        const kind = VEH.VEHICLE_KINDS?.includes?.('truck') ? 'truck' : 'van', Lt = this.kindLength(kind), Lc = P.length || 4.4;
        const along = dir === c.dir ? c.along : e.len - c.along;
        let s = along + Lc / 2 + Lt / 2 + 1.2; if (s + Lt / 2 > e.len - 1) s = along - Lc / 2 - Lt / 2 - 1.2;
        if (s - Lt / 2 < 0.5) return;
        const v = this.spawn({ edge: e, dir, lane, s, kind });
        v.service = 'tow'; v.parked = true; v.mesh.userData.parked = true; v.speed = 0; v.hazard = true;
        v.lateralExtra = v.latExtraCur = clamp(c.lat * (dir === c.dir ? 1 : -1) - laneOffset(e, lane, dir), -4, 4);
        this.placeOnLane(v, true, 0);
        const h = VEH.vehicleSize?.(kind, this.city.id)?.height || 3;
        const b = st.beacon = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: '#ffae00' }));
        b.position.set(0, h + 0.08, -Lt * 0.3); v.mesh.add(b);
        for (const o of this.near(v.x, v.z, 16)) if (o !== v && !o.service && !o.inactive && vvPen(v, o) > -0.3) { if (!(this.large && this.relocate(o, 250, this.bubble, true))) this.respawn(o); }
        this.grid.build(this.vehicles);
        st.truck = v; st.S.truckAt = st.t;
        this.emitParking('towtruck');
        this.say(v, (this.buc ? PARK_RO : PARK_US).truck[0], '', 3);
    },
    /** paper under the wiper (note / ticket) or a yellow wheel clamp on the parked car */
    addCarProp(kind) {
        const st = this.park, P = this.player; if (!st || !P) return;
        if (st.props.some(m => m.userData.kind === kind)) return;
        const fx = -Math.sin(st.heading), fz = -Math.cos(st.heading), lx = fz, lz = -fx, w = (P.width || 1.8) / 2, y0 = P.surfY ?? 0.24;
        const g = new THREE.Group(); g.userData.kind = kind;
        if (kind === 'clamp') {
            const yel = new THREE.MeshBasicMaterial({ color: '#f5c518' }), red = new THREE.MeshBasicMaterial({ color: '#c81e1e' });
            const disc = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 0.52), yel), arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.6), red);
            disc.position.set(0, 0.33, 0); arm.position.set(0.02, 0.62, 0); g.add(disc, arm);
            g.position.set(st.x + fx * 1.25 + lx * (w + 0.06), y0, st.z + fz * 1.25 + lz * (w + 0.06));
            g.rotation.y = st.heading;
        } else {
            const paper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.28), new THREE.MeshBasicMaterial({ color: kind === 'note' ? '#fde68a' : '#fb923c' }));
            g.add(paper);
            const side = kind === 'note' ? 0.38 : -0.3;
            g.position.set(st.x + fx * 0.9 + lx * side, y0 + 1.02, st.z + fz * 0.9 + lz * side);
            g.rotation.set(-0.55, st.heading, 0, 'YXZ');
        }
        this.group.add(g); st.props.push(g);
    },
    endParking(why) {
        const st = this.park; if (!st) return;
        if (st.check.illegal) this.emitParking('cleared', { why, stages: Object.keys(st.S) });
        for (const m of st.props) { this.group.remove(m); m.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
        const off = st.officer;
        if (off) { off.agent = null; off.pose = 0; off.prop = null; try { this.peds.crowd.dress(off.i, null); } catch { /* ignore */ } if (off.state === 'walk' && off.e) this.peds.placeWalk(off); else off.state = off.e ? 'walk' : 'stand'; if (off.state === 'walk') this.peds.placeWalk(off); }
        const v = st.truck;
        if (v) { const i = this.vehicles.indexOf(v); if (i >= 0) this.vehicles.splice(i, 1); v.inactive = true; v.mesh.visible = false; if (st.beacon) v.mesh.remove(st.beacon); this.group.remove(v.mesh); this.grid.build(this.vehicles); }
        this.park = null; this.parking = null;
    },
};
