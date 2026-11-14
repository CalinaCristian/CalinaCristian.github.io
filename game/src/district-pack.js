// District data pack (spec 10: each district ≤ 3 MB, loads in < 4 s). A lossless binary form of the district JSON:
// decodeDistrictPack(bytes) returns exactly the object JSON.parse returned for the source file (same keys in the same
// order, same strings, bit-identical numbers), except that long cache-validation signature strings are replaced by
// their hash (signatureHash), which the builder compares against the hash of the signature it computes.
// Used by world.js (browser) and by the Node tools (tools/osm/district-data.mjs); no DOM, no Node APIs here.
//
// Layout (little endian): 'DMCVPAK2', u32 count of sections, then per section u32 byte length, then the sections:
//   0 strings  UTF-8, each string preceded by its uvar byte length (object keys and values share the table)
//   1 shapes   uvar key count, then uvar string ids, per object shape (key list in order)
//   2 tags     one byte per value (see T below)
//   3 uvars    unsigned varints: array lengths, string ids, shape ids, row references
//   4 ints     zigzag varints: integers and scaled decimals, as differences from their prediction
//   5 floats   the 64 bits of numbers without a short decimal form, minus their prediction (64-bit integer difference, zigzag), stored as 8 byte planes
//   6 model    one byte per (field, position class): the predictor the encoder chose for it
//   7 refs     zigzag varints: row reference targets, as the difference from the previous target + 1
// Numbers: an integer → INT; a number equal to k / 10^p for an integer k (p = 1…7) → DEC+p-1 with k; anything else
// (and -0) → F64. Every value belongs to a field: the path from the root with array indices dropped (the 'x' of every
// point of buildingFootprints.#[] is one field; buildingRoofProfiles.#.low another). A number at position j of an array
// is in class min(j, 15) of the array's element field; a number held by an object key is class 0 of that key's field.
// Per (field, class) the encoder picks, by trial, the predictor that costs least: none, the previous number with the
// same tag in the same array, or the previous number with the same tag of the same field and class (the same column of
// the previous point, the same key of the previous record), or for integers the field's largest integer so far + 1
// (indices of faces that bring in their vertices in order), or for integers and decimals the field's last value plus
// its last step (evenly spaced samples). The value is stored as the difference (integers, scaled
// decimals; for floats of their 64-bit patterns, zigzagged) from the prediction. A short array of 2…4 numbers inside an array (a point, a face) equal to
// an earlier such row is stored as ROWREF: the index of that row among the literal rows; it updates no prediction. A point
// [x, z] equal to x and z of an earlier [x, y, z] row (a footprint vertex at a roof point) is ROWXZ, likewise.
// An OSM identity string ('w123', 'n45', 'r6') is OSM+prefix with its integer coded like an INT (class 0 of its field).
// Derived data: a legacy decimetre ring of `buildings` (row from index 9) that is exactly the delta-coded
// Math.round(10 ·) of the building's precise `buildingFootprints` ring is left out and rebuilt from it on decoding.
// The whole pack is gzipped on disk (<city>-<district>.bin.gz); readers accept it gzipped or already inflated.
const MAGIC = 'DMCVPAK2';
const T = { NULL: 0, FALSE: 1, TRUE: 2, STR: 3, OBJ: 4, ARR: 5, INT: 6, DEC: 7 /* 7…13 = 10^1…10^7 */, F64: 14, ROWREF: 15, ROWXZ: 16, OSM: 17 /* 17…19 = 'w', 'n', 'r' + integer */ };
const OSM_PREFIX = 'wnr', OSM_ID = /^([wnr])([1-9][0-9]{0,14})$/;
const POW = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7];
const MAX_INT = 2 ** 50;
const NT = T.F64 - T.INT + 1, CLASSES = 16, ROW_MAX = 4, SECTIONS = 8;
const P_NONE = 0, P_ARRAY = 1, P_FIELD = 2, P_NEXT = 3, P_LINE = 4;
// Signatures (stringified source geometry kept to validate the precomputed caches) this long or longer are stored as a hash.
const SIGNATURE_KEYS = new Set(['signature', 'authoritySignature']);
const SIGNATURE_MIN = 64;

