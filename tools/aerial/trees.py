#!/usr/bin/env python3
"""Tree crowns from aerial imagery (dev tooling; see mosaic.py). Needs numpy, Pillow and scipy.

OSM maps almost no individual trees in Bucharest's residential quarters, yet from above Floreasca is mostly canopy.
This finds the crowns in a georeferenced mosaic and writes their positions + crown radii, which
tools/osm/build-data.mjs adds as trees (the OSM natural=tree nodes win where mapped; the game still keeps every
trunk off carriageways and out of buildings). Only measurements are stored, never imagery.

  1. vegetation: normalised excess green (2g - r - b) / (r + g + b), with a lower bar in deep shade
  2. tree vs lawn: crowns are rough (local luminance spread) or shaded; mown grass is smooth and bright
  3. building footprints (OSM, registered like roofs.py) are removed: roof gardens / tiled roofs are not trees
  4. crowns: work at ~1 m/px, distance transform of the canopy mask; local maxima (>= 1.8 m from the canopy edge)
     with greedy spacing of 1.05 x the larger crown radius + 1.6 m → one trunk per crown, radius = distance to the edge

  python3 tools/aerial/trees.py --mosaic /tmp/flo18 --osm tilesdir... --out game/research/trees-bucharest-floreasca.json
  [--bbox minlat,minlon,maxlat,maxlon] [--debug /tmp/trees-debug.jpg]
"""
import argparse, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from roofs import load_osm  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mosaic', required=True)
    ap.add_argument('--osm', nargs='+', default=[])
    ap.add_argument('--out', required=True)
    ap.add_argument('--bbox', default=None, help='only keep crowns inside minlat,minlon,maxlat,maxlon')
    ap.add_argument('--debug', default=None, help='write a debug overlay JPEG (canopy mask + crowns) here')
    ap.add_argument('--res', type=float, default=1.0, help='working resolution, metres per pixel')
    ap.add_argument('--ground-out', default=None, help='also write the green ground (lawns, gardens, ground under canopy) as a raster JSON here')
    ap.add_argument('--ground-cell', type=float, default=3.0, help='green ground raster cell, metres')
    a = ap.parse_args()
    meta = json.load(open(a.mosaic + '.json'))
    im = Image.open(a.mosaic + '.jpg').convert('RGB')
    k = max(1, round(a.res / meta['mPerPx']))
    W0, H0 = im.size
    small = im.resize((W0 // k, H0 // k), Image.BILINEAR)
    m_px = meta['mPerPx'] * k
    A = np.asarray(small).astype(np.float32)
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    s = r + g + b + 1
    exg = (2 * g - r - b) / s
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    shade = lum < 70
    veg = ((exg > 0.075) & (g > 45)) | (shade & (exg > 0.035) & (g > 28))
    # roughness: local luminance standard deviation over ~3 m
    mu = ndi.uniform_filter(lum, 3)
    sd = np.sqrt(np.maximum(0, ndi.uniform_filter(lum * lum, 3) - mu * mu))
    tree = veg & ((sd > 8.5) | (shade & (sd > 4)))   # (mown pitches and lawns are smooth even when dark)
    tree = ndi.binary_opening(tree, iterations=1)
    tree = ndi.binary_closing(tree, iterations=1)
    # building footprints out (shifted by the global registration offset roofs.py uses: none here, the mask is coarse)
    n = 2 ** meta['z'] * 256

    def px(lat, lon):
        x = (lon + 180) / 360 * n
        y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
        return (x - meta['px0']) / k, (y - meta['py0']) / k

    def latlon(x, y):
        X = x * k + meta['px0']
        Y = y * k + meta['py0']
        return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * Y / n)))), X / n * 360 - 180

    if a.osm:
        nodes, ways = load_osm(a.osm)
        bm = Image.new('L', (tree.shape[1], tree.shape[0]), 0)
        d = ImageDraw.Draw(bm)
        for refs, t in ways.values():
            pts = [px(*nodes[q]) for q in refs if q in nodes]
            if len(pts) >= 3:
                d.polygon(pts, fill=1)
        tree &= ~np.asarray(bm).astype(bool)
    if a.ground_out:  # green ground: every vegetation pixel (lawns, gardens, ground under the crowns), buildings out
        gmask = veg.copy()
        if a.osm:
            gmask &= ~np.asarray(bm).astype(bool)
        gmask = ndi.binary_closing(gmask, iterations=2)
        cs = max(1, round(a.ground_cell / m_px))
        Hc, Wc = gmask.shape[0] // cs, gmask.shape[1] // cs
        share = gmask[:Hc * cs, :Wc * cs].reshape(Hc, cs, Wc, cs).mean(axis=(1, 3))
        cells = share >= 0.45
        # run-length rows (north → south), alternating off/on starting with off; the grid is axis-aligned in lat/lon
        la0, lo0 = latlon(0, 0)
        la1, lo1 = latlon(Wc * cs, Hc * cs)
        rle = []
        for row in cells:
            cur, cnt = False, 0
            for v in row:
                if bool(v) == cur:
                    cnt += 1
                else:
                    rle.append(cnt)
                    cur, cnt = bool(v), 1
            rle.append(cnt)
            rle.append(-1)  # row end
        gj = {'_source': 'aerial imagery (Esri World Imagery) measured by tools/aerial/trees.py; vegetation raster only, no imagery stored',
              '_format': 'w x h cells over [north, west, south, east]; rle = run lengths per row (off, on, off, …, -1 at each row end)',
              'north': round(la0, 7), 'west': round(lo0, 7), 'south': round(la1, 7), 'east': round(lo1, 7), 'w': int(Wc), 'h': int(Hc),
              'cellM': round(cs * m_px, 3), 'share': round(float(cells.mean()), 3), 'rle': rle}
        with open(a.ground_out, 'w') as f:
            json.dump(gj, f, separators=(',', ':'))
        print('green ground', Wc, 'x', Hc, 'cells, share', gj['share'], '->', a.ground_out)
    dt = ndi.distance_transform_edt(tree) * m_px
    mx = ndi.maximum_filter(dt, size=5)
    cand = np.argwhere((dt >= 1.8) & (dt >= mx - 1e-6))
    vals = dt[cand[:, 0], cand[:, 1]]
    order = np.argsort(-vals)
    kept = []
    grid = {}
    G = 8.0  # metres per bucket
    for i in order:
        y, x = cand[i]
        rr = float(dt[y, x])
        X, Y = x * m_px, y * m_px
        gx, gy = int(X // G), int(Y // G)
        ok = True
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for (qx, qy, qr) in grid.get((gx + dx, gy + dy), ()):
                    if math.hypot(qx - X, qy - Y) < 1.05 * max(rr, qr) + 1.6:
                        ok = False
                        break
                if not ok:
                    break
            if not ok:
                break
        if not ok:
            continue
        grid.setdefault((gx, gy), []).append((X, Y, rr))
        kept.append((x, y, rr))
    bb = list(map(float, a.bbox.split(','))) if a.bbox else None
    out = []
    for x, y, rr in kept:
        la, lo = latlon(x + 0.5, y + 0.5)
        if bb and not (bb[0] <= la <= bb[2] and bb[1] <= lo <= bb[3]):
            continue
        out.append([round(la, 6), round(lo, 6), round(min(rr * 1.15, 9.0), 1)])  # (edge distance underestimates the crown)
    out.sort()
    north, west = latlon(0, 0)
    south, east = latlon(tree.shape[1], tree.shape[0])
    coverage = [south, west, north, east]
    if bb:
        coverage = [max(south, bb[0]), max(west, bb[1]), min(north, bb[2]), min(east, bb[3])]
    meta_out = {'_source': 'aerial imagery (Esri World Imagery) measured by tools/aerial/trees.py; crown positions only, no imagery stored',
                '_format': 'trees: [[lat, lon, crown radius m], ...]', '_mosaic': {'bbox': meta['bbox'], 'z': meta['z']},
                '_coverage': [round(v, 7) for v in coverage],
                'canopyShare': round(float(tree.mean()), 3)}
    with open(a.out, 'w') as f:
        f.write(json.dumps(meta_out, separators=(',', ':'))[:-1] + ',"trees":[\n')
        f.write(',\n'.join(json.dumps(t, separators=(',', ':')) for t in out))
        f.write('\n]}\n')
    print(len(out), 'crowns, canopy share', meta_out['canopyShare'], '->', a.out)
    if a.debug:
        ov = np.asarray(small).copy()
        ov[tree] = (ov[tree] * 0.5 + np.array([0, 160, 255]) * 0.5).astype(np.uint8)
        dbg = Image.fromarray(ov)
        d = ImageDraw.Draw(dbg)
        for x, y, rr in kept:
            R = rr / m_px
            d.ellipse([x - R, y - R, x + R, y + R], outline=(255, 40, 40))
        dbg.save(a.debug, quality=85)


if __name__ == '__main__':
    main()
