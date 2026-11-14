// Reviewed lamp forms by place (r3-look-13). OSM `highway=street_lamp` nodes rarely carry a style tag (`lamp_mount`,
// `light:count`, `support`), so every mapped lamp drew as the generic single-arm street lamp. Where a street-level review saw
// a different form for all mapped lamps of one place, a zone below gives that form to the OSM lamps inside it (positions stay
// OSM's; nothing is added). Form sizes are estimates (CANDELABRA_MODEL); the instanced geometry is built in world.js.
export const CANDELABRA_MODEL = { globes: 5, globeR: 0.32, armHalfM: 0.95, estimates: ['globes', 'globeR', 'armHalfM', 'post height (the lamp\'s own height rule)'] };

const LAMP_FORM_ZONES = {
    'bucharest-unirii': [
        // Piața Unirii: 16 mapped street_lamp nodes in the square, no style tags; the 2024 panoramas of the fountain field
        // (game/research/bucharest-unirii.md, "Landmarks, monuments and street furniture") show tall dark candelabra lamps with globe clusters
        { form: 'candelabra', lat: 44.4268, lon: 26.1025, radiusM: 150, review: 'Street View 2024, Piața Unirii fountain field' },
    ],
};

/** the reviewed form of a mapped lamp at (x, z) for district key, else null */
export function reviewedLampForm(key, proj, x, z) {
    for (const zone of LAMP_FORM_ZONES[key] || []) { const p = proj(zone.lat, zone.lon); if (Math.hypot(x - p.x, z - p.z) <= zone.radiusM) return zone.form; }
    return null;
}
