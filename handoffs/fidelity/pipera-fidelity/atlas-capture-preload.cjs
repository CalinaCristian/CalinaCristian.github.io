// Capture-only watchdog: installed Chromium, bounded browser operations and
// compositor screenshots. Does not alter served game source or request a draw.
const fs = require('node:fs');
const { chromium } = require('playwright');
const launch = chromium.launch.bind(chromium);
function bounded(promise, label, milliseconds = 420000) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds / 1000}s`)), milliseconds);
    })]).finally(() => clearTimeout(timer));
}
function attach(page) {
    page.setDefaultTimeout(300000);
    const evaluate = page.evaluate.bind(page), goto = page.goto.bind(page), wait = page.waitForFunction.bind(page);
    page.evaluate = (...args) => bounded(evaluate(...args), 'Browser evaluation');
    page.goto = (url, opts = {}) => goto(url, { ...opts, waitUntil: 'domcontentloaded', timeout: 300000 });
    page.waitForFunction = (fn, arg, opts = {}) => wait(fn, arg, { ...opts, timeout: Math.max(300000, opts.timeout || 0) });
    page.screenshot = async (opts = {}) => {
        const session = await page.context().newCDPSession(page);
        try {
            const result = await bounded(session.send('Page.captureScreenshot', {
                format: opts.type || 'png', ...(opts.quality ? { quality: opts.quality } : {}),
                fromSurface: true, captureBeyondViewport: false,
            }), 'Compositor screenshot');
            const bytes = Buffer.from(result.data, 'base64');
            if (opts.path) fs.writeFileSync(opts.path, bytes);
            return bytes;
        } finally { await session.detach().catch(() => {}); }
    };
    return page;
}
chromium.launch = async (opts = {}) => {
    const browser = await launch({ ...opts, executablePath: opts.executablePath || '/usr/bin/chromium' });
    const newContext = browser.newContext.bind(browser), newPage = browser.newPage.bind(browser);
    browser.newContext = async (...args) => {
        const context = await newContext(...args), create = context.newPage.bind(context);
        context.newPage = async (...pageArgs) => attach(await create(...pageArgs));
        return context;
    };
    browser.newPage = async (...args) => attach(await newPage(...args));
    return browser;
};
