// The publisher keeps the footage and player. No copied broadcast/video files.
import { onActivityCancel } from './participation.js';

const HAGI_BROADCAST = Object.freeze({
    id: 'rx8GxxrkJEc',
    title: 'Hagi & Romania | Every Goal | 1994 FIFA World Cup',
    publisher: 'FIFA',
    url: 'https://www.youtube.com/watch?v=rx8GxxrkJEc',
    fallback: 'https://www.fifa.com/en/watch/2h1DNc78yJkeazIDAsjWuv',
});

function hagiEmbedURL(origin) {
    const u = new URL(`https://www.youtube.com/embed/${HAGI_BROADCAST.id}`);
    u.search = new URLSearchParams({ autoplay: '1', mute: '1', playsinline: '1', controls: '1',
        loop: '1', playlist: HAGI_BROADCAST.id, enablejsapi: '1', origin, rel: '0' });
    return u.href;
}

let apiPromise;
function youtubeAPI() {
    if (globalThis.YT?.Player) return Promise.resolve(globalThis.YT);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script'), previous = globalThis.onYouTubeIframeAPIReady;
        let timer;
        const clean = () => { clearTimeout(timer); if (globalThis.onYouTubeIframeAPIReady === ready) globalThis.onYouTubeIframeAPIReady = previous; };
        const failed = () => { clean(); script.remove(); apiPromise = null; reject(new Error('Video player unavailable')); };
        const ready = () => { clean(); previous?.(); resolve(globalThis.YT); };
        globalThis.onYouTubeIframeAPIReady = ready;
        script.src = 'https://www.youtube.com/iframe_api'; script.async = true; script.onerror = failed;
        timer = setTimeout(failed, 15000); document.head.append(script);
    });
    return apiPromise;
}

/** Focus the TV with the publisher's real player; opening it grants no award. */
export function officialHagiTV(ctx) {
    let current = null, disposed = false;
    const close = () => current?.close();
    const open = s => {
        if (disposed || !ctx.room.visible || current || s.ui.panelOpen) return false;
        const p = s.ui.$('.sp-panel'), frame = document.createElement('iframe');
        p.innerHTML = `<section class="sp-hagi" role="dialog" aria-label="Hagi highlights" style="box-sizing:border-box;width:min(900px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;padding:14px;background:#101719;border:2px solid #c8ae6d;border-radius:12px;pointer-events:auto">
            <h2 style="margin:0 0 6px;font-size:19px">Hagi &amp; România · 1994</h2>
            <p style="margin:0 0 10px">Official FIFA highlights · repeat · starts muted</p>
            <div data-video style="aspect-ratio:16/9;background:#080b0d"></div>
            <p data-video-status role="status">Loading the official player…</p>
            <nav style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><button data-close style="min-height:44px;padding:9px 16px">Back to the bar</button>
            <a href="${HAGI_BROADCAST.url}" target="_blank" rel="noopener" style="color:#f9dc8a">Watch on YouTube ↗</a>
            <a href="${HAGI_BROADCAST.fallback}" target="_blank" rel="noopener" style="color:#f9dc8a">Hagi on FIFA ↗</a></nav></section>`;
        frame.title = HAGI_BROADCAST.title; frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture'; frame.allowFullscreen = true;
        frame.style.cssText = 'display:block;width:100%;height:100%;border:0';
        const slot = p.querySelector('[data-video]');
        frame.src = hagiEmbedURL(location.origin); slot.append(frame);
        const status = p.querySelector('[data-video-status]');
        let player = null, ready = false, ended = false, lastVolume;
        const error = () => { if (!ended) { player?.pauseVideo?.(); status.textContent = 'Video unavailable here. Open the official highlights using a link below.'; slot.hidden = true; } };
        const key = e => {
            if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === 'keydown' && !e.repeat) run.close(); }
        };
        const run = current = { s, close() {
            if (ended) return; ended = true; current = null;
            clearTimeout(timeout); window.removeEventListener('keydown', key, true); window.removeEventListener('keyup', key, true);
            player?.destroy?.(); player = null; frame.removeAttribute('src'); frame.remove();
            if (s.ui._closePanel === run.close) { s.ui._closePanel = null; p.classList.remove('show'); p.replaceChildren(); }
            s.input?.take?.('KeyE'); s.input?.flush?.(); s.returnFocus?.();
        }, sync() {
            if (!ready || ended) return;
            const a = s.host.audio || globalThis.game?.audio;
            const muted = !!a?.muted || a?.enabled === false, volume = Math.round((a?.volume ?? 1) * 100);
            if (muted && !player.isMuted()) player.mute();
            if (volume !== lastVolume) player.setVolume(volume);
            lastVolume = volume;
        } };
        const timeout = setTimeout(error, 16000);
        p.querySelector('[data-close]').onclick = run.close;
        p.onclick = e => { if (e.target === p) run.close(); };
        s.input?.releaseLock?.(); s.input?.take?.('KeyE'); s.input?.keys?.delete?.('KeyE');
        p.classList.add('show'); s.ui._closePanel = run.close;
        window.addEventListener('keydown', key, true); window.addEventListener('keyup', key, true);
        youtubeAPI().then(YT => {
            if (ended || disposed) return;
            player = new YT.Player(frame, { events: {
                onReady() { if (ended) return; ready = true; clearTimeout(timeout); slot.hidden = false; status.textContent = 'FIFA · repeating highlights. Use the player controls for sound.'; player.mute(); run.sync(); player.playVideo(); },
                onError: error,
                onStateChange(e) { if (!ended && ready && e.data === 0 && !document.hidden) { player.seekTo(0); player.playVideo(); } },
            } });
        }).catch(error);
        return true;
    };
    const hidden = () => { if (document.hidden) close(); };
    document.addEventListener('visibilitychange', hidden);
    onActivityCancel(ctx, close);
    ctx.onUpdate((dt, s) => { if (current && (!ctx.room.visible || s.host.photo?.active || globalThis.game?.pauseOpen)) close(); else current?.sync(); });
    const dispose = () => { if (disposed) return; disposed = true; close(); document.removeEventListener('visibilitychange', hidden); };
    (ctx.extras.sceneCleanups ||= []).push(dispose);
    ctx.room.addEventListener('removed', dispose);
    return { open, close, dispose, get active() { return !!current; } };
}
