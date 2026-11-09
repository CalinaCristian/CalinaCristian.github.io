// Native phone inputs for the remaining short market / shore interactions.
// Every case declares its nearby setup pose; these are not public-route proofs.
const fs = require('node:fs'), cp = require('node:child_process'), assert = require('node:assert/strict'), { chromium } = require('playwright');
const out = process.env.OUT || '/tmp/tourist-shore-market'; fs.mkdirSync(out, { recursive: true }); fs.copyFileSync(__filename, `${out}/runner.cjs`);
(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const report = { sourceCommit: cp.execFileSync('git', ['rev-parse', process.env.SOURCE_COMMIT || 'HEAD'], { encoding: 'utf8' }).trim(), touch: true, setup: 'Explicit nearby setup for each interaction, actual CDP look/action touches afterwards; no source/collider/crowd changes.', cases: [], errors: [], captures: [] };
    const save = () => fs.writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2));
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), page = await context.newPage(), cdp = await context.newCDPSession(page);
        page.setDefaultTimeout(180000); page.on('pageerror', e => { report.errors.push(e.message); save(); });
        await page.route(/api\.open-meteo\.com/, r => r.fulfill({ json: { error: true } })); await page.addInitScript(() => requestAnimationFrame = () => 0);
        await page.goto(`http://127.0.0.1:${process.env.PORT || 8437}/game/?q=high`, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.game?.achievements);
        await page.evaluate(() => { window.step = (n = 1) => { for (let i = 0; i < n; i++) { game.syncModalControls(); game.spot.update(.05); } }; window.activityEvents = []; addEventListener('dmcv:activity', e => activityEvents.push({ ...e.detail })); game.setRoamTime('day'); game.setRoamWeather('clear'); game.setRoamSeason('summer'); });
        const tap = async selector => {
            const q = await page.locator(selector).evaluate(el => { const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2; if (!el.contains(document.elementFromPoint(x, y))) throw Error(`Obstructed native target ${el.outerHTML.slice(0, 100)}`); return { x, y, width: r.width, height: r.height }; });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: q.x, y: q.y, id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); return q;
        };
        const act = async () => { const q = await tap('[data-btn=act]'); assert.ok(q.width >= 44 && q.height >= 44); await page.evaluate(() => step()); return q; };
        const capture = async name => {
            const r = await page.evaluate(() => { game.drawFrame(); const a = game.camera.position.clone(), d = a.clone(); game.camera.getWorldPosition(a); game.camera.getWorldDirection(d); return { image: document.querySelector('canvas').toDataURL('image/webp', .85), capturedAt: new Date().toISOString(), position: { ...game.spot.position }, pose: { position: a.toArray(), bearing: (Math.atan2(d.x, -d.z) * 180 / Math.PI + 360) % 360, pitch: Math.asin(d.y) * 180 / Math.PI }, triangles: game.r3d.stats.triangles, calls: game.r3d.stats.drawCalls }; });
            fs.writeFileSync(`${out}/${name}.webp`, Buffer.from(r.image.split(',')[1], 'base64')); delete r.image; report.captures.push({ name, ...r }); save(); assert.ok(r.triangles <= 1.5e6 && r.calls <= 400); return r;
        };
        const setup = async kind => page.evaluate(kind => { const s = game.spot, it = s.spot.interactables.find(it => it.kind === kind); if (!it) throw Error(`Missing ${kind}`); s.ctl.enter(it.x, it.z, 0, it.y); s.input.flush(); step(); game.drawFrame(); return { position: { ...s.position }, kind, label: typeof it.label === 'function' ? it.label(s) : it.label }; }, kind);
        const aim = async target => {
            for (let n = 0; n < 45; n++) {
                const q = await page.evaluate(t => { const s = game.spot, p = s.camera.getWorldPosition(s.camera.position.clone()), dx = t.x - p.x, dz = t.z - p.z, desired = Math.atan2(-dx, -dz), pitch = Math.atan2(t.y - p.y, Math.hypot(dx, dz)); return { dx: (((s.ctl.heading - desired + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) / .0024, dy: (s.ctl.pitch - pitch) / .0024 }; }, target);
                // CDP touch movements below about ten CSS pixels can stay in
                // the browser's gesture slop. The game still requires its real
                // wall ray; this tolerance only stops the aiming helper.
                if (Math.abs(q.dx) < 25 && Math.abs(q.dy) < 25) return n;
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 285, y: 550, id: 2 }] });
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 285 + Math.max(-75, Math.min(75, q.dx / 1.6)), y: 550 + Math.max(-150, Math.min(150, q.dy / 1.6)), id: 2 }] });
                await page.evaluate(() => step()); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            }
            throw Error('Native touch look did not acquire the subject: ' + JSON.stringify(await page.evaluate(t => ({ target: t, position: { ...game.spot.position }, eye: game.camera.getWorldPosition(game.camera.position.clone()).toArray(), heading: game.spot.ctl.heading, pitch: game.spot.ctl.pitch, lookMode: game.input.lookMode, lookAllowed: game.input.lookAllowed, active: game.spot.ctl.active }), target)));
        };
        const test = async (name, fn) => { if (process.env.CASES && !process.env.CASES.split(',').includes(name)) return; const record = { name }; report.cases.push(record); save(); try { await fn(record); record.passed = true; } catch (e) { record.passed = false; record.failure = { message: e.message, stack: e.stack }; } save(); };
        if (!process.env.CASES?.startsWith('pier-')) await page.evaluate(() => game.enterSpot('pike-place'));
        await test('fish-immediate-pause-cancellation', async r => {
            r.setup = await setup('fish'); r.controls = await act(); await page.evaluate(() => step(5));
            r.inFlight = await page.evaluate(() => { const s = game.spot, it = s.spot.interactables.find(it => it.kind === 'fish'); return { label: it.label(s), award: game.achievements.isUnlocked('lm-pike-fish') }; });
            assert.equal(r.inFlight.label, 'Catch!'); assert.equal(r.inFlight.award, false);
            await tap('#pause-btn'); r.paused = await page.evaluate(() => { const s = game.spot, it = s.spot.interactables.find(it => it.kind === 'fish'); return { open: game.pauseOpen, label: it.label(s), award: game.achievements.isUnlocked('lm-pike-fish') }; });
            await tap('#pause-menu .pm-x[data-pa=resume]'); assert.equal(r.paused.open, true); assert.equal(r.paused.award, false);
            assert.ok(r.paused.label.startsWith('Ask'), 'Unfinished player fish throw survived host pause before another update');
        });
        await test('fish-native-timing-and-completion', async r => {
            await page.evaluate(() => step(50)); r.setup = await setup('fish'); await act(); await page.evaluate(() => step(5)); await act();
            assert.equal(await page.evaluate(() => game.achievements.isUnlocked('lm-pike-fish')), false, 'Early catch awarded');
            await page.evaluate(() => step(8)); await capture('fish-in-flight'); await page.evaluate(() => step(5)); await act();
            r.complete = await page.evaluate(() => ({ award: game.achievements.isUnlocked('lm-pike-fish'), count: game.spot.progress.fish, events: activityEvents })); assert.equal(r.complete.award, true); assert.equal(r.complete.count, 1);
        });
        if (process.env.ONLY !== 'fish') {
            await test('gum-native-aim-and-physical-wall-placement', async r => {
                r.setup = await page.evaluate(() => { const s = game.spot, walls = []; s.spot.scene.traverse(o => { if (o.name === 'gum-wall-face') walls.push(o); }); const m = walls[0], fx = Math.sin(m.rotation.y), fz = Math.cos(m.rotation.y); s.ctl.enter(m.position.x + fx * 2, m.position.z + fz * 2, 0); s.input.flush(); step(); const p = { ...s.position }, eye = s.camera.getWorldPosition(s.camera.position.clone()); return { position: p, wall: { x: m.position.x, y: eye.y, z: m.position.z }, sky: { x: p.x + 4, y: eye.y + 10, z: p.z } }; });
                r.skyDrags = await aim(r.setup.sky); await act(); assert.equal(await page.evaluate(() => game.achievements.isUnlocked('lm-gum-wall')), false, 'Looking away from the wall awarded gum');
                r.wallDrags = await aim(r.setup.wall); await act(); r.complete = await page.evaluate(() => ({ award: game.achievements.isUnlocked('lm-gum-wall'), count: game.spot.progress.gum, position: { ...game.spot.position } })); assert.equal(r.complete.award, true); assert.equal(r.complete.count, 1); await capture('gum-placed-on-wall');
            });
            await page.evaluate(() => game.enterSpot('bel-meydenbauer'));
            await test('pier-actual-arrival-source-centreline-and-terminal-award', async r => {
                r.arrival = await capture('pier-public-arrival');
                r.plan = await page.evaluate(async surfacePlan => {
                    const s = game.spot, way = s.spot.data.ways.find(w => w.id === 'w688415225'); if (!way) throw Error('Missing mapped pier centreline');
                    const arc = [...way.pts].reverse(), root = arc[0], prefix = s._navPath(s.position.x, s.position.z, ...root, { radius: 1, maxLength: 300 });
                    let surfacePath = null;
                    if (surfacePlan) {
                        const { findWalkPath } = await import('./src/spots/tour.js'), ground = s.spot.ground, it = s.spot.interactables.find(i => i.label === 'Walk to the end of the crescent pier'), supportCeiling = Math.max(s.position.y, it.y) + 1.2;
                        // A read-only planning adapter samples real reachable
                        // deck tops, instead of the bare lake bed. Physics and
                        // the source surfaces/colliders remain untouched.
                        const adapter = { heightAt: (x, z) => ground.flightHeightAt(x, z, supportCeiling), groundAt: (x, z, y) => ground.groundAt(x, z, y), waterY: ground.waterY };
                        const colliders = s._navColliders(s.position.x, s.position.z, it.x, it.z);
                        surfacePath = findWalkPath(adapter, colliders, s.position.x, s.position.z, it.x, it.z, { radius: 1.2, maxLength: 300 });
                        if (surfacePlan === 'corridor' && prefix) {
                            const { collide } = await import('./src/spots/walker.js');
                            const lengths = [0]; for (let i = 1; i < arc.length; i++) lengths.push(lengths.at(-1) + Math.hypot(arc[i][0] - arc[i - 1][0], arc[i][1] - arc[i - 1][1]));
                            const total = lengths.at(-1), point = distance => { let i = 1; while (i < lengths.length - 1 && lengths[i] < distance) i++; const q = Math.max(0, Math.min(1, (distance - lengths[i - 1]) / (lengths[i] - lengths[i - 1]))); return [arc[i - 1][0] + (arc[i][0] - arc[i - 1][0]) * q, arc[i - 1][1] + (arc[i][1] - arc[i - 1][1]) * q]; };
                            const height = (x, z) => { const y = ground.groundAt(x, z, supportCeiling); return Number.isFinite(y) && y < supportCeiling + .56 && y >= ground.waterY + .03 && !collide(colliders, x, z, .34, y + .3) ? y : NaN; };
                            const edge = (a, b) => { let y = height(...a); if (!Number.isFinite(y)) return false; const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .2); for (let i = 1; i <= n; i++) { const next = height(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n); if (!Number.isFinite(next) || Math.abs(next - y) > .55) return false; y = next; } return true; };
                            let previous = [{ p: root, cost: 0, path: [] }], rows = 0;
                            for (let distance = 0; distance <= total + .6; distance += .6) {
                                const at = Math.min(total, distance), p = point(at), a = point(Math.max(0, at - .3)), b = point(Math.min(total, at + .3)), dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1, next = [];
                                for (const offset of [-1.2, -.8, -.4, 0, .4, .8, 1.2]) {
                                    const q = [p[0] + dz / len * offset, p[1] - dx / len * offset]; if (!Number.isFinite(height(...q))) continue;
                                    let best = null;
                                    for (const prev of previous) if (edge(prev.p, q)) { const cost = prev.cost + Math.hypot(q[0] - prev.p[0], q[1] - prev.p[1]) + Math.abs(offset) * .01; if (!best || cost < best.cost) best = { p: q, cost, path: [...prev.path, q] }; }
                                    if (best) next.push(best);
                                }
                                rows++; previous = next; if (!previous.length || at === total) break;
                            }
                            surfacePath = previous.length ? [...prefix, ...previous.sort((a, b) => a.cost - b.cost)[0].path] : null;
                            window.pierCorridorDebug = { rows, remaining: previous.length, total, halfWidth: 1.2, clearanceRadius: .34, sampledSource: way.id };
                        }
                    }
                    return { source: way.id, arc, prefix, surfacePath, surfacePlan, corridor: window.pierCorridorDebug, arrival: { ...s.position }, people: s.spot.crowd.count, buildings: s.spot.data.buildings.length, colliders: s.spot.colliders.length, award: game.achievements.isUnlocked('lm-meyd-pier') };
                }, process.env.PIER_PLAN || false);
                assert.equal(r.plan.award, false); const path = r.plan.surfacePlan ? r.plan.surfacePath : r.plan.prefix && [...r.plan.prefix, ...r.plan.arc]; assert.ok(path, 'No planned physical approach to the pier terminal');
                await page.evaluate(path => { window.pierWalk = { path, i: 1, frames: 0, walked: 0, best: Infinity, noProgress: 0, maxStep: 0, maxRise: 0, previous: { ...game.spot.position }, trace: [] }; }, path);
                for (let batch = 0; batch < 300; batch++) {
                    r.walk = await page.evaluate(() => {
                        const s = game.spot, r = pierWalk;
                        for (let j = 0; j < 20 && r.i < r.path.length && r.noProgress < 100; j++) {
                            const [x, z] = r.path[r.i], dx = x - s.position.x, dz = z - s.position.z, d = Math.hypot(dx, dz);
                            if (d < .55) { r.i++; r.best = Infinity; r.noProgress = 0; continue; }
                            if (d < r.best - .03) { r.best = d; r.noProgress = 0; } else r.noProgress++;
                            s.ctl.auto = { fwd: 1, run: true, heading: Math.atan2(-dx, -dz) }; step(); r.frames++;
                            const p = { ...s.position }, delta = Math.hypot(p.x - r.previous.x, p.z - r.previous.z); r.walked += delta; r.maxStep = Math.max(r.maxStep, delta); r.maxRise = Math.max(r.maxRise, Math.abs(p.y - r.previous.y)); r.previous = p;
                            if (r.maxStep > .8 || r.maxRise > .8) { r.noProgress = 100; break; }
                        }
                        r.trace.push({ frames: r.frames, i: r.i, position: { ...s.position } });
                        return { reached: r.i === r.path.length, finished: r.i === r.path.length || r.noProgress >= 100, frames: r.frames, walked: r.walked, maxStep: r.maxStep, maxRise: r.maxRise, noProgress: r.noProgress, position: { ...s.position }, trace: r.trace, award: game.achievements.isUnlocked('lm-meyd-pier'), people: s.spot.crowd.count, buildings: s.spot.data.buildings.length, colliders: s.spot.colliders.length };
                    }); save(); if (r.walk.finished) break;
                }
                r.probe = await page.evaluate(async () => {
                    const s = game.spot, p = s.position, t = pierWalk.path[pierWalk.i]; if (!t) return null;
                    const { collide } = await import('./src/spots/walker.js'), dx = t[0] - p.x, dz = t[1] - p.z, len = Math.hypot(dx, dz), sample = (x, z) => { const hit = collide(s.spot.colliders, x, z, .3, p.y + .3); return { x, z, ground: s.spot.ground.groundAt(x, z, p.y), collider: hit && { px: hit.px, pz: hit.pz, hit: { ...hit.hit } }, bodies: s.spot.crowd.obstacles(x, z, 2) }; };
                    return { target: t, current: sample(p.x, p.z), ahead: sample(p.x + dx / len * .23, p.z + dz / len * .23), sides: [-1.6, -1.2, -.8, .8, 1.2, 1.6].map(offset => sample(p.x + dz / len * offset, p.z - dx / len * offset)) };
                }); save(); await page.evaluate(() => { game.spot.ctl.auto = null; game.spot.input.flush(); }); await capture('pier-public-end');
                assert.equal(r.walk.reached, true); assert.equal(r.walk.award, true);
                for (const k of ['people', 'buildings', 'colliders']) assert.equal(r.walk[k], r.plan[k]);
            });
            await test('stone-native-release-cancellation-and-three-flights', async r => {
                await page.evaluate(() => { game.spot.ctl.auto = null; game.spot.input.flush(); });
                r.setup = await setup('skip'); r.controls = await act();
                r.buttons = await page.locator('.sp-participation button').evaluateAll(es => es.map(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }))); assert.ok(r.buttons.every(b => b.width >= 44 && b.height >= 44));
                await page.evaluate(() => step(100)); assert.equal(await page.evaluate(() => activityEvents.filter(e => e.spot === 'bel-meydenbauer' && e.id === 'skip').length), 0);
                await tap('.sp-participation [data-action]'); await page.evaluate(() => step(5)); r.partial = await page.evaluate(() => game.spot.spot.ctx.extras.stoneSkipping.debug()); assert.equal(r.partial.phase, 'flight');
                await capture('stone-in-flight-cancelled'); await tap('.sp-participation [data-leave]'); assert.equal(await page.evaluate(() => game.spot.spot.ctx.extras.stoneSkipping.debug()), null);
                await act(); r.throws = [];
                for (let i = 0; i < 3; i++) { await page.evaluate(n => step(n), i * 3 + 1); await tap('.sp-participation [data-action]'); await page.evaluate(() => step(5)); const state = await page.evaluate(() => game.spot.spot.ctx.extras.stoneSkipping.debug()); assert.equal(state.phase, 'flight'); r.throws.push(state); if (i === 1) await capture('stone-second-flight'); await page.evaluate(() => step(40)); }
                r.complete = await page.evaluate(() => ({ active: game.spot.spot.ctx.extras.participation.active, debug: game.spot.spot.ctx.extras.stoneSkipping.debug(), events: activityEvents.filter(e => e.spot === 'bel-meydenbauer' && e.id === 'skip') }));
                assert.equal(r.complete.active, false); assert.equal(r.complete.debug, null); assert.equal(r.complete.events.length, 1);
            });
        }
        report.checked = true; save(); await context.close();
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
