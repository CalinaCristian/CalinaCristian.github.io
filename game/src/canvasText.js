// ============================================================================
//  Canvas text fitting: every canvas text in the game goes through fitText() so nothing can overflow its box.
//  fitText picks the largest font size (maxSize → minSize) and the fewest lines (≤ maxLines) that fit maxWidth
//  (and maxHeight when given); lines are balanced (not greedy). If even minSize × maxLines does not fit, words
//  are broken and the last line is ellipsized — the text is still guaranteed to stay inside maxWidth.
// ============================================================================

/** every fit that needed more than 2 lines or did not fit at all (inspect with `window.fitTextLog`) */
export const fitTextLog = [];
if (typeof window !== 'undefined') window.fitTextLog = fitTextLog;

const defFont = (s) => `${s}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

/** greedy wrap at width w; returns lines or null if a single word is wider than w */
function wrapAt(ctx, words, w) {
    const lines = []; let line = '';
    for (const word of words) {
        if (ctx.measureText(word).width > w) return null;
        const t = line ? line + ' ' + word : word;
        if (ctx.measureText(t).width <= w) line = t;
        else { lines.push(line); line = word; }
    }
    lines.push(line);
    return lines;
}
/** balanced wrap into at most n lines within maxWidth (null if impossible at the current font) */
function wrapBalanced(ctx, words, maxWidth, n) {
    const full = wrapAt(ctx, words, maxWidth);
    if (!full || full.length > n) return null;
    if (full.length <= 1) return full;
    // shrink the wrap width while the line count stays the same → evenly filled lines
    let lo = 0, hi = maxWidth;
    for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2, l = wrapAt(ctx, words, mid);
        if (l && l.length <= full.length) hi = mid; else lo = mid;
    }
    return wrapAt(ctx, words, hi) || full;
}
/** hard fallback: break long words by characters, cap at n lines, ellipsize the last */
function wrapForce(ctx, text, maxWidth, n) {
    const out = []; let line = '';
    for (const ch of text) {
        const t = line + ch;
        if (ctx.measureText(t).width <= maxWidth) { line = t; continue; }
        const sp = line.lastIndexOf(' ');
        if (sp > line.length * 0.5 && ch !== ' ') { out.push(line.slice(0, sp)); line = line.slice(sp + 1) + ch; }
        else { out.push(line.trimEnd()); line = ch === ' ' ? '' : ch; }
    }
    if (line) out.push(line);
    if (out.length > n) {
        const keep = out.slice(0, n); let last = keep[n - 1] + '…';
        while (last.length > 1 && ctx.measureText(last).width > maxWidth) last = last.slice(0, -2) + '…';
        keep[n - 1] = last; return keep;
    }
    return out;
}

/**
 * Fit `text` into maxWidth px. Options:
 *   maxSize, minSize  font size range in px (default 48 → 10)
 *   maxLines          default 1
 *   maxHeight         optional block height limit in px (lines × size × lineHeight)
 *   lineHeight        default 1.15
 *   font(size)        font string builder (default Helvetica/Arial)
 *   label             name used in fitTextLog
 * Returns { size, font, lines, lineHeight, fits }. Leaves ctx.font set to the chosen font.
 */
export function fitText(ctx, text, maxWidth, { maxSize = 48, minSize = 10, maxLines = 1, maxHeight = Infinity, lineHeight = 1.15, font = defFont, label = '' } = {}) {
    text = String(text ?? '').replace(/\s+/g, ' ').trim();
    const words = text.split(' ');
    let best = null;
    for (let n = 1; n <= maxLines; n++) {
        const cap = Math.min(maxSize, Math.floor(maxHeight / (n * lineHeight)));
        for (let s = cap; s >= minSize; s -= s > 40 ? 2 : 1) {
            ctx.font = font(s);
            const lines = wrapBalanced(ctx, words, maxWidth, n);
            if (lines) {
                // an extra line must buy a clearly bigger font
                if (!best || s >= best.size * 1.18) best = { size: s, font: font(s), lines, lineHeight, fits: true };
                break;
            }
        }
    }
    if (!best) {
        const s = Math.max(1, Math.min(minSize, Math.floor(maxHeight / (maxLines * lineHeight)) || minSize));
        ctx.font = font(s);
        best = { size: s, font: font(s), lines: wrapForce(ctx, text, maxWidth, maxLines), lineHeight, fits: false };
    }
    ctx.font = best.font;
    if (best.lines.length > 2 || !best.fits) {
        const e = { label, text, lines: best.lines.length, size: best.size, fits: best.fits };
        fitTextLog.push(e);
        if (typeof console !== 'undefined') console.info(`[fitText] ${best.fits ? best.lines.length + ' lines' : 'DID NOT FIT'} @${best.size}px ${label ? label + ': ' : ''}"${text.slice(0, 80)}"`);
    }
    return best;
}

/**
 * fitText + draw. (x, y) = anchor of the text block; the block is vertically centred on y (textBaseline 'middle'),
 * horizontal alignment follows ctx.textAlign. Returns the fitText result plus the block height.
 */
export function drawFitText(ctx, text, x, y, maxWidth, opts = {}) {
    const r = fitText(ctx, text, maxWidth, opts);
    const lh = r.size * r.lineHeight, n = r.lines.length;
    const base = ctx.textBaseline; ctx.textBaseline = 'middle';
    r.lines.forEach((l, i) => ctx.fillText(l, x, y + (i - (n - 1) / 2) * lh));
    ctx.textBaseline = base;
    r.height = n * lh;
    return r;
}
