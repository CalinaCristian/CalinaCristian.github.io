/** Keep host launchers off activity controls without disabling tour Skip/End. */
export function syncModalControls(host) {
    const modal = !!(!['drive', 'foot', 'office', 'spot'].includes(host.state) || host._pauseOpen || host.mapOpen || host.condOpen || host.hud.panelOpen || host.spot?.ui?.panelOpen || host.explore?.map?.isOpen || host.photo?.active || document.querySelector('#achv-panel.show, #save-gallery.show') || document.body.classList.contains('finale-open'));
    const extras = host.state === 'spot' ? host.spot?.spot?.ctx?.extras : null;
    const activity = !!(extras?.participation?.active || extras?.venueActivities?.active);
    if (modal === host._controlsModal && activity === host._controlsActivity) return;
    host._controlsModal = modal; host._controlsActivity = activity;
    document.body.classList.toggle('ui-modal', modal);
    document.body.classList.toggle('ui-activity', activity);
    const blocked = modal || activity;
    for (const el of document.querySelectorAll('#touch, #pause-btn, #explore-bar, .photo-open, #cond-btn, #car-finder, #story-chip, #drone-hud, #minimap-toggle, #spot-ui .sp-prompt, #spot-ui .sp-mini')) el.inert = blocked;
    for (const el of document.querySelectorAll('#spot-ui .sp-tour-controls')) el.inert = modal;
    if (blocked) { host.input.cancelTouch?.(); if (host.photo?.active) host.input.touch.brake = true; }
}
