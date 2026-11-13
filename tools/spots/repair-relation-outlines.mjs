#!/usr/bin/env node
// ============================================================================
//  Tourist-scene multipolygon repair (no rebuild). The Seattle spot extracts (game/research/osm/sea-spots/*.json, made by
//  a tool that is not in this repo) joined a relation's member ways end to start without reversing a way drawn the other
//  way, so a relation of two or more outer ways could come out as a bow-tie (Bellevue Botanical Garden, Perennial Border
//  r19655849: the garden bed rendered as bare lawn). The Bucharest extracts (fetch-buc.mjs `rings`) reverse correctly.
//  This tool re-assembles every relation area whose stored outline crosses itself from the relation's live OSM member
//  geometry (API 0.6 relation/<id>/full.json, saved under --osm), joining ways at either end, and
//    - in each scene file (game/data/spots/<scene>.json): replaces that area's `poly` (and `holes`) with the assembled
//      ring projected by the scene's own projection; a relation with several outer rings keeps its id on the largest and
//      gets `<id>_<n>` areas (same tags) for the others, appended at the end of `areas`;
//    - with --extracts, also the `outline` / `holes` of the same relation in the source extracts (so a scene rebuild
//      keeps the fix).
//  With --from-extracts the source extracts are scanned on their own (their bow-ties stay after the scene files were
//  repaired, so a scene rebuild would bring them back): each crossing relation outline there is replaced by the assembled
//  ring; an outline the extract clipped to its reach (a lake or bay larger than the extract) is replaced by the assembled
//  ring clipped to the stored outline's bounding box, in the extract and in the scene files whose area still crosses
//  (--clip-scenes). The extract tool itself is not in this repo: the repaired extracts are the source from here on.
//  An area whose correctly assembled OSM outline still crosses itself is left as it is (an OSM geometry question).
//  Nothing else in any file changes; each changed scene file gets an `outlineRepair` provenance record.
//
//  usage: node tools/spots/repair-relation-outlines.mjs --osm <dir> [--fetch] [--scenes a,b] [--repo <worktree>]
//               [--in <dir>] [--out <dir>] [--extracts] [--extracts-out <dir>] [--from-extracts [--clip-scenes]] [--write]
//  © OpenStreetMap contributors, ODbL 1.0.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) args[k.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true; }
const REPO = path.resolve(args.repo || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const IN = path.resolve(args.in || path.join(REPO, 'game', 'data', 'spots')), OUT = path.resolve(args.out || IN);
const OSM = path.resolve(args.osm || '.'); fs.mkdirSync(OSM, { recursive: true });
const { projector } = await import(pathToFileURL(path.join(REPO, 'game/src/spots/tools/build-data.mjs')).href);

const cross = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
const crossings = (p) => { const n = p.length; let k = 0; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (cross(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) k++; } return k; };
const area = (p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]); return a / 2; };
const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const cleanPoly = (p) => { const o = []; for (const q of p) { const l = o[o.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 0.15) o.push(q); } if (o.length > 2 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) < 0.15) o.pop(); return o; };

