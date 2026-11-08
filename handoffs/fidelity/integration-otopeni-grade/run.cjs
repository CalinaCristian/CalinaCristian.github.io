// Local source-preserving Otopeni grade and guide regression on source 59f953f.
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
let activeErrors = [], activeStage = 'boot';
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
        const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); page.setDefaultTimeout(180000);
        const errors = []; activeErrors = errors;
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/api.open-meteo.com/**', r => r.fulfill({ json: { current: { temperature_2m: 20, is_day: 1, precipitation: 0, rain: 0, snowfall: 0, weather_code: 0, cloud_cover: 10, wind_speed_10m: 4 } } }));
        await page.goto(base + '/game/index.html?weather=clear', {waitUntil:'domcontentloaded',timeout:60000});
        await page.waitForFunction(() => window.game);
        await page.addScriptTag({ url: base + '/game/dev/harness/visual/page/visual.js', type: 'module' });
        await page.waitForFunction(() => window.vqa);
        await page.evaluate(() => vqa.loadGroup('bucharest-otopeni', { quality: 'high', time: 'day', weather: 'clear', pr: .5 }));
        await page.addScriptTag({ url: base + '/game/dev/harness/page/index.js', type: 'module' });
        await page.waitForFunction(() => window.harness);
        for (const name of (process.argv.find(s=>s.startsWith('--probes='))?.split('=')[1].split(',') || ['inspect', 'overlaps', 'drive', 'geometry', 'guide'])) {
            activeStage = name;
            const value = await page.evaluate(fs.readFileSync(path.join(here, 'probes', name + '.js'), 'utf8'));
            fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(value, null, 2));
            console.log(name + ' saved');
        }
        if (captures) {
            const poses = [
                {id:'trench-bend',x:-99.3,z:-420.1,road:88,heading:-2.0,warm:120,traffic:true},
                {id:'tunnel-approach',x:-94,z:-493,road:160,heading:-2.0,warm:120,traffic:true},
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
        fs.writeFileSync(path.join(out, 'source.json'), JSON.stringify({ root, world: hash('game/src/world.js'), data: hash('game/data/bucharest-otopeni.json'), errors }, null, 2));
    } finally { await browser.close(); server.close(); }
})().catch(e => { fs.writeFileSync(path.join(out, 'incomplete.json'), JSON.stringify({ complete:false, stage:activeStage, error:String(e), errors:activeErrors, root },null,2)); console.error(e); server.close(); process.exitCode = 1; });