/** 53-bit string hash (cyrb53), as 'h1:' + 14 hex digits. Not cryptographic: it detects a cache whose source changed,
 *  which is all the signature comparison does (a stale cache passes with probability 2^-53). */
function signatureHash(s) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 'h1:' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}
const HASHED = /^h1:[0-9a-f]{14}$/;
/** true when a stored signature (literal, or hashed by the pack) matches the signature the builder computed */
/** (stored) => signatureMatches(stored, computed) for one computed signature, its hash made once on first need */
export function signatureMatcher(computed) {
    let hash;
    return (stored) => typeof stored === 'string' && typeof computed === 'string' && (stored === computed || (HASHED.test(stored) && computed.length >= SIGNATURE_MIN && stored === (hash ??= signatureHash(computed))));
}
export const signatureMatches = (stored, computed) => typeof stored === 'string' && typeof computed === 'string' && (stored === computed || (HASHED.test(stored) && computed.length >= SIGNATURE_MIN && stored === signatureHash(computed)));

/** replace long signature strings by their hash (in place); returns the count */
export function hashSignatures(value) {
    let n = 0;
    const walk = (v) => {
        if (Array.isArray(v)) { for (const x of v) if (x && typeof x === 'object') walk(x); return; }
        for (const k in v) {
            const x = v[k];
            if (typeof x === 'string') { if (SIGNATURE_KEYS.has(k) && x.length >= SIGNATURE_MIN) { v[k] = signatureHash(x); n++; } }
            else if (x && typeof x === 'object') walk(x);
        }
    };
    if (value && typeof value === 'object') walk(value);
    return n;
}

// Fields: ids handed out in traversal order (identical when encoding and decoding). Field 0 is the root. Keys made of
// digits (records keyed by building index) share one field per parent, like array elements.
class Fields {
    constructor() { this.count = 1; this.arr = new Map(); this.key = new Map(); this.obj = new Map(); }
    element(f) { let c = this.arr.get(f); if (c === undefined) this.arr.set(f, c = this.count++); return c; }
    keys(f, shape, keys) {
        const k = f * 1048576 + shape; let c = this.obj.get(k);
        if (!c) {
            c = new Int32Array(keys.length);
            for (let i = 0; i < keys.length; i++) { const id = f + (/^\d+$/.test(keys[i]) ? '\u0001#' : '\u0002' + keys[i]); let x = this.key.get(id); if (x === undefined) this.key.set(id, x = this.count++); c[i] = x; }
            this.obj.set(k, c);
        }
        return c;
    }
}

