// External capture-only preload: explicit installed Chromium and bounded cold SwiftShader boot waits.
// No served game source, camera, geometry, frame timing or rendering options are changed.
const { chromium } = require('playwright');
const launch = chromium.launch.bind(chromium);
function pageWatchdog(page) {
    if (page._originalDistrictWatchdog) return page;
    page._originalDistrictWatchdog = true;
    page.setDefaultTimeout(300000);
    const goto = page.goto.bind(page), wait = page.waitForFunction.bind(page);
    page.goto = (url, options = {}) => goto(url, { ...options, waitUntil: 'domcontentloaded', timeout: 300000 });
    page.waitForFunction = (fn, arg, options = {}) => wait(fn, arg, { ...options, timeout: Math.max(300000, options.timeout || 0) });
    return page;
}
chromium.launch = async (options = {}) => {
    const browser = await launch({ ...options, executablePath: options.executablePath || '/usr/bin/chromium' });
    const context = browser.newContext.bind(browser), page = browser.newPage.bind(browser);
    browser.newContext = async (...args) => {
        const ctx = await context(...args), create = ctx.newPage.bind(ctx);
        ctx.newPage = async (...args) => pageWatchdog(await create(...args));
        return ctx;
    };
    browser.newPage = async (...args) => pageWatchdog(await page(...args));
    return browser;
};
