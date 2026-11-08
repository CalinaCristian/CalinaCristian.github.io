#!/usr/bin/env python3
"""Building audit: does every real building of a district world match reality? (dev tooling, any city / district)

Compares a built district (game/data/<city>-<district>.json) with the raw OSM footprints and, when present, the aerial
roof survey (game/research/roofs-<city>-<district>.json):
  * coverage   every OSM building whose solid source footprint intersects the playable area or the scenery ring has a game building there
  * position   game centroid vs OSM centroid (m), footprint area kept (game / OSM)
  * height     OSM height / building:levels vs the game height (tagged buildings must match; untagged = estimates)
  * roof       game roof shape vs the aerial class (confident measurements only)
Writes <out>.json (every building) and prints a summary + the worst cases with lat/lon.

  python3 -I tools/osm/building-audit.py --data game/data/bucharest-floreasca.json --osm /tmp/tiles/buc_44.45* /tmp/tiles/buc_44.46* \
      --roofs game/research/roofs-bucharest-floreasca.json --out /tmp/flo-audit
"""
import argparse, glob, json, math, os, sys
import xml.etree.ElementTree as ET
import re


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


def source_ring_issue(points):
    """Independently check literal source validity; never repair the source boundary."""
    ring = [p for i, p in enumerate(points) if i == 0 or p != points[i - 1]]
    if len(ring) > 1 and ring[0] == ring[-1]:
        ring.pop()
    if len(ring) < 3:
        return 'fewer-than-three-distinct-vertices'
    if abs(area(ring)) <= 1e-8:
        return 'zero-source-area'
    cross = lambda a, b: a[0] * b[1] - a[1] * b[0]
    sub = lambda a, b: (a[0] - b[0], a[1] - b[1])
    eps = 1e-8
    edges = list(zip(ring, ring[1:] + ring[:1]))
    for i, (a, b) in enumerate(edges):
        for j, (c, d) in enumerate(edges[i + 1:], i + 1):
            if j == i + 1 or (i == 0 and j == len(edges) - 1):
                continue
            u, v = sub(b, a), sub(d, c)
            den = cross(u, v)
            if abs(den) < eps:
                continue
            t, w = cross(sub(c, a), v) / den, cross(sub(c, a), u) / den
            if eps < t < 1 - eps and eps < w < 1 - eps:
                return 'self-intersecting-source-ring'
    for i, b in enumerate(ring):
        u, v = sub(b, ring[i - 1]), sub(ring[(i + 1) % len(ring)], b)
        if abs(cross(u, v)) < eps and u[0] * v[0] + u[1] * v[1] < -eps:
            return 'self-intersecting-source-ring'
    return None


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


def measure(v):
    """Same strict physical-unit contract as building-roofs.js; no first-number/range guesses."""
    if isinstance(v, (int, float)):
        return float(v) if math.isfinite(v) else None
    s = str(v or '').strip().lower().replace('′', "'").replace('’', "'").replace('″', '"').replace('”', '"')
    f = re.fullmatch(r"([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:ft|feet|foot|')\s*(?:(\d+(?:\.\d*)?|\.\d+)\s*(?:in|inches|inch|\"))?", s)
    if f:
        return float(f[1]) * .3048 + (-1 if float(f[1]) < 0 else 1) * float(f[2] or 0) * .0254
    m = re.fullmatch(r'([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(m|metres?|meters?|cm|mm|in|inches|inch|")?', s)
    if not m:
        return None
    factor = .0254 if m[2] in ('in', 'inches', 'inch', '"') else .01 if m[2] == 'cm' else .001 if m[2] == 'mm' else 1
    return float(m[1]) * factor


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


