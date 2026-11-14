// SpotSession for index.js (split out by spec 22; index.js re-exports SpotSession, spotProgress, placeLabel and
// setNightWindows): plays a loaded spot inside a host (the game, or game/dev/spots.html) - Renderer3D wiring, walker,
// crowd, plaques, postcard challenge, activities, sound, UI, night lights, telemetry and saved progress
// (localStorage['dmcv.spots.v1']).
import * as THREE from '../../vendor/three.module.min.js';
import { Crowd } from './people.js';
import { SpotUI, SpotMap } from './ui.js';
import { SpotSound } from './sound.js';
import { LocalWalker } from './walker.js';
import { findWalkPath, pathLength, walkHeight, walkSegment, withMovingBodies, walkingLevelGround, TOUR_WALK_LIMIT_M } from './tour.js';
import { inPoly, polyBox, DEG, distPolyline } from './kit.js';
import { spotById } from './index.js';

const STORE = 'dmcv.spots.v1';
export function spotProgress() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } }
function saveProgress(p) { try { localStorage.setItem(STORE, JSON.stringify(p)); } catch { /* private mode */ } }

export class SpotSession {
    constructor(spot, host) {
        this.spot = spot; this.host = host; this.t = 0; this.nightK = 0; this.idleCheck = 0; this.progress = spotProgress();
        this.camera = host.camera; this.input = host.input; this.r3d = host.r3d;
    }
    async start() {
        const { spot, host } = this, r3d = this.r3d, cam = this.camera;
        cam.near = 0.25; // on foot: render's depth-precision test (note 55)
        cam.far = Math.max(cam.far, Number.isFinite(spot.env.cameraFarM) ? spot.env.cameraFarM : 9000);
        cam.updateProjectionMatrix();
        const T = [performance.now()];
        if (host.season !== undefined) r3d.setSeason(host.season === 'auto' ? null : host.season);
        r3d.setScene(spot.scene, cam, spot.env, { units: spot.units, vegetation: spot.vegetation,
            ...(host.weather !== undefined ? { weather: host.weather === 'live' ? null : host.weather } : {}),
            clock: { date: host.date || new Date(), lat: spot.clock.lat, lon: spot.clock.lon, timeZone: host.timeZone ?? spot.clock.timeZone, timeScale: host.timeScale ?? 1, override: host.override ?? null } }); T.push(performance.now());
        r3d.setLamps(spot.lamps, { headMesh: spot.lampHeadMesh }); T.push(performance.now());
        r3d.setHeadlights?.(false);
        // walker: the game's OnFootController (spec 14) when present, else the local fallback
        let Ctl = null;
        if (host.walker !== 'local') { try { Ctl = (await import('../onfoot.js')).OnFootController; } catch { Ctl = null; } }
        const obstacles = () => { const p = this.ctl; return [...(this.spot.crowd ? this.spot.crowd.obstacles(p.x, p.z) : []), ...(this.spot.ctx.extras.obstacles?.() || [])]; };
        const opts = { scene: spot.scene, camera: cam, input: this.input, colliders: spot.colliders, audio: host.audio, obstacles, groundAt: spot.groundAt };
        this.ctl = Ctl ? new Ctl(opts) : new LocalWalker(opts);
        this.walkerKind = Ctl ? 'OnFootController' : 'LocalWalker';
        const sp = spot.spawn; this.ctl.enter(sp.x, sp.z, sp.heading, sp.y);
        if (Number.isFinite(sp.pitch)) { this.ctl.pitch = Math.max(-1.3, Math.min(1.3, sp.pitch)); this.ctl.place(); }
        r3d.setPlayer(this.ctl);
        if (this.input) this.input.lookAllowed = true;
        // UI + sound
        this.ui = new SpotUI(host.uiRoot || document.body);
        this.ui.setTitle(spot.name, `${placeLabel(spot)} · walk-only bonus`);
        this.ui.setHelp('WASD walk · Shift run · Space jump · E interact · G drone · P camera · click to look (Esc releases)');
        if (spot.crowd) spot.crowd.o.bubbles = this.ui.bubbles;
        this.sound = new SpotSound({ audio: host.audio });
        for (const so of spot.sounds) this.sound.add(so.kind, so.x, so.z, so.radius, so.gain);
        spot.ctx.session = this;
        this._updateChallengeText();
        try { this._initMap(); } catch (e) { console.warn('[spots] map', e); }
        T.push(performance.now());
        this.startTiming = T.slice(1).map((t, i) => Math.round(t - T[i]));
        console.info('[spots] session start ms (setScene, setClock, setLamps, walker+ui+sound):', this.startTiming.join(', '));
        window.cvTelemetry?.track?.('spot_enter', { id: spot.id, scene: spot.sceneId, city: spot.city });
    }
    get position() { return this.ctl.position; }
    cancelActivities(reason = 'cancel') {
        const extras = this.spot.ctx.extras;
        extras.venueActivities?.cancel(reason); extras.participation?.cancel(reason);
        for (const cancel of extras.activityCancellers || []) cancel(reason);
    }
    // ------------------------------------------------------------------ spot map + objectives + guided tour (notes 32/33/67)
    /** everything worth finding in this scene: { kind, x, z, label, done, icon? } (landmarks, plaques, postcard, activities, entrances) */
    objectives() {
        const S = this.spot, out = [], P = this.progress, read = P.plaques || {};
        for (const mid of S.data.members || []) { const e = spotById(mid), d = S.data.spots[mid]; if (!e || !d || mid !== S.id && !e.available) continue;
            const ch = S.challenges.find((c) => c.id === mid), ext = d.extent?.polygon?.length ? polyBox(d.extent.polygon) : null;
            // the spot itself (its extent centre, else the postcard stand / spawn) — not ch.view, the point the postcard
            // looks AT (Kerry Park: downtown, 1.2 km away — the tour walked you into the city; after round 6)
            let hx = ext ? (ext.x0 + ext.x1) / 2 : ch?.x ?? d.spawn?.x ?? 0, hz = ext ? (ext.z0 + ext.z1) / 2 : ch?.z ?? d.spawn?.z ?? 0;
            const boundary = S.ctx.extras.walkBoundary;
            if (boundary && !boundary.inside(hx, hz)) {
                const arrival = S.spawns?.[mid] || d.spawn;
                if (!arrival || !boundary.inside(arrival.x, arrival.z)) continue;
                hx = arrival.x; hz = arrival.z;
            }
            out.push({ kind: 'hero', id: mid, x: hx, z: hz, label: e.name, blurb: e.blurb, done: !!this._seen?.has('hero:' + mid) }); }
        const entrances = Object.entries(S.spawns || {}).filter(([k]) => k === S.id || spotById(k)?.available);
        for (const [k, sp] of entrances) if (entrances.length > 1) out.push({ kind: 'entrance', x: sp.x, z: sp.z, label: 'Entrance: ' + (spotById(k)?.name || k), done: true, noTour: true });
        for (const pl of S.plaques) out.push({ kind: 'plaque', x: pl.x, z: pl.z, label: pl.title, text: pl.text, done: !!read[S.sceneId + ':' + pl.title], plaque: pl });
        for (const c of S.challenges) if (c.id === S.id || spotById(c.id)?.available) out.push({ kind: 'postcard', id: c.id, challenge: c, x: c.x, z: c.z, label: 'Postcard photo: ' + (spotById(c.id)?.name || 'the iconic view'), text: c.text, done: !!P.postcards?.[c.id] });
        const acts = [];
        for (const it of S.interactables) { if (it.kind === 'plaque' || it.kind === 'guide' || it.kind === 'talk' || it.hidden) continue; const lb = typeof it.label === 'function' ? it.label(this) : it.label; if (!lb) continue;
            acts.push({ kind: it.kind === 'bike' ? 'bike' : 'activity', interaction: it, noTour: !!it.noTour, x: it.x, z: it.z, full: lb, done: false }); }
        // short labels; activities sharing a "Verb: name" prefix (≥ 3, e.g. the Village Museum houses) become one group objective
        const pre = (l) => (/^([^:—]{3,40}):\s*(.+)$/.exec(l) || null), count = {};
        for (const a of acts) { const m = pre(a.full); if (m) count[m[1]] = (count[m[1]] || 0) + 1; }
        for (const a of acts) { const m = pre(a.full);
            if (m && count[m[1]] >= 3) { a.group = groupName(m[1]); a.name = m[2]; a.label = shortLabel(m[2]); }
            else { a.name = a.full; a.label = shortLabel(a.full.split(' — ')[0]); } out.push(a); }
        for (const o of out) {
            if (!o.name) o.name = o.label; o.short = o.short || shortLabel(o.label);
            o.floorY = S.ground.groundAt(o.x, o.z, o.interaction?.y ?? S.ground.heightAt(o.x, o.z) + 1.2);
        }
        return out;
    }
    _initMap() {
        const S = this.spot, b = S.ctx.extras.terrainBox || { x0: -200, z0: -200, x1: 200, z1: 200 }, tp = S.ctx.terrainOpts || {};
        const px = 900, [img] = S.ctx.painter.render(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0, px, null, tp.bg || '#617242', tp.bgMask || 'grass');
        this._seen = new Set(); this.map = new SpotMap(this.ui, { image: img, bounds: b });
        this.ui.$('.sp-mini').onclick = () => this.openMap();
        this.ui.setHelp('WASD walk · Shift run · Space jump · E interact · M map · G drone · P camera · click to look (Esc releases)');
        this.ui.setTour(null);
        // the tour guide ped + its interactable
        this.guide = S.crowd?.peds.find((p) => p.group?.tour) || null;
        if (this.guide) {
            this.guide.driven = true; this.guide.speed = 0;
            this._guideIt = { kind: 'guide', x: this.guide.x, z: this.guide.z, r: 2.6, label: (s) => (!s.tour || s.tour.state === 'done' ? 'Join the short guided tour' : s.tour.said && !['activity', 'bike', 'postcard'].includes(s.tour.stops[s.tour.i]?.kind) ? 'Next stop, please' : 'Tour guide — follow the flag'), use: (s) => { if (!s.tour || s.tour.state === 'done') { s.endTour(); s.startTour(); } else if (s.tour.said && !['activity', 'bike', 'postcard'].includes(s.tour.stops[s.tour.i]?.kind)) s._nextTourStop(); } };
            S.interactables.push(this._guideIt);
        }
        // E — talk to people (after round 6): the nearest person in front of the player within reach stops, turns and
        // answers (greeting → this place → a local custom as a tip → small talk), see Crowd.talkTo
        if (S.crowd) {
            const talk = { kind: 'talk', r: 2.6, ped: null, get x() { return this.ped ? this.ped.x : 1e9; }, get z() { return this.ped ? this.ped.z : 1e9; },
                cond: (s) => { const c = s.ctl, fx = -Math.sin(c.heading), fz = -Math.cos(c.heading); let best = null, bd = 2.4;
                    for (const q of S.crowd.peds) { if (q.hidden || q.driven || q === s.guide) continue; const dx = q.x - c.x, dz = q.z - c.z, d = Math.hypot(dx, dz); if (d < bd && d > 0.2 && (dx * fx + dz * fz) / d > 0.35 && Math.abs((q.y ?? c.y) - c.y) < 1.6) { bd = d; best = q; } }
                    talk.ped = best; return !!best; },
                label: () => (talk.ped ? `Talk to ${Crowd.whoLabel(talk.ped)}` : ''), use: (s) => s.talkTo(talk.ped) };
            S.interactables.push(talk);
        }
        this._refreshMarkers();
    }
    _refreshMarkers() {
        if (!this.map) return; const list = this.objectives(), cur = this.tour?.stops?.[this.tour.i];
        if (this.guide) list.push({ kind: 'guide', x: this.guide.x, z: this.guide.z, label: this.tour ? 'Your guide' : 'Free guided tour', done: false });
        for (const m of list) if (cur && m.kind === cur.kind && m.label === cur.label) m.cur = true;
        this.map.setMarkers(list); this._objs = list;
    }
    async openMap() {
        if (this.ui.panelOpen || !this.map) return;
        this.cancelActivities('map');
        if (this.input) { this.input.lookAllowed = false; this.input.releaseLock?.(); }
        this._refreshMarkers();
        const ICONS = { hero: '⭐', plaque: '📜', postcard: '📷', bike: '🚲', activity: '🎯' }, items = [], groups = new Map();
        for (const m of this._objs) { if (m.kind === 'guide' || m.kind === 'entrance') continue;
            if (m.group) { let g = groups.get(m.group); if (!g) { g = { icon: ICONS[m.kind] || '•', label: m.group, members: [], kind: m.kind }; groups.set(m.group, g); items.push(g); } g.members.push(m); continue; }
            items.push({ icon: ICONS[m.kind] || '•', label: m.short || m.label, done: m.done, kind: m.kind, marker: m }); }
        for (const g of groups.values()) { const d = g.members.filter((m) => m.done).length; g.label = `${g.label} (${d}/${g.members.length})`; g.done = d === g.members.length; }
        await this.ui.showMap(this.map, { title: this.spot.name, items, navigate: {set: target => this.setWaypoint(target),clear:()=>this.clearWaypoint()}, tour: this.guide ? { label: this.tour && this.tour.state !== 'done' ? 'End the guided tour' : '🚩 Short guided tour · up to 3 stops', run: () => { if (this.tour && this.tour.state !== 'done') this.endTour(); else { this.endTour(); this.startTour(); } } } : null });
        if (this.input) { this.input.lookAllowed = true; this.input.flush?.(); this.input.keys?.clear?.(); }
        this.returnFocus();
    }
    /** E on a person: their answer in a bubble, a local custom as a tip now and then */
    talkTo(ped) {
        if (!ped || !this.spot.crowd) return;
        const D = this.spot.ctx.data, cult = D.talkTips || [], { line, tip } = this.spot.crowd.talkTo(ped, this.ctl, cult);
        if (tip) { let n = String(tip.note || ''); if (n.length > 230) n = n.slice(0, n.lastIndexOf('. ', 230) > 80 ? n.lastIndexOf('. ', 230) + 1 : 230) + (n.lastIndexOf('. ', 230) > 80 ? '' : '…'); this.ui.toast('💬 Local tip — ' + tip.topic, n); }
        else if (!line) this.ui.toast('💬', 'They smile and nod.');
        this._talks = (this._talks || 0) + 1;
        try { window.dispatchEvent(new CustomEvent('dmcv:activity', { detail: { spot: this.spot.id, id: 'talk', n: this._talks } })); } catch { /* no host */ }
    }
    /** Strict walkable route; optional radius stays within the actual interaction's reach. */
    /** `clearOf` [x, z]: leave out the moving bodies whose clearance already holds that point (a guide pressed against a
     * walker would otherwise plan from inside the walker and find no start); movement still checks every step. */
    _navColliders(ax,az,bx,bz,range=200,clearOf=null) {
        let bodies=[...(this.spot.crowd?.obstacles((ax+bx)/2,(az+bz)/2,range)||[]),...(this.spot.ctx.extras.obstacles?.()||[])];
        if(clearOf)bodies=bodies.filter(o=>!(Math.hypot(o.x-clearOf[0],o.z-clearOf[1])<Math.hypot(o.width||0,o.length||0)/2+.9));
        return withMovingBodies(this.spot.colliders,bodies,this.guide);
    }
    _navigationGround(x = this.ctl?.x, z = this.ctl?.z, y = this.ctl?.y) {
        const g=walkingLevelGround(this.spot.ground,x,z,y),boundary=this.spot.ctx.extras.walkBoundary;
        if(!boundary)return g;
        const view=Object.create(g);view.walkInside=(x,z)=>boundary.inside(x,z);return view;
    }
    _navPath(ax, az, bx, bz, opts = {}) {
        const ground = this._navigationGround(ax, az, opts.startY ?? this.ctl?.y);
        if (Number.isFinite(opts.targetY)) {
            const endY = ground.groundAt(bx, bz, ground.heightAt(bx, bz) + 1.2);
            if (!Number.isFinite(endY) || Math.abs(endY - opts.targetY) > .55) return null;
        }
        return findWalkPath(ground, this._navColliders(ax,az,bx,bz,200,opts.clearOf), ax, az, bx, bz, opts);
    }
    setWaypoint(target) {
        if(!Number.isFinite(target?.x)||!Number.isFinite(target?.z))return{message:'Choose a point on the map.'};
        const p=this.position,ground=this._navigationGround(p.x,p.z,this.ctl?.y ?? p.y);
        let floorY=target.floorY ?? ground.groundAt(target.x,target.z,this.ctl?.y ?? p.y);
        if(!Number.isFinite(floorY))floorY=this.spot.ground.groundAt(target.x,target.z,this.spot.ground.heightAt(target.x,target.z)+1.2);
        this.waypoint={x:target.x,z:target.z,floorY,label:target.name||target.label||'Custom waypoint',radius:target.interaction?Math.max(.4,(target.interaction.r||2)-.4):1.5};
        this._waypointFrom=null;this._updateWaypoint(true);
        return{message:`Waypoint: ${this.waypoint.label}. ${this._waypointPath?'Follow the trail.':'No walking route on this level. Use the stairs or choose another approach.'}`};
    }
    clearWaypoint(){this.waypoint=null;this._waypointPath=null;this.map?.setWaypoint(null);this.ui.setWaypoint(null);this._waypointLine(null);}
    // (owner, 2026-11-11, L31: "a custom waypoint should draw the same trail as the guided tour") the planned walking route to a
    // waypoint is drawn on the ground as the tour's dashed amber trail, from where the walker stands
    _waypointLine(path){
        if(this._wpRoute){this.spot.scene.remove(this._wpRoute);this._wpRoute.geometry.dispose();this._wpRoute.material.dispose();this._wpRoute=null;}
        if(!path||path.length<2)return;const p=this.position,g=this._navigationGround(p.x,p.z,this.ctl?.y ?? p.y),route=[[p.x,p.z],...path.slice(1)],pos=[];
        for(let r=1;r<route.length;r++){const [px,pz]=route[r-1],[qx,qz]=route[r],L=Math.hypot(qx-px,qz-pz),n=Math.max(1,Math.floor(L/1.6)),nx=-(qz-pz)/(L||1),nz=(qx-px)/(L||1);
            for(let i=0;i<n;i++){const u0=i/n,u1=Math.min(1,(i+.55)/n);for(const [u,sd] of [[u0,-.12],[u0,.12],[u1,.12],[u1,-.12]]){const x=px+(qx-px)*u,z=pz+(qz-pz)*u;pos.push(x+nx*sd,g.groundAt(x,z,this.ctl?.y ?? p.y)+.06,z+nz*sd);}}}
        if(!pos.length)return;const idx=[];for(let q=0;q<pos.length/12;q++){const b=q*4;idx.push(b,b+1,b+2,b,b+2,b+3);}
        const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);
        const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:'#fbbf24',transparent:true,opacity:.75,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
        m.name='waypoint-route';m.userData.noAudit=true;m.renderOrder=2;this.spot.scene.add(m);this._wpRoute=m;
    }
    _updateWaypoint(force=false){
        const w=this.waypoint;if(!w)return;const p=this.position,y=this.ctl?.y ?? p.y,d=Math.hypot(w.x-p.x,w.z-p.z),arrived=d<=w.radius+1&&Number.isFinite(w.floorY)&&Math.abs(y-w.floorY)<=.75;
        if(force||!this._waypointFrom||Math.hypot(p.x-this._waypointFrom.x,p.z-this._waypointFrom.z)>3||Math.abs(y-this._waypointFrom.y)>.55){
            this._waypointFrom={x:p.x,z:p.z,y};
            this._waypointPath=arrived?null:this._navPath(p.x,p.z,w.x,w.z,{radius:w.radius,maxLength:600,startY:y,targetY:w.floorY});
            this.map?.setWaypoint(w,this._waypointPath);
            this._waypointLine(this._waypointPath);
        }
        const turn=Math.atan2(-(w.x-p.x),-(w.z-p.z))-(this.ctl.heading||0),direction=['↑','↖','←','↙','↓','↘','→','↗'][(Math.round(turn/(Math.PI/4))%8+8)%8];
        this.ui.setWaypoint({...w,direction,distance:d,arrived,routed:!!this._waypointPath,clear:()=>this.clearWaypoint()});
    }
    /** Optional quick visit: one activity first, a nearby fact, then this spot's postcard; all content remains on the map. */
    startTour() {
        if (!this.guide || this.tour) return;
        const S = this.spot, sp0 = S.spawns[S.id] || S.spawn, ext = S.data.spots?.[S.id]?.extent?.polygon;
        const near = (m) => {
            if (m.id && m.id !== S.id) return false;
            if (Math.hypot(m.x - sp0.x, m.z - sp0.z) > 230) return false;
            if (ext?.length && !inPoly(m.x, m.z, ext) && distPolyline(m.x, m.z, [...ext, ext[0]]).d > 40) return false;
            if (!m.id && Object.entries(S.spawns).some(([id, sp]) => id !== S.id && Math.hypot(m.x - sp.x, m.z - sp.z) + 5 < Math.hypot(m.x - sp0.x, m.z - sp0.z))) return false;
            const it = m.interaction;
            return !it || ((!it.cond || it.cond(this)) && (!it.tourAvailable || it.tourAvailable(this)) && Math.abs((it.y ?? this.ctl.y) - this.ctl.y) < 3);
        };
        const objs = this.objectives().filter((m) => !m.noTour && m.kind !== 'entrance' && near(m));
        const stops = []; let x = this.guide.x, z = this.guide.z, y = this.guide.y, walked = 0;
        const addNearest = (pool) => {
            // A detour counts against the budget before the stop enters the itinerary.
            for (const m of pool.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))) {
                const radius = m.interaction ? Math.min(1.5, Math.max(0.4, (m.interaction.r || 2) - 0.4)) : m.kind === 'postcard' ? Math.min(2, (m.challenge.r || 8) - 0.4) : 1.5;
                const path = this._navPath(x, z, m.x, m.z, { radius, maxLength: TOUR_WALK_LIMIT_M - walked, startY: y, targetY: m.floorY });
                if (!path) continue;
                const end = path.at(-1); m.tx = end[0]; m.tz = end[1]; m.path = path; m.radius = radius;
                m.done = false; stops.push(m); walked += pathLength(path); x = m.tx; z = m.tz; y = this.spot.ground.groundAt(x,z,y); return true;
            }
            return false;
        };
        const active = objs.filter((m) => ['activity', 'bike'].includes(m.kind));
        if (!addNearest(active)) {
            this.ui.toast('No activity route right now', 'Choose an activity on M and explore freely. The guide could not find a safe short route to an available activity.');
            return false;
        }
        addNearest(objs.filter((m) => m.kind === 'plaque'));
        addNearest(objs.filter((m) => m.kind === 'postcard'));
        if (!stops.length) { this.ui.toast('No short walking route', 'Explore freely with M. The guide could not find a safe route from here.'); return false; }
        this.tour = { stops, i: 0, state: 'walk', wait: 0, said: false, t: 0, walked, travelled:0, skipped: 0 };
        this.guide.act = 'guide'; this.guide.sayCd = 1e9;
        this.tour.narr = `Follow my flag — ${stops.length} stop${stops.length === 1 ? '' : 's'}, about ${Math.ceil(walked)} m. Skip or end the tour at any time.`;
        try { window.dispatchEvent(new CustomEvent('dmcv:activity', { detail: { spot: S.id, id: 'tour-start' } })); } catch { /* no host */ }
        this._tourUI(); this._routeLine(); return true;
    }
    _tourUI() {
        const T = this.tour; if (!T) return this.ui.setTour(null);
        const st = T.stops[T.i], done = T.state === 'done';
        this.ui.setTour({ title: done ? (T.skipped ? 'Tour ended' : 'Tour complete') : 'Short guided tour', i: T.i, n: T.stops.length, done,
            stop: st ? st.label : '', text: T.narr || '', dots: T.stops.map((m, k) => (m.skipped ? 3 : k < T.i ? 1 : k === T.i ? 2 : 0)),
            skip: done ? null : () => this.skipTourStop(), end: () => this.endTour() });
    }
    endTour() {
        this._guideBubble?.remove(); this._guideBubble = null;
        if (this.guide) { this.guide.speed = 0; this.guide.sayCd = 5; }
        this.tour = null; this._tourUI(); this._routeLine(); this._refreshMarkers();
    }
    /** An activity keeps the itinerary; its owning flow retains this exact stop until completion. */
    captureTourActivity() {
        const st = this.tour?.stops[this.tour.i];
        return this.tour?.state !== 'done' && st?.interaction && st.interaction === this._usingInteraction ? st : null;
    }
    recordTourActivity(spot, id) {
        const st = this.tour?.stops[this.tour.i];
        if (spot === this.spot.id && st?.interaction?.tourActivityIds?.includes(id)) this.completeTourActivity(st);
    }
    completeTourActivity(st) {
        if (!st || this.tour?.state === 'done' || this.tour?.stops[this.tour.i] !== st) return;
        st.participated = true;
        this._nextTourStop();
    }
    skipTourStop() {
        if (!this.tour || this.tour.state === 'done') return;
        this.cancelActivities('tour-skip');
        this.tour.stops[this.tour.i].skipped = true; this.tour.skipped++; this._nextTourStop();
    }
    _nextTourStop() {
        const T = this.tour; if (!T) return;
        T.stops[T.i].done = !T.stops[T.i].skipped; T.i++; T.said = false; T.t = 0; T.wait = 0;
        if (T.i >= T.stops.length) return this._finishTour();
        const st = T.stops[T.i], path = this._navPath(this.guide.x, this.guide.z, st.x, st.z, { radius: st.radius, maxLength: Math.max(0, TOUR_WALK_LIMIT_M - (T.travelled || 0)), startY: this.guide.y, targetY: st.floorY });
        if (!path) { T.narr = 'The next stop is blocked. You can skip it or end the tour.'; T.state = 'blocked'; this.guide.speed = 0; }
        else { st.path = path; st.wi = 1; [st.tx, st.tz] = path.at(-1); T.state = 'walk'; T.narr = 'Follow the flag to the next stop.'; }
        this._tourUI(); this._routeLine(); this._refreshMarkers();
    }
    /** a dashed ground line from the guide to the current stop (3-D) + the same route on the map */
    _routeLine() {
        if (this._route) { this.spot.scene.remove(this._route); this._route.geometry.dispose(); this._route.material.dispose(); this._route = null; }
        const T = this.tour, st = T?.stops[T.i]; if (!st || T.state === 'done' || T.state === 'blocked') { this.map?.setRoute(null); return; }
        const a = this.guide, g = this._navigationGround(a.x,a.z,a.y), pos = [];
        // the remaining route of this leg (guide → waypoints → stop), dashed on the ground
        const route = [[a.x, a.z], ...(st.path && st.path.length > 1 ? st.path.slice(st.wi ?? 1) : [[st.tx, st.tz]])];
        for (let r = 1; r < route.length; r++) { const [px, pz] = route[r - 1], [qx, qz] = route[r], L = Math.hypot(qx - px, qz - pz), n = Math.max(1, Math.floor(L / 1.6)), nx = -(qz - pz) / (L || 1), nz = (qx - px) / (L || 1);
            for (let i = 0; i < n; i += 1) { const u0 = i / n, u1 = Math.min(1, (i + 0.55) / n); for (const [u, sd] of [[u0, -0.12], [u0, 0.12], [u1, 0.12], [u1, -0.12]]) { const x = px + (qx - px) * u, z = pz + (qz - pz) * u; pos.push(x + nx * sd, g.groundAt(x, z, g.heightAt(x, z) + 1) + 0.06, z + nz * sd); } } }
        const idx = []; for (let q = 0; q < pos.length / 12; q++) { const b = q * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        m.name = 'tour-route'; m.userData.noAudit = true; m.renderOrder = 2; this.spot.scene.add(m); this._route = m;
        this.map?.setRoute(route);
    }
    _updateTour(dt, p) {
        const T = this.tour, G = this.guide; if (!T || !G || T.state === 'done' || dt <= 0) return;
        if (T.stops[T.i]?.participated) { this._nextTourStop(); return; }
        if (T.state === 'blocked') return;
        const st = T.stops[T.i]; T.t += dt;
        let dP = Math.hypot(p.x - G.x, p.z - G.z), dS = Math.hypot(st.tx - G.x, st.tz - G.z);
        const pS = Math.hypot(st.tx - p.x, st.tz - p.z); // player → stop
        if (T.state === 'walk') {
            const wait = dP > 14 && pS > dS; // the guide waits for a player who is behind, waving the flag
            if (dS < 0.5 && (st.wi ?? 1) >= st.path.length - 1) { T.state = 'arrive'; T.wait = 0; G.speed = 0; }
            else if (!wait) {
                // keeps the player's pace: a stroll when the player is close behind, a jog when the player is ahead
                const pv = Math.abs(p.vel ?? p.speed ?? 0), ahead = pS < dS;
                const v = ahead ? Math.min(4.5, Math.max(2.6, pv + 0.6)) : Math.min(3.0, Math.max(1.7, Math.min(pv + 0.5, 1.4 + Math.max(0, 9 - dP) * 0.2))); // (brisker: a tour is a few minutes, not ten)
                // Follow each corner closely; movement clearance still checks every short step.
                const wp = st.path && st.path.length > 1 ? st.path : null; st.wi ??= 1;
                if (wp) while (st.wi < wp.length - 1 && Math.hypot(wp[st.wi][0] - G.x, wp[st.wi][1] - G.z) < 0.35) st.wi++;
                const tgx = wp ? wp[st.wi][0] : st.tx, tgz = wp ? wp[st.wi][1] : st.tz, dT = Math.hypot(tgx - G.x, tgz - G.z) || 1;
                let dx = (tgx - G.x) / dT, dz = (tgz - G.z) / dT; const step = Math.min(v * dt, dT);
                const ground = this._navigationGround(G.x,G.z,G.y); let cols = this._navColliders(G.x,G.z,G.x,G.z,12), nx = G.x, nz = G.z, moved = false;
                // a walker pressed against the guide must not pin it: step out of that body's clearance (others still block)
                if (!Number.isFinite(walkHeight(ground, cols, G.x, G.z))) cols = this._navColliders(G.x,G.z,G.x,G.z,12,[G.x,G.z]);
                for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) {
                    const c = Math.cos(turn), s2 = Math.sin(turn), ex = dx * c - dz * s2, ez = dx * s2 + dz * c, tx = G.x + ex * step, tz = G.z + ez * step;
                    if (walkSegment(ground, cols, [G.x, G.z], [tx, tz])) { nx = tx; nz = tz; dx = ex; dz = ez; moved = true; break; }
                }
                T.travelled = (T.travelled || 0) + Math.hypot(nx - G.x, nz - G.z);
                G.x = nx; G.z = nz; if (moved) G.y = walkHeight(ground, cols, nx, nz);
                const remaining = Math.hypot(tgx - nx, tgz - nz);
                if (st.progressWaypoint !== st.wi || remaining < (st.bestRemaining ?? Infinity) - 0.05) {
                    st.progressWaypoint = st.wi; st.bestRemaining = remaining; st.blockedFor = 0; st.stuckFor = 0;
                } else { st.blockedFor = (st.blockedFor || 0) + dt; st.stuckFor = (st.stuckFor || 0) + dt; }
                if(T.travelled>TOUR_WALK_LIMIT_M){T.state='blocked';T.narr='This short walk has reached its distance budget. You can end the tour and keep exploring freely.';G.speed=0;this._tourUI();this._routeLine();return;}
                if(st.blockedFor>1){
                    // replan around the static world and the other bodies, never from inside the walker that holds the
                    // guide up; with no route, wait for the crowd to move (a few tries) before calling the leg blocked
                    const replanned=this._navPath(G.x,G.z,st.x,st.z,{radius:st.radius,maxLength:TOUR_WALK_LIMIT_M-T.travelled,startY:G.y,targetY:st.floorY,clearOf:[G.x,G.z]});st.blockedFor=0;
                    // (progress is then measured against the new first waypoint; a replan alone never counts as progress)
                    if(replanned){st.path=replanned;st.wi=1;st.progressWaypoint=1;st.bestRemaining=Math.hypot(replanned[1][0]-G.x,replanned[1][1]-G.z);[st.tx,st.tz]=replanned.at(-1);this._routeLine();}
                    if(st.stuckFor>6){T.state='blocked';T.narr='The public route is currently blocked. You can skip this stop or end the tour.';G.speed=0;this._tourUI();this._routeLine();return;}
                }
                G.speed = moved ? v : 0; G.phase += moved ? dt * v * 4.6 : 0; G.yaw = Math.atan2(dx, dz); G.tyaw = G.yaw;
                if ((T.t % 1) < dt) this._routeLine();
            } else { G.speed = 0; G.yaw = Math.atan2(p.x - G.x, p.z - G.z); }
        }
        if (T.state === 'arrive') {
            G.speed = 0; G.yaw = Math.atan2(st.x - G.x, st.z - G.z); T.wait += dt;
            if (pS < 6 && !T.said) { // narration: the guide's bubble + the full line in a toast (also when you hang back)
                T.said = true; const text = st.kind === 'hero' ? (st.blurb || st.label) : st.kind === 'plaque' ? (st.text || st.label) : st.kind === 'postcard' ? 'Best photo of the day from right here — ' + (st.text || 'the classic view') : st.label;
                this._guideBubble?.remove(); // at most one guide bubble at a time
                this._guideBubble = this.ui.bubbles?.say(this.spot.crowd?._headRef?.(G) || G, st.kind === 'hero' ? 'Here it is!' : st.kind === 'postcard' ? 'Photo time!' : 'Look here…', '', 'friendly');
                if (this._guideBubble) this._guideBubble.dataset.prio = '1';
                T.narr = text.slice(0, 240) + (['activity', 'bike'].includes(st.kind) ? ' · Try it with E, or skip this stop.' : st.kind === 'postcard' ? ' · P opens the camera. Take the postcard, or skip this stop.' : ''); this._tourUI(); if (st.kind === 'hero') this._seen.add('hero:' + st.id); T.wait = 0;
            }
            const left = T.said && T.wait > 1.5 && pS > 12; // the player already walked on: so does the tour
            const needsAction = ['activity', 'bike', 'postcard'].includes(st.kind);
            if (T.said && (needsAction ? st.participated : T.wait > 6 || left)) this._nextTourStop();
        }
        if (this._guideIt) { this._guideIt.x = G.x; this._guideIt.z = G.z; }
    }
    _finishTour() {
        const T = this.tour; T.state = 'done'; this.guide.speed = 0; this.guide.sayCd = 5; T.narr = T.skipped ? `Tour ended with ${T.skipped} skipped stop${T.skipped === 1 ? '' : 's'}. Keep exploring with M.` : `That's the tour — ${T.stops.length} stop${T.stops.length === 1 ? '' : 's'}. Enjoy ${this.spot.name}!`; this._tourUI(); this._routeLine();
        if (T.skipped) { this._refreshMarkers(); return; }
        const P = this.progress, k = this.spot.sceneId; (P.tours || (P.tours = {}))[k] = Date.now(); saveProgress(P);
        this.ui.toast('🏅 Tour complete', `You saw ${T.stops.length} stop${T.stops.length === 1 ? '' : 's'} at ${this.spot.name}.`);
        try { this.host.onTour?.({ scene: k, spot: this.spot.id, stops: T.stops.length }); } catch { /* host */ }
        try { window.dispatchEvent(new CustomEvent('dmcv:activity', { detail: { spot: this.spot.id, id: 'tour' } })); } catch { /* no host */ }
        window.cvTelemetry?.track?.('spot_tour', { id: this.spot.id });
        this._refreshMarkers();
    }
    /** photo-mode hook (host's PhotoMode onPhoto → here) */
    onPhoto(meta = {}) {
        const n = this.spot.crowd?.onPhoto(this.camera) || 0;
        const done = this.checkChallenge();
        const st = this.tour?.stops[this.tour.i]; if (done && st?.kind === 'postcard' && st.id === done) st.participated = true;
        return { people: n, postcard: done };
    }
    /** Host conditions setters call this after changing their destination-local
     * clock. The renderer advances that clock; session.update never resets it. */
    setConditions(conditions = {}) {
        this.cancelActivities('conditions');
        const { host, spot, r3d } = this;
        for (const key of ['date', 'override', 'timeScale', 'timeZone', 'weather', 'season']) {
            if (Object.prototype.hasOwnProperty.call(conditions, key)) host[key] = conditions[key];
        }
        r3d.setClock({ date: 'date' in conditions ? (host.date || new Date()) : (r3d.simDate || host.date || new Date()), lat: spot.clock.lat, lon: spot.clock.lon,
            timeZone: host.timeZone ?? spot.clock.timeZone, timeScale: host.timeScale ?? 1, override: host.override ?? null });
        if ('season' in conditions) r3d.setSeason(conditions.season === 'auto' ? null : conditions.season);
        if ('weather' in conditions) r3d.setWeather(conditions.weather === 'live' ? null : conditions.weather, { instant: true });
        this.condT = 0;
    }
    /** info for PhotoMode.getInfo while in a spot */
    photoInfo() { const sp = this.spot; return { place: sp.name, city: sp.city, timeZone: sp.clock.timeZone, night: !!this.r3d.nightLights, sub: placeLabel(sp) }; }
    /** local time / weather / season for the crowd's tagged lines (spec 15 R15.6) */
    _conditions() {
        const d = this.r3d.simDate || this.host.date || new Date(), w = this.r3d.weather || {};
        let hour = 12, month = d.getMonth(), day = d.getDate();
        try {
            const f = new Intl.DateTimeFormat('en-GB', { timeZone: this.spot.clock.timeZone, hour: 'numeric', hourCycle: 'h23', month: 'numeric', day: 'numeric' }).formatToParts(d);
            const g = (t) => +f.find((x) => x.type === t)?.value; hour = g('hour'); month = g('month') - 1; day = g('day');
        } catch { /* old browsers: device time */ }
        return { hour, month, day, tempC: w.tempC, kind: w.kind || '', snowCm: w.snowCm || 0 };
    }
    checkChallenge() {
        const cam = this.camera, p = this.ctl.position, dir = cam.getWorldDirection(new THREE.Vector3());
        const bearing = ((Math.atan2(dir.x, -dir.z) / DEG) % 360 + 360) % 360;
        for (const c of this.spot.challenges) {
            if (Math.hypot(p.x - c.x, p.z - c.z) > c.r) continue;
            let db = Math.abs(bearing - c.bearing) % 360; if (db > 180) db = 360 - db;
            if (db > c.tol) continue;
            if (c.cond && !c.cond(this)) { this.ui.toast('📷 Almost', c.condHint || 'Not quite the postcard — try again.'); continue; }
            const P = this.progress.postcards || (this.progress.postcards = {});
            const first = !P[c.id]; P[c.id] = Date.now(); saveProgress(this.progress);
            this.ui.toast(first ? '🏆 Postcard challenge complete' : '📷 Postcard', c.text || this.spot.name);
            this.sound.play('chime');
            window.cvTelemetry?.track?.('spot_postcard', { id: c.id, first });
            this._updateChallengeText();
            return c.id;
        }
        return null;
    }
    _updateChallengeText() {
        const c = this.spot.challenges.find((x) => x.id === this.spot.id) || this.spot.challenges[0];
        if (!c) { this.ui.setChallenge(''); return; }
        const done = !!this.progress.postcards?.[c.id];
        this.ui.setChallenge(`Postcard: ${shortLabel(c.title || spotById(c.id)?.name || 'the iconic view', 40)}${done ? ' — done' : ''}`, done); // short (note 81); the full brief is in the map / photo mode
    }
    async readPlaque(p) {
        if (this.input) { this.input.lookAllowed = false; this.input.releaseLock?.(); }
        window.cvTelemetry?.track?.('spot_plaque', { id: this.spot.id, title: p.title });
        await this.ui.showPlaque(p, this.spot.name);
        { const P = this.progress; (P.plaques || (P.plaques = {}))[this.spot.sceneId + ':' + p.title] = Date.now(); saveProgress(P); this._refreshMarkers?.(); }
        if (this.input) { this.input.lookAllowed = true; this.input.flush?.(); this.input.keys?.clear?.(); }
        this.returnFocus();
    }
    /** note 21: back to play after a spot panel closed — the host's returnFocus (main.js) or: focus the canvas, flush input */
    returnFocus() {
        if (this.host.returnFocus) { try { this.host.returnFocus(); return; } catch { /* fall through */ } }
        const a = document.activeElement; if (a && a !== document.body) a.blur?.();
        const cv = this.host.r3d?.renderer?.domElement || this.host.r3d?.canvas; try { cv?.focus?.({ preventScroll: true }); } catch { /* ignore */ }
        if (this.input) { this.input.flush?.(); this.input.keys?.clear?.(); this.input.lookAllowed = true; }
    }
    /** Keep a nearby guide's conversation from swallowing the arrived task's E prompt. */
    _interactionAt(p) {
        const T=this.tour, target=T?.state==='arrive'?T.stops[T.i]?.interaction:null;
        let best=null,bd=Infinity,task=null;
        for(const it of this.spot.interactables){
            if(it.cond&&!it.cond(this))continue;
            const d=Math.hypot(p.x-it.x,p.z-it.z);
            if(!(d<(it.r||2)&&Math.abs((it.y??p.y)-p.y)<3))continue;
            if(it===target)task=it;
            if(d<bd){bd=d;best=it;}
        }
        return task&&['guide','talk'].includes(best?.kind)?task:best;
    }
    /** per-frame: walker, crowd, interactions, scene animations, night, UI, sound */
    update(dt) {
        dt = Math.min(dt, 0.1); this.t += dt;
        const photo = this.host.photo?.active, panel = this.ui.panelOpen;
        const walkBefore = { x: this.ctl.x, z: this.ctl.z };
        if (!panel) this.ctl.update(photo ? 0 : dt);
        if (this.ctl.active !== false && this.ctl.rig) this.ctl.rig.rotation.z = 0; // the walker camera stays level on slopes
        if (this.ctl.active !== false) this._pushOut();
        this.spot.ctx.extras.walkBoundary?.constrain(this.ctl, walkBefore, this);
        const p = this.ctl.position, pl = { x: p.x, z: p.z, y: p.y, speed: this.ctl.speed || 0, heading: this.ctl.heading };
        // night factor (lamps, windows, neon)
        const tgt = this.r3d.nightLights ? 1 : 0; this.nightK += Math.sign(tgt - this.nightK) * Math.min(Math.abs(tgt - this.nightK), dt / 1.5);
        if (this._lastNightK !== this.nightK) { this._lastNightK = this.nightK; setNightWindows(this.spot.scene, this.nightK); for (const f of this.spot.nightHooks) f(this.nightK, this); }
        if (this.spot.crowd) {
            this.condT = (this.condT ?? 0) - dt;
            if (this.condT <= 0) { this.condT = 2; this.spot.crowd.cond = this._conditions(); }
            this.spot.crowd.rainy = (this.r3d.weather?.kind || '').includes('rain'); this.spot.crowd.interiors = this.spot.ctx.extras.interiors; this.spot.crowd.update(dt, pl, this.camera);
        }
        for (const f of this.spot.updaters) f(dt, this, pl);
        try { // map + tour never break the frame loop
            const drone = this.host.explore?.drone;
            if (this.tour && !panel && !photo && !drone?.active && this.ctl.active !== false) this._updateTour(dt, p);
            else if (this.guide) this.guide.speed = 0;
            if (this.map && !photo) { /* (the drone's position while it flies — note 43) */ const dr = this.host.explore?.drone, flying = dr?.active && dr.phase === 'fly'; this.map.update(dt, flying ? { x: dr.pos.x, z: dr.pos.z, heading: dr.yaw } : { x: p.x, z: p.z, heading: this.ctl.heading }); if (this.guide && (this._mkT = (this._mkT ?? 0) - dt) <= 0) { this._mkT = 1; this._refreshMarkers(); } }
            if(this.waypoint&&!panel&&!photo&&(this._waypointTick=(this._waypointTick||0)-dt)<=0){this._waypointTick=.5;this._updateWaypoint();}
        } catch (e) { if (!this._mapErr) { this._mapErr = true; console.warn('[spots] map/tour', e); } }
        if (this.input?.take?.('KeyJ') && !photo && !panel && !this.host.explore?.drone?.active) this.skipTourStop();
        if (!photo && !panel && this.input?.take?.('KeyM')) this.openMap(); // (G is the drone everywhere — round 6 note 14)
        // interactions (nearest within reach)
        if (!photo && !panel && !this.spot.ctx.extras.venueActivities?.active && !this.spot.ctx.extras.participation?.active) {
            const best=this._interactionAt(p);
            this.ui.prompt(best ? `<kbd>E</kbd>${escapeHtml(typeof best.label === 'function' ? best.label(this) : best.label)}` : null);
            this.ui.crosshair(!!best?.aim);
            if (best && this.input?.take?.('KeyE')) {
                const st = this.tour?.stops[this.tour.i];
                this._usingInteraction = best;
                try { best.use(this, best); } finally { this._usingInteraction = null; }
                // Modal flows report completion themselves. Merely opening or cancelling one never completes its stop.
                if (st && this.tour?.stops[this.tour.i] === st && st.interaction === best &&
                    !best.tourActivityIds?.length && !this.spot.ctx.extras.participation?.active && !this.spot.ctx.extras.venueActivities?.active) st.participated = true;
            }
            else this.input?.take?.('KeyE');
            // reset if fallen out of the world
            if (p.y < (this.spot.ctx.minY ?? -80)) this.ctl.teleport(this.spot.spawn.x, this.spot.spawn.z, this.spot.spawn.heading);
        } else this.ui.prompt(null);
        this.ui.update(this.camera);
        this.sound.update(dt, p.x, p.z);
    }
    /** people and cars are solid at any ground height (onfoot.js only checks obstacles near y = 0, see spec 15 Requests) */
    _pushOut() {
        const c = this.ctl, feet = c.y + (c.jumpY || 0); let moved = false;
        const boxes = [...(this.spot.crowd ? this.spot.crowd.obstacles(c.x, c.z, 2) : []), ...(this.spot.ctx.extras.obstacles?.() || [])];
        for (const o of boxes) {
            if (Math.abs((o.y ?? feet) - feet) > 1.3) continue;
            const dx = c.x - o.x, dz = c.z - o.z, f = dx * o.fx + dz * o.fz, l = dx * -o.fz + dz * o.fx, hl = o.length / 2 + 0.3, hw = o.width / 2 + 0.3;
            if (Math.abs(f) >= hl || Math.abs(l) >= hw) continue;
            const pf = hl - Math.abs(f), pw = hw - Math.abs(l);
            if (pw < pf) { const s = l >= 0 ? 1 : -1; c.x += -o.fz * s * pw; c.z += o.fx * s * pw; } else { const s = f >= 0 ? 1 : -1; c.x += o.fx * s * pf; c.z += o.fz * s * pf; }
            moved = true;
        }
        if (moved) c.place?.();
    }
    /** move the walker to another spawn of the same scene (seattle-center: space-needle / chihuly / mopop) */
    teleport(spotId) {
        const s = this.spot.spawns[spotId], entry = spotById(spotId); if (!s || !entry) return;
        this.cancelActivities('teleport');
        this.clearWaypoint();
        this.endTour(); this.ctl.teleport(s.x, s.z, s.heading);
        if (Number.isFinite(s.pitch)) { this.ctl.pitch = Math.max(-1.3, Math.min(1.3, s.pitch)); this.ctl.place(); }
        Object.assign(this.spot, { id: spotId, name: entry.name, entry, spawn: s });
        this.ui.setTitle(this.spot.name, `${placeLabel(this.spot)} · walk-only bonus`);
        this._updateChallengeText(); this._refreshMarkers();
    }
    dispose() {
        this.cancelActivities('exit');
        this.ctl?.exit(); this.ui?.dispose(); this.sound?.dispose(); this.spot?.dispose();
        this.r3d.setLamps?.([]);
        window.cvTelemetry?.track?.('spot_exit', { id: this.spot.id, seconds: Math.round(this.t) });
    }
}
/** "Seattle, WA" / "Bellevue, WA" / "Bucharest, Romania" */
export function placeLabel(sp) { return sp.entry?.area === 'bellevue' ? 'Bellevue, WA' : sp.city === 'seattle' ? 'Seattle, WA' : sp.city === 'bucharest' ? 'Bucharest, Romania' : sp.city; }
function shortLabel(t, n = 28) { const s = String(t || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
function groupName(p) { return /house|household|farm|gospod|casa/i.test(p) ? 'Households' : shortLabel(p.replace(/^(step into|visit|see|try|read)\s+(the\s+)?/i, (m) => m), 24); }
function firstSentence(t) { const s = String(t || '').trim(); const m = s.match(/^.{20,220}?[.!?](\s|$)/); return (m ? m[0] : s.slice(0, 200)).trim(); }
function escapeHtml(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
/** façade night windows + anything flagged userData.nightWindows / nightGlow */
export function setNightWindows(root, k) {
    const seen = new Set();
    root.traverse((o) => {
        const m = o.material; if (!m || Array.isArray(m) || seen.has(m)) return; seen.add(m);
        if (m.userData?.nightWindows) m.emissiveIntensity = (m.userData.dayWindows || 0) + (0.9 - (m.userData.dayWindows || 0)) * k;
        else if (m.userData?.nightGlow !== undefined) m.emissiveIntensity = m.userData.dayGlow + (m.userData.nightGlow - m.userData.dayGlow) * k;
    });
}
