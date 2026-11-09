// Scene-owned participatory activities. The host calls cancel before a mode
// takeover; the per-frame guard also covers dev hosts and visibility changes.
const CSS = `.sp-participation{position:absolute;left:16px;bottom:24px;box-sizing:border-box;width:min(390px,calc(100vw - 32px));padding:12px 14px;border:1px solid #cdb16b;border-radius:12px;background:#182027f5;color:#fff;pointer-events:auto;font:14px/1.4 system-ui}.sp-participation h2{font-size:17px;margin:0 0 6px}.sp-participation p{margin:5px 0}.sp-participation progress{width:100%;accent-color:#fbbf24}.sp-participation nav{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.sp-participation button{min-height:44px;padding:9px 14px;border:0;border-radius:8px;background:#fbbf24;color:#211b0b;font:700 14px system-ui;cursor:pointer}.sp-participation button[data-leave]{background:#414b54;color:#fff}.sp-participation button:disabled{opacity:.5}.sp-participation button:focus-visible{outline:3px solid white;outline-offset:2px}@media(max-width:600px),(max-height:500px){.sp-participation{top:108px;bottom:auto}}`;

export function activityBlocked(s) {
    const g = globalThis.game;
    return document.hidden || s.ui.panelOpen || s.host.photo?.active || s.host.explore?.drone?.active ||
        g?.pauseOpen || g?.condOpen || g?.hud?.panelOpen || (g?.spot === s && g.state !== 'spot');
}

// Walking courses have no modal panel, but host takeovers must still cancel
// their partial progress before that host stops calling the scene update.
export function onActivityCancel(ctx, cancel) {
    (ctx.extras.activityCancellers ||= []).push(cancel);
    const hidden = () => { if (document.hidden) cancel('hidden'); };
    document.addEventListener('visibilitychange', hidden);
    (ctx.extras.sceneCleanups ||= []).push(() => document.removeEventListener('visibilitychange', hidden));
}

export function activityFlow(ctx) {
    if (ctx.extras.participation) return ctx.extras.participation;
    let run = null;
    const restore = () => {
        if (!run) return null;
        const old = run; run = null;
        old.ui.remove(); old.s.ctl.active = old.active;
        old.s.input?.take?.('KeyE'); old.s.input?.keys?.delete?.('KeyE'); old.s.input?.takeLook?.();
        return old;
    };
    const api = {
        get active() { return !!run; },
        get run() { return run; },
        cancel(reason = 'cancel') { const old = restore(); old?.opts.cancel?.(old.s, reason); },
        complete() { const old = restore(); if (old) { old.opts.complete?.(old.s); old.s.completeTourActivity?.(old.tourStop); } },
        begin(s, opts) {
            if (run || s.ctl.active === false || activityBlocked(s) || ctx.extras.venueActivities?.active) return false;
            if (!document.getElementById('sp-participation-css')) { const st = document.createElement('style'); st.id = 'sp-participation-css'; st.textContent = CSS; document.head.append(st); }
            const ui = document.createElement('section'); ui.className = 'sp-participation'; ui.setAttribute('aria-label', opts.title);
            ui.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
            ui.innerHTML = '<h2></h2><p data-help></p><p data-status aria-live="polite"></p><progress max="1" value="0"></progress><nav><button type="button" data-action></button><button type="button" data-leave>Leave</button></nav>';
            ui.querySelector('h2').textContent = opts.title; ui.querySelector('[data-help]').textContent = opts.help || '';
            const button = ui.querySelector('[data-action]'); button.textContent = opts.action || 'Continue';
            const p = s.position;
            run = { s, opts, ui, button, status: ui.querySelector('[data-status]'), progress: ui.querySelector('progress'), active: s.ctl.active, busy: false, t: 0, start: { x: p.x, z: p.z, y: p.y, heading: s.ctl.heading } };
            button.onclick = () => { if (run && !run.busy && !activityBlocked(s)) opts.actioned?.(s, run); };
            ui.querySelector('[data-leave]').onclick = () => api.cancel('leave');
            run.tourStop = s.captureTourActivity?.();
            s.input?.releaseLock?.(); s.input?.take?.('KeyE'); s.ui.prompt(null);
            if (opts.lockWalker !== false) s.ctl.active = false;
            s.ui.el.append(ui);
            if(opts.focus){const dx=opts.focus.x-p.x,dz=opts.focus.z-p.z;s.ctl.heading=Math.atan2(-dx,-dz);s.ctl.pitch=Math.atan2(opts.focus.y-p.y-1.65,Math.hypot(dx,dz));s.ctl.place?.();}
            opts.started?.(s, run); return true;
        },
        dispose() { api.cancel('exit'); window.removeEventListener('keydown', key, true); window.removeEventListener('keyup', key, true); document.removeEventListener('visibilitychange', visibility); },
    };
    const key = e => {
        if (!run) return;
        if (run.opts.key?.(e, run)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
        if (run.ui.contains(e.target) && ['Enter', 'Space'].includes(e.code)) { e.stopImmediatePropagation(); return; }
        if (!['KeyE', 'Escape'].includes(e.code)) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.type === 'keyup' || e.repeat) return;
        if (e.code === 'Escape') api.cancel('escape'); else run.button.click();
    };
    const visibility = () => { if (document.hidden) api.cancel('hidden'); };
    window.addEventListener('keydown', key, true); window.addEventListener('keyup', key, true); document.addEventListener('visibilitychange', visibility);
    ctx.onUpdate((dt, s) => {
        if (!run) return;
        if (s !== run.s || activityBlocked(s)) { api.cancel('mode'); return; }
        if (s.input?.take?.('Escape')) { api.cancel('escape'); return; }
        if (s.input?.take?.('KeyE')) run.button.click();
        s.input?.take?.('Space');
        if (run.opts.lockWalker !== false && !run.opts.cameraRide) {
            const look = s.input?.takeLook?.() || { dx: 0, dy: 0 };
            s.ctl.heading -= look.dx * .0024; s.ctl.pitch = Math.max(-1.3, Math.min(1.3, s.ctl.pitch - look.dy * .0024)); s.ctl.place?.();
        }
        run.opts.update?.(Math.max(0, Math.min(.1, dt)), s, run);
        if (run) run.button.disabled = run.busy;
    });
    ctx.extras.participation = api;
    return api;
}
