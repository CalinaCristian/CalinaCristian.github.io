// Free-standing monuments of the chapter districts: statues, busts, obelisks, crosses, wayside crosses, memorial steles, sculptures.
//
// Before this pass a mapped monument was a map marker and nothing stood on the ground. Position, name, class (`form`),
// material and tagged height come from OpenStreetMap (monument-sources.js; the district pack's own landmark POIs give
// the position of ways and of memorials the extract does not list). What is drawn is a restrained generic object of that
// class: a plinth with a plain standing figure, a bust block, an obelisk, a stele. It is NOT a likeness, and every
// dimension below is an estimate (MONUMENT_MODEL) unless OSM tags a height. Works hand-modelled in landmarks.js are
// skipped (MONUMENT_LANDMARK_OWNED + any small landmark disc at the place). Nothing is placed on a carriageway, in a
// tram's swept body, inside a building or in water; such records are reported, never moved.
import { MONUMENT_SOURCES, MONUMENT_NOT_FREESTANDING } from './monument-sources.js';

// names (lower case, as tagged) of monuments that landmarks.js builds itself: extend when a landmark is added
export const MONUMENT_LANDMARK_OWNED = ['lascăr catargiu', 'monumentul eroilor aerului', 'monumentul aerului'];

export const MONUMENT_MODEL = {
    estimates: 'all dimensions except a tagged OSM height',
    totalM: { statue: 4.4, bust: 2.5, obelisk: 6, cross: 3.2, wayside: 1.5, sculpture: 2.6, installation: 2.6, stele: 2.6, monument: 4.2, marker: 0.9 },
    colliderM: { statue: 0.95, bust: 0.6, obelisk: 1.1, cross: 0.7, wayside: 0.45, sculpture: 0.85, installation: 0.85, stele: 1.0, monument: 1.5, marker: 0.75 },
};
// (r2-world-monuments, 2026-11-13) works whose subject is known from their OSM name and article (not from a panorama trace):
// a low-poly subject form instead of the class block. Still not likenesses; proportions are estimates. heightM only where
// noted (Memorialul Renașterii: about 25 m, ro.wikipedia "Memorialul Renașterii"; OSM has no height).
export const MONUMENT_SUBJECT = {
    n1883108499: { form: 'equestrian' },                // Carol I, Piața Revoluției (OSM height 13 m kept)
    n1731041124: { form: 'wolf' },                      // Lupoaica (Lupa Capitolina): the she-wolf with the twins
    w170953582: { form: 'lion' },                       // Monumentul Trupelor de Geniu (Leul)
    n7350336938: { form: 'lion' },                      // Leul Ierusalimului
    n1393030628: { form: 'spire', heightM: 25 },        // Memorialul Renașterii: white marble spire through a dark crown
};
const MATERIAL = { bronze: '#565b4c', copper: '#5f7f6c', coper: '#5f7f6c', metal: '#7b8186', steel: '#8a9096', 'stainless steel': '#a9aeb2', marble: '#e2dfd6', granite: '#8c8884', stone: '#b7b0a1', wood: '#7a5a3c', glass: '#9cc0cc', concrete: '#b4b1a9' };
const materialColour = (m, fallback) => { for (const part of String(m || '').toLowerCase().split(/[;,]/)) { const k = part.trim(); if (MATERIAL[k]) return MATERIAL[k]; } return fallback; };
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * env: { district, pois: [{ name, sub, x, z, building }], project(lat, lon) -> { x, z }, keep(x, z), cellOf, rgb, shadeRgb,
 *        blocked(x, z, r) -> reason | null, faceAngle(x, z) -> radians, baseY(x, z), addCollider(x, z, r, h, record),
 *        landmarkDiscs: [{ x, z, r }] }
 */
