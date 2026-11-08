#!/usr/bin/env python3
"""Building audit: does every real building of a district world match reality? (dev tooling, any city / district)

Compares a built district (game/data/<city>-<district>.json) with the raw OSM footprints and, when present, the aerial
roof survey (game/research/roofs-<city>-<district>.json):
  * coverage   every OSM building (centroid inside the playable area or the scenery ring) has a game building there
  * position   game centroid vs OSM centroid (m), footprint area kept (game / OSM)
  * height     OSM height / building:levels vs the game height (tagged buildings must match; untagged = estimates)
  * roof       game roof shape vs the aerial class (confident measurements only)
Writes <out>.json (every building) and prints a summary + the worst cases with lat/lon.

  python3 -I tools/osm/building-audit.py --data game/data/bucharest-floreasca.json --osm /tmp/tiles/buc_44.45* /tmp/tiles/buc_44.46* \
      --roofs game/research/roofs-bucharest-floreasca.json --out /tmp/flo-audit
"""
import argparse, glob, json, math, os, sys
import xml.etree.ElementTree as ET


def undelta(arr, start, q=0.1):
    out, x, z = [], 0, 0
    for i in range(start, len(arr) - 1, 2):
        if i == start:
            x, z = arr[i], arr[i + 1]
        else:
            x += arr[i]; z += arr[i + 1]
        out.append((x * q, z * q))
    return out


def area(p):
    return 0.5 * sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p)))


def centroid(p):
    a = area(p)
    if abs(a) < 1e-9:
        return sum(x for x, _ in p) / len(p), sum(z for _, z in p) / len(p)
    cx = cz = 0.0
    for i in range(len(p)):
        x0, z0 = p[i]; x1, z1 = p[(i + 1) % len(p)]; c = x0 * z1 - x1 * z0
        cx += (x0 + x1) * c; cz += (z0 + z1) * c
    return cx / (6 * a), cz / (6 * a)


def interior_point(p):
    """A source point actually inside the ring; a concave courtyard's centroid can lie outside it."""
    c = centroid(p)
    if pip(*c, p):
        return c
    levels = sorted(set(z for _, z in p)); best = None
    for z0, z1 in zip(levels[:-1], levels[1:]):
        z = (z0 + z1) / 2
        xs = sorted(x0 + (x1 - x0) * (z - a) / (b - a) for (x0, a), (x1, b) in zip(p, p[1:] + p[:1]) if (a > z) != (b > z))
        for x0, x1 in zip(xs[::2], xs[1::2]):
            if best is None or x1 - x0 > best[0]:
                best = (x1 - x0, ((x0 + x1) / 2, z))
    return best[1] if best else c


def pip(x, z, p):
    c = False
    for i in range(len(p)):
        x1, z1 = p[i]; x2, z2 = p[i - 1]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1:
            c = not c
    return c


def num(v):
    try:
        return float(str(v).replace('m', '').replace(',', '.').split(';')[0].strip())
    except Exception:  # noqa: BLE001
        return None


def segment_distance(x, z, a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]
    t = max(0, min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / max(1e-12, dx * dx + dz * dz)))
    return math.hypot(x - a[0] - t * dx, z - a[1] - t * dz)


def geometry_margin(x, z, geometry):
    values = [math.hypot(x - c['x'], z - c['z']) - c['r'] for c in geometry.get('circles', [])]
    for piece in geometry.get('pieces', []):
        values += [segment_distance(x, z, a, b) - piece['r'] for a, b in zip(piece['pts'][:-1], piece['pts'][1:])]
    for polygon in geometry.get('polys', []):
        distance = min(segment_distance(x, z, a, b) for a, b in zip(polygon, polygon[1:] + polygon[:1]))
        values.append(-distance if pip(x, z, polygon) else distance)
    return min(values, default=float('inf'))


