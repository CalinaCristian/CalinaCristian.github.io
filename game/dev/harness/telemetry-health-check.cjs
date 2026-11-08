#!/usr/bin/env node
// Real game transitions; production origin is fulfilled locally and the PostHog SDK is a capturing stub.
// No test events or personal credentials are sent to PostHog.
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const arg = (k, fallback) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) || fallback;
const root = path.resolve(arg('root', path.join(__dirname, '../../..'))), out = path.resolve(arg('out', '/tmp/telemetry-health-check'));
fs.mkdirSync(out, { recursive: true });
const sdk = `(() => {
    const stub = window.posthog, options = stub._i[0][1], common = {};
    for (const row of stub) if (row[0] === 'register') Object.assign(common, row[1]);
    window.__healthEvents = []; window.__sdkReady = true;
    window.posthog = {
        capture: (event, props) => window.__healthEvents.push({ event, props: { ...common, ...props } }),
        captureException: (error, props) => window.__healthEvents.push({ event: '$exception', props: { ...common, ...props, message: error?.message || '' } }),
        register: props => Object.assign(common, props), get_distinct_id: () => 'test-anonymous'
    }; options.loaded();
})();`;
(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const report = { root, checks: [], errors: [], expectedErrors: [], consoleErrors: [], expectedConsoleErrors: [], network: { sdkRequests: 0, externalRequests: [] } };
    const check = (name, ok, details) => { report.checks.push({ name, ok: !!ok, details }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); };
    const contexts = [];
    let failureContext = null, injectedDestinationFailure = false;
    const unexpectedConsole = () => { const expected = new Set(report.expectedConsoleErrors.map(e => e.index)); return report.consoleErrors.filter(e => !expected.has(e.index)); };
    async function fixture({ dnt = false, gpc = false, blockedStorage = false, pending = false, holdSdk = false } = {}) {
        const context = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 }); contexts.push(context);
        let release; const gate = new Promise(resolve => release = resolve); if (!holdSdk) release();
        const network = { sdk: 0, external: [] };
        await context.addInitScript(({ dnt, gpc, blockedStorage, pending }) => {
            if (dnt) Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });
            if (gpc) Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
            if (blockedStorage) Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Blocked for fixture', 'SecurityError'); } });
            if (pending) sessionStorage.setItem('dmcv.health.pending.v2', JSON.stringify({ v: 2, updated: Date.now() - 500, attempt: 'interrupted-fixture', destination: 'grozavesti', stage: 'built', loading: false, awaiting_frame: true, ended: false }));
        }, { dnt, gpc, blockedStorage, pending });
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.hostname === 'cristiancalina.com') {
                let file = path.join(root, decodeURIComponent(url.pathname)); if (file.endsWith('/')) file += 'index.html';
                try { await route.fulfill({ body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.webm': 'video/webm', '.ico': 'image/x-icon' }[path.extname(file)] || 'application/octet-stream' }); }
                catch { await route.fulfill({ status: 404, body: 'missing' }); }
            } else if (url.hostname === 'eu-assets.i.posthog.com') { network.sdk++; await gate; await route.fulfill({ body: sdk, contentType: 'text/javascript' }); }
            else if (url.hostname === 'api.open-meteo.com') await route.fulfill({ json: { error: true } });
            else { network.external.push(url.origin); await route.abort(); }
        });
        const page = await context.newPage(); page.setDefaultTimeout(300000); require('./integration-browser-bounds.cjs').boundEvaluations(page);
        page.on('console', message => {
            if (message.type() === 'error') {
                const row = { index: report.consoleErrors.length, fixture: contexts.indexOf(context) + 1, text: message.text(), location: message.location() };
                report.consoleErrors.push(row);
                const intended503 = injectedDestinationFailure && context === failureContext && (
                    (row.text.startsWith('Failed to load resource:') && /status of 503/.test(row.text) && row.location.url === 'https://cristiancalina.com/game/data/bucharest-grozavesti.json') ||
                    (row.text.startsWith('[world] district load failed') && /JSON|SyntaxError/.test(row.text) && /intentional|Unexpected token.*i/i.test(row.text)));
                if (intended503) report.expectedConsoleErrors.push({ ...row, reason: 'Explicit HTTP503/non-JSON Grozavesti destination fixture' });
            }
            for (const argument of message.args()) argument.dispose().catch(() => {});
        });
        page.on('pageerror', error => (/diagnostic pre-SDK fixture/.test(error.message) ? report.expectedErrors : report.errors).push(error.message));
        await page.goto('https://cristiancalina.com/game/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => window.game?.health);
        if (!dnt && !gpc && !holdSdk) await page.waitForFunction(() => window.__sdkReady);
        return { page, context, network, release };
    }
    try {
        const main = await fixture(), page = main.page;
        await page.evaluate(async () => { game.quality = 'low'; game.r3d.setQuality('low'); await game.startFreeRoam('floreasca', { tod: 'noon', weather: 'clear', season: 'summer' }); });
        await page.waitForFunction(() => __healthEvents.some(e => e.event === 'scene_first_frame'));
        let events = await page.evaluate(() => __healthEvents);
        const begin = events.find(e => e.event === 'load_started'), built = events.find(e => e.event === 'load_completed'), first = events.find(e => e.event === 'scene_first_frame');
        check('actual load has paired attempt/build/first-frame and resource counts', begin && built && first && begin.props.attempt_id === built.props.attempt_id && first.props.attempt_id === begin.props.attempt_id && built.props.build_ms > 0 && first.props.textures > 0 && first.props.first_frame_ms >= built.props.build_ms, { begin, built, first });
        check('release/schema context is attached before lazy capture', begin?.props.telemetry_schema === 2 && /^game-[a-f0-9]{16}$/.test(begin.props.release_id) && /^[a-f0-9]{40}$/.test(begin.props.source_commit), begin?.props);
        await page.keyboard.press('l');
        await page.waitForFunction(() => __healthEvents.some(e => e.event === 'ui_action_frame' && e.props.action === 'headlights'));
        check('native headlight key records next-frame latency and program delta', await page.evaluate(() => __healthEvents.some(e => e.event === 'ui_action_frame' && e.props.source === 'keyboard' && e.props.response_ms >= 0 && Number.isFinite(e.props.added_programs))));
        await page.waitForFunction(() => game.health.frames.length >= 12);
        await page.evaluate(() => { game.health.flush(); game.togglePause(true); });
        await page.waitForFunction(() => game.health.frames.length >= 12);
        await page.evaluate(() => { game.health.flush(); game.togglePause(false); });
        await page.waitForFunction(() => game.health.frames.length >= 12);
        await page.evaluate(() => game.health.flush());
        events = await page.evaluate(() => __healthEvents);
        check('performance summaries isolate pause and driving with sampled frame tails', ['drive', 'pause'].every(mode => events.some(e => e.event === 'perf_summary' && e.props.game_mode === mode && e.props.frame_p95_ms > 0 && e.props.frames_observed >= e.props.samples)), events.filter(e => e.event === 'perf_summary'));
        await page.evaluate(async () => { game.fuel = 0; await game.save.saveSession('diagnostic-fixture'); });
        failureContext = main.context; injectedDestinationFailure = true;
        await page.route('**/game/data/bucharest-grozavesti.json', route => route.fulfill({ status: 503, body: 'intentional diagnostic fixture' }));
        await page.evaluate(() => game.startFreeRoam('grozavesti'));
        events = await page.evaluate(() => __healthEvents);
        const failure = events.find(e => e.event === 'load_failed');
        check('actual failed replacement is correlated and preserves stable Continue', failure?.props.destination === 'grozavesti' && events.some(e => e.event === 'load_started' && e.props.attempt_id === failure.props.attempt_id) && await page.evaluate(() => game.state === 'menu' && game.save.hasSession()), failure);
        await page.locator('#continue').click();
        await page.waitForFunction(() => game.state === 'drive' && game.district === 'floreasca' && __healthEvents.some(e => e.event === 'continue_result'));
        check('real Continue reports recovery and keeps empty fuel', await page.evaluate(() => game.fuel === 0 && __healthEvents.some(e => e.event === 'continue_result' && e.props.success && e.props.after_load_failure)));
        injectedDestinationFailure = false;
        const resumed = await fixture({ pending: true });
        check('startup identifies a pending first frame without claiming an OS crash', await resumed.page.evaluate(() => __healthEvents.some(e => e.event === 'load_interrupted' && e.props.attempt_id === 'interrupted-fixture' && e.props.prior_stage === 'built' && e.props.confirmed_crash === false)));
        const denied = await fixture({ blockedStorage: true });
        check('blocked browser storage leaves capture/game setup working', await denied.page.evaluate(() => __healthEvents.some(e => e.event === 'diagnostics_ready' && e.props.storage_available === false)));
        for (const option of [{ dnt: true }, { gpc: true }]) {
            const privacy = await fixture(option);
            const empty = await privacy.page.evaluate(() => { game.health.write({ stage: 'forbidden' }); game.health.send('privacy-fixture', {}); return !window.cvTelemetry.enabled && sessionStorage.getItem('dmcv.health.pending.v2') === null; });
            check(`${option.dnt ? 'DNT' : 'GPC'} prevents SDK loading and breadcrumb storage`, empty && privacy.network.sdk === 0);
        }
        const early = await fixture({ holdSdk: true });
        await early.page.evaluate(() => setTimeout(() => { window.__earlyThrown = true; throw new Error('diagnostic pre-SDK fixture'); }, 0));
        await early.page.waitForFunction(() => window.__earlyThrown); early.release();
        await early.page.waitForFunction(() => window.__healthEvents?.some(e => e.event === '$exception'));
        check('early exception survives lazy SDK initialization', await early.page.evaluate(() => __healthEvents.some(e => e.event === '$exception' && e.props.message === 'diagnostic pre-SDK fixture' && e.props.phase === 'before_sdk' && e.props.telemetry_schema === 2)));
        report.events = await page.evaluate(() => __healthEvents);
        report.network = main.network;
        check('fixture sent no events to an external service', contexts.length === 6 && main.network.external.length === 0);
        report.unexpectedConsoleErrors = unexpectedConsole();
        check('all browser console errors belong to the explicit failed-destination fixture', report.unexpectedConsoleErrors.length === 0, { expected: report.expectedConsoleErrors, unexpected: report.unexpectedConsoleErrors });
        report.complete = true;
    } catch (error) {
        report.fatal = error.stack || String(error); report.complete = false; throw error;
    } finally {
        report.complete ??= false;
        for (const context of contexts) await context.close().catch(() => {}); await browser.close();
        report.unexpectedConsoleErrors = unexpectedConsole();
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    }
    if (report.errors.length || report.unexpectedConsoleErrors.length || report.checks.some(c => !c.ok)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
