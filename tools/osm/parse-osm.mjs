// Minimal streaming-ish OSM XML (API 0.6) parser: reads tile files one by one,
// dedupes elements by id and returns compact maps. No dependencies.
import fs from 'node:fs';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export const decode = (s) => s.indexOf('&') < 0 ? s : s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e] ?? m;
});

const attr = (s, name) => {
    const i = s.indexOf(' ' + name + '="');
    if (i < 0) return null;
    const j = i + name.length + 3;
    return s.slice(j, s.indexOf('"', j));
};
const TAG_RE = /<tag k="([^"]*)" v="([^"]*)"\s*\/>/g;
const ND_RE = /<nd ref="(\d+)"\s*\/>/g;
const MEM_RE = /<member type="(\w+)" ref="(\d+)" role="([^"]*)"\s*\/>/g;
function tags(body) {
    let t = null, m;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(body))) { (t ||= {})[decode(m[1])] = decode(m[2]); }
    return t;
}

/**
 * Parse a list of OSM XML files.
 * Returns { nodes: Map<id,[lat,lon]>, ntags: Map<id,tags>, ways: Map<id,{nodes:number[],tags}>, rels: Map<id,{members,tags}> }
 */
export function parseFiles(files, log = () => { }) {
    const maps = { nodes: new Map(), ntags: new Map(), ways: new Map(), rels: new Map() };
    for (const f of files) {
        parseInto(fs.readFileSync(f, 'utf8'), maps);
        log(`parsed ${f.split('/').pop()}  nodes=${maps.nodes.size} ways=${maps.ways.size} rels=${maps.rels.size}`);
    }
    return maps;
}

/** Parse one XML document into existing maps (first occurrence of an id wins). */
export function parseInto(xml, { nodes, ntags, ways, rels }) {
    {
        let pos = 0;
        for (; ;) {
            const lt = xml.indexOf('<', pos);
            if (lt < 0) break;
            // node
            if (xml.startsWith('<node ', lt)) {
                const end = xml.indexOf('>', lt);
                const head = xml.slice(lt, end + 1);
                const id = +attr(head, 'id');
                if (!nodes.has(id)) nodes.set(id, [+attr(head, 'lat'), +attr(head, 'lon')]);
                if (head.endsWith('/>')) { pos = end + 1; continue; }
                const close = xml.indexOf('</node>', end);
                const t = tags(xml.slice(end, close));
                if (t && !ntags.has(id)) ntags.set(id, t);
                pos = close + 7; continue;
            }
            if (xml.startsWith('<way ', lt)) {
                const end = xml.indexOf('>', lt);
                const head = xml.slice(lt, end + 1);
                const id = +attr(head, 'id');
                if (head.endsWith('/>')) { pos = end + 1; continue; }
                const close = xml.indexOf('</way>', end);
                if (!ways.has(id)) {
                    const body = xml.slice(end, close);
                    const nds = []; let m; ND_RE.lastIndex = 0;
                    while ((m = ND_RE.exec(body))) nds.push(+m[1]);
                    ways.set(id, { nodes: nds, tags: tags(body) || {} });
                }
                pos = close + 6; continue;
            }
            if (xml.startsWith('<relation ', lt)) {
                const end = xml.indexOf('>', lt);
                const head = xml.slice(lt, end + 1);
                const id = +attr(head, 'id');
                if (head.endsWith('/>')) { pos = end + 1; continue; }
                const close = xml.indexOf('</relation>', end);
                const body = xml.slice(end, close);
                const members = []; let m; MEM_RE.lastIndex = 0;
                while ((m = MEM_RE.exec(body))) members.push({ type: m[1], ref: +m[2], role: m[3] });
                const prev = rels.get(id);
                if (!prev) rels.set(id, { members, tags: tags(body) || {} });
                pos = close + 11; continue;
            }
            pos = lt + 1;
        }
    }
}