// ------------------------------------------------------------------ encode
class Bytes {
    constructor(n = 1 << 16) { this.b = new Uint8Array(n); this.n = 0; }
    need(k) { if (this.n + k > this.b.length) { let m = this.b.length * 2; while (m < this.n + k) m *= 2; const nb = new Uint8Array(m); nb.set(this.b.subarray(0, this.n)); this.b = nb; } }
    byte(v) { this.need(1); this.b[this.n++] = v; }
    uvar(v) { this.need(8); while (v >= 128) { this.b[this.n++] = (v % 128) | 128; v = Math.floor(v / 128); } this.b[this.n++] = v; }
    ivar(v) { this.uvar(v < 0 ? -2 * v - 1 : 2 * v); }
    raw(u8) { this.need(u8.length); this.b.set(u8, this.n); this.n += u8.length; }
    out() { return this.b.subarray(0, this.n); }
}
const numTag = (v) => {
    if (Object.is(v, -0) || !Number.isFinite(v)) return [T.F64, 0];
    if (Number.isInteger(v)) return Math.abs(v) <= MAX_INT ? [T.INT, v] : [T.F64, 0];
    for (let p = 1; p < POW.length; p++) { const k = Math.round(v * POW[p]); if (Math.abs(k) <= MAX_INT && k / POW[p] === v) return [T.DEC + p - 1, k]; }
    return [T.F64, 0];
};
const varLen = (d) => { let z = d < 0 ? -2 * d - 1 : 2 * d, n = 1; while (z >= 128) { z = Math.floor(z / 128); n++; } return n; };
// float residual: the 64-bit patterns subtracted (mod 2^64) and zigzagged, as [lo, hi]; nearby values give small ones
const fsub = (lo, hi, r) => {
    if (!r) return [lo, hi];
    const dlo = (lo - r[0]) >>> 0, dhi = (hi - r[1] - (lo < r[0] ? 1 : 0)) >>> 0, sign = dhi >>> 31 ? 0xffffffff : 0;
    return [((dlo << 1) ^ sign) >>> 0, (((dhi << 1) | (dlo >>> 31)) ^ sign) >>> 0];
};
const fLen = ([lo, hi]) => (hi ? 4 + Math.ceil((32 - Math.clz32(hi)) / 8) : lo ? Math.ceil((32 - Math.clz32(lo)) / 8) : 0) + 0.5;
const DERIVED = '\u0000derived', LEGACY_HEAD = 9;
const legacyRing = (ring) => { const out = []; let px = 0, pz = 0; for (const p of ring) { const x = Math.round(p[0] * 10), z = Math.round(p[1] * 10); out.push(x - px, z - pz); px = x; pz = z; } return out; };
// returns a shallow copy without the derivable parts and a DERIVED record (the input is not changed)
function deriveOut(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.buildings) || !value.buildingFootprints || typeof value.buildingFootprints !== 'object') return value;
    if (DERIVED in value) throw new Error('district pack: reserved key in input');
    const rings = [], buildings = value.buildings.slice();
    for (const [k, ring] of Object.entries(value.buildingFootprints)) {
        const i = +k, row = buildings[i];
        if (!Number.isInteger(i) || String(i) !== k || !Array.isArray(row) || !Array.isArray(ring) || row.length !== LEGACY_HEAD + 2 * ring.length || !ring.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) continue;
        const want = legacyRing(ring);
        if (want.every((v, j) => Object.is(v, row[LEGACY_HEAD + j]))) { buildings[i] = row.slice(0, LEGACY_HEAD); rings.push(i); }
    }
    if (!rings.length) return value;
    return { ...value, buildings, [DERIVED]: { legacyRings: rings } };
}
function deriveIn(value) {
    if (!value || typeof value !== 'object' || !(DERIVED in value)) return value;
    const d = value[DERIVED]; delete value[DERIVED];
    for (const i of d.legacyRings || []) { const row = value.buildings[i], ring = value.buildingFootprints[i]; if (!row || row.length !== LEGACY_HEAD || !ring) throw new Error('district pack: bad derived ring ' + i); for (const v of legacyRing(ring)) row.push(v | 0); }
    return value;
}
/** encode a JSON value (as JSON.parse returns it) into the pack bytes (not gzipped) */
export function encodeDistrictPack(value) {
    value = deriveOut(value);
    const enc = new TextEncoder();
    const scratch = new DataView(new ArrayBuffer(8));
    const bits = (x) => { scratch.setFloat64(0, x, true); return [scratch.getUint32(0, true), scratch.getUint32(4, true)]; };
    // one traversal; pass 1 (choice = null) adds up the cost of each predictor per (field, class), pass 2 writes
    const run = (choice) => {
        const strings = new Map(), shapes = new Map(), fields = new Fields(), rows = new Map(), pairs = new Map(), cost = [];
        let rowCount = 0, lastRef = -1;
        const R = new Bytes();
        const ref = (tag, target) => { TG.byte(tag); R.ivar(target - lastRef - 1); lastRef = target; };
        const S = new Bytes(), SH = new Bytes(), TG = new Bytes(1 << 20), U = new Bytes(1 << 20), I = new Bytes(1 << 20), F = new Bytes(1 << 20);
        const sid = (s) => { let id = strings.get(s); if (id === undefined) { id = strings.size; strings.set(s, id); const u = enc.encode(s); S.uvar(u.length); S.raw(u); } return id; };
        const shid = (keys) => { const k = keys.join('\u0000'); let id = shapes.get(k); if (id === undefined) { id = shapes.size; shapes.set(k, id); SH.uvar(keys.length); for (const key of keys) SH.uvar(sid(key)); } return id; };
        const fieldPrev = new Map(); // (fc * NT + tag) → previous value (scaled integer, or [lo, hi])
        const fieldMax = new Map(); // field → largest integer so far
        const fieldPrev2 = new Map(); // (fc * NT + tag) → the value before the previous one (integers, decimals)
        const rowKey = (v) => { let k = ''; for (const x of v) k += (Object.is(x, -0) ? '-0' : x) + ','; return k; };
        // own: Map tag → previous value in this array (null for a number held by an object key)
        const number = (x, fc, own) => {
            const [t, k] = numTag(x); TG.byte(t);
            const ti = t - T.INT, a = own ? own.get(ti) : undefined, fkey = fc * NT + ti, f = fieldPrev.get(fkey);
            if (t === T.F64) {
                const [lo, hi] = bits(x);
                if (!choice) { const c = cost[fc] ||= [0, 0, 0, 0, 0]; c[P_LINE] += fLen([lo, hi]); c[P_NEXT] += fLen([lo, hi]); c[P_NONE] += fLen([lo, hi]); c[P_ARRAY] += fLen(fsub(lo, hi, a)); c[P_FIELD] += fLen(fsub(lo, hi, f)); }
                else {
                    const p = choice[fc], r = p === P_ARRAY ? a : p === P_FIELD ? f : undefined;
                    const [zl, zh] = fsub(lo, hi, r); F.need(8); scratch.setUint32(0, zl, true); scratch.setUint32(4, zh, true);
                    for (let b = 0; b < 8; b++) F.b[F.n + b] = scratch.getUint8(b);
                    F.n += 8;
                }
                if (own) own.set(ti, [lo, hi]); fieldPrev.set(fkey, [lo, hi]); return;
            }
            intPart(t, k, fc, own, a, fkey, f);
        };
        const intPart = (t, k, fc, own, a, fkey, f) => {
            const ti = t - T.INT, fld = Math.floor(fc / CLASSES), m = t === T.INT ? fieldMax.get(fld) : undefined, nx = m === undefined ? undefined : m + 1;
            const f2 = fieldPrev2.get(fkey), ln = f === undefined ? undefined : f2 === undefined ? f : 2 * f - f2;
            if (!choice) { const c = cost[fc] ||= [0, 0, 0, 0, 0]; c[P_NONE] += varLen(k); c[P_ARRAY] += varLen(a === undefined ? k : k - a); c[P_FIELD] += varLen(f === undefined ? k : k - f); c[P_NEXT] += varLen(nx === undefined ? k : k - nx); c[P_LINE] += varLen(ln === undefined ? k : k - ln); }
            else { const p = choice[fc], r = p === P_ARRAY ? a : p === P_FIELD ? f : p === P_NEXT ? nx : p === P_LINE ? ln : undefined; I.ivar(r === undefined ? k : k - r); }
            if (own) own.set(ti, k); if (f !== undefined) fieldPrev2.set(fkey, f); fieldPrev.set(fkey, k);
            if (t === T.INT && (m === undefined || k > m)) fieldMax.set(fld, k);
        };
        const walk = (v, field, inArray) => {
            if (v === null) TG.byte(T.NULL);
            else if (v === false) TG.byte(T.FALSE);
            else if (v === true) TG.byte(T.TRUE);
            else if (typeof v === 'string') {
                const m = OSM_ID.exec(v), k = m ? +m[2] : 0;
                if (m && k <= MAX_INT && String(k) === m[2]) { TG.byte(T.OSM + OSM_PREFIX.indexOf(m[1])); const fc = field * CLASSES, fkey = fc * NT; intPart(T.INT, k, fc, null, undefined, fkey, fieldPrev.get(fkey)); }
                else { TG.byte(T.STR); U.uvar(sid(v)); }
            }
            else if (typeof v === 'number') number(v, field * CLASSES, null);
            else if (Array.isArray(v)) {
                if (inArray && v.length >= 2 && v.length <= ROW_MAX && v.every((x) => typeof x === 'number')) {
                    const key = rowKey(v), at = rows.get(key);
                    if (at !== undefined) { ref(T.ROWREF, at); return; }
                    const xz = v.length === 2 ? pairs.get(key) : undefined;
                    if (xz !== undefined) { ref(T.ROWXZ, xz); return; }
                    if (v.length === 3) { const pk = rowKey([v[0], v[2]]); if (!pairs.has(pk)) pairs.set(pk, rowCount); }
                    rows.set(key, rowCount++);
                }
                TG.byte(T.ARR); U.uvar(v.length);
                const el = fields.element(field), own = new Map();
                for (let j = 0; j < v.length; j++) {
                    const x = v[j];
                    if (typeof x === 'number') number(x, el * CLASSES + Math.min(j, CLASSES - 1), own);
                    else walk(x, el, true);
                }
            } else if (typeof v === 'object') {
                const keys = Object.keys(v), s = shid(keys); TG.byte(T.OBJ); U.uvar(s);
                const kf = fields.keys(field, s, keys);
                for (let i = 0; i < keys.length; i++) walk(v[keys[i]], kf[i], false);
            } else throw new Error('district pack: unsupported value ' + typeof v);
        };
        walk(value, 0, false);
        return { cost, fieldCount: fields.count, parts: [S.out(), SH.out(), TG.out(), U.out(), I.out(), F.out()], refs: R.out() };
    };
    const pass1 = run(null);
    const choice = new Uint8Array(pass1.fieldCount * CLASSES);
    pass1.cost.forEach((c, fc) => { if (c) { let best = P_NONE; for (const p of [P_ARRAY, P_FIELD, P_NEXT, P_LINE]) if (c[p] < c[best]) best = p; choice[fc] = best; } });
    const { parts, fieldCount, refs } = run(choice);
    if (fieldCount !== pass1.fieldCount) throw new Error('district pack: passes disagree');
    // floats as byte planes (all first bytes, then all second bytes…): the sign / exponent bytes repeat and compress
    const fl = parts[5], n = fl.length / 8, planes = new Uint8Array(fl.length);
    for (let i = 0; i < n; i++) for (let b = 0; b < 8; b++) planes[b * n + i] = fl[i * 8 + b];
    parts[5] = planes; parts.push(choice, refs);
    const head = 8 + 4 + 4 * parts.length, total = head + parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total), dv = new DataView(out.buffer);
    out.set(enc.encode(MAGIC), 0); dv.setUint32(8, parts.length, true);
    let at = head; parts.forEach((p, i) => { dv.setUint32(12 + 4 * i, p.length, true); out.set(p, at); at += p.length; });
    return out;
}

