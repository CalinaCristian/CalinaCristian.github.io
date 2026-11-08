import * as THREE from '../../../vendor/three.module.min.js';

// A prerecorded view of the real Dinamo controller and football simulation.
// Playback never imports physics, emits activities, or unlocks achievements.
export function addDinamoHintTV(ctx, { x, y, z, yaw, w = 2.6 }) {
    const video = document.createElement('video');
    video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'metadata';
    video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
    video.src = new URL('../../../assets/wcp/dinamo-hint.webm', import.meta.url).href;
    // Vendored Three r170 does not cancel its internal video frame callback on
    // texture disposal. Track that one callback so scene removal can cancel it.
    let frameCallback = 0, disposed = false;
    const requestFrame = video.requestVideoFrameCallback?.bind(video);
    if (requestFrame) video.requestVideoFrameCallback = (callback) => {
        if (disposed) return 0;
        frameCallback = requestFrame((...args) => { frameCallback = 0; callback(...args); });
        return frameCallback;
    };
    const texture = new THREE.VideoTexture(video); texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, color: '#dddddd', toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 9 / 16), material);
    screen.name = 'dinamo-hint-tv'; screen.position.set(x, y, z); screen.rotation.y = yaw;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + .12, w * 9 / 16 + .12, .08), new THREE.MeshBasicMaterial({ color: '#101114' }));
    frame.position.set(x - Math.sin(yaw) * .05, y, z - Math.cos(yaw) * .05); frame.rotation.y = yaw;
    ctx.add(frame, screen);
    let session = null, lastUpdate = 0, playing = false;
    const pause = () => { video.pause(); playing = false; };
    const sync = () => {
        const g = window.game;
        const active = !disposed && ctx.room.visible && !document.hidden && session &&
            performance.now() - lastUpdate < 400 && !session.ui.panelOpen && !session.host.photo?.active &&
            !g?.pauseOpen && !g?.hud?.panelOpen && (!g || g.state === 'spot');
        if (!active) { if (!video.paused || playing) pause(); return; }
        if (video.paused && !playing) {
            playing = true;
            video.play().catch(() => { playing = false; });
        }
    };
    ctx.onUpdate((dt, s) => { session = s; lastUpdate = performance.now(); sync(); });
    // Render still runs behind a pause menu; stop decoder work there immediately.
    screen.onBeforeRender = sync;
    const timer = setInterval(sync, 250);
    document.addEventListener('visibilitychange', sync);
    const dispose = () => {
        if (disposed) return; disposed = true; pause(); clearInterval(timer);
        if (frameCallback) video.cancelVideoFrameCallback?.(frameCallback);
        frameCallback = 0;
        document.removeEventListener('visibilitychange', sync); screen.onBeforeRender = () => {};
        texture.dispose(); video.removeAttribute('src'); video.load(); session = null;
    };
    ctx.room.addEventListener('removed', dispose);
    return { video, screen, texture, pause, dispose, get disposed() { return disposed; }, get pendingVideoFrame() { return frameCallback; } };
}
