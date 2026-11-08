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