export function emitMonuments(env) {
    const out = { basis: 'OSM class + position; generic form, estimated dimensions; not a likeness', placed: [], skipped: [] };
    const cand = [], byName = new Map();
    for (const p of env.pois) if (p.name && !byName.has(norm(p.name))) byName.set(norm(p.name), p);
    for (const s of MONUMENT_SOURCES) {
        let x, z;
        if (s.lat != null) { const q = env.project(s.lat, s.lon); x = q.x; z = q.z; }
        else { const p = byName.get(norm(s.name)); if (!p || p.building >= 0) continue; x = p.x; z = p.z; }
        cand.push({ ...s, x, z });
    }
    // district memorial / monument POIs the extract does not classify (artworks without a class stay markers: form unknown)
    for (const p of env.pois) {
        if (p.building >= 0 || !/^(memorial|monument)$/.test(p.sub) || MONUMENT_NOT_FREESTANDING.includes(norm(p.name))) continue;
        if (cand.some(c => Math.hypot(c.x - p.x, c.z - p.z) < 12 || (c.name && norm(c.name) === norm(p.name)))) continue;
        cand.push({ id: 'poi:' + p.name, name: p.name, form: p.sub === 'monument' ? 'monument' : 'stele', x: p.x, z: p.z });
    }
    const done = [];
    for (const m of cand) {
        if (!env.keep(m.x, m.z)) continue;
        const rec = { id: m.id, name: m.name, form: m.form, x: +m.x.toFixed(1), z: +m.z.toFixed(1) };
        if (MONUMENT_LANDMARK_OWNED.includes(norm(m.name)) || env.landmarkDiscs.some(d => Math.hypot(d.x - m.x, d.z - m.z) < d.r)) { out.skipped.push({ ...rec, reason: 'landmark-owned' }); continue; }
        if (done.some(d => Math.hypot(d.x - m.x, d.z - m.z) < 1.6)) { out.skipped.push({ ...rec, reason: 'duplicate-position' }); continue; }
        const r = MONUMENT_MODEL.colliderM[m.form] || 0.9, why = env.blocked(m.x, m.z, r);
        if (why) { out.skipped.push({ ...rec, reason: why }); continue; }
        const subj = MONUMENT_SUBJECT[m.id], total = m.heightM > 0 ? m.heightM : subj?.heightM > 0 ? subj.heightM : MONUMENT_MODEL.totalM[m.form];
        build(env, subj ? { ...m, form: subj.form } : m, total);
        env.addCollider(m.x, m.z, r, Math.min(total, 4), rec);
        done.push(m); out.placed.push({ ...rec, totalM: total, heightSource: m.heightM > 0 ? 'OSM height' : 'estimate' });
    }
    return out;
}