/** join ways (arrays of node ids) into closed rings, at either end of either way */
function joinRings(segs) {
    segs = segs.map(s => s.slice()); const rings = [], open = [];
    while (segs.length) {
        let ring = segs.shift();
        for (let guard = 0; guard < 1000 && ring[0] !== ring[ring.length - 1]; guard++) {
            const a = ring[0], b = ring[ring.length - 1]; let hit = -1;
            for (let i = 0; i < segs.length && hit < 0; i++) {
                const s = segs[i];
                if (s[0] === b) { ring = ring.concat(s.slice(1)); hit = i; }
                else if (s[s.length - 1] === b) { ring = ring.concat(s.slice(0, -1).reverse()); hit = i; }
                else if (s[s.length - 1] === a) { ring = s.slice(0, -1).concat(ring); hit = i; }
                else if (s[0] === a) { ring = s.slice(1).reverse().concat(ring); hit = i; }
            }
            if (hit < 0) break; segs.splice(hit, 1);
        }
        (ring[0] === ring[ring.length - 1] && ring.length > 3 ? rings : open).push(ring);
    }
    return { rings, open };
}
async function relationFull(id) {
    const f = path.join(OSM, `relation-${id}-full.json`);
    if (!fs.existsSync(f)) {
        if (!args.fetch) return null;
        const url = `https://api.openstreetmap.org/api/0.6/relation/${id}/full.json`;
        const r = await fetch(url, { headers: { 'User-Agent': 'osm-spot-outline-check/1.0' } }); const body = await r.text();
        fs.writeFileSync(f, JSON.stringify({ url, status: r.status, fetched: new Date().toISOString(), body }));
        await new Promise(res => setTimeout(res, 400));
    }
    const rec = JSON.parse(fs.readFileSync(f, 'utf8')); if (rec.status !== 200) return null;
    return { rec, json: JSON.parse(rec.body), sha256: crypto.createHash('sha256').update(rec.body).digest('hex') };
}
function assemble(json, id) {
    const nodes = new Map(), ways = new Map(); let rel = null;
    for (const e of json.elements) { if (e.type === 'node') nodes.set(e.id, [e.lat, e.lon]); else if (e.type === 'way') ways.set(e.id, e); else if (e.type === 'relation' && e.id === id) rel = e; }
    if (!rel) return null;
    const by = (role) => joinRings(rel.members.filter(m => m.type === 'way' && (m.role || 'outer') === role && ways.has(m.ref)).map(m => ways.get(m.ref).nodes));
    const ll = (ring) => ring.map(n => nodes.get(n)).filter(Boolean);
    const o = by('outer'), i = by('inner');
    return { outers: o.rings.map(ll), inners: i.rings.map(ll), openOuter: o.open.length, tags: rel.tags };
}

const files = fs.readdirSync(IN).filter(f => f.endsWith('.json') && !/manifest|-shore\.json$/.test(f) && (!args.scenes || String(args.scenes).split(',').includes(f.replace(/\.json$/, ''))));
const report = [], fixedLL = new Map();
for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(IN, f), 'utf8')); if (!d.origin || !Array.isArray(d.areas)) continue;
    const P = projector(d.origin.lat, d.origin.lon), add = [], changed = [];
    for (const a of d.areas) {
        const m = /^r(\d+)$/.exec(String(a.id)); if (!m || !a.poly || a.poly.length < 4) continue;
        const before = crossings(a.poly); if (!before) continue;
        const full = await relationFull(+m[1]); if (!full) { report.push({ scene: f, id: a.id, name: a.name || '', before, status: 'no OSM reply saved (run with --fetch)' }); continue; }
        const asm = assemble(full.json, +m[1]); if (!asm || !asm.outers.length) { report.push({ scene: f, id: a.id, before, status: 'no closed outer ring in OSM' }); continue; }
        const polys = asm.outers.map(r => cleanPoly(r.map(([la, lo]) => P.xy(la, lo)))).filter(p => p.length >= 3).sort((p, q) => Math.abs(area(q)) - Math.abs(area(p)));
        const after = polys.reduce((s, p) => s + crossings(p), 0);
        if (after) { report.push({ scene: f, id: a.id, name: a.name || '', before, after, status: 'the assembled OSM outline itself crosses: left as it is' }); continue; }
        // only a mis-joined outline is repaired: the stored outline must hold the same vertices as the assembled rings (a lake
        // or bay clipped to the extract's reach, or geometry changed in OSM since, is reported and left as it is)
        const key = (q) => Math.round(q[0] * 2) + ',' + Math.round(q[1] * 2), stored = new Set(a.poly.map(key)), asmPts = polys.flat();
        const shared = asmPts.filter(q => stored.has(key(q)) || [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].some(([dx, dz]) => stored.has(key([q[0] + dx, q[1] + dz])))).length;
        if (shared < 0.9 * asmPts.length || asmPts.length > 1.2 * a.poly.length + 4) { report.push({ scene: f, id: a.id, name: a.name || '', before, status: `not the same vertices (${shared}/${asmPts.length} assembled points in the stored ${a.poly.length}): clipped by the extract or changed in OSM; left as it is` }); continue; }
        const holesOf = (p) => asm.inners.map(r => cleanPoly(r.map(([la, lo]) => P.xy(la, lo)))).filter(h => h.length >= 3 && inPoly(h[0][0], h[0][1], p));
        a.poly = polys[0]; const h0 = holesOf(polys[0]); if (h0.length) a.holes = h0; else delete a.holes;
        for (let k = 1; k < polys.length; k++) { const { id, poly, holes, ...tags } = a; const hk = holesOf(polys[k]); add.push({ id: `${a.id}_${k}`, poly: polys[k], ...tags, ...(hk.length ? { holes: hk } : {}) }); }
        changed.push({ id: a.id, osmSha256: full.sha256, outerRings: polys.length });
        fixedLL.set(a.id, asm);
        report.push({ scene: f, id: a.id, name: a.name || '', before, after: 0, rings: polys.length, status: 'repaired' });
    }
    if (changed.length && args.write) {
        d.areas.push(...add);
        d.outlineRepair = { tool: 'tools/spots/repair-relation-outlines.mjs', date: new Date().toISOString().slice(0, 10), source: 'OSM API 0.6 relation/<id>/full.json', repaired: changed, added: add.map(a => a.id) };
        fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, f), JSON.stringify(d));
    }
}
for (const r of report) console.log([r.scene, r.id, r.name, 'crossings ' + r.before + (r.after != null ? '→' + r.after : ''), r.rings ? r.rings + ' ring(s)' : '', r.status].join('  '));
if (args.extracts && args.write) { // the source extracts: outline / holes of the same relations
    const sd = path.join(REPO, 'game/research/osm/sea-spots'), so = path.resolve(args['extracts-out'] || sd);
    for (const f of fs.readdirSync(sd).filter(f => f.endsWith('.json') && !f.includes('terrain'))) {
        const d = JSON.parse(fs.readFileSync(path.join(sd, f), 'utf8')); let n = 0;
        for (const a of d.areas || []) { const asm = fixedLL.get(a.id); if (!asm || asm.outers.length !== 1 || !a.outline || !crossings(a.outline)) continue; a.outline = asm.outers[0]; if (asm.inners.length) a.holes = asm.inners; n++; }
        if (n) { fs.mkdirSync(so, { recursive: true }); fs.writeFileSync(path.join(so, f), JSON.stringify(d)); console.log('extract', f, 'outlines repaired', n); }
    }
}