// ------------------------------------------------------------------ decode
export const isDistrictPack = (u8) => !!u8 && u8.length >= 12 && String.fromCharCode(...u8.subarray(0, 8)) === MAGIC;
export const isGzip = (u8) => !!u8 && u8.length > 2 && u8[0] === 31 && u8[1] === 139;
/** decode pack bytes (not gzipped) back into the JSON value */
export const decodeDistrictPack = (u8) => parseDistrictPackText(decodeDistrictPackText(u8));
/** JSON.parse of decodeDistrictPackText's text, with the derived parts rebuilt: the district object */
export const parseDistrictPackText = (text) => deriveIn(JSON.parse(text));
/** pack bytes (not gzipped) → the JSON text JSON.parse turns into the district object (a worker can do this part) */
function decodeDistrictPackText(u8) {
    if (!isDistrictPack(u8)) throw new Error('not a district pack');
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), count = dv.getUint32(8, true);
    if (count !== SECTIONS) throw new Error('district pack: unknown section count ' + count);
    const sec = []; let at = 12 + 4 * count;
    for (let i = 0; i < count; i++) { const len = dv.getUint32(12 + 4 * i, true); sec.push([at, at + len]); at += len; }
    if (at !== u8.length || (sec[5][1] - sec[5][0]) % 8) throw new Error('district pack: truncated');
    const dec = new TextDecoder();
    const strings = [];
    { let p = sec[0][0]; const end = sec[0][1]; while (p < end) { let len = 0, m = 1, b; do { b = u8[p++]; len += (b & 127) * m; m *= 128; } while (b & 128); strings.push(dec.decode(u8.subarray(p, p + len))); p += len; } }
    const shapes = [];
    { let p = sec[1][0]; const end = sec[1][1]; const rd = () => { let v = 0, m = 1, b; do { b = u8[p++]; v += (b & 127) * m; m *= 128; } while (b & 128); return v; };
        while (p < end) { const n = rd(), keys = new Array(n); for (let i = 0; i < n; i++) keys[i] = strings[rd()]; shapes.push(keys); } }
    // floats: undo the byte planes into little-endian 32-bit words (lo, hi per float)
    const nf = (sec[5][1] - sec[5][0]) / 8, fw = new Uint32Array(nf * 2);
    { const b0 = sec[5][0]; for (let i = 0; i < nf; i++) {
        fw[2 * i] = (u8[b0 + i] | u8[b0 + nf + i] << 8 | u8[b0 + 2 * nf + i] << 16 | u8[b0 + 3 * nf + i] << 24) >>> 0;
        fw[2 * i + 1] = (u8[b0 + 4 * nf + i] | u8[b0 + 5 * nf + i] << 8 | u8[b0 + 6 * nf + i] << 16 | u8[b0 + 7 * nf + i] << 24) >>> 0; } }
    const choice = u8.subarray(sec[6][0], sec[6][1]), fieldCount = choice.length / CLASSES;
    let tp = sec[2][0], up = sec[3][0], ip = sec[4][0], fi = 0, rp = sec[7][0], lastRef = -1;
    const target = () => { let b = u8[rp++], v; if (b < 128) v = b; else { v = b & 127; let m = 128; do { b = u8[rp++]; v += (b & 127) * m; m *= 128; } while (b & 128); } return (lastRef += 1 + (v % 2 ? -(v + 1) / 2 : v / 2)); };
    const uv = () => { let b = u8[up++]; if (b < 128) return b; let v = b & 127, m = 128; do { b = u8[up++]; v += (b & 127) * m; m *= 128; } while (b & 128); return v; };
    const iv = () => { let b = u8[ip++], v; if (b < 128) v = b; else { v = b & 127; let m = 128; do { b = u8[ip++]; v += (b & 127) * m; m *= 128; } while (b & 128); } return v % 2 ? -(v + 1) / 2 : v / 2; };
    const scratch = new DataView(new ArrayBuffer(8));
    // predictions. Field slots: (fc * NT + tag), set once seen. Array slots: NT per array nesting depth; a slot is set when
    // its generation equals the generation of the array that owns it (nothing to clear when an array starts).
    const nslot = fieldCount * CLASSES * NT, fval = new Float64Array(nslot), fval2 = new Float64Array(nslot), fset2 = new Uint8Array(nslot), flo = new Uint32Array(nslot), fhi = new Uint32Array(nslot), fset = new Uint8Array(nslot);
    const MAXD = 256, aval = new Float64Array(MAXD * NT), alo = new Uint32Array(MAXD * NT), ahi = new Uint32Array(MAXD * NT), agen = new Int32Array(MAXD * NT);
    const fmax = new Float64Array(fieldCount), fmaxSet = new Uint8Array(fieldCount);
    let depth = 0, gen = 0, lastK = 0;
    const fields = new Fields(), rowList = [];
    // t: tag; fc: field * CLASSES + class; ab: array slot base for this tag (−1: held by an object key); g: array generation
    const num = (t, fc, ab, g) => {
        if (fc >= fieldCount * CLASSES) throw new Error('district pack: model too short');
        const ti = t - T.INT, fs = fc * NT + ti, p = choice[fc], as = ab + ti, aSet = ab >= 0 && agen[as] === g;
        if (t === T.F64) {
            let lo = fw[2 * fi], hi = fw[2 * fi + 1]; fi++;
            if (p === P_ARRAY ? aSet : p === P_FIELD && fset[fs]) {
                const rl = p === P_ARRAY ? alo[as] : flo[fs], rh = p === P_ARRAY ? ahi[as] : fhi[fs], m = lo & 1 ? 0xffffffff : 0;
                const dlo = (((lo >>> 1) | (hi << 31)) ^ m) >>> 0, dhi = ((hi >>> 1) ^ m) >>> 0, sl = (rl + dlo) >>> 0;
                hi = (rh + dhi + (sl < rl ? 1 : 0)) >>> 0; lo = sl;
            }
            if (ab >= 0) { alo[as] = lo; ahi[as] = hi; agen[as] = g; }
            flo[fs] = lo; fhi[fs] = hi; fset[fs] = 1;
            scratch.setUint32(0, lo, true); scratch.setUint32(4, hi, true); return scratch.getFloat64(0, true);
        }
        let k = iv();
        const fld = (fc - fc % CLASSES) / CLASSES;
        if (p === P_ARRAY) { if (aSet) k += aval[as]; } else if (p === P_FIELD) { if (fset[fs]) k += fval[fs]; } else if (p === P_NEXT) { if (t === T.INT && fmaxSet[fld]) k += fmax[fld] + 1; } else if (p === P_LINE && fset[fs]) k += fset2[fs] ? 2 * fval[fs] - fval2[fs] : fval[fs];
        if (t === T.INT && (!fmaxSet[fld] || k > fmax[fld])) { fmax[fld] = k; fmaxSet[fld] = 1; }
        if (ab >= 0) { aval[as] = k; agen[as] = g; }
        if (fset[fs]) { fval2[fs] = fval[fs]; fset2[fs] = 1; }
        fval[fs] = k; fset[fs] = 1;
        lastK = k;
        return t === T.INT ? k : k / POW[ti];
    };
    // The decoder writes the JSON text and JSON.parse builds the objects: the same objects, and in the same V8
    // representation, as the JSON file gave (arrays built here were boxed / holey and objects had other hidden classes,
    // which made the builder's and the traffic's geometry tests up to 3× slower). The text is written as UTF-8 bytes into
    // one buffer and decoded once (string concatenation of the whole tree spent most of the decode in the collector).
    let buf = new Uint8Array(Math.max(1 << 16, u8.length * 4)), bp = 0;
    const room = (n) => { if (bp + n > buf.length) { let c = buf.length * 2; while (c < bp + n) c *= 2; const b = new Uint8Array(c); b.set(buf.subarray(0, bp)); buf = b; } };
    const ascii = (s) => { room(s.length); for (let i = 0; i < s.length; i++) buf[bp++] = s.charCodeAt(i); }; // number text, punctuation
    const enc = new TextEncoder(), jstr = new Array(strings.length), J = (id) => jstr[id] ?? (jstr[id] = enc.encode(JSON.stringify(strings[id])));
    const put = (b) => { room(b.length); buf.set(b, bp); bp += b.length; };
    const shapeKeys = shapes.map((keys) => keys.map((k) => enc.encode(JSON.stringify(k) + ':')));
    const fmt = (v) => (v === 0 && 1 / v < 0 ? '-0' : '' + v);
    // fmt(v) as bytes; a small non-negative integer is written digit by digit (the same digits '' + v gives)
    const DIG = new Uint8Array(16);
    const putNum = (v) => {
        if (v >= 0 && v <= 0x7fffffff && (v | 0) === v && !(v === 0 && 1 / v < 0)) { let n = 0, k = v; do { const q = (k / 10) | 0; DIG[n++] = 48 + k - q * 10; k = q; } while (k); room(n); while (n) buf[bp++] = DIG[--n]; }
        else ascii(fmt(v));
    };
    // a scaled decimal k / 10^p as text: the integer's digits with the point put in. JSON.parse of that decimal gives
    // the correctly rounded double, which is k / 10^p (also correctly rounded), and integer formatting is much faster
    const decText = (k, p) => { const neg = k < 0; let d = '' + (neg ? -k : k); if (d.length <= p) d = '0'.repeat(p - d.length + 1) + d; return (neg ? '-' : '') + d.slice(0, d.length - p) + '.' + d.slice(d.length - p); };
    // decText(k, p) as bytes, digit by digit for |k| < 2^31: sign, the digits before the point (at least '0'), the point,
    // p digits after it (zero padded)
    const putDec = (k, p) => {
        const neg = k < 0, a = neg ? -k : k;
        if (!(a <= 0x7fffffff && (a | 0) === a)) { ascii(decText(k, p)); return; }
        let n = 0, m = a; do { const q = (m / 10) | 0; DIG[n++] = 48 + m - q * 10; m = q; } while (m);
        room(n + p + 3);
        if (neg) buf[bp++] = 45;
        if (n <= p) { buf[bp++] = 48; buf[bp++] = 46; for (let z = n; z < p; z++) buf[bp++] = 48; while (n) buf[bp++] = DIG[--n]; }
        else { while (n > p) buf[bp++] = DIG[--n]; buf[bp++] = 46; while (n) buf[bp++] = DIG[--n]; }
    };
    const putNumText = (t, v) => { if (t === T.INT || t === T.F64) putNum(v); else putDec(lastK, t - T.INT); };
    const B = (c) => { room(1); buf[bp++] = c; }, Q = 34, COMMA = 44;
    const write = (field, inArray) => {
        const t = u8[tp++];
        if (t >= T.INT && t <= T.F64) { putNumText(t, num(t, field * CLASSES, -1, 0)); return; }
        switch (t) {
            case T.NULL: ascii('null'); return;
            case T.FALSE: ascii('false'); return;
            case T.TRUE: ascii('true'); return;
            case T.STR: put(J(uv())); return;
            case T.OSM: case T.OSM + 1: case T.OSM + 2: B(Q); B(OSM_PREFIX.charCodeAt(t - T.OSM)); { const k = num(T.INT, field * CLASSES, -1, 0); putNum(k === 0 ? 0 : k); } B(Q); return; // (as String(k): -0 → 0)
            case T.OBJ: {
                const sh = uv(), keys = shapes[sh], sk = shapeKeys[sh], kf = fields.keys(field, sh, keys);
                B(123);
                for (let i = 0; i < keys.length; i++) { if (i) B(COMMA); put(sk[i]); write(kf[i], false); }
                B(125); return;
            }
            case T.ROWREF: { const r = rowList[target()]; if (!r || !inArray) throw new Error('district pack: bad row reference'); B(91); for (let i = 0; i < r.length; i++) { if (i) B(COMMA); putNum(r[i]); } B(93); return; }
            case T.ROWXZ: { const r = rowList[target()]; if (!r || r.length !== 3 || !inArray) throw new Error('district pack: bad row reference'); B(91); putNum(r[0]); B(COMMA); putNum(r[2]); B(93); return; }
            case T.ARR: {
                const n = uv(), d = ++depth;
                if (d >= MAXD) throw new Error('district pack: nesting too deep');
                const g = ++gen, ab = d * NT, el = fields.element(field), base = el * CLASSES;
                let numeric = inArray && n >= 2 && n <= ROW_MAX;
                const nums = numeric ? [] : null;
                B(91);
                for (let j = 0; j < n; j++) {
                    const x = u8[tp];
                    if (j) B(COMMA);
                    if (x >= T.INT && x <= T.F64) { tp++; const v = num(x, base + (j < CLASSES ? j : CLASSES - 1), ab, g); if (nums) nums.push(v); putNumText(x, v); }
                    else { write(el, true); numeric = false; }
                }
                depth--;
                if (numeric) rowList.push(nums);
                B(93); return;
            }
            default: throw new Error('district pack: bad tag ' + t + ' at ' + (tp - 1));
        }
    };
    write(0, false);
    if (tp !== sec[2][1] || up !== sec[3][1] || ip !== sec[4][1] || fi !== nf || rp !== sec[7][1]) throw new Error('district pack: trailing data');
    return dec.decode(buf.subarray(0, bp));
}

/** gunzip with the platform's DecompressionStream (browsers, Node 18+); bytes that are not gzipped pass through */
async function inflate(u8) {
    if (!isGzip(u8)) return u8;
    return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
/** district data file name for a city / district: '<city>-<district>.bin.gz' (the legacy corridor maps stay JSON) */
export const districtFile = (cityId, districtId) => districtId ? `${cityId}-${districtId}.bin.gz` : `${cityId}.json`;
/** fetch and decode a district pack (served gzipped as is, or inflated by a server that sent Content-Encoding) */
export async function fetchDistrictPackText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`district data HTTP ${res.status}: ${url}`);
    return decodeDistrictPackText(await inflate(new Uint8Array(await res.arrayBuffer())));
}
export async function fetchDistrictPack(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`district data HTTP ${res.status}: ${url}`);
    return decodeDistrictPack(await inflate(new Uint8Array(await res.arrayBuffer())));
}
