#!/usr/bin/env node
// Metadata-only append; never rebuild roads, platforms, buildings or vegetation.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseFiles } from './parse-osm.mjs';
import { snapshotPublicTransportSources, publicTransportCatalogue } from './public-transport-sources.mjs';
const args = {}; for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.in || !args.out || !args.tiles || path.resolve(args.in) === path.resolve(args.out)) throw Error('Use --in prepared.json --out NEW.json --tiles DIRECTORY');
if (fs.existsSync(args.out)) throw Error('Refuse overwrite: ' + args.out);
const files = fs.readdirSync(args.tiles).filter(f => f.endsWith('.xml') && (!args.prefix || f.startsWith(args.prefix))).sort().map(f => path.join(args.tiles, f));
const ledger = files.map(f => ({ file: path.basename(f), sha256: createHash('sha256').update(fs.readFileSync(f)).digest('hex') }));
const original = fs.readFileSync(args.in, 'utf8'), doc = JSON.parse(original);
const meta = publicTransportCatalogue(doc, snapshotPublicTransportSources(parseFiles(files)), ledger);
if (doc.publicTransportSources && JSON.stringify(doc.publicTransportSources) !== JSON.stringify(meta.publicTransportSources)) throw Error('Existing transit metadata differs; review an explicit refresh');
const end = original.lastIndexOf('}'), result = doc.publicTransportSources ? original : original.slice(0, end) + ',' + JSON.stringify(meta).slice(1) + original.slice(end + 1);
fs.writeFileSync(args.out, result);
console.log(JSON.stringify({ output: args.out, changedFields: doc.publicTransportSources ? [] : ['publicTransportSources'], originalPrefixBytesPreserved: true, coverage: meta.publicTransportSources.coverage }, null, 2));
