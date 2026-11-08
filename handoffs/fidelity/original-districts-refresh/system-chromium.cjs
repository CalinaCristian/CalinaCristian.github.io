// Use the installed Chromium for isolated QA without downloading another browser.
// The project's harness options, including muted audio and software GL, are preserved.
const { chromium } = require('playwright');
const launch = chromium.launch.bind(chromium);
chromium.launch = options => launch({ ...options, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