function build(env, m, total) {
    const c = env.cellOf(m.x, m.z).solid, ang = env.faceAngle(m.x, m.z), y = env.baseY(m.x, m.z) - 0.05, x = m.x, z = m.z;
    const stone = env.rgb(materialColour(/marble|granite|stone|concrete/.test(m.material || '') ? m.material : '', '#bcb6a8')), stoneD = env.shadeRgb(stone, 0.86);
    const fig = env.rgb(materialColour(m.material, m.form === 'obelisk' || m.form === 'stele' || m.form === 'cross' || m.form === 'monument' ? '#b9b3a6' : '#565b4c'));
    const box = (y0, w, h, d, col, a = ang) => c.box(x, y + y0, z, w, h, d, a, col);
    // a box offset along the facing (local z: forward) and across it (local x)
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const at = (lx, lz, y0, w, h, d, col, a = ang) => c.box(x + lx * ca + lz * sa, y + y0, z - lx * sa + lz * ca, w, h, d, a, col);
    const pedestal = (ped, w, d) => { at(0, 0, 0, w + 0.5, 0.25, d + 0.5, stoneD); at(0, 0, 0.25, w, ped - 0.4, d, stone); at(0, 0, ped - 0.15, w + 0.2, 0.15, d + 0.2, stoneD); };
    const quadruped = (ped, k, body, legH, headUp) => { // body length along the facing; legs at the four corners; head forward
        const bw = 0.34 * k, bl = body * k, bh = 0.42 * k, lh = legH * k;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) at(sx * bw * 0.3, sz * bl * 0.36, ped, 0.1 * k, lh + 0.05, 0.12 * k, fig);
        at(0, 0, ped + lh, bw, bh, bl, fig);
        at(0, bl * 0.5 + 0.12 * k, ped + lh + bh * (headUp ? 0.7 : 0.35), 0.24 * k, 0.3 * k, 0.34 * k, fig);
    };
    if (m.form === 'equestrian') { // pedestal, horse, rider: figure height H = horse withers + rider (about 2.6 units)
        const ped = total * 0.5, H = total - ped, u = H / 2.6, S = 1.76 * u;
        pedestal(ped, 1.1 * u, 2.7 * u);
        quadruped(ped, S, 1.25, 0.51, true);
        const seat = ped + (0.51 + 0.42) * S;
        at(0, -0.15 * u, seat, 0.5 * u, 0.72 * u, 0.32 * u, fig); at(0, -0.1 * u, seat + 0.72 * u, 0.26 * u, 0.28 * u, 0.26 * u, fig);
    } else if (m.form === 'wolf') { // tall pedestal, the she-wolf, two small figures under her
        const ped = total * 0.75, S = (total - ped) / 0.82;
        pedestal(ped, 0.45 * S + 0.3, 1.2 * S + 0.3);
        quadruped(ped, S, 1.0, 0.32, false);
        for (const sz of [-0.15, 0.2]) at(0, sz * S, ped, 0.12 * S, 0.2 * S, 0.14 * S, fig);
    } else if (m.form === 'lion') { // pedestal, a standing lion with a mane block
        const ped = total * 0.62, S = (total - ped) / 0.9;
        pedestal(ped, 0.45 * S + 0.4, 1.2 * S + 0.4);
        quadruped(ped, S, 1.0, 0.34, true);
        at(0, 0.42 * S, ped + 0.34 * S + 0.1 * S, 0.46 * S, 0.5 * S, 0.3 * S, fig);
    } else if (m.form === 'spire') { // a slender three-sided white marble spire through a dark crown two thirds up
        const marble = env.rgb('#e6e2d8'), crown = env.rgb('#4a4d50'), n = 8;
        at(0, 0, 0, 4.2, 0.4, 4.2, stoneD);
        for (let i = 0; i < n; i++) { const w0 = 2.2 * (1 - i / n) + 0.25; at(0, 0, 0.4 + (total - 0.4) * i / n, w0, (total - 0.4) / n, w0, marble, ang + Math.PI / 4); }
        at(0, 0, total * 0.62, 3.1, total * 0.07, 3.1, crown); at(0, 0, total * 0.62 + total * 0.07, 2.5, total * 0.03, 2.5, crown, ang + Math.PI / 4);
    } else if (m.form === 'bust') {
        const k = total / 2.5, ped = 1.72 * k;
        box(0, 0.95 * k, 0.16, 0.95 * k, stoneD); box(0.16, 0.7 * k, ped - 0.16, 0.7 * k, stone);
        box(ped, 0.66 * k, 0.36 * k, 0.32 * k, fig); box(ped + 0.36 * k, 0.27 * k, 0.4 * k, 0.29 * k, fig);
    } else if (m.form === 'statue') {
        const ped = Math.min(total * 0.52, Math.max(1.2, total - 2.3)), k = (total - ped) / 2.1, w = Math.max(1.3, 0.62 * k + 0.5);
        box(0, w + 0.5, 0.22, w + 0.5, stoneD); box(0.22, w, ped - 0.34, w, stone); box(ped - 0.12, w + 0.16, 0.12, w + 0.16, stoneD);
        box(ped, 0.58 * k, 1.3 * k, 0.4 * k, fig); box(ped + 1.3 * k, 0.42 * k, 0.8 * k, 0.32 * k, fig); // a plain two-block mass: the class 'statue', no subject
    } else if (m.form === 'obelisk') {
        const base = Math.min(1.0, total * 0.14), shaft = total - base, w0 = Math.max(0.7, total * 0.13);
        box(0, w0 * 2.1, base * 0.45, w0 * 2.1, stoneD); box(base * 0.45, w0 * 1.5, base * 0.55, w0 * 1.5, stone);
        for (let i = 0; i < 4; i++) box(base + shaft * 0.23 * i, w0 * (1 - 0.14 * i), shaft * 0.23, w0 * (1 - 0.14 * i), fig);
        box(base + shaft * 0.92, w0 * 0.34, shaft * 0.08, w0 * 0.34, fig);
    } else if (m.form === 'cross') {
        box(0, 1.1, 0.3, 1.1, stoneD); box(0.3, 0.7, 0.35, 0.7, stone);
        box(0.65, 0.24, total - 0.65, 0.2, fig); box(0.65 + (total - 0.65) * 0.62, Math.min(1.3, total * 0.4), 0.24, 0.2, fig);
    } else if (m.form === 'wayside') { // (r3) a small stone wayside cross (troiță) on a low base: OSM historic=wayside_cross / man_made=cross
        const ws = env.rgb(materialColour(m.material, '#b7b0a1'));
        box(0, 0.6, 0.18, 0.42, stoneD); box(0.18, 0.2, total - 0.18, 0.14, ws); box(0.18 + (total - 0.18) * 0.66, Math.min(0.75, total * 0.5), 0.17, 0.14, ws);
    } else if (m.form === 'stele') {
        box(0, 2.0, 0.28, 0.9, stoneD); box(0.28, 1.35, total - 0.28, 0.32, fig);
    } else if (m.form === 'monument') {
        box(0, 3.0, 0.3, 3.0, stoneD); box(0.3, 2.3, 0.3, 2.3, stone); box(0.6, 1.2, total - 0.85, 1.2, fig); box(total - 0.25, 1.4, 0.25, 1.4, stoneD);
    } else if (m.form === 'marker') { // (r3) an artwork whose OSM tags do not describe its form: a plain low stone marker, nothing more
        box(0, 1.3, 0.2, 1.3, stoneD); box(0.2, 0.9, total - 0.2, 0.9, stone);
    } else { // sculpture / installation: a low plinth and one plain abstract block, turned 45 degrees
        const k = total / 2.6;
        box(0, 1.5 * k, 0.45 * k, 1.5 * k, stone); box(0.45 * k, 0.72 * k, 2.15 * k, 0.72 * k, fig, ang + Math.PI / 4);
    }
}
