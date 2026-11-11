#!/usr/bin/env node
// node game/dev/harness/tram-sweep-audit.cjs <repo root> <out dir> [city] [district] [step m]
// Actual generated district world, nothing rendered. Every usable rail leg, each direction, each tram body length, every
// <step> metres: the pose is the game's own (previewInitialTrafficPose) and so is the verdict (railBodyInside,
// initialTrafficStaticClearance). A refused pose is a place where a tram is stopped by a static body for good.
// Fails when the body is one the world builder itself generated (it must stay out of the tram sweep: tram-sweep.js).
// Conflicts with source structures and estimated models are listed, not hidden. Deterministic; not a driven journey.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2] || '.'), out = path.resolve(process.argv[3] || 'game/dev/harness/report/tram-sweep-audit');
const city = process.argv[4] || 'bucharest', district = process.argv[5] || 'grozavesti', stepM = +process.argv[6] || 1;
fs.mkdirSync(out, { recursive: true });
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css' };
const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname), file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(error ? 'missing' : bytes); });
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.setDefaultTimeout(900000);
        await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
        await page.goto(`http://127.0.0.1:${server.address().port}/game/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => window.game, null, { timeout: 90000 });
        const report = await page.evaluate(async ({ city, district, stepM }) => {
            const g = window.game; g.state = 'loading'; g.started = true;
            const { CHAPTERS } = await import('/game/src/cities.js'), { initialTrafficStaticClearance, previewInitialTrafficPose } = await import('/game/src/initial-traffic-admission.js'), { canTravelTram } = await import('/game/src/tram-path.js');
            await g.loadCity(city, { district, start: CHAPTERS.find(c => c.city === city && c.district === district)?.start });
            const T = g.traffic, W = g.world, r = v => Math.round(v * 100) / 100, rails = T.tramNetwork?.edges || [];
            const trams = T.vehicles.filter(v => v.edge?.rail), protos = []; for (const v of trams) if (!protos.some(p => p.length === v.length)) protos.push(v);
            const centre = (x, z) => { let best = Infinity; for (const e of rails) { const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - e.a.x) * dx + (z - e.a.z) * dz) / L2)); best = Math.min(best, Math.hypot(x - e.a.x - dx * t, z - e.a.z - dz * t)); } return best; };
            const kindOf = o => o.kind || (o.wall ? 'wall' : o.prop ? 'prop' : 'body'), found = new Map(); let poses = 0, unresolved = 0, outside = 0, refused = 0;
            for (const proto of protos) for (const edge of rails) for (const dir of [1, -1]) {
                if (!canTravelTram(edge, dir)) continue;
                for (let s = 0; s <= edge.len; s += stepM) {
                    let pose; try { pose = previewInitialTrafficPose(T, { ...proto, edge, dir, route: [], hist: [] }, s); } catch { unresolved++; continue; } // (a fork with no chosen branch, or the end of the line)
                    poses++;
                    const body = { ...proto, ...pose, edge, dir, route: [], hist: [] };
                    if (!T.railBodyInside(body)) { outside++; continue; }
                    const c = initialTrafficStaticClearance(W, body); if (c.valid) continue;
                    refused++;
                    const h = c.hit; let obj = null, od = Infinity;
                    if (h?.sample) W.buildings.query(h.sample.x, h.sample.z, h.sample.radius + 2, o => { if (kindOf(o) !== h.kind) return; const d = o.wall ? Math.min(Math.hypot(o.ax - h.sample.x, o.az - h.sample.z), Math.hypot(o.bx - h.sample.x, o.bz - h.sample.z), Math.hypot(o.x - h.sample.x, o.z - h.sample.z)) : Math.hypot(o.x - h.sample.x, o.z - h.sample.z) - (o.r || 0); if (d < od) { od = d; obj = o; } });
                    const key = obj || `${h?.kind}|${c.reason}`; let rec = found.get(key);
                    if (!rec) found.set(key, rec = { kind: h?.kind || c.reason, sourceId: h?.sourceId ?? null, inferred: obj?.inferred === true, estimated: obj?.estimated === true, poses: 0, bodyLengthsM: new Set(),
                        at: obj ? (obj.wall ? [r(obj.ax), r(obj.az), r(obj.bx), r(obj.bz)] : [r(obj.x), r(obj.z)]) : null, radiusM: obj && !obj.wall ? r(obj.r) : null,
                        railCentrelineM: obj ? r(obj.wall ? Math.min(centre(obj.ax, obj.az), centre(obj.bx, obj.bz), centre(obj.x, obj.z)) : centre(obj.x, obj.z)) : null,
                        colliderBandM: h?.colliderBand ? [r(h.colliderBand.min), r(h.colliderBand.max)] : null, bodyIntervalM: h?.interval ? [r(h.interval.min), r(h.interval.max)] : null,
                        first: { railEdge: edge.id, dir, s: r(s), pose: [r(body.x), r(body.y), r(body.z)], alongM: r(h?.sample?.along), acrossM: r(h?.sample?.across) } });
                    rec.poses++; rec.bodyLengthsM.add(proto.length);
                }
            }
            const list = [...found.values()].map(o => ({ ...o, bodyLengthsM: [...o.bodyLengthsM] })).sort((a, b) => b.poses - a.poses);
            return { city, district, stepM, railLegs: rails.length, bodyLengthsM: protos.map(p => p.length), poses, bodyOutsideDistrict: outside, noPose: unresolved, refused, sweep: W.stats.tramSweep, obstacles: list };
        }, { city, district, stepM });
        // what the world builder generates on its own: none of it may stand in a tram's way
        const generated = o => o.inferred || /^(bollard|tlight|pier|closure|rail-roadside-cap|furniture|busstop|basarab-|bridge-|lamp|tree)/.test(o.kind);
        const own = report.obstacles.filter(generated), others = report.obstacles.filter(o => !generated(o)), byKind = {};
        for (const o of report.obstacles) { const k = byKind[o.kind] || (byKind[o.kind] = { obstacles: 0, poses: 0 }); k.obstacles++; k.poses += o.poses; }
        fs.writeFileSync(path.join(out, `${city}-${district}.json`), JSON.stringify({ root, method: 'Built district world; game pose and rail guard at every station; RAF disabled; no visual or journey claim.', ...report, byKind, errors }, null, 2));
        console.log(`     ${report.poses} poses on ${report.railLegs} rail legs (${report.bodyLengthsM.join(' / ')} m bodies, every ${stepM} m): ${report.refused} refused by ${report.obstacles.length} static bodies ${JSON.stringify(byKind)}`);
        for (const o of report.obstacles.slice(0, 12)) console.log(`     ${String(o.poses).padStart(4)} poses  ${o.kind}${o.sourceId ? ' ' + o.sourceId : ''}${o.inferred ? ' (inferred)' : ''}${o.estimated ? ' (estimated)' : ''} at ${JSON.stringify(o.at)}, ${o.railCentrelineM} m from a rail centreline, band ${JSON.stringify(o.colliderBandM)} against body ${JSON.stringify(o.bodyIntervalM)}`);
        assert.deepEqual(errors, []);
        if (!report.railLegs) { console.log(`PASS ${city}/${district}: no tram rail in this district.`); return; }
        assert.ok(report.poses > 0 && report.sweep?.poses > 0, 'sweep and audit poses exist');
        assert.equal(own.length, 0, `${own.length} generated bodies stand in a tram's swept path: ` + own.slice(0, 6).map(o => `${o.kind} at ${JSON.stringify(o.at)} (${o.poses} poses)`).join('; '));
        console.log(`PASS ${city}/${district}: no generated body in the tram sweep. ${others.length ? `Still refused by ${others.length} source / estimated bodies (${others.reduce((n, o) => n + o.poses, 0)} poses): open, listed in the report.` : 'No pose is refused.'}`);
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(String(error.message || error).slice(0, 1800)); process.exitCode = 1; });
