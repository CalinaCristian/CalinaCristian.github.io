// Harness entry (ES module, injected by run.js after the game has booted):
// builds window.harness on top of window.game.
import { Harness } from './core.js';
import { SCENARIOS, STREETS, findStreet } from './scenarios.js';
import './office-talk.js'; // + the office-talk scenario (cockpit-ui, round 5)
import { staticAudit } from './audit.js';
import { sleep } from './util.js';

const g = window.game;
const H = new Harness(g);
H.install();

// every map is a 1:1 district (spec 22): without one, a city loads the district of its first chapter
const districtOf = (id, district) => district || g.chapters?.find(c => c.city === id)?.district || null;
async function loadCity(id, district) {
    district = districtOf(id, district);
    if (g.city?.id === id && g.district === district && g.started && g.state !== 'menu' && g.state !== 'loading') return true;
    const prev = g.state; g.state = 'loading';
    if (!g.started) {
        // what Game.start() does, minus the hard-wired Bucharest load and the audio
        g.started = true;
        document.querySelector('#menu')?.classList.remove('show');
        document.querySelector('#hud')?.classList.add('show');
        g.startTime = performance.now();
    }
    try { await g.loadCity(id, { district }); } catch (e) { H.issue('js-error', 'high', `loadCity(${id}:${district}) threw: ${e.message}`, { x: 0, z: 0 }, { key: 'load:' + id + ':' + district }); g.state = prev; return false; }
    try { g.player.camHolder.add(g.camera); g.camera.position.set(0, 0, 0); g.camera.rotation.set(0, 0, 0); } catch { /* ignore */ }
    g.fuel = 45; g.state = 'drive'; H.lampSet = null;
    return true;
}
async function waitFor(fn, ms) { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > ms) return false; await sleep(50); } return true; }

window.harness = {
    H, SCENARIOS, STREETS,
    get issues() { return H.issues; },
    list: () => SCENARIOS.map(s => ({ id: s.id, group: s.group || s.id, title: s.title, city: s.city })),
    loadCity,
    async runScenario(id, ctx = {}) {
        const sc = SCENARIOS.find(s => s.id === id); if (!sc) throw new Error('unknown scenario ' + id);
        // a scenario tied to a street names its district (`district`: an id, or a function of the city id)
        const want = typeof sc.district === 'function' ? sc.district(g.city?.id) : sc.district;
        if (want && g.district !== want) await loadCity(g.city?.id || sc.city, want);
        H.begin(id); H.perf = null;
        const t0 = performance.now(), sim0 = H.simT, before = H.issues.length;
        let result = null, error = null;
        try { if (want && g.district !== want) throw new Error('could not load district ' + want); result = await sc.run(H, ctx); }
        catch (e) { error = e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'); H.issue('harness-error', 'medium', `scenario ${id} crashed: ${e.message}`, { stack: e.stack }, { key: 'crash:' + id }); }
        H.ap = null; H.setControls(0, 0, true);
        await H.flushShots();
        return { id, title: sc.title, city: H.city, wallMs: Math.round(performance.now() - t0), simSec: Math.round((H.simT - sim0) * 10) / 10, newIssues: H.issues.length - before, stepMs: window.harness.stats().stepMs, result, error };
    },
    async audit() { H.lampSet = null; H.begin('audit'); return staticAudit(H); },
    // convenience API (for manual use from the console / quick scripts)
    driveTo: (x, z, opts) => H.driveTo(x, z, opts),
    async visitStop(id) {
        const stop = g.stops?.find(s => s.id === id); if (!stop?.poiRef) return { ok: false, reason: 'unknown stop ' + id };
        const dx = stop.poiRef.doorX ?? stop.poiRef.x, dz = stop.poiRef.doorZ ?? stop.poiRef.z;
        if (Math.hypot(g.player.x - dx, g.player.z - dz) > 150) { H.refuelInstant(); await g.fastTravel({ x: dx, z: dz, label: id }); }
        return H.driveTo(dx, dz, { arriveR: 7, stop: true, label: id });
    },
    refuel: () => H.refuelInstant(),
    findStreet: (re, len, o) => findStreet(H, re, len, o),
    stats: () => ({ simT: H.simT, issues: H.issues.length, shots: H.shots, city: H.city, scenario: H.scenario, player: g.player ? { x: g.player.x, z: g.player.z, speed: g.player.speed } : null, traffic: g.traffic?.stats, render: g.r3d?.stats, lastRenderMs: H._lastRenderMs, stepMs: H.perf && H.perf.n ? { autopilot: +(H.perf.ap / H.perf.n).toFixed(2), game: +(H.perf.game / H.perf.n).toFixed(2), checks: +(H.perf.check / H.perf.n).toFixed(2), steps: H.perf.n, shotsMs: Math.round(H.perf.shot), yieldMs: Math.round(H.perf.yield), auditMs: Math.round(H.perf.audit) } : null }),
    perfProbe(frames = 6) {
        // a few real rendered frames: software-GL caveat, only meaningful as a trend
        const t0 = performance.now(); for (let i = 0; i < frames; i++) H.renderFrame(); const ms = (performance.now() - t0) / frames;
        return { msPerFrame: Math.round(ms), fps: Math.round(1000 / ms * 10) / 10, quality: g.r3d?.stats?.quality, drawCalls: g.r3d?.stats?.drawCalls, triangles: g.r3d?.stats?.triangles, w: innerWidth, h: innerHeight };
    },
    log: () => H.log,
};
window.dispatchEvent(new Event('harness-ready'));
