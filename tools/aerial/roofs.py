#!/usr/bin/env python3
"""Measure every OSM building's roof from aerial imagery (dev tooling; see mosaic.py).

For each building footprint (OSM ways with building=*) inside the mosaic: shrink the footprint toward its centroid
(OSM vs imagery registration is off by a metre or two), sample the pixels, and measure
  * colour   - median roof colour (#rrggbb)
  * red      - how tile-red it is (r - max(g, b) on the median)
  * facet    - brightness difference between the two halves across the long axis / the short axis (a pitched roof
               has a lit and a shaded side; a flat roof is even). Vents / AC units make flat roofs noisy, so the
               halves are compared with medians.
  * shape    - flat | gabled | hipped (classification below), conf 0..1
Output: JSON {"<wayId>": {...}} (consumed by tools/osm/build-data.mjs as a research layer: OSM roof tags still win).

  python3 tools/aerial/roofs.py --mosaic /tmp/floreasca --osm tilesdir_or_files... --out game/research/roofs-bucharest-floreasca.json
"""
import argparse, glob, json, math, os, sys
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw


def load_osm(paths):
    nodes, ways = {}, {}
    files = []
    for p in paths:
        files += sorted(glob.glob(os.path.join(p, '*.xml')) + glob.glob(os.path.join(p, '*.osm'))) if os.path.isdir(p) else [p]
    for f in files:
        for ev, el in ET.iterparse(f, events=('end',)):
            if el.tag == 'node':
                nodes[el.get('id')] = (float(el.get('lat')), float(el.get('lon')))
                el.clear()
            elif el.tag == 'way':
                t = {x.get('k'): x.get('v') for x in el.iter('tag')}
                if 'building' in t or 'building:part' in t:
                    ways[el.get('id')] = ([n.get('ref') for n in el.iter('nd')], t)
                el.clear()
            elif el.tag == 'relation':
                el.clear()
    return nodes, ways


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mosaic', required=True)
    ap.add_argument('--osm', nargs='+', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--shrink', type=float, default=0.72)
    ap.add_argument('--full', action='store_true', help='write every measurement (calibration); default: compact [shape, conf, colour, areaM2]')
    ap.add_argument('--search', type=float, default=3.0, help='per-footprint registration search radius around the global offset, metres')
    a = ap.parse_args()
    meta = json.load(open(a.mosaic + '.json'))
    img = np.asarray(Image.open(a.mosaic + '.jpg').convert('RGB')).astype(np.float32)
    H, W = img.shape[:2]
    # registration: OSM outlines and the imagery disagree by a few metres (georeferencing + relief displacement: a roof
    # is drawn shifted away from nadir in proportion to the building's height), so every footprint is moved to the
    # offset where its outline sits on the strongest image edges (gradient magnitude), with a small pull toward the
    # median offset of all footprints
    gray = img @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    gy_, gx_ = np.gradient(gray)
    G = np.hypot(gx_, gy_)
    srch = max(1, int(round(a.search / meta['mPerPx'])))

    def outline_samples(P):
        S = []
        for (ax, ay), (bx, by) in zip(P[:-1], P[1:]):
            L = math.hypot(bx - ax, by - ay)
            for k in range(max(1, int(L))):
                S.append((ax + (bx - ax) * k / L, ay + (by - ay) * k / L))
        return np.array(S)

    def edge_score(S, dx, dy):
        X = np.round(S[:, 0] + dx).astype(int)
        Y = np.round(S[:, 1] + dy).astype(int)
        ok = (X >= 0) & (Y >= 0) & (X < W) & (Y < H)
        return float(G[Y[ok], X[ok]].mean()) if ok.any() else 0.0

    g0 = [0, 0]

    def register(P):
        S = outline_samples(P)
        if len(S) < 8:
            return g0[0], g0[1], 0.0
        base = edge_score(S, g0[0], g0[1])
        best = (base, g0[0], g0[1])
        for dy in range(-srch, srch + 1):
            for dx in range(-srch, srch + 1):
                if dx * dx + dy * dy > srch * srch:
                    continue
                v = edge_score(S, g0[0] + dx, g0[1] + dy) * (1 - 0.012 * math.hypot(dx, dy))
                if v > best[0]:
                    best = (v, g0[0] + dx, g0[1] + dy)
        return best[1], best[2], (best[0] - base) / max(1.0, base)
    n = 2 ** meta['z'] * 256

    def px(lat, lon):
        x = (lon + 180) / 360 * n
        y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
        return x - meta['px0'], y - meta['py0']

    nodes, ways = load_osm(a.osm)
    # global offset first (all outlines together), then each footprint within --search of it
    allS = []
    for wid, (refs, t) in ways.items():
        pts = [px(*nodes[r]) for r in refs if r in nodes]
        if len(pts) >= 4:
            allS.append(outline_samples(np.array(pts)))
    if allS:
        AS = np.concatenate(allS)
        best = (-1, 0, 0)
        for dy in range(-30, 31, 2):
            for dx in range(-30, 31, 2):
                v = edge_score(AS, dx, dy)
                if v > best[0]:
                    best = (v, dx, dy)
        for dy in range(best[2] - 2, best[2] + 3):
            for dx in range(best[1] - 2, best[1] + 3):
                v = edge_score(AS, dx, dy)
                if v > best[0]:
                    best = (v, dx, dy)
        g0[0], g0[1] = best[1], best[2]
        print('global offset', round(g0[0] * meta['mPerPx'], 2), 'm E,', round(-g0[1] * meta['mPerPx'], 2), 'm N', file=sys.stderr)
    out = {}
    for wid, (refs, t) in ways.items():
        if t.get('building:part') and not t.get('building'):
            continue
        pts = [px(*nodes[r]) for r in refs if r in nodes]
        if len(pts) < 4:
            continue
        P = np.array(pts)
        if P[:, 0].min() < 0 or P[:, 1].min() < 0 or P[:, 0].max() >= W or P[:, 1].max() >= H:
            continue
        rdx, rdy, rgain = register(P)
        P = P + np.array([rdx, rdy])
        if P[:, 0].min() < 0 or P[:, 1].min() < 0 or P[:, 0].max() >= W or P[:, 1].max() >= H:
            continue
        c = P.mean(axis=0)
        Ps = c + (P - c) * a.shrink
        area_px = abs(0.5 * np.sum(P[:-1, 0] * P[1:, 1] - P[1:, 0] * P[:-1, 1]))
        area_m2 = area_px * meta['mPerPx'] ** 2
        if area_m2 < 25:
            continue
        x0, y0 = np.floor(Ps.min(axis=0)).astype(int)
        x1, y1 = np.ceil(Ps.max(axis=0)).astype(int) + 1
        m = Image.new('L', (x1 - x0, y1 - y0), 0)
        ImageDraw.Draw(m).polygon([(x - x0, y - y0) for x, y in Ps], fill=1)
        mask = np.asarray(m).astype(bool)
        if mask.sum() < 12:
            continue
        sub = img[y0:y1, x0:x1][mask]
        med = np.median(sub, axis=0)
        r, g, b = med
        red = float(r - max(g, b))
        lum = sub @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
        # principal axis of the footprint
        Q = P - c
        cov = Q[:-1].T @ Q[:-1]
        ev, evec = np.linalg.eigh(cov)
        long_ax = evec[:, 1]
        short_ax = evec[:, 0]
        ratio = math.sqrt(max(ev[1], 1e-6) / max(ev[0], 1e-6))
        yy, xx = np.nonzero(mask)
        rel = np.stack([xx + x0 - c[0], yy + y0 - c[1]], axis=1)

        def halves(ax):
            s = rel @ np.array([-ax[1], ax[0]])  # side of the line through the centroid along `ax`
            A, B = lum[s > 0.5], lum[s < -0.5]
            if len(A) < 6 or len(B) < 6:
                return 0.0
            ma, mb = np.median(A), np.median(B)
            return float(abs(ma - mb) / max(1.0, (ma + mb) / 2))
        f_long = halves(long_ax)   # across the ridge of a gabled roof
        f_short = halves(short_ax)
        facet = max(f_long, f_short)
        spread = float(np.percentile(lum, 85) - np.percentile(lum, 15)) / max(1.0, float(np.median(lum)))
        # classification (calibrated on Floreasca crops, 2026-11-08): the roof colour is the reliable signal — red / brown
        # clay tiles are pitched; dark bitumen, light membrane and gravel are flat. Lit / shaded halves (facet) only
        # decide between pitched and flat for small grey roofs (metal / concrete-tile villas), because cast shadows
        # and rooftop plant fool it on large ones. Tree crowns (green) and deep shadow make the sample unusable.
        exg = 2 * sub[:, 1] - sub[:, 0] - sub[:, 2]                     # excess green: tree crowns over the roof
        gfrac = float(np.mean((exg > 34) & (sub[:, 1] > 55)))
        dark = float(np.median(lum)) < 40                                  # deep shadow (dark bitumen is ~60-110)
        tile = red > 16 and r > 80 and gfrac < 0.5
        if tile:
            shape = 'gabled' if (ratio > 2.0 and f_long > f_short * 1.3) else 'hipped'
            conf = min(1.0, 0.45 + (red - 16) / 50) * (1 - gfrac * 0.6)
        elif gfrac > 0.45 or dark:
            shape, conf = 'unknown', 0.0
        elif facet > 0.3 and spread > 0.35 and float(np.median(lum)) > 70:
            # Romană's grey sheet-metal historic roofs can be much larger than Floreasca's villas. Strong lit/shaded
            # halves alone cannot distinguish them from plant/shadows on a flat roof: keep the observation uncertain
            # instead of confidently flattening a pitched roof. OSM roof tags still win in the builder.
            shape = 'hipped'                    # (grey metal / concrete tiles; weak evidence: consumers want conf >= 0.5)
            conf = 0.4
        elif ratio > 2.4 and area_m2 > 250:   # evenly lit long slab blocks
            shape, conf = 'flat', 0.8
        else:
            shape = 'flat'
            conf = min(1.0, 0.55 + (0.2 if area_m2 > 300 else 0) + (0.15 if red < 6 else 0) - gfrac * 0.5)
        if shape == 'flat' and (t.get('amenity') == 'place_of_worship' or t.get('building') in ('church', 'cathedral', 'chapel', 'religious', 'mosque', 'synagogue', 'temple')):
            # A median-colour sample cannot resolve a church's domes, towers and compound metal roof. Do not flatten
            # that roof as a supposedly confident measurement; preserve OSM/landmark handling.
            shape, conf = 'unknown', 0.0
        out[wid] = {'shape': shape, 'conf': round(conf, 2), 'colour': '#%02x%02x%02x' % tuple(int(v) for v in med),
                    'red': round(red, 1), 'facet': round(facet, 3), 'spread': round(spread, 3), 'ratio': round(ratio, 2),
                    'areaM2': round(area_m2), 'building': t.get('building'), 'levels': t.get('building:levels'),
                    'shift': [round(rdx * meta['mPerPx'], 1), round(-rdy * meta['mPerPx'], 1)], 'green': round(gfrac, 2)}
    meta_out = {'_source': 'aerial imagery (Esri World Imagery) measured by tools/aerial/roofs.py; attributes only, no imagery stored',
                '_mosaic': {'bbox': meta['bbox'], 'z': meta['z'], 'mPerPx': round(meta['mPerPx'], 3)}}
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    if not a.full:
        out = {k: [v['shape'], v['conf'], v['colour'], v['areaM2']] for k, v in out.items()}
        meta_out['_format'] = 'roofs: {"<osm way id>": [shape flat|hipped|gabled|unknown, conf 0..1, median roof colour, footprint m2]}'
    with open(a.out, 'w') as f:
        f.write(json.dumps({**meta_out}, separators=(',', ':'))[:-1] + ',"roofs":{\n')
        f.write(',\n'.join(json.dumps(k) + ':' + json.dumps(v, separators=(',', ':')) for k, v in sorted(out.items(), key=lambda kv: int(kv[0]))))
        f.write('\n}}\n')
    cnt = {}
    for v in out.values():
        sh = v['shape'] if isinstance(v, dict) else v[0]
        cnt[sh] = cnt.get(sh, 0) + 1
    print(len(out), 'roofs', cnt, '->', a.out)


if __name__ == '__main__':
    main()
