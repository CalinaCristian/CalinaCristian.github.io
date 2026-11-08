// Use the installed Chromium for isolated QA without downloading another browser.
// The project's harness options, including muted audio and software GL, are preserved.
const { chromium } = require('playwright');
const launch = chromium.launch.bind(chromium);
chromium.launch = async options => {
    const browser = await launch({ ...options, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
    const context = browser.newContext.bind(browser);
    browser.newContext = async options => {
        const ctx = await context(options), newPage = ctx.newPage.bind(ctx);
        ctx.newPage = async () => {
            const page = await newPage(), goto = page.goto.bind(page);
            page.setDefaultTimeout(300000); page.setDefaultNavigationTimeout(180000);
            // Each capture runner waits for window.game/window.vqa after parsing the document.
            page.goto = (url, options = {}) => goto(url, { ...options, waitUntil: options.waitUntil === 'load' || !options.waitUntil ? 'domcontentloaded' : options.waitUntil });
            return page;
        };
        return ctx;
    };
    return browser;
};