def assemble_rings(chains):
    """Join OSM member ways by endpoint, keeping closed rings only."""
    pending = [list(p) for p in chains if len(p) >= 2]
    rings = []
    while pending:
        ring = pending.pop(0)
        while ring[0] != ring[-1]:
            found = False
            for i, p in enumerate(pending):
                if ring[-1] == p[0]:
                    ring += p[1:]
                elif ring[-1] == p[-1]:
                    ring += p[-2::-1]
                elif ring[0] == p[-1]:
                    ring = p[:-1] + ring
                elif ring[0] == p[0]:
                    ring = p[:0:-1] + ring
                else:
                    continue
                pending.pop(i); found = True; break
            if not found:
                break
        if len(ring) >= 4 and ring[0] == ring[-1]:
            rings.append(ring)
    return rings


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--osm', nargs='+', required=True)
    ap.add_argument('--roofs', default=None)
    ap.add_argument('--out', default=None)
    ap.add_argument('--ring', type=float, default=350, help='scenery ring width (m) to include beyond the playable area')
    a = ap.parse_args()
    d = json.load(open(a.data))
    S, P = d['strings'], d['proj']
    lat0, lon0, mLat, mLon = P['lat0'], P['lon0'], P['mPerLat'], P['mPerLon']
    proj = lambda la, lo: ((lo - lon0) * mLon * P.get('scale', 1), -(la - lat0) * mLat * P.get('scale', 1))
    roofs = d['roofs']
    source_ids = d.get('buildingIds', [])
    B = []
    for i, b in enumerate(d['buildings']):
        ring = undelta(b, 9)
        if len(ring) < 3:
            continue
        x0 = min(x for x, _ in ring); x1 = max(x for x, _ in ring); z0 = min(z for _, z in ring); z1 = max(z for _, z in ring)
        holes = [undelta(h, 0) for h in d.get('buildingHoles', {}).get(str(i), [])]
        B.append({'i': i, 'source': source_ids[i] if i < len(source_ids) else None, 'ring': ring, 'holes': holes, 'bb': (x0, z0, x1, z1), 'h': b[1] / 10, 'roof': roofs[b[3]], 'flags': b[5], 'levels': b[6], 'c': centroid(ring), 'area': abs(area(ring))})
    by_source = {b['source']: b for b in B if b['source']}
    geometry = d.get('district', {}).get('geometry')
    grid = {}
    G = 30.0
    for o in B:
        x0, z0, x1, z1 = o['bb']
        for gx in range(int(math.floor(x0 / G)), int(math.floor(x1 / G)) + 1):
            for gz in range(int(math.floor(z0 / G)), int(math.floor(z1 / G)) + 1):
                grid.setdefault((gx, gz), []).append(o)
    # playable mask (district.mask RLE, 20 m cells) → distance-ish test: inside, or within --ring of an inside cell
    m = d['district']['mask']; W, H, cell = m['w'], m['h'], m['cell']; mx0, mz0 = m['x0'], m['z0']
    inside = set(); k = 0; on = False
    for run in m['rle']:
        for _ in range(run):
            if on:
                inside.add((k % W, k // W))
            k += 1
        on = not on
    rc = int(math.ceil(a.ring / cell))
    near = set()
    for (cx, cz) in inside:
        for dx in range(-rc, rc + 1):
            for dz in range(-rc, rc + 1):
                if dx * dx + dz * dz <= rc * rc:
                    near.add((cx + dx, cz + dz))
    cellOf = lambda x, z: (int(math.floor((x - mx0) / cell)), int(math.floor((z - mz0) / cell)))
    # OSM footprints
    files = []
    for p in a.osm:
        files += sorted(glob.glob(os.path.join(p, '*.xml'))) if os.path.isdir(p) else [p]
    nodes, ways, relations = {}, {}, {}
    for f in files:
        for ev, el in ET.iterparse(f, events=('end',)):
            if el.tag == 'node':
                nodes[el.get('id')] = (float(el.get('lat')), float(el.get('lon'))); el.clear()
            elif el.tag == 'way':
                t = {x.get('k'): x.get('v') for x in el.iter('tag')}
                ways[el.get('id')] = ([n.get('ref') for n in el.iter('nd')], t)
                el.clear()
            elif el.tag == 'relation':
                t = {x.get('k'): x.get('v') for x in el.iter('tag')}
                if t.get('type') == 'multipolygon' and t.get('building') and t.get('building') != 'no':
                    relations[el.get('id')] = ([(m.get('ref'), m.get('role')) for m in el.iter('member') if m.get('type') == 'way'], t)
                el.clear()
    aer = json.load(open(a.roofs))['roofs'] if a.roofs and os.path.exists(a.roofs) else {}
    rows = []
    for wid, (refs, t) in ways.items():
        if not t.get('building') or t.get('building') == 'no':
            continue
        ll = [nodes[r] for r in refs if r in nodes]
        if len(ll) < 4:
            continue
        ring = [proj(la, lo) for la, lo in ll[:-1]]
        ar = abs(area(ring))
        if ar < 25:
            continue
        cx, cz = centroid(ring)
        c = cellOf(cx, cz)
        margin = geometry_margin(cx, cz, geometry) if geometry else None
        zone = ('inside' if margin <= 0 else 'ring' if margin <= a.ring else None) if geometry else ('inside' if c in inside else 'ring' if c in near else None)
        if not zone:
            continue
        hit = by_source.get('w' + wid)
        candidates = []
        for o in grid.get((int(math.floor(cx / G)), int(math.floor(cz / G))), []):
            x0, z0, x1, z1 = o['bb']
            if x0 <= cx <= x1 and z0 <= cz <= z1 and pip(cx, cz, o['ring']):
                candidates.append(o)
        if not hit and candidates:
            hit = min(candidates, key=lambda o: (abs(math.log(max(o['area'], 1e-9) / ar)), math.hypot(o['c'][0] - cx, o['c'][1] - cz)))
        if not hit:  # nearest game centroid within 8 m (shrunk footprints)
            best = 8.0
            for dx in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for o in grid.get((int(math.floor(cx / G)) + dx, int(math.floor(cz / G)) + dz), []):
                        dd = math.hypot(o['c'][0] - cx, o['c'][1] - cz)
                        if dd < best:
                            best, hit = dd, o
        h_osm = num(t.get('height'))
        lv = num(t.get('building:levels'))
        row = {'osm': 'w' + wid, 'zone': zone, 'type': t.get('building'), 'name': t.get('name'), 'areaOSM': round(ar), 'lat': round(sum(p[0] for p in ll) / len(ll), 6), 'lon': round(sum(p[1] for p in ll) / len(ll), 6),
               'heightOSM': h_osm, 'levelsOSM': lv, 'roofLevelsOSM': num(t.get('roof:levels')) or 0, 'roofOSM': t.get('roof:shape')}
        if margin is not None:
            row['margin'] = round(margin, 1)
        if hit:
            row.update({'game': hit['i'], 'dist': round(math.hypot(hit['c'][0] - cx, hit['c'][1] - cz), 1), 'areaKept': round(hit['area'] / ar, 2), 'hGame': hit['h'], 'roofGame': hit['roof']})
        r = aer.get(wid)
        if r:
            row['roofAerial'] = r[0]; row['roofConf'] = r[1]
        rows.append(row)
    # Relations are reported separately so the existing way-only coverage/roof metrics stay comparable. OSM inner
    # rings are independent source evidence; matching an outer footprint alone does not prove that its courtyard exists.
    relation_rows = []
    for rid, (members, t) in relations.items():
        if any(s in (t.get('building', '') + ' ' + t.get('leisure', '')) for s in ('stadium', 'grandstand', 'sports_centre', 'arena')):
            continue  # the builder's existing annular stand sectors do not have one outer building record
        outers = assemble_rings([ways[w][0] for w, role in members if role != 'inner' and w in ways])
        inners = assemble_rings([ways[w][0] for w, role in members if role == 'inner' and w in ways])
        inner_polys = [[proj(*nodes[n]) for n in r[:-1]] for r in inners if all(n in nodes for n in r)]
        for refs in outers:
            if not all(n in nodes for n in refs):
                continue
            ring = [proj(*nodes[n]) for n in refs[:-1]]; ar = abs(area(ring))
            if ar < 25:
                continue
            cx, cz = centroid(ring); c = cellOf(cx, cz)
            margin = geometry_margin(cx, cz, geometry) if geometry else None
            zone = ('inside' if margin <= 0 else 'ring' if margin <= a.ring else None) if geometry else ('inside' if c in inside else 'ring' if c in near else None)
            if not zone:
                continue
            holes = [h for h in inner_polys if h and all(pip(x, z, ring) for x, z in h)]
            candidates = [b for b in B if b['source'] == 'r' + rid]
            hit = min(candidates, key=lambda b: math.hypot(b['c'][0] - cx, b['c'][1] - cz)) if candidates else None
            ll = [nodes[n] for n in refs[:-1]]
            row = {'osm': 'r' + rid, 'kind': 'relation', 'zone': zone, 'type': t.get('building'), 'name': t.get('name'), 'areaOSM': round(ar), 'lat': round(sum(p[0] for p in ll) / len(ll), 6), 'lon': round(sum(p[1] for p in ll) / len(ll), 6), 'heightOSM': num(t.get('height')), 'levelsOSM': num(t.get('building:levels')), 'roofLevelsOSM': num(t.get('roof:levels')) or 0, 'roofOSM': t.get('roof:shape'), 'holeCountOSM': len(holes), 'holeAreaOSM': round(sum(abs(area(h)) for h in holes), 1)}
            if hit:
                gh = hit['holes']; source_area = sum(abs(area(h)) for h in holes)
                row.update({'game': hit['i'], 'dist': round(math.hypot(hit['c'][0] - cx, hit['c'][1] - cz), 1), 'areaKept': round(hit['area'] / ar, 2), 'hGame': hit['h'], 'roofGame': hit['roof'], 'holeCountGame': len(gh), 'holeAreaGame': round(sum(abs(area(h)) for h in gh), 1), 'holeAreaKept': round(sum(abs(area(h)) for h in gh) / source_area, 2) if source_area else None, 'courtyardInteriorsClear': all(any(pip(*interior_point(h), g) for g in gh) for h in holes)})
            relation_rows.append(row)
    # ---- summary
    def pct(n, tot):
        return f"{n}/{tot} ({100 * n / max(1, tot):.1f} %)"
    for zone in ('inside', 'ring'):
        R = [r for r in rows if r['zone'] == zone]
        big = [r for r in R if r['areaOSM'] >= 40 and r['type'] not in ('garage', 'garages', 'shed', 'roof', 'carport', 'kiosk')]
        miss = [r for r in big if 'game' not in r]
        print(f"== {zone}: {len(R)} OSM footprints ≥ 25 m² ({len(big)} ≥ 40 m², not sheds/garages)")
        print('  matched     ', pct(len(big) - len(miss), len(big)))
        M = [r for r in big if 'game' in r]
        if M:
            ak = sorted(r['areaKept'] for r in M); print(f"  area kept    median {ak[len(ak) // 2]:.2f}, < 0.6 for {sum(1 for v in ak if v < 0.6)}")
            ds = sorted(r['dist'] for r in M); print(f"  centroid off median {ds[len(ds) // 2]:.1f} m, > 3 m for {sum(1 for v in ds if v > 3)}")
        tagged = [r for r in M if r['heightOSM'] or r['levelsOSM']]
        if tagged:
            def want(r):
                return r['heightOSM'] if r['heightOSM'] else r['levelsOSM'] * 3.0 + (r['roofLevelsOSM'] * 2.6 if r['roofGame'] == 'flat' else 0)
            bad = [r for r in tagged if abs(r['hGame'] - want(r)) > max(2.5, 0.25 * want(r))]
            print('  height (OSM-tagged) within ±25 % / 2.5 m:', pct(len(tagged) - len(bad), len(tagged)))
            for r in sorted(bad, key=lambda r: -abs(r['hGame'] - want(r)))[:6]:
                print(f"    {r['osm']} {r['name'] or ''} OSM {r['heightOSM'] or ''} m / {r['levelsOSM'] or ''} lv → game {r['hGame']} m @ {r['lat']},{r['lon']}")
        conf = [r for r in M if r.get('roofConf', 0) >= 0.5 and r.get('roofAerial') in ('flat', 'hipped', 'gabled') and not r['roofOSM']]
        if conf:
            pitched = lambda s: s in ('hipped', 'gabled', 'pyramid', 'skillion', 'mansard', 'dome')
            ok = [r for r in conf if (r['roofAerial'] == 'flat') == (not pitched(r['roofGame']))]
            print('  roof flat/pitched agrees with the aerial survey:', pct(len(ok), len(conf)))
        for r in sorted(miss, key=lambda r: -r['areaOSM'])[:8]:
            print(f"    MISSING {r['osm']} {r['type']} {r['name'] or ''} {r['areaOSM']} m² @ {r['lat']},{r['lon']}")
    for zone in ('inside', 'ring'):
        rr = [r for r in relation_rows if r['zone'] == zone]
        matched = [r for r in rr if 'game' in r]
        courtyard = [r for r in rr if r['holeCountOSM']]
        kept = [r for r in courtyard if r.get('holeCountGame') == r['holeCountOSM'] and r.get('courtyardInteriorsClear')]
        print(f"== {zone} multipolygon relations: {pct(len(matched), len(rr))} source identity matched; courtyards {pct(len(kept), len(courtyard))} count and source interior points preserved (stadium stand sectors excluded)")
        tagged = [r for r in matched if r['heightOSM'] or r['levelsOSM']]
        expected = lambda r: r['heightOSM'] if r['heightOSM'] else r['levelsOSM'] * 3.0 + (r['roofLevelsOSM'] * 2.6 if r['roofGame'] == 'flat' else 0)
        height_ok = [r for r in tagged if abs(r['hGame'] - expected(r)) <= max(2.5, 0.25 * expected(r))]
        print('  relation height (OSM-tagged) within ±25 % / 2.5 m:', pct(len(height_ok), len(tagged)))
        for r in courtyard:
            if r not in kept:
                print(f"    COURTYARD {r['osm']} source={r['holeCountOSM']} game={r.get('holeCountGame', 0)} @ {r['lat']},{r['lon']}")
    if a.out:
        json.dump(rows + relation_rows, open(a.out + '.json', 'w'), indent=0)
        print('wrote', a.out + '.json')


if __name__ == '__main__':
    main()
