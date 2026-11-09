// Build the overview's source inventory. Development tool only; the site serves static JSON.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => readFileSync(resolve(root, p), 'utf8');
const { evidenceAsset, evidenceReport } = await import('data:text/javascript;base64,' + Buffer.from(read('game/overview/evidence-paths.js')).toString('base64'));
const sourceSha = process.argv.find(x => x.startsWith('--source='))?.slice(9) || execFileSync('git', ['rev-parse','HEAD'], {cwd:root, encoding:'utf8'}).trim();
const citySource = read('game/src/cities.js');
const { CITIES, CHAPTERS } = await import('data:text/javascript;base64,' + Buffer.from(citySource).toString('base64'));
const landmarkSource = read('game/src/landmarks.js');
const anchors = Object.fromEntries([...landmarkSource.split('const A = {')[1].split('\n};')[0].matchAll(/(\w+): \[(-?[\d.]+),\s*(-?[\d.]+),/g)].map(m=>[m[1],{lat:+m[2],lon:+m[3]}]));
const landmarks = [...landmarkSource.matchAll(/^\s+L\('([^']+)', '([^']+)', '((?:\\.|[^'])+)', .*?, (b\w+)(?:, \{|\))/gm)].map(m => ({id:m[1],city:m[2],name:m[3].replace(/\\'/g,"'"),builder:m[4],...anchors[m[1]]}));
// Each L() call remains on one line. Avoid requiring a WebGL/browser module during generation.
if (landmarks.length !== 61) throw new Error(`Review catalogue extraction: expected 61 landmarks, found ${landmarks.length}`);
const strictEvidence = process.argv.includes('--require-complete-evidence');
for (const lm of landmarks) {
    const path = `evidence/landmarks/${lm.city}/${lm.id}.json`, full = resolve(root, 'game/overview', path);
    if (!existsSync(full)) { if (strictEvidence) throw new Error(`Missing dedicated landmark evidence: ${lm.id}`); continue; }
    const record = JSON.parse(readFileSync(full, 'utf8'));
    if (record.schemaVersion !== 1 || record.id !== lm.id || record.city !== lm.city) throw new Error(`Landmark evidence identity: ${path}`);
    if (strictEvidence && (!record.sources?.length || !record.captures?.length || !record.checks?.length)) throw new Error(`Incomplete evidence: ${path}`);
    const collections = [{...record, captures:record.captures || []}, ...(record.historicalCollections || [])];
    for (const collection of collections) for (const capture of collection.captures || []) {
        if (!evidenceAsset(capture.image, {kind:'landmark',id:lm.id})) throw new Error(`Unsafe/missing game capture path in ${path}`);
        const bytes = readFileSync(resolve(root, 'game/overview', capture.image));
        if (createHash('sha256').update(bytes).digest('hex') !== capture.sha256) throw new Error(`Capture hash mismatch: ${capture.image}`);
        if (!/^[a-f0-9]{40}$/.test(capture.sourceCommit || collection.sourceCommit || '')) throw new Error(`Missing capture source: ${capture.image}`);
    }
    lm.evidence = path;
}
const { MENU_AVAILABLE, RECOMMENDED_SPOTS, PARK_WALKS } = await import('data:text/javascript;base64,' + Buffer.from(read('game/src/spot-availability.js')).toString('base64'));
const spotsSource = read('game/src/spots/index.js');
const spotBlock = spotsSource.split('export const SPOTS_ALL = [')[1].split('\n];')[0];
const spots = [...spotBlock.matchAll(/\{ id: '([^']+)', city: '([^']+)', (?:area: '([^']+)', )?name: '((?:\\.|[^'])+)', .*?scene: '([^']+)'/g)].map(m=>({id:m[1],city:m[2],area:m[3]||null,name:m[4].replace(/\\'/g,"'"),scene:m[5]}));
const readyBlock = spotsSource.split('export const READY = new Set([')[1].split(']);')[0];
const ready = [...readyBlock.matchAll(/'([a-z][a-z-]+)'/g)].map(m=>m[1]);
for (const spot of spots) {
    spot.historicalReady = ready.includes(spot.id);
    spot.menuAvailable = MENU_AVAILABLE.has(spot.id);
    spot.menuTier = RECOMMENDED_SPOTS.has(spot.id) ? 'recommended' : PARK_WALKS.has(spot.id) ? 'park' : 'destination';
    const recordPath = `evidence/spots/${spot.id}.json`, full = resolve(root, 'game/overview', recordPath);
    if (!existsSync(full)) { if (strictEvidence) throw new Error(`Missing dedicated destination evidence: ${spot.id}`); continue; }
    const record = JSON.parse(readFileSync(full, 'utf8'));
    if (record.schemaVersion !== 1 || record.id !== spot.id || record.city !== spot.city || record.name !== spot.name) throw new Error(`Destination evidence identity: ${recordPath}`);
    if (strictEvidence && (!record.sources?.length || !record.captures?.length || !record.checks?.length)) throw new Error(`Incomplete destination evidence: ${recordPath}`);
    const collections = [{...record, captures:record.captures || []}, ...(record.historicalCollections || [])];
    for (const collection of collections) for (const capture of collection.captures || []) {
        if (!evidenceAsset(capture.image, {kind:'spot',id:spot.id})) throw new Error(`Unsafe/missing game capture path in ${recordPath}`);
        const bytes = readFileSync(resolve(root, 'game/overview', capture.image));
        if (createHash('sha256').update(bytes).digest('hex') !== capture.sha256) throw new Error(`Capture hash mismatch: ${capture.image}`);
        if (!/^[a-f0-9]{40}$/.test(capture.sourceCommit || collection.sourceCommit || '')) throw new Error(`Missing capture source: ${capture.image}`);
    }
    for (const proof of record.nativeProofs || []) {
        if (!evidenceReport(proof.report) || !existsSync(resolve(root,'game/overview',proof.report))) throw new Error(`Unsafe/missing native proof in ${recordPath}`);
        const proofBytes = readFileSync(resolve(root,'game/overview',proof.report));
        if (createHash('sha256').update(proofBytes).digest('hex') !== proof.sha256) throw new Error(`Native proof hash mismatch: ${proof.report}`);
        const explicitlyUnknown = proof.sourceCommit === null && proof.passed === null && proof.provenance === 'historical-source-unrecorded';
        if (!explicitlyUnknown && !/^[a-f0-9]{40}$/.test(proof.sourceCommit || '')) throw new Error(`Missing native proof source in ${recordPath}`);
    }
    spot.evidence = recordPath;
}
const districts = Object.entries(CITIES).flatMap(([city,c])=>Object.entries(c.districts).map(([id,d])=>({id,city,name:d.name,label:d.label,landmarks:d.landmarks,scenery:d.scenery||[],chapters:CHAPTERS.filter(x=>x.city===city && x.district===id).map(x=>({id:x.id,title:x.title,year:x.year})),data:`game/data/${city}-${id}.json`})));
const paths = ['AGENTS.md','README.md','specs/README.md','specs/00-vision.md','specs/01-architecture.md','specs/STATUS.md','specs/12-buildings-streetscape.md','specs/13-traffic.md','specs/15-tourist-spots.md','specs/18-weather-lighting.md','specs/19-qa-harness.md','game/index.html','game/data/README.md','tools/osm/build-data.mjs','tools/aerial/README.md','game/src/main.js','game/src/world.js','game/src/cities.js','game/src/geobuild.js','game/src/buildings.js','game/src/archetypes.js','game/src/landmarks.js','game/src/render.js','game/src/weather.js','game/src/traffic.js','game/src/signals.js','game/src/crowd.js','game/src/vehicles.js','game/src/onfoot.js','game/src/input.js','game/src/nav.js','game/src/minimap.js','game/src/worldmap.js','game/src/explore.js','game/src/drone.js','game/src/photo.js','game/src/save.js','game/src/achievements.js','game/src/data.js','game/src/spots/index.js','game/src/spots/osm.js','game/src/spots/tour.js','game/src/spots/bike.js','game/src/football.js','game/src/office.js','game/src/flight.js','game/src/globe.js','game/src/trees.js','game/src/water.js','game/src/audio.js','game/src/telemetry-game.js','public/telemetry.js'];
const walk = (dir, pattern = /\.js$/) => readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`,pattern):pattern.test(e.name)?[`${dir}/${e.name}`]:[]);
const allPaths = [...new Set([...paths,...walk('game/src',/\.(?:js|mjs)$/),...walk('game/overview',/\.(?:js|mjs|css|html|json)$/).filter(p=>p!=='game/overview/inventory.json')])];
const sources = allPaths.map(path=>({path,sha256:createHash('sha256').update(read(path)).digest('hex')}));
for (const source of sources) {
    const committed = execFileSync('git',['show',`${sourceSha}:${source.path}`],{cwd:root,maxBuffer:20*1024*1024});
    if(createHash('sha256').update(committed).digest('hex') !== source.sha256) throw new Error(`Source ${source.path} differs from ${sourceSha}. Commit game/docs changes before pinning provenance.`);
}
const comparisonLocations = JSON.parse(read('game/overview/comparison-data/catalog.json')).locations.map(place=>place.id);
const data = {comparisonLocations,sourceSha,reviewedOn:'2026-11-09',repository:'https://github.com/CalinaCristian/CalinaCristian.github.io',counts:{districts:districts.length,chapters:CHAPTERS.length,landmarks:landmarks.length,landmarkBuilders:new Set(landmarks.map(x=>x.builder)).size,landmarkEvidence:landmarks.filter(lm=>lm.evidence).length,spots:spots.length,spotEvidence:spots.filter(s=>s.evidence).length,scenes:new Set(spots.map(s=>s.scene)).size,historicalReady:ready.length,menuAvailable:MENU_AVAILABLE.size,achievements:[...read('game/src/data.js').split('export const ACHIEVEMENTS = [')[1].split('\n];')[0].matchAll(/\{ id: '/g)].length},districts,landmarks,spots,sources};
writeFileSync(resolve(root,'game/overview/inventory.json'),JSON.stringify(data,null,2)+'\n');
process.stdout.write(JSON.stringify(data.counts)+'\n');
