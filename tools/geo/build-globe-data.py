"""Build the globe data (game/data/geo/) for game/src/globe.js — see game/data/geo/README.md.

usage: python3 -I tools/geo/build-globe-data.py <ne_geojson_dir> <BlackMarble_2016_01deg.jpg> game/data/geo [tol_deg=0.01]
  <ne_geojson_dir>: ne_50m_land, ne_50m_lakes, ne_50m_admin_0_boundary_lines_land, ne_50m_glaciated_areas .geojson
                    (github.com/nvkelso/natural-earth-vector/tree/master/geojson)
  BlackMarble_2016_01deg.jpg: NASA Earth Observatory "Earth at Night" 2016, 3600 x 1800 (0.1 deg)
needs Pillow + numpy.

ne50m.bin

Binary layout (little endian):
  'NEG1'  magic
  u8 layer count, then per layer: u8 kind (1 land, 2 lakes, 3 borders, 4 ice), varint ring count,
  per ring: varint n, zigzag-varint x0, y0, then n-1 zigzag-varint (dx, dy) pairs. Units 0.01 deg (lon, lat).
  Polygon rings (land / lakes / ice) are counter-clockwise in (lon, lat) and implicitly closed; fill with even-odd
  (the Caspian Sea is a ring inside Eurasia). Borders are open polylines.
"""
import json, math, sys, struct

ne, bm, out = sys.argv[1], sys.argv[2], sys.argv[3]
TOL = float(sys.argv[4]) if len(sys.argv) > 4 else 0.01
Q = 100  # 0.01 deg


def dp(pts, tol):
    """Douglas-Peucker on (lon, lat) with lon scaled by cos(lat) (degrees)."""
    if len(pts) < 3:
        return pts[:]
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        ax, ay = pts[a]; bx, by = pts[b]
        k = math.cos(math.radians((ay + by) / 2))
        dx, dy = (bx - ax) * k, by - ay
        L = math.hypot(dx, dy)
        best, bi = -1, -1
        for i in range(a + 1, b):
            px, py = (pts[i][0] - ax) * k, pts[i][1] - ay
            d = abs(px * dy - py * dx) / L if L > 1e-12 else math.hypot(px, py)
            if d > best:
                best, bi = d, i
        if best > tol:
            keep[bi] = True
            stack.append((a, bi)); stack.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]


def simplify_ring(r, tol):
    r = r[:-1] if len(r) > 1 and r[0] == r[-1] else r[:]
    if len(r) < 4:
        return r
    # split the closed ring at the point farthest from the first so DP keeps a stable shape
    far = max(range(len(r)), key=lambda i: (r[i][0] - r[0][0]) ** 2 + (r[i][1] - r[0][1]) ** 2)
    a = dp(r[:far + 1], tol); b = dp(r[far:] + [r[0]], tol)
    return a[:-1] + b[:-1]


def quant(r):
    q = []
    for x, y in r:
        p = (int(round(x * Q)), int(round(y * Q)))
        if not q or q[-1] != p:
            q.append(p)
    return q


def area(q):
    s = 0
    for i in range(len(q)):
        x0, y0 = q[i]; x1, y1 = q[(i + 1) % len(q)]
        s += x0 * y1 - x1 * y0
    return s / 2


def densify(q, closed, step=100):
    """insert points on edges longer than `step` units (1 deg), linear in lon/lat (keeps parallels / seams straight)"""
    o = []
    n = len(q)
    for i in range(n if closed else n - 1):
        x0, y0 = q[i]; x1, y1 = q[(i + 1) % n]
        o.append((x0, y0))
        L = max(abs(x1 - x0), abs(y1 - y0))
        if L > step:
            k = int(math.ceil(L / step))
            for j in range(1, k):
                o.append((int(round(x0 + (x1 - x0) * j / k)), int(round(y0 + (y1 - y0) * j / k))))
    if not closed:
        o.append(q[-1])
    return o


def rings_of(path, kinds=('Polygon', 'MultiPolygon')):
    g = json.load(open(path))
    for ft in g['features']:
        gm = ft['geometry']
        if gm is None:
            continue
        polys = [gm['coordinates']] if gm['type'] == 'Polygon' else gm['coordinates'] if gm['type'] == 'MultiPolygon' else []
        for p in polys:
            for i, r in enumerate(p):
                yield ft['properties'], i, [(c[0], c[1]) for c in r]


def lines_of(path):
    g = json.load(open(path))
    for ft in g['features']:
        gm = ft['geometry']
        ls = [gm['coordinates']] if gm['type'] == 'LineString' else gm['coordinates']
        for l in ls:
            yield ft['properties'], [(c[0], c[1]) for c in l]


def poly_layer(path, tol, min_area=0.0, keep=lambda p, i: True):
    out = []
    for props, i, r in rings_of(path):
        if not keep(props, i):
            continue
        q = quant(simplify_ring(r, tol))
        if len(q) < 3:
            continue
        a = area(q)
        if abs(a) < min_area * Q * Q:
            continue
        if a < 0:
            q.reverse()
        out.append(densify(q, True))
    return out


def line_layer(path, tol):
    out = []
    for props, l in lines_of(path):
        q = quant(dp(l, tol))
        if len(q) >= 2:
            out.append(densify(q, False))
    return out


def uvar(v, b):
    while True:
        x = v & 0x7F; v >>= 7
        if v:
            b.append(x | 0x80)
        else:
            b.append(x); return


def zz(v):
    return (v << 1) if v >= 0 else ((-v << 1) - 1)


def enc(layers):
    b = bytearray(b'NEG1')
    b.append(len(layers))
    for kind, rings in layers:
        b.append(kind); uvar(len(rings), b)
        for r in rings:
            uvar(len(r), b)
            px, py = 0, 0
            for j, (x, y) in enumerate(r):
                uvar(zz(x - px), b); uvar(zz(y - py), b); px, py = x, y
    return bytes(b)


land = poly_layer(f'{ne}/ne_50m_land.geojson', TOL, min_area=0.0004)
lakes = poly_layer(f'{ne}/ne_50m_lakes.geojson', TOL, min_area=0.12)  # the big lakes (+ their islands, even-odd)
borders = line_layer(f'{ne}/ne_50m_admin_0_boundary_lines_land.geojson', TOL)
ice = poly_layer(f'{ne}/ne_50m_glaciated_areas.geojson', TOL * 1.5, min_area=0.02)
layers = [(1, land), (2, lakes), (3, borders), (4, ice)]
data = enc(layers)
open(f'{out}/ne50m.bin', 'wb').write(data)
for k, rs in layers:
    print('layer', k, 'rings', len(rs), 'pts', sum(len(r) for r in rs))
print('ne50m.bin', len(data), 'bytes, tol', TOL)

# ---- NASA Black Marble 2016 (0.1 deg) -> grayscale city-lights mask, equirectangular 2880 x 1440 (lon -180..180, lat 90..-90)
if bm != '-':
    import os
    import numpy as np
    from PIL import Image
    a = np.asarray(Image.open(bm).convert('RGB')).astype(np.float32)
    # the lights are warm (R >= B); Black Marble's moonlit land / ocean background is blue-violet: keep only the lights
    v = np.clip((a[..., 0] - 0.62 * a[..., 2] - 12) / (255 - 0.62 * 255 - 12), 0, 1) ** 0.8
    img = Image.fromarray((v * 255 + 0.5).astype(np.uint8), 'L').resize((2880, 1440), Image.LANCZOS)
    img.save(f'{out}/lights.jpg', quality=68, optimize=True)
    print('lights.jpg', os.path.getsize(f'{out}/lights.jpg'), 'bytes')