// ---- --from-extracts: repair the source extracts directly (lat/lon outlines); clipped outlines are re-clipped to their box
/** Sutherland–Hodgman: a simple polygon clipped to an axis box [a0, b0, a1, b1] (first / second coordinate) */
function clipBox(poly, [a0, b0, a1, b1]) {
    const edges = [[(p) => p[0] >= a0, (p, q) => [a0, p[1] + (q[1] - p[1]) * (a0 - p[0]) / (q[0] - p[0])]], [(p) => p[0] <= a1, (p, q) => [a1, p[1] + (q[1] - p[1]) * (a1 - p[0]) / (q[0] - p[0])]],
        [(p) => p[1] >= b0, (p, q) => [p[0] + (q[0] - p[0]) * (b0 - p[1]) / (q[1] - p[1]), b0]], [(p) => p[1] <= b1, (p, q) => [p[0] + (q[0] - p[0]) * (b1 - p[1]) / (q[1] - p[1]), b1]]];
    let out = poly.slice(); if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
    for (const [inside, cut] of edges) { const src = out; out = []; for (let i = 0; i < src.length; i++) { const p = src[i], q = src[(i + 1) % src.length], pi = inside(p), qi = inside(q); if (pi) out.push(p); if (pi !== qi) out.push(cut(p, q)); } if (!out.length) break; }
    return out;
}
const dropCollinear = (p) => { const o = []; for (let i = 0; i < p.length; i++) { const a = p[(i - 1 + p.length) % p.length], b = p[i], c = p[(i + 1) % p.length]; const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); if (Math.abs(cr) > 1e-14 && !(a[0] === b[0] && a[1] === b[1])) o.push(b); } return o; };
if (args['from-extracts']) {
    const sd = path.join(REPO, 'game/research/osm/sea-spots'), so = path.resolve(args['extracts-out'] || sd), clipped = new Map();
    for (const f of fs.readdirSync(sd).filter(f => f.endsWith('.json') && !f.includes('terrain'))) {
        const d = JSON.parse(fs.readFileSync(path.join(sd, f), 'utf8')), done = [], extra = [];
        for (const a of d.areas || []) {
            const m = /^r(\d+)$/.exec(String(a.id)); if (!m || !a.outline || a.outline.length < 4) continue;
            const before = crossings(a.outline); if (!before) continue;
            const full = await relationFull(+m[1]); if (!full) { console.log('extract', f, a.id, 'no OSM reply saved (run with --fetch)'); continue; }
            const asm = assemble(full.json, +m[1]); if (!asm || !asm.outers.length) { console.log('extract', f, a.id, 'no closed outer ring in OSM'); continue; }
            const key = (q) => q[0].toFixed(6) + ',' + q[1].toFixed(6), stored = new Set(a.outline.map(key)), pts = asm.outers.flat();
            const same = pts.filter(q => stored.has(key(q))).length >= 0.9 * pts.length;
            let ring = null, how = '';
            if (same && asm.outers.every(r => !crossings(r))) { // mis-joined: the largest ring keeps the id, the others become <id>_<k>
                const rs = asm.outers.slice().sort((p, q) => Math.abs(area(q)) - Math.abs(area(p))); ring = rs[0]; how = `rejoined (${rs.length} outer ring(s))`;
                const holesOf = (r) => asm.inners.filter(h => inPoly(h[0][0], h[0][1], r));
                for (let k = 1; k < rs.length; k++) { const { id, outline, holes, ...tags } = a, hk = holesOf(rs[k]); extra.push({ id: `${a.id}_${k}`, ...tags, outline: rs[k], ...(hk.length ? { holes: hk } : {}) }); }
                const h0 = holesOf(rs[0]); if (h0.length) a.holes = h0; else delete a.holes;
            } else { // clipped by the extract: the assembled outer ring that overlaps the stored box, clipped to that box
                const la = a.outline.map(q => q[0]), lo = a.outline.map(q => q[1]), box = [Math.min(...la), Math.min(...lo), Math.max(...la), Math.max(...lo)];
                const cands = asm.outers.map(r => dropCollinear(clipBox(r, box))).filter(r => r.length >= 3).sort((p, q) => Math.abs(area(q)) - Math.abs(area(p)));
                if (cands.length && !crossings(cands[0])) { ring = [...cands[0], cands[0][0]]; how = `clipped to the stored box (${asm.outers.length} outer ring(s))`; clipped.set(a.id, { box, ring: cands[0], sha: full.sha256 }); }
            }
            if (!ring) { console.log('extract', f, a.id, 'crossings', before, 'left as it is (assembled ring still crosses)'); continue; }
            a.outline = ring;
            done.push(a.id); console.log('extract', f, a.id, 'crossings', before, '→ 0,', how);
        }
        d.areas.push(...extra);
        if (done.length && args.write) { d.outlineRepair = { tool: 'tools/spots/repair-relation-outlines.mjs --from-extracts', date: new Date().toISOString().slice(0, 10), source: 'OSM API 0.6 relation/<id>/full.json', repaired: done, added: extra.map(a => a.id) }; fs.mkdirSync(so, { recursive: true }); fs.writeFileSync(path.join(so, f), JSON.stringify(d)); }
    }
    if (args['clip-scenes']) for (const f of files) { // the clipped lakes / bays in the scene files, where the stored area still crosses
        const d = JSON.parse(fs.readFileSync(path.join(IN, f), 'utf8')); if (!d.origin || !Array.isArray(d.areas)) continue;
        const P = projector(d.origin.lat, d.origin.lon), changed = [];
        for (const a of d.areas) { const c = clipped.get(a.id); if (!c || !a.poly || !crossings(a.poly)) continue; const poly = cleanPoly(c.ring.map(([la, lo]) => P.xy(la, lo))); if (crossings(poly)) continue; console.log('scene', f, a.id, 'crossings', crossings(a.poly), '→ 0 (clipped OSM outline)'); a.poly = poly; changed.push({ id: a.id, osmSha256: c.sha, clippedTo: c.box }); }
        if (changed.length && args.write) { d.outlineRepair = { ...(d.outlineRepair || {}), clipped: changed, clippedDate: new Date().toISOString().slice(0, 10) }; fs.writeFileSync(path.join(OUT, f), JSON.stringify(d)); }
    }
}
