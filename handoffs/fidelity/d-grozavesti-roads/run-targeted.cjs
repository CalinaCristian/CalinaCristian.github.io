// Local browser regression for the frozen 10d9b98 -> 57986a6 road change.
// Source road indices in the probes belong to that source snapshot; no production test hooks are installed.
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3]);
const captures = process.argv.includes('--captures');
const here = __dirname;
fs.mkdirSync(out, { recursive: true });
const hash = name => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
const mime = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css' };
const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file.endsWith('/') ? file + 'index.html' : file, (err, buf) => {
        res.writeHead(err ? 404 : 200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(err ? 'missing' : buf);
    });
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
    const browser = await chromium.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/api.open-meteo.com/**', r => r.fulfill({ json: { current: { temperature_2m: 20, is_day: 1, precipitation: 0, rain: 0, snowfall: 0, weather_code: 0, cloud_cover: 10, wind_speed_10m: 4 } } }));
        await page.goto(base + '/game/index.html?weather=clear');
        await page.waitForFunction(() => window.game);
        await page.addScriptTag({ url: base + '/game/dev/harness/visual/page/visual.js', type: 'module' });
        await page.waitForFunction(() => window.vqa);
        await page.evaluate(() => vqa.loadGroup('bucharest-grozavesti', { quality: 'high', time: 'day', weather: 'clear', pr: .5 }));
        await page.addScriptTag({ url: base + '/game/dev/harness/page/index.js', type: 'module' });
        await page.waitForFunction(() => window.harness);
        for (const name of ['drive', 'inspect', 'overlaps', 'walls', 'geometry']) {
            const value = await page.evaluate(fs.readFileSync(path.join(here, 'probes', name + '.js'), 'utf8'));
            fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(value, null, 2));
            console.log(name + ' saved');
        }
        if (captures) {
            const poses = [
                { id: 'under-approach', x: 197, z: -420, road: 56, heading: -.28, warm: 900 },
                { id: 'under-target54', x: 196.8, z: -464.7, road: 56, heading: -.35, warm: 120 },
                { id: 'ramp-target54', x: 194, z: -470, road: 98, heading: -.34, warm: 120 },
                { id: 'side-target53', x: 218, z: -450, road: 56, heading: 1.64, warm: 120 },
                { id: 'north-legal', x: 1005, z: -1215, road: 110, heading: 2.18, warm: 120 },
            ];
            const results = [];
            for (const spec of poses) {
                await page.evaluate(s => { window.roadPoseSpec = s; }, spec);
                const row = await page.evaluate(fs.readFileSync(path.join(here, 'probes/pose.js'), 'utf8'));
                fs.writeFileSync(path.join(out, spec.id + '.png'), Buffer.from(row.framePng.split(',')[1], 'base64'));
                delete row.framePng; results.push(row);
            }
            fs.writeFileSync(path.join(out, 'poses.json'), JSON.stringify(results, null, 2));
        }
        fs.writeFileSync(path.join(out, 'source.json'), JSON.stringify({ root, world: hash('game/src/world.js'), data: hash('game/data/bucharest-grozavesti.json'), errors }, null, 2));
    } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
