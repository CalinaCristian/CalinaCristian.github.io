import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';

// Read registry declarations without importing browser-only game modules or building models.
export function sourceSnapshot(root) {
    const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
    const cityFile = 'game/src/cities.js', landmarkFile = 'game/src/landmarks.js', spotFile = 'game/src/spots/index.js';
    const citiesText = read(cityFile), landmarkText = read(landmarkFile), spotsText = read(spotFile);
    const { cities, chapters } = vm.runInNewContext(citiesText.replace(/\bexport /g, '') + '\n;({cities:CITIES,chapters:CHAPTERS})', {}, { timeout: 1000 });
    const districts = Object.entries(cities).flatMap(([city, c]) => Object.entries(c.districts).map(([id, d]) => ({
        city, id, name: d.name, bbox: Array.from(d.bbox), landmarks: Array.from(d.landmarks), scenery: Array.from(d.scenery || []),
        chapters: chapters.filter((ch) => ch.city === city && ch.district === id).map((ch) => ch.id),
    })));
    const functions = Array.from(landmarkText.matchAll(/^function (b\w+)\(/gm), (m) => m[1]);
    const context = Object.fromEntries(functions.map((name) => [name, name]));
    const anchorSource = landmarkText.slice(landmarkText.indexOf('const A = {'), landmarkText.indexOf('\nfunction L('));
    const anchors = vm.runInNewContext(anchorSource + '\n;A', {}, { timeout: 1000 });
    context.L = (id, city, name, osmNames, radiusM, sourceFunction, flags = {}) => ({ id, city, name, osmNames, radiusM, sourceFunction, backdrop: !!flags.backdrop, ...flags });
    const registry = landmarkText.slice(landmarkText.indexOf('export const LANDMARKS = ['), landmarkText.indexOf('\n];', landmarkText.indexOf('export const LANDMARKS = [')) + 3);
    const landmarks = vm.runInNewContext(registry.replace('export ', '') + '\n;LANDMARKS', context, { timeout: 1000 }).map((lm) => {
        const fnOffset = landmarkText.indexOf(`function ${lm.sourceFunction}(`), lines = landmarkText.slice(0, fnOffset).trimEnd().split('\n');
        const comments = [];
        for (let i = lines.length - 1; i >= 0 && lines[i].trim().startsWith('//'); i--) comments.unshift(lines[i].replace(/^\s*\/\/\s?/, ''));
        const memberships = districts.filter((d) => d.city === lm.city && d.landmarks.includes(lm.id)).map((d) => ({ district: d.id, scenery: d.scenery.includes(lm.id) }));
        return { ...lm, lat: anchors[lm.id][0], lon: anchors[lm.id][1], sourceLine: lines.length + 1,
            sourceCitations: comments.filter((line, i) => line.startsWith('Src:') || (i > 0 && comments[i - 1].startsWith('Src:') && !comments[i - 1].endsWith(';'))),
            sourceCaveats: comments.filter((line) => /assum|estimat|approx|no facade|low confidence|unverif|research only/i.test(line)),
            districts: memberships };
    });
    const registryPrefix = spotsText.slice(spotsText.indexOf('export const SPOTS_ALL = ['), spotsText.indexOf('\nconst showAll ='));
    const spotContext = vm.runInNewContext(registryPrefix.replace(/\bexport /g, '') + '\n;({all:SPOTS_ALL,dev:DEV_SPOTS,ready:Array.from(READY)})', {}, { timeout: 1000 });
    const spots = [...spotContext.all.map((s) => ({ ...s, registry: 'SPOTS_ALL' })), ...spotContext.dev.map((s) => ({ ...s, registry: 'DEV_SPOTS' }))].map(({ blurb, kind, ...s }) => ({ ...s, ready: spotContext.ready.includes(s.id) }));
    const scenes = [...new Set(spots.map((s) => s.scene || s.id))].map((id) => {
        const file = `game/src/spots/scenes/${id}.js`, text = read(file);
        const sharedHelpers = Array.from(text.matchAll(/from ['"]([^'"]+)['"]/g), (m) => path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1]))).filter((p) => /\/(buc|backdrop|sea-common|bel-common|props|kit|osm|ground|people)\.js$/.test(p));
        return { id, file, members: spots.filter((s) => (s.scene || s.id) === id).map((s) => s.id), sharedHelpers };
    });
    return JSON.parse(JSON.stringify({
        hashes: Object.fromEntries([[cityFile, citiesText], [landmarkFile, landmarkText], [spotFile, spotsText]].map(([file, text]) => [file, crypto.createHash('sha256').update(text).digest('hex')])),
        districts, landmarks, spots, scenes,
    }));
}
