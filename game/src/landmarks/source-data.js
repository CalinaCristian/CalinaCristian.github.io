// Exact OSM source massing of the Bucharest landmarks, in authored metres (generated data, no imagery; spec 22 moved it
// out of game/src into game/data/landmarks/):
//  - BUCHAREST_SOURCE_MASSES: source part massing (cathedral, regal, victoria, marriott, otp), from
//    research/landmark-source-bucharest.json
//  - CEC_SOURCE_MASSES: exact CEC source solids and derived visible surfaces, from the linked source ledger
//    (research/landmark-cec-source-assemblies.json)
// Read once while the landmarks module loads (top-level await, both files in parallel): fetch in the browser, the file
// system in Node (tools and tests import the modules from file: URLs).
const url = (file) => new URL(`../../data/landmarks/${file}`, import.meta.url);
const load = import.meta.url.startsWith('file:')
    ? async (file) => JSON.parse((await import('node:fs')).readFileSync(url(file), 'utf8'))
    : async (file) => { const r = await fetch(url(file)); if (!r.ok) throw new Error(`landmark data ${file}: HTTP ${r.status}`); return r.json(); };
export const [BUCHAREST_SOURCE_MASSES, CEC_SOURCE_MASSES] = await Promise.all([load('bucharest-source-masses.json'), load('cec-source-masses.json')]);
