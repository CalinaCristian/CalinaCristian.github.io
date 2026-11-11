#!/usr/bin/env node
// Real-life check: render the game at each reference viewpoint (viewpoints.json) and write a review sheet that places each
// game view next to a link to the street-level panorama at the same place, heading and pitch.
//
//   node game/dev/reality/capture.cjs --district=grozavesti [--only=id,id] [--out=<dir>] [--cdp=http://127.0.0.1:9333]
//
// The panorama is only linked, never downloaded or stored: it is a visual reference for a person (or Claude) reviewing the
// sheet, and its imagery must not be copied into the game or the repository. Findings go, as text, into
// handoffs/fidelity/reality-check/REVIEW-<district>.md. Default output is a temp folder (not committed).
// --cdp attaches to a running Chromium (real GPU) instead of launching one; otherwise Chromium is launched with ANGLE/D3D11.
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { chromium } = require('playwright');
const opt = (k, d) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const root = path.resolve(__dirname, '../../..'), district = opt('district', 'grozavesti');
const out = path.resolve(opt('out', path.join(os.tmpdir(), `reality-${district}`)));
const only = opt('only') ? opt('only').split(',') : null;
const views = JSON.parse(fs.readFileSync(path.join(__dirname, 'viewpoints.json'), 'utf8')).viewpoints.filter(v => v.district === district && (!only || only.includes(v.id)));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bin': 'application/octet-stream', '.gz': 'application/gzip', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };
const panoUrl = v => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${v.lat},${v.lon}&heading=${v.heading}&pitch=${v.pitch || 0}`;
if (!views.length) { console.error(`no viewpoints for district ${district}`); process.exit(2); }
fs.mkdirSync(out, { recursive: true });

(async () => {
    const server = http.createServer((req, res) => {
        let f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(root)) { res.writeHead(403); res.end(); return; }
        fs.stat(f, (e, st) => { if (!e && st.isDirectory()) f = path.join(f, 'index.html');
            fs.readFile(f, (err, buf) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(buf); }); });
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port, cdp = opt('cdp');
    const browser = cdp ? await chromium.connectOverCDP(cdp) : await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
    const context = cdp ? browser.contexts()[0] : await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage(); if (cdp) await page.setViewportSize({ width: 1280, height: 720 });
    page.setDefaultTimeout(600000);
    await page.goto(`http://127.0.0.1:${port}/game/?inspect=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.game, null, { timeout: 120000 });
    await page.evaluate(async (district) => {
        const g = window.game, { CHAPTERS } = await import('/game/src/cities.js');
        const ch = CHAPTERS.find(c => c.district === district); if (!ch) throw Error('unknown district ' + district);
        const df = g.drawFrame.bind(g); window.__realityDraw = df;
        g.loop = function loop() { requestAnimationFrame(g.loop); g.frameClock?.getDelta?.(); }; // no simulation between shots
        g.drawFrame = () => {};
        g.started = true; document.querySelector('#menu')?.classList.remove('show');
        g.clock.override = 'day'; g.weatherOverride = 'clear';
        g.state = 'loading'; await g.loadCity(ch.city, { district, start: ch.start }); g.state = 'drive';
    }, district);
    const rows = [];
    for (const v of views) {
        const shot = await page.evaluate((v) => {
            const g = window.game, w = g.world, cam = g.camera, q = g.city.proj(v.lat, v.lon), x = q.x ?? q[0], z = q.z ?? q[1];
            const hs = [2, 6, 9, 12.5, 16, 22].map(y => w.roadHeight(x, z, { y })).filter(Number.isFinite);
            const base = hs.length ? (v.surface === 'top' ? Math.max(...hs) : Math.min(...hs)) : 0;
            const br = v.heading * Math.PI / 180, pr = (v.pitch || 0) * Math.PI / 180, eye = [x, base + (v.eyeM ?? 2.5), z];
            g.scene.add(cam); cam.position.set(...eye); cam.up.set(0, 1, 0);
            cam.lookAt(eye[0] + Math.sin(br) * Math.cos(pr) * 50, eye[1] + Math.sin(pr) * 50, eye[2] - Math.cos(br) * Math.cos(pr) * 50);
            cam.fov = 70; cam.aspect = 16 / 9; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
            if (g.player?.rig) g.player.rig.visible = false;
            window.__realityDraw({ mirror: false }); window.__realityDraw({ mirror: false });
            return { x: +x.toFixed(1), z: +z.toFixed(1), y: +eye[1].toFixed(1), img: g.renderer.domElement.toDataURL('image/jpeg', 0.88) };
        }, v);
        fs.writeFileSync(path.join(out, `${v.id}.jpg`), Buffer.from(shot.img.split(',')[1], 'base64'));
        rows.push({ ...v, game: { x: shot.x, y: shot.y, z: shot.z } });
        console.log(`${v.id}: game (${shot.x}, ${shot.y}, ${shot.z})`);
    }
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const html = `<!doctype html><meta charset="utf-8"><title>Reality check · ${esc(district)}</title>
<style>body{font:14px system-ui;margin:16px;background:#f4f2ee;color:#222}figure{margin:0 0 28px;background:#fff;padding:12px;border-radius:8px}img{width:100%;max-width:960px;display:block}h2{font-size:16px;margin:0 0 6px}p{margin:4px 0}</style>
<h1>Reality check · ${esc(district)}</h1><p>Game views at each reference viewpoint. Open the panorama link beside each one and compare by eye; write findings in handoffs/fidelity/reality-check/REVIEW-${esc(district)}.md. Do not save or copy the panorama imagery.</p>
${rows.map(v => `<figure><h2>${esc(v.id)} · ${esc(v.name)}</h2><p>${v.lat}, ${v.lon} · heading ${v.heading}° · pitch ${v.pitch || 0}° · game (${v.game.x}, ${v.game.y}, ${v.game.z}) · ${esc(v.source)}</p><p><a href="${panoUrl(v)}" target="_blank" rel="noopener">Open the street-level panorama</a></p><img src="${esc(v.id)}.jpg" alt="game view"></figure>`).join('\n')}`;
    fs.writeFileSync(path.join(out, 'review.html'), html);
    console.log(`review sheet: ${path.join(out, 'review.html')}`);
    await page.close(); if (!cdp) await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
