// Game methods: story flow — free roam, chapters (start pose, objectives, completion, chaining, transitions),
// the flight cutscene, fast travel and its montage, the office visits and the finale. Installed on
// Game.prototype by main.js (mixin).
import { chapterCard, chapterMontage, chapterSelectHtml, saveProgress } from './chapters.js';
import { STOPS, AIRPORTS, PROFILE, MONTAGE_VIA, MONTAGE_WATER } from './data.js';
import { Office } from './office.js';
import { createOfficeWindowService } from './office-window-service.js';
import { createOfficeBubbleScope } from './office-bubble-scope.js';
import { playFlight } from './flight.js';
import { edgeSpeed, roadName, fmtDist, lanesDir } from './nav.js';
import { clamp } from './util.js';
import { showFinale } from './finale.js';
import { playChapterTransition } from './transition.js';
import { save } from './save.js';
import { chapterStartPose } from './chapter-start.js';
import { $, CITIES, FUEL_AERO, FUEL_GAME_MULT, FUEL_IDLE, FUEL_ROLL, GAL, makeVehicle, money, TANK_L, TIME_ZONES, WEATHER_OVERRIDES } from './game-common.js';

export class StoryMethods {
    /** free roam in a district: the car at the district's chapter start, no objective, no chapter cards / story progress */
    async startFreeRoam(districtId, options = {}) {
        const { tod, weather, season } = { ...this.travelConditions(), ...options };
        this.explore?.hooks?.abortDrone?.();
        const d = this.roamDistricts().find(x => x.id === districtId); if (!d || this._transit) return false;
        if (this.state === 'menu' && !this.started) {
            this.started = true; $('#start')?.blur();
            this.audio.init(); this.audio.resume();
            $('#menu').classList.remove('show'); $('#hud').classList.add('show'); document.body.classList.add('playing');
            this.startTime = performance.now();
        }
        this._transit = true;
        try {
            await save.saveSession('before-travel'); // before changing destination/conditions or releasing the stable scene
            this.freeRoam = { district: d.id, tod, weather, season };
            this.applyRoamTime(tod, CITIES[d.city].timeZone || TIME_ZONES[d.city]);
            this.weatherOverride = weather === 'live' ? null : (WEATHER_OVERRIDES.includes(weather) ? weather : null);
            this.r3d.setSeason?.(season === 'auto' ? null : season);
            this.photo?.close?.(); this.state = 'loading';
            $('#loading').classList.add('show'); await new Promise(r => setTimeout(r, 30));
            await this.loadCity(d.city, { district: d.id, start: d.start });
            $('#loading').classList.remove('show');
            this.freeRoam = { district: d.id, tod, weather, season }; // (loadCity resets the chapter state)
            this.enterRoam(d);
        } catch (error) { this.cityLoadFailed(error); return false; }
        finally { this._transit = false; }
        this.explore?.hooks?.afterFreeRoam?.(d.id); // (a free-roam start is roaming: the resume-story chip shows)
        return true;
    }
    enterRoam(d) {
        this.endFoot();
        const P = this.player; P.speed = 0; P.steer = 0; P.contactAge = 9; P.resetLook?.();
        this.traffic.setPlayer(P); this.traffic.clearForPlayer?.(P) ?? this.traffic.clearAround(P.x, P.z, 14);
        this.stuckT = 0; this.prevEdgeInfo = null; this.navManual = false;
        this.fuel = Math.max(this.fuel, TANK_L * 0.6); this.flags.emptyToast = false;
        P.camHolder.add(this.camera); this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0);
        this.state = 'drive'; this.input.flush(); this.frameClock.getDelta();
        this.updateObjective();
        this.buildConditions(); document.body.classList.add('free-roam');
        const tl = { now: 'real time', rush: 'morning rush, 08:30', noon: 'noon', golden: 'golden hour', night: 'night' }[this.freeRoam.tod] || '';
        this.hud.toast(`🗺️ Free roam · ${d.name}`, `${d.label ? d.label + ' · ' : ''}${tl}${this.freeRoam.weather !== 'live' ? ' · ' + this.freeRoam.weather : ''}. ${this.chapters?.length ? '📖 Resume story when you like · ' : ''}${this.touch ? 'Tap 🌍 for the world map · ⏸ for actions & settings.' : 'M → world map · G on foot → drone · K time & weather.'}`, 'intro');
    }
    /** progress line: "Chapters n/10" (+ the achievements completion % when progression is loaded) */
    setChapterProgress() {
        const n = this.chapters.filter(c => this.progress.done.has(c.id)).length, N = this.chapters.length;
        let pct = null; try { pct = this.achievements?.completion?.()?.pct ?? null; } catch { pct = null; }
        this.hud.setProgress(pct != null ? `${n}/${N} · ${pct} %` : n, pct != null ? null : N, 'Chapters');
    }
    updateRoamObjective() {
        const d = this.city.districts?.[this.district], hud = this.hud;
        hud.setChapter(`🗺️ Free roam · ${d?.name || this.district}`);
        this.setChapterProgress();
        hud.setYear('2026'); this.year = 2026;
        this.objective = null; this.objectivePlain = ''; this.objectiveLabel = `🗺️ Free roam · ${this.touch ? '🌍 world map · 🚁 drone' : 'M world map · G drone (on foot)'}`;
        hud.setObjective?.(this.objectiveLabel);
        this.autoRoute(true);
    }
    // ---------------------------------------------------------------------------------- chapters (spec 10)
    renderMenuChapters() {
        if (!this.chapters) return;
        let box = $('#chapter-select');
        if (!box) { const card = $('#menu .menu-card'); if (!card) return; box = document.createElement('div'); box.id = 'chapter-select'; ($('#start')?.parentElement || card).insertAdjacentElement('afterend', box); }
        box.innerHTML = chapterSelectHtml(this.chapters, this.progress);
        box.onclick = (e) => { const b = e.target.closest('[data-chapter]'); if (b) this.start(+b.dataset.chapter); };
    }
    /** the car pose at a chapter's start: right-most lane of the named road, facing the compass heading */
    chapterPose(ch) {
        const st = ch.start; if (!st) return null;
        const q = this.city.proj(st.lat, st.lon), heading = -((st.heading ?? st.bearing ?? 0) * Math.PI / 180);
        // the same rule as the district's own spawn (world.js): legal carriageway for the declared heading, same lane
        const built = chapterStartPose(this.world?.graph?.edges, q, st); if (built) return built;
        const named = st.road ? (e) => st.road.test(e.name || '') || st.road.test(e.ref || '') : null;
        return (named && this.lanePose(q.x, q.z, heading, null, named)) || this.lanePose(q.x, q.z, heading);
    }
    /** load (or reuse) the chapter's district, put the car at its start, set the objective */
    async enterChapter(idx, { initial = false } = {}) {
        await save.saveSession('before-chapter');
        this.explore?.hooks?.beforeChapter?.(); // (any chapter entry is Story)
        const ch = this.chapters[idx]; if (!ch) return false;
        const conditions = this.travelConditions();
        if (this.freeRoam) { this.freeRoam = null; this.toggleConditions(false); document.body.classList.remove('free-roam'); }
        this.applyRoamTime(conditions.tod, CITIES[ch.city].timeZone || TIME_ZONES[ch.city]);
        const same = this.world && this.city?.id === ch.city && this.district === ch.district && !initial;
        if (!same) {
            $('#loading').classList.add('show');
            await new Promise(r => setTimeout(r, 30));
            try { await this.loadCity(ch.city, { district: ch.district, start: ch.start }); }
            catch (error) { this.cityLoadFailed(error); return false; }
            finally { $('#loading').classList.remove('show'); }
        }
        // world.spawn is the chapter start when the world built this district for it; otherwise place it here
        const builtFor = !same && this.world.district?.id === ch.district;
        if (!builtFor) { const p = this.chapterPose(ch); if (p) this.player.place(p.x, p.z, p.heading, p.edge); }
        this.endFoot();
        this.player.speed = 0; this.player.steer = 0; this.player.contactAge = 9; this.player.resetLook?.();
        this.traffic.setPlayer(this.player); this.traffic.clearForPlayer?.(this.player) ?? this.traffic.clearAround(this.player.x, this.player.z, 14);
        this.stuckT = 0; this.prevEdgeInfo = null; this.navManual = false;
        this.chapterIdx = idx; this.ch = ch; this.chapter = ch.id; this.chapterDone = false;
        this.progress.reached.add(ch.id); saveProgress(this.progress); this.renderMenuChapters();
        this.fuel = Math.max(this.fuel, TANK_L * 0.6); this.flags.emptyToast = false;
        this.player.camHolder.add(this.camera); this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0);
        this.state = 'drive'; this.input.flush(); this.frameClock.getDelta();
        this.updateObjective();
        const km = this.nav.route ? ` · ${fmtDist(this.nav.route.total, this.city.units)} drive` : '';
        this.hud.toast(`📖 ${ch.year} · ${ch.title}`, `${ch.intro || ''}${km}`, 'intro');
        return true;
    }
    updateChapterObjective() {
        const ch = this.ch, N = this.chapters.length, hud = this.hud;
        this.setChapterProgress();
        hud.setYear(ch.year); this.year = ch.year;
        hud.setChapter(`Chapter ${this.chapterIdx + 1}/${N} · ${ch.title}`);
        const stop = this.stops.find(s => s.id === ch.stop);
        if (this.chapterDone) {
            this.objective = null; this.objectivePlain = '';
            const next = this.chapters[this.chapterIdx + 1];
            this.objectiveLabel = next ? `🚗 Free drive · M → next chapter (${next.year} · ${next.title})` : '🏁 Story complete — free drive';
        } else if (ch.waypoint) {
            // the waypoint on the road (lat/lon may sit in the junction's grass): reached = within 30 m of that point
            const q = this.city.proj(ch.waypoint.lat, ch.waypoint.lon), ne = this.nav.index.nearest(q.x, q.z, 300, (e) => e.main !== false);
            this.objective = { x: ne ? ne.cx : q.x, z: ne ? ne.cz : q.z, waypoint: true, label: ch.waypoint.label };
            this.objectiveLabel = `📍 ${ch.waypoint.label} <small>(${ch.year})</small>`; this.objectivePlain = ch.waypoint.label;
        } else if (stop?.poiRef) {
            this.objective = stop.poiRef; this.objectiveLabel = `${stop.icon} ${stop.short} <small>(${ch.year})</small>`; this.objectivePlain = stop.short;
        } else if (ch.stop === 'otopeni' || (this.airport && ch.stop === AIRPORTS[this.city.id]?.poi)) {
            this.objective = this.airport; this.objectiveLabel = `✈️ ${AIRPORTS[this.city.id]?.name || 'Airport'} — departures <small>(${ch.year})</small>`; this.objectivePlain = AIRPORTS[this.city.id]?.name || 'Airport';
        } else { this.objective = null; this.objectiveLabel = `${ch.title}`; this.objectivePlain = ''; }
        this.autoRoute(true);
    }
    /** chapter / district jump: the cinematic transition (transition.js, note 16) with the map montage as a fallback */
    async transition(o) {
        try { return await playChapterTransition({ ...o, audio: this.audio }); }
        catch (e) { console.warn('[transition]', e); return chapterMontage(o); }
    }
    /** the next chapter in the same district, in place (notes 41/42): the player keeps driving / walking from where they are */
    chainChapter(idx) {
        const ch = this.chapters[idx]; if (!ch) return false;
        this.chapterIdx = idx; this.ch = ch; this.chapter = ch.id; this.chapterDone = false; this.navManual = false;
        this.progress.reached.add(ch.id); saveProgress(this.progress); this.renderMenuChapters();
        this.updateObjective();
        if (this.state === 'foot' && this.foot?.active) this.nav.setDestination(this.nav.dest || { x: this.objective?.doorX ?? this.objective?.x, z: this.objective?.doorZ ?? this.objective?.z, label: this.objectivePlain }, { x: this.foot.x, z: this.foot.z, heading: this.foot.heading });
        const km = this.nav.route ? ` · ${fmtDist(this.nav.route.total, this.city.units)}` : '';
        // (after round 6) its office already visited this session (e.g. DB before Luxoft): the chapter completes right away
        if (ch.stop && this.visited.has(ch.stop)) { this.hud.toast(`📖 ${ch.year} · ${ch.title}`, 'You already visited this office — chapter complete.', 'intro'); const id = ch.id; setTimeout(() => this.completeChapter(id), 1200); return true; }
        this.hud.toast(`📖 ${ch.year} · ${ch.title}`, `A few months later: walk or drive there${km}. ${ch.intro || ''}`, 'intro');
        return true;
    }
    /** the chapter's goal reached: card → Continue (montage / flight → next chapter) or free drive here */
    async completeChapter(expect = null) {
        if (this._completing || !this.ch || this.chapterDone || (expect && expect !== this.chapter)) return; this._completing = true;
        const idx = this.chapterIdx, ch = this.ch, next = this.chapters[idx + 1] || null;
        this.chapterDone = true; this.progress.done.add(ch.id); if (next) this.progress.reached.add(next.id);
        saveProgress(this.progress); this.renderMenuChapters();
        try { this.achievements?.evaluate?.(); } catch (e) { console.warn('[achievements]', e); } // unlock at the event, not on the next load (note 44)
        this.audio.chime(); this.updateObjective(); this.hud.setObjective(this.objectiveLabel); this.hud.setNavLine('');
        if (!next) { this._completing = false; setTimeout(() => this.finale(), 900); return; }
        // same district (luxoft → db, arnia → uipath-buc): no card, no respawn — the next objective appears where you are
        if (next.city === ch.city && next.district === ch.district && this.world?.district?.id === next.district) { this._completing = false; this.chainChapter(idx + 1); return; }
        this.player.speed = 0; this.input.releaseLock(); this.input.lookAllowed = false; this.hud.prompt(null);
        this.photo?.close?.(); this.state = 'card';
        const nd = CITIES[next.city]?.districts?.[next.district];
        const act = await chapterCard({ done: ch, next, index: idx, total: this.chapters.length, nextDistrictName: nd?.name });
        this._completing = false; this.returnFocus();
        if (act === 'next') { await this.goToChapter(idx + 1); return; }
        this.state = this.foot?.active ? 'foot' : 'drive'; this.input.flush(); this.frameClock.getDelta();
        this.hud.toast('🚗 Free drive', `Explore ${this.world.district?.name || 'the district'}. Continue the story any time: M → Next chapter.`, 'intro');
    }
    /** montage (same city) or the flight cutscene (other city), then the chapter */
    async goToChapter(idx) {
        const ch = this.chapters[idx]; if (!ch || this._transit) return false;
        this._transit = true;
        try {
            const prev = this.ch;
            this.photo?.close?.(); this.state = 'montage'; this.input.lookAllowed = false; this.input.releaseLock(); this.hud.prompt(null); this.hud.setNavLine('');
            this.audio.stopEngine?.();
            if (prev && prev.city !== ch.city) await this.flightCutscene(prev.city);
            else {
                // same district (luxoft → db in pipera): a short "a few months later" card on the map, no district jump
                const sameDistrict = prev && prev.city === ch.city && prev.district === ch.district;
                const via = !sameDistrict && prev ? (ch.montageVia || MONTAGE_VIA[ch.id] || []) : [];
                const stc = STOPS.find(x => x.id === ch.stop);
                await this.transition({ card: stc ? { company: stc.company, role: stc.role, period: stc.period, color: stc.color, icon: stc.icon } : null, globe: !prev || prev.city !== ch.city, cityName: CITIES[ch.city]?.name || this.city?.name, districts: CITIES[ch.city].districts || {}, from: prev?.district, to: ch.district, year0: prev?.year, year1: ch.year, title: ch.title,
                    caption: ch.intro, travel: sameDistrict ? '' : (ch.montageCaption || ''), via, water: via.length ? (MONTAGE_WATER[ch.id] || []) : [], kicker: sameDistrict ? (ch.year === prev.year ? 'A few months later' : 'Later') : '',
                    duration: sameDistrict ? 3200 : ch.montageCaption ? 6000 : prev ? 5000 : 4200 });
            }
            await this.enterChapter(idx);
            if (prev && prev.city !== ch.city && ch.city === 'seattle') this.hud.achievement('flight');
        } finally { this._transit = false; }
        return true;
    }
    async flightCutscene(from) {
        $('#hud').classList.add('in-office');
        try { await playFlight({ from, hud: this.hud, audio: this.audio }); } catch (e) { console.warn('[flight]', e); }
        $('#hud').classList.remove('in-office'); document.body.classList.remove('in-office');
    }

    // ---------------------------------------------------------------------------------- fast travel
    /** (after round 6) F is held, not tapped: a ring fills for 1.2 s next to the screen centre and the jump happens only
     *  when it completes; letting go earlier cancels (no accidental fast travel). Returns true on the frame it completes. */
    holdToTravel(input, dt) {
        input.take('KeyF');
        const destination = this.explore?.destination || (this.navManual && this.nav?.dest) || (this.chapterDone ? null : this.objective);
        const held = !!input.keys?.has?.('KeyF') && !!destination, HOLD = 1.2;
        let el = this._ftRing || document.getElementById('ft-hold');
        if (el) this._ftRing = el;
        if (!el) { el = this._ftRing = document.createElement('div'); el.id = 'ft-hold'; el.innerHTML = '<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" class="bg"/><circle cx="22" cy="22" r="18" class="fg"/></svg><span></span>'; document.body.appendChild(el); }
        if (!held) { if (this._ftT) { this._ftT = 0; el.classList.remove('on'); } return false; }
        this._ftT = (this._ftT || 0) + dt; el.classList.add('on'); el.querySelector('span').textContent = 'Hold F · fast travel';
        el.querySelector('.fg').style.strokeDashoffset = String(113.1 * (1 - Math.min(1, this._ftT / HOLD)));
        if (this._ftT < HOLD) return false;
        this._ftT = 0; el.classList.remove('on'); input.keys.delete?.('KeyF'); return true;
    }
    fastTravelToObjective() {
        if (this.explore?.destination) return this.explore.fastTravelSelected();
        if (this.navManual && this.nav.dest) return this.fastTravel({ ...this.nav.dest });
        const o = this.objective;
        if (!o) { this.hud.toast('⏩ Nowhere to fast-travel', 'Pick a destination on the map (M).'); return; }
        return this.fastTravel({ x: o.doorX ?? o.x, z: o.doorZ ?? o.z, label: this.objectivePlain || 'Destination' });
    }
    /** point `d` metres along a route → lane pose (right-most lane of that leg, facing along the route) */
    poseAlongRoute(route, d) {
        const { points: P, cum, legs } = route;
        let i = 0; while (i < P.length - 2 && cum[i + 1] < d) i++;
        const leg = legs[Math.min(i, legs.length - 1)]; const e = leg.e, dir = leg.dir;
        const segLen = cum[i + 1] - cum[i] || 1;
        let local = d - cum[i];
        const r0 = (i === 0 ? 0 : ((dir > 0 ? e.a : e.b).radius ?? 6) + 3), r1 = (i >= P.length - 2 ? 0 : ((dir > 0 ? e.b : e.a).radius ?? 6) + 3);
        if (segLen > r0 + r1) local = clamp(local, r0, segLen - r1);
        const t = clamp(local / segLen, 0, 1);
        const cx = P[i][0] + (P[i + 1][0] - P[i][0]) * t, cz = P[i][1] + (P[i + 1][1] - P[i][1]) * t;
        const lat = this.traffic.laneOffset(e, Math.max(0, lanesDir(e, dir) - 1), dir);
        return { x: cx + e.nx * dir * lat, z: cz + e.nz * dir * lat, heading: Math.atan2(-e.dirx * dir, -e.dirz * dir), edge: e, dir };
    }
    async fastTravel(dest) {
        this.explore?.hooks?.abortDrone?.();
        if (this.clamp && !this.clamp.paid && this.state === 'drive') { this.hud.toast('🔒 Wheel clamp', 'Pay the fine first: Esc → “Pay fine”.', 'warn'); return false; }
        if (this.state === 'foot') this.enterCar(); // fast travel starts from the parked car; do not call it to a new pickup pose first
        if (this.state !== 'drive' || this.refuel) return false;
        const { player, hud, city } = this;
        const route = this.nav.compute(player.x, player.z, dest.x, dest.z, player.heading, player.surfY ?? null);
        if (!route) { hud.toast('🧭 No route', 'Could not find a drivable route there.', 'warn'); return false; }
        if (route.total < 120) { hud.toast('⏩ Already here', `${dest.label || 'Destination'} is just ahead.`); return false; }
        // travel time on the route (speed limits, ~35% lost to lights and traffic) and fuel at the normal rate
        let t = 0; for (const leg of route.legs) t += leg.e.len / Math.max(5, edgeSpeed(leg.e) * 0.8);
        t = Math.max(t * 1.35, route.total / 16);
        const vAvg = route.total / t;
        const burn = this.stations?.length ? (FUEL_IDLE + FUEL_ROLL * vAvg + FUEL_AERO * vAvg * vAvg * vAvg) * t * 1.15 : 0; // +15% stop-and-go; no mapped station = no fuel burn
        const tank = burn * FUEL_GAME_MULT;
        if (this.stations?.length && tank > this.fuel - 0.2 && !dest.station) {
            hud.toast('⛽ Not enough fuel for that trip', 'Fast-travel to a gas station first (M → Gas stations).', 'warn');
            return false;
        }
        // land on the last stretch of the route (the destination's own street when it is long enough), ~22 m
        // before the door, in the legal direction, on a spot clear of walls, props and parked cars
        let pose = null, landD = 60;
        for (const d of [22, 26, 32, 40, 50, 60]) {
            const p = this.poseAlongRoute(route, Math.max(0, route.total - d));
            if (this.spotFree(p, 6)) { pose = p; landD = d; break; }
        }
        if (!pose) pose = this.poseAlongRoute(route, Math.max(0, route.total - 60));
        const names = []; for (const leg of route.legs) { const n = leg.e.name || leg.e.ref; if (n && names[names.length - 1] !== n && !names.includes(n)) names.push(n); }
        this.photo?.close?.(); this.state = 'montage';
        this.input.lookAllowed = false; this.input.releaseLock();
        hud.prompt(null); hud.setNavLine('');
        this.audio.blip(520, 0.08, 0.08);
        await this.playMontage({ dest, names, dist: route.total, liters: burn, tank, secs: t });
        // apply
        if (this.stations?.length) this.fuel = Math.max(0.3, this.fuel - tank);
        this.stats.fuelReal += burn; this.stats.dist += route.total; this.stats.time += t;
        this.stats.fastTravels++; this.stats.fastDist += route.total;
        player.place(pose.x, pose.z, pose.heading, pose.edge); player.contactAge = 9; player.steer = 0;
        this.stuckT = 0; this.prevEdgeInfo = null;
        this.traffic.setPlayer(player);           // big worlds: rebuild the traffic bubble around the new spot
        this.traffic.clearForPlayer?.(player) ?? this.traffic.clearAround(pose.x, pose.z, 12);
        // and nobody queued between the landing spot and the door
        for (let d = route.total - landD + 6; d < route.total + 4; d += 6) {
            const q = this.poseAlongRoute(route, Math.min(route.total, d)); this.traffic.clearAround(q.x, q.z, 5);
        }
        const o = this.objective, isObjective = o && Math.hypot((o.doorX ?? o.x) - dest.x, (o.doorZ ?? o.z) - dest.z) < 5;
        if (isObjective) { this.navManual = false; this.autoRoute(true); }
        else this.setNavDest({ x: dest.x, z: dest.z, label: dest.label }, true); // keep guiding to where we fast-travelled
        for (const c of this.cameras || []) c.lastD = 1e9;
        this.state = 'drive';
        this.input.flush(); this.frameClock.getDelta();
        hud.toast(`⏩ ${dest.label || 'Arrived'}`, `${fmtDist(landD, city.units)} to go on ${roadName(pose.edge)}.`);
        if (this.stats.fastTravels === 1) hud.achievement('fast-travel');
        return true;
    }
    /** 1.5 s "driving montage": city, street names flashing by, distance, fuel and time */
    playMontage({ dest, names, dist, liters, tank, secs }) {
        const el = $('#montage'); if (!el) return Promise.resolve();
        const us = this.city.units === 'mph';
        const scale = this.world.scale ?? 1;
        const cityName = this.city.name || (this.city.id === 'bucharest' ? 'București' : 'Seattle');
        el.querySelector('.m-city').textContent = cityName;
        el.querySelector('.m-dest').textContent = '→ ' + (dest.label || 'Destination');
        const street = el.querySelector('.m-street'), dEl = el.querySelector('.m-dist'), fEl = el.querySelector('.m-fuel'), tEl = el.querySelector('.m-time'), bar = el.querySelector('.m-bar i');
        const list = names.length ? names : ['…'];
        el.classList.add('show');
        const DUR = 1500, t0 = performance.now();
        return new Promise(res => {
            let lastIdx = -1;
            const tick = () => {
                const k = clamp((performance.now() - t0) / DUR, 0, 1), e = 1 - Math.pow(1 - k, 2);
                const idx = Math.min(list.length - 1, Math.floor(k * list.length));
                if (idx !== lastIdx) { lastIdx = idx; street.textContent = list[idx]; street.classList.remove('flash'); void street.offsetWidth; street.classList.add('flash'); }
                const real = scale !== 1 && k >= 1 ? ` <small>(≈ ${fmtDist(dist / scale, this.city.units)} in real life)</small>` : '';
                dEl.innerHTML = `🛣️ ${fmtDist(dist * e, this.city.units)}${real}`;
                fEl.textContent = `⛽ −${us ? (tank * e / GAL).toFixed(2) + ' gal' : (tank * e).toFixed(2) + ' L'} tank`;
                tEl.textContent = `🕒 +${Math.max(1, Math.round(secs * e / 60))} min`;
                bar.style.width = (k * 100).toFixed(1) + '%';
                if (k < 1) requestAnimationFrame(tick);
                else setTimeout(() => { el.classList.remove('show'); res(); }, 120);
            };
            requestAnimationFrame(tick);
        });
    }

    // ----------------------------------------------------------------------------------
    enterOffice(stop) {
        this.basketball?.cancel('office');
        this.explore?.hooks?.abortDrone?.();
        this.photo?.close?.();
        // Preserve the physical street pose; the virtual room never relocates the player/car.
        this.camera.updateWorldMatrix(true, false);
        const entryCamera = this.camera.clone();
        entryCamera.position.setFromMatrixPosition(this.camera.matrixWorld);
        entryCamera.quaternion.setFromRotationMatrix(this.camera.matrixWorld); entryCamera.scale.set(1, 1, 1); entryCamera.updateMatrixWorld(true);
        this.officeFromFoot = this.state === 'foot';
        this.officeReturn = { camera: entryCamera, driveRigShown: this.player.driveRigShown !== false,
            carParent: this.carBody?.parent || null, carBox: this.carBox,
            foot: this.officeFromFoot ? { x: this.foot.x, y: this.foot.y, z: this.foot.z, heading: this.foot.heading, pitch: this.foot.pitch } : null };
        if (this.officeFromFoot) this.foot.exit();
        else {
            this.player.speed = 0;
            if (!this.carBody) { this.carBody = makeVehicle('hatch', '#1e3a8a', { instanced: true, city: this.city.id }); this.carBody.userData.parked = true; }
            const p = this.player;
            this.carBody.position.set(p.x, p.surfY ?? 0.24, p.z); this.carBody.rotation.set(0, p.heading, 0); this.scene.add(this.carBody);
            this.carBox = { x: p.x, z: p.z, fx: p.fx, fz: p.fz, length: this.carBody.userData.length || 4.2, width: this.carBody.userData.width || 1.8 };
        }
        this.setDriveRigShown(false);
        this._officePresentedAt = null; this._officeFPSAcc = this._officeFPSN = 0;
        this.state = 'office';
        this.audio.stopEngine(); this.audio.blip(520, 0.15, 0.1);
        $('#hud').classList.add('in-office'); document.body.classList.add('in-office');
        this.player.resetLook();
        try {
            this.officeBubbleScope = createOfficeBubbleScope(this.hud);
            this.office = new Office(this.renderer, this.camera, stop, this.officeBubbleScope.hud, this.input, this.audio);
            this.officeWindow = createOfficeWindowService({ renderer: this.renderer, r3d: this.r3d, world: this.world, scene: this.scene, traffic: this.traffic, office: this.office, entryCamera });
        } catch (error) {
            this.restoreOfficeReturn(); this.hud.toast('Room unavailable', 'The street state has been restored.', 'warn'); console.warn('[office] enter', error); return;
        }
        this.hud.toast(`${stop.icon} ${stop.company}`, stop.tagline);
        this.hud.setStreet(stop.company, stop.address);
        this.hud.prompt(null);
        this.hud.setNavLine('');
    }
    updateOffice(dt) {
        const o = this.office;
        o.update(dt);
        this.frame++; this.updateClock(dt);
        if (this.frame % 30 === 0) this.pollWeather();
        this.officeWindow.prepare(dt);
        this.traffic.setHour(this.trafficHours()); this.traffic.update(dt);
        this.carBody?.userData.setLights?.(((this.clock.date?.getTime?.() ?? performance.now()) / 400 | 0) % 2 === 0);
        this.officeWindow.capture();
        this.hud.update(dt, this.camera, this.city.id, { bubbleFilter: this.officeBubbleScope.accepts });
        this.renderOffice();
        if (o.done) this.leaveOffice();
    }
    renderOffice() {
        if (!this.office) return;
        try { this.office.render(); }
        finally {
            // Include all submitted environment, portal, shadow and room work before reset.
            const now = performance.now(), visible = document.visibilityState !== 'hidden', elapsed = visible && this._officePresentedAt != null ? now - this._officePresentedAt : 0;
            this._officePresentedAt = visible ? now : null;
            Object.assign(this.r3d.stats, { drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles });
            if (!visible) { this._officeFPSAcc = this._officeFPSN = 0; this.r3d.stats.fps = this.r3d.stats.frameMs = 0; }
            if (elapsed > 0) {
                this.r3d.stats.frameMs = Math.round(elapsed * 10) / 10; this._officeFPSAcc += elapsed; this._officeFPSN++;
                if (this._officeFPSAcc >= 500) { this.r3d.stats.fps = Math.round(10000 * this._officeFPSN / this._officeFPSAcc) / 10; this._officeFPSAcc = this._officeFPSN = 0; }
            }
            this.renderer.info.reset();
        }
    }
    restoreOfficeReturn() {
        if (!this.officeReturn && !this.office && !this.officeWindow) return;
        const restore = this.officeReturn;
        this.officeWindow?.dispose(); this.officeWindow = null;
        this.office?.dispose(); this.office = null;
        this.officeBubbleScope?.dispose(); this.officeBubbleScope = null;
        this.officeReturn = null; this._officePresentedAt = null;
        this.r3d._lastStatsNow = null; // mode boundary: no office-duration gap in the next driving FPS sample
        $('#hud').classList.remove('in-office'); document.body.classList.remove('in-office');
        this.player.camHolder.add(this.camera); this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0);
        this.player.resetLook();
        this.state = 'drive';
        if (restore?.camera) {
            for (const key of ['fov', 'aspect', 'near', 'far', 'zoom', 'filmGauge', 'filmOffset']) this.camera[key] = restore.camera[key];
            this.camera.updateProjectionMatrix();
        }
        if (this.officeFromFoot && restore?.foot) {
            const f = restore.foot; this.foot.enter(f.x, f.z, f.heading, f.y); this.foot.pitch = f.pitch; this.foot.place(); this.state = 'foot';
        } else if (restore) {
            if (!restore.carParent) this.carBody?.removeFromParent(); else restore.carParent.add(this.carBody);
            this.carBox = restore.carBox; this.setDriveRigShown(restore.driveRigShown);
        }
        this.officeFromFoot = false;
    }
    leaveOffice() {
        this.photo?.close?.();
        const o = this.office, stop = o.stop;
        this.restoreOfficeReturn();
        if (this.freeRoam) { // free roam (R10.10): the CV content, no story progress
            if (o.read.size === 0) this.hud.toast('💬 Nobody asked', 'Walk up to your host and press E to talk.');
            else this.hud.toast(`${stop.icon} ${stop.short}`, 'Free roam: keep going (M → world map: districts and tourist spots).');
        } else if (this.ch) { // The linear chapter completes only after its final Continue action.
            if (o.conversationComplete && !this.visited.has(stop.id)) { this.visited.add(stop.id); if (stop.poiRef) stop.poiRef.visited = true; this.audio.chime(); }
            if (o.conversationComplete && this.ch.stop === stop.id && !this.chapterDone) { const id = this.chapter; queueMicrotask(() => this.completeChapter(id)); }
            else if (!o.conversationComplete) this.hud.toast('Chapter paused', 'Hear the full story from your host to continue this chapter.');
        } else if (o.conversationComplete && !this.visited.has(stop.id)) {
            this.visited.add(stop.id); if (stop.poiRef) stop.poiRef.visited = true;
            this.audio.chime();
            this.hud.toast('✅ ' + stop.short + ' unlocked', `${this.visited.size}/${STOPS.length} chapters of the CV discovered`);
            this.updateObjective();
            if (stop.id === 'uipath-bel') setTimeout(() => this.finale(), 1200);
            else if (this.objective) setTimeout(() => this.hud.toast('⏩ Hold F to fast-travel to the next stop', `${this.objectivePlain} · or drive there yourself`, 'intro'), 1600);
        } else if (!o.conversationComplete) this.hud.toast('Chapter paused', 'Hear the full story from your host to continue this chapter.');
        this.input.flush();
        this.player.speed = 0;
        this.returnFocus();
    }

    finale() {
        this.photo?.close?.();
        this.input.releaseLock();
        this.hud.achievement('all');
        const s = this.stats;
        const links = PROFILE.links.map(l => `<a class="btn ghost" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`).join('');
        const timeline = STOPS.map(st => `<li><span class="dot" style="background:${st.color}"></span><b>${st.company}</b> — ${st.role} <small>${st.period}</small></li>`).join('');
        const both = (o) => [o.RON ? money('RON', o.RON) : '', o.USD ? money('USD', o.USD) : ''].filter(Boolean).join(' + ') || '0';
        const mins = Math.round((performance.now() - (this.startTime || performance.now())) / 60000);
        const statLine = [
            `Time: ${mins} min`,
            `Distance driven: ${(s.dist / 1000).toFixed(1)} km (${(s.dist / 1609.34).toFixed(1)} mi)`,
            `Fuel spent: ${s.fuelReal.toFixed(1)} L burned · ${s.fuelL.toFixed(1)} L bought (${both(s.fuelCost)})`,
            `Fines: ${s.fineCount} (${both(s.fines)})`,
            `Honks: ${this.honks}`,
            `Fast travels: ${s.fastTravels}${s.fastTravels ? ` (${(s.fastDist / 1000).toFixed(1)} km skipped)` : ''}`,
            `Achievements: ${this.hud.unlocked.size}`,
        ].join(' · ');
        let comp = null; try { comp = this.achievements?.completion?.() || null; } catch { comp = null; }
        const fin = { profile: PROFILE, stops: STOPS, stats: { minutes: mins, distanceKm: s.dist / 1000, chapters: [this.progress?.done?.size ?? this.visited.size, this.chapters?.length ?? STOPS.length],
            achievements: comp ? [comp.unlocked, comp.total] : [this.hud.unlocked.size, null], completion: comp?.pct ?? null, photos: this.photoCount ?? null,
            fines: s.fineCount ? `${s.fineCount} (${both(s.fines)})` : '' },
            actions: { worldmap: () => { if (this.explore?.openWorldMap) this.explore.openWorldMap(); else this.startFreeRoam?.(this.district || 'romana', { tod: 'now', weather: 'live' }); }, spots: () => this.togglePause(true, 'spots'), replay: () => this.goToChapter(0) } };
        try { showFinale(fin); return; } catch (e) { console.warn('[finale]', e); }
        // fallback: the old panel
        this.hud.panel(`<div class="eyebrow">🏁 Story complete</div><h2>${PROFILE.name}</h2><p class="lead">${PROFILE.title} · ${PROFILE.location}</p><p>${PROFILE.summary}</p><ul class="timeline">${timeline}</ul><div class="chips">${PROFILE.topSkills.map(sk => `<span class="chip">${sk}</span>`).join('')}</div><h3>Say hi</h3><div class="links">${links}<a class="btn ghost" href="mailto:${PROFILE.email}">Email</a></div><h3>Trip computer</h3><p class="meta">${statLine}</p><p class="meta">You can keep driving around, or fly back to Bucharest from SeaTac.</p>`);
    }
}
