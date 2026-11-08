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
    B = []
    for i, b in enumerate(d['buildings']):
        ring = undelta(b, 9)
        if len(ring) < 3:
            continue
        x0 = min(x for x, _ in ring); x1 = max(x for x, _ in ring); z0 = min(z for _, z in ring); z1 = max(z for _, z in ring)
        B.append({'i': i, 'ring': ring, 'bb': (x0, z0, x1, z1), 'h': b[1] / 10, 'roof': roofs[b[3]], 'flags': b[5], 'levels': b[6], 'c': centroid(ring), 'area': abs(area(ring))})
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
    nodes, ways = {}, {}
    for f in files:
        for ev, el in ET.iterparse(f, events=('end',)):
            if el.tag == 'node':
                nodes[el.get('id')] = (float(el.get('lat')), float(el.get('lon'))); el.clear()
            elif el.tag == 'way':
                t = {x.get('k'): x.get('v') for x in el.iter('tag')}
                if t.get('building') and t.get('building') != 'no':
                    ways[el.get('id')] = ([n.get('ref') for n in el.iter('nd')], t)
                el.clear()
            elif el.tag == 'relation':
                el.clear()
    aer = json.load(open(a.roofs))['roofs'] if a.roofs and os.path.exists(a.roofs) else {}
    rows = []
    for wid, (refs, t) in ways.items():
        ll = [nodes[r] for r in refs if r in nodes]
        if len(ll) < 4:
            continue
        ring = [proj(la, lo) for la, lo in ll[:-1]]
        ar = abs(area(ring))
        if ar < 25:
            continue
        cx, cz = centroid(ring)
        c = cellOf(cx, cz)
        zone = 'inside' if c in inside else 'ring' if c in near else None
        if not zone:
            continue
        hit = None
        for o in grid.get((int(math.floor(cx / G)), int(math.floor(cz / G))), []):
            x0, z0, x1, z1 = o['bb']
            if x0 <= cx <= x1 and z0 <= cz <= z1 and pip(cx, cz, o['ring']):
                hit = o; break
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
               'heightOSM': h_osm, 'levelsOSM': lv, 'roofOSM': t.get('roof:shape')}
        if hit:
            row.update({'game': hit['i'], 'dist': round(math.hypot(hit['c'][0] - cx, hit['c'][1] - cz), 1), 'areaKept': round(hit['area'] / ar, 2), 'hGame': hit['h'], 'roofGame': hit['roof']})
        r = aer.get(wid)
        if r:
            row['roofAerial'] = r[0]; row['roofConf'] = r[1]
        rows.append(row)
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
                return r['heightOSM'] if r['heightOSM'] else r['levelsOSM'] * 3.0
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
    if a.out:
        json.dump(rows, open(a.out + '.json', 'w'), indent=0)
        print('wrote', a.out + '.json')


if __name__ == '__main__':
    main()
