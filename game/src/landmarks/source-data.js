// Exact OSM source massing of the Bucharest landmarks, in authored metres (generated data, no imagery; spec 22 moved it
// out of game/src into game/data/landmarks/):
//  - bucharestSourceMasses(): source part massing (cathedral, regal, victoria, marriott, otp), from
//    research/landmark-source-bucharest.json
//  - cecSourceMasses(): exact CEC source solids and derived visible surfaces, from the linked source ledger
//    (research/landmark-cec-source-assemblies.json)
// Browser: both files are fetched in parallel while the landmarks module loads (top-level await), so the builders read
// them synchronously. Node (tools and tests import the modules from file: URLs): read on first use, so the tools that
// copy game/src alone to build a district (they only need the LANDMARKS list) keep working.
const FILES = { bucharest: 'bucharest-source-masses.json', cec: 'cec-source-masses.json' };
const url = (file) => new URL(`../../data/landmarks/${file}`, import.meta.url);
const data = {};
const fs = import.meta.url.startsWith('file:') ? await import('node:fs') : null;
if (!fs) await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
    const r = await fetch(url(file));
    if (!r.ok) throw new Error(`landmark data ${file}: HTTP ${r.status}`);
    data[key] = await r.json();
}));
const get = (key) => data[key] || (data[key] = JSON.parse(fs.readFileSync(url(FILES[key]), 'utf8')));
export const bucharestSourceMasses = () => get('bucharest');
export const cecSourceMasses = () => get('cec');