def segment_segment_distance(a, b, c, d):
    cross = lambda p, q, r: (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
    overlap = max(min(a[0],b[0]),min(c[0],d[0])) <= min(max(a[0],b[0]),max(c[0],d[0]))+1e-9 and max(min(a[1],b[1]),min(c[1],d[1])) <= min(max(a[1],b[1]),max(c[1],d[1]))+1e-9
    if overlap and cross(a,b,c)*cross(a,b,d) <= 0 and cross(c,d,a)*cross(c,d,b) <= 0:
        return 0
    return min(segment_distance(*a,c,d),segment_distance(*b,c,d),segment_distance(*c,a,b),segment_distance(*d,a,b))


def geometry_footprint_margin(outer, geometry, holes=None):
    """Exact edge distance to the authored union; negative means capsule overlap, not penetration depth."""
    holes = holes or []
    rings = [outer] + holes
    edges = [(a,r[(i+1)%len(r)]) for r in rings for i,a in enumerate(r)]
    solid = lambda p: pip(*p,outer) and not any(pip(*p,h) for h in holes)
    line_distance = lambda a,b: 0 if solid(a) or solid(b) else min(segment_segment_distance(a,b,c,d) for c,d in edges)
    values = [line_distance(a,b)-p['r'] for p in geometry.get('pieces',[]) for a,b in zip(p['pts'][:-1],p['pts'][1:])]
    for c in geometry.get('circles',[]):
        point = (c['x'],c['z'])
        values.append((0 if solid(point) else min(segment_distance(*point,a,b) for a,b in edges))-c['r'])
    for polygon in geometry.get('polys',[]):
        if any(solid(p) for p in polygon) or any(pip(*p,polygon) for r in rings for p in r):
            values.append(0)
        else:
            values.extend(line_distance(a,b) for a,b in zip(polygon,polygon[1:]+polygon[:1]))
    return min(values,default=float('inf'))


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
    ap.add_argument('--ring', type=float, default=600, help='scenery ring width (m) to include beyond the playable area')
    a = ap.parse_args()
    d = json.load(open(a.data))
    S, P = d['strings'], d['proj']
    lat0, lon0, mLat, mLon = P['lat0'], P['lon0'], P['mPerLat'], P['mPerLon']
    proj = lambda la, lo: ((lo - lon0) * mLon * P.get('scale', 1), -(la - lat0) * mLat * P.get('scale', 1))
    roofs = d['roofs']
    source_ids = d.get('buildingIds', [])
    B = []
    for i, b in enumerate(d['buildings']):
        ring = d.get('buildingFootprints', {}).get(str(i)) or undelta(b, 9)
        if len(ring) < 3:
            continue
        x0 = min(x for x, _ in ring); x1 = max(x for x, _ in ring); z0 = min(z for _, z in ring); z1 = max(z for _, z in ring)
        holes = d.get('buildingHoleFootprints', {}).get(str(i)) or [undelta(h, 0) for h in d.get('buildingHoles', {}).get(str(i), [])]
        dimensions = d.get('buildingDimensions', {}).get(str(i), [b[1] / 10, b[2] / 10])
        B.append({'i': i, 'source': source_ids[i] if i < len(source_ids) else None, 'ring': ring, 'holes': holes, 'bb': (x0, z0, x1, z1), 'h': dimensions[0], 'minH': dimensions[1], 'roof': roofs[b[3]], 'flags': b[5], 'levels': b[6], 'c': centroid(ring), 'area': abs(area(ring))})
    by_source = {}
    for b in B:
        if b['source']:
            by_source.setdefault(b['source'], []).append(b)
    strict_identity = bool(source_ids)
    source_skips = []

    def source_match(source, ring, holes):
        candidates = by_source.get(source, [])
        c = centroid(ring)
        return min(candidates, key=lambda b: math.dist(b['c'], c)) if candidates else None

    def boundary_error(source, prepared):
        return max((min(segment_distance(*p, a, b) for a, b in zip(prepared, prepared[1:] + prepared[:1])) for p in source), default=float('inf'))

    def match_fields(hit, ring, holes, tags):
        if not hit:
            return {'identityPresent': False, 'matchMethod': 'source-id' if strict_identity else 'legacy-spatial'}
        e = max(boundary_error(ring, hit['ring']), boundary_error(hit['ring'], ring))
        same_holes = len(holes) == len(hit['holes']) and all(any(max(boundary_error(h, g), boundary_error(g, h)) <= .15 for g in hit['holes']) for h in holes)
        height = measure(tags.get('height'))
        minimum = measure(tags.get('min_height'))
        levels = num(tags.get('building:levels'))
        issues = [f'unparsed OSM {k}={tags[k]}' for k in ('height', 'min_height') if tags.get(k) is not None and measure(tags[k]) is None]
        issues += [f'nonpositive OSM height={tags["height"]}'] if height is not None and height <= 0 else []
        return {'identityPresent': True, 'matchedSource': hit['source'], 'matchMethod': 'source-id' if strict_identity else 'legacy-spatial', 'sourceDimensionIssues': issues,
                'boundaryErrorM': round(e, 5), 'topologyMatches': e <= .15 and same_holes,
                'literalHeightMatches': height is None or height <= 0 or abs(hit['h'] - height) <= .011,
                'literalMinimumMatches': minimum is None or minimum <= 0 or abs(hit['minH'] - minimum) <= .011,
                'storeysMatch': levels is None or levels <= 0 or abs(hit['levels'] - levels) < .001}
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
        if not ((t.get('building') and t['building'] != 'no') or (t.get('building:part') and t['building:part'] != 'no')):
            continue
        if len(refs) < 4 or refs[0] != refs[-1] or any(r not in nodes for r in refs):
            source_skips.append({'osm': 'w' + wid, 'reason': 'unclosed-or-incomplete-source-way'})
            continue
        ll = [nodes[r] for r in refs if r in nodes]
        if len(ll) < 4:
            continue
        ring = [proj(la, lo) for la, lo in ll[:-1]]
        ar = abs(area(ring))
        issue = source_ring_issue(ring)
        if issue:
            source_skips.append({'osm': 'w' + wid, 'reason': issue})
            continue
        cx, cz = centroid(ring)
        c = cellOf(cx, cz)
        centroid_margin = geometry_margin(cx, cz, geometry) if geometry else None
        margin = geometry_footprint_margin(ring, geometry) if geometry else None
        zone = ('inside' if margin <= 0 else 'ring' if margin <= a.ring else None) if geometry else ('inside' if c in inside else 'ring' if c in near else None)
        if not zone:
            continue
        hit = source_match('w' + wid, ring, [])
        candidates = []
        for o in grid.get((int(math.floor(cx / G)), int(math.floor(cz / G))), []):
            x0, z0, x1, z1 = o['bb']
            if x0 <= cx <= x1 and z0 <= cz <= z1 and pip(cx, cz, o['ring']):
                candidates.append(o)
        if not strict_identity and not hit and candidates:
            hit = min(candidates, key=lambda o: (abs(math.log(max(o['area'], 1e-9) / ar)), math.hypot(o['c'][0] - cx, o['c'][1] - cz)))
        if not strict_identity and not hit:  # Legacy data lacks source identities; never use this for a source-identity build.
            best = 8.0
            for dx in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for o in grid.get((int(math.floor(cx / G)) + dx, int(math.floor(cz / G)) + dz), []):
                        dd = math.hypot(o['c'][0] - cx, o['c'][1] - cz)
                        if dd < best:
                            best, hit = dd, o
        h_osm = measure(t.get('height'))
        lv = num(t.get('building:levels'))
        row = {'osm': 'w' + wid, 'zone': zone, 'type': t.get('building'), 'name': t.get('name'), 'areaOSM': round(ar), 'lat': round(sum(p[0] for p in ll) / len(ll), 6), 'lon': round(sum(p[1] for p in ll) / len(ll), 6),
               'heightOSM': h_osm, 'levelsOSM': lv, 'roofLevelsOSM': num(t.get('roof:levels')) or 0, 'roofOSM': t.get('roof:shape')}
        if margin is not None:
            row['margin'] = round(margin, 1)
            row['centroidMargin'] = round(centroid_margin, 1)
        row.update(match_fields(hit, ring, [], t))
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
        if not strict_identity and any(s in (t.get('building', '') + ' ' + t.get('leisure', '')) for s in ('stadium', 'grandstand', 'sports_centre', 'arena')):
            continue  # the builder's existing annular stand sectors do not have one outer building record
        outers = assemble_rings([ways[w][0] for w, role in members if role != 'inner' and w in ways])
        inners = assemble_rings([ways[w][0] for w, role in members if role == 'inner' and w in ways])
        inner_polys = [[proj(*nodes[n]) for n in r[:-1]] for r in inners if all(n in nodes for n in r)]
        for refs in outers:
            if not all(n in nodes for n in refs):
                continue
            ring = [proj(*nodes[n]) for n in refs[:-1]]; ar = abs(area(ring))
            issue = source_ring_issue(ring)
            if issue:
                source_skips.append({'osm': 'r' + rid, 'reason': issue})
                continue
            cx, cz = centroid(ring); c = cellOf(cx, cz)
            holes = [h for h in inner_polys if h and all(pip(x, z, ring) for x, z in h)]
            centroid_margin = geometry_margin(cx, cz, geometry) if geometry else None
            margin = geometry_footprint_margin(ring, geometry, holes) if geometry else None
            zone = ('inside' if margin <= 0 else 'ring' if margin <= a.ring else None) if geometry else ('inside' if c in inside else 'ring' if c in near else None)
            if not zone:
                continue
            candidates = [b for b in B if b['source'] == 'r' + rid]
            hit = min(candidates, key=lambda b: math.hypot(b['c'][0] - cx, b['c'][1] - cz)) if candidates else None
            ll = [nodes[n] for n in refs[:-1]]
            row = {'osm': 'r' + rid, 'kind': 'relation', 'zone': zone, 'type': t.get('building'), 'name': t.get('name'), 'areaOSM': round(ar), 'lat': round(sum(p[0] for p in ll) / len(ll), 6), 'lon': round(sum(p[1] for p in ll) / len(ll), 6), 'heightOSM': measure(t.get('height')), 'levelsOSM': num(t.get('building:levels')), 'roofLevelsOSM': num(t.get('roof:levels')) or 0, 'roofOSM': t.get('roof:shape'), 'holeCountOSM': len(holes), 'holeAreaOSM': round(sum(abs(area(h)) for h in holes), 1)}
            if margin is not None:
                row['margin'] = round(margin, 1); row['centroidMargin'] = round(centroid_margin, 1)
            row.update(match_fields(hit, ring, holes, t))
            if hit:
                gh = hit['holes']; source_area = sum(abs(area(h)) for h in holes)
                row.update({'game': hit['i'], 'dist': round(math.hypot(hit['c'][0] - cx, hit['c'][1] - cz), 1), 'areaKept': round(hit['area'] / ar, 2), 'hGame': hit['h'], 'roofGame': hit['roof'], 'holeCountGame': len(gh), 'holeAreaGame': round(sum(abs(area(h)) for h in gh), 1), 'holeAreaKept': round(sum(abs(area(h)) for h in gh) / source_area, 2) if source_area else None, 'courtyardInteriorsClear': all(any(pip(*interior_point(h), g) for g in gh) for h in holes)})
            relation_rows.append(row)
    # ---- summary
    def pct(n, tot):
        return f"{n}/{tot} ({100 * n / max(1, tot):.1f} %)"
    for zone in ('inside', 'ring'):
        R = [r for r in rows if r['zone'] == zone]
        exact = [r for r in R if r.get('identityPresent')]
        print(f"== {zone}: ALL valid positive-area way/part source identities {pct(len(exact), len(R))}; topology {pct(sum(r.get('topologyMatches', False) for r in exact), len(exact))}")
        big = [r for r in R if r['areaOSM'] >= 40 and r['type'] not in ('garage', 'garages', 'shed', 'roof', 'carport', 'kiosk')]
        miss = [r for r in big if 'game' not in r]
        print(f"== {zone}: {sum(r['areaOSM'] >= 25 for r in R)} OSM footprints ≥ 25 m² ({len(big)} ≥ 40 m², not sheds/garages; legacy comparison subset)")
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
        print(f"== {zone} multipolygon relations: {pct(len(matched), len(rr))} source identity matched; courtyards {pct(len(kept), len(courtyard))} count and source interior points preserved (legacy annular sectors excluded only without source identities)")
        tagged = [r for r in matched if r['heightOSM'] or r['levelsOSM']]
        expected = lambda r: r['heightOSM'] if r['heightOSM'] else r['levelsOSM'] * 3.0 + (r['roofLevelsOSM'] * 2.6 if r['roofGame'] == 'flat' else 0)
        height_ok = [r for r in tagged if abs(r['hGame'] - expected(r)) <= max(2.5, 0.25 * expected(r))]
        print('  relation height (OSM-tagged) within ±25 % / 2.5 m:', pct(len(height_ok), len(tagged)))
        for r in courtyard:
            if r not in kept:
                print(f"    COURTYARD {r['osm']} source={r['holeCountOSM']} game={r.get('holeCountGame', 0)} @ {r['lat']},{r['lon']}")
    if a.out:
        json.dump(rows + relation_rows, open(a.out + '.json', 'w'), indent=0)
        json.dump(source_skips, open(a.out + '-source-skips.json', 'w'), indent=1)
        print('wrote', a.out + '.json')


if __name__ == '__main__':
    main()
