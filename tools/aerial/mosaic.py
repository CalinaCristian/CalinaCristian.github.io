#!/usr/bin/env python3
"""Aerial imagery mosaic for reality checks (dev tooling, nothing here ships with the game).

Downloads Esri World Imagery XYZ tiles for a lat/lon bbox (cached, polite: 1 request at a time) and stitches them into
one georeferenced JPEG + a sidecar JSON ({z, x0, y0, w, h, bbox}) so pixel <-> lat/lon is exact (Web Mercator).
The imagery is used only to *measure* the real city (roof shape / colour per footprint, see roofs.py, and the
game-vs-satellite comparison in game/dev/harness/aerial-compare.js). It is never redistributed.
Imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community.

  python3 tools/aerial/mosaic.py --bbox 44.4526,26.0972,44.4694,26.1099 --z 18 --cache /tmp/esri --out /tmp/floreasca
"""
import argparse, json, math, os, sys, time, urllib.request
from PIL import Image

URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'


def tile_xy(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def latlon(px, py, z):
    """global pixel (256-px tiles) -> lat, lon"""
    n = 2 ** z * 256
    lon = px / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * py / n))))
    return lat, lon


def fetch(z, x, y, cache):
    f = os.path.join(cache, f'{z}_{x}_{y}.jpg')
    if os.path.exists(f) and os.path.getsize(f) > 0:
        return f
    req = urllib.request.Request(URL.format(z=z, x=x, y=y), headers={'User-Agent': 'drive-my-cv-dev-tools/1.0'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            with open(f, 'wb') as o:
                o.write(data)
            return f
        except Exception as e:  # noqa: BLE001
            print('retry', z, x, y, e, file=sys.stderr)
            time.sleep(2 ** attempt)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bbox', required=True, help='minlat,minlon,maxlat,maxlon')
    ap.add_argument('--z', type=int, default=18)
    ap.add_argument('--cache', default='/tmp/esri-tiles')
    ap.add_argument('--out', required=True, help='output path without extension')
    a = ap.parse_args()
    la0, lo0, la1, lo1 = map(float, a.bbox.split(','))
    os.makedirs(a.cache, exist_ok=True)
    fx0, fy0 = tile_xy(la1, lo0, a.z)
    fx1, fy1 = tile_xy(la0, lo1, a.z)
    tx0, ty0, tx1, ty1 = int(fx0), int(fy0), int(fx1), int(fy1)
    W, H = (tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256
    img = Image.new('RGB', (W, H))
    n = 0
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            f = fetch(a.z, tx, ty, a.cache)
            if f:
                try:
                    img.paste(Image.open(f).convert('RGB'), ((tx - tx0) * 256, (ty - ty0) * 256))
                except Exception as e:  # noqa: BLE001
                    print('bad tile', f, e, file=sys.stderr)
            n += 1
    img.save(a.out + '.jpg', quality=90)
    meta = {'z': a.z, 'px0': tx0 * 256, 'py0': ty0 * 256, 'w': W, 'h': H, 'bbox': [la0, lo0, la1, lo1],
            'mPerPx': 156543.034 * math.cos(math.radians((la0 + la1) / 2)) / 2 ** a.z,
            'attribution': 'Esri, Maxar, Earthstar Geographics, and the GIS User Community'}
    with open(a.out + '.json', 'w') as o:
        json.dump(meta, o)
    print(f'{n} tiles -> {a.out}.jpg {W}x{H} ({meta["mPerPx"]:.3f} m/px)')


if __name__ == '__main__':
    main()
