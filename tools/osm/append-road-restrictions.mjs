#!/usr/bin/env node
// Append a verified raw restriction catalogue without rebuilding any geometry.
import fs from 'node:fs';
import path from 'node:path';
import {createHash}from 'node:crypto';
import {parseFiles}from './parse-osm.mjs';
import {snapshotRoadRestrictionSources,roadRestrictionCatalogue}from './road-restrictions.mjs';
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
if(!args.in||!args.out||!args.tiles||path.resolve(args.in)===path.resolve(args.out))throw Error('Use --in prepared.json --out NEW.json --tiles DIRECTORY');
if(fs.existsSync(args.out))throw Error('Refuse overwrite: '+args.out);
const files=fs.readdirSync(args.tiles).filter(f=>f.endsWith('.xml')).sort().map(f=>path.join(args.tiles,f));
const ledger=files.map(f=>({file:path.basename(f),sha256:createHash('sha256').update(fs.readFileSync(f)).digest('hex')}));
const doc=JSON.parse(fs.readFileSync(args.in)),snapshot=snapshotRoadRestrictionSources(parseFiles(files));
const meta=roadRestrictionCatalogue(doc,snapshot,ledger,args.district||doc.district?.id);
fs.writeFileSync(args.out,JSON.stringify({...doc,...meta}));
console.log(JSON.stringify({output:args.out,changedFields:Object.keys(meta),coverage:meta.roadRestrictionCoverage},null,2));
