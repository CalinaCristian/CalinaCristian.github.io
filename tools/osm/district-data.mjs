// Read / write district data files from Node tools. Chapter districts ship as lossless binary packs
// (game/data/<city>-<district>.bin.gz, codec in game/src/district-pack.js); the legacy corridor maps stay JSON.
//   readDistrictData(file)        → the object JSON.parse returned for the original JSON (signatures hashed)
//   writeDistrictData(obj, file)  → .bin.gz: pack + gzip -9, verified by decoding; .json: plain JSON
// A path to '<name>.json' that does not exist resolves to '<name>.bin.gz', so tools written for the JSON files keep working.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { decodeDistrictPack, encodeDistrictPack, hashSignatures, isGzip, isDistrictPack } from '../../game/src/district-pack.js';

const toPath = (f) => (f instanceof URL ? f.pathname.replace(/^\/([A-Za-z]:)/, '$1') : String(f));
export function resolveDistrictFile(file) {
    const p = toPath(file);
    if (fs.existsSync(p) || !p.endsWith('.json')) return p;
    const packed = p.slice(0, -5) + '.bin.gz';
    return fs.existsSync(packed) ? packed : p;
}
/** decode file bytes: a pack (gzipped or not) or JSON */
export function parseDistrictBytes(buf) {
    let u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (isGzip(u8)) u8 = zlib.gunzipSync(u8);
    if (isDistrictPack(u8)) return decodeDistrictPack(u8);
    return JSON.parse(Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('utf8'));
}
export const readDistrictData = (file) => parseDistrictBytes(fs.readFileSync(resolveDistrictFile(file)));
/** the bytes of a district pack for an object (signatures hashed on a copy; the input is left as it is) */
export function packDistrictData(obj) {
    const value = structuredClone(obj);
    hashSignatures(value);
    const gz = zlib.gzipSync(encodeDistrictPack(value), { level: 9, memLevel: 9 });
    if (!isDeepStrictEqual(decodeDistrictPack(zlib.gunzipSync(gz)), value)) throw new Error('district pack does not round-trip');
    return gz;
}
export function writeDistrictData(obj, file) {
    const p = toPath(file);
    const bytes = p.endsWith('.bin.gz') ? packDistrictData(obj) : Buffer.from(JSON.stringify(obj));
    fs.writeFileSync(p, bytes);
    return bytes.length;
}
