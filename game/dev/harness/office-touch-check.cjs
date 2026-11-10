#!/usr/bin/env node
// Real office dialogue and native touch hit targets, including a previously closed Achievements panel.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const option = (key, fallback) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
const root = path.resolve(option('root', path.join(__dirname, '../../..'))), out = path.resolve(option('out', '/tmp/office-touch-check'));
fs.mkdirSync(out, { recursive: true });
(async () => {
    const server = http.createServer((req, res) => {
        let file = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (file.endsWith('/')) file += 'index.html';
        fs.readFile(file, (error, body) => { res.writeHead(error ? 404 : 200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream' }); res.end(error ? 'missing' : body); });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH,headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const report = { root, viewports: [], errors: [] };
    try {
        for (const [width, height] of [[390, 844], [844, 390], [440, 756], [956, 352]]) {
            const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
            await context.route(/api\.open-meteo\.com/, r => r.fulfill({ json: { error: true } }));
            const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
            await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
            await page.goto(`http://127.0.0.1:${server.address().port}/game/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForFunction(() => window.game?.achievements, null, { polling:100,timeout: 90000 });
            // A genuine menu touch is the positive control; leave its rendered panel in the DOM after closing.
            await page.locator('#achv-menu').tap();
            await page.waitForFunction(() => game.achievements.isOpen,null,{polling:100});
            await page.locator('#achv-panel .achv-x').tap();
            const result = { width, height, offices: [] };
            const ids = await page.evaluate(async () => (await import('./src/data.js')).STOPS.map(s => s.id));
            for (const id of ids) {
                await page.evaluate(async id => {
                    const { Office } = await import('./src/office.js'), { STOPS } = await import('./src/data.js');
                    const g = game; g.office?.dispose(); g.hud.closePanel(); g.achievements.close();
                    document.querySelector('#menu').classList.remove('show'); document.body.classList.add('playing'); document.body.dataset.mode = 'office';
                    g.state = 'office'; g.office = new Office(g.renderer, g.camera, STOPS.find(s => s.id === id), g.hud, g.input, g.audio); g.office.talk();
                }, id);
                await page.waitForFunction(() => game.hud.panelOpen && +getComputedStyle(document.querySelector('#panel')).opacity > .99, null, { polling: 50, timeout: 10000 });
                const office = { id, taps: 0, blocked: [], completed: false, closed: false };
                for (let step = 0; step < 16; step++) {
                    const next = await page.evaluate(() => {
                        const buttons = [...document.querySelectorAll('#panel .dlg-opts button')], button = buttons.find(b => !b.classList.contains('bye'));
                        if (!button || !game.office.talking) return null;
                        button.scrollIntoView({ block: 'nearest' });
                        const r = button.getBoundingClientRect(), points = [];
                        for (const fx of [.1, .5, .9]) for (const fy of [.25, .5, .75]) {
                            const x = r.x + r.width * fx, y = r.y + r.height * fy, hit = document.elementFromPoint(x, y);
                            points.push({ x, y, ok: button.contains(hit), hit: hit?.closest('[id]')?.id || hit?.tagName });
                        }
                        return { point: points.find(p => !p.ok) || points[4], blocked: points.filter(p => !p.ok), option: button.dataset.opt };
                    });
                    if (!next) break;
                    office.blocked.push(...next.blocked); await page.touchscreen.tap(next.point.x, next.point.y); office.taps++;
                    if (await page.evaluate(() => game.achievements.isOpen,null,{polling:100})) { office.openedAchievements = true; break; }
                }
                office.completed = await page.evaluate(() => game.office.conversationComplete && game.office.read.size === game.office.stations.length);
                if (result.offices.length === 0 || office.openedAchievements) await page.screenshot({ path: path.join(out, `${width}x${height}-${id}.png`) });
                if (!office.openedAchievements) {
                    office.closed = await page.evaluate(() => !game.hud.panelOpen && !game.office.talking && !game.achievements.isOpen);
                }
                result.offices.push(office);
            }
            report.viewports.push(result); await context.close();
        }
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    const offices = report.viewports.flatMap(v => v.offices), failed = offices.filter(o => o.blocked.length || o.openedAchievements || !o.completed || !o.closed);
    console.log(JSON.stringify({ offices: offices.length, taps: offices.reduce((n, o) => n + o.taps, 0), failed, errors: report.errors, out }));
    if (failed.length || report.errors.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
