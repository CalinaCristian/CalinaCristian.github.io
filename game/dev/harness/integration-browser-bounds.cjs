// Playwright's default action timeout does not bound page.evaluate. Keep slow source builds
// possible while making a stuck browser an explicit incomplete failure in integration reports.
exports.boundEvaluations = (page, milliseconds = 420000) => {
    const evaluate = page.evaluate.bind(page);
    page.evaluate = (...args) => {
        let timer;
        const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Browser evaluation timed out after ${milliseconds / 1000} s`)), milliseconds); });
        return Promise.race([evaluate(...args), deadline]).finally(() => clearTimeout(timer));
    };
};

// Chromium's compositor capture has no document.fonts.ready wait and avoids a
// WebGL canvas.toDataURL readback. The actual rendered viewport and native UI
// stay intact; this does not request another game draw or change counters.
exports.captureViewport = async (page, file, milliseconds = 420000) => {
    const cdp = await page.context().newCDPSession(page);
    let timer;
    try {
        const result = await Promise.race([
            cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Compositor capture timed out after ${milliseconds / 1000} s`)), milliseconds); }),
        ]);
        require('node:fs').writeFileSync(file, Buffer.from(result.data, 'base64'));
    } finally { clearTimeout(timer); await cdp.detach().catch(() => {}); }
};
