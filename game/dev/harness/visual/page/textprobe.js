// ============================================================================
//  Visual QA — canvas text probe. Injected with page.addInitScript BEFORE the
//  game loads (classic script, no imports). Records every fillText/strokeText
//  whose drawn box leaves the canvas, is squeezed hard by maxWidth, or runs past
//  the background panel it was drawn on (the last filled rectangle that contains
//  the text anchor) — i.e. text that ends up cut on a sign / screen / HUD canvas.
//  Results: window.__vqaText = { hits: Map(key → record), n }.
// ============================================================================
(() => {
    if (window.__vqaText) return;
    const S = window.__vqaText = { hits: new Map(), n: 0, panels: new WeakMap() };
    const P = CanvasRenderingContext2D.prototype;
    const fillRect = P.fillRect, roundRect = P.roundRect, fill = P.fill, rect = P.rect, beginPath = P.beginPath;
    const panelsOf = (ctx) => { let a = S.panels.get(ctx); if (!a) S.panels.set(ctx, a = []); return a; };
    // remember filled rectangles in device pixels (transform: translation + scale only, which covers the game's canvases)
    const pushPanel = (ctx, x, y, w, h) => {
        try {
            const m = ctx.getTransform(); if (Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6) return;
            let x0 = m.a * x + m.e, y0 = m.d * y + m.f, x1 = m.a * (x + w) + m.e, y1 = m.d * (y + h) + m.f;
            if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0];
            if (x1 - x0 < 24 || y1 - y0 < 10) return; // thin strips / dots are not panels
            const a = panelsOf(ctx); a.push([x0, y0, x1, y1]); if (a.length > 24) a.shift();
        } catch { /* ignore */ }
    };
    P.fillRect = function (x, y, w, h) { pushPanel(this, x, y, w, h); return fillRect.apply(this, arguments); };
    P.beginPath = function () { this.__vqaRR = null; return beginPath.apply(this, arguments); };
    if (roundRect) P.roundRect = function (x, y, w, h) { this.__vqaRR = [x, y, w, h]; return roundRect.apply(this, arguments); };
    P.rect = function (x, y, w, h) { this.__vqaRR = [x, y, w, h]; return rect.apply(this, arguments); };
    P.fill = function () { const r = this.__vqaRR; if (r) pushPanel(this, r[0], r[1], r[2], r[3]); return fill.apply(this, arguments); };
    const src = () => {
        const st = (new Error().stack || '').split('\n').slice(2);
        const l = st.find(s => /\/game\/src\//.test(s)) || st.find(s => !/textprobe/.test(s)) || '';
        const m = l.match(/(game\/src\/[\w.-]+:\d+)/) || l.match(/([\w.-]+\.js:\d+)/);
        return m ? m[1] : l.trim().slice(0, 80);
    };
    const check = (ctx, text, x, y, maxWidth, kind) => {
        try {
            text = String(text); if (!text.trim() || text.charCodeAt(0) === 0) return;
            S.n++;
            const cv = ctx.canvas, W = cv.width, H = cv.height;
            const mt = ctx.measureText(text);
            const natural = mt.width;
            const k = maxWidth !== undefined && maxWidth > 0 && natural > maxWidth ? maxWidth / natural : 1;
            const m = ctx.getTransform();
            if (Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6) return; // rotated text (gauge dials): skip
            const L = (x - mt.actualBoundingBoxLeft * k), R = (x + mt.actualBoundingBoxRight * k);
            const T = (y - mt.actualBoundingBoxAscent), B = (y + mt.actualBoundingBoxDescent);
            const dx0 = m.a * L + m.e, dx1 = m.a * R + m.e, dy0 = m.d * T + m.f, dy1 = m.d * B + m.f;
            const ax = m.a * x + m.e, ay = m.d * y + m.f;
            const problems = [];
            const tol = 1.5;
            if (dx0 < -tol || dx1 > W + tol) problems.push(`runs ${Math.round(Math.max(-dx0, dx1 - W))} px past the ${dx0 < -tol ? 'left' : 'right'} edge of the ${W}×${H} canvas`);
            if (dy0 < -tol || dy1 > H + tol) problems.push(`runs ${Math.round(Math.max(-dy0, dy1 - H))} px past the ${dy0 < -tol ? 'top' : 'bottom'} edge of the ${W}×${H} canvas`);
            if (k < 0.72) problems.push(`squeezed to ${Math.round(k * 100)} % width by maxWidth ${Math.round(maxWidth)} (natural ${Math.round(natural)} px)`);
            // background panel: most recent filled rect containing the anchor, smaller than the canvas
            const panels = S.panels.get(ctx) || [];
            for (let i = panels.length - 1; i >= 0; i--) {
                const [p0, q0, p1, q1] = panels[i];
                if (ax < p0 || ax > p1 || ay < q0 || ay > q1) continue;
                if (p0 <= 0.5 && q0 <= 0.5 && p1 >= W - 0.5 && q1 >= H - 0.5) break; // full-canvas background: covered by the canvas test
                const over = Math.max(p0 - dx0, dx1 - p1, q0 - dy0, dy1 - q1);
                if (over > 3) problems.push(`overflows its ${Math.round(p1 - p0)}×${Math.round(q1 - q0)} background panel by ${Math.round(over)} px`);
                break;
            }
            if (!problems.length) return;
            const key = text.slice(0, 60) + '|' + W + 'x' + H + '|' + problems[0].replace(/\d+/g, '#');
            const old = S.hits.get(key);
            if (old) { old.count++; return; }
            S.hits.set(key, { text: text.slice(0, 120), kind, font: ctx.font, canvas: [W, H], canvasId: cv.id || null, onScreen: !!cv.isConnected, box: [Math.round(dx0), Math.round(dy0), Math.round(dx1), Math.round(dy1)], maxWidth: maxWidth ?? null, problems, src: src(), count: 1 });
        } catch { /* never break the game */ }
    };
    const ft = P.fillText, stt = P.strokeText;
    P.fillText = function (text, x, y, maxWidth) { check(this, text, x, y, maxWidth, 'fill'); return ft.apply(this, arguments); };
    P.strokeText = function (text, x, y, maxWidth) { check(this, text, x, y, maxWidth, 'stroke'); return stt.apply(this, arguments); };
})();
